from __future__ import annotations

import statistics
from collections import defaultdict
from collections.abc import Callable


def _point_key(x: float, y: float) -> tuple[float, float]:
    return round(x, 2), round(y, 2)


def connected_components(
    vectors: list[dict],
    predicate: Callable[[dict], bool],
) -> list[list[dict]]:
    candidates = [vector for vector in vectors if predicate(vector)]
    by_endpoint: dict[tuple[float, float], list[int]] = defaultdict(list)
    for index, vector in enumerate(candidates):
        by_endpoint[_point_key(vector["x0"], vector["y0"])].append(index)
        by_endpoint[_point_key(vector["x1"], vector["y1"])].append(index)

    seen: set[int] = set()
    result: list[list[dict]] = []
    for index in range(len(candidates)):
        if index in seen:
            continue
        pending = [index]
        seen.add(index)
        component: list[dict] = []
        while pending:
            current = pending.pop()
            vector = candidates[current]
            component.append(vector)
            for endpoint in (
                _point_key(vector["x0"], vector["y0"]),
                _point_key(vector["x1"], vector["y1"]),
            ):
                for neighbour in by_endpoint[endpoint]:
                    if neighbour not in seen:
                        seen.add(neighbour)
                        pending.append(neighbour)
        result.append(component)
    return result


def component_x_span(component: list[dict]) -> tuple[float, float]:
    values = [float(value) for vector in component for value in (vector["x0"], vector["x1"])]
    return min(values), max(values)


def select_wide_components(
    vectors: list[dict],
    predicate: Callable[[dict], bool],
    minimum_span: float = 50,
) -> list[dict]:
    selected: list[dict] = []
    for component in connected_components(vectors, predicate):
        left, right = component_x_span(component)
        if right - left >= minimum_span:
            selected.extend(component)
    return selected


def y_at_x(trace: list[dict], x: float, tolerance: float = 0.4) -> float | None:
    exact: list[float] = []
    nearby: list[tuple[float, float]] = []
    for segment in trace:
        x0, x1 = float(segment["x0"]), float(segment["x1"])
        y0, y1 = float(segment["y0"]), float(segment["y1"])
        left, right = sorted((x0, x1))
        if left - tolerance <= x <= right + tolerance:
            ratio = 0.0 if x1 == x0 else (x - x0) / (x1 - x0)
            if -0.10 <= ratio <= 1.10:
                exact.append(y0 + (y1 - y0) * ratio)
        else:
            distance = min(abs(x - x0), abs(x - x1))
            if distance <= 2:
                nearby.append((distance, y0 if abs(x - x0) <= abs(x - x1) else y1))
    if exact:
        return statistics.median(exact)
    if nearby:
        nearby.sort(key=lambda item: item[0])
        return statistics.median(value for _distance, value in nearby[:2])
    return None


def dominant_slope(trace: list[dict], x0: float, x1: float) -> dict | None:
    left, right = sorted((x0, x1))
    candidates: list[tuple[float, float]] = []
    for segment in trace:
        sx0, sx1 = float(segment["x0"]), float(segment["x1"])
        sy0, sy1 = float(segment["y0"]), float(segment["y1"])
        dx = sx1 - sx0
        if abs(dx) < 2:
            continue
        segment_left, segment_right = sorted((sx0, sx1))
        overlap = max(0.0, min(right, segment_right) - max(left, segment_left))
        if overlap < 0.4:
            continue
        candidates.append((overlap, (sy1 - sy0) / dx))
    if not candidates:
        return None
    candidates.sort(reverse=True)
    best_overlap = candidates[0][0]
    strongest = [slope for overlap, slope in candidates if overlap >= best_overlap * 0.8]
    cell_width = max(0.001, right - left)
    return {
        "slope": statistics.median(strongest),
        "coverage": min(1.0, best_overlap / cell_width),
        "competing_segments": len(strongest),
    }
