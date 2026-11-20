---
name: architecture-diagrams
description: Generate or update the architecture diagram of an Infrastructure as Code repository (Terraform, AWS CDK, CloudFormation) as draw.io, Mermaid and Archify (interactive HTML) files in docs/architecture/. Use when the user asks to draw, generate, refresh or sync the architecture diagram, or when an IaC file changed and the LiveArch hook asks for a sync.
license: Apache-2.0
compatibility: Requires python3 (3.10+, standard library only). The Archify HTML also needs Node.js and the Archify skill (https://github.com/tt-a1i/archify); without them every other file is still produced. Works offline. Never needs cloud credentials.
metadata:
  author: KiroNight Team X
  version: 0.1.0
---

# Architecture diagrams from IaC

The pipeline is always **IaC → `model.json` → rendered diagrams** (draw.io, Mermaid, Archify JSON + HTML). You build
the model; deterministic scripts draw the diagrams. **Never write or edit `architecture.drawio`, `architecture.mmd`,
`architecture.archify.json` or `architecture.html` yourself**, and never use the Archify skill to author them by hand.

All paths under `scripts/` and `references/` are relative to this skill's folder. Output goes to `docs/architecture/`
in the user's IaC repo, unless the user picks another folder.

## Hard rules
- Read-only on IaC. Never run `terraform apply|destroy|import|state`, `cdk deploy|destroy`, or mutating `aws` commands.
- Ask first before `terraform init`, `terraform plan` or `cdk synth`: they run code or use the network.
- Copy into `properties` only the keys in the catalog allowlist. Write account IDs as `<account>`. Never copy variable values.
- If the IaC cannot be parsed, **do not touch** the existing files in `docs/architecture/`. Report the `PARSE_ERROR` and stop.

## Workflow

### 1. Detect sources
Find the markers listed in `references/model-building.md` § Detection (`*.tf`, `cdk.json`, CloudFormation templates).
Skip `.terraform/`, `node_modules/` and `cdk.out/` (except `cdk.out/*.template.json` for CDK).
- If the `livearch` MCP server is available, call `detect_sources` instead.
- CDK: use `cdk.out/*.template.json`. If it is missing or older than the CDK sources, ask the user before running
  `cdk synth`. Otherwise use what exists and add a `STALE_SYNTH` warning.

### 2. Build the model
Follow `references/model-building.md` step by step. Use the catalog in `references/resource-catalog.json` and the
schema in `references/model.schema.json`.
- Incremental sync: read the current `docs/architecture/model.json` first. Keep every ID that still maps to the same
  IaC address, and recompute only what the changed files affect.
- Write the result to `docs/architecture/model.next.json`. Sort `groups`, `nodes` and `edges` by `id`, and indent JSON with 2 spaces.

### 3. Compute the changeset
```bash
python3 scripts/changeset.py docs/architecture/model.json docs/architecture/model.next.json   # first run: use '-' as old model
```
If it prints `no architectural change`, delete `model.next.json`, tell the user, and stop.
Otherwise move `model.next.json` over `model.json`.

### 4. Render
```bash
python3 scripts/render.py docs/architecture/model.json
```
The script merges into the existing draw.io file. It keeps the positions and styles a person changed, and never
touches cells a person added. If it stops on a compressed draw.io file, ask the user to save it uncompressed.
It then calls the Archify CLI to build `architecture.html`. If it prints `skip architecture.html`, tell the user to
install Archify (or set `ARCHIFY_HOME`). If Archify rejects the layout, report its diagnostic: do not edit the JSON.

### 5. Validate (mandatory)
```bash
python3 scripts/validate_architecture.py docs/architecture
```
On `RESULT: FAIL`, fix **`model.json`**, then re-render and validate again. Never patch the diagrams. If it still
fails after 2 attempts, show the errors to the user and stop.

### 6. Report
Report in at most 5 lines: the changeset output, the model's `warnings` (e.g. `UNMAPPED_TYPE`, `REMOTE_MODULE`), and
the paths of the files. Suggest opening `architecture.html` in a browser: it is the interactive view (focus, path
tracing, presentation mode with `F`).

## References (load only when needed)
- `references/model-building.md`: how to turn IaC into the model (IDs, groups, hidden resources, edges). **Always read it before step 2.**
- `references/resource-catalog.json`: type → kind → notation mapping, property allowlist.
- `references/model.schema.json`: the model contract.
- `references/drawio-format.md`, `references/mermaid-format.md`, `references/archify-format.md`: output formats, for debugging validator errors.
