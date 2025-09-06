/**
 * MotionText Renderer Demo Application
 */

import { MotionTextRenderer } from '../src/index';
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

// Status displays
const rendererStatus = document.getElementById('renderer-status') as HTMLSpanElement;
const currentTime = document.getElementById('current-time') as HTMLSpanElement;
const activeCues = document.getElementById('active-cues') as HTMLSpanElement;

// Application state
let renderer: MotionTextRenderer | null = null;
let currentConfig: RendererConfig | null = null;

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
        hintTime: 2,
        root: {
          id: 'group1',
          type: 'group',
          children: [
            {
              id: 'text1',
              type: 'text',
              absStart: 2,
              absEnd: 5,
              content: '안녕하세요! MotionText Renderer입니다.',
              layout: {
                position: [0.5, 0.85],
              },
            },
          ],
        },
      },
      {
        id: 'cue2',
        track: 'subtitle',
        hintTime: 6,
        root: {
          id: 'group2',
          type: 'group',
          children: [
            {
              id: 'text2',
              type: 'text',
              absStart: 6,
              absEnd: 9,
              content: '이것은 기본 자막 테스트입니다.',
              layout: {
                position: [0.5, 0.85],
              },
            },
          ],
        },
      },
    ],
  },

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
        hintTime: 1,
        root: {
          id: 'title-group',
          type: 'group',
          children: [
            {
              id: 'title-text',
              type: 'text',
              absStart: 1,
              absEnd: 4,
              content: '🎬 애니메이션 테스트',
              layout: {
                position: [0.5, 0.2],
              },
            },
          ],
        },
      },
      {
        id: 'subtitle-cue',
        track: 'subtitle',
        hintTime: 4,
        root: {
          id: 'subtitle-group',
          type: 'group',
          children: [
            {
              id: 'subtitle-text',
              type: 'text',
              absStart: 4,
              absEnd: 8,
              content: '다양한 애니메이션 효과를 지원합니다',
              layout: {
                position: [0.5, 0.8],
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
        hintTime: 2,
        root: {
          id: 'plugin-group',
          type: 'group',
          children: [
            {
              id: 'plugin-text',
              type: 'text',
              absStart: 2,
              absEnd: 6,
              content: '플러그인 시스템 테스트',
              layout: {
                position: [0.5, 0.5],
              },
            },
          ],
        },
      },
    ],
  },
};

// Initialize demo application
function initDemo() {
  updateStatus('렌더러 준비됨');
  
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
  pauseBtn.addEventListener('click', () => {
    video.pause();
    if (renderer) renderer.pause();
  });
  resetBtn.addEventListener('click', resetDemo);
  applyConfigBtn.addEventListener('click', applyConfig);
  resetConfigBtn.addEventListener('click', resetConfig);

  console.log('✅ MotionText Renderer Demo 초기화 완료');
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

    // Initialize renderer if not exists
    if (!renderer) {
      renderer = new MotionTextRenderer(captionContainer);
      updateStatus('렌더러 초기화됨');
    }

    // Load configuration
    await renderer.loadConfig(config);
    renderer.attachMedia(video);

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

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initDemo);

// Export for debugging
(window as any).demoApp = {
  renderer,
  video,
  loadConfiguration,
  sampleConfigs,
};