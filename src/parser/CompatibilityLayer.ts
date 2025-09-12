// CompatibilityLayer
// v1.3/v2.0 자동 감지 및 호환성 레이어

import type { ScenarioFileV1_3 } from '../types/scenario';
import type { Scenario as ScenarioV2 } from '../types/scenario-v2';
import { V13ToV20Migrator, type MigrationOptions } from '../migration/V13ToV20Migrator';

export type CompatibleScenario = ScenarioFileV1_3 | ScenarioV2;

export interface CompatibilityOptions {
  /** 자동 마이그레이션 활성화 여부 (기본: true) */
  autoMigrate?: boolean;
  /** 경고 메시지 출력 여부 (기본: true) */
  showWarnings?: boolean;
  /** 마이그레이션 옵션 */
  migrationOptions?: MigrationOptions;
  /** deprecated 필드 허용 여부 (기본: true) */
  allowDeprecated?: boolean;
}

export interface CompatibilityResult {
  /** 처리된 시나리오 (항상 v2.0 형식) */
  scenario: ScenarioV2;
  /** 원본 버전 */
  originalVersion: string;
  /** 마이그레이션 수행 여부 */
  wasMigrated: boolean;
  /** 경고 메시지들 */
  warnings: string[];
}

/**
 * v1.3과 v2.0 시나리오를 자동으로 감지하고 호환성을 제공하는 레이어
 */
export class CompatibilityLayer {
  private options: Required<CompatibilityOptions>;

  constructor(options: CompatibilityOptions = {}) {
    this.options = {
      autoMigrate: options.autoMigrate ?? true,
      showWarnings: options.showWarnings ?? true,
      migrationOptions: options.migrationOptions ?? {},
      allowDeprecated: options.allowDeprecated ?? true,
    };
  }

  /**
   * 시나리오를 자동으로 감지하고 v2.0으로 변환
   */
  process(scenario: CompatibleScenario | string): CompatibilityResult {
    // JSON 문자열인 경우 파싱
    const parsedScenario = typeof scenario === 'string' 
      ? JSON.parse(scenario) 
      : scenario;

    // 버전 감지
    const version = this.detectVersion(parsedScenario);
    const warnings: string[] = [];

    // v2.0인 경우 그대로 반환 (추가 검증만 수행)
    if (version === '2.0') {
      if (this.options.showWarnings) {
        this.validateV20Fields(parsedScenario, warnings);
      }

      return {
        scenario: parsedScenario as ScenarioV2,
        originalVersion: version,
        wasMigrated: false,
        warnings,
      };
    }

    // v1.3인 경우 마이그레이션 수행
    if (version === '1.3' && this.options.autoMigrate) {
      const migrator = new V13ToV20Migrator({
        ...this.options.migrationOptions,
        showWarnings: this.options.showWarnings,
      });

      const migrationResult = migrator.migrate(parsedScenario);

      return {
        scenario: migrationResult.scenario,
        originalVersion: version,
        wasMigrated: true,
        warnings: [...warnings, ...migrationResult.warnings],
      };
    }

    // v1.3이지만 자동 마이그레이션 비활성화인 경우
    if (version === '1.3' && !this.options.autoMigrate) {
      if (!this.options.allowDeprecated) {
        throw new Error(
          'v1.3 scenario detected but auto migration is disabled and deprecated fields are not allowed'
        );
      }

      // v1.3을 v2.0 구조로 간단 변환 (deprecated 필드 유지)
      const basicMigrated = this.basicV13ToV20Conversion(parsedScenario);
      warnings.push('v1.3 scenario detected: using basic compatibility mode with deprecated fields');

      return {
        scenario: basicMigrated,
        originalVersion: version,
        wasMigrated: true,
        warnings,
      };
    }

    // 알 수 없는 버전
    throw new Error(`Unsupported scenario version: ${version}`);
  }

  /**
   * 시나리오 버전 자동 감지
   */
  private detectVersion(scenario: any): string {
    // 명시적 버전 필드가 있는 경우
    if (scenario.version) {
      if (scenario.version === '2.0') return '2.0';
      if (scenario.version === '1.3') return '1.3';
      
      // 지원하지 않는 버전
      throw new Error(`Unsupported scenario version: ${scenario.version}`);
    }

    // v2.0 고유 필드 감지
    if (this.hasV20Features(scenario)) {
      return '2.0';
    }

    // v1.3 고유 필드 감지
    if (this.hasV13Features(scenario)) {
      return '1.3';
    }

    // 기본적으로 v1.3으로 가정 (하위 호환성)
    return '1.3';
  }

  /**
   * v2.0 고유 기능 감지
   */
  private hasV20Features(scenario: any): boolean {
    // Define 섹션 존재
    if (scenario.define && typeof scenario.define === 'object') {
      return true;
    }

    // v2.0 시간 필드 형태 ([start, end] 배열)
    if (this.hasTimeArrayFields(scenario)) {
      return true;
    }

    // 노드 ID 필수화 (모든 노드에 id 필드)
    if (this.hasConsistentNodeIds(scenario)) {
      return true;
    }

    return false;
  }

  /**
   * v1.3 고유 기능 감지  
   */
  private hasV13Features(scenario: any): boolean {
    // deprecated 필드들 존재
    const deprecatedFields = ['hintTime', 'absStart', 'absEnd', 'relStart', 'relEnd'];
    
    return this.hasAnyFields(scenario, deprecatedFields);
  }

  /**
   * 시간 배열 필드 존재 확인
   */
  private hasTimeArrayFields(obj: any): boolean {
    const timeArrayFields = ['displayTime', 'domLifetime', 'time_offset'];
    
    return this.searchForArrayFields(obj, timeArrayFields);
  }

  /**
   * 일관된 노드 ID 존재 확인
   */
  private hasConsistentNodeIds(scenario: any): boolean {
    if (!scenario.cues || !Array.isArray(scenario.cues)) return false;

    let nodeCount = 0;
    let nodesWithId = 0;

    const countNodes = (obj: any) => {
      if (Array.isArray(obj)) {
        obj.forEach(countNodes);
      } else if (typeof obj === 'object' && obj !== null) {
        if (obj.e_type || obj.type) { // 노드로 판단되는 객체
          nodeCount++;
          if (obj.id) nodesWithId++;
        }
        Object.values(obj).forEach(countNodes);
      }
    };

    scenario.cues.forEach(countNodes);

    // 50% 이상의 노드가 ID를 가지면 v2.0으로 판단
    return nodeCount > 0 && (nodesWithId / nodeCount) >= 0.5;
  }

  /**
   * 특정 필드들의 존재 여부 확인
   */
  private hasAnyFields(obj: any, fields: string[]): boolean {
    if (Array.isArray(obj)) {
      return obj.some(item => this.hasAnyFields(item, fields));
    } else if (typeof obj === 'object' && obj !== null) {
      // 현재 객체에서 확인
      if (fields.some(field => field in obj)) {
        return true;
      }
      
      // 자식 객체들에서 재귀 검색
      return Object.values(obj).some(value => this.hasAnyFields(value, fields));
    }
    
    return false;
  }

  /**
   * 배열 필드들 검색
   */
  private searchForArrayFields(obj: any, fields: string[]): boolean {
    if (Array.isArray(obj)) {
      return obj.some(item => this.searchForArrayFields(item, fields));
    } else if (typeof obj === 'object' && obj !== null) {
      // 현재 객체에서 배열 필드 확인
      for (const field of fields) {
        if (field in obj && Array.isArray(obj[field]) && obj[field].length === 2) {
          return true;
        }
      }
      
      // 자식 객체들에서 재귀 검색
      return Object.values(obj).some(value => this.searchForArrayFields(value, fields));
    }
    
    return false;
  }

  /**
   * v2.0 필드 유효성 검증
   */
  private validateV20Fields(scenario: any, warnings: string[]): void {
    // 필수 필드 확인
    if (!scenario.version) {
      warnings.push('Missing version field');
    }

    if (!scenario.define) {
      warnings.push('Missing define section (recommended for v2.0)');
    }

    // 시간 배열 형식 확인
    this.validateTimeArraysRecursive(scenario, '', warnings);
  }

  /**
   * 시간 배열 재귀 검증
   */
  private validateTimeArraysRecursive(obj: any, path: string, warnings: string[]): void {
    const timeFields = ['displayTime', 'domLifetime', 'time_offset'];
    
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.validateTimeArraysRecursive(item, `${path}[${index}]`, warnings);
      });
    } else if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        const newPath = path ? `${path}.${key}` : key;
        
        if (timeFields.includes(key)) {
          if (!Array.isArray(value) || value.length !== 2) {
            warnings.push(`Invalid time array at ${newPath}: expected [start, end]`);
          } else if (typeof value[0] !== 'number' || typeof value[1] !== 'number') {
            warnings.push(`Invalid time array at ${newPath}: values must be numbers`);
          } else if (value[0] > value[1]) {
            warnings.push(`Invalid time range at ${newPath}: start (${value[0]}) > end (${value[1]})`);
          }
        }
        
        this.validateTimeArraysRecursive(value, newPath, warnings);
      });
    }
  }

  /**
   * 기본적인 v1.3 → v2.0 변환 (deprecated 필드 유지)
   */
  private basicV13ToV20Conversion(scenario: any): ScenarioV2 {
    const converted = JSON.parse(JSON.stringify(scenario));
    
    // 버전만 업데이트
    converted.version = '2.0';
    
    // 빈 define 섹션 추가
    if (!converted.define) {
      converted.define = {};
    }
    
    return converted as ScenarioV2;
  }

  /**
   * 정적 편의 메서드들
   */

  /**
   * 시나리오가 v2.0인지 확인
   */
  static isV20(scenario: any): boolean {
    const layer = new CompatibilityLayer({ autoMigrate: false, showWarnings: false });
    return layer.detectVersion(scenario) === '2.0';
  }

  /**
   * 시나리오가 v1.3인지 확인
   */
  static isV13(scenario: any): boolean {
    const layer = new CompatibilityLayer({ autoMigrate: false, showWarnings: false });
    return layer.detectVersion(scenario) === '1.3';
  }

  /**
   * 빠른 처리 (기본 옵션 사용)
   */
  static processQuick(scenario: CompatibleScenario): ScenarioV2 {
    const layer = new CompatibilityLayer();
    return layer.process(scenario).scenario;
  }

  /**
   * 경고 없이 조용한 처리
   */
  static processSilent(scenario: CompatibleScenario): ScenarioV2 {
    const layer = new CompatibilityLayer({ showWarnings: false });
    return layer.process(scenario).scenario;
  }
}