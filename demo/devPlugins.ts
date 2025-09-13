// Dev plugin preloader for demo
import type { RendererConfig } from '../src/types';
import { preloadFromScenario } from '../src/loader/dev/PreloadFromScenario';
import { preloadFromScenarioV2 } from '../src/loader/dev/PreloadFromScenarioV2';
import { configureDevPlugins, getDevPluginConfig } from '../src/loader/dev/DevPluginConfig';
import { devRegistry } from '../src/loader/dev/DevPluginRegistry';

// Statically enumerate local plugin entries (Vite dev only)
const LOCAL_PLUGIN_ENTRIES: Record<string, () => Promise<any>> = {
  ...import.meta.glob('/plugin-server/plugins/*/index.mjs'),
  ...import.meta.glob('./plugin-server/plugins/*/index.mjs'),
};

// Configure dev plugin source from environment (optional). Defaults are provided in the loader.
const MODE = (import.meta as any).env?.VITE_PLUGIN_MODE || 'auto';
const ORIGIN = (import.meta as any).env?.VITE_PLUGIN_ORIGIN || 'http://localhost:3300';
const LOCAL_BASE = (import.meta as any).env?.VITE_PLUGIN_LOCAL_BASE || './plugin-server/plugins/';

configureDevPlugins({ mode: MODE, serverBase: ORIGIN, localBase: LOCAL_BASE });

export async function preloadPluginsForScenario(scenario: RendererConfig) {
  // Proactively register local plugins via Vite glob when in local/auto mode.
  // This avoids HTTP fetch of local files and enables pure name@version resolution.
  try { await ensureLocalPluginsRegistered(); } catch { /* noop */ }
  
  // Use v2.0 preloader for v2.0 scenarios
  if ((scenario as any).version === '2.0') {
    await preloadFromScenarioV2(scenario as any);
  } else {
    await preloadFromScenario(scenario as any);
  }
}

// Register all local plugins found under demo/plugin-server/plugins via Vite glob
async function ensureLocalPluginsRegistered() {
  const cfg = getDevPluginConfig();
  if (cfg.mode === 'server') return; // server-only mode
  const paths = Object.keys(LOCAL_PLUGIN_ENTRIES);
  for (const p of paths) {
    // p example: '/plugin-server/plugins/cwi@1.0.0/index.mjs'
    const m = p.match(/\/plugins\/(.+)\/index\.mjs$/);
    if (!m) continue;
    const folder = decodeURIComponent(m[1]);
    const at = folder.lastIndexOf('@');
    const name = at > 0 ? folder.slice(0, at) : folder;
    const version = at > 0 ? folder.slice(at + 1) : '0.0.0';
    // Skip if already registered
    if (devRegistry.has(name) || devRegistry.has(`${name}@${version}`)) continue;
    try {
      const mod: any = await LOCAL_PLUGIN_ENTRIES[p]!();
      const baseUrl = new URL('./', new URL(p, window.location.origin)).toString();
      devRegistry.register({ name, version, module: mod, baseUrl, manifest: { name, version, entry: 'index.mjs' } });
    } catch (_e) {
      // ignore single entry failure; continue others
    }
  }
}

// No explicit clear required in normal usage; registry persists across mode switches.
