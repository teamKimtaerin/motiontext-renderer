// Public entry for motiontext-renderer (M2.5 minimal slice)
import type { ScenarioFileV1_3 } from './types/scenario';
import { parseScenario } from './parser/ScenarioParser';
import { TimelineController } from './core/TimelineController';
import { Stage } from './core/Stage';
import { TrackManager } from './core/TrackManager';
import { Renderer } from './core/Renderer';
import gsap from 'gsap';
export { MotionTextController } from './controller';
// Public plugin configuration/registration API (for external consumers)
export {
  configureDevPlugins as configurePluginSource,
  getDevPluginConfig,
} from './loader/dev/DevPluginConfig';
import { devRegistry } from './loader/dev/DevPluginRegistry';

// (reserved) type helpers can be added later

export class MotionTextRenderer {
  private container: HTMLElement;
  private scenario: ScenarioFileV1_3 | null = null;
  private media: HTMLVideoElement | null = null;
  private timeline = new TimelineController();
  private stage = new Stage();
  private trackManager = new TrackManager();
  private renderer: Renderer;
  private unsub: (() => void) | null = null;
  private stageBoundsUnsub: (() => void) | null = null;
  private controlSafeBottomPx = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    // Enforce GSAP presence (peer dependency)
    if (!gsap) {
      throw new Error(
        "GSAP is required as a peer dependency. Install 'gsap' and ensure it is available to the host app."
      );
    }
    this.stage.setContainer(container);
    this.renderer = new Renderer(container, this.stage, this.trackManager);
    this.stageBoundsUnsub = this.stage.onBoundsChange(() =>
      this.renderer.recomputeMountedBases()
    );
    // Do not override container positioning; demo CSS positions it absolutely.
  }

  async loadConfig(config: any) {
    // Normalize incoming config to Scenario v1.3
    this.scenario = parseScenario(config);
    this.stage.setScenario(this.scenario);
    this.trackManager.setScenario(this.scenario);
    this.renderer.setScenario(this.scenario);
    this.renderer.remount();
    if (this.media) {
      this.renderer.update(this.media.currentTime);
      // Attach-only start policy: do not auto-start timeline here
    }
  }

  attachMedia(video: HTMLVideoElement) {
    this.media = video;
    this.timeline.attachMedia(video);
    this.stage.setMedia(video);
    if (this.unsub) {
      try {
        this.unsub();
      } finally {
        this.unsub = null;
      }
    }
    this.unsub = this.timeline.onTick((t) => this.renderer.update(t));
    this.renderer.update(video.currentTime);
    // If video is already playing at attach time, start timeline loop
    if (!video.paused) {
      this.timeline.ensurePlaying();
    }
  }

  play() {
    this.timeline.play();
  }

  pause() {
    this.timeline.pause();
  }

  seek(timeSec: number) {
    this.timeline.seek(timeSec);
    this.renderer.update(timeSec);
  }

  setRate(rate: number) {
    this.timeline.setRate(rate);
  }

  dispose() {
    this.pause();
    // Timeline 분리를 Stage/Renderer 이전에 처리 (관례상 안전)
    if (this.media) {
      this.timeline.detachMedia();
      this.media = null;
    }
    if (this.unsub) this.unsub();
    this.unsub = null;
    if (this.stageBoundsUnsub) this.stageBoundsUnsub();
    this.stageBoundsUnsub = null;
    this.renderer.dispose();
    this.scenario = null;
    this.stage.dispose();
  }

  setCaptionsVisible(visible: boolean) {
    this.container.style.visibility = visible ? 'visible' : 'hidden';
  }

  // Allow controller to reserve bottom safe area in pixels (e.g., controller height)
  setControlSafeBottom(px: number) {
    this.controlSafeBottomPx = Math.max(0, Math.floor(px || 0));
    // Expose to CSS so layout can offset bottom-anchored items
    this.container.style.setProperty(
      '--mtx-safe-bottom-px',
      `${this.controlSafeBottomPx}px`
    );
  }

  // (Orchestration methods moved to core/Renderer.ts)
}

export type { ScenarioFileV1_3 };

// Register a plugin module programmatically (external/custom plugins)
export function registerExternalPlugin(params: {
  name: string;
  version: string;
  module: any; // plugin module (default export + optional named)
  baseUrl: string; // base URL for assets.getUrl resolution
  manifest?: any; // optional manifest-like metadata
}): void {
  const { name, version, module, baseUrl, manifest } = params;
  devRegistry.register({
    name,
    version,
    module,
    baseUrl,
    manifest: manifest ?? { name, version, entry: 'index.mjs' },
  });
}

// Bulk-register plugins from a path→import-function map (e.g., Vite's import.meta.glob)
export async function registerExternalPluginsFromGlob(
  globMap: Record<string, () => Promise<any>>,
  parse?: (
    _path: string
  ) => { name: string; version: string; baseUrl: string } | null
): Promise<void> {
  const entries = Object.entries(globMap || {});
  for (const [path, loader] of entries) {
    try {
      const info =
        typeof parse === 'function'
          ? parse(path)
          : defaultParsePluginPath(path);
      if (!info) continue;
      const mod = await loader();
      devRegistry.register({
        name: info.name,
        version: info.version,
        module: mod,
        baseUrl: info.baseUrl,
        manifest: {
          name: info.name,
          version: info.version,
          entry: 'index.mjs',
        },
      });
    } catch {
      /* ignore single entry failures */
    }
  }
}

function defaultParsePluginPath(
  path: string
): { name: string; version: string; baseUrl: string } | null {
  // Match ".../<name>@<version>/index.mjs" at end of path
  const m = String(path).match(/\/(?<folder>[^/]+)\/(?:index\.mjs)$/);
  const folder = m?.groups?.folder;
  if (!folder) return null;
  const at = folder.lastIndexOf('@');
  const name = at > 0 ? folder.slice(0, at) : folder;
  const version = at > 0 ? folder.slice(at + 1) : '0.0.0';
  try {
    const u =
      typeof window !== 'undefined'
        ? new URL(path, window.location.origin)
        : new URL(path, 'http://localhost/');
    const baseUrl = new URL('./', u).toString();
    return { name, version, baseUrl };
  } catch {
    return null;
  }
}
