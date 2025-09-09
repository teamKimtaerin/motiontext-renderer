/**
 * Motion Text Renderer 시나리오 생성 유틸리티
 * 플러그인 manifest.json을 기반으로 RendererConfig 생성
 */

import type { RendererConfig } from '../src/types';
import { getDevPluginConfig } from '../src/loader/dev/DevPluginConfig';

export interface PluginManifest {
  name: string
  version: string
  pluginApi: string
  targets: string[]
  capabilities?: string[]
  schema: Record<string, SchemaProperty>
}

export interface SchemaProperty {
  type: 'number' | 'string' | 'boolean' | 'select'
  label: string
  description: string
  default: unknown
  min?: number
  max?: number
  step?: number
  enum?: string[]
}

export interface PreviewSettings {
  text: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  pluginParams: Record<string, unknown>
}

/**
 * 플러그인 manifest를 로드합니다
 */
export async function loadPluginManifest(pluginName: string): Promise<PluginManifest> {
  try {
    // Resolve manifest from dev config (server/local/auto)
    const cfg = getDevPluginConfig();
    const key = pluginName.includes('@') ? pluginName : `${pluginName}@1.0.0`;
    const tryUrls: string[] = [];
    // 0) Try Vite glob dynamic import when in dev (local files)
    try {
      const ENTRIES: Record<string, () => Promise<any>> = {
        ...(import.meta as any).glob('/plugin-server/plugins/*/manifest.json'),
        ...(import.meta as any).glob('./plugin-server/plugins/*/manifest.json'),
      };
      let match: string | undefined;
      const suffixRaw = `/${key}/manifest.json`;
      const suffixEnc = `/${encodeURIComponent(key)}/manifest.json`;
      for (const p of Object.keys(ENTRIES)) {
        if (p.endsWith(suffixRaw) || p.endsWith(suffixEnc)) { match = p; break; }
      }
      if (match) {
        const mod = await ENTRIES[match]!();
        const json = (mod?.default ?? mod) as PluginManifest;
        if (json && typeof json === 'object' && json.name) return json;
      }
    } catch { /* ignore and fall through to fetch */ }
    if (cfg.mode === 'server' || cfg.mode === 'auto') {
      tryUrls.push(`${cfg.serverBase.replace(/\/$/, '')}/plugins/${encodeURIComponent(key)}/manifest.json`);
    }
    if (cfg.mode === 'local' || cfg.mode === 'auto') {
      // localBase is usually './plugin-server/plugins/' relative to demo root
      const base = cfg.localBase; // already ensured trailing slash
      tryUrls.push(`${base}${encodeURIComponent(key)}/manifest.json`);
      // Also attempt absolute dev root mapping
      tryUrls.push(`/plugin-server/plugins/${encodeURIComponent(key)}/manifest.json`);
    }
    let response: Response | null = null;
    let lastErr: unknown = null;
    // Prepare fetch URL variants (raw and encoded)
    const variants: string[] = [];
    for (const u of tryUrls) {
      if (!u) continue;
      // Replace only the last segment folder with raw/encoded variants
      variants.push(u.replace(/\/(?:[^\/]+)\/manifest\.json$/, `/${key}/manifest.json`));
      variants.push(u.replace(/\/(?:[^\/]+)\/manifest\.json$/, `/${encodeURIComponent(key)}/manifest.json`));
      variants.push(u); // original
    }
    for (const url of variants) {
      try {
        response = await fetch(url);
        if (!response.ok) { continue; }
        // Ensure we actually got JSON (avoid SPA HTML fallbacks)
        const ct = response.headers.get('content-type') || '';
        if (!/json/i.test(ct)) {
          // Attempt to parse anyway but guard
          try { return await response.clone().json(); }
          catch { continue; }
        }
        try {
          return await response.json();
        } catch (e) {
          lastErr = e; continue;
        }
      } catch (e) { lastErr = e; }
    }
    throw new Error(`Failed to load manifest for ${pluginName} (tried server/local). Last error: ${String(lastErr)}`);
  } catch (error) {
    console.error(`Error loading manifest for ${pluginName}:`, error)
    throw error
  }
}

/**
 * manifest의 기본값으로부터 초기 파라미터를 생성합니다
 */
export function getDefaultParameters(manifest: PluginManifest): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  
  Object.entries(manifest.schema).forEach(([key, property]) => {
    params[key] = property.default
  })
  
  return params
}

/**
 * 미리보기용 RendererConfig를 생성합니다
 */
export function generatePreviewScenario(
  pluginName: string,
  settings: PreviewSettings,
  duration: number = 3
): RendererConfig {
  // 위치를 0-1 범위로 정규화 (640x360 기준)
  const normalizedX = Math.max(0, Math.min(1, settings.position.x / 640))
  const normalizedY = Math.max(0, Math.min(1, settings.position.y / 360))
  const relW = Math.max(0, Math.min(1, settings.size.width / 640));
  const relH = Math.max(0, Math.min(1, settings.size.height / 360));
  
  return {
    version: '1.3',
    timebase: { unit: 'seconds' },
    stage: { 
      baseAspect: '16:9',
      backgroundColor: 'transparent' 
    },
    tracks: [
      {
        id: 'preview-track',
        type: 'free',
        layer: 1,
      },
    ],
    cues: [
      {
        id: 'preview-cue',
        track: 'preview-track',
        hintTime: { start: 0 },
        root: {
          e_type: 'group',
          layout: {
            position: { x: normalizedX, y: normalizedY },
            anchor: 'tl',
            size: {
              width: relW,
              height: relH,
            },
          },
          children: [
            {
              e_type: 'text',
              text: settings.text,
              absStart: 0,
              absEnd: duration,
              style: {
                fontSizeRel: 0.06,
                fontFamily: 'Arial, sans-serif',
                color: '#ffffff',
                align: 'center',
              },
              pluginChain: [
                {
                  name: pluginName,
                  params: settings.pluginParams,
                },
              ],
            },
          ],
        },
      },
    ],
  } as RendererConfig
}

/**
 * 무한 루프 시나리오를 생성합니다
 */
export function generateLoopedScenario(
  pluginName: string,
  settings: PreviewSettings,
  duration: number = 3
): RendererConfig {
  // 위치를 0-1 범위로 정규화 (640x360 기준)
  const normalizedX = Math.max(0, Math.min(1, settings.position.x / 640))
  const normalizedY = Math.max(0, Math.min(1, settings.position.y / 360))
  const relW = Math.max(0, Math.min(1, settings.size.width / 640));
  const relH = Math.max(0, Math.min(1, settings.size.height / 360));
  
  // Simplified plugin chain - only the requested plugin
  const pluginChain = [
    {
      name: pluginName,
      params: settings.pluginParams,
      relStartPct: 0.0,
      relEndPct: 1.0,
    }
  ];
  
  const scenario = {
    version: '1.3',
    timebase: { unit: 'seconds' },
    stage: { 
      baseAspect: '16:9'
    },
    tracks: [
      {
        id: 'free',
        type: 'free',
        layer: 1,
      },
    ],
    cues: [
      {
        id: 'preview-cue',
        track: 'free',
        root: {
          e_type: 'text',
          text: settings.text,
          absStart: 0,
          absEnd: duration,
          layout: {
            position: { x: normalizedX, y: normalizedY },
            anchor: 'cc',
            size: { width: relW, height: relH },
          },
          style: {
            fontSizeRel: 0.07,
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            align: 'center'
          },
          pluginChain: pluginChain,
        },
      },
    ],
  } as RendererConfig
  
  console.log('[ScenarioGenerator] Generated scenario:', JSON.stringify(scenario, null, 2))
  return scenario
}

/**
 * 파라미터 검증 및 정규화
 */
export function validateAndNormalizeParams(
  params: Record<string, unknown>,
  manifest: PluginManifest
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {}
  
  Object.entries(manifest.schema).forEach(([key, property]) => {
    const value = params[key] ?? property.default
    
    // 타입별 검증 및 정규화
    switch (property.type) {
      case 'number':
        let numValue = Number(value as number)
        if (!Number.isFinite(numValue)) {
          const d = typeof property.default === 'number' ? property.default : Number(property.default as number)
          numValue = Number.isFinite(d) ? (d as number) : 0
        }
        if (property.min !== undefined) {
          numValue = Math.max(property.min, numValue)
        }
        if (property.max !== undefined) {
          numValue = Math.min(property.max, numValue)
        }
        normalized[key] = numValue
        break
        
      case 'boolean':
        normalized[key] = Boolean(value)
        break
        
      case 'select':
        {
          const v = String(value)
          const ok = property.enum?.includes(v)
          normalized[key] = ok ? v : String(property.default ?? '')
        }
        break
        
      case 'string':
      default:
        normalized[key] = String(value ?? property.default ?? '')
        break
    }
  })
  
  return normalized
}

/**
 * assets-database.json의 configFile을 manifest.json으로 변환
 */
export function convertConfigFileToManifest(configFile: string): string {
  // "/plugin/rotation/config.json" -> "/plugin/rotation/manifest.json"
  return configFile.replace('/config.json', '/manifest.json')
}
