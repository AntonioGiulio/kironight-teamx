export const repo = 'https://github.com/AntonioGiulio/kironight-teamx';
export const sourceUrl = path => `${repo}/blob/107559a/${path}`;

const example = 'examples/aws-three-tier';
const architecture = `${example}/docs/architecture`;
const scripts = 'power/livearch/skills/architecture-diagrams/scripts';
const stop = 'python3 .kiro/hooks/scripts/stop_gate.py';
const mermaid = `flowchart LR
  subgraph la_aws_vpc_main["main · VPC"]
    subgraph la_aws_subnet_private["private · Subnet"]
      la_aws_db_instance_orders_db[("orders_db  RDS")]
      la_aws_ecs_service_api["api  ECS Service"]
    end
    subgraph la_aws_subnet_public["public · Subnet"]
      la_aws_lb_public{{"public  Load Balancer"}}
    end
  end
  la_aws_lambda_function_order_worker("order_worker  Lambda")
  la_aws_sqs_queue_orders[["orders  SQS"]]
  la_aws_lb_public -->|"HTTP 80"| la_aws_ecs_service_api
  la_aws_ecs_service_api -->|"TCP 5432"| la_aws_db_instance_orders_db
  la_aws_sqs_queue_orders ==> la_aws_lambda_function_order_worker`;

// One entry per slide in LiveArch-Presentation.pptx, in deck order.
export const story = [
  {
    name: 'LiveArch', scene: 0, color: '#79f6d2', icon: 'core',
    eyebrow: 'KIRONIGHT 2025 / TEAM X',
    title: ['LiveArch'],
    description: 'Diagrammi di architettura che restano aggiornati. Un Kiro Power di KiroNight Team X.',
    takeaway: 'Terraform · CDK · CloudFormation → draw.io · Mermaid · Archify',
    stage: 'Orbita di partenza', model: 'LA–01 / NAVETTA LIVEARCH',
    path: '.kiro/steering/product.md', related: ['docs/context-map.md'],
  },
  {
    name: 'Problema', scene: 3, color: '#ffd28a', icon: 'core',
    eyebrow: 'PERCHÉ LIVEARCH',
    title: ['Il problema'],
    items: [
      ['Disegnati una volta', 'I diagrammi vengono creati e poi dimenticati.'],
      ['Fuori sincrono', 'L’IaC cambia ogni giorno. I diagrammi no.'],
      ['Chi entra nel team', '«Questo diagramma è ancora aggiornato?»'],
      ['Chi progetta l’architettura', 'Chiede un modello ArchiMate e riceve un PNG obsoleto.'],
    ],
    takeaway: 'L’IaC è la fonte di verità, ma un diagramma aiuta a leggerla.',
    stage: 'Segnale fuori sincrono', model: 'IAC / FONTE DI VERITÀ',
    path: '.kiro/steering/product.md',
  },
  {
    name: 'In 30 secondi', scene: 5, color: '#79f6d2', icon: 'core',
    eyebrow: 'IL POWER IN BREVE',
    title: ['LiveArch in 30 secondi'],
    description: 'IaC (Terraform, CDK o CloudFormation) → model.json canonico → tre viste coerenti.',
    items: [
      ['draw.io', 'Modificabile. Conserva il layout manuale.'],
      ['Mermaid', 'Facile da revisionare in Git e visibile su GitHub.'],
      ['Archify (HTML)', 'Vista interattiva con modalità presentazione.'],
    ],
    takeaway: 'L’agente costruisce il modello. Gli script disegnano. Archify sostituisce ArchiMate e non richiede Archi.',
    stage: 'Dal modello alle tre viste', model: 'DRAW.IO / MERMAID / ARCHIFY',
    path: 'power/livearch/README.md',
  },
  {
    name: 'Steering', scene: 2, color: '#c8b9ff', icon: 'steer',
    eyebrow: 'CONTESTO / REGOLE DI PROGETTO',
    title: ['Steering'],
    description: 'Otto file Markdown in .kiro/steering/. Kiro carica le regole di base in ogni sessione e quelle specialistiche quando servono.',
    items: [
      ['product.md · always', 'Scopo, MVP, utenti e criteri di successo.'],
      ['structure.md · always', 'Struttura delle cartelle e convenzioni sui nomi.'],
      ['security.md · always', 'Comandi vietati, dati esclusi dai diagrammi e campi consentiti.'],
      ['glossary.md · always', 'Una definizione per termine: adapter, kind, diagramId.'],
      ['tech.md · always', 'Script in Python 3.10+ con la sola libreria standard. Nessuna chiamata cloud.'],
      ['architecture-model.md · fileMatch', 'Nodi, gruppi, archi, ID stabili e determinismo.'],
      ['diagram-conventions.md · fileMatch', 'Livelli del layout, stili degli archi e colori per tipo.'],
      ['iac-sources.md · auto', 'Come leggere Terraform, CDK e CloudFormation.'],
    ],
    stage: 'Sistema Steering', model: 'ALWAYS / FILEMATCH / AUTO',
    path: '.kiro/steering/architecture-model.md', related: ['.kiro/steering/diagram-conventions.md', 'docs/context-map.md'],
  },
  {
    name: 'Specs', scene: 1, color: '#87d5ff', icon: 'spec',
    eyebrow: 'CONTESTO / CHE COSA COSTRUIRE',
    title: ['Specs'],
    description: 'Quattro spec in .kiro/specs/. Ognuna ha requirements.md, design.md e tasks.md.',
    items: [
      ['ING · iac-ingestion', 'Individua e legge Terraform, CDK e CloudFormation. Produce RawResource[].'],
      ['MOD · architecture-model', 'Classifica le risorse e costruisce ID stabili, gruppi e archi in model.json.'],
      ['REN · diagram-rendering', 'Genera e valida le tre viste. Preserva il layout di draw.io.'],
      ['SYNC · live-sync', 'Installa l’hook, sincronizza in modo incrementale, protegge i file generati e consente la disinstallazione.'],
    ],
    takeaway: 'Esempio EARS (MOD-1.4): WHEN lo stesso RawResource[] viene trasformato due volte, THE SYSTEM SHALL produrre due model.json identici byte per byte.',
    stage: 'Sistema Specs', model: 'ING / MOD / REN / SYNC',
    path: '.kiro/specs/architecture-model/requirements.md', related: ['.kiro/specs/iac-ingestion/requirements.md', '.kiro/specs/diagram-rendering/requirements.md', '.kiro/specs/live-sync/requirements.md'],
  },
  {
    name: 'Skills', scene: 3, color: '#ffd28a', icon: 'skill',
    eyebrow: 'CONTESTO / PROCEDURE PER L’AGENTE',
    title: ['Skills'],
    description: 'Quattro skill di sviluppo in .kiro/skills/ e due skill distribuite con il Power in power/livearch/skills/.',
    items: [
      ['write-livearch-spec', 'Scrive requisiti EARS con ID, tracciabilità e design.'],
      ['add-resource-mapping', 'Aggiunge un tipo AWS al catalogo, aggiorna la versione e valida l’esempio.'],
      ['add-iac-source', 'Guida una nuova sorgente, come Pulumi, e aggiorna model-building.md.'],
      ['add-diagram-format', 'Guida un nuovo renderer, come PlantUML, con riferimenti e verifiche.'],
      ['architecture-diagrams · Power', 'Si attiva con «draw architecture»: rileva le sorgenti, costruisce il modello, calcola le differenze, genera e valida i file.'],
      ['setup-live-sync · Power', 'Chiede conferma se il repo è pubblico. Installa livearch-sync.json e livearch-steering.md ed esegue il primo sync. La rimozione conserva i diagrammi.'],
    ],
    stage: 'Sistema Skills', model: 'SVILUPPO / POWER',
    path: '.kiro/skills/add-diagram-format/SKILL.md', related: ['power/livearch/skills/architecture-diagrams/SKILL.md', 'power/livearch/skills/setup-live-sync/SKILL.md'],
  },
  {
    name: 'Hooks', scene: 4, color: '#79f6d2', icon: 'hook',
    eyebrow: 'CONTESTO / CONTROLLI AUTOMATICI',
    title: ['Hooks'],
    description: 'Sette hook in tre file JSON di .kiro/hooks/. Si attivano al salvataggio, prima dell’uso di uno strumento o a fine turno.',
    items: [
      ['validate-golden-example-on-save', 'PostFileSave: rivalida l’esempio quando cambiano catalogo, schema o script.'],
      ['stop-gate', 'Stop: blocca il turno se catalogo, esempio, rigenerazione o tracciabilità non superano i controlli.'],
      ['catalog-or-schema-changed', 'PostFileSave: chiede di allineare versione, Steering, riferimenti e spec.'],
      ['design-rules-changed', 'PostFileSave: chiede di riallineare le regole di Steering con le guide del Power.'],
      ['spec-traceability', 'PostFileSave: check_spec_traceability.py controlla che ogni criterio EARS abbia un task.'],
      ['guard-shell-commands', 'PreToolUse (shell): blocca comandi che modificano l’infrastruttura.'],
      ['guard-secret-writes', 'PreToolUse (scrittura): blocca valori sensibili e ARN con ID account.'],
    ],
    stage: 'Sistema Hooks', model: 'POSTFILESAVE / PRETOOLUSE / STOP',
    path: '.kiro/hooks/quality-gates.json', related: ['.kiro/hooks/context-consistency.json', '.kiro/hooks/guard-secrets-and-commands.json'],
  },
  {
    name: 'Quattro livelli', scene: 5, color: '#79f6d2', icon: 'sync',
    eyebrow: 'CONTESTO / COME COLLABORANO',
    title: ['Quattro livelli,', 'un solo patto'],
    items: [
      ['01 · Steering · .kiro/steering/', 'Fissa regole, scopo, sicurezza e vocabolario.'],
      ['02 · Specs · .kiro/specs/', 'Traduce le regole in criteri EARS verificabili con task tracciabili.'],
      ['03 · Skills · .kiro/skills/ e power/livearch/skills/', 'Guida l’agente nei passi per applicare regole e spec.'],
      ['04 · Hooks · .kiro/hooks/', 'Verifica i risultati al salvataggio e a fine turno.'],
    ],
    takeaway: 'Steering, Specs e Skills rimandano a model.schema.json, resource-catalog.json e model-building.md. Non duplicano le regole.',
    stage: 'Convergenza del contesto', model: 'STEERING → SPECS → SKILLS → HOOKS',
    path: 'docs/context-map.md',
  },
  {
    name: 'Pipeline', scene: 2, color: '#c8b9ff', icon: 'steer',
    eyebrow: 'DALL’IAC AI DIAGRAMMI',
    title: ['La pipeline'],
    items: [
      ['01 · Rileva', 'Cerca *.tf, progetti CDK e template CloudFormation.'],
      ['02 · Costruisci', 'Il catalogo classifica le risorse. Gli indirizzi IaC diventano gli ID in model.json.'],
      ['03 · Calcola le differenze', 'changeset.py confronta i modelli. Se non cambia nulla, la pipeline si ferma.'],
      ['04 · Genera', 'render.py produce draw.io, Mermaid e i file Archify.'],
      ['05 · Valida', 'validate_architecture.py controlla il risultato. In caso di errore, correggi il modello, non i diagrammi.'],
    ],
    takeaway: 'Stesso modello, stessi byte. ID e layout sopravvivono al sync. Gli script Python 3.10+ non modificano l’IaC e non chiamano il cloud.',
    stage: 'Rotta di generazione', model: 'RILEVA → MODELLO → DIFF → RENDER → VALIDA',
    path: 'power/livearch/skills/architecture-diagrams/SKILL.md', related: [`${scripts}/render.py`, `${scripts}/validate_architecture.py`, `${scripts}/changeset.py`],
  },
  {
    name: 'Demo', scene: 3, color: '#ffd28a', icon: 'skill',
    eyebrow: 'COPIONE / CINQUE PASSI',
    title: ['La demo'],
    items: [
      ['01 · Mostra il contesto', 'Apri context-map.md e product.md. Mostra una voce del catalogo per un servizio AWS.'],
      ['02 · Genera i diagrammi', 'Chiedi «Draw the architecture of examples/aws-three-tier». Il Power genera le tre viste e restituisce RESULT: OK se valide.'],
      ['03 · Modifica l’IaC', 'Fai aggiungere un topic SNS in worker.tf. PostFileSave attiva il sync. Il changeset mostra un nodo e un arco aggiunti.'],
      ['04 · Conserva il layout', 'Sposta un riquadro in draw.io. Sincronizza di nuovo: il riquadro resta al suo posto.'],
      ['05 · Mostra i blocchi', 'Mostra il rifiuto di terraform apply e di una scrittura diretta in un diagramma generato.'],
    ],
    takeaway: 'Estensione opzionale: «support EFS» → add-resource-mapping → allineamento del catalogo e nuova validazione.',
    stage: 'Manovra dimostrativa', model: 'ESEMPIO AWS / SNS / DRAW.IO',
    path: 'docs/context-map.md', related: ['.kiro/steering/product.md', `${example}/terraform/worker.tf`],
  },
  {
    name: 'Output', scene: 5, color: '#79f6d2', icon: 'core',
    eyebrow: 'ESEMPIO AWS / FILE PRODOTTI',
    title: ['Che cosa produce', 'LiveArch'],
    description: 'examples/aws-three-tier/terraform → 3 gruppi, 6 nodi, 6 archi, 0 warning.',
    items: [
      ['model.json', 'Rappresentazione canonica, fonte delle tre viste.'],
      ['architecture.drawio', 'Diagramma vettoriale modificabile. Conserva le posizioni manuali.'],
      ['architecture.mmd', 'Sorgente Mermaid per GitHub e altri lettori compatibili.'],
      ['architecture.archify.json', 'Sorgente Archify leggibile in una pull request.'],
      ['architecture.html', 'Vista HTML interattiva e autonoma.'],
    ],
    takeaway: 'Estratto: Load Balancer → ECS → RDS. La coda SQS attiva il worker Lambda.',
    stage: 'Le tre viste del modello', model: 'DRAW.IO / MERMAID / ARCHIFY',
    path: `${architecture}/model.json`, related: [`${architecture}/architecture.mmd`, `${architecture}/architecture.html`],
    snippet: mermaid, snippetLabel: 'Estratto Mermaid',
  },
  {
    name: 'Salvaguardie', scene: 4, color: '#79f6d2', icon: 'hook',
    eyebrow: 'SICUREZZA / CONTROLLI DEL REPO',
    title: ['Salvaguardie'],
    items: [
      ['Nessun comando distruttivo', 'guard-shell-commands blocca modifiche all’infrastruttura prima dell’uso della shell.'],
      ['Nessun segreto nei diagrammi', 'guard-secret-writes blocca password, token e ARN con ID account prima della scrittura.'],
      ['Nessuna scrittura diretta dell’agente', 'Nel repo dell’utente, livearch-block-manual-diagram-writes blocca le scritture su .drawio, .mmd, .archify.json e .html (PreToolUse).'],
      ['Catalogo valido', 'catalog-or-schema-changed chiede di riallineare versione e documenti, rigenerare l’esempio e validarlo.'],
      ['Spec tracciabili', 'spec-traceability richiede almeno un task per criterio EARS.'],
      ['Stop gate', 'A fine turno controlla catalogo, esempio, idempotenza e tracciabilità.'],
    ],
    stage: 'Controlli di sicurezza', model: 'PRETOOLUSE / POSTFILESAVE / STOP',
    path: '.kiro/hooks/guard-secrets-and-commands.json', related: ['.kiro/hooks/quality-gates.json', 'power/livearch/skills/setup-live-sync/assets/livearch-sync.json'],
  },
  {
    name: 'Estensioni', scene: 3, color: '#ffd28a', icon: 'skill',
    eyebrow: 'SVILUPPO / AGGIUNGERE CAPACITÀ',
    title: ['Estendere LiveArch'],
    items: [
      ['Servizio AWS · esempio EFS', 'add-resource-mapping aggiunge la voce al catalogo. Aggiorna la versione, allinea i riferimenti e rigenera l’esempio. Un tipo di una categoria esistente non richiede modifiche al renderer.'],
      ['Sorgente IaC · esempio Pulumi', 'add-iac-source guida l’adapter e aggiorna model-building.md. Allinea lo Steering, aggiungi criteri ING/MOD e task, poi rivalida l’esempio.'],
      ['Formato · esempio PlantUML', 'add-diagram-format guida renderer, validatore e guida di formato. Allinea i documenti e rivalida l’esempio.'],
    ],
    takeaway: 'Il catalogo collega le regole, le skill indicano i passi e gli hook verificano il risultato.',
    stage: 'Rotta di estensione', model: 'TIPO AWS / SORGENTE IAC / RENDERER',
    path: '.kiro/skills/add-resource-mapping/SKILL.md', related: ['.kiro/skills/add-iac-source/SKILL.md', '.kiro/skills/add-diagram-format/SKILL.md'],
  },
  {
    name: 'Regressione', scene: 1, color: '#87d5ff', icon: 'spec',
    eyebrow: 'ESEMPIO AWS / VERIFICA COMPLETA',
    title: ['L’esempio', 'di riferimento'],
    description: 'examples/aws-three-tier/: dai file Terraform ai cinque file in docs/architecture/.',
    items: [
      ['Input Terraform', 'app.tf, data.tf, network.tf e worker.tf.'],
      ['Procedura', 'La skill architecture-diagrams costruisce il modello, genera le viste e valida il risultato.'],
      ['Output', 'model.json, architecture.drawio, architecture.mmd, architecture.archify.json e architecture.html.'],
      ['Validazione al salvataggio', 'Controlla l’esempio se cambia catalogo, schema, script o un file generato dell’esempio.'],
      ['Stop gate', 'Confronta i file con una nuova generazione: stesso input, stessi byte.'],
      ['Spec-traceability', 'Controlla che i criteri delle spec rimandino a task. È un controllo distinto dalla validazione dei diagrammi.'],
    ],
    stage: 'Orbita di regressione', model: 'TERRAFORM → GOLDEN EXAMPLE',
    path: '.kiro/hooks/quality-gates.json', related: [`${architecture}/model.json`, '.kiro/hooks/scripts/check_spec_traceability.py'],
  },
  {
    name: 'Criteri', scene: 5, color: '#79f6d2', icon: 'sync',
    eyebrow: 'KIRO NIGHT / CRITERI DELLA GIURIA',
    title: ['Il contesto', 'fa la differenza'],
    items: [
      ['Qualità', 'Criteri EARS verificabili e task tracciabili. Sette hook e un esempio con confronto byte per byte.'],
      ['Completezza', '8 file di Steering, 4 spec, 4 skill di sviluppo, 2 skill del Power e 7 hook. Coprono tutto il flusso, fino all’HTML interattivo di Archify.'],
      ['Coerenza', 'Una regola ha una sola fonte. Lo Steering rimanda al catalogo, le spec alle regole, gli hook verificano o segnalano cosa allineare.'],
      ['Collaborazione', 'Steering: perché. Specs: cosa. Skills: come. Hooks: verifica. Il pacchetto power/livearch/ è separato dal contesto di sviluppo.'],
    ],
    stage: 'Bilancio della missione', model: 'QUALITÀ / COMPLETEZZA / COERENZA',
    path: 'docs/context-map.md', related: ['power/livearch/README.md'],
  },
  {
    name: 'Grazie', scene: 0, color: '#79f6d2', icon: 'core',
    eyebrow: 'KIRO NIGHT / TEAM X',
    title: ['Grazie'],
    description: 'KiroNight Team X · LiveArch 0.1.0 · Apache 2.0',
    commands: `python3 ${scripts}/render.py \\\n  ${architecture}/model.json\n\n${stop}   # nessun output = tutti i controlli superati`,
    stage: 'Rientro', model: 'FINE DELLA ROTTA / LA–01',
    path: 'README.md', related: ['.kiro/hooks/scripts/stop_gate.py'],
  },
];
