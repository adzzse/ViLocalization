"""Suggest line breaks using DazedTL's standalone cell-width fitter; never apply them."""

import argparse
import importlib.util
import json
from pathlib import Path
import unicodedata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="UTF-8 file containing one message")
    parser.add_argument("--width", type=int, required=True, help="approximate display cells, not pixels")
    parser.add_argument("--lines", type=int, required=True, help="maximum visible rows")
    args = parser.parse_args()
    if args.width < 1 or args.lines < 1:
        parser.error("width and lines must be positive")
    module_path = Path(__file__).resolve().parents[1] / "vendor/dazedtl/text-fitting/layout.py"
    spec = importlib.util.spec_from_file_location("dazed_layout", module_path)
    layout = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(layout)
    try:
        text = unicodedata.normalize("NFC", args.input.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError) as error:
        parser.exit(2, f"Could not read UTF-8 message: {error}\n")
    fitted, _ = layout.fit_box(text, args.width, args.lines)
    fits = layout.widest(fitted) <= args.width and layout.line_count(fitted) <= args.lines
    if not fits:
        # Upstream's row estimate counts spaces that a line break removes.
        for rows in range(1, min(args.lines, len(text.split())) + 1):
            candidate = layout.reflow(text, rows, args.width)
            if layout.widest(candidate) <= args.width and layout.line_count(candidate) <= args.lines:
                fitted, fits = candidate, True
                break
    print(json.dumps({"text": fitted, "fits": fits, "rows": layout.line_count(fitted),
                      "widest_cells": layout.widest(fitted), "approximate": True}, ensure_ascii=False, indent=2))
    return 0 if fits else 1


if __name__ == "__main__":
    raise SystemExit(main())
