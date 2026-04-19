from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
MEMORY_DIR = REPO_ROOT / "ai-memory"
SESSIONS_DIR = MEMORY_DIR / "sessions"
LOCAL_CONFIG = REPO_ROOT / ".agent-memory.local.json"

READ_ORDER = (
    "START_HERE.md",
    "PROJECT_STATE.md",
    "ARCHITECTURE.md",
    "METHODS.md",
    "ENGINEERING_STYLE.md",
    "CHANGELOG.md",
    "WORKTREE_STATUS.md",
)

REQUIRED_FILES = (
    "START_HERE.md",
    "PROJECT_STATE.md",
    "ARCHITECTURE.md",
    "METHODS.md",
    "ENGINEERING_STYLE.md",
    "CHANGELOG.md",
    "WORKTREE_STATUS.md",
    "SESSION_PROTOCOL.md",
    "AGENT_CONTEXT.md",
    "RECENT_COMMITS.md",
    "INDEX.md",
)

PROJECT_STATE_AUTO_START = "<!-- AUTO_STATUS:START -->"
PROJECT_STATE_AUTO_END = "<!-- AUTO_STATUS:END -->"


@dataclass(frozen=True)
class SyncConfig:
    enabled: bool
    target_dir: Path | None
    reason: str = ""


def _now() -> datetime:
    return datetime.now().astimezone()


def _timestamp() -> str:
    return _now().strftime("%Y-%m-%d %H:%M:%S %z")


def _date_only() -> str:
    return _now().strftime("%Y-%m-%d")


def _run_git(*args: str) -> str:
    try:
        result = subprocess.run(
            ["git", "-c", "core.quotepath=off", *args],
            cwd=REPO_ROOT,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except Exception as exc:
        return f"<git error: {exc}>"

    output = (result.stdout or result.stderr or "").strip()
    return output if output else "<empty>"


def _read_text(path: Path, fallback: str = "") -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return fallback


def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def _template(file_name: str) -> str:
    title = file_name.rsplit(".", 1)[0].replace("_", " ").title()
    templates = {
        "START_HERE.md": (
            "# START HERE\n\n"
            "Перед любой работой, анализом, правками, тестами, деплоем или ответом по проекту:\n"
            "1. Запусти `python tools/agent_memory.py preflight`.\n"
            "2. Прочитай memory-файлы в порядке из `ai-memory/SESSION_PROTOCOL.md`.\n"
            "3. Только после этого приступай к задаче.\n"
        ),
        "PROJECT_STATE.md": (
            "# Project State\n\n"
            f"{PROJECT_STATE_AUTO_START}\n"
            "Generated: not yet refreshed\n"
            f"{PROJECT_STATE_AUTO_END}\n"
        ),
        "ARCHITECTURE.md": "# Architecture\n\n",
        "METHODS.md": "# Methods\n\n",
        "ENGINEERING_STYLE.md": "# Engineering Style\n\n",
        "CHANGELOG.md": "# Agent Changelog\n\n",
        "WORKTREE_STATUS.md": "# Worktree Status\n\n",
        "SESSION_PROTOCOL.md": "# Session Protocol\n\n",
        "AGENT_CONTEXT.md": "# Agent Context\n\n",
        "RECENT_COMMITS.md": "# Recent Commits\n\n",
        "INDEX.md": "# AI Memory Index\n\n",
    }
    return templates.get(file_name, f"# {title}\n\n")


def ensure_memory_structure() -> None:
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    for file_name in REQUIRED_FILES:
        path = MEMORY_DIR / file_name
        if not path.exists():
            _write_text(path, _template(file_name))


def _load_sync_config() -> SyncConfig:
    if not LOCAL_CONFIG.exists():
        return SyncConfig(False, None, "config-missing")

    try:
        data = json.loads(LOCAL_CONFIG.read_text(encoding="utf-8"))
    except Exception as exc:
        return SyncConfig(False, None, f"config-invalid: {exc}")

    if not isinstance(data, dict):
        return SyncConfig(False, None, "config-invalid")
    if data.get("enabled") is False:
        return SyncConfig(False, None, "config-disabled")

    if isinstance(data.get("vaultPath"), str):
        vault_path = Path(data["vaultPath"]).expanduser()
        project_folder = str(data.get("projectFolder") or Path("Projects") / REPO_ROOT.name)
        target_dir = vault_path / project_folder
    elif isinstance(data.get("vault_root"), str):
        vault_path = Path(data["vault_root"]).expanduser()
        project_name = str(data.get("project_name") or REPO_ROOT.name)
        target_dir = vault_path / "Projects" / project_name
    else:
        return SyncConfig(False, None, "vault-not-configured")

    return SyncConfig(True, target_dir.resolve(), "")


def _copy_tree(source_dir: Path, target_dir: Path) -> None:
    if not source_dir.exists():
        return
    target_dir.mkdir(parents=True, exist_ok=True)
    for file_path in source_dir.rglob("*"):
        if not file_path.is_file():
            continue
        relative = file_path.relative_to(source_dir)
        destination = target_dir / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file_path, destination)


def sync_to_vault() -> SyncConfig:
    config = _load_sync_config()
    if not config.enabled or config.target_dir is None:
        return config
    _copy_tree(MEMORY_DIR, config.target_dir)
    return config


def sync_from_vault() -> SyncConfig:
    config = _load_sync_config()
    if not config.enabled or config.target_dir is None:
        return config
    if not config.target_dir.exists():
        return SyncConfig(False, config.target_dir, "vault-project-not-found")
    _copy_tree(config.target_dir, MEMORY_DIR)
    return config


def _replace_auto_block(text: str, block: str) -> str:
    start = text.find(PROJECT_STATE_AUTO_START)
    end = text.find(PROJECT_STATE_AUTO_END)
    if start == -1 or end == -1 or end < start:
        return text.rstrip() + "\n\n" + block + "\n"
    end += len(PROJECT_STATE_AUTO_END)
    return text[:start] + block + text[end:]


def _project_state_auto_block() -> str:
    status_short = _run_git("status", "--short")
    if status_short == "<empty>":
        status_short = "clean"

    return "\n".join(
        [
            PROJECT_STATE_AUTO_START,
            f"Generated: {_timestamp()}",
            "",
            "## Repository Snapshot",
            f"- Local repo path: `{REPO_ROOT}`",
            f"- Project memory path: `{MEMORY_DIR}`",
            f"- Branch: `{_run_git('branch', '--show-current')}`",
            f"- HEAD: `{_run_git('rev-parse', '--short', 'HEAD')}`",
            f"- Last commit: `{_run_git('log', '-1', '--pretty=format:%h %s')}`",
            "",
            "## Git Remote",
            "```text",
            _run_git("remote", "-v"),
            "```",
            "",
            "## Branch Tracking",
            "```text",
            _run_git("branch", "-vv"),
            "```",
            "",
            "## Worktree",
            "```text",
            status_short,
            "```",
            PROJECT_STATE_AUTO_END,
        ]
    )


def _refresh_project_state() -> None:
    path = MEMORY_DIR / "PROJECT_STATE.md"
    text = _read_text(path, _template("PROJECT_STATE.md"))
    _write_text(path, _replace_auto_block(text, _project_state_auto_block()))


def _refresh_worktree_status() -> None:
    content = "\n".join(
        [
            "# Worktree Status",
            "",
            f"Generated: {_timestamp()}",
            "",
            "## git status -sb",
            "```text",
            _run_git("status", "-sb"),
            "```",
            "",
            "## git branch -vv",
            "```text",
            _run_git("branch", "-vv"),
            "```",
            "",
            "## HEAD",
            "```text",
            _run_git("log", "-1", "--stat", "--oneline"),
            "```",
        ]
    )
    _write_text(MEMORY_DIR / "WORKTREE_STATUS.md", content)


def _refresh_recent_commits(limit: int = 40) -> None:
    raw = _run_git("log", "-n", str(limit), "--date=iso-strict", "--pretty=format:%h%x09%ad%x09%an%x09%s")
    lines = [
        "# Recent Commits",
        "",
        f"Generated: {_timestamp()}",
        "",
        "| Hash | Date | Author | Message |",
        "| --- | --- | --- | --- |",
    ]
    if raw == "<empty>":
        lines.append("| - | - | - | No commits found |")
    else:
        for row in raw.splitlines():
            parts = row.split("\t", 3)
            if len(parts) != 4:
                continue
            commit_hash, date, author, message = parts
            safe_message = message.replace("|", "\\|")
            safe_author = author.replace("|", "\\|")
            lines.append(f"| `{commit_hash}` | {date} | {safe_author} | {safe_message} |")
    _write_text(MEMORY_DIR / "RECENT_COMMITS.md", "\n".join(lines))


def _refresh_index() -> None:
    lines = [
        "# AI Memory Index",
        "",
        f"Updated: {_timestamp()}",
        "",
    ]
    for file_name in REQUIRED_FILES:
        lines.append(f"- [{file_name}]({file_name})")
    lines.append("- [sessions/](sessions/)")
    _write_text(MEMORY_DIR / "INDEX.md", "\n".join(lines))


def refresh_memory() -> SyncConfig:
    ensure_memory_structure()
    _refresh_project_state()
    _refresh_worktree_status()
    _refresh_recent_commits()
    _refresh_index()
    return sync_to_vault()


def _split_list(value: str) -> list[str]:
    result: list[str] = []
    for chunk in value.replace(";", ",").replace("\n", ",").split(","):
        item = chunk.strip()
        if item and item not in result:
            result.append(item)
    return result


def _changed_files_for_commit(commit_hash: str) -> list[str]:
    if not commit_hash:
        return []
    raw = _run_git("show", "--name-only", "--pretty=format:", commit_hash)
    if raw == "<empty>":
        return []
    return [line.strip() for line in raw.splitlines() if line.strip()]


def append_log_entry(args: argparse.Namespace) -> SyncConfig:
    ensure_memory_structure()
    branch = _run_git("branch", "--show-current")
    heading = f"## {_timestamp()}"
    lines = [
        heading,
        "",
        f"- Source: `{args.source}`",
        f"- Task: {args.task.strip()}",
        f"- Branch: `{branch}`",
    ]

    methods = _split_list(args.methods)
    if methods:
        lines.append("- Methods: " + ", ".join(f"`{item}`" for item in methods))

    files = _split_list(args.files)
    if files:
        lines.append("- Files: " + ", ".join(f"`{item}`" for item in files))
    else:
        lines.append("- Files: _not specified_")

    notes = []
    if args.why.strip():
        notes.append(f"Why: {args.why.strip()}")
    if args.risks.strip():
        notes.append(f"Risks: {args.risks.strip()}")
    if args.check.strip():
        notes.append(f"Check: {args.check.strip()}")
    if args.notes.strip():
        notes.append(args.notes.strip())
    if notes:
        lines.append("- Notes: " + " | ".join(notes))

    changelog = MEMORY_DIR / "CHANGELOG.md"
    current = _read_text(changelog, _template("CHANGELOG.md"))
    separator = "\n\n" if current.strip() else ""
    _write_text(changelog, current.rstrip() + separator + "\n".join(lines))

    session_path = SESSIONS_DIR / f"{_date_only()}.md"
    session_current = _read_text(session_path, f"# Session {_date_only()}\n\n")
    method_text = ", ".join(methods) if methods else "n/a"
    file_text = ", ".join(files) if files else "none"
    session_line = f"- {_now().strftime('%H:%M:%S')} | source={args.source} | task={args.task.strip()} | files={file_text} | methods={method_text}"
    _write_text(session_path, session_current.rstrip() + "\n" + session_line)

    return sync_to_vault()


def _append_log_entry(
    *,
    task: str,
    methods: str = "",
    files: str = "",
    why: str = "",
    risks: str = "",
    check: str = "",
    notes: str = "",
    source: str = "manual",
    dedupe_token: str = "",
) -> bool:
    ensure_memory_structure()
    changelog = MEMORY_DIR / "CHANGELOG.md"
    current = _read_text(changelog, _template("CHANGELOG.md"))
    if dedupe_token and dedupe_token in current:
        return False

    namespace = argparse.Namespace(
        task=task,
        methods=methods,
        files=files,
        why=why,
        risks=risks,
        check=check,
        notes=notes,
        source=source,
    )
    append_log_entry(namespace)
    return True


def install_post_commit_hook() -> tuple[bool, str]:
    hooks_dir = REPO_ROOT / ".git" / "hooks"
    if not hooks_dir.exists():
        return False, "git-hooks-dir-not-found"

    hook_path = hooks_dir / "post-commit"
    marker_start = "# >>> agent-memory >>>"
    marker_end = "# <<< agent-memory <<<"
    repo_root_var = "$" + "REPO_ROOT"
    snippet = "\n".join(
        [
            marker_start,
            'REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"',
            f'if [ -n "{repo_root_var}" ]; then',
            f'  python "{repo_root_var}/tools/agent_memory.py" post-commit >/dev/null 2>&1 || true',
            "fi",
            marker_end,
            "",
        ]
    )

    current = _read_text(hook_path, "#!/bin/sh\n")
    if marker_start in current and marker_end in current:
        before = current.split(marker_start, 1)[0].rstrip()
        after = current.split(marker_end, 1)[1].lstrip()
        updated = before + "\n\n" + snippet + after
    else:
        updated = current.rstrip() + "\n\n" + snippet

    _write_text(hook_path, updated)
    return True, str(hook_path)


def cmd_preflight(_: argparse.Namespace) -> int:
    ensure_memory_structure()
    config = _load_sync_config()

    print("[memory] preflight complete")
    print(f"[memory] local repo path: {REPO_ROOT}")
    print(f"[memory] project memory path: {MEMORY_DIR}")
    if config.enabled and config.target_dir is not None:
        print(f"[memory] Obsidian/Codex vault memory path: {config.target_dir}")
    else:
        print(f"[memory] Obsidian/Codex sync: skipped ({config.reason})")
    print("[memory] read order:")
    for file_name in READ_ORDER:
        print(f"- ai-memory/{file_name}")
    print("[memory] WARNING: сначала память, потом работа. Do not analyze, edit, test, deploy, or answer before reading these files.")
    return 0


def cmd_init(_: argparse.Namespace) -> int:
    ensure_memory_structure()
    installed, detail = install_post_commit_hook()
    result = refresh_memory()
    _append_log_entry(
        task="[memory-init] Bootstrap/refresh Python project memory workflow",
        methods="memory structure ensure, refresh, post-commit hook install",
        files="ai-memory,tools/agent_memory.py,.git/hooks/post-commit",
        source="init",
        dedupe_token="[memory-init] Bootstrap/refresh Python project memory workflow",
    )
    print("[memory] init completed")
    print(f"[memory] post-commit hook: {'installed/updated' if installed else 'skipped'} ({detail})")
    if result.enabled and result.target_dir is not None:
        print(f"[memory] synced to Obsidian/Codex vault: {result.target_dir}")
    else:
        print(f"[memory] sync skipped: {result.reason}")
    return 0


def cmd_install_hooks(_: argparse.Namespace) -> int:
    installed, detail = install_post_commit_hook()
    print(f"[memory] post-commit hook: {'installed/updated' if installed else 'skipped'} ({detail})")
    return 0


def cmd_post_commit(_: argparse.Namespace) -> int:
    ensure_memory_structure()
    commit_hash = _run_git("rev-parse", "HEAD")
    short_hash = _run_git("rev-parse", "--short", "HEAD")
    subject = _run_git("log", "-1", "--pretty=format:%s")
    author = _run_git("log", "-1", "--pretty=format:%an")
    files = ",".join(_changed_files_for_commit(commit_hash))
    token = f"Commit: `{commit_hash}`"

    appended = _append_log_entry(
        task=subject if subject != "<empty>" else "Commit created",
        methods="git post-commit hook, automatic memory update",
        files=files,
        notes=f"Commit: `{commit_hash}` (`{short_hash}`) | Author: `{author}`",
        source="post-commit",
        dedupe_token=token,
    )
    refresh_memory()
    print("[memory] post-commit log " + ("appended" if appended else "already present"))
    return 0


def cmd_refresh(_: argparse.Namespace) -> int:
    result = refresh_memory()
    print("[memory] refreshed project memory")
    if result.enabled and result.target_dir is not None:
        print(f"[memory] synced to Obsidian/Codex vault: {result.target_dir}")
    else:
        print(f"[memory] sync skipped: {result.reason}")
    return 0


def cmd_log(args: argparse.Namespace) -> int:
    result = append_log_entry(args)
    print("[memory] log entry appended")
    if result.enabled and result.target_dir is not None:
        print(f"[memory] synced to Obsidian/Codex vault: {result.target_dir}")
    else:
        print(f"[memory] sync skipped: {result.reason}")
    return 0


def cmd_sync(args: argparse.Namespace) -> int:
    ensure_memory_structure()
    if args.direction == "pull":
        result = sync_from_vault()
        action = "pulled from"
    else:
        result = sync_to_vault()
        action = "pushed to"

    if result.enabled and result.target_dir is not None:
        print(f"[memory] {action} Obsidian/Codex vault: {result.target_dir}")
    else:
        print(f"[memory] sync skipped: {result.reason}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Project memory workflow for Codex agents.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    init = subparsers.add_parser("init", help="Ensure memory structure, refresh, sync, and install hooks.")
    init.set_defaults(func=cmd_init)

    preflight = subparsers.add_parser("preflight", help="Print mandatory memory read order.")
    preflight.set_defaults(func=cmd_preflight)

    refresh = subparsers.add_parser("refresh", help="Refresh generated memory snapshots and sync.")
    refresh.set_defaults(func=cmd_refresh)

    log = subparsers.add_parser("log", help="Append a structured memory entry.")
    log.add_argument("--task", required=True, help="What was done.")
    log.add_argument("--methods", default="", help="How it was done.")
    log.add_argument("--files", default="", help="Changed files.")
    log.add_argument("--why", default="", help="Why this approach was chosen.")
    log.add_argument("--risks", default="", help="Known risks.")
    log.add_argument("--check", default="", help="What should be verified.")
    log.add_argument("--notes", default="", help="Additional notes.")
    log.add_argument("--source", default="manual", help="Log source.")
    log.set_defaults(func=cmd_log)

    sync = subparsers.add_parser("sync", help="Sync memory with Obsidian/Codex vault.")
    sync.add_argument("--direction", choices=("push", "pull"), default="push")
    sync.set_defaults(func=cmd_sync)

    install_hooks = subparsers.add_parser("install-hooks", help="Install/update the post-commit memory hook.")
    install_hooks.set_defaults(func=cmd_install_hooks)

    post_commit = subparsers.add_parser("post-commit", help=argparse.SUPPRESS)
    post_commit.set_defaults(func=cmd_post_commit)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
