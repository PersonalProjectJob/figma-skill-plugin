#!/usr/bin/env python3
"""Design-system conformance audit for a hi-fi design document.

Answers the question a reviewer answers by eye, but with counts:
does this design speak the product's grammar, or only its vocabulary?

Vocabulary = colour values. Grammar = type scale, spacing scale, radius
scale, token binding, reuse. A design can score 100% on colour and still
be rejected; this script is what makes that visible before handoff.

Usage
-----
    python conformance-audit.py DESIGN.json --tokens TOKENS.json
    python conformance-audit.py DESIGN.json --preset example

DESIGN.json is a Pencil `.pen` document (plain JSON), or any JSON node
tree whose nodes carry the usual visual props (fontSize, cornerRadius,
gap, padding*, fill, stroke, fontFamily, fontWeight).

TOKENS.json declares the allowlist extracted mechanically from the truth
source in this session -- never hand-typed:

    {
      "font_sizes":  [10, 11, 12, 14, 16, 18, 20, 24, 76],
      "spacing":     [4, 8, 12, 16, 24, 32, 48, 64],
      "radii":       [6, 8, 12, 16, 9999],
      "font_families": ["Inter"],
      "colors": {"brandPrimary": "#4F46E5", "...": "..."},
      "raw_color_allowlist": ["#FFFFFF", "#00000000"]
    }

Exit code is 1 when any axis has a violation, so this can gate a handoff.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

# Presets exist only as a convenience for repeated audits of the same
# product. They are NOT a substitute for extraction -- if a preset and the
# truth source disagree, the truth source wins and the preset is stale.
#
# The bundled preset below is ILLUSTRATIVE ONLY -- a plain 8pt spacing scale
# on Inter. Replace it with your own product, or skip it and pass --tokens.
PRESETS = {
    "example": {
        "font_sizes": [10, 11, 12, 14, 16, 18, 20, 24, 76],
        "spacing": [4, 8, 12, 16, 24, 32, 48, 64],
        "radii": [6, 8, 12, 16, 9999],
        "font_families": ["Inter"],
        "raw_color_allowlist": ["#FFFFFF", "#FFF", "#00000000", "TRANSPARENT"],
    }
}

SPACING_KEYS = ("gap", "itemSpacing", "spacing")
PADDING_RE = re.compile(r"^padding", re.IGNORECASE)
COLOR_KEYS = ("fill", "fills", "stroke", "strokes", "color", "background")
HEX_RE = re.compile(r"#(?:[0-9a-fA-F]{3,8})\b")


def walk(node, depth=0):
    """Yield (node, depth) for every dict in the tree, children last."""
    if isinstance(node, dict):
        yield node, depth
        for key, value in node.items():
            if key == "children" or isinstance(value, (list, dict)):
                yield from walk(value, depth + 1)
    elif isinstance(node, list):
        for item in node:
            yield from walk(item, depth)


def numbers_in(value):
    """Padding may be a scalar or a list ([v,h] / [t,r,b,l]). Normalise."""
    if isinstance(value, (int, float)):
        return [value]
    if isinstance(value, list):
        return [v for v in value if isinstance(v, (int, float))]
    return []


def collect(doc):
    found = {
        "font_sizes": Counter(),
        "weight_pairs": Counter(),
        "families": Counter(),
        "radii": Counter(),
        "gaps": Counter(),
        "paddings": Counter(),
        "token_colors": Counter(),
        "raw_colors": Counter(),
        "node_names": Counter(),
        "text_nodes": 0,
    }

    for node, _ in walk(doc):
        size = node.get("fontSize")
        if isinstance(size, (int, float)):
            found["font_sizes"][size] += 1
            found["text_nodes"] += 1
            weight = node.get("fontWeight") or node.get("fontStyle")
            if weight is not None:
                found["weight_pairs"][(size, str(weight))] += 1

        family = node.get("fontFamily") or node.get("font")
        if isinstance(family, str):
            found["families"][family] += 1

        radius = node.get("cornerRadius", node.get("borderRadius"))
        for value in numbers_in(radius):
            found["radii"][value] += 1

        for key in SPACING_KEYS:
            for value in numbers_in(node.get(key)):
                found["gaps"][value] += 1

        for key, value in node.items():
            if PADDING_RE.match(key):
                for number in numbers_in(value):
                    found["paddings"][number] += 1

        for key in COLOR_KEYS:
            value = node.get(key)
            for text in ([value] if isinstance(value, str) else []):
                if text.startswith("$"):
                    found["token_colors"][text] += 1
                else:
                    for hex_value in HEX_RE.findall(text) or ([text] if text else []):
                        found["raw_colors"][hex_value.upper()] += 1

        name = node.get("name")
        if isinstance(name, str) and name:
            found["node_names"][name] += 1

    return found


def off_scale(counter, allowed):
    allowed = set(allowed)
    return {value: count for value, count in counter.items() if value not in allowed}


def render(found, tokens):
    lines = []
    violations = 0

    def section(title, offenders, total, note=""):
        nonlocal violations
        bad = sum(offenders.values())
        status = "PASS" if bad == 0 else "FAIL"
        if bad:
            violations += 1
        pct = f" ({100.0 * bad / total:.0f}% of {total})" if total else ""
        lines.append(f"[{status}] {title}: {bad} off-scale instances{pct}")
        if offenders:
            worst = sorted(offenders.items(), key=lambda kv: -kv[1])
            detail = ", ".join(f"{v}×{c}" for v, c in worst[:14])
            lines.append(f"         values: {detail}")
        if note:
            lines.append(f"         {note}")

    fs_total = sum(found["font_sizes"].values())
    section("Type scale", off_scale(found["font_sizes"], tokens["font_sizes"]), fs_total)

    # An unused top of the ramp is its own smell: it usually means page
    # headers were sized by hand instead of taken from the named styles.
    unused = [s for s in sorted(tokens["font_sizes"], reverse=True)[:3]
              if found["font_sizes"].get(s, 0) == 0]
    if unused:
        lines.append(f"         note: largest ramp steps never used: {unused}"
                     " -- headers likely hand-sized")

    gap_total = sum(found["gaps"].values())
    section("Spacing (gaps)", off_scale(found["gaps"], tokens["spacing"]), gap_total)

    pad_total = sum(found["paddings"].values())
    section("Spacing (padding)", off_scale(found["paddings"], tokens["spacing"]), pad_total)

    radius_total = sum(found["radii"].values())
    section("Radius scale", off_scale(found["radii"], tokens["radii"]), radius_total)

    fam_total = sum(found["families"].values())
    section("Font family", off_scale(found["families"], tokens["font_families"]), fam_total)

    raw_allow = {c.upper() for c in tokens.get("raw_color_allowlist", [])}
    unbound = {c: n for c, n in found["raw_colors"].items() if c not in raw_allow}
    bound = sum(found["token_colors"].values())
    total_color = bound + sum(found["raw_colors"].values())
    section("Colour token binding", unbound, total_color,
            note=f"{bound} token-bound vs {sum(found['raw_colors'].values())} raw literals")

    # Reuse proxy: a unit drawn once per screen shows up with a distinct
    # name each time; a reused unit repeats the same name. Low repetition
    # across many nodes means hand-redrawing.
    repeated = sum(c for c in found["node_names"].values() if c > 1)
    distinct = len(found["node_names"])
    total_named = sum(found["node_names"].values())
    ratio = (100.0 * repeated / total_named) if total_named else 0.0
    lines.append(f"[INFO] Reuse proxy: {ratio:.0f}% of named nodes share a name "
                 f"({distinct} distinct names over {total_named} nodes)")
    lines.append("         low value = units redrawn per screen rather than reused")

    weird = {f"{size}px/{weight}": count
             for (size, weight), count in found["weight_pairs"].items()
             if str(weight) in {"500", "medium", "Medium"} and size <= 12}
    if weird:
        lines.append("[WARN] Medium weight on <=12px text (rarely a defined style): "
                     + ", ".join(f"{k} ×{v}" for k, v in sorted(weird.items())))

    return lines, violations


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("design", type=Path, help="design document JSON (.pen or node tree)")
    parser.add_argument("--tokens", type=Path, help="token allowlist JSON from extraction")
    parser.add_argument("--preset", choices=sorted(PRESETS), help="built-in allowlist (may be stale)")
    args = parser.parse_args()

    if not args.tokens and not args.preset:
        parser.error("pass --tokens (extracted this session) or --preset")

    tokens = dict(PRESETS[args.preset]) if args.preset else {}
    if args.tokens:
        tokens.update(json.loads(args.tokens.read_text(encoding="utf-8")))
    for key in ("font_sizes", "spacing", "radii", "font_families"):
        tokens.setdefault(key, [])

    try:
        doc = json.loads(args.design.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"ERROR: {args.design} is not valid JSON ({exc}).", file=sys.stderr)
        print("A Figma file must be exported to JSON first; .pen files are already JSON.",
              file=sys.stderr)
        return 2

    found = collect(doc)
    lines, violations = render(found, tokens)

    print(f"Conformance audit -- {args.design.name}")
    if args.preset:
        print(f"allowlist: preset '{args.preset}' "
              "(verify against the truth source; presets go stale)")
    print("-" * 72)
    for line in lines:
        print(line)
    print("-" * 72)
    print(f"{violations} axis/axes with violations. "
          "Fix them, or list each as a known deviation with a reason.")
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
