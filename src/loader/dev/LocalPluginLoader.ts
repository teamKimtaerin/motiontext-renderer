// Local-only loader: dynamically import plugin entry from a local folder and register.
import { devRegistry, type RegisteredPlugin } from './DevPluginRegistry';

function ensureTrailingSlash(s: string): string {
  return s.endsWith('/') ? s : s + '/';
}

// Glob all local plugin entry modules under demo root (Vite dev only)
// Note: This path is resolved relative to Vite dev server root 'demo'.
// Keys look like '/plugin-server/plugins/<name@version>/index.mjs'
const localEntries: Record<string, () => Promise<any>> =
  typeof import.meta !== 'undefined' && (import.meta as any).glob
    ? (import.meta as any).glob('/plugin-server/plugins/*/index.mjs')
    : {};

export async function importFrom(base: string, key: string): Promise<RegisteredPlugin> {
  // 1) Try Vite glob mapping for reliable dev-time resolution
  let matchPath: string | undefined = undefined;
  const suffix = `/${key}/index.mjs`;
  const suffixEnc = `/${encodeURIComponent(key)}/index.mjs`;
  for (const p of Object.keys(localEntries)) {
    if (p.endsWith(suffix) || p.endsWith(suffixEnc)) { matchPath = p; break; }
  }
  let mod: any = undefined;
  let baseUrl: string | undefined = undefined;
  if (matchPath) {
    mod = await localEntries[matchPath]!();
    // Compute baseUrl from matched path relative to location
    const u = new URL(matchPath, window.location.origin);
    baseUrl = new URL('./', u).toString();
  } else {
    // 2) Fallback: direct URL import from configured base
    const baseAbs = new URL(ensureTrailingSlash(base), window.location.href).toString();
    const folder = encodeURIComponent(key);
    const entryUrl = new URL(`${folder}/index.mjs`, baseAbs).toString();
    mod = await import(/* @vite-ignore */ entryUrl);
    baseUrl = new URL(`./${folder}/`, baseAbs).toString();
  }

  const at = key.lastIndexOf('@');
  const name = at > 0 ? key.slice(0, at) : key;
  const version = at > 0 ? key.slice(at + 1) : '0.0.0';
  const p: RegisteredPlugin = {
    name,
    version,
    module: mod,
    baseUrl: baseUrl!,
    manifest: { name, version, entry: 'index.mjs' },
  };
  devRegistry.register(p);
  return p;
}
