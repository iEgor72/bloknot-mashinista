from __future__ import annotations

import copy
import hashlib
import json
import math
import statistics
from collections import Counter, defaultdict
from pathlib import Path

from . import BUILDER_VERSION
from .axis import extract_km_axis, fit_km_axis
from .common import find_seed_element, parse_page_range, snap_grade
from .pdf_io import PdfBuilderError, load_vector_pdf
from .adapters import blue_bottom_table, diagonal_grade_table


MANUAL_PDF_CONFIDENCE = {
    "verified",
    "pdf_table_trace_verified",
    "pdf_vector_confirmed",
    "manual_reviewed",
    "pdf_manual_evidence_replayed",
}


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _resolve_path(value: str | None, base_dir: Path) -> Path | None:
    if not value:
        return None
    path = Path(value).expanduser()
    return path if path.is_absolute() else (base_dir / path).resolve()


def _normalize_page_windows(value: object, snap_m: int) -> list[dict]:
    if not isinstance(value, list):
        raise PdfBuilderError("page_windows must be an array")
    normalized: list[dict] = []
    seen_ids: set[str] = set()
    for raw in value:
        if not isinstance(raw, dict):
            raise PdfBuilderError("every page_windows item must be an object")
        window_id = str(raw.get("id", "")).strip()
        if not window_id or window_id in seen_ids:
            raise PdfBuilderError("page_windows ids must be non-empty and unique")
        try:
            page = int(raw.get("page"))
        except (TypeError, ValueError) as error:
            raise PdfBuilderError("page_windows page must be a positive integer") from error
        if page <= 0:
            raise PdfBuilderError("page_windows page must be a positive integer")
        keep_m = raw.get("keep_m")
        if not isinstance(keep_m, list) or len(keep_m) != 2:
            raise PdfBuilderError("page_windows keep_m must contain [start_m, end_m]")
        try:
            keep_start, keep_end = (int(keep_m[0]), int(keep_m[1]))
        except (TypeError, ValueError) as error:
            raise PdfBuilderError("page_windows keep_m values must be integers") from error
        if keep_end <= keep_start:
            raise PdfBuilderError("page_windows keep_m must be an increasing range")
        if keep_start % snap_m or keep_end % snap_m:
            raise PdfBuilderError("page_windows keep_m values must be multiples of snap_m")

        item = {
            "id": window_id,
            "page": page,
            "keep_m": [keep_start, keep_end],
        }
        axis_override = raw.get("axis_override")
        if axis_override is not None:
            if not isinstance(axis_override, dict):
                raise PdfBuilderError("page_windows axis_override must be an object")
            required = ("left_x", "left_m", "right_x", "right_m")
            if any(axis_override.get(key) is None for key in required):
                raise PdfBuilderError(
                    "page_windows axis_override requires left_x, left_m, right_x, right_m"
                )
            try:
                left_x = float(axis_override["left_x"])
                right_x = float(axis_override["right_x"])
                left_m = int(axis_override["left_m"])
                right_m = int(axis_override["right_m"])
            except (TypeError, ValueError) as error:
                raise PdfBuilderError("page_windows axis_override values must be numeric") from error
            if not all(math.isfinite(value) for value in (left_x, right_x)) or right_x <= left_x:
                raise PdfBuilderError("page_windows axis_override requires finite left_x < right_x")
            if left_m == right_m or left_m % snap_m or right_m % snap_m:
                raise PdfBuilderError(
                    "page_windows axis_override chainage must differ and follow snap_m"
                )
            axis_start, axis_end = sorted((left_m, right_m))
            if keep_start < axis_start or keep_end > axis_end:
                raise PdfBuilderError(
                    "page_windows keep_m must stay inside the axis_override chainage range"
                )
            item["axis_override"] = {
                "left_x": left_x,
                "left_m": left_m,
                "right_x": right_x,
                "right_m": right_m,
            }
        normalized.append(item)
        seen_ids.add(window_id)

    by_page: dict[int, list[dict]] = defaultdict(list)
    for item in normalized:
        by_page[int(item["page"])].append(item)
    for page, windows in by_page.items():
        ordered_keep = sorted(windows, key=lambda item: int(item["keep_m"][0]))
        if any(
            int(left["keep_m"][1]) > int(right["keep_m"][0])
            for left, right in zip(ordered_keep, ordered_keep[1:])
        ):
            raise PdfBuilderError(f"page_windows keep_m ranges overlap on page {page}")
        remapped = [item for item in windows if item.get("axis_override")]
        ordered_x = sorted(remapped, key=lambda item: float(item["axis_override"]["left_x"]))
        if any(
            float(left["axis_override"]["right_x"])
            > float(right["axis_override"]["left_x"]) + 1e-6
            for left, right in zip(ordered_x, ordered_x[1:])
        ):
            raise PdfBuilderError(f"page_windows axis_override ranges overlap on page {page}")
    return normalized


def _normalize_page_priorities(value: object) -> dict[str, int]:
    if not isinstance(value, dict):
        raise PdfBuilderError("page_priorities must be an object")
    result: dict[str, int] = {}
    for raw_page, raw_priority in value.items():
        try:
            page = int(raw_page)
        except (TypeError, ValueError) as error:
            raise PdfBuilderError("page_priorities keys must be positive integers") from error
        if page <= 0:
            raise PdfBuilderError("page_priorities keys must be positive integers")
        if isinstance(raw_priority, bool) or not isinstance(raw_priority, int):
            raise PdfBuilderError("page_priorities values must be integers")
        result[str(page)] = int(raw_priority)
    return result


def _normalize_allowed_profile_gaps(
    value: object,
    snap_m: int,
    range_start_m: int,
    range_end_m: int,
) -> list[dict]:
    if not isinstance(value, list):
        raise PdfBuilderError("allowed_profile_gaps must be an array")
    normalized: list[dict] = []
    for raw in value:
        if not isinstance(raw, dict):
            raise PdfBuilderError("every allowed_profile_gaps item must be an object")
        try:
            start_m = int(raw.get("start_m"))
            end_m = int(raw.get("end_m"))
        except (TypeError, ValueError) as error:
            raise PdfBuilderError(
                "allowed_profile_gaps start_m and end_m must be integers"
            ) from error
        if (
            end_m <= start_m
            or start_m % snap_m
            or end_m % snap_m
            or start_m < range_start_m
            or end_m > range_end_m
        ):
            raise PdfBuilderError(
                "allowed_profile_gaps must be increasing snap-aligned ranges inside the section"
            )
        reason = str(raw.get("reason", "")).strip()
        if not reason:
            raise PdfBuilderError("allowed_profile_gaps reason is required")
        normalized.append({"start_m": start_m, "end_m": end_m, "reason": reason})
    normalized.sort(key=lambda item: (item["start_m"], item["end_m"]))
    if any(
        int(left["end_m"]) > int(right["start_m"])
        for left, right in zip(normalized, normalized[1:])
    ):
        raise PdfBuilderError("allowed_profile_gaps must not overlap")
    return normalized


def load_config(path: Path) -> dict:
    payload = _read_json(path)
    if str(payload.get("schema_version", "")) != "1.0":
        raise PdfBuilderError("builder config requires schema_version=1.0")
    for key in ("id", "pdf", "km_start_m", "km_end_m"):
        if payload.get(key) in (None, ""):
            raise PdfBuilderError(f"builder config field is required: {key}")
    base_dir = path.resolve().parent
    payload = copy.deepcopy(payload)
    payload["config_path"] = str(path.resolve())
    payload["pdf"] = str(_resolve_path(str(payload["pdf"]), base_dir))
    compare_seed = _resolve_path(payload.get("compare_seed"), base_dir)
    payload["compare_seed"] = str(compare_seed) if compare_seed else None
    payload.setdefault("adapter", "auto")
    payload.setdefault("snap_m", 100)
    payload.setdefault("review_dpi", 220)
    payload.setdefault("max_review_crops", 40)
    payload.setdefault("excluded_pages", [])
    payload.setdefault("profile_pages", None)
    payload.setdefault("page_coordinate_offsets_m", {})
    payload.setdefault("page_windows", [])
    payload.setdefault("page_priorities", {})
    payload.setdefault("allowed_profile_gaps", [])
    # Explicit opt-in for migrating an existing legacy/XML profile.  The seed
    # may align boundaries, but never becomes PDF confidence by itself.
    payload.setdefault("reconcile_seed_order", False)
    if not isinstance(payload["reconcile_seed_order"], bool):
        raise PdfBuilderError("reconcile_seed_order must be a boolean")
    if not isinstance(payload["page_coordinate_offsets_m"], dict):
        raise PdfBuilderError("page_coordinate_offsets_m must be an object")
    snap_m = int(payload["snap_m"])
    if snap_m <= 0:
        raise PdfBuilderError("snap_m must be a positive integer")
    normalized_page_offsets: dict[str, int] = {}
    for raw_page, raw_offset in payload["page_coordinate_offsets_m"].items():
        try:
            page_number = int(raw_page)
            offset_m = int(raw_offset)
        except (TypeError, ValueError) as error:
            raise PdfBuilderError(
                "page_coordinate_offsets_m keys and values must be integers"
            ) from error
        if page_number <= 0:
            raise PdfBuilderError("page_coordinate_offsets_m page numbers must be positive")
        if offset_m % snap_m:
            raise PdfBuilderError(
                "page_coordinate_offsets_m values must be multiples of snap_m"
            )
        normalized_page_offsets[str(page_number)] = offset_m
    payload["page_coordinate_offsets_m"] = normalized_page_offsets
    payload["page_windows"] = _normalize_page_windows(payload["page_windows"], snap_m)
    payload["page_priorities"] = _normalize_page_priorities(payload["page_priorities"])
    payload["range_start_m"] = min(int(payload["km_start_m"]), int(payload["km_end_m"]))
    payload["range_end_m"] = max(int(payload["km_start_m"]), int(payload["km_end_m"]))
    payload["allowed_profile_gaps"] = _normalize_allowed_profile_gaps(
        payload["allowed_profile_gaps"],
        snap_m,
        payload["range_start_m"],
        payload["range_end_m"],
    )
    return payload


def load_seed_elements(config: dict) -> tuple[list[dict], dict | None]:
    seed_path = config.get("compare_seed")
    if not seed_path:
        return [], None
    path = Path(seed_path)
    if not path.is_file():
        raise PdfBuilderError(f"compare_seed not found: {path}")
    payload = _read_json(path)
    if isinstance(payload, list):
        elements = payload
    else:
        elements = payload.get("elements") or []
    if not isinstance(elements, list):
        raise PdfBuilderError("compare_seed must contain an elements array")
    return [dict(element) for element in elements], payload if isinstance(payload, dict) else None


def _adapter_modules() -> dict[str, object]:
    from .adapters import black_grade_strokes

    return {
        blue_bottom_table.ADAPTER_ID: blue_bottom_table,
        diagonal_grade_table.ADAPTER_ID: diagonal_grade_table,
        black_grade_strokes.ADAPTER_ID: black_grade_strokes,
    }


def _adapter_alias(value: str) -> str:
    aliases = {
        "blue": "blue_bottom_table",
        "a": "blue_bottom_table",
        "black": "black_grade_strokes",
        "b": "black_grade_strokes",
        "diagonal": "diagonal_grade_table",
        "c": "diagonal_grade_table",
    }
    return aliases.get(value, value)


def inspect_document(document: dict, config: dict) -> dict:
    adapters = _adapter_modules()
    selected_pages = parse_page_range(config.get("profile_pages"), int(document["page_count"]))
    selected_pages.difference_update(int(page) for page in config.get("excluded_pages") or [])
    forced_adapter = _adapter_alias(str(config.get("adapter", "auto")))
    page_results: list[dict] = []
    blocked: list[dict] = []

    for page in document["pages"]:
        page_number = int(page["page_number"])
        if page_number not in selected_pages:
            page_results.append({"page": page_number, "status": "excluded"})
            continue
        labels = extract_km_axis(page["words"], float(page["height"]), page.get("chars") or [])
        if len(labels) < 4:
            item = {"page": page_number, "status": "no_axis", "axis_labels": len(labels)}
            page_results.append(item)
            if config.get("profile_pages"):
                blocked.append({"kind": "axis_not_found", **item})
            continue
        axis_fit = fit_km_axis(labels)
        scores = {
            adapter_id: float(adapter.score_page(page, axis_fit))
            for adapter_id, adapter in adapters.items()
        }
        ranking_scores = dict(scores)
        # The older blue-table format also contains diagonal decoration, but
        # its dedicated adapter has stricter colour/divider invariants and is
        # already acceptance-tested.  Use the diagonal fallback only when the
        # dedicated blue adapter does not recognize the page at all.
        if scores.get(blue_bottom_table.ADAPTER_ID, 0) > 0:
            ranking_scores[diagonal_grade_table.ADAPTER_ID] = 0.0
        ranked = sorted(ranking_scores.items(), key=lambda item: item[1], reverse=True)
        if forced_adapter == "auto":
            best_id, best_score = ranked[0]
            next_score = ranked[1][1] if len(ranked) > 1 else 0.0
            # A diagonal table match is unusually specific: it requires the
            # table band, signed vector strokes and matching numeric labels.
            # The generic black-stroke adapter can also see the kilometre grid
            # on the same page, so do not let that known false positive turn a
            # strong diagonal match into an ambiguous layout.
            strong_diagonal_match = (
                best_id == diagonal_grade_table.ADAPTER_ID
                and best_score >= 94
                and best_score >= next_score
            )
            if best_score <= 0 or (
                next_score > 0
                and best_score - next_score < 5
                and not strong_diagonal_match
            ):
                item = {
                    "page": page_number,
                    "status": "layout_ambiguous",
                    "scores": scores,
                    "axis": axis_fit,
                }
                page_results.append(item)
                blocked.append({"kind": "layout_ambiguous", **item})
                continue
            adapter_id = best_id
        else:
            if forced_adapter not in adapters:
                raise PdfBuilderError(f"unknown adapter: {forced_adapter}")
            adapter_id = forced_adapter
            if scores[adapter_id] <= 0:
                item = {
                    "page": page_number,
                    "status": "forced_layout_not_detected",
                    "adapter": adapter_id,
                    "scores": scores,
                    "axis": axis_fit,
                }
                page_results.append(item)
                blocked.append({"kind": "forced_layout_not_detected", **item})
                continue
        page_results.append(
            {
                "page": page_number,
                "status": "ready",
                "adapter": adapter_id,
                "scores": scores,
                "axis": axis_fit,
            }
        )
    return {"pages": page_results, "blocked": blocked}


def _stitch_diagonal_page_coordinates(
    cells: list[dict],
    inspection: dict,
    diagnostics: list[dict],
) -> None:
    """Resolve at most two pickets of page-phase jitter."""
    direction_by_page = {
        int(item["page"]): str((item.get("axis") or {}).get("direction", "ascending"))
        for item in inspection["pages"]
        if item.get("status") == "ready"
    }
    by_page: dict[int, list[dict]] = defaultdict(list)
    for cell in cells:
        if cell.get("layout") == diagonal_grade_table.ADAPTER_ID:
            by_page[int(cell["page"])].append(cell)
    diagnostic_by_page = {int(item["page"]): item for item in diagnostics}

    previous_boundary = None
    previous_direction = None
    for page_number in sorted(by_page):
        page_cells = by_page[page_number]
        direction = direction_by_page.get(page_number, "ascending")
        page_start = min(int(cell["start_m"]) for cell in page_cells)
        page_end = max(int(cell["end_m"]) for cell in page_cells)
        if any(cell.get("explicit_page_window") for cell in page_cells):
            previous_boundary = None
            previous_direction = None
            if page_number in diagnostic_by_page:
                diagnostic_by_page[page_number]["cross_page_shift_m"] = 0
                diagnostic_by_page[page_number]["stitched_page_range_m"] = [
                    page_start,
                    page_end,
                ]
                diagnostic_by_page[page_number][
                    "auto_stitch_skipped_explicit_window"
                ] = True
            continue
        current_boundary = page_start if direction == "ascending" else page_end
        shift = 0
        if previous_boundary is not None and previous_direction == direction:
            candidate_shift = previous_boundary - current_boundary
            if abs(candidate_shift) <= 200:
                shift = candidate_shift
                for cell in page_cells:
                    cell["picket_grid_start_m"] = int(cell["start_m"])
                    cell["picket_grid_end_m"] = int(cell["end_m"])
                    cell["start_m"] = int(cell["start_m"]) + shift
                    cell["end_m"] = int(cell["end_m"]) + shift
                    cell["len_m"] = int(cell["end_m"]) - int(cell["start_m"])
                    cell["cross_page_shift_m"] = shift
                    cell["evidence"] = sorted(
                        set(
                            (cell.get("evidence") or [])
                            + [
                                "cross_page_two_picket_continuity"
                                if abs(shift) > 100
                                else "cross_page_picket_continuity"
                            ]
                        )
                    )
                page_start += shift
                page_end += shift
        previous_boundary = page_end if direction == "ascending" else page_start
        previous_direction = direction
        if page_number in diagnostic_by_page:
            diagnostic_by_page[page_number]["cross_page_shift_m"] = shift
            diagnostic_by_page[page_number]["stitched_page_range_m"] = [page_start, page_end]


def _discard_diagonal_leading_blank_cells(
    cells: list[dict],
    diagnostics: list[dict],
) -> None:
    by_page: dict[int, list[dict]] = defaultdict(list)
    for cell in cells:
        if cell.get("layout") == diagonal_grade_table.ADAPTER_ID:
            by_page[int(cell["page"])].append(cell)
    diagnostic_by_page = {int(item["page"]): item for item in diagnostics}
    discarded_ids: set[int] = set()
    for page_number, page_cells in by_page.items():
        leading = min(page_cells, key=lambda cell: int(cell["start_m"]))
        if (
            int(leading.get("len_m") or 0) <= 100
            and leading.get("magnitude") is None
            and leading.get("printed_length_m") is None
            and leading.get("table_stroke_sign") is None
            and leading.get("stroke_kind") is None
        ):
            discarded_ids.add(id(leading))
            if page_number in diagnostic_by_page:
                diagnostic_by_page[page_number]["discarded_leading_blank_cells"] = 1
                diagnostic_by_page[page_number]["discarded_leading_blank_range_m"] = [
                    int(leading["start_m"]),
                    int(leading["end_m"]),
                ]
    if discarded_ids:
        cells[:] = [cell for cell in cells if id(cell) not in discarded_ids]


def _apply_page_coordinate_offsets(
    cells: list[dict],
    diagnostics: list[dict],
    page_coordinate_offsets_m: dict | None,
) -> None:
    """Apply an explicit, reviewable picket-phase correction per PDF page."""

    offsets = {
        int(page): int(offset)
        for page, offset in (page_coordinate_offsets_m or {}).items()
        if int(offset)
    }
    if not offsets:
        return
    for cell in cells:
        page_number = int(cell["page"])
        offset_m = offsets.get(page_number)
        if offset_m is None:
            continue
        cell["unshifted_start_m"] = int(cell["start_m"])
        cell["unshifted_end_m"] = int(cell["end_m"])
        cell["start_m"] = int(cell["start_m"]) + offset_m
        cell["end_m"] = int(cell["end_m"]) + offset_m
        cell["len_m"] = int(cell["end_m"]) - int(cell["start_m"])
        cell["page_coordinate_offset_m"] = offset_m
        cell["evidence"] = sorted(
            set((cell.get("evidence") or []) + ["explicit_page_coordinate_offset"])
        )
    for item in diagnostics:
        offset_m = offsets.get(int(item["page"]))
        if offset_m is not None:
            item["page_coordinate_offset_m"] = offset_m


def _snap_coordinate(value: float, snap_m: int) -> int:
    return int(round(float(value) / snap_m) * snap_m)


def _apply_page_windows(
    cells: list[dict],
    diagnostics: list[dict],
    page_windows: list[dict] | None,
    snap_m: int,
) -> None:
    """Apply explicit per-page chainage windows and optional X-axis remaps."""

    windows = list(page_windows or [])
    if not windows:
        return
    by_page: dict[int, list[dict]] = defaultdict(list)
    for window in windows:
        by_page[int(window["page"])].append(window)
    diagnostic_by_page = {int(item["page"]): item for item in diagnostics}
    source_by_page: dict[int, list[dict]] = defaultdict(list)
    passthrough: list[dict] = []
    for cell in cells:
        page = int(cell["page"])
        if page in by_page:
            source_by_page[page].append(cell)
        else:
            passthrough.append(cell)

    output = list(passthrough)
    for page, page_windows_for_page in by_page.items():
        source_cells = source_by_page.get(page, [])
        page_output: list[dict] = []
        window_diagnostics: list[dict] = []
        x_boundaries = sorted(
            {
                round(float(value), 6)
                for cell in source_cells
                for value in (cell.get("x0"), cell.get("x1"))
                if value is not None and math.isfinite(float(value))
            }
        )
        for window in page_windows_for_page:
            keep_start, keep_end = (int(value) for value in window["keep_m"])
            axis_override = window.get("axis_override")
            matched = 0
            emitted = 0
            if axis_override and not x_boundaries:
                raise PdfBuilderError(
                    f"page_window {window['id']} axis_override requires cell X boundaries"
                )
            if axis_override:
                tolerance = 0.75
                for key in ("left_x", "right_x"):
                    boundary = float(axis_override[key])
                    if min(abs(boundary - value) for value in x_boundaries) > tolerance:
                        raise PdfBuilderError(
                            f"page_window {window['id']} {key} does not match a cell boundary"
                        )
            for source in source_cells:
                item = copy.deepcopy(source)
                item["page_window_original_start_m"] = int(source["start_m"])
                item["page_window_original_end_m"] = int(source["end_m"])
                item["page_window_original_x0"] = source.get("x0")
                item["page_window_original_x1"] = source.get("x1")
                evidence = list(item.get("evidence") or []) + ["explicit_page_window"]
                remapped = False
                if axis_override:
                    if source.get("x0") is None or source.get("x1") is None:
                        continue
                    source_left, source_right = sorted(
                        (float(source["x0"]), float(source["x1"]))
                    )
                    window_left = float(axis_override["left_x"])
                    window_right = float(axis_override["right_x"])
                    clipped_left = max(source_left, window_left)
                    clipped_right = min(source_right, window_right)
                    if clipped_right <= clipped_left + 1e-9:
                        continue
                    matched += 1
                    slope = (
                        int(axis_override["right_m"]) - int(axis_override["left_m"])
                    ) / (window_right - window_left)
                    source_axis_slope = source.get("axis_slope")
                    if (
                        source_axis_slope is not None
                        and float(source_axis_slope) * slope < 0
                    ):
                        raise PdfBuilderError(
                            f"page_window {window['id']} axis_override reverses the detected axis"
                        )

                    def mapped(x: float) -> int:
                        return _snap_coordinate(
                            int(axis_override["left_m"]) + slope * (x - window_left),
                            snap_m,
                        )

                    left_m = mapped(clipped_left)
                    right_m = mapped(clipped_right)
                    item["start_m"] = min(left_m, right_m)
                    item["end_m"] = max(left_m, right_m)
                    item["len_m"] = int(item["end_m"]) - int(item["start_m"])
                    item["axis_slope"] = slope
                    item["page_window_source_x"] = [
                        round(clipped_left, 6),
                        round(clipped_right, 6),
                    ]
                    item["x0"] = clipped_left
                    item["x1"] = clipped_right
                    item["page_window_axis_override"] = copy.deepcopy(axis_override)
                    evidence.append("explicit_page_axis_override")
                    remapped = True
                else:
                    matched += 1

                clipped_start = max(keep_start, int(item["start_m"]))
                clipped_end = min(keep_end, int(item["end_m"]))
                if clipped_end <= clipped_start:
                    continue
                was_clipped = (
                    clipped_start != int(item["start_m"])
                    or clipped_end != int(item["end_m"])
                )
                item["start_m"] = clipped_start
                item["end_m"] = clipped_end
                item["len_m"] = clipped_end - clipped_start
                item["page_window_id"] = str(window["id"])
                item["explicit_page_window"] = True
                if was_clipped:
                    evidence.append("explicit_page_window_clip")
                item["evidence"] = sorted(set(evidence))
                if remapped and not was_clipped:
                    for length_evidence in item.get("length_evidence") or []:
                        length_evidence["geometry_len_m"] = int(item["len_m"])
                elif was_clipped and item.get("length_evidence"):
                    item["page_window_source_length_evidence"] = copy.deepcopy(
                        item["length_evidence"]
                    )
                    item["length_evidence"] = []
                if int(item["end_m"]) <= int(item["start_m"]):
                    continue
                page_output.append(item)
                emitted += 1
            window_diagnostics.append(
                {
                    "id": str(window["id"]),
                    "keep_m": [keep_start, keep_end],
                    "axis_override": copy.deepcopy(axis_override),
                    "matched_cells": matched,
                    "output_cells": emitted,
                }
            )
        output.extend(page_output)
        diagnostic = diagnostic_by_page.get(page)
        if diagnostic is not None:
            diagnostic["page_windows"] = window_diagnostics
            diagnostic["page_window_input_cells"] = len(source_cells)
            diagnostic["page_window_output_cells"] = len(page_output)
            emitted_source_cells = {
                (item.get("page"), item.get("index"))
                for item in page_output
            }
            diagnostic["page_window_discarded_cells"] = max(
                0,
                len(source_cells) - len(emitted_source_cells),
            )
            diagnostic["explicit_page_windows"] = True
    cells[:] = output


def extract_pages(
    document: dict,
    inspection: dict,
    config: dict | None = None,
) -> tuple[list[dict], list[dict], list[dict]]:
    adapters = _adapter_modules()
    pages_by_number = {int(page["page_number"]): page for page in document["pages"]}
    cells: list[dict] = []
    issues: list[dict] = []
    diagnostics: list[dict] = []
    for item in inspection["pages"]:
        if item.get("status") != "ready":
            continue
        page_number = int(item["page"])
        adapter_id = str(item["adapter"])
        extraction = adapters[adapter_id].extract_page(
            pages_by_number[page_number],
            item["axis"],
        )
        for cell in extraction.get("cells") or []:
            axis = item["axis"]
            residual_key = (
                "p90_residual_m"
                if len(axis.get("labels") or []) >= 10
                else "max_residual_m"
            )
            cell.setdefault("axis_residual_m", float(axis[residual_key]))
            cells.append(cell)
        for issue in extraction.get("issues") or []:
            # Adapters also expose per-cell reasons directly on the cell. Keep
            # only page-level extraction issues here to avoid duplicate review
            # items for the same evidence.
            if issue.get("cell") is not None or issue.get("cell_index") not in (None, 0):
                continue
            issues.append({"page": page_number, "adapter": adapter_id, **issue})
        diagnostics.append(
            {
                "page": page_number,
                "adapter": adapter_id,
                "axis": item["axis"],
                **(extraction.get("diagnostics") or {}),
            }
        )
    _apply_page_coordinate_offsets(
        cells,
        diagnostics,
        (config or {}).get("page_coordinate_offsets_m"),
    )
    _apply_page_windows(
        cells,
        diagnostics,
        (config or {}).get("page_windows"),
        int((config or {}).get("snap_m", 100)),
    )
    _discard_diagonal_leading_blank_cells(cells, diagnostics)
    _stitch_diagonal_page_coordinates(cells, inspection, diagnostics)
    return cells, issues, diagnostics


def _trace_scales(
    cells: list[dict],
    layout_id: str,
) -> tuple[float | None, dict[int, float]]:
    samples: list[tuple[int, float]] = []
    for cell in cells:
        if cell.get("layout") != layout_id:
            continue
        magnitude = cell.get("magnitude")
        diagonal_layout = layout_id == diagonal_grade_table.ADAPTER_ID
        trace_slope = (
            cell.get("trace_endpoint_slope")
            if diagonal_layout
            else cell.get("trace_slope")
        )
        axis_slope = cell.get("axis_slope")
        if magnitude is None or float(magnitude) < 0.1 or trace_slope is None or not axis_slope:
            continue
        if diagonal_layout and not cell.get("trace_endpoint_available"):
            continue
        if not diagonal_layout and float(cell.get("trace_coverage") or 0) < 0.55:
            continue
        scale = abs(float(trace_slope)) / (float(magnitude) * abs(float(axis_slope)))
        if 0.0001 <= scale <= 0.1:
            samples.append((int(cell["page"]), scale))
    if not samples:
        return None, {}
    global_scale = statistics.median(scale for _page, scale in samples)
    by_page: dict[int, list[float]] = defaultdict(list)
    for page, scale in samples:
        by_page[page].append(scale)
    return global_scale, {
        page: statistics.median(values)
        for page, values in by_page.items()
    }


def _seed_is_manual(seed: dict | None) -> bool:
    return bool(seed and str(seed.get("confidence", "")) in MANUAL_PDF_CONFIDENCE)


def _signed_from_magnitude(magnitude: float, sign_source: float) -> float:
    if magnitude == 0:
        return 0.0
    return round(magnitude if sign_source > 0 else -magnitude, 4)


def _finalize_blue_cell(
    cell: dict,
    seed_elements: list[dict],
    global_scale: float | None,
    page_scales: dict[int, float],
) -> dict:
    result = copy.deepcopy(cell)
    seed = find_seed_element(seed_elements, int(cell["start_m"]), int(cell["end_m"]))
    result["seed_suggestion"] = (
        {
            "start_m": int(seed["start_m"]),
            "len_m": int(seed["len_m"]),
            "grad_permille": float(seed["grad_permille"]),
            "confidence": str(seed.get("confidence", "")),
        }
        if seed
        else None
    )
    scale = page_scales.get(int(cell["page"]), global_scale)
    trace_grade = None
    if scale and cell.get("trace_slope") is not None and float(cell.get("axis_slope") or 0):
        trace_grade = float(cell["trace_slope"]) / (float(cell["axis_slope"]) * scale)
    result["trace_grade_estimate"] = trace_grade
    magnitude = cell.get("magnitude")
    manual_seed = _seed_is_manual(seed)
    reasons = list(result.get("review_reasons") or [])

    if magnitude is not None:
        magnitude = float(magnitude)
        if manual_seed and abs(abs(float(seed["grad_permille"])) - magnitude) <= 0.051:
            grade = float(seed["grad_permille"])
            confidence = "pdf_manual_evidence_replayed"
            result["evidence"].append("manual_pdf_decision")
        elif magnitude == 0:
            grade = 0.0
            confidence = "pdf_vector_confirmed"
        elif trace_grade is None or abs(trace_grade) < 0.035:
            grade = float(seed["grad_permille"]) if seed else magnitude
            confidence = "needs_review"
            reasons.append("weak_or_missing_profile_sign")
        else:
            grade = _signed_from_magnitude(magnitude, trace_grade)
            tolerance = max(0.16, magnitude * 0.08)
            if (
                abs(abs(trace_grade) - magnitude) <= tolerance
                and float(cell.get("trace_coverage") or 0) >= 0.55
                and float(
                    cell["axis_residual_m"]
                    if cell.get("axis_residual_m") is not None
                    else 9999
                ) <= 50
            ):
                confidence = "pdf_vector_confirmed"
            else:
                confidence = "needs_review"
                reasons.append("profile_trace_magnitude_conflict")
    elif manual_seed:
        grade = float(seed["grad_permille"])
        confidence = "pdf_manual_evidence_replayed"
        result["evidence"].append("manual_pdf_decision")
    elif seed:
        grade = float(seed["grad_permille"])
        confidence = "needs_review"
        reasons.append("missing_pdf_magnitude_legacy_suggestion")
    elif trace_grade is not None:
        grade = snap_grade(trace_grade)
        confidence = "needs_review"
        reasons.append("trace_only_magnitude_suggestion")
    else:
        grade = 0.0
        confidence = "blocked"
        reasons.append("magnitude_and_trace_missing")

    result["grade"] = round(float(grade), 4)
    result["confidence"] = confidence
    result["review_reasons"] = sorted(set(reasons))
    result["length_evidence"] = [
        {
            "page": int(cell["page"]),
            "index": int(cell["index"]),
            "geometry_len_m": int(cell["len_m"]),
            "printed_len_m": int(cell["printed_length_m"]),
            "crop_box": cell.get("crop_box"),
        }
    ] if cell.get("printed_length_m") is not None else []
    return result


def _finalize_other_cell(cell: dict, seed_elements: list[dict]) -> dict:
    result = copy.deepcopy(cell)
    seed = find_seed_element(seed_elements, int(cell["start_m"]), int(cell["end_m"]))
    reasons = list(result.get("review_reasons") or [])
    if result.get("grade") is None and seed:
        result["grade"] = float(seed["grad_permille"])
        reasons.append("missing_pdf_grade_seed_suggestion")
        result["confidence"] = "needs_review"
    elif result.get("grade") is None:
        result["grade"] = 0.0
        reasons.append("grade_missing")
        result["confidence"] = "blocked"
    result["review_reasons"] = sorted(set(reasons))
    result.setdefault("length_evidence", [])
    result["seed_suggestion"] = (
        {
            "start_m": int(seed["start_m"]),
            "len_m": int(seed["len_m"]),
            "grad_permille": float(seed["grad_permille"]),
            "confidence": str(seed.get("confidence", "")),
        }
        if seed
        else None
    )
    return result


def _finalize_diagonal_cell(
    cell: dict,
    seed_elements: list[dict],
    global_scale: float | None,
    page_scales: dict[int, float],
) -> dict:
    result = _finalize_other_cell(cell, seed_elements)
    if cell.get("magnitude") is not None or result.get("seed_suggestion") is not None:
        return result
    table_sign = cell.get("table_stroke_sign")
    trace_slope = cell.get("trace_endpoint_slope")
    axis_slope = cell.get("axis_slope")
    scale = page_scales.get(int(cell["page"]), global_scale)
    if (
        table_sign not in (-1, 1)
        or trace_slope is None
        or not axis_slope
        or not scale
        or not cell.get("trace_endpoint_available")
    ):
        return result
    magnitude_estimate = abs(float(trace_slope)) / (abs(float(axis_slope)) * float(scale))
    if not 0.05 <= magnitude_estimate <= 30:
        return result
    result["trace_grade_estimate"] = snap_grade(magnitude_estimate * int(table_sign))
    result["grade"] = result["trace_grade_estimate"]
    result["confidence"] = "needs_review"
    result["evidence"] = sorted(
        set((result.get("evidence") or []) + ["calibrated_blue_trace_magnitude_suggestion"])
    )
    reasons = set(result.get("review_reasons") or [])
    reasons.discard("grade_missing")
    reasons.add("blue_trace_magnitude_suggestion")
    result["review_reasons"] = sorted(reasons)
    return result


def finalize_cells(raw_cells: list[dict], seed_elements: list[dict]) -> tuple[list[dict], dict]:
    global_scale, page_scales = _trace_scales(raw_cells, blue_bottom_table.ADAPTER_ID)
    diagonal_global_scale, diagonal_page_scales = _trace_scales(
        raw_cells,
        diagonal_grade_table.ADAPTER_ID,
    )
    finalized: list[dict] = []
    for cell in raw_cells:
        if cell.get("layout") == blue_bottom_table.ADAPTER_ID:
            finalized.append(_finalize_blue_cell(cell, seed_elements, global_scale, page_scales))
        elif cell.get("layout") == diagonal_grade_table.ADAPTER_ID:
            finalized.append(
                _finalize_diagonal_cell(
                    cell,
                    seed_elements,
                    diagonal_global_scale,
                    diagonal_page_scales,
                )
            )
        else:
            finalized.append(_finalize_other_cell(cell, seed_elements))
    return finalized, {
        "global_blue_trace_scale": global_scale,
        "page_blue_trace_scales": {str(page): scale for page, scale in page_scales.items()},
        "global_diagonal_trace_scale": diagonal_global_scale,
        "page_diagonal_trace_scales": {
            str(page): scale for page, scale in diagonal_page_scales.items()
        },
    }


def _pdf_grade_evidence(cell: dict) -> float | None:
    magnitude = cell.get("magnitude")
    if magnitude is None:
        return None
    magnitude = float(magnitude)
    if magnitude == 0:
        return 0.0
    if cell.get("layout") == diagonal_grade_table.ADAPTER_ID:
        table_sign = cell.get("table_stroke_sign")
        if table_sign in (-1, 1):
            return round(magnitude * int(table_sign), 4)
        return None
    stroke_sign = cell.get("stroke_sign")
    if stroke_sign in (-1, 1):
        return round(magnitude * int(stroke_sign), 4)
    if cell.get("grade") is not None:
        return float(cell["grade"])
    return None


def _seed_alignment_score(cell: dict, seed: dict) -> int:
    score = 0
    magnitude = cell.get("magnitude")
    seed_grade = float(seed["grad_permille"])
    if magnitude is not None:
        score += 10 if abs(abs(seed_grade) - float(magnitude)) <= 0.051 else -10
    pdf_grade = _pdf_grade_evidence(cell)
    if pdf_grade is not None:
        score += 5 if abs(seed_grade - pdf_grade) <= 0.051 else -5
    printed_length = cell.get("printed_length_m")
    if printed_length is not None:
        score += 4 if int(printed_length) == int(seed["len_m"]) else -2
    return score


def _align_cells_to_seed(cells: list[dict], seed_elements: list[dict]) -> list[tuple[int | None, int | None]]:
    """Needleman-Wunsch alignment using only PDF magnitude/sign/length evidence."""
    gap_penalty = -5
    row_count, column_count = len(cells), len(seed_elements)
    scores = [[0] * (column_count + 1) for _ in range(row_count + 1)]
    back: list[list[str | None]] = [
        [None] * (column_count + 1)
        for _ in range(row_count + 1)
    ]
    for row in range(1, row_count + 1):
        scores[row][0] = row * gap_penalty
        back[row][0] = "cell"
    for column in range(1, column_count + 1):
        scores[0][column] = column * gap_penalty
        back[0][column] = "seed"
    for row in range(1, row_count + 1):
        for column in range(1, column_count + 1):
            options = [
                (
                    scores[row - 1][column - 1]
                    + _seed_alignment_score(cells[row - 1], seed_elements[column - 1]),
                    "match",
                ),
                (scores[row - 1][column] + gap_penalty, "cell"),
                (scores[row][column - 1] + gap_penalty, "seed"),
            ]
            scores[row][column], back[row][column] = max(options, key=lambda item: item[0])

    row, column = row_count, column_count
    alignment: list[tuple[int | None, int | None]] = []
    while row or column:
        action = back[row][column]
        if action == "match":
            alignment.append((row - 1, column - 1))
            row -= 1
            column -= 1
        elif action == "cell":
            alignment.append((row - 1, None))
            row -= 1
        elif action == "seed":
            alignment.append((None, column - 1))
            column -= 1
        else:  # pragma: no cover - defensive guard for an invalid DP table
            raise PdfBuilderError("cannot reconstruct PDF/seed alignment")
    alignment.reverse()
    return alignment


def _validate_reconciliation_seed(seed_elements: list[dict]) -> None:
    cursor = None
    for index, seed in enumerate(seed_elements):
        start_m = int(seed["start_m"])
        length_m = int(seed["len_m"])
        if length_m <= 0:
            raise PdfBuilderError(f"reconciliation seed element {index} has non-positive length")
        if cursor is not None and start_m != cursor:
            kind = "gap" if start_m > cursor else "overlap"
            raise PdfBuilderError(
                f"reconciliation seed has a {kind} before element {index}: {cursor} -> {start_m}"
            )
        cursor = start_m + length_m


def reconcile_cells_with_seed(
    cells: list[dict],
    seed_elements: list[dict],
) -> tuple[list[dict], list[dict], dict]:
    """Rebase an explicitly requested migration draft onto legacy boundaries.

    The alignment is useful while converting the old XML profile to JSON.  It
    does not promote legacy values: every seed-only value or boundary without
    matching PDF evidence remains ``needs_review``.
    """
    ordered_cells = sorted(
        (copy.deepcopy(cell) for cell in cells),
        key=lambda cell: (
            int(cell["start_m"]),
            int(cell["end_m"]),
            int(cell.get("page") or 0),
            int(cell.get("index") or 0),
        ),
    )
    ordered_seed = sorted(
        (copy.deepcopy(seed) for seed in seed_elements),
        key=lambda seed: int(seed["start_m"]),
    )
    if not ordered_cells or not ordered_seed:
        return cells, [], {"enabled": False, "reason": "cells_or_seed_missing"}
    _validate_reconciliation_seed(ordered_seed)

    alignment = _align_cells_to_seed(ordered_cells, ordered_seed)
    cell_by_seed: dict[int, dict] = {
        seed_index: ordered_cells[cell_index]
        for cell_index, seed_index in alignment
        if cell_index is not None and seed_index is not None
    }
    matched_seed_indices = sorted(cell_by_seed)

    def page_near(seed_index: int) -> int:
        if not matched_seed_indices:
            return 0
        nearest = min(matched_seed_indices, key=lambda value: abs(value - seed_index))
        return int(cell_by_seed[nearest].get("page") or 0)

    reconciled: list[dict] = []
    confirmed = 0
    seed_only = 0
    magnitude_matches = 0
    sign_matches = 0
    length_matches = 0
    boundary_matches = 0
    ambiguous_pairs = 0
    for seed_index, seed in enumerate(ordered_seed):
        seed_start = int(seed["start_m"])
        seed_length = int(seed["len_m"])
        seed_end = seed_start + seed_length
        seed_grade = float(seed["grad_permille"])
        seed_suggestion = {
            "start_m": seed_start,
            "len_m": seed_length,
            "grad_permille": seed_grade,
            "confidence": str(seed.get("confidence", "")),
        }
        source = cell_by_seed.get(seed_index)
        if source is None:
            seed_only += 1
            reconciled.append(
                {
                    "page": page_near(seed_index),
                    "index": 0,
                    "layout": "legacy_seed_reconciliation",
                    "start_m": seed_start,
                    "end_m": seed_end,
                    "len_m": seed_length,
                    "grade": seed_grade,
                    "confidence": "needs_review",
                    "evidence": ["legacy_seed_alignment_context"],
                    "review_reasons": ["no_pdf_cell_alignment_legacy_seed_suggestion"],
                    "source_cells": [],
                    "length_evidence": [],
                    "seed_suggestion": seed_suggestion,
                    "crop_box": None,
                    "merge_barrier": True,
                    "reconciled_boundary": True,
                }
            )
            continue

        result = copy.deepcopy(source)
        result["extracted_start_m"] = int(source["start_m"])
        result["extracted_end_m"] = int(source["end_m"])
        result["start_m"] = seed_start
        result["end_m"] = seed_end
        result["len_m"] = seed_length
        result["seed_suggestion"] = seed_suggestion
        result["reconciled_boundary"] = True
        result["merge_barrier"] = True
        result["evidence"] = sorted(
            set((result.get("evidence") or []) + ["legacy_seed_alignment_context"])
        )

        reasons = [
            reason
            for reason in (result.get("review_reasons") or [])
            if reason not in {
                "missing_pdf_grade_seed_suggestion",
                "missing_pdf_magnitude",
                "printed_length_vector_conflict",
            }
        ]
        magnitude = source.get("magnitude")
        magnitude_match = (
            magnitude is not None
            and abs(abs(seed_grade) - float(magnitude)) <= 0.051
        )
        pdf_grade = _pdf_grade_evidence(source)
        sign_match = pdf_grade is not None and abs(seed_grade - pdf_grade) <= 0.051
        printed_length = source.get("printed_length_m")
        printed_length_match = (
            printed_length is not None and int(printed_length) == seed_length
        )
        residual_value = source.get("axis_residual_m")
        axis_reliable = float(residual_value) <= 50 if residual_value is not None else False
        geometry_length_match = (
            printed_length is None
            and axis_reliable
            and int(source["len_m"]) == seed_length
        )
        length_match = printed_length_match or geometry_length_match
        boundary_match = (
            int(source["start_m"]) == seed_start
            and int(source["end_m"]) == seed_end
        )
        alternative_scores = [
            _seed_alignment_score(source, ordered_seed[other_index])
            for other_index in (seed_index - 1, seed_index + 1)
            if 0 <= other_index < len(ordered_seed)
        ]
        pair_score = _seed_alignment_score(source, seed)
        alignment_ambiguous = any(score == pair_score for score in alternative_scores)
        magnitude_matches += int(magnitude_match)
        sign_matches += int(sign_match)
        length_matches += int(length_match)
        boundary_matches += int(boundary_match)
        ambiguous_pairs += int(alignment_ambiguous)

        if magnitude is None:
            result["grade"] = seed_grade
            reasons.append("legacy_seed_value_without_pdf_magnitude")
        elif not magnitude_match:
            result["grade"] = pdf_grade if pdf_grade is not None else seed_grade
            reasons.append("pdf_magnitude_seed_conflict")
        elif pdf_grade is None:
            result["grade"] = seed_grade
            reasons.append("legacy_seed_sign_without_pdf_vector")
        elif not sign_match:
            result["grade"] = pdf_grade
            reasons.append("pdf_sign_seed_conflict")
        else:
            result["grade"] = pdf_grade
        if not length_match:
            reasons.append("seed_boundary_without_matching_pdf_length")
        if not boundary_match:
            reasons.append("legacy_seed_boundary_rebased")
        if alignment_ambiguous:
            reasons.append("seed_alignment_ambiguous")

        result["review_reasons"] = sorted(set(reasons))
        result["confidence"] = (
            "pdf_vector_confirmed"
            if (
                not result["review_reasons"]
                and magnitude_match
                and sign_match
                and length_match
                and boundary_match
                and not alignment_ambiguous
            )
            else "needs_review"
        )
        confirmed += int(result["confidence"] == "pdf_vector_confirmed")
        reconciled.append(result)

    issues = []
    unmatched_cells = 0
    for cell_index, seed_index in alignment:
        if cell_index is None or seed_index is not None:
            continue
        unmatched_cells += 1
        cell = ordered_cells[cell_index]
        issues.append(
            {
                "kind": "unmatched_pdf_cell_during_seed_reconciliation",
                "page": int(cell.get("page") or 0),
                "start_m": int(cell["start_m"]),
                "end_m": int(cell["end_m"]),
                "cell_index": int(cell.get("index") or 0),
                "magnitude": cell.get("magnitude"),
                "pdf_grade": _pdf_grade_evidence(cell),
                "printed_length_m": cell.get("printed_length_m"),
                "reason": "PDF cell was not used as a legacy-boundary suggestion",
                "crop_box": cell.get("crop_box"),
            }
        )

    return reconciled, issues, {
        "enabled": True,
        "pdf_cells": len(ordered_cells),
        "seed_elements": len(ordered_seed),
        "aligned_pairs": len(cell_by_seed),
        "unmatched_pdf_cells": unmatched_cells,
        "seed_only_elements": seed_only,
        "magnitude_matches": magnitude_matches,
        "sign_matches": sign_matches,
        "length_matches": length_matches,
        "boundary_matches": boundary_matches,
        "ambiguous_pairs": ambiguous_pairs,
        "confirmed_elements": confirmed,
    }


def add_manual_seed_gap_suggestions(
    cells: list[dict],
    seed_elements: list[dict],
    config: dict,
) -> list[dict]:
    """Add an explicit review-only placeholder for an exact uncovered gap.

    This never treats a legacy profile as PDF evidence.  A suggestion is
    allowed only when a manually/PDF-reviewed seed element exactly bridges two
    extracted cell boundaries.  The resulting element is a merge barrier and
    remains ``needs_review`` until a human confirms it.
    """
    if not cells or not seed_elements:
        return cells
    range_start = int(config["range_start_m"])
    range_end = int(config["range_end_m"])
    starts = {int(cell["start_m"]): cell for cell in cells}
    ends = {int(cell["end_m"]): cell for cell in cells}
    result = list(cells)
    for seed in seed_elements:
        if not _seed_is_manual(seed):
            continue
        start_m = int(seed["start_m"])
        end_m = start_m + int(seed["len_m"])
        if start_m < range_start or end_m > range_end or end_m <= start_m:
            continue
        if start_m not in ends or end_m not in starts:
            continue
        if any(
            max(start_m, int(cell["start_m"])) < min(end_m, int(cell["end_m"]))
            for cell in result
        ):
            continue
        before = ends[start_m]
        after = starts[end_m]
        page = int(before.get("page") or after.get("page") or 0)
        result.append(
            {
                "page": page,
                "index": 0,
                "layout": "manual_seed_gap_suggestion",
                "start_m": start_m,
                "end_m": end_m,
                "len_m": end_m - start_m,
                "grade": float(seed["grad_permille"]),
                "confidence": "needs_review",
                "evidence": ["manual_seed_gap_suggestion"],
                "review_reasons": ["missing_pdf_cell_manual_seed_suggestion"],
                "source_cells": [],
                "length_evidence": [],
                "crop_box": None,
                "merge_barrier": True,
                "seed_suggestion": {
                    "start_m": start_m,
                    "len_m": end_m - start_m,
                    "grad_permille": float(seed["grad_permille"]),
                    "confidence": str(seed.get("confidence", "")),
                },
                "neighboring_source_cells": [
                    *(before.get("source_cells") or []),
                    *(after.get("source_cells") or []),
                ],
            }
        )
    return result


def _confidence_rank(value: str) -> int:
    return {
        "pdf_vector_confirmed": 5,
        "pdf_manual_evidence_replayed": 4,
        "needs_review": 2,
        "blocked": 0,
    }.get(value, 1)


def _clip_cell(cell: dict, start_m: int, end_m: int) -> dict | None:
    clipped_start = max(start_m, int(cell["start_m"]))
    clipped_end = min(end_m, int(cell["end_m"]))
    if clipped_end <= clipped_start:
        return None
    result = copy.deepcopy(cell)
    result["original_start_m"] = int(cell["start_m"])
    result["original_end_m"] = int(cell["end_m"])
    result["start_m"] = clipped_start
    result["end_m"] = clipped_end
    result["len_m"] = clipped_end - clipped_start
    return result


def _resolve_page_priority_overlaps(
    cells: list[dict],
    page_priorities: dict | None,
    diagnostics: list[dict],
) -> tuple[list[dict], list[dict]]:
    """Resolve only cross-page overlaps with an explicit unique priority."""

    priorities = {
        int(page): int(priority)
        for page, priority in (page_priorities or {}).items()
    }
    if not priorities:
        return list(cells), []
    valid = [
        (index, cell)
        for index, cell in enumerate(cells)
        if int(cell["end_m"]) > int(cell["start_m"])
    ]
    invalid = [
        copy.deepcopy(cell)
        for cell in cells
        if int(cell["end_m"]) <= int(cell["start_m"])
    ]
    boundaries = sorted(
        {
            coordinate
            for _index, cell in valid
            for coordinate in (int(cell["start_m"]), int(cell["end_m"]))
        }
    )
    fragments: list[dict] = []
    issues: list[dict] = []
    suppressed_m: dict[int, int] = defaultdict(int)
    selected_m: dict[int, int] = defaultdict(int)

    for interval_start, interval_end in zip(boundaries, boundaries[1:]):
        candidates = [
            (source_index, cell)
            for source_index, cell in valid
            if int(cell["start_m"]) <= interval_start
            and int(cell["end_m"]) >= interval_end
        ]
        if not candidates:
            continue
        candidate_pages = {int(cell["page"]) for _source_index, cell in candidates}
        competing_pages = len(candidate_pages) > 1
        winners = set(candidate_pages)
        suppressed_pages: set[int] = set()
        priority_tie = False
        winning_priority = None
        if competing_pages:
            winning_priority = max(priorities.get(page, 0) for page in candidate_pages)
            winners = {
                page
                for page in candidate_pages
                if priorities.get(page, 0) == winning_priority
            }
            suppressed_pages = candidate_pages - winners
            priority_tie = len(winners) > 1
            for page in suppressed_pages:
                suppressed_m[page] += interval_end - interval_start
            if priority_tie:
                issues.append(
                    {
                        "kind": "page_priority_tie",
                        "after_m": interval_start,
                        "next_m": interval_end,
                        "pages": sorted(winners),
                        "priority": winning_priority,
                        "confidence": "blocked",
                    }
                )
            for page in winners:
                selected_m[page] += interval_end - interval_start

        for source_index, cell in candidates:
            page = int(cell["page"])
            if page not in winners:
                continue
            fragment = _clip_cell(cell, interval_start, interval_end)
            if fragment is None:
                continue
            fragment["_page_priority_source_index"] = source_index
            fragment["page_priority"] = priorities.get(page, 0)
            if competing_pages:
                fragment["page_priority_competing_pages"] = sorted(candidate_pages)
                fragment["page_priority_suppressed_pages"] = sorted(suppressed_pages)
                fragment["evidence"] = sorted(
                    set((fragment.get("evidence") or []) + ["page_priority_selected"])
                )
            if priority_tie:
                fragment["confidence"] = "blocked"
                fragment["review_reasons"] = sorted(
                    set((fragment.get("review_reasons") or []) + ["page_priority_tie"])
                )
            fragments.append(fragment)

    coalesced: list[dict] = []
    for fragment in sorted(
        fragments,
        key=lambda item: (
            int(item["_page_priority_source_index"]),
            int(item["start_m"]),
            int(item["end_m"]),
        ),
    ):
        if coalesced:
            previous = coalesced[-1]
            same_source = (
                int(previous["_page_priority_source_index"])
                == int(fragment["_page_priority_source_index"])
            )
            same_resolution = all(
                previous.get(key) == fragment.get(key)
                for key in (
                    "confidence",
                    "review_reasons",
                )
            )
            if (
                same_source
                and same_resolution
                and int(previous["end_m"]) == int(fragment["start_m"])
            ):
                previous["end_m"] = int(fragment["end_m"])
                previous["len_m"] = int(previous["end_m"]) - int(previous["start_m"])
                previous["evidence"] = sorted(
                    set((previous.get("evidence") or []) + (fragment.get("evidence") or []))
                )
                for key in (
                    "page_priority_competing_pages",
                    "page_priority_suppressed_pages",
                ):
                    values = sorted(
                        set((previous.get(key) or []) + (fragment.get(key) or []))
                    )
                    if values:
                        previous[key] = values
                continue
        coalesced.append(fragment)
    for item in coalesced:
        item.pop("_page_priority_source_index", None)
    coalesced.extend(invalid)
    coalesced.sort(
        key=lambda item: (
            int(item["start_m"]),
            int(item["end_m"]),
            int(item["page"]),
            int(item.get("index") or 0),
        )
    )

    diagnostic_by_page = {int(item["page"]): item for item in diagnostics}
    for page, value in suppressed_m.items():
        if page in diagnostic_by_page:
            diagnostic_by_page[page]["page_priority_suppressed_m"] = value
    for page, value in selected_m.items():
        if page in diagnostic_by_page:
            diagnostic_by_page[page]["page_priority_selected_m"] = value
    surviving_pages = {int(item["page"]) for item in coalesced}
    for page in suppressed_m:
        if page not in surviving_pages and page in diagnostic_by_page:
            diagnostic_by_page[page]["page_priority_fully_suppressed"] = True
    return coalesced, issues


def _merge_cells(left: dict, right: dict) -> dict:
    result = copy.deepcopy(left)
    result["end_m"] = int(right["end_m"])
    result["len_m"] = int(result["end_m"]) - int(result["start_m"])
    result["source_cells"] = list(left.get("source_cells") or []) + list(right.get("source_cells") or [])
    result["evidence"] = sorted(set((left.get("evidence") or []) + (right.get("evidence") or [])))
    result["review_reasons"] = sorted(
        set((left.get("review_reasons") or []) + (right.get("review_reasons") or []))
    )
    result["length_evidence"] = list(left.get("length_evidence") or []) + list(
        right.get("length_evidence") or []
    )
    if _confidence_rank(str(right.get("confidence"))) < _confidence_rank(str(left.get("confidence"))):
        result["confidence"] = right.get("confidence")
    result["merged_page_break"] = True
    return result


def normalize_profile(cells: list[dict], config: dict) -> tuple[list[dict], list[dict]]:
    start_m, end_m = int(config["range_start_m"]), int(config["range_end_m"])
    clipped: list[dict] = []
    issues: list[dict] = []
    allowed_gaps = {
        (int(item["start_m"]), int(item["end_m"])): item
        for item in config.get("allowed_profile_gaps") or []
    }
    observed_allowed_gaps: set[tuple[int, int]] = set()

    def record_gap(kind: str, gap_start: int, gap_end: int, **extra) -> None:
        key = (gap_start, gap_end)
        if key in allowed_gaps:
            observed_allowed_gaps.add(key)
            return
        issues.append(
            {
                "kind": kind,
                "after_m": gap_start,
                "next_m": gap_end,
                **extra,
            }
        )
    for cell in cells:
        if int(cell["end_m"]) <= int(cell["start_m"]):
            invalid = copy.deepcopy(cell)
            invalid["confidence"] = "blocked"
            invalid["review_reasons"] = sorted(
                set((invalid.get("review_reasons") or []) + ["non_positive_cell_length"])
            )
            issues.append({"kind": "non_positive_cell_length", "cell": invalid})
            continue
        item = _clip_cell(cell, start_m, end_m)
        if item is not None:
            clipped.append(item)
    clipped.sort(key=lambda item: (int(item["start_m"]), int(item["end_m"]), int(item["page"])))

    deduplicated: list[dict] = []
    for cell in clipped:
        if (
            deduplicated
            and int(deduplicated[-1]["start_m"]) == int(cell["start_m"])
            and int(deduplicated[-1]["end_m"]) == int(cell["end_m"])
        ):
            previous = deduplicated[-1]
            if abs(float(previous["grade"]) - float(cell["grade"])) > 0.051:
                issues.append({"kind": "duplicate_grade_conflict", "cell": cell, "other": previous})
            elif _confidence_rank(str(cell.get("confidence"))) > _confidence_rank(str(previous.get("confidence"))):
                deduplicated[-1] = cell
            continue
        deduplicated.append(cell)

    merged: list[dict] = []
    for cell in deduplicated:
        if merged:
            previous = merged[-1]
            previous_pages = {int(item["page"]) for item in previous.get("source_cells") or []}
            current_pages = {int(item["page"]) for item in cell.get("source_cells") or []}
            page_break = previous_pages.isdisjoint(current_pages)
            if (
                int(previous["end_m"]) == int(cell["start_m"])
                and abs(float(previous["grade"]) - float(cell["grade"])) <= 0.001
                and page_break
                and not previous.get("review_reasons")
                and not cell.get("review_reasons")
                and not previous.get("merge_barrier")
                and not cell.get("merge_barrier")
            ):
                merged[-1] = _merge_cells(previous, cell)
                continue
        merged.append(cell)

    for index, cell in enumerate(merged):
        unresolved_length = []
        for evidence in cell.get("length_evidence") or []:
            printed = int(evidence["printed_len_m"])
            geometry = int(evidence["geometry_len_m"])
            if printed not in {geometry, int(cell["len_m"])}:
                unresolved_length.append(evidence)
        if unresolved_length:
            if str(cell.get("confidence")) != "blocked":
                cell["confidence"] = "needs_review"
            cell["review_reasons"] = sorted(
                set((cell.get("review_reasons") or []) + ["printed_length_vector_conflict"])
            )
            for evidence in unresolved_length:
                issues.append(
                    {
                        "kind": "printed_length_vector_conflict",
                        "cell": cell,
                        "evidence": evidence,
                    }
                )
        if index:
            previous = merged[index - 1]
            previous_end = int(previous["end_m"])
            current_start = int(cell["start_m"])
            if current_start > previous_end:
                record_gap(
                    "profile_gap",
                    previous_end,
                    current_start,
                    delta_m=current_start - previous_end,
                )
            elif current_start < previous_end:
                issues.append(
                    {
                        "kind": "profile_overlap",
                        "after_m": previous_end,
                        "next_m": current_start,
                        "delta_m": current_start - previous_end,
                    }
                )
    if not merged or int(merged[0]["start_m"]) > start_m:
        record_gap(
            "profile_head_gap",
            start_m,
            int(merged[0]["start_m"]) if merged else end_m,
        )
    if not merged or int(merged[-1]["end_m"]) < end_m:
        record_gap(
            "profile_tail_gap",
            int(merged[-1]["end_m"]) if merged else start_m,
            end_m,
        )
    for gap_start, gap_end in sorted(set(allowed_gaps) - observed_allowed_gaps):
        issues.append(
            {
                "kind": "profile_allowed_gap_not_observed",
                "after_m": gap_start,
                "next_m": gap_end,
                "confidence": "blocked",
                "reason": allowed_gaps[(gap_start, gap_end)]["reason"],
            }
        )
    return merged, issues


def _issue_from_cell_reason(cell: dict, reason: str) -> dict:
    item = {
        "kind": reason,
        "page": int(cell.get("page") or 0),
        "cell_index": int(cell.get("index") or 0),
        "start_m": int(cell["start_m"]),
        "end_m": int(cell["end_m"]),
        "confidence": str(cell.get("confidence", "")),
        "crop_box": cell.get("crop_box"),
        "seed_suggestion": cell.get("seed_suggestion"),
    }
    if cell.get("grade") is not None:
        item["suggested_grade"] = float(cell["grade"])
    return item


def build_issues(
    profile: list[dict],
    extraction_issues: list[dict],
    normalization_issues: list[dict],
    blocked_pages: list[dict],
    pdf_sha256: str,
) -> list[dict]:
    issues: list[dict] = []
    for cell in profile:
        reasons = list(cell.get("review_reasons") or [])
        if reasons:
            item = _issue_from_cell_reason(cell, reasons[0])
            item["reasons"] = reasons
            issues.append(item)
        if str(cell.get("confidence")) == "blocked" and not cell.get("review_reasons"):
            issues.append(_issue_from_cell_reason(cell, "blocked_cell"))
    for source in extraction_issues + normalization_issues + blocked_pages:
        if source.get("cell"):
            cell = source["cell"]
            item = _issue_from_cell_reason(cell, str(source.get("kind", "extraction_issue")))
            evidence = source.get("evidence")
            if evidence:
                item["evidence"] = evidence
            issues.append(item)
        else:
            issues.append({key: value for key, value in source.items() if key not in {"axis", "scores"}})

    unique: list[dict] = []
    seen: dict[tuple, int] = {}
    prefix = pdf_sha256[:12]
    for item in issues:
        kind = str(item.get("kind", "review"))
        page = int(item.get("page") or 0)
        cell_index = int(item.get("cell_index") or 0)
        start_m = int(item.get("start_m") or item.get("after_m") or 0)
        key = (kind, page, cell_index, start_m)
        if key in seen:
            existing = unique[seen[key]]
            for field in ("evidence", "tokens", "reason"):
                if field not in existing and field in item:
                    existing[field] = copy.deepcopy(item[field])
            continue
        seen[key] = len(unique)
        item = copy.deepcopy(item)
        item["issue_id"] = (
            f"{prefix}-p{page:02d}-c{cell_index:03d}-m{start_m:07d}-{kind}"
        )
        item["severity"] = (
            "blocked"
            if str(item.get("confidence")) == "blocked"
            or kind.startswith("profile_")
            or "not_found" in kind
            else "review"
        )
        unique.append(item)
    unique.sort(key=lambda item: (int(item.get("page") or 0), int(item.get("start_m") or 0), item["kind"]))
    return unique


def _simplified_elements(profile: list[dict]) -> list[dict]:
    return [
        {
            "start_m": int(cell["start_m"]),
            "len_m": int(cell["len_m"]),
            "grad_permille": round(float(cell["grade"]), 4),
            "confidence": str(cell["confidence"]),
        }
        for cell in profile
    ]


def _profile_digest(elements: list[dict], include_confidence: bool = False) -> str:
    normalized = [
        {
            "start_m": int(item["start_m"]),
            "len_m": int(item["len_m"]),
            "grad_permille": round(float(item["grad_permille"]), 4),
            **({"confidence": str(item.get("confidence", ""))} if include_confidence else {}),
        }
        for item in elements
    ]
    raw = json.dumps(normalized, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def compare_with_seed(elements: list[dict], seed_elements: list[dict]) -> dict:
    if not seed_elements:
        return {"available": False}
    seed_by_range = {
        (int(item["start_m"]), int(item["start_m"]) + int(item["len_m"])): item
        for item in seed_elements
    }
    candidate_by_range = {
        (int(item["start_m"]), int(item["start_m"]) + int(item["len_m"])): item
        for item in elements
    }
    shared = sorted(set(seed_by_range) & set(candidate_by_range))
    grade_differences = []
    for key in shared:
        seed_grade = float(seed_by_range[key]["grad_permille"])
        candidate_grade = float(candidate_by_range[key]["grad_permille"])
        if abs(seed_grade - candidate_grade) > 0.001:
            grade_differences.append(
                {
                    "start_m": key[0],
                    "end_m": key[1],
                    "seed_grade": seed_grade,
                    "candidate_grade": candidate_grade,
                }
            )
    return {
        "available": True,
        "shared_ranges": len(shared),
        "candidate_only_ranges": [list(item) for item in sorted(set(candidate_by_range) - set(seed_by_range))],
        "seed_only_ranges": [list(item) for item in sorted(set(seed_by_range) - set(candidate_by_range))],
        "grade_differences": grade_differences,
    }


def build_profile(config: dict) -> dict:
    document = load_vector_pdf(Path(config["pdf"]))
    seed_elements, _seed_payload = load_seed_elements(config)
    inspection = inspect_document(document, config)
    raw_cells, extraction_issues, diagnostics = extract_pages(document, inspection, config)
    finalized, calibration = finalize_cells(raw_cells, seed_elements)
    finalized, page_priority_issues = _resolve_page_priority_overlaps(
        finalized,
        config.get("page_priorities"),
        diagnostics,
    )
    fully_suppressed_pages = {
        int(item["page"])
        for item in diagnostics
        if item.get("page_priority_fully_suppressed")
    }
    if fully_suppressed_pages:
        extraction_issues = [
            item
            for item in extraction_issues
            if int(item.get("page") or 0) not in fully_suppressed_pages
        ]
    reconciliation_issues: list[dict] = []
    reconciliation = {"enabled": False}
    if config.get("reconcile_seed_order"):
        if not seed_elements:
            raise PdfBuilderError("reconcile_seed_order requires compare_seed")
        ordered_seed = sorted(seed_elements, key=lambda seed: int(seed["start_m"]))
        _validate_reconciliation_seed(ordered_seed)
        seed_start = int(ordered_seed[0]["start_m"])
        seed_end = int(ordered_seed[-1]["start_m"]) + int(ordered_seed[-1]["len_m"])
        if seed_start != int(config["range_start_m"]) or seed_end != int(config["range_end_m"]):
            raise PdfBuilderError(
                "reconciliation seed range does not match builder range: "
                f"{seed_start}..{seed_end} != "
                f"{config['range_start_m']}..{config['range_end_m']}"
            )
        finalized, reconciliation_issues, reconciliation = reconcile_cells_with_seed(
            finalized,
            seed_elements,
        )
    else:
        finalized = add_manual_seed_gap_suggestions(finalized, seed_elements, config)
    profile, normalization_issues = normalize_profile(finalized, config)
    elements = _simplified_elements(profile)
    issues = build_issues(
        profile,
        extraction_issues + reconciliation_issues,
        page_priority_issues + normalization_issues,
        inspection["blocked"],
        document["fingerprint"]["sha256"],
    )
    confidence_counts = dict(Counter(item["confidence"] for item in elements))
    summary = {
        "raw_cells": len(raw_cells),
        "logical_elements": len(elements),
        "coverage_start_m": elements[0]["start_m"] if elements else None,
        "coverage_end_m": (
            elements[-1]["start_m"] + elements[-1]["len_m"] if elements else None
        ),
        "confidence": confidence_counts,
        "review_issues": sum(item["severity"] == "review" for item in issues),
        "blocked_issues": sum(item["severity"] == "blocked" for item in issues),
        "profile_sha256": _profile_digest(elements),
        "profile_with_confidence_sha256": _profile_digest(elements, include_confidence=True),
    }
    return {
        "builder_version": BUILDER_VERSION,
        "config": config,
        "document": {key: value for key, value in document.items() if key != "pages"},
        "inspection": inspection,
        "page_diagnostics": diagnostics,
        "calibration": calibration,
        "seed_reconciliation": reconciliation,
        "raw_cells": raw_cells,
        "profile_cells": profile,
        "elements": elements,
        "issues": issues,
        "summary": summary,
        "seed_comparison": compare_with_seed(elements, seed_elements),
    }
