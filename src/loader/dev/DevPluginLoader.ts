// Dev-only loader: fetch manifest → fetch entry → Blob import → register in devRegistry
import { devRegistry, type RegisteredPlugin } from './DevPluginRegistry';
import gsapImport from 'gsap';

export interface DevManifest {
  name: string;
  version: string;
  entry: string;
  pluginApi?: string;
  targets?: string[];
  capabilities?: string[];
  preload?: string[];
  peer?: Record<string, string>;
}

function baseOf(url: string): string {
  try {
    const u = new URL(url, window.location.href);
    u.pathname = u.pathname.replace(/[^/]+$/, '');
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

export async function loadFrom(manifestUrl: string): Promise<RegisteredPlugin> {
  const res = await fetch(manifestUrl);
  if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status}`);
  const manifest = (await res.json()) as DevManifest;
  // Peer validation (dev warning only)
  try {
    if (manifest.peer && typeof manifest.peer.gsap === 'string') {
      const range = manifest.peer.gsap;
      const actual =
        (typeof window !== 'undefined' && (window as any).gsap?.version) ||
        ((gsapImport as any)?.version as string | undefined);
      let ok = false;
      if (actual) ok = satisfies(actual, range);
      else ok = false;
      if (!ok) {
        /* eslint-disable-next-line no-console */
        console.warn(
          `[DevPluginLoader] Peer 'gsap' version mismatch or missing. Required: '${range}', ` +
            `Detected: '${actual ?? 'none'}' (dev-warning)`
        );
      }
    }
  } catch (_err) { /* noop */ }
  const base = baseOf(manifestUrl);
  const entryUrl = new URL(manifest.entry, base).toString();
  const entryRes = await fetch(entryUrl);
  if (!entryRes.ok) throw new Error(`Entry fetch failed: ${entryRes.status}`);
  const code = await entryRes.text();
  const blob = new Blob([code], { type: 'text/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  // vite needs @vite-ignore
  const mod: any = await import(/* @vite-ignore */ blobUrl);
  const p: RegisteredPlugin = {
    name: manifest.name,
    version: manifest.version,
    module: mod,
    baseUrl: base,
    manifest,
  };
  devRegistry.register(p);
  return p;
}

// Minimal semver '^' and exact comparator for dev warnings
function parseVer(v: string): [number, number, number] {
  const m = String(v).trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return [0, 0, 0];
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function cmp(a: [number, number, number], b: [number, number, number]): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] - b[2];
}

function satisfies(actual: string, range: string): boolean {
  const caret = range.trim().match(/^\^(\d+\.\d+\.\d+)$/);
  if (caret) {
    const base = parseVer(caret[1]);
    const a = parseVer(actual);
    // ^x.y.z means >= x.y.z and < (x+1).0.0
    const upper: [number, number, number] = [base[0] + 1, 0, 0];
    return cmp(a, base) >= 0 && cmp(a, upper) < 0;
  }
  const exact = range.trim().match(/^(\d+\.\d+\.\d+)$/);
  if (exact) {
    const base = parseVer(exact[1]);
    const a = parseVer(actual);
    return cmp(a, base) === 0;
  }
  // Fallback: treat as satisfied
  return true;
}
