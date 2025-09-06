// Parser/validator for scenario JSON v1.3 to internal structures.
// Minimal adapter for M2.5: accepts demo-like configs and normalizes to v1.3.

import type {
  ScenarioFileV1_3,
  ScenarioVersion,
  StageSpec,
  Timebase,
  Track,
  Cue,
  GroupNode,
  TextNode,
  Node,
} from "../types/scenario";

function isArrayPosition(pos: any): pos is [number, number] {
  return Array.isArray(pos) && pos.length === 2 && pos.every((v) => typeof v === "number");
}

function isArrayPositionLoose(pos: any): pos is [any, any] {
  return Array.isArray(pos) && pos.length === 2;
}

function toNum(v: any): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function normalizeNode(node: any): Node {
  // Accept demo shape with { type, content } and v1.3 shape with { e_type, text }
  const eType = node.e_type ?? node.type;
  if (eType === "group") {
    const children = Array.isArray(node.children) ? node.children.map(normalizeNode) : [];
    const group: GroupNode = {
      e_type: "group",
      name: node.name,
      style: node.style,
      layout: normalizeLayout(node.layout),
      children,
    };
    return group;
  }
  if (eType === "text") {
    const textNode: TextNode = {
      e_type: "text",
      text: node.text ?? node.content ?? "",
      absStart: toNum(node.absStart),
      absEnd: toNum(node.absEnd),
      style: node.style,
      layout: normalizeLayout(node.layout),
    };
    return textNode;
  }
  // For M2.5 we only support text nodes (ignore others safely)
  const dummy: GroupNode = { e_type: "group", children: [] } as any;
  return dummy;
}

function normalizeLayout(layout: any) {
  if (!layout) return undefined;
  const out: any = { ...layout };
  if (isArrayPosition(layout.position)) {
    out.position = { x: layout.position[0], y: layout.position[1] };
  } else if (isArrayPositionLoose(layout.position)) {
    const x = toNum(layout.position[0]);
    const y = toNum(layout.position[1]);
    if (x != null && y != null) out.position = { x, y };
  } else if (layout.position && (layout.position.x != null || layout.position.y != null)) {
    const x = toNum(layout.position.x);
    const y = toNum(layout.position.y);
    if (x != null && y != null) out.position = { x, y };
  }
  return out;
}

export function parseScenario(input: any): ScenarioFileV1_3 {
  // Minimal shape checks and normalization only for M2.5
  const version: ScenarioVersion = (input.version ?? "1.3") as ScenarioVersion;
  const timebase: Timebase = input.timebase ?? { unit: "seconds" };
  const stage: StageSpec = input.stage ?? { baseAspect: "16:9" };
  const tracks: Track[] = Array.isArray(input.tracks) ? input.tracks : [];
  const cues: Cue[] = Array.isArray(input.cues)
    ? input.cues.map((c: any) => ({
        id: String(c.id ?? "cue"),
        track: String(c.track ?? (tracks[0]?.id ?? "default")),
        hintTime: typeof c.hintTime === "object" ? c.hintTime : undefined,
        root: normalizeNode(c.root ?? { e_type: "group", children: [] }) as GroupNode,
      }))
    : [];

  return {
    version,
    timebase,
    stage,
    tracks,
    cues,
  } as ScenarioFileV1_3;
}

export type { ScenarioFileV1_3 };
