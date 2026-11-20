---
inclusion: always
---

# Project Structure

> Da aggiornare man mano che il progetto prende forma.

```
.
├── .kiro/
│   ├── steering/   # contesto persistente per l'agente (product, tech, structure)
│   ├── specs/      # una cartella per feature: requirements.md, design.md, tasks.md
│   ├── skills/     # procedure riutilizzabili: <nome-skill>/SKILL.md
│   ├── hooks/      # automazioni dell'agente (*.kiro.hook)
│   └── settings/   # configurazione (mcp.json)
└── README.md
```

## Convenzioni
- Ogni feature parte da uno spec in `.kiro/specs/<nome-feature>/`.
- Nomi di file e cartelle in kebab-case.
