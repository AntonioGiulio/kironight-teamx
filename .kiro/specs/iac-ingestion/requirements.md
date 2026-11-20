# Requirements: IaC ingestion

Prefisso: `ING` · Dipendenze: produce i `RawResource[]` consumati da MOD · Steering: `.kiro/steering/iac-sources.md`,
`.kiro/steering/security.md`, `.kiro/steering/glossary.md`.

## Introduzione
Gli **adapter** leggono l'IaC repo e producono `RawResource[]` (vedi glossario). Non conoscono il modello né i formati
di output. In questa spec rientrano rilevamento delle sorgenti, parsing di Terraform, CloudFormation e CDK (tramite
`cdk.out/`), redazione dei dati sensibili alla fonte e i tool MCP `detect_sources` e `parse_iac`.

## Fuori scope
- Chiamate a API AWS o lettura dello stato remoto (`terraform state`, backend S3).
- Parsing del codice sorgente CDK (TypeScript, Python, Java…): si legge solo `cdk.out/`.
- Download di moduli remoti o provider (`terraform init`).
- Provider diversi da `aws` nel catalogo (l'adapter li legge, la classificazione è di MOD).

## Requisiti

### ING-1: Rilevamento delle sorgenti
**User story:** Come platform engineer, voglio che LiveArch capisca da solo quali linguaggi IaC usa il mio repo, così che non debba configurare nulla.

1. **ING-1.1**: WHEN `detect_sources` riceve la root di un repo, THE SYSTEM SHALL restituire un adapter per ogni marker della tabella "Rilevamento" di `.kiro/steering/iac-sources.md` presente nel repo, con l'elenco dei file associati in percorsi relativi con `/`.
2. **ING-1.2**: WHEN la scansione incontra le cartelle `.terraform/`, `node_modules/`, `.git/` o `cdk.out/`, THE SYSTEM SHALL ignorarne il contenuto, con l'unica eccezione di `cdk.out/*.template.json` quando esiste `cdk.json`.
3. **ING-1.3**: IF il repo non contiene alcun marker, THEN THE SYSTEM SHALL restituire `adapters: []` e il messaggio `no IaC found`, senza creare né modificare file.
4. **ING-1.4**: WHEN sono presenti più adapter, THE SYSTEM SHALL restituirli in ordine alfabetico (`cdk`, `cloudformation`, `terraform`) e restituire i file di ciascuno ordinati per percorso.
5. **ING-1.5**: WHEN un template CloudFormation sta dentro `cdk.out/`, THE SYSTEM SHALL assegnarlo solo all'adapter `cdk` e mai anche a `cloudformation`.

### ING-2: Contratto RawResource
**User story:** Come sviluppatore del Power, voglio un formato intermedio unico per tutti gli adapter, così che MOD non debba conoscere i linguaggi IaC.

1. **ING-2.1**: THE SYSTEM SHALL produrre per ogni risorsa un `RawResource` con i campi `address`, `iacType`, `attributes`, `references[]`, `file`, `line`, `module`, `adapter`, come definito in `design.md` § Data models.
2. **ING-2.2**: THE SYSTEM SHALL ordinare l'array `RawResource[]` restituito da `parse_iac` per `address`, così che due esecuzioni sullo stesso input diano array identici.
3. **ING-2.3**: WHEN una risorsa ne referenzia un'altra, THE SYSTEM SHALL inserire in `references[]` l'`address` della risorsa referenziata e l'attributo di origine (`{ to, via }`), senza duplicati.
4. **ING-2.4**: THE SYSTEM SHALL calcolare lo SHA-256 di ogni file letto e restituirlo in `files[]` (`path`, `sha256`), nel formato di `source.files` di `model.schema.json`.

### ING-3: Terraform in modalità statica
**User story:** Come platform engineer, voglio che i miei `.tf` siano letti senza eseguire Terraform, così che la sync non richieda credenziali né rete.

1. **ING-3.1**: WHEN l'adapter `terraform` analizza una cartella, THE SYSTEM SHALL estrarre ogni blocco `resource` con indirizzo Terraform completo (`aws_subnet.public`, `module.network.aws_subnet.public`), senza eseguire il binario `terraform`; i blocchi `data`, `variable`, `output`, `locals` e `provider` non producono `RawResource`.
2. **ING-3.2**: WHEN un blocco `module` ha `source` locale (che inizia con `./` o `../`), THE SYSTEM SHALL espandere ricorsivamente il modulo e anteporre `module.<nome>.` agli indirizzi delle sue risorse.
3. **ING-3.3**: IF un blocco `module` ha `source` remoto (registry, `git::`, `http`), THEN THE SYSTEM SHALL non scaricarlo, registrare un modulo vuoto con `module = "module.<nome>"` e produrre un warning `REMOTE_MODULE` con `ref = "module.<nome>"`.
4. **ING-3.4**: IF un attributo contiene un'espressione non risolvibile staticamente (funzioni, `var.*` senza default non sensibile, `local.*` derivati), THEN THE SYSTEM SHALL conservare il testo dell'espressione in `attributes.__unresolved[<attributo>]` e produrre un warning `UNRESOLVED_EXPRESSION` con `ref` uguale all'indirizzo della risorsa.
5. **ING-3.5**: WHEN una risorsa ha `count` o `for_each` letterale (numero, lista o mappa letterale), THE SYSTEM SHALL registrare `attributes.__instances` con il numero di istanze; IF il valore non è letterale, THEN THE SYSTEM SHALL registrare `attributes.__instances = null`.
6. **ING-3.6**: WHILE è attiva la modalità statica, THE SYSTEM SHALL completare il parsing di 200 risorse distribuite su 20 file in ≤ 2 s sulla macchina di sviluppo di riferimento (vedi `design.md` § Test strategy).

### ING-4: Terraform in modalità piano
**User story:** Come platform engineer, voglio poter fornire un piano JSON, così che `count`, `for_each` e variabili siano risolti con precisione.

1. **ING-4.1**: WHERE l'utente passa a `parse_iac` il percorso di un file prodotto da `terraform show -json <plan>`, THE SYSTEM SHALL usare `planned_values` e `configuration` di quel file come unica fonte per l'adapter `terraform`, ignorando i `.tf`.
2. **ING-4.2**: WHEN legge un piano JSON, THE SYSTEM SHALL scartare i valori degli attributi marcati in `sensitive_values` e quelli che corrispondono alle regole di ING-6.
3. **ING-4.3**: THE SYSTEM SHALL non eseguire mai `terraform plan`, `terraform init` né `terraform show`: il file del piano è un input fornito dall'utente.

### ING-5: CloudFormation e CDK
**User story:** Come team che usa CDK o CloudFormation, voglio lo stesso diagramma che otterrei con Terraform, così che LiveArch funzioni su tutto il nostro parco IaC.

1. **ING-5.1**: WHEN l'adapter `cloudformation` legge un template JSON o YAML, THE SYSTEM SHALL produrre un `RawResource` per ogni voce di `Resources` con `address = "<StackName>.<LogicalId>"`, dove `StackName` è il nome del file senza estensioni `.template.json`, `.json`, `.yaml`, `.yml`.
2. **ING-5.2**: WHEN un valore usa `Ref`, `Fn::GetAtt`, `Fn::Sub` o `Fn::ImportValue`, anche nella forma breve YAML (`!Ref`, `!GetAtt`, `!Sub`, `!ImportValue`), THE SYSTEM SHALL aggiungere il riferimento a `references[]`.
3. **ING-5.3**: WHEN una risorsa ha tipo `AWS::CloudFormation::Stack`, THE SYSTEM SHALL registrare `module = "<StackName>.<LogicalId>"` per le risorse del template annidato, se il template annidato è presente in locale.
4. **ING-5.4**: WHEN l'adapter `cdk` legge `cdk.out/*.template.json`, THE SYSTEM SHALL applicare le regole di ING-5.1 e ING-5.2 e copiare `Metadata["aws:cdk:path"]` in `attributes.__cdkPath`.
5. **ING-5.5**: IF `cdk.out/` manca, THEN THE SYSTEM SHALL restituire per l'adapter `cdk` lo stato `needs-synth`, senza eseguire `cdk synth`.
6. **ING-5.6**: IF il file `.template.json` più recente di `cdk.out/` è più vecchio del file sorgente CDK modificato più di recente (tutti i file elencati in `cdk.json` → `watch.include`, oppure tutti i file fuori da `cdk.out/` e `node_modules/`), THEN THE SYSTEM SHALL usare comunque `cdk.out/` e produrre un warning `STALE_SYNTH` con `ref = null`.

### ING-6: Redazione alla fonte
**User story:** Come security engineer, voglio che i segreti non lascino mai l'adapter, così che nessuno stadio successivo possa farli trapelare.

1. **ING-6.1**: THE SYSTEM SHALL non leggere mai file `*.tfvars`, `*.tfvars.json`, `.env`, `*.tfstate`, `*.tfstate.backup`.
2. **ING-6.2**: WHEN il nome di un attributo contiene (senza distinzione tra maiuscole e minuscole) `password`, `secret`, `token`, `private_key`, `access_key` o `credential`, THE SYSTEM SHALL sostituirne il valore con la stringa `<redacted>`.
3. **ING-6.3**: WHEN un valore contiene un account ID AWS di 12 cifre, anche dentro un ARN, THE SYSTEM SHALL sostituire le 12 cifre con `<account>`.
4. **ING-6.4**: WHEN una `variable` ha `sensitive = true`, THE SYSTEM SHALL trattare come non risolvibile ogni riferimento a quella variabile, senza leggerne il `default`.

### ING-7: Errori di parsing
**User story:** Come utente, voglio che un file IaC rotto non distrugga i miei diagrammi, così che possa correggere con calma.

1. **ING-7.1**: IF un file non è sintatticamente valido, THEN THE SYSTEM SHALL restituire un warning `PARSE_ERROR` con `ref` uguale al percorso del file e il messaggio `<file>:<linea>: <errore>`, e lo stato `failed` per l'intero `parse_iac`.
2. **ING-7.2**: WHILE `parse_iac` ha stato `failed`, THE SYSTEM SHALL non restituire `RawResource[]` parziali.

### ING-8: Tool MCP e sicurezza di esecuzione
**User story:** Come utente di Kiro, voglio che l'agente legga l'IaC con strumenti deterministici, così che il risultato non dipenda dall'LLM.

1. **ING-8.1**: THE SYSTEM SHALL esporre i tool MCP `detect_sources` e `parse_iac` sul server `livearch` (stdio), con gli schemi di input e output di `design.md` § Components and interfaces.
2. **ING-8.2**: THE SYSTEM SHALL rifiutare con l'errore `PATH_OUTSIDE_ROOT` ogni percorso che, risolto (anche seguendo i symlink), esce dalla root passata al tool.
3. **ING-8.3**: THE SYSTEM SHALL non aprire connessioni di rete e non avviare processi figli durante `detect_sources` e `parse_iac`.
