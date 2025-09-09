/* eslint-disable no-console */
/**
 * MotionText Renderer Demo Application
 */

import { MotionTextRenderer, MotionTextController } from '../src/index';
import { preloadPluginsForScenario } from './devPlugins';
import { configureDevPlugins } from '../src/loader/dev/DevPluginConfig';
import { loadPluginManifest, getDefaultParameters, generatePreviewScenario, generateLoopedScenario } from './scenarioGenerator';
import { getDevPluginConfig } from '../src/loader/dev/DevPluginConfig';
import { AISubtitleEditor } from './aiEditor';
import pluginLocal from './samples/plugin_local.json';
import pluginShowcase from './samples/plugin_showcase.json';
import animatedSubtitle from './samples/animated_subtitle.json';
import animatedFreeMixed from './samples/animated_free_mixed.json';
import tiltedBox from './samples/tilted_box.json';
import m5Layout from './samples/m5_layout_features.json';
import cwiDemoFull from './samples/cwi_demo_full.json';
import type { RendererConfig } from '../src/types';

// DOM Elements
const video = document.getElementById('demo-video') as HTMLVideoElement;
const captionContainer = document.getElementById('caption-container') as HTMLElement;
const sampleSelector = document.getElementById('sample-selector') as HTMLSelectElement;
const loadSampleBtn = document.getElementById('load-sample') as HTMLButtonElement;
const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
const configEditor = document.getElementById('config-editor') as HTMLTextAreaElement;
const applyConfigBtn = document.getElementById('apply-config') as HTMLButtonElement;
const resetConfigBtn = document.getElementById('reset-config') as HTMLButtonElement;
// SafeArea dev controls
const safeTop = document.getElementById('safe-top') as HTMLInputElement | null;
const safeBottom = document.getElementById('safe-bottom') as HTMLInputElement | null;
const safeLeft = document.getElementById('safe-left') as HTMLInputElement | null;
const safeRight = document.getElementById('safe-right') as HTMLInputElement | null;
const safeApplyStage = document.getElementById('safe-apply-stage') as HTMLInputElement | null;
const safeApplySubtitle = document.getElementById('safe-apply-subtitle') as HTMLInputElement | null;
const safeApplyFree = document.getElementById('safe-apply-free') as HTMLInputElement | null;
const safeForceClamp = document.getElementById('safe-force-clamp') as HTMLInputElement | null;
const applySafeBtn = document.getElementById('apply-safearea') as HTMLButtonElement | null;
// Optional plugin mode buttons (if present in DOM)
const modeServerBtn = document.getElementById('plugin-mode-server') as HTMLButtonElement | null;
const modeLocalBtn = document.getElementById('plugin-mode-local') as HTMLButtonElement | null;
const modeAutoBtn = document.getElementById('plugin-mode-auto') as HTMLButtonElement | null;
// Quick plugin preview controls
const pluginPreviewSelector = document.getElementById('plugin-preview-selector') as HTMLSelectElement | null;
const pluginPreviewText = document.getElementById('plugin-preview-text') as HTMLInputElement | null;
const pluginPreviewLoop = document.getElementById('plugin-preview-loop') as HTMLInputElement | null;
const pluginPreviewDuration = document.getElementById('plugin-preview-duration') as HTMLInputElement | null;
const pluginPreviewGenerate = document.getElementById('plugin-preview-generate') as HTMLButtonElement | null;

// AI Editor elements
const claudeApiKeyInput = document.getElementById('claude-api-key') as HTMLInputElement;
const saveApiKeyBtn = document.getElementById('save-api-key') as HTMLButtonElement;
const editInstructionTextarea = document.getElementById('edit-instruction') as HTMLTextAreaElement;
const applyAiEditBtn = document.getElementById('apply-ai-edit') as HTMLButtonElement;
const resetToOriginalBtn = document.getElementById('reset-to-original') as HTMLButtonElement;

// Status displays
const rendererStatus = document.getElementById('renderer-status') as HTMLSpanElement;
const currentTime = document.getElementById('current-time') as HTMLSpanElement;
const activeCues = document.getElementById('active-cues') as HTMLSpanElement;

// Application state
let renderer: MotionTextRenderer | null = null;
let controller: MotionTextController | null = null;
let currentConfig: RendererConfig | null = null;
let aiEditor: AISubtitleEditor | null = null;

// Sample configurations
const sampleConfigs: Record<string, RendererConfig> = {
  basic: {
    version: '1.3',
    timebase: { unit: 'seconds' },
    stage: { baseAspect: '16:9' },
    tracks: [
      {
        id: 'subtitle',
        type: 'subtitle',
        layer: 1,
      },
    ],
    cues: [
      {
        id: 'cue1',
        track: 'subtitle',
        root: {
          e_type: 'group',
          children: [
            {
              e_type: 'text',
              text: '안녕하세요! MotionText Renderer입니다.',
              absStart: 2,
              absEnd: 5,
              layout: { position: { x: 0.5, y: 0.85 }, anchor: 'bc' },
            },
          ],
        },
      },
      {
        id: 'cue2',
        track: 'subtitle',
        root: {
          e_type: 'group',
          children: [
            {
              e_type: 'text',
              text: '이것은 기본 자막 테스트입니다.',
              absStart: 6,
              absEnd: 9,
              layout: { position: { x: 0.5, y: 0.85 }, anchor: 'bc' },
            },
          ],
        },
      },
    ],
  },
  animated_subtitle: animatedSubtitle as RendererConfig,
  animated_free_mixed: animatedFreeMixed as RendererConfig,
  tilted_box: tiltedBox as RendererConfig,
  m5_layout_features: m5Layout as RendererConfig,
  plugin_local: pluginLocal as RendererConfig,
  plugin_showcase: pluginShowcase as RendererConfig,
  // CwI full demo (statically imported to avoid top-level await delay)
  cwi_demo_full: cwiDemoFull as RendererConfig,

  animated: {
    version: '1.3',
    timebase: { unit: 'seconds' },
    stage: { baseAspect: '16:9' },
    tracks: [
      {
        id: 'title',
        type: 'free',
        layer: 2,
      },
      {
        id: 'subtitle',
        type: 'subtitle',
        layer: 1,
      },
    ],
    cues: [
      {
        id: 'title-cue',
        track: 'title',
        hintTime: { start: 1 },
        root: {
          e_type: 'group',
          children: [
            {
              e_type: 'text',
              absStart: 1,
              absEnd: 4,
              text: '🎬 애니메이션 테스트',
              layout: {
                position: { x: 0.5, y: 0.2 },
              },
            },
          ],
        },
      },
      {
        id: 'subtitle-cue',
        track: 'subtitle',
        hintTime: { start: 4 },
        root: {
          e_type: 'group',
          children: [
            {
              e_type: 'text',
              absStart: 4,
              absEnd: 8,
              text: '다양한 애니메이션 효과를 지원합니다',
              layout: {
                position: { x: 0.5, y: 0.8 },
              },
            },
          ],
        },
      },
    ],
  },

  plugin: {
    version: '1.3',
    timebase: { unit: 'seconds' },
    stage: { baseAspect: '16:9' },
    tracks: [
      {
        id: 'effect',
        type: 'free',
        layer: 3,
      },
    ],
    cues: [
      {
        id: 'plugin-cue',
        track: 'effect',
        hintTime: { start: 2 },
        root: {
          e_type: 'group',
          children: [
            {
              e_type: 'text',
              absStart: 2,
              absEnd: 6,
              text: '플러그인 시스템 테스트',
              layout: {
                position: { x: 0.5, y: 0.5 },
              },
            },
          ],
        },
      },
    ],
  },
};

// Initialize demo application
async function initDemo() {
  updateStatus('렌더러 준비됨');
  
  // Initialize AI Editor
  initAIEditor();
  
  // Set up video time update
  video.addEventListener('timeupdate', () => {
    currentTime.textContent = `${video.currentTime.toFixed(2)}s`;
  });

  // Set up event listeners
  loadSampleBtn.addEventListener('click', loadSelectedSample);
  playBtn.addEventListener('click', () => {
    video.play();
    if (renderer) renderer.play();
  });
  // Hide demo's separate pause button; custom controller handles play/pause toggle
  if (pauseBtn) pauseBtn.style.display = 'none';
  resetBtn.addEventListener('click', resetDemo);
  applyConfigBtn.addEventListener('click', applyConfig);
  resetConfigBtn.addEventListener('click', resetConfig);
  if (applySafeBtn) applySafeBtn.addEventListener('click', applySafeAreaFromUI);
  // Optional: plugin mode switchers
  if (modeServerBtn) modeServerBtn.addEventListener('click', async () => {
    const origin = prompt('Plugin server origin (e.g., http://localhost:3300):', 'http://localhost:3300') || 'http://localhost:3300';
    await setPluginModeServer(origin);
  });
  if (modeLocalBtn) modeLocalBtn.addEventListener('click', async () => {
    const base = prompt('Local plugin folder base (e.g., ./plugin-server/plugins/):', './plugin-server/plugins/') || './plugin-server/plugins/';
    await setPluginModeLocal(base);
  });
  if (modeAutoBtn) modeAutoBtn.addEventListener('click', async () => {
    const origin = prompt('Preferred server origin (optional):', 'http://localhost:3300') || 'http://localhost:3300';
    const base = prompt('Local plugin folder base (optional):', './plugin-server/plugins/') || './plugin-server/plugins/';
    await setPluginModeAuto(origin, base);
  });

  // Populate plugin preview selector and wire generator
  await populatePluginSelector();
  if (pluginPreviewGenerate) {
    pluginPreviewGenerate.addEventListener('click', async () => {
      try {
        const nameRaw = pluginPreviewSelector?.value || '';
        if (!nameRaw) { alert('플러그인을 선택하세요.'); return; }
        const key = nameRaw.includes('@') ? nameRaw : `${nameRaw}@1.0.0`;
        const dev = getDevPluginConfig();
        const manifest = await loadPluginManifest(key, { mode: dev.mode, serverBase: dev.serverBase, localBase: dev.localBase });
        const defaults = getDefaultParameters(manifest);
        // Heuristic defaults for certain plugins that need time windows
        const dur = Number(pluginPreviewDuration?.value || '3') || 3;
        if (manifest.name === 'cwi') {
          (defaults as any).kind = (defaults as any).kind || 'pop';
          (defaults as any).t0 = (defaults as any).t0 ?? 0.0;
          (defaults as any).t1 = (defaults as any).t1 ?? Math.max(0.5, dur);
        }
        const txt = pluginPreviewText?.value || manifest.name;
        // Center region with reasonable size
        const settings = {
          text: txt,
          position: { x: 320, y: 180 },
          size: { width: 480, height: 120 },
          pluginParams: defaults,
        };
        const cfg = (pluginPreviewLoop?.checked
          ? generateLoopedScenario(key, settings, dur)
          : generatePreviewScenario(key, settings, dur));
        await loadConfiguration(cfg);
        if (renderer) { renderer.play(); }
      } catch (e) {
        console.error('플러그인 미리보기 생성 실패:', e);
        alert('미리보기 생성 실패: ' + e);
      }
    });
  }

  console.log('✅ MotionText Renderer Demo 초기화 완료');
}

// Initialize AI Editor
function initAIEditor() {
  // Create AI editor instance
  aiEditor = new AISubtitleEditor((config) => {
    // Update config editor and reload
    configEditor.value = JSON.stringify(config, null, 2);
    loadConfiguration(config);
  });

  // API 키 저장 버튼
  saveApiKeyBtn.addEventListener('click', () => {
    const apiKey = claudeApiKeyInput.value.trim();
    if (!apiKey) {
      alert('API 키를 입력해주세요.');
      return;
    }

    if (!apiKey.startsWith('sk-ant-')) {
      alert('올바른 Claude API 키 형식이 아닙니다. (sk-ant-로 시작해야 함)');
      return;
    }

    if (aiEditor) {
      aiEditor.setApiKey(apiKey);
    }
  });

  // AI 편집 버튼
  applyAiEditBtn.addEventListener('click', async () => {
    const instruction = editInstructionTextarea.value.trim();
    if (!instruction) {
      alert('편집 요청을 입력해주세요.');
      return;
    }

    if (!currentConfig) {
      alert('먼저 샘플을 로드해주세요.');
      return;
    }

    if (!aiEditor?.hasValidApiKey()) {
      alert('API 키를 먼저 설정해주세요.');
      return;
    }

    try {
      // Save original config if not already saved
      if (aiEditor && currentConfig) {
        aiEditor.saveOriginalConfig(currentConfig);
      }

      // Apply AI edit
      await aiEditor?.applyEdit(instruction);
      
      // Clear instruction after successful edit
      editInstructionTextarea.value = '';
    } catch (error) {
      console.error('AI 편집 실패:', error);
      alert(`AI 편집 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  });

  // 원본 복원 버튼
  resetToOriginalBtn.addEventListener('click', () => {
    if (aiEditor) {
      aiEditor.restoreOriginal();
    }
  });

  console.log('🤖 AI 편집기 초기화 완료');
}

// Load selected sample configuration
function loadSelectedSample() {
  const selectedSample = sampleSelector.value;
  if (!selectedSample || !sampleConfigs[selectedSample]) {
    alert('샘플을 선택해주세요.');
    return;
  }

  const config = sampleConfigs[selectedSample];
  loadConfiguration(config);
}

// Load configuration into renderer
async function loadConfiguration(config: RendererConfig) {
  try {
    // Display JSON in editor
    configEditor.value = JSON.stringify(config, null, 2);
    currentConfig = config;

    // Reinitialize renderer to ensure clean state (handles Undo/Apply edge cases)
    if (renderer) {
      renderer.dispose();
    }
    if (controller) {
      controller.destroy();
      controller = null;
    }
    renderer = new MotionTextRenderer(captionContainer);
    (window as any).demoApp.renderer = renderer;
    updateStatus('렌더러 초기화됨');

    // Preload plugins referenced by scenario (Dev loader)
    await preloadPluginsForScenario(config);

    // Load configuration and attach media
    await renderer.loadConfig(config);
    renderer.attachMedia(video);

    // Mount custom controller overlay for testing
    try {
      const container = document.querySelector('.video-container') as HTMLElement;
      if (container) {
        video.controls = false; // hide native controls when using custom controller
        controller = new MotionTextController(video, renderer, container, { captionsVisible: true });
        controller.mount();
        (window as any).demoApp.controller = controller;
      }
    } catch (e) {
      console.warn('Custom controller mount skipped:', e);
    }

    updateStatus('설정 로드 완료');
    activeCues.textContent = config.cues.length.toString();

    console.log('✅ 설정 로드 완료:', config);
  } catch (error) {
    console.error('❌ 설정 로드 실패:', error);
    updateStatus('설정 로드 실패');
    alert(`설정 로드 중 오류가 발생했습니다: ${error}`);
  }
}

// Apply configuration from editor
function applyConfig() {
  try {
    const configText = configEditor.value.trim();
    if (!configText) {
      alert('JSON 설정을 입력해주세요.');
      return;
    }

    const config = JSON.parse(configText) as RendererConfig;
    loadConfiguration(config);
  } catch (error) {
    console.error('❌ JSON 파싱 실패:', error);
    alert('올바른 JSON 형식이 아닙니다.');
  }
}

// Reset configuration
function resetConfig() {
  configEditor.value = '';
  currentConfig = null;
  updateStatus('설정 초기화됨');
  activeCues.textContent = '0';
}

// Reset demo
function resetDemo() {
  video.currentTime = 0;
  video.pause();
  
  if (renderer) {
    renderer.seek(0);
    renderer.pause();
  }

  updateStatus('데모 리셋됨');
}

// Update status display
function updateStatus(status: string) {
  rendererStatus.textContent = status;
  console.log('📊 상태:', status);
}

// Error handling
window.addEventListener('error', (event) => {
  console.error('❌ 전역 오류:', event.error);
  updateStatus('오류 발생');
});

// Initialize when page loads (robust against late module evaluation)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDemo);
} else {
  initDemo();
}

// Export for debugging
(window as any).demoApp = {
  renderer,
  controller,
  video,
  aiEditor,
  loadConfiguration,
  sampleConfigs,
  applySafeAreaFromUI,
  setPluginModeServer,
  setPluginModeLocal,
  setPluginModeAuto,
  populatePluginSelector,
};

// Helper: apply safe area controls to current config and reload
function applySafeAreaFromUI() {
  try {
    if (!currentConfig) {
      alert('먼저 샘플을 로드하세요.');
      return;
    }
    const t = clamp01(parseFloat(safeTop?.value || '0'));
    const b = clamp01(parseFloat(safeBottom?.value || '0'));
    const l = clamp01(parseFloat(safeLeft?.value || '0'));
    const r = clamp01(parseFloat(safeRight?.value || '0'));
    const safe = { top: t, bottom: b, left: l, right: r } as any;
    // clone config minimally
    const cfg: any = JSON.parse(JSON.stringify(currentConfig));
    if (safeApplyStage?.checked) {
      cfg.stage = cfg.stage || {}; cfg.stage.safeArea = safe;
    }
    if (safeApplySubtitle?.checked) {
      const tr = cfg.tracks.find((x: any) => x.type === 'subtitle');
      if (tr) tr.safeArea = safe;
    }
    if (safeApplyFree?.checked) {
      const tr = cfg.tracks.find((x: any) => x.type === 'free');
      if (tr) tr.safeArea = safe;
    }
    if (safeForceClamp?.checked) {
      // set layout.safeAreaClamp = true for all nodes
      const visit = (n: any) => {
        if (n && typeof n === 'object') {
          n.layout = n.layout || {}; n.layout.safeAreaClamp = true;
          const children = Array.isArray(n.children) ? n.children : [];
          children.forEach(visit);
        }
      };
      (cfg.cues || []).forEach((c: any) => c.root && visit(c.root));
    }
    // reflect in editor and reload
    configEditor.value = JSON.stringify(cfg, null, 2);
    loadConfiguration(cfg);
  } catch (e) {
    console.error('safe-area 적용 실패', e);
    alert('safe-area 적용 실패: ' + e);
  }
}

function clamp01(v: number) { return isFinite(v) ? Math.min(1, Math.max(0, v)) : 0; }

// ===== Plugin mode switching (example for other projects) =====
async function setPluginModeServer(origin: string) {
  configureDevPlugins({ mode: 'server', serverBase: origin });
  await reloadCurrentConfig();
}

async function setPluginModeLocal(localBase: string) {
  configureDevPlugins({ mode: 'local', localBase });
  await reloadCurrentConfig();
}

async function setPluginModeAuto(origin?: string, localBase?: string) {
  const conf: any = { mode: 'auto' as const };
  if (origin) conf.serverBase = origin;
  if (localBase) conf.localBase = localBase;
  configureDevPlugins(conf);
  await reloadCurrentConfig();
}

async function reloadCurrentConfig() {
  if (!currentConfig) return;
  // Reuse existing flow to ensure plugins preload under new config
  await preloadPluginsForScenario(currentConfig);
  await loadConfiguration(currentConfig);
}

// Discover available local plugins via Vite glob and populate selector
async function populatePluginSelector() {
  if (!pluginPreviewSelector) return;
  try {
    const entries: Record<string, () => Promise<any>> = {
      ...(import.meta as any).glob('/plugin-server/plugins/*/manifest.json'),
      ...(import.meta as any).glob('./plugin-server/plugins/*/manifest.json'),
    };
    const keys = Object.keys(entries);
    const seen = new Set<string>();
    const options: { label: string; value: string }[] = [];
    for (const p of keys) {
      const m = p.match(/\/plugins\/(.+)\/manifest\.json$/);
      if (!m) continue;
      const folder = decodeURIComponent(m[1]);
      const at = folder.lastIndexOf('@');
      const name = at > 0 ? folder.slice(0, at) : folder;
      const ver = at > 0 ? folder.slice(at + 1) : '1.0.0';
      const key = `${name}@${ver}`;
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({ label: `${name} ${ver}`, value: key });
    }
    options.sort((a, b) => a.label.localeCompare(b.label));
    // Clear and append
    pluginPreviewSelector.innerHTML = '<option value="">-- 플러그인 선택 --</option>';
    for (const opt of options) {
      const el = document.createElement('option');
      el.value = opt.value;
      el.textContent = opt.label;
      pluginPreviewSelector.appendChild(el);
    }
  } catch (e) {
    console.warn('플러그인 목록 수집 실패:', e);
  }
}
