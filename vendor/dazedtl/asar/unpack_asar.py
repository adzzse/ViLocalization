#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path, PureWindowsPath
import re
import shutil
import struct
import sys
import time


CHUNK_SIZE = 8 * 1024 * 1024


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate ASAR header key: {key}")
        result[key] = value
    return result


def read_u32(data: bytes, offset: int) -> int:
    return struct.unpack_from("<I", data, offset)[0]


def read_header(archive: Path) -> tuple[dict, int]:
    with archive.open("rb") as handle:
        size_pickle = handle.read(8)
        if len(size_pickle) != 8:
            raise ValueError("ASAR archive is too small")
        payload_size = read_u32(size_pickle, 0)
        if payload_size != 4:
            raise ValueError(f"unexpected ASAR size-pickle payload: {payload_size}")
        header_size = read_u32(size_pickle, 4)
        if header_size < 8 or header_size > archive.stat().st_size - 8:
            raise ValueError("invalid ASAR header size")
        header_pickle = handle.read(header_size)
        if len(header_pickle) != header_size:
            raise ValueError("ASAR header is truncated")

    if len(header_pickle) < 8:
        raise ValueError("ASAR header pickle is too small")
    json_size = read_u32(header_pickle, 4)
    if json_size > len(header_pickle) - 8:
        raise ValueError("ASAR JSON header is truncated")
    json_blob = header_pickle[8 : 8 + json_size].rstrip(b"\0")
    header = json.loads(json_blob.decode("utf-8"), object_pairs_hook=unique_object)
    if not isinstance(header, dict):
        raise ValueError("ASAR header must be an object")
    return header, 8 + header_size


def safe_join(root: Path, relative: str) -> Path:
    parts = relative.split("/")
    if (PureWindowsPath(relative).drive or "\\" in relative or ":" in relative
            or any(part in ("", ".", "..") or part.endswith((" ", ".")) or re.search(r'[<>"|?*\x00-\x1f]', part)
                   or re.match(r"^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)", part, re.I) for part in parts)):
        raise ValueError(f"unsafe ASAR path: {relative}")
    candidate = (root / relative).resolve()
    root = root.resolve()
    if candidate == root or root not in candidate.parents:
        raise ValueError(f"refusing path outside output root: {relative}")
    return candidate


def iter_entries(node: dict, prefix: str = ""):
    files = node.get("files", {})
    if not isinstance(files, dict):
        raise ValueError("ASAR files must be an object")
    for name, entry in sorted(files.items()):
        if not isinstance(entry, dict):
            raise ValueError(f"invalid ASAR entry: {name}")
        rel = f"{prefix}/{name}" if prefix else name
        if "files" in entry:
            yield from iter_entries(entry, rel)
        else:
            yield rel, entry


def copy_range(handle, out_path: Path, offset: int, size: int):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    remaining = size
    handle.seek(offset)
    with out_path.open("wb") as out:
        while remaining:
            chunk = handle.read(min(CHUNK_SIZE, remaining))
            if not chunk:
                raise EOFError(f"unexpected EOF while extracting {out_path}")
            out.write(chunk)
            remaining -= len(chunk)


def extract(archive: Path, output: Path, unpacked_dir: Path | None = None) -> int:
    if output.exists() or output.is_symlink():
        raise FileExistsError(f"Use a new output directory: {output}")
    header, data_offset = read_header(archive)
    entries = list(iter_entries(header))
    planned = []
    paths = set()
    archive_size = archive.stat().st_size
    for rel, entry in entries:
        destination = safe_join(output, rel)
        portable_path = str(destination).casefold()
        if portable_path in paths:
            raise ValueError(f"duplicate/ambiguous ASAR output path: {rel}")
        paths.add(portable_path)
        if "link" in entry:
            raise ValueError(f"ASAR links require an engine-specific adapter: {rel}")
        size = entry.get("size", 0)
        if type(size) is not int or size < 0:
            raise ValueError(f"invalid ASAR entry size: {rel}")
        if entry.get("unpacked"):
            source = safe_join(unpacked_dir, rel) if unpacked_dir else None
            if source is None or not source.is_file():
                raise FileNotFoundError(f"Missing unpacked sidecar file: {rel}")
            if source.stat().st_size != size:
                raise ValueError(f"ASAR sidecar size does not match header: {rel}")
            planned.append((destination, 0, 0, source))
            continue
        raw_offset = entry.get("offset", "0")
        if type(raw_offset) not in (str, int) or not str(raw_offset).isascii() or not str(raw_offset).isdigit():
            raise ValueError(f"invalid ASAR entry range: {rel}")
        offset = data_offset + int(raw_offset)
        if offset + size > archive_size:
            raise ValueError(f"ASAR entry extends beyond archive: {rel}")
        planned.append((destination, offset, size, None))
    if any(str(parent).casefold() in paths for destination, *_ in planned for parent in destination.parents):
        raise ValueError("ASAR output file/directory paths collide")
    output.mkdir(parents=True)

    start = time.time()
    extracted = 0
    copied_bytes = 0
    with archive.open("rb") as handle:
        for index, (out_path, offset, size, source) in enumerate(planned, 1):
            if source is not None:
                out_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, out_path)
                extracted += 1
                continue
            copy_range(handle, out_path, offset, size)
            extracted += 1
            copied_bytes += size
            if index % 250 == 0 or index == len(entries):
                elapsed = max(time.time() - start, 0.1)
                mib = copied_bytes / (1024 * 1024)
                print(
                    f"progress {index}/{len(entries)} files | {mib:.1f} MiB | "
                    f"{mib / elapsed:.1f} MiB/s",
                    flush=True,
                )

    print(f"archive: {archive}")
    print(f"output: {output}")
    print(f"files_extracted: {extracted}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Offline ASAR extractor.")
    parser.add_argument("archive", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--unpacked-dir", type=Path, default=None)
    args = parser.parse_args()

    archive = args.archive.resolve()
    output = args.output.resolve()
    unpacked_dir = args.unpacked_dir.resolve() if args.unpacked_dir else None
    if not archive.exists():
        raise SystemExit(f"archive not found: {archive}")
    try:
        return extract(archive, output, unpacked_dir)
    except (ValueError, OSError, EOFError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    raise SystemExit(main())
