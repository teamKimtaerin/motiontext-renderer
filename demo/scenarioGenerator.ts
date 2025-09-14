/**
 * Motion Text Renderer 시나리오 생성 유틸리티 (standalone)
 * - 외부 프로젝트에서도 그대로 복사/사용 가능하도록 내부 의존성 제거
 * - 플러그인 manifest.json을 기반으로 RendererConfig 생성
 */

// RendererConfig 타입 (시나리오 v2.0)
export interface RendererConfig {
  version: '2.0';
  timebase: { unit: 'seconds'; fps?: number };
  stage: { baseAspect: '16:9' | '9:16' | 'auto'; backgroundColor?: string; safeArea?: { top?: number; bottom?: number; left?: number; right?: number } };
  behavior?: { preloadMs?: number; resizeThrottleMs?: number; snapToFrame?: boolean };
  tracks: Array<{ id: string; type: 'subtitle' | 'free'; layer: number; defaultStyle?: any; safeArea?: { top?: number; bottom?: number; left?: number; right?: number } }>;
  cues: Array<{
    id: string;
    track: string;
    displayTime?: [number, number];
    domLifetime?: [number, number];
    root: any;
  }>;
}

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

export type ManifestLoadMode = 'server' | 'local' | 'auto';

export interface ManifestLoadOptions {
  mode?: ManifestLoadMode; // default 'auto'
  serverBase?: string;     // e.g., 'http://localhost:3300'
  localBase?: string;      // e.g., '/plugin-server/plugins/' or './plugin-server/plugins/'
  fetchImpl?: typeof fetch; // optional custom fetch for SSR/tests
}

/**
 * 플러그인 manifest를 로드합니다
 */
export async function loadPluginManifest(pluginName: string, opts: ManifestLoadOptions = {}): Promise<PluginManifest> {
  try {
    const key = pluginName.includes('@') ? pluginName : `${pluginName}@1.0.0`;
    const mode: ManifestLoadMode = opts.mode ?? 'auto';
    const serverBase = (opts.serverBase ?? '').replace(/\/$/, '');
    const localBase = opts.localBase ?? '';
    const f = opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch.bind(window) : undefined);
    if (!f) throw new Error('No fetch implementation available in this environment');

    const tryUrls: string[] = [];
    if (mode === 'server' || mode === 'auto') {
      if (serverBase) tryUrls.push(`${serverBase}/plugins/${key}/manifest.json`);
      if (serverBase) tryUrls.push(`${serverBase}/plugins/${encodeURIComponent(key)}/manifest.json`);
    }
    if (mode === 'local' || mode === 'auto') {
      if (localBase) {
        const base = localBase.endsWith('/') ? localBase : localBase + '/';
        tryUrls.push(`${base}${key}/manifest.json`);
        tryUrls.push(`${base}${encodeURIComponent(key)}/manifest.json`);
      }
      // Optional conventional absolute path
      tryUrls.push(`/plugin-server/plugins/${key}/manifest.json`);
      tryUrls.push(`/plugin-server/plugins/${encodeURIComponent(key)}/manifest.json`);
    }

    let lastErr: unknown = null;
    for (const url of tryUrls) {
      try {
        const res = await f(url);
        if (!res || !res.ok) continue;
        const ct = res.headers.get('content-type') || '';
        if (/json/i.test(ct)) return await res.json();
        try { return await res.json(); } catch { continue; }
      } catch (e) { lastErr = e; }
    }
    throw new Error(`Failed to load manifest for ${pluginName}. Tried ${tryUrls.join(', ')}. Last error: ${String(lastErr)}`);
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
  // Center position (always use center for preview)
  const normalizedX = 0.5;
  const normalizedY = 0.5;
  const relW = Math.max(0, Math.min(1, settings.size.width / 640));
  const relH = Math.max(0, Math.min(1, settings.size.height / 360));
  
  return {
    version: '2.0',
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
        defaultConstraints: {
          mode: 'flow',
          direction: 'vertical',
          maxWidth: 1.0,
          maxHeight: 1.0,
          anchor: 'cc',
          constraintMode: 'flexible',
          breakoutEnabled: true
        }
      },
    ],
    cues: [
      {
        id: 'preview-cue',
        track: 'preview-track',
        displayTime: [0, duration],
        domLifetime: [0, duration + 0.5],
        root: {
          id: 'preview-group',
          eType: 'group',
          layout: {
            mode: 'absolute',
            position: { x: normalizedX, y: normalizedY },
            anchor: 'cc',
            size: {
              width: Math.max(0.3, relW),  // 최소 30% 너비 보장
              height: Math.max(0.3, relH), // 최소 30% 높이 보장
            },
            // Center children inside the preview group
            childrenLayout: {
              mode: 'flow',
              direction: 'vertical',
              align: 'center',
              justify: 'center',
              gap: 0
            },
          },
          children: [
            {
              id: 'preview-text',
              eType: 'text',
              text: settings.text,
              // layout 제거 - flow 모드 정렬에 완전히 의존
              style: {
                fontSize: '1.5rem',
                fontFamily: 'Arial, sans-serif',
                color: '#ffffff',
                textAlign: 'center',
              },
              pluginChain: [
                {
                  name: pluginName,
                  params: settings.pluginParams,
                  timeOffset: ['0%', '100%'],
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
  // Center position (always use center for preview)
  const normalizedX = 0.5;
  const normalizedY = 0.5;
  const relW = Math.max(0, Math.min(1, settings.size.width / 640));
  const relH = Math.max(0, Math.min(1, settings.size.height / 360));
  
  // Simplified plugin chain - only the requested plugin
  const pluginChain = [
    {
      name: pluginName,
      params: settings.pluginParams,
      timeOffset: ['0%', '100%'],
    }
  ];
  
  const scenario = {
    version: '2.0',
    timebase: { unit: 'seconds' },
    stage: { 
      baseAspect: '16:9'
    },
    tracks: [
      {
        id: 'free',
        type: 'free',
        layer: 1,
        defaultConstraints: {
          mode: 'flow',
          direction: 'vertical',
          maxWidth: 1.0,
          maxHeight: 1.0,
          anchor: 'cc',
          constraintMode: 'flexible',
          breakoutEnabled: true
        }
      },
    ],
    cues: [
      {
        id: 'preview-cue',
        track: 'free',
        displayTime: [0, duration],
        domLifetime: [0, duration + 0.5],
        root: {
          id: 'looped-group',
          eType: 'group',
          displayTime: [0, duration],
          layout: {
            mode: 'absolute',
            position: { x: normalizedX, y: normalizedY },
            anchor: 'cc',
            size: { 
              width: Math.max(0.3, relW),  // 최소 30% 너비 보장
              height: Math.max(0.3, relH)  // 최소 30% 높이 보장
            },
            // Center children inside the looped group
            childrenLayout: {
              mode: 'flow',
              direction: 'vertical',
              align: 'center',
              justify: 'center',
              gap: 0
            },
          },
          children: [
            {
              id: 'looped-text',
              eType: 'text',
              text: settings.text,
              // layout 제거 - flow 모드 정렬에 완전히 의존
              style: {
                fontSize: '1.7rem',
                fontFamily: 'Arial, sans-serif',
                color: '#ffffff',
                textAlign: 'center'
              },
              pluginChain: pluginChain,
            }
          ]
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
