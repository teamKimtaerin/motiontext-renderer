import type { Scenario } from '../../types/scenario-v2';
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

export async function preloadFromScenarioV2(
  scenario: Scenario,
  origin?: string,
  defaultVersion = '1.0.0'
): Promise<void> {
  const cfg = getDevPluginConfig();
  const want = new Map<string, { id: string; version: string }>();
  
  for (const cue of scenario.cues || []) {
    eachNode((cue as any).root, (node) => {
      // pluginChain in v2.0
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
          console.warn('[preloadFromScenarioV2] server load failed:', key);
        }
      }
    }
    // Local path for 'local' or when 'auto' server failed
    if (!loaded && (mode === 'local' || mode === 'auto')) {
      // If already present (e.g., registered earlier by ensureLocalPluginsRegistered), skip import
      if (devRegistry.has(key) || devRegistry.has(id)) {
        loaded = true;
        console.log(`[preloadFromScenarioV2] Plugin already registered: ${key}`);
      } else {
        try {
          await importLocal(cfg.localBase, key);
          loaded = true;
          console.log(`[preloadFromScenarioV2] Loaded plugin: ${key}`);
        } catch (e) {
          console.warn('[preloadFromScenarioV2] local import failed:', key, e);
        }
      }
    }
    // If neither path succeeded, leave it unresolved; renderer will degrade gracefully
  }
}
