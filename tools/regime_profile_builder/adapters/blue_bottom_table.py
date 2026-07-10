from __future__ import annotations

import re
import statistics

from ..axis import coordinate_at_x
from ..trace import dominant_slope, select_wide_components, y_at_x


ADAPTER_ID = "blue_bottom_table"
_BLUE = (0.0, 0.439, 0.753)


def _parse_magnitude(text: str) -> float | None:
    value = text.strip().replace(".", ",")
    if value == "0":
        return 0.0
    if not re.fullmatch(r"\d{1,2},\d{1,2}", value):
        return None
    return float(value.replace(",", "."))


def _word_center(word: dict) -> float:
    return (float(word["x0"]) + float(word["x1"])) / 2


def _bottom_km_top(page: dict, axis_fit: dict) -> float | None:
    axis_values = {str(item["km"]) for item in axis_fit.get("labels", [])}
    candidates = [
        float(word["top"])
        for word in page["words"]
        if str(word.get("text", "")).strip() in axis_values
        and float(word.get("top", 0)) > float(page["height"]) * 0.55
    ]
    return statistics.median(candidates) if candidates else None


def _table_dividers(page: dict, km_top: float) -> list[float]:
    candidates: list[float] = []
    for line in page["lines"]:
        x0, x1 = float(line["x0"]), float(line["x1"])
        top, bottom = float(line["top"]), float(line["bottom"])
        if (
            abs(x1 - x0) < 0.06
            and km_top - 8 <= top <= km_top + 22
            and km_top + 40 <= bottom <= km_top + 82
            and bottom - top > 30
        ):
            candidates.append(x0)
    candidates.sort()
    result: list[float] = []
    for value in candidates:
        if not result or value - result[-1] > 0.2:
            result.append(value)
    return result


def _is_blue_profile(vector: dict) -> bool:
    stroke = vector.get("stroke")
    if not isinstance(stroke, tuple) or len(stroke) != 3:
        return False
    if not all(abs(float(actual) - expected) < 0.015 for actual, expected in zip(stroke, _BLUE)):
        return False
    linewidth = float(vector.get("linewidth") or 0)
    return 0.62 <= linewidth <= 0.90


def _select_trace(page: dict) -> list[dict]:
    return select_wide_components(page["vectors"], _is_blue_profile, minimum_span=45)


def _picket_grid_xs(page: dict, km_top: float, left_x: float, right_x: float) -> list[float]:
    candidates: list[float] = []
    for line in page["lines"]:
        x0, x1 = float(line["x0"]), float(line["x1"])
        top, bottom = float(line["top"]), float(line["bottom"])
        if (
            abs(x1 - x0) < 0.06
            and left_x - 1 <= x0 <= right_x + 1
            and km_top - 5 <= bottom <= km_top + 5
            and bottom - top >= 15
        ):
            candidates.append(x0)
    candidates.sort()
    result: list[float] = []
    for value in candidates:
        if not result or value - result[-1] > 0.2:
            result.append(value)
    return result


def _calibrate_to_km_blocks(
    axis_fit: dict,
    left_x: float,
    right_x: float,
    picket_xs: list[float] | None = None,
) -> dict:
    """Anchor the page to the railway kilometre blocks printed in the ruler.

    In these regime cards a block labelled ``3628`` covers 3627+900 through
    3628+900.  The generic axis fit deliberately uses only label centres and
    can therefore round a page edge one picket (100 m) the wrong way.  Page
    edges are stronger evidence: they coincide with complete kilometre-block
    boundaries.  Infer the first/last visible block from every reliable axis
    label, then fit the exact ruler span between the two table edges.
    """
    labels = list(axis_fit.get("labels") or [])
    if not labels or right_x <= left_x:
        return dict(axis_fit)

    scale = abs(float(axis_fit["slope"]))
    ascending = float(axis_fit["slope"]) > 0
    first_candidates: list[float] = []
    last_candidates: list[float] = []
    for label in labels:
        km = float(label["km"])
        x = float(label["x"])
        left_delta_km = (x - left_x) * scale / 1000
        right_delta_km = (right_x - x) * scale / 1000
        if ascending:
            first_candidates.append(km + 0.5 - left_delta_km)
            last_candidates.append(km - 0.5 + right_delta_km)
        else:
            first_candidates.append(km - 0.5 + left_delta_km)
            last_candidates.append(km + 0.5 - right_delta_km)

    first_km = int(round(statistics.median(first_candidates)))

    # The vertical ruler grid is the strongest metric evidence available: one
    # adjacent line pair is exactly one picket (100 m), including on a partial
    # final page that ends at (for example) picket 6 rather than a full km.
    grid = sorted(picket_xs or [])
    if len(grid) >= 4:
        differences = [right - left for left, right in zip(grid, grid[1:]) if right > left]
        # Missing verticals are common where a signal masks the profile.  Use
        # the median one-picket spacing and extend its lattice to the nearest
        # page-table edges instead of mistaking the first detected line for
        # the start of the kilometre ruler.
        one_picket_differences = [value for value in differences if value <= min(differences) * 1.35]
        step = statistics.median(one_picket_differences) if one_picket_differences else 0.0
        left_steps = int(round((grid[0] - left_x) / step)) if step > 0 else 0
        right_steps = int(round((right_x - grid[-1]) / step)) if step > 0 else 0
        grid_left = grid[0] - max(0, left_steps) * step
        grid_right = grid[-1] + max(0, right_steps) * step
        interval_count = int(round((grid_right - grid_left) / step)) if step > 0 else 0
        endpoint_error = abs((grid_right - grid_left) - interval_count * step) if step > 0 else 999.0
        if interval_count >= 3 and endpoint_error <= step * 0.25:
            left_coordinate = first_km * 1000 + (900 if not ascending else -100)
            right_coordinate = left_coordinate + (interval_count * 100 if ascending else -interval_count * 100)
            slope = (right_coordinate - left_coordinate) / (grid_right - grid_left)
            calibrated = dict(axis_fit)
            calibrated.update(
                {
                    "slope": slope,
                    "intercept": left_coordinate - slope * grid_left,
                    "ruler_first_km": first_km,
                    "ruler_last_km": int((right_coordinate + 100) // 1000),
                    "ruler_left_m": left_coordinate,
                    "ruler_right_m": right_coordinate,
                    "ruler_picket_intervals": interval_count,
                    "calibration": "picket_grid",
                }
            )
            return calibrated

    last_km = int(round(statistics.median(last_candidates)))
    if ascending:
        left_coordinate = first_km * 1000 - 100
        right_coordinate = last_km * 1000 + 900
    else:
        left_coordinate = first_km * 1000 + 900
        right_coordinate = last_km * 1000 - 100

    # Reject an implausible inference rather than silently stretching a page.
    original_span = abs(float(axis_fit["slope"]) * (right_x - left_x))
    calibrated_span = abs(right_coordinate - left_coordinate)
    # A short final page can end in the middle of the last kilometre block
    # (for example at picket 6).  In that case the complete-block hypothesis
    # stretches the ruler by several pickets and must be rejected.
    if calibrated_span <= 0 or abs(calibrated_span - original_span) > 150:
        return dict(axis_fit)

    slope = (right_coordinate - left_coordinate) / (right_x - left_x)
    calibrated = dict(axis_fit)
    calibrated.update(
        {
            "slope": slope,
            "intercept": left_coordinate - slope * left_x,
            "ruler_first_km": first_km,
            "ruler_last_km": last_km,
            "ruler_left_m": left_coordinate,
            "ruler_right_m": right_coordinate,
            "calibration": "complete_km_blocks",
        }
    )
    return calibrated


def score_page(page: dict, axis_fit: dict) -> float:
    km_top = _bottom_km_top(page, axis_fit)
    if km_top is None:
        return 0.0
    dividers = _table_dividers(page, km_top)
    trace = _select_trace(page)
    if len(dividers) < 4 or len(trace) < 2:
        return 0.0
    x_span = dividers[-1] - dividers[0]
    trace_xs = [float(value) for item in trace for value in (item["x0"], item["x1"])]
    trace_span = max(trace_xs) - min(trace_xs) if trace_xs else 0
    alignment = 1.0 if x_span and abs(trace_span - x_span) <= max(2.0, x_span * 0.02) else 0.5
    return min(100.0, 50.0 + len(dividers) + min(20.0, len(trace) / 2) + alignment * 10)


def _pick_word(
    words: list[dict],
    x0: float,
    x1: float,
    top_min: float,
    top_max: float,
    parser,
) -> dict | None:
    candidates: list[dict] = []
    for word in words:
        center = _word_center(word)
        top = float(word["top"])
        if not (x0 - 0.4 <= center <= x1 + 0.4 and top_min <= top <= top_max):
            continue
        value = parser(str(word["text"]))
        if value is None:
            continue
        candidates.append({"text": str(word["text"]), "value": value, "x": center, "top": top})
    if not candidates:
        return None
    midpoint = (x0 + x1) / 2
    return min(candidates, key=lambda item: abs(item["x"] - midpoint))


def extract_page(page: dict, axis_fit: dict) -> dict:
    km_top = _bottom_km_top(page, axis_fit)
    if km_top is None:
        return {
            "cells": [],
            "issues": [{"kind": "table_not_found", "reason": "lower kilometre table not found"}],
            "diagnostics": {"adapter": ADAPTER_ID},
        }
    dividers = _table_dividers(page, km_top)
    trace = _select_trace(page)
    if len(dividers) < 4 or len(trace) < 2:
        return {
            "cells": [],
            "issues": [{"kind": "layout_incomplete", "reason": "table dividers or blue trace not found"}],
            "diagnostics": {
                "adapter": ADAPTER_ID,
                "dividers": len(dividers),
                "trace_vectors": len(trace),
            },
        }

    picket_xs = _picket_grid_xs(page, km_top, dividers[0], dividers[-1])
    calibrated_axis = _calibrate_to_km_blocks(
        axis_fit,
        dividers[0],
        dividers[-1],
        picket_xs,
    )

    cells: list[dict] = []
    issues: list[dict] = []
    for index, (left_x, right_x) in enumerate(zip(dividers, dividers[1:]), start=1):
        left_coordinate = coordinate_at_x(calibrated_axis, left_x)
        right_coordinate = coordinate_at_x(calibrated_axis, right_x)
        start_m, end_m = sorted((left_coordinate, right_coordinate))
        magnitude_word = _pick_word(
            page["words"], left_x, right_x, km_top + 9, km_top + 31, _parse_magnitude
        )
        length_word = _pick_word(
            page["words"],
            left_x,
            right_x,
            km_top + 34,
            km_top + 66,
            lambda value: int(value) if re.fullmatch(r"\d{3,4}", value.strip()) else None,
        )
        slope = dominant_slope(trace, left_x, right_x)
        left_y = y_at_x(trace, left_x)
        right_y = y_at_x(trace, right_x)
        evidence = ["km_axis", "vector_boundaries", "blue_profile_trace"]
        if magnitude_word:
            evidence.append("pdf_magnitude_text")
        if length_word:
            evidence.append("pdf_length_text")
        cell = {
            "page": int(page["page_number"]),
            "index": index,
            "layout": ADAPTER_ID,
            "x0": left_x,
            "x1": right_x,
            "start_m": start_m,
            "end_m": end_m,
            "len_m": end_m - start_m,
            "magnitude": magnitude_word["value"] if magnitude_word else None,
            "magnitude_text": magnitude_word,
            "printed_length_m": length_word["value"] if length_word else None,
            "length_text": length_word,
            "trace_slope": slope["slope"] if slope else None,
            "trace_coverage": slope["coverage"] if slope else 0.0,
            "trace_competing_segments": slope["competing_segments"] if slope else 0,
            "trace_y0": left_y,
            "trace_y1": right_y,
            "axis_slope": float(calibrated_axis["slope"]),
            "grade": None,
            "confidence": "needs_review",
            "evidence": evidence,
            "review_reasons": [],
            "crop_box": [
                max(0.0, left_x - 45),
                max(0.0, km_top - 155),
                min(float(page["width"]), right_x + 45),
                min(float(page["height"]), km_top + 72),
            ],
            "source_cells": [{"page": int(page["page_number"]), "index": index}],
        }
        if cell["len_m"] <= 0:
            cell["review_reasons"].append("non_positive_cell_length")
            issues.append({"kind": "invalid_boundary", "cell": cell})
        cells.append(cell)

    trace_xs = [float(value) for item in trace for value in (item["x0"], item["x1"])]
    diagnostics = {
        "adapter": ADAPTER_ID,
        "km_top": km_top,
        "dividers": len(dividers),
        "trace_vectors": len(trace),
        "table_x_range": [dividers[0], dividers[-1]],
        "trace_x_range": [min(trace_xs), max(trace_xs)],
        "picket_grid_lines": len(picket_xs),
        "axis_calibration": {
            key: calibrated_axis[key]
            for key in (
                "calibration",
                "ruler_first_km",
                "ruler_last_km",
                "ruler_left_m",
                "ruler_right_m",
                "ruler_picket_intervals",
                "slope",
                "intercept",
            )
            if key in calibrated_axis
        },
    }
    return {"cells": cells, "issues": issues, "diagnostics": diagnostics}
