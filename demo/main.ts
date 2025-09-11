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
import { OfflineExporter } from './export/OfflineExporter.js';
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
const videoContainer = document.querySelector('.video-container') as HTMLElement;
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

// Export controls
const exportMp4Btn = document.getElementById('export-mp4-btn') as HTMLButtonElement;
const exportModal = document.getElementById('export-modal') as HTMLElement;
const modalOverlay = document.getElementById('modal-overlay') as HTMLElement;
const modalClose = document.getElementById('modal-close') as HTMLButtonElement;
const exportSettings = document.getElementById('export-settings') as HTMLElement;
const exportProgress = document.getElementById('export-progress') as HTMLElement;
const exportResolution = document.getElementById('export-resolution') as HTMLSelectElement;
const exportFps = document.getElementById('export-fps') as HTMLSelectElement;
const exportQuality = document.getElementById('export-quality') as HTMLSelectElement;
const exportCaptureMode = document.getElementById('export-capture-mode') as HTMLSelectElement;
const exportEncoder = document.getElementById('export-encoder') as HTMLSelectElement;
const exportStartTime = document.getElementById('export-start-time') as HTMLInputElement;
const exportEndTime = document.getElementById('export-end-time') as HTMLInputElement;
const estimatedSize = document.getElementById('estimated-size') as HTMLSpanElement;
const estimatedTime = document.getElementById('estimated-time') as HTMLSpanElement;
const exportStart = document.getElementById('export-start') as HTMLButtonElement;
const exportCancel = document.getElementById('export-cancel') as HTMLButtonElement;
const currentStage = document.getElementById('current-stage') as HTMLSpanElement;
const progressPercentage = document.getElementById('progress-percentage') as HTMLSpanElement;
const progressFill = document.getElementById('progress-fill') as HTMLElement;
const progressCurrent = document.getElementById('progress-current') as HTMLSpanElement;
const progressEta = document.getElementById('progress-eta') as HTMLSpanElement;
const exportActions = document.getElementById('export-actions') as HTMLElement;
const exportComplete = document.getElementById('export-complete') as HTMLElement;
const exportDone = document.getElementById('export-done') as HTMLButtonElement;

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
  
  // Update export button when video metadata loads
  video.addEventListener('loadedmetadata', () => {
    updateExportButtonState();
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

  // AI Editor 자동 초기화
  if (aiEditor) {
    aiEditor.initializeClient();
  }

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
      alert('환경변수에 ANTHROPIC_API_KEY를 설정하고 프록시 서버를 다시 시작해주세요.');
      return;
    }

    try {
      // Save original config if not already saved
      if (aiEditor && currentConfig) {
        aiEditor.saveOriginalConfig(currentConfig);
      }

      // Apply AI edit (자동으로 적용됨)
      await aiEditor?.applyEdit(instruction);
      
      // Clear instruction after successful edit
      editInstructionTextarea.value = '';
      
      // 성공하면 더 이상 alert 표시하지 않음 (자동 알림으로 대체)
    } catch (error) {
      console.error('AI 편집 실패:', error);
      // 에러는 여전히 alert으로 표시 (중요한 정보이므로)
      // alert(`AI 편집 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
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
    
    // Initialize export system
    initializeExportSystem();

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

// =====================================
// Export Functionality
// =====================================

// Export-related globals
let offlineExporter: OfflineExporter | null = null;

/**
 * Initialize export functionality
 */
function initializeExportSystem() {
  if (offlineExporter) {
    offlineExporter.dispose();
  }
  
  // 렌더러 인스턴스와 함께 OfflineExporter 생성
  offlineExporter = new OfflineExporter(video, videoContainer, renderer);
  
  // Enable/disable export button based on renderer state
  updateExportButtonState();
  
  console.log('Export system initialized with renderer');
}

/**
 * Update export button availability
 */
function updateExportButtonState() {
  const hasScenario = currentConfig !== null;
  const isVideoLoaded = video && video.duration > 0;
  
  exportMp4Btn.disabled = !hasScenario || !isVideoLoaded;
  
  if (!hasScenario) {
    exportMp4Btn.title = '시나리오를 먼저 로드해주세요';
  } else if (!isVideoLoaded) {
    exportMp4Btn.title = '비디오가 로드되지 않았습니다';
  } else {
    exportMp4Btn.title = 'MP4로 내보내기';
  }
}

/**
 * Show export modal
 */
function showExportModal() {
  if (!video || !video.duration) {
    alert('비디오가 로드되지 않았습니다.');
    return;
  }
  
  // Reset modal to settings view
  exportSettings.style.display = 'block';
  exportProgress.style.display = 'none';
  exportActions.style.display = 'block';
  exportComplete.style.display = 'none';
  
  // Update end time default
  exportEndTime.value = video.duration.toFixed(1);
  
  // Update estimates
  updateExportEstimates();
  
  // Show modal
  exportModal.style.display = 'flex';
}

/**
 * Hide export modal
 */
function hideExportModal() {
  exportModal.style.display = 'none';
  
  // Cancel export if in progress
  if (offlineExporter?.isExportInProgress()) {
    offlineExporter.cancelExport();
  }
}

/**
 * Update export estimates based on current settings
 */
function updateExportEstimates() {
  if (!video || !video.duration || !offlineExporter) return;
  
  const resolution = exportResolution.value.split('x');
  const width = parseInt(resolution[0]);
  const height = parseInt(resolution[1]);
  const fps = parseInt(exportFps.value);
  const startTime = parseFloat(exportStartTime.value) || 0;
  const endTime = parseFloat(exportEndTime.value) || video.duration;
  const duration = Math.max(0.1, endTime - startTime);
  
  // File size estimate
  const fileSize = offlineExporter.estimateFileSize(width, height, fps, duration);
  estimatedSize.textContent = fileSize;
  
  // Time estimate (rough calculation)
  const frameCount = Math.ceil(duration * fps);
  const estimatedSeconds = Math.max(30, frameCount * 0.2); // ~200ms per frame
  estimatedTime.textContent = offlineExporter.formatTime(estimatedSeconds * 1000);
}

/**
 * Start export process
 */
async function startExport() {
  if (!offlineExporter) return;
  
  const resolution = exportResolution.value.split('x');
  const width = parseInt(resolution[0]);
  const height = parseInt(resolution[1]);
  const fps = parseInt(exportFps.value);
  const quality = parseFloat(exportQuality.value);
  const captureMode = exportCaptureMode.value;
  const encodingMode = exportEncoder.value;
  const startTime = parseFloat(exportStartTime.value) || 0;
  const endTime = parseFloat(exportEndTime.value) || video.duration;
  
  // 캡처 모드 설정
  offlineExporter.setCaptureMode(captureMode);
  
  // 인코딩 모드 설정 (Frame Capture 모드에서만 사용)
  if (captureMode === 'frame' && offlineExporter.videoEncoder) {
    offlineExporter.videoEncoder.setEncodingMode(encodingMode);
  }
  
  // Validate settings
  if (startTime >= endTime) {
    alert('시작 시간은 끝 시간보다 작아야 합니다.');
    return;
  }
  
  if (endTime > video.duration) {
    alert('끝 시간이 비디오 길이를 초과합니다.');
    return;
  }
  
  // Switch to progress view
  exportSettings.style.display = 'none';
  exportProgress.style.display = 'block';
  exportActions.style.display = 'none';
  
  // Reset progress
  progressFill.style.width = '0%';
  progressPercentage.textContent = '0%';
  currentStage.textContent = '준비 중...';
  progressCurrent.textContent = '-';
  progressEta.textContent = '-';
  
  try {
    const options = {
      fps,
      width,
      height,
      quality,
      startTime,
      endTime,
      filename: 'motiontext-export',
      downloadAutomatically: true
    };
    
    console.log('Starting export with options:', options);
    
    await offlineExporter.exportVideo(options, (progress) => {
      updateProgressUI(progress);
    });
    
    // Show completion
    exportProgress.style.display = 'none';
    exportComplete.style.display = 'block';
    
  } catch (error) {
    console.error('Export failed:', error);
    
    // Show error and go back to settings
    alert(`내보내기 실패: ${error.message}`);
    exportProgress.style.display = 'none';
    exportSettings.style.display = 'block';
    exportActions.style.display = 'block';
  }
}

/**
 * Update progress UI
 */
function updateProgressUI(progress: any) {
  const percentage = Math.round(progress.progress * 100);
  
  progressFill.style.width = `${percentage}%`;
  progressPercentage.textContent = `${percentage}%`;
  
  // Stage messages
  const stageMessages = {
    preparation: '준비 중...',
    capturing: '프레임 캡처 중...',
    encoding: '비디오 인코딩 중...',
    finalizing: '마무리 중...',
    completed: '완료!',
    error: '오류 발생'
  };
  
  // 폴백 메시지 우선 표시
  if (progress.fallbackMessage) {
    currentStage.textContent = progress.fallbackMessage;
    currentStage.style.color = '#f59e0b'; // 주황색으로 강조
    setTimeout(() => {
      currentStage.style.color = ''; // 2초 후 원래 색상으로
    }, 2000);
  } else {
    currentStage.textContent = progress.details?.message || stageMessages[progress.stage] || progress.stage;
    currentStage.style.color = ''; // 기본 색상
  }
  
  if (progress.details) {
    if (progress.details.currentFrame && progress.details.totalFrames) {
      progressCurrent.textContent = `${progress.details.currentFrame}/${progress.details.totalFrames} 프레임`;
    } else if (progress.details.encodedFrames && progress.details.totalFrames) {
      progressCurrent.textContent = `${progress.details.encodedFrames}/${progress.details.totalFrames} 인코딩됨`;
    }
    
    if (progress.details.estimatedTimeLeft) {
      progressEta.textContent = progress.details.estimatedTimeLeft;
    }
  }
}

// =====================================
// Export Event Listeners
// =====================================

// Export button click
exportMp4Btn.addEventListener('click', showExportModal);

// Modal close events
modalClose.addEventListener('click', hideExportModal);
modalOverlay.addEventListener('click', hideExportModal);

// Settings change events
[exportResolution, exportFps, exportQuality, exportEncoder, exportStartTime, exportEndTime].forEach(element => {
  element.addEventListener('change', updateExportEstimates);
  element.addEventListener('input', updateExportEstimates);
});

// Export action buttons
exportStart.addEventListener('click', startExport);
exportCancel.addEventListener('click', hideExportModal);
exportDone.addEventListener('click', hideExportModal);

// ESC key to close modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && exportModal.style.display === 'flex') {
    hideExportModal();
  }
});
