import { describe, it, expect } from 'vitest';
import { anchorTranslate, anchorFraction } from '../anchors';
import type { Anchor } from '../../../types/layout';

describe('M5.6: Anchor utilities', () => {
  describe('anchorTranslate', () => {
    it('should return correct translate percentages for all 9 anchor points', () => {
      const testCases: [Anchor, { tx: number; ty: number }][] = [
        // Top row
        ['tl', { tx: 0, ty: 0 }], // top-left: no translation needed
        ['tc', { tx: -50, ty: 0 }], // top-center: move left by 50%
        ['tr', { tx: -100, ty: 0 }], // top-right: move left by 100%

        // Middle row
        ['cl', { tx: 0, ty: -50 }], // center-left: move up by 50%
        ['cc', { tx: -50, ty: -50 }], // center-center: move up-left by 50%
        ['cr', { tx: -100, ty: -50 }], // center-right: move up by 50%, left by 100%

        // Bottom row
        ['bl', { tx: 0, ty: -100 }], // bottom-left: move up by 100%
        ['bc', { tx: -50, ty: -100 }], // bottom-center: move up by 100%, left by 50%
        ['br', { tx: -100, ty: -100 }], // bottom-right: move up-left by 100%
      ];

      testCases.forEach(([anchor, expected]) => {
        const result = anchorTranslate(anchor);
        expect(result).toEqual(expected);
      });
    });
  });

  describe('anchorFraction', () => {
    it('should return correct fraction coordinates for all 9 anchor points', () => {
      const testCases: [Anchor, { ax: number; ay: number }][] = [
        // Top row (ay = 0)
        ['tl', { ax: 0, ay: 0 }], // top-left: 0,0
        ['tc', { ax: 0.5, ay: 0 }], // top-center: 0.5,0
        ['tr', { ax: 1, ay: 0 }], // top-right: 1,0

        // Middle row (ay = 0.5)
        ['cl', { ax: 0, ay: 0.5 }], // center-left: 0,0.5
        ['cc', { ax: 0.5, ay: 0.5 }], // center-center: 0.5,0.5
        ['cr', { ax: 1, ay: 0.5 }], // center-right: 1,0.5

        // Bottom row (ay = 1)
        ['bl', { ax: 0, ay: 1 }], // bottom-left: 0,1
        ['bc', { ax: 0.5, ay: 1 }], // bottom-center: 0.5,1
        ['br', { ax: 1, ay: 1 }], // bottom-right: 1,1
      ];

      testCases.forEach(([anchor, expected]) => {
        const result = anchorFraction(anchor);
        expect(result).toEqual(expected);
      });
    });
  });

  describe('consistency between anchorTranslate and anchorFraction', () => {
    it('should maintain consistent relationship: translate = -fraction * 100', () => {
      const anchors: Anchor[] = [
        'tl',
        'tc',
        'tr',
        'cl',
        'cc',
        'cr',
        'bl',
        'bc',
        'br',
      ];

      anchors.forEach((anchor) => {
        const translate = anchorTranslate(anchor);
        const fraction = anchorFraction(anchor);

        // The relationship: translate percentage = -fraction * 100
        // Handle +0/-0 difference by using Math.sign consistency check
        const expectedTx = -fraction.ax * 100;
        const expectedTy = -fraction.ay * 100;
        expect(
          translate.tx === expectedTx ||
            (translate.tx === 0 && expectedTx === 0)
        ).toBe(true);
        expect(
          translate.ty === expectedTy ||
            (translate.ty === 0 && expectedTy === 0)
        ).toBe(true);
      });
    });
  });

  describe('boundary values', () => {
    it('should handle edge anchor points correctly', () => {
      // Test corner anchors (boundary values)
      expect(anchorFraction('tl')).toEqual({ ax: 0, ay: 0 }); // min values
      expect(anchorFraction('br')).toEqual({ ax: 1, ay: 1 }); // max values

      expect(anchorTranslate('tl')).toEqual({ tx: 0, ty: 0 }); // no translation
      expect(anchorTranslate('br')).toEqual({ tx: -100, ty: -100 }); // max translation
    });

    it('should handle center values correctly', () => {
      // Test center points (0.5 fractions)
      expect(anchorFraction('tc')).toEqual({ ax: 0.5, ay: 0 });
      expect(anchorFraction('cl')).toEqual({ ax: 0, ay: 0.5 });
      expect(anchorFraction('cc')).toEqual({ ax: 0.5, ay: 0.5 });

      expect(anchorTranslate('tc')).toEqual({ tx: -50, ty: 0 });
      expect(anchorTranslate('cl')).toEqual({ tx: 0, ty: -50 });
      expect(anchorTranslate('cc')).toEqual({ tx: -50, ty: -50 });
    });
  });
});
