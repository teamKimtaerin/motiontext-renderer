import type { Scenario as ScenarioV2, TimeRange } from '../types/scenario-v2';

/**
 * FieldMigration
 *
 * v1.3 → v2.0 필드명 변환 유틸리티
 * - hintTime → domLifetime: [start, end]
 * - absStart/absEnd → displayTime: [start, end]
 * - relStart/relEnd → time_offset: [start, end]
 * - 플러그인 t0/t1 → time_offset: [start, end]
 */
export class FieldMigration {
  /**
   * v1.3 시나리오를 v2.0 형식으로 마이그레이션
   * @param v13Scenario v1.3 형식의 시나리오 객체
   * @returns v2.0 형식으로 변환된 시나리오 객체
   */
  static migrateV13ToV20(v13Scenario: any): ScenarioV2 {
    const migrated = JSON.parse(JSON.stringify(v13Scenario)); // 깊은 복사

    // 버전 업데이트
    migrated.version = '2.0';

    // 빈 define 섹션 추가 (필요 시 나중에 수동으로 채움)
    if (!migrated.define) {
      migrated.define = {};
    }

    // Cue 레벨 마이그레이션
    if (migrated.cues && Array.isArray(migrated.cues)) {
      migrated.cues.forEach((cue: any) => {
        this.migrateCue(cue);
      });
    }

    return migrated as ScenarioV2;
  }

  /**
   * Cue 객체를 마이그레이션
   * @param cue 마이그레이션할 Cue 객체
   */
  private static migrateCue(cue: any): void {
    // hintTime → domLifetime 변환
    if ('hintTime' in cue) {
      if (typeof cue.hintTime === 'number') {
        // 단일 숫자인 경우 자동 확장은 나중에 계산 (여기서는 기본값 설정)
        cue.domLifetime = [cue.hintTime, cue.hintTime + 5.0]; // 기본 5초 창
      }
      delete cue.hintTime;
    }

    // Root 노드 마이그레이션
    if (cue.root) {
      this.migrateNode(cue.root);
    }
  }

  /**
   * Node 객체를 재귀적으로 마이그레이션
   * @param node 마이그레이션할 Node 객체
   */
  private static migrateNode(node: any): void {
    // absStart/absEnd → displayTime 변환
    if ('absStart' in node || 'absEnd' in node) {
      const start = node.absStart ?? 0;
      const end = node.absEnd ?? start + 1;
      node.displayTime = [start, end] as TimeRange;
      delete node.absStart;
      delete node.absEnd;
    }

    // pluginChain 마이그레이션
    if (node.pluginChain && Array.isArray(node.pluginChain)) {
      node.pluginChain.forEach((plugin: any) => {
        this.migratePlugin(plugin);
      });
    }

    // children 재귀 처리
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child: any) => {
        this.migrateNode(child);
      });
    }
  }

  /**
   * 플러그인 객체를 마이그레이션
   * @param plugin 마이그레이션할 플러그인 객체
   */
  private static migratePlugin(plugin: any): void {
    // relStart/relEnd → time_offset 변환
    if ('relStart' in plugin || 'relEnd' in plugin) {
      const start = plugin.relStart ?? 0;
      const end = plugin.relEnd ?? 1;
      plugin.time_offset = [start, end] as TimeRange;
      delete plugin.relStart;
      delete plugin.relEnd;
    }

    // relStartPct/relEndPct → time_offset 변환
    if ('relStartPct' in plugin || 'relEndPct' in plugin) {
      const start = (plugin.relStartPct ?? 0) / 100;
      const end = (plugin.relEndPct ?? 100) / 100;
      plugin.time_offset = [start, end] as TimeRange;
      delete plugin.relStartPct;
      delete plugin.relEndPct;
    }

    // t0/t1 → time_offset 변환 (레거시 형태)
    if ('t0' in plugin || 't1' in plugin) {
      const start = plugin.t0 ?? 0;
      const end = plugin.t1 ?? 1;
      plugin.time_offset = [start, end] as TimeRange;
      delete plugin.t0;
      delete plugin.t1;
    }
  }

  /**
   * v2.0 시간 배열 형식 검증
   * @param timeRange 검증할 시간 범위
   * @param fieldName 필드명 (에러 메시지용)
   * @returns 유효한 경우 true
   */
  static validateTimeRange(timeRange: any, fieldName: string): boolean {
    if (!Array.isArray(timeRange)) {
      throw new Error(`${fieldName} must be an array [start, end]`);
    }

    if (timeRange.length !== 2) {
      throw new Error(`${fieldName} must have exactly 2 elements [start, end]`);
    }

    const [start, end] = timeRange;

    if (typeof start !== 'number' || typeof end !== 'number') {
      throw new Error(`${fieldName} values must be numbers`);
    }

    if (start > end) {
      throw new Error(`${fieldName} start (${start}) must be <= end (${end})`);
    }

    return true;
  }

  /**
   * 노드 ID가 모든 노드에 있는지 검증
   * @param scenario 검증할 시나리오
   * @returns 유효한 경우 true
   */
  static validateNodeIds(scenario: ScenarioV2): boolean {
    const visitedIds = new Set<string>();

    if (scenario.cues) {
      for (const cue of scenario.cues) {
        if (cue.root) {
          this.validateNodeIdRecursive(
            cue.root,
            visitedIds,
            `cue[${cue.id}].root`
          );
        }
      }
    }

    return true;
  }

  /**
   * 노드 ID를 재귀적으로 검증
   * @param node 검증할 노드
   * @param visitedIds 방문한 ID 집합
   * @param path 현재 경로 (에러 메시지용)
   */
  private static validateNodeIdRecursive(
    node: any,
    visitedIds: Set<string>,
    path: string
  ): void {
    // ID 필수 검증
    if (!node.id || typeof node.id !== 'string') {
      throw new Error(`Node at ${path} is missing required 'id' field`);
    }

    // ID 중복 검증
    if (visitedIds.has(node.id)) {
      throw new Error(`Duplicate node ID: "${node.id}" found at ${path}`);
    }

    visitedIds.add(node.id);

    // 자식 노드들 재귀 검증
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child: any, index: number) => {
        this.validateNodeIdRecursive(
          child,
          visitedIds,
          `${path}.children[${index}]`
        );
      });
    }
  }

  /**
   * v1.3 샘플 JSON을 v2.0으로 변환하여 파일로 저장
   * @param v13Json v1.3 JSON 문자열
   * @returns v2.0 JSON 문자열
   */
  static convertSampleJson(v13Json: string): string {
    try {
      const v13Scenario = JSON.parse(v13Json);
      const v20Scenario = this.migrateV13ToV20(v13Scenario);

      // 검증
      this.validateNodeIds(v20Scenario);

      // 시간 범위 검증 (displayTime, domLifetime 등)
      this.validateTimeRangesInScenario(v20Scenario);

      return JSON.stringify(v20Scenario, null, 2);
    } catch (error) {
      throw new Error(`Migration failed: ${error}`);
    }
  }

  /**
   * 시나리오 내 모든 시간 범위 검증
   * @param scenario 검증할 시나리오
   */
  private static validateTimeRangesInScenario(scenario: ScenarioV2): void {
    if (scenario.cues) {
      for (const cue of scenario.cues) {
        // domLifetime 검증
        if (cue.domLifetime) {
          this.validateTimeRange(cue.domLifetime, `cue[${cue.id}].domLifetime`);
        }

        // 노드 내 시간 범위 검증
        if (cue.root) {
          this.validateTimeRangesInNode(cue.root, `cue[${cue.id}].root`);
        }
      }
    }
  }

  /**
   * 노드 내 시간 범위를 재귀적으로 검증
   * @param node 검증할 노드
   * @param path 현재 경로
   */
  private static validateTimeRangesInNode(node: any, path: string): void {
    // displayTime 검증
    if (node.displayTime) {
      this.validateTimeRange(node.displayTime, `${path}.displayTime`);
    }

    // pluginChain 내 time_offset 검증
    if (node.pluginChain && Array.isArray(node.pluginChain)) {
      node.pluginChain.forEach((plugin: any, index: number) => {
        if (plugin.time_offset) {
          this.validateTimeRange(
            plugin.time_offset,
            `${path}.pluginChain[${index}].time_offset`
          );
        }
      });
    }

    // 자식 노드들 재귀 검증
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child: any, index: number) => {
        this.validateTimeRangesInNode(child, `${path}.children[${index}]`);
      });
    }
  }
}
