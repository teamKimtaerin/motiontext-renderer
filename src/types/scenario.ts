// Types for Scenario JSON v1.3
// Reference: context/명령파일(JSON) 스펙 v1 3.md

import type { Layout, Style, EffectScope } from './layout';
import type { PluginSpec } from './plugin';

// Scenario-file schema version is independent from package.json version.
// Keep it explicit so loaders can validate incoming files reliably.
export const SUPPORTED_SCENARIO_VERSIONS = ['1.3'] as const;
export type ScenarioVersion = (typeof SUPPORTED_SCENARIO_VERSIONS)[number];
export const CURRENT_SCENARIO_VERSION: ScenarioVersion = '1.3';

export interface Timebase {
  unit: 'seconds' | 'tc'; // default seconds
  fps?: number;
}

export interface StageSpec {
  baseAspect: '16:9' | '9:16' | 'auto';
  safeArea?: { top?: number; bottom?: number; left?: number; right?: number };
}

export interface BehaviorSpec {
  preloadMs?: number; // default 300
  resizeThrottleMs?: number; // default 80
  snapToFrame?: boolean; // default false
}

export type TrackType = 'subtitle' | 'free';

export type ScaleMode = 'scaleWithVideo' | 'fixedPoint' | 'cap';

export type OverlapPolicy = 'ignore' | 'push' | 'stack';

export interface Track {
  id: string;
  type: TrackType;
  layer: number; // higher is above
  scaleMode?: ScaleMode; // default scaleWithVideo
  overlapPolicy?: OverlapPolicy; // default ignore
  defaultStyle?: Style;
  safeArea?: { top?: number; bottom?: number; left?: number; right?: number };
}

export interface CueHintTime {
  start?: number;
  end?: number;
}

export interface Cue {
  id: string;
  track: string; // track id
  hintTime?: CueHintTime; // execution governed by children abs ranges
  root: GroupNode; // single group root
}

export interface BaseNode {
  name?: string;
  style?: Style;
  layout?: Layout;
  plugin?: PluginSpec;
  pluginChain?: PluginSpec[]; // multiple plugins chain
  effectScope?: EffectScope;
  children?: Node[]; // groups can hold children
}

export interface GroupNode extends BaseNode {
  e_type: 'group';
}

export interface TextNode extends BaseNode {
  e_type: 'text';
  text: string;
  absStart?: number;
  absEnd?: number;
  tokenId?: number;
}

export interface ImageNode extends BaseNode {
  e_type: 'image';
  src: string;
  absStart?: number;
  absEnd?: number;
  alt?: string;
}

export interface VideoNode extends BaseNode {
  e_type: 'video';
  src: string;
  absStart?: number;
  absEnd?: number;
  mute?: boolean;
  loop?: boolean;
}

export type Node = GroupNode | TextNode | ImageNode | VideoNode;

export interface WordToken {
  id: number;
  text: string;
  t0: number;
  t1: number;
}

export interface WordStream {
  source?: string;
  language?: string;
  tokens: WordToken[];
}

export interface BindingOverride {
  id: number;
  plugin?: PluginSpec;
  style?: Style;
  layout?: Partial<Layout>;
}

export interface BindingRule {
  target: string; // e.g. "cueId.root.children[0]" or node path
  fromWordStream: {
    range: { startId: number; endId: number };
    layoutPerToken?: Partial<Layout>;
    pluginPerToken?: PluginSpec;
    overrides?: BindingOverride[];
  };
}

export interface ScenarioFileV1_3 {
  version: ScenarioVersion;
  timebase: Timebase;
  stage: StageSpec;
  behavior?: BehaviorSpec;
  tracks: Track[];
  wordStream?: WordStream;
  bindings?: BindingRule[];
  cues: Cue[];
}
