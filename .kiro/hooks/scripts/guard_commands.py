#!/usr/bin/env python3
"""PreToolUse guard for LiveArch development (see .kiro/steering/security.md).

Reads the Kiro hook event JSON from stdin.
- shell tools: block infrastructure-mutating commands (exit 2); ask before commands that run code or use the network.
- write tools: block content that looks like a secret or a real AWS account id (exit 2).
"""
import json
import re
import sys

BLOCK = [
    r"\bterraform\s+(apply|destroy|import)\b",
    r"\bterraform\s+state\s+(rm|mv|push|replace-provider)\b",
    r"\b(cdk|npx\s+cdk|npx\s+aws-cdk)\s+(deploy|destroy)\b",
    r"\baws\s+cloudformation\s+(create-stack|update-stack|delete-stack|deploy|execute-change-set)\b",
    r"\baws\s+\S+\s+(create|delete|put|update|terminate|run|modify|attach|detach)-[a-z-]+\b",
]
ASK = [r"\bterraform\s+(init|plan)\b", r"\bcdk\s+synth\b", r"\bnpx\s+(aws-)?cdk\s+synth\b"]
SECRETS = [
    re.compile(r"\b(AKIA|ASIA)[0-9A-Z]{16}\b"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"arn:aws:[a-z0-9-]*:[a-z0-9-]*:\d{12}:"),
]


def main():
    event = json.load(sys.stdin)
    tool = event.get("tool_name", "")
    payload = event.get("tool_input", {}) or {}
    text = payload.get("command") if isinstance(payload.get("command"), str) else json.dumps(payload)

    if re.search(r"bash|pwsh|shell", tool):
        for pattern in BLOCK:
            if re.search(pattern, text):
                sys.stderr.write(f"Blocked by security.md: '{text.strip()}' would change infrastructure. LiveArch is read-only.\n")
                return 2
        for pattern in ASK:
            if re.search(pattern, text):
                print(json.dumps({"hookSpecificOutput": {
                    "permissionDecision": "ask",
                    "permissionDecisionReason": "This runs IaC tooling (code execution / network). security.md requires explicit user consent.",
                }}))
                return 0
        return 0

    for pattern in SECRETS:
        if pattern.search(text):
            sys.stderr.write("Blocked by security.md: the content contains a secret-like value or a full ARN with an account id. Use <account> or a placeholder.\n")
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
