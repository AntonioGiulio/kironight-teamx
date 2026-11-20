---
name: add-diagram-format
description: Add a new output diagram format to LiveArch (e.g. PlantUML, D2, Structurizr/C4, SVG) as a renderer of model.json, with its format guide, validator checks and golden output. Use when the user wants LiveArch to produce another diagram type.
metadata:
  project: livearch
---

# Add a diagram format

A format is a **pure function of the model** (plus the previous file, if people can edit it). It never reads IaC.

## 1. Decide the editing policy
- **Regenerated** (like Mermaid and ArchiMate): simplest, since people never edit the file.
- **Merged** (like draw.io): you must define identity (the `diagramId`), what is preserved (geometry, style) and how
  user content is recognised. Copy the merge rules table from `references/drawio-format.md` and adapt it.

## 2. Write the format guide
Create `power/livearch/skills/architecture-diagrams/references/<format>-format.md`. It must cover:
- file skeleton and header (generator, catalog version, model hash, **no timestamp**);
- mapping of node, group and edge kinds (add the per-kind keys to `kinds` / `edgeKinds` / `groupKinds` in the catalog);
- ordering (always by `id`), escaping, and the ID rule (`diagramId` as is).

## 3. Implement
- Add a `render_<format>()` to `scripts/render.py` (standard library only) and register the output file in `main()`.
- Add a `check_<format>()` to `scripts/validate_architecture.py`: it must parse the file, and its set of
  groups/nodes/edges must **equal** the model's.

## 4. Update the context
- `.kiro/steering/diagram-conventions.md` and `.kiro/steering/product.md` (formats table).
- `.kiro/specs/diagram-rendering/`: a new `REN-<n>` requirement with criteria for structure, consistency and
  determinism, plus tasks.
- `SKILL.md` of both Power skills and `power/livearch/README.md`, wherever the outputs are listed.

## 5. Verify
Re-render the golden example, then run the validator and `python3 .kiro/hooks/scripts/stop_gate.py`. Rendering twice
must produce no diff.
