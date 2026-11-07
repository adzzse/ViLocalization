"""Bridge pinned WolfTL JSON to the existing custom-engine corpus/QA workflow."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / "vendor/wolftl/WolfTL.exe"
CONTROL_START = re.compile(r"\\(?:[A-Za-z][A-Za-z0-9]*[+-]?(?=\[)|[EN]|A[+-]|[<>.!^|\\-])|<[LCR]>")
ORDERED_CONTROLS = "(?:" + CONTROL_START.pattern + r")(?:\[[^\r\n]*?\])?"


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique_object)


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_rows(path, rows):
    path.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows), encoding="utf-8")


def read_rows(path):
    return [json.loads(line, object_pairs_hook=unique_object)
            for line in path.read_text(encoding="utf-8").split("\n") if line.strip()]


def tree_hashes(root):
    result = {}
    for path in sorted(root.rglob("*")):
        if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
            raise ValueError(f"Linked paths are not supported: {path}")
        if path.is_file():
            result[path.relative_to(root).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result


def run_tool(data, output, operation):
    if os.name != "nt":
        raise ValueError("The bundled WolfTL executable requires Windows.")
    expected = read_json(ROOT / "sources.lock.json")["WolfTL"]["asset_sha256"]
    if hashlib.sha256(TOOL.read_bytes()).hexdigest() != expected:
        raise ValueError("WolfTL checksum mismatch; restore the pinned tool before continuing.")
    output.mkdir(parents=True, exist_ok=True)
    args = [str(TOOL), str(data), str(output), "--" + operation]
    if not (data / "BasicData/Game.dat").exists():
        args.append("--skip-game_dat")
    result = subprocess.run(args, cwd=output, capture_output=True, timeout=120,
                            creationflags=subprocess.CREATE_NO_WINDOW)
    (output / f"{operation}.log").write_bytes(result.stdout + result.stderr)
    if result.returncode:
        raise ValueError(f"WolfTL {operation} failed ({result.returncode}): "
                         + (result.stdout + result.stderr).decode("utf-8", errors="replace")[-2000:])


def load_dumps(root):
    return {path.relative_to(root).as_posix(): read_json(path)
            for path in sorted(root.rglob("*.json"))}


def control_tokens(text):
    tokens = []
    position = 0
    while match := CONTROL_START.search(text, position):
        end = match.end()
        if end < len(text) and text[end] == "[":
            depth = 1
            end += 1
            while end < len(text) and depth:
                depth += (text[end] == "[") - (text[end] == "]")
                end += 1
            # An unmatched tail can be a literal filename or runtime fragment; keep it whole.
        tokens.append(text[match.start():end])
        position = end
    return tokens


def catalog(dumps):
    """Keep unambiguous display text separate from values needing game-specific review."""
    rows = []

    def add(file, doc, location, kind, scene, selected, reason):
        value = doc
        for part in location:
            value = value[part]
        if not isinstance(value, str) or not value.strip() or value == "INVALID_IGNORE":
            return
        pointer = "/" + "/".join(str(part).replace("~", "~0").replace("/", "~1") for part in location)
        identity = "wolf:" + file + "#" + pointer
        if any(char in identity for char in "\r\n\0"):
            raise ValueError("Source filenames must produce single-line occurrence IDs.")
        rows.append({"id": identity, "key": identity, "kind": kind, "en": value, "vi": "",
                     "scene": scene, "group": file, "order": len(rows), "speaker": "unknown",
                     "tokens": list(dict.fromkeys(control_tokens(value))),
                     "file": file, "location": location, "selected": selected, "review_reason": reason})

    def commands(file, doc, location, scene):
        sequence = doc
        for part in location:
            sequence = sequence[part]
        for index, command in enumerate(sequence):
            code = command["code"]
            args = command.get("intArgs", [])
            picture_text = code == 150 and bool(args) and ((args[0] >> 4) & 7) == 2
            for arg in range(len(command.get("stringArgs", []))):
                selected = code == 102 or (arg == 0 and (code == 101 or picture_text))
                kind = "dlg" if code == 101 else "choice" if code == 102 else "text"
                add(file, doc, location + [index, "stringArgs", arg], kind, scene, selected,
                    "display-text" if selected else f"command-{code}: review identifiers, paths and logic first")

    for file, doc in sorted(dumps.items()):
        if file == "Game.json":
            for field in ("Title", "TitlePlus", "StartUpMsg", "TitleMsg"):
                if field in doc:
                    add(file, doc, [field], "text", "game-settings", field != "TitlePlus", "game-title/message")
        elif file.startswith("common/"):
            commands(file, doc, ["commands"], f"common:{doc['id']}")
        elif file.startswith("mps/"):
            for event_index, event in enumerate(doc["events"]):
                for page_index, page in enumerate(event["pages"]):
                    scene = f"map:{file[4:-5]}:event:{event['id']}:page:{page['id']}"
                    commands(file, doc, ["events", event_index, "pages", page_index, "list"], scene)
        elif file.startswith("db/"):
            for type_index, dbtype in enumerate(doc["types"]):
                for index, datum in enumerate(dbtype["data"]):
                    location = ["types", type_index, "data", index]
                    scene = f"{file}:type:{type_index}:record:{index}"
                    add(file, doc, location + ["name"], "text", scene, False, "database record name: review references")
                    for field_index, field in enumerate(datum["data"]):
                        add(file, doc, location + ["data", field_index, "value"], "text", scene,
                            False, "database value: review field meaning and asset paths")
        else:
            raise ValueError(f"Unknown WolfTL dump format: {file}")
    return rows


def source_files(data):
    basic = data / "BasicData"
    common = basic / "CommonEvent.dat"
    if not common.is_file():
        raise ValueError("Expected an unpacked WOLF Data directory with BasicData/CommonEvent.dat.")
    files = {common}
    if (basic / "Game.dat").is_file():
        files.add(basic / "Game.dat")
    for project in basic.glob("*.project"):
        if project.name.lower() == "sysdatabasebasic.project":
            continue
        binary = project.with_suffix(".dat")
        if not binary.is_file():
            raise ValueError(f"Missing database pair: {binary}")
        files.update((project, binary))
    files.update((data / "MapData").rglob("*.mps"))
    for path in files:
        if path.is_symlink() or not path.resolve().is_relative_to(data):
            raise ValueError(f"Linked source files are not supported: {path}")
    unhandled = sorted(path.relative_to(data).as_posix() for path in basic.iterdir()
                       if path.is_file() and path.suffix.lower() in (".dat", ".project") and path not in files)
    return sorted(files), unhandled


def require_identity(data, rebuilt):
    source = tree_hashes(data)
    output = tree_hashes(rebuilt)
    different = sorted(name for name in source.keys() | output.keys() if source.get(name) != output.get(name))
    if different:
        raise ValueError("Byte-identity round trip failed or WolfTL skipped files: " + ", ".join(different[:20]))
    return source


def extract(work, data):
    work, data = work.resolve(), data.resolve()
    project = read_json(work / "project.json")
    if project.get("adapter") is not None:
        raise ValueError("Initialize a fresh custom-engine project first.")
    if work.is_relative_to(data) or data.is_relative_to(work):
        raise ValueError("Keep the project and input game data in separate directories.")
    outputs = [work / "original/wolf", work / "corpus.jsonl", work / "review-candidates.jsonl", work / "wolf-report.json"]
    if any(path.exists() for path in outputs):
        raise ValueError("This project already has WOLF source data; use a new project for another version.")
    files, unhandled = source_files(data)
    with tempfile.TemporaryDirectory(prefix=".wolf-extract-", dir=work) as directory:
        stage = Path(directory)
        snapshot = stage / "snapshot"
        copied = snapshot / "data"
        (copied / "BasicData").mkdir(parents=True)
        (copied / "MapData").mkdir()
        for source in files:
            target = copied / source.relative_to(data)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
        hashes = tree_hashes(copied)
        native = stage / "native"
        run_tool(copied, native, "create")
        run_tool(copied, native, "patch")
        require_identity(copied, native / "patched/data")
        if tree_hashes(copied) != hashes:
            raise ValueError("WolfTL modified its input snapshot.")
        shutil.copytree(native / "dump", snapshot / "dump")
        rows = catalog(load_dumps(snapshot / "dump"))
        selected = [row for row in rows if row["selected"]]
        review = [row for row in rows if not row["selected"]]
        report = {"tool": "WolfTL v0.6.2", "identity": "byte-identical", "files": len(hashes),
                  "dump_files": len(load_dumps(snapshot / "dump")), "selected": len(selected),
                  "review_candidates": len(review), "unhandled_basic_data": unhandled,
                  "coverage_note": "Display commands and game messages only by default. Database/runtime strings need review; images, editor metadata and archives are outside this census."}
        write_json(snapshot / "manifest.json", {"source": hashes, "dump": tree_hashes(snapshot / "dump"), "report": report})
        write_rows(stage / "corpus.jsonl", selected)
        write_rows(stage / "review-candidates.jsonl", review)
        write_json(stage / "wolf-report.json", report)
        qa = read_json(work / "qa.json")
        if ORDERED_CONTROLS not in qa["ordered_patterns"]:
            qa["ordered_patterns"].append(ORDERED_CONTROLS)
        write_json(stage / "qa.json", qa)
        snapshot.rename(outputs[0])
        for path in outputs[1:]:
            (stage / path.name).rename(path)
        (stage / "qa.json").replace(work / "qa.json")
    return report


def load_source(work):
    original = work / "original/wolf"
    manifest = read_json(original / "manifest.json")
    if tree_hashes(original / "data") != manifest["source"] or tree_hashes(original / "dump") != manifest["dump"]:
        raise ValueError("Original WOLF source/dump hash changed; use a new project for updated source.")
    dumps = load_dumps(original / "dump")
    available = {row["id"]: row for row in catalog(dumps)}
    required = {key for key, row in available.items() if row["selected"]}
    rows = read_rows(work / "corpus.jsonl")
    seen = set()
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str):
            raise ValueError("Corpus rows must be objects with occurrence IDs.")
        key = row.get("id")
        if key not in available or key in seen or any(row.get(field) != available[key][field] for field in ("key", "en", "tokens")):
            raise ValueError("Corpus occurrence IDs/source changed or duplicated; keep the original ID, key, en and tokens.")
        seen.add(key)
    if not required <= seen:
        raise ValueError("Corpus dropped default display-text occurrences.")
    return original, manifest, dumps, {key: available[key] for key in seen}


def checked_final(work):
    code = """const { inspectProject } = await import(process.argv[1]);
const result = inspectProject(process.argv[2]);
if (result.errors.length) throw new Error(result.errors.slice(0, 10).join('\\n'));
process.stdout.write(JSON.stringify(result.translations));"""
    result = subprocess.run(["node", "--input-type=module", "-e", code,
                             (ROOT / "scripts/workflow.mjs").as_uri(), str(work)],
                            capture_output=True, text=True, encoding="utf-8", timeout=120,
                            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if result.returncode:
        raise ValueError("Existing workflow QA failed: " + result.stderr[-2000:])
    checked = json.loads(result.stdout, object_pairs_hook=unique_object)
    if read_json(work / "final.json") != checked:
        raise ValueError("final.json is stale or modified. Run the existing finalize command again.")
    return checked


def affected_files(file):
    path = Path(file)
    if file == "Game.json":
        return {"BasicData/Game.dat"}
    if file.startswith("common/"):
        return {"BasicData/CommonEvent.dat"}
    if file.startswith("mps/"):
        return {"MapData/" + path.with_suffix(".mps").relative_to("mps").as_posix()}
    return {"BasicData/" + path.with_suffix(suffix).name for suffix in (".dat", ".project")}


def rebuild(work, output):
    work, output = work.resolve(), output.resolve()
    if output == work / "build" or not output.is_relative_to(work / "build"):
        raise ValueError("Choose a new output directory inside this project's build/.")
    if output.exists():
        raise FileExistsError("Output already exists; choose another build directory.")
    original, manifest, dumps, rows = load_source(work)
    translations = checked_final(work)
    if set(translations) != set(rows):
        raise ValueError("Final translations must cover exactly the corpus occurrences.")
    changed = set()
    for key, value in translations.items():
        if not isinstance(value, str) or "\0" in value:
            raise ValueError("Translations must be strings without NUL characters.")
        row = rows[key]
        if control_tokens(value) != control_tokens(row["en"]):
            raise ValueError("WOLF control-code sequence changed: " + key)
        if value == row["en"]:
            continue
        target = dumps[row["file"]]
        for part in row["location"][:-1]:
            target = target[part]
        target[row["location"][-1]] = value
        changed.update(affected_files(row["file"]))
    with tempfile.TemporaryDirectory(prefix=".wolf-build-", dir=work / "build") as directory:
        stage = Path(directory)
        copied = stage / "data"
        shutil.copytree(original / "data", copied)
        native = stage / "native"
        for folder in ("common", "db", "mps"):
            (native / "dump" / folder).mkdir(parents=True)
        for file, doc in dumps.items():
            target = native / "dump" / file
            target.parent.mkdir(parents=True, exist_ok=True)
            write_json(target, doc)
        run_tool(copied, native, "patch")
        rebuilt = native / "patched/data"
        hashes = tree_hashes(rebuilt)
        if hashes.keys() != manifest["source"].keys():
            raise ValueError("WolfTL skipped or added binary files during rebuild.")
        if any(hashes[name] != digest for name, digest in manifest["source"].items() if name not in changed):
            raise ValueError("Rebuild changed a binary file outside the selected occurrences.")
        run_tool(rebuilt, stage / "readback", "create")
        if load_dumps(stage / "readback/dump") != dumps:
            raise ValueError("Read-back of rebuilt data differs from intended text or non-text fields.")
        if tree_hashes(original / "data") != manifest["source"]:
            raise ValueError("Original source changed during rebuild.")
        delivery = stage / "delivery"
        delivery.mkdir()
        patch_files = [name for name, digest in hashes.items() if digest != manifest["source"][name]]
        for name in patch_files:
            target = delivery / "data" / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(rebuilt / name, target)
        report = {"files": {name: {"original_sha256": manifest["source"][name], "sha256": hashes[name]}
                            for name in patch_files}, "readback": "exact-json-match", "playtest": "not-run"}
        write_json(delivery / "patch-manifest.json", report)
        output.parent.mkdir(parents=True, exist_ok=True)
        delivery.rename(output)
    return {"output": str(output), "changed_files": len(patch_files), "readback": "exact-json-match"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    reader = commands.add_parser("extract", help="Snapshot loose WOLF data and verify byte-identity before exporting corpus")
    reader.add_argument("project", type=Path)
    reader.add_argument("data", type=Path)
    writer = commands.add_parser("rebuild", help="Validate finalized edits and write a fresh build with read-back verification")
    writer.add_argument("project", type=Path)
    writer.add_argument("output", type=Path)
    args = parser.parse_args()
    result = extract(args.project, args.data) if args.command == "extract" else rebuild(args.project, args.output)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError, subprocess.TimeoutExpired) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
