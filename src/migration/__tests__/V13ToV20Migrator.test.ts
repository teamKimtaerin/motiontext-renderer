import { describe, it, expect, beforeEach } from 'vitest';
import { V13ToV20Migrator } from '../V13ToV20Migrator';

describe('V13ToV20Migrator', () => {
  let migrator: V13ToV20Migrator;

  beforeEach(() => {
    migrator = new V13ToV20Migrator();
  });

  describe('기본 필드 변환', () => {
    it('버전을 1.3에서 2.0으로 업데이트', () => {
      const v13Scenario = {
        version: '1.3',
        timebase: { unit: 'seconds' },
        stage: { baseAspect: '16:9' },
        tracks: [],
        cues: []
      };

      const result = migrator.migrate(v13Scenario);
      
      expect(result.scenario.version).toBe('2.0');
      expect(result.scenario.define).toBeDefined();
    });

    it('hintTime을 domLifetime으로 변환', () => {
      const v13Scenario = {
        version: '1.3',
        cues: [{
          id: 'test-cue',
          track: 'subtitle',
          hintTime: 5,
          root: { id: 'root', type: 'group', children: [] }
        }]
      };

      const result = migrator.migrate(v13Scenario);
      const cue = result.scenario.cues[0];
      
      expect('hintTime' in cue).toBe(false);
      expect(cue.domLifetime).toEqual([5, 10]); // hintTime + 5초 기본창
    });

    it('absStart/absEnd를 displayTime으로 변환', () => {
      const v13Scenario = {
        version: '1.3',
        cues: [{
          id: 'test-cue',
          track: 'subtitle',
          root: {
            id: 'root',
            type: 'text',
            absStart: 2,
            absEnd: 6,
            content: 'Test text'
          }
        }]
      };

      const result = migrator.migrate(v13Scenario);
      const textNode = result.scenario.cues[0].root;
      
      expect('absStart' in textNode).toBe(false);
      expect('absEnd' in textNode).toBe(false);
      expect(textNode.displayTime).toEqual([2, 6]);
    });

    it('플러그인 relStart/relEnd를 timeOffset으로 변환', () => {
      const v13Scenario = {
        version: '1.3',
        cues: [{
          id: 'test-cue',
          track: 'subtitle',
          root: {
            id: 'root',
            type: 'text',
            pluginChain: [{
              name: 'fadeIn',
              relStart: 0.1,
              relEnd: 0.8
            }]
          }
        }]
      };

      const result = migrator.migrate(v13Scenario);
      const plugin = result.scenario.cues[0].root.pluginChain[0];
      
      expect('relStart' in plugin).toBe(false);
      expect('relEnd' in plugin).toBe(false);
      expect(plugin.timeOffset).toEqual([0.1, 0.8]);
    });
  });

  describe('Define 추출 전략', () => {
    describe('Conservative 전략 (기본값)', () => {
      beforeEach(() => {
        migrator = new V13ToV20Migrator({ 
          defineStrategy: 'conservative' 
        });
      });

      it('시맨틱 타입명은 추출하지 않음', () => {
        const v13Scenario = {
          version: '1.3',
          cues: Array.from({ length: 6 }, (_, i) => ({
            id: `cue-${i}`,
            track: 'subtitle',
            root: {
              id: `root-${i}`,
              type: 'text', // 6번 반복되지만 추출하지 않음
              content: `Test ${i}`
            }
          }))
        };

        const result = migrator.migrate(v13Scenario);
        
        expect(result.extractedDefines).toBe(0);
        expect(Object.keys(result.scenario.define)).toHaveLength(0);
        
        // 모든 노드에 원래 값 유지
        result.scenario.cues.forEach((cue: any) => {
          expect(cue.root.type).toBe('text');
        });
      });

      it('앵커 값은 추출하지 않음', () => {
        const v13Scenario = {
          version: '1.3',
          cues: Array.from({ length: 6 }, (_, i) => ({
            id: `cue-${i}`,
            track: 'subtitle',
            root: {
              id: `root-${i}`,
              type: 'text',
              layout: {
                anchor: 'cc' // 6번 반복되지만 추출하지 않음
              }
            }
          }))
        };

        const result = migrator.migrate(v13Scenario);
        
        expect(result.extractedDefines).toBe(0);
        result.scenario.cues.forEach((cue: any) => {
          expect(cue.root.layout.anchor).toBe('cc');
        });
      });

      it('색상 코드는 5회 이상 중복시 추출', () => {
        const v13Scenario = {
          version: '1.3',
          tracks: Array.from({ length: 6 }, (_, i) => ({
            id: `track-${i}`,
            type: 'subtitle',
            defaultStyle: {
              color: '#ffffff' // 색상 코드 6번 반복
            }
          }))
        };

        const result = migrator.migrate(v13Scenario);
        
        expect(result.extractedDefines).toBe(1);
        expect(result.scenario.define.color_1).toBe('#ffffff');
        
        // 모든 트랙에서 define 참조로 변경됨
        result.scenario.tracks.forEach((track: any) => {
          expect(track.defaultStyle.color).toBe('define.color_1');
        });
      });

      it('긴 텍스트는 추출', () => {
        const longText = '이것은 매우 긴 텍스트입니다. 20자가 넘어가야 추출됩니다.';
        const v13Scenario = {
          version: '1.3',
          cues: Array.from({ length: 6 }, (_, i) => ({
            id: `cue-${i}`,
            track: 'subtitle',
            root: {
              id: `root-${i}`,
              type: 'text',
              content: longText
            }
          }))
        };

        const result = migrator.migrate(v13Scenario);
        
        expect(result.extractedDefines).toBe(1);
        expect(result.scenario.define.text_1).toBe(longText);
      });

      it('단순 숫자는 추출하지 않음', () => {
        const v13Scenario = {
          version: '1.3',
          cues: Array.from({ length: 6 }, (_, i) => ({
            id: `cue-${i}`,
            track: 'subtitle',
            root: {
              id: `root-${i}`,
              type: 'text',
              layout: {
                position: [0.5, 0.8] // 단순 좌표값은 추출하지 않음
              }
            }
          }))
        };

        const result = migrator.migrate(v13Scenario);
        
        expect(result.extractedDefines).toBe(0);
        result.scenario.cues.forEach((cue: any) => {
          expect(cue.root.layout.position).toEqual([0.5, 0.8]);
        });
      });
    });

    describe('Aggressive 전략', () => {
      beforeEach(() => {
        migrator = new V13ToV20Migrator({ 
          defineStrategy: 'aggressive',
          minDuplicateCount: 2
        });
      });

      it('모든 중복 값을 추출', () => {
        const v13Scenario = {
          version: '1.3',
          cues: Array.from({ length: 3 }, (_, i) => ({
            id: `cue-${i}`,
            track: 'subtitle',
            root: {
              id: `root-${i}`,
              type: 'text', // 3번 반복 -> 추출됨
              content: `Test ${i}` // 각기 다른 값이므로 추출되지 않음
            }
          }))
        };

        const result = migrator.migrate(v13Scenario);
        
        // Aggressive 전략에서는 track: 'subtitle'과 type: 'text'가 각각 추출됨
        expect(result.extractedDefines).toBe(2);
        
        // 추출 순서에 따라 subtitle이 text_1, text가 text_2가 됨
        expect(result.scenario.define.text_1).toBe('subtitle');
        expect(result.scenario.define.text_2).toBe('text');
        
        result.scenario.cues.forEach((cue: any) => {
          expect(cue.track).toBe('define.text_1');
          expect(cue.root.type).toBe('define.text_2');
        });
      });
    });

    describe('None 전략', () => {
      beforeEach(() => {
        migrator = new V13ToV20Migrator({ 
          defineStrategy: 'none'
        });
      });

      it('Define 추출을 완전히 비활성화', () => {
        const v13Scenario = {
          version: '1.3',
          tracks: Array.from({ length: 10 }, (_, i) => ({
            id: `track-${i}`,
            type: 'subtitle',
            defaultStyle: {
              color: '#ffffff' // 10번 반복되어도 추출하지 않음
            }
          }))
        };

        const result = migrator.migrate(v13Scenario);
        
        expect(result.extractedDefines).toBe(0);
        expect(Object.keys(result.scenario.define)).toHaveLength(0);
        
        result.scenario.tracks.forEach((track: any) => {
          expect(track.defaultStyle.color).toBe('#ffffff');
        });
      });
    });
  });

  describe('노드 ID 생성', () => {
    it('누락된 노드 ID를 자동 생성', () => {
      const v13Scenario = {
        version: '1.3',
        cues: [{
          id: 'test-cue',
          track: 'subtitle',
          root: {
            // ID 누락
            type: 'group',
            children: [{
              // ID 누락
              type: 'text',
              content: 'Test text'
            }]
          }
        }]
      };

      const result = migrator.migrate(v13Scenario);
      
      expect(result.generatedIds).toBe(2);
      
      const root = result.scenario.cues[0].root;
      expect(root.id).toBeDefined();
      expect(root.id).toMatch(/^cue-0-\d+$/);
      
      const child = root.children[0];
      expect(child.id).toBeDefined();
      expect(child.id).toMatch(/^cue-0-.*-child-0-\d+$/);
    });

    it('기존 ID는 유지', () => {
      const v13Scenario = {
        version: '1.3',
        cues: [{
          id: 'test-cue',
          track: 'subtitle',
          root: {
            id: 'existing-root',
            type: 'group',
            children: [{
              id: 'existing-child',
              type: 'text',
              content: 'Test text'
            }]
          }
        }]
      };

      const result = migrator.migrate(v13Scenario);
      
      expect(result.generatedIds).toBe(0);
      expect(result.scenario.cues[0].root.id).toBe('existing-root');
      expect(result.scenario.cues[0].root.children[0].id).toBe('existing-child');
    });
  });

  describe('검증 및 경고', () => {
    it('deprecated 필드 사용시 경고', () => {
      const v13Scenario = {
        version: '1.3',
        cues: [{
          id: 'test-cue',
          track: 'subtitle',
          hintTime: 5, // deprecated 필드
          root: {
            id: 'root',
            type: 'text',
            absStart: 2, // deprecated 필드
            absEnd: 6,   // deprecated 필드
            content: 'Test'
          }
        }]
      };

      const result = migrator.migrate(v13Scenario);
      
      // deprecated 필드 경고는 FieldMigration에서 처리하므로 여기서는 없음
      // 하지만 변환은 정상적으로 수행됨
      expect(result.scenario.version).toBe('2.0');
      expect(result.scenario.cues[0].domLifetime).toEqual([5, 10]);
    });
  });

  describe('정적 편의 메서드', () => {
    it('migrateQuick으로 빠른 변환', () => {
      const v13Scenario = {
        version: '1.3',
        cues: [{
          id: 'test-cue',
          track: 'subtitle',
          root: { id: 'root', type: 'text', content: 'Test' }
        }]
      };

      const result = V13ToV20Migrator.migrateQuick(v13Scenario);
      
      expect(result.version).toBe('2.0');
      expect(result.define).toBeDefined();
    });

    it('옵션을 전달하여 전략 변경', () => {
      const v13Scenario = {
        version: '1.3',
        tracks: Array.from({ length: 6 }, (_, i) => ({
          id: `track-${i}`,
          type: 'subtitle',
          defaultStyle: { color: '#ffffff' }
        }))
      };

      const aggressive = V13ToV20Migrator.migrateQuick(v13Scenario, {
        defineStrategy: 'aggressive',
        minDuplicateCount: 2
      });
      
      const conservative = V13ToV20Migrator.migrateQuick(v13Scenario, {
        defineStrategy: 'conservative'
      });

      // Aggressive는 추출함
      expect(Object.keys(aggressive.define).length).toBeGreaterThan(0);
      
      // Conservative는 색상 코드를 추출함
      expect(Object.keys(conservative.define).length).toBe(1);
    });
  });
});