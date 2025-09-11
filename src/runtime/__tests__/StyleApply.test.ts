import { describe, it, expect } from 'vitest';
import { buildTransform } from '../StyleApply';
import type { Channels } from '../../composer/PluginChainComposer';

describe('M4: StyleApply', () => {
  describe('buildTransform', () => {
    it('should return empty string for no transforms', () => {
      expect(buildTransform(undefined, {})).toBe('');
      expect(buildTransform('', {})).toBe('');
    });

    it('should preserve base transform', () => {
      const base = 'translateZ(0)';
      expect(buildTransform(base, {})).toBe('translateZ(0)');
    });

    it('should apply scale transform', () => {
      const ch: Channels = { sx: 2, sy: 3 };
      expect(buildTransform(undefined, ch)).toBe('scale(2, 3)');
    });

    it('should skip scale when values are 1', () => {
      const ch: Channels = { sx: 1, sy: 1 };
      expect(buildTransform(undefined, ch)).toBe('');
    });

    it('should apply translate transform with rounding', () => {
      const ch: Channels = { tx: 10.567, ty: -20.234 };
      expect(buildTransform(undefined, ch)).toBe(
        'translate(10.57px, -20.23px)'
      );
    });

    it('should skip translate when values are 0', () => {
      const ch: Channels = { tx: 0, ty: 0 };
      expect(buildTransform(undefined, ch)).toBe('');
    });

    it('should apply rotation transform', () => {
      const ch: Channels = { rot: 45 };
      expect(buildTransform(undefined, ch)).toBe('rotate(45deg)');
    });

    it('should skip rotation when value is 0', () => {
      const ch: Channels = { rot: 0 };
      expect(buildTransform(undefined, ch)).toBe('');
    });

    it('should combine multiple transforms in correct order', () => {
      const ch: Channels = {
        sx: 2,
        sy: 2,
        tx: 100,
        ty: 50,
        rot: 45,
      };

      const result = buildTransform(undefined, ch);
      expect(result).toBe('scale(2, 2) translate(100px, 50px) rotate(45deg)');
    });

    it('should preserve base and add new transforms', () => {
      const base = 'perspective(100px)';
      const ch: Channels = { sx: 1.5, sy: 1.5, rot: 30 };

      const result = buildTransform(base, ch);
      expect(result).toBe('perspective(100px) scale(1.5, 1.5) rotate(30deg)');
    });

    it('should handle partial channel values', () => {
      const ch1: Channels = { sx: 2 }; // sy undefined
      expect(buildTransform(undefined, ch1)).toBe('scale(2, 1)');

      const ch2: Channels = { sy: 2 }; // sx undefined
      expect(buildTransform(undefined, ch2)).toBe('scale(1, 2)');

      const ch3: Channels = { tx: 10 }; // ty undefined
      expect(buildTransform(undefined, ch3)).toBe('translate(10px, 0px)');
    });

    it('should handle edge cases in rounding', () => {
      const ch: Channels = {
        tx: 0.004, // Should round to 0
        ty: 0.005, // Should round to 0.01
      };
      expect(buildTransform(undefined, ch)).toBe('translate(0px, 0.01px)');
    });

    it('should handle negative values correctly', () => {
      const ch: Channels = {
        sx: -1,
        sy: -1,
        tx: -100.5,
        ty: -50.5,
        rot: -180,
      };

      const result = buildTransform(undefined, ch);
      expect(result).toBe(
        'scale(-1, -1) translate(-100.5px, -50.5px) rotate(-180deg)'
      );
    });
  });
});
