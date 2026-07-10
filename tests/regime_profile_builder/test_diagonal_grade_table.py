from __future__ import annotations

import unittest

from tools.regime_profile_builder.adapters.diagonal_grade_table import (
    _collapse_boundaries_on_picket_grid,
    _cluster_boundary_candidates,
    _chars_are_adjacent,
    _assign_tokens_to_intervals,
    _parse_diagonal_magnitude,
    _picket_grid_lines,
    _picket_grid_calibration,
    _refine_bottom_only_boundaries,
    _refine_picket_coordinates_with_printed_lengths,
    _table_boundaries,
    _trace_conflict_is_actionable,
    _trace_sign,
    extract_page,
    score_page,
)


def numeric_chars(text: str, x: float, top: float, order: int) -> list[dict]:
    result = []
    cursor = x
    for offset, value in enumerate(text):
        width = 2.0 if value == "," else 4.0
        result.append(
            {
                "text": value,
                "order": order + offset,
                "x0": cursor,
                "x1": cursor + width,
                "top": top,
                "bottom": top + 7.0,
                "upright": True,
                "size": 7.0,
            }
        )
        cursor += width
    return result


class DiagonalGradeTableTest(unittest.TestCase):
    def test_tokens_straddling_a_boundary_have_one_nearest_owner(self):
        assignments = _assign_tokens_to_intervals(
            [{"x": 4.9, "text": "1"}, {"x": 5.2, "text": "2"}],
            [0.0, 5.0, 10.0],
        )
        self.assertEqual([[item["text"] for item in group] for group in assignments], [["1"], ["2"]])

    def test_numeric_token_grouping_stops_at_orientation_change(self):
        upright = {"x0": 0.0, "x1": 4.0, "top": 0.0, "bottom": 7.0, "upright": True}
        rotated = {"x0": 3.0, "x1": 7.0, "top": 1.0, "bottom": 8.0, "upright": False}
        self.assertFalse(_chars_are_adjacent(upright, rotated))

    def test_printed_lengths_correct_small_grid_jitter_but_not_large_outlier(self):
        calibration = {
            "step_x": 5.0,
            "direction": "ascending",
            "boundary_coordinates": [1000, 1200, 1300],
        }
        matched = [
            {"length": {"value": 100}, "length_candidates": 1},
            {"length": {"value": 200}, "length_candidates": 1},
        ]
        refined = _refine_picket_coordinates_with_printed_lengths(
            [0.0, 8.0, 15.0],
            calibration,
            matched,
        )
        self.assertEqual(refined["boundary_coordinates"], [1000, 1100, 1300])
        outlier = _refine_picket_coordinates_with_printed_lengths(
            [0.0, 5.0, 35.0],
            {**calibration, "boundary_coordinates": [1000, 1100, 1700]},
            [
                {"length": {"value": 100}, "length_candidates": 1},
                {"length": {"value": 2600}, "length_candidates": 1},
            ],
        )
        self.assertEqual(outlier["boundary_coordinates"], [1000, 1100, 1700])

    def test_trace_sign_reports_full_interval_endpoint_slope(self):
        sign, evidence = _trace_sign(
            [{"x0": 0.0, "x1": 10.0, "y0": 0.0, "y1": 20.0}],
            0.0,
            10.0,
        )
        self.assertEqual(sign, 1)
        self.assertEqual(evidence["trace_endpoint_slope"], 2.0)
        self.assertTrue(evidence["trace_endpoint_available"])

    def test_blue_trace_conflict_requires_majority_interval_coverage(self):
        self.assertFalse(_trace_conflict_is_actionable(3.0, 1, -1, 0.54))
        self.assertTrue(_trace_conflict_is_actionable(3.0, 1, -1, 0.55))

    def test_endpoint_clustering_does_not_chain_across_a_picket(self):
        clustered = _cluster_boundary_candidates(
            [
                {"x": 0.0, "sources": {"bottom"}},
                {"x": 3.0, "sources": {"bottom"}},
                {"x": 6.0, "sources": {"top"}},
            ],
            4.0,
        )
        self.assertEqual([item["x"] for item in clustered], [1.5, 6.0])

    def test_bottom_only_boundary_needs_distinct_neighbor_evidence(self):
        candidates = [
            {"x": 0.0, "sources": ["top"]},
            {"x": 5.0, "sources": ["bottom"]},
            {"x": 10.0, "sources": ["top"]},
        ]
        kept = _refine_bottom_only_boundaries(
            candidates,
            [{"x": 2.0, "text": "1"}, {"x": 7.0, "text": "2"}],
            [],
            [],
            5.0,
        )
        self.assertEqual(len(kept), 3)
        removed = _refine_bottom_only_boundaries(
            candidates,
            [{"x": 7.0, "text": "2"}],
            [{"x": 7.0, "value": 200}],
            [],
            5.0,
        )
        self.assertEqual([item["x"] for item in removed], [0.0, 10.0])
        top_fragment = [
            {"x": 0.0, "sources": ["top"]},
            {"x": 5.0, "sources": ["top"]},
            {"x": 10.0, "sources": ["divider"]},
        ]
        removed_top_fragment = _refine_bottom_only_boundaries(
            top_fragment,
            [],
            [{"x": 7.0, "value": 200}],
            [{"x0": 0.0, "x1": 10.0, "top0": 0.0, "top1": 40.0, "sign": 1}],
            5.0,
        )
        self.assertEqual([item["x"] for item in removed_top_fragment], [0.0, 10.0])

    def test_accepts_whole_number_diagonal_magnitudes(self):
        self.assertEqual(_parse_diagonal_magnitude("3"), 3.0)
        self.assertEqual(_parse_diagonal_magnitude("15"), 15.0)
        self.assertIsNone(_parse_diagonal_magnitude("300"))

    def test_picket_grid_anchors_kilometre_label_at_block_centre(self):
        page = {
            "lines": [
                {"x0": float(x), "x1": float(x), "top": 80.0, "bottom": 100.0}
                for x in range(0, 105, 5)
            ]
        }
        axis = {
            "slope": 20.0,
            "labels": [
                {"km": km, "x": 25.0 + km * 50.0}
                for km in range(4)
            ],
        }
        calibration = _picket_grid_calibration(page, axis, 100.0, [0.0, 100.0])
        self.assertIsNotNone(calibration)
        assert calibration is not None
        self.assertEqual(calibration["boundary_coordinates"], [0, 2000])
        self.assertEqual(calibration["median_residual_m"], 0.0)

    def test_picket_grid_accepts_wide_landscape_ruler(self):
        page = {
            "lines": [
                {"x0": index * 7.5, "x1": index * 7.5, "top": 80.0, "bottom": 100.0}
                for index in range(25)
            ]
        }
        grid, step = _picket_grid_lines(page, 100.0, 0.0, 180.0)
        self.assertEqual(len(grid), 25)
        self.assertEqual(step, 7.5)

    def test_picket_grid_prefers_bottom_km_row_phase(self):
        page = {
            "lines": [
                {"x0": float(x), "x1": float(x), "top": 80.0, "bottom": 100.0}
                for x in range(0, 205, 5)
            ],
            "words": [
                {
                    "text": str(km),
                    "x0": center - 4.0,
                    "x1": center + 4.0,
                    "top": 100.2,
                    "bottom": 108.2,
                }
                for km, center in enumerate((25.0, 75.0, 125.0, 175.0))
            ],
        }
        # The top operational ruler is deliberately two pickets out of phase
        # with the lower profile ruler.
        axis = {
            "slope": 20.0,
            "labels": [
                {"km": km, "x": 15.0 + km * 50.0}
                for km in range(4)
            ],
        }
        calibration = _picket_grid_calibration(page, axis, 100.0, [0.0, 200.0])
        self.assertIsNotNone(calibration)
        assert calibration is not None
        self.assertEqual(calibration["axis_label_source"], "bottom_km_row")
        self.assertEqual(calibration["axis_labels_used"], 4)
        self.assertEqual(calibration["boundary_coordinates"], [0, 4000])

    def test_picket_grid_falls_back_when_bottom_row_is_incomplete(self):
        page = {
            "lines": [
                {"x0": float(x), "x1": float(x), "top": 80.0, "bottom": 100.0}
                for x in range(0, 105, 5)
            ],
            "words": [
                {
                    "text": str(km),
                    "x0": center - 4.0,
                    "x1": center + 4.0,
                    "top": 100.0,
                    "bottom": 108.0,
                }
                for km, center in enumerate((25.0, 75.0, 125.0))
            ],
        }
        axis = {
            "slope": 20.0,
            "labels": [
                {"km": km, "x": 25.0 + km * 50.0}
                for km in range(4)
            ],
        }
        calibration = _picket_grid_calibration(page, axis, 100.0, [0.0, 100.0])
        self.assertIsNotNone(calibration)
        assert calibration is not None
        self.assertEqual(calibration["axis_label_source"], "top_axis")
        self.assertEqual(calibration["boundary_coordinates"], [0, 2000])

    def test_collapses_cad_join_points_on_the_same_picket(self):
        boundaries, calibration = _collapse_boundaries_on_picket_grid(
            [10.0, 29.5, 30.5, 50.0],
            {"boundary_coordinates": [1000, 1200, 1200, 1400]},
        )
        self.assertEqual(boundaries, [10.0, 30.0, 50.0])
        self.assertEqual(calibration["boundary_coordinates"], [1000, 1200, 1400])
        self.assertEqual(calibration["collapsed_same_picket_boundaries"], 1)

    def test_includes_diagonal_endpoints_on_both_table_frames(self):
        page = {
            "width": 100.0,
            "height": 600.0,
            "lines": [],
            "vectors": [
                {"x0": 10.0, "y0": 140.0, "x1": 30.0, "y1": 180.0, "stroke": None, "linewidth": 0.72},
                {"x0": 30.0, "y0": 180.0, "x1": 50.0, "y1": 140.0, "stroke": None, "linewidth": 0.72},
            ],
        }
        band = {"top": 420.0, "bottom": 460.0, "height": 40.0}
        self.assertEqual(
            _table_boundaries(page, 400.0, band, [], [], []),
            [10.0, 30.0, 50.0],
        )

    def test_reads_diagonal_signs_and_merges_flat_fragments(self):
        height = 600.0
        vectors = [
            {"x0": 10.0, "y0": 140.0, "x1": 30.0, "y1": 180.0, "stroke": None, "linewidth": 0.72},
            {"x0": 30.0, "y0": 180.0, "x1": 50.0, "y1": 140.0, "stroke": None, "linewidth": 0.72},
            {"x0": 50.0, "y0": 160.0, "x1": 60.0, "y1": 160.0, "stroke": None, "linewidth": 0.72},
            {"x0": 60.0, "y0": 160.0, "x1": 70.0, "y1": 160.0, "stroke": None, "linewidth": 0.72},
            {"x0": 70.0, "y0": 140.0, "x1": 90.0, "y1": 180.0, "stroke": None, "linewidth": 0.72},
        ]
        chars: list[dict] = []
        order = 0
        for text, x, top in [
            ("1,2", 16.0, 426.0), ("200", 16.0, 448.0),
            ("2,3", 36.0, 426.0), ("200", 36.0, 448.0),
            ("200", 56.0, 448.0),
            ("0,4", 76.0, 426.0), ("200", 76.0, 448.0),
        ]:
            token = numeric_chars(text, x, top, order)
            chars.extend(token)
            order += len(token)
        page = {
            "page_number": 1,
            "width": 100.0,
            "height": height,
            "words": [{"text": str(value), "x0": 0, "x1": 10, "top": 400, "bottom": 410} for value in range(10, 14)],
            "chars": chars,
            "vectors": vectors,
            "lines": [
                {"x0": x, "x1": x, "top": 420.0, "bottom": 460.0, "stroke": None, "linewidth": 0.72}
                for x in (10.0, 30.0, 50.0, 70.0, 90.0)
            ],
        }
        axis = {
            "slope": 10.0,
            "intercept": 900.0,
            "max_residual_m": 0.0,
            "labels": [{"km": value, "x": 10.0 + index * 10, "top": 400.0} for index, value in enumerate(range(10, 14))],
        }
        self.assertGreater(score_page(page, axis), 90)
        result = extract_page(page, axis)
        self.assertEqual(
            [(cell["start_m"], cell["end_m"], cell["grade"]) for cell in result["cells"]],
            [(1000, 1200, 1.2), (1200, 1400, -2.3), (1400, 1600, 0.0), (1600, 1800, 0.4)],
        )
        self.assertEqual(result["cells"][2]["source_vectors"], 2)
        self.assertEqual(result["cells"][0]["axis_slope"], 10.0)

        descending_axis = {**axis, "slope": -10.0, "intercept": 1900.0}
        descending = extract_page(page, descending_axis)
        grades_by_magnitude = {
            cell["magnitude"]: cell["grade"]
            for cell in descending["cells"]
        }
        self.assertEqual(grades_by_magnitude[1.2], -1.2)
        self.assertEqual(grades_by_magnitude[2.3], 2.3)


if __name__ == "__main__":
    unittest.main()
