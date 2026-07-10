import unittest

from tools.regime_profile_builder.adapters.blue_bottom_table import (
    _assign_tokens_to_cells,
    _recover_trace_edge_dividers,
    _source_order_numeric_tokens,
    extract_page,
)


def _char(text, order, x0, x1, top, bottom):
    return {
        "text": text,
        "order": order,
        "x0": x0,
        "x1": x1,
        "top": top,
        "bottom": bottom,
        "upright": True,
        "size": bottom - top,
    }


class BlueBottomTableSourceOrderTests(unittest.TestCase):
    def test_source_order_recovers_rotated_tokens_and_excludes_service_row(self):
        page = {
            "chars": [
                # Geometry runs bottom-to-top, but PDF source order is semantic.
                _char("0", 0, 2.0, 8.0, 30.0, 35.0),
                _char(",", 1, 2.0, 8.0, 26.0, 30.0),
                _char("6", 2, 2.0, 8.0, 21.0, 26.0),
                _char("3", 10, 12.0, 18.0, 30.0, 35.0),
                _char("0", 11, 12.0, 18.0, 26.0, 30.0),
                _char("0", 12, 12.0, 18.0, 21.0, 26.0),
                # This parseable service-row value is below the actual frame.
                _char("9", 20, 22.0, 28.0, 51.0, 56.0),
                _char("4", 21, 22.0, 28.0, 56.0, 61.0),
                _char("5", 22, 22.0, 28.0, 61.0, 66.0),
            ]
        }

        magnitudes, lengths = _source_order_numeric_tokens(
            page,
            {"top": 10.0, "bottom": 50.0},
            0.0,
            30.0,
        )

        self.assertEqual([(token["text"], token["value"]) for token in magnitudes], [("0,6", 0.6)])
        self.assertEqual([(token["text"], token["value"]) for token in lengths], [("300", 300)])

    def test_tokens_near_boundary_get_one_nearest_owner(self):
        assignments = _assign_tokens_to_cells(
            [{"text": "1,0", "x": 4.9}, {"text": "2,0", "x": 5.2}],
            [0.0, 5.0, 10.0],
        )

        self.assertEqual([[token["text"] for token in cell] for cell in assignments], [["1,0"], ["2,0"]])

    def test_recovers_missing_outer_divider_from_trace_and_printed_cell(self):
        page = {
            "chars": [
                _char("3", 0, 17.0, 23.0, 16.0, 21.0),
                _char(",", 1, 17.0, 23.0, 21.0, 25.0),
                _char("8", 2, 17.0, 23.0, 25.0, 30.0),
                _char("4", 10, 17.0, 23.0, 31.0, 35.0),
                _char("0", 11, 17.0, 23.0, 35.0, 39.0),
                _char("0", 12, 17.0, 23.0, 39.0, 43.0),
            ]
        }
        trace = [
            {"x0": 10.0, "x1": 50.0, "y0": 5.0, "y1": 6.0},
            {"x0": 50.0, "x1": 90.0, "y0": 6.0, "y1": 7.0},
        ]

        dividers, diagnostics = _recover_trace_edge_dividers(
            page,
            {"slope": -20.0},
            [30.0, 50.0, 70.0, 90.0],
            trace,
            {"top": 10.0, "bottom": 50.0},
        )

        self.assertEqual(dividers, [10.0, 30.0, 50.0, 70.0, 90.0])
        self.assertEqual(diagnostics[0]["side"], "left")
        self.assertEqual(diagnostics[0]["printed_length_m"], 400)

    def test_recovers_missing_right_divider_symmetrically(self):
        page = {
            "chars": [
                _char("3", 0, 77.0, 83.0, 16.0, 21.0),
                _char(",", 1, 77.0, 83.0, 21.0, 25.0),
                _char("8", 2, 77.0, 83.0, 25.0, 30.0),
                _char("4", 10, 77.0, 83.0, 31.0, 35.0),
                _char("0", 11, 77.0, 83.0, 35.0, 39.0),
                _char("0", 12, 77.0, 83.0, 39.0, 43.0),
            ]
        }
        trace = [
            {"x0": 10.0, "x1": 50.0, "y0": 5.0, "y1": 6.0},
            {"x0": 50.0, "x1": 90.0, "y0": 6.0, "y1": 7.0},
        ]

        dividers, diagnostics = _recover_trace_edge_dividers(
            page,
            {"slope": -20.0},
            [10.0, 30.0, 50.0, 70.0],
            trace,
            {"top": 10.0, "bottom": 50.0},
        )

        self.assertEqual(dividers, [10.0, 30.0, 50.0, 70.0, 90.0])
        self.assertEqual(diagnostics[0]["side"], "right")
        self.assertEqual(diagnostics[0]["printed_length_m"], 400)

    def test_does_not_recover_from_disconnected_outer_component(self):
        page = {
            "chars": [
                _char("3", 0, 17.0, 23.0, 16.0, 21.0),
                _char(",", 1, 17.0, 23.0, 21.0, 25.0),
                _char("8", 2, 17.0, 23.0, 25.0, 30.0),
                _char("4", 10, 17.0, 23.0, 31.0, 35.0),
                _char("0", 11, 17.0, 23.0, 35.0, 39.0),
                _char("0", 12, 17.0, 23.0, 39.0, 43.0),
            ]
        }
        trace = [
            {"x0": 10.0, "x1": 60.0, "y0": 50.0, "y1": 51.0},
            {"x0": 30.0, "x1": 50.0, "y0": 5.0, "y1": 6.0},
            {"x0": 50.0, "x1": 90.0, "y0": 6.0, "y1": 7.0},
        ]

        dividers, diagnostics = _recover_trace_edge_dividers(
            page,
            {"slope": -20.0},
            [30.0, 50.0, 70.0, 90.0],
            trace,
            {"top": 10.0, "bottom": 50.0},
        )

        self.assertEqual(dividers, [30.0, 50.0, 70.0, 90.0])
        self.assertEqual(diagnostics, [])

    def test_extract_uses_unique_char_fallback_but_keeps_valid_word(self):
        divider_xs = [10.0, 30.0, 50.0, 70.0, 90.0]
        page = {
            "page_number": 1,
            "width": 100.0,
            "height": 160.0,
            "words": [
                {"text": "10", "x0": 47.0, "x1": 53.0, "top": 100.0, "bottom": 108.0},
                {"text": "1,2", "x0": 37.0, "x1": 43.0, "top": 115.0, "bottom": 123.0},
            ],
            "chars": [
                _char("0", 0, 17.0, 23.0, 128.0, 133.0),
                _char(",", 1, 17.0, 23.0, 124.0, 128.0),
                _char("6", 2, 17.0, 23.0, 119.0, 124.0),
                _char("3", 10, 17.0, 23.0, 139.0, 144.0),
                _char("0", 11, 17.0, 23.0, 135.0, 139.0),
                _char("0", 12, 17.0, 23.0, 130.0, 135.0),
                # A conflicting char token in the second cell must not replace the word.
                _char("9", 20, 37.0, 43.0, 128.0, 133.0),
                _char(",", 21, 37.0, 43.0, 124.0, 128.0),
                _char("9", 22, 37.0, 43.0, 119.0, 124.0),
                # Old km_top+66 filtering would admit this service-row number.
                _char("9", 30, 57.0, 63.0, 147.0, 151.0),
                _char("4", 31, 57.0, 63.0, 151.0, 155.0),
                _char("5", 32, 57.0, 63.0, 155.0, 159.0),
            ],
            "lines": [
                {"x0": x, "x1": x, "top": 110.0, "bottom": 145.0}
                for x in divider_xs
            ],
            "vectors": [
                {
                    "x0": 10.0,
                    "x1": 50.0,
                    "y0": 80.0,
                    "y1": 85.0,
                    "stroke": (0.0, 0.439, 0.753),
                    "linewidth": 0.75,
                },
                {
                    "x0": 50.0,
                    "x1": 90.0,
                    "y0": 85.0,
                    "y1": 82.0,
                    "stroke": (0.0, 0.439, 0.753),
                    "linewidth": 0.75,
                },
            ],
        }
        axis_fit = {
            "slope": 100.0,
            "intercept": 0.0,
            "labels": [{"km": 10, "x": 50.0}],
        }

        result = extract_page(page, axis_fit)

        self.assertEqual(result["cells"][0]["magnitude"], 0.6)
        self.assertEqual(result["cells"][0]["printed_length_m"], 300)
        self.assertEqual(result["cells"][0]["magnitude_text"]["source"], "pdf_chars")
        self.assertEqual(result["cells"][1]["magnitude"], 1.2)
        self.assertNotIn("source", result["cells"][1]["magnitude_text"])
        self.assertIsNone(result["cells"][2]["printed_length_m"])
        self.assertEqual(result["diagnostics"]["source_char_magnitude_fallbacks"], 1)
        self.assertEqual(result["diagnostics"]["source_char_length_fallbacks"], 1)


if __name__ == "__main__":
    unittest.main()
