// Plugin System API v3.0
// Reference: context/plugin-system-architecture-v-3-0.md
//
// v2.1 → v3.0 주요 변경사항:
// - time_offset: [start, end] 배열로 시간 표현 통일
// - 강화된 권한 시스템 (7개 capabilities)
// - 에셋 관리 통합 (무결성 검증, FontFace 자동화)
// - Define 시스템 연동

import type { TimeRange, DefineReference } from './scenario-v2';

// ============================================================================
// Core Plugin Types
// ============================================================================

export const PLUGIN_API_VERSION = '3.0' as const;

export type ComposeMode = 'replace' | 'add' | 'multiply';
export type DomScope = 'effectsRoot' | 'baseWrapper';

// Plugin capabilities (v3.0 expanded from 3 → 7)
export type PluginCapability = 
  | 'style-vars'         // CSS 변수 채널 조작 권한
  | 'portal-breakout'    // breakout 시스템 사용 권한
  | 'dom-manipulation'   // 고급 DOM 조작 권한
  | 'asset-loading'      // 런타임 에셋 동적 로딩 권한
  | 'audio-playback'     // 오디오 재생 제어 권한
  | 'external-api'       // 외부 API 호출 권한 (fetch, XMLHttpRequest)
  | 'performance-timing' // 성능 측정 및 프로파일링 API 권한

// Plugin targets (v3.0 expanded)
export type PluginTarget = 
  | 'text'   // 텍스트 노드
  | 'image'  // 이미지 노드
  | 'video'  // 비디오 노드
  | 'group'  // 그룹 노드
  | 'stage'  // 스테이지 전역 (배경 효과, 글로벌 필터 등)

// ============================================================================
// Plugin Specification
// ============================================================================

export interface PluginSpec {
  name: string;
  type?: 'channel' | 'dom' | 'hybrid'; // v3.0 플러그인 타입 명시 (성능 최적화)
  time_offset?: DefineReference<TimeRange>; // [start, end] - v3.0 시간 표현 통일
  params?: DefineReference<Record<string, unknown>>;
  compose?: DefineReference<ComposeMode>; // default 'replace'
  domScope?: DefineReference<DomScope>; // default 'effectsRoot'
  capabilities?: DefineReference<PluginCapability[]>;
  targets?: DefineReference<PluginTarget[]>;
  priority?: DefineReference<number>; // 같은 시간대 플러그인 실행 우선순위
}

export type PluginChain = PluginSpec[];

// ============================================================================
// Manifest Schema (v3.0)
// ============================================================================

export interface PluginManifestSchema {
  [key: string]: SchemaField;
}

export interface SchemaField {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  default?: unknown;
  min?: number;
  max?: number;
  enum?: unknown[];
  pattern?: string; // 문자열 검증 정규식
  
  // UI 메타데이터
  ui?: {
    control?: 'text' | 'number' | 'slider' | 'select' | 'checkbox' | 'color';
    group?: string;
    order?: number;
    step?: number;
    unit?: string;
    allowDefine?: boolean; // define 참조 허용 여부
  };
  
  // 다국어 지원
  i18n?: {
    label?: Record<string, string>; // { "en": "Label", "ko": "라벨" }
    description?: Record<string, string>;
    options?: Record<string, Record<string, string>>; // enum 옵션별 다국어
  };
  
  // 조건부 필드
  dependencies?: {
    [fieldName: string]: { when: unknown };
  };
}

export interface PluginManifest {
  name: string;
  version: string;
  type?: 'channel' | 'dom' | 'hybrid'; // v3.0 플러그인 타입 선언 (성능 최적화)
  pluginApi: '3.0';
  minRenderer: string; // 최소 렌더러 버전
  entry: string; // 진입점 파일
  
  targets: PluginTarget[]; // 적용 가능한 노드 타입
  capabilities: PluginCapability[]; // 사용할 권한 목록
  
  // 의존성
  peer?: Record<string, string>; // peer dependencies (e.g., gsap)
  
  // 에셋 로딩
  preload?: string[]; // 사전 로딩할 에셋
  lazyLoad?: string[]; // 지연 로딩할 에셋
  
  // 무결성 검증
  integrity?: {
    entry: string; // entry 파일 SHA-384 해시
    assets?: Record<string, string>; // 에셋별 해시
    signature?: string; // ed25519 서명 (선택적)
  };
  
  // 스키마
  schema?: PluginManifestSchema;
}

// ============================================================================
// Runtime Context (v3.0)
// ============================================================================

export interface BreakoutOptions {
  mode?: 'portal' | 'lift';
  toLayer?: number;
  coordSpace?: 'stage' | 'track' | 'parent';
  transfer?: 'move' | 'clone';
  return?: {
    when?: 'complete' | 'manual';
    transition?: {
      duration?: number;
      easing?: string;
    };
  };
}

export interface AudioOptions {
  loop?: boolean;
  volume?: number;
  delay?: number;
}

export interface PluginContext {
  // 기본 컨테이너 (effectsRoot)
  container: HTMLElement;
  
  // 에셋 관리 (v3.0 확장)
  assets: {
    getUrl: (path: string) => string;
    loadAsset: (path: string) => Promise<ArrayBuffer>;
    preloadAsset: (path: string) => Promise<void>;
    getAssetType: (path: string) => 'image' | 'video' | 'font' | 'audio' | undefined;
  };
  
  // 시나리오 데이터 접근 (v3.0 신규)
  scenario: {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    define: Record<string, any>; // Define 시스템 일관성
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    resolveDefine: (path: string) => any; // Define 시스템 일관성
    version: string;
  };
  
  // 포털 시스템 (portal-breakout capability 필요)
  portal?: {
    breakout: (options: BreakoutOptions) => void;
    return: () => void;
  };
  
  // 채널 시스템 (style-vars capability 필요)
  channels?: {
    set: (channel: string, value: ChannelValue | unknown, mode?: ComposeMode) => void;
    get: (channel: string) => ChannelValue | unknown;
    available: string[];
    debug?: (channel: string, value: ChannelValue | unknown) => void; // 디버그 모드
  };
  
  // 오디오 시스템 (audio-playback capability 필요)
  audio?: {
    play: (url: string, options?: AudioOptions) => Promise<void>;
    pause: (url: string) => void;
    setVolume: (url: string, volume: number) => void;
    stop: (url: string) => void;
  };
  
  // 렌더러 정보
  renderer: {
    version: string;
    timeScale: number;
    currentTime: number;
    duration: number;
    debug?: boolean; // 디버그 모드 여부
  };
  
  // 유틸리티
  utils: {
    interpolate: <T>(from: T, to: T, progress: number) => T;
    easing: Record<string, (t: number) => number>;
  };
  
  // Peer 의존성 (manifest의 peer 필드 기준)
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  gsap?: any; // 외부 라이브러리 타입
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  lottie?: any; // 외부 라이브러리 타입
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  [peerDep: string]: any; // 외부 라이브러리 타입
}

// ============================================================================
// Plugin Runtime Module (v3.0)
// ============================================================================

// Timeline-like interface (GSAP 호환)
export interface TimelineLike {
  pause(): this;
  progress(value?: number): number | this;
  duration(value?: number): number | this;
  kill?(): void;
}

// Seek 함수형 인터페이스
export type SeekApplier = (progress: number) => void;

export interface PluginRuntimeModule {
  name: string;
  version: string;
  
  // 초기화 (선택적)
  init?: (
    element: HTMLElement, 
    options: Record<string, unknown>, 
    ctx: PluginContext
  ) => Promise<void> | void;
  
  // 애니메이션 생성 (필수)
  animate: (
    element: HTMLElement,
    options: Record<string, unknown>,
    ctx: PluginContext,
    duration: number
  ) => TimelineLike | SeekApplier | Promise<TimelineLike | SeekApplier>;
  
  // 정리 (선택적)
  cleanup?: (element: HTMLElement) => Promise<void> | void;
  
  // 스키마 (선택적, manifest와 동일)
  schema?: PluginManifestSchema;
  
  // 에러 핸들링 (선택적)
  onError?: (error: Error, context: string) => void;
}

// ============================================================================
// Channel System (v3.0)
// ============================================================================

export type ChannelValue = number | string | boolean;

export interface Channels {
  // 변환 채널
  tx?: number;      // translateX (px)
  ty?: number;      // translateY (px)  
  sx?: number;      // scaleX (1 = 원본 크기)
  sy?: number;      // scaleY (1 = 원본 크기)
  rot?: number;     // rotate (deg)
  
  // 시각 효과 채널
  opacity?: number; // 0~1
  filter?: string;  // CSS filter
  mixBlendMode?: string;
  
  // 색상 채널
  color?: string;
  background?: string;
  borderColor?: string;
  
  // 사용자 정의 채널
  [channel: string]: ChannelValue | undefined;
}

// ============================================================================
// Legacy Compatibility (임시)
// ============================================================================

// v2.1 호환성을 위한 임시 타입들 (점진적 제거 예정)
export interface LegacyPluginSpec {
  name: string;
  relStart?: number;
  relEnd?: number;
  relStartPct?: number;
  relEndPct?: number;
  params?: Record<string, unknown>;
  compose?: ComposeMode;
}