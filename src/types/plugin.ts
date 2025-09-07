// Types for Plugin system (v2 design)
// Reference: context/plugin-system-architecture-v-2-1.md
// Includes PluginSpec, PluginChain, and runtime interfaces.

export type ComposeMode = 'add' | 'multiply' | 'replace'; // default: replace (last-wins)

export interface PluginSpec {
  name: string; // plugin identifier
  params?: Record<string, unknown>;

  // Relative time window against element's absStart/absEnd
  relStart?: number; // seconds offset from absStart
  relEnd?: number; // seconds offset from absEnd
  relStartPct?: number; // 0..1, absStart + D*relStartPct
  relEndPct?: number; // 0..1, absEnd + D*relEndPct

  compose?: ComposeMode; // default replace
}

export type PluginChain = PluginSpec[];

// Minimal timeline-like interface (GSAP-compatible subset) for relative timelines
export interface TimelineLike {
  progress(_p?: number): this | number;
  duration(_d?: number): this | number;
  pause(): this;
  play(): this;
  kill(): void;
}

// Alternative to returning a Timeline: a pure seek applier
export type SeekApplier = (_progress: number) => void;

export interface PluginContext {
  // Host-provided utilities within sandbox
  container: HTMLElement; // restricted to container subtree
  assets: { getUrl: (_path: string) => string };
  portal?: unknown; // Portal API surface is provided by runtime (narrowed later)
  onSeek?: (_fn: (_progress: number) => void) => void;
  timeScale?: number;
  // Optional peer deps
  gsap?: unknown;
}

export interface PluginRuntimeModule {
  name: string;
  version: string;
  init?: (
    _element: HTMLElement,
    _options: Record<string, unknown> | undefined,
    _ctx: PluginContext
  ) => void;
  animate: (
    _element: HTMLElement,
    _options: Record<string, unknown> | undefined,
    _ctx: PluginContext,
    _duration: number
  ) => TimelineLike | SeekApplier;
  cleanup?: (_element: HTMLElement) => void;
  schema?: Record<string, unknown>;
}
