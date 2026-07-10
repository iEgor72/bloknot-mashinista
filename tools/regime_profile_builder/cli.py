from __future__ import annotations

import argparse
import copy
import hashlib
import json
import sys
from pathlib import Path

from . import BUILDER_VERSION
from .pdf_io import PdfBuilderError, load_vector_pdf
from .pipeline import build_profile, inspect_document, load_config
from .review import ensure_safe_output, render_review_bundle, write_artifacts


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def _read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, payload) -> None:
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def _public_config(config: dict) -> dict:
    result = {
        key: value
        for key, value in config.items()
        if key not in {"pdf", "compare_seed", "config_path"}
    }
    result["pdf_file_name"] = Path(config["pdf"]).name
    if config.get("compare_seed"):
        result["compare_seed_file_name"] = Path(config["compare_seed"]).name
    return result


def _canonical_profile_digest(elements: list[dict]) -> str:
    normalized = [
        {
            "start_m": int(item["start_m"]),
            "len_m": int(item["len_m"]),
            "grad_permille": round(float(item["grad_permille"]), 4),
        }
        for item in elements
    ]
    raw = json.dumps(normalized, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def command_inspect(args) -> int:
    config = load_config(Path(args.config))
    document = load_vector_pdf(Path(config["pdf"]))
    inspection = inspect_document(document, config)
    output = ensure_safe_output(Path(args.out), REPOSITORY_ROOT)
    inspect_path = output / "inspect.json"
    if inspect_path.exists() and not args.force:
        raise PdfBuilderError(f"inspect artifact already exists; use --force: {inspect_path}")
    payload = {
        "schema_version": "1.0",
        "builder_version": BUILDER_VERSION,
        "config": _public_config(config),
        "source": {key: value for key, value in document.items() if key not in {"pages", "path"}},
        "inspection": inspection,
    }
    _write_json(inspect_path, payload)
    print(json.dumps({
        "source": payload["source"],
        "ready_pages": sum(item.get("status") == "ready" for item in inspection["pages"]),
        "blocked_pages": len(inspection["blocked"]),
        "output": str(inspect_path),
    }, ensure_ascii=False, indent=2))
    return 0 if not inspection["blocked"] else 1


def command_build(args) -> int:
    config = load_config(Path(args.config))
    result = build_profile(config)
    artifacts = write_artifacts(result, Path(args.out), REPOSITORY_ROOT, force=args.force)
    rendered = {"crops": [], "contact_sheet": None}
    if not args.no_render:
        rendered = render_review_bundle(result, Path(args.out))
        _write_json(Path(args.out).resolve() / "review-render.json", rendered)
    print(json.dumps({
        "summary": result["summary"],
        "artifacts": artifacts,
        "review_render": rendered,
    }, ensure_ascii=False, indent=2))
    return 0 if result["summary"]["blocked_issues"] == 0 else 1


def _validate_continuity(elements: list[dict], range_start: int, range_end: int) -> list[str]:
    errors: list[str] = []
    cursor = range_start
    for index, element in enumerate(elements):
        start = int(element["start_m"])
        length = int(element["len_m"])
        end = start + length
        if length <= 0:
            errors.append(f"element {index} has non-positive length")
        if start != cursor:
            errors.append(f"element {index} starts at {start}, expected {cursor}")
        cursor = max(cursor, end)
    if cursor != range_end:
        errors.append(f"profile ends at {cursor}, expected {range_end}")
    return errors


def command_check(args) -> int:
    run_dir = Path(args.run).resolve()
    run = _read_json(run_dir / "run.json")
    draft = _read_json(run_dir / "draft.profile.json")
    review = _read_json(run_dir / "review.json")
    elements = draft.get("elements") or []
    range_start = int(draft["range"]["start_m"])
    range_end = int(draft["range"]["end_m"])
    errors = _validate_continuity(elements, range_start, range_end)
    actual_digest = _canonical_profile_digest(elements)
    expected_digest = str(run["summary"].get("profile_sha256", ""))
    if actual_digest != expected_digest:
        errors.append(f"profile digest mismatch: {actual_digest} != {expected_digest}")
    issue_count = len(review.get("issues") or [])
    expected_issue_count = int(run["summary"].get("review_issues", 0)) + int(
        run["summary"].get("blocked_issues", 0)
    )
    if issue_count != expected_issue_count:
        errors.append(f"review issue count mismatch: {issue_count} != {expected_issue_count}")
    if args.require_clean and issue_count:
        errors.append(f"run still has {issue_count} review issues")
    payload = {
        "run": str(run_dir),
        "elements": len(elements),
        "issues": issue_count,
        "profile_sha256": actual_digest,
        "errors": errors,
        "ok": not errors,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


def command_apply_review(args) -> int:
    run_dir = Path(args.run).resolve()
    run = _read_json(run_dir / "run.json")
    draft = _read_json(run_dir / "draft.profile.json")
    review = _read_json(run_dir / "review.json")
    decisions = _read_json(Path(args.decisions))
    expected_sha = str(run["source"]["fingerprint"]["sha256"])
    if str(decisions.get("pdf_sha256", "")) != expected_sha:
        raise PdfBuilderError("decision PDF SHA-256 does not match the builder run")
    issues_by_id = {item["issue_id"]: item for item in review.get("issues") or []}
    elements = copy.deepcopy(draft.get("elements") or [])
    elements_by_start = {int(item["start_m"]): item for item in elements}
    resolved: list[str] = []
    deferred: list[str] = []
    for decision in decisions.get("decisions") or []:
        issue_id = str(decision.get("issue_id", ""))
        if issue_id not in issues_by_id:
            raise PdfBuilderError(f"unknown issue_id in decisions: {issue_id}")
        issue = issues_by_id[issue_id]
        action = str(decision.get("action", "defer"))
        if action == "defer":
            deferred.append(issue_id)
            continue
        start_m = int(issue.get("start_m") or 0)
        element = elements_by_start.get(start_m)
        if action == "accept_suggestion":
            if element and issue.get("suggested_grade") is not None:
                element["grad_permille"] = float(issue["suggested_grade"])
                element["confidence"] = "manual_reviewed"
            resolved.append(issue_id)
        elif action == "keep_seed":
            suggestion = issue.get("seed_suggestion") or {}
            if not element or suggestion.get("grad_permille") is None:
                raise PdfBuilderError(f"issue has no seed suggestion: {issue_id}")
            element["grad_permille"] = float(suggestion["grad_permille"])
            element["confidence"] = "manual_reviewed_legacy_fallback"
            resolved.append(issue_id)
        elif action == "set_grade":
            if not element or decision.get("grade_permille") is None:
                raise PdfBuilderError(f"set_grade requires an element and grade_permille: {issue_id}")
            element["grad_permille"] = float(decision["grade_permille"])
            element["confidence"] = "manual_reviewed"
            resolved.append(issue_id)
        elif action == "accept_geometry":
            if element:
                element["confidence"] = "manual_reviewed"
            resolved.append(issue_id)
        elif action == "insert_gap":
            gap_start = int(issue.get("after_m") or 0)
            gap_end = int(issue.get("next_m") or 0)
            if (
                not str(issue.get("kind", "")).startswith("profile_")
                or gap_end <= gap_start
                or decision.get("grade_permille") is None
            ):
                raise PdfBuilderError(
                    f"insert_gap requires a profile gap and grade_permille: {issue_id}"
                )
            if gap_start in elements_by_start:
                raise PdfBuilderError(f"an element already starts at gap coordinate: {gap_start}")
            inserted = {
                "start_m": gap_start,
                "len_m": gap_end - gap_start,
                "grad_permille": float(decision["grade_permille"]),
                "confidence": "manual_reviewed",
            }
            elements.append(inserted)
            elements.sort(key=lambda item: int(item["start_m"]))
            elements_by_start[gap_start] = inserted
            resolved.append(issue_id)
        else:
            raise PdfBuilderError(f"unsupported review action {action!r} for {issue_id}")
    output_path = Path(args.out).resolve() if args.out else run_dir / "reviewed.profile.json"
    ensure_safe_output(output_path.parent, REPOSITORY_ROOT)
    payload = copy.deepcopy(draft)
    payload["elements"] = elements
    payload["status"] = "builder_reviewed_draft_not_product_verified"
    payload["review_resolution"] = {
        "pdf_sha256": expected_sha,
        "resolved": resolved,
        "deferred": deferred,
        "remaining": sorted(set(issues_by_id) - set(resolved)),
    }
    _write_json(output_path, payload)
    print(json.dumps({
        "output": str(output_path),
        "resolved": len(resolved),
        "remaining": len(payload["review_resolution"]["remaining"]),
    }, ensure_ascii=False, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Build review-only railway profile drafts from vector regime-map PDFs."
    )
    parser.add_argument("--version", action="version", version=BUILDER_VERSION)
    subparsers = parser.add_subparsers(dest="command", required=True)

    inspect_parser = subparsers.add_parser("inspect", help="classify PDF pages and layouts")
    inspect_parser.add_argument("--config", required=True)
    inspect_parser.add_argument("--out", required=True)
    inspect_parser.add_argument("--force", action="store_true")
    inspect_parser.set_defaults(handler=command_inspect)

    build_parser_ = subparsers.add_parser("build", help="build draft profile and review artifacts")
    build_parser_.add_argument("--config", required=True)
    build_parser_.add_argument("--out", required=True)
    build_parser_.add_argument("--no-render", action="store_true")
    build_parser_.add_argument("--force", action="store_true")
    build_parser_.set_defaults(handler=command_build)

    check_parser = subparsers.add_parser("check", help="check an existing builder run")
    check_parser.add_argument("--run", required=True)
    check_parser.add_argument("--require-clean", action="store_true")
    check_parser.set_defaults(handler=command_check)

    review_parser = subparsers.add_parser("apply-review", help="apply manual decisions to a run artifact")
    review_parser.add_argument("--run", required=True)
    review_parser.add_argument("--decisions", required=True)
    review_parser.add_argument("--out")
    review_parser.set_defaults(handler=command_apply_review)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return int(args.handler(args))
    except (PdfBuilderError, ValueError, OSError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
