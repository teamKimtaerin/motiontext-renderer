import { describe, it, expect } from 'vitest';
import { FieldMigration } from '../FieldMigration';

describe('FieldMigration', () => {
  describe('v1.3 → v2.0 마이그레이션', () => {
    it('기본 v1.3 시나리오를 v2.0으로 변환한다', () => {
      const v13Scenario = {
        version: '1.3',
        timebase: { unit: 'seconds' },
        stage: { baseAspect: '16:9' },
        tracks: [{ id: 'subtitle', type: 'subtitle', layer: 1 }],
        cues: [{
          id: 'cue1',
          track: 'subtitle',
          hintTime: 2.5,
          root: {
            id: 'text1',
            eType: 'text',
            text: 'Hello World',
            absStart: 1.0,
            absEnd: 5.0
          }
        }]
      };

      const result = FieldMigration.migrateV13ToV20(v13Scenario);

      expect(result.version).toBe('2.0');
      expect(result.define).toEqual({});
      expect(result.cues[0].domLifetime).toEqual([2.5, 7.5]); // hintTime + 5초 기본값
      expect(result.cues[0].root.displayTime).toEqual([1.0, 5.0]);
      expect(result.cues[0]).not.toHaveProperty('hintTime');
      expect(result.cues[0].root).not.toHaveProperty('absStart');
      expect(result.cues[0].root).not.toHaveProperty('absEnd');
    });

    it('플러그인 체인의 시간 필드를 변환한다', () => {
      const v13Scenario = {
        version: '1.3',
        tracks: [],
        cues: [{
          id: 'cue1',
          track: 'subtitle',
          root: {
            id: 'text1',
            eType: 'text',
            text: 'Hello',
            pluginChain: [
              { name: 'fadeIn', relStart: 0, relEnd: 0.5 },
              { name: 'fadeOut', relStartPct: 80, relEndPct: 100 },
              { name: 'legacy', t0: 0.2, t1: 0.8 }
            ]
          }
        }]
      };

      const result = FieldMigration.migrateV13ToV20(v13Scenario);
      const plugins = result.cues[0].root.pluginChain;

      expect(plugins[0].timeOffset).toEqual([0, 0.5]);
      expect(plugins[0]).not.toHaveProperty('relStart');
      expect(plugins[0]).not.toHaveProperty('relEnd');

      expect(plugins[1].timeOffset).toEqual([0.8, 1.0]); // 80%, 100%
      expect(plugins[1]).not.toHaveProperty('relStartPct');
      expect(plugins[1]).not.toHaveProperty('relEndPct');

      expect(plugins[2].timeOffset).toEqual([0.2, 0.8]);
      expect(plugins[2]).not.toHaveProperty('t0');
      expect(plugins[2]).not.toHaveProperty('t1');
    });

    it('중첩된 노드 구조를 재귀적으로 변환한다', () => {
      const v13Scenario = {
        version: '1.3',
        tracks: [],
        cues: [{
          id: 'cue1',
          track: 'subtitle',
          root: {
            id: 'group1',
            eType: 'group',
            absStart: 1.0,
            absEnd: 5.0,
            children: [{
              id: 'text1',
              eType: 'text',
              text: 'Hello',
              absStart: 2.0,
              absEnd: 4.0,
              pluginChain: [
                { name: 'fadeIn', relStart: 0, relEnd: 0.3 }
              ]
            }]
          }
        }]
      };

      const result = FieldMigration.migrateV13ToV20(v13Scenario);
      const root = result.cues[0].root;
      const child = root.children[0];

      expect(root.displayTime).toEqual([1.0, 5.0]);
      expect(child.displayTime).toEqual([2.0, 4.0]);
      expect(child.pluginChain[0].timeOffset).toEqual([0, 0.3]);
    });
  });

  describe('검증 기능', () => {
    it('유효한 시간 범위를 검증한다', () => {
      expect(FieldMigration.validateTimeRange([1.0, 5.0], 'displayTime')).toBe(true);
      expect(FieldMigration.validateTimeRange([0, 0], 'displayTime')).toBe(true); // start === end 허용
    });

    it('잘못된 시간 범위를 거부한다', () => {
      expect(() => FieldMigration.validateTimeRange('not-array', 'displayTime'))
        .toThrow('displayTime must be an array [start, end]');

      expect(() => FieldMigration.validateTimeRange([1], 'displayTime'))
        .toThrow('displayTime must have exactly 2 elements [start, end]');

      expect(() => FieldMigration.validateTimeRange([1, 2, 3], 'displayTime'))
        .toThrow('displayTime must have exactly 2 elements [start, end]');

      expect(() => FieldMigration.validateTimeRange(['1', '2'], 'displayTime'))
        .toThrow('displayTime values must be numbers');

      expect(() => FieldMigration.validateTimeRange([5.0, 1.0], 'displayTime'))
        .toThrow('displayTime start (5) must be <= end (1)');
    });

    it('노드 ID 필수성을 검증한다', () => {
      const scenario = {
        version: '2.0',
        tracks: [],
        cues: [{
          id: 'cue1',
          track: 'subtitle',
          root: {
            // id 누락
            eType: 'text',
            text: 'Hello'
          }
        }]
      } as any;

      expect(() => FieldMigration.validateNodeIds(scenario))
        .toThrow('Node at cue[cue1].root is missing required \'id\' field');
    });

    it('노드 ID 중복을 검출한다', () => {
      const scenario = {
        version: '2.0',
        tracks: [],
        cues: [{
          id: 'cue1',
          track: 'subtitle',
          root: {
            id: 'group1',
            eType: 'group',
            children: [{
              id: 'text1',
              eType: 'text',
              text: 'Hello'
            }, {
              id: 'text1', // 중복 ID
              eType: 'text',
              text: 'World'
            }]
          }
        }]
      } as any;

      expect(() => FieldMigration.validateNodeIds(scenario))
        .toThrow('Duplicate node ID: "text1" found at cue[cue1].root.children[1]');
    });
  });

  describe('JSON 변환 기능', () => {
    it('v1.3 JSON 문자열을 v2.0으로 변환한다', () => {
      const v13Json = JSON.stringify({
        version: '1.3',
        timebase: { unit: 'seconds' },
        stage: { baseAspect: '16:9' },
        tracks: [{ id: 'subtitle', type: 'subtitle', layer: 1 }],
        cues: [{
          id: 'cue1',
          track: 'subtitle',
          hintTime: 2,
          root: {
            id: 'text1',
            eType: 'text',
            text: 'Hello World',
            absStart: 1.0,
            absEnd: 3.0
          }
        }]
      });

      const result = FieldMigration.convertSampleJson(v13Json);
      const converted = JSON.parse(result);

      expect(converted.version).toBe('2.0');
      expect(converted.cues[0].domLifetime).toEqual([2, 7]);
      expect(converted.cues[0].root.displayTime).toEqual([1.0, 3.0]);
    });

    it('잘못된 JSON 변환 시 에러를 발생시킨다', () => {
      const invalidJson = 'invalid json';
      expect(() => FieldMigration.convertSampleJson(invalidJson))
        .toThrow('Migration failed:');
    });

    it('ID가 없는 노드 변환 시 에러를 발생시킨다', () => {
      const v13Json = JSON.stringify({
        version: '1.3',
        tracks: [],
        cues: [{
          id: 'cue1',
          track: 'subtitle',
          root: {
            // id 누락
            eType: 'text',
            text: 'Hello'
          }
        }]
      });

      expect(() => FieldMigration.convertSampleJson(v13Json))
        .toThrow('Migration failed:');
    });
  });

  describe('에지 케이스', () => {
    it('absStart만 있고 absEnd가 없는 경우를 처리한다', () => {
      const v13Scenario = {
        version: '1.3',
        tracks: [],
        cues: [{
          id: 'cue1',
          track: 'subtitle',
          root: {
            id: 'text1',
            eType: 'text',
            text: 'Hello',
            absStart: 2.5
            // absEnd 누락
          }
        }]
      };

      const result = FieldMigration.migrateV13ToV20(v13Scenario);
      expect(result.cues[0].root.displayTime).toEqual([2.5, 3.5]); // +1초 기본값
    });

    it('빈 pluginChain을 처리한다', () => {
      const v13Scenario = {
        version: '1.3',
        tracks: [],
        cues: [{
          id: 'cue1',
          track: 'subtitle',
          root: {
            id: 'text1',
            eType: 'text',
            text: 'Hello',
            pluginChain: []
          }
        }]
      };

      const result = FieldMigration.migrateV13ToV20(v13Scenario);
      expect(result.cues[0].root.pluginChain).toEqual([]);
    });

    it('플러그인의 일부 시간 필드만 있는 경우를 처리한다', () => {
      const v13Scenario = {
        version: '1.3',
        tracks: [],
        cues: [{
          id: 'cue1',
          track: 'subtitle',
          root: {
            id: 'text1',
            eType: 'text',
            text: 'Hello',
            pluginChain: [
              { name: 'fadeIn', relStart: 0.2 } // relEnd 누락
            ]
          }
        }]
      };

      const result = FieldMigration.migrateV13ToV20(v13Scenario);
      expect(result.cues[0].root.pluginChain[0].timeOffset).toEqual([0.2, 1]); // 기본값 1
    });
  });
});