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
MAX_BACKUP_INPUT_BYTES = 512 * 1024 * 1024
MAX_BACKUP_PAYLOAD_BYTES = 256 * 1024 * 1024
MAX_COMPRESSION_RATIO = 200
MAX_TAR_MEMBERS = 5000
MAX_EMAP_FILE_BYTES = 64 * 1024 * 1024
MAX_EMAP_GROUP_BYTES = 128 * 1024 * 1024


def bounded_zlib_decompress(data):
    decompressor = zlib.decompressobj()
    output = bytearray()
    compressed_size = max(1, len(data))
    for offset in range(0, len(data), 1024 * 1024):
        chunk = data[offset:offset + 1024 * 1024]
        remaining = MAX_BACKUP_PAYLOAD_BYTES - len(output)
        output.extend(decompressor.decompress(chunk, remaining + 1))
        if len(output) > MAX_BACKUP_PAYLOAD_BYTES or decompressor.unconsumed_tail:
            raise ValueError("Android backup payload exceeds the safe size limit")
        if len(output) > compressed_size * MAX_COMPRESSION_RATIO:
            raise ValueError("Android backup compression ratio exceeds the safe limit")
    remaining = MAX_BACKUP_PAYLOAD_BYTES - len(output)
    output.extend(decompressor.flush(remaining + 1))
    if len(output) > MAX_BACKUP_PAYLOAD_BYTES:
        raise ValueError("Android backup payload exceeds the safe size limit")
    if len(output) > compressed_size * MAX_COMPRESSION_RATIO:
        raise ValueError("Android backup compression ratio exceeds the safe limit")
    if not decompressor.eof:
        raise ValueError("Truncated Android backup payload")
    return bytes(output)


def read_backup_payload(path):
    backup_path = Path(path)
    if backup_path.stat().st_size > MAX_BACKUP_INPUT_BYTES:
        raise ValueError("Backup exceeds the safe input size limit")
    with backup_path.open("rb") as source:
        data = source.read(MAX_BACKUP_INPUT_BYTES + 1)
    if len(data) > MAX_BACKUP_INPUT_BYTES:
        raise ValueError("Backup exceeds the safe input size limit")
    if data.startswith(b"ANDROID BACKUP\n"):
      parts = data.split(b"\n", 4)
      if len(parts) < 5:
          raise ValueError("Invalid Android backup header")
      version = parts[1].decode("utf-8", "replace")
      compressed = parts[2] == b"1"
      encryption = parts[3].decode("utf-8", "replace")
      if encryption != "none":
          raise ValueError(f"Encrypted backups are not supported: {encryption}")
      payload = bounded_zlib_decompress(parts[4]) if compressed else parts[4]
      if len(payload) > MAX_BACKUP_PAYLOAD_BYTES:
          raise ValueError("Android backup payload exceeds the safe size limit")
      return payload, f"android-backup-v{version}"
    if len(data) > MAX_BACKUP_PAYLOAD_BYTES:
        raise ValueError("Raw tar backup exceeds the safe payload size limit")
    return data, "tar"


def safe_file_name(name):
    base = posixpath.basename(name)
    if not re.match(r"^[A-Za-z0-9_.-]+$", base):
        base = re.sub(r"[^A-Za-z0-9_.-]+", "_", base)
    return base


def title_to_slug(title):
    base = re.sub(r"[^a-z0-9]+", "-", str(title).lower()).strip("-")
    return base[:72] or "phone-backup-emap"


def validate_map_id(value):
    map_id = str(value or "").strip()
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,71}", map_id):
        raise ValueError("Map id must contain only lowercase latin letters, digits and hyphens")
    return map_id


def sha256_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def find_emap_groups(tar_path):
    groups = {}
    member_count = 0
    with tarfile.open(tar_path, "r:") as archive:
        for member in archive:
            member_count += 1
            if member_count > MAX_TAR_MEMBERS:
                raise ValueError("Backup contains too many archive members")
            if not member.isfile() or APP_EMAP_SUFFIX not in member.name:
                continue
            prefix, rel = member.name.split(APP_EMAP_SUFFIX, 1)
            if not rel or "/" in rel or not rel.lower().endswith(".xml"):
                continue
            if member.size < 0 or member.size > MAX_EMAP_FILE_BYTES:
                raise ValueError(f"EMap file exceeds the safe size limit: {member.name}")
            group_key = prefix + APP_EMAP_SUFFIX[:-1]
            groups.setdefault(group_key, []).append(member)
    result = []
    for group_key, members in groups.items():
        if sum(item.size for item in members) > MAX_EMAP_GROUP_BYTES:
            raise ValueError(f"EMap group exceeds the safe size limit: {group_key}")
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
    total_written = 0
    with tarfile.open(tar_path, "r:") as archive:
        for member in group["members"]:
            name = safe_file_name(member.name)
            target = output_dir / name
            with archive.extractfile(member) as source:
                if not source:
                    continue
                payload = source.read(MAX_EMAP_FILE_BYTES + 1)
                if len(payload) > MAX_EMAP_FILE_BYTES or len(payload) != member.size:
                    raise ValueError(f"EMap file has an unsafe or inconsistent size: {member.name}")
                total_written += len(payload)
                if total_written > MAX_EMAP_GROUP_BYTES:
                    raise ValueError("EMap group exceeds the safe size limit")
                target.write_bytes(payload)
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
    map_id = validate_map_id(args.id or title_to_slug(args.title))
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
