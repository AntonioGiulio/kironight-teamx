# Tasks: Architecture model

Le attività già coperte dalla versione agent-driven (agente + script Python) sono spuntate; il resto è il porting nel
server MCP `livearch`.

- [x] 1. Contratto e validazione del modello (oggi in Python)
  - [x] 1.1 `model.schema.json` con `modelVersion`, `generator.catalogVersion`, `source.files[]`, ordinamento per `id`
  - [x] 1.2 `validate_architecture.py` `check_model`: chiavi obbligatorie, ordinamento, duplicati, `diagramId`, label, `catalogVersion`
  - _Requirements: MOD-1.1, MOD-1.2, MOD-1.3, MOD-3.2, MOD-3.3_

- [x] 2. Changeset
  - [x] 2.1 `scripts/changeset.py`: `added`/`removed`/`changed` per sezione, `-` come modello vuoto, `--json`
  - [x] 2.2 Riepilogo in ≤ 5 righe con `(+N)` e `total`, `no architectural change`
  - _Requirements: MOD-8.1, MOD-8.2, MOD-8.3, MOD-8.4_

- [x] 3. Golden example
  - [x] 3.1 `examples/aws-three-tier/docs/architecture/model.json` (3 gruppi, 6 nodi, 6 edge, 0 warning) validato dallo Stop gate
  - _Requirements: MOD-9.1, MOD-9.2, MOD-9.3_

- [ ] 4. Tipi e classificazione (TypeScript)
  - [ ] 4.1 `model/types.ts` come in `design.md`
  - [ ] 4.2 `model/classify.ts`: lookup esatto prima di `hiddenPrefixes`, nodo `external` + `UNMAPPED_TYPE`
  - [ ] 4.3 Test `classify.test.ts`: alias CloudFormation, esatto vs prefisso, tipo sconosciuto
  - _Requirements: MOD-2.1, MOD-2.2, MOD-2.3, MOD-2.4, MOD-2.5_

- [ ] 5. ID, label e istanze
  - [ ] 5.1 `model/ids.ts`: `sanitize`, `diagramId`, ID degli edge, errore `DIAGRAM_ID_COLLISION`
  - [ ] 5.2 Label dall'indirizzo o da `__cdkPath`, troncamento a 40 con `…`
  - [ ] 5.3 `model/instances.ts`: soglia 3, `instances`, `unresolved = "count"`
  - [ ] 5.4 Test `ids.test.ts` e `instances.test.ts` (inclusa una collisione `a-b` / `a_b`)
  - _Requirements: MOD-3.1, MOD-3.2, MOD-3.3, MOD-3.4, MOD-3.5, MOD-4.1, MOD-4.2, MOD-4.3_

- [ ] 6. Appartenenza ai gruppi
  - [ ] 6.1 `model/membership.ts`: BFS attraverso le risorse nascoste, priorità subnet > network, ordine di sorgente
  - [ ] 6.2 `parent` delle subnet, gruppi `module` solo con più root module o stack
  - [ ] 6.3 Errore `INVALID_GROUP_TREE` su cicli o parent mancanti
  - [ ] 6.4 Test `membership.test.ts`: catena `db_instance → db_subnet_group → subnet`, repo con due stack
  - _Requirements: MOD-5.1, MOD-5.2, MOD-5.3, MOD-5.4, MOD-5.5_

- [ ] 7. Inferenza degli edge
  - [ ] 7.1 `model/edges.ts`: regole `lb-listener`, `sg-ingress`, `event-source`/`subscription`, `data-access`, `depends-on`
  - [ ] 7.2 Deduplica per coppia con priorità; nessun edge verso gruppi né self-edge
  - [ ] 7.3 Test `edges.test.ts`: una fixture per regola, più il conflitto `data-access` vs `network-flow` del golden
  - _Requirements: MOD-6.1, MOD-6.2, MOD-6.3, MOD-6.4, MOD-6.5, MOD-6.6, MOD-6.7, MOD-9.2_

- [ ] 8. Allowlist e warning
  - [ ] 8.1 `model/allowlist.ts`: solo chiavi del catalogo con valore letterale, scarto di `<redacted>` e 12 cifre
  - [ ] 8.2 Propagazione e ordinamento dei warning di ING
  - [ ] 8.3 Test `allowlist.test.ts`: attributo `password` e ARN con account ID non arrivano mai in `properties`
  - _Requirements: MOD-7.1, MOD-7.2, MOD-7.3_

- [ ] 9. Assemblaggio e determinismo
  - [ ] 9.1 `model/assemble.ts`: `generator`, `source`, ordinamento, chiavi nell'ordine dello schema, nessun timestamp
  - [ ] 9.2 Test `determinism.test.ts`: 50 permutazioni dell'input con seed fisso → stesso output byte per byte
  - [ ] 9.3 Test `golden.test.ts`: `build_model(parse_iac(golden))` identico al `model.json` committato
  - _Requirements: MOD-1.1, MOD-1.2, MOD-1.3, MOD-1.4, MOD-9.1, MOD-9.3_

- [ ] 10. Tool MCP
  - [ ] 10.1 `build_model` e `diff_models` in `server.ts`, con `previous` per la sync incrementale
  - [ ] 10.2 Porting di `changeset.py` in `model/changeset.ts` con output identico (test di confronto sulle fixture)
  - [ ] 10.3 Test `server.test.ts`: chiamata end-to-end `parse_iac` → `build_model` sul golden
  - _Requirements: MOD-10.1, MOD-10.2, MOD-8.1, MOD-8.2_
