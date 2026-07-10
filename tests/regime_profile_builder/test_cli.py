from __future__ import annotations

import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from tools.regime_profile_builder.cli import (
    OBSOLETE_LEGACY_PROFILE_FLAG,
    _canonical_profile_digest,
    _promoted_profile_status,
    _validate_continuity,
    _validate_promotion_target,
    build_parser,
    command_apply_review,
    command_check,
    command_promote,
)
from tools.regime_profile_builder.pdf_io import PdfBuilderError


def write_run_artifacts(
    run_dir: Path,
    elements: list[dict],
    *,
    fingerprint: str,
    issues: list[dict] | None = None,
    range_start: int | None = None,
    range_end: int | None = None,
) -> tuple[dict, str, str]:
    issues = list(issues or [])
    range_start = (
        int(elements[0]["start_m"])
        if range_start is None
        else int(range_start)
    )
    range_end = (
        int(elements[-1]["start_m"]) + int(elements[-1]["len_m"])
        if range_end is None
        else int(range_end)
    )
    numeric_digest = _canonical_profile_digest(elements)
    confidence_digest = _canonical_profile_digest(
        elements,
        include_confidence=True,
    )
    run = {
        "builder_version": "test",
        "source": {"fingerprint": {"sha256": fingerprint}},
        "summary": {
            "profile_sha256": numeric_digest,
            "profile_with_confidence_sha256": confidence_digest,
            "review_issues": len(issues),
            "blocked_issues": 0,
        },
    }
    draft = {
        "range": {"start_m": range_start, "end_m": range_end},
        "elements": elements,
        "allowed_profile_gaps": [],
    }
    (run_dir / "run.json").write_text(json.dumps(run), encoding="utf-8")
    (run_dir / "draft.profile.json").write_text(
        json.dumps(draft),
        encoding="utf-8",
    )
    (run_dir / "review.json").write_text(
        json.dumps({"issues": issues}),
        encoding="utf-8",
    )
    return draft, numeric_digest, confidence_digest


def reviewed_resolution(
    fingerprint: str,
    issue_ids: list[str],
    base_numeric_digest: str,
    base_confidence_digest: str,
    elements: list[dict],
) -> dict:
    return {
        "pdf_sha256": fingerprint,
        "resolved": issue_ids,
        "remaining": [],
        "base_profile_sha256": base_numeric_digest,
        "base_profile_with_confidence_sha256": base_confidence_digest,
        "profile_sha256": _canonical_profile_digest(elements),
        "profile_with_confidence_sha256": _canonical_profile_digest(
            elements,
            include_confidence=True,
        ),
    }


class CliReviewTest(unittest.TestCase):
    def test_apply_review_parser_accepts_multiple_decision_fragments(self):
        args = build_parser().parse_args([
            "apply-review",
            "--run", "run",
            "--decisions", "upper.json",
            "--decisions", "lower.json",
        ])
        self.assertEqual(args.decisions, ["upper.json", "lower.json"])

    def test_continuity_accepts_only_observed_declared_gap(self):
        elements = [
            {"start_m": 1000, "len_m": 100},
            {"start_m": 1300, "len_m": 100},
        ]
        allowed = [{"start_m": 1100, "end_m": 1300, "reason": "chainage reset"}]
        self.assertEqual(_validate_continuity(elements, 1000, 1400, allowed), [])
        self.assertTrue(_validate_continuity(elements, 1000, 1400, []))
        self.assertTrue(
            _validate_continuity(
                [{"start_m": 1000, "len_m": 400}],
                1000,
                1400,
                allowed,
            )
        )

    def test_promoted_status_discloses_legacy_magnitudes(self):
        status, count = _promoted_profile_status([
            {"confidence": "pdf_vector_confirmed"},
            {"confidence": "manual_reviewed_legacy_fallback"},
            {"confidence": "manual_reviewed_legacy_fallback"},
        ])
        self.assertEqual(status, "pdf_profile_audited_2_legacy_magnitudes")
        self.assertEqual(count, 2)

    def test_apply_review_can_insert_a_manually_graded_gap(self):
        with tempfile.TemporaryDirectory() as directory:
            run_dir = Path(directory)
            fingerprint = "b" * 64
            base_elements = [
                {"start_m": 1000, "len_m": 100, "grad_permille": 0.0},
                {"start_m": 1200, "len_m": 100, "grad_permille": 0.0},
            ]
            _draft, base_digest, base_confidence_digest = write_run_artifacts(
                run_dir,
                base_elements,
                fingerprint=fingerprint,
                range_start=1000,
                range_end=1300,
                issues=[{
                    "issue_id": "gap-1",
                    "kind": "profile_gap",
                    "after_m": 1100,
                    "next_m": 1200,
                }],
            )
            decisions = run_dir / "decisions.json"
            decisions.write_text(
                json.dumps({
                    "pdf_sha256": fingerprint,
                    "decisions": [{
                        "issue_id": "gap-1",
                        "action": "insert_gap",
                        "grade_permille": 1.5,
                    }],
                }),
                encoding="utf-8",
            )
            output = run_dir / "reviewed.profile.json"
            with redirect_stdout(io.StringIO()):
                exit_code = command_apply_review(SimpleNamespace(
                    run=str(run_dir),
                    decisions=str(decisions),
                    out=str(output),
                ))
            payload = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(exit_code, 0)
            self.assertEqual(
                [(item["start_m"], item["len_m"]) for item in payload["elements"]],
                [(1000, 100), (1100, 100), (1200, 100)],
            )
            self.assertEqual(payload["elements"][1]["grad_permille"], 1.5)
            self.assertEqual(payload["elements"][1]["confidence"], "manual_reviewed")
            self.assertTrue(payload["review_resolution"]["profile_sha256"])
            self.assertTrue(payload["review_resolution"]["profile_with_confidence_sha256"])
            self.assertEqual(
                payload["review_resolution"]["base_profile_sha256"],
                base_digest,
            )
            self.assertEqual(
                payload["review_resolution"]["base_profile_with_confidence_sha256"],
                base_confidence_digest,
            )

    def test_check_prefers_fully_resolved_reviewed_profile(self):
        with tempfile.TemporaryDirectory() as directory:
            run_dir = Path(directory)
            elements = [{"start_m": 1000, "len_m": 100, "grad_permille": 0.0}]
            fingerprint = "f" * 64
            base, digest, confidence_digest = write_run_artifacts(
                run_dir,
                elements,
                fingerprint=fingerprint,
                issues=[{"issue_id": "resolved-1"}],
            )
            (run_dir / "reviewed.profile.json").write_text(
                json.dumps({
                    **base,
                    "review_resolution": reviewed_resolution(
                        fingerprint,
                        ["resolved-1"],
                        digest,
                        confidence_digest,
                        elements,
                    ),
                }),
                encoding="utf-8",
            )
            output = io.StringIO()
            with redirect_stdout(output):
                exit_code = command_check(SimpleNamespace(run=str(run_dir), require_clean=True))
            self.assertEqual(exit_code, 0)
            self.assertTrue(json.loads(output.getvalue())["ok"])

    def test_apply_review_marks_a_legacy_grade_fallback_explicitly(self):
        with tempfile.TemporaryDirectory() as directory:
            run_dir = Path(directory)
            fingerprint = "e" * 64
            write_run_artifacts(
                run_dir,
                [{
                    "start_m": 1000,
                    "len_m": 100,
                    "grad_permille": 0.0,
                }],
                fingerprint=fingerprint,
                issues=[{"issue_id": "grade-1", "start_m": 1000}],
            )
            decisions = run_dir / "decisions.json"
            decisions.write_text(
                json.dumps({
                    "pdf_sha256": fingerprint,
                    "decisions": [{
                        "issue_id": "grade-1",
                        "action": "set_grade_from_legacy",
                        "grade_permille": 2.5,
                    }],
                }),
                encoding="utf-8",
            )
            output = run_dir / "reviewed.profile.json"
            with redirect_stdout(io.StringIO()):
                command_apply_review(SimpleNamespace(
                    run=str(run_dir),
                    decisions=str(decisions),
                    out=str(output),
                ))
            element = json.loads(output.read_text(encoding="utf-8"))["elements"][0]
            self.assertEqual(element["grad_permille"], 2.5)
            self.assertEqual(element["confidence"], "manual_reviewed_legacy_fallback")

    def test_promote_preserves_section_metadata_and_replaces_only_profile(self):
        with tempfile.TemporaryDirectory() as directory:
            repository_root = Path(directory)
            run_dir = repository_root / "run"
            run_dir.mkdir()
            elements = [{
                "start_m": 1000,
                "len_m": 100,
                "grad_permille": 1.0,
                "confidence": "manual_reviewed",
            }]
            fingerprint = "d" * 64
            base, base_digest, base_confidence_digest = write_run_artifacts(
                run_dir,
                elements,
                fingerprint=fingerprint,
                issues=[{"issue_id": "one"}],
            )
            digest = _canonical_profile_digest(elements)
            confidence_digest = _canonical_profile_digest(elements, include_confidence=True)
            (run_dir / "reviewed.profile.json").write_text(
                json.dumps({
                    **base,
                    "elements": elements,
                    "review_resolution": reviewed_resolution(
                        fingerprint,
                        ["one"],
                        base_digest,
                        base_confidence_digest,
                        elements,
                    ),
                }),
                encoding="utf-8",
            )
            section_path = repository_root / "assets" / "tracker" / "sections" / "section.json"
            section_path.parent.mkdir(parents=True)
            section_path.write_text(
                json.dumps({
                    "id": "section",
                    "status": "draft",
                    "km_start": 1,
                    "km_end": 1.1,
                    "elements": [{"start_m": 1000, "len_m": 100, "grad_permille": 0.0}],
                    "stations": [{"name": "kept"}],
                    "flags_for_review": [
                        {"reason": OBSOLETE_LEGACY_PROFILE_FLAG},
                        {"reason": "Физический профиль извлечён из PDF; 2 элемента требуют ручной сверки"},
                        {"reason": "В legacy profile.xml отсутствует подтверждённый элемент 1,0–1,1 км; диапазон оставлен как gap"},
                        {"reason": "Светофоры ещё не перенесены"},
                    ],
                    "provenance": [{"kind": "regime_map_pdf", "sha256": fingerprint, "role": "old"}],
                    "runtime": {},
                }),
                encoding="utf-8",
            )
            catalog_path = section_path.parent / "index.json"
            catalog_path.write_text(
                json.dumps({
                    "sections": [{
                        "id": "section",
                        "file": "section.json",
                        "profile_status": "old",
                    }],
                }),
                encoding="utf-8",
            )
            with patch("tools.regime_profile_builder.cli.REPOSITORY_ROOT", repository_root):
                with redirect_stdout(io.StringIO()):
                    exit_code = command_promote(SimpleNamespace(
                        run=str(run_dir),
                        section=str(section_path),
                        out=str(section_path),
                    ))
            promoted = json.loads(section_path.read_text(encoding="utf-8"))
            self.assertEqual(exit_code, 0)
            self.assertEqual(promoted["elements"], elements)
            self.assertEqual(promoted["stations"], [{"name": "kept"}])
            self.assertEqual(
                promoted["flags_for_review"],
                [{"reason": "Светофоры ещё не перенесены"}],
            )
            self.assertEqual(promoted["runtime"]["profile_status"], "pdf_verified")
            self.assertEqual(promoted["provenance"][-1]["profile_sha256"], digest)
            self.assertEqual(
                promoted["provenance"][-1]["profile_with_confidence_sha256"],
                confidence_digest,
            )
            self.assertEqual(promoted["provenance"][-1]["promotion_version"], "0.2.0")
            self.assertEqual(promoted["provenance"][-1]["legacy_fallback_elements"], 0)
            catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
            self.assertEqual(catalog["sections"][0]["profile_status"], "pdf_verified")

    def test_promote_rejects_output_other_than_selected_product_section(self):
        with tempfile.TemporaryDirectory() as directory:
            repository_root = Path(directory)
            product_dir = repository_root / "assets" / "tracker" / "sections"
            product_dir.mkdir(parents=True)
            section_path = product_dir / "section.json"
            with patch("tools.regime_profile_builder.cli.REPOSITORY_ROOT", repository_root):
                with self.assertRaisesRegex(PdfBuilderError, "replace the selected product section"):
                    _validate_promotion_target(section_path.resolve(), (product_dir / "other.json").resolve())

    def test_apply_review_rejects_a_tampered_draft(self):
        with tempfile.TemporaryDirectory() as directory:
            run_dir = Path(directory)
            fingerprint = "a" * 64
            elements = [{
                "start_m": 1000,
                "len_m": 100,
                "grad_permille": 1.0,
                "confidence": "needs_review",
            }]
            write_run_artifacts(
                run_dir,
                elements,
                fingerprint=fingerprint,
                issues=[{"issue_id": "grade-1", "start_m": 1000}],
            )
            tampered = json.loads(
                (run_dir / "draft.profile.json").read_text(encoding="utf-8")
            )
            tampered["elements"][0]["grad_permille"] = 9.0
            (run_dir / "draft.profile.json").write_text(
                json.dumps(tampered),
                encoding="utf-8",
            )
            decisions = run_dir / "decisions.json"
            decisions.write_text(
                json.dumps({
                    "pdf_sha256": fingerprint,
                    "decisions": [],
                }),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(PdfBuilderError, "draft profile digest mismatch"):
                command_apply_review(SimpleNamespace(
                    run=str(run_dir),
                    decisions=str(decisions),
                    out=None,
                ))

    def test_apply_review_rejects_nan_and_infinity_decisions(self):
        for value in (float("nan"), float("inf"), float("-inf")):
            with self.subTest(value=value), tempfile.TemporaryDirectory() as directory:
                run_dir = Path(directory)
                fingerprint = "9" * 64
                write_run_artifacts(
                    run_dir,
                    [{
                        "start_m": 1000,
                        "len_m": 100,
                        "grad_permille": 0.0,
                        "confidence": "needs_review",
                    }],
                    fingerprint=fingerprint,
                    issues=[{"issue_id": "grade-1", "start_m": 1000}],
                )
                decisions = run_dir / "decisions.json"
                decisions.write_text(
                    json.dumps({
                        "pdf_sha256": fingerprint,
                        "decisions": [{
                            "issue_id": "grade-1",
                            "action": "set_grade",
                            "grade_permille": value,
                        }],
                    }),
                    encoding="utf-8",
                )
                with self.assertRaisesRegex(PdfBuilderError, "grad_permille must be finite"):
                    command_apply_review(SimpleNamespace(
                        run=str(run_dir),
                        decisions=str(decisions),
                        out=None,
                    ))
                self.assertFalse((run_dir / "reviewed.profile.json").exists())

    def test_check_rejects_reviewed_profile_bound_to_another_draft(self):
        with tempfile.TemporaryDirectory() as directory:
            run_dir = Path(directory)
            fingerprint = "8" * 64
            elements = [{
                "start_m": 1000,
                "len_m": 100,
                "grad_permille": 0.0,
                "confidence": "manual_reviewed",
            }]
            base, base_digest, base_confidence_digest = write_run_artifacts(
                run_dir,
                elements,
                fingerprint=fingerprint,
                issues=[{"issue_id": "one"}],
            )
            resolution = reviewed_resolution(
                fingerprint,
                ["one"],
                base_digest,
                base_confidence_digest,
                elements,
            )
            resolution["base_profile_sha256"] = "0" * 64
            (run_dir / "reviewed.profile.json").write_text(
                json.dumps({**base, "review_resolution": resolution}),
                encoding="utf-8",
            )
            output = io.StringIO()
            with redirect_stdout(output):
                exit_code = command_check(
                    SimpleNamespace(run=str(run_dir), require_clean=True)
                )
            payload = json.loads(output.getvalue())
            self.assertEqual(exit_code, 1)
            self.assertTrue(
                any("not bound to the current draft" in item for item in payload["errors"])
            )

    def test_check_rejects_nonfinite_reviewed_elements(self):
        with tempfile.TemporaryDirectory() as directory:
            run_dir = Path(directory)
            fingerprint = "7" * 64
            elements = [{
                "start_m": 1000,
                "len_m": 100,
                "grad_permille": 0.0,
                "confidence": "manual_reviewed",
            }]
            base, base_digest, base_confidence_digest = write_run_artifacts(
                run_dir,
                elements,
                fingerprint=fingerprint,
                issues=[{"issue_id": "one"}],
            )
            broken_elements = [dict(elements[0], grad_permille=float("nan"))]
            resolution = reviewed_resolution(
                fingerprint,
                ["one"],
                base_digest,
                base_confidence_digest,
                elements,
            )
            (run_dir / "reviewed.profile.json").write_text(
                json.dumps({
                    **base,
                    "elements": broken_elements,
                    "review_resolution": resolution,
                }),
                encoding="utf-8",
            )
            output = io.StringIO()
            with redirect_stdout(output):
                exit_code = command_check(
                    SimpleNamespace(run=str(run_dir), require_clean=True)
                )
            payload = json.loads(output.getvalue())
            self.assertEqual(exit_code, 1)
            self.assertTrue(
                any("grad_permille must be finite" in item for item in payload["errors"])
            )

    def test_promote_rejects_stale_base_and_nonfinite_reviewed_elements(self):
        for broken_base, broken_grade in (
            (True, 0.0),
            (False, float("inf")),
        ):
            with (
                self.subTest(broken_base=broken_base, broken_grade=broken_grade),
                tempfile.TemporaryDirectory() as directory,
            ):
                run_dir = Path(directory)
                fingerprint = "6" * 64
                elements = [{
                    "start_m": 1000,
                    "len_m": 100,
                    "grad_permille": 0.0,
                    "confidence": "manual_reviewed",
                }]
                base, base_digest, base_confidence_digest = write_run_artifacts(
                    run_dir,
                    elements,
                    fingerprint=fingerprint,
                    issues=[{"issue_id": "one"}],
                )
                reviewed_elements = [dict(elements[0], grad_permille=broken_grade)]
                resolution = reviewed_resolution(
                    fingerprint,
                    ["one"],
                    base_digest,
                    base_confidence_digest,
                    elements,
                )
                if broken_base:
                    resolution["base_profile_sha256"] = "1" * 64
                (run_dir / "reviewed.profile.json").write_text(
                    json.dumps({
                        **base,
                        "elements": reviewed_elements,
                        "review_resolution": resolution,
                    }),
                    encoding="utf-8",
                )
                with self.assertRaises(PdfBuilderError):
                    command_promote(SimpleNamespace(
                        run=str(run_dir),
                        section=str(run_dir / "unused-section.json"),
                        out=str(run_dir / "unused-section.json"),
                    ))

    def test_unmatched_pdf_cell_requires_explicit_dismiss_action(self):
        with tempfile.TemporaryDirectory() as directory:
            run_dir = Path(directory)
            fingerprint = "c" * 64
            write_run_artifacts(
                run_dir,
                [{"start_m": 1000, "len_m": 100, "grad_permille": 0.0}],
                fingerprint=fingerprint,
                issues=[{
                        "issue_id": "unmatched-1",
                        "kind": "unmatched_pdf_cell_during_seed_reconciliation",
                        "start_m": 9000,
                }],
            )
            decisions = run_dir / "decisions.json"
            decisions.write_text(
                json.dumps({
                    "pdf_sha256": fingerprint,
                    "decisions": [{"issue_id": "unmatched-1", "action": "accept_geometry"}],
                }),
                encoding="utf-8",
            )
            args = SimpleNamespace(run=str(run_dir), decisions=str(decisions), out=None)
            with self.assertRaises(PdfBuilderError):
                with redirect_stdout(io.StringIO()):
                    command_apply_review(args)

            decisions.write_text(
                json.dumps({
                    "pdf_sha256": fingerprint,
                    "decisions": [{
                        "issue_id": "unmatched-1",
                        "action": "dismiss_unmatched_pdf_cell",
                    }],
                }),
                encoding="utf-8",
            )
            with redirect_stdout(io.StringIO()):
                exit_code = command_apply_review(args)
            self.assertEqual(exit_code, 0)
            reviewed = json.loads((run_dir / "reviewed.profile.json").read_text(encoding="utf-8"))
            self.assertEqual(reviewed["review_resolution"]["resolved"], ["unmatched-1"])


if __name__ == "__main__":
    unittest.main()
