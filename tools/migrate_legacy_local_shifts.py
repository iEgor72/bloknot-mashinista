#!/usr/bin/env python3
import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

LEGACY_DROP_KEYS = {
    'schedule_generated',
    'schedule_period_id',
    'schedule_code',
    'scheduleDateKey',
    'schedule_origin_period_id',
    'schedule_origin_date_key',
}


def load_rows(path: Path):
    with path.open('r', encoding='utf-8') as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError(f'{path} does not contain a JSON array')
    return data


def migrate_rows(rows):
    migrated = []
    removed_generated = 0
    stripped_fields = 0
    touched = 0
    for row in rows:
        if not isinstance(row, dict):
            migrated.append(row)
            continue
        if row.get('schedule_generated') is True:
            removed_generated += 1
            touched += 1
            continue
        next_row = dict(row)
        removed_here = 0
        for key in list(next_row.keys()):
            if key in LEGACY_DROP_KEYS:
                next_row.pop(key, None)
                removed_here += 1
        if removed_here:
            stripped_fields += removed_here
            touched += 1
        migrated.append(next_row)
    return migrated, {
        'removed_generated_rows': removed_generated,
        'stripped_fields': stripped_fields,
        'touched_rows': touched,
        'remaining_rows': len(migrated),
    }


def main():
    parser = argparse.ArgumentParser(description='Remove legacy schedule-layer fields from local shift JSON files.')
    parser.add_argument('--data-dir', default='data/local-shifts')
    parser.add_argument('--apply', action='store_true', help='Write changes and create .bak backups')
    parser.add_argument('--only', nargs='*', help='Optional list of file basenames or paths to process')
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    paths = sorted(data_dir.glob('*.json'))
    if args.only:
        wanted = set(args.only)
        paths = [p for p in paths if p.name in wanted or str(p) in wanted]

    if not paths:
        print(json.dumps({'processed_files': 0, 'changed_files': 0, 'results': []}, ensure_ascii=False, indent=2))
        return

    run_stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    results = []
    changed_files = 0

    for path in paths:
        rows = load_rows(path)
        migrated, stats = migrate_rows(rows)
        changed = migrated != rows
        result = {
            'file': str(path),
            'changed': changed,
            **stats,
        }
        if changed and args.apply:
            backup_path = path.with_suffix(path.suffix + f'.bak.{run_stamp}')
            shutil.copy2(path, backup_path)
            with path.open('w', encoding='utf-8') as f:
                json.dump(migrated, f, ensure_ascii=False, indent=2)
                f.write('\n')
            result['backup'] = str(backup_path)
        results.append(result)
        if changed:
            changed_files += 1

    print(json.dumps({
        'processed_files': len(paths),
        'changed_files': changed_files,
        'apply': bool(args.apply),
        'results': results,
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
