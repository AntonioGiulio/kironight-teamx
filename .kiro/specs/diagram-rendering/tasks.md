# Tasks: Diagram rendering

Spuntato = implementato in `scripts/render.py` / `scripts/validate_architecture.py` e verificato sul golden example.

- [x] 1. Regole comuni
  - [x] 1.1 Header di provenienza senza timestamp in draw.io (`la__meta`), Mermaid (`%%`) e Archify (`subtitle`, card)
  - [x] 1.2 Auto-layout per tier e gruppi fratelli in ordine di traffico
  - [x] 1.3 Stili, forme e frecce letti solo dal catalogo
  - [x] 1.4 Idempotenza verificata dallo Stop gate (re-render == file committati)
  - _Requirements: REN-1.1, REN-1.2, REN-1.3, REN-1.4, REN-1.5_

- [x] 2. draw.io con merge
  - [x] 2.1 Celle `<object>` con `livearch_id`, `livearch_managed`, `livearch_style_hash`; cella `la__meta`
  - [x] 2.2 Conservazione di geometria e stile modificati, copia delle celle utente, rimozione delle celle obsolete
  - [x] 2.3 Errore su file compresso prima di qualsiasi scrittura
  - [x] 2.4 Icone `mxgraph.aws4` da catalogo
  - [x] 2.5 Nuovo layout se cambia il gruppo padre, crescita dei gruppi conservati (+30 px), celle utente orfane sotto `1`
  - _Requirements: REN-2.1, REN-2.2, REN-2.3, REN-2.4, REN-2.5, REN-2.6, REN-2.7, REN-2.8, REN-2.9, REN-2.10_

- [ ] 3. Test di regressione per draw.io
  - [ ] 3.1 Fixture `drawio-manual-edits/`: cella spostata, stile cambiato, nota utente, nodo rimosso dal modello, nodo spostato in un altro gruppo, nodo nuovo in un gruppo conservato, nota dentro un gruppo rimosso
  - [ ] 3.2 Test che verifica geometria, stile e nota invariati, la rimozione della cella obsoleta con i suoi edge, il nuovo layout dopo il cambio di gruppo, la crescita del gruppo e la nota spostata sotto `1`
  - _Requirements: REN-2.2, REN-2.3, REN-2.4, REN-2.5, REN-2.8, REN-2.9, REN-2.10_

- [x] 4. Mermaid
  - [x] 4.1 Header, `flowchart LR`, `subgraph` annidati, frecce e label per kind
  - [x] 4.2 Label tra doppi apici con `#quot;` e `<br/>`
  - _Requirements: REN-3.1, REN-3.2, REN-3.3, REN-3.4_

- [x] 5. Archify
  - [x] 5.1 IR `schema_version: 1` con tipi e varianti dal catalogo, `pos`/`size` dalla geometria draw.io
  - [x] 5.2 Boundary vuoti omessi, card ambra per i warning
  - [x] 5.3 `find_archify` (`ARCHIFY_HOME` + cartelle skill), build dell'HTML, skip se mancano CLI o Node.js, errore se Archify rifiuta
  - [x] 5.4 `archify finalize` sul golden example: quattro gate superati
  - [x] 5.5 Ordinamento di componenti, connessioni e boundary
  - _Requirements: REN-4.1, REN-4.2, REN-4.3, REN-4.4, REN-4.5, REN-4.6, REN-4.7, REN-4.8_

- [x] 6. Validatore
  - [x] 6.1 `check_catalog`, `check_model`, `check_drawio`, `check_mermaid`, `check_archify`, `check_secrets`
  - [x] 6.2 Output `WARN`/`ERROR`/`RESULT`, exit 0/1, modalità `--catalog`
  - [x] 6.3 Hook `validate-golden-example-on-save` e Stop gate che lo usano come gate
  - _Requirements: REN-5.1, REN-5.2, REN-5.3, REN-5.4, REN-5.5, REN-5.6_

- [ ] 7. Test di mutazione del validatore
  - [ ] 7.1 Script che copia il golden, applica una mutazione per regola (cella mancante, freccia sbagliata, componente in più, account ID, HTML non Archify) e si aspetta `RESULT: FAIL`
  - [ ] 7.2 Aggiungerlo allo Stop gate
  - _Requirements: REN-5.2, REN-5.3, REN-5.4_

- [ ] 8. Prestazioni
  - [ ] 8.1 Generatore deterministico di un modello di 200 nodi e 300 edge
  - [ ] 8.2 Misura con `--no-html`: mediana di 5 esecuzioni ≤ 2 s
  - _Requirements: REN-6.1_

- [ ] 9. Scrittura atomica
  - [ ] 9.1 `render.py`: scrivere in `<out>/.livearch-tmp/`, eseguire Archify su quella cartella, poi `os.replace` file per file; rimuovere la cartella in caso di errore
  - [ ] 9.2 Test: con Archify simulato che esce con 1 e con un renderer forzato a fallire, byte e mtime dei file esistenti restano invariati e `.livearch-tmp/` non esiste più
  - _Requirements: REN-8.1, REN-8.2_

- [ ] 10. Tool MCP
  - [ ] 10.1 `render_diagrams` e `validate_diagrams` in `server.ts` (TypeScript, `power/livearch/mcp/src/render/`), scrittura confinata alla root (`PATH_OUTSIDE_ROOT`) e atomica come in REN-8
  - [ ] 10.2 Costanti di layout, ordine degli attributi XML, escape e formattazione dei numeri identici a `render.py`
  - [ ] 10.3 Generare una volta con `render.py --no-html` e `validate_architecture.py` gli output attesi delle fixture (golden, `drawio-manual-edits/`, mutazioni) e committarli
  - [ ] 10.4 Test di parità: byte identici per i tre file e righe `ERROR`/`WARN` identiche per il validatore, senza lanciare Python
  - [ ] 10.5 Aggiornare `power/livearch/skills/architecture-diagrams/SKILL.md` (step 4–5) per usare i tool quando il server è disponibile
  - _Requirements: REN-7.1, REN-7.2, REN-7.3, REN-8.1, REN-8.2_
