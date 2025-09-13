// Validation v2.0 - v2.0 시나리오 검증 로직
// Reference: context/scenario-json-spec-v-2-0.md
//
// v2.0 검증 특징:
// - displayTime, domLifetime, time_offset 배열 검증
// - [start, end] 형식 및 start <= end 조건
// - 노드 ID 필수 및 중복 검사
// - 트랙 참조 유효성
// - Define 참조 해결 후 검증

import type { Scenario, Node } from '../types/scenario-v2';
import { validateTimeRange } from '../utils/time-v2';

export class ValidationError extends Error {
  constructor(message: string, public readonly path?: string) {
    super(path ? `[${path}] ${message}` : message);
    this.name = 'ValidationError';
  }
}

/**
 * v2.0 시나리오 전체 검증
 * @param scenario - 검증할 시나리오
 * @throws ValidationError - 검증 실패 시
 */
export function validateScenario(scenario: Scenario): void {
  // 버전 재확인
  if (scenario.version !== '2.0') {
    throw new ValidationError(`Invalid version: expected "2.0", got "${scenario.version}"`);
  }

  // 필수 필드 검증
  validateRequiredFields(scenario);
  
  // 시간 배열 검증
  validateTimeArrays(scenario);
  
  // 노드 ID 검증
  validateNodeIds(scenario);
  
  // 트랙 참조 검증
  validateTrackReferences(scenario);
  
  // 시간 논리 검증 (displayTime vs domLifetime)
  validateTimeLogic(scenario);
}

/**
 * 필수 필드 존재 여부 검증
 */
function validateRequiredFields(scenario: Scenario): void {
  if (!scenario.timebase) {
    throw new ValidationError('Missing required field: timebase');
  }
  
  if (!scenario.stage) {
    throw new ValidationError('Missing required field: stage');
  }
  
  if (!Array.isArray(scenario.tracks)) {
    throw new ValidationError('tracks must be an array');
  }
  
  if (!Array.isArray(scenario.cues)) {
    throw new ValidationError('cues must be an array');
  }

  // timebase 검증
  if (scenario.timebase.unit !== 'seconds') {
    throw new ValidationError(`timebase.unit must be "seconds", got "${scenario.timebase.unit}"`);
  }
  
  if (scenario.timebase.fps !== undefined) {
    if (typeof scenario.timebase.fps !== 'number' || scenario.timebase.fps <= 0) {
      throw new ValidationError('timebase.fps must be a positive number');
    }
  }

  // stage 검증
  const validAspects = ['16:9', '9:16', 'auto'];
  if (!validAspects.includes(scenario.stage.baseAspect)) {
    throw new ValidationError(`stage.baseAspect must be one of: ${validAspects.join(', ')}`);
  }
}

/**
 * 모든 시간 배열 필드 검증
 */
function validateTimeArrays(scenario: Scenario): void {
  // Cue의 domLifetime 검증
  for (let i = 0; i < scenario.cues.length; i++) {
    const cue = scenario.cues[i];
    const path = `cues[${i}]`;
    
    if (cue.domLifetime) {
      try {
        validateTimeRange(cue.domLifetime);
      } catch (error) {
        throw new ValidationError(`${path}.domLifetime: ${error instanceof Error ? error.message : 'Invalid time range'}`);
      }
    }
    
    // 노드 재귀 검증
    validateNodeTimeArrays(cue.root, `${path}.root`);
  }
}

/**
 * 노드 계층 구조 시간 배열 검증 (재귀)
 */
function validateNodeTimeArrays(node: Node, path: string): void {
  // displayTime 검증
  if (node.displayTime) {
    try {
      validateTimeRange(node.displayTime);
    } catch (error) {
      throw new ValidationError(`${path}.displayTime: ${error instanceof Error ? error.message : 'Invalid time range'}`);
    }
  }
  
  // pluginChain의 time_offset 검증
  if (node.pluginChain) {
    for (let i = 0; i < node.pluginChain.length; i++) {
      const plugin = node.pluginChain[i];
      const pluginPath = `${path}.pluginChain[${i}]`;
      
      if (typeof plugin !== 'string' && (plugin as any).time_offset) {
        const off = (plugin as any).time_offset;
        // 새 규칙: 숫자(초) 또는 백분율 문자열("50%") 허용
        if (!Array.isArray(off) || off.length !== 2) {
          throw new ValidationError(`${pluginPath}.time_offset must be [start, end] array`);
        }
        for (let k = 0; k < 2; k++) {
          const v = off[k];
          const ok = (
            typeof v === 'number' && Number.isFinite(v)
          ) || (
            typeof v === 'string' && /^\s*-?\d+(?:\.\d+)?%?\s*$/.test(v)
          );
          if (!ok) {
            throw new ValidationError(`${pluginPath}.time_offset[${k}] must be a number (seconds) or percentage string like '50%'`);
          }
        }
      }
    }
  }
  
  // group 노드의 children 재귀 검증
  if (node.e_type === 'group' && node.children) {
    for (let i = 0; i < node.children.length; i++) {
      validateNodeTimeArrays(node.children[i], `${path}.children[${i}]`);
    }
  }
}

/**
 * 노드 ID 필수성 및 중복 검사
 */
function validateNodeIds(scenario: Scenario): void {
  const allNodeIds = new Set<string>();
  const nodeIdPaths = new Map<string, string>(); // ID -> path 매핑
  
  for (let i = 0; i < scenario.cues.length; i++) {
    const cue = scenario.cues[i];
    const path = `cues[${i}]`;
    
    // Cue ID 검증
    if (!cue.id || typeof cue.id !== 'string') {
      throw new ValidationError(`${path}.id: Cue ID is required and must be a non-empty string`);
    }
    
    if (allNodeIds.has(cue.id)) {
      throw new ValidationError(`Duplicate cue ID: "${cue.id}" (conflicts with ${nodeIdPaths.get(cue.id)})`);
    }
    
    allNodeIds.add(cue.id);
    nodeIdPaths.set(cue.id, path);
    
    // 노드 ID 재귀 검증
    validateNodeIdRecursive(cue.root, `${path}.root`, allNodeIds, nodeIdPaths);
  }
}

/**
 * 노드 ID 재귀 검증
 */
function validateNodeIdRecursive(
  node: Node, 
  path: string, 
  allIds: Set<string>, 
  idPaths: Map<string, string>
): void {
  // 노드 ID 필수
  if (!node.id || typeof node.id !== 'string') {
    throw new ValidationError(`${path}.id: Node ID is required and must be a non-empty string`);
  }
  
  // 중복 검사
  if (allIds.has(node.id)) {
    throw new ValidationError(`Duplicate node ID: "${node.id}" (conflicts with ${idPaths.get(node.id)})`);
  }
  
  allIds.add(node.id);
  idPaths.set(node.id, path);
  
  // group 노드의 children 재귀
  if (node.e_type === 'group' && node.children) {
    for (let i = 0; i < node.children.length; i++) {
      validateNodeIdRecursive(node.children[i], `${path}.children[${i}]`, allIds, idPaths);
    }
  }
}

/**
 * 트랙 참조 유효성 검증
 */
function validateTrackReferences(scenario: Scenario): void {
  const trackIds = new Set(scenario.tracks.map(track => track.id));
  
  // 트랙 ID 중복 검사
  const trackIdCounts = new Map<string, number>();
  for (const track of scenario.tracks) {
    trackIdCounts.set(track.id, (trackIdCounts.get(track.id) || 0) + 1);
  }
  
  for (const [id, count] of trackIdCounts) {
    if (count > 1) {
      throw new ValidationError(`Duplicate track ID: "${id}"`);
    }
  }
  
  // Cue의 track 참조 검증
  for (let i = 0; i < scenario.cues.length; i++) {
    const cue = scenario.cues[i];
    const path = `cues[${i}]`;
    
    if (!cue.track || typeof cue.track !== 'string') {
      throw new ValidationError(`${path}.track: Track reference is required and must be a string`);
    }
    
    if (!trackIds.has(cue.track)) {
      throw new ValidationError(`${path}.track: Unknown track ID "${cue.track}"`);
    }
  }
}

/**
 * 시간 논리 검증 (displayTime과 domLifetime 관계)
 */
function validateTimeLogic(scenario: Scenario): void {
  for (let i = 0; i < scenario.cues.length; i++) {
    const cue = scenario.cues[i];
    const path = `cues[${i}]`;
    
    if (cue.domLifetime) {
      const [domStart, domEnd] = cue.domLifetime as [number, number];
      
      // domLifetime은 모든 노드의 displayTime을 포함해야 함
      validateDomLifetimeCoversNodes(cue.root, domStart, domEnd, `${path}.root`);
    }
  }
}

/**
 * domLifetime이 모든 노드의 displayTime을 커버하는지 검증 (재귀)
 */
function validateDomLifetimeCoversNodes(
  node: Node, 
  domStart: number, 
  domEnd: number, 
  path: string
): void {
  if (node.displayTime) {
    const [nodeStart, nodeEnd] = node.displayTime as [number, number];
    
    // domLifetime이 노드보다 충분히 앞서 시작해야 함 (preload 고려)
    if (nodeStart < domStart) {
      console.warn(
        `Warning: ${path}.displayTime starts (${nodeStart}) before domLifetime (${domStart}). ` +
        'This may cause late DOM mounting.'
      );
    }
    
    // domLifetime이 노드 종료 후에도 유지되어야 함 (cleanup 고려)
    if (nodeEnd > domEnd) {
      console.warn(
        `Warning: ${path}.displayTime ends (${nodeEnd}) after domLifetime (${domEnd}). ` +
        'This may cause early DOM unmounting.'
      );
    }
  }
  
  // group 노드의 children 재귀
  if (node.e_type === 'group' && node.children) {
    for (let i = 0; i < node.children.length; i++) {
      validateDomLifetimeCoversNodes(node.children[i], domStart, domEnd, `${path}.children[${i}]`);
    }
  }
}

/**
 * 개발/디버그용 검증 (경고를 에러로 승격)
 * @param scenario - 검증할 시나리오
 * @param strict - 엄격 모드 (경고도 에러로 처리)
 */
export function validateScenarioStrict(scenario: Scenario, strict = false): void {
  // 기본 검증
  validateScenario(scenario);
  
  if (strict) {
    // 엄격 모드에서는 console.warn을 에러로 변환
    const originalWarn = console.warn;
    console.warn = (message: string) => {
      throw new ValidationError(`Strict validation failed: ${message}`);
    };
    
    try {
      validateTimeLogic(scenario);
    } finally {
      console.warn = originalWarn;
    }
  }
}
