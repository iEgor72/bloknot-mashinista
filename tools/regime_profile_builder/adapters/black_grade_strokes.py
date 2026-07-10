"""Adapter for vector maps with black grade strokes and a black profile trace.

This layout is used by the Postyshevo - Novyi Urgal regime map. The short
strokes in a compact row encode cell boundaries, numeric PDF characters encode
the unsigned magnitude, and the thicker profile trace supplies the sign.

The adapter deliberately has no access to legacy/seed data and never emits the
product-level ``verified`` confidence.
"""

from __future__ import annotations

import math
import re
import statistics
from collections.abc import Iterable


ADAPTER_ID = "black_grade_strokes"

_MAGNITUDE_RE = re.compile(r"^(?:\d{1,2}(?:[,.]\d)?|0)$")
_NUMERIC_CHAR_RE = re.compile(r"^[0-9,.]$")


def _number(value: object, default: float = 0.0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    return result if math.isfinite(result) else default


def _page_number(page: dict) -> int:
    try:
        return int(page.get("page_number", 0))
    except (TypeError, ValueError):
        return 0


def _is_black_stroke(value: object) -> bool:
    if value is None:
        return True
    if not isinstance(value, (tuple, list)) or not value:
        return False
    channels = [_number(channel, 1.0) for channel in value]
    return max(abs(channel) for channel in channels) <= 0.08


def _vector_geometry(vector: dict) -> tuple[float, float, float, float] | None:
    try:
        values = tuple(float(vector[key]) for key in ("x0", "y0", "x1", "y1"))
    except (KeyError, TypeError, ValueError):
        return None
    if not all(math.isfinite(value) for value in values):
        return None
    return values


def _union_length(intervals: Iterable[tuple[float, float]]) -> float:
    ordered = sorted((min(left, right), max(left, right)) for left, right in intervals)
    if not ordered:
        return 0.0
    total = 0.0
    left, right = ordered[0]
    for next_left, next_right in ordered[1:]:
        if next_left <= right:
            right = max(right, next_right)
            continue
        total += right - left
        left, right = next_left, next_right
    return total + right - left


def _cluster_by_mid_y(candidates: list[dict], tolerance: float) -> list[list[dict]]:
    clusters: list[list[dict]] = []
    for candidate in sorted(candidates, key=lambda item: item["mid_y"]):
        best: list[dict] | None = None
        best_distance = math.inf
        for cluster in clusters:
            center = statistics.median(item["mid_y"] for item in cluster)
            distance = abs(candidate["mid_y"] - center)
            if distance <= tolerance and distance < best_distance:
                best = cluster
                best_distance = distance
        if best is None:
            clusters.append([candidate])
        else:
            best.append(candidate)
    return clusters


def _deduplicate_strokes(strokes: list[dict], width: float) -> list[dict]:
    endpoint_tolerance = max(0.6, width * 0.0009)
    result: list[dict] = []
    for stroke in sorted(strokes, key=lambda item: (item["left"], item["right"])):
        duplicate = next(
            (
                existing
                for existing in result
                if abs(existing["left"] - stroke["left"]) <= endpoint_tolerance
                and abs(existing["right"] - stroke["right"]) <= endpoint_tolerance
            ),
            None,
        )
        if duplicate is None:
            result.append(dict(stroke))
            continue
        # Prefer the vector closest to the selected row center.
        if abs(stroke["mid_y"] - stroke["row_y"]) < abs(
            duplicate["mid_y"] - duplicate["row_y"]
        ):
            duplicate.update(stroke)

    gap_tolerance = max(2.0, width * 0.0025)
    for current, following in zip(result, result[1:]):
        gap = following["left"] - current["right"]
        if abs(gap) <= gap_tolerance:
            shared = (current["right"] + following["left"]) / 2
            current["right"] = shared
            following["left"] = shared
    for stroke in result:
        stroke["center"] = (stroke["left"] + stroke["right"]) / 2
    return result


def _find_grade_strokes(page: dict) -> tuple[list[dict], dict]:
    width = max(1.0, _number(page.get("width"), 843.0))
    height = max(1.0, _number(page.get("height"), 596.0))
    min_width = max(2.5, width * 0.003)
    max_width = min(320.0, width * 0.45)
    candidates: list[dict] = []

    for vector in page.get("vectors") or []:
        if not isinstance(vector, dict) or not _is_black_stroke(vector.get("stroke")):
            continue
        linewidth = _number(vector.get("linewidth"))
        if not 0.40 <= linewidth <= 1.25:
            continue
        geometry = _vector_geometry(vector)
        if geometry is None:
            continue
        x0, y0, x1, y1 = geometry
        left, right = sorted((x0, x1))
        span = right - left
        mid_y = (y0 + y1) / 2
        if not min_width <= span <= max_width:
            continue
        if not height * 0.12 <= mid_y <= height * 0.45:
            continue
        if abs(y1 - y0) > max(32.0, span * 1.6):
            continue
        candidates.append(
            {
                "vector": vector,
                "left": left,
                "right": right,
                "center": (left + right) / 2,
                "mid_y": mid_y,
                "linewidth": linewidth,
            }
        )

    tolerance = max(2.5, height * 0.006)
    clusters = _cluster_by_mid_y(candidates, tolerance)
    viable = [cluster for cluster in clusters if len(cluster) >= 3]
    if not viable:
        return [], {
            "raw_candidate_count": len(candidates),
            "cluster_count": len(clusters),
            "row_y": None,
            "row_spread": None,
        }

    def cluster_score(cluster: list[dict]) -> tuple[float, int, float]:
        coverage = _union_length((item["left"], item["right"]) for item in cluster)
        row = statistics.median(item["mid_y"] for item in cluster)
        spread = max(abs(item["mid_y"] - row) for item in cluster)
        score = len(cluster) * 3.0 + min(coverage / width, 1.0) * 24.0 - spread
        return score, len(cluster), coverage

    selected = max(viable, key=cluster_score)
    row_y = statistics.median(item["mid_y"] for item in selected)
    prepared = [{**item, "row_y": row_y} for item in selected]
    strokes = _deduplicate_strokes(prepared, width)
    spread = max((abs(item["mid_y"] - row_y) for item in selected), default=0.0)
    return strokes, {
        "raw_candidate_count": len(candidates),
        "cluster_count": len(clusters),
        "selected_cluster_count": len(selected),
        "row_y": round(row_y, 4),
        "row_spread": round(spread, 4),
    }


def _trace_candidates(page: dict, strokes: list[dict], row_y: float) -> list[dict]:
    if not strokes:
        return []
    width = max(1.0, _number(page.get("width"), 843.0))
    height = max(1.0, _number(page.get("height"), 596.0))
    page_left = min(item["left"] for item in strokes)
    page_right = max(item["right"] for item in strokes)
    candidates: list[dict] = []
    for vector in page.get("vectors") or []:
        if not isinstance(vector, dict) or not _is_black_stroke(vector.get("stroke")):
            continue
        linewidth = _number(vector.get("linewidth"))
        if not 1.45 <= linewidth <= 3.20:
            continue
        geometry = _vector_geometry(vector)
        if geometry is None:
            continue
        x0, y0, x1, y1 = geometry
        left, right = sorted((x0, x1))
        span = right - left
        if span < max(4.0, width * 0.004):
            continue
        if right < page_left - 4 or left > page_right + 4:
            continue
        if max(y0, y1) <= row_y + max(2.0, height * 0.004):
            continue
        if min(y0, y1) >= height * 0.92:
            continue
        if abs(y1 - y0) > max(30.0, span * 1.5):
            continue
        candidates.append(
            {
                "vector": vector,
                "x0": x0,
                "y0": y0,
                "x1": x1,
                "y1": y1,
                "left": left,
                "right": right,
            }
        )
    return candidates


def _connected_components(segments: list[dict], tolerance: float) -> list[list[dict]]:
    if not segments:
        return []
    endpoints = [
        ((item["x0"], item["y0"]), (item["x1"], item["y1"]))
        for item in segments
    ]
    neighbors: list[list[int]] = [[] for _item in segments]
    for left_index in range(len(segments)):
        for right_index in range(left_index + 1, len(segments)):
            connected = any(
                math.hypot(left[0] - right[0], left[1] - right[1]) <= tolerance
                for left in endpoints[left_index]
                for right in endpoints[right_index]
            )
            if connected:
                neighbors[left_index].append(right_index)
                neighbors[right_index].append(left_index)

    components: list[list[dict]] = []
    seen: set[int] = set()
    for start in range(len(segments)):
        if start in seen:
            continue
        pending = [start]
        seen.add(start)
        component: list[dict] = []
        while pending:
            index = pending.pop()
            component.append(segments[index])
            for neighbor in neighbors[index]:
                if neighbor not in seen:
                    seen.add(neighbor)
                    pending.append(neighbor)
        components.append(component)
    return components


def _select_trace(page: dict, strokes: list[dict], row_y: float) -> tuple[list[dict], dict]:
    width = max(1.0, _number(page.get("width"), 843.0))
    candidates = _trace_candidates(page, strokes, row_y)
    if not candidates:
        return [], {
            "trace_candidate_count": 0,
            "trace_component_count": 0,
            "trace_x_range": None,
            "trace_coverage_ratio": 0.0,
        }

    # The format can intentionally reposition the profile vertically inside a
    # page, so one logical trace is not always one endpoint-connected
    # component. The profile does, however, use one stable linewidth. Select
    # the linewidth cluster with the widest X coverage and most segments. This
    # also rejects thick full-width control strips and small diagram symbols.
    linewidth_groups: list[list[dict]] = []
    for candidate in sorted(candidates, key=lambda item: item["vector"].get("linewidth") or 0):
        linewidth = _number(candidate["vector"].get("linewidth"))
        matching = next(
            (
                group
                for group in linewidth_groups
                if abs(
                    linewidth
                    - statistics.median(_number(item["vector"].get("linewidth")) for item in group)
                )
                <= 0.24
            ),
            None,
        )
        if matching is None:
            linewidth_groups.append([candidate])
        else:
            matching.append(candidate)

    def group_score(group: list[dict]) -> tuple[float, float, int]:
        coverage = _union_length((item["left"], item["right"]) for item in group)
        total = sum(item["right"] - item["left"] for item in group)
        return -abs(len(group) - len(strokes)), coverage, int(round(total))

    selected = max(linewidth_groups, key=group_score)
    components = _connected_components(selected, max(2.5, width * 0.0035))
    trace_left = min(item["left"] for item in selected)
    trace_right = max(item["right"] for item in selected)
    stroke_left = min(item["left"] for item in strokes)
    stroke_right = max(item["right"] for item in strokes)
    stroke_span = max(1.0, stroke_right - stroke_left)
    overlap = _union_length(
        (
            max(item["left"], stroke_left),
            min(item["right"], stroke_right),
        )
        for item in selected
        if item["right"] > stroke_left and item["left"] < stroke_right
    )
    return selected, {
        "trace_candidate_count": len(candidates),
        "trace_component_count": len(components),
        "trace_linewidth_group_count": len(linewidth_groups),
        "trace_linewidth": round(
            statistics.median(_number(item["vector"].get("linewidth")) for item in selected),
            4,
        ),
        "trace_segment_count": len(selected),
        "trace_x_range": [round(trace_left, 4), round(trace_right, 4)],
        "trace_coverage_ratio": round(overlap / stroke_span, 4),
    }


def _parse_magnitude(raw: str) -> float | None:
    normalized = re.sub(r"\s+", "", raw).replace(".", ",")
    if not _MAGNITUDE_RE.fullmatch(normalized):
        return None
    try:
        value = float(normalized.replace(",", "."))
    except ValueError:
        return None
    if not 0.0 <= value <= 50.0:
        return None
    return value


def _vertical_center_bottom(item: dict, height: float) -> float:
    top = _number(item.get("top"))
    bottom = _number(item.get("bottom"), top)
    return height - (top + bottom) / 2


def _label_candidates(page: dict, stroke: dict, row_y: float) -> list[dict]:
    height = max(1.0, _number(page.get("height"), 596.0))
    label_band_top = row_y + min(72.0, max(36.0, height * 0.11))
    label_band_bottom = row_y - max(3.0, height * 0.006)
    left = stroke["left"] - 1.2
    right = stroke["right"] + 1.2
    numeric_chars = []
    for char in page.get("chars") or []:
        if not isinstance(char, dict):
            continue
        text = str(char.get("text", ""))
        if not _NUMERIC_CHAR_RE.fullmatch(text):
            continue
        center_x = (_number(char.get("x0")) + _number(char.get("x1"))) / 2
        center_y = _vertical_center_bottom(char, height)
        if left <= center_x <= right and label_band_bottom <= center_y <= label_band_top:
            numeric_chars.append(char)

    candidates: list[dict] = []
    rotated = [char for char in numeric_chars if not bool(char.get("upright", True))]
    upright = [char for char in numeric_chars if bool(char.get("upright", True))]
    for kind, chars in (("pdf_rotated_chars", rotated), ("pdf_upright_chars", upright)):
        if not chars:
            continue
        if kind == "pdf_rotated_chars":
            ordered = sorted(chars, key=lambda char: _number(char.get("top")), reverse=True)
        else:
            ordered = sorted(chars, key=lambda char: _number(char.get("x0")))
        raw = "".join(str(char.get("text", "")) for char in ordered)
        magnitude = _parse_magnitude(raw)
        if magnitude is not None:
            candidates.append(
                {
                    "magnitude": magnitude,
                    "raw": raw,
                    "kind": kind,
                    "character_count": len(ordered),
                }
            )

    for word in page.get("words") or []:
        if not isinstance(word, dict):
            continue
        center_x = (_number(word.get("x0")) + _number(word.get("x1"))) / 2
        center_y = _vertical_center_bottom(word, height)
        if not (left <= center_x <= right and label_band_bottom <= center_y <= label_band_top):
            continue
        raw = str(word.get("text", ""))
        magnitude = _parse_magnitude(raw)
        if magnitude is not None:
            candidates.append(
                {
                    "magnitude": magnitude,
                    "raw": raw,
                    "kind": "pdf_word",
                    "character_count": None,
                }
            )

    priority = {"pdf_rotated_chars": 0, "pdf_upright_chars": 1, "pdf_word": 2}
    unique: dict[tuple[float, str], dict] = {}
    for candidate in candidates:
        key = (round(float(candidate["magnitude"]), 4), candidate["kind"])
        unique.setdefault(key, candidate)
    return sorted(unique.values(), key=lambda item: (priority.get(item["kind"], 9), item["raw"]))


def _trace_y_at_x(trace: list[dict], x: float) -> float | None:
    values: list[float] = []
    nearby: list[tuple[float, float]] = []
    for segment in trace:
        x0 = segment["x0"]
        x1 = segment["x1"]
        y0 = segment["y0"]
        y1 = segment["y1"]
        left, right = sorted((x0, x1))
        if left - 0.8 <= x <= right + 0.8:
            ratio = 0.0 if x1 == x0 else (x - x0) / (x1 - x0)
            if -0.12 <= ratio <= 1.12:
                values.append(y0 + (y1 - y0) * ratio)
        else:
            for endpoint_x, endpoint_y in ((x0, y0), (x1, y1)):
                distance = abs(x - endpoint_x)
                if distance <= 5.0:
                    nearby.append((distance, endpoint_y))
    if values:
        return statistics.median(values)
    if nearby:
        nearby.sort(key=lambda item: item[0])
        return statistics.median(value for _distance, value in nearby[:2])
    return None


def _trace_coverage(trace: list[dict], x0: float, x1: float) -> float:
    left, right = sorted((x0, x1))
    width = max(0.001, right - left)
    overlap = _union_length(
        (max(left, segment["left"]), min(right, segment["right"]))
        for segment in trace
        if segment["right"] > left and segment["left"] < right
    )
    return min(1.0, overlap / width)


def _coordinate(axis_fit: tuple[float, float], x: float) -> tuple[int, float]:
    slope, intercept = axis_fit
    raw = float(slope) * x + float(intercept)
    snapped = int(round(raw / 100.0) * 100)
    return snapped, abs(raw - snapped)


def _crop_box(page: dict, stroke: dict, trace: list[dict], row_y: float) -> list[float]:
    width = max(1.0, _number(page.get("width"), 843.0))
    height = max(1.0, _number(page.get("height"), 596.0))
    # Review crops must include neighbouring ruler cells; a single black-stroke
    # cell can be only a few points wide and is otherwise unreadable in the
    # contact sheet.
    x_pad = max(42.0, width * 0.055)
    overlapping = [
        value
        for segment in trace
        if segment["right"] >= stroke["left"] - x_pad
        and segment["left"] <= stroke["right"] + x_pad
        for value in (segment["y0"], segment["y1"])
    ]
    bottom_coordinates = [row_y, *overlapping]
    low = max(0.0, min(bottom_coordinates) - 16.0)
    high = min(height, max(bottom_coordinates) + 16.0)
    return [
        round(max(0.0, stroke["left"] - x_pad), 2),
        round(max(0.0, height - high), 2),
        round(min(width, stroke["right"] + x_pad), 2),
        round(min(height, height - low), 2),
    ]


def _layout(page: dict) -> tuple[list[dict], list[dict], dict]:
    strokes, stroke_diagnostics = _find_grade_strokes(page)
    row_y = _number(stroke_diagnostics.get("row_y"))
    trace, trace_diagnostics = _select_trace(page, strokes, row_y) if strokes else ([], {})
    return strokes, trace, {**stroke_diagnostics, **trace_diagnostics}


def score_page(page: dict, axis_fit: dict) -> float:
    """Return a 0..100 likelihood that ``page`` matches this vector layout."""

    del axis_fit
    try:
        strokes, trace, diagnostics = _layout(page)
        if len(strokes) < 3:
            return 0.0
        width = max(1.0, _number(page.get("width"), 843.0))
        span = max(item["right"] for item in strokes) - min(item["left"] for item in strokes)
        count_score = min(1.0, len(strokes) / 10.0)
        span_score = min(1.0, span / (width * 0.60))
        label_hits = sum(bool(_label_candidates(page, stroke, _number(diagnostics.get("row_y")))) for stroke in strokes)
        label_score = label_hits / len(strokes)
        trace_score = min(1.0, _number(diagnostics.get("trace_coverage_ratio"))) if trace else 0.0
        row_spread = _number(diagnostics.get("row_spread"), 99.0)
        row_score = max(0.0, 1.0 - row_spread / max(3.0, _number(page.get("height"), 596.0) * 0.012))
        return round(100.0 * (
            0.25 * count_score
            + 0.20 * span_score
            + 0.25 * label_score
            + 0.25 * trace_score
            + 0.05 * row_score
        ),
            4,
        )
    except (KeyError, TypeError, ValueError, OverflowError, statistics.StatisticsError):
        return 0.0


def extract_page(page: dict, axis_fit: dict) -> dict:
    """Extract page cells without consulting seed data or product files."""

    page_number = _page_number(page)
    cells: list[dict] = []
    issues: list[dict] = []

    try:
        slope = float(axis_fit["slope"])
        intercept = float(axis_fit["intercept"])
    except (KeyError, TypeError, ValueError):
        slope, intercept = math.nan, math.nan
    axis_valid = math.isfinite(slope) and math.isfinite(intercept) and abs(slope) > 1e-9

    strokes, trace, diagnostics = _layout(page)
    diagnostics = {
        "adapter": ADAPTER_ID,
        "page": page_number,
        "score": score_page(page, axis_fit),
        "axis_valid": axis_valid,
        **diagnostics,
    }
    row_y = _number(diagnostics.get("row_y"))

    if not axis_valid:
        issues.append(
            {
                "kind": "invalid_axis_fit",
                "reason": "axis fit must contain a finite non-zero slope and intercept",
            }
        )
    if not strokes:
        issues.append(
            {
                "kind": "grade_stroke_row_not_found",
                "reason": "no compact row of black grade strokes was found",
            }
        )
    if strokes and not trace:
        issues.append(
            {
                "kind": "profile_trace_not_found",
                "reason": "no thick black profile trace was found",
            }
        )

    trace_coverage = _number(diagnostics.get("trace_coverage_ratio"))
    for index, stroke in enumerate(strokes, start=1):
        reasons: list[str] = []
        evidence = ["cell_boundary_vector"]
        labels = _label_candidates(page, stroke, row_y)
        best_label_kind = labels[0]["kind"] if labels else None
        preferred_labels = [item for item in labels if item["kind"] == best_label_kind]
        magnitudes = sorted({round(float(item["magnitude"]), 4) for item in preferred_labels})
        magnitude = magnitudes[0] if len(magnitudes) == 1 else None
        if not labels:
            reasons.append("missing_magnitude_label")
        elif len(magnitudes) > 1:
            reasons.append("ambiguous_magnitude_label")
        else:
            selected_label = preferred_labels[0]
            evidence.append(f"{selected_label['kind']}:{selected_label['raw']}")

        if axis_valid:
            left_coordinate, left_residual = _coordinate((slope, intercept), stroke["left"])
            right_coordinate, right_residual = _coordinate((slope, intercept), stroke["right"])
            start_m = min(left_coordinate, right_coordinate)
            end_m = max(left_coordinate, right_coordinate)
            evidence.append("axis_fit_100m")
            if end_m <= start_m:
                reasons.append("non_positive_cell_length")
            if _number(axis_fit.get("max_residual_m"), math.inf) > 50.0:
                reasons.append("axis_fit_residual_high")
        else:
            left_coordinate = right_coordinate = None
            left_residual = right_residual = None
            start_m = end_m = None
            reasons.append("invalid_axis_fit")

        grade: float | None = None
        trace_delta_y: float | None = None
        trace_slope: float | None = None
        trace_y0: float | None = None
        trace_y1: float | None = None
        if magnitude is not None:
            if math.isclose(magnitude, 0.0, abs_tol=1e-9):
                grade = 0.0
                evidence.append("zero_magnitude")
            elif not trace:
                reasons.append("missing_profile_trace")
            else:
                samples = None
                for inset_ratio in (0.0, 0.05, 0.12):
                    span = stroke["right"] - stroke["left"]
                    left_x = stroke["left"] + span * inset_ratio
                    right_x = stroke["right"] - span * inset_ratio
                    left_y = _trace_y_at_x(trace, left_x)
                    right_y = _trace_y_at_x(trace, right_x)
                    if left_y is not None and right_y is not None:
                        samples = (left_x, left_y, right_x, right_y)
                        break
                if samples is None:
                    reasons.append("missing_trace_height")
                else:
                    left_x, left_y, right_x, right_y = samples
                    trace_y0 = left_y
                    trace_y1 = right_y
                    if not math.isclose(left_x, right_x, abs_tol=1e-9):
                        trace_slope = (right_y - left_y) / (right_x - left_x)
                    left_raw_coordinate = slope * left_x + intercept
                    right_raw_coordinate = slope * right_x + intercept
                    low_y, high_y = (
                        (left_y, right_y)
                        if left_raw_coordinate <= right_raw_coordinate
                        else (right_y, left_y)
                    )
                    trace_delta_y = high_y - low_y
                    threshold = max(0.08, (stroke["right"] - stroke["left"]) * 0.0008)
                    if abs(trace_delta_y) < threshold:
                        reasons.append("weak_trace_sign")
                        if not math.isclose(trace_delta_y, 0.0, abs_tol=1e-6):
                            grade = magnitude if trace_delta_y > 0 else -magnitude
                            evidence.append("pdf_profile_trace_weak")
                    else:
                        grade = magnitude if trace_delta_y > 0 else -magnitude
                        evidence.append("pdf_profile_trace")

        if trace and trace_coverage < 0.85:
            reasons.append("incomplete_trace_coverage")

        confidence = "pdf_vector_confirmed" if not reasons and grade is not None else "needs_review"
        cell = {
            "page": page_number,
            "index": index,
            "layout": ADAPTER_ID,
            "x0": round(stroke["left"], 4),
            "x1": round(stroke["right"], 4),
            "start_m": start_m,
            "end_m": end_m,
            "len_m": end_m - start_m if start_m is not None and end_m is not None else 0,
            "magnitude": magnitude,
            "magnitude_text": preferred_labels[0] if preferred_labels else None,
            "printed_length_m": None,
            "length_text": None,
            "length_evidence": [],
            "axis_slope": slope if axis_valid else None,
            "trace_slope": trace_slope,
            "trace_coverage": round(_trace_coverage(trace, stroke["left"], stroke["right"]), 4),
            "trace_y0": trace_y0,
            "trace_y1": trace_y1,
            "grade": round(grade, 4) if grade is not None else None,
            "confidence": confidence,
            "evidence": evidence,
            "review_reasons": reasons,
            "crop_box": _crop_box(page, stroke, trace, row_y),
            "source_cells": [{"page": page_number, "index": index}],
        }
        cells.append(cell)
        for reason in reasons:
            issues.append({"kind": reason, "cell": cell})

    diagnostics.update(
        {
            "cell_count": len(cells),
            "resolved_magnitude_count": sum(cell["magnitude"] is not None for cell in cells),
            "confirmed_count": sum(cell["confidence"] == "pdf_vector_confirmed" for cell in cells),
            "needs_review_count": sum(cell["confidence"] == "needs_review" for cell in cells),
        }
    )
    return {"cells": cells, "issues": issues, "diagnostics": diagnostics}
