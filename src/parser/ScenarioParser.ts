// Parser/validator for Scenario JSON v1.3
// Validates shape, coerces a few legacy aliases, and returns a sanitized object.

import type {
  ScenarioFileV1_3,
  ScenarioVersion,
  StageSpec,
  Timebase,
  Track,
  Cue,
  GroupNode,
  TextNode,
  ImageNode,
  VideoNode,
  Node,
} from '../types/scenario';
import { SUPPORTED_SCENARIO_VERSIONS } from '../types/scenario';

type Path = string;

function fail(path: Path, msg: string): never {
  throw new Error(`scenario.${path}: ${msg}`);
}
const isNum = (v: any) => typeof v === 'number' && Number.isFinite(v);
const toNum = (v: any) =>
  isNum(v)
    ? (v as number)
    : typeof v === 'string' && Number.isFinite(+v)
      ? +v
      : undefined;
const isObj = (v: any) =>
  v != null && typeof v === 'object' && !Array.isArray(v);
const asStr = (v: any) => (v == null ? undefined : String(v));

const ASPECTS = new Set(['16:9', '9:16', 'auto']);
const TRACK_TYPES = new Set(['subtitle', 'free']);
const SCALE_MODES = new Set(['scaleWithVideo', 'fixedPoint', 'cap']);
const OVERLAP_POLICIES = new Set(['ignore', 'push', 'stack']);
const COMPOSE = new Set(['add', 'multiply', 'replace']);

function normLayout(layout: any, path: Path) {
  if (!layout) return undefined;
  const out: any = {};
  if (layout.mode) out.mode = layout.mode;
  if (layout.anchor) out.anchor = layout.anchor;
  const p = layout.position;
  if (Array.isArray(p) && p.length === 2) {
    const x = toNum(p[0]),
      y = toNum(p[1]);
    if (x == null || y == null)
      fail(`${path}.layout.position`, `must be numbers`);
    out.position = { x, y };
  } else if (isObj(p) && (p.x != null || p.y != null)) {
    const x = toNum(p.x),
      y = toNum(p.y);
    if (x == null || y == null)
      fail(`${path}.layout.position`, `must have numeric x,y`);
    out.position = { x, y };
  }
  if (layout.size) out.size = layout.size;
  if (layout.padding) out.padding = layout.padding;
  if (layout.transform) out.transform = layout.transform;
  if (layout.transformOrigin) out.transformOrigin = layout.transformOrigin;
  if (layout.zIndex != null) out.zIndex = layout.zIndex;
  if (layout.overflow) out.overflow = layout.overflow;
  if (layout.safeAreaClamp != null) out.safeAreaClamp = !!layout.safeAreaClamp;
  if (layout.override) out.override = layout.override;
  return Object.keys(out).length ? out : undefined;
}

function normPluginSpec(p: any, path: Path) {
  if (!isObj(p)) fail(path, `must be object`);
  const name = asStr(p.name);
  if (!name) fail(path, `missing name`);
  const out: any = { name };
  if (isObj(p.params)) out.params = p.params;
  if (p.relStart != null) {
    const n = toNum(p.relStart);
    if (n == null) fail(`${path}.relStart`, `must be number`);
    out.relStart = n;
  }
  if (p.relEnd != null) {
    const n = toNum(p.relEnd);
    if (n == null) fail(`${path}.relEnd`, `must be number`);
    out.relEnd = n;
  }
  if (p.relStartPct != null) {
    const n = toNum(p.relStartPct);
    if (n == null || n < 0 || n > 1) fail(`${path}.relStartPct`, `0..1`);
    out.relStartPct = n;
  }
  if (p.relEndPct != null) {
    const n = toNum(p.relEndPct);
    if (n == null || n < 0 || n > 1) fail(`${path}.relEndPct`, `0..1`);
    out.relEndPct = n;
  }
  if (p.compose != null) {
    const c = asStr(p.compose);
    if (!c || !COMPOSE.has(c))
      fail(`${path}.compose`, `must be add|multiply|replace`);
    out.compose = c;
  }
  return out;
}

function normEffectScope(es: any, path: Path) {
  if (!isObj(es)) return undefined;
  const out: any = {};
  if (es.breakout) {
    const b = es.breakout;
    const mode = asStr(b.mode);
    if (mode && mode !== 'portal' && mode !== 'lift')
      fail(`${path}.breakout.mode`, `portal|lift`);
    out.breakout = {
      mode,
      toLayer: b.toLayer != null ? toNum(b.toLayer) : undefined,
      coordSpace: b.coordSpace,
      zLift: b.zLift != null ? toNum(b.zLift) : undefined,
      clampStage: !!b.clampStage,
      return: b.return,
      transfer: b.transfer,
    };
  }
  return Object.keys(out).length ? out : undefined;
}

function normNode(node: any, path: Path): Node {
  const eType = node.eType ?? node.type;
  if (eType === 'group') {
    const childrenIn = Array.isArray(node.children) ? node.children : [];
    const children = childrenIn.map((ch: any, i: number) =>
      normNode(ch, `${path}.children[${i}]`)
    );
    const g: GroupNode = {
      eType: 'group',
      name: node.name,
      style: node.style,
      layout: normLayout(node.layout, path),
      children,
    };
    return g;
  }
  if (eType === 'text') {
    const text = node.text ?? node.content ?? '';
    const t0 = node.absStart != null ? toNum(node.absStart) : undefined;
    const t1 = node.absEnd != null ? toNum(node.absEnd) : undefined;
    if (t0 != null && t1 != null && !(t1 > t0))
      fail(`${path}.absEnd`, `must be > absStart`);
    const tn: TextNode = {
      eType: 'text',
      text,
      absStart: t0,
      absEnd: t1,
      style: node.style,
      layout: normLayout(node.layout, path),
    };
    if (node.plugin)
      (tn as any).plugin = normPluginSpec(node.plugin, `${path}.plugin`);
    if (Array.isArray(node.pluginChain))
      (tn as any).pluginChain = node.pluginChain.map((p: any, i: number) =>
        normPluginSpec(p, `${path}.pluginChain[${i}]`)
      );
    if (node.effectScope)
      (tn as any).effectScope = normEffectScope(
        node.effectScope,
        `${path}.effectScope`
      );
    return tn;
  }
  if (eType === 'image') {
    const src = asStr(node.src);
    if (!src) fail(path, `image.src required`);
    const t0 = node.absStart != null ? toNum(node.absStart) : undefined;
    const t1 = node.absEnd != null ? toNum(node.absEnd) : undefined;
    if (t0 != null && t1 != null && !(t1 > t0))
      fail(`${path}.absEnd`, `must be > absStart`);
    const im: ImageNode = {
      eType: 'image',
      src,
      alt: node.alt,
      absStart: t0,
      absEnd: t1,
      style: node.style,
      layout: normLayout(node.layout, path),
    } as any;
    return im;
  }
  if (eType === 'video') {
    const src = asStr(node.src);
    if (!src) fail(path, `video.src required`);
    const t0 = node.absStart != null ? toNum(node.absStart) : undefined;
    const t1 = node.absEnd != null ? toNum(node.absEnd) : undefined;
    if (t0 != null && t1 != null && !(t1 > t0))
      fail(`${path}.absEnd`, `must be > absStart`);
    const vn: VideoNode = {
      eType: 'video',
      src,
      absStart: t0,
      absEnd: t1,
      style: node.style,
      layout: normLayout(node.layout, path),
      mute: !!node.mute,
      loop: !!node.loop,
    } as any;
    return vn;
  }
  fail(path, `unsupported node type: ${eType}`);
}

export function parseScenario(input: any): ScenarioFileV1_3 {
  if (!isObj(input)) fail('$', 'must be object');
  const version = (input.version ?? '1.3') as ScenarioVersion;
  if (!SUPPORTED_SCENARIO_VERSIONS.includes(version))
    fail('version', `unsupported version: ${version}`);

  const timebaseIn = input.timebase ?? { unit: 'seconds' };
  if (!isObj(timebaseIn)) fail('timebase', 'must be object');
  const unit = timebaseIn.unit ?? 'seconds';
  if (unit !== 'seconds' && unit !== 'tc')
    fail('timebase.unit', "must be 'seconds' or 'tc'");
  const tb: Timebase = {
    unit,
    fps: timebaseIn.fps != null ? toNum(timebaseIn.fps) : undefined,
  } as Timebase;

  const stageIn = input.stage ?? { baseAspect: '16:9' };
  if (!isObj(stageIn)) fail('stage', 'must be object');
  const ba = asStr(stageIn.baseAspect) ?? '16:9';
  if (!ASPECTS.has(ba))
    fail('stage.baseAspect', "must be '16:9'|'9:16'|'auto'");
  const stage: StageSpec = {
    baseAspect: ba as any,
    safeArea: stageIn.safeArea,
  };

  if (!Array.isArray(input.tracks) || input.tracks.length === 0)
    fail('tracks', 'must be a non-empty array');
  const ids = new Set<string>();
  const tracks: Track[] = input.tracks.map((t: any, i: number) => {
    if (!isObj(t)) fail(`tracks[${i}]`, `must be object`);
    const id = asStr(t.id);
    if (!id) fail(`tracks[${i}].id`, `required`);
    if (ids.has(id)) fail(`tracks[${i}].id`, `duplicate '${id}'`);
    ids.add(id);
    const type = asStr(t.type) ?? 'subtitle';
    if (!TRACK_TYPES.has(type)) fail(`tracks[${i}].type`, `subtitle|free`);
    const layer = toNum(t.layer);
    if (layer == null) fail(`tracks[${i}].layer`, `number required`);
    const track: Track = {
      id,
      type: type as any,
      layer,
      scaleMode: t.scaleMode,
      overlapPolicy: t.overlapPolicy,
      defaultStyle: t.defaultStyle,
      safeArea: t.safeArea,
    } as Track;
    if (track.scaleMode && !SCALE_MODES.has(track.scaleMode))
      fail(`tracks[${i}].scaleMode`, `invalid`);
    if (track.overlapPolicy && !OVERLAP_POLICIES.has(track.overlapPolicy))
      fail(`tracks[${i}].overlapPolicy`, `invalid`);
    return track;
  });

  if (!Array.isArray(input.cues)) fail('cues', 'must be array');
  const cues: Cue[] = input.cues.map((c: any, i: number) => {
    if (!isObj(c)) fail(`cues[${i}]`, `must be object`);
    const id = asStr(c.id) ?? `cue-${i + 1}`;
    const track = asStr(c.track) ?? tracks[0]?.id;
    if (!track || !ids.has(track))
      fail(`cues[${i}].track`, `unknown track '${track}'`);
    const hintTime = isObj(c.hintTime)
      ? {
          start: c.hintTime.start != null ? toNum(c.hintTime.start) : undefined,
          end: c.hintTime.end != null ? toNum(c.hintTime.end) : undefined,
        }
      : undefined;
    const root = normNode(
      c.root ?? { eType: 'group', children: [] },
      `cues[${i}].root`
    ) as GroupNode;
    return { id, track, hintTime, root } as Cue;
  });

  const out: ScenarioFileV1_3 = {
    version,
    timebase: tb,
    stage,
    tracks,
    cues,
  } as ScenarioFileV1_3;
  // pass-through optional fields if valid (no deep validation here)
  if (Array.isArray(input.bindings)) (out as any).bindings = input.bindings;
  if (isObj(input.wordStream)) (out as any).wordStream = input.wordStream;
  if (isObj(input.definitions)) (out as any).definitions = input.definitions;
  return out;
}

export type { ScenarioFileV1_3 };
