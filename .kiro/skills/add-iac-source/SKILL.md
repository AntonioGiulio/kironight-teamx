---
name: add-iac-source
description: Add support for a new Infrastructure as Code language or tool to LiveArch (e.g. Pulumi, OpenTofu, Bicep, Terragrunt, Serverless Framework) - detection, adapter design, catalog aliases, security review and spec updates. Use when the user wants LiveArch to read a new IaC format.
metadata:
  project: livearch
---

# Add a new IaC source

A new language adds **one adapter** and touches nothing downstream. The adapter's only output is `RawResource[]`.
If your design needs the renderers or the model schema to change, the design is wrong. See `.kiro/steering/architecture-model.md`.

## 1. Choose the reading strategy (in order of preference)
1. **An existing canonical artifact**, like `cdk.out` for CDK. For example, Pulumi exposes `pulumi preview --json`, and
   Bicep compiles to an ARM JSON template.
2. **Static parsing** of the source files.
3. **Running the tool**. Allowed only if it needs no credentials and only after user consent. Add the command to the
   "require consent" list in `.kiro/steering/security.md` and to `ASK` in `.kiro/hooks/scripts/guard_commands.py`.
   Commands that deploy go to the forbidden list and to `BLOCK`.

## 2. Define the address scheme
The address becomes the node `id` and must be **stable**: it may not depend on ordering, tags or values. Write it down
together with a worked example. Pulumi, for instance: `<stack>.<urn type>::<name>`.

## 3. Update the context, in this order
1. `.kiro/steering/iac-sources.md`: add a row to the detection table and a section for the language.
2. `power/livearch/skills/architecture-diagrams/references/model-building.md`: the Detection table and Step 1 address rules.
3. `model.schema.json`: add the adapter name to `source.adapters.items.enum`, plus a minor schema version note.
4. `resource-catalog.json`: add aliases for the new type names. For a new provider such as Azure, also add the `resIcon`
   values (`mxgraph.azure.*`), and keep `provider` accurate.
5. `.kiro/specs/iac-ingestion/`: a new requirement `ING-<n>` with EARS criteria for detection, addressing, references,
   errors (`PARSE_ERROR`) and performance, plus design and tasks. Use the `write-livearch-spec` skill.

## 4. Golden example
Add `examples/<provider>-<name>/` with its IaC sources and the expected `docs/architecture/`. Run the validator and the
stop gate (`python3 .kiro/hooks/scripts/stop_gate.py`).

## Done when
- The validator passes on the new example.
- `check_spec_traceability.py` passes.
- The new commands are classified in security.md.
