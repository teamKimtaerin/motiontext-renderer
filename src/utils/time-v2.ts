// Time utilities for v2.0 - Array-based time handling
// Reference: context/scenario-json-spec-v-2-0.md
//
// v1.3 → v2.0 주요 변경사항:
// - 모든 시간은 [start, end] 배열 형태
// - displayTime: [start, end] 노드 표시 시간
// - time_offset: [start, end] 플러그인 오프셋
// - domLifetime: [start, end] DOM 생존 시간

import type { TimeRange } from '../types/scenario-v2';

// ============================================================================
// Core Time Functions
// ============================================================================

/**
 * 주어진 시간이 시간 구간 내에 있는지 확인
 * @param t - 현재 시간
 * @param timeRange - [start, end] 시간 구간
 * @returns 시간 구간 내에 있으면 true
 */
export function isWithinTimeRange(t: number, timeRange: TimeRange): boolean {
  if (!Array.isArray(timeRange) || timeRange.length !== 2) {
    return false;
  }

  const [start, end] = timeRange;
  if (!Number.isFinite(t) || !Number.isFinite(start) || !Number.isFinite(end)) {
    return false;
  }

  return t >= start && t <= end;
}

/**
 * 시간 구간 내에서의 진행도(0~1) 계산
 * @param currentTime - 현재 시간
 * @param timeRange - [start, end] 시간 구간
 * @returns 0~1 사이의 진행도. 구간 밖이면 clamp됨
 */
export function progressInTimeRange(
  currentTime: number,
  timeRange: TimeRange
): number {
  if (!Array.isArray(timeRange) || timeRange.length !== 2) {
    return 0;
  }

  const [start, end] = timeRange;
  if (
    !Number.isFinite(currentTime) ||
    !Number.isFinite(start) ||
    !Number.isFinite(end)
  ) {
    return 0;
  }

  const duration = end - start;
  if (duration <= 0) {
    return 0;
  }

  const progress = (currentTime - start) / duration;
  return Math.max(0, Math.min(1, progress));
}

/**
 * 플러그인 실행 창 계산
 * @param displayTime - 노드의 [start, end] 표시 시간
 * @param timeOffset - 플러그인의 [offsetStart, offsetEnd] 상대 오프셋 (0~1)
 * @returns 플러그인의 절대 실행 시간 구간
 */
export function computePluginWindow(
  displayTime: TimeRange,
  timeOffset: TimeRange = [0, 1] // 기본값을 [0, 1]로 변경
): TimeRange {
  if (!Array.isArray(displayTime) || displayTime.length !== 2) {
    throw new TypeError('displayTime must be [start, end] array');
  }

  if (!Array.isArray(timeOffset) || timeOffset.length !== 2) {
    throw new TypeError('timeOffset must be [start, end] array');
  }

  const [nodeStart, nodeEnd] = displayTime;
  const [offsetStart, offsetEnd] = timeOffset;

  if (!Number.isFinite(nodeStart) || !Number.isFinite(nodeEnd)) {
    throw new TypeError('displayTime values must be finite numbers');
  }

  if (!Number.isFinite(offsetStart) || !Number.isFinite(offsetEnd)) {
    throw new TypeError('timeOffset values must be finite numbers');
  }

  // time_offset는 0~1 상대 비율로 처리
  const nodeDuration = nodeEnd - nodeStart;
  const pluginStart = nodeStart + nodeDuration * offsetStart;
  const pluginEnd = nodeStart + nodeDuration * offsetEnd;

  return [pluginStart, pluginEnd];
}

// ============================================================================
// Extended: Percentage/Absolute offset with explicit base_time
// ============================================================================

/**
 * 문자열 혹은 숫자 오프셋 값을 base_time 기준 절대 시간으로 변환
 * - "50%" → baseStart + baseDuration * 0.5 (양 끝 공통: 비율은 항상 baseStart 기준)
 * - 숫자(또는 숫자 문자열)는 경계별로 다르게 해석
 *   - which = 'start' → baseStart + value
 *   - which = 'end'   → baseEnd   + value
 *   이를 통해 [0, 2] 같이 숫자로 끝 경계에 여유 시간을 더하는 확장 표현을 지원
 */
function resolveOffsetToAbsolute(
  bound: unknown,
  baseStart: number,
  baseEnd: number,
  baseDuration: number,
  which: 'start' | 'end'
): number {
  if (typeof bound === 'string') {
    const s = bound.trim();
    if (s.endsWith('%')) {
      const n = parseFloat(s.slice(0, -1));
      const pct = Number.isFinite(n) ? n / 100 : 0;
      // Percentage offsets are applied relative to each boundary:
      //  - start: baseStart + baseDuration * pct
      //  - end:   baseEnd   + baseDuration * pct
      // This allows negative percentages on the end boundary to shorten the window
      // from the end (e.g., base [2,4], '-20%' → 4 - 0.4 = 3.6).
      return which === 'start'
        ? baseStart + baseDuration * pct
        : baseEnd + baseDuration * pct;
    }
    const n = parseFloat(s);
    if (Number.isFinite(n)) {
      return (which === 'start' ? baseStart : baseEnd) + n;
    }
    return which === 'start' ? baseStart : baseEnd;
  }
  if (typeof bound === 'number') {
    // 절대 초(오프셋), 음수 허용
    return (which === 'start' ? baseStart : baseEnd) + bound;
  }
  // 안전 폴백: 해당 경계 기본
  return which === 'start' ? baseStart : baseEnd;
}

/**
 * base_time을 기준으로 time_offset을 해석하여 절대 실행 창을 계산
 * - time_offset 요소는 절대 초(number) 또는 백분율 문자열("50%") 둘 다 허용
 * - base_time이 [start,end]이며, 백분율은 base_time 길이에 대한 비율
 * - 값이 제공되지 않으면 전체(base_time 전체)를 의미하도록 ['0%','100%']를 권장
 */
export function computePluginWindowFromBase(
  baseTime: TimeRange,
  timeOffset: [unknown, unknown] = ['0%', '100%']
): TimeRange {
  if (!Array.isArray(baseTime) || baseTime.length !== 2) {
    throw new TypeError('baseTime must be [start, end] array');
  }
  const [bStart, bEnd] = baseTime;
  if (!Number.isFinite(bStart) || !Number.isFinite(bEnd)) {
    throw new TypeError('baseTime values must be finite numbers');
  }
  const bDur = bEnd - bStart;
  const [o0, o1] = Array.isArray(timeOffset) ? timeOffset : ['0%', '100%'];
  const abs0 = resolveOffsetToAbsolute(o0, bStart, bEnd, bDur, 'start');
  const abs1 = resolveOffsetToAbsolute(o1, bStart, bEnd, bDur, 'end');
  return [abs0, abs1];
}

// ============================================================================
// Time Range Utilities
// ============================================================================

/**
 * 시간 구간을 주어진 범위로 제한
 * @param timeRange - [start, end] 시간 구간
 * @param min - 최소값
 * @param max - 최대값
 * @returns 제한된 시간 구간
 */
export function clampTimeRange(
  timeRange: TimeRange,
  min: number,
  max: number
): TimeRange {
  if (!Array.isArray(timeRange) || timeRange.length !== 2) {
    return [min, max];
  }

  const [start, end] = timeRange;

  // Handle NaN values by replacing with bounds
  const safeStart = Number.isFinite(start) ? start : min;
  const safeEnd = Number.isFinite(end) ? end : max;

  const clampedStart = Math.max(min, Math.min(max, safeStart));
  const clampedEnd = Math.max(min, Math.min(max, safeEnd));

  return [clampedStart, clampedEnd];
}

/**
 * 시간 구간의 지속 시간 계산
 * @param timeRange - [start, end] 시간 구간
 * @returns 지속 시간 (end - start)
 */
export function getTimeRangeDuration(timeRange: TimeRange): number {
  if (!Array.isArray(timeRange) || timeRange.length !== 2) {
    return 0;
  }

  const [start, end] = timeRange;
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }

  return Math.max(0, end - start);
}

/**
 * 두 시간 구간이 겹치는지 확인
 * @param range1 - 첫 번째 시간 구간
 * @param range2 - 두 번째 시간 구간
 * @returns 겹치면 true
 */
export function timeRangesOverlap(
  range1: TimeRange,
  range2: TimeRange
): boolean {
  if (!Array.isArray(range1) || !Array.isArray(range2)) {
    return false;
  }

  const [start1, end1] = range1;
  const [start2, end2] = range2;

  if (
    !Number.isFinite(start1) ||
    !Number.isFinite(end1) ||
    !Number.isFinite(start2) ||
    !Number.isFinite(end2)
  ) {
    return false;
  }

  return start1 <= end2 && start2 <= end1;
}

/**
 * 시간 구간들의 합집합 계산
 * @param ranges - 시간 구간 배열
 * @returns 전체를 포함하는 시간 구간
 */
export function unionTimeRanges(ranges: TimeRange[]): TimeRange | null {
  if (!Array.isArray(ranges) || ranges.length === 0) {
    return null;
  }

  const validRanges = ranges.filter(
    (range) =>
      Array.isArray(range) &&
      range.length === 2 &&
      Number.isFinite(range[0]) &&
      Number.isFinite(range[1])
  );

  if (validRanges.length === 0) {
    return null;
  }

  const allStarts = validRanges.map((range) => range[0]);
  const allEnds = validRanges.map((range) => range[1]);

  return [Math.min(...allStarts), Math.max(...allEnds)];
}

// ============================================================================
// Frame Snapping
// ============================================================================

/**
 * 시간을 프레임 단위로 스냅
 * @param time - 스냅할 시간
 * @param fps - 프레임률
 * @returns 프레임에 맞춰진 시간
 */
export function snapToFrame(time: number, fps?: number): number {
  if (!fps || fps <= 0 || !Number.isFinite(fps) || !Number.isFinite(time)) {
    return time;
  }
  return Math.round(time * fps) / fps;
}

/**
 * 시간 구간을 프레임 단위로 스냅
 * @param timeRange - [start, end] 시간 구간
 * @param fps - 프레임률
 * @returns 프레임에 맞춰진 시간 구간
 */
export function snapTimeRangeToFrame(
  timeRange: TimeRange,
  fps?: number
): TimeRange {
  if (!Array.isArray(timeRange) || timeRange.length !== 2 || !fps) {
    return timeRange;
  }

  const [start, end] = timeRange;
  return [snapToFrame(start, fps), snapToFrame(end, fps)];
}

// ============================================================================
// Percentage-based Time Calculations
// ============================================================================

/**
 * 부모 시간 구간 기준으로 상대적 시간 구간 계산
 * @param parentRange - 부모의 [start, end] 시간 구간
 * @param relativeRange - 상대적 [startPct, endPct] (0~1)
 * @returns 절대 시간 구간
 */
export function computeRelativeTimeRange(
  parentRange: TimeRange,
  relativeRange: [number, number]
): TimeRange {
  if (!Array.isArray(parentRange) || parentRange.length !== 2) {
    throw new TypeError('parentRange must be [start, end] array');
  }

  if (!Array.isArray(relativeRange) || relativeRange.length !== 2) {
    throw new TypeError('relativeRange must be [startPct, endPct] array');
  }

  const [parentStart, parentEnd] = parentRange;
  const [startPct, endPct] = relativeRange;

  if (!Number.isFinite(parentStart) || !Number.isFinite(parentEnd)) {
    throw new TypeError('parentRange values must be finite numbers');
  }

  if (startPct < 0 || startPct > 1 || endPct < 0 || endPct > 1) {
    throw new RangeError('relative percentages must be between 0 and 1');
  }

  const parentDuration = parentEnd - parentStart;
  const absoluteStart = parentStart + parentDuration * startPct;
  const absoluteEnd = parentStart + parentDuration * endPct;

  return [absoluteStart, absoluteEnd];
}

// ============================================================================
// Time Validation
// ============================================================================

/**
 * 시간 구간 배열의 유효성 검사
 * @param timeRange - 검사할 시간 구간
 * @throws TypeError - 유효하지 않은 형식
 * @throws RangeError - start > end인 경우
 */
export function validateTimeRange(
  timeRange: unknown
): asserts timeRange is TimeRange {
  if (!Array.isArray(timeRange)) {
    throw new TypeError('timeRange must be an array');
  }

  if (timeRange.length !== 2) {
    throw new TypeError('timeRange must have exactly 2 elements [start, end]');
  }

  const [start, end] = timeRange;

  if (!Number.isFinite(start)) {
    throw new TypeError('timeRange start must be a finite number');
  }

  if (!Number.isFinite(end)) {
    throw new TypeError('timeRange end must be a finite number');
  }

  if (start > end) {
    throw new RangeError(
      `timeRange start (${start}) must not be greater than end (${end})`
    );
  }
}

/**
 * 시간 구간이 유효한지 확인 (예외 없이)
 * @param timeRange - 검사할 시간 구간
 * @returns 유효하면 true
 */
export function isValidTimeRange(timeRange: unknown): timeRange is TimeRange {
  try {
    validateTimeRange(timeRange);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Legacy Compatibility Helpers
// ============================================================================

/**
 * v1.3 스타일 absStart/absEnd를 v2.0 displayTime으로 변환
 * @deprecated v2.0 네이티브 사용 권장
 */
export function legacyAbsToDisplayTime(
  absStart?: number,
  absEnd?: number
): TimeRange | undefined {
  if (absStart != null && absEnd != null) {
    return [absStart, absEnd];
  }
  return undefined;
}

/**
 * v1.3 스타일 relStart/relEnd를 v2.0 time_offset으로 변환
 * @deprecated v2.0 네이티브 사용 권장
 */
export function legacyRelToTimeOffset(
  relStart?: number,
  relEnd?: number
): TimeRange | undefined {
  if (relStart != null || relEnd != null) {
    return [relStart ?? 0, relEnd ?? 0];
  }
  return undefined;
}
