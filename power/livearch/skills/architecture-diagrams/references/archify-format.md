# Archify format (LiveArch)

[Archify](https://github.com/tt-a1i/archify) turns a typed JSON document into a **self-contained interactive HTML**
diagram (dark/light themes, focus, path tracing, presentation mode, PNG/SVG export). LiveArch produces two files:

| File | Written by | Edit? |
|------|-----------|-------|
| `architecture.archify.json` | `render.py` (deterministic, standard library) | never: regenerated in full |
| `architecture.html` | Archify CLI (`archify render architecture … --quality showcase`), called by `render.py` | never |

The JSON follows Archify's `architecture.schema.json` (`schema_version: 1`). It is the reviewable source in a PR; the
HTML is the artifact people open. Reference implementation: `../scripts/render.py` (`render_archify`).

## Finding the Archify CLI
`render.py` looks for `bin/archify.mjs` in `$ARCHIFY_HOME`, then `~/.kiro/skills/archify`, `~/.claude/skills/archify`,
`~/.agents/skills/archify`, `~/.config/opencode/skills/archify`. It also needs `node` on `PATH`.
If either is missing it still writes the JSON, prints `skip architecture.html …` and the validator emits a **warning**.
Pass `--no-html` to skip the HTML on purpose (e.g. in CI without Node.js).

## Mapping
| Model | Archify | Rule |
|-------|---------|------|
| node | `components[]` | `id` = `diagramId`, `type` = `kinds[kind].archify`, `label` = node label, `sublabel` = catalog short label |
| node geometry | `pos`, `size` | centre of the **draw.io absolute geometry**, x scaled ×1.6, fixed size `150×56` |
| group | `boundaries[]` | `kind` = `groupKinds[kind].archify` (`region` or `security-group`), `wraps` = every node below the group |
| group nesting | `pad` | `16 + 22 × (levels of sub-groups)`, so an outer boundary always encloses the inner ones |
| edge | `connections[]` | `id` = edge `diagramId`, `variant` = `edgeKinds[kind].archify`, `label` if not null |
| cross-group edge | `route: "straight"` | crosses the boundary instead of running along its border |
| provenance | `meta.subtitle`, `cards[0]` | generator, catalog version, model hash, source adapters. No timestamps |
| model `warnings` | `cards[1]` (amber) | one item per warning message |

Order: components and connections by id; boundaries by nesting depth, then id (outer first).

## Why the layout follows draw.io
draw.io is the only hand-editable format. Taking Archify positions from the draw.io geometry means a box a person moves
in draw.io moves in the HTML too, after the next sync.

## Archify gates
`archify render` runs Archify's own schema and layout validation (edges through nodes, edges along a boundary border,
label collisions). A rejection makes `render.py` exit with an error: fix the cause in the **layout constants or the
model**, never by editing the JSON. For a full quality receipt run:

```bash
node <archify>/bin/archify.mjs finalize architecture docs/architecture/architecture.archify.json <tmp>/architecture.html --quality showcase --json
```

## Known limits
- Groups with no nodes below them have no Archify boundary (`wraps` needs at least one component). They still appear
  in draw.io and Mermaid.
- Archify `sources` (code-backed node evidence) are not emitted yet: they need a pinned commit and `--repo-root`.
