#!/usr/bin/env python3
"""Read-only, standard-library checks for issue #19's BPMN/SVG documentation."""

from pathlib import Path
import re
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "docs" / "process-map"
BPMN = "http://www.omg.org/spec/BPMN/20100524/MODEL"
NS = {
    "b": BPMN,
    "d": "http://www.omg.org/spec/BPMN/20100524/DI",
    "s": "http://www.w3.org/2000/svg",
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def normalized(value):
    return " ".join(value.split())


def check(name):
    path = DIRECTORY / name
    bpmn = ET.parse(path.with_suffix(".bpmn")).getroot()
    svg = ET.parse(path.with_suffix(".svg")).getroot()
    identifiers = [node.get("id") for node in bpmn.iter() if node.get("id")]
    require(len(identifiers) == len(set(identifiers)), f"{name}: duplicate ID")
    for element in bpmn.iter():
        for key in ("sourceRef", "targetRef", "processRef", "bpmnElement"):
            reference = element.get(key)
            require(not reference or reference in identifiers,
                    f"{name}: missing {key} {reference}")

    drawn_shapes = {n.get("bpmnElement") for n in bpmn.findall(".//d:BPMNShape", NS)}
    drawn_edges = {n.get("bpmnElement") for n in bpmn.findall(".//d:BPMNEdge", NS)}
    owners = {}
    for process in bpmn.findall("b:process", NS):
        require(process.get("isExecutable") == "false", f"{name}: executable process")
        nodes = {n.get("id"): n for n in process if n.tag != f"{{{BPMN}}}sequenceFlow"}
        flows = process.findall("b:sequenceFlow", NS)
        starts = []
        successors = {node: [] for node in nodes}
        predecessors = {node: [] for node in nodes}
        for flow in flows:
            source, target = flow.get("sourceRef"), flow.get("targetRef")
            require(source in nodes and target in nodes, f"{name}: cross-process sequence")
            require(flow.get("id") in drawn_edges, f"{name}: undrawn sequence")
            successors[source].append(target)
            predecessors[target].append(source)
        for identifier, node in nodes.items():
            owners[identifier] = process.get("id")
            require(identifier in drawn_shapes, f"{name}: undrawn node {identifier}")
            if node.tag == f"{{{BPMN}}}startEvent":
                starts.append(identifier)
                require(not predecessors[identifier] and successors[identifier],
                        f"{name}: invalid start {identifier}")
            elif node.tag == f"{{{BPMN}}}endEvent":
                require(predecessors[identifier] and not successors[identifier],
                        f"{name}: invalid end {identifier}")
            else:
                require(predecessors[identifier] and successors[identifier],
                        f"{name}: disconnected node {identifier}")
        visited, pending = set(), list(starts)
        while pending:
            node = pending.pop()
            if node not in visited:
                visited.add(node)
                pending.extend(successors[node])
        require(visited == set(nodes), f"{name}: unreachable nodes {set(nodes) - visited}")
        # Every reachable node must also have at least one route to an end.
        can_finish = {node for node in nodes if not successors[node]}
        pending = list(can_finish)
        while pending:
            for previous in predecessors[pending.pop()]:
                if previous not in can_finish:
                    can_finish.add(previous)
                    pending.append(previous)
        require(can_finish == set(nodes), f"{name}: nodes cannot reach an end")

    for participant in bpmn.findall(".//b:participant", NS):
        owners[participant.get("id")] = participant.get("processRef", participant.get("id"))
    for flow in bpmn.findall(".//b:messageFlow", NS):
        require(owners[flow.get("sourceRef")] != owners[flow.get("targetRef")],
                f"{name}: message inside one participant")
        require(flow.get("id") in drawn_edges, f"{name}: undrawn message")

    svg_text = normalized(" ".join(" ".join(n.itertext()) for n in svg.findall(".//s:text", NS)))
    for element in bpmn.iter():
        label = element.get("name") or (element.text if element.tag == f"{{{BPMN}}}text" else "")
        if label:
            require(normalized(label) in svg_text, f"{name}: missing SVG label {label}")
    for node in svg.iter():
        tag = node.tag.rsplit("}", 1)[-1]
        require(tag not in {"script", "foreignObject", "image", "iframe", "use", "style"},
                f"{name}: active or externally loaded SVG element {tag}")
        for key, value in node.attrib.items():
            attribute = key.rsplit("}", 1)[-1].lower()
            require(not attribute.startswith("on") and attribute != "href",
                    f"{name}: executable/external SVG attribute {attribute}")
            for url in re.findall(r"url\(([^)]+)\)", value):
                require(url.startswith("#"), f"{name}: external SVG URL")
    require("90 days" in svg_text or "90-day" in svg_text, f"{name}: missing 90-day rule")
    require("not cash" in svg_text, f"{name}: missing voucher rule")
    if name == "to-be":
        for term in ("basedatos.csv", "avisos.csv", "09 consent", "Authenticate", "uncertain", "06b"):
            require(term in svg_text, f"{name}: missing agreed label {term}")
        require("Google Sheets" not in svg_text, f"{name}: outdated history provider")
        require("pending review/integration" not in svg_text, f"{name}: outdated HU-08 status")
    print(f"PASS {name}: structure, reachability, SVG coverage/safety and business labels")


if __name__ == "__main__":
    for map_name in ("as-is", "to-be"):
        check(map_name)
