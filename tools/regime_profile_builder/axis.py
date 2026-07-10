from __future__ import annotations

import math
import re
import statistics


def _longest_consecutive_run(candidates: list[dict]) -> list[dict]:
    candidates.sort(key=lambda item: item["x"])
    best: list[dict] = []
    for start_index in range(len(candidates)):
        run = [candidates[start_index]]
        direction = 0
        for candidate in candidates[start_index + 1 :]:
            difference = candidate["km"] - run[-1]["km"]
            next_direction = 1 if difference == 1 else -1 if difference == -1 else 0
            if next_direction and direction in (0, next_direction):
                run.append(candidate)
                direction = next_direction
                continue
            # Page drawings may overlay signal/track numbers on the same text
            # row. Skip those noisy candidates and continue looking for the
            # next consecutive kilometre label to the right.
            continue
        if len(run) > len(best):
            best = run
    return best


def _axis_run_quality(run: list[dict]) -> tuple:
    """Rank a consecutive axis run by coverage and geometric regularity."""

    if not run:
        return (0, 0, -math.inf, -math.inf, -math.inf)
    spacings = [
        abs(float(right["x"]) - float(left["x"]))
        for left, right in zip(run, run[1:])
    ]
    spacing_cv = (
        statistics.pstdev(spacings) / statistics.mean(spacings)
        if len(spacings) >= 2 and statistics.mean(spacings) > 0
        else 0.0
    )
    tops = [float(item["top"]) for item in run]
    top_spread = max(tops) - min(tops) if tops else math.inf
    span = (
        abs(float(run[-1]["x"]) - float(run[0]["x"]))
        if len(run) >= 2
        else 0.0
    )
    return (
        len(run),
        sum(int(item["km"]) >= 10 for item in run),
        -spacing_cv,
        -top_spread,
        span,
    )


def _best_axis_run(candidates: list[dict], row_tolerance: float = 8.0) -> list[dict]:
    """Choose the strongest numeric row instead of blindly taking the topmost."""
    rows: list[list[dict]] = []
    for candidate in sorted(candidates, key=lambda item: (float(item["top"]), float(item["x"]))):
        target = next(
            (
                row
                for row in rows
                if abs(statistics.median(float(item["top"]) for item in row) - float(candidate["top"]))
                <= row_tolerance
            ),
            None,
        )
        if target is None:
            target = []
            rows.append(target)
        target.append(candidate)

    ranked: list[tuple[tuple, list[dict]]] = []
    for row in rows:
        run = _longest_consecutive_run(list(row))
        if not run:
            continue
        ranked.append(
            (
                _axis_run_quality(run)
                + (statistics.mean(float(item["top"]) for item in run),),
                run,
            )
        )
    return max(ranked, key=lambda item: item[0])[1] if ranked else []


def _char_baseline(char: dict) -> float:
    top = float(char.get("top", 0))
    return float(char.get("bottom", top + float(char.get("size", 0) or 0)))


def _char_token_candidates(chars: list[dict], page_height: float) -> list[dict]:
    """Recover numeric tokens without geometrically merging overlaid text.

    Some CAD-authored PDFs draw an unrelated number and a kilometre label at
    almost the same X/Y coordinates. ``extract_words`` then concatenates both
    streams (for example ``148`` over ``204`` becomes ``124084``). Character
    source order still keeps each draw operation contiguous, so use it together
    with baseline, size and rightward X continuity to reconstruct the tokens.
    """

    top_limit = max(90.0, page_height * 0.20)
    numeric: list[dict] = []
    for sequence, char in enumerate(chars):
        if (
            not str(char.get("text", "")).isdigit()
            or float(char.get("top", 9999)) > top_limit
            or float(char.get("size", 0) or 0) < 8
            or not bool(char.get("upright", True))
        ):
            continue
        prepared = dict(char)
        prepared["_sequence"] = sequence
        try:
            prepared["_order"] = int(char.get("order", sequence))
        except (TypeError, ValueError):
            prepared["_order"] = sequence
        numeric.append(prepared)

    groups: list[list[dict]] = []
    current: list[dict] = []
    for char in sorted(numeric, key=lambda item: (item["_order"], item["_sequence"])):
        if current:
            previous = current[-1]
            size = max(float(previous.get("size", 0) or 0), float(char.get("size", 0) or 0))
            x_gap = float(char.get("x0", 0)) - float(previous.get("x1", 0))
            continues = (
                int(char["_order"]) == int(previous["_order"]) + 1
                and abs(_char_baseline(char) - _char_baseline(previous))
                <= max(0.25, size * 0.04)
                and abs(float(char.get("size", 0) or 0) - float(previous.get("size", 0) or 0))
                <= max(0.15, size * 0.03)
                and -max(0.5, size * 0.10) <= x_gap <= max(2.0, size * 0.60)
                and float(char.get("x0", 0)) > float(previous.get("x0", 0))
            )
            if not continues:
                groups.append(current)
                current = []
        current.append(char)
    if current:
        groups.append(current)

    candidates: list[dict] = []
    for group in groups:
        text = "".join(str(char["text"]) for char in group)
        if not re.fullmatch(r"\d{1,4}", text):
            continue
        value = int(text)
        if not 0 <= value <= 9999:
            continue
        left = min(float(char.get("x0", 0)) for char in group)
        right = max(float(char.get("x1", 0)) for char in group)
        candidates.append(
            {
                "km": value,
                "x": (left + right) / 2,
                "top": statistics.mean(float(char.get("top", 0)) for char in group),
            }
        )
    return candidates


def _axis_from_chars(chars: list[dict], page_height: float) -> list[dict]:
    return _best_axis_run(
        _char_token_candidates(chars, page_height),
        row_tolerance=3.0,
    )


def extract_km_axis(
    words: list[dict],
    page_height: float,
    chars: list[dict] | None = None,
) -> list[dict]:
    candidates: list[dict] = []
    top_limit = max(90.0, page_height * 0.20)
    for word in words:
        text = str(word.get("text", "")).strip()
        if not re.fullmatch(r"\d{1,4}", text):
            continue
        value = int(text)
        if not 0 <= value <= 9999:
            continue
        if float(word.get("top", 9999)) > top_limit:
            continue
        width = float(word.get("x1", 0)) - float(word.get("x0", 0))
        if width < 8:
            continue
        candidates.append(
            {
                "km": value,
                "x": (float(word.get("x0", 0)) + float(word.get("x1", 0))) / 2,
                "top": float(word.get("top", 0)),
            }
        )
    word_axis = _best_axis_run(candidates)
    char_axis = _axis_from_chars(chars or [], page_height)
    return (
        char_axis
        if _axis_run_quality(char_axis) > _axis_run_quality(word_axis)
        else word_axis
    )


def fit_km_axis(labels: list[dict]) -> dict:
    if len(labels) < 4:
        raise ValueError("at least four consecutive kilometre labels are required")
    pairs = [(float(item["x"]), (float(item["km"]) + 0.5) * 1000) for item in labels]
    mean_x = sum(x for x, _coordinate in pairs) / len(pairs)
    mean_coordinate = sum(coordinate for _x, coordinate in pairs) / len(pairs)
    denominator = sum((x - mean_x) ** 2 for x, _coordinate in pairs)
    if denominator <= 0:
        raise ValueError("invalid kilometre axis")
    slope = sum(
        (x - mean_x) * (coordinate - mean_coordinate)
        for x, coordinate in pairs
    ) / denominator
    intercept = mean_coordinate - slope * mean_x
    residuals = [abs((slope * x + intercept) - coordinate) for x, coordinate in pairs]
    sorted_residuals = sorted(residuals)
    p90_index = int(math.floor((len(sorted_residuals) - 1) * 0.9))
    return {
        "slope": slope,
        "intercept": intercept,
        "direction": "ascending" if slope > 0 else "descending",
        "labels": labels,
        # A single CAD text object can be physically displaced even when the
        # remaining kilometre row and the vector ruler agree. Keep the strict
        # maximum for diagnostics, and expose a robust value for per-cell
        # confidence so one outlier does not downgrade a complete page.
        "median_residual_m": statistics.median(residuals),
        "p90_residual_m": sorted_residuals[p90_index],
        "max_residual_m": max(residuals, default=math.inf),
    }


def coordinate_at_x(axis_fit: dict | tuple[float, float], x: float, snap_m: int = 100) -> int:
    if isinstance(axis_fit, dict):
        slope = float(axis_fit["slope"])
        intercept = float(axis_fit["intercept"])
    else:
        slope, intercept = axis_fit
    raw = slope * x + intercept
    return int(round(raw / snap_m) * snap_m)


def x_at_coordinate(axis_fit: dict | tuple[float, float], coordinate_m: float) -> float:
    if isinstance(axis_fit, dict):
        slope = float(axis_fit["slope"])
        intercept = float(axis_fit["intercept"])
    else:
        slope, intercept = axis_fit
    if slope == 0:
        raise ValueError("axis slope cannot be zero")
    return (coordinate_m - intercept) / slope
