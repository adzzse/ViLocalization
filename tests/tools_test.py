import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
import unicodedata


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("asar", ROOT / "vendor/asar/unpack_asar.py")
asar = importlib.util.module_from_spec(spec)
spec.loader.exec_module(asar)


def archive(directory, files=None, payload=b"hello"):
    header = json.dumps({"files": files or {"hello.txt": {"size": 5, "offset": "0"}}}).encode("utf-8")
    padding = b"\0" * (-len(header) % 4)
    pickle = struct.pack("<II", 4 + len(header) + len(padding), len(header)) + header + padding
    result = directory / "app.asar"
    result.write_bytes(struct.pack("<II", 4, len(pickle)) + pickle + payload)
    return result


class AsarTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="vilocalization-asar-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.output = self.base / "decoded"

    def test_nested_utf8_files_extract_without_changing_source(self):
        target = "Chào thế giới".encode("utf-8")
        source = archive(self.base, {"data": {"files": {"text.txt": {"size": len(target), "offset": "0"}}}}, target)
        before = hashlib.sha256(source.read_bytes()).hexdigest()
        self.assertEqual(asar.extract(source, self.output), 0)
        self.assertEqual((self.output / "data/text.txt").read_bytes(), target)
        self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), before)

    def test_existing_output_is_not_overwritten(self):
        source = archive(self.base)
        self.output.mkdir()
        saved = self.output / "hello.txt"
        saved.write_text("user edit", encoding="utf-8")
        with self.assertRaises(FileExistsError):
            asar.extract(source, self.output)
        self.assertEqual(saved.read_text(encoding="utf-8"), "user edit")

    def test_cli_runs_without_an_app_from_an_unrelated_directory(self):
        source = archive(self.base)
        command = [sys.executable, "-X", "utf8", str(ROOT / "vendor/asar/unpack_asar.py"), str(source), str(self.output)]
        result = subprocess.run(command, cwd=self.base, capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual((self.output / "hello.txt").read_bytes(), b"hello")
        result = subprocess.run(command, cwd=self.base, capture_output=True, text=True, encoding="utf-8")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.output / "hello.txt").read_bytes(), b"hello")

    def test_unsafe_or_ambiguous_paths_fail_before_any_output(self):
        for index, name in enumerate(("../outside.txt", "C:\\outside.txt", "file.txt:stream", "CON.txt", "trailing.", "bad?.txt", "bad\x01.txt")):
            with self.subTest(name=name):
                output = self.base / f"decoded-{index}"
                source = archive(self.base, {"hello.txt": {"size": 5, "offset": "0"}, name: {"size": 0, "offset": "0"}})
                with self.assertRaises(ValueError):
                    asar.extract(source, output)
                self.assertFalse(output.exists())
        source = archive(self.base, {"a": {"size": 0, "offset": "0"}, "A": {"size": 0, "offset": "0"}})
        with self.assertRaises(ValueError):
            asar.extract(source, self.output)
        self.assertFalse(self.output.exists())

    def test_invalid_ranges_fail_before_any_output(self):
        for entry in ({"size": -1, "offset": "0"}, {"size": 1, "offset": "-1"}, {"size": 99, "offset": "0"}):
            with self.subTest(entry=entry):
                source = archive(self.base, {"first.txt": {"size": 5, "offset": "0"}, "bad.txt": entry})
                with self.assertRaises(ValueError):
                    asar.extract(source, self.output)
                self.assertFalse(self.output.exists())

    def test_link_and_missing_unpacked_files_are_not_reported_as_complete(self):
        for entry in ({"link": "../outside"}, {"unpacked": True, "size": 5}):
            source = archive(self.base, {"external.txt": entry})
            with self.assertRaises((ValueError, FileNotFoundError)):
                asar.extract(source, self.output)
            self.assertFalse(self.output.exists())

    def test_unpacked_sidecar_is_copied(self):
        sidecar = self.base / "app.asar.unpacked"
        sidecar.mkdir()
        (sidecar / "external.txt").write_bytes(b"sidecar")
        source = archive(self.base, {"external.txt": {"unpacked": True, "size": 7}})
        self.assertEqual(asar.extract(source, self.output, sidecar), 0)
        self.assertEqual((self.output / "external.txt").read_bytes(), b"sidecar")

    def test_wrong_unpacked_size_is_rejected_before_output(self):
        sidecar = self.base / "sidecar"
        sidecar.mkdir()
        (sidecar / "external.txt").write_bytes(b"xy")
        for index, size in enumerate((10, -1, "2", True)):
            with self.subTest(size=size):
                output = self.base / f"decoded-{index}"
                source = archive(self.base, {"external.txt": {"unpacked": True, "size": size}})
                with self.assertRaises(ValueError):
                    asar.extract(source, output, sidecar)
                self.assertFalse(output.exists())

    def test_truncated_header_and_bad_json_length_are_rejected(self):
        for data in (b"bad", struct.pack("<II", 4, 99), struct.pack("<IIII", 4, 8, 4, 999)):
            source = self.base / "app.asar"
            source.write_bytes(data)
            with self.assertRaises(ValueError):
                asar.extract(source, self.output)
            self.assertFalse(self.output.exists())


class FittingTests(unittest.TestCase):
    def test_original_upstream_regressions_pass_from_an_unrelated_directory(self):
        with tempfile.TemporaryDirectory(prefix="vilocalization-fitting-") as directory:
            result = subprocess.run([sys.executable, "-X", "utf8", str(ROOT / "vendor/text-fitting/test_layout.py")],
                                    cwd=directory, capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("0 failures", result.stdout)

    def test_vietnamese_fitting_is_read_only_and_returns_an_explicit_estimate(self):
        with tempfile.TemporaryDirectory(prefix="vilocalization-fitting-") as directory:
            source = Path(directory) / "text.txt"
            original = unicodedata.normalize("NFD", "Chào mừng bạn trở lại thế giới kỳ diệu.")
            source.write_text(original, encoding="utf-8")
            result = subprocess.run([sys.executable, "-X", "utf8", str(ROOT / "scripts/fit_text.py"),
                                     "--input", str(source), "--width", "22", "--lines", "3"],
                                    cwd=directory, capture_output=True, text=True, encoding="utf-8")
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads(result.stdout)
            self.assertTrue(report["approximate"])
            self.assertTrue(report["fits"])
            self.assertLessEqual(report["rows"], 3)
            self.assertLessEqual(report["widest_cells"], 22)
            self.assertTrue(unicodedata.is_normalized("NFC", report["text"]))
            self.assertEqual(source.read_text(encoding="utf-8"), original)

    def test_unfittable_text_and_invalid_input_have_failure_exit_codes(self):
        with tempfile.TemporaryDirectory(prefix="vilocalization-fitting-") as directory:
            source = Path(directory) / "text.txt"
            source.write_text("unbreakableword", encoding="utf-8")
            command = [sys.executable, "-X", "utf8", str(ROOT / "scripts/fit_text.py"), "--input", str(source), "--width", "3", "--lines", "1"]
            result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8")
            self.assertEqual(result.returncode, 1)
            self.assertFalse(json.loads(result.stdout)["fits"])
            source.write_bytes(b"\xff")
            self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)

    def test_tight_two_word_and_more_than_four_row_layouts_are_found(self):
        with tempfile.TemporaryDirectory(prefix="vilocalization-fitting-") as directory:
            source = Path(directory) / "text.txt"
            for message, width, rows in (("abcdefghij klmnopqrst", 10, 2), ("one two", 3, 2), ("one two six ten sun", 3, 5)):
                with self.subTest(message=message):
                    source.write_text(message, encoding="utf-8")
                    result = subprocess.run([sys.executable, "-X", "utf8", str(ROOT / "scripts/fit_text.py"),
                                             "--input", str(source), "--width", str(width), "--lines", str(rows)],
                                            capture_output=True, text=True, encoding="utf-8")
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    report = json.loads(result.stdout)
                    self.assertTrue(report["fits"])
                    self.assertLessEqual(report["widest_cells"], width)
                    self.assertLessEqual(report["rows"], rows)
                    self.assertEqual(report["text"].replace("\n", " "), message)


if __name__ == "__main__":
    unittest.main()
