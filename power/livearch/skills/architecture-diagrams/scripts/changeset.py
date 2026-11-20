#!/usr/bin/env python3
"""Print the changeset between two LiveArch models (what the user sees after a sync).

Usage:
    changeset.py <old-model.json|-> <new-model.json> [--json]

Use '-' as old model on the first sync. Output: at most 5 human lines, or the full JSON with --json.
Standard library only.
"""
import json
import sys
from pathlib import Path

SECTIONS = ("groups", "nodes", "edges")


def load(path):
    if path == "-":
        return {s: [] for s in SECTIONS}
    return json.loads(Path(path).read_text(encoding="utf-8"))


def changeset(old, new):
    result = {}
    for section in SECTIONS:
        before = {i["id"]: i for i in old.get(section, [])}
        after = {i["id"]: i for i in new.get(section, [])}
        result[section] = {
            "added": sorted(after.keys() - before.keys()),
            "removed": sorted(before.keys() - after.keys()),
            "changed": sorted(k for k in after.keys() & before.keys() if after[k] != before[k]),
        }
    return result


def summary(cs):
    lines = []
    for change in ("added", "removed", "changed"):
        items = [f"{s[:-1]} {i}" for s in SECTIONS for i in cs[s][change]]
        if items:
            shown = ", ".join(items[:4]) + (f" (+{len(items) - 4})" if len(items) > 4 else "")
            lines.append(f"{change}: {shown}")
    if not lines:
        lines.append("no architectural change")
    total = sum(len(cs[s][c]) for s in SECTIONS for c in ("added", "removed", "changed"))
    lines.append(f"total: {total} change(s)")
    return lines[:5]


def main(argv):
    if len(argv) not in (3, 4) or (len(argv) == 4 and argv[3] != "--json"):
        print(__doc__, file=sys.stderr)
        return 2
    cs = changeset(load(argv[1]), load(argv[2]))
    if len(argv) == 4:
        print(json.dumps(cs, indent=2))
    else:
        print("\n".join(summary(cs)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
