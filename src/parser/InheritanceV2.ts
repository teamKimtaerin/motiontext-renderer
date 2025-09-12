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
  ResolvedNodeUnion 
} from '../types/scenario-v2';
import type { Layout, Style } from '../types/layout';

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
  
  // 각 Cue에 상속 적용
  const inheritedCues = scenario.cues.map(cue => {
    const track = trackDefaults.get(cue.track);
    
    return {
      ...cue,
      // domLifetime 상속 (Cue 레벨에서는 부모가 없으므로 트랙 기본값만)
      domLifetime: cue.domLifetime || getDefaultDomLifetime(cue.root),
      // 루트 노드에 상속 적용
      root: applyNodeInheritance(cue.root, null, track)
    };
  });
  
  return {
    ...scenario,
    cues: inheritedCues
  };
}

/**
 * 노드 상속 적용 (재귀)
 * @param node - 현재 노드
 * @param parent - 부모 노드 (없으면 null)
 * @param track - 소속 트랙
 * @returns 상속이 적용된 노드
 */
function applyNodeInheritance(
  node: Node, 
  parent: ResolvedNodeUnion | null, 
  _track: Track | undefined
): ResolvedNodeUnion {
  // 1. displayTime 상속
  const inheritedDisplayTime = inheritDisplayTime(node, parent, _track);
  
  // 2. layout 상속
  const inheritedLayout = inheritLayout(node, parent, _track);
  
  // 3. style 상속 (병합)
  const inheritedStyle = inheritStyle(node, parent, _track);
  
  // 4. pluginChain 상속
  const inheritedPluginChain = inheritPluginChain(node, parent, _track);
  
  // 5. effectScope 상속
  const inheritedEffectScope = inheritEffectScope(node, parent, _track);
  
  // 기본 상속된 노드 생성
  const baseInherited = {
    ...node,
    displayTime: inheritedDisplayTime,
    layout: inheritedLayout,
    style: inheritedStyle,
    pluginChain: inheritedPluginChain,
    effectScope: inheritedEffectScope
  };
  
  // 노드 타입별 처리
  if (node.e_type === 'group') {
    const groupNode = baseInherited as ResolvedNodeUnion & { e_type: 'group'; children?: Node[] };
    
    return {
      ...groupNode,
      children: groupNode.children?.map(child => 
        applyNodeInheritance(child, baseInherited as ResolvedNodeUnion, _track)
      )
    };
  }
  
  // text, image, video 노드는 추가 처리 없음
  return baseInherited as ResolvedNodeUnion;
}

/**
 * displayTime 상속 로직
 */
function inheritDisplayTime(
  node: Node, 
  parent: ResolvedNodeUnion | null, 
  _track: Track | undefined
): TimeRange {
  // 1. 직접 명시 (최우선)
  if (node.displayTime) {
    return node.displayTime as TimeRange;
  }
  
  // 2. 부모에서 상속
  if (parent?.displayTime) {
    return parent.displayTime;
  }
  
  // 3. 트랙 기본값 (현재 v2.0에서는 트랙에 displayTime 기본값 없음)
  // 향후 확장 가능
  
  // 4. 시스템 기본값 (전체 시간)
  return [-Infinity, Infinity];
}

/**
 * layout 상속 로직
 */
function inheritLayout(
  node: Node, 
  _parent: ResolvedNodeUnion | null, 
  _track: Track | undefined
): Layout | undefined {
  // 1. 직접 명시
  if (node.layout) {
    return node.layout as Layout;
  }
  
  // 2. 부모에서 상속 (layout은 일반적으로 상속되지 않음)
  // 부모의 layout을 상속하면 겹침 문제가 발생할 수 있음
  
  // 3. 트랙 기본값 (현재 없음)
  
  // 4. undefined (기본값)
  return undefined;
}

/**
 * style 상속 및 병합 로직
 */
function inheritStyle(
  node: Node, 
  parent: ResolvedNodeUnion | null, 
  track: Track | undefined
): Style | undefined {
  // 상속 순서대로 스타일 수집
  const styles: (Style | undefined)[] = [
    track?.defaultStyle as Style | undefined,  // 트랙 기본값 (가장 낮은 우선순위)
    parent?.style,        // 부모 스타일
    node.style as Style | undefined           // 직접 명시 (최우선)
  ];
  
  // undefined가 아닌 스타일들만 필터링
  const validStyles = styles.filter((style): style is Style => style !== undefined);
  
  if (validStyles.length === 0) {
    return undefined;
  }
  
  // 스타일 병합 (나중 것이 우선)
  return mergeStyles(...validStyles);
}

/**
 * pluginChain 상속 로직
 */
function inheritPluginChain(
  node: Node, 
  _parent: ResolvedNodeUnion | null, 
  _track: Track | undefined
): any[] | undefined {
  // 1. 직접 명시 (최우선)
  if (node.pluginChain) {
    return node.pluginChain as any[];
  }
  
  // 2. 부모에서 상속할지는 정책에 따라
  // 일반적으로 pluginChain은 상속하지 않음 (각 노드별 고유 효과)
  
  // 3. 트랙 기본 플러그인 (향후 확장 가능)
  
  return undefined;
}

/**
 * effectScope 상속 로직
 */
function inheritEffectScope(
  node: Node, 
  parent: ResolvedNodeUnion | null, 
  _track: Track | undefined
): any | undefined {
  // 1. 직접 명시
  if (node.effectScope) {
    return node.effectScope;
  }
  
  // 2. 부모에서 상속
  if (parent?.effectScope) {
    return parent.effectScope;
  }
  
  // 3. 기본값
  return undefined;
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
  const starts = allDisplayTimes.map(([start]) => start).filter(t => Number.isFinite(t));
  const ends = allDisplayTimes.map(([, end]) => end).filter(t => Number.isFinite(t));
  
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
  
  if (node.e_type === 'group' && node.children) {
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
    analyzeNodeInheritance(originalCue.root, inheritedCue.root as ResolvedNodeUnion, {
      nodeCount: () => nodeCount++,
      inheritedDisplayTime: () => inheritedDisplayTimes++,
      inheritedStyle: () => inheritedStyles++
    });
  }
  
  return {
    cueCount: inherited.cues.length,
    nodeCount,
    inheritedDisplayTimes,
    inheritedStyles,
    generatedDomLifetimes
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
  if ((!original.style && inherited.style) || 
      (original.style && inherited.style && original.style !== inherited.style)) {
    counters.inheritedStyle();
  }
  
  // group 노드 재귀
  if (original.e_type === 'group' && inherited.e_type === 'group') {
    const originalChildren = original.children || [];
    const inheritedChildren = inherited.children || [];
    
    for (let i = 0; i < Math.min(originalChildren.length, inheritedChildren.length); i++) {
      analyzeNodeInheritance(originalChildren[i], inheritedChildren[i], counters);
    }
  }
}