// Tests for time-v2.ts - v2.0 Array-based time utilities

import { describe, it, expect } from 'vitest';
import {
  isWithinTimeRange,
  progressInTimeRange,
  computePluginWindow,
  clampTimeRange,
  getTimeRangeDuration,
  timeRangesOverlap,
  unionTimeRanges,
  snapToFrame,
  snapTimeRangeToFrame,
  computeRelativeTimeRange,
  validateTimeRange,
  isValidTimeRange,
  legacyAbsToDisplayTime,
  legacyRelToTimeOffset,
} from '../time-v2';

describe('time-v2.ts', () => {
  describe('isWithinTimeRange', () => {
    it('returns true when time is within range', () => {
      expect(isWithinTimeRange(5, [0, 10])).toBe(true);
      expect(isWithinTimeRange(0, [0, 10])).toBe(true); // boundary
      expect(isWithinTimeRange(10, [0, 10])).toBe(true); // boundary
    });

    it('returns false when time is outside range', () => {
      expect(isWithinTimeRange(-1, [0, 10])).toBe(false);
      expect(isWithinTimeRange(11, [0, 10])).toBe(false);
    });

    it('handles invalid inputs gracefully', () => {
      expect(isWithinTimeRange(5, [NaN, 10])).toBe(false);
      expect(isWithinTimeRange(NaN, [0, 10])).toBe(false);
      expect(isWithinTimeRange(5, [0, 10, 20] as any)).toBe(false);
      expect(isWithinTimeRange(5, 'invalid' as any)).toBe(false);
    });
  });

  describe('progressInTimeRange', () => {
    it('calculates progress correctly', () => {
      expect(progressInTimeRange(0, [0, 10])).toBe(0);
      expect(progressInTimeRange(5, [0, 10])).toBe(0.5);
      expect(progressInTimeRange(10, [0, 10])).toBe(1);
    });

    it('clamps progress to 0-1 range', () => {
      expect(progressInTimeRange(-5, [0, 10])).toBe(0);
      expect(progressInTimeRange(15, [0, 10])).toBe(1);
    });

    it('handles zero duration ranges', () => {
      expect(progressInTimeRange(5, [5, 5])).toBe(0);
      expect(progressInTimeRange(5, [10, 5])).toBe(0); // invalid range
    });

    it('handles invalid inputs gracefully', () => {
      expect(progressInTimeRange(5, [NaN, 10])).toBe(0);
      expect(progressInTimeRange(NaN, [0, 10])).toBe(0);
      expect(progressInTimeRange(5, [] as any)).toBe(0);
    });
  });

  describe('computePluginWindow', () => {
    it('computes plugin window correctly', () => {
      const displayTime = [1, 5] as const;
      const timeOffset = [0, 1] as const;
      
      // In v2 helpers, numeric offsets are treated as 0..1 relative to duration
      // duration = 4 → [1 + 4*0, 1 + 4*1] = [1, 5]
      expect(computePluginWindow(displayTime, timeOffset)).toEqual([1, 5]);
    });

    it('handles negative offsets', () => {
      const displayTime = [2, 8] as const;
      const timeOffset = [-1, 2] as const;
      
      // duration = 6 → [2 + 6*(-1), 2 + 6*2] = [-4, 14]
      expect(computePluginWindow(displayTime, timeOffset)).toEqual([-4, 14]);
    });

    it('uses default time offset when not provided', () => {
      const displayTime = [3, 7] as const;
      
      expect(computePluginWindow(displayTime)).toEqual([3, 7]);
    });

    it('throws on invalid inputs', () => {
      expect(() => computePluginWindow('invalid' as any)).toThrow(TypeError);
      expect(() => computePluginWindow([1, 2], 'invalid' as any)).toThrow(TypeError);
      expect(() => computePluginWindow([NaN, 2])).toThrow(TypeError);
    });
  });

  describe('clampTimeRange', () => {
    it('clamps time range to bounds', () => {
      expect(clampTimeRange([-5, 15], 0, 10)).toEqual([0, 10]);
      expect(clampTimeRange([2, 8], 0, 10)).toEqual([2, 8]);
      expect(clampTimeRange([5, 15], 0, 10)).toEqual([5, 10]);
    });

    it('handles invalid inputs', () => {
      expect(clampTimeRange('invalid' as any, 0, 10)).toEqual([0, 10]);
      expect(clampTimeRange([NaN, 5], 0, 10)).toEqual([0, 5]);
    });
  });

  describe('getTimeRangeDuration', () => {
    it('calculates duration correctly', () => {
      expect(getTimeRangeDuration([2, 7])).toBe(5);
      expect(getTimeRangeDuration([10, 10])).toBe(0);
    });

    it('handles invalid ranges', () => {
      expect(getTimeRangeDuration([5, 2])).toBe(0); // end < start
      expect(getTimeRangeDuration([NaN, 10])).toBe(0);
      expect(getTimeRangeDuration('invalid' as any)).toBe(0);
    });
  });

  describe('timeRangesOverlap', () => {
    it('detects overlapping ranges', () => {
      expect(timeRangesOverlap([1, 5], [3, 7])).toBe(true);
      expect(timeRangesOverlap([1, 3], [3, 5])).toBe(true); // touching boundary
      expect(timeRangesOverlap([1, 2], [4, 5])).toBe(false); // no overlap
    });

    it('handles invalid inputs', () => {
      expect(timeRangesOverlap('invalid' as any, [1, 2])).toBe(false);
      expect(timeRangesOverlap([1, 2], [NaN, 5])).toBe(false);
    });
  });

  describe('unionTimeRanges', () => {
    it('computes union of time ranges', () => {
      const ranges = [[1, 3], [5, 7], [2, 4]] as const;
      expect(unionTimeRanges(ranges)).toEqual([1, 7]);
    });

    it('handles single range', () => {
      expect(unionTimeRanges([[3, 8]])).toEqual([3, 8]);
    });

    it('handles empty or invalid inputs', () => {
      expect(unionTimeRanges([])).toBeNull();
      expect(unionTimeRanges([[NaN, 5], [1, 2]])).toEqual([1, 2]);
    });
  });

  describe('snapToFrame', () => {
    it('snaps time to frame boundaries', () => {
      expect(snapToFrame(1.234, 30)).toBeCloseTo(1.233, 3); // 37/30
      expect(snapToFrame(0.5, 60)).toBeCloseTo(0.5, 3); // exact
    });

    it('handles invalid fps', () => {
      expect(snapToFrame(1.234, 0)).toBe(1.234);
      expect(snapToFrame(1.234, NaN)).toBe(1.234);
      expect(snapToFrame(NaN, 30)).toBe(NaN);
    });
  });

  describe('snapTimeRangeToFrame', () => {
    it('snaps both start and end to frames', () => {
      const range = [1.234, 5.678] as const;
      const snapped = snapTimeRangeToFrame(range, 30);
      
      expect(snapped[0]).toBeCloseTo(1.233, 3);
      expect(snapped[1]).toBeCloseTo(5.667, 3);
    });

    it('handles invalid inputs', () => {
      expect(snapTimeRangeToFrame([1, 2], 0)).toEqual([1, 2]);
      expect(snapTimeRangeToFrame('invalid' as any, 30)).toBe('invalid' as any);
    });
  });

  describe('computeRelativeTimeRange', () => {
    it('computes relative time range correctly', () => {
      const parent = [10, 20] as const;
      const relative = [0.25, 0.75] as const;
      
      expect(computeRelativeTimeRange(parent, relative)).toEqual([12.5, 17.5]);
    });

    it('handles edge cases', () => {
      const parent = [5, 15] as const;
      expect(computeRelativeTimeRange(parent, [0, 1])).toEqual([5, 15]);
      expect(computeRelativeTimeRange(parent, [0.5, 0.5])).toEqual([10, 10]);
    });

    it('throws on invalid inputs', () => {
      expect(() => computeRelativeTimeRange('invalid' as any, [0, 1])).toThrow();
      expect(() => computeRelativeTimeRange([1, 2], [-0.1, 0.5])).toThrow();
      expect(() => computeRelativeTimeRange([1, 2], [0.5, 1.1])).toThrow();
    });
  });

  describe('validateTimeRange', () => {
    it('validates correct time ranges', () => {
      expect(() => validateTimeRange([1, 5])).not.toThrow();
      expect(() => validateTimeRange([0, 0])).not.toThrow();
    });

    it('throws on invalid ranges', () => {
      expect(() => validateTimeRange('invalid')).toThrow(TypeError);
      expect(() => validateTimeRange([1])).toThrow(TypeError);
      expect(() => validateTimeRange([1, 2, 3])).toThrow(TypeError);
      expect(() => validateTimeRange([NaN, 5])).toThrow(TypeError);
      expect(() => validateTimeRange([5, 2])).toThrow(RangeError);
    });
  });

  describe('isValidTimeRange', () => {
    it('returns true for valid ranges', () => {
      expect(isValidTimeRange([1, 5])).toBe(true);
      expect(isValidTimeRange([0, 0])).toBe(true);
    });

    it('returns false for invalid ranges', () => {
      expect(isValidTimeRange('invalid')).toBe(false);
      expect(isValidTimeRange([5, 2])).toBe(false);
      expect(isValidTimeRange([NaN, 5])).toBe(false);
    });
  });

  describe('legacy compatibility helpers', () => {
    describe('legacyAbsToDisplayTime', () => {
      it('converts absStart/absEnd to displayTime', () => {
        expect(legacyAbsToDisplayTime(1, 5)).toEqual([1, 5]);
      });

      it('returns undefined for partial values', () => {
        expect(legacyAbsToDisplayTime(1, undefined)).toBeUndefined();
        expect(legacyAbsToDisplayTime(undefined, 5)).toBeUndefined();
        expect(legacyAbsToDisplayTime()).toBeUndefined();
      });
    });

    describe('legacyRelToTimeOffset', () => {
      it('converts relStart/relEnd to time_offset', () => {
        expect(legacyRelToTimeOffset(0, 1)).toEqual([0, 1]);
      });

      it('handles partial values with defaults', () => {
        expect(legacyRelToTimeOffset(2, undefined)).toEqual([2, 0]);
        expect(legacyRelToTimeOffset(undefined, 3)).toEqual([0, 3]);
      });

      it('returns undefined when both are undefined', () => {
        expect(legacyRelToTimeOffset()).toBeUndefined();
      });
    });
  });
});
