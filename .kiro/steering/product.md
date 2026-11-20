---
inclusion: always
---

# Product: LiveArch

LiveArch è un **Kiro Power** che legge un repository di Infrastructure as Code (Terraform, AWS CDK, CloudFormation) e
ricostruisce, e mantiene aggiornato in tempo reale, il disegno dell'architettura in tre formati:

| Formato | File | Pubblico |
|---------|------|----------|
| draw.io | `docs/architecture/architecture.drawio` | team, wiki, presentazioni (layout modificabile a mano) |
| Mermaid | `docs/architecture/architecture.mmd` | README, PR, GitHub (renderizzato nativamente) |
| Archify (HTML interattivo autocontenuto, [tt-a1i/archify](https://github.com/tt-a1i/archify)) | `docs/architecture/architecture.html` (+ IR `architecture.archify.json`) | onboarding, review, presentazioni: focus, percorsi, temi, export PNG/SVG |

Tutti e tre derivano da **un unico modello canonico** (`docs/architecture/model.json`): i diagrammi non vengono mai
scritti "a mano" dall'agente, ma renderizzati dal modello. Vedi `#[[file:.kiro/steering/architecture-model.md]]`.

## Problema
I diagrammi di architettura sono sempre in ritardo rispetto all'IaC: vengono disegnati una volta e poi divergono.
L'IaC è già la fonte di verità dell'infrastruttura, ma non è leggibile da chi deve capire il sistema.

## Utenti
- **Platform / DevOps engineer**: modifica l'IaC e vuole il diagramma aggiornato senza sforzo.
- **Sviluppatore nuovo nel team**: vuole capire l'infrastruttura in 5 minuti.
- **Architect / tech lead**: vuole una vista interattiva da condividere e presentare (un solo file HTML), coerente con quanto deployato.
- **Reviewer di PR**: vuole vedere l'impatto architetturale di una modifica IaC.

## Funzionalità MVP
1. **Ingestion IaC**: Terraform (HCL / `terraform show -json`), CloudFormation, CDK (via `cdk synth`). Provider: AWS.
2. **Modello canonico**: risorse, gruppi (VPC, subnet, account, ambiente), relazioni, con ID stabili.
3. **Rendering** deterministico in draw.io, Mermaid, Archify.
4. **Live sync**: a ogni modifica di un file IaC il modello e i diagrammi vengono aggiornati in modo incrementale,
   **preservando il layout** modificato a mano in draw.io.
5. **Validazione**: i tre diagrammi sono sempre ben formati e coerenti tra loro e con il modello.

## Fuori scope (MVP)
- Lettura dello stato reale del cloud (nessuna chiamata a API AWS).
- Generare IaC a partire dai diagrammi (direzione inversa).
- Provider diversi da AWS (l'architettura deve però renderli aggiungibili via catalogo).

## Principi di prodotto
- **L'IaC è la fonte di verità**, il modello è derivato, i diagrammi sono viste del modello.
- **Determinismo**: stesso input IaC → stessi file byte per byte (diff di PR leggibili).
- **Rispetto del lavoro umano**: posizioni e stili modificati a mano in draw.io non vengono mai sovrascritti.
- **Read-only e locale**: il Power non esegue `apply`/`deploy` e non invia codice fuori dalla macchina.
  Vedi `#[[file:.kiro/steering/security.md]]`.
- **Leggibilità prima della completezza**: risorse di dettaglio (IAM policy attachment, route table association…) sono
  nascoste di default secondo il catalogo.

## Criteri di successo della demo
- Si modifica un `.tf` (es. si aggiunge una coda SQS) e i tre diagrammi si aggiornano da soli.
- Lo spostamento manuale di un box in draw.io sopravvive alla sincronizzazione successiva.
- Il validatore rileva un diagramma incoerente e l'hook lo segnala a Kiro.
