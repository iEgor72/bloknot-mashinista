from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
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
    try:
        serialized = json.dumps(
            payload,
            ensure_ascii=False,
            indent=2,
            allow_nan=False,
        )
    except (TypeError, ValueError) as error:
        raise PdfBuilderError(
            f"refusing to write non-JSON or non-finite data to {path.name}"
        ) from error
    temporary.write_text(serialized + "\n", encoding="utf-8")
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


def _is_finite_number(value: object) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(float(value))
    )


def _profile_element_errors(elements: object, context: str = "profile") -> list[str]:
    if not isinstance(elements, list):
        return [f"{context} elements must be an array"]
    errors: list[str] = []
    for index, item in enumerate(elements):
        if not isinstance(item, dict):
            errors.append(f"{context} element {index} must be an object")
            continue
        for field in ("start_m", "len_m"):
            value = item.get(field)
            if not _is_finite_number(value) or not float(value).is_integer():
                errors.append(
                    f"{context} element {index} {field} must be a finite integer"
                )
        grade = item.get("grad_permille")
        if not _is_finite_number(grade):
            errors.append(
                f"{context} element {index} grad_permille must be finite"
            )
    return errors


def _require_valid_profile_elements(elements: object, context: str) -> list[dict]:
    errors = _profile_element_errors(elements, context)
    if errors:
        raise PdfBuilderError("; ".join(errors))
    return elements


def _profile_metadata_errors(profile: dict, context: str) -> list[str]:
    errors: list[str] = []
    profile_range = profile.get("range")
    if not (
        isinstance(profile_range, dict)
        and _is_finite_number(profile_range.get("start_m"))
        and float(profile_range["start_m"]).is_integer()
        and _is_finite_number(profile_range.get("end_m"))
        and float(profile_range["end_m"]).is_integer()
        and int(profile_range["end_m"]) > int(profile_range["start_m"])
    ):
        errors.append(f"{context} range must contain finite increasing integers")
    raw_gaps = profile.get("allowed_profile_gaps", [])
    gaps = [] if raw_gaps is None else raw_gaps
    if not isinstance(gaps, list):
        errors.append(f"{context} allowed_profile_gaps must be an array")
        return errors
    for index, gap in enumerate(gaps):
        if not isinstance(gap, dict):
            errors.append(f"{context} allowed gap {index} must be an object")
            continue
        start_m = gap.get("start_m")
        end_m = gap.get("end_m")
        if not (
            _is_finite_number(start_m)
            and float(start_m).is_integer()
            and _is_finite_number(end_m)
            and float(end_m).is_integer()
            and int(end_m) > int(start_m)
        ):
            errors.append(
                f"{context} allowed gap {index} must contain finite increasing integers"
            )
    return errors


def _canonical_profile_digest(elements: list[dict], *, include_confidence: bool = False) -> str:
    _require_valid_profile_elements(elements, "profile digest")
    normalized = [
        {
            "start_m": int(item["start_m"]),
            "len_m": int(item["len_m"]),
            "grad_permille": round(float(item["grad_permille"]), 4),
            **({"confidence": str(item.get("confidence", ""))} if include_confidence else {}),
        }
        for item in elements
    ]
    raw = json.dumps(normalized, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _draft_integrity(
    run: dict,
    draft: dict,
) -> tuple[list[str], str | None, str | None]:
    elements = draft.get("elements")
    errors = _profile_element_errors(elements, "draft profile")
    errors.extend(_profile_metadata_errors(draft, "draft profile"))
    if errors:
        return errors, None, None
    numeric_digest = _canonical_profile_digest(elements)
    confidence_digest = _canonical_profile_digest(
        elements,
        include_confidence=True,
    )
    summary = run.get("summary") or {}
    expected_numeric = str(summary.get("profile_sha256", ""))
    expected_confidence = str(summary.get("profile_with_confidence_sha256", ""))
    if not expected_numeric:
        errors.append("run summary profile_sha256 is missing")
    elif numeric_digest != expected_numeric:
        errors.append(
            f"draft profile digest mismatch: {numeric_digest} != {expected_numeric}"
        )
    if not expected_confidence:
        errors.append("run summary profile_with_confidence_sha256 is missing")
    elif confidence_digest != expected_confidence:
        errors.append(
            "draft profile confidence digest mismatch: "
            f"{confidence_digest} != {expected_confidence}"
        )
    return errors, numeric_digest, confidence_digest


def _require_current_draft(run: dict, draft: dict) -> tuple[str, str]:
    errors, numeric_digest, confidence_digest = _draft_integrity(run, draft)
    if errors or numeric_digest is None or confidence_digest is None:
        raise PdfBuilderError("; ".join(errors or ["draft profile integrity is invalid"]))
    return numeric_digest, confidence_digest


def _review_binding_errors(
    run: dict,
    draft: dict,
    reviewed: dict,
    resolution: dict,
    draft_numeric_digest: str | None,
    draft_confidence_digest: str | None,
) -> list[str]:
    errors: list[str] = []
    expected_pdf_sha = str(
        ((run.get("source") or {}).get("fingerprint") or {}).get("sha256", "")
    )
    if not expected_pdf_sha:
        errors.append("run PDF SHA-256 is missing")
    elif str(resolution.get("pdf_sha256", "")) != expected_pdf_sha:
        errors.append("reviewed profile PDF SHA-256 does not match the builder run")
    if (
        draft_numeric_digest is None
        or str(resolution.get("base_profile_sha256", ""))
        != draft_numeric_digest
    ):
        errors.append("reviewed profile is not bound to the current draft profile digest")
    if (
        draft_confidence_digest is None
        or str(resolution.get("base_profile_with_confidence_sha256", ""))
        != draft_confidence_digest
    ):
        errors.append(
            "reviewed profile is not bound to the current draft confidence digest"
        )
    if reviewed.get("range") != draft.get("range"):
        errors.append("reviewed profile range does not match the current draft")
    if (reviewed.get("allowed_profile_gaps") or []) != (
        draft.get("allowed_profile_gaps") or []
    ):
        errors.append("reviewed profile allowed gaps do not match the current draft")
    return errors


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


def _validate_continuity(
    elements: list[dict],
    range_start: int,
    range_end: int,
    allowed_gaps: list[dict] | None = None,
) -> list[str]:
    errors: list[str] = []
    allowed = {
        (int(item["start_m"]), int(item["end_m"]))
        for item in allowed_gaps or []
    }
    observed: set[tuple[int, int]] = set()
    cursor = range_start
    for index, element in enumerate(elements):
        start = int(element["start_m"])
        length = int(element["len_m"])
        end = start + length
        if length <= 0:
            errors.append(f"element {index} has non-positive length")
        if start != cursor:
            gap = (cursor, start)
            if start > cursor and gap in allowed:
                observed.add(gap)
            else:
                errors.append(f"element {index} starts at {start}, expected {cursor}")
        cursor = max(cursor, end)
    if cursor != range_end:
        gap = (cursor, range_end)
        if cursor < range_end and gap in allowed:
            observed.add(gap)
        else:
            errors.append(f"profile ends at {cursor}, expected {range_end}")
    unused = sorted(allowed - observed)
    if unused:
        errors.append(f"declared profile gaps were not observed: {unused}")
    return errors


def _actual_profile_ranges(
    elements: list[dict],
    range_start: int,
    range_end: int,
    allowed_gaps: list[dict] | None = None,
) -> tuple[list[dict], list[dict]]:
    reasons = {
        (int(item["start_m"]), int(item["end_m"])): str(item.get("reason", ""))
        for item in allowed_gaps or []
    }
    coverage: list[dict] = []
    gaps: list[dict] = []
    cursor = range_start
    for element in elements:
        start_m = int(element["start_m"])
        end_m = start_m + int(element["len_m"])
        if start_m > cursor:
            gap = {"start_m": cursor, "end_m": start_m}
            if reasons.get((cursor, start_m)):
                gap["reason"] = reasons[(cursor, start_m)]
            gaps.append(gap)
        if coverage and start_m == int(coverage[-1]["end_m"]):
            coverage[-1]["end_m"] = end_m
        else:
            coverage.append({"start_m": start_m, "end_m": end_m})
        cursor = max(cursor, end_m)
    if cursor < range_end:
        gap = {"start_m": cursor, "end_m": range_end}
        if reasons.get((cursor, range_end)):
            gap["reason"] = reasons[(cursor, range_end)]
        gaps.append(gap)
    return coverage, gaps


def command_check(args) -> int:
    run_dir = Path(args.run).resolve()
    run = _read_json(run_dir / "run.json")
    draft = _read_json(run_dir / "draft.profile.json")
    review = _read_json(run_dir / "review.json")
    reviewed_path = run_dir / "reviewed.profile.json"
    has_reviewed_profile = reviewed_path.is_file()
    profile = _read_json(reviewed_path) if has_reviewed_profile else draft
    elements = profile.get("elements")
    errors, draft_numeric_digest, draft_confidence_digest = _draft_integrity(
        run,
        draft,
    )
    raw_resolution = profile.get("review_resolution") if has_reviewed_profile else None
    resolution = raw_resolution if isinstance(raw_resolution, dict) else {}
    if has_reviewed_profile:
        if not isinstance(raw_resolution, dict):
            errors.append("reviewed profile review_resolution must be an object")
        errors.extend(
            _review_binding_errors(
                run,
                draft,
                profile,
                resolution,
                draft_numeric_digest,
                draft_confidence_digest,
            )
        )
    profile_errors = _profile_element_errors(elements, "checked profile")
    errors.extend(profile_errors)
    metadata_errors = _profile_metadata_errors(profile, "checked profile")
    errors.extend(metadata_errors)
    actual_digest = None
    actual_confidence_digest = None
    profile_range = profile.get("range")
    if not profile_errors and not metadata_errors:
        range_start = int(profile_range["start_m"])
        range_end = int(profile_range["end_m"])
        errors.extend(
            _validate_continuity(
                elements,
                range_start,
                range_end,
                profile.get("allowed_profile_gaps"),
            )
        )
        actual_digest = _canonical_profile_digest(elements)
        actual_confidence_digest = _canonical_profile_digest(
            elements,
            include_confidence=True,
        )
        expected_digest = str(
            resolution.get("profile_sha256")
            or (run.get("summary") or {}).get("profile_sha256", "")
        )
        if actual_digest != expected_digest:
            errors.append(
                f"profile digest mismatch: {actual_digest} != {expected_digest}"
            )
    all_issue_ids = {str(item["issue_id"]) for item in review.get("issues") or []}
    if has_reviewed_profile:
        expected_confidence_digest = str(
            resolution.get("profile_with_confidence_sha256", "")
        )
        if (
            actual_confidence_digest is not None
            and actual_confidence_digest != expected_confidence_digest
        ):
            errors.append(
                "profile confidence digest mismatch: "
                f"{actual_confidence_digest} != {expected_confidence_digest}"
            )
        remaining_ids = {str(value) for value in resolution.get("remaining") or []}
        resolved_ids = {str(value) for value in resolution.get("resolved") or []}
        unknown_ids = (remaining_ids | resolved_ids) - all_issue_ids
        if unknown_ids:
            errors.append(f"review resolution contains unknown issues: {sorted(unknown_ids)}")
        if remaining_ids | resolved_ids != all_issue_ids:
            errors.append("review resolution does not account for every run issue")
        issue_count = len(remaining_ids)
    else:
        issue_count = len(all_issue_ids)
    expected_issue_count = int(run["summary"].get("review_issues", 0)) + int(
        run["summary"].get("blocked_issues", 0)
    )
    if len(all_issue_ids) != expected_issue_count:
        errors.append(f"review issue count mismatch: {len(all_issue_ids)} != {expected_issue_count}")
    if args.require_clean and issue_count:
        errors.append(f"run still has {issue_count} review issues")
    payload = {
        "run": str(run_dir),
        "profile": str(reviewed_path if reviewed_path.is_file() else run_dir / "draft.profile.json"),
        "elements": len(elements) if isinstance(elements, list) else 0,
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
    base_profile_sha256, base_profile_with_confidence_sha256 = (
        _require_current_draft(run, draft)
    )
    expected_sha = str(run["source"]["fingerprint"]["sha256"])
    decision_paths = (
        [Path(value) for value in args.decisions]
        if isinstance(args.decisions, (list, tuple))
        else [Path(args.decisions)]
    )
    decision_items: list[dict] = []
    decision_files: list[str] = []
    seen_decision_ids: set[str] = set()
    for decision_path in decision_paths:
        payload = _read_json(decision_path)
        if str(payload.get("pdf_sha256", "")) != expected_sha:
            raise PdfBuilderError(
                f"decision PDF SHA-256 does not match the builder run: {decision_path.name}"
            )
        decision_files.append(decision_path.name)
        for decision in payload.get("decisions") or []:
            issue_id = str(decision.get("issue_id", ""))
            if issue_id in seen_decision_ids:
                raise PdfBuilderError(f"duplicate issue_id across decision files: {issue_id}")
            seen_decision_ids.add(issue_id)
            decision_items.append(decision)
    issues_by_id = {item["issue_id"]: item for item in review.get("issues") or []}
    elements = copy.deepcopy(draft.get("elements") or [])
    elements_by_start = {int(item["start_m"]): item for item in elements}
    resolved: list[str] = []
    deferred: list[str] = []
    for decision in decision_items:
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
            if not element or issue.get("suggested_grade") is None:
                raise PdfBuilderError(f"issue has no applicable suggestion: {issue_id}")
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
        elif action in {"set_grade", "set_grade_from_legacy"}:
            if not element or decision.get("grade_permille") is None:
                raise PdfBuilderError(
                    f"{action} requires an element and grade_permille: {issue_id}"
                )
            element["grad_permille"] = float(decision["grade_permille"])
            element["confidence"] = (
                "manual_reviewed_legacy_fallback"
                if action == "set_grade_from_legacy"
                else "manual_reviewed"
            )
            resolved.append(issue_id)
        elif action == "accept_geometry":
            if not element:
                raise PdfBuilderError(f"issue has no profile element geometry: {issue_id}")
            element["confidence"] = "manual_reviewed"
            resolved.append(issue_id)
        elif action == "dismiss_unmatched_pdf_cell":
            if str(issue.get("kind", "")) != "unmatched_pdf_cell_during_seed_reconciliation":
                raise PdfBuilderError(f"issue is not an unmatched PDF cell: {issue_id}")
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
    _require_valid_profile_elements(elements, "reviewed profile")
    output_path = Path(args.out).resolve() if args.out else run_dir / "reviewed.profile.json"
    ensure_safe_output(output_path.parent, REPOSITORY_ROOT)
    payload = copy.deepcopy(draft)
    payload["elements"] = elements
    payload["status"] = "builder_reviewed_draft_not_product_verified"
    payload["review_resolution"] = {
        "pdf_sha256": expected_sha,
        "decision_files": decision_files,
        "resolved": resolved,
        "deferred": deferred,
        "remaining": sorted(set(issues_by_id) - set(resolved)),
        "base_profile_sha256": base_profile_sha256,
        "base_profile_with_confidence_sha256": (
            base_profile_with_confidence_sha256
        ),
    }
    payload["review_resolution"]["profile_sha256"] = _canonical_profile_digest(elements)
    payload["review_resolution"]["profile_with_confidence_sha256"] = (
        _canonical_profile_digest(elements, include_confidence=True)
    )
    _write_json(output_path, payload)
    print(json.dumps({
        "output": str(output_path),
        "resolved": len(resolved),
        "remaining": len(payload["review_resolution"]["remaining"]),
    }, ensure_ascii=False, indent=2))
    return 0


OBSOLETE_LEGACY_PROFILE_FLAG = (
    "Знаки и границы уклонов пока мигрированы из profile.xml, "
    "а не сверены по границам элементов PDF"
)
RESOLVED_PROFILE_FLAG_PREFIXES = (
    "Физический профиль извлечён из PDF;",
    "Профиль повторно извлечён из ориентированных pts чёрной векторной трассы PDF;",
    "ненулевой уклон, но высоты профиля на границах почти равны",
    "В legacy profile.xml отсутствует подтверждённый элемент",
)


def _is_resolved_profile_flag(item: object) -> bool:
    reason = str((item or {}).get("reason", "")) if isinstance(item, dict) else ""
    return reason == OBSOLETE_LEGACY_PROFILE_FLAG or any(
        reason.startswith(prefix) for prefix in RESOLVED_PROFILE_FLAG_PREFIXES
    )


def _validate_promotion_target(section_path: Path, output_path: Path) -> None:
    product_dir = (REPOSITORY_ROOT / "assets" / "tracker" / "sections").resolve()
    try:
        relative_section = section_path.relative_to(product_dir)
    except ValueError as error:
        raise PdfBuilderError(
            f"promotion source must be a product section JSON inside {product_dir}"
        ) from error
    if section_path.suffix.lower() != ".json" or len(relative_section.parts) != 1:
        raise PdfBuilderError("promotion source must be one top-level product section JSON")
    if output_path != section_path:
        raise PdfBuilderError(
            "promotion must replace the selected product section in place; "
            "builder artifacts belong outside assets/tracker/sections"
        )


def _promoted_profile_status(elements: list[dict]) -> tuple[str, int]:
    legacy_fallback_count = sum(
        item.get("confidence") == "manual_reviewed_legacy_fallback"
        for item in elements
    )
    if legacy_fallback_count:
        return f"pdf_profile_audited_{legacy_fallback_count}_legacy_magnitudes", legacy_fallback_count
    return "pdf_verified", 0


def command_promote(args) -> int:
    run_dir = Path(args.run).resolve()
    reviewed_path = run_dir / "reviewed.profile.json"
    if not reviewed_path.is_file():
        raise PdfBuilderError("reviewed.profile.json is required before promotion")
    run = _read_json(run_dir / "run.json")
    draft_path = run_dir / "draft.profile.json"
    if not draft_path.is_file():
        raise PdfBuilderError("draft.profile.json is required before promotion")
    draft = _read_json(draft_path)
    draft_numeric_digest, draft_confidence_digest = _require_current_draft(
        run,
        draft,
    )
    reviewed = _read_json(reviewed_path)
    resolution = reviewed.get("review_resolution")
    if not isinstance(resolution, dict):
        raise PdfBuilderError("reviewed profile review_resolution must be an object")
    binding_errors = _review_binding_errors(
        run,
        draft,
        reviewed,
        resolution,
        draft_numeric_digest,
        draft_confidence_digest,
    )
    if binding_errors:
        raise PdfBuilderError("; ".join(binding_errors))
    fingerprint = run["source"]["fingerprint"]
    if resolution.get("remaining"):
        raise PdfBuilderError("reviewed profile still has unresolved issues")
    review_path = run_dir / "review.json"
    if not review_path.is_file():
        raise PdfBuilderError("review.json is required before promotion")
    review = _read_json(review_path)
    issue_ids = {str(item["issue_id"]) for item in review.get("issues") or []}
    resolved = [str(value) for value in resolution.get("resolved") or []]
    if len(resolved) != len(set(resolved)) or set(resolved) != issue_ids:
        raise PdfBuilderError("review resolution does not account for every run issue exactly once")
    elements = _require_valid_profile_elements(
        reviewed.get("elements"),
        "reviewed profile",
    )
    expected_digest = str(resolution.get("profile_sha256", ""))
    actual_digest = _canonical_profile_digest(elements)
    if not expected_digest or actual_digest != expected_digest:
        raise PdfBuilderError("reviewed profile digest is missing or invalid")
    expected_confidence_digest = str(
        resolution.get("profile_with_confidence_sha256", "")
    )
    actual_confidence_digest = _canonical_profile_digest(
        elements,
        include_confidence=True,
    )
    if not expected_confidence_digest or actual_confidence_digest != expected_confidence_digest:
        raise PdfBuilderError("reviewed profile confidence digest is missing or invalid")

    section_path = Path(args.section).resolve()
    output_path = Path(args.out).resolve()
    _validate_promotion_target(section_path, output_path)
    section = _read_json(section_path)
    range_start = int(reviewed["range"]["start_m"])
    range_end = int(reviewed["range"]["end_m"])
    if (
        int(round(float(section.get("km_start")) * 1000)) != range_start
        or int(round(float(section.get("km_end")) * 1000)) != range_end
    ):
        raise PdfBuilderError("reviewed profile range does not match the product section")
    allowed_profile_gaps = reviewed.get("allowed_profile_gaps") or []
    continuity_errors = _validate_continuity(
        elements,
        range_start,
        range_end,
        allowed_profile_gaps,
    )
    if continuity_errors:
        raise PdfBuilderError("reviewed profile is not continuous: " + "; ".join(continuity_errors))

    promoted = copy.deepcopy(section)
    promoted["elements"] = copy.deepcopy(elements)
    promoted["flags_for_review"] = [
        item
        for item in promoted.get("flags_for_review") or []
        if not _is_resolved_profile_flag(item)
    ]
    for item in promoted.get("provenance") or []:
        if item.get("kind") == "regime_map_pdf" and item.get("sha256") == fingerprint["sha256"]:
            item["role"] = "authoritative_profile_manually_reviewed"
    promoted.setdefault("provenance", [])
    promoted["provenance"] = [
        item
        for item in promoted["provenance"]
        if item.get("kind") != "regime_profile_builder_review"
    ]
    profile_status, legacy_fallback_count = _promoted_profile_status(elements)
    promoted["provenance"].append(
        {
            "kind": "regime_profile_builder_review",
            "builder_version": str(run.get("builder_version", "unknown")),
            "promotion_version": BUILDER_VERSION,
            "pdf_sha256": str(fingerprint["sha256"]),
            "profile_sha256": actual_digest,
            "profile_with_confidence_sha256": actual_confidence_digest,
            "resolved_issues": len(resolved),
            "legacy_fallback_elements": legacy_fallback_count,
            "role": "authoritative_profile_review",
        }
    )
    runtime = promoted.setdefault("runtime", {})
    runtime["profile_status"] = profile_status
    profile_coverage, profile_gaps = _actual_profile_ranges(
        elements,
        range_start,
        range_end,
        allowed_profile_gaps,
    )
    runtime["profile_coverage"] = profile_coverage
    runtime["profile_gaps"] = profile_gaps

    catalog_path = section_path.parent / "index.json"
    if not catalog_path.is_file():
        raise PdfBuilderError(f"product section catalog is missing: {catalog_path}")
    catalog = _read_json(catalog_path)
    catalog_entries = [
        item
        for item in catalog.get("sections") or []
        if item.get("id") == promoted.get("id") and item.get("file") == section_path.name
    ]
    if len(catalog_entries) != 1:
        raise PdfBuilderError(
            "product section must have exactly one matching entry in sections/index.json"
        )
    catalog_entries[0]["profile_status"] = runtime["profile_status"]

    _write_json(output_path, promoted)
    _write_json(catalog_path, catalog)
    print(
        json.dumps(
            {
                "output": str(output_path),
                "catalog": str(catalog_path),
                "section_id": promoted.get("id"),
                "elements": len(elements),
                "profile_sha256": actual_digest,
                "status": promoted.get("status"),
                "profile_status": runtime["profile_status"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
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
    review_parser.add_argument("--decisions", required=True, action="append")
    review_parser.add_argument("--out")
    review_parser.set_defaults(handler=command_apply_review)

    promote_parser = subparsers.add_parser(
        "promote",
        help="promote a clean reviewed profile into a product section JSON",
    )
    promote_parser.add_argument("--run", required=True)
    promote_parser.add_argument("--section", required=True)
    promote_parser.add_argument("--out", required=True)
    promote_parser.set_defaults(handler=command_promote)
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
