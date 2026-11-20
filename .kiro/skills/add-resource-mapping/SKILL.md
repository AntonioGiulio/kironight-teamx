---
name: add-resource-mapping
description: Add or change how an IaC resource type (Terraform type or CloudFormation type) appears in LiveArch diagrams - its kind, icon, visibility, property allowlist or edge inference - by editing the resource catalog. Use when a diagram shows UNMAPPED_TYPE, when supporting a new AWS service, or when a resource should be hidden or shown.
metadata:
  project: livearch
---

# Add a resource mapping to the catalog

The single source of truth is `power/livearch/skills/architecture-diagrams/references/resource-catalog.json`.
No code change is needed for a type that fits an existing kind.

## 1. Classify the type
Answer these before you edit anything:
- **Terraform type and CloudFormation type**: e.g. `aws_efs_file_system` / `AWS::EFS::FileSystem`. The CFN type goes in
  `aliases`, so that CDK and CloudFormation work too.
- Does someone reading the diagram **care** about it?
  - **No**: add it to `hidden` (exact entry). If it carries a relationship, set `edgeInference`.
  - Container-like (network, account…): add it to `groups`.
  - **Yes**: add it to `resources`.
- **Kind**: pick one of the existing `kinds`. If none fits, **stop**: a new kind changes `model.schema.json`, every
  renderer and the REN spec. Propose it to the user first.

## 2. Fill in the entry (resources)
| Field | Rule |
|-------|------|
| `label` | AWS short name shown under the resource name (≤ 16 chars) |
| `drawio.resIcon` | an existing `mxgraph.aws4.*` resource icon. Verify the name in draw.io (search "aws4" in the shape library); never guess |
| `properties` | allowlist of **non-sensitive** literal attributes that help understanding (size, engine, runtime). Never names, ARNs, endpoints, passwords, policies, CIDRs |
| `provider` | `aws` |

Keep each array sorted by `iacType`, and match the column alignment of the neighbouring lines.

## 3. Check for shadowing
An exact entry wins over `hiddenPrefixes`, but the validator still warns you when a prefix shadows a visible type.
Warnings like that usually mean the prefix is too broad.

## 4. Verify
```bash
python3 power/livearch/skills/architecture-diagrams/scripts/validate_architecture.py --catalog
```
Bump `catalogVersion`: **minor** for new types, **patch** for mapping fixes. Update the golden example model's
`generator.catalogVersion` to match, re-render it, and validate it:
```bash
python3 power/livearch/skills/architecture-diagrams/scripts/render.py examples/aws-three-tier/docs/architecture/model.json
python3 power/livearch/skills/architecture-diagrams/scripts/validate_architecture.py examples/aws-three-tier/docs/architecture
```

## 5. If you added an edge inference rule
Document it in `.kiro/steering/iac-sources.md` (Inferenza degli edge) **and** in
`references/model-building.md` (Step 5), and add an acceptance criterion to `.kiro/specs/architecture-model/requirements.md`
with a task in `tasks.md`.

Commit message: `feat(catalog): map <iacType> as <kind>`.
