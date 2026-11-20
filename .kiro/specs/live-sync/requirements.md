# Requirements: Live sync

Prefisso: `SYNC` · Dipendenze: orchestra ING (`parse_iac`), MOD (modello e changeset di MOD-8) e REN (render e
validatore) · Steering: `.kiro/steering/product.md`, `.kiro/steering/security.md`, `.kiro/steering/glossary.md`.

## Introduzione
La **sync** è il ciclo IaC → modello → diagrammi su un IaC repo esistente; la **live sync** è la stessa sync avviata
da un hook quando l'agente salva un file IaC. In questa spec rientrano l'installazione nel repo dell'utente (skill
`setup-live-sync`), l'hook installato, il flusso incrementale dello skill `architecture-diagrams`, la protezione dei
file generati e la modalità watch del server MCP.

## Fuori scope
- Modifiche manuali all'IaC fatte fuori da Kiro, senza server MCP: gli hook di Kiro sui file scattano solo sulle
  modifiche dell'agente (vedi SYNC-6).
- CI e commenti automatici sulle PR (feature futura "diff architetturale nelle PR").
- Commit e push dei diagrammi: li decide l'utente.

## Requisiti

### SYNC-1: Installazione nel repo IaC
**User story:** Come platform engineer, voglio attivare la live sync con una richiesta, così che non debba configurare hook a mano.

1. **SYNC-1.1**: WHEN l'utente chiede di attivare la live sync, THE SYSTEM SHALL installare `assets/livearch-sync.json` come `.kiro/hooks/livearch-sync.json` e `assets/livearch-steering.md` come `.kiro/steering/livearch.md`, copiati byte per byte.
2. **SYNC-1.2**: IF il repo non contiene `*.tf`, `cdk.json` né template CloudFormation, THEN THE SYSTEM SHALL non installare nulla e comunicarlo all'utente.
3. **SYNC-1.3**: WHEN un file di destinazione esiste ed è identico all'asset, THE SYSTEM SHALL lasciarlo invariato, così che una seconda installazione non modifichi alcun file.
4. **SYNC-1.4**: IF un file di destinazione esiste ed è diverso dall'asset, THEN THE SYSTEM SHALL mostrare il diff e chiedere all'utente `replace`, `keep` o `merge`, senza sovrascrivere.
5. **SYNC-1.5**: IF il remote `origin` è pubblico (`gh repo view --json visibility` = `PUBLIC`) o la visibilità non è determinabile, THEN THE SYSTEM SHALL avvisare che i diagrammi rivelano la topologia e chiedere conferma prima di installare.
6. **SYNC-1.6**: WHEN l'installazione termina, THE SYSTEM SHALL eseguire una sync completa (SYNC-3 con modello precedente `-`) e mostrarne il report.

### SYNC-2: Trigger della live sync
**User story:** Come platform engineer, voglio che i diagrammi si aggiornino quando Kiro modifica l'IaC, così che non debba ricordarmelo.

1. **SYNC-2.1**: WHEN l'agente salva un file che corrisponde a `\.tf$`, `cdk.out/*.template.json` o `*.template.(json|yaml|yml)`, THE SYSTEM SHALL avviare una sync incrementale di `docs/architecture/`.
2. **SYNC-2.2**: WHILE una live sync è in corso, THE SYSTEM SHALL scrivere solo file in `docs/architecture/` e non modificare alcun file IaC.
3. **SYNC-2.3**: WHEN l'agente salva un file che non corrisponde ai pattern di SYNC-2.1 (per esempio `*.tfvars`, `README.md`), THE SYSTEM SHALL non avviare la sync.

### SYNC-3: Sync incrementale
**User story:** Come utente, voglio che la sync tocchi solo ciò che è cambiato, così che i diff restino piccoli e il mio layout resti intatto.

1. **SYNC-3.1**: WHEN parte una sync, THE SYSTEM SHALL leggere `docs/architecture/model.json` se esiste, riusare gli `id` degli indirizzi ancora presenti e scrivere il nuovo modello in `docs/architecture/model.next.json`.
2. **SYNC-3.2**: WHEN il changeset di MOD-8 tra `model.json` e `model.next.json` è `no architectural change`, THE SYSTEM SHALL cancellare `model.next.json`, non rilanciare il render e riportare `no architectural change`.
3. **SYNC-3.3**: WHEN il changeset non è vuoto, THE SYSTEM SHALL sostituire `model.json` con `model.next.json`, eseguire `render.py` (REN) e poi `validate_architecture.py` (REN-5).
4. **SYNC-3.4**: WHEN la sync termina, THE SYSTEM SHALL riportare in al massimo 5 righe il changeset, i `warnings` del modello e i percorsi dei file scritti.
5. **SYNC-3.5**: WHEN al golden example viene aggiunta in `examples/aws-three-tier/terraform/data.tf` una risorsa `aws_sqs_queue.dlq` senza riferimenti, THE SYSTEM SHALL produrre il changeset `added: node aws_sqs_queue.dlq` / `total: 1 change(s)` e lo stesso nodo in tutti e tre i formati, lasciando invariata la geometria delle celle draw.io esistenti.

### SYNC-4: Errori durante la sync
**User story:** Come utente, voglio che una sync fallita non rovini i diagrammi esistenti, così che il repo resti sempre in uno stato coerente.

1. **SYNC-4.1**: IF l'IaC non è analizzabile (`PARSE_ERROR` di ING-7), THEN THE SYSTEM SHALL lasciare invariati tutti i file di `docs/architecture/` e riportare `PARSE_ERROR` con `<file>:<linea>`.
2. **SYNC-4.2**: IF il validatore restituisce `RESULT: FAIL`, THEN THE SYSTEM SHALL correggere `model.json`, rilanciare render e validatore e, dopo 2 tentativi falliti, fermarsi e mostrare gli errori all'utente.
3. **SYNC-4.3**: IF la sync richiederebbe `terraform init`, `terraform plan` o `cdk synth`, THEN THE SYSTEM SHALL chiedere conferma all'utente prima di eseguirli; IF l'utente rifiuta, THEN THE SYSTEM SHALL proseguire con i dati presenti e il warning `STALE_SYNTH` dove applicabile.

### SYNC-5: Protezione dei file generati
**User story:** Come utente, voglio che l'agente non possa "aggiustare" i diagrammi a mano, così che restino sempre derivati dall'IaC.

1. **SYNC-5.1**: WHEN l'agente tenta una scrittura diretta su `docs/architecture/architecture.drawio`, `architecture.mmd`, `architecture.archify.json` o `architecture.html`, THE SYSTEM SHALL bloccarla (exit code 2 dell'hook `livearch-block-manual-diagram-writes`) con il messaggio `LiveArch: diagrams are generated. Update docs/architecture/model.json and run scripts/render.py from the architecture-diagrams skill.`
2. **SYNC-5.2**: WHEN `render.py` scrive gli stessi file, THE SYSTEM SHALL non bloccarlo, perché non passa dal tool di scrittura dell'agente.

### SYNC-6: Modifiche manuali e modalità watch
**User story:** Come platform engineer che modifica l'IaC nel proprio editor, voglio un modo per allineare i diagrammi, così che la live sync copra anche il mio lavoro.

1. **SYNC-6.1**: WHEN l'installazione termina, THE SYSTEM SHALL spiegare in una frase che gli hook scattano solo sulle modifiche dell'agente e che dopo una modifica manuale basta chiedere "sync the architecture".
2. **SYNC-6.2**: WHERE il server MCP `livearch` è installato e l'utente attiva `watch`, THE SYSTEM SHALL osservare i file dei pattern di SYNC-2.1 e avviare una sync 2 s dopo l'ultima modifica (debounce), una sola alla volta.
3. **SYNC-6.3**: WHILE la modalità watch è attiva, THE SYSTEM SHALL ignorare le modifiche in `docs/architecture/`, `.terraform/`, `node_modules/` e `.git/`, così che il render non riavvii la sync.
4. **SYNC-6.4**: WHEN un ciclo di watch termina, THE SYSTEM SHALL inviare al client MCP una notifica con il `SyncReport` (`changeset`, `warnings`, `written`, `result`) di `design.md`.

### SYNC-7: Disinstallazione
**User story:** Come utente, voglio poter rimuovere LiveArch senza perdere i diagrammi, così che provarlo non abbia costi.

1. **SYNC-7.1**: WHEN l'utente chiede di disinstallare la live sync, THE SYSTEM SHALL cancellare solo `.kiro/hooks/livearch-sync.json` e `.kiro/steering/livearch.md` e lasciare `docs/architecture/` invariata.

### SYNC-8: Tool `sync` del server MCP
**User story:** Come utente di Kiro, voglio un unico comando deterministico per la sync, così che hook, watch e richieste manuali diano lo stesso risultato.

1. **SYNC-8.1**: WHERE il server MCP `livearch` è installato, THE SYSTEM SHALL esporre il tool `sync` che esegue in sequenza `parse_iac` (ING), `build_model` con `previous` (MOD), `render_diagrams` (REN) e `validate_diagrams` (REN) e restituisce un `SyncReport`.
2. **SYNC-8.2**: WHILE una sync è in corso su una root, THE SYSTEM SHALL rifiutare una seconda sync sulla stessa root con il risultato `BUSY`, sia che arrivi dal tool `sync` sia dalla modalità watch.
3. **SYNC-8.3**: WHEN `sync` viene eseguito due volte di seguito senza modifiche all'IaC, THE SYSTEM SHALL restituire alla seconda esecuzione `result: "NO_CHANGE"` e non modificare alcun file.
4. **SYNC-8.4**: WHERE il server MCP `livearch` è disponibile, THE SYSTEM SHALL far eseguire la sync dello skill `architecture-diagrams` tramite il tool `sync` invece della costruzione manuale del modello.
