// Renderer v2.0 Native - v2.0 네이티브 렌더러 코어
// Reference: context/scenario-json-spec-v-2-0.md
//
// v1.3 → v2.0 주요 변경사항:
// - displayTime: [start, end] 배열 직접 처리
// - v1.3 필드 완전 제거 (absStart/absEnd, relStart/relEnd)
// - isWithinTimeRange, progressInTimeRange 사용
// - 플러그인 v3.0 지원
// - domLifetime 기반 DOM 생명주기

import type { 
  Scenario, 
  Cue, 
  ResolvedNodeUnion, 
  TimeRange 
} from '../types/scenario-v2';
import type { PluginSpec, TimelineLike, SeekApplier } from '../types/plugin-v3';
import type { Channels } from '../types/plugin-v3';
import {
  isWithinTimeRange,
  progressInTimeRange,
  computePluginWindowFromBase
} from '../utils/time-v2';
import { DefineResolver } from '../parser/DefineResolver';
import { devRegistry } from '../loader/dev/DevPluginRegistry';
import { createPluginContextV3, type PluginContextV3 } from '../runtime/PluginContextV3';
import { applyLayoutWithConstraints } from '../layout/LayoutEngine';
import { getDefaultTrackConstraints } from '../layout/DefaultConstraints';
import { TimelineControllerV2, type TimelineOptions, type TickCallback } from './TimelineControllerV2';
import { Stage } from './Stage';
import { TrackManager } from './TrackManager';
import { applyDomSeparation, applyCSSVariableChannels } from '../runtime/DomSeparation';
import { isBuiltinPlugin as isBuiltinPluginV2, evaluateBuiltinPlugin } from '../runtime/plugins/BuiltinV2';

/**
 * DOM 플러그인 상태 관리 인터페이스
 */
interface DomPluginState {
  plugin: PluginSpec;
  initialized: boolean;
  seekFunction?: SeekApplier | TimelineLike;
  context?: PluginContextV3;
}

export interface RendererOptions {
  container: HTMLElement;
  preloadMs?: number; // default 300ms
  snapToFrame?: boolean;
  fps?: number;
  debugMode?: boolean;
}

export interface MountedElement {
  node: ResolvedNodeUnion;
  element: HTMLElement;
  cueId: string;
  mountTime: number;
}

/**
 * MotionText Renderer v2.0 Native
 * v2.0 시나리오를 네이티브로 처리하는 렌더러
 */
export class RendererV2 {
  private container: HTMLElement;
  private scenario: Scenario | null = null;
  private mountedElements = new Map<string, MountedElement>();
  
  // DOM 플러그인 상태 관리: nodeId → pluginName → DomPluginState
  private domPluginStates = new Map<string, Map<string, DomPluginState>>();
  private options: Required<RendererOptions>;
  private lastUpdateTime = 0;
  private defineResolver: DefineResolver = new DefineResolver();
  private timeline: TimelineControllerV2;
  private stage: Stage;
  private trackManager: TrackManager;
  
  constructor(options: RendererOptions) {
    this.container = options.container;
    this.options = {
      preloadMs: 300,
      snapToFrame: false,
      fps: 30,
      debugMode: false,
      ...options
    };
    
    // Initialize TimelineController
    const timelineOptions: TimelineOptions = {
      autoStart: true,
      snapToFrame: this.options.snapToFrame,
      fps: this.options.fps,
      debugMode: this.options.debugMode
    };
    this.timeline = new TimelineControllerV2(timelineOptions);
    
    // Register update callback
    this.timeline.onTick(this.onTimelineUpdate.bind(this));
    
    // Initialize Stage
    this.stage = new Stage();
    this.stage.setContainer(this.container);
    
    // Initialize TrackManager
    this.trackManager = new TrackManager();
    
    this.setupContainer();
  }

  /**
   * v2.0 시나리오 로드
   * @param scenario - 파싱된 v2.0 시나리오
   */
  setScenario(scenario: Scenario): void {
    // 상속 시스템에서 사용할 수 있도록 전역 변수에 debugMode 설정
    (globalThis as any).__MTX_DEBUG_MODE__ = this.options.debugMode;
    
    if (this.options.debugMode) {
      console.log('[RendererV2] setScenario called', {
        version: scenario.version,
        cuesCount: scenario.cues?.length || 0,
        tracksCount: scenario.tracks?.length || 0,
        hasDefine: !!scenario.define
      });
    }
    
    if (scenario.version !== '2.0') {
      throw new Error(`RendererV2 only supports v2.0 scenarios, got version "${scenario.version}"`);
    }
    
    this.scenario = scenario;
    this.unmountAll(); // 기존 요소들 정리
    
    // DefineResolver 초기화 - scenario의 define 섹션으로 새로 생성
    if (scenario.define) {
      this.defineResolver = new DefineResolver(scenario.define);
    }
    
    // Stage에 시나리오 설정
    this.stage.setScenario(scenario);
    
    // TrackManager에 시나리오 설정
    this.trackManager.setScenario(scenario);
    
    if (this.options.debugMode) {
      console.log('[RendererV2] Scenario loaded:', {
        version: scenario.version,
        cueCount: scenario.cues.length,
        trackCount: scenario.tracks.length,
        container: {
          width: this.container.clientWidth,
          height: this.container.clientHeight,
          styles: {
            position: this.container.style.position,
            overflow: this.container.style.overflow,
            visibility: getComputedStyle(this.container).visibility,
            display: getComputedStyle(this.container).display
          }
        }
      });
    }
  }

  /**
   * TimelineController에서 호출되는 업데이트 콜백
   * @param currentTime - 현재 재생 시간 (초)
   */
  private onTimelineUpdate: TickCallback = (currentTime) => {
    if (!this.scenario) {
      if (this.options.debugMode) {
        console.log(`[RendererV2] Timeline update but no scenario loaded`);
      }
      return;
    }
    
    this.lastUpdateTime = currentTime;
    
    if (this.options.debugMode) {
      console.log(`[RendererV2] Timeline update: t=${currentTime.toFixed(3)}s, cues=${this.scenario.cues.length}`);
    }
    
    // Cue별 처리
    for (const cue of this.scenario.cues) {
      this.processCue(cue, currentTime);
    }
    
    if (this.options.debugMode) {
      this.logDebugInfo(currentTime);
    }
  };

  /**
   * 현재 시간에 따른 렌더링 업데이트 (수동 호출용)
   * @param currentTime - 현재 재생 시간 (초)
   */
  update(currentTime: number): void {
    this.onTimelineUpdate(currentTime);
  }

  /**
   * 개별 Cue 처리
   */
  private processCue(cue: Cue, currentTime: number): void {
    const track = this.getTrack(cue.track);
    if (!track) {
      console.warn(`[RendererV2] Unknown track: ${cue.track}`);
      return;
    }
    
    // domLifetime 체크 (DOM 생명주기 관리)
    if (cue.domLifetime) {
      const [domStart, domEnd] = cue.domLifetime as TimeRange;
      
      if (!this.isWithinDomLifetime(currentTime, domStart, domEnd)) {
        this.unmountCue(cue);
        return;
      }
    }
    
    // 루트 노드 처리
    this.processNode(cue.root as ResolvedNodeUnion, cue, track, currentTime);
  }

  /**
   * 개별 노드 처리 (재귀)
   */
  private processNode(
    node: ResolvedNodeUnion,
    cue: Cue,
    track: any,
    currentTime: number,
    parentNodeId?: string
  ): void {
    const nodeId = `${cue.id}:${node.id}`;
    
    // displayTime 체크
    const [displayStart, displayEnd] = node.displayTime || [-Infinity, Infinity];
    const isActive = isWithinTimeRange(currentTime, [displayStart, displayEnd]);
    
    if (isActive) {
      this.ensureMounted(node, cue, nodeId, track, parentNodeId);
      this.updateNode(node, currentTime, nodeId, track);
    } else {
      this.unmountNode(nodeId);
    }
    
    // group 노드의 children 재귀 처리
    if (node.e_type === 'group' && node.children) {
      for (const child of node.children) {
        this.processNode(child, cue, track, currentTime, nodeId);
      }
    }
  }

  /**
   * 노드가 마운트되어 있는지 확인하고 필요시 마운트
   */
  private ensureMounted(
    node: ResolvedNodeUnion,
    cue: Cue,
    nodeId: string,
    track: any,
    parentNodeId?: string
  ): void {
    if (this.mountedElements.has(nodeId)) return;
    
    const element = this.createElement(node);
    // Annotate element with the composite node key (cueId:nodeId)
    try {
      (element as any).dataset = (element as any).dataset || {};
      element.dataset.nodeKey = nodeId;
      element.dataset.cueId = cue.id;
    } catch {}
    this.mountedElements.set(nodeId, {
      node,
      element,
      cueId: cue.id,
      mountTime: this.lastUpdateTime
    });
    // Determine parent DOM element (group nesting support)
    let parentEl: HTMLElement | null = null;
    if (parentNodeId) {
      const parentMounted = this.mountedElements.get(parentNodeId);
      parentEl = parentMounted?.element || null;
    }

    // Fallback to root container when no valid parent
    (parentEl || this.container).appendChild(element);
    
    // 기본 스타일 적용 (레이아웃 + 트랙 기본값)
    this.applyBaseStyle(element, node, track);
    
    if (this.options.debugMode) {
      console.log(`[RendererV2] Mounted node: ${nodeId}`, {
        element: element,
        nodetype: node.e_type,
        text: node.e_type === 'text' ? (node as any).text : undefined,
        layout: node.layout,
        displayTime: node.displayTime,
        trackDefaults: track?.defaultStyle,
        styles: {
          position: element.style.position,
          left: element.style.left,
          top: element.style.top,
          transform: element.style.transform,
          fontSize: element.style.fontSize,
          color: element.style.color,
          visibility: element.style.visibility,
          display: element.style.display
        }
      });
    }
  }

  /**
   * 노드 업데이트 (플러그인 효과 적용)
   */
  private updateNode(node: ResolvedNodeUnion, currentTime: number, nodeId: string, _track: any): void {
    const mounted = this.mountedElements.get(nodeId);
    if (!mounted) return;
    
    // 플러그인 체인 처리
    if (node.pluginChain && node.pluginChain.length > 0) {
      const channels = this.processPluginChain(
        node,
        node.pluginChain as PluginSpec[],
        currentTime,
        mounted.element
      );
      
      this.applyChannels(mounted.element, channels);
    }
  }

  /**
   * 플러그인 체인 처리
   */
  private processPluginChain(
    node: ResolvedNodeUnion,
    pluginChain: PluginSpec[],
    currentTime: number,
    element: HTMLElement
  ): Channels {
    const channels: Channels = {};
    
    for (const plugin of pluginChain) {
      // base_time 우선순위: plugin.base_time → node.base_time → node.displayTime
      const rawBase: any = (plugin as any).base_time ?? (node as any).base_time ?? node.displayTime;
      const baseTime = this.resolveAllDefines(rawBase) as TimeRange;

      // time_offset은 절대 초 또는 백분율('%') 허용
      const rawOffset = (plugin as any).time_offset ?? ['0%', '100%'];
      const resolvedOffset = this.resolveAllDefines(rawOffset) as [unknown, unknown];

      // 실행 창 계산
      const pluginWindow = computePluginWindowFromBase(baseTime, resolvedOffset);
      
      if (isWithinTimeRange(currentTime, pluginWindow)) {
        const progress = progressInTimeRange(currentTime, pluginWindow);
        
        const pluginChannels = this.evaluatePlugin(plugin, progress, element);
        
        // 채널 병합 (compose 모드에 따라)
        this.mergeChannels(channels, pluginChannels, plugin.compose || 'replace');
      }
    }
    
    return channels;
  }

  /**
   * 모든 Define 참조를 재귀적으로 해석
   */
  private resolveAllDefines(value: unknown): unknown {
    if (typeof value === 'string' && value.startsWith('define.')) {
      try {
        // Define 참조 문자열 해석을 위해 임시 시나리오 생성
        const tempScenario = {
          version: '2.0' as const,
          timebase: { unit: 'seconds' as const },
          stage: { baseAspect: '16:9' as const },
          tracks: [],
          cues: [],
          temp: value
        };
        const resolved = this.defineResolver.resolveScenario(tempScenario);
        return (resolved as any).temp;
      } catch (error) {
        if (this.options.debugMode) {
          console.warn(`[RendererV2] Failed to resolve define "${value}":`, error);
        }
        return value; // 해석 실패 시 원본 값 반환
      }
    }
    
    if (Array.isArray(value)) {
      return value.map(v => this.resolveAllDefines(v));
    }
    
    if (typeof value === 'object' && value !== null) {
      const resolved: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        resolved[key] = this.resolveAllDefines(val);
      }
      return resolved;
    }
    
    return value;
  }

  /**
   * 플러그인 평가 (내장 + 외부)
   */
  private evaluatePlugin(plugin: PluginSpec, progress: number, element?: HTMLElement): Channels {
    // Define 참조를 사전 해석
    const resolvedParams = this.resolveAllDefines(plugin.params || {});
    
    // 해석된 params로 플러그인 스펙 생성
    const resolvedPlugin: PluginSpec = {
      ...plugin,
      params: resolvedParams as Record<string, any>
    };
    
    // 플러그인 타입 감지 (하이브리드 지원)
    const pluginTypes = this.detectPluginType(resolvedPlugin);
    
    if (pluginTypes.size === 0) {
      console.warn(`[RendererV2] Unknown plugin: ${plugin.name}`);
      return {};
    }
    
    let channels: Channels = {};
    
    // 내장 플러그인
    if (pluginTypes.has('builtin')) {
      return this.evaluateBuiltinPlugin(resolvedPlugin, progress) || {};
    }
    
    // 채널 기반 플러그인
    if (pluginTypes.has('channel')) {
      const channelResult = this.evaluateChannelPlugin(resolvedPlugin, progress, element);
      channels = { ...channels, ...channelResult };
    }
    
    // DOM 기반 플러그인 (채널을 반환하지 않지만 DOM 직접 조작)
    if (pluginTypes.has('dom') && element) {
      this.evaluateDomPlugin(resolvedPlugin, progress, element);
      // DOM 플러그인은 채널 반환하지 않음
    }
    
    return channels;
  }

  /**
   * 플러그인 타입 감지 - v3.0 하이브리드 지원
   */
  private detectPluginType(plugin: PluginSpec): Set<'builtin' | 'channel' | 'dom'> {
    const types = new Set<'builtin' | 'channel' | 'dom'>();
    
    // 내장 플러그인 확인
    if (this.isBuiltinPlugin(plugin.name)) {
      types.add('builtin');
      return types;
    }
    
    // 외부 플러그인 확인
    const registeredPlugin = devRegistry.resolve(plugin.name);
    if (!registeredPlugin) {
      return types; // 빈 Set 반환
    }
    
    // 1순위: 시나리오에 명시된 타입
    if (plugin.type) {
      if (plugin.type === 'channel') {
        types.add('channel');
      } else if (plugin.type === 'dom') {
        types.add('dom');
      } else if (plugin.type === 'hybrid') {
        types.add('channel');
        types.add('dom');
      }
      return types;
    }
    
    // 2순위: Manifest에 명시된 타입
    if (registeredPlugin.manifest?.type) {
      const manifestType = registeredPlugin.manifest.type;
      if (manifestType === 'channel') {
        types.add('channel');
      } else if (manifestType === 'dom') {
        types.add('dom');
      } else if (manifestType === 'hybrid') {
        types.add('channel');
        types.add('dom');
      }
      return types;
    }
    
    // 3순위: 자동 감지 (폴백)
    if (typeof registeredPlugin.module?.evalChannels === 'function') {
      types.add('channel');
    }
    if (typeof registeredPlugin.module?.animate === 'function') {
      types.add('dom');
    }
    
    return types;
  }

  /**
   * 내장 플러그인인지 확인
   */
  private isBuiltinPlugin(name: string): boolean {
    // BuiltinV2.ts와 동기화
    return isBuiltinPluginV2(name);
  }

  /**
   * 내장 플러그인 평가
   */
  private evaluateBuiltinPlugin(plugin: PluginSpec, progress: number): Channels | null {
    // BuiltinV2.ts의 구현 사용 (21개 플러그인 지원)
    return evaluateBuiltinPlugin(plugin, progress);
  }

  /**
   * 채널 기반 플러그인 평가 (v3.0 API)
   */
  private evaluateChannelPlugin(plugin: PluginSpec, progress: number, _element?: HTMLElement): Channels {
    const registeredPlugin = devRegistry.resolve(plugin.name);
    if (!registeredPlugin) {
      console.warn(`[RendererV2] Plugin not found in registry: "${plugin.name}"`);
      return {};
    }

    if (this.options.debugMode) {
      console.log(`[RendererV2] Plugin found:`, {
        name: plugin.name,
        hasModule: !!registeredPlugin.module,
        hasEvalChannels: typeof registeredPlugin.module?.evalChannels === 'function'
      });
    }

    // Plugin API v3.0 - evalChannels 함수
    if (typeof registeredPlugin.module?.evalChannels === 'function') {
      try {
        // PluginContextV3 생성
        const context = this.createPluginContext(registeredPlugin.baseUrl);
        
        if (this.options.debugMode) {
          console.log(`[RendererV2] Calling evalChannels for "${plugin.name}" with:`, {
            plugin,
            progress,
            context
          });
        }
        
        const channels = registeredPlugin.module.evalChannels(plugin, progress, context);
        
        if (this.options.debugMode) {
          console.log(`[RendererV2] evalChannels returned:`, channels);
        }
        
        return channels || {};
      } catch (error) {
        console.error(`[RendererV2] Channel plugin "${plugin.name}" evalChannels failed:`, error);
        return {};
      }
    }

    console.warn(`[RendererV2] Plugin "${plugin.name}" has no evalChannels function`);
    return {};
  }

  /**
   * DOM 기반 플러그인 평가 (v2.1 API)
   */
  private evaluateDomPlugin(plugin: PluginSpec, progress: number, element?: HTMLElement): Channels {
    if (!element) {
      console.warn(`[RendererV2] DOM plugin "${plugin.name}" requires element`);
      return {};
    }

    // Prefer composite node key if present; fallback to legacy nodeId (node-only)
    const nodeId = (element.dataset.nodeKey || element.dataset.nodeId)!;
    if (!nodeId) {
      console.warn(`[RendererV2] Missing nodeKey/nodeId on element for plugin ${plugin.name}`);
      return {};
    }
    
    if (this.options.debugMode) {
      console.log(`[RendererV2] DOM plugin "${plugin.name}" element structure:`, {
        nodeId,
        outerHTML: element.outerHTML,
        children: Array.from(element.children).map(c => c.className),
        effectsRootSelector: '.mtx-effects-root, [data-mtx-effects-root]',
        effectsRootFound: !!element.querySelector('.mtx-effects-root, [data-mtx-effects-root]')
      });
    }
    
    const effectsRoot = element.querySelector('.mtx-effects-root, [data-mtx-effects-root]') as HTMLElement;
    
    if (!effectsRoot) {
      console.warn(`[RendererV2] DOM plugin "${plugin.name}" requires effectsRoot`);
      return {};
    }

    // DOM 플러그인 상태 관리 (M3에서 구현 예정)
    this.manageDomPluginState(nodeId, plugin, effectsRoot, progress);
    
    // DOM 플러그인은 채널 값을 반환하지 않음 (DOM 직접 조작)
    return {};
  }

  /**
   * DOM 플러그인 상태 관리
   */
  private manageDomPluginState(nodeId: string, plugin: PluginSpec, effectsRoot: HTMLElement, progress: number): void {
    if (this.options.debugMode) {
      console.log(`[RendererV2] manageDomPluginState: plugin="${plugin.name}", nodeId="${nodeId}", progress=${progress}`);
    }
    
    let nodeStates = this.domPluginStates.get(nodeId);
    if (!nodeStates) {
      nodeStates = new Map();
      this.domPluginStates.set(nodeId, nodeStates);
      if (this.options.debugMode) {
        console.log(`[RendererV2] Created new nodeStates for nodeId: ${nodeId}`);
      }
    }

    let state = nodeStates.get(plugin.name);
    if (!state) {
      state = {
        plugin,
        initialized: false,
      };
      nodeStates.set(plugin.name, state);
    }

    // 초기화가 안 된 경우 또는 DOM 요소가 없는 경우 초기화
    if (!state.initialized) {
      if (this.options.debugMode) {
        console.log(`[RendererV2] Initializing DOM plugin: ${plugin.name}`);
      }
      this.initializeDomPlugin(state, plugin, effectsRoot);
    } else {
      // 플러그인이 초기화되었다고 되어 있지만 DOM 요소가 실제로 존재하는지 확인
      const needsReinitialization = this.checkDomPluginElements(plugin.name, effectsRoot);
      if (needsReinitialization) {
        if (this.options.debugMode) {
          console.log(`[RendererV2] DOM elements missing for ${plugin.name}, reinitializing...`);
        }
        // 상태 리셋 후 재초기화
        state.initialized = false;
        state.seekFunction = undefined;
        this.initializeDomPlugin(state, plugin, effectsRoot);
      } else {
        if (this.options.debugMode) {
          console.log(`[RendererV2] Plugin ${plugin.name} already initialized and DOM elements exist`);
        }
      }
    }

    // seek 함수가 있으면 진행도 적용
    if (state.seekFunction) {
      if (this.options.debugMode) {
        console.log(`[RendererV2] Applying progress ${progress} to ${plugin.name}`);
      }
      if (typeof state.seekFunction === 'function') {
        // SeekApplier 타입: (progress: number) => void
        if (this.options.debugMode) {
          console.log(`[RendererV2] Calling SeekApplier for ${plugin.name}`);
        }
        state.seekFunction(progress);
      } else if (state.seekFunction && typeof state.seekFunction.progress === 'function') {
        // TimelineLike 타입: GSAP Timeline 등
        if (this.options.debugMode) {
          console.log(`[RendererV2] Calling Timeline.progress for ${plugin.name}`);
        }
        state.seekFunction.progress(progress);
      } else {
        console.warn(`[RendererV2] Invalid seekFunction type for plugin ${plugin.name}:`, typeof state.seekFunction);
      }
    } else {
      console.warn(`[RendererV2] No seekFunction found for plugin ${plugin.name}, state:`, state);
    }
  }

  /**
   * DOM 플러그인의 예상 DOM 요소가 존재하는지 확인
   * @returns true if reinitialization is needed (elements are missing)
   */
  private checkDomPluginElements(pluginName: string, effectsRoot: HTMLElement): boolean {
    switch (pluginName) {
      case 'glow':
        return !effectsRoot.querySelector('[data-glow]');
      case 'flames':
        return !effectsRoot.querySelector('img[data-flames]');
      case 'glitch':
        return !effectsRoot.querySelector('[data-glitch]');
      case 'magnetic':
        return !effectsRoot.querySelector('[data-magnetic]');
      // 다른 DOM 플러그인들도 필요에 따라 추가
      default:
        // 알려지지 않은 플러그인의 경우 재초기화가 필요하다고 가정하지 않음
        return false;
    }
  }

  /**
   * DOM 플러그인 초기화
   */
  private initializeDomPlugin(state: DomPluginState, plugin: PluginSpec, effectsRoot: HTMLElement): void {
    const registeredPlugin = devRegistry.resolve(plugin.name);
    if (!registeredPlugin?.module) {
      console.warn(`[RendererV2] DOM plugin not found: ${plugin.name}`);
      return;
    }

    try {
      // 플러그인 컨텍스트 생성
      const context = createPluginContextV3({
        container: effectsRoot,
        scenario: this.scenario!,
        baseUrl: registeredPlugin.baseUrl,
        renderer: {
          version: '2.0.0',
          currentTime: 0,
          duration: 1,
          timeScale: 1,
          fps: this.options.fps
        },
        peerDeps: {
          gsap: (window as any).gsap,
        }
      });
      const resolvedParams = this.resolveAllDefines(plugin.params || {});

      // init 호출 (있는 경우)
      if (typeof registeredPlugin.module.init === 'function') {
        registeredPlugin.module.init(effectsRoot, resolvedParams, context);
      }

      // animate 호출하여 seek 함수 생성
      if (typeof registeredPlugin.module.animate === 'function') {
        const seekFn = registeredPlugin.module.animate(
          effectsRoot,
          resolvedParams,
          context,
          1.0 // duration은 1.0으로 정규화 (progress 0~1 사용)
        );

        state.seekFunction = seekFn;
        // Safety: if plugin returned a GSAP-like timeline, pause it.
        if (seekFn && typeof seekFn === 'object' && typeof (seekFn as any).pause === 'function') {
          try { (seekFn as any).pause(0); } catch {}
        }
      }

      state.initialized = true;
      state.context = context;

      if (this.options.debugMode) {
        console.log(`[RendererV2] DOM plugin initialized: ${plugin.name}`);
      }
    } catch (error) {
      console.warn(`[RendererV2] DOM plugin init failed: ${plugin.name}`, error);
    }
  }

  /**
   * DOM 플러그인 정리 (노드 언마운트 시)
   */
  private cleanupDomPlugin(nodeId: string, pluginName?: string): void {
    let nodeStates = this.domPluginStates.get(nodeId);
    // Backward compatibility: prior to fix, keys used bare node.id. Fallback to that.
    if (!nodeStates) {
      const fallbackId = nodeId.includes(':') ? nodeId.split(':')[1] : undefined;
      if (fallbackId) nodeStates = this.domPluginStates.get(fallbackId);
    }
    if (!nodeStates) return;

    if (pluginName) {
      // 특정 플러그인만 정리
      const state = nodeStates.get(pluginName);
      if (state?.context && state.initialized) {
        // Timeline 정리
        if (state.seekFunction && typeof state.seekFunction === 'object' && state.seekFunction.kill) {
          try {
            state.seekFunction.kill();
          } catch (error) {
            console.warn(`[RendererV2] Timeline cleanup failed for ${pluginName}:`, error);
          }
        }
        
        // 플러그인 정리
        const registeredPlugin = devRegistry.resolve(pluginName);
        if (registeredPlugin?.module?.cleanup) {
          try {
            registeredPlugin.module.cleanup(state.context.targetElement || document.createElement('div'));
          } catch (error) {
            console.warn(`[RendererV2] DOM plugin cleanup failed: ${pluginName}`, error);
          }
        }
        
        // 상태 리셋: 재진입 시 재초기화되도록 함
        state.initialized = false;
        state.seekFunction = undefined;
      }
      nodeStates.delete(pluginName);
    } else {
      // 모든 플러그인 정리
      for (const [name, state] of nodeStates) {
        if (state.context && state.initialized) {
          // Timeline 정리
          if (state.seekFunction && typeof state.seekFunction === 'object' && state.seekFunction.kill) {
            try {
              state.seekFunction.kill();
            } catch (error) {
              console.warn(`[RendererV2] Timeline cleanup failed for ${name}:`, error);
            }
          }
          
          // 플러그인 정리
          const registeredPlugin = devRegistry.resolve(name);
          if (registeredPlugin?.module?.cleanup) {
            try {
              registeredPlugin.module.cleanup(state.context.targetElement || document.createElement('div'));
            } catch (error) {
              console.warn(`[RendererV2] DOM plugin cleanup failed: ${name}`, error);
            }
          }
          
          // 상태 리셋: 재진입 시 재초기화되도록 함
          state.initialized = false;
          state.seekFunction = undefined;
        }
      }
      this.domPluginStates.delete(nodeId);
    }
  }

  /**
   * PluginContextV3 생성
   */
  private createPluginContext(baseUrl: string): PluginContextV3 {
    if (!this.scenario) {
      throw new Error('Scenario not loaded');
    }

    // effectsRoot DOM을 플러그인 컨테이너로 사용
    // 실제 구현에서는 현재 처리 중인 요소의 effectsRoot를 사용해야 함
    const container = this.container; // 임시로 메인 컨테이너 사용

    return createPluginContextV3({
      container,
      scenario: this.scenario,
      baseUrl,
      renderer: {
        version: '2.0',
        currentTime: this.lastUpdateTime,
        duration: 0, // 미구현
        timeScale: 1, // 미구현
        fps: this.options.fps,
      },
      peerDeps: {
        gsap: (window as any).gsap,
      },
    });
  }

  /**
   * 채널 병합
   */
  private mergeChannels(target: Channels, source: Channels, mode: string): void {
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) continue;
      
      switch (mode) {
        case 'add':
          if (typeof value === 'number' && typeof target[key] === 'number') {
            target[key] = (target[key] as number) + value;
          } else {
            target[key] = value;
          }
          break;
          
        case 'multiply':
          if (typeof value === 'number' && typeof target[key] === 'number') {
            target[key] = (target[key] as number) * value;
          } else {
            target[key] = value;
          }
          break;
          
        case 'replace':
        default:
          target[key] = value;
          break;
      }
    }
  }

  /**
   * 채널을 CSS로 적용
   */
  private applyChannels(element: HTMLElement, channels: Channels): void {
    if (this.options.debugMode) {
      console.log(`[RendererV2] applyChannels called`, {
        hasChannels: !!channels,
        channelCount: Object.keys(channels || {}).length,
        channels: channels
      });
    }
    
    // 적용할 채널이 없으면 스킵
    if (!channels || Object.keys(channels).length === 0) {
      if (this.options.debugMode) {
        console.log(`[RendererV2] No channels to apply, skipping`);
      }
      return;
    }
    
    // baseWrapper를 찾아서 채널 적용
    const baseWrapper = element.querySelector('.mtx-base-wrapper') as HTMLElement;
    if (!baseWrapper) {
      console.warn('[RendererV2] No baseWrapper found for channel application', {
        element,
        innerHTML: element.innerHTML,
        classList: Array.from(element.classList),
        children: Array.from(element.children).map(child => ({
          tagName: child.tagName,
          classList: Array.from(child.classList)
        })),
        channels
      });
      return;
    }
    
    if (this.options.debugMode) {
      console.log(`[RendererV2] Applying channels to baseWrapper`, {
        baseWrapper: baseWrapper,
        channels: channels
      });
    }
    
    // CSS 변수를 통한 채널 적용 (DomSeparation의 CSS 변수 시스템 사용)
    applyCSSVariableChannels(baseWrapper, channels);
    
    if (this.options.debugMode) {
      console.log(`[RendererV2] Channels applied successfully`);
    }
  }

  /**
   * HTML 요소 생성 - baseWrapper/effectsRoot 구조 적용
   */
  private createElement(node: ResolvedNodeUnion): HTMLElement {
    // 1. 기본 요소 생성
    const originalElement = this.createOriginalElement(node);
    
    // 2. DOM 분리 아키텍처 적용
    const { baseWrapper, effectsRoot } = applyDomSeparation(originalElement, {
      enableCSSVariables: true,
      preserveExisting: true
    });
    
    // 3. 콘텐츠를 effectsRoot로 이동
    this.moveContentToEffectsRoot(node, originalElement, effectsRoot);
    
    // 4. 메타데이터 저장
    // Keep legacy nodeId (node-local id) for compatibility; composite is set in ensureMounted
    originalElement.dataset.nodeId = node.id;
    baseWrapper.dataset.baseWrapper = 'true';
    effectsRoot.dataset.effectsRoot = 'true';
    
    if (this.options.debugMode) {
      console.log('[RendererV2] createElement completed', {
        nodeId: node.id,
        element: originalElement,
        outerHTML: originalElement.outerHTML,
        hasBaseWrapper: !!originalElement.querySelector('.mtx-base-wrapper'),
        hasEffectsRoot: !!originalElement.querySelector('.mtx-effects-root'),
        innerHTML: originalElement.innerHTML
      });
    }
    
    return originalElement;
  }

  /**
   * 기본 HTML 요소 생성 (DOM 분리 전)
   */
  private createOriginalElement(node: ResolvedNodeUnion): HTMLElement {
    let element: HTMLElement;
    
    switch (node.e_type) {
      case 'text':
        element = document.createElement('div');
        element.textContent = node.text || '';
        element.className = 'mtx-text';
        break;
        
      case 'image':
        element = document.createElement('img') as HTMLImageElement;
        (element as HTMLImageElement).src = node.src || '';
        (element as HTMLImageElement).alt = node.alt || '';
        element.className = 'mtx-image';
        break;
        
      case 'video':
        element = document.createElement('video') as HTMLVideoElement;
        (element as HTMLVideoElement).src = node.src || '';
        (element as HTMLVideoElement).muted = node.muted ?? true;
        element.className = 'mtx-video';
        break;
        
      case 'group':
        element = document.createElement('div');
        element.className = 'mtx-group';
        break;
        
      default:
        element = document.createElement('div');
        element.className = 'mtx-unknown';
    }
    
    return element;
  }

  /**
   * 콘텐츠를 effectsRoot로 이동
   */
  private moveContentToEffectsRoot(node: ResolvedNodeUnion, originalElement: HTMLElement, effectsRoot: HTMLElement): void {
    switch (node.e_type) {
      case 'text':
        // 텍스트를 effectsRoot로 이동
        effectsRoot.textContent = node.text || '';
        // originalElement의 직접 자식 텍스트 노드만 제거 (baseWrapper는 보존)
        for (const child of Array.from(originalElement.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE) {
            originalElement.removeChild(child);
          }
        }
        break;
        
      case 'image':
        // 이미지 속성을 effectsRoot의 img로 이동
        const imgElement = document.createElement('img');
        imgElement.src = (originalElement as HTMLImageElement).src;
        imgElement.alt = (originalElement as HTMLImageElement).alt;
        imgElement.style.width = '100%';
        imgElement.style.height = '100%';
        effectsRoot.appendChild(imgElement);
        // 원본은 빈 상태로 유지
        (originalElement as HTMLImageElement).src = '';
        break;
        
      case 'video':
        // 비디오 속성을 effectsRoot의 video로 이동
        const videoElement = document.createElement('video');
        videoElement.src = (originalElement as HTMLVideoElement).src;
        videoElement.muted = (originalElement as HTMLVideoElement).muted;
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        effectsRoot.appendChild(videoElement);
        // 원본은 빈 상태로 유지
        (originalElement as HTMLVideoElement).src = '';
        break;
        
      case 'group':
        // 그룹은 effectsRoot를 컨테이너로 사용
        break;
    }
  }

  /**
   * 기본 스타일 적용 (새로운 constraints 시스템 사용)
   */
  private applyBaseStyle(element: HTMLElement, node: ResolvedNodeUnion, track?: any): void {
    // Get track constraints if available
    const trackConstraints = track?.defaultConstraints || (track?.type ? getDefaultTrackConstraints(track.type) : undefined);
    
    // Apply layout with constraints system
    applyLayoutWithConstraints(
      element, 
      node.layout, 
      trackConstraints,
      'cc', // default anchor
      {
        hasEffectScope: !!node.effectScope,
        stageSafe: this.scenario?.stage?.safeArea,
        trackSafe: track?.safeArea
      }
    );
    
    // Merge styles: track defaults → node styles (node takes precedence)
    const trackDefaults = track?.defaultStyle || {};
    const nodeStyle = node.style || {};
    const mergedStyle = { ...trackDefaults, ...nodeStyle } as any;
    
    // Apply merged styles
    if (mergedStyle.fontSizeRel) {
      // Convert relative size to pixels based on container size
      const container = this.container;
      const containerHeight = container.clientHeight || 720; // fallback to 720p
      element.style.fontSize = `${mergedStyle.fontSizeRel * containerHeight}px`;
    }
    if (mergedStyle.color) element.style.color = mergedStyle.color;
    if (mergedStyle.fontFamily) element.style.fontFamily = mergedStyle.fontFamily;
    if (mergedStyle.fontWeight) element.style.fontWeight = String(mergedStyle.fontWeight);
    if (mergedStyle.align) element.style.textAlign = mergedStyle.align;
    
    // Apply default text styling for text nodes without explicit style
    if (node.e_type === 'text' && !mergedStyle.fontSizeRel) {
      element.style.fontSize = '2rem'; // Default visible size
      element.style.color = element.style.color || '#ffffff'; // Default white text
      element.style.fontWeight = element.style.fontWeight || 'bold';
    }
  }

  /**
   * 유틸리티 메서드들
   */
  private isWithinDomLifetime(time: number, start: number, end: number): boolean {
    return time >= start && time <= end;
  }



  private getTrack(trackId: string) {
    return this.trackManager.getTrackById(trackId);
  }

  private unmountNode(nodeId: string): void {
    const mounted = this.mountedElements.get(nodeId);
    if (!mounted) return;
    
    // DOM 플러그인 정리
    this.cleanupDomPlugin(nodeId);
    
    mounted.element.remove();
    this.mountedElements.delete(nodeId);
    
    if (this.options.debugMode) {
      console.log(`[RendererV2] Unmounted node: ${nodeId}`);
    }
  }

  private unmountCue(cue: Cue): void {
    const toRemove = Array.from(this.mountedElements.keys())
      .filter(nodeId => nodeId.startsWith(`${cue.id}:`));
    
    toRemove.forEach(nodeId => this.unmountNode(nodeId));
  }

  private unmountAll(): void {
    for (const [nodeId] of this.mountedElements) {
      this.unmountNode(nodeId);
    }
  }

  private setupContainer(): void {
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    
    // Ensure container has dimensions
    if (this.container.clientWidth === 0 || this.container.clientHeight === 0) {
      this.container.style.width = this.container.style.width || '100%';
      this.container.style.height = this.container.style.height || '100%';
      this.container.style.minHeight = this.container.style.minHeight || '400px';
    }
    
    if (this.options.debugMode) {
      console.log('[RendererV2] Container setup:', {
        width: this.container.clientWidth,
        height: this.container.clientHeight,
        styles: {
          position: this.container.style.position,
          overflow: this.container.style.overflow,
          width: this.container.style.width,
          height: this.container.style.height,
          minHeight: this.container.style.minHeight
        }
      });
    }
  }

  private logDebugInfo(currentTime: number): void {
    const mountedCount = this.mountedElements.size;
    
    if (mountedCount > 0) {
      console.log(`[RendererV2] t=${currentTime.toFixed(3)}s, mounted=${mountedCount}`);
    }
  }

  /**
   * 비디오 미디어 연결
   * @param media - 비디오 엘리먼트
   */
  attachMedia(media: HTMLVideoElement): void {
    this.timeline.attachMedia(media);
    this.stage.setMedia(media);
    
    if (this.options.debugMode) {
      console.log('[RendererV2] Media attached:', {
        duration: media.duration,
        readyState: media.readyState,
        videoWidth: media.videoWidth,
        videoHeight: media.videoHeight
      });
    }
  }

  /**
   * 미디어 분리
   */
  detachMedia(): void {
    this.timeline.detachMedia();
    
    if (this.options.debugMode) {
      console.log('[RendererV2] Media detached');
    }
  }

  /**
   * 정리
   */
  dispose(): void {
    this.timeline.dispose();
    this.stage.dispose();
    this.unmountAll();
    this.scenario = null;
  }
}
