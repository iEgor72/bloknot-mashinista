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


def _axis_from_chars(chars: list[dict], page_height: float) -> list[dict]:
    top_limit = max(90.0, page_height * 0.20)
    numeric = [
        char
        for char in chars
        if str(char.get("text", "")).isdigit()
        and float(char.get("top", 9999)) <= top_limit
        and float(char.get("size", 0)) >= 8
    ]
    by_row: list[list[dict]] = []
    for char in sorted(numeric, key=lambda item: (float(item["top"]), float(item["x0"]))):
        target = None
        for row in by_row:
            if abs(float(row[0]["top"]) - float(char["top"])) <= 0.06:
                target = row
                break
        if target is None:
            target = []
            by_row.append(target)
        target.append(char)

    candidates: list[dict] = []
    for row in by_row:
        groups: list[list[dict]] = []
        for char in sorted(row, key=lambda item: float(item["x0"])):
            if not groups or float(char["x0"]) - float(groups[-1][-1]["x1"]) > 1.5:
                groups.append([char])
            else:
                groups[-1].append(char)
        for group in groups:
            text = "".join(str(char["text"]) for char in group)
            if not re.fullmatch(r"\d{2,4}", text):
                continue
            value = int(text)
            if not 80 <= value <= 9999:
                continue
            candidates.append(
                {
                    "km": value,
                    "x": (float(group[0]["x0"]) + float(group[-1]["x1"])) / 2,
                    "top": statistics.mean(float(char["top"]) for char in group),
                }
            )
    return _longest_consecutive_run(candidates)


def extract_km_axis(
    words: list[dict],
    page_height: float,
    chars: list[dict] | None = None,
) -> list[dict]:
    candidates: list[dict] = []
    top_limit = max(90.0, page_height * 0.20)
    for word in words:
        text = str(word.get("text", "")).strip()
        if not re.fullmatch(r"\d{2,4}", text):
            continue
        value = int(text)
        if not 80 <= value <= 9999:
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
    if candidates:
        first_row_top = min(item["top"] for item in candidates)
        candidates = [item for item in candidates if item["top"] <= first_row_top + 8]
    best = _longest_consecutive_run(candidates)
    if len(best) >= 4:
        return best
    char_axis = _axis_from_chars(chars or [], page_height)
    return char_axis if len(char_axis) >= 4 else []


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
    return {
        "slope": slope,
        "intercept": intercept,
        "direction": "ascending" if slope > 0 else "descending",
        "labels": labels,
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
