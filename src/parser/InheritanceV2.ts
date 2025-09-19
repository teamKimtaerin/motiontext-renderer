// Inheritance v2.0 - v2.0 상속 시스템
// Reference: context/scenario-json-spec-v-2-0.md
//
// v2.0 상속 우선순위:
// 1. 직접 명시된 값 (최우선)
// 2. Define 참조 값
// 3. 부모 노드에서 상속
// 4. 트랙 기본값
// 5. 시스템 기본값

import type {
  Scenario,
  Node,
  Track,
  TimeRange,
  ResolvedNodeUnion,
} from '../types/scenario-v2';
import type { TextStyle, BoxStyle } from '../types/layout';

// 상속 우선순위 설정
type InheritancePriority = 'direct' | 'parent' | 'track' | 'system';

// 필드별 상속 규칙 설정
interface FieldInheritanceRule {
  priority: InheritancePriority[];
  merge?: boolean; // 병합이 필요한 필드 (예: style)
  systemDefault?: any; // 시스템 기본값
}

// 상속 규칙 구성
const INHERITANCE_RULES: Record<string, FieldInheritanceRule> = {
  displayTime: {
    priority: ['direct', 'parent', 'system'],
    systemDefault: [-Infinity, Infinity],
  },
  // layout 제거 - 각 요소의 고유한 위치/크기이므로 상속하지 않음

  // 선택적 상속 가능한 layout 속성들
  anchor: {
    priority: ['direct', 'parent', 'track'], // anchor만 선택적 상속
    systemDefault: undefined,
  },
  safeAreaClamp: {
    priority: ['direct', 'parent'],
    systemDefault: undefined,
  },
  style: {
    priority: ['direct', 'parent', 'track'],
    merge: true, // 텍스트 스타일은 병합
    systemDefault: undefined,
  },
  boxStyle: {
    priority: ['direct', 'track'], // 부모에서 상속받지 않음, 그룹 노드만 트랙에서 상속
    merge: true, // 박스 스타일은 병합
    systemDefault: undefined,
  },
  pluginChain: {
    priority: ['direct'], // 각 노드별 고유 효과
    systemDefault: undefined,
  },
  effectScope: {
    priority: ['direct', 'parent'],
    systemDefault: undefined,
  },
};

// 기본 상속 규칙 (등록되지 않은 필드용)
const DEFAULT_INHERITANCE_RULE: FieldInheritanceRule = {
  priority: ['direct', 'parent', 'track', 'system'],
  systemDefault: undefined,
};

/**
 * v2.0 시나리오 상속 시스템 적용
 * @param scenario - Define이 해결된 시나리오
 * @returns 상속이 적용된 시나리오
 */
export function applyInheritance(scenario: Scenario): Scenario {
  // 트랙별 기본값을 매핑으로 생성
  const trackDefaults = new Map<string, Track>();
  for (const track of scenario.tracks) {
    trackDefaults.set(track.id, track);
  }

  const debugMode = (globalThis as any).__MTX_DEBUG_MODE__ || false;

  // 각 Cue에 상속 적용
  const inheritedCues = scenario.cues.map((cue, index) => {
    const track = trackDefaults.get(cue.track);

    if (debugMode) {
      // eslint-disable-next-line no-console
      console.log(`[Inheritance] Processing cue ${index}: ${cue.id}`, {
        displayTime: (cue as any).displayTime,
        domLifetime: cue.domLifetime,
        track: track?.id,
      });
    }

    const inheritedCue = {
      ...cue,
      // domLifetime 상속 (Cue 레벨에서는 부모가 없으므로 트랙 기본값만)
      domLifetime: cue.domLifetime || getDefaultDomLifetime(cue.root),
      // 루트 노드에 상속 적용 (Cue의 displayTime을 컨텍스트로 전달)
      root: applyNodeInheritance(
        cue.root,
        null,
        track,
        (cue as any).displayTime
      ),
    };

    if (debugMode) {
      // eslint-disable-next-line no-console
      console.log(`[Inheritance] Cue ${cue.id} inheritance completed`, {
        originalDisplayTime: (cue as any).displayTime,
        inheritedRoot: inheritedCue.root,
      });
    }

    return inheritedCue;
  });

  return {
    ...scenario,
    cues: inheritedCues,
  };
}

/**
 * 노드 상속 적용 (재귀)
 * @param node - 현재 노드
 * @param parent - 부모 노드 (없으면 null)
 * @param track - 소속 트랙
 * @param cueDisplayTime - Cue의 displayTime (최상위 컨텍스트)
 * @returns 상속이 적용된 노드
 */
function applyNodeInheritance(
  node: Node,
  parent: ResolvedNodeUnion | null,
  track: Track | undefined,
  cueDisplayTime?: TimeRange
): ResolvedNodeUnion {
  const debugMode = (globalThis as any).__MTX_DEBUG_MODE__ || false;

  // 모든 원본 필드를 복사하여 상속된 노드 생성
  const inheritedNode = { ...node };

  if (debugMode) {
    // eslint-disable-next-line no-console
    console.log(`[Inheritance] Processing node: ${node.id || 'unknown'}`, {
      nodeType: node.eType,
      hasDisplayTime: !!(node as any).displayTime,
      parentDisplayTime: parent?.displayTime,
      cueDisplayTime,
      fields: Object.keys(node),
    });
  }

  // INHERITANCE_RULES에 정의된 필드들에만 상속 로직 적용
  for (const fieldName of Object.keys(INHERITANCE_RULES)) {
    const originalValue = inheritedNode[fieldName as keyof Node];
    inheritedNode[fieldName as keyof Node] = inheritField(
      fieldName,
      node,
      parent,
      track,
      cueDisplayTime
    );

    if (debugMode && fieldName === 'displayTime') {
      // eslint-disable-next-line no-console
      console.log(`[Inheritance] ${fieldName} inheritance:`, {
        nodeId: node.id || 'unknown',
        original: originalValue,
        inherited: inheritedNode[fieldName as keyof Node],
        parentValue: parent?.[fieldName as keyof ResolvedNodeUnion],
        cueValue: cueDisplayTime,
      });
    }
  }

  // Backward compatibility: automatically split legacy style into style and boxStyle
  if (node.eType === 'group') {
    const groupNode = inheritedNode as any;
    const legacyStyle = groupNode.style;

    if (legacyStyle && !groupNode.boxStyle) {
      const {
        backgroundColor,
        boxBg,
        border,
        padding,
        borderRadius,
        opacity,
        ...textStyle
      } = legacyStyle;

      // If any box-related properties exist, split them
      if (backgroundColor || boxBg || border || padding || borderRadius || opacity !== undefined) {
        groupNode.style = textStyle;
        groupNode.boxStyle = {
          backgroundColor,
          boxBg,
          border,
          padding,
          borderRadius,
          opacity
        };
      }
    }
  }

  // 노드 타입별 처리
  if (node.eType === 'group') {
    const groupNode = inheritedNode as ResolvedNodeUnion & {
      eType: 'group';
      children?: Node[];
    };

    return {
      ...groupNode,
      children: groupNode.children?.map((child) =>
        applyNodeInheritance(
          child,
          inheritedNode as ResolvedNodeUnion,
          track,
          cueDisplayTime
        )
      ),
    };
  }

  // text, image, video 노드는 추가 처리 없음
  return inheritedNode as ResolvedNodeUnion;
}

/**
 * 통합 필드 상속 로직
 * @param fieldName - 상속할 필드명
 * @param node - 현재 노드
 * @param parent - 부모 노드
 * @param track - 소속 트랙
 * @param cueDisplayTime - Cue의 displayTime (최상위 컨텍스트)
 * @returns 상속된 값
 */
function inheritField(
  fieldName: string,
  node: Node,
  parent: ResolvedNodeUnion | null,
  track: Track | undefined,
  cueDisplayTime?: TimeRange
): any {
  const rule = INHERITANCE_RULES[fieldName] || DEFAULT_INHERITANCE_RULE;

  // 특수 필드 처리 (pluginChain 등)
  if (fieldName === 'pluginChain') {
    // pluginChain은 각 노드별 고유하므로 상속되지 않음
    return (node as any)[fieldName] || rule.systemDefault;
  }

  const values: any[] = [];

  // 우선순위에 따라 값 수집
  for (const priority of rule.priority) {
    let value: any = undefined;

    switch (priority) {
      case 'direct':
        value = (node as any)[fieldName];
        break;
      case 'parent':
        value = parent ? (parent as any)[fieldName] : undefined;
        break;
      case 'track':
        // 특정 필드에 대한 트랙 기본값 처리
        if (fieldName === 'style') {
          value = track?.defaultStyle;
        } else if (fieldName === 'boxStyle') {
          // boxStyle은 그룹 노드일 때만 트랙에서 상속
          if (node.eType === 'group') {
            value = track?.defaultBoxStyle;
          }
        } else if (
          fieldName === 'anchor' &&
          track?.defaultConstraints?.anchor
        ) {
          value = track.defaultConstraints.anchor;
        }
        // 다른 필드들은 향후 확장 가능
        break;
      case 'system':
        // displayTime의 경우 Cue의 displayTime을 우선 사용
        if (fieldName === 'displayTime' && cueDisplayTime) {
          value = cueDisplayTime;
        } else {
          value = rule.systemDefault;
        }
        break;
    }

    if (value !== undefined) {
      values.push(value);
    }
  }

  // 값이 없으면 시스템 기본값 또는 undefined
  if (values.length === 0) {
    return rule.systemDefault;
  }

  // 병합이 필요한 필드 처리
  if (rule.merge) {
    if (fieldName === 'style') {
      return mergeStyles(...values.filter((v) => v !== undefined));
    } else if (fieldName === 'boxStyle') {
      return mergeBoxStyles(...values.filter((v) => v !== undefined));
    }
    // layout 병합 제거 - layout은 더이상 상속하지 않음
  }

  // 일반 필드는 첫 번째 값 (가장 높은 우선순위) 반환
  return values[0];
}

/**
 * 스타일 병합 유틸리티
 * @param styles - 병합할 스타일 배열 (나중 것이 우선)
 * @returns 병합된 스타일
 */
function mergeStyles(...styles: Style[]): Style {
  const merged: Style = {};

  for (const style of styles) {
    if (style) {
      // 깊은 복사로 병합
      Object.assign(merged, style);
    }
  }

  return merged;
}

/**
 * BoxStyle 병합 함수
 * 우선순위에 따라 BoxStyle 객체들을 병합 (나중 객체가 우선)
 * @param styles - 병합할 BoxStyle 배열 (우선순위 순: direct → track)
 * @returns 병합된 BoxStyle
 */
function mergeBoxStyles(...styles: BoxStyle[]): BoxStyle {
  const merged: BoxStyle = {};

  // 순서대로 병합하여 나중 값이 우선하도록 (direct가 먼저, track이 나중이므로 track이 덮어씀)
  // 하지만 우리는 direct가 우선해야 하므로 역순으로 병합
  for (let i = styles.length - 1; i >= 0; i--) {
    const style = styles[i];
    if (style && typeof style === 'object') {
      Object.assign(merged, style);
    }
  }

  return merged;
}

/**
 * 노드 구조를 분석하여 기본 domLifetime 계산
 * @param rootNode - 루트 노드
 * @returns 계산된 domLifetime
 */
function getDefaultDomLifetime(rootNode: Node): TimeRange {
  const allDisplayTimes: TimeRange[] = [];

  // 노드 트리에서 모든 displayTime 수집
  collectDisplayTimes(rootNode, allDisplayTimes);

  if (allDisplayTimes.length === 0) {
    // displayTime이 없으면 넉넉한 기본값
    return [-1, Infinity];
  }

  // 모든 displayTime의 범위 계산
  const starts = allDisplayTimes
    .map(([start]) => start)
    .filter((t) => Number.isFinite(t));
  const ends = allDisplayTimes
    .map(([, end]) => end)
    .filter((t) => Number.isFinite(t));

  const minStart = starts.length > 0 ? Math.min(...starts) : 0;
  const maxEnd = ends.length > 0 ? Math.max(...ends) : 10;

  // preload를 위해 약간 앞서 시작, cleanup을 위해 약간 늦게 종료
  return [minStart - 0.5, maxEnd + 0.5];
}

/**
 * 노드 트리에서 모든 displayTime 수집 (재귀)
 */
function collectDisplayTimes(node: Node, collected: TimeRange[]): void {
  if (node.displayTime) {
    const timeRange = node.displayTime as TimeRange;
    if (Number.isFinite(timeRange[0]) && Number.isFinite(timeRange[1])) {
      collected.push(timeRange);
    }
  }

  if (node.eType === 'group' && node.children) {
    for (const child of node.children) {
      collectDisplayTimes(child, collected);
    }
  }
}

/**
 * 상속 결과 디버깅 정보 생성
 * @param original - 원본 시나리오
 * @param inherited - 상속 적용된 시나리오
 * @returns 디버깅 정보
 */
export function generateInheritanceDebugInfo(
  original: Scenario,
  inherited: Scenario
): {
  cueCount: number;
  nodeCount: number;
  inheritedDisplayTimes: number;
  inheritedStyles: number;
  generatedDomLifetimes: number;
} {
  let nodeCount = 0;
  let inheritedDisplayTimes = 0;
  let inheritedStyles = 0;
  let generatedDomLifetimes = 0;

  for (let i = 0; i < inherited.cues.length; i++) {
    const originalCue = original.cues[i];
    const inheritedCue = inherited.cues[i];

    // domLifetime 생성 여부 확인
    if (!originalCue.domLifetime && inheritedCue.domLifetime) {
      generatedDomLifetimes++;
    }

    // 노드별 상속 분석
    analyzeNodeInheritance(
      originalCue.root,
      inheritedCue.root as ResolvedNodeUnion,
      {
        nodeCount: () => nodeCount++,
        inheritedDisplayTime: () => inheritedDisplayTimes++,
        inheritedStyle: () => inheritedStyles++,
      }
    );
  }

  return {
    cueCount: inherited.cues.length,
    nodeCount,
    inheritedDisplayTimes,
    inheritedStyles,
    generatedDomLifetimes,
  };
}

/**
 * 노드별 상속 분석 (재귀)
 */
function analyzeNodeInheritance(
  original: Node,
  inherited: ResolvedNodeUnion,
  counters: {
    nodeCount: () => void;
    inheritedDisplayTime: () => void;
    inheritedStyle: () => void;
  }
): void {
  counters.nodeCount();

  // displayTime 상속 확인
  if (!original.displayTime && inherited.displayTime) {
    counters.inheritedDisplayTime();
  }

  // style 상속 확인 (병합도 상속으로 카운트)
  if (
    (!original.style && inherited.style) ||
    (original.style && inherited.style && original.style !== inherited.style)
  ) {
    counters.inheritedStyle();
  }

  // group 노드 재귀
  if (original.eType === 'group' && inherited.eType === 'group') {
    const originalChildren = original.children || [];
    const inheritedChildren = inherited.children || [];

    for (
      let i = 0;
      i < Math.min(originalChildren.length, inheritedChildren.length);
      i++
    ) {
      analyzeNodeInheritance(
        originalChildren[i],
        inheritedChildren[i],
        counters
      );
    }
  }
}
