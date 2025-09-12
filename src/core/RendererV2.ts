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
import type { PluginSpec } from '../types/plugin-v3';
import type { Channels } from '../types/plugin-v3';
import { 
  isWithinTimeRange, 
  progressInTimeRange, 
  computePluginWindow 
} from '../utils/time-v2';
import { DefineResolver } from '../parser/DefineResolver';
import { devRegistry } from '../loader/dev/DevPluginRegistry';
import { createPluginContextV3, type PluginContextV3 } from '../runtime/PluginContextV3';
import { applyNormalizedPosition } from '../layout/LayoutEngine';
import { TimelineControllerV2, type TimelineOptions, type TickCallback } from './TimelineControllerV2';
import { Stage } from './Stage';
import { TrackManager } from './TrackManager';

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
    if (!this.scenario) return;
    
    this.lastUpdateTime = currentTime;
    
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
    currentTime: number
  ): void {
    const nodeId = `${cue.id}:${node.id}`;
    
    // displayTime 체크
    const [displayStart, displayEnd] = node.displayTime || [-Infinity, Infinity];
    const isActive = isWithinTimeRange(currentTime, [displayStart, displayEnd]);
    
    if (isActive) {
      this.ensureMounted(node, cue, nodeId, track);
      this.updateNode(node, currentTime, nodeId, track);
    } else {
      this.unmountNode(nodeId);
    }
    
    // group 노드의 children 재귀 처리
    if (node.e_type === 'group' && node.children) {
      for (const child of node.children) {
        this.processNode(child, cue, track, currentTime);
      }
    }
  }

  /**
   * 노드가 마운트되어 있는지 확인하고 필요시 마운트
   */
  private ensureMounted(node: ResolvedNodeUnion, cue: Cue, nodeId: string, track: any): void {
    if (this.mountedElements.has(nodeId)) return;
    
    const element = this.createElement(node);
    this.mountedElements.set(nodeId, {
      node,
      element,
      cueId: cue.id,
      mountTime: this.lastUpdateTime
    });
    
    this.container.appendChild(element);
    
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
        node.pluginChain as PluginSpec[], 
        currentTime, 
        node.displayTime
      );
      
      this.applyChannels(mounted.element, channels);
    }
  }

  /**
   * 플러그인 체인 처리
   */
  private processPluginChain(
    pluginChain: PluginSpec[],
    currentTime: number,
    displayTime: TimeRange
  ): Channels {
    const channels: Channels = {};
    
    for (const plugin of pluginChain) {
      // time_offset 적용하여 플러그인 실행 창 계산
      const pluginWindow = computePluginWindow(
        displayTime, 
        (plugin.time_offset as TimeRange) || [0, 0]
      );
      
      if (isWithinTimeRange(currentTime, pluginWindow)) {
        const progress = progressInTimeRange(currentTime, pluginWindow);
        const pluginChannels = this.evaluatePlugin(plugin, progress);
        
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
  private evaluatePlugin(plugin: PluginSpec, progress: number): Channels {
    // Define 참조를 사전 해석
    const resolvedParams = this.resolveAllDefines(plugin.params || {});
    
    // 해석된 params로 플러그인 스펙 생성
    const resolvedPlugin: PluginSpec = {
      ...plugin,
      params: resolvedParams as Record<string, any>
    };
    
    // 내장 플러그인 처리
    const builtinChannels = this.evaluateBuiltinPlugin(resolvedPlugin, progress);
    if (builtinChannels) return builtinChannels;
    
    // 외부 플러그인 처리 (DevPluginRegistry)
    const externalChannels = this.evaluateExternalPlugin(resolvedPlugin, progress);
    if (externalChannels) return externalChannels;
    
    console.warn(`[RendererV2] Unknown plugin: ${plugin.name}`);
    return {};
  }

  /**
   * 내장 플러그인 평가
   */
  private evaluateBuiltinPlugin(plugin: PluginSpec, progress: number): Channels | null {
    const { name, params = {} } = plugin;
    
    switch (name) {
      case 'fadeIn':
        return { opacity: progress };
        
      case 'fadeOut':
        return { opacity: 1 - progress };
        
      case 'slideInLeft':
        const distance = (params as any).distance || 100;
        return { tx: -distance * (1 - progress) };
        
      case 'slideInRight':
        const rightDistance = (params as any).distance || 100;
        return { tx: rightDistance * (1 - progress) };
        
      case 'scaleIn':
        const scale = progress;
        return { sx: scale, sy: scale };
        
      case 'pop':
        // backOut 이징을 시뮬레이션
        const backOutProgress = this.backOutEasing(progress);
        return { sx: backOutProgress, sy: backOutProgress };
        
      default:
        return null;
    }
  }

  /**
   * 외부 플러그인 평가 (DevPluginRegistry)
   */
  private evaluateExternalPlugin(plugin: PluginSpec, progress: number): Channels | null {
    const registeredPlugin = devRegistry.resolve(plugin.name);
    if (!registeredPlugin) return null;

    // Plugin API v3.0 지원 (evalChannels 함수)
    if (typeof registeredPlugin.module?.evalChannels === 'function') {
      try {
        // PluginContextV3 생성
        const context = this.createPluginContext(registeredPlugin.baseUrl);
        const channels = registeredPlugin.module.evalChannels(plugin, progress, context);
        return channels || {};
      } catch (error) {
        if (this.options.debugMode) {
          console.warn(`[RendererV2] External plugin "${plugin.name}" evalChannels failed:`, error);
        }
        return {};
      }
    }

    // 향후 다른 Plugin API 버전 지원 가능성 확장
    return null;
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
    const transforms: string[] = [];
    
    // 변환 채널들
    if (channels.tx !== undefined) transforms.push(`translateX(${channels.tx}px)`);
    if (channels.ty !== undefined) transforms.push(`translateY(${channels.ty}px)`);
    if (channels.sx !== undefined) transforms.push(`scaleX(${channels.sx})`);
    if (channels.sy !== undefined) transforms.push(`scaleY(${channels.sy})`);
    if (channels.rot !== undefined) transforms.push(`rotate(${channels.rot}deg)`);
    
    if (transforms.length > 0) {
      element.style.transform = transforms.join(' ');
    }
    
    // 기타 채널들
    if (channels.opacity !== undefined) {
      element.style.opacity = String(channels.opacity);
    }
    
    if (channels.filter) {
      element.style.filter = channels.filter;
    }
    
    if (channels.color) {
      element.style.color = channels.color;
    }
  }

  /**
   * HTML 요소 생성
   */
  private createElement(node: ResolvedNodeUnion): HTMLElement {
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
    
    // 공통 속성
    element.dataset.nodeId = node.id;
    
    return element;
  }

  /**
   * 기본 스타일 적용
   */
  private applyBaseStyle(element: HTMLElement, node: ResolvedNodeUnion, track?: any): void {
    // Apply layout positioning first
    if (node.layout) {
      applyNormalizedPosition(element, node.layout, 'cc');
    }
    
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


  private backOutEasing(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  private getTrack(trackId: string) {
    return this.trackManager.getTrackById(trackId);
  }

  private unmountNode(nodeId: string): void {
    const mounted = this.mountedElements.get(nodeId);
    if (!mounted) return;
    
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