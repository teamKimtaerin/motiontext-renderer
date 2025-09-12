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
  Node, 
  Cue, 
  ResolvedNodeUnion, 
  TimeRange 
} from '../types/scenario-v2-native';
import type { PluginSpec } from '../types/plugin-v3';
import type { Channels } from '../types/plugin-v3';
import { 
  isWithinTimeRange, 
  progressInTimeRange, 
  computePluginWindow 
} from '../utils/time-v2';

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
  
  constructor(options: RendererOptions) {
    this.container = options.container;
    this.options = {
      preloadMs: 300,
      snapToFrame: false,
      fps: 30,
      debugMode: false,
      ...options
    };
    
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
    
    if (this.options.debugMode) {
      console.log('[RendererV2] Scenario loaded:', {
        version: scenario.version,
        cueCount: scenario.cues.length,
        trackCount: scenario.tracks.length
      });
    }
  }

  /**
   * 현재 시간에 따른 렌더링 업데이트
   * @param currentTime - 현재 재생 시간 (초)
   */
  update(currentTime: number): void {
    if (!this.scenario) return;
    
    this.lastUpdateTime = currentTime;
    
    // 프레임 스냅 적용
    const snapTime = this.options.snapToFrame 
      ? this.snapToFrame(currentTime) 
      : currentTime;
    
    // Cue별 처리
    for (const cue of this.scenario.cues) {
      this.processCue(cue, snapTime);
    }
    
    if (this.options.debugMode) {
      this.logDebugInfo(snapTime);
    }
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
      this.ensureMounted(node, cue, nodeId);
      this.updateNode(node, currentTime, nodeId);
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
  private ensureMounted(node: ResolvedNodeUnion, cue: Cue, nodeId: string): void {
    if (this.mountedElements.has(nodeId)) return;
    
    const element = this.createElement(node);
    this.mountedElements.set(nodeId, {
      node,
      element,
      cueId: cue.id,
      mountTime: this.lastUpdateTime
    });
    
    this.container.appendChild(element);
    
    if (this.options.debugMode) {
      console.log(`[RendererV2] Mounted node: ${nodeId}`);
    }
  }

  /**
   * 노드 업데이트 (플러그인 효과 적용)
   */
  private updateNode(node: ResolvedNodeUnion, currentTime: number, nodeId: string): void {
    const mounted = this.mountedElements.get(nodeId);
    if (!mounted) return;
    
    // 기본 스타일 적용
    this.applyBaseStyle(mounted.element, node);
    
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
   * 플러그인 평가 (내장 + 외부)
   */
  private evaluatePlugin(plugin: PluginSpec, progress: number): Channels {
    // 내장 플러그인 처리
    const builtinChannels = this.evaluateBuiltinPlugin(plugin, progress);
    if (builtinChannels) return builtinChannels;
    
    // 외부 플러그인 처리 (향후 확장)
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
    element.style.position = 'absolute';
    
    return element;
  }

  /**
   * 기본 스타일 적용
   */
  private applyBaseStyle(element: HTMLElement, node: ResolvedNodeUnion): void {
    if (!node.style) return;
    
    // 기본적인 스타일 적용
    const style = node.style as any;
    
    if (style.fontSize) element.style.fontSize = style.fontSize;
    if (style.color) element.style.color = style.color;
    if (style.fontFamily) element.style.fontFamily = style.fontFamily;
    if (style.fontWeight) element.style.fontWeight = style.fontWeight;
    if (style.textAlign) element.style.textAlign = style.textAlign;
  }

  /**
   * 유틸리티 메서드들
   */
  private isWithinDomLifetime(time: number, start: number, end: number): boolean {
    return time >= start && time <= end;
  }

  private snapToFrame(time: number): number {
    if (!this.options.snapToFrame || !this.options.fps) return time;
    return Math.round(time * this.options.fps) / this.options.fps;
  }

  private backOutEasing(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  private getTrack(trackId: string) {
    return this.scenario?.tracks.find(track => track.id === trackId);
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
  }

  private logDebugInfo(currentTime: number): void {
    const mountedCount = this.mountedElements.size;
    
    if (mountedCount > 0) {
      console.log(`[RendererV2] t=${currentTime.toFixed(3)}s, mounted=${mountedCount}`);
    }
  }

  /**
   * 정리
   */
  dispose(): void {
    this.unmountAll();
    this.scenario = null;
  }
}