// PluginChainComposer v2.0 - time_offset 기반 플러그인 체인 합성
// Reference: context/plugin-system-architecture-v-3-0.md
//
// v1.3 → v2.0 주요 변경사항:
// - time_offset: [start, end] 배열 기반
// - computePluginWindow, isWithinTimeRange 사용
// - 플러그인 API v3.0 지원
// - 채널 시스템 통합

import type { PluginSpec, Channels, ComposeMode } from '../types/plugin-v3';
import type { TimeRange } from '../types/scenario-v2';
import {
  isWithinTimeRange,
  progressInTimeRange,
  computePluginWindow
} from '../utils/time-v2';

export interface ComposerOptions {
  debugMode?: boolean;
  maxActivePlugins?: number;
  skipInactivePlugins?: boolean;
}

export interface PluginEvaluationResult {
  plugin: PluginSpec;
  channels: Channels;
  progress: number;
  window: TimeRange;
  isActive: boolean;
}

export type PluginEvaluator = (
  plugin: PluginSpec,
  progress: number,
  context?: PluginEvaluationContext
) => Channels;

export interface PluginEvaluationContext {
  currentTime: number;
  displayTime: TimeRange;
  nodeId?: string;
  element?: HTMLElement;
}

/**
 * v2.0 플러그인 체인 합성기
 * time_offset 배열을 기반으로 플러그인들의 채널을 합성
 */
export class PluginChainComposerV2 {
  private options: Required<ComposerOptions>;
  
  constructor(options: ComposerOptions = {}) {
    this.options = {
      debugMode: false,
      maxActivePlugins: 10,
      skipInactivePlugins: true,
      ...options
    };
  }

  /**
   * 플러그인 체인 합성 (메인 함수)
   * @param chain - 플러그인 스펙 배열
   * @param currentTime - 현재 시간
   * @param displayTime - 노드의 displayTime [start, end]
   * @param evaluator - 플러그인 평가 함수
   * @param options - 추가 옵션
   * @returns 합성된 채널들
   */
  composeChain(
    chain: PluginSpec[],
    currentTime: number,
    displayTime: TimeRange,
    evaluator: PluginEvaluator,
    context?: PluginEvaluationContext
  ): Channels {
    if (!chain || chain.length === 0) return {};
    
    const activePlugins = this.evaluatePlugins(
      chain, 
      currentTime, 
      displayTime, 
      evaluator,
      context
    );
    
    const channels = this.mergeChannels(activePlugins);
    
    if (this.options.debugMode) {
      this.logDebugInfo(activePlugins, channels);
    }
    
    return channels;
  }

  /**
   * 모든 플러그인 평가
   */
  private evaluatePlugins(
    chain: PluginSpec[],
    currentTime: number,
    displayTime: TimeRange,
    evaluator: PluginEvaluator,
    context?: PluginEvaluationContext
  ): PluginEvaluationResult[] {
    const results: PluginEvaluationResult[] = [];
    let activeCount = 0;
    
    for (const plugin of chain) {
      // 최대 활성 플러그인 수 제한
      if (activeCount >= this.options.maxActivePlugins) {
        if (this.options.debugMode) {
          console.warn(`[PluginChainComposerV2] Maximum active plugins (${this.options.maxActivePlugins}) reached`);
        }
        break;
      }
      
      const result = this.evaluatePlugin(plugin, currentTime, displayTime, evaluator, context);
      
      if (result.isActive) {
        activeCount++;
      } else if (this.options.skipInactivePlugins) {
        continue; // 비활성 플러그인 건너뛰기
      }
      
      results.push(result);
    }
    
    return results;
  }

  /**
   * 개별 플러그인 평가
   */
  private evaluatePlugin(
    plugin: PluginSpec,
    currentTime: number,
    displayTime: TimeRange,
    evaluator: PluginEvaluator,
    context?: PluginEvaluationContext
  ): PluginEvaluationResult {
    // time_offset 기반 플러그인 실행 창 계산
    const timeOffset = (plugin.time_offset as TimeRange) || [0, 0];
    const pluginWindow = computePluginWindow(displayTime, timeOffset);
    
    const isActive = isWithinTimeRange(currentTime, pluginWindow);
    const progress = isActive ? progressInTimeRange(currentTime, pluginWindow) : 0;
    
    let channels: Channels = {};
    
    if (isActive) {
      try {
        const evalContext = {
          ...context,
          currentTime,
          displayTime
        };
        channels = evaluator(plugin, progress, evalContext);
      } catch (error) {
        console.error(`[PluginChainComposerV2] Plugin evaluation error for "${plugin.name}":`, error);
      }
    }
    
    return {
      plugin,
      channels,
      progress,
      window: pluginWindow,
      isActive
    };
  }

  /**
   * 채널 병합 (합성 모드에 따라)
   */
  private mergeChannels(results: PluginEvaluationResult[]): Channels {
    const finalChannels: Channels = {};
    
    for (const result of results) {
      if (!result.isActive || !result.channels) continue;
      
      const composeMode = (result.plugin.compose as ComposeMode) || 'replace';
      const priority = (typeof result.plugin.priority === 'number') ? result.plugin.priority : 0;
      this.applyChannels(finalChannels, result.channels, composeMode, priority);
    }
    
    return finalChannels;
  }

  /**
   * 채널 적용 (합성 모드에 따라)
   */
  private applyChannels(
    target: Channels, 
    source: Channels, 
    mode: ComposeMode, 
    _priority: number = 0
  ): void {
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined || value === null) continue;
      
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
          // 우선순위가 있는 경우 고려 (나중에 추가될 수 있음)
          target[key] = value;
          break;
      }
    }
  }

  /**
   * 디버그 정보 로그
   */
  private logDebugInfo(results: PluginEvaluationResult[], finalChannels: Channels): void {
    const activePlugins = results.filter(r => r.isActive);
    
    if (activePlugins.length === 0) return;
    
    console.log(`[PluginChainComposerV2] Active plugins: ${activePlugins.length}`);
    
    for (const result of activePlugins) {
      console.log(`  - ${result.plugin.name}: progress=${result.progress.toFixed(3)}, channels=${Object.keys(result.channels).join(',')}`);
    }
    
    console.log(`[PluginChainComposerV2] Final channels:`, finalChannels);
  }
}

/**
 * 정적 유틸리티 함수들
 */

/**
 * 간편한 플러그인 체인 합성 (정적 메서드)
 * @param chain - 플러그인 체인
 * @param currentTime - 현재 시간
 * @param displayTime - 표시 시간 구간
 * @param evaluator - 평가 함수
 * @param options - 옵션
 * @returns 합성된 채널
 */
export function composePluginChain(
  chain: PluginSpec[],
  currentTime: number,
  displayTime: TimeRange,
  evaluator: PluginEvaluator,
  options?: ComposerOptions
): Channels {
  const composer = new PluginChainComposerV2(options);
  return composer.composeChain(chain, currentTime, displayTime, evaluator);
}

/**
 * 플러그인 활성화 상태 확인
 * @param plugin - 플러그인 스펙
 * @param currentTime - 현재 시간
 * @param displayTime - 표시 시간 구간
 * @returns 활성화 여부
 */
export function isPluginActive(
  plugin: PluginSpec,
  currentTime: number,
  displayTime: TimeRange
): boolean {
  const timeOffset = (plugin.time_offset as TimeRange) || [0, 0];
  const pluginWindow = computePluginWindow(displayTime, timeOffset);
  return isWithinTimeRange(currentTime, pluginWindow);
}

/**
 * 플러그인 진행도 계산
 * @param plugin - 플러그인 스펙
 * @param currentTime - 현재 시간
 * @param displayTime - 표시 시간 구간
 * @returns 진행도 (0~1), 비활성 시 0
 */
export function getPluginProgress(
  plugin: PluginSpec,
  currentTime: number,
  displayTime: TimeRange
): number {
  const timeOffset = (plugin.time_offset as TimeRange) || [0, 0];
  const pluginWindow = computePluginWindow(displayTime, timeOffset);
  
  if (!isWithinTimeRange(currentTime, pluginWindow)) {
    return 0;
  }
  
  return progressInTimeRange(currentTime, pluginWindow);
}

/**
 * 채널 합성 모드별 병합
 * @param target - 대상 채널
 * @param source - 소스 채널
 * @param mode - 합성 모드
 */
export function mergeChannelsByMode(
  target: Channels, 
  source: Channels, 
  mode: ComposeMode = 'replace'
): void {
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null) continue;
    
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
 * 채널 값 검증
 * @param channels - 검증할 채널들
 * @returns 유효한 채널들만 포함된 새 객체
 */
export function validateChannels(channels: Channels): Channels {
  const validated: Channels = {};
  
  for (const [key, value] of Object.entries(channels)) {
    // undefined, null, NaN 값 제외
    if (value != null && !Number.isNaN(value)) {
      validated[key] = value;
    }
  }
  
  return validated;
}

/**
 * 채널 디버그 정보
 * @param channels - 분석할 채널들
 * @returns 디버그 정보 문자열
 */
export function getChannelsDebugInfo(channels: Channels): string {
  const entries = Object.entries(channels)
    .filter(([, value]) => value != null)
    .map(([key, value]) => {
      if (typeof value === 'number') {
        return `${key}=${value.toFixed(3)}`;
      }
      return `${key}="${value}"`;
    });
    
  return `{${entries.join(', ')}}`;
}