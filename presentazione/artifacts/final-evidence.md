# Evidenze della presentazione

## Scelte di progetto

- **Formato:** 16 slide, tradotte e adattate da `LiveArch-Presentation.pptx` nello stesso ordine. Nessun quiz o passaggio da sbloccare.
- **Fonti:** il PowerPoint per il contenuto, il repo al commit `107559a` per i riferimenti tecnici. Il trigger dell’hook contro le scritture dirette è `PreToolUse`, come nel file del Power.
- **Grafica:** una navetta, sei ambienti planetari, stelle su più livelli, orbite, scie di salto e un nucleo che alimenta tre viste. Le 16 slide riusano questi scenari Three.js.

## Controlli

- `npm test` controlla l’ordine delle 16 slide e i percorsi dei file citati. `npm run build` produce la presentazione statica.
- `python3 .kiro/hooks/scripts/check_spec_traceability.py`: `RESULT: OK (0 problems)`. Lo Stop gate non ha restituito blocchi.
- Chromium con WebGL 2 (ANGLE/SwiftShader): tutte le 16 slide, frecce, accesso diretto, Home/End, estratto Mermaid, fonti e ritorno all’inizio. Verifiche a 1440×900, 1024×640 e 390×844 con touch emulato.
- Catture locali: `/tmp/livearch-deck-*.png`. Non sono state fatte prove sul proiettore dell’evento o su un telefono fisico.
