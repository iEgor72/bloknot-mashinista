from __future__ import annotations

import math
import re
import statistics
from collections import defaultdict

from ..axis import coordinate_at_x
from ..trace import dominant_slope, y_at_x
from .blue_bottom_table import _bottom_km_top, _parse_magnitude, _table_dividers


ADAPTER_ID = "diagonal_grade_table"


def _parse_diagonal_magnitude(value: str) -> float | None:
    parsed = _parse_magnitude(value)
    if parsed is not None:
        return parsed
    if re.fullmatch(r"\d{1,2}", value):
        return float(value)
    return None


def _is_black_grade_vector(vector: dict) -> bool:
    stroke = vector.get("stroke")
    if stroke is not None:
        if not isinstance(stroke, tuple) or not stroke or max(abs(float(value)) for value in stroke) > 0.05:
            return False
    linewidth = float(vector.get("linewidth") or 0)
    return 0.55 <= linewidth <= 0.85


def _top_coordinates(page: dict, vector: dict) -> tuple[float, float]:
    height = float(page["height"])
    return height - float(vector["y0"]), height - float(vector["y1"])


def _table_band(page: dict, km_top: float) -> dict | None:
    """Locate the upper/lower Y levels of the diagonal grade table."""
    lows: list[float] = []
    highs: list[float] = []
    for vector in page["vectors"]:
        if not _is_black_grade_vector(vector):
            continue
        x_span = abs(float(vector["x1"]) - float(vector["x0"]))
        if not 3 <= x_span < float(page["width"]) * 0.80:
            continue
        top0, top1 = _top_coordinates(page, vector)
        low, high = sorted((top0, top1))
        if not (km_top + 4 <= low <= km_top + 70 and km_top + 4 <= high <= km_top + 75):
            continue
        if high - low < 15:
            continue
        lows.append(low)
        highs.append(high)
    if len(lows) < 3:
        return None
    table_top = statistics.median(lows)
    table_bottom = statistics.median(highs)
    height = table_bottom - table_top
    if not 28 <= height <= 58:
        return None
    return {
        "top": table_top,
        "bottom": table_bottom,
        "mid": (table_top + table_bottom) / 2,
        "height": height,
        "diagonal_samples": len(lows),
    }


def _cluster(values: list[float], tolerance: float) -> list[float]:
    groups: list[list[float]] = []
    for value in sorted(values):
        if not groups or value - groups[-1][-1] > tolerance:
            groups.append([value])
        else:
            groups[-1].append(value)
    return [statistics.mean(group) for group in groups]


def _cluster_boundary_candidates(candidates: list[dict], tolerance: float) -> list[dict]:
    """Cluster endpoints without single-link chaining across a real picket."""
    groups: list[list[dict]] = []
    for candidate in sorted(candidates, key=lambda item: float(item["x"])):
        if not groups or float(candidate["x"]) - float(groups[-1][0]["x"]) > tolerance:
            groups.append([candidate])
        else:
            groups[-1].append(candidate)
    return [
        {
            "x": statistics.mean(float(item["x"]) for item in group),
            "sources": sorted({str(source) for item in group for source in item["sources"]}),
            "support": len(group),
        }
        for group in groups
    ]


def _picket_grid_lines(
    page: dict,
    km_top: float,
    minimum_x: float,
    maximum_x: float,
) -> tuple[list[float], float | None]:
    candidates: list[float] = []
    for line in page["lines"]:
        x0, x1 = float(line["x0"]), float(line["x1"])
        top, bottom = float(line["top"]), float(line["bottom"])
        if (
            abs(x1 - x0) <= 0.5
            and minimum_x - 2 <= (x0 + x1) / 2 <= maximum_x + 2
            and km_top - 11 <= bottom <= km_top + 11
            and bottom - top >= 12
        ):
            candidates.append((x0 + x1) / 2)
    grid = _cluster(candidates, 0.8)
    if len(grid) < 20:
        return grid, None
    differences = [
        right - left
        for left, right in zip(grid, grid[1:])
        if 2 <= right - left <= 10
    ]
    difference_groups: list[list[float]] = []
    for value in sorted(differences):
        if not difference_groups or value - difference_groups[-1][-1] > 0.3:
            difference_groups.append([value])
        else:
            difference_groups[-1].append(value)
    if not difference_groups:
        return grid, None
    strongest = max(
        difference_groups,
        key=lambda group: (len(group), -statistics.mean(group)),
    )
    step = statistics.median(strongest)
    # Landscape exports use both ~5 pt and ~7.5 pt per 100 m rulers. Keep the
    # upper bound below the 1 km block spacing while accepting both families.
    return grid, step if 3.5 <= step <= 9.0 else None


def _interval_evidence_keys(
    left_x: float,
    right_x: float,
    magnitudes: list[dict],
    strokes: list[dict],
) -> set[tuple]:
    keys = {
        ("magnitude", round(float(token["x"]), 2), str(token.get("text", "")))
        for token in magnitudes
        if left_x <= float(token["x"]) < right_x
    }
    stroke = _stroke_for_interval(strokes, left_x, right_x)
    if stroke is not None:
        keys.add(
            (
                "stroke",
                round(float(stroke["x0"]), 2),
                round(float(stroke["x1"]), 2),
                int(stroke["sign"]),
            )
        )
    return keys


def _refine_bottom_only_boundaries(
    candidates: list[dict],
    magnitudes: list[dict],
    lengths: list[dict],
    strokes: list[dict],
    picket_step: float | None,
) -> list[dict]:
    if len(candidates) < 3:
        return candidates
    result = list(candidates)
    changed = True
    while changed and len(result) >= 3:
        changed = False
        for index in range(1, len(result) - 1):
            candidate = result[index]
            left_x = float(result[index - 1]["x"])
            center_x = float(candidate["x"])
            right_x = float(result[index + 1]["x"])
            left_evidence = _interval_evidence_keys(left_x, center_x, magnitudes, strokes)
            right_evidence = _interval_evidence_keys(center_x, right_x, magnitudes, strokes)
            distinct_neighbors = bool(
                left_evidence
                and right_evidence
                and left_evidence - right_evidence
                and right_evidence - left_evidence
            )
            if distinct_neighbors or picket_step is None:
                continue
            geometry_length = int(round((right_x - left_x) / picket_step)) * 100
            printed_lengths = {
                int(token["value"])
                for token in lengths
                if left_x <= float(token["x"]) < right_x
            }
            if geometry_length in printed_lengths:
                result.pop(index)
                changed = True
                break
    return result


def _table_boundaries(
    page: dict,
    km_top: float,
    band: dict,
    magnitudes: list[dict],
    lengths: list[dict],
    strokes: list[dict],
) -> list[float]:
    """Union explicit dividers with every diagonal endpoint on the table frame.

    Consecutive grades can point in the same direction.  In that case their
    shared boundary is represented only by two endpoints on the lower frame;
    using the upper frame alone silently joins the cells, while accepting lone
    lower endpoints creates false CAD-fragment cells.
    """
    candidates = [
        {"x": float(value), "sources": {"divider"}}
        for value in _table_dividers(page, km_top)
    ]
    tolerance = max(1.4, float(band["height"]) * 0.04)
    for vector in page["vectors"]:
        if not _is_black_grade_vector(vector):
            continue
        x0, x1 = float(vector["x0"]), float(vector["x1"])
        if abs(x1 - x0) <= 2:
            continue
        top0, top1 = _top_coordinates(page, vector)
        if abs(top0 - float(band["top"])) <= tolerance:
            candidates.append({"x": x0, "sources": {"top"}})
        elif abs(top0 - float(band["bottom"])) <= tolerance:
            candidates.append({"x": x0, "sources": {"bottom"}})
        if abs(top1 - float(band["top"])) <= tolerance:
            candidates.append({"x": x1, "sources": {"top"}})
        elif abs(top1 - float(band["bottom"])) <= tolerance:
            candidates.append({"x": x1, "sources": {"bottom"}})
    _grid, step = _picket_grid_lines(page, km_top, 0.0, float(page["width"]))
    endpoint_tolerance = max(0.8, float(step or 1.0) * 0.8)
    clustered = _cluster_boundary_candidates(candidates, endpoint_tolerance)
    refined = _refine_bottom_only_boundaries(
        clustered,
        magnitudes,
        lengths,
        strokes,
        step,
    )
    return [float(item["x"]) for item in refined]


def _bottom_km_row_labels(
    page: dict,
    axis_fit: dict,
    km_top: float,
) -> list[dict]:
    """Read the kilometre labels attached to the profile/table ruler.

    Some CAD sheets render the operational ruler at the top and the profile
    ruler at the bottom with different horizontal phases.  The lower labels
    share the picket lattice used by the grade table, so they are the stronger
    calibration anchor whenever at least four monotonic labels survive text
    extraction.
    """
    expected_values = {
        int(label["km"])
        for label in axis_fit.get("labels") or []
    }
    if not expected_values:
        return []

    candidates: list[dict] = []
    for word in page.get("words") or []:
        text = str(word.get("text", "")).strip()
        if not re.fullmatch(r"\d{1,4}", text):
            continue
        value = int(text)
        if value not in expected_values or abs(float(word.get("top", -9999)) - km_top) > 3.0:
            continue
        candidates.append(
            {
                "km": value,
                "x": (float(word.get("x0", 0)) + float(word.get("x1", 0))) / 2,
                "top": float(word.get("top", 0)),
            }
        )
    if len(candidates) < 4:
        return []

    direction = 1 if float(axis_fit["slope"]) > 0 else -1
    best: list[dict] = []
    ordered = sorted(candidates, key=lambda item: float(item["x"]))
    for start_index in range(len(ordered)):
        run = [ordered[start_index]]
        seen = {int(ordered[start_index]["km"])}
        for candidate in ordered[start_index + 1 :]:
            value = int(candidate["km"])
            if value in seen:
                continue
            if direction * (value - int(run[-1]["km"])) <= 0:
                continue
            run.append(candidate)
            seen.add(value)
        if (len(run), float(run[-1]["x"]) - float(run[0]["x"])) > (
            len(best),
            float(best[-1]["x"]) - float(best[0]["x"]) if best else 0.0,
        ):
            best = run
    return best if len(best) >= 4 else []


def _picket_grid_calibration(
    page: dict,
    axis_fit: dict,
    km_top: float,
    boundaries: list[float],
) -> dict | None:
    """Calibrate table boundaries against the printed 100 m picket ruler."""
    grid, step = _picket_grid_lines(page, km_top, boundaries[0], boundaries[-1])
    if len(grid) < 20 or step is None:
        return None

    direction = 1 if float(axis_fit["slope"]) > 0 else -1
    anchor_x = grid[0]
    bottom_labels = _bottom_km_row_labels(page, axis_fit, km_top)
    calibration_labels = bottom_labels or list(axis_fit.get("labels") or [])
    label_source = "bottom_km_row" if bottom_labels else "top_axis"
    base_candidates = [
        # The printed kilometre number is centred over its 1 km block, so its
        # text centre represents K + 500 m on the picket ruler.
        (float(label["km"]) + 0.5) * 1000
        - direction * ((float(label["x"]) - anchor_x) / step) * 100
        for label in calibration_labels
    ]
    if len(base_candidates) < 4:
        return None
    base_m = statistics.median(base_candidates)
    raw_start_m = base_m + direction * ((boundaries[0] - anchor_x) / step) * 100
    start_m = int(round(raw_start_m / 100) * 100)
    boundary_coordinates = [
        start_m
        + direction * int(round((boundary - boundaries[0]) / step)) * 100
        for boundary in boundaries
    ]
    label_residuals = [
        abs(
            base_m
            + direction * ((float(label["x"]) - anchor_x) / step) * 100
            - (float(label["km"]) + 0.5) * 1000
        )
        for label in calibration_labels
    ]
    sorted_residuals = sorted(label_residuals)
    p90_index = int(math.floor((len(sorted_residuals) - 1) * 0.9))
    return {
        "calibration": "picket_grid_100m",
        "grid_lines": len(grid),
        "step_x": step,
        "anchor_x": anchor_x,
        "base_m": base_m,
        "axis_label_source": label_source,
        "axis_labels_used": len(calibration_labels),
        "direction": "ascending" if direction > 0 else "descending",
        "boundary_coordinates": boundary_coordinates,
        "median_residual_m": statistics.median(label_residuals),
        "p90_residual_m": sorted_residuals[p90_index],
        "max_residual_m": max(label_residuals, default=math.inf),
    }


def _collapse_boundaries_on_picket_grid(
    boundaries: list[float],
    calibration: dict,
) -> tuple[list[float], dict]:
    """Join PDF join-points which resolve to the same printed picket.

    CAD exports sometimes split a diagonal at the table frame and leave two
    endpoints a few pixels apart.  They are not two railway profile cells when
    both endpoints land on the same 100 m ruler mark.
    """
    coordinates = [int(value) for value in calibration["boundary_coordinates"]]
    groups: list[tuple[int, list[float]]] = []
    for boundary, coordinate in zip(boundaries, coordinates):
        if groups and groups[-1][0] == coordinate:
            groups[-1][1].append(float(boundary))
        else:
            groups.append((coordinate, [float(boundary)]))
    collapsed = [statistics.mean(values) for _coordinate, values in groups]
    result = dict(calibration)
    result["boundary_coordinates"] = [coordinate for coordinate, _values in groups]
    result["collapsed_same_picket_boundaries"] = len(boundaries) - len(collapsed)
    return collapsed, result


def _refine_picket_coordinates_with_printed_lengths(
    boundaries: list[float],
    calibration: dict,
    matched: list[dict],
) -> dict:
    """Resolve one/two-picket CAD jitter while rejecting large text outliers."""
    if len(boundaries) < 2 or len(matched) != len(boundaries) - 1:
        return calibration
    step = float(calibration["step_x"])
    raw_positions = [(float(value) - float(boundaries[0])) / step for value in boundaries]
    candidates: list[list[int]] = [[0]]
    for raw_position in raw_positions[1:]:
        center = int(round(raw_position))
        candidates.append(sorted({value for value in range(center - 2, center + 3) if value >= 1}))

    costs: dict[int, tuple[float, list[int]]] = {0: (0.0, [0])}
    constrained_intervals = 0
    for index in range(1, len(boundaries)):
        interval = matched[index - 1]
        printed = interval.get("length")
        desired = None
        if printed is not None and int(interval.get("length_candidates") or 0) == 1:
            printed_value = int(printed["value"])
            raw_span = raw_positions[index] - raw_positions[index - 1]
            if printed_value >= 100 and printed_value % 100 == 0:
                candidate_desired = printed_value // 100
                if abs(candidate_desired - raw_span) <= 2.1:
                    desired = candidate_desired
                    constrained_intervals += 1
        next_costs: dict[int, tuple[float, list[int]]] = {}
        for current in candidates[index]:
            geometry_cost = (current - raw_positions[index]) ** 2
            best: tuple[float, list[int]] | None = None
            for previous, (previous_cost, path) in costs.items():
                if current <= previous:
                    continue
                transition_cost = 0.0
                if desired is not None:
                    transition_cost = 12.0 * ((current - previous) - desired) ** 2
                candidate = (previous_cost + geometry_cost + transition_cost, path + [current])
                if best is None or candidate[0] < best[0]:
                    best = candidate
            if best is not None:
                next_costs[current] = best
        if not next_costs:
            return calibration
        costs = next_costs
    _cost, offsets = min(costs.values(), key=lambda item: item[0])
    direction = 1 if str(calibration.get("direction")) == "ascending" else -1
    start_m = int(calibration["boundary_coordinates"][0])
    refined_coordinates = [start_m + direction * offset * 100 for offset in offsets]
    original_coordinates = [int(value) for value in calibration["boundary_coordinates"]]
    result = dict(calibration)
    result["boundary_coordinates"] = refined_coordinates
    result["printed_length_constraints"] = constrained_intervals
    result["printed_length_adjusted_boundaries"] = sum(
        left != right for left, right in zip(original_coordinates, refined_coordinates)
    )
    result["pre_length_refinement_coordinates"] = original_coordinates
    return result


def _union_length(intervals: list[tuple[float, float]]) -> float:
    ordered = sorted((min(left, right), max(left, right)) for left, right in intervals)
    if not ordered:
        return 0.0
    total = 0.0
    left, right = ordered[0]
    for next_left, next_right in ordered[1:]:
        if next_left <= right + 1.0:
            right = max(right, next_right)
        else:
            total += right - left
            left, right = next_left, next_right
    return total + right - left


def _is_blue(stroke: object) -> bool:
    return (
        isinstance(stroke, tuple)
        and len(stroke) == 3
        and float(stroke[2]) >= 0.65
        and float(stroke[2]) >= float(stroke[1]) + 0.08
        and float(stroke[2]) >= float(stroke[0]) + 0.18
    )


def _select_blue_trace(page: dict, km_top: float) -> tuple[list[dict], dict | None]:
    """Pick the widest blue style on this page; CAD styling varies by page."""
    groups: dict[tuple, list[dict]] = defaultdict(list)
    height = float(page["height"])
    for vector in page["vectors"]:
        top0, top1 = _top_coordinates(page, vector)
        linewidth = float(vector.get("linewidth") or 0)
        if (
            _is_blue(vector.get("stroke"))
            and 0.65 <= linewidth <= 3.40
            and min(top0, top1) >= height * 0.38
            and max(top0, top1) <= km_top + 3
            and abs(float(vector["x1"]) - float(vector["x0"])) > 1
        ):
            key = (
                tuple(round(float(channel), 3) for channel in vector["stroke"]),
                round(linewidth, 3),
            )
            groups[key].append(vector)
    if not groups:
        return [], None
    key, trace = max(
        groups.items(),
        key=lambda item: _union_length(
            [(float(vector["x0"]), float(vector["x1"])) for vector in item[1]]
        ),
    )
    return trace, {
        "stroke": list(key[0]),
        "linewidth": key[1],
        "segments": len(trace),
        "x_coverage": _union_length(
            [(float(vector["x0"]), float(vector["x1"])) for vector in trace]
        ),
    }


def _oriented_stroke(page: dict, vector: dict, band: dict) -> dict | None:
    if not _is_black_grade_vector(vector):
        return None
    x0, x1 = float(vector["x0"]), float(vector["x1"])
    y0, y1 = float(vector["y0"]), float(vector["y1"])
    if x1 < x0:
        x0, x1, y0, y1 = x1, x0, y1, y0
    x_span = x1 - x0
    if not 3 <= x_span < float(page["width"]) * 0.80:
        return None
    top0 = float(page["height"]) - y0
    top1 = float(page["height"]) - y1
    tolerance = max(3.2, float(band["height"]) * 0.09)
    if not (
        float(band["top"]) - tolerance <= top0 <= float(band["bottom"]) + tolerance
        and float(band["top"]) - tolerance <= top1 <= float(band["bottom"]) + tolerance
    ):
        return None

    top_span = abs(top1 - top0)
    if top_span >= float(band["height"]) * 0.35:
        sign = 1 if y1 > y0 else -1
        kind = "diagonal"
    elif top_span <= 1.5 and abs(((top0 + top1) / 2) - float(band["mid"])) <= tolerance:
        sign = 0
        kind = "flat"
    else:
        return None
    return {
        "x0": x0,
        "x1": x1,
        "y0": y0,
        "y1": y1,
        "top0": top0,
        "top1": top1,
        "sign": sign,
        "kind": kind,
        "linewidth": float(vector.get("linewidth") or 0),
        "source_vectors": 1,
    }


def _merge_flat_strokes(strokes: list[dict]) -> list[dict]:
    diagonals = [item for item in strokes if item["kind"] != "flat"]
    flats = sorted((item for item in strokes if item["kind"] == "flat"), key=lambda item: item["x0"])
    merged: list[dict] = []
    for stroke in flats:
        center_y = (float(stroke["top0"]) + float(stroke["top1"])) / 2
        if merged:
            previous = merged[-1]
            previous_y = (float(previous["top0"]) + float(previous["top1"])) / 2
            if stroke["x0"] <= previous["x1"] + 0.7 and abs(center_y - previous_y) <= 1.3:
                previous["x1"] = max(float(previous["x1"]), float(stroke["x1"]))
                previous["source_vectors"] = int(previous["source_vectors"]) + int(stroke["source_vectors"])
                continue
        merged.append(dict(stroke))
    return sorted(diagonals + merged, key=lambda item: (float(item["x0"]), float(item["x1"])))


def _grade_strokes(page: dict, band: dict) -> list[dict]:
    raw = [
        stroke
        for vector in page["vectors"]
        if (stroke := _oriented_stroke(page, vector, band)) is not None
    ]
    unique: list[dict] = []
    seen: set[tuple] = set()
    for stroke in raw:
        key = (
            round(float(stroke["x0"]), 1),
            round(float(stroke["x1"]), 1),
            int(stroke["sign"]),
            str(stroke["kind"]),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(stroke)
    return _merge_flat_strokes(unique)


def _char_center(char: dict) -> tuple[float, float]:
    return (
        (float(char["x0"]) + float(char["x1"])) / 2,
        (float(char["top"]) + float(char["bottom"])) / 2,
    )


def _chars_are_adjacent(left: dict, right: dict) -> bool:
    if bool(left.get("upright", True)) != bool(right.get("upright", True)):
        return False
    left_x, left_y = _char_center(left)
    right_x, right_y = _char_center(right)
    left_width = max(0.1, float(left["x1"]) - float(left["x0"]))
    right_width = max(0.1, float(right["x1"]) - float(right["x0"]))
    left_height = max(0.1, float(left["bottom"]) - float(left["top"]))
    right_height = max(0.1, float(right["bottom"]) - float(right["top"]))
    x_gap = max(0.0, max(float(left["x0"]), float(right["x0"])) - min(float(left["x1"]), float(right["x1"])))
    y_gap = max(0.0, max(float(left["top"]), float(right["top"])) - min(float(left["bottom"]), float(right["bottom"])))
    horizontal = (
        abs(right_y - left_y) <= max(left_height, right_height) * 0.35
        and x_gap <= 1.2
        and abs(right_x - left_x) <= max(left_width, right_width) * 1.8
    )
    vertical = (
        abs(right_x - left_x) <= max(left_width, right_width) * 0.35 + 0.5
        and y_gap <= 1.2
        and abs(right_y - left_y) <= max(left_height, right_height) * 1.8
    )
    return horizontal or vertical


def _numeric_tokens(page: dict, band: dict) -> tuple[list[dict], list[dict]]:
    """Read table numbers in PDF source order, including rotated labels."""
    numeric_chars = []
    for fallback_order, char in enumerate(page.get("chars") or []):
        text = str(char.get("text", ""))
        if text not in "0123456789,." or not text:
            continue
        _x, center_y = _char_center(char)
        if not float(band["top"]) + 0.5 <= center_y <= float(band["bottom"]) - 0.2:
            continue
        item = dict(char)
        item["order"] = int(item.get("order", fallback_order))
        numeric_chars.append(item)
    numeric_chars.sort(key=lambda item: int(item["order"]))

    groups: list[list[dict]] = []
    for char in numeric_chars:
        if (
            groups
            and int(char["order"]) == int(groups[-1][-1]["order"]) + 1
            and _chars_are_adjacent(groups[-1][-1], char)
        ):
            groups[-1].append(char)
        else:
            groups.append([char])

    magnitudes: list[dict] = []
    lengths: list[dict] = []
    for group in groups:
        text = "".join(str(char["text"]) for char in group).replace(".", ",")
        x0 = min(float(char["x0"]) for char in group)
        x1 = max(float(char["x1"]) for char in group)
        top = min(float(char["top"]) for char in group)
        bottom = max(float(char["bottom"]) for char in group)
        token = {
            "text": text,
            "x": (x0 + x1) / 2,
            "x0": x0,
            "x1": x1,
            "top": top,
            "bottom": bottom,
            "source": "pdf_chars",
        }
        magnitude = _parse_diagonal_magnitude(text)
        if magnitude is not None:
            magnitudes.append({**token, "value": magnitude})
        if re.fullmatch(r"\d{3,4}", text):
            lengths.append({**token, "value": int(text)})
    return magnitudes, lengths


def _token_in_stroke(token: dict, stroke: dict, margin: float = 1.2) -> bool:
    return float(stroke["x0"]) - margin <= float(token["x"]) <= float(stroke["x1"]) + margin


def _pick_token(tokens: list[dict], stroke: dict) -> tuple[dict | None, int]:
    candidates = [token for token in tokens if _token_in_stroke(token, stroke)]
    if not candidates:
        return None, 0
    midpoint = (float(stroke["x0"]) + float(stroke["x1"])) / 2
    return min(candidates, key=lambda token: abs(float(token["x"]) - midpoint)), len(candidates)


def _assign_tokens_to_intervals(
    tokens: list[dict],
    boundaries: list[float],
    margin: float = 1.5,
) -> list[list[dict]]:
    assignments: list[list[dict]] = [[] for _ in range(max(0, len(boundaries) - 1))]
    for token in tokens:
        token_x = float(token["x"])
        candidates = [
            index
            for index, (left_x, right_x) in enumerate(zip(boundaries, boundaries[1:]))
            if float(left_x) - margin <= token_x <= float(right_x) + margin
        ]
        if not candidates:
            continue
        owner = min(
            candidates,
            key=lambda index: abs(
                token_x - (float(boundaries[index]) + float(boundaries[index + 1])) / 2
            ),
        )
        assignments[owner].append(token)
    return assignments


def _stroke_for_interval(strokes: list[dict], left_x: float, right_x: float) -> dict | None:
    width = max(0.001, right_x - left_x)
    candidates: list[tuple[float, float, dict]] = []
    for stroke in strokes:
        overlap = max(0.0, min(right_x, float(stroke["x1"])) - max(left_x, float(stroke["x0"])))
        if overlap < width * 0.72:
            continue
        endpoint_error = abs(float(stroke["x0"]) - left_x) + abs(float(stroke["x1"]) - right_x)
        vertical_span = abs(float(stroke["top1"]) - float(stroke["top0"]))
        candidates.append((endpoint_error, -vertical_span, stroke))
    if not candidates:
        return None
    candidates.sort(key=lambda item: (item[0], item[1]))
    return candidates[0][2]


def _trace_sign(trace: list[dict], left_x: float, right_x: float) -> tuple[int | None, dict]:
    left_y = y_at_x(trace, left_x, tolerance=1.2) if trace else None
    right_y = y_at_x(trace, right_x, tolerance=1.2) if trace else None
    slope = dominant_slope(trace, left_x, right_x) if trace else None
    value = None
    if left_y is not None and right_y is not None and abs(right_y - left_y) >= 0.02:
        value = right_y - left_y
    elif slope is not None and abs(float(slope["slope"])) >= 0.0001:
        value = float(slope["slope"])
    sign = None if value is None else (1 if value > 0 else -1)
    endpoint_slope = (
        (right_y - left_y) / (right_x - left_x)
        if left_y is not None and right_y is not None and abs(right_x - left_x) > 0.001
        else None
    )
    return sign, {
        "trace_y0": left_y,
        "trace_y1": right_y,
        "trace_slope": float(slope["slope"]) if slope else None,
        "trace_coverage": float(slope["coverage"]) if slope else 0.0,
        "trace_endpoint_slope": endpoint_slope,
        "trace_endpoint_available": endpoint_slope is not None,
    }


def _trace_conflict_is_actionable(
    magnitude: float | None,
    table_sign: int | None,
    trace_sign: int | None,
    trace_coverage: float,
) -> bool:
    return bool(
        magnitude not in (None, 0)
        and table_sign not in (None, 0)
        and trace_sign not in (None, 0)
        and table_sign != trace_sign
        and trace_coverage >= 0.55
    )


def _matched_strokes(page: dict, axis_fit: dict) -> dict | None:
    km_top = _bottom_km_top(page, axis_fit)
    if km_top is None:
        return None
    band = _table_band(page, km_top)
    if band is None:
        return None
    strokes = _grade_strokes(page, band)
    magnitudes, lengths = _numeric_tokens(page, band)
    boundaries = _table_boundaries(page, km_top, band, magnitudes, lengths, strokes)
    if len(boundaries) < 5:
        return None
    trace, trace_style = _select_blue_trace(page, km_top)
    picket_calibration = _picket_grid_calibration(page, axis_fit, km_top, boundaries)
    if picket_calibration is not None:
        boundaries, picket_calibration = _collapse_boundaries_on_picket_grid(
            boundaries,
            picket_calibration,
        )
    magnitude_assignments = _assign_tokens_to_intervals(magnitudes, boundaries)
    length_assignments = _assign_tokens_to_intervals(lengths, boundaries)
    matched: list[dict] = []
    for boundary_index, (left_x, right_x) in enumerate(zip(boundaries, boundaries[1:])):
        interval = {"x0": left_x, "x1": right_x}
        magnitude_candidates = magnitude_assignments[boundary_index]
        length_candidates = length_assignments[boundary_index]
        midpoint = (float(left_x) + float(right_x)) / 2
        magnitude = (
            min(magnitude_candidates, key=lambda token: abs(float(token["x"]) - midpoint))
            if magnitude_candidates
            else None
        )
        length = (
            min(length_candidates, key=lambda token: abs(float(token["x"]) - midpoint))
            if length_candidates
            else None
        )
        magnitude_count = len(magnitude_candidates)
        length_count = len(length_candidates)
        table_stroke = _stroke_for_interval(strokes, left_x, right_x)
        trace_sign, trace_evidence = _trace_sign(trace, left_x, right_x)
        matched.append(
            {
                "x0": left_x,
                "x1": right_x,
                "boundary_index": boundary_index,
                "magnitude": magnitude,
                "magnitude_candidates": magnitude_count,
                "length": length,
                "length_candidates": length_count,
                "table_stroke": table_stroke,
                "trace_sign": trace_sign,
                **trace_evidence,
            }
        )
    if picket_calibration is not None:
        picket_calibration = _refine_picket_coordinates_with_printed_lengths(
            boundaries,
            picket_calibration,
            matched,
        )
    return {
        "km_top": km_top,
        "band": band,
        "boundaries": boundaries,
        "strokes": strokes,
        "magnitudes": magnitudes,
        "lengths": lengths,
        "trace": trace,
        "trace_style": trace_style,
        "picket_calibration": picket_calibration,
        "matched": matched,
    }


def score_page(page: dict, axis_fit: dict) -> float:
    result = _matched_strokes(page, axis_fit)
    if result is None:
        return 0.0
    matched = len(result["matched"])
    magnitudes = len(result["magnitudes"])
    if matched < 4:
        return 0.0
    coverage = magnitudes / max(1, matched)
    if coverage < 0.45:
        return 0.0
    return min(100.0, 88.0 + min(7.0, matched * 0.5) + min(5.0, coverage * 5.0))


def extract_page(page: dict, axis_fit: dict) -> dict:
    result = _matched_strokes(page, axis_fit)
    if result is None:
        return {
            "cells": [],
            "issues": [{"kind": "diagonal_table_not_found", "reason": "diagonal grade table not found"}],
            "diagnostics": {"adapter": ADAPTER_ID},
        }

    cells: list[dict] = []
    issues: list[dict] = []
    used_magnitude_orders: set[tuple] = set()
    used_length_orders: set[tuple] = set()
    band = result["band"]
    picket_calibration = result.get("picket_calibration")
    residual_value = (
        picket_calibration.get("median_residual_m")
        if picket_calibration is not None
        else axis_fit.get("max_residual_m")
    )
    axis_residual = float(residual_value) if residual_value is not None else math.inf
    chainage_direction = 1 if float(axis_fit["slope"]) > 0 else -1
    for matched in result["matched"]:
        left_x = float(matched["x0"])
        right_x = float(matched["x1"])
        if picket_calibration is not None:
            boundary_index = int(matched["boundary_index"])
            left_coordinate = int(picket_calibration["boundary_coordinates"][boundary_index])
            right_coordinate = int(picket_calibration["boundary_coordinates"][boundary_index + 1])
        else:
            left_coordinate = coordinate_at_x(axis_fit, left_x)
            right_coordinate = coordinate_at_x(axis_fit, right_x)
        start_m, end_m = sorted((left_coordinate, right_coordinate))
        magnitude = (
            float(matched["magnitude"]["value"])
            if matched.get("magnitude") is not None
            else None
        )
        table_stroke = matched.get("table_stroke")
        table_sign = (
            int(table_stroke["sign"]) * chainage_direction
            if table_stroke is not None
            else None
        )
        raw_trace_sign = matched.get("trace_sign")
        trace_sign = (
            int(raw_trace_sign) * chainage_direction
            if raw_trace_sign in (-1, 1)
            else None
        )
        # The blue profile is useful QA, but its CAD colour/segmentation varies
        # too much to be the authoritative sign source for this layout.
        sign = table_sign
        reasons: list[str] = []
        if magnitude is None and table_sign == 0:
            grade = 0.0
        elif magnitude is None:
            grade = None
            reasons.append("missing_pdf_magnitude")
        elif magnitude == 0:
            grade = 0.0
            if table_sign not in (None, 0):
                reasons.append("zero_magnitude_on_diagonal")
        elif sign in (None, 0):
            grade = None
            reasons.append("missing_or_flat_grade_sign")
        else:
            grade = round(magnitude * sign, 4)
        table_trace_sign_conflict = _trace_conflict_is_actionable(
            magnitude,
            table_sign,
            trace_sign,
            float(matched.get("trace_coverage") or 0.0),
        )
        if table_trace_sign_conflict:
            reasons.append("table_trace_sign_conflict")
        if int(matched["magnitude_candidates"]) > 1:
            reasons.append("multiple_magnitude_tokens_in_cell")
        if int(matched["length_candidates"]) > 1:
            reasons.append("multiple_length_tokens_in_cell")
        if end_m <= start_m:
            reasons.append("non_positive_cell_length")
        if axis_residual > 50:
            reasons.append("axis_residual_exceeds_50m")

        printed_length = matched["length"]["value"] if matched.get("length") else None
        evidence = ["km_axis", "vector_cell_boundaries"]
        if picket_calibration is not None:
            evidence.append("picket_grid_100m")
        if table_stroke is not None:
            evidence.append(
                "horizontal_zero_grade_stroke"
                if table_stroke["kind"] == "flat"
                else "diagonal_grade_stroke"
            )
        if trace_sign is not None:
            evidence.append("dynamic_blue_profile_trace")
        if magnitude is not None:
            evidence.append("pdf_magnitude_text")
        if printed_length is not None:
            evidence.append("pdf_length_text")
        confidence = "pdf_vector_confirmed" if not reasons and grade is not None else "needs_review"
        cell = {
            "page": int(page["page_number"]),
            "index": 0,
            "layout": ADAPTER_ID,
            "x0": left_x,
            "x1": right_x,
            "start_m": start_m,
            "end_m": end_m,
            "len_m": end_m - start_m,
            "magnitude": magnitude,
            "magnitude_text": matched.get("magnitude"),
            "printed_length_m": printed_length,
            "length_text": matched.get("length"),
            "stroke_sign": sign,
            "table_stroke_sign": table_sign,
            "trace_sign": trace_sign,
            "table_trace_sign_conflict": table_trace_sign_conflict,
            "stroke_kind": table_stroke["kind"] if table_stroke else None,
            "stroke_top0": float(table_stroke["top0"]) if table_stroke else None,
            "stroke_top1": float(table_stroke["top1"]) if table_stroke else None,
            "source_vectors": int(table_stroke["source_vectors"]) if table_stroke else 0,
            "trace_y0": matched.get("trace_y0"),
            "trace_y1": matched.get("trace_y1"),
            "trace_slope": matched.get("trace_slope"),
            "trace_coverage": matched.get("trace_coverage"),
            "trace_endpoint_slope": matched.get("trace_endpoint_slope"),
            "trace_endpoint_available": matched.get("trace_endpoint_available"),
            "axis_slope": float(axis_fit["slope"]),
            "axis_residual_m": axis_residual,
            "grade": grade,
            "confidence": confidence,
            "evidence": evidence,
            "review_reasons": reasons,
            "crop_box": [
                max(0.0, left_x - 35),
                max(0.0, float(band["top"]) - 145),
                min(float(page["width"]), right_x + 35),
                min(float(page["height"]), float(band["bottom"]) + 12),
            ],
            "source_cells": [],
            "length_evidence": [],
        }
        if printed_length is not None:
            cell["length_evidence"].append(
                {
                    "page": int(page["page_number"]),
                    "index": 0,
                    "geometry_len_m": int(cell["len_m"]),
                    "printed_len_m": int(printed_length),
                    "crop_box": cell["crop_box"],
                }
            )
        cells.append(cell)
        token = matched.get("magnitude")
        if token is not None:
            used_magnitude_orders.add((round(float(token["x"]), 2), str(token["text"])))
        length_token = matched.get("length")
        if length_token is not None:
            used_length_orders.add(
                (round(float(length_token["x"]), 2), str(length_token["text"]))
            )

    cells.sort(key=lambda cell: (int(cell["start_m"]), int(cell["end_m"])))
    for index, cell in enumerate(cells, start=1):
        cell["index"] = index
        cell["source_cells"] = [{"page": int(page["page_number"]), "index": index}]
        for evidence in cell["length_evidence"]:
            evidence["index"] = index

    unmatched = [
        token
        for token in result["magnitudes"]
        if (round(float(token["x"]), 2), str(token["text"])) not in used_magnitude_orders
    ]
    if unmatched:
        issues.append(
            {
                "kind": "unmatched_magnitude_text",
                "reason": f"{len(unmatched)} grade labels were not matched to table strokes",
                "tokens": unmatched,
            }
        )

    unmatched_lengths = [
        token
        for token in result["lengths"]
        if (round(float(token["x"]), 2), str(token["text"])) not in used_length_orders
    ]

    diagnostics = {
        "adapter": ADAPTER_ID,
        "km_top": float(result["km_top"]),
        "table_band": band,
        "cell_boundaries": len(result["boundaries"]),
        "grade_strokes": len(result["strokes"]),
        "magnitude_tokens": len(result["magnitudes"]),
        "length_tokens": len(result["lengths"]),
        "matched_cells": len(cells),
        "unmatched_magnitude_tokens": len(unmatched),
        "unmatched_length_tokens": len(unmatched_lengths),
        "trace_style": result.get("trace_style"),
        "picket_calibration": picket_calibration,
        "source_axis_max_residual_m": float(
            axis_fit["max_residual_m"]
            if axis_fit.get("max_residual_m") is not None
            else math.inf
        ),
        "axis_slope": float(axis_fit["slope"]),
        "axis_max_residual_m": axis_residual,
    }
    return {"cells": cells, "issues": issues, "diagnostics": diagnostics}
