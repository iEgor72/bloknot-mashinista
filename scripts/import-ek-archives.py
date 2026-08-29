#!/usr/bin/env python3
"""Convert legacy EK ZIP archives into the application's section JSON format.

The legacy XML is treated as an unverified community source.  In particular,
speed limits are deliberately not promoted into section JSON.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import zipfile
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET


ARCHIVES = {
    "Вихоревка - Гыршелун(+ Саянская)": ("ek069-vikhorevka-gyrshelun-sayanskaya", "Вихоревка — Гыршелун (+ Саянская)", "Вихоревка", "Гыршелун", "vostsib", "Восточно-Сибирская железная дорога"),
    "Владивосток-Облучье": ("ek069-vladivostok-obluchye", "Владивосток — Облучье", "Владивосток", "Облучье", "dvost", "Дальневосточная железная дорога"),
    "Войновка-Екатеринбург": ("ek069-voynovka-yekaterinburg", "Войновка — Екатеринбург", "Войновка", "Екатеринбург", "svrd", "Свердловская железная дорога"),
    "Иркутск - Слюдянка": ("ek069-irkutsk-slyudyanka", "Иркутск — Слюдянка", "Иркутск", "Слюдянка", "vostsib", "Восточно-Сибирская железная дорога"),
    "Комсомольск ТЧЭ-9": ("ek069-komsomolsk-tche-9", "Комсомольск, ТЧЭ-9", "Комсомольск", "Комсомольск", "dvost", "Дальневосточная железная дорога"),
    "Коноша-Сосногорск": ("ek069-konosha-sosnogorsk", "Коноша — Сосногорск", "Коноша", "Сосногорск", "sevn", "Северная железная дорога"),
    "Мариинск-Иркутск(by SkripTal)": ("ek069-mariinsk-irkutsk", "Мариинск — Иркутск", "Мариинск", "Иркутск", "cross-network", "Красноярская / Восточно-Сибирская железные дороги"),
    "Ружино(груз)": ("ek069-ruzhino-freight", "Ружино (грузовое движение)", "Ружино", "Ружино", "dvost", "Дальневосточная железная дорога"),
    "Ружино(пасс 8170)": ("ek069-ruzhino-pass-8170", "Ружино (пассажирское движение, 8170)", "Ружино", "Ружино", "dvost", "Дальневосточная железная дорога"),
    "Тайшет - Гыршелун(не тестировалась)": ("ek069-taishet-gyrshelun", "Тайшет — Гыршелун (источник не тестировался)", "Тайшет", "Гыршелун", "cross-network", "Восточно-Сибирская / Забайкальская железные дороги"),
    "Таксимо-Юктали(груз EA70)": ("ek069-taksimo-yuktali-freight", "Таксимо — Юктали (грузовое движение, EA70)", "Таксимо", "Юктали", "cross-network", "Восточно-Сибирская / Дальневосточная железные дороги"),
    "Тында-Верхнезейск": ("ek069-tynda-verkhnezeysk", "Тында — Верхнезейск", "Тында", "Верхнезейск", "dvost", "Дальневосточная железная дорога"),
    "Тында-Комсомольск-Известковая": ("ek069-tynda-komsomolsk-izvestkovaya", "Тында — Комсомольск — Известковая", "Тында", "Известковая", "dvost", "Дальневосточная железная дорога"),
}

REQUIRED_FILES = ("data.xml", "profile.xml", "1.xml", "1n.xml", "2.xml", "2n.xml")
NUMBER_RE = re.compile(r"[-+]?\d+(?:[.,]\d+)?")
SPEED_NAME_RE = re.compile(r"(?:км\s*/?\s*ч|кмч|^\s*\d+(?:[.,]\d+)?\s*$)", re.IGNORECASE)


def xml_root(raw: bytes) -> ET.Element:
    last_error = None
    for encoding in ("utf-8-sig", "cp1251"):
        try:
            text = raw.decode(encoding)
            text = re.sub(r"^\s*<\?xml[^>]*\?>", "", text, count=1)
            return ET.fromstring(text)
        except (UnicodeDecodeError, ET.ParseError) as error:
            last_error = error
    raise ValueError(f"XML cannot be decoded: {last_error}")


def number(text: str | None) -> float:
    match = NUMBER_RE.search(str(text or "").replace(" ", ""))
    if not match:
        raise ValueError(f"not a number: {text!r}")
    return float(match.group(0).replace(",", "."))


def clean_number(value: float) -> int | float:
    rounded = round(value, 6)
    return int(rounded) if math.isclose(rounded, round(rounded), abs_tol=1e-6) else rounded


def merged_ranges(ranges):
    result = []
    for start, end in sorted(ranges):
        if end <= start:
            continue
        if result and start <= result[-1][1]:
            result[-1][1] = max(result[-1][1], end)
        else:
            result.append([start, end])
    return result


def range_length(ranges):
    return sum(end - start for start, end in merged_ranges(ranges))


def overlap_length(start, end, ranges):
    return sum(max(0, min(end, right) - max(start, left)) for left, right in merged_ranges(ranges))


def parse_geometry(root):
    geometry = {}
    for sector in root.findall("sector"):
        sector_id = int(sector.attrib["id"])
        by_ordinate = {}
        for waypoint in sector.findall("wpt"):
            try:
                ordinate = int(round(number(waypoint.findtext("ord"))))
                lat = number(waypoint.findtext("lat"))
                lon = number(waypoint.findtext("lon"))
            except ValueError:
                continue
            if -90 <= lat <= 90 and -180 <= lon <= 180:
                by_ordinate[ordinate] = (lat, lon)
        points = [(ordinate, *by_ordinate[ordinate]) for ordinate in sorted(by_ordinate)]
        if len(points) >= 2:
            geometry[sector_id] = points
    return geometry


def parse_profile(root):
    result = defaultdict(list)
    corrections = []
    source_order = {}
    for order, sector in enumerate(root.findall("sector")):
        sector_id = int(sector.attrib["id"])
        source_order.setdefault(sector_id, order)
        for point_index, point in enumerate(sector.findall("pt")):
            try:
                raw_start = point.findtext("start")
                raw_length = point.findtext("len")
                raw_gradient = point.findtext("grad")
                start = int(round(number(raw_start)))
                length = int(round(number(raw_length)))
                gradient = number(raw_gradient)
            except ValueError:
                corrections.append(f"Не прочитан элемент профиля sector={sector_id}, index={point_index}")
                continue
            if length <= 0 or abs(gradient) > 50:
                corrections.append(f"Отброшен неправдоподобный элемент sector={sector_id}, start={start}")
                continue
            if str(raw_gradient or "").strip().startswith("="):
                corrections.append(f"Исправлена запись уклона {raw_gradient!r} в sector={sector_id}, start={start}")
            result[sector_id].append({"start": start, "end": start + length, "gradient": gradient, "order": point_index})
    return result, source_order, corrections


def parse_objects(zip_file):
    result = []
    for file_name in ("1.xml", "1n.xml", "2.xml", "2n.xml"):
        root = xml_root(zip_file.read(file_name))
        for sector in root.findall("sector"):
            sector_id = int(sector.attrib["id"])
            for waypoint in sector.findall("wpt"):
                try:
                    object_type = int(number(waypoint.findtext("type")))
                    coordinate = int(round(number(waypoint.findtext("coordinate"))))
                    length = max(0, int(round(number(waypoint.findtext("length") or "0"))))
                except ValueError:
                    continue
                name = " ".join((waypoint.findtext("name") or "").split())
                if not name:
                    continue
                result.append({"type": object_type, "name": name, "coordinate": coordinate, "length": length, "source_sector": sector_id, "source_file": file_name})
    return result


def select_geometry(profile_sector, profile_items, geometry):
    profile_start = min(item["start"] for item in profile_items)
    profile_end = max(item["end"] for item in profile_items)
    candidates = []
    for sector_id, points in geometry.items():
        start, end = points[0][0], points[-1][0]
        overlap = max(0, min(profile_end, end) - max(profile_start, start))
        if overlap:
            candidates.append((sector_id, start, end, overlap))
    exact = [item for item in candidates if item[0] == profile_sector]
    selected = exact[:]
    covered = [(max(profile_start, start), min(profile_end, end)) for _, start, end, _ in selected]
    threshold = max(1000, min(100000, (profile_end - profile_start) * 0.05))
    for candidate in sorted(candidates, key=lambda item: item[3], reverse=True):
        if candidate in selected:
            continue
        sector_id, start, end, overlap = candidate
        clipped_start, clipped_end = max(profile_start, start), min(profile_end, end)
        contribution = overlap - overlap_length(clipped_start, clipped_end, covered)
        if contribution >= threshold and contribution >= overlap * 0.45:
            selected.append(candidate)
            covered.append((clipped_start, clipped_end))
    return selected


def assign_profiles(profile, profile_order, geometry):
    assigned = defaultdict(list)
    assigned_order = {}
    reassigned = []
    for source_sector, items in profile.items():
        selected = select_geometry(source_sector, items, geometry)
        for selected_index, (geometry_sector, geometry_start, geometry_end, _) in enumerate(selected):
            assigned_order.setdefault(geometry_sector, (profile_order[source_sector], selected_index, geometry_start))
            if geometry_sector != source_sector:
                reassigned.append((source_sector, geometry_sector))
            priority = 3 if geometry_sector == source_sector else (1 if source_sector == 0 else 2)
            for item in items:
                start = max(item["start"], geometry_start)
                end = min(item["end"], geometry_end)
                if end > start:
                    assigned[geometry_sector].append({**item, "start": start, "end": end, "source_sector": source_sector, "priority": priority})
    return assigned, assigned_order, sorted(set(reassigned))


def normalized_elements(candidates, official_min, official_max):
    legacy_min, legacy_max = official_min - 1000, official_max - 1000
    clipped = []
    endpoints = {legacy_min, legacy_max}
    for item in candidates:
        start, end = max(legacy_min, item["start"]), min(legacy_max, item["end"])
        if end <= start:
            continue
        clipped.append({**item, "start": start, "end": end})
        endpoints.update((start, end))
    result = []
    positions = sorted(endpoints)
    for left, right in zip(positions, positions[1:]):
        middle = (left + right) / 2
        choices = [item for item in clipped if item["start"] <= middle < item["end"]]
        if not choices:
            continue
        choice = max(choices, key=lambda item: (item["priority"], -item["source_sector"], -item["order"]))
        start_m, end_m = left + 1000, right + 1000
        if result and result[-1]["start_m"] + result[-1]["len_m"] == start_m and result[-1]["grad_permille"] == clean_number(choice["gradient"]):
            result[-1]["len_m"] += end_m - start_m
        else:
            result.append({
                "start_m": clean_number(start_m),
                "len_m": clean_number(end_m - start_m),
                "grad_permille": clean_number(choice["gradient"]),
                "confidence": "legacy_ek_unverified",
            })
    return result


def coverage_and_gaps(elements, minimum, maximum):
    coverage = merged_ranges((item["start_m"], item["start_m"] + item["len_m"]) for item in elements)
    gaps = []
    cursor = minimum
    for start, end in coverage:
        if start > cursor:
            gaps.append({"start_m": clean_number(cursor), "end_m": clean_number(start), "reason": "В исходной ЭК отсутствует профиль для этого диапазона."})
        cursor = max(cursor, end)
    if cursor < maximum:
        gaps.append({"start_m": clean_number(cursor), "end_m": clean_number(maximum), "reason": "В исходной ЭК отсутствует профиль для этого диапазона."})
    return ([{"start_m": clean_number(start), "end_m": clean_number(end)} for start, end in coverage], gaps)


def section_objects(objects, geometry_sector, minimum, maximum):
    stations, signals, whistles = [], [], []
    seen = set()
    for item in objects:
        official = item["coordinate"] + 1000
        if official < minimum or official > maximum:
            continue
        if item["source_sector"] != geometry_sector and item["source_sector"] != 0:
            continue
        identity = (item["type"], item["name"].casefold(), official)
        if identity in seen:
            continue
        seen.add(identity)
        common = {
            "name": item["name"],
            "chainage_m": official,
            "sector": geometry_sector,
            "confidence": "legacy_ek_unverified",
            "legacy_source": item["source_file"],
        }
        if item["length"]:
            common["length_m"] = item["length"]
        if item["type"] == 2 and not SPEED_NAME_RE.search(item["name"]):
            stations.append({"name": item["name"], "km": clean_number(official / 1000), "sector": geometry_sector, "confidence": "legacy_ek_unverified"})
        elif item["type"] == 1:
            signals.append(common)
        elif item["type"] == 4:
            whistles.append(common)
    key = lambda item: item.get("chainage_m", item.get("km", 0) * 1000)
    return sorted(stations, key=key), sorted(signals, key=key), sorted(whistles, key=key)


def make_section(route_meta, archive_path, archive_hash, geometry_sector, points, candidates, objects, corrections, reassignments):
    route_id, route_name, _, _, railway_id, railway_name = route_meta
    section_id = f"{route_id}-s{geometry_sector}"
    path_id = f"{section_id}-path"
    minimum, maximum = points[0][0] + 1000, points[-1][0] + 1000
    elements = normalized_elements(candidates, minimum, maximum)
    coverage, gaps = coverage_and_gaps(elements, minimum, maximum)
    stations, signals, whistles = section_objects(objects, geometry_sector, minimum, maximum)
    flags = [
        "Импортировано из пользовательской ЭК приложения «Блокнот машиниста» 0.6.9; профиль, объекты и GPS-геометрия не сверены с официальной режимной картой.",
        "Ограничения скорости из старого XML намеренно не перенесены: их требуется внести вручную по действующим документам.",
        "Направление движения и принадлежность GPS-сектора требуют ручной проверки.",
    ]
    if corrections:
        flags.append(f"При разборе исходника применены безопасные числовые исправления/отбраковка: {len(corrections)}.")
    related = [pair for pair in reassignments if pair[1] == geometry_sector]
    if related:
        pairs = ", ".join(f"{source}→{target}" for source, target in related)
        flags.append(f"Профиль сопоставлен с GPS-сектором по пересечению километража ({pairs}); соответствие требует проверки.")
    geometry_points = [{
        "lat": clean_number(lat), "lon": clean_number(lon), "sector": geometry_sector,
        "path_id": path_id, "ordinate": ordinate, "chainage_m": ordinate + 1000,
    } for ordinate, lat, lon in points]
    return {
        "schema_version": "1.0",
        "id": section_id,
        "status": "draft",
        "railway": {"id": railway_id, "name": railway_name},
        "section_name": f"{route_name} — сектор {geometry_sector}",
        "direction": "требует проверки",
        "km_start": clean_number(minimum / 1000),
        "km_end": clean_number(maximum / 1000),
        "generator_format": "Б",
        "elements": elements,
        "stations": stations,
        "signals": signals,
        "whistle_points": whistles,
        "speed": {"established": None, "permanent_restrictions": [], "temporary_warnings": [], "source": "manual_required"},
        "flags_for_review": flags,
        "provenance": [{
            "kind": "legacy_ek_archive", "file_name": archive_path.name, "sha256": archive_hash,
            "source_application": "Блокнот машиниста 0.6.9", "role": "non_authoritative_import_seed",
        }],
        "runtime": {
            "coordinate_unit": "m", "coordinate_kind": "official_railway_chainage", "coordinate_offset_m": -1000,
            "movement_order": "ascending", "default_path_id": path_id,
            "route_legs": [{"path_id": path_id, "sector": geometry_sector, "from_chainage_m": minimum, "to_chainage_m": maximum}],
            "profile_status": "legacy_ek_unverified", "profile_coverage": coverage, "profile_gaps": gaps,
            "profile_applies_both_directions": False,
        },
        "geometry": {"status": "draft_from_legacy_ek", "source": archive_path.name, "paths": [{"path_id": path_id, "sector": geometry_sector, "points": geometry_points}]},
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="Directory containing EK ZIP files")
    parser.add_argument("--output", type=Path, default=Path("assets/tracker/sections"))
    args = parser.parse_args()
    output = args.output.resolve()
    index_path = output / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8"))
    index["sections"] = [item for item in index["sections"] if not item["id"].startswith("ek069-")]
    index["routes"] = [item for item in index["routes"] if not item["id"].startswith("ek069-")]
    for old_file in output.glob("ek069-*.json"):
        old_file.unlink()

    converted = []
    for archive_path in sorted(args.source.glob("*.zip"), key=lambda path: path.name.casefold()):
        route_meta = ARCHIVES.get(archive_path.stem)
        if not route_meta:
            raise SystemExit(f"No route metadata for {archive_path.name}")
        archive_hash = hashlib.sha256(archive_path.read_bytes()).hexdigest()
        with zipfile.ZipFile(archive_path) as zip_file:
            missing = sorted(set(REQUIRED_FILES) - set(zip_file.namelist()))
            if missing:
                raise SystemExit(f"{archive_path.name}: missing {', '.join(missing)}")
            geometry = parse_geometry(xml_root(zip_file.read("data.xml")))
            profile, profile_order, corrections = parse_profile(xml_root(zip_file.read("profile.xml")))
            objects = parse_objects(zip_file)
        assigned, assigned_order, reassignments = assign_profiles(profile, profile_order, geometry)
        section_ids = []
        for geometry_sector in sorted(assigned, key=lambda sector: assigned_order[sector]):
            section = make_section(route_meta, archive_path, archive_hash, geometry_sector, geometry[geometry_sector], assigned[geometry_sector], objects, corrections, reassignments)
            if not section["elements"]:
                continue
            file_name = f"{section['id']}.json"
            (output / file_name).write_text(json.dumps(section, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            section_ids.append(section["id"])
            index["sections"].append({
                "id": section["id"], "file": file_name, "section_name": section["section_name"], "status": section["status"],
                "direction": section["direction"], "km_start": section["km_start"], "km_end": section["km_end"],
                "profile_status": section["runtime"]["profile_status"], "geometry_status": section["geometry"]["status"],
            })
        if not section_ids:
            raise SystemExit(f"{archive_path.name}: no sections produced")
        route_id, route_name, route_from, route_to, _, _ = route_meta
        index["routes"].append({
            "id": route_id, "name": f"{route_name} (ЭК 0.6.9)", "from": route_from, "to": route_to,
            "default_variant": "legacy-ek", "variants": [{"id": "legacy-ek", "name": "Импортированная ЭК (требует проверки)", "section_ids": section_ids}],
            "flags_for_review": ["Маршрут и порядок секторов восстановлены из старой ЭК и требуют ручной проверки."],
        })
        converted.append((archive_path.name, len(section_ids)))

    index["generated_at"] = "2026-08-30"
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Converted {len(converted)} archives into {sum(count for _, count in converted)} sections")
    for name, count in converted:
        print(f"- {name}: {count}")


if __name__ == "__main__":
    main()
