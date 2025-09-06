/**
 * Core type definitions for MotionText Renderer
 * Based on CLAUDE.md specification
 */

// Core configuration types
export interface RendererConfig {
  version: '1.3';
  timebase: {
    unit: 'seconds';
    fps?: number;
  };
  stage: {
    baseAspect: string; // e.g., "16:9"
  };
  tracks: Track[];
  cues: Cue[];
}

// Track types
export interface Track {
  id: string;
  type: 'subtitle' | 'free';
  layer: number;
  overlapPolicy?: 'stack' | 'replace' | 'blend';
  defaultStyle?: Record<string, any>;
}

// Cue and Node types
export interface Cue {
  id: string;
  track: string;
  hintTime: number;
  root: GroupNode;
}

export interface BaseNode {
  id: string;
  type: 'group' | 'text' | 'image' | 'video';
  layout?: Layout;
  effectScope?: EffectScope;
}

export interface GroupNode extends BaseNode {
  type: 'group';
  children: Node[];
}

export interface TextNode extends BaseNode {
  type: 'text';
  absStart: number;
  absEnd: number;
  content: string;
  style?: Record<string, any>;
}

export interface ImageNode extends BaseNode {
  type: 'image';
  absStart: number;
  absEnd: number;
  src: string;
}

export interface VideoNode extends BaseNode {
  type: 'video';
  absStart: number;
  absEnd: number;
  src: string;
}

export type Node = GroupNode | TextNode | ImageNode | VideoNode;

// Layout types
export interface Layout {
  position: [number, number]; // Normalized coordinates (0~1)
  size?: [number, number];
  transform?: Transform;
  overflow?: 'visible' | 'hidden' | 'clip';
  override?: Record<string, any>;
}

export interface Transform {
  scale?: [number, number];
  rotation?: number;
  skew?: [number, number];
  anchor?: [number, number];
}

// Effect and Portal types
export interface EffectScope {
  breakout?: {
    mode: 'portal';
    toLayer: number;
    coordSpace: 'parent' | 'stage';
    return?: boolean;
  };
}

// Plugin types
export interface PluginManifest {
  name: string;
  version: string;
  entry: string;
  integrity: {
    entry: string;
    assets?: Record<string, string>;
  };
  peer?: Record<string, string>;
  minRenderer: string;
  capabilities: string[];
  preload?: string[];
  schema?: Record<string, any>;
}

export interface PluginContext {
  gsap?: any;
  container: HTMLElement;
  assets: {
    getUrl: (_path: string) => string;
  };
  portal?: {
    breakout: (_element: HTMLElement, _config: any) => void;
  };
  onSeek?: (_callback: () => void) => void;
  timeScale: number;
}

export interface Plugin {
  name: string;
  version: string;
  init?: (_element: HTMLElement, _options: any, _ctx: PluginContext) => void;
  animate: (
    _element: HTMLElement,
    _options: any,
    _ctx: PluginContext,
    _duration: number
  ) => any;
  cleanup?: (_element: HTMLElement) => void;
  schema?: Record<string, any>;
}
