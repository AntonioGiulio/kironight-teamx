---
inclusion: always
---

# Sicurezza e privacy

LiveArch legge infrastruttura di produzione altrui: deve essere **innocuo per costruzione**.

## Comandi vietati
Il Power e le sue skill non eseguono mai:
- `terraform apply`, `terraform destroy`, `terraform import`, `terraform state *` (scrittura)
- `cdk deploy`, `cdk destroy`, `aws cloudformation create-stack` / `update-stack` / `delete-stack`
- comandi `aws` CLI che modificano risorse

Richiedono **conferma esplicita dell'utente**, perché eseguono codice o usano la rete:
- `terraform init` (scarica provider e moduli)
- `terraform plan` (legge lo stato remoto e usa credenziali)
- `cdk synth` (esegue l'app CDK)

## Dati che non devono mai finire nel modello o nei diagrammi
- Valori di variabili, `default` di variabili `sensitive`, output `sensitive`, contenuti di `.tfvars`.
- Password, token, chiavi (`password`, `secret`, `token`, `private_key`, `access_key`… in qualsiasi attributo).
- Account ID AWS a 12 cifre e ARN completi: vengono sostituiti con `<account>`.
- Le proprietà copiate in `node.properties` sono **solo** quelle nell'allowlist `properties` del catalogo
  (es. `instance_class`, `engine`, `runtime`). Allowlist, non denylist.

## Rete ed esecuzione
- L'MCP server `livearch` è **stdio, locale**, senza porte in ascolto e senza chiamate in uscita.
- Nessuna telemetria. Nessun invio di codice IaC a servizi terzi.
- Le dipendenze del Power sono **pinnate** a una versione esatta.

## Nel repository dell'utente
- I diagrammi rivelano la topologia: se il repo è pubblico, `setup-live-sync` deve avvisare prima di committarli.
- L'hook installato fa solo letture e scritture in `docs/architecture/`. Non deve toccare l'IaC.

Questi vincoli sono applicati dall'hook `.kiro/hooks/guard-secrets-and-commands.json` e dal validatore
(scansione dei segreti sugli output).
