from __future__ import annotations

import tempfile
import unittest
import json
from pathlib import Path

from tools.regime_profile_builder.review import ensure_safe_output, write_artifacts
from tools.regime_profile_builder.pipeline import load_config
from tools.regime_profile_builder.pdf_io import PdfBuilderError


class SafetyTest(unittest.TestCase):
    def test_force_rebuild_removes_stale_reviewed_profile_and_review_images(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "tmp" / "pdfs" / "run"
            review_dir = output / "review"
            review_dir.mkdir(parents=True)
            (output / "reviewed.profile.json").write_text("{}", encoding="utf-8")
            (output / "review-render.json").write_text("{}", encoding="utf-8")
            (review_dir / "001-stale.png").write_bytes(b"stale")
            (review_dir / "contact-sheet.png").write_bytes(b"stale")
            result = {
                "builder_version": "test",
                "config": {
                    "id": "fixture",
                    "pdf": str(root / "fixture.pdf"),
                    "range_start_m": 1000,
                    "range_end_m": 1100,
                    "allowed_profile_gaps": [],
                },
                "document": {
                    "fingerprint": {
                        "file_name": "fixture.pdf",
                        "sha256": "a" * 64,
                    },
                    "page_count": 1,
                },
                "summary": {
                    "raw_cells": 1,
                    "logical_elements": 1,
                    "coverage_start_m": 1000,
                    "coverage_end_m": 1100,
                    "review_issues": 0,
                    "blocked_issues": 0,
                    "profile_sha256": "b" * 64,
                    "confidence": {"pdf_vector_confirmed": 1},
                },
                "inspection": {"pages": [], "blocked": []},
                "page_diagnostics": [],
                "calibration": {},
                "elements": [{
                    "start_m": 1000,
                    "len_m": 100,
                    "grad_permille": 0.0,
                    "confidence": "pdf_vector_confirmed",
                }],
                "profile_cells": [],
                "issues": [],
                "seed_comparison": {"available": False},
            }
            write_artifacts(result, output, root, force=True)
            self.assertFalse((output / "reviewed.profile.json").exists())
            self.assertFalse((output / "review-render.json").exists())
            self.assertFalse(review_dir.exists())
            self.assertTrue((output / "draft.profile.json").is_file())

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

    def test_reconcile_seed_order_must_be_boolean(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text(json.dumps({
                "schema_version": "1.0",
                "id": "fixture",
                "pdf": "fixture.pdf",
                "km_start_m": 0,
                "km_end_m": 100,
                "reconcile_seed_order": "false",
            }), encoding="utf-8")
            with self.assertRaises(PdfBuilderError):
                load_config(path)

    def test_page_coordinate_offsets_must_follow_snap_grid(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text(json.dumps({
                "schema_version": "1.0",
                "id": "fixture",
                "pdf": "fixture.pdf",
                "km_start_m": 0,
                "km_end_m": 100,
                "snap_m": 100,
                "page_coordinate_offsets_m": {"11": 50},
            }), encoding="utf-8")
            with self.assertRaises(PdfBuilderError):
                load_config(path)

    def test_page_windows_accept_multiple_axis_overrides_for_one_page(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text(json.dumps({
                "schema_version": "1.0",
                "id": "fixture",
                "pdf": "fixture.pdf",
                "km_start_m": 0,
                "km_end_m": 10000,
                "snap_m": 100,
                "page_windows": [
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
                "page_priorities": {"27": 300},
            }), encoding="utf-8")
            config = load_config(path)
            self.assertEqual(len(config["page_windows"]), 2)
            self.assertEqual(config["page_priorities"], {"27": 300})

    def test_page_window_chainage_must_follow_snap_grid(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text(json.dumps({
                "schema_version": "1.0",
                "id": "fixture",
                "pdf": "fixture.pdf",
                "km_start_m": 0,
                "km_end_m": 1000,
                "snap_m": 100,
                "page_windows": [{"id": "bad", "page": 1, "keep_m": [50, 500]}],
            }), encoding="utf-8")
            with self.assertRaises(PdfBuilderError):
                load_config(path)

    def test_page_priorities_must_be_integer_map(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text(json.dumps({
                "schema_version": "1.0",
                "id": "fixture",
                "pdf": "fixture.pdf",
                "km_start_m": 0,
                "km_end_m": 1000,
                "page_priorities": {"31": "high"},
            }), encoding="utf-8")
            with self.assertRaises(PdfBuilderError):
                load_config(path)

    def test_allowed_profile_gap_requires_reason_and_exact_snap_range(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            payload = {
                "schema_version": "1.0",
                "id": "fixture",
                "pdf": "fixture.pdf",
                "km_start_m": 1000,
                "km_end_m": 2000,
                "snap_m": 100,
                "allowed_profile_gaps": [
                    {"start_m": 1200, "end_m": 1400, "reason": "chainage reset"},
                ],
            }
            path.write_text(json.dumps(payload), encoding="utf-8")
            config = load_config(path)
            self.assertEqual(config["allowed_profile_gaps"], payload["allowed_profile_gaps"])
            payload["allowed_profile_gaps"][0]["reason"] = ""
            path.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaises(PdfBuilderError):
                load_config(path)


if __name__ == "__main__":
    unittest.main()
