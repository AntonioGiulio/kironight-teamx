#!/usr/bin/env python3
"""Render a LiveArch model.json into draw.io, Mermaid and Archify.

Usage:
    render.py <model.json> [<outDir>] [--no-html]

outDir defaults to the folder of model.json. An existing architecture.drawio in outDir is merged
(geometry and person-edited styles of managed cells are kept, user cells are copied unchanged).
architecture.archify.json (Archify IR) is always written; architecture.html is built from it with the Archify CLI
(Node.js) when it is installed, otherwise skipped with a notice (--no-html skips it on purpose).
Standard library only. Deterministic: same model + same previous draw.io => same bytes.
Rules: references/drawio-format.md, mermaid-format.md, archify-format.md.
"""
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
CATALOG_PATH = HERE.parent / "references" / "resource-catalog.json"
GENERATOR = "livearch/0.1.0"

NODE_W = NODE_H = 78
COL_W, ROW_H = 170, 140
PAD, TOP, GAP = 30, 50, 30
MIN_GROUP_W, MIN_GROUP_H = 200, 120
ORIGIN = 40



def sanitize(value):
    return re.sub(r"[^A-Za-z0-9_]", "_", value)


def short_hash(text, n=12):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:n]


def load_catalog():
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    by_type = {}
    for section in ("resources", "groups", "hidden"):
        for entry in catalog[section]:
            for iac_type in [entry["iacType"], *entry.get("aliases", [])]:
                by_type[iac_type] = entry
    return catalog, by_type


# --------------------------------------------------------------------------- styles

def node_style(node, catalog, by_type):
    entry = by_type.get(node["iacType"], {})
    res_icon = entry.get("drawio", {}).get("resIcon")
    if not res_icon:
        return "rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#7D8998;fontColor=#232F3E;"
    fill = catalog["kinds"][node["kind"]]["drawio"]["fillColor"]
    return (
        "sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;"
        f"fillColor={fill};strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;"
        "align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;"
        f"resIcon={res_icon};"
    )


def group_style(group, catalog):
    gk = catalog["groupKinds"][group["kind"]]["drawio"]
    return (
        "outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=0;container=1;"
        "pointerEvents=0;collapsible=0;recursiveResize=0;shape=mxgraph.aws4.group;"
        f"grIcon={gk['grIcon']};strokeColor={gk['strokeColor']};fillColor=none;verticalAlign=top;"
        f"align=left;spacingLeft=30;fontColor={gk['strokeColor']};dashed=0;"
    )


def edge_style(edge, catalog):
    ek = catalog["edgeKinds"][edge["kind"]]["drawio"]
    end = "endArrow=none;" if edge["kind"] == "depends-on" else "endArrow=block;endFill=1;"
    return (
        "edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#545B64;"
        f"{end}strokeWidth={ek['strokeWidth']};dashed={1 if ek['dashed'] else 0};"
    )


def node_label(node, by_type, sep):
    short = by_type.get(node["iacType"], {}).get("label")
    return f"{node['label']}{sep}{short}" if short else node["label"]


def group_label(group, by_type):
    short = by_type.get(group["iacType"] or "", {}).get("label")
    return f"{group['label']} · {short}" if short else group["label"]


# --------------------------------------------------------------------------- layout

class Layout:
    """Deterministic auto-layout: geometry relative to the parent container."""

    def __init__(self, model, catalog):
        self.kinds = catalog["kinds"]
        self.child_groups = {}
        self.child_nodes = {}
        for g in model["groups"]:
            self.child_groups.setdefault(g["parent"], []).append(g["id"])
        for n in model["nodes"]:
            self.child_nodes.setdefault(n["group"], []).append(n)
        self.geo = {}
        self._measure(None)

    def _min_tier(self, gid):
        """Sibling groups are laid out left to right in traffic order: lowest node tier first."""
        tiers = [self.kinds[n["kind"]]["tier"] for n in self.child_nodes.get(gid, [])]
        tiers += [self._min_tier(k) for k in self.child_groups.get(gid, [])]
        return min(tiers, default=99)

    def _measure(self, gid):
        is_group = gid is not None
        left, top = (PAD, TOP) if is_group else (ORIGIN, ORIGIN)
        nodes = sorted(self.child_nodes.get(gid, []), key=lambda n: n["id"])
        tiers = sorted({self.kinds[n["kind"]]["tier"] for n in nodes})
        column = {t: i for i, t in enumerate(tiers)}
        rows = {}
        for n in nodes:
            c = column[self.kinds[n["kind"]]["tier"]]
            r = rows.get(c, 0)
            rows[c] = r + 1
            self.geo[n["id"]] = [left + c * COL_W + (COL_W - NODE_W) // 2, top + r * ROW_H + 10, NODE_W, NODE_H]
        nodes_w = len(tiers) * COL_W
        nodes_h = max(rows.values(), default=0) * ROW_H
        y = top + nodes_h + (GAP if nodes else 0)
        x = left
        kids_h = 0
        for k in sorted(self.child_groups.get(gid, []), key=lambda k: (self._min_tier(k), k)):
            w, h = self._measure(k)
            self.geo[k] = [x, y, w, h]
            x += w + GAP
            kids_h = max(kids_h, h)
        kids_w = max(0, x - left - GAP)
        if not is_group:
            return None
        width = max(MIN_GROUP_W, PAD * 2 + max(nodes_w, kids_w))
        height = max(MIN_GROUP_H, (y + kids_h + PAD) if kids_h else (top + nodes_h + PAD))
        return width, height


# --------------------------------------------------------------------------- draw.io

def read_previous_drawio(path):
    previous, user_cells = {}, []
    if not path.exists():
        return previous, user_cells
    root = ET.parse(path).getroot()
    diagram = root.find("diagram")
    graph_root = diagram.find("mxGraphModel/root") if diagram is not None else None
    if graph_root is None:
        raise SystemExit(
            f"error: {path} has compressed or missing diagram content. "
            "Save it uncompressed in draw.io (File > Properties > Compressed off) and retry."
        )
    for el in graph_root:
        if el.tag == "object" and el.get("livearch_managed") in ("1", "meta"):
            cell = el.find("mxCell")
            geometry = cell.find("mxGeometry") if cell is not None else None
            previous[el.get("id")] = {
                "parent": cell.get("parent") if cell is not None else None,
                "style": cell.get("style", "") if cell is not None else "",
                "style_hash": el.get("livearch_style_hash"),
                "geometry": geometry,
            }
        elif el.get("id") in ("0", "1"):
            continue
        else:
            user_cells.append(el)
    return previous, user_cells


def geometry_element(x, y, w, h):
    return ET.Element("mxGeometry", {"x": str(x), "y": str(y), "width": str(w), "height": str(h), "as": "geometry"})


def render_drawio(model, catalog, by_type, model_hash, previous, user_cells):
    layout = Layout(model, catalog)
    ids = {g["id"]: g["diagramId"] for g in model["groups"]}
    ids.update({n["id"]: n["diagramId"] for n in model["nodes"]})
    final_geo = {}

    mxfile = ET.Element("mxfile", {"host": "livearch", "agent": GENERATOR})
    diagram = ET.SubElement(mxfile, "diagram", {"id": "livearch", "name": "Architecture"})
    graph = ET.SubElement(diagram, "mxGraphModel", {
        "grid": "1", "gridSize": "10", "guides": "1", "connect": "1", "arrows": "1",
        "page": "0", "math": "0", "shadow": "0",
    })
    root = ET.SubElement(graph, "root")
    ET.SubElement(root, "mxCell", {"id": "0"})
    ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})

    def managed(diagram_id, label, model_id, kind, style, parent, *, vertex=True, source=None, target=None):
        prev = previous.get(diagram_id)
        if prev and short_hash(prev["style"]) != prev["style_hash"]:
            style, style_hash = prev["style"], prev["style_hash"]
        else:
            style_hash = short_hash(style)
        obj = ET.SubElement(root, "object", {
            "id": diagram_id, "label": label, "livearch_id": model_id, "livearch_managed": "1",
            "livearch_kind": kind, "livearch_style_hash": style_hash,
        })
        attrs = {"style": style}
        if vertex:
            attrs.update({"vertex": "1", "parent": parent})
        else:
            attrs.update({"edge": "1", "parent": "1", "source": source, "target": target})
        cell = ET.SubElement(obj, "mxCell", attrs)
        keep = prev is not None and prev["parent"] == attrs["parent"] and prev["geometry"] is not None
        return cell, keep, prev

    meta_label = f"LiveArch · catalog {catalog['catalogVersion']} · model {model_hash}"
    meta = ET.SubElement(root, "object", {"id": "la__meta", "label": meta_label, "livearch_managed": "meta"})
    meta_cell = ET.SubElement(meta, "mxCell", {"style": "text;html=1;fontSize=9;fontColor=#7D8998;", "vertex": "1", "parent": "1"})
    prev_meta = previous.get("la__meta")
    meta_cell.append(prev_meta["geometry"] if prev_meta and prev_meta["geometry"] is not None
                     else geometry_element(ORIGIN, 5, 360, 20))

    def emit_vertex(item, label, style, parent_id):
        parent = ids[parent_id] if parent_id else "1"
        cell, keep, prev = managed(item["diagramId"], label, item["id"], item["kind"], style, parent)
        if keep:
            g = prev["geometry"]
            final_geo[item["id"]] = [int(float(g.get(k, 0))) for k in ("x", "y", "width", "height")]
            cell.append(g)
        else:
            final_geo[item["id"]] = list(layout.geo[item["id"]])
            cell.append(geometry_element(*final_geo[item["id"]]))

    for g in sorted(model["groups"], key=lambda g: g["id"]):
        emit_vertex(g, group_label(g, by_type), group_style(g, catalog), g["parent"])
    for n in sorted(model["nodes"], key=lambda n: n["id"]):
        emit_vertex(n, node_label(n, by_type, "<br>"), node_style(n, catalog, by_type), n["group"])

    # A preserved group grows so that newly placed children fit (repeat for nesting depth).
    groups_by_id = {g["id"]: g for g in model["groups"]}
    parent_of = {g["id"]: g["parent"] for g in model["groups"]}
    parent_of.update({n["id"]: n["group"] for n in model["nodes"]})
    for _ in range(len(groups_by_id) + 1):
        for child_id, (x, y, w, h) in sorted(final_geo.items()):
            parent_id = parent_of.get(child_id)
            if parent_id:
                pg = final_geo[parent_id]
                pg[2] = max(pg[2], x + w + PAD)
                pg[3] = max(pg[3], y + h + PAD)
    for obj in root.findall("object"):
        mid = obj.get("livearch_id")
        if mid in final_geo and obj.get("livearch_kind") in catalog["groupKinds"]:
            geo = obj.find("mxCell/mxGeometry")
            geo.set("width", str(final_geo[mid][2]))
            geo.set("height", str(final_geo[mid][3]))

    for e in sorted(model["edges"], key=lambda e: e["id"]):
        cell, keep, prev = managed(e["diagramId"], e["label"] or "", e["id"], e["kind"], edge_style(e, catalog),
                                   "1", vertex=False, source=ids[e["from"]], target=ids[e["to"]])
        if keep:
            cell.append(prev["geometry"])
        else:
            ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})

    known = {el.get("id") for el in root}
    for el in user_cells:
        cell = el if el.tag == "mxCell" else el.find("mxCell")
        if cell is not None and cell.get("parent") not in known:
            cell.set("parent", "1")
        root.append(el)

    ET.indent(mxfile, space="  ")
    return ET.tostring(mxfile, encoding="unicode") + "\n", final_geo


# --------------------------------------------------------------------------- Mermaid

SHAPES = {
    "rect": ('["', '"]'), "rounded": ('("', '")'), "stadium": ('(["', '"])'),
    "subroutine": ('[["', '"]]'), "cylinder": ('[("', '")]'), "hexagon": ('{{"', '"}}'),
}


def mermaid_text(value):
    return value.replace('"', "#quot;")


def render_mermaid(model, catalog, by_type, model_hash):
    kinds = catalog["kinds"]
    lines = [
        "%% Generated by LiveArch - do not edit, change the IaC instead",
        f"%% livearch catalog={catalog['catalogVersion']} model={model_hash}",
        "flowchart LR",
    ]
    child_groups, child_nodes = {}, {}
    for g in model["groups"]:
        child_groups.setdefault(g["parent"], []).append(g)
    for n in model["nodes"]:
        child_nodes.setdefault(n["group"], []).append(n)

    def node_line(n, indent):
        open_, close = SHAPES[kinds[n["kind"]]["mermaid"]["shape"]]
        return f"{indent}{n['diagramId']}{open_}{mermaid_text(node_label(n, by_type, '<br/>'))}{close}"

    def emit(parent, depth):
        indent = "  " * depth
        for g in sorted(child_groups.get(parent, []), key=lambda g: g["id"]):
            lines.append(f'{indent}subgraph {g["diagramId"]}["{mermaid_text(group_label(g, by_type))}"]')
            for n in sorted(child_nodes.get(g["id"], []), key=lambda n: n["id"]):
                lines.append(node_line(n, indent + "  "))
            emit(g["id"], depth + 1)
            lines.append(f"{indent}end")

    emit(None, 1)
    for n in sorted(child_nodes.get(None, []), key=lambda n: n["id"]):
        lines.append(node_line(n, "  "))
    ids = {n["id"]: n["diagramId"] for n in model["nodes"]}
    for e in sorted(model["edges"], key=lambda e: e["id"]):
        arrow = catalog["edgeKinds"][e["kind"]]["mermaid"]
        label = f'|"{mermaid_text(e["label"])}"|' if e["label"] else ""
        lines.append(f"  {ids[e['from']]} {arrow}{label} {ids[e['to']]}")

    fills, members = {}, {}
    for kind in sorted(kinds):
        fills.setdefault(kinds[kind]["mermaid"]["class"], kinds[kind]["drawio"]["fillColor"])
    for n in model["nodes"]:
        members.setdefault(kinds[n["kind"]]["mermaid"]["class"], []).append(n["diagramId"])
    used = sorted(members)
    for cls in used:
        lines.append(f"  classDef {cls} fill:{fills[cls]},stroke:#232F3E,color:#ffffff")
    for cls in used:
        lines.append(f"  class {','.join(sorted(members[cls]))} {cls}")
    return "\n".join(lines) + "\n"


# --------------------------------------------------------------------------- Archify

ARCHIFY_SCALE_X = 1.6
ARCHIFY_NODE = (150, 56)
ARCHIFY_PAD, ARCHIFY_PAD_STEP = 16, 22


def absolute_geometry(model, final_geo):
    parent_of = {g["id"]: g["parent"] for g in model["groups"]}
    parent_of.update({n["id"]: n["group"] for n in model["nodes"]})

    def absolute(item_id):
        x, y, w, h = final_geo[item_id]
        p = parent_of[item_id]
        while p:
            x += final_geo[p][0]
            y += final_geo[p][1]
            p = parent_of[p]
        return x, y, w, h

    return {item_id: absolute(item_id) for item_id in final_geo}


def render_archify(model, catalog, by_type, model_hash, final_geo):
    """Archify architecture IR (schema_version 1). The HTML is built from it by the Archify CLI."""
    kinds, group_kinds, edge_kinds = catalog["kinds"], catalog["groupKinds"], catalog["edgeKinds"]
    geo = absolute_geometry(model, final_geo)
    node_w, node_h = ARCHIFY_NODE
    components = []
    for n in sorted(model["nodes"], key=lambda n: n["id"]):
        x, y, w, h = geo[n["id"]]
        cx, cy = (x + w / 2) * ARCHIFY_SCALE_X, y + h / 2
        comp = {
            "id": n["diagramId"],
            "type": kinds[n["kind"]]["archify"],
            "label": n["label"],
            "pos": [int(cx - node_w / 2), int(cy - node_h / 2)],
            "size": [node_w, node_h],
        }
        short = by_type.get(n["iacType"], {}).get("label")
        if short:
            comp["sublabel"] = short
        components.append(comp)

    child_groups, child_nodes = {}, {}
    for g in model["groups"]:
        child_groups.setdefault(g["parent"], []).append(g["id"])
    for n in model["nodes"]:
        child_nodes.setdefault(n["group"], []).append(n["diagramId"])

    def members(gid):
        found = list(child_nodes.get(gid, []))
        for k in child_groups.get(gid, []):
            found += members(k)
        return found

    def height(gid):
        return 1 + max((height(k) for k in child_groups.get(gid, [])), default=-1)

    groups = {g["id"]: g for g in model["groups"]}

    def depth(gid):
        d, p = 0, groups[gid]["parent"]
        while p:
            d, p = d + 1, groups[p]["parent"]
        return d

    boundaries = []
    for g in sorted(model["groups"], key=lambda g: (depth(g["id"]), g["id"])):
        wraps = sorted(members(g["id"]))
        if not wraps:
            continue  # Archify boundaries need at least one component: empty groups exist only in draw.io/Mermaid
        boundaries.append({
            "kind": group_kinds[g["kind"]]["archify"],
            "label": group_label(g, by_type),
            "wraps": wraps,
            "pad": ARCHIFY_PAD + ARCHIFY_PAD_STEP * height(g["id"]),
        })

    ids = {n["id"]: n["diagramId"] for n in model["nodes"]}
    group_of = {n["id"]: n["group"] for n in model["nodes"]}
    connections = []
    for e in sorted(model["edges"], key=lambda e: e["id"]):
        conn = {"id": e["diagramId"], "from": ids[e["from"]], "to": ids[e["to"]],
                "variant": edge_kinds[e["kind"]]["archify"]}
        if group_of[e["from"]] != group_of[e["to"]]:
            # Crossing a boundary: a straight segment crosses it instead of running along its border.
            conn["route"] = "straight"
        if e["label"]:
            conn["label"] = e["label"]
        connections.append(conn)

    files = [f["path"] for f in model["source"]["files"]]
    cards = [{
        "dot": "slate",
        "title": "Generated by LiveArch",
        "items": [
            f"Source: {', '.join(model['source']['adapters'])} · {len(files)} files",
            f"catalog {catalog['catalogVersion']} · model {model_hash}",
            "Do not edit: change the IaC and run a LiveArch sync",
        ],
    }]
    if model["warnings"]:
        cards.append({"dot": "amber", "title": "Model warnings", "items": [w["message"] for w in model["warnings"]]})

    doc = {
        "schema_version": 1,
        "diagram_type": "architecture",
        "meta": {
            "title": "Architecture",
            "subtitle": f"Generated by LiveArch from Infrastructure as Code · model {model_hash}",
            "output": "architecture.html",
            "quality_profile": "showcase",
        },
        "components": components,
        "boundaries": boundaries,
        "connections": connections,
        "cards": cards,
    }
    return json.dumps(doc, indent=2, ensure_ascii=False) + "\n"


def find_archify():
    """Archify CLI: $ARCHIFY_HOME, then the usual skill install folders. None if not installed."""
    import os
    candidates = [os.environ.get("ARCHIFY_HOME")] + [
        str(Path.home() / d / "skills" / "archify") for d in (".kiro", ".claude", ".agents", ".config/opencode")
    ]
    for c in candidates:
        if c and (Path(c) / "bin" / "archify.mjs").is_file():
            return Path(c) / "bin" / "archify.mjs"
    return None


def build_archify_html(ir_path, html_path):
    import shutil
    import subprocess
    cli, node = find_archify(), shutil.which("node")
    if cli is None or node is None:
        print("skip architecture.html: Archify CLI or Node.js not found (set ARCHIFY_HOME)", file=sys.stderr)
        return False
    result = subprocess.run(
        [node, str(cli), "render", "architecture", str(ir_path), str(html_path), "--quality", "showcase"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        sys.stderr.write(result.stdout + result.stderr)
        raise SystemExit(f"error: Archify rejected {ir_path.name}; fix the layout constants or the model")
    print(f"wrote {html_path}")
    return True


# --------------------------------------------------------------------------- main

def main(argv):
    flags = {a for a in argv[1:] if a.startswith("--")}
    argv = [a for a in argv if not a.startswith("--")]
    if len(argv) not in (2, 3):
        print(__doc__, file=sys.stderr)
        return 2
    model_path = Path(argv[1])
    out_dir = Path(argv[2]) if len(argv) == 3 else model_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)
    model_bytes = model_path.read_text(encoding="utf-8")
    model = json.loads(model_bytes)
    model_hash = short_hash(model_bytes)
    catalog, by_type = load_catalog()

    drawio_path = out_dir / "architecture.drawio"
    previous, user_cells = read_previous_drawio(drawio_path)
    drawio, final_geo = render_drawio(model, catalog, by_type, model_hash, previous, user_cells)
    outputs = {
        drawio_path: drawio,
        out_dir / "architecture.mmd": render_mermaid(model, catalog, by_type, model_hash),
        out_dir / "architecture.archify.json": render_archify(model, catalog, by_type, model_hash, final_geo),
    }
    for path, content in outputs.items():
        path.write_text(content, encoding="utf-8", newline="\n")
        print(f"wrote {path}")
    if "--no-html" not in flags:
        build_archify_html(out_dir / "architecture.archify.json", out_dir / "architecture.html")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
