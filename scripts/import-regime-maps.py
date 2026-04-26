from __future__ import annotations

import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DOCS_MANIFEST = ROOT / "assets" / "docs" / "manifest.json"
MAP_DIR = ROOT / "assets" / "tracker" / "maps" / "komsomol-sk-tche-9"
TRACKER_MAP = MAP_DIR / "data.xml"
OUTPUT = ROOT / "assets" / "tracker" / "regime-maps.json"

SOURCE_HINTS = {
    "БАМ": {
        "code": "BAM",
        "title": "БАМ",
        "sectorHints": [1, 10, 18, 19, 20],
    },
    "ВСГ": {
        "code": "VSG",
        "title": "ВСГ",
        "sectorHints": [13, 14, 15, 16, 17],
    },
    "ВЛЧ": {
        "code": "VLCH",
        "title": "ВЛЧ",
        "sectorHints": [9, 10],
    },
}

NUMBER_RE = re.compile(r"\d{1,6}")
SPEED_RE = re.compile(r"\b\d{2,3}\s*км\s*[\\/]\s*ч\b", re.IGNORECASE)
SPEED_NUMBER_RE = re.compile(r"(?<!\d)(\d{2,3})(?!\d)")
GRADE_VALUE_RE = re.compile(r"(?<!\d)(?:\d{1,2}[,.]\d{1,2}|\d{1,2})\s*(?:‰|,)", re.IGNORECASE)
LENGTH_VALUE_RE = re.compile(r"(?<!\d)(?:[2-9]\d{2}|[1-9]\d{3})(?!\d)")
GRADE_TOKEN_RE = re.compile(r"(?<!\d)(\d{1,2}(?:[,.]\d{1,2})?)(?:\s*‰)?(?!\d)")
MODE_RANGE_RE = re.compile(r"^\d{1,2}-\d{1,2}[ПP]?$")
MODE_POWER_RE = re.compile(r"^\d{3,5},?\d{0,5}$")
SIGNAL_LABEL_EXCLUDE = {
    "НТ",
    "ННТТ",
    "НЕТ",
    "ЧЕТ",
    "ЧЕТН",
    "ЧАС",
    "ЧАСЫ",
}
CONTROL_NEUTRAL_LABELS = {"НТ", "ННТТ"}
CONTROL_POWER_LABELS = {"2200", "3500", "4900", "5600", "7100", "2200,3500"}


def load_pdf_pages(path: Path) -> list[tuple[int, str, list[dict], list[dict]]]:
    try:
        import pdfplumber

        with pdfplumber.open(path) as pdf:
            pages: list[tuple[int, str, list[dict], list[dict]]] = []
            for index, page in enumerate(pdf.pages):
                words = []
                for word in page.extract_words(x_tolerance=1, y_tolerance=3, keep_blank_chars=False):
                    words.append(
                        {
                            "text": str(word.get("text", "")),
                            "x0": float(word.get("x0", 0)),
                            "x1": float(word.get("x1", 0)),
                            "top": float(word.get("top", 0)),
                            "bottom": float(word.get("bottom", 0)),
                        }
                    )
                vectors: list[dict] = []

                def stroke_tuple(value) -> tuple[float, ...] | None:
                    if isinstance(value, (tuple, list)):
                        try:
                            return tuple(float(item) for item in value)
                        except (TypeError, ValueError):
                            return None
                    return None

                def append_vector(x0: float, y0: float, x1: float, y1: float, obj: dict) -> None:
                    vectors.append(
                        {
                            "x0": float(x0),
                            "y0": float(y0),
                            "x1": float(x1),
                            "y1": float(y1),
                            "stroke": stroke_tuple(obj.get("stroking_color")),
                            "linewidth": float(obj.get("linewidth") or 0),
                        }
                    )

                for line in page.lines:
                    append_vector(line.get("x0", 0), line.get("y0", 0), line.get("x1", 0), line.get("y1", 0), line)
                for curve in page.curves:
                    points = curve.get("pts") or []
                    for start, end in zip(points, points[1:]):
                        # pdfplumber curve points are top-origin; line y0/y1 are bottom-origin.
                        append_vector(
                            float(start[0]),
                            float(page.height) - float(start[1]),
                            float(end[0]),
                            float(page.height) - float(end[1]),
                            curve,
                        )
                pages.append((index + 1, page.extract_text(x_tolerance=1, y_tolerance=3) or "", words, vectors))
            return pages
    except Exception:
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        return [
            (index + 1, page.extract_text() or "", [], [])
            for index, page in enumerate(reader.pages)
        ]


def load_pdf_text_pages(path: Path) -> list[tuple[int, str]]:
    return [(page, text) for page, text, _words, _vectors in load_pdf_pages(path)]


def normalize_text(value: str) -> str:
    text = value.upper().replace("Ё", "Е")
    text = text.replace("\u00a0", " ").replace("–", "-").replace("—", "-")
    return re.sub(r"[^А-ЯA-Z0-9]+", " ", text)


def normalize_line(value: str) -> str:
    text = value.replace("\u00a0", " ").replace("–", "-").replace("—", "-")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_sector_bounds() -> dict[int, tuple[int, int]]:
    root = ET.fromstring(TRACKER_MAP.read_text(encoding="utf-8"))
    result: dict[int, tuple[int, int]] = {}
    for sector_node in root.iter("sector"):
        raw_sector = sector_node.attrib.get("id")
        if not raw_sector:
            continue
        sector = int(float(raw_sector))
        values: list[int] = []
        for point in sector_node.iter("wpt"):
            raw_ord = point.findtext("ord") or point.attrib.get("ord")
            if raw_ord:
                values.append(round(float(raw_ord)))
        if values:
            result[sector] = (min(values), max(values))
    return result


def parse_station_index() -> list[dict]:
    stations: dict[str, dict] = {}
    for path in sorted(MAP_DIR.glob("*.xml")):
        if path.name in {"data.xml", "profile.xml", "speed.xml"}:
            continue
        try:
            root = ET.fromstring(path.read_text(encoding="utf-8"))
        except ET.ParseError:
            continue
        for sector_node in root.iter("sector"):
            raw_sector = sector_node.attrib.get("id")
            if not raw_sector:
                continue
            sector = int(float(raw_sector))
            for point in sector_node.iter("wpt"):
                if (point.findtext("type") or "").strip() != "2":
                    continue
                name = (point.findtext("name") or "").strip()
                coordinate = point.findtext("coordinate")
                if not name or not coordinate:
                    continue
                key = normalize_text(name).strip()
                if len(key) < 4:
                    continue
                item = stations.setdefault(
                    key,
                    {
                        "name": name,
                        "normalized": key,
                        "sectors": set(),
                        "coordinates": [],
                        "sectorCoordinates": set(),
                    },
                )
                item["sectors"].add(sector)
                rounded_coordinate = round(float(coordinate))
                item["coordinates"].append(rounded_coordinate)
                item["sectorCoordinates"].add((sector, rounded_coordinate))
    result = []
    for item in stations.values():
        result.append(
            {
                "name": item["name"],
                "normalized": item["normalized"],
                "sectors": sorted(item["sectors"]),
                "coordinates": sorted(set(item["coordinates"])),
                "sectorCoordinates": [
                    {"sector": sector, "coordinate": coordinate}
                    for sector, coordinate in sorted(item["sectorCoordinates"])
                ],
            }
        )
    return result


def extract_sequential_km_ranges(lines: list[str]) -> list[dict]:
    ranges: list[dict] = []
    seen: set[tuple[int, int]] = set()
    for line in lines:
        raw_numbers = [int(match.group(0)) for match in NUMBER_RE.finditer(line)]
        numbers = [value for value in raw_numbers if 80 <= value <= 9999]
        if len(numbers) < 4:
            continue

        run = [numbers[0]]
        direction = 0
        for value in numbers[1:]:
            diff = value - run[-1]
            next_direction = 1 if diff == 1 else -1 if diff == -1 else 0
            if next_direction and (direction in (0, next_direction)):
                run.append(value)
                direction = next_direction
                continue
            add_km_run(ranges, seen, run, line)
            run = [value]
            direction = 0
        add_km_run(ranges, seen, run, line)
    return ranges


def add_km_run(ranges: list[dict], seen: set[tuple[int, int]], run: list[int], line: str) -> None:
    if len(run) < 4:
        return
    start = min(run)
    end = max(run)
    if end - start < 3:
        return
    key = (start, end)
    if key in seen:
        return
    seen.add(key)
    ranges.append(
        {
            "startKm": start,
            "endKm": end,
            "start": start * 1000,
            "end": (end + 1) * 1000,
            "direction": "desc" if run[0] > run[-1] else "asc",
            "raw": normalize_line(line)[:220],
        }
    )


def range_target_sectors(km_ranges: list[dict], bounds: dict[int, tuple[int, int]]) -> list[int]:
    result: set[int] = set()
    for item in km_ranges:
        left = min(item["start"], item["end"])
        right = max(item["start"], item["end"])
        for sector, sector_bounds in bounds.items():
            if max(left, sector_bounds[0] - 1000) <= min(right, sector_bounds[1] + 1000):
                result.add(sector)
    return sorted(result)


def count_profile_hints(lines: list[str]) -> dict:
    grade_count = 0
    length_count = 0
    raw_lines: list[str] = []
    for line in lines:
        normalized = normalize_line(line)
        if not normalized:
            continue
        lower = normalized.lower()
        if "км/ч" in lower or "км\\ч" in lower:
            continue
        grades = GRADE_VALUE_RE.findall(normalized)
        lengths = LENGTH_VALUE_RE.findall(normalized)
        if grades:
            grade_count += len(grades)
            raw_lines.append(normalized[:180])
        elif length_count < grade_count + 8 and len(lengths) >= 3:
            length_count += len(lengths)
            raw_lines.append(normalized[:180])
    return {
        "grades": grade_count,
        "lengths": length_count,
        "raw": raw_lines[:4],
    }


def extract_grade_values(line: str) -> list[float]:
    normalized = normalize_line(line)
    lower = normalized.lower()
    if "км/ч" in lower or "км\\ч" in lower:
        return []
    if "‰" not in normalized and normalized.count(",") + normalized.count(".") < 2:
        return []
    result: list[float] = []
    for match in GRADE_TOKEN_RE.finditer(normalized):
        value = float(match.group(1).replace(",", "."))
        if 0 <= value <= 45:
            result.append(value)
    return result


def extract_length_values(line: str) -> list[int]:
    normalized = normalize_line(line)
    lower = normalized.lower()
    if "км/ч" in lower or "км\\ч" in lower or "км " in lower.lower():
        return []
    values: list[int] = []
    for match in LENGTH_VALUE_RE.finditer(normalized):
        value = int(match.group(0))
        if 100 <= value <= 5000:
            values.append(value)
    return values


def interval_intersects(a_start: int, a_end: int, b_start: int, b_end: int, margin: int = 300) -> bool:
    return max(a_start, b_start - margin) <= min(a_end, b_end + margin)


def interval_target_sectors(
    start: int,
    end: int,
    sectors: list[int],
    bounds: dict[int, tuple[int, int]],
    margin: int = 300,
) -> list[int]:
    result: list[int] = []
    left = min(start, end)
    right = max(start, end)
    for sector in sectors:
        sector_bounds = bounds.get(sector)
        if not sector_bounds:
            continue
        if interval_intersects(left, right, sector_bounds[0], sector_bounds[1], margin):
            result.append(sector)
    return sorted(set(result))


def extract_km_axis_from_words(words: list[dict]) -> list[dict]:
    candidates = []
    for word in words:
        text = str(word.get("text", "")).strip()
        if not re.fullmatch(r"\d{2,4}", text):
            continue
        value = int(text)
        if not 80 <= value <= 9999:
            continue
        if float(word.get("top", 999)) > 90:
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
        top = min(item["top"] for item in candidates)
        candidates = [item for item in candidates if item["top"] <= top + 8]
    candidates.sort(key=lambda item: item["x"])

    best: list[dict] = []
    for start_index in range(len(candidates)):
        run = [candidates[start_index]]
        direction = 0
        for candidate in candidates[start_index + 1 :]:
            diff = candidate["km"] - run[-1]["km"]
            next_direction = 1 if diff == 1 else -1 if diff == -1 else 0
            if next_direction and direction in (0, next_direction):
                run.append(candidate)
                direction = next_direction
                continue
            break
        if len(run) > len(best):
            best = run
    if len(best) < 4:
        return []
    return best


def axis_x_from_coordinate(axis: list[dict], coordinate: float) -> float | None:
    if len(axis) < 2:
        return None
    km = coordinate / 1000
    points = sorted(axis, key=lambda item: item["km"])
    if km <= points[0]["km"]:
        left, right = points[0], points[1]
    elif km >= points[-1]["km"]:
        left, right = points[-2], points[-1]
    else:
        left, right = points[0], points[1]
        for index in range(1, len(points)):
            if points[index - 1]["km"] <= km <= points[index]["km"]:
                left, right = points[index - 1], points[index]
                break
    if right["km"] == left["km"]:
        return None
    return left["x"] + (km - left["km"]) * (right["x"] - left["x"]) / (right["km"] - left["km"])


def coordinate_from_axis_x(axis: list[dict], x: float) -> int | None:
    if len(axis) < 2:
        return None
    points = sorted(axis, key=lambda item: item["x"])
    if x <= points[0]["x"]:
        left, right = points[0], points[1]
    elif x >= points[-1]["x"]:
        left, right = points[-2], points[-1]
    else:
        left, right = points[0], points[1]
        for index in range(1, len(points)):
            if points[index - 1]["x"] <= x <= points[index]["x"]:
                left, right = points[index - 1], points[index]
                break
    if right["x"] == left["x"]:
        return None
    km = left["km"] + (x - left["x"]) * (right["km"] - left["km"]) / (right["x"] - left["x"])
    return round(km * 1000)


def is_profile_trace_color(stroke: object) -> bool:
    if not isinstance(stroke, tuple) or len(stroke) != 3:
        return False
    red, green, blue = stroke
    return blue >= 0.45 and red <= 0.25 and (blue >= green + 0.12 or green >= 0.30)


def extract_profile_trace_segments(vectors: list[dict]) -> list[dict]:
    candidates: list[dict] = []
    for vector in vectors:
        if not is_profile_trace_color(vector.get("stroke")):
            continue
        linewidth = float(vector.get("linewidth") or 0)
        if linewidth < 0.7:
            continue
        x0 = float(vector.get("x0", 0))
        y0 = float(vector.get("y0", 0))
        x1 = float(vector.get("x1", 0))
        y1 = float(vector.get("y1", 0))
        dx = x1 - x0
        dy = y1 - y0
        length = math.hypot(dx, dy)
        if length < 2 or abs(dx) < 1:
            continue
        mid_y = (y0 + y1) / 2
        if mid_y < 120 or mid_y > 470:
            continue
        # The PDF also contains long horizontal speed strips in the same blue.
        if abs(dy) < 1 and length > 180:
            continue
        candidates.append(
            {
                "x0": x0,
                "y0": y0,
                "x1": x1,
                "y1": y1,
                "midY": mid_y,
                "weight": abs(dx),
            }
        )
    if not candidates:
        return []
    weighted = sorted(candidates, key=lambda item: item["midY"])
    total_weight = sum(max(0.1, item["weight"]) for item in weighted)
    cursor = 0.0
    center_y = weighted[len(weighted) // 2]["midY"]
    for item in weighted:
        cursor += max(0.1, item["weight"])
        if cursor >= total_weight / 2:
            center_y = item["midY"]
            break
    profile = [item for item in candidates if abs(item["midY"] - center_y) <= 115]
    if len(profile) < 2:
        return candidates
    return profile


def profile_trace_y_at_x(trace: list[dict], x: float) -> float | None:
    values: list[float] = []
    nearby: list[tuple[float, float]] = []
    for segment in trace:
        x0 = segment["x0"]
        x1 = segment["x1"]
        y0 = segment["y0"]
        y1 = segment["y1"]
        left = min(x0, x1)
        right = max(x0, x1)
        if left - 0.5 <= x <= right + 0.5:
            ratio = 0 if x1 == x0 else (x - x0) / (x1 - x0)
            if -0.25 <= ratio <= 1.25:
                values.append(y0 + (y1 - y0) * ratio)
        else:
            distance = min(abs(x - left), abs(x - right))
            if distance <= 20:
                value = y0 if abs(x - x0) <= abs(x - x1) else y1
                nearby.append((distance, value))
    if values:
        values.sort()
        return values[len(values) // 2]
    if nearby:
        nearby.sort(key=lambda item: item[0])
        values = sorted(value for _distance, value in nearby[:4])
        return values[len(values) // 2]
    return None


def recover_profile_grade(
    grade: float,
    start: int,
    end: int,
    axis: list[dict],
    trace: list[dict],
) -> tuple[float, bool, str]:
    magnitude = abs(grade)
    if magnitude < 0.05:
        return 0.0, True, "rk-profile-zero"
    if len(axis) < 2 or not trace:
        return magnitude, False, "rk-extracted-magnitude"
    length = end - start
    inset = min(120, max(20, length * 0.18))
    sample_start = start + inset if length > inset * 2 else start
    sample_end = end - inset if length > inset * 2 else end
    start_x = axis_x_from_coordinate(axis, sample_start)
    end_x = axis_x_from_coordinate(axis, sample_end)
    if start_x is None or end_x is None:
        return magnitude, False, "rk-extracted-magnitude"
    start_y = profile_trace_y_at_x(trace, start_x)
    end_y = profile_trace_y_at_x(trace, end_x)
    if start_y is None or end_y is None:
        return magnitude, False, "rk-extracted-magnitude"
    delta_y = end_y - start_y
    threshold = 0.45 if magnitude <= 0.5 else 0.8
    if abs(delta_y) < threshold:
        return magnitude, False, "rk-extracted-magnitude"
    return (magnitude if delta_y > 0 else -magnitude), True, "rk-profile-trace"


def is_speed_unit_text(value: str) -> bool:
    text = value.lower()
    return "км" in text or "\\ч" in text or "/ч" in text


def extract_speed_labels_from_words(words: list[dict], axis: list[dict]) -> list[dict]:
    if len(axis) < 2:
        return []
    sorted_words = sorted(words, key=lambda word: (float(word.get("top", 0)), float(word.get("x0", 0))))
    labels: list[dict] = []

    def add_label(speed: int, word: dict, raw: str) -> None:
        if speed < 15 or speed > 160:
            return
        x = (float(word.get("x0", 0)) + float(word.get("x1", 0))) / 2
        coordinate = coordinate_from_axis_x(axis, x)
        if coordinate is None:
            return
        for existing in labels:
            if existing["speed"] == speed and abs(existing["x"] - x) < 10 and abs(existing["top"] - float(word.get("top", 0))) < 8:
                return
        labels.append(
            {
                "speed": speed,
                "x": x,
                "top": float(word.get("top", 0)),
                "coordinate": coordinate,
                "raw": raw[:120],
            }
        )

    for index, word in enumerate(sorted_words):
        top = float(word.get("top", 0))
        if top < 80:
            continue
        text = normalize_line(str(word.get("text", "")))
        numbers = [int(match.group(1)) for match in SPEED_NUMBER_RE.finditer(text)]
        numbers = [value for value in numbers if 15 <= value <= 160]
        if not numbers:
            continue
        if is_speed_unit_text(text):
            add_label(numbers[-1], word, text)
            continue
        for next_word in sorted_words[index + 1 : index + 4]:
            if abs(float(next_word.get("top", 0)) - top) > 5:
                continue
            gap = float(next_word.get("x0", 0)) - float(word.get("x1", 0))
            if gap < -2 or gap > 36:
                continue
            next_text = normalize_line(str(next_word.get("text", "")))
            if is_speed_unit_text(next_text):
                add_label(numbers[-1], word, text + " " + next_text)
                break
    labels.sort(key=lambda item: item["coordinate"])
    return labels


def build_speed_rules_from_page(
    source: dict,
    config: dict,
    page_number: int,
    words: list[dict],
    sectors: list[int],
    bounds: dict[int, tuple[int, int]],
) -> list[dict]:
    axis = extract_km_axis_from_words(words)
    labels = extract_speed_labels_from_words(words, axis)
    if len(axis) < 2 or not labels:
        return []
    page_start = min(round(item["km"] * 1000) for item in axis)
    page_end = max(round(item["km"] * 1000) for item in axis)
    result: list[dict] = []
    for index, label in enumerate(labels):
        left = page_start if index == 0 else round((labels[index - 1]["coordinate"] + label["coordinate"]) / 2)
        right = page_end if index == len(labels) - 1 else round((label["coordinate"] + labels[index + 1]["coordinate"]) / 2)
        left = max(page_start, min(page_end, left))
        right = max(page_start, min(page_end, right))
        if right - left < 150:
            continue
        target_sectors = interval_target_sectors(left, right, sectors, bounds)
        if not target_sectors:
            continue
        result.append(
            {
                "sourceCode": config["code"],
                "sourceName": source["name"],
                "sourcePath": source["path"],
                "sourceUpdatedAt": source.get("updated_at", ""),
                "page": page_number,
                "coordinate": left,
                "end": right,
                "length": right - left,
                "speed": label["speed"],
                "name": f"РК {label['speed']}",
                "targetSectors": target_sectors,
                "confidence": "rk-geometry",
                "raw": label["raw"],
            }
        )
    return result


def build_station_objects_from_page(
    source: dict,
    config: dict,
    page_number: int,
    station_hits: list[dict],
    km_ranges: list[dict],
    sectors: list[int],
) -> list[dict]:
    if not station_hits or not sectors:
        return []
    spans = [
        (min(item["start"], item["end"]) - 500, max(item["start"], item["end"]) + 500)
        for item in km_ranges
    ]
    result: list[dict] = []
    seen: set[tuple[int, int, str]] = set()
    sector_set = set(sectors)
    for station in station_hits:
        for item in station.get("sectorCoordinates", []):
            sector = int(item.get("sector", 0))
            coordinate = int(item.get("coordinate", 0))
            if sector not in sector_set:
                continue
            if spans and not any(left <= coordinate <= right for left, right in spans):
                continue
            key = (sector, coordinate, station["name"])
            if key in seen:
                continue
            seen.add(key)
            result.append(
                {
                    "sourceCode": config["code"],
                    "sourceName": source["name"],
                    "sourcePath": source["path"],
                    "sourceUpdatedAt": source.get("updated_at", ""),
                    "page": page_number,
                    "sector": sector,
                    "type": "2",
                    "name": station["name"],
                    "coordinate": coordinate,
                    "length": 0,
                    "end": coordinate,
                    "confidence": "rk-station-match",
                }
            )
    result.sort(key=lambda item: (item["sector"], item["coordinate"], item["name"]))
    return result


def normalize_signal_label(value: str) -> str:
    text = normalize_line(value).upper().replace("Ё", "Е")
    text = text.replace(" ", "").replace("-", "")
    text = text.replace("І", "I").replace("Ⅰ", "I").replace("Ⅱ", "II").replace("Ⅲ", "III")
    return text


def is_signal_label(value: str) -> bool:
    text = normalize_signal_label(value)
    if text in SIGNAL_LABEL_EXCLUDE:
        return False
    if len(text) < 1 or len(text) > 6:
        return False
    if text[0] not in {"Н", "Ч"}:
        return False
    body = text[1:]
    if body.startswith("М"):
        body = body[1:]
    while body and body[0] in "0123456789IVX":
        body = body[1:]
    if len(body) > 1:
        return False
    if body and body not in set("АБВГДЕЖКЛМНПРСТ"):
        return False
    return True


def build_signal_objects_from_page(
    source: dict,
    config: dict,
    page_number: int,
    words: list[dict],
    sectors: list[int],
    bounds: dict[int, tuple[int, int]],
) -> list[dict]:
    axis = extract_km_axis_from_words(words)
    if len(axis) < 2 or not sectors:
        return []
    page_start = min(round(item["km"] * 1000) for item in axis)
    page_end = max(round(item["km"] * 1000) for item in axis)
    seen: set[tuple[int, int, str]] = set()
    result: list[dict] = []
    for word in words:
        label = normalize_signal_label(str(word.get("text", "")))
        if not is_signal_label(label):
            continue
        top = float(word.get("top", 0))
        bottom = float(word.get("bottom", 0))
        if top < 230 or top > 455:
            continue
        height = bottom - top
        if height < 5 or height > 18:
            continue
        width = float(word.get("x1", 0)) - float(word.get("x0", 0))
        if width < 2 or width > 44:
            continue
        x = (float(word.get("x0", 0)) + float(word.get("x1", 0))) / 2
        coordinate = coordinate_from_axis_x(axis, x)
        if coordinate is None:
            continue
        if coordinate < page_start - 1200 or coordinate > page_end + 1200:
            continue
        target_sectors = interval_target_sectors(coordinate, coordinate, sectors, bounds, margin=800)
        if not target_sectors:
            continue
        for sector in target_sectors:
            key = (sector, round(coordinate / 50), label)
            if key in seen:
                continue
            seen.add(key)
            result.append(
                {
                    "sourceCode": config["code"],
                    "sourceName": source["name"],
                    "sourcePath": source["path"],
                    "sourceUpdatedAt": source.get("updated_at", ""),
                    "page": page_number,
                    "sector": sector,
                    "type": "1",
                    "name": label,
                    "coordinate": coordinate,
                    "length": 0,
                    "end": coordinate,
                    "confidence": "rk-signal-label",
                    "raw": str(word.get("text", ""))[:80],
                }
            )
    result.sort(key=lambda item: (item["sector"], item["coordinate"], item["name"]))
    return result


def normalize_control_label(value: str) -> str:
    text = normalize_line(value).upper().replace("Ё", "Е")
    text = text.replace(" ", "").replace("–", "-").replace("—", "-")
    text = text.replace("Х", "X").replace("І", "I").replace("Ⅰ", "I").replace("Ⅱ", "II").replace("Ⅲ", "III")
    text = text.strip(".,;:")
    if set(text) <= {"X", "-"} and "X" in text:
        return text.replace("X", "Х")
    return text


def classify_control_label(label: str, top: float) -> str | None:
    normalized = normalize_control_label(label)
    if normalized in CONTROL_NEUTRAL_LABELS and 150 <= top <= 465:
        return "neutral"
    latin = normalized.replace("Х", "X")
    if not 52 <= top <= 190:
        return None
    if latin in {"X", "XX", "X-X", "XX-XX"}:
        return "throttle"
    if MODE_RANGE_RE.fullmatch(latin):
        return "throttle"
    if normalized in {"СОЕД"}:
        return "connection"
    if normalized in {"ЭДТ"}:
        return "brake"
    if re.fullmatch(r"\d-\d[ПP]", latin):
        return "brake"
    power_label = normalized.rstrip(",")
    if MODE_POWER_RE.fullmatch(normalized) and (normalized in CONTROL_POWER_LABELS or power_label in CONTROL_POWER_LABELS):
        return "power"
    return None


def build_control_marks_from_page(
    source: dict,
    config: dict,
    page_number: int,
    words: list[dict],
    sectors: list[int],
    bounds: dict[int, tuple[int, int]],
) -> list[dict]:
    axis = extract_km_axis_from_words(words)
    if len(axis) < 2 or not sectors:
        return []
    page_start = min(round(item["km"] * 1000) for item in axis)
    page_end = max(round(item["km"] * 1000) for item in axis)
    result: list[dict] = []
    seen: set[tuple[int, int, str, str]] = set()
    for word in words:
        raw = str(word.get("text", ""))
        top = float(word.get("top", 0))
        label = normalize_control_label(raw)
        kind = classify_control_label(label, top)
        if not kind:
            continue
        if kind == "neutral":
            label = "НТ"
        elif kind == "power":
            label = label.rstrip(",")
        width = float(word.get("x1", 0)) - float(word.get("x0", 0))
        if width < 2 or width > 90:
            continue
        x = (float(word.get("x0", 0)) + float(word.get("x1", 0))) / 2
        coordinate = coordinate_from_axis_x(axis, x)
        if coordinate is None:
            continue
        if coordinate < page_start - 1200 or coordinate > page_end + 1200:
            continue
        target_sectors = interval_target_sectors(coordinate, coordinate, sectors, bounds, margin=800)
        if not target_sectors:
            continue
        for sector in target_sectors:
            key = (sector, round(coordinate / 50), kind, label)
            if key in seen:
                continue
            seen.add(key)
            result.append(
                {
                    "sourceCode": config["code"],
                    "sourceName": source["name"],
                    "sourcePath": source["path"],
                    "sourceUpdatedAt": source.get("updated_at", ""),
                    "page": page_number,
                    "sector": sector,
                    "kind": kind,
                    "name": label,
                    "coordinate": coordinate,
                    "confidence": "rk-control-label",
                    "raw": raw[:80],
                    "top": round(top, 1),
                }
            )
    result.sort(key=lambda item: (item["sector"], item["coordinate"], item["kind"], item["name"]))
    return result


def build_profile_segments_from_page(
    source: dict,
    config: dict,
    page_number: int,
    lines: list[str],
    words: list[dict],
    vectors: list[dict],
    km_ranges: list[dict],
    sectors: list[int],
) -> list[dict]:
    if not km_ranges or not sectors:
        return []
    best_range = max(km_ranges, key=lambda item: abs(item["endKm"] - item["startKm"]))
    grades: list[float] = []
    lengths: list[int] = []
    grade_line_index = -1
    for index, line in enumerate(lines):
        values = extract_grade_values(line)
        if len(values) >= 3:
            grades = values
            grade_line_index = index
            break
    if grade_line_index < 0:
        return []

    for line in lines[grade_line_index + 1 : grade_line_index + 7]:
        values = extract_length_values(line)
        if len(values) < 2:
            continue
        lengths.extend(values)
        if len(lengths) >= len(grades):
            break
    count = min(len(grades), len(lengths))
    if count < 3:
        return []

    span_start = min(best_range["start"], best_range["end"])
    span_end = max(best_range["start"], best_range["end"])
    usable_lengths = lengths[:count]
    total_length = sum(usable_lengths)
    if total_length < 500:
        return []
    # Do not let noisy PDF extraction make a page profile bleed far past the km strip.
    if total_length > (span_end - span_start) + 5000:
        total_length = 0
        clipped_lengths: list[int] = []
        for length in usable_lengths:
            if total_length + length > (span_end - span_start) + 5000:
                break
            clipped_lengths.append(length)
            total_length += length
        usable_lengths = clipped_lengths
        count = min(len(grades), len(usable_lengths))
    if count < 3:
        return []

    if best_range.get("direction") == "desc":
        grades = list(reversed(grades[:count]))
        usable_lengths = list(reversed(usable_lengths[:count]))
    else:
        grades = grades[:count]
        usable_lengths = usable_lengths[:count]

    axis = extract_km_axis_from_words(words)
    trace = extract_profile_trace_segments(vectors)
    cursor = span_start
    result: list[dict] = []
    for index, (grade, length) in enumerate(zip(grades, usable_lengths), start=1):
        start = cursor
        end = min(span_end, start + length)
        if end - start < 100:
            continue
        signed_grade, grade_signed, confidence = recover_profile_grade(grade, start, end, axis, trace)
        result.append(
            {
                "sourceCode": config["code"],
                "sourceName": source["name"],
                "sourcePath": source["path"],
                "sourceUpdatedAt": source.get("updated_at", ""),
                "page": page_number,
                "start": start,
                "end": end,
                "length": end - start,
                "grade": signed_grade,
                "gradeMagnitude": abs(grade),
                "gradeSigned": grade_signed,
                "confidence": confidence,
                "segment": index,
                "rangeStartKm": best_range["startKm"],
                "rangeEndKm": best_range["endKm"],
            }
        )
        cursor = end
        if cursor >= span_end:
            break
    return result


def find_station_hits(text: str, stations: list[dict]) -> list[dict]:
    normalized = normalize_text(text)
    hits = []
    for station in stations:
        name = station["normalized"]
        if len(name) < 4:
            continue
        if name not in normalized:
            continue
        hits.append(
            {
                "name": station["name"],
                "sectors": station["sectors"],
                "coordinates": station["coordinates"][:4],
                "sectorCoordinates": station.get("sectorCoordinates", [])[:12],
            }
        )
    return hits


def source_config(source: dict) -> dict:
    name = source.get("name", "")
    for key, config in SOURCE_HINTS.items():
        if key.lower() in name.lower():
            return config
    return {
        "code": re.sub(r"[^A-Z0-9]+", "", name.upper())[:12] or "REGIME",
        "title": name or "Режимная карта",
        "sectorHints": [],
    }


def build() -> dict:
    manifest = json.loads(DOCS_MANIFEST.read_text(encoding="utf-8"))
    bounds = parse_sector_bounds()
    stations = parse_station_index()
    sources = []
    by_sector: dict[str, list[dict]] = {}
    total_pages = 0
    pages_with_profile = 0

    def count_sector_objects(type_filter: str | None = None) -> int:
        seen: set[tuple[int, str, str, int]] = set()
        for sector_key, items in by_sector.items():
            sector = int(sector_key)
            for item in items:
                for obj in item.get("objects") or []:
                    obj_sector = obj.get("sector")
                    if obj_sector is not None and int(obj_sector) != sector:
                        continue
                    obj_type = str(obj.get("type", ""))
                    if type_filter is not None and obj_type != type_filter:
                        continue
                    coordinate = round(float(obj.get("coordinate", 0)) / 50)
                    name = normalize_text(str(obj.get("name", "")))
                    key = (sector, obj_type, name, coordinate)
                    if key in seen:
                        continue
                    seen.add(key)
        return len(seen)

    def count_sector_control_marks(kind_filter: str | None = None) -> int:
        seen: set[tuple[int, str, str, int]] = set()
        for sector_key, items in by_sector.items():
            sector = int(sector_key)
            for item in items:
                for mark in item.get("controlMarks") or []:
                    mark_sector = mark.get("sector")
                    if mark_sector is not None and int(mark_sector) != sector:
                        continue
                    kind = str(mark.get("kind", ""))
                    if kind_filter is not None and kind != kind_filter:
                        continue
                    coordinate = round(float(mark.get("coordinate", 0)) / 50)
                    name = normalize_text(str(mark.get("name", "")))
                    key = (sector, kind, name, coordinate)
                    if key in seen:
                        continue
                    seen.add(key)
        return len(seen)

    for source in manifest.get("memos", []):
        if source.get("mime_type") != "application/pdf":
            continue
        config = source_config(source)
        path = ROOT / source["path"].lstrip("/")
        if not path.exists():
            continue
        page_items = []
        for page_number, text, words, vectors in load_pdf_pages(path):
            lines = [line for line in text.splitlines() if normalize_line(line)]
            km_ranges = extract_sequential_km_ranges(lines)
            profile_hints = count_profile_hints(lines)
            station_hits = find_station_hits(text, stations)
            speed_hints = SPEED_RE.findall(text.replace("\\", "/"))
            range_sectors = set(range_target_sectors(km_ranges, bounds))
            station_sectors: set[int] = set()
            for station in station_hits:
                station_sectors.update(station["sectors"])
            sectors = range_sectors | station_sectors
            hints = set(config.get("sectorHints", []))
            if hints and sectors:
                hinted = sectors & hints
                if hinted:
                    sectors = hinted
            sectors = sorted(sectors)
            profile_segments = build_profile_segments_from_page(
                source,
                config,
                page_number,
                lines,
                words,
                vectors,
                km_ranges,
                sectors,
            )
            speed_rules = build_speed_rules_from_page(source, config, page_number, words, sectors, bounds)
            station_objects = build_station_objects_from_page(source, config, page_number, station_hits, km_ranges, sectors)
            signal_objects = build_signal_objects_from_page(source, config, page_number, words, sectors, bounds)
            control_marks = build_control_marks_from_page(source, config, page_number, words, sectors, bounds)
            objects = station_objects + signal_objects
            if not km_ranges and not station_hits and not profile_hints["grades"] and not speed_hints and not control_marks:
                continue
            item = {
                "sourceCode": config["code"],
                "sourceName": source["name"],
                "sourcePath": source["path"],
                "sourceUpdatedAt": source.get("updated_at", ""),
                "page": page_number,
                "sectors": sectors,
                "kmRanges": km_ranges[:4],
                "stationHits": station_hits[:8],
                "profileHints": profile_hints,
                "profileSegments": profile_segments,
                "speedRules": speed_rules,
                "objects": objects,
                "controlMarks": control_marks,
                "speedHints": len(speed_hints),
            }
            page_items.append(item)
            total_pages += 1
            if profile_segments or (profile_hints["grades"] and profile_hints["lengths"]):
                pages_with_profile += 1
            for sector in sectors:
                key = str(sector)
                by_sector.setdefault(key, []).append(item)
        source_sectors = sorted({sector for item in page_items for sector in item["sectors"]})
        sources.append(
            {
                "code": config["code"],
                "name": source["name"],
                "path": source["path"],
                "updatedAt": source.get("updated_at", ""),
                "pages": len(page_items),
                "profilePages": sum(
                    1
                    for item in page_items
                    if item["profileSegments"] or (item["profileHints"]["grades"] and item["profileHints"]["lengths"])
                ),
                "signedProfileSegments": sum(
                    1
                    for item in page_items
                    for segment in item.get("profileSegments") or []
                    if segment.get("gradeSigned") is True
                ),
                "speedRules": sum(len(item.get("speedRules") or []) for item in page_items),
                "objects": sum(len(item.get("objects") or []) for item in page_items),
                "signalObjects": sum(
                    1
                    for item in page_items
                    for obj in item.get("objects") or []
                    if str(obj.get("type", "")) == "1"
                ),
                "controlMarks": sum(len(item.get("controlMarks") or []) for item in page_items),
                "neutralMarks": sum(
                    1
                    for item in page_items
                    for mark in item.get("controlMarks") or []
                    if str(mark.get("kind", "")) == "neutral"
                ),
                "sectors": source_sectors,
            }
        )

    for items in by_sector.values():
        items.sort(
            key=lambda item: (
                0 if item["profileHints"]["grades"] and item["profileHints"]["lengths"] else 1,
                item["sourceName"],
                item["page"],
            )
        )

    return {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "title": "Режимные карты",
        "sources": sources,
        "bySector": dict(sorted(by_sector.items(), key=lambda pair: int(pair[0]))),
        "counts": {
            "sources": len(sources),
            "pages": total_pages,
            "profilePages": pages_with_profile,
            "profileSegments": sum(
                len(item.get("profileSegments") or [])
                for items in by_sector.values()
                for item in items
            ),
            "signedProfileSegments": sum(
                1
                for items in by_sector.values()
                for item in items
                for segment in item.get("profileSegments") or []
                if segment.get("gradeSigned") is True
            ),
            "speedRules": sum(
                len(item.get("speedRules") or [])
                for items in by_sector.values()
                for item in items
            ),
            "objects": count_sector_objects(),
            "signalObjects": count_sector_objects("1"),
            "controlMarks": count_sector_control_marks(),
            "neutralMarks": count_sector_control_marks("neutral"),
            "sectors": len(by_sector),
        },
    }


def main() -> None:
    payload = build()
    OUTPUT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"[regime-maps] sources={payload['counts']['sources']} "
        f"pages={payload['counts']['pages']} "
        f"profile_pages={payload['counts']['profilePages']} "
        f"profile_segments={payload['counts']['profileSegments']} "
        f"signed_profile_segments={payload['counts']['signedProfileSegments']} "
        f"speed_rules={payload['counts']['speedRules']} "
        f"objects={payload['counts']['objects']} "
        f"signals={payload['counts']['signalObjects']} "
        f"control_marks={payload['counts']['controlMarks']} "
        f"neutral_marks={payload['counts']['neutralMarks']} "
        f"sectors={payload['counts']['sectors']} -> {OUTPUT}"
    )


if __name__ == "__main__":
    main()
