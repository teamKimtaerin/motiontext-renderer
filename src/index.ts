// MotionText Renderer v2.0 Native - Public API
import type { Scenario } from "./types/scenario-v2";
import { parseScenario } from "./parser/ScenarioParserV2";
import { RendererV2 } from "./core/RendererV2";
import { AssetManager } from "./assets/AssetManager";
export { MotionTextController } from "./controller";
// Public plugin configuration/registration API (for external consumers)
export { configureDevPlugins as configurePluginSource, getDevPluginConfig } from './loader/dev/DevPluginConfig';
import { devRegistry } from './loader/dev/DevPluginRegistry';

// (reserved) type helpers can be added later

export class MotionTextRenderer {
  private renderer: RendererV2;
  private assetManager: AssetManager;
  private scenario: Scenario | null = null;

  constructor(container: HTMLElement) {
    this.renderer = new RendererV2({
      container,
      preloadMs: 300,
      snapToFrame: false,
      fps: 30,
      debugMode: true
    });
    this.assetManager = new AssetManager();
  }

  async loadConfig(config: any) {
    // Parse v2.0 scenario
    this.scenario = parseScenario(config);
    
    // Load assets from define section if present
    if (this.scenario.define) {
      await this.assetManager.loadAssetsFromDefines(this.scenario.define);
    }
    
    // Set scenario to renderer
    this.renderer.setScenario(this.scenario);
  }

  attachMedia(video: HTMLVideoElement) {
    // Delegate to RendererV2 which uses TimelineControllerV2 for proper sync
    this.renderer.attachMedia(video);
  }

  play() {
    // V2 renderer doesn't manage playback directly
    // This is handled by the video element
  }

  pause() {
    // V2 renderer doesn't manage playback directly
    // This is handled by the video element
  }

  seek(timeSec: number) {
    this.renderer.update(timeSec);
  }

  dispose() {
    this.renderer.dispose();
    this.assetManager.dispose();
    this.scenario = null;
  }

  setCaptionsVisible(visible: boolean) {
    // This would need to be implemented in RendererV2
    // For now, we can modify container visibility
    this.renderer['container'].style.visibility = visible ? "visible" : "hidden";
  }

  // Allow controller to reserve bottom safe area in pixels (e.g., controller height)
  setControlSafeBottom(px: number) {
    const controlSafeBottomPx = Math.max(0, Math.floor(px || 0));
    // Expose to CSS so layout can offset bottom-anchored items
    this.renderer['container'].style.setProperty('--mtx-safe-bottom-px', `${controlSafeBottomPx}px`);
  }
}

export type { Scenario };

// Register a plugin module programmatically (external/custom plugins)
export function registerExternalPlugin(params: {
  name: string;
  version: string;
  module: any;               // plugin module (default export + optional named)
  baseUrl: string;           // base URL for assets.getUrl resolution
  manifest?: any;            // optional manifest-like metadata
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
  parse?: (_path: string) => { name: string; version: string; baseUrl: string } | null
): Promise<void> {
  const entries = Object.entries(globMap || {});
  for (const [path, loader] of entries) {
    try {
      const info = (typeof parse === 'function') ? parse(path) : defaultParsePluginPath(path);
      if (!info) continue;
      const mod = await loader();
      devRegistry.register({
        name: info.name,
        version: info.version,
        module: mod,
        baseUrl: info.baseUrl,
        manifest: { name: info.name, version: info.version, entry: 'index.mjs' },
      });
    } catch { /* ignore single entry failures */ }
  }
}

function defaultParsePluginPath(path: string): { name: string; version: string; baseUrl: string } | null {
  // Match ".../<name>@<version>/index.mjs" at end of path
  const m = String(path).match(/\/(?<folder>[^/]+)\/(?:index\.mjs)$/);
  const folder = m?.groups?.folder;
  if (!folder) return null;
  const at = folder.lastIndexOf('@');
  const name = at > 0 ? folder.slice(0, at) : folder;
  const version = at > 0 ? folder.slice(at + 1) : '0.0.0';
  try {
    const u = (typeof window !== 'undefined') ? new URL(path, window.location.origin) : new URL(path, 'http://localhost/');
    const baseUrl = new URL('./', u).toString();
    return { name, version, baseUrl };
  } catch {
    return null;
  }
}
