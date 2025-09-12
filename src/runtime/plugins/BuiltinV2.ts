// Builtin Plugins v2.0 - v2.0 내장 플러그인
// Reference: context/plugin-system-architecture-v-3-0.md
//
// v2.0 내장 플러그인 특징:
// - Plugin API v3.0 준수
// - 채널 시스템 기반
// - 수학적으로 정확한 이징 함수
// - 매개변수 검증 및 기본값

import type { PluginSpec, Channels } from '../../types/plugin-v3';

export interface BuiltinPluginOptions {
  // fadeIn/fadeOut
  easing?: 'linear' | 'ease' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounceOut';
  
  // slide 계열
  distance?: number; // 픽셀
  direction?: 'left' | 'right' | 'up' | 'down' | 'horizontal' | 'vertical';
  
  // scale 계열
  fromScale?: number;
  toScale?: number;
  
  // pop
  popScale?: number; // 최대 확대 비율
  elasticity?: number; // 탄성 정도
  
  // wave
  amplitude?: number; // 진폭 (픽셀)
  frequency?: number; // 주파수 (Hz)
  
  // shake
  intensity?: number; // 강도
  
  // spin
  turns?: number; // 회전 수
  
  // 고급 옵션
  reverse?: boolean; // 효과 방향 반전
  loop?: boolean; // 반복
}

/**
 * v2.0 내장 플러그인 평가기
 * @param plugin - 플러그인 스펙
 * @param progress - 진행도 (0~1)
 * @returns 채널 값들
 */
export function evaluateBuiltinPlugin(plugin: PluginSpec, progress: number): Channels {
  const { name, params = {} } = plugin;
  const options = params as BuiltinPluginOptions;
  
  // 진행도 검증
  const p = Math.max(0, Math.min(1, progress));
  
  switch (name) {
    case 'fadeIn':
      return evaluateFadeIn(p, options);
      
    case 'fadeOut':
      return evaluateFadeOut(p, options);
      
    case 'slideInLeft':
      return evaluateSlideIn(p, { ...options, direction: 'left' });
      
    case 'slideInRight':
      return evaluateSlideIn(p, { ...options, direction: 'right' });
      
    case 'slideInUp':
      return evaluateSlideIn(p, { ...options, direction: 'up' });
      
    case 'slideInDown':
      return evaluateSlideIn(p, { ...options, direction: 'down' });
      
    case 'slideOutLeft':
      return evaluateSlideOut(p, { ...options, direction: 'left' });
      
    case 'slideOutRight':
      return evaluateSlideOut(p, { ...options, direction: 'right' });
      
    case 'slideOutUp':
      return evaluateSlideOut(p, { ...options, direction: 'up' });
      
    case 'slideOutDown':
      return evaluateSlideOut(p, { ...options, direction: 'down' });
      
    case 'scaleIn':
      return evaluateScaleIn(p, options);
      
    case 'scaleOut':
      return evaluateScaleOut(p, options);
      
    case 'pop':
      return evaluatePop(p, options);
      
    case 'waveY':
      return evaluateWaveY(p, options);
      
    case 'waveX':
      return evaluateWaveX(p, options);
      
    case 'shakeX':
      return evaluateShakeX(p, options);
      
    case 'shakeY':
      return evaluateShakeY(p, options);
      
    case 'bounce':
      return evaluateBounce(p, options);
      
    case 'elastic':
      return evaluateElastic(p, options);
      
    case 'spin':
      return evaluateSpin(p, options);
      
    case 'flip':
      return evaluateFlip(p, options);
      
    default:
      // eslint-disable-next-line no-console
      console.warn(`[BuiltinV2] Unknown builtin plugin: ${name}`);
      return {};
  }
}

/**
 * 개별 내장 플러그인 구현들
 */

function evaluateFadeIn(progress: number, options: BuiltinPluginOptions): Channels {
  const easing = options.easing || 'ease';
  const opacity = applyEasing(progress, easing);
  
  return { opacity };
}

function evaluateFadeOut(progress: number, options: BuiltinPluginOptions): Channels {
  const easing = options.easing || 'ease';
  const opacity = 1 - applyEasing(progress, easing);
  
  return { opacity };
}

function evaluateSlideIn(progress: number, options: BuiltinPluginOptions): Channels {
  const distance = options.distance || 100;
  const direction = options.direction || 'left';
  const easing = options.easing || 'easeOut';
  
  const easedProgress = applyEasing(progress, easing);
  const offset = distance * (1 - easedProgress);
  
  switch (direction) {
    case 'left':
      return { tx: -offset };
    case 'right':
      return { tx: offset };
    case 'up':
      return { ty: -offset };
    case 'down':
      return { ty: offset };
    default:
      return { tx: -offset };
  }
}

function evaluateSlideOut(progress: number, options: BuiltinPluginOptions): Channels {
  const distance = options.distance || 100;
  const direction = options.direction || 'left';
  const easing = options.easing || 'easeIn';
  
  const easedProgress = applyEasing(progress, easing);
  const offset = distance * easedProgress;
  
  switch (direction) {
    case 'left':
      return { tx: -offset };
    case 'right':
      return { tx: offset };
    case 'up':
      return { ty: -offset };
    case 'down':
      return { ty: offset };
    default:
      return { tx: -offset };
  }
}

function evaluateScaleIn(progress: number, options: BuiltinPluginOptions): Channels {
  const fromScale = options.fromScale || 0;
  const toScale = options.toScale || 1;
  const easing = options.easing || 'easeOut';
  
  const easedProgress = applyEasing(progress, easing);
  const scale = fromScale + (toScale - fromScale) * easedProgress;
  
  return { sx: scale, sy: scale };
}

function evaluateScaleOut(progress: number, options: BuiltinPluginOptions): Channels {
  const fromScale = options.fromScale || 1;
  const toScale = options.toScale || 0;
  const easing = options.easing || 'easeIn';
  
  const easedProgress = applyEasing(progress, easing);
  const scale = fromScale + (toScale - fromScale) * easedProgress;
  
  return { sx: scale, sy: scale };
}

function evaluatePop(progress: number, options: BuiltinPluginOptions): Channels {
  const popScale = options.popScale || 1.2;
  const elasticity = options.elasticity || 0.3;
  
  // backOut 이징 시뮬레이션
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const backOut = 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);
  
  const scale = 1 + (popScale - 1) * backOut * (1 + elasticity * Math.sin(progress * Math.PI * 4));
  
  return { sx: scale, sy: scale };
}

function evaluateWaveY(progress: number, options: BuiltinPluginOptions): Channels {
  const amplitude = options.amplitude || 10;
  const frequency = options.frequency || 2;
  
  const offset = amplitude * Math.sin(progress * Math.PI * 2 * frequency);
  
  return { ty: offset };
}

function evaluateWaveX(progress: number, options: BuiltinPluginOptions): Channels {
  const amplitude = options.amplitude || 10;
  const frequency = options.frequency || 2;
  
  const offset = amplitude * Math.sin(progress * Math.PI * 2 * frequency);
  
  return { tx: offset };
}

function evaluateShakeX(progress: number, options: BuiltinPluginOptions): Channels {
  const intensity = options.intensity || 5;
  const frequency = 15; // 고정 주파수로 빠른 진동
  
  const offset = intensity * (Math.random() - 0.5) * Math.sin(progress * Math.PI * 2 * frequency);
  
  return { tx: offset };
}

function evaluateShakeY(progress: number, options: BuiltinPluginOptions): Channels {
  const intensity = options.intensity || 5;
  const frequency = 15; // 고정 주파수로 빠른 진동
  
  const offset = intensity * (Math.random() - 0.5) * Math.sin(progress * Math.PI * 2 * frequency);
  
  return { ty: offset };
}

function evaluateBounce(progress: number, options: BuiltinPluginOptions): Channels {
  const easing = options.easing || 'bounceOut';
  
  let bounceValue: number;
  
  if (easing === 'bounceOut') {
    const n1 = 7.5625;
    const d1 = 2.75;
    
    if (progress < 1 / d1) {
      bounceValue = n1 * progress * progress;
    } else if (progress < 2 / d1) {
      bounceValue = n1 * (progress -= 1.5 / d1) * progress + 0.75;
    } else if (progress < 2.5 / d1) {
      bounceValue = n1 * (progress -= 2.25 / d1) * progress + 0.9375;
    } else {
      bounceValue = n1 * (progress -= 2.625 / d1) * progress + 0.984375;
    }
  } else {
    bounceValue = progress; // fallback
  }
  
  return { sy: bounceValue };
}

function evaluateElastic(progress: number, options: BuiltinPluginOptions): Channels {
  const elasticity = options.elasticity || 0.7;
  
  if (progress === 0 || progress === 1) {
    return { sx: progress, sy: progress };
  }
  
  const c4 = (2 * Math.PI) / 3;
  const elastic = Math.pow(2, -10 * progress) * Math.sin((progress * 10 - 0.75) * c4) + 1;
  
  const scale = progress + (elastic - progress) * elasticity;
  
  return { sx: scale, sy: scale };
}

function evaluateSpin(progress: number, options: BuiltinPluginOptions): Channels {
  const turns = options.turns || 1; // 회전 수
  const rotation = progress * 360 * turns;
  
  return { rot: rotation };
}

function evaluateFlip(progress: number, options: BuiltinPluginOptions): Channels {
  const direction = options.direction || 'horizontal';
  
  if (direction === 'horizontal') {
    const scaleX = Math.cos(progress * Math.PI);
    return { sx: Math.abs(scaleX), sy: 1 };
  } else {
    const scaleY = Math.cos(progress * Math.PI);
    return { sx: 1, sy: Math.abs(scaleY) };
  }
}

/**
 * 이징 함수들
 */
function applyEasing(progress: number, easing: string): number {
  switch (easing) {
    case 'linear':
      return progress;
      
    case 'ease':
      return easeInOut(progress);
      
    case 'easeIn':
      return easeIn(progress);
      
    case 'easeOut':
      return easeOut(progress);
      
    case 'easeInOut':
      return easeInOut(progress);
      
    default:
      return progress;
  }
}

function easeIn(t: number): number {
  return t * t * t;
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOut(t: number): number {
  return t < 0.5 
    ? 4 * t * t * t 
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 내장 플러그인 목록 반환
 */
export function getBuiltinPluginNames(): string[] {
  return [
    'fadeIn', 'fadeOut',
    'slideInLeft', 'slideInRight', 'slideInUp', 'slideInDown',
    'slideOutLeft', 'slideOutRight', 'slideOutUp', 'slideOutDown',
    'scaleIn', 'scaleOut',
    'pop', 'bounce', 'elastic',
    'waveY', 'waveX',
    'shakeX', 'shakeY',
    'spin', 'flip'
  ];
}

/**
 * 플러그인이 내장 플러그인인지 확인
 */
export function isBuiltinPlugin(pluginName: string): boolean {
  return getBuiltinPluginNames().includes(pluginName);
}

/**
 * 내장 플러그인 기본 옵션 반환
 */
export function getBuiltinPluginDefaults(pluginName: string): BuiltinPluginOptions {
  const defaults: Record<string, BuiltinPluginOptions> = {
    fadeIn: { easing: 'ease' },
    fadeOut: { easing: 'ease' },
    slideInLeft: { distance: 100, easing: 'easeOut' },
    slideInRight: { distance: 100, easing: 'easeOut' },
    slideInUp: { distance: 100, easing: 'easeOut' },
    slideInDown: { distance: 100, easing: 'easeOut' },
    scaleIn: { fromScale: 0, toScale: 1, easing: 'easeOut' },
    scaleOut: { fromScale: 1, toScale: 0, easing: 'easeIn' },
    pop: { popScale: 1.2, elasticity: 0.3 },
    waveY: { amplitude: 10, frequency: 2 },
    waveX: { amplitude: 10, frequency: 2 },
    shakeX: { intensity: 5 },
    shakeY: { intensity: 5 },
    spin: { turns: 1 },
    bounce: { easing: 'bounceOut' },
    elastic: { elasticity: 0.7 },
    flip: { direction: 'horizontal' }
  };
  
  return defaults[pluginName] || {};
}