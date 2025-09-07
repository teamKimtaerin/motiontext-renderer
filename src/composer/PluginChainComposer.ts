// Composes plugin outputs across overlapping windows with compose:"add"|"multiply"|"replace".
// Default policy: last-wins when overlapping and no compose specified.

import type { PluginChain, PluginSpec, ComposeMode } from '../types/plugin';
import { computeRelativeWindow, isWithin } from '../utils/time';

export type Channels = Partial<{
  tx: number; // translateX in px (relative to overlay pixels)
  ty: number; // translateY in px
  sx: number; // scaleX (1 = no change)
  sy: number; // scaleY
  rot: number; // rotation in deg
  opacity: number; // 0..1
}>;

export interface PluginEval {
  spec: PluginSpec;
  t0: number;
  t1: number;
}

export function windowEval(
  absStart: number,
  absEnd: number,
  spec: PluginSpec,
  fps?: number
): PluginEval {
  const { t0, t1 } = computeRelativeWindow(absStart, absEnd, spec, {
    snapToFrame: false,
    fps,
  });
  return { spec, t0, t1 };
}

export function progress(now: number, t0: number, t1: number): number {
  const d = t1 - t0;
  if (!(d > 0)) return 0;
  const p = (now - t0) / d;
  if (p < 0) return 0;
  if (p > 1) return 1;
  return p;
}

export function composeChannels(
  acc: Channels,
  add: Channels,
  mode: ComposeMode | undefined
): Channels {
  const out: Channels = { ...acc };
  for (const k of Object.keys(add) as (keyof Channels)[]) {
    const v = add[k]!;
    if (mode === 'add')
      out[k] = ((out[k] as number | undefined) ?? 0) + (v as number);
    else if (mode === 'multiply')
      out[k] = ((out[k] as number | undefined) ?? 1) * (v as number);
    else out[k] = v; // replace (last wins)
  }
  return out;
}

export function composeActive(
  chain: PluginChain | undefined,
  now: number,
  absStart: number,
  absEnd: number,
  evalFn: (_spec: PluginSpec, _p: number) => Channels,
  fps?: number
): Channels {
  if (!chain || chain.length === 0) return {};
  let acc: Channels = {};
  for (const spec of chain) {
    const { t0, t1 } = computeRelativeWindow(absStart, absEnd, spec, { fps });
    if (!isWithin(now, t0, t1)) continue;
    const p = progress(now, t0, t1);
    const ch = evalFn(spec, p);
    acc = composeChannels(acc, ch, spec.compose);
  }
  return acc;
}
