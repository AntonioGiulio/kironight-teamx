---
inclusion: always
---

# Glossario

Termini da usare **sempre con questo significato** in codice, spec, skill e diagrammi.

| Termine | Significato |
|---------|-------------|
| **Power** | Il pacchetto Kiro `power/livearch/` (Agent Plugins): manifest, skill, MCP server. |
| **IaC repo** | Il repository dell'utente che LiveArch analizza. Non questo repository. |
| **Adapter** | Componente che trasforma un linguaggio IaC in `RawResource[]`. Uno per linguaggio. |
| **RawResource** | Risorsa IaC grezza: indirizzo, tipo, attributi, riferimenti, posizione nel file. |
| **Modello** | `model.json`, la rappresentazione canonica (nodi, gruppi, edge). Unica fonte per i renderer. |
| **Catalogo** | `resource-catalog.json`: mapping `iacType → kind → notazioni`, visibilità, allowlist delle proprietà. |
| **Nodo / Gruppo / Edge** | Risorsa visibile / contenitore / relazione orientata del modello. |
| **kind** | Categoria neutrale rispetto al provider (`database`, `queue`…), definita nel catalogo. |
| **tier** | Colonna di layout (0–5) associata a un kind. |
| **diagramId** | `la_` + indirizzo sanitizzato: l'ID usato in tutti e tre i formati. |
| **Renderer** | Componente che trasforma il modello in un formato (drawio, mermaid, archify). |
| **Sync** | Ciclo IaC → modello → renderer, eseguito su un repo esistente. **Incrementale** se riusa il modello precedente. |
| **Live sync** | Sync attivata automaticamente da un hook alla modifica di un file IaC. |
| **Cella gestita** | Cella draw.io con `livearch_managed="1"`. Le altre sono **celle utente** e sono intoccabili. |
| **Golden example** | `examples/aws-three-tier/`: input IaC con output atteso, usato come test di regressione. |

## Prefissi degli ID requisito
| Prefisso | Spec |
|----------|------|
| `ING` | `.kiro/specs/iac-ingestion` |
| `MOD` | `.kiro/specs/architecture-model` |
| `REN` | `.kiro/specs/diagram-rendering` |
| `SYNC` | `.kiro/specs/live-sync` |
