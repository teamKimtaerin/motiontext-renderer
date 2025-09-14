// MotionText Renderer v2.0 Native Types
// Reference: context/scenario-json-spec-v-2-0.md
//
// 완전한 v2.0 전용 타입 정의. v1.3 의존성 없음.
// - displayTime: [start, end] 배열 기반
// - domLifetime: [start, end] 배열 기반
// - time_offset: [start, end] 배열 기반
// - 노드 ID 의무화
// - Define 시스템 지원

import type { Layout, Style, EffectScope, LayoutConstraints } from './layout';
import type { PluginSpec } from './plugin-v3';

// ============================================================================
// Core Types
// ============================================================================

export const SCENARIO_VERSION = '2.0' as const;
// PLUGIN_API_VERSION은 plugin-v3.ts에서 export함

// Time range type [start, end]
export type TimeRange = [number, number];

// Define reference type
export type DefineReference<T> = T | string; // string = "define.keyname"

// ============================================================================
// Define System
// ============================================================================

export interface DefineAsset {
  type: 'font' | 'image' | 'video' | 'audio';
  family?: string; // for fonts
  src: string;
  url?: string; // legacy support
  preload?: boolean;
  integrity?: string; // SHA-384 hash
  fallback?: string[]; // for fonts
  alt?: string; // for images
  mimeType?: string; // for video/audio
  loop?: boolean; // for audio/video
  volume?: number; // for audio
  display?: 'swap' | 'fallback' | 'optional' | 'block'; // for fonts
}

export interface AssetContext {
  baseUrl?: string;
  fonts: Map<string, FontFace>;
  images: Map<string, string>;
  videos: Map<string, string>;
  audios: Map<string, string>;
}

export interface DefineSection {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  [key: string]: any; // Define 시스템은 모든 JSON 값을 허용해야 함 (styles, assets, configs 등)
}

// ============================================================================
// Scenario Structure
// ============================================================================

export interface Timebase {
  unit: 'seconds';
  fps?: number;
}

export interface Stage {
  baseAspect: '16:9' | '9:16' | 'auto';
  safeArea?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
}

export interface Behavior {
  preloadMs?: number; // default 300
  resizeThrottleMs?: number; // default 80
  snapToFrame?: boolean; // default false
}

export type TrackType = 'subtitle' | 'free';
export type OverlapPolicy = 'push' | 'stack' | 'ignore';

export interface Track {
  id: string;
  type: TrackType;
  layer: number; // higher is above
  overlapPolicy?: DefineReference<OverlapPolicy>; // default push
  defaultStyle?: DefineReference<Style>;
  defaultConstraints?: DefineReference<LayoutConstraints>; // default layout constraints for this track
}

export interface Cue {
  id: string;
  track: string;
  domLifetime?: DefineReference<TimeRange>; // [start, end] - auto-calculated if omitted
  root: Node;
}

// ============================================================================
// Nodes
// ============================================================================

export interface BaseNode {
  id: string; // MANDATORY in v2.0
  eType: 'group' | 'text' | 'image' | 'video';
  displayTime?: DefineReference<TimeRange>; // [start, end] - inherited from parent if omitted
  baseTime?: DefineReference<TimeRange>; // [start, end] - base time for time_offset calculations
  layout?: DefineReference<Layout>;
  style?: DefineReference<Style>;
  pluginChain?: DefineReference<PluginSpec[]>;
  effectScope?: DefineReference<EffectScope>;
}

export interface GroupNode extends BaseNode {
  eType: 'group';
  children?: Node[];
}

export interface TextNode extends BaseNode {
  eType: 'text';
  text: DefineReference<string>;
}

export interface ImageNode extends BaseNode {
  eType: 'image';
  src: DefineReference<string>;
  alt?: DefineReference<string>;
}

export interface VideoNode extends BaseNode {
  eType: 'video';
  src: DefineReference<string>;
  autoplay?: DefineReference<boolean>;
  muted?: DefineReference<boolean>;
  loop?: DefineReference<boolean>;
}

export type Node = GroupNode | TextNode | ImageNode | VideoNode;

// ============================================================================
// Plugin System References
// ============================================================================

// 플러그인 타입들은 plugin-v3.ts에서 정의됨

// ============================================================================
// Main Scenario
// ============================================================================

export interface Scenario {
  version: '2.0';
  pluginApiVersion?: '3.0';
  timebase: Timebase;
  stage: Stage;
  behavior?: Behavior;
  define?: DefineSection; // Define section for reusable values
  tracks: Track[];
  cues: Cue[];
}

// ============================================================================
// Inheritance System
// ============================================================================

export interface ResolvedNode
  extends Omit<
    BaseNode,
    'displayTime' | 'baseTime' | 'layout' | 'style' | 'pluginChain' | 'effectScope'
  > {
  displayTime: TimeRange;
  baseTime?: TimeRange;
  layout?: Layout;
  style?: Style;
  pluginChain?: PluginSpec[];
  effectScope?: EffectScope;
}

export interface ResolvedTextNode extends ResolvedNode {
  eType: 'text';
  text: string;
}

export interface ResolvedImageNode extends ResolvedNode {
  eType: 'image';
  src: string;
  alt?: string;
}

export interface ResolvedVideoNode extends ResolvedNode {
  eType: 'video';
  src: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
}

export interface ResolvedGroupNode extends ResolvedNode {
  eType: 'group';
  children?: ResolvedNodeUnion[];
}

export type ResolvedNodeUnion =
  | ResolvedTextNode
  | ResolvedImageNode
  | ResolvedVideoNode
  | ResolvedGroupNode;

// ============================================================================
// Asset Management
// ============================================================================

export interface AssetManager {
  baseUrl?: string;
  fonts: Map<string, FontFace>;
  images: Map<string, string>;
  videos: Map<string, string>;
  audios: Map<string, string>;
}

// ============================================================================
// Legacy type aliases (for gradual migration)
// ============================================================================

// Aliases for existing code during transition
export type ScenarioV2 = Scenario;
export type NodeV2 = Node;
export type CueV2 = Cue;
export type TrackV2 = Track;
export type TimebaseV2 = Timebase;
export type StageSpecV2 = Stage;
export type BehaviorSpecV2 = Behavior;
export type PluginSpecV2 = PluginSpec;
