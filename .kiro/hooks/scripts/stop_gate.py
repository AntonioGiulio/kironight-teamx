#!/usr/bin/env python3
"""Stop gate: the agent may not finish its turn while the context artifacts are broken.

Checks: catalog valid, golden example valid, rendering is idempotent (re-render == committed files),
every spec acceptance criterion is covered by a task. On failure prints a Kiro "block" decision so the
agent keeps working with the reason. Standard library only.
"""
import filecmp
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / "power/livearch/skills/architecture-diagrams/scripts"
GOLDEN = ROOT / "examples/aws-three-tier/docs/architecture"


def run(*args):
    proc = subprocess.run([sys.executable, *map(str, args)], capture_output=True, text=True, cwd=ROOT)
    return proc.returncode, (proc.stdout + proc.stderr).strip()


def main():
    problems = []
    code, out = run(SCRIPTS / "validate_architecture.py", "--catalog")
    if code:
        problems.append("catalog:\n" + out)
    code, out = run(SCRIPTS / "validate_architecture.py", GOLDEN)
    if code:
        problems.append("golden example:\n" + out)
    else:
        with tempfile.TemporaryDirectory() as tmp:
            for f in GOLDEN.iterdir():
                shutil.copy(f, tmp)
            run(SCRIPTS / "render.py", Path(tmp) / "model.json")
            diff = [f.name for f in GOLDEN.iterdir() if not filecmp.cmp(f, Path(tmp) / f.name, shallow=False)]
            if diff:
                problems.append(f"golden example is stale or rendering is not idempotent: {diff}. "
                                "Re-run render.py on examples/aws-three-tier/docs/architecture/model.json.")
    code, out = run(Path(__file__).with_name("check_spec_traceability.py"))
    if code:
        problems.append("spec traceability:\n" + out)

    if problems:
        print(json.dumps({"decision": "block", "reason": "LiveArch stop gate failed. Fix before finishing:\n\n" + "\n\n".join(problems)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
