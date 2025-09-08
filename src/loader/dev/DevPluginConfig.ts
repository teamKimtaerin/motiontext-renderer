export type DevPluginMode = 'server' | 'local' | 'auto';

export interface DevPluginConfig {
  mode: DevPluginMode;
  serverBase: string; // e.g., http://localhost:3300
  localBase: string;  // e.g., ./demo/plugin-server/plugins/
}

let cfg: DevPluginConfig | null = null;

function env(key: string, fallback: string): string {
  const v = (import.meta as any)?.env?.[key];
  return (v ?? fallback) as string;
}

function ensureTrailingSlash(s: string): string {
  return s.endsWith('/') ? s : s + '/';
}

export function getDevPluginConfig(): DevPluginConfig {
  if (cfg) return cfg;
  // Defaults: auto mode, localhost server, repo-local plugin folder
  const mode = (env('VITE_PLUGIN_MODE', 'auto') as DevPluginMode);
  const serverBase = env('VITE_PLUGIN_ORIGIN', 'http://localhost:3300');
  // Dev server root is 'demo', so default local base is './plugin-server/plugins/'
  const localBase = env('VITE_PLUGIN_LOCAL_BASE', './plugin-server/plugins/');
  cfg = {
    mode: mode === 'server' || mode === 'local' || mode === 'auto' ? mode : 'auto',
    serverBase: serverBase.replace(/\/$/, ''),
    localBase: ensureTrailingSlash(localBase),
  };
  return cfg;
}

export function configureDevPlugins(opts: Partial<DevPluginConfig> & { mode?: DevPluginMode }): void {
  const cur = getDevPluginConfig();
  cfg = {
    mode: opts.mode ?? cur.mode,
    serverBase: (opts.serverBase ?? cur.serverBase).replace(/\/$/, ''),
    localBase: ensureTrailingSlash(opts.localBase ?? cur.localBase),
  };
}
