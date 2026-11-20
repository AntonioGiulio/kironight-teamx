---
name: setup-live-sync
description: Install LiveArch live sync in an Infrastructure as Code repository so the architecture diagrams (draw.io, Mermaid, ArchiMate) update automatically whenever Terraform, CDK or CloudFormation files change. Use when the user wants to keep architecture diagrams always up to date, enable automatic or real-time diagram sync, or set up LiveArch in a repo.
license: Apache-2.0
compatibility: Kiro IDE 1.0+ or Kiro CLI V3 (hooks schema v1). Requires python3.
metadata:
  author: KiroNight Team X
  version: 0.1.0
---

# Set up live sync

Installs two files in the user's IaC repo, then runs the first sync. The assets are in this skill's `assets/` folder.

| Asset | Installed as | Purpose |
|-------|--------------|---------|
| `assets/livearch-sync.json` | `.kiro/hooks/livearch-sync.json` | when an IaC file is saved, sync; block hand edits to generated diagrams |
| `assets/livearch-steering.md` | `.kiro/steering/livearch.md` | rules every session follows in this repo |

## Steps
1. **Check there is IaC**: look for `*.tf`, `cdk.json` or CloudFormation templates. If there are none, tell the user and stop.
2. **Check what already exists**: if either target file exists, compare it with the asset.
   - Identical: skip it, so running the setup twice changes nothing.
   - Different: show the diff and ask the user to **replace**, **keep**, or **merge** it. Never overwrite silently.
3. **Visibility warning**: diagrams reveal the infrastructure topology. Find out whether the remote is public:
   `git remote get-url origin`, then `gh repo view --json visibility -q .visibility` if `gh` is available, or ask the user.
   If it is public, warn the user and get confirmation before going on.
4. **Install**: copy the two assets byte for byte, creating `.kiro/hooks/` and `.kiro/steering/` if needed.
   - If the IaC is not at the repo root, adapt the hook `matcher` and tell the user.
   - CDK: make sure `cdk.out/` is **not** git-ignored only if the user wants the CI to render diagrams. Otherwise just mention it.
5. **First sync**: run the `architecture-diagrams` skill for a full sync, then show its 5-line report.
6. **Explain the limit** in one sentence: Kiro file hooks fire on **agent** edits only. After editing IaC by hand, ask
   Kiro to "sync the architecture", or enable watch mode when the `livearch` MCP server is installed.
7. Suggest committing `docs/architecture/`, `.kiro/hooks/livearch-sync.json` and `.kiro/steering/livearch.md` together.

## Uninstall
Delete the two installed files. The diagrams in `docs/architecture/` stay; they are normal files.
