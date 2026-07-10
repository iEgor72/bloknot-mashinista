from __future__ import annotations

import unittest

from tools.regime_profile_builder.axis import coordinate_at_x, extract_km_axis, fit_km_axis
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

    def test_axis_reports_robust_residual_for_one_displaced_cad_label(self):
        labels = [
            {"km": 208 - index, "x": 100.0 + index * 56.0, "top": 20.0}
            for index in range(13)
        ]
        labels[4]["x"] += 7.0
        axis = fit_km_axis(labels)
        self.assertGreater(axis["max_residual_m"], axis["p90_residual_m"])
        self.assertLess(axis["p90_residual_m"], 50.0)

    def test_axis_accepts_single_digit_railway_kilometres(self):
        labels = extract_km_axis([
            {
                "text": str(9 + index),
                "x0": 45.0 + index * 100.0,
                "x1": 55.0 + index * 100.0,
                "top": 10.0,
            }
            for index in range(5)
        ], 600.0)
        axis = fit_km_axis(labels)
        self.assertEqual(axis["labels"][0]["km"], 9)
        self.assertEqual(axis["direction"], "ascending")

    def test_axis_prefers_real_kilometre_row_over_single_digit_noise(self):
        words = []
        for index in range(4):
            words.append({
                "text": str(index + 1),
                "x0": 10.0 + index * 20.0,
                "x1": 20.0 + index * 20.0,
                "top": 5.0,
            })
        for index in range(6):
            words.append({
                "text": str(100 + index),
                "x0": 40.0 + index * 50.0,
                "x1": 60.0 + index * 50.0,
                "top": 30.0 + (index % 2) * 0.3,
            })
        labels = extract_km_axis(words, 600.0)
        self.assertEqual([item["km"] for item in labels], list(range(100, 106)))

    def test_axis_recovers_overlaid_cad_labels_from_character_source_order(self):
        words = []
        chars = []
        order = 0

        def add_char_token(text, x, top):
            nonlocal order
            for index, digit in enumerate(text):
                x0 = x + index * 6.7
                chars.append({
                    "text": digit,
                    "order": order,
                    "x0": x0,
                    "x1": x0 + 6.6,
                    "top": top,
                    "bottom": top + 12.0,
                    "size": 12.0,
                    "upright": True,
                })
                order += 1

        overlaid_noise = {204: "148", 202: "85", 198: "156", 196: "93"}
        for index, kilometre in enumerate(range(208, 195, -1)):
            x = 90.0 + index * 56.0
            top = 19.0 + (index % 4) * 0.45
            if kilometre in overlaid_noise:
                noise = overlaid_noise[kilometre]
                add_char_token(noise, x - 3.0, top - 0.3)
                words.append({
                    "text": f"{noise}{kilometre}",
                    "x0": x - 3.0,
                    "x1": x + 20.0,
                    "top": top,
                })
            elif kilometre >= 205:
                words.append({
                    "text": str(kilometre),
                    "x0": x,
                    "x1": x + 20.0,
                    "top": top,
                })
            add_char_token(str(kilometre), x, top)

        labels = extract_km_axis(words, 600.0, chars)
        self.assertEqual(
            [item["km"] for item in labels],
            list(range(208, 195, -1)),
        )

    def test_axis_keeps_cleaner_word_run_when_char_run_is_not_better(self):
        words = []
        chars = []
        irregular_char_x = [15.0, 62.0, 132.0, 164.0, 252.0, 274.0]
        order = 0
        for index, kilometre in enumerate(range(100, 106)):
            word_x = 20.0 + index * 50.0
            words.append({
                "text": str(kilometre),
                "x0": word_x - 10.0,
                "x1": word_x + 10.0,
                "top": 20.0,
            })
            for digit_index, digit in enumerate(str(kilometre)):
                x0 = irregular_char_x[index] + digit_index * 6.7
                chars.append({
                    "text": digit,
                    "order": order,
                    "x0": x0,
                    "x1": x0 + 6.6,
                    "top": 20.0,
                    "bottom": 32.0,
                    "size": 12.0,
                    "upright": True,
                })
                order += 1

        labels = extract_km_axis(words, 600.0, chars)
        self.assertEqual([item["km"] for item in labels], list(range(100, 106)))
        self.assertEqual(labels[0]["x"], 20.0)

    def test_axis_accepts_zero_kilometre(self):
        labels = extract_km_axis([
            {
                "text": str(index),
                "x0": 45.0 + index * 100.0,
                "x1": 55.0 + index * 100.0,
                "top": 10.0,
            }
            for index in range(5)
        ], 600.0)
        self.assertEqual(labels[0]["km"], 0)

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
