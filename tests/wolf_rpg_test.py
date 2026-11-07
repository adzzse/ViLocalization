import importlib.util
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("wolf_rpg", ROOT / "scripts/wolf_rpg.py")
wolf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wolf)


def common_fixture(encoding="utf-8"):
    """Synthetic WolfTL v0.6.2 CommonEvent/Command layout, without game assets."""
    integer = lambda value: struct.pack("<I", value)

    def string(value):
        encoded = value.encode(encoding)
        return integer(len(encoded) + 1) + encoded + b"\0"

    def command(code, strings, args=()):
        return (bytes([len(args) + 1]) + integer(code) + b"".join(integer(arg) for arg in args)
                + bytes([0, len(strings)]) + b"".join(string(value) for value in strings) + b"\0")

    commands = [command(101, ["Hello, \\v[1]!\nReady?"]), command(101, ["Hello, \\v[1]!\nReady?"]),
                command(102, ["Yes", "No"]), command(150, ["Status: \\v[2]"], [0x20, 1]),
                command(150, ["Picture/title.png"], [0, 1]), command(103, ["Developer comment"]),
                command(122, ["internal_identifier"], [0, 0])]
    event = (b"\x8e" + integer(0) + integer(0) + b"\0" * 7 + string("Synthetic")
             + integer(len(commands)) + b"".join(commands) + string("") + string("") + b"\x8f"
             + integer(0) * 4 + b"\0" * 29 + string("") * 100 + b"\x91" + string("") + b"\x91")
    marker = b"\xc9" if encoding == "utf-8" else b"\x8f"
    magic = b"\0W\0\0OLUFC\0" if encoding == "utf-8" else b"\0W\0\0OL\0FC\0"
    return magic + marker + integer(1) + event + marker


class CatalogTests(unittest.TestCase):
    def test_display_commands_keep_occurrences_while_database_and_identifiers_need_review(self):
        commands = [{"code": 101, "stringArgs": ["Same"]}, {"code": 101, "stringArgs": ["Same"]},
                    {"code": 102, "stringArgs": ["Yes", "No"]},
                    {"code": 150, "intArgs": [0x20], "stringArgs": ["Label"]},
                    {"code": 150, "intArgs": [0], "stringArgs": ["image.png"]},
                    {"code": 150, "intArgs": [0], "stringArgs": [r"Picture\face[happy.png"]},
                    {"code": 122, "stringArgs": ["identifier"]}, {"code": 103, "stringArgs": ["Comment"]}]
        dumps = {"common/0_A.json": {"id": 0, "commands": commands},
                 "mps/Title.json": {"events": [{"id": 7, "pages": [{"id": 2, "list": [commands[0]]}]}]},
                 "db/Items.json": {"types": [{"data": [{"name": "Sword", "data": [
                     {"name": "Label", "value": "Sword"}, {"name": "Attack", "value": 5},
                     {"name": "Unused", "value": "INVALID_IGNORE"}]}]}]},
                 "Game.json": {"Title": "Game", "TitlePlus": "v1.0", "MainFont": "Font", "SubFonts": ["Font"]}}
        rows = wolf.catalog(dumps)
        selected = [row for row in rows if row["selected"]]
        self.assertEqual(len(selected), 7)
        duplicates = [row for row in selected if row["en"] == "Same"]
        self.assertEqual(len(duplicates), 3)
        self.assertNotEqual(duplicates[0]["id"], duplicates[1]["id"])
        self.assertTrue(any(row["scene"] == "map:Title:event:7:page:2" for row in selected))
        review = {row["en"] for row in rows if not row["selected"]}
        self.assertEqual(review, {"image.png", r"Picture\face[happy.png", "identifier", "Comment", "Sword", "v1.0"})
        self.assertFalse(any(row["en"] in ("Font", "INVALID_IGNORE") for row in rows))

    def test_unknown_dump_and_duplicate_json_keys_fail(self):
        with self.assertRaises(ValueError):
            wolf.catalog({"unexpected.json": {}})
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "test.json"
            path.write_text('{"Title":"first","Title":"second"}', encoding="utf-8")
            with self.assertRaises(ValueError):
                wolf.read_json(path)

    def test_jsonl_preserves_unicode_line_separators_inside_strings(self):
        rows = [{"en": "First\u0085Second\u2028Third\u2029Fourth"}, {"en": "Another row"}]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "corpus.jsonl"
            wolf.write_rows(path, rows)
            self.assertEqual(wolf.read_rows(path), rows)

    def test_wolf_controls_include_nested_variables_formatting_and_timing(self):
        text = r"\>\EReady\N\f+[2]\-[1]\v1[30]\cself[\v[12]]\A+\A-\.\!\^<C>"
        tokens = wolf.control_tokens(text)
        self.assertEqual(tokens, [r"\>", r"\E", r"\N", r"\f+[2]", r"\-[1]", r"\v1[30]",
                                  r"\cself[\v[12]]", r"\A+", r"\A-", r"\.", r"\!", r"\^", "<C>"])
        self.assertEqual(wolf.control_tokens(r"\v[1"), [r"\v[1"])
        self.assertEqual(wolf.control_tokens(r"\v1[1] \v1[1]"), [r"\v1[1]", r"\v1[1]"])

    def test_identity_requires_the_complete_same_file_set_and_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            source, target = Path(directory) / "source", Path(directory) / "target"
            source.mkdir()
            target.mkdir()
            (source / "a.dat").write_bytes(b"a")
            for name, value in (("b.dat", b"a"), ("a.dat", b"b")):
                path = target / name
                path.write_bytes(value)
                with self.assertRaisesRegex(ValueError, "identity"):
                    wolf.require_identity(source, target)
                path.unlink()


@unittest.skipUnless(os.name == "nt", "Pinned native WolfTL requires Windows")
class NativeWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="vilocalization-wolf-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.data = self.base / "game/Data"
        (self.data / "BasicData").mkdir(parents=True)
        (self.data / "MapData").mkdir()
        self.source = self.data / "BasicData/CommonEvent.dat"
        self.source.write_bytes(common_fixture())
        code = "const {initProject}=await import(process.argv[1]); process.stdout.write(initProject('synthetic','en',process.argv[2]));"
        result = self.run_process(["node", "--input-type=module", "-e", code,
                                   (ROOT / "scripts/workflow.mjs").as_uri(), str(self.base / "projects")])
        self.work = Path(result.stdout)

    def run_process(self, command, success=True):
        result = subprocess.run(command, cwd=self.base, capture_output=True, text=True, encoding="utf-8")
        if success:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0)
        return result

    def extract(self):
        result = self.run_process([sys.executable, "-X", "utf8", str(ROOT / "scripts/wolf_rpg.py"),
                                   "extract", str(self.work), str(self.data)])
        return json.loads(result.stdout)

    def finalize(self, replacements=None):
        self.run_process(["node", str(ROOT / "scripts/workflow.mjs"), "batch", str(self.work)])
        source = {row["id"]: row for row in wolf.read_rows(self.work / "corpus.jsonl")}
        for batch in wolf.read_json(self.work / "B/manifest.json"):
            wolf.write_rows(self.work / "E" / (batch["name"] + ".part01.jsonl"),
                            [{"id": key, "vi": (replacements or {}).get(key, source[key]["en"])} for key in batch["ids"]])
        self.run_process(["node", str(ROOT / "scripts/workflow.mjs"), "check", str(self.work)])
        self.run_process(["node", str(ROOT / "scripts/workflow.mjs"), "finalize", str(self.work)])

    def test_actual_cli_roundtrip_and_vietnamese_rebuild_with_tokens_and_candidate_selection(self):
        original = self.source.read_bytes()
        report = self.extract()
        self.assertEqual(report["identity"], "byte-identical")
        self.assertEqual(report["selected"], 5)
        self.assertEqual(report["review_candidates"], 3)
        rows = wolf.read_rows(self.work / "corpus.jsonl")
        candidates = wolf.read_rows(self.work / "review-candidates.jsonl")
        reviewed = next(row for row in candidates if row["en"] == "internal_identifier")
        # Promote a reviewed value while keeping it unchanged, as a translator must for identifiers.
        wolf.write_rows(self.work / "corpus.jsonl", rows + [reviewed])
        replacements = {rows[0]["id"]: "Chào, \\v[1]!\nSẵn sàng chưa?",
                        rows[4]["id"]: "Trạng thái: \\v[2]"}
        self.finalize(replacements)
        output = self.work / "build/pilot"
        result = self.run_process([sys.executable, "-X", "utf8", str(ROOT / "scripts/wolf_rpg.py"),
                                   "rebuild", str(self.work), str(output)])
        self.assertEqual(json.loads(result.stdout)["changed_files"], 1)
        patched = output / "data/BasicData/CommonEvent.dat"
        self.assertIn(replacements[rows[0]["id"]].encode("utf-8"), patched.read_bytes())
        self.assertEqual(wolf.read_json(output / "patch-manifest.json")["readback"], "exact-json-match")
        self.assertEqual(self.source.read_bytes(), original)
        self.assertEqual((self.work / "original/wolf/data/BasicData/CommonEvent.dat").read_bytes(), original)
        self.run_process([sys.executable, str(ROOT / "scripts/wolf_rpg.py"), "rebuild", str(self.work), str(output)], success=False)

    def test_source_corpus_and_final_drift_are_rejected_before_output(self):
        self.extract()
        corpus = self.work / "corpus.jsonl"
        rows = wolf.read_rows(corpus)
        for mutation in (rows[1:], rows + [rows[0]], [{**rows[0], "en": "tampered"}] + rows[1:],
                         [{**rows[0], "id": "../outside"}] + rows[1:]):
            wolf.write_rows(corpus, mutation)
            with self.assertRaises(ValueError):
                wolf.load_source(self.work)
        wolf.write_rows(corpus, rows)
        backup = self.work / "original/wolf/data/BasicData/CommonEvent.dat"
        original = backup.read_bytes()
        backup.write_bytes(original + b"x")
        with self.assertRaisesRegex(ValueError, "hash changed"):
            wolf.load_source(self.work)
        backup.write_bytes(original)
        self.finalize()
        final = wolf.read_json(self.work / "final.json")
        final[rows[0]["id"]] = "Tampered"
        wolf.write_json(self.work / "final.json", final)
        output = self.work / "build/stale"
        with self.assertRaisesRegex(ValueError, "stale"):
            wolf.rebuild(self.work, output)
        self.assertFalse(output.exists())
        with self.assertRaisesRegex(ValueError, "build/"):
            wolf.rebuild(self.work, self.data / "override")

    def test_core_qa_rejects_removing_wolf_timing_and_substitution_tokens(self):
        original = self.source.read_bytes()
        text = r"\>\E\-[2]\v1[30] and \v1[31]\.\^"
        old = b"Status: \\v[2]"
        encoded = text.encode("utf-8")
        self.source.write_bytes(original.replace(struct.pack("<I", len(old) + 1) + old + b"\0",
                                                struct.pack("<I", len(encoded) + 1) + encoded + b"\0"))
        self.extract()
        self.run_process(["node", str(ROOT / "scripts/workflow.mjs"), "batch", str(self.work)])
        rows = {row["id"]: row for row in wolf.read_rows(self.work / "corpus.jsonl")}
        for batch in wolf.read_json(self.work / "B/manifest.json"):
            wolf.write_rows(self.work / "E" / (batch["name"] + ".part01.jsonl"),
                            [{"id": key, "vi": "Removed controls" if rows[key]["en"] == text else rows[key]["en"]}
                             for key in batch["ids"]])
        result = self.run_process(["node", str(ROOT / "scripts/workflow.mjs"), "check", str(self.work)], success=False)
        self.assertIn("literal token changed", result.stderr)
        for batch in wolf.read_json(self.work / "B/manifest.json"):
            wolf.write_rows(self.work / "E" / (batch["name"] + ".part01.jsonl"),
                            [{"id": key, "vi": text.replace(r"\.\^", r"\^\.") if rows[key]["en"] == text else rows[key]["en"]}
                             for key in batch["ids"]])
        result = self.run_process(["node", str(ROOT / "scripts/workflow.mjs"), "check", str(self.work)], success=False)
        self.assertIn("ordered token changed", result.stderr)
        swapped = text.replace("[30]", "[temporary]").replace("[31]", "[30]").replace("[temporary]", "[31]")
        for batch in wolf.read_json(self.work / "B/manifest.json"):
            wolf.write_rows(self.work / "E" / (batch["name"] + ".part01.jsonl"),
                            [{"id": key, "vi": swapped if rows[key]["en"] == text else rows[key]["en"]}
                             for key in batch["ids"]])
        result = self.run_process(["node", str(ROOT / "scripts/workflow.mjs"), "check", str(self.work)], success=False)
        self.assertIn("ordered token changed", result.stderr)

    def test_rebuild_checks_complete_nested_control_order_beyond_generic_regex_qa(self):
        original = self.source.read_bytes()
        text = r"\udb[\v[1]:2:3] and \udb[\v[1]:4:5]"
        old = b"Status: \\v[2]"
        encoded = text.encode("utf-8")
        self.source.write_bytes(original.replace(struct.pack("<I", len(old) + 1) + old + b"\0",
                                                struct.pack("<I", len(encoded) + 1) + encoded + b"\0"))
        self.extract()
        rows = wolf.read_rows(self.work / "corpus.jsonl")
        key = next(row["id"] for row in rows if row["en"] == text)
        swapped = r"\udb[\v[1]:4:5] and \udb[\v[1]:2:3]"
        self.finalize({key: swapped})
        output = self.work / "build/nested-reorder"
        with self.assertRaisesRegex(ValueError, "control-code sequence"):
            wolf.rebuild(self.work, output)
        self.assertFalse(output.exists())

    def test_silently_skipped_bad_map_blocks_extraction_without_partial_corpus(self):
        (self.data / "MapData/Broken.mps").write_bytes(b"broken map")
        with self.assertRaises(ValueError):
            wolf.extract(self.work, self.data)
        self.assertFalse((self.work / "corpus.jsonl").exists())
        self.assertFalse((self.work / "original/wolf").exists())

    def test_legacy_data_is_lossless_but_unrepresentable_vietnamese_fails_readback(self):
        self.source.write_bytes(common_fixture("cp932"))
        self.extract()
        rows = wolf.read_rows(self.work / "corpus.jsonl")
        self.finalize({rows[0]["id"]: "Chào, \\v[1]!\nSẵn sàng chưa?"})
        with self.assertRaisesRegex(ValueError, "Read-back"):
            wolf.rebuild(self.work, self.work / "build/legacy")
        self.assertFalse((self.work / "build/legacy").exists())


if __name__ == "__main__":
    unittest.main()
