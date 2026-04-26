from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DOCS_MANIFEST = ROOT / "assets" / "docs" / "manifest.json"
TRACKER_MAP = ROOT / "assets" / "tracker" / "maps" / "komsomol-sk-tche-9" / "data.xml"
OUTPUT = ROOT / "assets" / "tracker" / "speed-docs.json"

SOURCE_CONFIG = {
    "БАМ": {
        "code": "BAM",
        "sectorHints": [7, 18, 19, 20],
        "title": "БАМ",
    },
    "ВСГ": {
        "code": "VSG",
        "sectorHints": [10, 11, 12, 13, 14, 15, 16, 17],
        "title": "ВСГ",
    },
    "ВЛЧ": {
        "code": "VLCH",
        "sectorHints": [9],
        "title": "ВЛЧ",
    },
}

FULL_KM_RANGE_RE = re.compile(
    r"(?P<skm>\d{1,4})\s*км\.?\s*(?P<spk>\d{1,2})?\s*(?:пк|ПК)?"
    r"\s*[-–]\s*"
    r"(?P<ekm>\d{1,4})\s*км\.?\s*(?P<epk>\d{1,2})?\s*(?:пк|ПК)?"
    r"\s*[-–]?\s*"
    r"(?P<speed>\d{2,3})\s*км\s*/?\s*ч",
    re.IGNORECASE,
)
SAME_KM_PK_RANGE_RE = re.compile(
    r"(?P<km>\d{1,4})\s*км\.?\s*"
    r"(?P<spk>\d{1,2})\s*[-–]\s*(?P<epk>\d{1,2})"
    r"\s*[-–]?\s*"
    r"(?P<speed>\d{2,3})\s*км\s*/?\s*ч",
    re.IGNORECASE,
)
COMPACT_KM_PK_RANGE_RE = re.compile(
    r"(?P<skm>\d{1,4})\s*пк\s*(?P<spk>\d{1,2})"
    r"\s*[-–]\s*"
    r"(?P<ekm>\d{1,4})\s*пк\s*(?P<epk>\d{1,2})"
    r"\s*[-–]?\s*"
    r"(?P<speed>\d{2,3})\s*км\s*/?\s*ч",
    re.IGNORECASE,
)
SINGLE_POINT_RE = re.compile(
    r"(?P<km>\d{1,4})\s*км\.?\s*(?P<pk>\d{1,2})?\s*(?:пк|ПК)?"
    r"(?:\s*\([^)]*\))?\s*[-–]\s*"
    r"(?P<speed>\d{2,3})\s*км\s*/?\s*ч",
    re.IGNORECASE,
)


def load_pdf_text_pages(path: Path) -> list[tuple[int, str]]:
    try:
        import pdfplumber

        with pdfplumber.open(path) as pdf:
            return [
                (index + 1, page.extract_text(x_tolerance=1, y_tolerance=3) or "")
                for index, page in enumerate(pdf.pages)
            ]
    except Exception:
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        return [
            (index + 1, page.extract_text() or "")
            for index, page in enumerate(reader.pages)
        ]


def normalize_line(text: str) -> str:
    value = text.replace("\u00a0", " ").replace("—", "-").replace("–", "-")
    value = re.sub(r"(\d)(км|КМ|пк|ПК)", r"\1 \2", value)
    value = re.sub(r"(км|КМ|пк|ПК)(\d)", r"\1 \2", value)
    value = re.sub(r"(\d)(км/ч|км\s*/\s*ч)", r"\1 \2", value, flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def coordinate_from_km_pk(km: int, pk: int | None) -> int:
    safe_pk = max(1, min(10, int(pk or 1)))
    return int(km) * 1000 + (safe_pk - 1) * 100


def parse_applies_to(raw: str) -> str:
    text = raw.lower()
    if "порож" in text:
        return "empty"
    has_passenger = "пасс" in text
    has_cargo = "груз" in text or "гр," in text or "гр." in text
    if has_passenger and has_cargo:
        return "cargo_passenger"
    if has_passenger:
        return "passenger"
    if has_cargo:
        return "cargo"
    return "all"


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
            if not raw_ord:
                continue
            values.append(round(float(raw_ord)))
        if values:
            result[sector] = (min(values), max(values))
    return result


def interval_intersects(a_start: int, a_end: int, b_start: int, b_end: int, margin: int = 250) -> bool:
    return max(a_start, b_start - margin) <= min(a_end, b_end + margin)


def guess_target_sectors(source_code: str, start: int, end: int, sector_hints: list[int], bounds: dict[int, tuple[int, int]]) -> list[int]:
    if source_code == "VLCH":
        sector_hints = [9]
    elif source_code == "BAM":
        if start >= 3_812_000:
            sector_hints = [7]
        elif start >= 1_467_000:
            sector_hints = [18, 19, 20]
    elif source_code == "VSG":
        if start >= 421_000:
            sector_hints = [15, 16, 17]
        elif start >= 331_000:
            sector_hints = [10]
        elif end <= 18_500:
            sector_hints = [12]
        elif start >= 182_000 and end <= 208_500:
            sector_hints = [14]
        elif start < 182_000:
            sector_hints = [13]

    result: list[int] = []
    for sector in sector_hints:
        sector_bounds = bounds.get(sector)
        if not sector_bounds:
            continue
        if interval_intersects(start, end, sector_bounds[0], sector_bounds[1]):
            result.append(sector)
    return sorted(set(result))


def make_rule(
    source: dict,
    page: int,
    raw: str,
    start_km: int,
    start_pk: int | None,
    end_km: int,
    end_pk: int | None,
    speed: int,
    bounds: dict[int, tuple[int, int]],
    confidence: str,
) -> dict | None:
    if speed < 5 or speed > 160:
        return None
    start = coordinate_from_km_pk(start_km, start_pk)
    end = coordinate_from_km_pk(end_km, end_pk)
    if end < start:
        start, end = end, start
        start_km, end_km = end_km, start_km
        start_pk, end_pk = end_pk, start_pk
    if end == start:
        end += 100
    target_sectors = guess_target_sectors(source["code"], start, end, source["sectorHints"], bounds)
    return {
        "sourceCode": source["code"],
        "sourceName": source["name"],
        "sourcePath": source["path"],
        "sourceUpdatedAt": source.get("updated_at", ""),
        "page": page,
        "startKm": int(start_km),
        "startPk": int(start_pk or 1),
        "endKm": int(end_km),
        "endPk": int(end_pk or 1),
        "coordinate": start,
        "end": end,
        "length": max(100, end - start),
        "speed": int(speed),
        "appliesTo": parse_applies_to(raw),
        "targetSectors": target_sectors,
        "confidence": confidence,
        "raw": raw[:260],
    }


def parse_rules_from_line(source: dict, page: int, line: str, bounds: dict[int, tuple[int, int]]) -> list[dict]:
    normalized = normalize_line(line)
    if "км/ч" not in normalized.lower() and "км /ч" not in normalized.lower() and "км / ч" not in normalized.lower():
        return []
    if "-" not in normalized or "пк" not in normalized.lower():
        return []

    rules: list[dict] = []
    occupied: list[tuple[int, int]] = []

    def add(match: re.Match, rule: dict | None) -> None:
        if not rule:
            return
        span = match.span()
        if any(max(span[0], item[0]) < min(span[1], item[1]) for item in occupied):
            return
        occupied.append(span)
        rules.append(rule)

    for match in FULL_KM_RANGE_RE.finditer(normalized):
        rule = make_rule(
            source,
            page,
            normalized,
            int(match.group("skm")),
            int(match.group("spk") or 1),
            int(match.group("ekm")),
            int(match.group("epk") or 1),
            int(match.group("speed")),
            bounds,
            "high",
        )
        add(match, rule)

    for match in COMPACT_KM_PK_RANGE_RE.finditer(normalized):
        rule = make_rule(
            source,
            page,
            normalized,
            int(match.group("skm")),
            int(match.group("spk")),
            int(match.group("ekm")),
            int(match.group("epk")),
            int(match.group("speed")),
            bounds,
            "medium",
        )
        add(match, rule)

    for match in SAME_KM_PK_RANGE_RE.finditer(normalized):
        rule = make_rule(
            source,
            page,
            normalized,
            int(match.group("km")),
            int(match.group("spk")),
            int(match.group("km")),
            int(match.group("epk")),
            int(match.group("speed")),
            bounds,
            "medium",
        )
        add(match, rule)

    for match in SINGLE_POINT_RE.finditer(normalized):
        # Single-point restrictions are useful, but lower confidence because PDF rows can
        # contain braking-check coordinates in the same visual row.
        rule = make_rule(
            source,
            page,
            normalized,
            int(match.group("km")),
            int(match.group("pk") or 1),
            int(match.group("km")),
            int(match.group("pk") or 1),
            int(match.group("speed")),
            bounds,
            "low",
        )
        add(match, rule)

    return rules


def dedupe_rules(rules: list[dict]) -> list[dict]:
    seen: set[tuple] = set()
    result: list[dict] = []
    for rule in rules:
        key = (
            rule["sourceCode"],
            rule["coordinate"],
            rule["end"],
            rule["speed"],
            rule["appliesTo"],
            tuple(rule["targetSectors"]),
        )
        if key in seen:
            continue
        seen.add(key)
        rule["id"] = f"{rule['sourceCode'].lower()}-{len(result) + 1:04d}"
        result.append(rule)
    return result


def main() -> None:
    manifest = json.loads(DOCS_MANIFEST.read_text(encoding="utf-8"))
    bounds = parse_sector_bounds()
    sources = []
    rules: list[dict] = []

    for item in manifest.get("speeds", []):
        config = SOURCE_CONFIG.get(item.get("name"))
        if not config:
            continue
        source = {
            **config,
            "name": item["name"],
            "path": item["path"],
            "updated_at": item.get("updated_at", ""),
        }
        sources.append(source)
        local_path = ROOT / item["path"].lstrip("/")
        for page, text in load_pdf_text_pages(local_path):
            for line in text.splitlines():
                rules.extend(parse_rules_from_line(source, page, line, bounds))

    rules = dedupe_rules(rules)
    by_sector: dict[str, int] = {}
    by_source: dict[str, int] = {}
    active_count = 0
    for rule in rules:
        by_source[rule["sourceCode"]] = by_source.get(rule["sourceCode"], 0) + 1
        if rule["targetSectors"]:
            active_count += 1
        for sector in rule["targetSectors"]:
            by_sector[str(sector)] = by_sector.get(str(sector), 0) + 1

    payload = {
        "schemaVersion": 1,
        "title": "Актуальные скорости из документов",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sources": [
            {
                "code": source["code"],
                "name": source["name"],
                "path": source["path"],
                "updatedAt": source.get("updated_at", ""),
                "sectorHints": source["sectorHints"],
            }
            for source in sources
        ],
        "counts": {
            "rules": len(rules),
            "activeRules": active_count,
            "bySource": dict(sorted(by_source.items())),
            "bySector": dict(sorted(by_sector.items(), key=lambda item: int(item[0]))),
        },
        "rules": rules,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {len(rules)} speed document rules -> {OUTPUT}")
    print(json.dumps(payload["counts"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
