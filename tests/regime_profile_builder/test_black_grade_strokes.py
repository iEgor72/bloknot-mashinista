from __future__ import annotations

import unittest
from unittest.mock import patch

from tools.regime_profile_builder.adapters import black_grade_strokes as adapter


def compact_stroke(
    left: float,
    right: float,
    left_y: float,
    right_y: float,
    magnitude: float,
) -> dict:
    return {
        "vector": {
            "x0": right,
            "y0": right_y,
            "x1": left,
            "y1": left_y,
        },
        "left": left,
        "right": right,
        "center": (left + right) / 2,
        "mid_y": (left_y + right_y) / 2,
        "row_y": (left_y + right_y) / 2,
        "test_magnitude": magnitude,
    }


def trace_segment(left: float, right: float, left_y: float, right_y: float) -> dict:
    return {
        "vector": {"linewidth": 2.0},
        "x0": left,
        "y0": left_y,
        "x1": right,
        "y1": right_y,
        "left": left,
        "right": right,
    }


def extract(stroke: dict, trace: list[dict], axis_slope: float = -10.0) -> dict:
    diagnostics = {
        "row_y": stroke["row_y"],
        "row_spread": 0.0,
        "trace_coverage_ratio": 1.0 if trace else 0.0,
    }
    page = {
        "page_number": 1,
        "width": 100.0,
        "height": 600.0,
        "chars": [],
        "words": [],
        "vectors": [],
    }
    axis = {
        "slope": axis_slope,
        "intercept": 1300.0 if axis_slope < 0 else 900.0,
        "max_residual_m": 0.0,
    }

    def labels(_page: dict, item: dict, _row_y: float) -> list[dict]:
        magnitude = float(item["test_magnitude"])
        return [
            {
                "magnitude": magnitude,
                "raw": str(magnitude).replace(".", ","),
                "kind": "pdf_word",
                "character_count": None,
            }
        ]

    with (
        patch.object(adapter, "_layout", return_value=([stroke], trace, diagnostics)),
        patch.object(adapter, "_label_candidates", side_effect=labels),
    ):
        return adapter.extract_page(page, axis)["cells"][0]


class BlackGradeStrokesTest(unittest.TestCase):
    def test_compact_stroke_orientation_is_primary_sign(self):
        rising = compact_stroke(10.0, 20.0, 140.0, 162.0, 1.0)
        falling = compact_stroke(10.0, 20.0, 162.0, 140.0, 1.0)
        horizontal = compact_stroke(10.0, 20.0, 150.0, 150.1, 0.0)

        self.assertEqual(adapter._table_stroke_sign(rising, -10.0)[0], -1)
        self.assertEqual(adapter._table_stroke_sign(falling, -10.0)[0], 1)
        self.assertEqual(adapter._table_stroke_sign(horizontal, -10.0)[0], 0)

    def test_rising_stroke_is_positive_on_an_ascending_axis(self):
        stroke = compact_stroke(10.0, 20.0, 140.0, 162.0, 0.3)

        cell = extract(stroke, [], axis_slope=10.0)

        self.assertEqual(cell["table_stroke_orientation"], 1)
        self.assertEqual(cell["table_stroke_sign"], 1)
        self.assertEqual(cell["grade"], 0.3)
        self.assertEqual(cell["confidence"], "pdf_vector_confirmed")

    def test_strong_trace_disagreement_flags_conflict_without_flipping_grade(self):
        stroke = compact_stroke(10.0, 20.0, 140.0, 162.0, 2.0)
        # With a descending kilometre axis this thick trace says plus, while
        # the compact rising-right table stroke says minus.
        trace = [trace_segment(10.0, 20.0, 200.0, 180.0)]

        cell = extract(stroke, trace)

        self.assertEqual(cell["grade"], -2.0)
        self.assertEqual(cell["table_stroke_sign"], -1)
        self.assertEqual(cell["trace_sign"], 1)
        self.assertIn("table_trace_sign_conflict", cell["review_reasons"])
        self.assertEqual(cell["confidence"], "needs_review")

    def test_small_grade_is_confirmed_when_trace_is_too_weak_for_qa(self):
        stroke = compact_stroke(10.0, 20.0, 140.0, 162.0, 0.1)
        trace = [trace_segment(10.0, 20.0, 200.0, 199.99)]

        cell = extract(stroke, trace)

        self.assertEqual(cell["grade"], -0.1)
        self.assertEqual(cell["trace_sign"], 0)
        self.assertNotIn("weak_trace_sign", cell["review_reasons"])
        self.assertNotIn("table_trace_sign_conflict", cell["review_reasons"])
        self.assertEqual(cell["confidence"], "pdf_vector_confirmed")

    def test_small_positive_grade_does_not_require_the_thick_trace(self):
        stroke = compact_stroke(10.0, 20.0, 162.0, 140.0, 0.2)

        cell = extract(stroke, [])

        self.assertEqual(cell["grade"], 0.2)
        self.assertEqual(cell["table_stroke_sign"], 1)
        self.assertIsNone(cell["trace_sign"])
        self.assertEqual(cell["review_reasons"], [])
        self.assertEqual(cell["confidence"], "pdf_vector_confirmed")

    def test_horizontal_table_stroke_is_zero_without_trace(self):
        stroke = compact_stroke(10.0, 20.0, 150.0, 150.0, 0.0)

        cell = extract(stroke, [])

        self.assertEqual(cell["grade"], 0.0)
        self.assertEqual(cell["table_stroke_sign"], 0)
        self.assertEqual(cell["confidence"], "pdf_vector_confirmed")


if __name__ == "__main__":
    unittest.main()
