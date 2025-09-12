import { describe, it, expect, beforeEach } from 'vitest';
import { CompatibilityLayer } from '../CompatibilityLayer';

describe('CompatibilityLayer', () => {
  let layer: CompatibilityLayer;

  beforeEach(() => {
    layer = new CompatibilityLayer();
  });

  describe('버전 감지', () => {
    it('v2.0 시나리오를 올바르게 감지', () => {
      const v20Scenario = {
        version: '2.0',
        define: {},
        timebase: { unit: 'seconds' },
        stage: { baseAspect: '16:9' },
        tracks: [],
        cues: [{
          id: 'test-cue',
          track: 'subtitle',
          root: {
            id: 'root',
            type: 'text',
            displayTime: [1, 5], // v2.0 시간 배열 형식
            content: 'Test'
          },
          domLifetime: [1, 6] // v2.0 필드
        }]
      };

      const result = layer.process(v20Scenario);
      
      expect(result.originalVersion).toBe('2.0');
      expect(result.wasMigrated).toBe(false);
      expect(result.scenario.version).toBe('2.0');
    });

    it('v1.3 시나리오를 올바르게 감지', () => {
      const v13Scenario = {
        version: '1.3',
        timebase: { unit: 'seconds' },
        stage: { baseAspect: '16:9' },
        tracks: [],
        cues: [{
          id: 'test-cue',
          track: 'subtitle',
          hintTime: 5, // v1.3 필드
          root: {
            id: 'root',
            type: 'text',
            absStart: 1, // v1.3 필드
            absEnd: 5,   // v1.3 필드
            content: 'Test'
          }
        }]
      };

      const result = layer.process(v13Scenario);
      
      expect(result.originalVersion).toBe('1.3');
      expect(result.wasMigrated).toBe(true);
      expect(result.scenario.version).toBe('2.0');
    });

    it('버전 필드가 없는 경우 기본적으로 v1.3으로 판단', () => {
      const unknownScenario = {
        // version 필드 없음
        cues: [{
          id: 'test-cue',
          root: { type: 'text', content: 'Test' }
        }]
      };

      const result = layer.process(unknownScenario);
      
      expect(result.originalVersion).toBe('1.3');
      expect(result.wasMigrated).toBe(true);
    });

    it('v2.0 고유 기능으로 버전 감지 - Define 섹션', () => {
      const scenarioWithDefine = {
        // version 필드 없지만 define 섹션 존재
        define: { 
          color_primary: '#ffffff'
        },
        cues: []
      };

      const result = layer.process(scenarioWithDefine);
      
      expect(result.originalVersion).toBe('2.0');
      expect(result.wasMigrated).toBe(false);
    });

    it('v2.0 고유 기능으로 버전 감지 - 시간 배열', () => {
      const scenarioWithTimeArrays = {
        cues: [{
          id: 'test-cue',
          root: {
            id: 'root',
            type: 'text',
            displayTime: [1, 5], // v2.0 시간 배열
            content: 'Test'
          }
        }]
      };

      const result = layer.process(scenarioWithTimeArrays);
      
      expect(result.originalVersion).toBe('2.0');
      expect(result.wasMigrated).toBe(false);
    });

    it('노드 ID 일관성으로 버전 감지', () => {
      const scenarioWithConsistentIds = {
        cues: [{
          id: 'cue-1',
          root: {
            id: 'root-1', // 모든 노드에 ID 있음 = v2.0
            type: 'group',
            children: [{
              id: 'child-1',
              type: 'text',
              content: 'Test'
            }]
          }
        }]
      };

      const result = layer.process(scenarioWithConsistentIds);
      
      expect(result.originalVersion).toBe('2.0');
    });
  });

  describe('마이그레이션 처리', () => {
    it('v1.3 → v2.0 자동 마이그레이션', () => {
      const v13Scenario = {
        version: '1.3',
        cues: [{
          id: 'test-cue',
          track: 'subtitle',
          hintTime: 5,
          root: {
            id: 'root',
            type: 'text',
            absStart: 1,
            absEnd: 5,
            content: 'Test'
          }
        }]
      };

      const result = layer.process(v13Scenario);
      
      expect(result.wasMigrated).toBe(true);
      expect(result.scenario.version).toBe('2.0');
      expect(result.scenario.define).toBeDefined();
      
      // 필드 변환 확인
      const cue = result.scenario.cues[0];
      expect(cue.domLifetime).toEqual([5, 10]);
      expect('hintTime' in cue).toBe(false);
      
      const textNode = cue.root;
      expect(textNode.displayTime).toEqual([1, 5]);
      expect('absStart' in textNode).toBe(false);
      expect('absEnd' in textNode).toBe(false);
    });

    it('v2.0는 검증만 수행', () => {
      const v20Scenario = {
        version: '2.0',
        define: {},
        cues: [{
          id: 'test-cue',
          root: {
            id: 'root',
            type: 'text',
            displayTime: [1, 5],
            content: 'Test'
          }
        }]
      };

      const result = layer.process(v20Scenario);
      
      expect(result.wasMigrated).toBe(false);
      expect(result.scenario).toEqual(v20Scenario);
    });

    it('JSON 문자열 입력 처리', () => {
      const v13Json = JSON.stringify({
        version: '1.3',
        cues: [{
          id: 'test-cue',
          root: { type: 'text', content: 'Test' }
        }]
      });

      const result = layer.process(v13Json);
      
      expect(result.originalVersion).toBe('1.3');
      expect(result.wasMigrated).toBe(true);
      expect(result.scenario.version).toBe('2.0');
    });
  });

  describe('옵션 설정', () => {
    it('자동 마이그레이션 비활성화', () => {
      const layerNoMigration = new CompatibilityLayer({ 
        autoMigrate: false,
        allowDeprecated: true
      });

      const v13Scenario = {
        version: '1.3',
        cues: [{
          id: 'test-cue',
          hintTime: 5,
          root: { type: 'text', content: 'Test' }
        }]
      };

      const result = layerNoMigration.process(v13Scenario);
      
      expect(result.originalVersion).toBe('1.3');
      expect(result.wasMigrated).toBe(true); // 기본 변환은 수행
      expect(result.scenario.version).toBe('2.0'); // 버전은 업데이트
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('deprecated 필드 허용하지 않는 경우 에러', () => {
      const strictLayer = new CompatibilityLayer({ 
        autoMigrate: false,
        allowDeprecated: false
      });

      const v13Scenario = {
        version: '1.3',
        cues: [{
          id: 'test-cue',
          hintTime: 5, // deprecated 필드
          root: { type: 'text', content: 'Test' }
        }]
      };

      expect(() => {
        strictLayer.process(v13Scenario);
      }).toThrow('auto migration is disabled and deprecated fields are not allowed');
    });

    it('경고 메시지 비활성화', () => {
      const normalLayer = new CompatibilityLayer({ 
        showWarnings: true
      });
      
      const silentLayer = new CompatibilityLayer({ 
        showWarnings: false
      });

      const v20ScenarioWithIssues = {
        version: '2.0',
        cues: [{
          id: 'test-cue',
          root: {
            id: 'root',
            type: 'text',
            displayTime: [5, 1], // 잘못된 시간 범위
            content: 'Test'
          }
        }]
      };

      const normalResult = normalLayer.process(v20ScenarioWithIssues);
      const silentResult = silentLayer.process(v20ScenarioWithIssues);
      
      // showWarnings 옵션이 경고 메시지 생성에 영향을 줄 수 있음
      expect(normalResult.warnings.length).toBeGreaterThanOrEqual(silentResult.warnings.length);
      
      // normalResult에는 시간 범위 경고가 있어야 함
      expect(normalResult.warnings.some(w => w.includes('start (5) > end (1)'))).toBe(true);
    });

    it('마이그레이션 옵션 전달', () => {
      const customLayer = new CompatibilityLayer({
        migrationOptions: {
          defineStrategy: 'aggressive',
          minDuplicateCount: 2
        }
      });

      const v13Scenario = {
        version: '1.3',
        tracks: Array.from({ length: 3 }, (_, i) => ({
          id: `track-${i}`,
          type: 'subtitle',
          defaultStyle: { color: '#ffffff' }
        }))
      };

      const result = customLayer.process(v13Scenario);
      
      // Aggressive 전략으로 색상이 추출되어야 함
      expect(Object.keys(result.scenario.define).length).toBeGreaterThan(0);
    });
  });

  describe('검증 및 경고', () => {
    it('v2.0 필드 검증', () => {
      const v20ScenarioWithIssues = {
        version: '2.0',
        cues: [{
          id: 'test-cue',
          root: {
            id: 'root',
            type: 'text',
            displayTime: [5, 1], // 잘못된 시간 범위 (start > end)
            content: 'Test'
          }
        }]
      };

      const result = layer.process(v20ScenarioWithIssues);
      
      expect(result.warnings.some(w => 
        w.includes('start (5) > end (1)')
      )).toBe(true);
    });

    it('누락된 필수 필드 경고', () => {
      const scenarioMissingFields = {
        version: '2.0',
        // define 누락
        cues: [] // 빈 cues
      };

      const result = layer.process(scenarioMissingFields);
      
      expect(result.warnings.some(w => 
        w.includes('Missing define section')
      )).toBe(true);
    });

    it('잘못된 시간 배열 검증', () => {
      const scenarioInvalidTimeArrays = {
        version: '2.0',
        define: {},
        cues: [{
          id: 'test-cue',
          root: {
            id: 'root',
            type: 'text',
            displayTime: [1], // 배열 길이가 2가 아님
            content: 'Test'
          }
        }]
      };

      const result = layer.process(scenarioInvalidTimeArrays);
      
      expect(result.warnings.some(w => 
        w.includes('expected [start, end]')
      )).toBe(true);
    });
  });

  describe('정적 메서드', () => {
    it('isV20으로 v2.0 감지', () => {
      const v20Scenario = {
        version: '2.0',
        define: {},
        cues: []
      };
      
      expect(CompatibilityLayer.isV20(v20Scenario)).toBe(true);
    });

    it('isV13으로 v1.3 감지', () => {
      const v13Scenario = {
        version: '1.3',
        cues: [{
          hintTime: 5, // v1.3 고유 필드
          root: { type: 'text', content: 'Test' }
        }]
      };
      
      expect(CompatibilityLayer.isV13(v13Scenario)).toBe(true);
    });

    it('processQuick으로 빠른 처리', () => {
      const v13Scenario = {
        version: '1.3',
        cues: [{
          id: 'test-cue',
          hintTime: 5,
          root: { type: 'text', content: 'Test' }
        }]
      };

      const result = CompatibilityLayer.processQuick(v13Scenario);
      
      expect(result.version).toBe('2.0');
      expect(result.define).toBeDefined();
    });

    it('processSilent으로 경고 없는 처리', () => {
      const scenarioWithIssues = {
        version: '2.0',
        cues: [{
          id: 'test-cue',
          root: {
            type: 'text',
            displayTime: [5, 1], // 잘못된 시간 범위
            content: 'Test'
          }
        }]
      };

      // processSilent은 경고를 출력하지 않음
      const result = CompatibilityLayer.processSilent(scenarioWithIssues);
      
      expect(result.version).toBe('2.0');
    });
  });

  describe('에지 케이스', () => {
    it('빈 시나리오 처리', () => {
      const emptyScenario = {};

      const result = layer.process(emptyScenario);
      
      expect(result.originalVersion).toBe('1.3'); // 기본값
      expect(result.wasMigrated).toBe(true);
      expect(result.scenario.version).toBe('2.0');
    });

    it('잘못된 JSON 문자열 처리', () => {
      const invalidJson = '{ invalid json }';

      expect(() => {
        layer.process(invalidJson);
      }).toThrow();
    });

    it('지원하지 않는 버전', () => {
      const unsupportedVersion = {
        version: '3.0', // 지원하지 않는 버전
        cues: []
      };

      expect(() => {
        layer.process(unsupportedVersion);
      }).toThrow('Unsupported scenario version: 3.0');
    });
  });
});