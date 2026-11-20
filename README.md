# kironight-teamx: LiveArch

**LiveArch** is a Kiro Power that reads an Infrastructure as Code repository (Terraform, AWS CDK, CloudFormation)
and keeps its architecture diagram **always up to date** as **draw.io**, **Mermaid** and **ArchiMate** (Archi) files.

KiroNight challenge: *build the context, not the code*. This repo is mostly Kiro context. Start from
[`docs/context-map.md`](docs/context-map.md).

## What's inside
| Artifact | Where | Role |
|----------|-------|------|
| Steering | `.kiro/steering/` | product, stack, structure, security, glossary (always) + model, diagram conventions, IaC sources (on demand) |
| Specs | `.kiro/specs/{iac-ingestion,architecture-model,diagram-rendering,live-sync}/` | EARS requirements, design, traceable tasks |
| Dev skills | `.kiro/skills/` | add a resource mapping, an IaC source, a diagram format; write a spec |
| Hooks | `.kiro/hooks/` | security guard, validate on save, Stop gate, consistency between artifacts |
| **The Power** | `power/livearch/` | `plugin.json` + skills `architecture-diagrams` and `setup-live-sync` |
| Golden example | `examples/aws-three-tier/` | Terraform in, expected diagrams out |

## Try it
```bash
S=power/livearch/skills/architecture-diagrams/scripts
python3 $S/render.py examples/aws-three-tier/docs/architecture/model.json
python3 $S/validate_architecture.py examples/aws-three-tier/docs/architecture
python3 .kiro/hooks/scripts/stop_gate.py        # no output = all gates green
```
Open `examples/aws-three-tier/docs/architecture/architecture.drawio` in draw.io. To view the ArchiMate model, import
`architecture.archimate.xml` into Archi (*File → Import → Open Exchange XML Model*).
