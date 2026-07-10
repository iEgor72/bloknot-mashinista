from __future__ import annotations

import unittest

from tools.regime_profile_builder.axis import coordinate_at_x, fit_km_axis
from tools.regime_profile_builder.adapters.blue_bottom_table import _calibrate_to_km_blocks
from tools.regime_profile_builder.trace import dominant_slope, select_wide_components


class AxisTraceTest(unittest.TestCase):
    def test_axis_supports_both_directions(self):
        ascending = fit_km_axis([
            {"km": 100 + index, "x": 50.0 + index * 100.0, "top": 10.0}
            for index in range(5)
        ])
        descending = fit_km_axis([
            {"km": 104 - index, "x": 50.0 + index * 100.0, "top": 10.0}
            for index in range(5)
        ])
        self.assertEqual(ascending["direction"], "ascending")
        self.assertEqual(descending["direction"], "descending")
        self.assertEqual(coordinate_at_x(ascending, 50.0), 100500)
        self.assertEqual(coordinate_at_x(descending, 50.0), 104500)
        self.assertLessEqual(ascending["max_residual_m"], 0.001)

    def test_trace_prefers_wide_connected_profile(self):
        vectors = [
            {"x0": 0.0, "y0": 10.0, "x1": 50.0, "y1": 20.0, "kind": "profile"},
            {"x0": 50.0, "y0": 20.0, "x1": 100.0, "y1": 30.0, "kind": "profile"},
            {"x0": 20.0, "y0": 80.0, "x1": 30.0, "y1": 90.0, "kind": "arrow"},
        ]
        trace = select_wide_components(vectors, lambda item: True, minimum_span=40)
        self.assertEqual(len(trace), 2)
        slope = dominant_slope(trace, 10.0, 90.0)
        self.assertIsNotNone(slope)
        self.assertAlmostEqual(slope["slope"], 0.2)

    def test_blue_ruler_uses_railway_kilometre_block_boundaries(self):
        calibrated = _calibrate_to_km_blocks(
            {
                "slope": 100.0,
                "intercept": 0.0,
                "labels": [
                    {"km": 3637, "x": 95.0, "top": 10.0},
                    {"km": 3638, "x": 105.0, "top": 10.0},
                    {"km": 3639, "x": 115.0, "top": 10.0},
                    {"km": 3640, "x": 125.0, "top": 10.0},
                ],
            },
            0.0,
            140.0,
        )
        self.assertEqual(calibrated["ruler_first_km"], 3628)
        self.assertEqual(calibrated["ruler_last_km"], 3641)
        self.assertEqual(coordinate_at_x(calibrated, 0.0), 3627900)
        self.assertEqual(coordinate_at_x(calibrated, 140.0), 3641900)

    def test_blue_ruler_keeps_partial_last_kilometre(self):
        calibrated = _calibrate_to_km_blocks(
            {
                "slope": 100.0,
                "intercept": 0.0,
                "labels": [
                    {"km": 3810, "x": 5.0, "top": 10.0},
                    {"km": 3811, "x": 15.0, "top": 10.0},
                    {"km": 3812, "x": 25.0, "top": 10.0},
                    {"km": 3813, "x": 35.0, "top": 10.0},
                ],
            },
            0.0,
            66.0,
            [float(value) for value in range(67)],
        )
        self.assertEqual(calibrated["ruler_picket_intervals"], 66)
        self.assertEqual(coordinate_at_x(calibrated, 0.0), 3809900)
        self.assertEqual(coordinate_at_x(calibrated, 66.0), 3816500)


if __name__ == "__main__":
    unittest.main()
