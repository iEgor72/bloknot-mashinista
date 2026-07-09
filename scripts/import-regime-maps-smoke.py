from __future__ import annotations

import importlib.util
import sys
import types
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
IMPORTER_PATH = ROOT / "scripts" / "import-regime-maps.py"


def load_importer():
    spec = importlib.util.spec_from_file_location("import_regime_maps", IMPORTER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import {IMPORTER_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakePage:
    height = 100.0
    lines = [
        {
            # bbox values deliberately lose the original descending direction.
            "x0": 10.0,
            "y0": 20.0,
            "x1": 30.0,
            "y1": 40.0,
            "pts": [(30.0, 60.0), (10.0, 80.0)],
            "stroking_color": 0.0,
            "linewidth": 2.0,
        }
    ]
    curves = []

    def extract_words(self, **_kwargs):
        return []

    def extract_text(self, **_kwargs):
        return ""


class FakePdf:
    pages = [FakePage()]

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


def main() -> None:
    importer = load_importer()
    real_pdfplumber = sys.modules.get("pdfplumber")
    sys.modules["pdfplumber"] = types.SimpleNamespace(open=lambda _path: FakePdf())
    try:
        pages = importer.load_pdf_pages(Path("orientation-fixture.pdf"))
    finally:
        if real_pdfplumber is None:
            sys.modules.pop("pdfplumber", None)
        else:
            sys.modules["pdfplumber"] = real_pdfplumber

    vector = pages[0][3][0]
    expected = {"x0": 30.0, "y0": 40.0, "x1": 10.0, "y1": 20.0}
    actual = {key: vector[key] for key in expected}
    if actual != expected:
        raise AssertionError(f"oriented pts were not preserved: expected {expected}, got {actual}")
    print("Regime-map vector orientation smoke passed.")


if __name__ == "__main__":
    main()
