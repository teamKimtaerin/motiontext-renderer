// V13ToV20Migrator
// 완전한 v1.3 → v2.0 자동 마이그레이션 도구

import type { Scenario as ScenarioV2, DefineSection } from '../types/scenario-v2';
import { FieldMigration } from '../parser/FieldMigration';

export interface MigrationOptions {
  /** 자동으로 Define 섹션 추출 여부 (기본: true) */
  extractDefines?: boolean;
  /** Define 추출 전략 (기본: 'conservative') */
  defineStrategy?: 'aggressive' | 'conservative' | 'none';
  /** 노드 ID 자동 생성 여부 (기본: true) */
  generateNodeIds?: boolean;
  /** 경고 메시지 출력 여부 (기본: true) */
  showWarnings?: boolean;
  /** Define 추출 최소 중복 횟수 (기본: conservative=5, aggressive=2) */
  minDuplicateCount?: number;
  /** Define 추출 제외 필드 패턴 */
  defineBlacklist?: string[];
  /** 의미있는 값 보존 여부 (기본: true) */
  preserveSemantics?: boolean;
}

export interface MigrationResult {
  /** 변환된 v2.0 시나리오 */
  scenario: ScenarioV2;
  /** 발생한 경고 메시지들 */
  warnings: string[];
  /** 추출된 Define 개수 */
  extractedDefines: number;
  /** 생성된 노드 ID 개수 */
  generatedIds: number;
}

export class V13ToV20Migrator {
  private options: Required<MigrationOptions>;
  private warnings: string[] = [];

  constructor(options: MigrationOptions = {}) {
    const defineStrategy = options.defineStrategy ?? 'conservative';
    
    this.options = {
      extractDefines: options.extractDefines ?? true,
      defineStrategy,
      generateNodeIds: options.generateNodeIds ?? true,
      showWarnings: options.showWarnings ?? true,
      minDuplicateCount: options.minDuplicateCount ?? (defineStrategy === 'conservative' ? 5 : 2),
      defineBlacklist: options.defineBlacklist ?? [],
      preserveSemantics: options.preserveSemantics ?? true,
    };
  }

  /**
   * v1.3 시나리오를 완전한 v2.0으로 마이그레이션
   */
  migrate(v13Scenario: any): MigrationResult {
    this.warnings = [];

    // 1단계: 기본 필드 마이그레이션 (FieldMigration 재사용)
    let migrated = FieldMigration.migrateV13ToV20(v13Scenario);

    // 2단계: Define 섹션 추출
    let extractedDefines = 0;
    if (this.options.extractDefines && this.options.defineStrategy !== 'none') {
      const extraction = this.extractDefineSection(migrated);
      migrated = extraction.scenario;
      extractedDefines = extraction.extractedCount;
    }

    // 3단계: 노드 ID 자동 생성
    let generatedIds = 0;
    if (this.options.generateNodeIds) {
      generatedIds = this.generateMissingNodeIds(migrated);
    }

    // 4단계: 검증 및 경고
    this.validateAndWarn(migrated);

    return {
      scenario: migrated,
      warnings: this.warnings,
      extractedDefines,
      generatedIds,
    };
  }

  /**
   * Define 섹션 자동 추출
   * 중복된 값들을 찾아서 Define으로 이동
   */
  private extractDefineSection(scenario: any): { scenario: any; extractedCount: number } {
    let extractedCount = 0;
    const defines: DefineSection = scenario.define || {};
    let defineCounter = 1;

    // 여러 패스를 통해 점진적으로 추출 (재귀적 참조 방지)
    let hasMoreToExtract = true;
    while (hasMoreToExtract && extractedCount < 20) { // 무한루프 방지
      const valueOccurrences = new Map<string, { paths: string[]; value: any }>();
      
      // 현재 상태에서 중복 값 수집
      this.collectValueOccurrences(scenario, '', valueOccurrences);

      hasMoreToExtract = false;

      for (const [, occurrence] of valueOccurrences) {
        if (occurrence.paths.length >= this.options.minDuplicateCount && 
            this.isExtractableValue(occurrence.value)) {
          
          // Define 키 생성
          const defineKey = this.generateDefineKey(occurrence.value, defineCounter++);
          defines[defineKey] = occurrence.value;

          // 원본 위치들을 define 참조로 교체
          for (const path of occurrence.paths) {
            this.replaceValueAtPath(scenario, path, `define.${defineKey}`);
          }

          extractedCount++;
          hasMoreToExtract = true; // 한 번에 하나씩 처리하고 다시 스캔
          this.addWarning(`Extracted ${occurrence.paths.length} occurrences to define.${defineKey}`);
          
          // 한 번에 하나의 값만 처리하고 루프 재시작
          break;
        }
      }
    }

    scenario.define = defines;
    return { scenario, extractedCount };
  }

  /**
   * 값의 모든 출현을 재귀적으로 수집
   */
  private collectValueOccurrences(
    obj: any, 
    currentPath: string, 
    occurrences: Map<string, { paths: string[]; value: any }>
  ): void {
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.collectValueOccurrences(item, `${currentPath}[${index}]`, occurrences);
      });
    } else if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        
        // Define 참조는 수집하지 않음 (이미 교체된 값)
        if (typeof value === 'string' && value.startsWith('define.')) {
          return;
        }
        
        if (this.isExtractableValue(value)) {
          const valueStr = JSON.stringify(value);
          if (!occurrences.has(valueStr)) {
            occurrences.set(valueStr, { paths: [], value });
          }
          occurrences.get(valueStr)!.paths.push(newPath);
        }

        this.collectValueOccurrences(value, newPath, occurrences);
      });
    }
  }

  /**
   * Define으로 추출 가능한 값인지 판단
   */
  private isExtractableValue(value: any): boolean {
    if (this.options.defineStrategy === 'aggressive') {
      return this.isExtractableValueAggressive(value);
    } else {
      return this.isExtractableValueConservative(value);
    }
  }

  /**
   * 공격적 추출 전략 (기존 로직)
   */
  private isExtractableValueAggressive(value: any): boolean {
    // 문자열 (색상, 폰트명 등)
    if (typeof value === 'string' && value.length > 3) return true;
    
    // 숫자 (0과 1 제외)
    if (typeof value === 'number' && value !== 0 && value !== 1) return true;
    
    // 객체 (복잡한 설정)
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return Object.keys(value).length > 1;
    }
    
    return false;
  }

  /**
   * 보수적 추출 전략 (의미있는 값만)
   */
  private isExtractableValueConservative(value: any): boolean {
    if (typeof value === 'string') {
      // 시맨틱 타입명 제외
      const semanticTypes = ['text', 'group', 'subtitle', 'container', 'image', 'video'];
      if (semanticTypes.includes(value.toLowerCase())) return false;
      
      // 앵커 값 제외
      const anchors = ['tl', 'tc', 'tr', 'cl', 'cc', 'cr', 'bl', 'bc', 'br'];
      if (anchors.includes(value.toLowerCase())) return false;
      
      // 색상 코드는 추출 (길이 무관)
      if (value.match(/^#[0-9a-fA-F]{3,8}$/)) return true;
      
      // 긴 폰트 패밀리는 추출
      if (value.includes(',') && (value.includes('serif') || value.includes('sans'))) return true;
      
      // URL이나 경로는 추출
      if (value.startsWith('http') || value.startsWith('file://') || value.includes('/')) return true;
      
      // 20자 이상 긴 텍스트는 추출
      if (value.length >= 20) return true;
      
      // 매우 짧은 문자열 제외 (위 조건에 해당하지 않는 경우만)
      if (value.length < 10) return false;
      
      return false;
    }
    
    if (typeof value === 'number') {
      // 0-10 범위의 단순 숫자 제외
      if (value >= 0 && value <= 10 && Number.isInteger(value)) return false;
      
      // 0-1 범위의 소수점 값 제외 (정규화된 좌표)
      if (value >= 0 && value <= 1) return false;
      
      return true;
    }
    
    // 객체는 복잡한 경우만 추출 (3개 이상 프로퍼티)
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return Object.keys(value).length >= 3;
    }
    
    return false;
  }

  /**
   * Define 키 자동 생성
   */
  private generateDefineKey(value: any, counter: number): string {
    if (typeof value === 'string') {
      // 색상 코드 감지
      if (value.match(/^#[0-9a-fA-F]{3,8}$/)) return `color_${counter}`;
      
      // 폰트명 감지
      if (value.includes('font') || value.match(/\w+\s*,\s*sans-serif|serif/i)) {
        return `font_${counter}`;
      }
      
      // 일반 문자열
      return `text_${counter}`;
    }
    
    if (typeof value === 'number') {
      return `value_${counter}`;
    }
    
    if (typeof value === 'object') {
      // 스타일 객체 감지
      if ('color' in value || 'fontFamily' in value || 'fontSize' in value) {
        return `style_${counter}`;
      }
      
      // 레이아웃 객체 감지
      if ('position' in value || 'anchor' in value) {
        return `layout_${counter}`;
      }
      
      return `config_${counter}`;
    }
    
    return `item_${counter}`;
  }

  /**
   * 경로를 통해 값을 교체
   */
  private replaceValueAtPath(obj: any, path: string, newValue: string): void {
    const parts = path.split(/[.\[\]]/).filter(Boolean);
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!isNaN(Number(part))) {
        current = current[Number(part)];
      } else {
        current = current[part];
      }
    }
    
    const lastPart = parts[parts.length - 1];
    if (!isNaN(Number(lastPart))) {
      current[Number(lastPart)] = newValue;
    } else {
      current[lastPart] = newValue;
    }
  }

  /**
   * 누락된 노드 ID 자동 생성
   */
  private generateMissingNodeIds(scenario: any): number {
    let generatedCount = 0;
    const usedIds = new Set<string>();

    // 1단계: 기존 ID 수집
    this.collectExistingIds(scenario, usedIds);

    // 2단계: 누락된 ID 생성
    if (scenario.cues && Array.isArray(scenario.cues)) {
      scenario.cues.forEach((cue: any, cueIndex: number) => {
        generatedCount += this.generateIdsForNode(cue.root, `cue-${cueIndex}`, usedIds);
      });
    }

    return generatedCount;
  }

  /**
   * 기존 ID들을 재귀적으로 수집
   */
  private collectExistingIds(obj: any, usedIds: Set<string>): void {
    if (Array.isArray(obj)) {
      obj.forEach(item => this.collectExistingIds(item, usedIds));
    } else if (typeof obj === 'object' && obj !== null) {
      if (obj.id && typeof obj.id === 'string') {
        usedIds.add(obj.id);
      }
      
      Object.values(obj).forEach(value => {
        this.collectExistingIds(value, usedIds);
      });
    }
  }

  /**
   * 노드와 자식들에게 누락된 ID 생성
   */
  private generateIdsForNode(node: any, prefix: string, usedIds: Set<string>): number {
    let generatedCount = 0;

    if (typeof node === 'object' && node !== null) {
      // 현재 노드 ID 생성
      if (!node.id) {
        let counter = 1;
        let newId: string;
        
        do {
          newId = `${prefix}-${counter}`;
          counter++;
        } while (usedIds.has(newId));
        
        node.id = newId;
        usedIds.add(newId);
        generatedCount++;
      }

      // 자식 노드들 처리
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child: any, index: number) => {
          generatedCount += this.generateIdsForNode(child, `${node.id || prefix}-child-${index}`, usedIds);
        });
      }
    }

    return generatedCount;
  }

  /**
   * 마이그레이션 결과 검증 및 경고 생성
   */
  private validateAndWarn(scenario: any): void {
    // deprecated 필드 사용 경고
    this.checkDeprecatedFields(scenario);
    
    // 필수 필드 누락 경고
    this.checkRequiredFields(scenario);
    
    // 시간 배열 검증
    this.validateTimeArrays(scenario);
  }

  /**
   * deprecated 필드 확인
   */
  private checkDeprecatedFields(obj: any, path = ''): void {
    const deprecatedFields = ['hintTime', 'absStart', 'absEnd', 'relStart', 'relEnd'];
    
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.checkDeprecatedFields(item, `${path}[${index}]`);
      });
    } else if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        const newPath = path ? `${path}.${key}` : key;
        
        if (deprecatedFields.includes(key)) {
          this.addWarning(`Deprecated field '${key}' found at ${newPath}`);
        }
        
        this.checkDeprecatedFields(value, newPath);
      });
    }
  }

  /**
   * 필수 필드 확인
   */
  private checkRequiredFields(scenario: any): void {
    if (!scenario.version) {
      this.addWarning('Missing required field: version');
    }
    
    if (!scenario.cues || !Array.isArray(scenario.cues)) {
      this.addWarning('Missing or invalid field: cues');
    } else {
      scenario.cues.forEach((cue: any, index: number) => {
        if (!cue.id) {
          this.addWarning(`Cue ${index} missing required field: id`);
        }
      });
    }
  }

  /**
   * 시간 배열 검증
   */
  private validateTimeArrays(obj: any, path = ''): void {
    const timeFields = ['displayTime', 'domLifetime', 'time_offset'];
    
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.validateTimeArrays(item, `${path}[${index}]`);
      });
    } else if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        const newPath = path ? `${path}.${key}` : key;
        
        if (timeFields.includes(key)) {
          if (!Array.isArray(value) || value.length !== 2) {
            this.addWarning(`Invalid time array at ${newPath}: expected [start, end]`);
          } else if (value[0] > value[1]) {
            this.addWarning(`Invalid time range at ${newPath}: start > end`);
          }
        }
        
        this.validateTimeArrays(value, newPath);
      });
    }
  }

  /**
   * 경고 메시지 추가
   */
  private addWarning(message: string): void {
    this.warnings.push(message);
    
    if (this.options.showWarnings) {
      console.warn(`[V13ToV20Migrator] ${message}`);
    }
  }

  /**
   * 정적 편의 메서드
   */
  static migrateQuick(v13Scenario: any, options?: MigrationOptions): ScenarioV2 {
    const migrator = new V13ToV20Migrator(options);
    return migrator.migrate(v13Scenario).scenario;
  }
}