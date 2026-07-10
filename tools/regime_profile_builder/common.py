from __future__ import annotations

import re


def parse_page_range(value: str | None, page_count: int) -> set[int]:
    if not value:
        return set(range(1, page_count + 1))
    result: set[int] = set()
    for token in re.split(r"\s*,\s*", value.strip()):
        if not token:
            continue
        if "-" in token:
            left_text, right_text = token.split("-", 1)
            left, right = int(left_text), int(right_text)
            if left > right:
                left, right = right, left
            result.update(range(left, right + 1))
        else:
            result.add(int(token))
    invalid = sorted(page for page in result if page < 1 or page > page_count)
    if invalid:
        raise ValueError(f"page range contains pages outside 1..{page_count}: {invalid}")
    return result


def overlap_length(left_start: int, left_end: int, right_start: int, right_end: int) -> int:
    return max(0, min(left_end, right_end) - max(left_start, right_start))


def find_seed_element(seed_elements: list[dict], start_m: int, end_m: int) -> dict | None:
    candidates: list[tuple[int, dict]] = []
    for element in seed_elements:
        seed_start = int(element["start_m"])
        seed_end = seed_start + int(element["len_m"])
        overlap = overlap_length(start_m, end_m, seed_start, seed_end)
        if overlap:
            candidates.append((overlap, element))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def snap_grade(value: float) -> float:
    rounded = round(float(value), 1)
    return 0.0 if abs(rounded) < 0.05 else rounded


def safe_slug(value: str) -> str:
    text = re.sub(r"[^a-zA-Z0-9а-яА-ЯёЁ_-]+", "-", value).strip("-")
    return text or "regime-profile"
