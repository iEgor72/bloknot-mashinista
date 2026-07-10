from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from tools.regime_profile_builder.review import ensure_safe_output


class SafetyTest(unittest.TestCase):
    def test_product_section_directory_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            product = root / "assets" / "tracker" / "sections" / "run"
            with self.assertRaises(ValueError):
                ensure_safe_output(product, root)

    def test_tmp_output_is_allowed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "tmp" / "pdfs" / "run"
            self.assertEqual(ensure_safe_output(output, root), output.resolve())


if __name__ == "__main__":
    unittest.main()
