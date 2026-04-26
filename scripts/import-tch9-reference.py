#!/usr/bin/env python3
import argparse
import json
import os
import sqlite3
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_INPUT = r"D:\Загрузки\tch9_v43_d25.04.26.db"
DEFAULT_OUTPUT = "assets/tracker/tch9-reference.json"


def open_readonly_sqlite(path):
    uri = "file:" + str(path).replace("\\", "/") + "?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def rows(conn, sql, params=()):
    return [compact_row(dict(row)) for row in conn.execute(sql, params)]


def compact_row(row):
    return {key: value for key, value in row.items() if value is not None}


def read_table_counts(conn):
    result = {}
    table_names = conn.execute(
        "select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name"
    ).fetchall()
    for item in table_names:
        name = item[0]
        result[name] = conn.execute(f"select count(*) from {name!r}").fetchone()[0]
    return result


def read_norms(conn):
    result = {}
    for row in conn.execute("select * from norm_time order by year"):
        year = str(row["year"])
        result[year] = [row[f"month{i}"] for i in range(1, 13)]
    return result


def read_daily_table(conn, table_name):
    result = {}
    for row in conn.execute(f"select * from {table_name} order by year, _id"):
        year = str(row["year"])
        month_number = int(row["_id"])
        result.setdefault(year, {})[str(month_number)] = [row[f"day{i}"] for i in range(1, 32)]
    return result


def read_hauls(conn):
    stations_by_haul = defaultdict(list)
    for row in conn.execute(
        """
        select
          soh.haul_id,
          soh.station_id,
          s.station,
          soh.km,
          soh.pusher_flag
        from station_on_haul soh
        join stations s on s._id = soh.station_id
        order by soh.haul_id, soh.km, soh._id
        """
    ):
        km = row["km"]
        stations_by_haul[row["haul_id"]].append({
            "stationId": row["station_id"],
            "name": row["station"],
            "km": km,
            "meter": km * 1000 if km is not None else None,
            "pusher": bool(row["pusher_flag"]),
        })

    hauls = []
    for row in conn.execute(
        """
        select
          h._id,
          h.haul,
          h.length_of_haul,
          h.depot_id,
          d.depot_name,
          d.depot_code,
          h.gateaway,
          h.weight_norm,
          h.train_length_norm,
          h.speed_norm,
          h.shoulder_id
        from hauls h
        left join depot d on d._id = h.depot_id
        order by h._id
        """
    ):
        hauls.append({
            "id": row["_id"],
            "name": row["haul"],
            "lengthKm": row["length_of_haul"],
            "depotId": row["depot_id"],
            "depotName": row["depot_name"],
            "depotCode": row["depot_code"],
            "gateaway": row["gateaway"],
            "weightNorm": row["weight_norm"],
            "trainLengthNorm": row["train_length_norm"],
            "speedNorm": row["speed_norm"],
            "shoulderId": row["shoulder_id"],
            "stations": stations_by_haul.get(row["_id"], []),
        })
    return hauls


def read_udr_table(conn, table_name):
    result = []
    for row in conn.execute(
        f"""
        select
          u.*,
          h.haul,
          l.line as loco_line
        from {table_name} u
        left join hauls h on h._id = u.haul_id
        left join loco l on l._id = u.loco_id
        order by u._id
        """
    ):
        values = {}
        for weight in range(5, 27):
            key = f"col{weight}"
            if key in row.keys() and row[key] is not None:
                values[str(weight)] = row[key]
        result.append({
            "id": row["_id"],
            "haulId": row["haul_id"],
            "haul": row["haul"],
            "locoId": row["loco_id"],
            "loco": row["loco_line"],
            "values": values,
            "gateaway": row["gateaway"],
            "idle": row["idle"],
            "shunting": row["shunting"],
            "limitation": row["limitation"],
        })
    return result


def build_reference(db_path):
    conn = open_readonly_sqlite(db_path)
    try:
        stat = db_path.stat()
        return {
            "schemaVersion": 1,
            "title": "Комсомольск ТЧЭ-9",
            "source": {
                "fileName": db_path.name,
                "sizeBytes": stat.st_size,
                "modifiedAt": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
                "importedAt": datetime.now(timezone.utc).isoformat(),
            },
            "counts": read_table_counts(conn),
            "branches": rows(conn, "select * from branches order by _id"),
            "depots": rows(conn, "select * from depot order by _id"),
            "trafficTypes": rows(conn, "select * from traffic_type order by _id"),
            "locos": rows(conn, "select * from loco order by _id"),
            "hauls": read_hauls(conn),
            "trainNumbers": rows(conn, "select * from train_numbers order by begin_number, end_number"),
            "normTime": read_norms(conn),
            "dailyCurrentTime": read_daily_table(conn, "cur_time"),
            "dailyCutTimeAlt": read_daily_table(conn, "cut_time_alt"),
            "locoOnHaul": rows(
                conn,
                """
                select
                  loh._id,
                  loh.haul as haul_id,
                  h.haul,
                  loh.loco_id,
                  l.line as loco,
                  loh.traffic_type,
                  tt.type as traffic_type_name
                from loco_on_haul loh
                left join hauls h on h._id = loh.haul
                left join loco l on l._id = loh.loco_id
                left join traffic_type tt on tt._id = loh.traffic_type
                order by loh._id
                """,
            ),
            "udr": {
                "cargo": read_udr_table(conn, "udr_cargo"),
                "passenger": read_udr_table(conn, "udr_pass"),
                "work": read_udr_table(conn, "udr_work"),
                "reserve": rows(
                    conn,
                    """
                    select
                      r._id,
                      r.haul_id,
                      h.haul,
                      r.line,
                      r.udr_res
                    from udr_reserve r
                    left join hauls h on h._id = r.haul_id
                    order by r._id
                    """,
                ),
                "pusher": rows(
                    conn,
                    """
                    select
                      p._id,
                      p.haulpush_id,
                      hp.haul_push,
                      p.line,
                      p.udr
                    from udr_pusher p
                    left join haul_pusher hp on hp._id = p.haulpush_id
                    order by p._id
                    """,
                ),
            },
        }
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Import TrainNote TCH9 SQLite reference into a static JSON asset.")
    parser.add_argument("--input", default=DEFAULT_INPUT, help="Path to TrainNote tch9 SQLite DB")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Output JSON asset path")
    args = parser.parse_args()

    db_path = Path(args.input)
    out_path = Path(args.output)
    if not db_path.exists():
        raise SystemExit(f"Input DB not found: {db_path}")

    reference = build_reference(db_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(reference, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out_path} from {db_path}")


if __name__ == "__main__":
    main()
