from __future__ import annotations

import copy
import hashlib
import json
import statistics
from collections import Counter, defaultdict
from pathlib import Path

from . import BUILDER_VERSION
from .axis import extract_km_axis, fit_km_axis
from .common import find_seed_element, parse_page_range, snap_grade
from .pdf_io import PdfBuilderError, load_vector_pdf
from .adapters import blue_bottom_table


MANUAL_PDF_CONFIDENCE = {
    "verified",
    "pdf_table_trace_verified",
    "pdf_vector_confirmed",
    "manual_reviewed",
}


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _resolve_path(value: str | None, base_dir: Path) -> Path | None:
    if not value:
        return None
    path = Path(value).expanduser()
    return path if path.is_absolute() else (base_dir / path).resolve()


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
    payload["range_start_m"] = min(int(payload["km_start_m"]), int(payload["km_end_m"]))
    payload["range_end_m"] = max(int(payload["km_start_m"]), int(payload["km_end_m"]))
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
        black_grade_strokes.ADAPTER_ID: black_grade_strokes,
    }


def _adapter_alias(value: str) -> str:
    aliases = {
        "blue": "blue_bottom_table",
        "a": "blue_bottom_table",
        "black": "black_grade_strokes",
        "b": "black_grade_strokes",
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
        ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
        if forced_adapter == "auto":
            best_id, best_score = ranked[0]
            next_score = ranked[1][1] if len(ranked) > 1 else 0.0
            if best_score <= 0 or (next_score > 0 and best_score - next_score < 5):
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


def extract_pages(document: dict, inspection: dict) -> tuple[list[dict], list[dict], list[dict]]:
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
            cell["axis_residual_m"] = float(item["axis"]["max_residual_m"])
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
    return cells, issues, diagnostics


def _blue_scales(cells: list[dict]) -> tuple[float | None, dict[int, float]]:
    samples: list[tuple[int, float]] = []
    for cell in cells:
        if cell.get("layout") != blue_bottom_table.ADAPTER_ID:
            continue
        magnitude = cell.get("magnitude")
        trace_slope = cell.get("trace_slope")
        axis_slope = cell.get("axis_slope")
        if magnitude is None or float(magnitude) < 0.1 or trace_slope is None or not axis_slope:
            continue
        if float(cell.get("trace_coverage") or 0) < 0.55:
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
                and float(cell.get("axis_residual_m") or 9999) <= 50
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


def finalize_cells(raw_cells: list[dict], seed_elements: list[dict]) -> tuple[list[dict], dict]:
    global_scale, page_scales = _blue_scales(raw_cells)
    finalized: list[dict] = []
    for cell in raw_cells:
        if cell.get("layout") == blue_bottom_table.ADAPTER_ID:
            finalized.append(_finalize_blue_cell(cell, seed_elements, global_scale, page_scales))
        else:
            finalized.append(_finalize_other_cell(cell, seed_elements))
    return finalized, {
        "global_blue_trace_scale": global_scale,
        "page_blue_trace_scales": {str(page): scale for page, scale in page_scales.items()},
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
    clipped = [item for cell in cells if (item := _clip_cell(cell, start_m, end_m))]
    clipped.sort(key=lambda item: (int(item["start_m"]), int(item["end_m"]), int(item["page"])))

    deduplicated: list[dict] = []
    issues: list[dict] = []
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
                issues.append(
                    {
                        "kind": "profile_gap",
                        "after_m": previous_end,
                        "next_m": current_start,
                        "delta_m": current_start - previous_end,
                    }
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
        issues.append(
            {
                "kind": "profile_head_gap",
                "after_m": start_m,
                "next_m": int(merged[0]["start_m"]) if merged else end_m,
            }
        )
    if not merged or int(merged[-1]["end_m"]) < end_m:
        issues.append(
            {
                "kind": "profile_tail_gap",
                "after_m": int(merged[-1]["end_m"]) if merged else start_m,
                "next_m": end_m,
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
    seen: set[tuple] = set()
    prefix = pdf_sha256[:12]
    for item in issues:
        kind = str(item.get("kind", "review"))
        page = int(item.get("page") or 0)
        cell_index = int(item.get("cell_index") or 0)
        start_m = int(item.get("start_m") or item.get("after_m") or 0)
        key = (kind, page, cell_index, start_m)
        if key in seen:
            continue
        seen.add(key)
        item = copy.deepcopy(item)
        item["issue_id"] = f"{prefix}-p{page:02d}-c{cell_index:03d}-{kind}"
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
    raw_cells, extraction_issues, diagnostics = extract_pages(document, inspection)
    finalized, calibration = finalize_cells(raw_cells, seed_elements)
    finalized = add_manual_seed_gap_suggestions(finalized, seed_elements, config)
    profile, normalization_issues = normalize_profile(finalized, config)
    elements = _simplified_elements(profile)
    issues = build_issues(
        profile,
        extraction_issues,
        normalization_issues,
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
        "raw_cells": raw_cells,
        "profile_cells": profile,
        "elements": elements,
        "issues": issues,
        "summary": summary,
        "seed_comparison": compare_with_seed(elements, seed_elements),
    }
