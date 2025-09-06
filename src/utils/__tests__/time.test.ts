import { describe, it, expect } from 'vitest';
import { 
  computeRelativeWindow, 
  snapToFrame, 
  clampRange, 
  isWithin,
  type ComputeWindowOptions
} from '../time';

describe('M2: Time Utilities', () => {
  describe('computeRelativeWindow', () => {
    it('should compute basic window with relStart and relEnd', () => {
      const result = computeRelativeWindow(2, 5, { relStart: 0, relEnd: 0 });
      
      expect(result.t0).toBe(2);
      expect(result.t1).toBe(5);
      expect(result.rawT0).toBe(2);
      expect(result.rawT1).toBe(5);
      expect(result.D).toBe(3);
    });

    it('should handle percentage offsets', () => {
      const result = computeRelativeWindow(2, 5, { relStartPct: 0.1, relEndPct: 0.0 });
      
      expect(result.t0).toBeCloseTo(2.3); // 2 + (3 * 0.1)
      expect(result.t1).toBe(5); // 5 + (3 * 0.0)
      expect(result.D).toBe(3);
    });

    it('should prioritize relStart over relStartPct', () => {
      const result = computeRelativeWindow(2, 5, { 
        relStart: 1, 
        relStartPct: 0.5,
        relEnd: -1,
        relEndPct: 0.2
      });
      
      expect(result.rawT0).toBe(3); // 2 + 1 (relStart used, not relStartPct)
      expect(result.rawT1).toBe(4); // 5 + (-1) (relEnd used, not relEndPct)
    });

    it('should use default values when no spec provided', () => {
      const result = computeRelativeWindow(2, 5, {});
      
      expect(result.t0).toBe(2); // 2 + 0
      expect(result.t1).toBe(5); // 5 + 0
    });

    it('should clamp to element duration by default', () => {
      const result = computeRelativeWindow(2, 5, { 
        relStart: -1, // would make t0 = 1 (before absStart)
        relEnd: 2     // would make t1 = 7 (after absEnd)
      });
      
      expect(result.t0).toBe(2); // clamped to absStart
      expect(result.t1).toBe(5); // clamped to absEnd
      expect(result.rawT0).toBe(1); // original unclamped value
      expect(result.rawT1).toBe(7); // original unclamped value
    });

    it('should not clamp when clampToElement is false', () => {
      const options: ComputeWindowOptions = { clampToElement: false };
      const result = computeRelativeWindow(2, 5, { 
        relStart: -1, 
        relEnd: 2 
      }, options);
      
      expect(result.t0).toBe(1); // not clamped
      expect(result.t1).toBe(7); // not clamped
    });

    it('should snap to frame when enabled', () => {
      const options: ComputeWindowOptions = { 
        snapToFrame: true, 
        fps: 30 
      };
      const result = computeRelativeWindow(2.04, 5.07, { 
        relStart: 0, 
        relEnd: 0 
      }, options);
      
      // 2.04 at 30fps should snap to 2.033 (61/30)
      // 5.07 at 30fps should snap to 5.067 (152/30)
      expect(result.t0).toBeCloseTo(2.033, 3);
      expect(result.t1).toBeCloseTo(5.067, 3);
    });

    it('should throw error for invalid percentage values', () => {
      expect(() => {
        computeRelativeWindow(2, 5, { relStartPct: 1.5 });
      }).toThrow('relStartPct must be within 0..1, got 1.5');

      expect(() => {
        computeRelativeWindow(2, 5, { relEndPct: -0.1 });
      }).toThrow('relEndPct must be within 0..1, got -0.1');
    });

    it('should throw error for invalid duration', () => {
      expect(() => {
        computeRelativeWindow(5, 2, {}); // absEnd < absStart
      }).toThrow('Invalid element duration D=-3. Requires absEnd > absStart.');
    });

    it('should throw error for non-finite times', () => {
      expect(() => {
        computeRelativeWindow(NaN, 5, {});
      }).toThrow('absStart/absEnd must be finite numbers');

      expect(() => {
        computeRelativeWindow(2, Infinity, {});
      }).toThrow('absStart/absEnd must be finite numbers');
    });

    it('should throw error for inverted computed window', () => {
      expect(() => {
        computeRelativeWindow(2, 5, { 
          relStart: 2.5, // will make t0 = 4.5
          relEnd: -1.5   // will make t1 = 3.5, creating inverted window
        });
      }).toThrow(/Computed window is inverted/);
    });

    it('should handle empty window after clamp', () => {
      // Window completely outside element bounds
      const result = computeRelativeWindow(10, 20, { 
        relStart: -15, // t0 would be -5
        relEnd: -15    // t1 would be 5, still < absStart
      });
      
      // Should collapse to empty window at absStart
      expect(result.t0).toBe(10);
      expect(result.t1).toBe(10);
    });
  });

  describe('snapToFrame', () => {
    it('should snap time to nearest frame boundary', () => {
      expect(snapToFrame(1.04, 30)).toBeCloseTo(1.033, 3); // 31/30
      expect(snapToFrame(1.02, 30)).toBeCloseTo(1.033, 3); // rounds up to 31/30
      expect(snapToFrame(1.01, 30)).toBeCloseTo(1.0, 3);   // rounds down to 30/30
    });

    it('should handle edge cases', () => {
      expect(snapToFrame(0, 30)).toBe(0);
      expect(snapToFrame(1, 30)).toBeCloseTo(1.0, 3);
      expect(snapToFrame(1.5, 2)).toBeCloseTo(1.5, 3); // 3/2
    });

    it('should return original time for invalid fps', () => {
      expect(snapToFrame(1.234, 0)).toBe(1.234);
      expect(snapToFrame(1.234, -30)).toBe(1.234);
      expect(snapToFrame(1.234, NaN)).toBe(1.234);
      expect(snapToFrame(1.234)).toBe(1.234); // undefined fps
    });
  });

  describe('clampRange', () => {
    it('should clamp both values to range', () => {
      expect(clampRange([0, 10], 2, 8)).toEqual([2, 8]);
      expect(clampRange([-5, 15], 0, 10)).toEqual([0, 10]);
      expect(clampRange([3, 7], 0, 10)).toEqual([3, 7]); // already in range
    });

    it('should handle inverted ranges', () => {
      expect(clampRange([10, 0], 2, 8)).toEqual([8, 2]); // both clamped independently
    });

    it('should handle edge cases', () => {
      expect(clampRange([5, 5], 0, 10)).toEqual([5, 5]); // point range
      expect(clampRange([0, 0], 5, 10)).toEqual([5, 5]); // both below min
      expect(clampRange([15, 20], 0, 10)).toEqual([10, 10]); // both above max
    });
  });

  describe('isWithin', () => {
    it('should check if time is within half-open interval [t0, t1)', () => {
      expect(isWithin(2.5, 2, 5)).toBe(true);
      expect(isWithin(2, 2, 5)).toBe(true);    // inclusive start
      expect(isWithin(5, 2, 5)).toBe(false);   // exclusive end
      expect(isWithin(1.9, 2, 5)).toBe(false); // before start
      expect(isWithin(5.1, 2, 5)).toBe(false); // after end
    });

    it('should handle edge cases', () => {
      expect(isWithin(0, 0, 0)).toBe(false); // empty interval
      expect(isWithin(0, 0, 1)).toBe(true);  // at start of [0, 1)
      expect(isWithin(1, 0, 1)).toBe(false); // at end of [0, 1)
    });
  });
});