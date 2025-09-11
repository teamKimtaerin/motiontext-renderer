import { describe, it, expect } from 'vitest';
import { DefineResolver } from '../DefineResolver';
import { FieldMigration } from '../FieldMigration';
import type { ScenarioV2 } from '../../types/scenario-v2';

// 생성한 v2.0 샘플 JSON들
const basicV20Json = `{
  "version": "2.0",
  "timebase": { "unit": "seconds" },
  "stage": { "baseAspect": "16:9" },
  "define": {
    "subtitle_style": {
      "fontSize": "24px",
      "fontFamily": "Arial, sans-serif",
      "color": "#ffffff",
      "textShadow": "2px 2px 4px rgba(0,0,0,0.8)",
      "stroke": { "widthRel": 0.002, "color": "#000000" },
      "textAlign": "center"
    },
    "subtitle_position": [0.5, 0.85],
    "cue1_timing": [2, 5],
    "fade_in": {
      "name": "fadeIn",
      "time_offset": [0, 0.3]
    }
  },
  "tracks": [
    {
      "id": "subtitle",
      "type": "subtitle",
      "layer": 1,
      "defaultStyle": "define.subtitle_style"
    }
  ],
  "cues": [
    {
      "id": "cue1",
      "track": "subtitle",
      "domLifetime": [1.8, 5.5],
      "root": {
        "id": "group1",
        "e_type": "group",
        "children": [
          {
            "id": "text1",
            "e_type": "text",
            "text": "안녕하세요! MotionText Renderer v2.0입니다.",
            "displayTime": "define.cue1_timing",
            "layout": {
              "position": "define.subtitle_position"
            },
            "pluginChain": ["define.fade_in"]
          }
        ]
      }
    }
  ]
}`;

const withAssetsV20Json = `{
  "version": "2.0",
  "timebase": { "unit": "seconds" },
  "stage": { "baseAspect": "16:9" },
  "define": {
    "custom_font": {
      "type": "font",
      "url": "fonts/NotoSansKR-Regular.woff2"
    },
    "brand_colors": {
      "primary": "#ff6b35",
      "text": "#333333"
    },
    "brand_theme": {
      "typography": {
        "title": {
          "fontFamily": "custom_font",
          "fontSize": "32px",
          "color": "define.brand_colors.primary"
        }
      }
    },
    "layout": {
      "title_position": [0.5, 0.3]
    }
  },
  "tracks": [
    {
      "id": "title",
      "type": "free",
      "layer": 2,
      "defaultStyle": "define.brand_theme.typography.title"
    }
  ],
  "cues": [
    {
      "id": "title_cue",
      "track": "title", 
      "domLifetime": [1, 8],
      "root": {
        "id": "title_text",
        "e_type": "text",
        "text": "MotionText v2.0",
        "displayTime": [2, 7],
        "layout": {
          "position": "define.layout.title_position",
          "anchor": "cc"
        }
      }
    }
  ]
}`;

describe('v2.0 샘플 JSON 검증', () => {
  describe('basic_v20.json', () => {
    it('유효한 v2.0 시나리오로 파싱된다', () => {
      const scenario = JSON.parse(basicV20Json) as ScenarioV2;
      
      expect(scenario.version).toBe('2.0');
      expect(scenario.define).toBeDefined();
      expect(scenario.tracks).toHaveLength(1);
      expect(scenario.cues).toHaveLength(1);
    });

    it('Define 참조가 올바르게 해석된다', () => {
      const scenario = JSON.parse(basicV20Json) as ScenarioV2;
      const resolver = new DefineResolver();
      const resolved = resolver.resolveScenario(scenario);

      // Track defaultStyle 해석 검증
      expect(resolved.tracks[0].defaultStyle).toEqual({
        fontSize: "24px",
        fontFamily: "Arial, sans-serif",
        color: "#ffffff",
        textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
        stroke: { widthRel: 0.002, color: "#000000" },
        textAlign: "center"
      });

      // 노드 속성 해석 검증
      const textNode = resolved.cues[0].root.children![0];
      expect(textNode.displayTime).toEqual([2, 5]);
      expect(textNode.layout?.position).toEqual([0.5, 0.85]);
      expect(textNode.pluginChain).toEqual([{
        name: "fadeIn",
        time_offset: [0, 0.3]
      }]);
    });

    it('필수 필드 검증을 통과한다', () => {
      const scenario = JSON.parse(basicV20Json) as ScenarioV2;
      
      // 노드 ID 검증
      expect(() => FieldMigration.validateNodeIds(scenario)).not.toThrow();
      
      // 시간 범위 검증
      const textNode = scenario.cues[0].root.children![0];
      expect(() => FieldMigration.validateTimeRange(scenario.cues[0].domLifetime!, 'domLifetime')).not.toThrow();
    });
  });

  describe('with_assets_v20.json', () => {
    it('유효한 v2.0 시나리오로 파싱된다', () => {
      const scenario = JSON.parse(withAssetsV20Json) as ScenarioV2;
      
      expect(scenario.version).toBe('2.0');
      expect(scenario.define).toBeDefined();
      expect(scenario.define?.custom_font).toEqual({
        type: 'font',
        url: 'fonts/NotoSansKR-Regular.woff2'
      });
    });

    it('중첩된 Define 참조가 올바르게 해석된다', () => {
      const scenario = JSON.parse(withAssetsV20Json) as ScenarioV2;
      const resolver = new DefineResolver();
      const resolved = resolver.resolveScenario(scenario);

      // 중첩 참조 해석 검증
      const trackStyle = resolved.tracks[0].defaultStyle as any;
      expect(trackStyle.fontFamily).toBe('custom_font');
      expect(trackStyle.fontSize).toBe('32px');
      expect(trackStyle.color).toBe('#ff6b35'); // define.brand_theme.colors.primary

      // 레이아웃 참조 해석 검증
      const textNode = resolved.cues[0].root;
      expect(textNode.layout?.position).toEqual([0.5, 0.3]);
    });

    it('에셋 정의가 올바르게 추출된다', () => {
      const scenario = JSON.parse(withAssetsV20Json) as ScenarioV2;
      
      expect(scenario.define?.custom_font).toEqual({
        type: 'font',
        url: 'fonts/NotoSansKR-Regular.woff2'
      });
    });
  });

  describe('마이그레이션 호환성', () => {
    it('v1.3 샘플을 v2.0으로 변환 후 해석할 수 있다', () => {
      // 간단한 v1.3 샘플
      const v13Sample = {
        version: '1.3',
        timebase: { unit: 'seconds' },
        stage: { baseAspect: '16:9' },
        tracks: [{ id: 'subtitle', type: 'subtitle', layer: 1 }],
        cues: [{
          id: 'test_cue',
          track: 'subtitle',
          hintTime: 3,
          root: {
            id: 'test_text',
            e_type: 'text',
            text: 'Test',
            absStart: 2,
            absEnd: 5,
            pluginChain: [
              { name: 'fadeIn', relStart: 0, relEnd: 0.5 }
            ]
          }
        }]
      };

      // 마이그레이션
      const v20Scenario = FieldMigration.migrateV13ToV20(v13Sample);
      
      // 검증
      expect(v20Scenario.version).toBe('2.0');
      expect(v20Scenario.cues[0].domLifetime).toEqual([3, 8]); // hintTime + 5초
      expect(v20Scenario.cues[0].root.displayTime).toEqual([2, 5]); // absStart/End
      expect(v20Scenario.cues[0].root.pluginChain![0].time_offset).toEqual([0, 0.5]); // relStart/End

      // Define 참조 해석 테스트 (빈 define이지만 정상 동작)
      const resolver = new DefineResolver();
      const resolved = resolver.resolveScenario(v20Scenario);
      
      expect(resolved.cues[0].root.text).toBe('Test');
    });
  });

  describe('성능 테스트', () => {
    it('복잡한 v2.0 시나리오도 빠르게 처리한다', () => {
      // 복잡한 define 구조 생성
      const complexDefines: Record<string, any> = {
        base_style: { color: '#ffffff', fontSize: '16px' }
      };

      // 20개 레벨의 중첩 참조 생성
      for (let i = 1; i <= 20; i++) {
        complexDefines[`level_${i}`] = {
          value: i,
          text: `Level ${i}`,
          style: i === 1 ? 'define.base_style' : `define.level_${i-1}.style`
        };
      }

      const complexScenario: ScenarioV2 = {
        version: '2.0',
        define: complexDefines,
        tracks: [{ id: 'test', type: 'subtitle', layer: 1 }],
        cues: [{
          id: 'complex_cue',
          track: 'test',
          root: {
            id: 'complex_text',
            e_type: 'text',
            text: 'define.level_20.text' // 깊은 중첩 참조
          }
        }]
      };

      const startTime = performance.now();
      const resolver = new DefineResolver();
      const resolved = resolver.resolveScenario(complexScenario);
      const endTime = performance.now();

      // 50ms 이내로 완료되어야 함
      expect(endTime - startTime).toBeLessThan(50);
      expect(resolved.cues[0].root.text).toBe('Level 20');
    });
  });

  describe('에러 케이스', () => {
    it('잘못된 Define 참조 시 명확한 에러를 발생시킨다', () => {
      const invalidScenario: ScenarioV2 = {
        version: '2.0',
        define: { valid_key: 'value' },
        tracks: [],
        cues: [{
          id: 'invalid_cue',
          track: 'test',
          root: {
            id: 'invalid_text',
            e_type: 'text',
            text: 'define.nonexistent_key'
          }
        }]
      };

      const resolver = new DefineResolver();
      expect(() => resolver.resolveScenario(invalidScenario))
        .toThrow('Undefined define key: "nonexistent_key"');
    });

    it('잘못된 시간 배열 형식을 검출한다', () => {
      const invalidTimeScenario = {
        version: '2.0',
        tracks: [],
        cues: [{
          id: 'invalid_time',
          track: 'test',
          domLifetime: [5, 3], // start > end (잘못됨)
          root: {
            id: 'test_node',
            e_type: 'text',
            text: 'Test'
          }
        }]
      } as ScenarioV2;

      expect(() => FieldMigration.validateTimeRange(invalidTimeScenario.cues[0].domLifetime!, 'domLifetime'))
        .toThrow('domLifetime start (5) must be <= end (3)');
    });
  });
});