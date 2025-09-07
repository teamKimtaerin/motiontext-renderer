// Dev plugin preloader for demo
import type { RendererConfig } from '../src/types';
import { preloadFromScenario } from '../src/loader/dev/PreloadFromScenario';

export const PLUGIN_ORIGIN = (import.meta as any).env?.VITE_PLUGIN_ORIGIN || 'http://localhost:3300';

export async function preloadPluginsForScenario(scenario: RendererConfig, origin = PLUGIN_ORIGIN) {
  await preloadFromScenario(scenario as any, origin);
}
