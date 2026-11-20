---
inclusion: fileMatch
fileMatchPattern: ["power/livearch/**", "examples/**", ".kiro/specs/**", "**/model.json"]
---

# Modello canonico (Intermediate Representation)

Tutto passa dal modello: `IaC → adapter → model.json → renderer → {drawio, mmd, archify.json → html}`.
Nessun renderer legge l'IaC, nessun adapter conosce i formati di output.

Schema normativo: `#[[file:power/livearch/skills/architecture-diagrams/references/model.schema.json]]`
Procedura operativa per l'agente (stesse regole, nel Power): `power/livearch/skills/architecture-diagrams/references/model-building.md`.
Se cambi una regola qui, va aggiornata anche lì. L'hook `design-rules-changed` lo ricorda.

## Entità
- **node**: una risorsa visibile (`id`, `kind`, `label`, `iacType`, `provider`, `group`, `source`, `properties`).
- **group**: un contenitore (`account`, `region`, `network`, `subnet`, `environment`, `module`), annidabile via `parent`.
- **edge**: una relazione orientata (`from`, `to`, `kind`, `label`).

## Regole sugli ID (critiche per la live sync)
1. `node.id` = **indirizzo IaC** della risorsa:
   - Terraform: indirizzo completo, es. `module.network.aws_subnet.public[0]`.
   - CloudFormation / CDK: `<StackName>.<LogicalId>`, es. `ApiStack.OrdersQueue1A2B3C`.
2. L'ID **non dipende** da label, tag, ordine nel file o attributi: rinominare un tag non cambia l'ID.
3. ID dei diagrammi: `diagramId = "la_" + sanitize(id)` dove `sanitize` sostituisce ogni carattere fuori da
   `[A-Za-z0-9_]` con `_`. È valido sia come ID Mermaid sia come id Archify (`^[a-zA-Z][a-zA-Z0-9_-]*$`) sia come id draw.io.
   Vale anche per i gruppi. Niente `-` negli ID: in Mermaid confonde il parser degli archi.
4. ID degli edge: `<from>--<kind>--><to>`; diagramId `la_e_` + sanitize.
5. Una risorsa con `count`/`for_each` produce un nodo per istanza **solo** se le istanze sono ≤ 3; oltre, un nodo
   unico con `properties.instances = N` e label `"<label> ×N"`.

## Kind (vocabolario neutrale rispetto al provider)
`compute`, `container`, `function`, `load-balancer`, `api-gateway`, `database`, `cache`, `object-storage`,
`queue`, `topic`, `stream`, `cdn`, `dns`, `identity`, `secret`, `monitoring`, `external`.

Il mapping `iacType → kind` e quello `kind → notazione` stanno **solo** nel catalogo:
`#[[file:power/livearch/skills/architecture-diagrams/references/resource-catalog.json]]`

## Edge kind
| kind | Significato | Come si deduce |
|------|-------------|----------------|
| `network-flow` | traffico di rete | listener/target group, security group ingress, integrazioni API GW |
| `data-access` | lettura/scrittura dati | env var/ARN referenziati, policy IAM verso storage/db |
| `trigger` | evento che invoca | event source mapping, notifiche S3, subscription SNS |
| `depends-on` | dipendenza generica | riferimento esplicito non classificabile (fallback) |

Gli edge di contenimento **non esistono**: il contenimento è espresso da `node.group` / `group.parent`.

## Visibilità
- Le risorse con `visibility: "hidden"` nel catalogo (es. `aws_iam_role_policy_attachment`) non diventano nodi;
  i loro riferimenti vengono "collassati" sugli edge dei nodi visibili.
- Un `iacType` assente dal catalogo diventa un nodo `kind: "external"` con `properties.unmapped = true`
  e viene segnalato in `model.warnings[]`. Non si inventano mapping.

## Determinismo
- `nodes`, `groups`, `edges` ordinati per `id`; chiavi JSON nell'ordine dello schema.
- Nessun timestamp nel modello; la provenienza è `source.commit` (se disponibile) e `source.files[]` con hash.
