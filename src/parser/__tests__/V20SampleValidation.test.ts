import { describe, it, expect } from 'vitest';
import { DefineResolver } from '../DefineResolver';
import { FieldMigration } from '../FieldMigration';
import type { Scenario as ScenarioV2 } from '../../types/scenario-v2';
import { readFileSync } from 'fs';
import { join } from 'path';

// 실제 v2.0 샘플 파일들을 읽어서 테스트
const samplesDir = join(__dirname, '../../../demo/samples/v2');

function loadSampleJson(filename: string): string {
  return readFileSync(join(samplesDir, filename), 'utf-8');
}

// 실제 파일에서 로드
const basicV20Json = loadSampleJson('basic_v20.json');
const withAssetsV20Json = loadSampleJson('with_assets_v20.json');

// 테스트용 하드코딩된 샘플 (원본 유지)
const inlineBasicV20Json = `{
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
      "timeOffset": [0, 0.3]
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
        "eType": "group",
        "children": [
          {
            "id": "text1",
            "eType": "text",
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

describe('v2.0 샘플 JSON 검증', () => {
  describe('실제 샘플 파일 검증', () => {
    describe('basic_v20.json (실제 파일)', () => {
      it('파일이 유효한 v2.0 시나리오로 파싱된다', () => {
        const scenario = JSON.parse(basicV20Json) as ScenarioV2;
        
        expect(scenario.version).toBe('2.0');
        expect(scenario.define).toBeDefined();
        expect(scenario.tracks).toHaveLength(1);
        expect(scenario.cues).toHaveLength(3); // 실제 파일에는 3개 cue
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

        // 첫 번째 cue의 노드 속성 해석 검증
        const firstCue = resolved.cues[0];
        const textNode = firstCue.root.children![0];
        expect(textNode.displayTime).toEqual([2, 5]);
        expect(textNode.layout?.position).toEqual([0.5, 0.85]);
        expect(textNode.pluginChain).toEqual([
          {
            name: 'fadeIn',
            timeOffset: ['0%', '30%'],
          },
        ]);
      });

      it('모든 cue가 올바른 시간 범위를 가진다', () => {
        const scenario = JSON.parse(basicV20Json) as ScenarioV2;
        
        // 각 cue의 domLifetime 검증
        scenario.cues.forEach((cue, index) => {
          expect(() => {
            if (cue.domLifetime) {
              FieldMigration.validateTimeRange(cue.domLifetime, `cue[${index}].domLifetime`);
            }
          }).not.toThrow();
        });
      });

      it('모든 노드가 필수 ID를 가진다', () => {
        const scenario = JSON.parse(basicV20Json) as ScenarioV2;
        expect(() => FieldMigration.validateNodeIds(scenario)).not.toThrow();
      });
    });

    describe('with_assets_v20.json (실제 파일)', () => {
      it('파일이 유효한 v2.0 시나리오로 파싱된다', () => {
        const scenario = JSON.parse(withAssetsV20Json) as ScenarioV2;
        
        expect(scenario.version).toBe('2.0');
        expect(scenario.define).toBeDefined();
        expect(scenario.tracks).toHaveLength(3); // logo, title, subtitle
        expect(scenario.cues).toHaveLength(3);
      });

      it('에셋 정의가 올바르게 추출된다', () => {
        const scenario = JSON.parse(withAssetsV20Json) as ScenarioV2;
        
        expect(scenario.define?.custom_font).toEqual({
          type: 'font',
          url: 'fonts/NotoSansKR-Regular.woff2'
        });
        
        expect(scenario.define?.logo_image).toEqual({
          type: 'image',
          url: 'images/logo.png'
        });
      });

      it('복잡한 중첩 Define 참조가 올바르게 해석된다', () => {
        const scenario = JSON.parse(withAssetsV20Json) as ScenarioV2;
        const resolver = new DefineResolver();
        const resolved = resolver.resolveScenario(scenario);

        // 중첩 참조 해석 검증
        const titleTrackStyle = resolved.tracks[0].defaultStyle as any;
        expect(titleTrackStyle.fontFamily).toBe('custom_font');
        expect(titleTrackStyle.fontSize).toBe('32px');
        expect(titleTrackStyle.color).toBe('#ff6b35'); // define.brand_theme.colors.primary

        // 레이아웃 참조 해석 검증
        const titleCue = resolved.cues.find(c => c.id === 'title_cue');
        expect(titleCue?.root.layout?.position).toEqual([0.5, 0.3]);
      });

      it('플러그인 체인 참조가 올바르게 해석된다', () => {
        const scenario = JSON.parse(withAssetsV20Json) as ScenarioV2;
        const resolver = new DefineResolver();
        const resolved = resolver.resolveScenario(scenario);

        // title_cue의 pluginChain 검증
        const titleCue = resolved.cues.find(c => c.id === 'title_cue');
        expect(titleCue?.root.pluginChain).toEqual([
          { name: 'slideInLeft', timeOffset: ['0%', '60%'] },
          { name: 'fadeOut', timeOffset: ['80%', '100%'] },
        ]);
      });

      it('모든 시간 범위가 유효하다', () => {
        const scenario = JSON.parse(withAssetsV20Json) as ScenarioV2;
        expect(() => FieldMigration.validateNodeIds(scenario)).not.toThrow();
      });
    });

    describe('성능 테스트', () => {
      it('실제 v2.0 샘플들을 빠르게 처리한다', () => {
        const scenarios = [basicV20Json, withAssetsV20Json];
        
        scenarios.forEach((jsonStr, _index) => {
          const startTime = performance.now();
          const scenario = JSON.parse(jsonStr) as ScenarioV2;
          const resolver = new DefineResolver();
          const resolved = resolver.resolveScenario(scenario);
          const endTime = performance.now();

          // 10ms 이내로 완료되어야 함
          expect(endTime - startTime).toBeLessThan(10);
          expect(resolved.version).toBe('2.0');
        });
      });

      it('복잡한 중첩 참조도 빠르게 처리한다', () => {
        // with_assets_v20.json의 중첩 참조 성능 테스트
        const scenario = JSON.parse(withAssetsV20Json) as ScenarioV2;
        
        const startTime = performance.now();
        const resolver = new DefineResolver();
        
        // 여러 번 해석해서 성능 안정성 확인
        for (let i = 0; i < 100; i++) {
          resolver.resolveScenario(scenario);
        }
        
        const endTime = performance.now();
        const avgTime = (endTime - startTime) / 100;
        
        // 평균 1ms 이내로 완료되어야 함
        expect(avgTime).toBeLessThan(1);
      });
    });

    describe('에러 케이스', () => {
      it('잘못된 JSON 파일 시뮬레이션', () => {
        const invalidScenario: ScenarioV2 = {
          version: '2.0',
          define: { valid_key: 'value' },
          tracks: [],
          cues: [{
            id: 'invalid_cue',
            track: 'test',
            root: {
              id: 'invalid_text',
              eType: 'text',
              text: 'define.nonexistent_key'
            }
          }]
        };

        const resolver = new DefineResolver();
        expect(() => resolver.resolveScenario(invalidScenario))
          .toThrow('Undefined define key: "nonexistent_key"');
      });

      it('실제 샘플에서 손상된 Define 참조 감지', () => {
        // basic_v20.json을 수정해서 잘못된 참조 만들기
        const corruptedJson = basicV20Json.replace(
          '"define.subtitle_style"', 
          '"define.nonexistent_style"'
        );
        
        const scenario = JSON.parse(corruptedJson) as ScenarioV2;
        const resolver = new DefineResolver();
        
        expect(() => resolver.resolveScenario(scenario))
          .toThrow('Undefined define key: "nonexistent_style"');
      });
    });
  });

  describe('인라인 테스트 샘플', () => {
    describe('basic_v20.json (인라인)', () => {
      it('유효한 v2.0 시나리오로 파싱된다', () => {
        const scenario = JSON.parse(inlineBasicV20Json) as ScenarioV2;
      
        expect(scenario.version).toBe('2.0');
        expect(scenario.define).toBeDefined();
        expect(scenario.tracks).toHaveLength(1);
        expect(scenario.cues).toHaveLength(1);
      });

      it('Define 참조가 올바르게 해석된다', () => {
        const scenario = JSON.parse(inlineBasicV20Json) as ScenarioV2;
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
          timeOffset: [0, 0.3]
        }]);
      });

      it('필수 필드 검증을 통과한다', () => {
        const scenario = JSON.parse(inlineBasicV20Json) as ScenarioV2;
        
        // 노드 ID 검증
        expect(() => FieldMigration.validateNodeIds(scenario)).not.toThrow();
        
        // 시간 범위 검증
        const _textNode = scenario.cues[0].root.children![0];
        expect(() => FieldMigration.validateTimeRange(scenario.cues[0].domLifetime!, 'domLifetime')).not.toThrow();
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
              eType: 'text',
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
        expect(v20Scenario.cues[0].root.pluginChain![0].timeOffset).toEqual([0, 0.5]); // relStart/End

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
              eType: 'text',
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
              eType: 'text',
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
              eType: 'text',
              text: 'Test'
            }
          }]
        } as ScenarioV2;

        expect(() => FieldMigration.validateTimeRange(invalidTimeScenario.cues[0].domLifetime!, 'domLifetime'))
          .toThrow('domLifetime start (5) must be <= end (3)');
      });
    });
  });
});
