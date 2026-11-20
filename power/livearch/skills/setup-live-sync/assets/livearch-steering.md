---
inclusion: fileMatch
fileMatchPattern: ["**/*.tf", "**/cdk.json", "**/cdk.out/*.template.json", "**/*.template.json", "**/*.template.yaml", "docs/architecture/**"]
---

# LiveArch in this repository

The architecture diagrams in `docs/architecture/` are **generated from the IaC** by the LiveArch Power.

- The source of truth is the IaC. To change the diagram, change the IaC, then sync with the `architecture-diagrams` skill.
- `architecture.mmd`, `architecture.archify.json` and `architecture.html` are fully regenerated: never edit them.
- `architecture.drawio` can be **rearranged by hand**: moved boxes, restyled boxes and added notes survive every sync.
  Don't rename or delete managed shapes, since the next sync recreates them.
- `model.json` is derived data: commit it, but don't edit it by hand.
- LiveArch never runs `terraform apply/destroy`, `cdk deploy` or anything that changes infrastructure. It asks before
  `terraform init/plan` or `cdk synth`.
- After an IaC change, report the architectural changeset (max 5 lines) along with the code change.
