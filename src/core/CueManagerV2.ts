// CueManager v2.0 - domLifetime 기반 DOM 생명주기 관리
// Reference: context/scenario-json-spec-v-2-0.md
//
// v2.0 특징:
// - domLifetime: [start, end] 기반 DOM 마운트/언마운트
// - 효율적인 preload 및 cleanup
// - 메모리 최적화
// - 트랙별 렌더링 최적화

import type { Scenario, Cue, Track, TimeRange } from '../types/scenario-v2-native';
import { isWithinTimeRange, unionTimeRanges } from '../utils/time-v2';

export interface CueManagerOptions {
  preloadMs?: number;        // preload 시간 (기본 300ms)
  cleanupDelayMs?: number;   // cleanup 지연 시간 (기본 500ms)
  maxMountedCues?: number;   // 최대 마운트된 Cue 수 (메모리 제한)
  debugMode?: boolean;
}

export interface MountedCue {
  cue: Cue;
  track: Track;
  mountTime: number;
  container: HTMLElement;
  isActive: boolean;
  preloaded: boolean;
}

export interface CueLifecycleEvent {
  type: 'mount' | 'unmount' | 'activate' | 'deactivate';
  cue: Cue;
  time: number;
}

export type CueLifecycleListener = (event: CueLifecycleEvent) => void;

/**
 * v2.0 Cue 생명주기 관리자
 * domLifetime 기반으로 Cue의 DOM 마운트/언마운트를 효율적으로 관리
 */
export class CueManagerV2 {
  private scenario: Scenario | null = null;
  private mountedCues = new Map<string, MountedCue>();
  private options: Required<CueManagerOptions>;
  private lifecycleListeners = new Set<CueLifecycleListener>();
  private cleanupTimeouts = new Map<string, number>();
  
  // 성능 통계
  private stats = {
    totalMounts: 0,
    totalUnmounts: 0,
    currentMounted: 0,
    peakMounted: 0
  };

  constructor(options: CueManagerOptions = {}) {
    this.options = {
      preloadMs: 300,
      cleanupDelayMs: 500,
      maxMountedCues: 50,
      debugMode: false,
      ...options
    };

    if (this.options.debugMode) {
      console.log('[CueManagerV2] Initialized with options:', this.options);
    }
  }

  /**
   * v2.0 시나리오 설정
   * @param scenario - 관리할 시나리오
   */
  setScenario(scenario: Scenario): void {
    if (scenario.version !== '2.0') {
      throw new Error(`CueManagerV2 only supports v2.0 scenarios, got version "${scenario.version}"`);
    }

    // 기존 Cue들 정리
    this.unmountAll();
    
    this.scenario = scenario;
    
    // domLifetime 자동 계산 (없는 경우)
    this.ensureDomLifetimes();

    if (this.options.debugMode) {
      console.log('[CueManagerV2] Scenario set:', {
        cueCount: scenario.cues.length,
        trackCount: scenario.tracks.length
      });
    }
  }

  /**
   * 현재 시간에 따른 Cue 생명주기 업데이트
   * @param currentTime - 현재 재생 시간
   */
  update(currentTime: number): void {
    if (!this.scenario) return;

    const preloadTime = currentTime + (this.options.preloadMs / 1000);

    for (const cue of this.scenario.cues) {
      this.processCueLifecycle(cue, currentTime, preloadTime);
    }

    this.cleanupExpiredCues(currentTime);
    this.enforceMemoryLimits();

    if (this.options.debugMode) {
      this.logDebugStats();
    }
  }

  /**
   * 개별 Cue 생명주기 처리
   */
  private processCueLifecycle(cue: Cue, currentTime: number, preloadTime: number): void {
    const domLifetime = this.getCueDomLifetime(cue);
    const [domStart, domEnd] = domLifetime;
    
    const mounted = this.mountedCues.get(cue.id);
    const shouldMount = preloadTime >= domStart && currentTime <= domEnd;
    const shouldActivate = isWithinTimeRange(currentTime, domLifetime);

    if (shouldMount && !mounted) {
      this.mountCue(cue, currentTime < domStart);
    } else if (mounted) {
      // 활성화 상태 업데이트
      if (shouldActivate !== mounted.isActive) {
        mounted.isActive = shouldActivate;
        this.notifyLifecycle({
          type: shouldActivate ? 'activate' : 'deactivate',
          cue,
          time: currentTime
        });
      }
    }

    if (!shouldMount && mounted && currentTime > domEnd) {
      this.scheduleUnmount(cue, currentTime);
    }
  }

  /**
   * Cue DOM 마운트
   */
  private mountCue(cue: Cue, isPreload: boolean): void {
    if (this.mountedCues.has(cue.id)) return;

    const track = this.getTrack(cue.track);
    if (!track) {
      console.warn(`[CueManagerV2] Unknown track: ${cue.track}`);
      return;
    }

    // DOM 컨테이너 생성
    const container = this.createCueContainer(cue, track);
    
    const mountedCue: MountedCue = {
      cue,
      track,
      mountTime: Date.now(),
      container,
      isActive: !isPreload,
      preloaded: isPreload
    };

    this.mountedCues.set(cue.id, mountedCue);
    
    // 기존 cleanup 취소
    this.cancelScheduledUnmount(cue.id);
    
    this.stats.totalMounts++;
    this.stats.currentMounted++;
    this.stats.peakMounted = Math.max(this.stats.peakMounted, this.stats.currentMounted);

    this.notifyLifecycle({
      type: 'mount',
      cue,
      time: Date.now()
    });

    if (this.options.debugMode) {
      console.log(`[CueManagerV2] Mounted cue: ${cue.id} (preload: ${isPreload})`);
    }
  }

  /**
   * Cue DOM 언마운트 예약
   */
  private scheduleUnmount(cue: Cue, currentTime: number): void {
    if (this.cleanupTimeouts.has(cue.id)) return;

    const timeoutId = window.setTimeout(() => {
      this.unmountCue(cue.id);
      this.cleanupTimeouts.delete(cue.id);
    }, this.options.cleanupDelayMs);

    this.cleanupTimeouts.set(cue.id, timeoutId);

    if (this.options.debugMode) {
      console.log(`[CueManagerV2] Scheduled unmount: ${cue.id} in ${this.options.cleanupDelayMs}ms`);
    }
  }

  /**
   * 예약된 언마운트 취소
   */
  private cancelScheduledUnmount(cueId: string): void {
    const timeoutId = this.cleanupTimeouts.get(cueId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      this.cleanupTimeouts.delete(cueId);
    }
  }

  /**
   * Cue DOM 언마운트
   */
  private unmountCue(cueId: string): void {
    const mounted = this.mountedCues.get(cueId);
    if (!mounted) return;

    // DOM 제거
    mounted.container.remove();
    
    this.mountedCues.delete(cueId);
    this.stats.totalUnmounts++;
    this.stats.currentMounted--;

    this.notifyLifecycle({
      type: 'unmount',
      cue: mounted.cue,
      time: Date.now()
    });

    if (this.options.debugMode) {
      console.log(`[CueManagerV2] Unmounted cue: ${cueId}`);
    }
  }

  /**
   * Cue 컨테이너 DOM 생성
   */
  private createCueContainer(cue: Cue, track: Track): HTMLElement {
    const container = document.createElement('div');
    container.className = `mtx-cue mtx-track-${track.type}`;
    container.dataset.cueId = cue.id;
    container.dataset.trackId = track.id;
    
    // 트랙별 스타일링
    container.style.position = 'absolute';
    container.style.zIndex = String(track.layer);
    
    // 트랙 타입별 기본 스타일
    switch (track.type) {
      case 'subtitle':
        container.style.pointerEvents = 'none';
        container.style.userSelect = 'none';
        break;
      case 'free':
        // free 트랙은 별도 스타일 없음
        break;
    }

    return container;
  }

  /**
   * Cue의 domLifetime 가져오기 (자동 계산 포함)
   */
  private getCueDomLifetime(cue: Cue): TimeRange {
    if (cue.domLifetime) {
      return cue.domLifetime as TimeRange;
    }

    // domLifetime이 없으면 노드들의 displayTime으로부터 계산
    return this.calculateDomLifetime(cue);
  }

  /**
   * Cue의 domLifetime 자동 계산
   */
  private calculateDomLifetime(cue: Cue): TimeRange {
    const displayTimes: TimeRange[] = [];
    this.collectNodeDisplayTimes(cue.root, displayTimes);
    
    const union = unionTimeRanges(displayTimes);
    if (!union) return [0, 10]; // 기본값

    const [start, end] = union;
    const preloadSec = this.options.preloadMs / 1000;
    const cleanupSec = this.options.cleanupDelayMs / 1000;

    return [
      Math.max(0, start - preloadSec),
      end + cleanupSec
    ];
  }

  /**
   * 노드 트리에서 displayTime 수집 (재귀)
   */
  private collectNodeDisplayTimes(node: any, collected: TimeRange[]): void {
    if (node.displayTime && Array.isArray(node.displayTime)) {
      const [start, end] = node.displayTime;
      if (Number.isFinite(start) && Number.isFinite(end)) {
        collected.push([start, end]);
      }
    }

    if (node.e_type === 'group' && node.children) {
      for (const child of node.children) {
        this.collectNodeDisplayTimes(child, collected);
      }
    }
  }

  /**
   * 만료된 Cue들 정리
   */
  private cleanupExpiredCues(currentTime: number): void {
    for (const [cueId, mounted] of this.mountedCues) {
      const domLifetime = this.getCueDomLifetime(mounted.cue);
      const [, domEnd] = domLifetime;
      
      if (currentTime > domEnd + (this.options.cleanupDelayMs / 1000)) {
        this.unmountCue(cueId);
      }
    }
  }

  /**
   * 메모리 제한 강제 적용
   */
  private enforceMemoryLimits(): void {
    if (this.mountedCues.size <= this.options.maxMountedCues) return;

    // 오래된 비활성 Cue들부터 정리
    const sortedCues = Array.from(this.mountedCues.entries())
      .filter(([, mounted]) => !mounted.isActive)
      .sort(([, a], [, b]) => a.mountTime - b.mountTime);

    const toUnmount = sortedCues.length - (this.options.maxMountedCues - this.getActiveCueCount());
    
    for (let i = 0; i < toUnmount; i++) {
      const [cueId] = sortedCues[i];
      this.unmountCue(cueId);
    }

    if (this.options.debugMode && toUnmount > 0) {
      console.warn(`[CueManagerV2] Memory limit enforced: unmounted ${toUnmount} inactive cues`);
    }
  }

  /**
   * 활성 Cue 개수 반환
   */
  private getActiveCueCount(): number {
    return Array.from(this.mountedCues.values())
      .filter(mounted => mounted.isActive).length;
  }

  /**
   * 모든 domLifetime 확인 및 자동 계산
   */
  private ensureDomLifetimes(): void {
    if (!this.scenario) return;

    let autoCalculated = 0;

    for (const cue of this.scenario.cues) {
      if (!cue.domLifetime) {
        // domLifetime 자동 계산하여 설정
        const calculated = this.calculateDomLifetime(cue);
        (cue as any).domLifetime = calculated;
        autoCalculated++;
      }
    }

    if (this.options.debugMode && autoCalculated > 0) {
      console.log(`[CueManagerV2] Auto-calculated domLifetime for ${autoCalculated} cues`);
    }
  }

  /**
   * 트랙 찾기
   */
  private getTrack(trackId: string): Track | undefined {
    return this.scenario?.tracks.find(track => track.id === trackId);
  }

  /**
   * 모든 Cue 언마운트
   */
  private unmountAll(): void {
    // 예약된 cleanup 모두 취소
    for (const timeoutId of this.cleanupTimeouts.values()) {
      window.clearTimeout(timeoutId);
    }
    this.cleanupTimeouts.clear();

    // 모든 Cue 언마운트
    for (const cueId of Array.from(this.mountedCues.keys())) {
      this.unmountCue(cueId);
    }
  }

  /**
   * 생명주기 이벤트 리스너 등록
   */
  onLifecycle(listener: CueLifecycleListener): () => void {
    this.lifecycleListeners.add(listener);
    return () => this.lifecycleListeners.delete(listener);
  }

  /**
   * 생명주기 이벤트 알림
   */
  private notifyLifecycle(event: CueLifecycleEvent): void {
    for (const listener of this.lifecycleListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[CueManagerV2] Lifecycle listener error:', error);
      }
    }
  }

  /**
   * 디버그 통계 로그
   */
  private logDebugStats(): void {
    if (this.stats.currentMounted === 0) return;

    const activeCount = this.getActiveCueCount();
    console.log(`[CueManagerV2] Stats: ${this.stats.currentMounted} mounted (${activeCount} active), peak: ${this.stats.peakMounted}`);
  }

  /**
   * 현재 마운트된 Cue 목록 반환
   */
  getMountedCues(): ReadonlyMap<string, MountedCue> {
    return this.mountedCues;
  }

  /**
   * 특정 Cue의 마운트 상태 확인
   */
  isMounted(cueId: string): boolean {
    return this.mountedCues.has(cueId);
  }

  /**
   * 특정 Cue가 활성 상태인지 확인
   */
  isActive(cueId: string): boolean {
    return this.mountedCues.get(cueId)?.isActive ?? false;
  }

  /**
   * 통계 정보 반환
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * 정리
   */
  dispose(): void {
    this.unmountAll();
    this.lifecycleListeners.clear();
    this.scenario = null;

    if (this.options.debugMode) {
      console.log('[CueManagerV2] Disposed. Final stats:', this.stats);
    }
  }
}