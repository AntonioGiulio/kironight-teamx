---
inclusion: auto
name: iac-sources
description: Regole per leggere Terraform, AWS CDK e CloudFormation e dedurre risorse, gruppi e relazioni. Usare quando si lavora sugli adapter IaC, sull'inferenza degli edge o su un nuovo linguaggio IaC.
---

# Sorgenti IaC e adapter

Ogni adapter produce **solo** `RawResource[]` (`address`, `iacType`, `attributes`, `references[]`, `file`, `line`).
Il passaggio a nodi, gruppi ed edge è comune a tutti ed è guidato dal catalogo
(`#[[file:power/livearch/skills/architecture-diagrams/references/resource-catalog.json]]`).

## Rilevamento
| Marker nel repo | Adapter |
|-----------------|---------|
| `*.tf` | terraform |
| `cdk.json` | cdk (CloudFormation sintetizzato) |
| `*.template.json`, `*.yaml`/`*.json` con `AWSTemplateFormatVersion` o `Resources` | cloudformation |

Più adapter nello stesso repo vengono uniti in un unico modello, e ogni stack o root module diventa un gruppo `module`.

## Terraform
- **Modalità statica (default, usata dalla live sync)**: parsing degli `.tf` senza eseguire Terraform. Niente
  credenziali, niente rete, meno di 2 s su 200 risorse.
- **Modalità piano (facoltativa)**: se l'utente fornisce `terraform show -json <plan>`, quella diventa la fonte e
  risolve `count`, `for_each` e le variabili.
- Moduli locali (`source = "./..."`): espansi; ogni modulo è un gruppo `module`.
- Moduli remoti (registry o git): **non scaricati**. Diventano un gruppo `module` vuoto con un warning.
- Espressioni non risolvibili: la label usa il nome della risorsa, e l'espressione va in `properties.unresolved`.

## CDK
- Si legge **solo** `cdk.out/*.template.json`. Il codice TypeScript/Python di CDK non va mai parsato.
- `cdk synth` esegue codice dell'utente: **non lanciarlo senza conferma esplicita**. Se `cdk.out/` manca o è più
  vecchio dei sorgenti, chiedi all'utente se eseguire il synth oppure usa l'ultimo output con un warning.
- Il percorso di costrutto (`Metadata.aws:cdk:path`) diventa la label e i gruppi `module` per costrutto di livello 1.

## CloudFormation
- `Ref`, `Fn::GetAtt`, `Fn::Sub`, `Fn::ImportValue` sono **riferimenti**: vanno nei `references[]`.
- Gli stack annidati (`AWS::CloudFormation::Stack`) diventano gruppi `module`.

## Inferenza degli edge (in ordine di priorità)
1. **Regole esplicite del catalogo** (`hidden[].edgeInference`), ad esempio:
   - `lb-listener`: listener → target group → servizio genera `load-balancer --network-flow--> target`.
   - `event-source`: `aws_lambda_event_source_mapping` genera `source --trigger--> function`.
   - `subscription`: `aws_sns_topic_subscription` genera `topic --trigger--> endpoint`.
   - `sg-ingress`: una regola SG che referenzia un altro SG genera `network-flow` tra i nodi che li usano.
2. **Riferimenti da env var o ARN**: una funzione o un servizio che referenzia una coda, una tabella o un bucket
   genera `data-access`.
3. **Altri riferimenti** tra nodi visibili generano `depends-on`.
4. I riferimenti che passano da risorse `hidden` vengono collassati: `A → hidden → B` diventa `A → B`.
- Niente edge duplicati: a parità di `from` e `to` vince il kind più specifico (`network-flow` > `trigger` >
  `data-access` > `depends-on`).
