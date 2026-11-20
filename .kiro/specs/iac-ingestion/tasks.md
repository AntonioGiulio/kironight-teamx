# Tasks: IaC ingestion

- [ ] 1. Scaffold del server MCP `livearch`
  - [ ] 1.1 Creare `power/livearch/mcp/` con `package.json` (versioni esatte: `typescript`, `@modelcontextprotocol/sdk`, `yaml`; nessun `^`/`~`), `tsconfig.json` strict e lo script `npm test` (`tsc && node --test dist/test`)
  - [ ] 1.2 Creare `power/livearch/mcp.json` (stdio, `node dist/server.js`) e aggiornare `power/livearch/README.md`
  - [ ] 1.3 Implementare `fs/safe-path.ts` con `realpath` e l'errore `PATH_OUTSIDE_ROOT`; test con symlink verso l'esterno
  - _Requirements: ING-8.1, ING-8.2_

- [ ] 2. Tipi e contratto
  - [ ] 2.1 Scrivere `ingest/types.ts` come in `design.md`
  - [ ] 2.2 Funzioni di ordinamento stabile per risorse, riferimenti, file e warning
  - [ ] 2.3 Calcolo SHA-256 dei file letti
  - [ ] 2.4 Test `contract.test.ts`: due esecuzioni sullo stesso input danno JSON identico byte per byte; riferimenti senza duplicati
  - _Requirements: ING-2.1, ING-2.2, ING-2.3, ING-2.4_

- [ ] 3. Rilevamento
  - [ ] 3.1 `ingest/detect.ts` con i marker di `.kiro/steering/iac-sources.md`, le esclusioni di cartelle e l'eccezione `cdk.out`
  - [ ] 3.2 Assegnare i template in `cdk.out/` solo a `cdk`; stato `needs-synth` se `cdk.json` c'è e `cdk.out/` manca
  - [ ] 3.3 Test `detect.test.ts`: repo vuoto (`no IaC found`), repo misto, ordinamento, `node_modules` ignorato
  - _Requirements: ING-1.1, ING-1.2, ING-1.3, ING-1.4, ING-1.5, ING-5.5_

- [ ] 4. Redazione
  - [ ] 4.1 `ingest/redact.ts`: nomi sensibili → `<redacted>`, account ID → `<account>`
  - [ ] 4.2 Esclusione di `*.tfvars`, `*.tfvars.json`, `.env`, `*.tfstate*` dalla lettura (anche se passati esplicitamente)
  - [ ] 4.3 Test `redact.test.ts` con la fixture `secrets/`: nessuna stringa di 12 cifre e nessun valore sensibile nell'output serializzato
  - _Requirements: ING-6.1, ING-6.2, ING-6.3_

- [ ] 5. Adapter Terraform statico
  - [ ] 5.1 Lexer e parser HCL del sottoinsieme (D-ING-1), con posizioni di riga
  - [ ] 5.2 Estrazione dei blocchi `resource` con indirizzi completi (esclusi `data`, `variable`, `output`, `locals`, `provider`) ed estrazione dei riferimenti dai traversal
  - [ ] 5.3 Espansione dei moduli locali e gestione dei moduli remoti (`REMOTE_MODULE`)
  - [ ] 5.4 Risoluzione dei letterali, `var.*` con default non sensibile, `__unresolved` + `UNRESOLVED_EXPRESSION`
  - [ ] 5.5 `count`/`for_each` letterali → `__instances`
  - [ ] 5.6 Test `terraform-static.test.ts` con le fixture `tf-modules/` ed `examples/aws-three-tier/terraform`
  - _Requirements: ING-3.1, ING-3.2, ING-3.3, ING-3.4, ING-3.5, ING-6.4_

- [ ] 6. Prestazioni Terraform
  - [ ] 6.1 Script di generazione della fixture `perf-200/` (deterministico)
  - [ ] 6.2 Test `perf.test.ts`: mediana di 5 esecuzioni ≤ 2 s
  - _Requirements: ING-3.6_

- [ ] 7. Adapter Terraform da piano
  - [ ] 7.1 `ingest/terraform/plan.ts`: `planned_values` + `configuration`, moduli figli ricorsivi
  - [ ] 7.2 Maschera `sensitive_values` + redazione
  - [ ] 7.3 Test `terraform-plan.test.ts` con `tf-plan/plan.json`, più un test che verifica che non venga avviato alcun processo
  - _Requirements: ING-4.1, ING-4.2, ING-4.3_

- [ ] 8. Adapter CloudFormation e CDK
  - [ ] 8.1 `ingest/cloudformation.ts`: JSON + YAML con custom tags, indirizzi `<Stack>.<LogicalId>`
  - [ ] 8.2 Estrazione dei riferimenti da `Ref`, `Fn::GetAtt`, `Fn::Sub`, `Fn::ImportValue`
  - [ ] 8.3 Stack annidati → `module`
  - [ ] 8.4 `ingest/cdk.ts`: `cdk.out/*.template.json`, `__cdkPath`, rilevamento di synth obsoleto (`STALE_SYNTH`)
  - [ ] 8.5 Test `cloudformation.test.ts` (`cfn-yaml/`) e `cdk.test.ts` (`cdk-app/`, con mtime manipolati per il caso obsoleto)
  - _Requirements: ING-5.1, ING-5.2, ING-5.3, ING-5.4, ING-5.6_

- [ ] 9. Errori di parsing
  - [ ] 9.1 Ogni adapter converte le eccezioni del parser in `PARSE_ERROR` `<file>:<linea>: <errore>`
  - [ ] 9.2 `status: "failed"` azzera `resources`
  - [ ] 9.3 Test `errors.test.ts` con la fixture `broken/`
  - _Requirements: ING-7.1, ING-7.2_

- [ ] 10. Tool MCP
  - [ ] 10.1 Registrare `detect_sources` e `parse_iac` in `server.ts` con gli schemi di input/output
  - [ ] 10.2 Test `server.test.ts` via client MCP in-process (lista dei tool, chiamata su `examples/aws-three-tier`)
  - [ ] 10.3 Test `sandbox.test.ts`: stub di `net.connect` e `child_process.spawn` che lanciano un errore; i due tool riescono comunque
  - _Requirements: ING-8.1, ING-8.3_
