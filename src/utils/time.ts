// Time helpers: snapping to frame, relative window calculations (t0, t1).
// Spec reference: context/명령파일(JSON) 스펙 v1 3.md
//
// ⚠️ DEPRECATED - v1.3 기반 시간 함수
// v2.0 프로젝트에서는 time-v2.ts 사용 권장
// - time-v2.ts: [start, end] 배열 기반 함수들
// - 더 나은 타입 안전성과 일관된 API 제공

import type { PluginSpec } from '../types/plugin';

export interface ComputeWindowOptions {
  // Clamp resulting window to [absStart, absEnd]. Default: true (element inactive outside anyway)
  clampToElement?: boolean;
  // Snap t0/t1 to nearest frame when provided
  snapToFrame?: boolean;
  fps?: number; // used when snapToFrame is true
}

export interface ComputedWindow {
  t0: number;
  t1: number;
  // raw values before clamping/snap (for debugging)
  rawT0: number;
  rawT1: number;
  D: number;
}

export function snapToFrame(t: number, fps?: number): number {
  if (!fps || fps <= 0 || !Number.isFinite(fps)) return t;
  return Math.round(t * fps) / fps;
}

export function clampRange(
  range: [number, number],
  min: number,
  max: number
): [number, number] {
  const [a, b] = range;
  const t0 = Math.min(Math.max(a, min), max);
  const t1 = Math.min(Math.max(b, min), max);
  return [t0, t1];
}

function validatePercents(
  spec: Pick<PluginSpec, 'relStartPct' | 'relEndPct'>
): void {
  const { relStartPct, relEndPct } = spec;
  if (relStartPct != null && (relStartPct < 0 || relStartPct > 1)) {
    throw new RangeError(`relStartPct must be within 0..1, got ${relStartPct}`);
  }
  if (relEndPct != null && (relEndPct < 0 || relEndPct > 1)) {
    throw new RangeError(`relEndPct must be within 0..1, got ${relEndPct}`);
  }
}

function computeOffsets(
  absStart: number,
  absEnd: number,
  spec: Pick<PluginSpec, 'relStart' | 'relEnd' | 'relStartPct' | 'relEndPct'>
): { rawT0: number; rawT1: number; D: number } {
  if (!Number.isFinite(absStart) || !Number.isFinite(absEnd)) {
    throw new TypeError('absStart/absEnd must be finite numbers');
  }
  const D = absEnd - absStart;
  if (!(D > 0)) {
    throw new RangeError(
      `Invalid element duration D=${D}. Requires absEnd > absStart.`
    );
  }

  validatePercents(spec);

  const s =
    spec.relStart ?? (spec.relStartPct != null ? D * spec.relStartPct : 0);
  const e = spec.relEnd ?? (spec.relEndPct != null ? D * spec.relEndPct : 0);
  const rawT0 = absStart + s;
  const rawT1 = absEnd + e;
  return { rawT0, rawT1, D };
}

/**
 * Compute the actual execution window for a plugin relative spec.
 * t0 = absStart + (relStart ?? D*relStartPct ?? 0)
 * t1 = absEnd   + (relEnd   ?? D*relEndPct   ?? 0)
 *
 * By default, clamps [t0,t1] to [absStart,absEnd] because the element is only active in that span.
 */
export function computeRelativeWindow(
  absStart: number,
  absEnd: number,
  spec: Pick<PluginSpec, 'relStart' | 'relEnd' | 'relStartPct' | 'relEndPct'>,
  opts: ComputeWindowOptions = {}
): ComputedWindow {
  const { rawT0, rawT1, D } = computeOffsets(absStart, absEnd, spec);

  if (rawT0 > rawT1) {
    // Allow zero-length after clamp/snap; but before any processing, enforce non-decreasing order.
    // This likely indicates a bad spec (e.g., relStartPct>relEndPct on short spans).
    throw new RangeError(
      `Computed window is inverted (t0=${rawT0} > t1=${rawT1}). Check relStart/relEnd or pct.`
    );
  }

  const clamp = opts.clampToElement ?? true;
  let t0 = rawT0;
  let t1 = rawT1;
  if (clamp) {
    [t0, t1] = clampRange([t0, t1], absStart, absEnd);
    if (t0 > t1) {
      // After clamp, inverted means no intersection → collapse to absStart (empty window)
      t0 = absStart;
      t1 = absStart;
    }
  }

  if (opts.snapToFrame && opts.fps) {
    t0 = snapToFrame(t0, opts.fps);
    t1 = snapToFrame(t1, opts.fps);
  }

  return { t0, t1, rawT0, rawT1, D };
}

/** Return true when time `t` is within [t0, t1). */
export function isWithin(t: number, t0: number, t1: number): boolean {
  return t >= t0 && t < t1;
}
