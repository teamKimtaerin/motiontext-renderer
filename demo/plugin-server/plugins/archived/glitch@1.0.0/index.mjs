/**
 * Glitch Effect Plugin
 * 디지털 오류처럼 텍스트가 흔들리고 깜빡이는 애니메이션 효과
 * MotionText Renderer Plugin API v2.1
 */

export const name = "glitch";
export const version = "1.0.0";

export function init(el, options, ctx) {
    // effectsRoot(el)에 초기 설정 적용
    if (!ctx.gsap) {
      console.error('GSAP is required for Glitch effect');
      return;
    }

    // 글리치 효과를 위한 DOM 구조 생성
    if (el && !el.hasAttribute('data-glitch')) {
      el.setAttribute('data-glitch', '');
    }
    setupGlitchStructure(el, options);
}

export function animate(el, options, ctx, duration) {
    if (!ctx.gsap || !el) {
      return (p) => {}; // 빈 함수 반환
    }

    const {
      glitchIntensity = 5,
      animationDuration = 2,
      glitchFrequency = 0.3,
      colorSeparation = true,
      noiseEffect = true
    } = options;

    // GSAP 타임라인 생성
    const tl = ctx.gsap.timeline({ repeat: -1 });
    const glitchContainer = el.querySelector('.glitch-container');
    const originalText = el.querySelector('.glitch-original');
    const redText = el.querySelector('.glitch-red');
    const cyanText = el.querySelector('.glitch-cyan');

    if (!glitchContainer) return (p) => {};

    // 기본 글리치 흔들림 효과
    tl.to(originalText, {
      x: () => ctx.gsap.utils.random(-glitchIntensity, glitchIntensity),
      y: () => ctx.gsap.utils.random(-glitchIntensity/2, glitchIntensity/2),
      duration: 0.1,
      ease: 'none',
      repeat: 3,
      yoyo: true
    }, 0);

    // 색상 분리 효과
    if (colorSeparation && redText && cyanText) {
      tl.to(redText, {
        x: () => ctx.gsap.utils.random(-glitchIntensity/2, glitchIntensity/2),
        opacity: () => ctx.gsap.utils.random(0.3, 0.8),
        duration: 0.05,
        ease: 'none',
        repeat: 5,
        yoyo: true
      }, 0)
      .to(cyanText, {
        x: () => ctx.gsap.utils.random(-glitchIntensity/2, glitchIntensity/2),
        opacity: () => ctx.gsap.utils.random(0.3, 0.8),
        duration: 0.07,
        ease: 'none',
        repeat: 4,
        yoyo: true
      }, 0.1);
    }

    // 깜빡임 효과
    tl.to(originalText, {
      opacity: 0,
      duration: 0.05,
      repeat: 1,
      yoyo: true
    }, 0.5)
    .to(originalText, {
      opacity: 0,
      duration: 0.03,
      repeat: 2,
      yoyo: true
    }, 1);

    // 노이즈 효과 (텍스처)
    if (noiseEffect) {
      tl.to(originalText, {
        filter: 'blur(1px) saturate(2) contrast(1.2)',
        duration: 0.1,
        ease: 'none',
        repeat: 1,
        yoyo: true
      }, 0.3);
    }

    // 디지털 스킵 효과
    tl.to(originalText, {
      scaleY: 0.8,
      skewX: () => ctx.gsap.utils.random(-5, 5),
      duration: 0.05,
      ease: 'none',
      repeat: 1,
      yoyo: true
    }, 1.2);

    // 위치 리셋
    tl.to([originalText, redText, cyanText], {
      x: 0,
      y: 0,
      scaleY: 1,
      skewX: 0,
      filter: 'none',
      opacity: (i) => i === 0 ? 1 : (colorSeparation ? 0.5 : 0),
      duration: 0.2,
      ease: 'power2.out'
    }, animationDuration - 0.2);

    // 상대 타임라인 반환 (호스트가 진행 제어)
    return tl;
}

export function cleanup(el) {
    if (el && window.gsap) {
      window.gsap.killTweensOf(el.querySelectorAll('*'));
      // DOM 구조 복원
      const originalText = el.querySelector('.glitch-original');
      if (originalText) {
        el.innerHTML = originalText.textContent || '';
      }
      if (el.hasAttribute('data-glitch')) {
        el.removeAttribute('data-glitch');
      }
    }
}

/**
 * 글리치 효과를 위한 DOM 구조 생성
 */
function setupGlitchStructure(element, options) {
  if (!element) return;

  // Prefer text from effectsRoot; if empty, fallback to host text and clear host to avoid duplication
  let text = element.textContent || '';
  const host = element.parentElement;
  if ((!text || !text.trim()) && host) {
    // Collect only text nodes from host; keep element children (like effectsRoot)
    let collected = '';
    const toRemove = [];
    for (const node of Array.from(host.childNodes)) {
      if (node.nodeType === 3 /* TEXT_NODE */) {
        collected += node.textContent || '';
        toRemove.push(node);
      }
    }
    toRemove.forEach((n) => host.removeChild(n));
    text = collected;
  }
  element.innerHTML = '';
  element.className = 'glitch-effect';

  const container = document.createElement('div');
  container.className = 'glitch-container';
  container.style.position = 'relative';
  container.style.display = 'inline-block';

  // 원본 텍스트
  const originalText = document.createElement('span');
  originalText.className = 'glitch-original';
  originalText.textContent = text || '글리치 효과';
  originalText.style.position = 'relative';
  originalText.style.zIndex = '3';
  originalText.style.color = '#ffffff';

  container.appendChild(originalText);

  // 색상 분리 효과를 위한 레이어들
  if (options?.colorSeparation !== false) {
    // 빨간색 레이어
    const redText = document.createElement('span');
    redText.className = 'glitch-red';
    redText.textContent = text || '글리치 효과';
    redText.style.position = 'absolute';
    redText.style.top = '0';
    redText.style.left = '0';
    redText.style.zIndex = '1';
    redText.style.color = '#ff0040';
    redText.style.mixBlendMode = 'screen';
    redText.style.opacity = '0.5';

    // 시안색 레이어
    const cyanText = document.createElement('span');
    cyanText.className = 'glitch-cyan';
    cyanText.textContent = text || '글리치 효과';
    cyanText.style.position = 'absolute';
    cyanText.style.top = '0';
    cyanText.style.left = '0';
    cyanText.style.zIndex = '2';
    cyanText.style.color = '#00ffff';
    cyanText.style.mixBlendMode = 'screen';
    cyanText.style.opacity = '0.5';

    container.appendChild(redText);
    container.appendChild(cyanText);
  }

  element.appendChild(container);
}
