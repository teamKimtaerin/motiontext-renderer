import { describe, it, expect } from 'vitest';
import {
  windowEval,
  progress,
  composeChannels,
  composeActive,
  type Channels,
} from '../PluginChainComposer';
import type { PluginSpec, PluginChain } from '../../types/plugin';

describe('M4: PluginChainComposer', () => {
  describe('windowEval', () => {
    it('should compute plugin window with relative offsets', () => {
      const spec: PluginSpec = { name: 'test', relStart: 0.5, relEnd: -0.5 };
      const result = windowEval(10, 20, spec);

      expect(result.spec).toBe(spec);
      expect(result.t0).toBe(10.5); // 10 + 0.5
      expect(result.t1).toBe(19.5); // 20 - 0.5
    });

    it('should compute plugin window with percentage offsets', () => {
      const spec: PluginSpec = {
        name: 'test',
        relStartPct: 0.2,
        relEndPct: 0.1,
      };
      const result = windowEval(10, 20, spec);

      expect(result.t0).toBe(12); // 10 + (10 * 0.2)
      expect(result.t1).toBe(20); // 20 + (10 * 0.1) = 21, but clamped to absEnd = 20 by default
    });

    it('should handle fps parameter for frame snapping', () => {
      const spec: PluginSpec = { name: 'test' };
      const result = windowEval(10.04, 20.07, spec, { fps: 30 });

      // With snapToFrame: false, values should not be snapped
      expect(result.t0).toBe(10.04);
      expect(result.t1).toBe(20.07);
    });
  });

  describe('progress', () => {
    it('should calculate progress within window', () => {
      expect(progress(5, 0, 10)).toBe(0.5);
      expect(progress(2.5, 0, 10)).toBe(0.25);
      expect(progress(7.5, 0, 10)).toBe(0.75);
    });

    it('should clamp progress to 0-1 range', () => {
      expect(progress(-5, 0, 10)).toBe(0);
      expect(progress(15, 0, 10)).toBe(1);
      expect(progress(0, 0, 10)).toBe(0);
      expect(progress(10, 0, 10)).toBe(1);
    });

    it('should handle zero-duration window', () => {
      expect(progress(5, 5, 5)).toBe(0);
      expect(progress(10, 10, 10)).toBe(0);
    });

    it('should handle inverted window', () => {
      expect(progress(5, 10, 0)).toBe(0); // t1 < t0
    });
  });

  describe('composeChannels', () => {
    it('should replace channels by default', () => {
      const acc: Channels = { tx: 10, ty: 20, opacity: 0.5 };
      const add: Channels = { tx: 5, opacity: 1 };

      const result = composeChannels(acc, add, undefined);

      expect(result.tx).toBe(5); // replaced
      expect(result.ty).toBe(20); // unchanged
      expect(result.opacity).toBe(1); // replaced
    });

    it('should add channels with add mode', () => {
      const acc: Channels = { tx: 10, ty: 20, rot: 45 };
      const add: Channels = { tx: 5, ty: -10, sx: 1.5 };

      const result = composeChannels(acc, add, 'add');

      expect(result.tx).toBe(15); // 10 + 5
      expect(result.ty).toBe(10); // 20 + (-10)
      expect(result.rot).toBe(45); // unchanged
      expect(result.sx).toBe(1.5); // 0 (default) + 1.5
    });

    it('should multiply channels with multiply mode', () => {
      const acc: Channels = { sx: 2, sy: 2, opacity: 0.5 };
      const add: Channels = { sx: 1.5, opacity: 0.8 };

      const result = composeChannels(acc, add, 'multiply');

      expect(result.sx).toBe(3); // 2 * 1.5
      expect(result.sy).toBe(2); // unchanged
      expect(result.opacity).toBe(0.4); // 0.5 * 0.8
    });

    it('should use correct defaults for add mode', () => {
      const acc: Channels = {};
      const add: Channels = { tx: 10, ty: 20, rot: 45 };

      const result = composeChannels(acc, add, 'add');

      expect(result.tx).toBe(10); // 0 (default) + 10
      expect(result.ty).toBe(20); // 0 (default) + 20
      expect(result.rot).toBe(45); // 0 (default) + 45
    });

    it('should use correct defaults for multiply mode', () => {
      const acc: Channels = {};
      const add: Channels = { sx: 2, sy: 3, opacity: 0.5 };

      const result = composeChannels(acc, add, 'multiply');

      expect(result.sx).toBe(2); // 1 (default) * 2
      expect(result.sy).toBe(3); // 1 (default) * 3
      expect(result.opacity).toBe(0.5); // 1 (default) * 0.5
    });

    it('should preserve accumulator for non-overlapping channels', () => {
      const acc: Channels = { tx: 10, rot: 45 };
      const add: Channels = { ty: 20, opacity: 0.5 };

      const result = composeChannels(acc, add, 'replace');

      expect(result.tx).toBe(10);
      expect(result.ty).toBe(20);
      expect(result.rot).toBe(45);
      expect(result.opacity).toBe(0.5);
    });
  });

  describe('composeActive', () => {
    const mockEval = (spec: PluginSpec, p: number): Channels => {
      // Simple mock: returns channels based on plugin name and progress
      if (spec.name === 'fade') {
        return { opacity: p };
      } else if (spec.name === 'move') {
        return { tx: p * 100, ty: p * 50 };
      } else if (spec.name === 'scale') {
        return { sx: 1 + p, sy: 1 + p };
      }
      return {};
    };

    it('should return empty channels for empty chain', () => {
      const result = composeActive(undefined, 5, 0, 10, mockEval);
      expect(result).toEqual({});

      const result2 = composeActive([], 5, 0, 10, mockEval);
      expect(result2).toEqual({});
    });

    it('should filter inactive plugins', () => {
      const chain: PluginChain = [
        { name: 'fade', relStart: 0, relEnd: -5 }, // [0, 5]
        { name: 'move', relStart: 5, relEnd: 0 }, // [5, 10]
      ];

      // At t=2, only fade is active (window [0, 5])
      const result1 = composeActive(chain, 2, 0, 10, mockEval);
      expect(result1.opacity).toBeCloseTo(0.4); // progress = 2/5 = 0.4
      expect(result1.tx).toBeUndefined();

      // At t=7, only move is active
      const result2 = composeActive(chain, 7, 0, 10, mockEval);
      expect(result2.opacity).toBeUndefined();
      expect(result2.tx).toBeCloseTo(40); // progress = (7-5)/5 = 0.4, tx = 0.4 * 100
    });

    it('should compose overlapping plugins with replace mode', () => {
      const chain: PluginChain = [
        { name: 'fade', relStart: 0, relEnd: 0 },
        { name: 'move', relStart: 0, relEnd: 0 },
      ];

      const result = composeActive(chain, 5, 0, 10, mockEval);

      // move overwrites fade (last-wins) but move doesn't set opacity
      expect(result.opacity).toBe(0.5); // fade sets opacity, move doesn't touch it
      expect(result.tx).toBe(50); // progress = 0.5, tx = 0.5 * 100
      expect(result.ty).toBe(25); // progress = 0.5, ty = 0.5 * 50
    });

    it('should compose overlapping plugins with add mode', () => {
      const chain: PluginChain = [
        { name: 'move', relStart: 0, relEnd: 0 },
        { name: 'move', relStart: 0, relEnd: 0, compose: 'add' },
      ];

      const result = composeActive(chain, 5, 0, 10, mockEval);

      expect(result.tx).toBe(100); // 50 + 50
      expect(result.ty).toBe(50); // 25 + 25
    });

    it('should compose overlapping plugins with multiply mode', () => {
      const chain: PluginChain = [
        { name: 'scale', relStart: 0, relEnd: 0 },
        { name: 'scale', relStart: 0, relEnd: 0, compose: 'multiply' },
      ];

      const result = composeActive(chain, 5, 0, 10, mockEval);

      expect(result.sx).toBe(2.25); // 1.5 * 1.5
      expect(result.sy).toBe(2.25); // 1.5 * 1.5
    });

    it('should handle complex chain with mixed modes', () => {
      const chain: PluginChain = [
        { name: 'fade', relStart: 0, relEnd: 0 }, // replace
        { name: 'move', relStart: 0, relEnd: 0, compose: 'add' }, // add
        { name: 'scale', relStart: 0.25, relEnd: -0.25 }, // replace in middle
      ];

      const result = composeActive(chain, 5, 0, 10, mockEval);

      // fade sets opacity: 0.5
      // move adds tx/ty (doesn't affect opacity)
      // scale replaces sx/sy (at t=5, window [2.5, 7.5], progress = (5-2.5)/5 = 0.5)

      expect(result.opacity).toBe(0.5); // from fade
      expect(result.tx).toBe(50); // from move
      expect(result.ty).toBe(25); // from move
      expect(result.sx).toBe(1.5); // from scale (replaced)
      expect(result.sy).toBe(1.5); // from scale (replaced)
    });

    it('should respect plugin time windows', () => {
      const chain: PluginChain = [
        { name: 'fade', relStartPct: 0.2, relEndPct: 0.2 }, // [2, 8] for [0, 10]
      ];

      // Before window
      const result1 = composeActive(chain, 1, 0, 10, mockEval);
      expect(result1).toEqual({});

      // In window [2, 10] (clamped from [2, 12])
      const result2 = composeActive(chain, 5, 0, 10, mockEval);
      expect(result2.opacity).toBeCloseTo(0.375); // (5-2)/(10-2) = 3/8 = 0.375

      // At t=9, still in window because relEndPct=0.2 means window ends at 10 + (10*0.2) = 12, clamped to 10
      const result3 = composeActive(chain, 9, 0, 10, mockEval);
      expect(result3.opacity).toBeCloseTo(0.875); // (9-2)/(10-2) = 7/8 = 0.875
    });

    it('should handle edge case at exact boundaries', () => {
      const chain: PluginChain = [
        { name: 'fade', relStart: 2, relEnd: -2 }, // [2, 8] for [0, 10]
      ];

      // At start boundary (inclusive)
      const result1 = composeActive(chain, 2, 0, 10, mockEval);
      expect(result1.opacity).toBe(0); // progress = 0

      // At end boundary (exclusive)
      const result2 = composeActive(chain, 8, 0, 10, mockEval);
      expect(result2).toEqual({}); // not active
    });

    it('should handle fps parameter', () => {
      const chain: PluginChain = [{ name: 'fade', relStart: 0, relEnd: 0 }];

      // fps parameter is passed through but doesn't affect snapToFrame=false
      const result = composeActive(chain, 5.123, 0, 10, mockEval, { fps: 30 });
      expect(result.opacity).toBeCloseTo(0.5123);
    });
  });
});
