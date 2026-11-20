#!/usr/bin/env python3
"""Validate a LiveArch output folder (model.json + draw.io, Mermaid, Archify) or the resource catalog.

Usage:
    validate_architecture.py <dir>          # e.g. docs/architecture
    validate_architecture.py --catalog      # checks references/resource-catalog.json

Checks: model structure and invariants, catalog consistency, the diagrams are well formed and contain exactly the
model's groups/nodes/edges (Archify: architecture.archify.json; architecture.html must come from the Archify CLI),
and no secret-like values appear in the text outputs. Archify's own layout gates run in render.py.
Exit code 0 = valid, 1 = errors found, 2 = usage error. Standard library only.
"""
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
REFS = HERE.parent / "references"
# Archify architecture schema v1 enums (componentType, variant, boundary kind).
ARCHIFY_TYPES = {"frontend", "backend", "database", "cloud", "security", "messagebus", "external"}
ARCHIFY_VARIANTS = {"default", "emphasis", "security", "dashed"}
ARCHIFY_BOUNDARIES = {"region", "security-group"}
SECRET_PATTERNS = [
    ("AWS access key", re.compile(r"\b(AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("AWS account id", re.compile(r"(?<![0-9a-fA-F])\d{12}(?![0-9a-fA-F])")),
    ("private key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("password assignment", re.compile(r"(?i)\b(password|passwd|secret_string)\b\s*[=:]\s*\S+")),
]


class Report:
    def __init__(self):
        self.errors, self.warnings = [], []

    def error(self, where, msg):
        self.errors.append(f"[{where}] {msg}")

    def warn(self, where, msg):
        self.warnings.append(f"[{where}] {msg}")


def sanitize(value):
    return re.sub(r"[^A-Za-z0-9_]", "_", value)


def load_json(path, report, where):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        report.error(where, f"missing file {path}")
    except json.JSONDecodeError as exc:
        report.error(where, f"invalid JSON: {exc}")
    return None


# --------------------------------------------------------------------------- catalog

def check_catalog(catalog, report):
    w = "catalog"
    kinds = catalog.get("kinds", {})
    schema = json.loads((REFS / "model.schema.json").read_text(encoding="utf-8"))
    schema_kinds = set(schema["$defs"]["nodeKind"]["enum"])
    schema_groups = set(schema["$defs"]["groupKind"]["enum"])
    schema_edges = set(schema["$defs"]["edgeKind"]["enum"])
    if set(kinds) != schema_kinds:
        report.error(w, f"kinds differ from model.schema.json nodeKind: {sorted(set(kinds) ^ schema_kinds)}")
    if set(catalog.get("groupKinds", {})) != schema_groups:
        report.error(w, "groupKinds differ from model.schema.json groupKind")
    if set(catalog.get("edgeKinds", {})) != schema_edges:
        report.error(w, "edgeKinds differ from model.schema.json edgeKind")
    for name, k in kinds.items():
        if not isinstance(k.get("tier"), int) or not 0 <= k["tier"] <= 5:
            report.error(w, f"kind {name}: tier must be an integer 0..5")
        if k.get("archify") not in ARCHIFY_TYPES:
            report.error(w, f"kind {name}: unknown Archify component type {k.get('archify')!r}")
        if not re.fullmatch(r"#[0-9A-Fa-f]{6}", k.get("drawio", {}).get("fillColor", "")):
            report.error(w, f"kind {name}: drawio.fillColor must be #RRGGBB")
    for name, e in catalog.get("edgeKinds", {}).items():
        if e.get("archify") not in ARCHIFY_VARIANTS:
            report.error(w, f"edgeKind {name}: unknown Archify variant {e.get('archify')!r}")
    for name, g in catalog.get("groupKinds", {}).items():
        if g.get("archify") not in ARCHIFY_BOUNDARIES:
            report.error(w, f"groupKind {name}: unknown Archify boundary kind {g.get('archify')!r}")
    seen = {}
    for section in ("resources", "groups", "hidden"):
        for entry in catalog.get(section, []):
            for t in [entry["iacType"], *entry.get("aliases", [])]:
                if t in seen:
                    report.error(w, f"type {t} defined twice ({seen[t]} and {section})")
                seen[t] = section
            if section == "resources":
                if entry.get("kind") not in kinds:
                    report.error(w, f"{entry['iacType']}: unknown kind {entry.get('kind')!r}")
                if not isinstance(entry.get("properties"), list):
                    report.error(w, f"{entry['iacType']}: properties allowlist must be a list")
                if not entry.get("drawio", {}).get("resIcon", "").startswith("mxgraph.aws4."):
                    report.warn(w, f"{entry['iacType']}: no mxgraph.aws4 resIcon")
            if section == "groups" and entry.get("groupKind") not in schema_groups:
                report.error(w, f"{entry['iacType']}: unknown groupKind {entry.get('groupKind')!r}")
    for prefix in catalog.get("hiddenPrefixes", []):
        for t, section in seen.items():
            if section != "hidden" and t.startswith(prefix):
                report.warn(w, f"hiddenPrefix {prefix!r} shadows {section} type {t} (exact match wins)")
    used = {e["kind"] for e in catalog.get("resources", [])}
    for name in sorted(set(kinds) - used - {"external"}):
        report.warn(w, f"kind {name} is not used by any resource")


# --------------------------------------------------------------------------- model

def check_model(model, catalog, report):
    w = "model.json"
    schema = json.loads((REFS / "model.schema.json").read_text(encoding="utf-8"))
    for key in schema["required"]:
        if key not in model:
            report.error(w, f"missing top-level key {key!r}")
    if report.errors:
        return
    if model["generator"].get("catalogVersion") != catalog["catalogVersion"]:
        report.error(w, f"catalogVersion {model['generator'].get('catalogVersion')} != catalog {catalog['catalogVersion']}")
    defs = schema["$defs"]
    sections = {"groups": defs["group"], "nodes": defs["node"], "edges": defs["edge"]}
    enums = {"groups": set(defs["groupKind"]["enum"]), "nodes": set(defs["nodeKind"]["enum"]),
             "edges": set(defs["edgeKind"]["enum"])}
    for name, sdef in sections.items():
        items = model[name]
        ids = [i.get("id") for i in items]
        if ids != sorted(ids):
            report.error(w, f"{name} must be sorted by id")
        if len(ids) != len(set(ids)):
            report.error(w, f"duplicate ids in {name}")
        for item in items:
            missing = [k for k in sdef["required"] if k not in item]
            extra = [k for k in item if k not in sdef["properties"]]
            if missing or extra:
                report.error(w, f"{name} {item.get('id')}: missing {missing} extra {extra}")
                continue
            if item["kind"] not in enums[name]:
                report.error(w, f"{name} {item['id']}: invalid kind {item['kind']!r}")
            prefix = "la_e_" if name == "edges" else "la_"
            if item["diagramId"] != prefix + sanitize(item["id"]):
                report.error(w, f"{name} {item['id']}: diagramId must be {prefix + sanitize(item['id'])}")
            if "label" in item and item["label"] is not None and len(item["label"]) > (30 if name == "edges" else 40):
                report.error(w, f"{name} {item['id']}: label too long")
    groups = {g["id"]: g for g in model["groups"]}
    nodes = {n["id"]: n for n in model["nodes"]}
    for g in groups.values():
        seen, p = {g["id"]}, g["parent"]
        while p:
            if p not in groups:
                report.error(w, f"group {g['id']}: parent {p} does not exist")
                break
            if p in seen:
                report.error(w, f"group {g['id']}: parent cycle")
                break
            seen.add(p)
            p = groups[p]["parent"]
    catalog_types = {}
    for e in catalog["resources"]:
        for t in [e["iacType"], *e.get("aliases", [])]:
            catalog_types[t] = e
    for n in nodes.values():
        if n["group"] is not None and n["group"] not in groups:
            report.error(w, f"node {n['id']}: group {n['group']} does not exist")
        entry = catalog_types.get(n["iacType"])
        if entry is None:
            if not n["properties"].get("unmapped") or n["kind"] != "external":
                report.error(w, f"node {n['id']}: {n['iacType']} not in catalog: must be kind external + unmapped")
        else:
            if n["kind"] != entry["kind"]:
                report.error(w, f"node {n['id']}: kind {n['kind']} but catalog says {entry['kind']}")
            allowed = set(entry["properties"]) | {"instances", "unmapped", "unresolved"}
            for key in n["properties"]:
                if key not in allowed:
                    report.error(w, f"node {n['id']}: property {key!r} not in catalog allowlist")
    for e in model["edges"]:
        if e["from"] not in nodes or e["to"] not in nodes:
            report.error(w, f"edge {e['id']}: endpoints must be existing nodes")
        if e["id"] != f"{e['from']}--{e['kind']}-->{e['to']}":
            report.error(w, f"edge {e['id']}: id must be <from>--<kind>--><to>")
    pairs = [(e["from"], e["to"]) for e in model["edges"]]
    if len(pairs) != len(set(pairs)):
        report.error(w, "more than one edge between the same from/to pair")


def expected_ids(model):
    return (
        {g["diagramId"] for g in model["groups"]},
        {n["diagramId"] for n in model["nodes"]},
        {e["diagramId"] for e in model["edges"]},
    )


# --------------------------------------------------------------------------- diagrams

def check_drawio(path, model, report):
    w = path.name
    try:
        root = ET.parse(path).getroot()
    except (FileNotFoundError, ET.ParseError) as exc:
        report.error(w, f"cannot parse: {exc}")
        return
    graph_root = root.find("diagram/mxGraphModel/root")
    if graph_root is None:
        report.error(w, "missing diagram/mxGraphModel/root (compressed file?)")
        return
    groups, nodes, edges = expected_ids(model)
    by_id = {g["diagramId"]: g for g in model["groups"]} | {n["diagramId"]: n for n in model["nodes"]}
    parent_expected = {}
    for item in model["groups"]:
        parent_expected[item["diagramId"]] = "la_" + sanitize(item["parent"]) if item["parent"] else "1"
    for item in model["nodes"]:
        parent_expected[item["diagramId"]] = "la_" + sanitize(item["group"]) if item["group"] else "1"
    edges_by_id = {e["diagramId"]: e for e in model["edges"]}
    found_v, found_e = set(), set()
    all_ids = [el.get("id") for el in graph_root]
    if len(all_ids) != len(set(all_ids)):
        report.error(w, "duplicate cell ids")
    if not any(el.get("livearch_managed") == "meta" for el in graph_root):
        report.error(w, "missing provenance cell la__meta")
    for el in graph_root:
        if el.tag != "object" or el.get("livearch_managed") != "1":
            continue
        did, cell = el.get("id"), el.find("mxCell")
        if cell is None or cell.find("mxGeometry") is None:
            report.error(w, f"{did}: managed object without mxCell/mxGeometry")
            continue
        if cell.get("vertex") == "1":
            found_v.add(did)
            if did not in by_id:
                report.error(w, f"{did}: managed vertex not in model (stale cell)")
            elif cell.get("parent") != parent_expected[did]:
                report.error(w, f"{did}: parent {cell.get('parent')} expected {parent_expected[did]}")
            if did in by_id and el.get("livearch_id") != by_id[did]["id"]:
                report.error(w, f"{did}: livearch_id mismatch")
        elif cell.get("edge") == "1":
            found_e.add(did)
            e = edges_by_id.get(did)
            if e is None:
                report.error(w, f"{did}: managed edge not in model (stale cell)")
            elif (cell.get("source"), cell.get("target")) != ("la_" + sanitize(e["from"]), "la_" + sanitize(e["to"])):
                report.error(w, f"{did}: source/target do not match the model")
    for missing in sorted((groups | nodes) - found_v):
        report.error(w, f"missing vertex {missing}")
    for missing in sorted(edges - found_e):
        report.error(w, f"missing edge {missing}")


MERMAID_ARROWS = {"network-flow": "-->", "trigger": "==>", "data-access": "-.->", "depends-on": "---"}
MERMAID_EDGE = re.compile(r"^\s*(la_\w+)\s+(-->|==>|-\.->|---)(\|\"[^\"]*\"\|)?\s+(la_\w+)\s*$")
MERMAID_NODE = re.compile(r"^\s*(la_\w+)(\[\"|\(\"|\(\[\"|\[\[\"|\[\(\"|\{\{\")")
MERMAID_SUBGRAPH = re.compile(r"^\s*subgraph\s+(la_\w+)\[\"")


def check_mermaid(path, model, report):
    w = path.name
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        report.error(w, "missing file")
        return
    if not lines or not lines[0].startswith("%% Generated by LiveArch"):
        report.error(w, "first line must be the LiveArch header")
    if "flowchart LR" not in lines[:3]:
        report.error(w, "missing 'flowchart LR' after the header")
    groups, nodes, _ = expected_ids(model)
    found_g, found_n, found_e = set(), set(), set()
    depth = 0
    for line in lines:
        if m := MERMAID_SUBGRAPH.match(line):
            found_g.add(m.group(1))
            depth += 1
        elif line.strip() == "end":
            depth -= 1
        elif m := MERMAID_EDGE.match(line):
            found_e.add((m.group(1), m.group(2), m.group(4)))
        elif m := MERMAID_NODE.match(line):
            found_n.add(m.group(1))
    if depth != 0:
        report.error(w, "unbalanced subgraph/end")
    expected_e = {("la_" + sanitize(e["from"]), MERMAID_ARROWS[e["kind"]], "la_" + sanitize(e["to"])) for e in model["edges"]}
    for label, exp, got in (("subgraph", groups, found_g), ("node", nodes, found_n)):
        for x in sorted(exp - got):
            report.error(w, f"missing {label} {x}")
        for x in sorted(got - exp):
            report.error(w, f"{label} {x} not in model")
    for x in sorted(expected_e - found_e):
        report.error(w, f"missing edge {x[0]} {x[1]} {x[2]}")
    for x in sorted(found_e - expected_e):
        report.error(w, f"edge {x[0]} {x[1]} {x[2]} not in model (or wrong arrow for its kind)")


def check_archify(folder, model, catalog, report):
    path = folder / "architecture.archify.json"
    w = path.name
    doc = load_json(path, report, w)
    if doc is None:
        return
    if doc.get("schema_version") != 1 or doc.get("diagram_type") != "architecture":
        report.error(w, "must be an Archify architecture document (schema_version 1)")
        return
    kinds, edge_kinds = catalog["kinds"], catalog["edgeKinds"]
    _, nodes, edges = expected_ids(model)
    comps = {c.get("id"): c for c in doc.get("components", [])}
    for x in sorted(nodes - set(comps)):
        report.error(w, f"missing component {x}")
    for x in sorted(set(comps) - nodes):
        report.error(w, f"component {x} not in model")
    for n in model["nodes"]:
        c = comps.get(n["diagramId"])
        if c and c.get("type") != kinds[n["kind"]]["archify"]:
            report.error(w, f"{n['diagramId']}: type {c.get('type')} expected {kinds[n['kind']]['archify']}")
        if c and not (isinstance(c.get("pos"), list) and isinstance(c.get("size"), list)):
            report.error(w, f"{n['diagramId']}: pos and size are required")
    conns = {c.get("id"): c for c in doc.get("connections", [])}
    for x in sorted(edges - set(conns)):
        report.error(w, f"missing connection {x}")
    for x in sorted(set(conns) - edges):
        report.error(w, f"connection {x} not in model")
    for e in model["edges"]:
        c = conns.get(e["diagramId"])
        if c is None:
            continue
        if (c.get("from"), c.get("to")) != ("la_" + sanitize(e["from"]), "la_" + sanitize(e["to"])):
            report.error(w, f"{e['diagramId']}: from/to do not match the model")
        if c.get("variant") != edge_kinds[e["kind"]]["archify"]:
            report.error(w, f"{e['diagramId']}: variant {c.get('variant')} expected {edge_kinds[e['kind']]['archify']}")
    for b in doc.get("boundaries", []):
        if b.get("kind") not in ARCHIFY_BOUNDARIES:
            report.error(w, f"boundary {b.get('label')!r}: invalid kind {b.get('kind')!r}")
        for x in b.get("wraps", []):
            if x not in comps:
                report.error(w, f"boundary {b.get('label')!r} wraps unknown component {x}")
    html = folder / "architecture.html"
    if not html.exists():
        report.warn("architecture.html", "not built (Archify CLI missing?): run render.py with Archify installed")
    elif 'name="generator" content="archify' not in html.read_text(encoding="utf-8", errors="replace")[:4000]:
        report.error("architecture.html", "not generated by Archify")


def check_secrets(folder, report):
    for path in sorted(folder.iterdir()):
        if path.suffix not in {".json", ".drawio", ".mmd"}:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for name, pattern in SECRET_PATTERNS:
            if m := pattern.search(text):
                line = text.count("\n", 0, m.start()) + 1
                report.error(path.name, f"possible {name} at line {line}: redact it (see steering security.md)")


# --------------------------------------------------------------------------- main

def main(argv):
    report = Report()
    catalog = load_json(REFS / "resource-catalog.json", report, "catalog")
    if catalog is None:
        return finish(report)
    if argv[1:] == ["--catalog"]:
        check_catalog(catalog, report)
        return finish(report)
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    folder = Path(argv[1])
    check_catalog(catalog, report)
    model = load_json(folder / "model.json", report, "model.json")
    if model is not None:
        check_model(model, catalog, report)
        if not report.errors:
            check_drawio(folder / "architecture.drawio", model, report)
            check_mermaid(folder / "architecture.mmd", model, report)
            check_archify(folder, model, catalog, report)
    if folder.is_dir():
        check_secrets(folder, report)
    if model is not None and not report.errors:
        print(f"model: {len(model['groups'])} groups, {len(model['nodes'])} nodes, {len(model['edges'])} edges, "
              f"{len(model['warnings'])} warnings")
    return finish(report)


def finish(report):
    for msg in report.warnings:
        print(f"WARN  {msg}")
    for msg in report.errors:
        print(f"ERROR {msg}")
    print("RESULT: " + ("FAIL" if report.errors else "OK") + f" ({len(report.errors)} errors, {len(report.warnings)} warnings)")
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
