#!/usr/bin/env python3
"""Check traceability of every spec in .kiro/specs/.

- Every acceptance criterion <PREFIX>-<n>.<m> in requirements.md is referenced by at least one task in tasks.md.
- Every reference in tasks.md (_Requirements: ..._) exists in requirements.md.
- Every criterion uses an EARS keyword (WHEN / IF ... THEN / WHILE / WHERE / THE SYSTEM SHALL).
- The prefix matches the table in .kiro/steering/glossary.md.
Exit 0 = OK, 1 = problems. Standard library only.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SPECS = ROOT / ".kiro/specs"
GLOSSARY = ROOT / ".kiro/steering/glossary.md"
CRITERION = re.compile(r"^\s*(?:\d+\.\s+|[-*]\s+)?\**((?:[A-Z]+)-\d+\.\d+)\**[:.)\s]+(.*)$")
REFS = re.compile(r"_Requirements?:\s*([^_]+)_")
EARS = re.compile(r"\b(WHEN|IF|WHILE|WHERE|THE SYSTEM SHALL)\b")


def main():
    prefixes = dict(re.findall(r"\|\s*`([A-Z]+)`\s*\|\s*`\.kiro/specs/([a-z0-9-]+)`", GLOSSARY.read_text(encoding="utf-8")))
    problems = []
    for spec in sorted(p for p in SPECS.iterdir() if p.is_dir()):
        req, tasks = spec / "requirements.md", spec / "tasks.md"
        if not req.exists() or not tasks.exists():
            problems.append(f"{spec.name}: requirements.md and tasks.md are both required")
            continue
        criteria = {}
        for line in req.read_text(encoding="utf-8").splitlines():
            if m := CRITERION.match(line):
                criteria[m.group(1)] = m.group(2)
        if not criteria:
            problems.append(f"{spec.name}: no acceptance criteria found (expected IDs like ABC-1.1)")
            continue
        used_prefixes = {c.split("-")[0] for c in criteria}
        expected = [p for p, name in prefixes.items() if name == spec.name]
        if expected and used_prefixes != set(expected):
            problems.append(f"{spec.name}: prefix {sorted(used_prefixes)} but glossary.md says {expected}")
        for cid, text in criteria.items():
            if not EARS.search(text):
                problems.append(f"{spec.name}: {cid} is not in EARS form")
        referenced = set()
        for refs in REFS.findall(tasks.read_text(encoding="utf-8")):
            referenced.update(r.strip() for r in refs.split(",") if r.strip())
        for cid in sorted(set(criteria) - referenced, key=lambda c: [int(x) for x in re.findall(r"\d+", c)]):
            problems.append(f"{spec.name}: {cid} is not covered by any task")
        for ref in sorted(referenced - set(criteria)):
            problems.append(f"{spec.name}: tasks.md references unknown criterion {ref}")
    for line in problems:
        print(line)
    print("RESULT: " + ("FAIL" if problems else "OK") + f" ({len(problems)} problems)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
