import { describe, it, expect } from 'vitest';
import { DefineResolver } from '../DefineResolver';
import { FieldMigration } from '../FieldMigration';
import { AssetManager } from '../../assets/AssetManager';
import type { ScenarioV2 } from '../../types/scenario-v2';

describe('v2.0 Integration Tests', () => {
  describe('DefineResolver + FieldMigration', () => {
    it('v1.3 → v2.0 마이그레이션 후 Define 참조를 해석한다', () => {
      // v1.3 기본 시나리오
      const v13Scenario = {
        version: '1.3',
        timebase: { unit: 'seconds' },
        stage: { baseAspect: '16:9' },
        tracks: [{ 
          id: 'subtitle', 
          type: 'subtitle', 
          layer: 1,
          defaultStyle: {
            color: '#ffffff',
            fontSize: 24
          }
        }],
        cues: [{
          id: 'cue1',
          track: 'subtitle',
          hintTime: 2.0,
          root: {
            id: 'text1',
            e_type: 'text',
            text: 'Hello World',
            absStart: 1.0,
            absEnd: 3.0,
            pluginChain: [
              { name: 'fadeIn', relStart: 0, relEnd: 0.5 }
            ]
          }
        }]
      };

      // 1. v1.3 → v2.0 마이그레이션
      const v20Scenario = FieldMigration.migrateV13ToV20(v13Scenario);
      
      // Define 섹션에 공통 정의 추가
      v20Scenario.define = {
        brand_color: '#ff6b35',
        fade_duration: [0, 0.8],
        common_text: 'Hello v2.0'
      };

      // 참조 사용으로 변경
      v20Scenario.tracks[0].defaultStyle!.color = 'define.brand_color';
      v20Scenario.cues[0].root.text = 'define.common_text';
      v20Scenario.cues[0].root.pluginChain![0].time_offset = 'define.fade_duration';

      // 2. Define 참조 해석
      const resolver = new DefineResolver();
      const resolved = resolver.resolveScenario(v20Scenario);

      // 검증
      expect(resolved.version).toBe('2.0');
      expect(resolved.cues[0].domLifetime).toEqual([2.0, 7.0]); // hintTime 변환됨
      expect(resolved.cues[0].root.displayTime).toEqual([1.0, 3.0]); // absStart/End 변환됨
      expect(resolved.tracks[0].defaultStyle?.color).toBe('#ff6b35'); // Define 해석됨
      expect(resolved.cues[0].root.text).toBe('Hello v2.0'); // Define 해석됨
      expect(resolved.cues[0].root.pluginChain?.[0].time_offset).toEqual([0, 0.8]); // Define 해석됨
    });

    it('복잡한 중첩 Define 참조를 올바르게 해석한다', () => {
      const scenario: ScenarioV2 = {
        version: '2.0',
        define: {
          theme: {
            colors: {
              primary: '#ff6b35',
              secondary: '#4ecdc4'
            },
            typography: {
              title: { fontSize: 32, fontWeight: 'bold' },
              body: { fontSize: 18, fontWeight: 'normal' }
            }
          },
          animations: {
            entrance: {
              name: 'fadeIn',
              time_offset: [0, 0.5]
            },
            exit: {
              name: 'fadeOut', 
              time_offset: [0.8, 1.0]
            }
          }
        },
        tracks: [{
          id: 'title',
          type: 'subtitle',
          layer: 1,
          defaultStyle: {
            color: 'define.theme.colors.primary',
            fontSize: 'define.theme.typography.title.fontSize',
            fontWeight: 'define.theme.typography.title.fontWeight'
          }
        }],
        cues: [{
          id: 'title_cue',
          track: 'title',
          root: {
            id: 'title_text',
            e_type: 'text',
            text: 'Main Title',
            pluginChain: [
              'define.animations.entrance',
              'define.animations.exit'
            ]
          }
        }]
      };

      const resolver = new DefineResolver();
      const resolved = resolver.resolveScenario(scenario);

      // 중첩 참조 해석 검증
      const track = resolved.tracks[0];
      expect(track.defaultStyle?.color).toBe('#ff6b35');
      expect(track.defaultStyle?.fontSize).toBe(32);
      expect(track.defaultStyle?.fontWeight).toBe('bold');

      const plugins = resolved.cues[0].root.pluginChain as any[];
      expect(plugins[0]).toEqual({
        name: 'fadeIn',
        time_offset: [0, 0.5]
      });
      expect(plugins[1]).toEqual({
        name: 'fadeOut',
        time_offset: [0.8, 1.0]
      });
    });
  });

  describe('전체 워크플로우', () => {
    it('실제 데모 샘플을 v2.0으로 변환한다', async () => {
      // 실제 basic.json 스타일의 v1.3 시나리오
      const basicV13 = {
        version: '1.3',
        timebase: { unit: 'seconds' },
        stage: { baseAspect: '16:9' },
        tracks: [{
          id: 'subtitle',
          type: 'subtitle',
          layer: 1,
          defaultStyle: {
            fontSize: '24px',
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            textAlign: 'center'
          }
        }],
        cues: [{
          id: 'cue1',
          track: 'subtitle',
          hintTime: 2,
          root: {
            id: 'group1',
            e_type: 'group',
            absStart: 1.0,
            absEnd: 5.0,
            layout: {
              position: { x: 0.5, y: 0.9 },
              anchor: 'bc'
            },
            children: [{
              id: 'text1',
              e_type: 'text',
              text: 'Hello Basic v2.0',
              absStart: 1.5,
              absEnd: 4.5
            }]
          }
        }]
      };

      // 1. JSON 문자열로 변환 테스트
      const v13Json = JSON.stringify(basicV13, null, 2);
      const v20Json = FieldMigration.convertSampleJson(v13Json);
      const converted = JSON.parse(v20Json);

      expect(converted.version).toBe('2.0');
      expect(converted.define).toBeDefined();

      // 2. Define 시스템 활용을 위한 개선
      converted.define = {
        subtitle_style: {
          fontSize: '24px',
          fontFamily: 'Arial, sans-serif', 
          color: '#ffffff',
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
          textAlign: 'center'
        },
        main_timing: [1.0, 5.0],
        text_timing: [1.5, 4.5]
      };

      // Track과 노드에서 Define 참조 사용
      converted.tracks[0].defaultStyle = 'define.subtitle_style';
      converted.cues[0].root.displayTime = 'define.main_timing';
      converted.cues[0].root.children[0].displayTime = 'define.text_timing';

      // 3. Define 참조 해석
      const resolver = new DefineResolver();
      const final = resolver.resolveScenario(converted as ScenarioV2);

      // 검증
      expect(final.tracks[0].defaultStyle).toEqual({
        fontSize: '24px',
        fontFamily: 'Arial, sans-serif', 
        color: '#ffffff',
        textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
        textAlign: 'center'
      });
      expect(final.cues[0].root.displayTime).toEqual([1.0, 5.0]);
      expect(final.cues[0].root.children?.[0].displayTime).toEqual([1.5, 4.5]);

      // 4. AssetManager 테스트 (에셋이 있다면)
      const assetManager = new AssetManager();
      await assetManager.loadAssetsFromDefines(final.define || {});
      expect(assetManager.getLoadStats().total).toBe(0); // 에셋 없음

      assetManager.dispose();
    });

    it('에셋이 포함된 시나리오를 처리한다', async () => {
      const scenarioWithAssets: ScenarioV2 = {
        version: '2.0',
        define: {
          custom_font: {
            type: 'font',
            url: 'fonts/custom.woff2'
          },
          background_image: {
            type: 'image', 
            url: 'https://example.com/bg.jpg'
          },
          shared_style: {
            fontFamily: 'custom_font', // 에셋 키를 직접 참조
            color: '#333333'
          }
        },
        tracks: [{
          id: 'custom',
          type: 'free',
          layer: 1,
          defaultStyle: 'define.shared_style'
        }],
        cues: [{
          id: 'custom_cue',
          track: 'custom',
          root: {
            id: 'custom_text',
            e_type: 'text',
            text: 'Custom Font Text',
            displayTime: [2.0, 6.0]
          }
        }]
      };

      // Define 참조 해석
      const resolver = new DefineResolver();
      const resolved = resolver.resolveScenario(scenarioWithAssets);

      // 검증 - Define 참조 해석이 올바르게 되었는지 확인
      expect(resolved.tracks[0].defaultStyle).toEqual({
        fontFamily: 'custom_font', // 폰트 키로 해석됨
        color: '#333333'
      });

      // AssetManager에서 에셋 정의 추출 테스트
      const assetManager = new AssetManager('http://localhost:3000/');
      
      // 에셋 로드 시도 (Node.js 환경에서는 에러가 발생하지만 무시됨)
      try {
        await assetManager.loadAssetsFromDefines(resolved.define || {});
      } catch (error) {
        // Node.js 환경에서의 에러는 무시
        console.warn('Asset loading failed in test environment (expected)');
      }

      // 에셋 정의가 있는지만 확인
      expect(resolved.define?.custom_font).toEqual({
        type: 'font',
        url: 'fonts/custom.woff2'
      });
      expect(resolved.define?.background_image).toEqual({
        type: 'image',
        url: 'https://example.com/bg.jpg'
      });

      assetManager.dispose();
    });
  });

  describe('에러 처리 통합 테스트', () => {
    it('마이그레이션 + Define 해석에서 발생하는 에러를 처리한다', () => {
      const invalidV13 = {
        version: '1.3',
        tracks: [],
        cues: [{
          id: 'invalid_cue',
          track: 'subtitle',
          root: {
            // id 누락으로 마이그레이션 실패
            e_type: 'text',
            text: 'Invalid'
          }
        }]
      };

      expect(() => {
        FieldMigration.convertSampleJson(JSON.stringify(invalidV13));
      }).toThrow('Migration failed');
    });

    it('Define 참조에서 순환 참조 에러를 처리한다', () => {
      const circularScenario: ScenarioV2 = {
        version: '2.0',
        define: {
          a: 'define.b',
          b: 'define.c', 
          c: 'define.a' // 순환 참조
        },
        tracks: [],
        cues: [{
          id: 'test',
          track: 'test',
          root: {
            id: 'test_node',
            e_type: 'text',
            text: 'define.a' // 순환 참조 사용
          }
        }]
      };

      const resolver = new DefineResolver();
      expect(() => resolver.resolveScenario(circularScenario))
        .toThrow(/Circular reference detected/);
    });
  });

  describe('성능 검증', () => {
    it('대용량 Define 섹션도 빠르게 처리한다', () => {
      // 100개 define 키가 있는 시나리오
      const defines: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        defines[`key_${i}`] = {
          value: i,
          text: `Text ${i}`,
          style: { color: `#${i.toString(16).padStart(6, '0')}` }
        };
      }

      const scenario: ScenarioV2 = {
        version: '2.0',
        define: defines,
        tracks: [],
        cues: [{
          id: 'perf_test',
          track: 'test',
          root: {
            id: 'perf_node',
            e_type: 'text',
            text: 'define.key_50.text' // 중간 키의 text 속성 참조
          }
        }]
      };

      const startTime = performance.now();
      const resolver = new DefineResolver();
      const resolved = resolver.resolveScenario(scenario);
      const endTime = performance.now();

      // 100ms 이내로 완료되어야 함
      expect(endTime - startTime).toBeLessThan(100);
      expect(resolved.cues[0].root.text).toBe('Text 50');
    });
  });
});