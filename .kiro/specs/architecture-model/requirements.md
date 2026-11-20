# Requirements: Architecture model

Prefisso: `MOD` · Dipendenze: consuma i `RawResource[]` di ING, produce il `model.json` consumato da REN e SYNC ·
Steering: `.kiro/steering/architecture-model.md`, `.kiro/steering/security.md`, `.kiro/steering/glossary.md`.

## Introduzione
Il **modello** (`docs/architecture/model.json`) è l'unica fonte per i renderer. Questa spec copre la trasformazione
`RawResource[]` → modello: classificazione con il catalogo, ID, gruppi, edge, allowlist delle proprietà, changeset e
il tool MCP `build_model`. Contratto: `power/livearch/skills/architecture-diagrams/references/model.schema.json`.
Regole operative: `power/livearch/skills/architecture-diagrams/references/model-building.md`.

## Fuori scope
- Lettura dell'IaC e redazione alla fonte (ING).
- Layout, stili e formati di output (REN).
- Mapping per provider diversi da `aws`: si aggiungono al catalogo con lo skill `add-resource-mapping`, non qui.

## Requisiti

### MOD-1: Contratto del modello
**User story:** Come sviluppatore di un renderer, voglio un modello con un contratto stabile, così che il renderer non debba conoscere l'IaC.

1. **MOD-1.1**: THE SYSTEM SHALL produrre un `model.json` valido rispetto a `model.schema.json`, con `modelVersion = "1.0.0"` e `generator.catalogVersion` uguale a `catalogVersion` di `resource-catalog.json`.
2. **MOD-1.2**: THE SYSTEM SHALL ordinare `groups`, `nodes` ed `edges` per `id` e serializzare il JSON con indentazione di 2 spazi e newline finale.
3. **MOD-1.3**: THE SYSTEM SHALL non scrivere timestamp nel modello; la provenienza è solo `source.commit` (o `null`) e `source.files[]` (`path`, `sha256`).
4. **MOD-1.4**: WHEN lo stesso `RawResource[]` viene trasformato due volte, THE SYSTEM SHALL produrre due `model.json` identici byte per byte.
5. **MOD-1.5**: THE SYSTEM SHALL impostare `generator.name = "livearch"` e `generator.version` uguale a `version` di `power/livearch/plugin.json`.
6. **MOD-1.6**: WHEN cambia soltanto l'ordine dei `RawResource[]`, dei file o dei blocchi nei file, THE SYSTEM SHALL produrre lo stesso `model.json` byte per byte.

### MOD-2: Classificazione con il catalogo
**User story:** Come platform engineer, voglio che ogni risorsa sia classificata sempre allo stesso modo, così che il diagramma non dipenda dall'LLM.

1. **MOD-2.1**: WHEN un `iacType` corrisponde esattamente a un `iacType` o a un `alias` di `resources` nel catalogo, THE SYSTEM SHALL creare un nodo con il `kind` e il `provider` di quella voce.
2. **MOD-2.2**: WHEN un `iacType` corrisponde a una voce di `groups`, THE SYSTEM SHALL creare un gruppo con `kind = groupKind` di quella voce e nessun nodo.
3. **MOD-2.3**: WHEN un `iacType` corrisponde a `hidden` o a un `hiddenPrefixes`, THE SYSTEM SHALL non creare né nodo né gruppo e usare la risorsa solo per collassare i riferimenti (MOD-5.2, MOD-6).
4. **MOD-2.4**: IF un `iacType` compare sia come corrispondenza esatta sia sotto un `hiddenPrefixes`, THEN THE SYSTEM SHALL applicare la corrispondenza esatta.
5. **MOD-2.5**: IF un `iacType` non è nel catalogo, THEN THE SYSTEM SHALL creare un nodo `kind: "external"` con `properties.unmapped = true` e un warning `UNMAPPED_TYPE` con `ref` uguale all'indirizzo, senza inventare un mapping.

### MOD-3: ID e label
**User story:** Come utente della live sync, voglio ID che non cambiano quando rinomino un tag, così che il layout manuale sopravviva.

1. **MOD-3.1**: THE SYSTEM SHALL usare come `id` di nodi e gruppi l'indirizzo IaC (`RawResource.address`), indipendente da label, tag, attributi e ordine nel file.
2. **MOD-3.2**: THE SYSTEM SHALL calcolare `diagramId = "la_" + sanitize(id)` per nodi e gruppi, dove `sanitize` sostituisce con `_` ogni carattere fuori da `[A-Za-z0-9_]`.
3. **MOD-3.3**: THE SYSTEM SHALL calcolare l'`id` di un edge come `<from>--<kind>--><to>` e il suo `diagramId` come `"la_e_" + sanitize(id)`.
4. **MOD-3.4**: THE SYSTEM SHALL usare come label la parte nome dell'indirizzo (`orders` per `aws_sqs_queue.orders`) o l'ultimo segmento di `__cdkPath`, troncata a 40 caratteri con `…`, e mai valori di tag o variabili.
5. **MOD-3.5**: WHEN due risorse diverse producono lo stesso `diagramId`, THE SYSTEM SHALL fallire la costruzione del modello con l'errore `DIAGRAM_ID_COLLISION` che elenca i due indirizzi.

### MOD-4: Istanze multiple
**User story:** Come lettore del diagramma, voglio vedere le istanze solo quando sono poche, così che il diagramma resti leggibile.

1. **MOD-4.1**: WHEN `attributes.__instances` è ≤ 3, THE SYSTEM SHALL creare un nodo per istanza con indirizzo indicizzato (`[0]`, `["key"]`).
2. **MOD-4.2**: WHEN `attributes.__instances` è > 3, THE SYSTEM SHALL creare un solo nodo con `properties.instances = N` e label `"<label> ×N"`.
3. **MOD-4.3**: IF `attributes.__instances` è `null`, THEN THE SYSTEM SHALL creare un solo nodo con `properties.unresolved = "count"`.

### MOD-5: Appartenenza ai gruppi
**User story:** Come nuovo membro del team, voglio vedere in quale rete e subnet sta ogni risorsa, così che capisca l'esposizione.

1. **MOD-5.1**: THE SYSTEM SHALL assegnare a `node.group` il gruppo più specifico referenziato tramite l'attributo `membership` del catalogo e i suoi sinonimi (`subnet_id`, `subnets`, `subnet_ids`, `vpc_id`); una subnet prevale su una network e, tra due subnet, prevale la prima in ordine di sorgente.
2. **MOD-5.2**: WHEN l'appartenenza passa per una risorsa nascosta (`aws_db_instance → aws_db_subnet_group → aws_subnet`), THE SYSTEM SHALL seguirla fino al gruppo visibile.
3. **MOD-5.3**: THE SYSTEM SHALL impostare `group.parent` di una subnet al suo VPC e `group: null` per i nodi senza gruppo.
4. **MOD-5.4**: WHEN il repo contiene più di un root module Terraform o più di uno stack CloudFormation/CDK, THE SYSTEM SHALL creare un gruppo `kind: "module"` per ciascuno; con un solo root module o stack, THE SYSTEM SHALL non crearlo.
5. **MOD-5.5**: IF la catena `parent` contiene un ciclo o un gruppo inesistente, THEN THE SYSTEM SHALL fallire con l'errore `INVALID_GROUP_TREE` e non scrivere il modello.
6. **MOD-5.6**: WHEN un `RawResource` ha `module` diverso da `null` (modulo Terraform locale o stack CloudFormation annidato, ING-3.2 e ING-5.3), THE SYSTEM SHALL creare un gruppo `kind: "module"` con `id` uguale a quel valore e assegnargli le risorse che non hanno un gruppo più specifico.

### MOD-6: Inferenza degli edge
**User story:** Come reviewer, voglio frecce che dicano che tipo di relazione c'è, così che distingua traffico, dati ed eventi.

1. **MOD-6.1**: WHEN un listener inoltra a un target group usato da un servizio, THE SYSTEM SHALL creare `LB --network-flow--> servizio` con label `"<PROTOCOL> <port>"` del listener.
2. **MOD-6.2**: WHEN una regola ingress del security group B ammette il security group A, THE SYSTEM SHALL creare `network-flow` da ogni nodo che usa A a ogni nodo che usa B, con label `"TCP <port>"`.
3. **MOD-6.3**: WHEN esiste un event source mapping, una notifica o una subscription, THE SYSTEM SHALL creare `sorgente --trigger--> destinazione`.
4. **MOD-6.4**: WHEN un nodo `compute`, `container` o `function` referenzia, direttamente o tramite risorse nascoste, un nodo `queue`, `topic`, `stream`, `database`, `cache`, `object-storage` o `secret`, THE SYSTEM SHALL creare un edge `data-access` con label `null`.
5. **MOD-6.5**: WHEN due nodi visibili si referenziano e nessuna regola da MOD-6.1 a MOD-6.4 si applica, THE SYSTEM SHALL creare un edge `depends-on`.
6. **MOD-6.6**: IF più regole producono edge tra la stessa coppia (`from`, `to`), THEN THE SYSTEM SHALL tenere solo quello di priorità più alta (`network-flow` > `trigger` > `data-access` > `depends-on`).
7. **MOD-6.7**: THE SYSTEM SHALL non creare edge verso gruppi, edge di contenimento né self-edge.
8. **MOD-6.8**: WHEN un riferimento passa da una o più risorse nascoste (`A → hidden → … → B`), THE SYSTEM SHALL trattarlo come riferimento diretto `A → B` per MOD-6.4 e MOD-6.5.
9. **MOD-6.9**: WHEN il catalogo dichiara un `edgeInference` che non ha un'implementazione registrata, THE SYSTEM SHALL rifiutare il caricamento del catalogo con l'errore `UNKNOWN_EDGE_RULE` che indica il nome della regola.

### MOD-7: Allowlist delle proprietà
**User story:** Come security engineer, voglio che nel modello entrino solo proprietà approvate, così che un nuovo attributo sensibile non trapeli per errore.

1. **MOD-7.1**: THE SYSTEM SHALL copiare in `node.properties` solo le chiavi elencate in `properties` della voce di catalogo che hanno un valore letterale, più `instances`, `unmapped` e `unresolved`.
2. **MOD-7.2**: IF un valore di `node.properties` contiene `<redacted>` o una sequenza di 12 cifre, THEN THE SYSTEM SHALL scartare la proprietà.
3. **MOD-7.3**: THE SYSTEM SHALL propagare in `model.warnings[]` i warning di ING, ordinati per (`code`, `ref`, `message`), usando solo i codici di `model.schema.json` `$defs.warning.code`.

### MOD-8: Changeset
**User story:** Come platform engineer, voglio sapere cosa è cambiato nell'architettura dopo una sync, così che possa verificarlo in pochi secondi.

1. **MOD-8.1**: WHEN si confrontano due modelli, THE SYSTEM SHALL produrre per `groups`, `nodes` ed `edges` le liste ordinate `added`, `removed`, `changed` (stesso `id`, contenuto diverso).
2. **MOD-8.2**: WHEN il changeset viene stampato in forma testuale, THE SYSTEM SHALL usare al massimo 5 righe, con al massimo 4 elementi per riga seguiti da `(+N)`, e l'ultima riga `total: <N> change(s)`.
3. **MOD-8.3**: IF i due modelli hanno gli stessi `groups`, `nodes` ed `edges`, THEN THE SYSTEM SHALL stampare `no architectural change`.
4. **MOD-8.4**: WHEN il modello precedente non esiste (primo sync, argomento `-`), THE SYSTEM SHALL trattarlo come modello vuoto.

### MOD-9: Golden example
**User story:** Come sviluppatore del Power, voglio un caso di regressione concreto, così che ogni modifica a catalogo o regole sia verificata.

1. **MOD-9.1**: WHEN il modello viene costruito da `examples/aws-three-tier/terraform`, THE SYSTEM SHALL produrre esattamente `examples/aws-three-tier/docs/architecture/model.json`: 3 gruppi, 6 nodi, 6 edge, 0 warning.
2. **MOD-9.2**: WHEN il golden example viene costruito, THE SYSTEM SHALL classificare `aws_ecs_service.api → aws_db_instance.orders_db` come `network-flow` (regola SG, MOD-6.2) e non come `data-access`.
3. **MOD-9.3**: WHEN il golden example viene costruito, THE SYSTEM SHALL non creare nodi per ruoli IAM e per `aws_s3_bucket_public_access_block`.

### MOD-10: Tool MCP
**User story:** Come utente di Kiro, voglio che il modello sia costruito da un tool deterministico, così che il risultato non dipenda dall'LLM.

1. **MOD-10.1**: WHERE il server MCP `livearch` è installato, THE SYSTEM SHALL esporre i tool `build_model` e `diff_models` con gli schemi di `design.md` § Components and interfaces.
2. **MOD-10.2**: WHERE `build_model` riceve `previous`, THE SYSTEM SHALL riusare gli `id` del modello precedente per ogni indirizzo ancora presente e restituire il changeset di MOD-8 insieme al modello.
3. **MOD-10.3**: WHEN `build_model` riceve `previous`, THE SYSTEM SHALL produrre un `model` identico byte per byte a quello prodotto senza `previous` sullo stesso input: `previous` serve solo al changeset.
4. **MOD-10.4**: WHEN `diff_models` e `scripts/changeset.py` confrontano gli stessi due modelli, THE SYSTEM SHALL restituire un `summary` identico riga per riga all'output testuale di `changeset.py` e un `changeset` uguale al suo output `--json`.
5. **MOD-10.5**: WHEN `parse_iac` e `build_model` vengono eseguiti in sequenza sulla fixture `perf-200` di ING (200 risorse in 20 file), THE SYSTEM SHALL completare entrambi in ≤ 3 s (mediana di 5 esecuzioni sulla macchina di riferimento).
