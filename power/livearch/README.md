# LiveArch: Kiro Power

Keeps your architecture diagram in sync with your Infrastructure as Code.

```
Terraform / CDK / CloudFormation  →  model.json  →  architecture.drawio   (editable layout)
                                                  →  architecture.mmd      (GitHub / PR)
                                                  →  architecture.archimate.xml (Archi)
```

## Install
Kiro → Powers panel → **Add Custom Power** → **Import power from GitHub**, then paste
`https://github.com/AntonioGiulio/kironight-teamx/tree/main/power/livearch`.
You can also import it from a local folder.

## Use
- "Draw the architecture of this repo" activates the `architecture-diagrams` skill.
- "Keep the architecture diagram always up to date" activates the `setup-live-sync` skill, which installs a hook and a
  steering file in your repo.

## What it guarantees
- **Deterministic**: the same IaC always produces the same bytes, so PR diffs stay readable.
- **Your layout survives**: positions, styles and notes you change in draw.io are kept on every sync.
- **Consistent**: `scripts/validate_architecture.py` checks that the three diagrams match the model and contain no secrets.
- **Safe**: read-only, offline, and it never deploys anything.

## Contents
| Path | What |
|------|------|
| `plugin.json` | manifest and activation keywords |
| `skills/architecture-diagrams/` | generate/sync workflow, catalog, schema, format guides, scripts |
| `skills/setup-live-sync/` | hook and steering installed in your repo |

The planned `livearch` MCP server (`detect_sources`, `build_model`, `render_diagrams`, `sync`, `validate`) will replace
the agent-built model and add a file watcher. Until it ships, the Power works with skills and scripts only.
