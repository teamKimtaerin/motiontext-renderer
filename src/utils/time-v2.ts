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
  if (!Number.isFinite(currentTime) || !Number.isFinite(start) || !Number.isFinite(end)) {
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
  timeOffset: TimeRange = [0, 1]  // 기본값을 [0, 1]로 변경
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
export function timeRangesOverlap(range1: TimeRange, range2: TimeRange): boolean {
  if (!Array.isArray(range1) || !Array.isArray(range2)) {
    return false;
  }
  
  const [start1, end1] = range1;
  const [start2, end2] = range2;
  
  if (!Number.isFinite(start1) || !Number.isFinite(end1) || 
      !Number.isFinite(start2) || !Number.isFinite(end2)) {
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
  
  const validRanges = ranges.filter(range => 
    Array.isArray(range) && 
    range.length === 2 && 
    Number.isFinite(range[0]) && 
    Number.isFinite(range[1])
  );
  
  if (validRanges.length === 0) {
    return null;
  }
  
  const allStarts = validRanges.map(range => range[0]);
  const allEnds = validRanges.map(range => range[1]);
  
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
export function snapTimeRangeToFrame(timeRange: TimeRange, fps?: number): TimeRange {
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
export function validateTimeRange(timeRange: unknown): asserts timeRange is TimeRange {
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
    throw new RangeError(`timeRange start (${start}) must not be greater than end (${end})`);
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