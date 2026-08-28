import importlib.util
import io
import tarfile
import tempfile
import unittest
import zlib
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "import-poekhali-android-backup.py"
SPEC = importlib.util.spec_from_file_location("android_backup_import", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class AndroidBackupImportSafetyTests(unittest.TestCase):
    def test_rejects_excessive_compression_ratio(self):
        compressed = zlib.compress(b"0" * (1024 * 1024), level=9)
        with self.assertRaisesRegex(ValueError, "compression ratio"):
            MODULE.bounded_zlib_decompress(compressed)

    def test_rejects_unsafe_map_id(self):
        for value in ("../outside", "Map Name", "a/b", ""):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    MODULE.validate_map_id(value)

    def test_reads_small_uncompressed_android_backup(self):
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode="w") as archive:
            payload = b"<data/>"
            info = tarfile.TarInfo("apps/example/app_emap/data.xml")
            info.size = len(payload)
            archive.addfile(info, io.BytesIO(payload))
        backup = b"ANDROID BACKUP\n5\n0\nnone\n" + buffer.getvalue()
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "safe.ab"
            path.write_bytes(backup)
            restored, kind = MODULE.read_backup_payload(path)
        self.assertEqual(kind, "android-backup-v5")
        self.assertEqual(restored, buffer.getvalue())


if __name__ == "__main__":
    unittest.main()
