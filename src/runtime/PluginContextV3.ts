// Plugin Context v3.0 (Plugin System v3.0)
// 시나리오 접근, 채널 시스템, 에셋 관리가 통합된 플러그인 컨텍스트

import type { ScenarioFileV1_3 } from '../types/scenario';
import type { PluginChannelInterface } from './ChannelComposer';

export interface ScenarioResolver {
  /**
   * Define 값 해석
   * @param definePath "define.colors.primary" 형태의 경로
   * @returns 해석된 값 또는 undefined
   */
  resolveDefine(definePath: string): any;
  
  /**
   * 시나리오 메타데이터 접근
   */
  readonly version: string;
  readonly timebase: { unit: string; fps?: number };
  readonly stage: { baseAspect: string };
  readonly tracks: any[];
}

export interface AssetManager {
  /**
   * 에셋 URL 생성 (베이스 URL 기준)
   */
  getUrl(path: string): string;
  
  /**
   * 폰트 로드 및 등록 (권한 필요)
   */
  loadFont?(fontSpec: {
    family: string;
    src: string;
    weight?: string;
    style?: string;
  }): Promise<void>;
  
  /**
   * 이미지 프리로드 (권한 필요)
   */
  preloadImage?(url: string): Promise<HTMLImageElement>;
  
  /**
   * 오디오 프리로드 (권한 필요)
   */
  preloadAudio?(url: string): Promise<HTMLAudioElement>;
}

export interface AudioSystem {
  /**
   * 오디오 재생
   */
  play(url: string, options?: {
    volume?: number;
    loop?: boolean;
    startTime?: number;
  }): Promise<void>;
  
  /**
   * 오디오 일시정지
   */
  pause(url: string): void;
  
  /**
   * 볼륨 설정
   */
  setVolume(url: string, volume: number): void;
  
  /**
   * 오디오 정지 및 해제
   */
  stop(url: string): void;
}

export interface PortalSystem {
  /**
   * 플러그인 영역 외부로 탈출 (breakout)
   * 전체 화면 오버레이 등에 사용
   */
  breakout(options: {
    zIndex?: number;
    className?: string;
    appendTo?: 'body' | 'stage';
  }): HTMLElement;
  
  /**
   * 탈출 상태 해제
   */
  return(): void;
  
  /**
   * 현재 탈출 상태인지 확인
   */
  readonly isBreakout: boolean;
}

export interface RendererInfo {
  readonly version: string;
  readonly currentTime: number;
  readonly duration: number;
  readonly timeScale: number;
  readonly fps?: number;
}

export interface PluginUtils {
  /**
   * 값 보간 (선형 보간 기본)
   */
  interpolate(from: any, to: any, progress: number, easing?: string): any;
  
  /**
   * 이징 함수들
   */
  readonly easing: Record<string, (t: number) => number>;
  
  /**
   * 색상 유틸리티
   */
  readonly color: {
    parse(color: string): { r: number; g: number; b: number; a: number } | null;
    format(rgba: { r: number; g: number; b: number; a: number }): string;
    interpolate(from: string, to: string, progress: number): string;
  };
}

/**
 * Plugin Context v3.0 완전 인터페이스
 */
export interface PluginContextV3 {
  // DOM 접근 (샌드박스)
  readonly container: HTMLElement; // effectsRoot
  
  // 시나리오 접근
  readonly scenario: ScenarioResolver;
  
  // 에셋 관리
  readonly assets: AssetManager;
  
  // 채널 시스템 (권한 필요: style-vars)
  readonly channels?: PluginChannelInterface;
  
  // 포털 시스템 (권한 필요: portal-breakout)
  readonly portal?: PortalSystem;
  
  // 오디오 시스템 (권한 필요: asset-loading)
  readonly audio?: AudioSystem;
  
  // 렌더러 정보
  readonly renderer: RendererInfo;
  
  // 유틸리티
  readonly utils: PluginUtils;
  
  // 시간 관련 콜백
  onSeek?: (callback: (progress: number) => void) => void;
  
  // 외부 라이브러리 (manifest.json의 peer 기준)
  readonly gsap?: any;
  readonly lottie?: any;
  [peerDep: string]: any;
}

/**
 * 기본 시나리오 리졸버 구현
 */
export class DefaultScenarioResolver implements ScenarioResolver {
  constructor(private scenario: ScenarioFileV1_3) {}

  resolveDefine(definePath: string): any {
    if (!definePath.startsWith('define.')) {
      return definePath; // define이 아니면 그대로 반환
    }

    const path = definePath.slice(7); // 'define.' 제거
    return this.getNestedValue(this.scenario, path);
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj?.define || obj);
  }

  get version(): string {
    return this.scenario.version || '1.3';
  }

  get timebase() {
    return this.scenario.timebase || { unit: 'seconds' };
  }

  get stage() {
    return this.scenario.stage || { baseAspect: '16:9' };
  }

  get tracks() {
    return this.scenario.tracks || [];
  }
}

/**
 * 기본 에셋 매니저 구현
 */
export class DefaultAssetManager implements AssetManager {
  constructor(private baseUrl: string) {}

  getUrl(path: string): string {
    return new URL(path, this.baseUrl).toString();
  }

  async loadFont(fontSpec: {
    family: string;
    src: string;
    weight?: string;
    style?: string;
  }): Promise<void> {
    const fontFace = new FontFace(
      fontSpec.family,
      `url("${this.getUrl(fontSpec.src)}")`,
      {
        weight: fontSpec.weight || 'normal',
        style: fontSpec.style || 'normal',
      }
    );

    await fontFace.load();
    document.fonts.add(fontFace);
  }

  async preloadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = this.getUrl(url);
    });
  }

  async preloadAudio(url: string): Promise<HTMLAudioElement> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.oncanplaythrough = () => resolve(audio);
      audio.onerror = reject;
      audio.src = this.getUrl(url);
      audio.load();
    });
  }
}

/**
 * 기본 유틸리티 구현
 */
export const defaultUtils: PluginUtils = {
  interpolate(from: any, to: any, progress: number, easing = 'linear'): any {
    const easingFn = this.easing[easing] || this.easing.linear;
    const t = easingFn(Math.max(0, Math.min(1, progress)));

    // 숫자 보간
    if (typeof from === 'number' && typeof to === 'number') {
      return from + (to - from) * t;
    }

    // 색상 보간
    if (typeof from === 'string' && typeof to === 'string') {
      if (from.startsWith('#') || to.startsWith('#') ||
          from.startsWith('rgb') || to.startsWith('rgb')) {
        return this.color.interpolate(from, to, t);
      }
    }

    // 배열 보간
    if (Array.isArray(from) && Array.isArray(to)) {
      return from.map((f, i) => this.interpolate(f, to[i] || f, progress, easing));
    }

    // 객체 보간
    if (typeof from === 'object' && typeof to === 'object') {
      const result: any = {};
      for (const key in from) {
        result[key] = this.interpolate(from[key], to[key] || from[key], progress, easing);
      }
      return result;
    }

    // 기본: threshold 방식
    return t < 0.5 ? from : to;
  },

  easing: {
    linear: (t: number) => t,
    easeIn: (t: number) => t * t,
    easeOut: (t: number) => t * (2 - t),
    easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    backOut: (t: number) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
  },

  color: {
    parse(color: string) {
      // 간단한 색상 파싱 (hex, rgb만 지원)
      if (color.startsWith('#')) {
        const hex = color.slice(1);
        if (hex.length === 3) {
          return {
            r: parseInt(hex[0] + hex[0], 16),
            g: parseInt(hex[1] + hex[1], 16),
            b: parseInt(hex[2] + hex[2], 16),
            a: 1,
          };
        } else if (hex.length === 6) {
          return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16),
            a: 1,
          };
        }
      }
      
      const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (rgbMatch) {
        return {
          r: parseInt(rgbMatch[1], 10),
          g: parseInt(rgbMatch[2], 10),
          b: parseInt(rgbMatch[3], 10),
          a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1,
        };
      }

      return null;
    },

    format(rgba: { r: number; g: number; b: number; a: number }): string {
      if (rgba.a === 1) {
        return `rgb(${Math.round(rgba.r)}, ${Math.round(rgba.g)}, ${Math.round(rgba.b)})`;
      } else {
        return `rgba(${Math.round(rgba.r)}, ${Math.round(rgba.g)}, ${Math.round(rgba.b)}, ${rgba.a})`;
      }
    },

    interpolate(from: string, to: string, progress: number): string {
      const fromColor = this.parse(from);
      const toColor = this.parse(to);
      
      if (!fromColor || !toColor) {
        return progress < 0.5 ? from : to;
      }

      return this.format({
        r: fromColor.r + (toColor.r - fromColor.r) * progress,
        g: fromColor.g + (toColor.g - fromColor.g) * progress,
        b: fromColor.b + (toColor.b - fromColor.b) * progress,
        a: fromColor.a + (toColor.a - fromColor.a) * progress,
      });
    },
  },
};

/**
 * Plugin Context v3.0 팩토리
 * 권한 시스템을 고려하여 선택적으로 기능을 포함
 */
export function createPluginContextV3(config: {
  container: HTMLElement;
  scenario: ScenarioFileV1_3;
  baseUrl: string;
  channels?: PluginChannelInterface;
  portal?: PortalSystem;
  audio?: AudioSystem;
  renderer: RendererInfo;
  peerDeps?: Record<string, any>;
  onSeek?: (callback: (progress: number) => void) => void;
}): PluginContextV3 {
  const scenarioResolver = new DefaultScenarioResolver(config.scenario);
  const assetManager = new DefaultAssetManager(config.baseUrl);

  return {
    container: config.container,
    scenario: scenarioResolver,
    assets: assetManager,
    channels: config.channels,
    portal: config.portal,
    audio: config.audio,
    renderer: config.renderer,
    utils: defaultUtils,
    onSeek: config.onSeek,
    ...config.peerDeps,
  };
}