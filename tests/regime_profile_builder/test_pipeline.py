from __future__ import annotations

import unittest

from tools.regime_profile_builder.pipeline import (
    add_manual_seed_gap_suggestions,
    build_issues,
    finalize_cells,
    normalize_profile,
)


def cell(page, index, start, end, grade, *, printed=None, confidence="pdf_vector_confirmed"):
    return {
        "page": page,
        "index": index,
        "layout": "black_grade_strokes",
        "start_m": start,
        "end_m": end,
        "len_m": end - start,
        "grade": grade,
        "confidence": confidence,
        "evidence": ["fixture"],
        "review_reasons": [],
        "source_cells": [{"page": page, "index": index}],
        "length_evidence": ([{
            "page": page,
            "index": index,
            "geometry_len_m": end - start,
            "printed_len_m": printed,
            "crop_box": [0, 0, 10, 10],
        }] if printed is not None else []),
        "crop_box": [0, 0, 10, 10],
    }


class PipelineTest(unittest.TestCase):
    def test_clips_and_merges_same_grade_across_page_break(self):
        config = {"range_start_m": 1000, "range_end_m": 1500}
        profile, issues = normalize_profile(
            [
                cell(1, 1, 900, 1100, -1.0, printed=200),
                cell(1, 2, 1100, 1300, 2.0, printed=200),
                cell(2, 1, 1300, 1500, 2.0, printed=200),
            ],
            config,
        )
        self.assertEqual([(item["start_m"], item["len_m"], item["grade"]) for item in profile], [
            (1000, 100, -1.0),
            (1100, 400, 2.0),
        ])
        self.assertFalse([item for item in issues if item["kind"].startswith("profile_")])

    def test_printed_length_conflict_requires_review(self):
        config = {"range_start_m": 1000, "range_end_m": 1200}
        profile, issues = normalize_profile(
            [cell(1, 1, 1000, 1200, 1.0, printed=300)],
            config,
        )
        self.assertEqual(profile[0]["confidence"], "needs_review")
        self.assertEqual(
            [item["kind"] for item in issues],
            ["printed_length_vector_conflict"],
        )

    def test_missing_pdf_magnitude_never_becomes_confirmed_from_legacy(self):
        raw = {
            "page": 1,
            "index": 1,
            "layout": "blue_bottom_table",
            "start_m": 1000,
            "end_m": 1100,
            "len_m": 100,
            "magnitude": None,
            "printed_length_m": None,
            "trace_slope": 0.01,
            "trace_coverage": 1.0,
            "axis_slope": 0.1,
            "axis_residual_m": 0.0,
            "grade": None,
            "confidence": "needs_review",
            "evidence": [],
            "review_reasons": [],
            "crop_box": [0, 0, 10, 10],
            "source_cells": [{"page": 1, "index": 1}],
        }
        seed = [{
            "start_m": 1000,
            "len_m": 100,
            "grad_permille": 0.5,
            "confidence": "legacy_xml_unverified",
        }]
        finalized, _calibration = finalize_cells([raw], seed)
        self.assertEqual(finalized[0]["grade"], 0.5)
        self.assertEqual(finalized[0]["confidence"], "needs_review")
        self.assertIn("missing_pdf_magnitude_legacy_suggestion", finalized[0]["review_reasons"])

    def test_exact_manual_seed_gap_becomes_review_only_merge_barrier(self):
        config = {"range_start_m": 1000, "range_end_m": 1300}
        extracted = [
            cell(1, 1, 1000, 1100, 0.0),
            cell(2, 1, 1200, 1300, 0.0),
        ]
        suggested = add_manual_seed_gap_suggestions(
            extracted,
            [{
                "start_m": 1100,
                "len_m": 100,
                "grad_permille": 0.0,
                "confidence": "verified",
            }],
            config,
        )
        profile, issues = normalize_profile(suggested, config)
        self.assertEqual(len(profile), 3)
        self.assertFalse([item for item in issues if item["kind"] == "profile_gap"])
        self.assertEqual(profile[1]["confidence"], "needs_review")
        self.assertTrue(profile[1]["merge_barrier"])

    def test_unverified_seed_cannot_fill_gap(self):
        config = {"range_start_m": 1000, "range_end_m": 1300}
        extracted = [cell(1, 1, 1000, 1100, 0.0), cell(2, 1, 1200, 1300, 0.0)]
        suggested = add_manual_seed_gap_suggestions(
            extracted,
            [{
                "start_m": 1100,
                "len_m": 100,
                "grad_permille": 0.0,
                "confidence": "legacy_xml_unverified",
            }],
            config,
        )
        self.assertEqual(len(suggested), 2)

    def test_blocked_cell_reason_is_a_blocking_issue(self):
        blocked = cell(1, 1, 1000, 1100, 0.0, confidence="blocked")
        blocked["review_reasons"] = ["grade_missing"]
        issues = build_issues([blocked], [], [], [], "a" * 64)
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0]["severity"], "blocked")


if __name__ == "__main__":
    unittest.main()
