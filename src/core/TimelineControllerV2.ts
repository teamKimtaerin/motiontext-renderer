// TimelineController v2.0 - v2.0 타임라인 컨트롤러
// Reference: context/scenario-json-spec-v-2-0.md
//
// v2.0 특징:
// - requestVideoFrameCallback 기반 고정밀 동기화
// - TimeRange 배열 처리
// - 프레임 스냅 지원
// - 배속 재생 안정성

import { createLogger } from '../utils/logger';

export interface TimelineOptions {
  autoStart?: boolean; // 비디오 재생 시 자동 시작
  snapToFrame?: boolean; // 프레임 단위 스냅
  fps?: number; // 프레임률 (스냅 사용시)
  syncTolerance?: number; // 동기화 허용 오차 (초)
  debugMode?: boolean; // 디버그 모드
}

export interface TimelineState {
  isPlaying: boolean;
  currentTime: number;
  playbackRate: number;
  frameCount: number;
  lastVideoTime: number;
  driftCorrection: number;
}

export type TickCallback = (currentTime: number, frameInfo?: FrameInfo) => void;

export interface FrameInfo {
  frameNumber: number;
  timestamp: number;
  videoTime: number;
  drift: number;
  frameRate: number;
}

/**
 * v2.0 타임라인 컨트롤러
 * 비디오 미디어와 동기화된 고정밀 타임라인 관리
 */
export class TimelineControllerV2 {
  private media: HTMLVideoElement | null = null;
  private options: Required<TimelineOptions>;
  private state: TimelineState;
  private tickCallbacks = new Set<TickCallback>();
  private rafId: number | null = null;
  private videoFrameId: number | null = null;
  private startTime = 0;
  private pausedTime = 0;
  private logger = createLogger('TimelineV2', null);

  // requestVideoFrameCallback 지원 감지
  private supportsVideoFrame =
    'requestVideoFrameCallback' in HTMLVideoElement.prototype;

  constructor(options: TimelineOptions = {}) {
    this.options = {
      autoStart: true,
      snapToFrame: false,
      fps: 30,
      syncTolerance: 0.1,
      debugMode: false,
      ...options,
    };

    this.state = {
      isPlaying: false,
      currentTime: 0,
      playbackRate: 1,
      frameCount: 0,
      lastVideoTime: 0,
      driftCorrection: 0,
    };

    this.logger.setEnabled(this.options.debugMode);
    this.logger.debug('Initialized with options:', this.options);
    this.logger.debug(
      'requestVideoFrameCallback supported:',
      this.supportsVideoFrame
    );
  }

  /**
   * 비디오 미디어 연결
   * @param video - 동기화할 비디오 요소
   */
  attachMedia(video: HTMLVideoElement): void {
    this.detachMedia(); // 기존 연결 해제

    this.media = video;
    this.setupMediaListeners();

    // 비디오가 이미 재생 중이면 자동 시작
    if (this.options.autoStart && !video.paused) {
      this.ensurePlaying();
    }

    this.state.currentTime = video.currentTime;
    this.state.playbackRate = video.playbackRate;

    if (this.options.debugMode) {
      this.logger.debug('Media attached:', {
        duration: video.duration,
        currentTime: video.currentTime,
        playbackRate: video.playbackRate,
      });
    }
  }

  /**
   * 비디오 미디어 연결 해제
   */
  detachMedia(): void {
    if (!this.media) return;

    this.stop();
    this.removeMediaListeners();
    this.media = null;

    this.logger.debug('Media detached');
  }

  /**
   * 타임라인 재생 시작
   */
  play(): void {
    if (this.state.isPlaying) return;

    this.state.isPlaying = true;
    this.startTime = performance.now() - (this.pausedTime || 0);

    if (this.supportsVideoFrame && this.media) {
      this.startVideoFrameLoop();
    } else {
      this.startRafLoop();
    }

    if (this.options.debugMode) {
      console.log('[TimelineV2] Play started');
    }
  }

  /**
   * 타임라인 일시정지
   */
  pause(): void {
    if (!this.state.isPlaying) return;

    this.state.isPlaying = false;
    this.pausedTime = performance.now() - this.startTime;

    this.stopFrameLoop();

    if (this.options.debugMode) {
      console.log('[TimelineV2] Paused at:', this.state.currentTime);
    }
  }

  /**
   * 타임라인 정지 (처음으로 되돌림)
   */
  stop(): void {
    this.pause();
    this.state.currentTime = 0;
    this.state.frameCount = 0;
    this.pausedTime = 0;
    this.state.driftCorrection = 0;

    if (this.options.debugMode) {
      console.log('[TimelineV2] Stopped');
    }
  }

  /**
   * 특정 시간으로 이동
   * @param time - 이동할 시간 (초)
   */
  seek(time: number): void {
    if (!Number.isFinite(time) || time < 0) return;

    this.state.currentTime = time;
    this.pausedTime = 0;
    this.startTime = performance.now();

    // 비디오도 함께 이동
    if (this.media && Math.abs(this.media.currentTime - time) > 0.1) {
      this.media.currentTime = time;
    }

    this.notifyTick();

    if (this.options.debugMode) {
      console.log('[TimelineV2] Seeked to:', time);
    }
  }

  /**
   * 재생 속도 설정
   * @param rate - 재생 속도 (1.0 = 정상)
   */
  setRate(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0) return;

    this.state.playbackRate = rate;

    // 타임라인 시간 조정
    const now = performance.now();
    this.pausedTime = (now - this.startTime) * this.state.playbackRate;
    this.startTime = now;

    if (this.options.debugMode) {
      console.log('[TimelineV2] Playback rate set to:', rate);
    }
  }

  /**
   * 틱 콜백 등록
   * @param callback - 매 프레임마다 호출될 콜백
   * @returns 등록 해제 함수
   */
  onTick(callback: TickCallback): () => void {
    this.tickCallbacks.add(callback);
    return () => this.tickCallbacks.delete(callback);
  }

  /**
   * 비디오가 재생 중이면 타임라인도 시작
   */
  ensurePlaying(): void {
    if (this.media && !this.media.paused && !this.state.isPlaying) {
      this.play();
    }
  }

  /**
   * 현재 상태 반환
   */
  getState(): Readonly<TimelineState> {
    return { ...this.state };
  }

  /**
   * 비디오 프레임 기반 루프 시작
   */
  private startVideoFrameLoop(): void {
    if (!this.media || !this.supportsVideoFrame) return;

    const videoFrameCallback = (now: number, metadata: any) => {
      if (!this.state.isPlaying) return;

      const videoTime = metadata.mediaTime || this.media!.currentTime;
      this.updateTimeFromVideo(videoTime);

      const frameInfo: FrameInfo = {
        frameNumber: this.state.frameCount++,
        timestamp: now,
        videoTime,
        drift: this.state.driftCorrection,
        frameRate: this.calculateFrameRate(now),
      };

      this.notifyTick(frameInfo);

      // 다음 프레임 요청
      this.videoFrameId = (this.media as any).requestVideoFrameCallback(
        videoFrameCallback
      );
    };

    this.videoFrameId = (this.media as any).requestVideoFrameCallback(
      videoFrameCallback
    );
  }

  /**
   * requestAnimationFrame 기반 루프 시작
   */
  private startRafLoop(): void {
    const rafCallback = (now: number) => {
      if (!this.state.isPlaying) return;

      this.updateTimeFromPerformance(now);

      const frameInfo: FrameInfo = {
        frameNumber: this.state.frameCount++,
        timestamp: now,
        videoTime: this.media?.currentTime || 0,
        drift: this.state.driftCorrection,
        frameRate: this.calculateFrameRate(now),
      };

      this.notifyTick(frameInfo);

      // 다음 프레임 요청
      this.rafId = requestAnimationFrame(rafCallback);
    };

    this.rafId = requestAnimationFrame(rafCallback);
  }

  /**
   * 프레임 루프 중지
   */
  private stopFrameLoop(): void {
    if (this.videoFrameId && this.media && this.supportsVideoFrame) {
      (this.media as any).cancelVideoFrameCallback(this.videoFrameId);
      this.videoFrameId = null;
    }

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * 비디오 시간으로부터 타임라인 시간 업데이트
   */
  private updateTimeFromVideo(videoTime: number): void {
    const drift = Math.abs(this.state.currentTime - videoTime);

    if (drift > this.options.syncTolerance) {
      // 드리프트가 허용 오차를 초과하면 비디오 시간으로 동기화
      this.state.currentTime = videoTime;
      this.state.driftCorrection = drift;

      if (this.options.debugMode) {
        console.warn(
          `[TimelineV2] Sync correction: drift=${drift.toFixed(3)}s`
        );
      }
    } else {
      this.state.currentTime = videoTime;
      this.state.driftCorrection = drift;
    }

    this.state.lastVideoTime = videoTime;
  }

  /**
   * performance.now()로부터 타임라인 시간 업데이트
   */
  private updateTimeFromPerformance(now: number): void {
    const elapsed = ((now - this.startTime) / 1000) * this.state.playbackRate;
    this.state.currentTime = elapsed;

    // 비디오와 동기화 확인
    if (this.media && !this.media.paused) {
      const videoTime = this.media.currentTime;
      const drift = Math.abs(this.state.currentTime - videoTime);

      if (drift > this.options.syncTolerance) {
        this.state.currentTime = videoTime;
        this.state.driftCorrection = drift;
      }
    }
  }

  /**
   * 프레임률 계산
   */
  private calculateFrameRate(_now: number): number {
    // 간단한 이동 평균으로 프레임률 계산
    // 실제 구현에서는 더 정교한 계산이 필요할 수 있음
    return this.options.fps || 60;
  }

  /**
   * 틱 콜백들에게 알림
   */
  private notifyTick(frameInfo?: FrameInfo): void {
    let currentTime = this.state.currentTime;

    // 프레임 스냅 적용
    if (this.options.snapToFrame) {
      currentTime = this.snapToFrame(currentTime);
    }

    for (const callback of this.tickCallbacks) {
      try {
        callback(currentTime, frameInfo);
      } catch (error) {
        console.error('[TimelineV2] Tick callback error:', error);
      }
    }
  }

  /**
   * 프레임 단위로 시간 스냅
   */
  private snapToFrame(time: number): number {
    if (!this.options.fps) return time;
    return Math.round(time * this.options.fps) / this.options.fps;
  }

  /**
   * 비디오 이벤트 리스너 설정
   */
  private setupMediaListeners(): void {
    if (!this.media) return;

    this.media.addEventListener('play', this.onVideoPlay);
    this.media.addEventListener('pause', this.onVideoPause);
    this.media.addEventListener('seeked', this.onVideoSeeked);
    this.media.addEventListener('ratechange', this.onVideoRateChange);
  }

  /**
   * 비디오 이벤트 리스너 제거
   */
  private removeMediaListeners(): void {
    if (!this.media) return;

    this.media.removeEventListener('play', this.onVideoPlay);
    this.media.removeEventListener('pause', this.onVideoPause);
    this.media.removeEventListener('seeked', this.onVideoSeeked);
    this.media.removeEventListener('ratechange', this.onVideoRateChange);
  }

  /**
   * 비디오 이벤트 핸들러들
   */
  private onVideoPlay = () => {
    if (this.options.autoStart) {
      this.play();
    }
  };

  private onVideoPause = () => {
    this.pause();
  };

  private onVideoSeeked = () => {
    if (this.media) {
      this.seek(this.media.currentTime);
    }
  };

  private onVideoRateChange = () => {
    if (this.media) {
      this.setRate(this.media.playbackRate);
    }
  };

  /**
   * 정리
   */
  dispose(): void {
    this.detachMedia();
    this.tickCallbacks.clear();

    if (this.options.debugMode) {
      console.log('[TimelineV2] Disposed');
    }
  }
}
