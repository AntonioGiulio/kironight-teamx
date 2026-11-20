---
inclusion: always
---

# Project Structure

```
.
├── .kiro/                          # contesto per sviluppare LiveArch (dev-time)
│   ├── steering/                   # regole: prodotto, stack, modello, notazioni, sicurezza, glossario
│   ├── specs/                      # una cartella per feature: requirements.md, design.md, tasks.md
│   ├── skills/                     # procedure per chi sviluppa il Power (es. aggiungere una risorsa al catalogo)
│   ├── hooks/                      # controlli automatici (*.json, schema v1) + scripts/
│   └── settings/mcp.json
├── power/livearch/                 # IL DELIVERABLE: il Kiro Power installabile
│   ├── plugin.json                 # manifest Agent Plugins (keywords di attivazione)
│   ├── README.md                   # (mcp.json arriverà con il server MCP pianificato)
│   └── skills/
│       ├── architecture-diagrams/  # genera e sincronizza modello + diagrammi (draw.io, Mermaid, Archify)
│       │   ├── SKILL.md
│       │   ├── references/         # FONTE DI VERITÀ: model.schema.json, resource-catalog.json, model-building.md, guide formati
│       │   └── scripts/            # render.py, validate_architecture.py, changeset.py (stdlib)
│       └── setup-live-sync/        # installa hook e steering nel repo IaC dell'utente
│           ├── SKILL.md
│           └── assets/             # livearch-sync.json (hook), livearch-steering.md
├── examples/aws-three-tier/        # golden example: terraform/ in input, docs/architecture/ atteso in output
└── docs/context-map.md             # come collaborano gli artefatti (per il pitch)
```

## Regole
- **Unica fonte di verità** per schema e catalogo: `power/livearch/skills/architecture-diagrams/references/`.
  Steering, spec e skill li **referenziano**, non li copiano.
- Il Power deve restare **autocontenuto**: niente riferimenti da `power/` verso `.kiro/` o `examples/`.
- Cartelle e file in kebab-case; script Python in snake_case.
- Ogni spec in `.kiro/specs/<feature>/` usa ID requisito `<PREFISSO>-<n>` (vedi `#[[file:.kiro/steering/glossary.md]]`).

## Output nel repo IaC dell'utente
```
docs/architecture/
├── model.json                      # modello canonico (derivato, committato)
├── architecture.drawio
├── architecture.mmd
├── architecture.archify.json       # IR Archify (deterministico)
└── architecture.html               # vista interattiva, costruita dalla CLI di Archify
.kiro/hooks/livearch-sync.json      # installato da setup-live-sync
.kiro/steering/livearch.md          # installato da setup-live-sync
```
