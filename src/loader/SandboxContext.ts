// Sandbox context: exposes gsap, container, assets.getUrl, portal, onSeek, timeScale, etc.
// Restricts DOM access to container subtree.
import type { PluginContext } from '../types/plugin';
import gsapImport from 'gsap';

export interface AssetsHelper {
  getUrl: (_path: string) => string;
}

export function createDevContext(
  baseUrl: string,
  container: HTMLElement,
  extras?: Partial<PluginContext>
): PluginContext {
  const assets: AssetsHelper = {
    getUrl: (p: string) => new URL(p, baseUrl).toString(),
  };
  const gsapObj: any =
    (extras && (extras as any).gsap) ||
    (typeof window !== 'undefined' && (window as any).gsap) ||
    (gsapImport as any);
  return {
    container,
    assets,
    portal: undefined,
    onSeek: undefined,
    timeScale: 1,
    gsap: gsapObj,
    ...(extras || {}),
  } as PluginContext;
}
