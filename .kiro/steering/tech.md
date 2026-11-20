---
inclusion: always
---

# Tech Stack

## Componenti
| Componente | Tecnologia | Stato | Note |
|------------|-----------|-------|------|
| Power | Formato **Agent Plugins 1.0** (`plugin.json`, `skills/`) | MVP | in `power/livearch/` |
| Skill del Power | Agent Skills (`SKILL.md` + `references/` + `scripts/` + `assets/`) | MVP | |
| Renderer, validatore, changeset | **Python 3.10+, solo standard library** (`scripts/render.py`, `validate_architecture.py`, `changeset.py`) | MVP | implementazione di riferimento, deterministica |
| Costruzione del modello | l'agente, seguendo `references/model-building.md` | MVP | sostituita dal server MCP |
| MCP server `livearch` | TypeScript, Node.js 22, `@modelcontextprotocol/sdk`, stdio | pianificato | specificato in `.kiro/specs/*`; porta in TS le regole degli script |
| Parsing Terraform | parsing statico HCL; `terraform show -json` facoltativo | pianificato | |
| Parsing CDK | `cdk synth` → template CloudFormation in `cdk.out/` | pianificato | CDK non viene mai parsato come TypeScript |
| Parsing CloudFormation | template JSON/YAML | pianificato | |

Nell'MVP l'LLM fa solo ciò che richiede giudizio (leggere l'IaC → modello), mentre il disegno, la validazione e il diff sono
codice deterministico. Il server MCP renderà deterministica anche la costruzione del modello.

## Perché
- **Python stdlib per gli script**: le skill devono funzionare nel repo dell'utente senza `npm install` né venv.
- **CDK via synth**: il CloudFormation sintetizzato è l'unica rappresentazione affidabile; parsare il TypeScript
  di CDK porterebbe a risultati parziali.
- **MCP server separato**: il rendering deterministico è codice, non generazione LLM. L'agente orchestra,
  gli strumenti producono i file.

## Comandi
| Scopo | Comando |
|-------|---------|
| Renderizza un modello | `python3 power/livearch/skills/architecture-diagrams/scripts/render.py <dir>/model.json` |
| Valida un set di diagrammi | `python3 power/livearch/skills/architecture-diagrams/scripts/validate_architecture.py <dir>` |
| Valida il catalogo | `python3 power/livearch/skills/architecture-diagrams/scripts/validate_architecture.py --catalog` |
| Changeset tra due modelli | `python3 power/livearch/skills/architecture-diagrams/scripts/changeset.py <old> <new>` |
| Tracciabilità delle spec | `python3 .kiro/hooks/scripts/check_spec_traceability.py` |
| Tutti i gate (come l'hook Stop) | `python3 .kiro/hooks/scripts/stop_gate.py` (nessun output = OK) |

## Convenzioni
- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`), scope consigliati: `power`, `skill`, `spec`, `steering`, `hook`.
- Dipendenze con versioni **pinnate** (mai `latest`, mai range `^`/`~` nel `mcp.json` del Power).
- File generati: UTF-8, LF, newline finale, JSON indentato a 2 spazi, chiavi in ordine stabile.
- Nessun segreto nel repo né nei diagrammi: vedi `#[[file:.kiro/steering/security.md]]`.
- Le modifiche a schema o catalogo richiedono l'aggiornamento del golden example nello stesso commit.
