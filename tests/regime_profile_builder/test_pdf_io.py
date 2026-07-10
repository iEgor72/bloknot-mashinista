from __future__ import annotations

import sys
import tempfile
import types
import unittest
from pathlib import Path

from tools.regime_profile_builder.pdf_io import load_vector_pdf


class FakePage:
    width = 100.0
    height = 100.0
    chars = []
    lines = [
        {
            "x0": 10.0,
            "y0": 20.0,
            "x1": 30.0,
            "y1": 40.0,
            "top": 60.0,
            "bottom": 80.0,
            "pts": [(30.0, 60.0), (10.0, 80.0)],
            "stroking_color": (0.0, 0.0, 0.0),
            "linewidth": 2.0,
        }
    ]
    curves = []

    def extract_words(self, **_kwargs):
        return []


class FakePdf:
    pages = [FakePage()]

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


class PdfIoTest(unittest.TestCase):
    def test_oriented_pts_are_preserved(self):
        real_pdfplumber = sys.modules.get("pdfplumber")
        sys.modules["pdfplumber"] = types.SimpleNamespace(open=lambda _path: FakePdf())
        try:
            with tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "fixture.pdf"
                path.write_bytes(b"vector-fixture")
                document = load_vector_pdf(path)
        finally:
            if real_pdfplumber is None:
                sys.modules.pop("pdfplumber", None)
            else:
                sys.modules["pdfplumber"] = real_pdfplumber

        vector = document["pages"][0]["vectors"][0]
        actual = {key: vector[key] for key in ("x0", "y0", "x1", "y1")}
        self.assertEqual(actual, {"x0": 30.0, "y0": 40.0, "x1": 10.0, "y1": 20.0})


if __name__ == "__main__":
    unittest.main()
