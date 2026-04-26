#!/usr/bin/env python3
import argparse
import hashlib
import json
import posixpath
import re
import shutil
import tarfile
import tempfile
import zlib
from pathlib import Path


DEFAULT_MANIFEST = Path("assets/tracker/maps-manifest.json")
DEFAULT_MAPS_DIR = Path("assets/tracker/maps")
APP_EMAP_SUFFIX = "/app_emap/"
REQUIRED_XML = {"data.xml", "profile.xml"}


def read_backup_payload(path):
    data = Path(path).read_bytes()
    if data.startswith(b"ANDROID BACKUP\n"):
      parts = data.split(b"\n", 4)
      if len(parts) < 5:
          raise ValueError("Invalid Android backup header")
      version = parts[1].decode("utf-8", "replace")
      compressed = parts[2] == b"1"
      encryption = parts[3].decode("utf-8", "replace")
      if encryption != "none":
          raise ValueError(f"Encrypted backups are not supported: {encryption}")
      payload = zlib.decompress(parts[4]) if compressed else parts[4]
      return payload, f"android-backup-v{version}"
    return data, "tar"


def safe_file_name(name):
    base = posixpath.basename(name)
    if not re.match(r"^[A-Za-z0-9_.-]+$", base):
        base = re.sub(r"[^A-Za-z0-9_.-]+", "_", base)
    return base


def title_to_slug(title):
    base = re.sub(r"[^a-z0-9]+", "-", str(title).lower()).strip("-")
    return base[:72] or "phone-backup-emap"


def sha256_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def find_emap_groups(tar_path):
    groups = {}
    with tarfile.open(tar_path, "r:*") as archive:
        for member in archive.getmembers():
            if not member.isfile() or APP_EMAP_SUFFIX not in member.name:
                continue
            prefix, rel = member.name.split(APP_EMAP_SUFFIX, 1)
            if not rel or "/" in rel or not rel.lower().endswith(".xml"):
                continue
            group_key = prefix + APP_EMAP_SUFFIX[:-1]
            groups.setdefault(group_key, []).append(member)
    result = []
    for group_key, members in groups.items():
        names = {posixpath.basename(item.name).lower() for item in members}
        result.append({
            "key": group_key,
            "members": sorted(members, key=lambda item: item.name.lower()),
            "complete": REQUIRED_XML.issubset(names),
            "names": names,
        })
    return result


def sort_map_files(files):
    priority = {
        "data.xml": 0,
        "profile.xml": 1,
        "speed.xml": 2,
        "1.xml": 3,
        "1n.xml": 4,
        "2.xml": 5,
        "2n.xml": 6,
    }
    return sorted(files, key=lambda item: (priority.get(item.lower(), 50), item.lower()))


def extract_group(tar_path, group, output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)
    written = []
    with tarfile.open(tar_path, "r:*") as archive:
        for member in group["members"]:
            name = safe_file_name(member.name)
            target = output_dir / name
            with archive.extractfile(member) as source:
                if not source:
                    continue
                target.write_bytes(source.read())
            written.append(name)
    return sort_map_files(written)


def build_manifest_entry(map_id, title, source_name, files):
    base = f"/assets/tracker/maps/{map_id}"
    data = "data.xml" if "data.xml" in files else ""
    profile = "profile.xml" if "profile.xml" in files else ""
    speed = "speed.xml" if "speed.xml" in files else ""
    return {
        "id": map_id,
        "title": title,
        "sourceName": source_name,
        "data": f"{base}/{data}" if data else "",
        "profile": f"{base}/{profile}" if profile else "",
        "speed": f"{base}/{speed}" if speed else "",
        "files": [f"{base}/{name}" for name in files],
        "downloaded": True,
    }


def update_manifest(manifest_path, entry):
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    maps = manifest.get("maps") if isinstance(manifest.get("maps"), list) else []
    updated = False
    for index, item in enumerate(maps):
        if item and item.get("id") == entry["id"]:
            maps[index] = entry
            updated = True
            break
    if not updated:
        maps.append(entry)
    manifest["maps"] = maps
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return "updated" if updated else "added"


def main():
    parser = argparse.ArgumentParser(description="Import Poekhali EMap XML files from an Android adb backup.")
    parser.add_argument("--backup", required=True, help="Path to .ab Android backup or raw tar backup.")
    parser.add_argument("--id", default="", help="Map id for assets/tracker/maps/<id>.")
    parser.add_argument("--title", default="Phone backup EMap", help="Map title for maps-manifest.json.")
    parser.add_argument("--source-name", default="", help="Source label stored in maps-manifest.json.")
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST), help="Path to maps-manifest.json.")
    parser.add_argument("--maps-dir", default=str(DEFAULT_MAPS_DIR), help="Output maps directory.")
    parser.add_argument("--group", default="", help="Specific app_emap group key if backup has several.")
    parser.add_argument("--dry-run", action="store_true", help="Inspect backup without writing assets or manifest.")
    args = parser.parse_args()

    backup_path = Path(args.backup)
    manifest_path = Path(args.manifest)
    maps_dir = Path(args.maps_dir)
    map_id = args.id or title_to_slug(args.title)
    source_name = args.source_name or f"phone-backup:{backup_path.name}/app_emap"

    payload, payload_type = read_backup_payload(backup_path)
    with tempfile.TemporaryDirectory(prefix="poekhali-backup-") as tmp:
        tar_path = Path(tmp) / "backup.tar"
        tar_path.write_bytes(payload)
        groups = find_emap_groups(tar_path)
        complete_groups = [item for item in groups if item["complete"]]
        if args.group:
            complete_groups = [item for item in complete_groups if item["key"] == args.group]
        if not complete_groups:
            print(f"backup={backup_path}")
            print(f"type={payload_type}")
            print(f"emap_groups={len(groups)}")
            raise SystemExit("No complete app_emap group with data.xml and profile.xml found")
        if len(complete_groups) > 1:
            print("Several complete app_emap groups found; pass --group:")
            for item in complete_groups:
                print(item["key"])
            raise SystemExit(2)

        group = complete_groups[0]
        temp_map_dir = Path(tmp) / "map"
        files = extract_group(tar_path, group, temp_map_dir)
        hashes = {name: hashlib.sha256((temp_map_dir / name).read_bytes()).hexdigest()[:16] for name in files}

        print(f"backup={backup_path}")
        print(f"type={payload_type}")
        print(f"group={group['key']}")
        print(f"map_id={map_id}")
        print(f"title={args.title}")
        print(f"files={','.join(files)}")
        for name in files:
            print(f"sha256:{name}={hashes[name]}")

        if args.dry_run:
            existing_dir = maps_dir / map_id
            if existing_dir.exists():
                comparisons = []
                for name in files:
                    existing = existing_dir / name
                    if existing.exists():
                        comparisons.append(f"{name}:{'same' if sha256_file(existing)[:16] == hashes[name] else 'diff'}")
                    else:
                        comparisons.append(f"{name}:missing")
                print("existing=" + ",".join(comparisons))
            print("dry_run=true")
            return

        output_dir = maps_dir / map_id
        if output_dir.exists():
            shutil.rmtree(output_dir)
        shutil.copytree(temp_map_dir, output_dir)
        entry = build_manifest_entry(map_id, args.title, source_name, files)
        action = update_manifest(manifest_path, entry)
        print(f"written={output_dir}")
        print(f"manifest={action}:{manifest_path}")


if __name__ == "__main__":
    main()
