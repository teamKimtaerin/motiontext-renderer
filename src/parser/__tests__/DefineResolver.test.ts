import { describe, it, expect } from 'vitest';
import { DefineResolver } from '../DefineResolver';
import type { Scenario as ScenarioV2, DefineSection } from '../../types/scenario-v2';

describe('DefineResolver', () => {
  describe('기본 동작', () => {
    it('Define 섹션이 없으면 시나리오를 그대로 반환한다', () => {
      const resolver = new DefineResolver();
      const scenario: ScenarioV2 = {
        version: '2.0',
        tracks: [],
        cues: []
      };

      const result = resolver.resolveScenario(scenario);
      expect(result).toEqual(scenario);
    });

    it('Define 참조가 없으면 시나리오를 그대로 반환한다', () => {
      const defines: DefineSection = {
        color: '#ff0000'
      };
      const resolver = new DefineResolver(defines);
      const scenario: ScenarioV2 = {
        version: '2.0',
        define: defines,
        tracks: [],
        cues: []
      };

      const result = resolver.resolveScenario(scenario);
      expect(result).toEqual(scenario);
    });

    it('간단한 Define 참조를 해석한다', () => {
      const defines: DefineSection = {
        brand_color: '#ff0000',
        font_size: 24
      };
      const resolver = new DefineResolver(defines);
      const scenario: ScenarioV2 = {
        version: '2.0',
        define: defines,
        tracks: [{
          id: 'subtitle',
          type: 'subtitle',
          layer: 1,
          defaultStyle: {
            color: 'define.brand_color',
            fontSize: 'define.font_size'
          }
        }],
        cues: []
      };

      const result = resolver.resolveScenario(scenario);
      expect(result.tracks[0].defaultStyle).toEqual({
        color: '#ff0000',
        fontSize: 24
      });
    });

    it('중첩된 Define 참조를 해석한다', () => {
      const defines: DefineSection = {
        theme: {
          colors: {
            primary: '#ff0000',
            secondary: '#00ff00'
          },
          sizes: {
            large: 24,
            medium: 18
          }
        }
      };
      const resolver = new DefineResolver(defines);
      const scenario: ScenarioV2 = {
        version: '2.0',
        define: defines,
        tracks: [{
          id: 'subtitle',
          type: 'subtitle',
          layer: 1,
          defaultStyle: {
            color: 'define.theme.colors.primary',
            fontSize: 'define.theme.sizes.large'
          }
        }],
        cues: []
      };

      const result = resolver.resolveScenario(scenario);
      expect(result.tracks[0].defaultStyle).toEqual({
        color: '#ff0000',
        fontSize: 24
      });
    });

    it('배열 내의 Define 참조를 해석한다', () => {
      const defines: DefineSection = {
        fade_effect: {
          name: 'fadeIn',
          time_offset: [0, 0.5]
        }
      };
      const resolver = new DefineResolver(defines);
      const scenario: ScenarioV2 = {
        version: '2.0',
        define: defines,
        tracks: [],
        cues: [{
          id: 'cue1',
          track: 'subtitle',
          root: {
            id: 'text1',
            e_type: 'text',
            text: 'Hello',
            pluginChain: ['define.fade_effect']
          }
        }]
      };

      const result = resolver.resolveScenario(scenario);
      expect(result.cues[0].root.pluginChain).toEqual([{
        name: 'fadeIn',
        time_offset: [0, 0.5]
      }]);
    });
  });

  describe('에러 처리', () => {
    it('존재하지 않는 Define 키 참조 시 에러를 발생시킨다', () => {
      const resolver = new DefineResolver({});
      const scenario: ScenarioV2 = {
        version: '2.0',
        define: {}, // 빈 define 섹션 명시
        tracks: [{
          id: 'subtitle',
          type: 'subtitle',
          layer: 1,
          defaultStyle: {
            color: 'define.nonexistent'
          }
        }],
        cues: []
      };

      expect(() => resolver.resolveScenario(scenario)).toThrow(
        'Undefined define key: "nonexistent" referenced at tracks[0].defaultStyle.color'
      );
    });

    it('잘못된 Define 참조 형식 시 에러를 발생시킨다', () => {
      const resolver = new DefineResolver({});
      const scenario: ScenarioV2 = {
        version: '2.0',
        define: {}, // 빈 define 섹션 명시
        tracks: [{
          id: 'subtitle',
          type: 'subtitle',
          layer: 1,
          defaultStyle: {
            color: 'define.'
          }
        }],
        cues: []
      };

      expect(() => resolver.resolveScenario(scenario)).toThrow(
        'Invalid define reference: "define." at tracks[0].defaultStyle.color'
      );
    });

    it('존재하지 않는 중첩 경로 참조 시 에러를 발생시킨다', () => {
      const defines: DefineSection = {
        theme: {
          colors: {
            primary: '#ff0000'
          }
        }
      };
      const resolver = new DefineResolver(defines);
      const scenario: ScenarioV2 = {
        version: '2.0',
        define: defines,
        tracks: [{
          id: 'subtitle',
          type: 'subtitle',
          layer: 1,
          defaultStyle: {
            color: 'define.theme.colors.nonexistent'
          }
        }],
        cues: []
      };

      expect(() => resolver.resolveScenario(scenario)).toThrow(
        'Property "nonexistent" not found in define'
      );
    });
  });

  describe('순환 참조 검출', () => {
    it('직접 순환 참조를 검출한다', () => {
      const defines: DefineSection = {
        a: 'define.a'
      };
      const resolver = new DefineResolver(defines);
      const scenario: ScenarioV2 = {
        version: '2.0',
        define: defines,
        tracks: [{
          id: 'subtitle',
          type: 'subtitle',
          layer: 1,
          defaultStyle: {
            color: 'define.a'
          }
        }],
        cues: []
      };

      expect(() => resolver.resolveScenario(scenario)).toThrow(
        'Circular reference detected in define: define.a -> define.a'
      );
    });

    it('간접 순환 참조를 검출한다', () => {
      const defines: DefineSection = {
        a: 'define.b',
        b: 'define.c',
        c: 'define.a'
      };
      const resolver = new DefineResolver(defines);
      const scenario: ScenarioV2 = {
        version: '2.0',
        define: defines,
        tracks: [{
          id: 'subtitle',
          type: 'subtitle',
          layer: 1,
          defaultStyle: {
            color: 'define.a'
          }
        }],
        cues: []
      };

      expect(() => resolver.resolveScenario(scenario)).toThrow(
        /Circular reference detected in define:/
      );
    });
  });

  describe('유틸리티 메서드', () => {
    it('사용 가능한 키 목록을 반환한다', () => {
      const defines: DefineSection = {
        color: '#ff0000',
        size: 24,
        style: { color: '#00ff00' }
      };
      const resolver = new DefineResolver(defines);
      
      const keys = resolver.getAvailableKeys();
      expect(keys).toEqual(['color', 'size', 'style']);
    });

    it('키의 타입을 반환한다', () => {
      const defines: DefineSection = {
        color: '#ff0000',
        size: 24,
        style: { color: '#00ff00' },
        effects: ['fadeIn', 'fadeOut']
      };
      const resolver = new DefineResolver(defines);
      
      expect(resolver.getKeyType('color')).toBe('string');
      expect(resolver.getKeyType('size')).toBe('number');
      expect(resolver.getKeyType('style')).toBe('object');
      expect(resolver.getKeyType('effects')).toBe('array');
      expect(resolver.getKeyType('nonexistent')).toBe(null);
    });
  });
});
