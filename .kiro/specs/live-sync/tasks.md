# Tasks: Live sync

Spuntato = presente negli asset e negli skill del Power.

- [x] 1. Skill `setup-live-sync`
  - [x] 1.1 Asset `livearch-sync.json` e `livearch-steering.md`; copia byte per byte
  - [x] 1.2 Controllo della presenza di IaC, idempotenza, diff con `replace`/`keep`/`merge`
  - [x] 1.3 Avviso sulla visibilità del repo via `git remote` + `gh repo view`
  - [x] 1.4 Prima sync completa e frase sul limite degli hook
  - [x] 1.5 Sezione Uninstall
  - _Requirements: SYNC-1.1, SYNC-1.2, SYNC-1.3, SYNC-1.4, SYNC-1.5, SYNC-1.6, SYNC-6.1, SYNC-7.1_

- [x] 2. Hook installato
  - [x] 2.1 `livearch-sync-on-iac-change`: PostFileSave con il matcher IaC e prompt di sync incrementale read-only sull'IaC
  - [x] 2.2 `livearch-block-manual-diagram-writes`: PreToolUse `write`, exit 2 sui quattro file generati
  - _Requirements: SYNC-2.1, SYNC-2.2, SYNC-2.3, SYNC-5.1, SYNC-5.2_

- [x] 3. Flusso incrementale nello skill `architecture-diagrams`
  - [x] 3.1 Lettura del modello precedente, `model.next.json`, changeset, stop su `no architectural change`
  - [x] 3.2 Render, validazione con al massimo 2 retry, report in ≤ 5 righe
  - [x] 3.3 Hard rules: `PARSE_ERROR` senza toccare `docs/architecture/`, conferma prima di `init`/`plan`/`synth`
  - _Requirements: SYNC-3.1, SYNC-3.2, SYNC-3.3, SYNC-3.4, SYNC-4.1, SYNC-4.2, SYNC-4.3_

- [ ] 4. Test della live sync
  - [ ] 4.1 Test dell'hook di blocco: `tool_input` su `architecture.mmd` → exit 2, su `model.json` → exit 0
  - [ ] 4.2 Test del matcher: `app.tf` e `cdk.out/Api.template.json` avviano la sync, `prod.tfvars` e `README.md` no
  - [ ] 4.3 Scenario DLQ sul golden: changeset `added: node aws_sqs_queue.dlq`, `total: 1 change(s)`, geometria esistente invariata
  - [ ] 4.4 Scenario `.tf` rotto: hash dei file di `docs/architecture/` invariati
  - _Requirements: SYNC-2.1, SYNC-2.3, SYNC-3.5, SYNC-4.1, SYNC-5.1_

- [ ] 5. Modalità watch (server MCP)
  - [ ] 5.1 Tool `sync`, `watch`, `unwatch` in `server.ts` (orchestrano ING, MOD, REN)
  - [ ] 5.2 Watcher con debounce di 2 s, una sync alla volta, esclusione di `docs/architecture/`, `.terraform/`, `node_modules/`, `.git/`
  - [ ] 5.3 Test `watch.test.ts`: 10 salvataggi in 1 s → una sync; scrittura in `docs/architecture/` → nessuna sync
  - [ ] 5.4 Aggiornare lo step 6 di `setup-live-sync` per proporre `watch` quando il server è installato
  - _Requirements: SYNC-6.2, SYNC-6.3_
