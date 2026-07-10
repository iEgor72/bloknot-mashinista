from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from tools.regime_profile_builder.pipeline import (
    add_manual_seed_gap_suggestions,
    build_issues,
    finalize_cells,
    normalize_profile,
    reconcile_cells_with_seed,
    inspect_document,
    _apply_page_windows,
    _apply_page_coordinate_offsets,
    _resolve_page_priority_overlaps,
    _stitch_diagonal_page_coordinates,
    _discard_diagonal_leading_blank_cells,
)
from tools.regime_profile_builder.pdf_io import PdfBuilderError


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
    def test_exact_declared_profile_gap_is_allowed_but_must_be_observed(self):
        config = {
            "range_start_m": 1000,
            "range_end_m": 1400,
            "allowed_profile_gaps": [
                {"start_m": 1100, "end_m": 1300, "reason": "physical chainage reset"},
            ],
        }
        profile, issues = normalize_profile(
            [cell(1, 1, 1000, 1100, 1.0), cell(2, 1, 1300, 1400, 2.0)],
            config,
        )
        self.assertEqual(len(profile), 2)
        self.assertFalse([item for item in issues if item["kind"].startswith("profile_")])

        _profile, issues = normalize_profile(
            [cell(1, 1, 1000, 1400, 1.0)],
            config,
        )
        self.assertTrue(
            any(item["kind"] == "profile_allowed_gap_not_observed" for item in issues)
        )

    def test_page_windows_remap_two_axis_segments_without_bridging_gap(self):
        upper = cell(27, 1, 0, 100, 1.0)
        upper.update({"layout": "diagonal_grade_table", "x0": 0.0, "x1": 10.0})
        lower = cell(27, 2, 100, 200, -2.0)
        lower.update({"layout": "diagonal_grade_table", "x0": 10.0, "x1": 20.0})
        diagnostics = [{"page": 27}]
        cells = [upper, lower]

        _apply_page_windows(
            cells,
            diagnostics,
            [
                {
                    "id": "upper",
                    "page": 27,
                    "keep_m": [9400, 9800],
                    "axis_override": {
                        "left_x": 0.0,
                        "left_m": 9800,
                        "right_x": 10.0,
                        "right_m": 9400,
                    },
                },
                {
                    "id": "lower",
                    "page": 27,
                    "keep_m": [8200, 9100],
                    "axis_override": {
                        "left_x": 10.0,
                        "left_m": 9100,
                        "right_x": 20.0,
                        "right_m": 8200,
                    },
                },
            ],
            100,
        )

        self.assertEqual(
            sorted((item["start_m"], item["end_m"]) for item in cells),
            [(8200, 9100), (9400, 9800)],
        )
        self.assertTrue(all(item["explicit_page_window"] for item in cells))
        self.assertTrue(all("explicit_page_axis_override" in item["evidence"] for item in cells))
        self.assertEqual(diagnostics[0]["page_window_output_cells"], 2)

    def test_page_window_keep_m_clips_and_preserves_source_coordinates(self):
        source = cell(25, 1, 1000, 1300, 1.0)
        diagnostics = [{"page": 25}]
        cells = [source]

        _apply_page_windows(
            cells,
            diagnostics,
            [{"id": "middle", "page": 25, "keep_m": [1100, 1200]}],
            100,
        )

        self.assertEqual((cells[0]["start_m"], cells[0]["end_m"]), (1100, 1200))
        self.assertEqual(
            (cells[0]["page_window_original_start_m"], cells[0]["page_window_original_end_m"]),
            (1000, 1300),
        )
        self.assertEqual(cells[0]["page_window_id"], "middle")
        self.assertIn("explicit_page_window_clip", cells[0]["evidence"])

    def test_explicit_axis_window_is_not_auto_stitched(self):
        previous = cell(26, 1, 8000, 8100, 1.0)
        current = cell(27, 1, 8200, 8300, 2.0)
        for item in (previous, current):
            item["layout"] = "diagonal_grade_table"
        current["explicit_page_window"] = True
        inspection = {
            "pages": [
                {"page": 26, "status": "ready", "axis": {"direction": "ascending"}},
                {"page": 27, "status": "ready", "axis": {"direction": "ascending"}},
            ]
        }
        diagnostics = [{"page": 26}, {"page": 27}]

        _stitch_diagonal_page_coordinates([previous, current], inspection, diagnostics)

        self.assertEqual((current["start_m"], current["end_m"]), (8200, 8300))
        self.assertEqual(diagnostics[1]["cross_page_shift_m"], 0)
        self.assertTrue(diagnostics[1]["auto_stitch_skipped_explicit_window"])

    def test_page_priority_suppresses_lower_page_review_evidence(self):
        preferred = cell(29, 1, 1000, 1200, 1.0)
        shadowed = cell(31, 1, 1000, 1200, -9.0, confidence="needs_review")
        shadowed["review_reasons"] = ["ambiguous_magnitude_label"]
        diagnostics = [{"page": 29}, {"page": 31}]

        resolved, issues = _resolve_page_priority_overlaps(
            [preferred, shadowed],
            {"29": 300, "31": 100},
            diagnostics,
        )

        self.assertEqual(issues, [])
        self.assertEqual(len(resolved), 1)
        self.assertEqual(resolved[0]["page"], 29)
        self.assertEqual(resolved[0]["review_reasons"], [])
        self.assertIn("page_priority_selected", resolved[0]["evidence"])
        self.assertEqual(diagnostics[1]["page_priority_suppressed_m"], 200)
        self.assertTrue(diagnostics[1]["page_priority_fully_suppressed"])

    def test_page_priority_keeps_non_positive_cell_for_normalizer(self):
        invalid = cell(31, 1, 1100, 1100, 0.0, confidence="needs_review")
        resolved, priority_issues = _resolve_page_priority_overlaps(
            [invalid],
            {"31": 100},
            [{"page": 31}],
        )
        profile, normalization_issues = normalize_profile(
            resolved,
            {"range_start_m": 1000, "range_end_m": 1200},
        )
        self.assertEqual(priority_issues, [])
        self.assertEqual(profile, [])
        self.assertTrue(
            any(item["kind"] == "non_positive_cell_length" for item in normalization_issues)
        )

    def test_page_priority_splits_lower_page_around_preferred_overlap(self):
        fallback = cell(31, 1, 1000, 1300, 1.0)
        preferred = cell(29, 1, 1100, 1200, 2.0)
        resolved, issues = _resolve_page_priority_overlaps(
            [fallback, preferred],
            {"29": 300, "31": 100},
            [{"page": 29}, {"page": 31}],
        )
        self.assertEqual(issues, [])
        self.assertEqual(
            [(item["start_m"], item["end_m"], item["page"]) for item in resolved],
            [(1000, 1100, 31), (1100, 1200, 29), (1200, 1300, 31)],
        )

    def test_priority_tie_and_same_page_overlap_remain_blocked(self):
        tied = [cell(29, 1, 1000, 1200, 1.0), cell(33, 1, 1000, 1200, -1.0)]
        resolved, priority_issues = _resolve_page_priority_overlaps(
            tied,
            {"29": 300, "33": 300},
            [{"page": 29}, {"page": 33}],
        )
        profile, normalization_issues = normalize_profile(
            resolved,
            {"range_start_m": 1000, "range_end_m": 1200},
        )
        self.assertEqual(len(profile), 1)
        self.assertEqual(profile[0]["confidence"], "blocked")
        self.assertTrue(priority_issues)
        self.assertTrue(
            any(item["kind"] == "duplicate_grade_conflict" for item in normalization_issues)
        )

        same_page = [cell(31, 1, 1000, 1200, 1.0), cell(31, 2, 1100, 1300, 2.0)]
        unresolved, same_page_issues = _resolve_page_priority_overlaps(
            same_page,
            {"31": 100},
            [{"page": 31}],
        )
        _profile, normalization_issues = normalize_profile(
            unresolved,
            {"range_start_m": 1000, "range_end_m": 1300},
        )
        self.assertEqual(same_page_issues, [])
        self.assertTrue(any(item["kind"] == "profile_overlap" for item in normalization_issues))

    def test_missing_page_priority_config_keeps_previous_behavior(self):
        original = [cell(29, 1, 1000, 1200, 1.0), cell(31, 1, 1000, 1200, 2.0)]
        resolved, issues = _resolve_page_priority_overlaps(original, {}, [])
        self.assertEqual(resolved, original)
        self.assertEqual(issues, [])

    def test_explicit_page_coordinate_offset_preserves_length_and_evidence(self):
        shifted = cell(11, 1, 195900, 196500, 18.0)
        diagnostics = [{"page": 11}, {"page": 13}]
        _apply_page_coordinate_offsets(
            [shifted],
            diagnostics,
            {"11": 100},
        )
        self.assertEqual(
            (shifted["start_m"], shifted["end_m"], shifted["len_m"]),
            (196000, 196600, 600),
        )
        self.assertEqual(
            (shifted["unshifted_start_m"], shifted["unshifted_end_m"]),
            (195900, 196500),
        )
        self.assertIn("explicit_page_coordinate_offset", shifted["evidence"])
        self.assertEqual(diagnostics[0]["page_coordinate_offset_m"], 100)
        self.assertNotIn("page_coordinate_offset_m", diagnostics[1])

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

    def test_review_only_grade_suggestion_does_not_merge_into_confirmed_neighbor(self):
        config = {"range_start_m": 1000, "range_end_m": 1200}
        suggested = cell(1, 1, 1000, 1100, 1.0, confidence="needs_review")
        suggested["review_reasons"] = ["blue_trace_magnitude_suggestion"]
        confirmed = cell(2, 1, 1100, 1200, 1.0)
        profile, _issues = normalize_profile([suggested, confirmed], config)
        self.assertEqual([(item["start_m"], item["len_m"]) for item in profile], [(1000, 100), (1100, 100)])

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

    def test_printed_length_conflict_does_not_downgrade_blocked_cell(self):
        config = {"range_start_m": 1000, "range_end_m": 1200}
        blocked = cell(1, 1, 1000, 1200, 1.0, printed=300, confidence="blocked")
        profile, _issues = normalize_profile([blocked], config)
        self.assertEqual(profile[0]["confidence"], "blocked")

    def test_non_positive_cell_is_blocked_instead_of_silently_discarded(self):
        config = {"range_start_m": 1000, "range_end_m": 1200}
        invalid = cell(1, 1, 1100, 1100, 0.0, confidence="needs_review")
        profile, issues = normalize_profile([invalid], config)
        self.assertEqual(profile, [])
        structural = [item for item in issues if item["kind"] == "non_positive_cell_length"]
        self.assertEqual(len(structural), 1)
        self.assertEqual(structural[0]["cell"]["confidence"], "blocked")

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

    def test_promoted_manual_pdf_evidence_can_be_replayed_again(self):
        raw = {
            "page": 1,
            "index": 1,
            "layout": "blue_bottom_table",
            "start_m": 1000,
            "end_m": 1100,
            "len_m": 100,
            "magnitude": 0.5,
            "printed_length_m": 100,
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
            "grad_permille": -0.5,
            "confidence": "pdf_manual_evidence_replayed",
        }]
        finalized, _calibration = finalize_cells([raw], seed)
        self.assertEqual(finalized[0]["grade"], -0.5)
        self.assertEqual(finalized[0]["confidence"], "pdf_manual_evidence_replayed")

    def test_diagonal_missing_magnitude_gets_review_only_trace_suggestion(self):
        known = cell(1, 1, 1000, 1100, 2.0)
        known.update({
            "layout": "diagonal_grade_table",
            "magnitude": 2.0,
            "trace_slope": 0.02,
            "trace_endpoint_slope": 0.02,
            "trace_endpoint_available": True,
            "trace_coverage": 1.0,
            "axis_slope": 10.0,
            "table_stroke_sign": 1,
        })
        missing = cell(1, 2, 1100, 1200, None, confidence="needs_review")
        missing.update({
            "layout": "diagonal_grade_table",
            "magnitude": None,
            "trace_slope": 0.03,
            "trace_endpoint_slope": 0.03,
            "trace_endpoint_available": True,
            "trace_coverage": 1.0,
            "axis_slope": 10.0,
            "table_stroke_sign": -1,
            "review_reasons": ["missing_pdf_magnitude"],
        })
        finalized, calibration = finalize_cells([known, missing], [])
        self.assertEqual(finalized[1]["grade"], -3.0)
        self.assertEqual(finalized[1]["confidence"], "needs_review")
        self.assertIn("blue_trace_magnitude_suggestion", finalized[1]["review_reasons"])
        self.assertIsNotNone(calibration["global_diagonal_trace_scale"])

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

    def test_duplicate_cell_issue_keeps_richer_normalization_evidence(self):
        reviewed = cell(1, 1, 1000, 1100, 1.0, confidence="needs_review")
        reviewed["review_reasons"] = ["printed_length_vector_conflict"]
        evidence = {"geometry_len_m": 100, "printed_len_m": 200}
        issues = build_issues(
            [reviewed],
            [],
            [{"kind": "printed_length_vector_conflict", "cell": reviewed, "evidence": evidence}],
            [],
            "a" * 64,
        )
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0]["evidence"], evidence)

    def test_profile_gap_issue_ids_include_coordinate(self):
        issues = build_issues(
            [],
            [],
            [
                {"kind": "profile_gap", "after_m": 1100, "next_m": 1200},
                {"kind": "profile_gap", "after_m": 2100, "next_m": 2200},
            ],
            [],
            "d" * 64,
        )
        self.assertEqual(len({item["issue_id"] for item in issues}), 2)

    def test_seed_reconciliation_is_explicit_and_keeps_seed_only_values_in_review(self):
        first = cell(1, 1, 0, 100, 1.0, printed=100)
        first.update({
            "layout": "diagonal_grade_table",
            "magnitude": 1.0,
            "table_stroke_sign": 1,
            "trace_sign": 1,
            "printed_length_m": 100,
            "axis_residual_m": 0.0,
        })
        spurious = cell(1, 2, 100, 200, 9.0, printed=100)
        spurious.update({
            "layout": "diagonal_grade_table",
            "magnitude": 9.0,
            "table_stroke_sign": 1,
            "trace_sign": 1,
            "printed_length_m": 100,
            "axis_residual_m": 0.0,
        })
        last = cell(1, 3, 200, 300, 3.0, printed=100)
        last.update({
            "layout": "diagonal_grade_table",
            "magnitude": 3.0,
            "table_stroke_sign": 1,
            "trace_sign": 1,
            "printed_length_m": 100,
            "axis_residual_m": 0.0,
        })
        seed = [
            {"start_m": 0, "len_m": 100, "grad_permille": 1.0, "confidence": "legacy_xml_unverified"},
            {"start_m": 100, "len_m": 100, "grad_permille": -2.0, "confidence": "legacy_xml_unverified"},
            {"start_m": 200, "len_m": 100, "grad_permille": 3.0, "confidence": "legacy_xml_unverified"},
        ]

        reconciled, issues, diagnostics = reconcile_cells_with_seed(
            [first, spurious, last],
            seed,
        )

        self.assertEqual(len(reconciled), 3)
        self.assertEqual(reconciled[0]["confidence"], "pdf_vector_confirmed")
        self.assertEqual(reconciled[1]["confidence"], "needs_review")
        self.assertEqual(reconciled[1]["grade"], -2.0)
        self.assertIn(
            "no_pdf_cell_alignment_legacy_seed_suggestion",
            reconciled[1]["review_reasons"],
        )
        self.assertEqual(reconciled[2]["confidence"], "pdf_vector_confirmed")
        self.assertEqual(len(issues), 1)
        self.assertEqual(diagnostics["aligned_pairs"], 2)
        self.assertEqual(diagnostics["unmatched_pdf_cells"], 1)
        self.assertEqual(diagnostics["seed_only_elements"], 1)
        self.assertTrue(all(item.get("merge_barrier") for item in reconciled))

    def test_seed_reconciliation_never_launders_different_boundaries(self):
        source = cell(1, 1, 9000, 9100, 1.0, printed=100)
        source.update({
            "layout": "diagonal_grade_table",
            "magnitude": 1.0,
            "table_stroke_sign": 1,
            "printed_length_m": 100,
            "axis_residual_m": 0.0,
        })
        reconciled, _issues, _diagnostics = reconcile_cells_with_seed(
            [source],
            [{
                "start_m": 0,
                "len_m": 100,
                "grad_permille": 1.0,
                "confidence": "legacy_xml_unverified",
            }],
        )
        self.assertEqual(reconciled[0]["confidence"], "needs_review")
        self.assertIn("legacy_seed_boundary_rebased", reconciled[0]["review_reasons"])

    def test_seed_reconciliation_marks_duplicate_signature_alignment_ambiguous(self):
        source = cell(1, 1, 0, 100, 1.0, printed=100)
        source.update({
            "layout": "diagonal_grade_table",
            "magnitude": 1.0,
            "table_stroke_sign": 1,
            "printed_length_m": 100,
            "axis_residual_m": 0.0,
        })
        reconciled, _issues, diagnostics = reconcile_cells_with_seed(
            [source],
            [
                {"start_m": 0, "len_m": 100, "grad_permille": 1.0},
                {"start_m": 100, "len_m": 100, "grad_permille": 1.0},
            ],
        )
        self.assertEqual(diagnostics["ambiguous_pairs"], 1)
        self.assertTrue(any(
            "seed_alignment_ambiguous" in item["review_reasons"]
            for item in reconciled
        ))

    def test_seed_reconciliation_rejects_seed_gaps(self):
        with self.assertRaises(PdfBuilderError):
            reconcile_cells_with_seed(
                [cell(1, 1, 0, 100, 0.0)],
                [
                    {"start_m": 0, "len_m": 100, "grad_permille": 0.0},
                    {"start_m": 200, "len_m": 100, "grad_permille": 0.0},
                ],
            )

    def test_partial_blue_page_wins_over_diagonal_fallback(self):
        adapters = {
            # The final partial page of the accepted Postyshevo map scores 83:
            # fewer cells lower the score even though every blue-layout
            # invariant (exact trace colour and vertical dividers) is present.
            "blue_bottom_table": SimpleNamespace(score_page=lambda _page, _axis: 83.0),
            "diagonal_grade_table": SimpleNamespace(score_page=lambda _page, _axis: 100.0),
            "black_grade_strokes": SimpleNamespace(score_page=lambda _page, _axis: 0.0),
        }
        document = {
            "page_count": 1,
            "pages": [{"page_number": 1, "height": 600.0, "words": [], "chars": []}],
        }
        config = {
            "profile_pages": "1",
            "excluded_pages": [],
            "adapter": "auto",
        }
        labels = [
            {"km": 100 + index, "x": 10.0 + index * 10.0, "top": 10.0}
            for index in range(4)
        ]
        axis = {"slope": 100.0, "intercept": 0.0, "max_residual_m": 0.0, "labels": labels}
        with (
            patch("tools.regime_profile_builder.pipeline._adapter_modules", return_value=adapters),
            patch("tools.regime_profile_builder.pipeline.extract_km_axis", return_value=labels),
            patch("tools.regime_profile_builder.pipeline.fit_km_axis", return_value=axis),
        ):
            inspection = inspect_document(document, config)

        self.assertEqual(inspection["blocked"], [])
        self.assertEqual(inspection["pages"][0]["adapter"], "blue_bottom_table")

    def test_diagonal_pages_stitch_one_picket_phase_without_changing_lengths(self):
        first = cell(1, 1, 100, 200, 1.0)
        second = cell(2, 1, 300, 400, 2.0)
        for item in (first, second):
            item["layout"] = "diagonal_grade_table"
        inspection = {
            "pages": [
                {"page": 1, "status": "ready", "axis": {"direction": "ascending"}},
                {"page": 2, "status": "ready", "axis": {"direction": "ascending"}},
            ]
        }
        diagnostics = [{"page": 1}, {"page": 2}]
        _stitch_diagonal_page_coordinates([first, second], inspection, diagnostics)
        self.assertEqual((second["start_m"], second["end_m"], second["len_m"]), (200, 300, 100))
        self.assertEqual(second["cross_page_shift_m"], -100)
        self.assertEqual(diagnostics[1]["stitched_page_range_m"], [200, 300])

    def test_diagonal_pages_do_not_stitch_more_than_two_pickets(self):
        first = cell(1, 1, 100, 200, 1.0)
        second = cell(2, 1, 500, 600, 2.0)
        for item in (first, second):
            item["layout"] = "diagonal_grade_table"
        inspection = {
            "pages": [
                {"page": 1, "status": "ready", "axis": {"direction": "ascending"}},
                {"page": 2, "status": "ready", "axis": {"direction": "ascending"}},
            ]
        }
        diagnostics = [{"page": 1}, {"page": 2}]
        _stitch_diagonal_page_coordinates([first, second], inspection, diagnostics)
        self.assertEqual((second["start_m"], second["end_m"]), (500, 600))
        self.assertEqual(diagnostics[1]["cross_page_shift_m"], 0)

    def test_discarded_leading_blank_allows_evidenced_two_picket_phase(self):
        first = cell(1, 1, 100, 200, 1.0)
        blank = cell(2, 1, 300, 400, None, confidence="needs_review")
        second = cell(2, 2, 400, 500, -2.0)
        for item in (first, blank, second):
            item["layout"] = "diagonal_grade_table"
        first.update({"magnitude": 1.0, "table_stroke_sign": 1, "stroke_kind": "diagonal"})
        second.update({"magnitude": 2.0, "table_stroke_sign": -1, "stroke_kind": "diagonal"})
        blank.update({
            "magnitude": None,
            "printed_length_m": None,
            "table_stroke_sign": None,
            "stroke_kind": None,
        })
        inspection = {
            "pages": [
                {"page": 1, "status": "ready", "axis": {"direction": "ascending"}},
                {"page": 2, "status": "ready", "axis": {"direction": "ascending"}},
            ]
        }
        diagnostics = [{"page": 1}, {"page": 2}]
        cells = [first, blank, second]
        _discard_diagonal_leading_blank_cells(cells, diagnostics)
        _stitch_diagonal_page_coordinates(cells, inspection, diagnostics)
        self.assertNotIn(blank, cells)
        self.assertEqual((second["start_m"], second["end_m"]), (200, 300))
        self.assertEqual(diagnostics[1]["cross_page_shift_m"], -200)


if __name__ == "__main__":
    unittest.main()
