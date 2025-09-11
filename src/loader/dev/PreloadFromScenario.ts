import type { ScenarioFileV1_3 } from '../../types/scenario';
import { devRegistry } from './DevPluginRegistry';
import { loadFrom } from './DevPluginLoader';
import { getDevPluginConfig } from './DevPluginConfig';
import { importFrom as importLocal } from './LocalPluginLoader';

function eachNode(n: any, visit: (_node: any) => void) {
  if (!n || typeof n !== 'object') return;
  visit(n);
  const children: any[] = Array.isArray(n.children) ? n.children : [];
  for (const c of children) eachNode(c, visit);
}

function parseName(name: string): { id: string; version?: string } {
  const idx = name.lastIndexOf('@');
  if (idx > 0) {
    return { id: name.slice(0, idx), version: name.slice(idx + 1) };
  }
  return { id: name };
}

export async function preloadFromScenario(
  scenario: ScenarioFileV1_3,
  origin?: string,
  defaultVersion = '1.0.0'
): Promise<void> {
  const cfg = getDevPluginConfig();
  const want = new Map<string, { id: string; version: string }>();
  for (const cue of scenario.cues || []) {
    eachNode((cue as any).root, (node) => {
      // single plugin
      const single = (node as any).plugin;
      if (single && typeof single.name === 'string') {
        const { id, version } = parseName(single.name);
        want.set(`${id}@${version || defaultVersion}`, {
          id,
          version: version || defaultVersion,
        });
      }
      // pluginChain
      const chain: any[] = Array.isArray((node as any).pluginChain)
        ? (node as any).pluginChain
        : [];
      for (const spec of chain) {
        if (!spec || typeof spec.name !== 'string') continue;
        const { id, version } = parseName(spec.name);
        want.set(`${id}@${version || defaultVersion}`, {
          id,
          version: version || defaultVersion,
        });
      }
    });
  }

  // Also scan bindings: pluginPerToken and overrides.plugin (if present)
  const bindings: any[] = Array.isArray((scenario as any).bindings)
    ? ((scenario as any).bindings as any[])
    : [];
  for (const b of bindings) {
    const src = b?.fromWordStream;
    if (
      src &&
      src.pluginPerToken &&
      typeof src.pluginPerToken.name === 'string'
    ) {
      const { id, version } = parseName(src.pluginPerToken.name);
      want.set(`${id}@${version || defaultVersion}`, {
        id,
        version: version || defaultVersion,
      });
    }
    const ovs: any[] = Array.isArray(src?.overrides) ? src.overrides : [];
    for (const ov of ovs) {
      if (ov?.plugin && typeof ov.plugin.name === 'string') {
        const { id, version } = parseName(ov.plugin.name);
        want.set(`${id}@${version || defaultVersion}`, {
          id,
          version: version || defaultVersion,
        });
      }
    }
  }

  for (const { id, version } of want.values()) {
    const key = `${id}@${version}`;
    const mode = cfg.mode;
    const serverBase = (origin ? origin : cfg.serverBase).replace(/\/$/, '');

    let loaded = false;
    // Server-preferred path for 'server' and 'auto'
    if (mode === 'server' || mode === 'auto') {
      const manifestUrl = `${serverBase}/plugins/${key}/manifest.json`;
      try {
        await loadFrom(manifestUrl);
        loaded = true;
      } catch (_e) {
        if (mode === 'server') {
          // eslint-disable-next-line no-console
          console.warn('[preloadFromScenario] server load failed:', key);
        }
      }
    }
    // Local path for 'local' or when 'auto' server failed
    if (!loaded && (mode === 'local' || mode === 'auto')) {
      // If already present (e.g., registered earlier), skip import
      if (devRegistry.has(key) || devRegistry.has(id)) {
        loaded = true;
      } else {
        try {
          await importLocal(cfg.localBase, key);
          loaded = true;
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[preloadFromScenario] local import failed:', key, e);
        }
      }
    }
    // If neither path succeeded, leave it unresolved; renderer will degrade gracefully
  }
}
