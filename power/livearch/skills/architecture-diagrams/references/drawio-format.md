# draw.io format (LiveArch)

Uncompressed draw.io XML (`.drawio`). It is the only format a person may edit by hand, so the renderer **merges**
instead of overwriting. Reference implementation: `../scripts/render.py`.

## File skeleton
```xml
<mxfile host="livearch" agent="livearch/0.1.0">
  <diagram id="livearch" name="Architecture">
    <mxGraphModel grid="1" gridSize="10" guides="1" connect="1" arrows="1" page="0" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <object id="la__meta" label="LiveArch · catalog 1.1.0 · model 3f2a…" livearch_managed="meta" ...>
          <mxCell style="text;html=1;fontSize=9;fontColor=#7D8998;" vertex="1" parent="1">
            <mxGeometry x="40" y="5" width="360" height="20" as="geometry" />
          </mxCell>
        </object>
        <!-- groups (containers), then nodes, then edges; each sorted by model id -->
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

## Managed cells
Every model group, node and edge is one `<object>` that wraps an `<mxCell>`:

| Attribute | Value |
|-----------|-------|
| `id` | `diagramId` of the model (`la_…`, `la_e_…`) |
| `label` | node: `<label><br><catalog label>`; group: `<label> · <catalog group label>`; edge: `edge.label` or empty |
| `livearch_id` | model `id` (IaC address) |
| `livearch_managed` | `1` (`meta` for the provenance cell) |
| `livearch_kind` | node/group/edge kind |
| `livearch_style_hash` | first 12 hex chars of `sha256(style)` of the style the renderer wrote |

- Group: `mxCell vertex="1"`, `container=1`, `parent` = parent group's diagramId, or `1` at the top level.
- Node: `mxCell vertex="1"`, `parent` = its group's diagramId, or `1`. The geometry is **relative to the parent**.
- Edge: `mxCell edge="1" parent="1" source=<from diagramId> target=<to diagramId>`.

## Styles (from the catalog)
- Node with `resIcon`: `sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;fillColor=<kinds[kind].drawio.fillColor>;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=<resources[].drawio.resIcon>;`
- Node without `resIcon` (unmapped/external): `rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#7D8998;fontColor=#232F3E;`
- Group: `…shape=mxgraph.aws4.group;grIcon=<groupKinds[kind].drawio.grIcon>;strokeColor=<…>;fillColor=none;container=1;verticalAlign=top;align=left;spacingLeft=30;`
- Edge: `edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#545B64;endArrow=block;endFill=1;strokeWidth=<edgeKinds[kind].drawio.strokeWidth>;dashed=<0|1>;` and `endArrow=none` for `depends-on`.

## Auto-layout (new cells only)
Deterministic, computed per container (the root or a group):
1. The container's nodes go in **columns by tier** (only the tiers present, in ascending order) and **rows by id**.
   Slot 170×140, icon 78×78 centred horizontally, 10 px from the top of the slot.
2. Child groups go **below** the nodes, side by side in id order, 30 px apart.
3. Group padding: 50 top (title), 30 on the other sides. Minimum group width 200.
4. Root origin (40, 40).

## Merge rules (sync on an existing file)
| Situation | Behaviour |
|-----------|-----------|
| Managed cell still in the model, **same parent** | keep `mxGeometry` (including edge waypoints) |
| Managed cell still in the model, parent changed | new auto-layout geometry |
| `sha256(current style)[:12] == livearch_style_hash` | style not touched by a person: replace it with the catalog style |
| Hashes differ | person changed the style: **keep it**, keep the old hash |
| Managed cell no longer in the model | remove it (an edge disappears with its endpoints) |
| New cell inside a preserved group | auto-layout, and the group grows so the cell fits (+30 px) |
| Cell without `livearch_managed` (user cell) | **copied unchanged**; if its parent no longer exists it moves to `1` |
| Compressed `<diagram>` content | **stop** with an error: ask the user to save uncompressed (File → Properties → Compressed off) |
