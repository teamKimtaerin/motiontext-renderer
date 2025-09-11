// Types for Scenario JSON v2.0
// Reference: context/scenario-json-spec-v-2-0.md

import type { Layout, Style, EffectScope } from './layout';
import type { PluginSpec } from './plugin';

// v2.0 scenario version support
export const SUPPORTED_SCENARIO_V2_VERSIONS = ['2.0'] as const;
export type ScenarioV2Version = (typeof SUPPORTED_SCENARIO_V2_VERSIONS)[number];
export const CURRENT_SCENARIO_V2_VERSION: ScenarioV2Version = '2.0';

// Time array type [start, end]
export type TimeRange = [number, number];

// Define system types
export interface DefineAsset {
  type: 'font' | 'image' | 'video' | 'audio';
  url: string;
  integrity?: string; // SHA-384 hash (reserved for M7)
}

export interface DefineSection {
  [key: string]: any; // Can be any JSON value, style, asset, etc.
}

// Define reference type
export type DefineReference<T> = T | string; // string = "define.keyname"

// v2.0 Timebase (same as v1.3)
export interface TimebaseV2 {
  unit: 'seconds' | 'tc'; // default seconds
  fps?: number;
}

// v2.0 Stage (same as v1.3)
export interface StageSpecV2 {
  baseAspect: '16:9' | '9:16' | 'auto';
  safeArea?: { top?: number; bottom?: number; left?: number; right?: number };
}

// v2.0 Behavior (same as v1.3)
export interface BehaviorSpecV2 {
  preloadMs?: number; // default 300
  resizeThrottleMs?: number; // default 80
  snapToFrame?: boolean; // default false
}

export type TrackTypeV2 = 'subtitle' | 'free';
export type ScaleModeV2 = 'scaleWithVideo' | 'fixedPoint' | 'cap';
export type OverlapPolicyV2 = 'ignore' | 'push' | 'stack';

// v2.0 Track with Define references support
export interface TrackV2 {
  id: string;
  type: TrackTypeV2;
  layer: number; // higher is above
  scaleMode?: DefineReference<ScaleModeV2>; // default scaleWithVideo
  overlapPolicy?: DefineReference<OverlapPolicyV2>; // default ignore
  defaultStyle?: DefineReference<Style>;
  safeArea?: DefineReference<{ top?: number; bottom?: number; left?: number; right?: number }>;
}

// v2.0 Cue - domLifetime replaces hintTime
export interface CueV2 {
  id: string;
  track: string;
  domLifetime?: DefineReference<TimeRange>; // [start, end] or auto-calculated
  root: NodeV2;
}

// v2.0 Node types with mandatory id and displayTime
export interface BaseNodeV2 {
  id: string; // MANDATORY in v2.0
  e_type: 'group' | 'text' | 'image' | 'video';
  displayTime?: DefineReference<TimeRange>; // [start, end] replaces absStart/absEnd
  layout?: DefineReference<Layout>;
  style?: DefineReference<Style>;
  pluginChain?: DefineReference<PluginSpecV2[]>;
  effectScope?: DefineReference<EffectScope>;
}

export interface GroupNodeV2 extends BaseNodeV2 {
  e_type: 'group';
  children?: NodeV2[];
}

export interface TextNodeV2 extends BaseNodeV2 {
  e_type: 'text';
  text: DefineReference<string>;
}

export interface ImageNodeV2 extends BaseNodeV2 {
  e_type: 'image';
  src: DefineReference<string>;
  alt?: DefineReference<string>;
}

export interface VideoNodeV2 extends BaseNodeV2 {
  e_type: 'video';
  src: DefineReference<string>;
  poster?: DefineReference<string>;
}

export type NodeV2 = GroupNodeV2 | TextNodeV2 | ImageNodeV2 | VideoNodeV2;

// v2.0 Plugin spec with time_offset
export interface PluginSpecV2 extends Omit<PluginSpec, 'relStart' | 'relEnd' | 'relStartPct' | 'relEndPct'> {
  time_offset?: DefineReference<TimeRange>; // [start, end] replaces rel* fields
}

// v2.0 Main Scenario interface
export interface ScenarioV2 {
  version: ScenarioV2Version;
  timebase?: TimebaseV2;
  stage?: StageSpecV2;
  behavior?: BehaviorSpecV2;
  define?: DefineSection; // NEW: Define section for reusable definitions
  tracks: TrackV2[];
  cues: CueV2[];
}

// Utility types for inheritance system (M2.0.2)
export interface InheritableProps {
  layout?: Layout;
  style?: Style;
  pluginChain?: PluginSpecV2[];
  effectScope?: EffectScope;
}

// Asset resolution context (M2.0.1)
export interface AssetContext {
  baseUrl?: string;
  fonts: Map<string, FontFace>;
  images: Map<string, string>;
  videos: Map<string, string>;
  audios: Map<string, string>;
}