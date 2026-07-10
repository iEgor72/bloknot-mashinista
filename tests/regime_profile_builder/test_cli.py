from __future__ import annotations

import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace

from tools.regime_profile_builder.cli import command_apply_review


class CliReviewTest(unittest.TestCase):
    def test_apply_review_can_insert_a_manually_graded_gap(self):
        with tempfile.TemporaryDirectory() as directory:
            run_dir = Path(directory)
            fingerprint = "b" * 64
            (run_dir / "run.json").write_text(
                json.dumps({"source": {"fingerprint": {"sha256": fingerprint}}}),
                encoding="utf-8",
            )
            (run_dir / "draft.profile.json").write_text(
                json.dumps({
                    "elements": [
                        {"start_m": 1000, "len_m": 100, "grad_permille": 0.0},
                        {"start_m": 1200, "len_m": 100, "grad_permille": 0.0},
                    ]
                }),
                encoding="utf-8",
            )
            (run_dir / "review.json").write_text(
                json.dumps({
                    "issues": [{
                        "issue_id": "gap-1",
                        "kind": "profile_gap",
                        "after_m": 1100,
                        "next_m": 1200,
                    }]
                }),
                encoding="utf-8",
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


if __name__ == "__main__":
    unittest.main()
