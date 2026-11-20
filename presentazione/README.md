# LiveArch · Prima il contesto

Adattamento in italiano delle 16 slide di `LiveArch-Presentation.pptx`, nello stesso ordine. La presentazione usa la navetta e gli scenari animati in Three.js per accompagnare il testo.

## Avvio

Dalla radice del repo, con Node.js 22.12 o successivo:

```sh
cd presentazione
npm ci
npm run dev
```

Apri <http://localhost:5173>. Premi `F` per lo schermo intero. Usa `←` e `→` per cambiare slide. Usa `Home` e `End` per andare alla prima o all’ultima slide. Le tappe numerate consentono l’accesso diretto.

**Fonti dal repo** apre i riferimenti di ogni slide. Nella slide 11, **Mermaid e fonti** mostra anche l’estratto del diagramma. La slide 16 contiene il link al repo e i comandi del PowerPoint.

Dopo l’installazione, la presentazione funziona senza rete. Solo i link a GitHub richiedono una connessione. Se WebGL 2 non parte, appare uno schema statico.

## Verifica e build

```sh
npm test
npm run build
npm run preview
```

Per ospitare la presentazione, pubblica la cartella `dist/` su un server statico. Non serve un backend.
