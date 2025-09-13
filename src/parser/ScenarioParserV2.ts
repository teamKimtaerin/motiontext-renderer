// ScenarioParser v2.0 Native - v2.0 전용 파서
// Reference: context/scenario-json-spec-v-2-0.md
//
// v1.3 → v2.0 주요 변경사항:
// - v2.0만 지원 (v1.3 완전 거부)
// - Define 시스템 완전 통합
// - 시간 배열 검증 ([start, end])
// - 노드 ID 필수화
// - 상속 시스템 적용

import { DefineResolver } from './DefineResolver';
import type { Scenario } from '../types/scenario-v2';
import { validateScenario } from './ValidationV2';
import { applyInheritance } from './InheritanceV2';

/**
 * v2.0 시나리오 전용 파서
 * @param input - JSON 입력 (v2.0만 지원)
 * @returns 검증되고 해결된 ScenarioV2
 * @throws Error - v1.3 시나리오이거나 유효하지 않은 경우
 */
export function parseScenario(input: unknown): Scenario {
  // 기본 타입 검증
  if (!input || typeof input !== 'object') {
    throw new Error('Scenario must be a valid JSON object');
  }

  const raw = input as Record<string, unknown>;

  // v2.0만 지원
  if (raw.version !== '2.0') {
    const version = raw.version || 'unknown';
    throw new Error(
      `Only v2.0 scenarios are supported, got version "${version}". ` +
        'Use migration tools to convert v1.3 scenarios to v2.0.'
    );
  }

  // DefineResolver로 모든 define 참조 해결
  const resolver = new DefineResolver(raw.define as any);
  const resolvedRaw = resolver.resolveScenario(raw as any);
  const resolved = resolvedRaw as unknown as Scenario;

  // v2.0 검증 (시간 배열, ID, 참조 등)
  validateScenario(resolved);

  // 상속 시스템 적용
  const inherited = applyInheritance(resolved);

  return inherited;
}

/**
 * 시나리오가 v2.0인지 확인
 * @param input - 검사할 객체
 * @returns v2.0이면 true
 */
export function isScenarioV2(input: unknown): input is Scenario {
  try {
    if (!input || typeof input !== 'object') return false;
    const obj = input as Record<string, unknown>;
    return obj.version === '2.0';
  } catch {
    return false;
  }
}

/**
 * 시나리오 버전 감지
 * @param input - JSON 객체
 * @returns 버전 문자열 또는 null
 */
export function detectScenarioVersion(input: unknown): string | null {
  try {
    if (!input || typeof input !== 'object') return null;
    const obj = input as Record<string, unknown>;
    return typeof obj.version === 'string' ? obj.version : null;
  } catch {
    return null;
  }
}

/**
 * 안전한 시나리오 파싱 (에러 대신 결과 객체 반환)
 * @param input - JSON 입력
 * @returns 성공/실패 결과
 */
export function safeParseScenario(
  input: unknown
):
  | { success: true; data: Scenario; version: '2.0' }
  | { success: false; error: string; version: string | null } {
  const version = detectScenarioVersion(input);

  try {
    const scenario = parseScenario(input);
    return { success: true, data: scenario, version: '2.0' };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown parsing error';
    return { success: false, error: message, version };
  }
}

/**
 * 개발/디버그용 파서 (더 자세한 에러 정보)
 * @param input - JSON 입력
 * @param debugPath - 디버그 경로 (선택적)
 * @returns 파싱된 시나리오
 */
export function parseScenarioDebug(
  input: unknown,
  debugPath?: string
): Scenario {
  const prefix = debugPath ? `[${debugPath}] ` : '';

  try {
    return parseScenario(input);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${prefix}${error.message}`);
    }
    throw new Error(`${prefix}Unknown parsing error`);
  }
}
