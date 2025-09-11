import { describe, it, expect } from 'vitest';
import { evalBuiltin } from '../Builtin';
import type { PluginSpec } from '../../../types/plugin';

describe('M4: Builtin Plugins', () => {
  describe('fadeIn', () => {
    it('should fade from 0 to 1 with easing', () => {
      const spec: PluginSpec = { name: 'fadeIn' };

      expect(evalBuiltin(spec, 0)).toEqual({ opacity: 0 });
      expect(evalBuiltin(spec, 1)).toEqual({ opacity: 1 });

      // Middle value should be eased (not linear)
      const mid = evalBuiltin(spec, 0.5);
      expect(mid.opacity).toBeGreaterThan(0.5); // easeOutCubic accelerates early
      expect(mid.opacity).toBeLessThan(0.9);
    });

    it('should clamp values outside 0-1', () => {
      const spec: PluginSpec = { name: 'fadeIn' };

      expect(evalBuiltin(spec, -0.5)).toEqual({ opacity: 0 });
      expect(evalBuiltin(spec, 1.5)).toEqual({ opacity: 1 });
    });
  });

  describe('fadeOut', () => {
    it('should fade from 1 to 0 linearly', () => {
      const spec: PluginSpec = { name: 'fadeOut' };

      expect(evalBuiltin(spec, 0)).toEqual({ opacity: 1 });
      expect(evalBuiltin(spec, 1)).toEqual({ opacity: 0 });
      expect(evalBuiltin(spec, 0.5)).toEqual({ opacity: 0.5 });
      expect(evalBuiltin(spec, 0.25)).toEqual({ opacity: 0.75 });
    });

    it('should clamp values outside 0-1', () => {
      const spec: PluginSpec = { name: 'fadeOut' };

      expect(evalBuiltin(spec, -0.5)).toEqual({ opacity: 1 });
      expect(evalBuiltin(spec, 1.5)).toEqual({ opacity: 0 });
    });
  });

  describe('pop', () => {
    it('should scale with backOut easing', () => {
      const spec: PluginSpec = { name: 'pop' };

      const start = evalBuiltin(spec, 0);
      expect(start.sx).toBe(1);
      expect(start.sy).toBe(1);

      const end = evalBuiltin(spec, 1);
      expect(end.sx).toBeCloseTo(1.2); // default maxScale
      expect(end.sy).toBeCloseTo(1.2);

      // Should overshoot slightly due to backOut easing
      const mid = evalBuiltin(spec, 0.8);
      expect(mid.sx).toBeGreaterThan(1.15);
      expect(mid.sy).toBeGreaterThan(1.15);
    });

    it('should respect custom maxScale parameter', () => {
      const spec: PluginSpec = {
        name: 'pop',
        params: { maxScale: 2.0 },
      };

      const end = evalBuiltin(spec, 1);
      expect(end.sx).toBeCloseTo(2.0);
      expect(end.sy).toBeCloseTo(2.0);
    });

    it('should handle non-number maxScale gracefully', () => {
      const spec: PluginSpec = {
        name: 'pop',
        params: { maxScale: 'invalid' as any },
      };

      const end = evalBuiltin(spec, 1);
      expect(end.sx).toBeCloseTo(1.2); // falls back to default
      expect(end.sy).toBeCloseTo(1.2);
    });

    it('should apply uniform scaling', () => {
      const spec: PluginSpec = { name: 'pop' };

      // sx and sy should always be equal
      for (const p of [0, 0.25, 0.5, 0.75, 1]) {
        const result = evalBuiltin(spec, p);
        expect(result.sx).toBe(result.sy);
      }
    });
  });

  describe('waveY', () => {
    it('should create sine wave motion', () => {
      const spec: PluginSpec = { name: 'waveY' };

      // At progress 0: sin(0) = 0
      expect(evalBuiltin(spec, 0)).toEqual({ ty: 0 });

      // At progress 0.25: sin(π) = 0 (for frequency=2)
      const quarter = evalBuiltin(spec, 0.25);
      expect(quarter.ty).toBeCloseTo(0, 5);

      // At progress 0.125: sin(π/2) = 1 (peak)
      const peak = evalBuiltin(spec, 0.125);
      expect(peak.ty).toBeCloseTo(8, 5); // default amplitude

      // At progress 0.375: sin(3π/2) = -1 (trough)
      const trough = evalBuiltin(spec, 0.375);
      expect(trough.ty).toBeCloseTo(-8, 5);
    });

    it('should respect custom amplitude', () => {
      const spec: PluginSpec = {
        name: 'waveY',
        params: { amplitudePx: 20 },
      };

      const peak = evalBuiltin(spec, 0.125);
      expect(peak.ty).toBeCloseTo(20, 5);
    });

    it('should respect custom frequency', () => {
      const spec: PluginSpec = {
        name: 'waveY',
        params: { frequency: 1 },
      };

      // With frequency=1, one complete cycle
      expect(evalBuiltin(spec, 0)).toEqual({ ty: 0 });

      const peak = evalBuiltin(spec, 0.25);
      expect(peak.ty).toBeCloseTo(8, 5); // sin(π/2) = 1

      const zero = evalBuiltin(spec, 0.5);
      expect(zero.ty).toBeCloseTo(0, 5); // sin(π) = 0
    });

    it('should handle non-number parameters gracefully', () => {
      const spec: PluginSpec = {
        name: 'waveY',
        params: {
          amplitudePx: 'invalid' as any,
          frequency: null as any,
        },
      };

      // Should use defaults
      const peak = evalBuiltin(spec, 0.125);
      expect(peak.ty).toBeCloseTo(8, 5); // default amplitude=8, frequency=2
    });
  });

  describe('shakeX', () => {
    it('should create horizontal shake motion', () => {
      const spec: PluginSpec = { name: 'shakeX' };

      // At progress 0: sin(0) = 0
      expect(evalBuiltin(spec, 0)).toEqual({ tx: 0 });

      // Should oscillate multiple times (default cycles=8)
      const samples = [0.0625, 0.125, 0.1875, 0.25, 0.3125];
      const values = samples.map((p) => evalBuiltin(spec, p).tx);

      // Check that we have both positive and negative values
      expect(Math.max(...values!)).toBeGreaterThan(0);
      expect(Math.min(...values!)).toBeLessThan(0);
    });

    it('should respect custom amplitude', () => {
      const spec: PluginSpec = {
        name: 'shakeX',
        params: { amplitudePx: 15 },
      };

      // Find approximate peak (with cycles=8)
      // sin(2π * 8 * 1/16) = sin(π) = 0, so use a different point
      const peak = evalBuiltin(spec, 1 / 32); // sin(π/2) = 1
      expect(Math.abs(peak.tx!)).toBeCloseTo(15, 1);
    });

    it('should respect custom cycles', () => {
      const spec: PluginSpec = {
        name: 'shakeX',
        params: { cycles: 2 },
      };

      // With 2 cycles, peaks at 0.125, 0.375, 0.625, 0.875
      const peak1 = evalBuiltin(spec, 0.125);
      expect(Math.abs(peak1.tx!)).toBeCloseTo(6, 5); // default amplitude

      const zero = evalBuiltin(spec, 0.25);
      expect(zero.tx).toBeCloseTo(0, 5);
    });

    it('should handle non-number parameters gracefully', () => {
      const spec: PluginSpec = {
        name: 'shakeX',
        params: {
          amplitudePx: undefined as any,
          cycles: 'invalid' as any,
        },
      };

      // Should use defaults
      const result = evalBuiltin(spec, 1 / 32); // sin(π/2) = 1
      expect(Math.abs(result.tx!)).toBeCloseTo(6, 1); // default amplitude=6, cycles=8
    });
  });

  describe('unknown plugin', () => {
    it('should return empty channels for unknown plugins', () => {
      const spec: PluginSpec = { name: 'unknownPlugin' };

      expect(evalBuiltin(spec, 0)).toEqual({});
      expect(evalBuiltin(spec, 0.5)).toEqual({});
      expect(evalBuiltin(spec, 1)).toEqual({});
    });
  });

  describe('parameter validation', () => {
    it('should handle missing params object', () => {
      const specs: PluginSpec[] = [
        { name: 'pop' },
        { name: 'waveY' },
        { name: 'shakeX' },
      ];

      // All should work with default values
      specs.forEach((spec) => {
        const result = evalBuiltin(spec, 0.5);
        expect(Object.keys(result).length).toBeGreaterThan(0);
      });
    });

    it('should handle empty params object', () => {
      const specs: PluginSpec[] = [
        { name: 'pop', params: {} },
        { name: 'waveY', params: {} },
        { name: 'shakeX', params: {} },
      ];

      // All should work with default values
      specs.forEach((spec) => {
        const result = evalBuiltin(spec, 0.5);
        expect(Object.keys(result).length).toBeGreaterThan(0);
      });
    });
  });
});
