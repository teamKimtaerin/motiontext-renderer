import type {
  DefineSection,
  Scenario as ScenarioV2,
} from '../types/scenario-v2';

/**
 * DefineResolver
 *
 * Define 섹션의 참조를 해석하여 실제 값으로 치환하는 클래스
 * - "define.keyname" 형태의 문자열을 감지하여 실제 값으로 변환
 * - 중첩 객체와 배열 순회 지원
 * - 순환 참조 검출 및 에러 처리
 * - parse-time 해석으로 런타임 성능 최적화
 */
export class DefineResolver {
  private readonly defines: DefineSection;
  private readonly visited: Set<string> = new Set();
  private readonly resolutionPath: string[] = [];

  constructor(defines: DefineSection = {}) {
    this.defines = defines;
  }

  /**
   * 시나리오 전체를 해석하여 Define 참조를 실제 값으로 치환
   * @param scenario v2.0 시나리오 객체
   * @returns Define 참조가 해석된 시나리오 객체
   */
  resolveScenario(scenario: ScenarioV2): ScenarioV2 {
    // 새로운 해석 세션 시작
    this.visited.clear();
    this.resolutionPath.length = 0;

    // 시나리오의 define 섹션을 현재 defines와 병합
    const combinedDefines = { ...this.defines, ...scenario.define };

    // 임시로 새 DefineResolver를 생성하여 병합된 defines 사용
    const tempResolver = new DefineResolver(combinedDefines);

    // 시나리오 전체를 해석
    const resolved = tempResolver.resolveObject(scenario) as ScenarioV2;

    return resolved;
  }

  /**
   * 객체를 순회하며 Define 참조를 해석
   * @param obj 해석할 객체
   * @param keyPath 현재 키 경로 (에러 메시지용)
   * @returns Define 참조가 해석된 객체
   */
  private resolveObject(obj: any, keyPath: string = ''): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // 문자열인 경우 Define 참조 확인
    if (typeof obj === 'string') {
      return this.resolveDefineReference(obj, keyPath);
    }

    // 배열인 경우 각 요소 해석
    if (Array.isArray(obj)) {
      return obj.map((item, index) =>
        this.resolveObject(item, `${keyPath}[${index}]`)
      );
    }

    // 객체인 경우 각 속성 해석
    if (typeof obj === 'object') {
      const resolved: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const newKeyPath = keyPath ? `${keyPath}.${key}` : key;
        resolved[key] = this.resolveObject(value, newKeyPath);
      }
      return resolved;
    }

    // 원시 타입은 그대로 반환
    return obj;
  }

  /**
   * Define 참조 문자열을 실제 값으로 해석 (중첩 경로 지원)
   * @param value 해석할 문자열 값
   * @param keyPath 현재 키 경로 (에러 메시지용)
   * @returns 해석된 값 또는 원본 문자열
   */
  private resolveDefineReference(value: string, keyPath: string): any {
    // "define.keyname" 패턴이 아니면 그대로 반환
    if (!value.startsWith('define.')) {
      return value;
    }

    const fullPath = value.substring(7); // "define." 제거
    const pathParts = fullPath.split('.');

    // 빈 키는 에러
    if (pathParts.length === 0 || !pathParts[0]) {
      throw new Error(`Invalid define reference: "${value}" at ${keyPath}`);
    }

    const rootKey = pathParts[0];

    // defines에서 키 찾기
    if (!(rootKey in this.defines)) {
      throw new Error(
        `Undefined define key: "${rootKey}" referenced at ${keyPath}`
      );
    }

    // 정확한 경로 기반 순환 참조 검출
    const fullRefPath = `define.${fullPath}`;
    if (this.resolutionPath.includes(fullRefPath)) {
      const cyclePath = [...this.resolutionPath, fullRefPath].join(' -> ');
      throw new Error(`Circular reference detected in define: ${cyclePath}`);
    }

    // 해석 경로에 추가 (순환 참조 추적용)
    this.visited.add(rootKey);
    this.resolutionPath.push(fullRefPath);

    try {
      // Root 값 해석
      let resolved = this.resolveObject(
        this.defines[rootKey],
        `define.${rootKey}`
      );

      // 중첩 경로가 있는 경우 깊이 탐색
      for (let i = 1; i < pathParts.length; i++) {
        const part = pathParts[i];
        if (resolved === null || resolved === undefined) {
          throw new Error(
            `Cannot access "${part}" on ${typeof resolved} at ${keyPath}`
          );
        }
        if (typeof resolved !== 'object') {
          throw new Error(
            `Cannot access property "${part}" on non-object at ${keyPath}`
          );
        }
        if (!(part in resolved)) {
          throw new Error(
            `Property "${part}" not found in define at ${keyPath}`
          );
        }
        resolved = resolved[part];
      }

      return resolved;
    } finally {
      // 해석 완료 후 경로에서 제거
      this.visited.delete(rootKey);
      this.resolutionPath.pop();
    }
  }

  /**
   * Define 섹션에서 사용 가능한 키 목록 반환
   * @returns 정의된 키 배열
   */
  getAvailableKeys(): string[] {
    return Object.keys(this.defines);
  }

  /**
   * 특정 키의 타입 확인
   * @param key 확인할 키
   * @returns 값의 타입
   */
  getKeyType(key: string): string | null {
    if (!(key in this.defines)) {
      return null;
    }
    const value = this.defines[key];
    if (Array.isArray(value)) {
      return 'array';
    }
    return typeof value;
  }
}
