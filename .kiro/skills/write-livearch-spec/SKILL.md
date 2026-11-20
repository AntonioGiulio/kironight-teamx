---
name: write-livearch-spec
description: Write or update a LiveArch spec (requirements.md, design.md, tasks.md in .kiro/specs/) with EARS acceptance criteria, prefixed requirement IDs and task traceability. Use when creating a new feature spec, adding requirements, or when the spec-traceability hook reports problems.
metadata:
  project: livearch
---

# Write a LiveArch spec

## Rules
1. **ID prefix**: each spec has one prefix, registered in `.kiro/steering/glossary.md` (ING, MOD, REN, SYNC). For a new
   spec, add a row to that table first.
2. **Requirement**: `### <P>-<n>: <title>`, a user story (`Come <ruolo>, voglio …, così che …`) and numbered criteria `<P>-<n>.<m>`.
3. **EARS** in uppercase English keywords:
   - `WHEN <event> THE SYSTEM SHALL <response>`
   - `IF <unwanted condition> THEN THE SYSTEM SHALL <response>`
   - `WHILE <state> THE SYSTEM SHALL <response>`
   - `WHERE <optional feature> THE SYSTEM SHALL <response>`
4. **Testable**: concrete values only, such as file names, warning codes from `model.schema.json`, limits ("≤ 5 s on 200
   resources"), or exact outputs. Forbidden words: "fast", "user-friendly", "appropriate", "etc.".
5. **Reference, don't copy**: point to steering and `references/` files by path, and never restate the catalog or the schema.
6. **Tasks**: `- [ ] N. title` with sub-tasks `- [ ] N.M`. Every task ends with `_Requirements: <P>-x.y, …_`. Every
   criterion needs at least one task, and test tasks are explicit.
7. **Design**: overview, architecture (mermaid), components and interfaces (TypeScript signatures for the `livearch` MCP
   server), data models (by reference), error handling (warning codes), test strategy, decisions, traceability table.

## Checklist before finishing
```bash
python3 .kiro/hooks/scripts/check_spec_traceability.py
```
- No criterion contradicts `.kiro/steering/*.md`. If one must, change the steering first and say so.
- Cross-spec dependencies are named by prefix (e.g. "uses the changeset from MOD-8").
- Out-of-scope section present.
