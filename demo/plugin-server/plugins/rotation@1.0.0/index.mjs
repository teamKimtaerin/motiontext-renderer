/**
 * 3D Rotation Text Effect Plugin
 * 텍스트가 3차원 공간에서 회전하는 애니메이션 효과
 * MotionText Renderer Plugin API v2.1
 */

export default {
  name: "rotation",
  version: "1.0.0",
  
  init(el, options, ctx) {
    if (!ctx.gsap) {
      console.error('GSAP is required for 3D Rotation effect');
      return;
    }
    setupRotation3D(el, options);
    splitTextIntoCharacters(el);
  },

  animate(el, options, ctx, duration) {
    if (!ctx.gsap || !el) {
      return (p) => {};
    }

    const {
      rotationDegrees = 360,
      animationDuration = 1.5,
      staggerDelay = 0.1,
      perspective = 800,
      axisX = false,
      axisY = true,
      axisZ = false
    } = options;

    const tl = ctx.gsap.timeline();
    const chars = el.querySelectorAll('.rotation-char');

    if (chars.length === 0) return (p) => {};

    // 3D 컨테이너에 perspective 적용
    const container = el.querySelector('.rotation-container');
    if (container) {
      container.style.perspective = `${perspective}px`;
    }

    chars.forEach((char, index) => {
      // 초기 상태
      tl.set(char, {
        rotationX: axisX ? -rotationDegrees/4 : 0,
        rotationY: axisY ? -rotationDegrees/4 : 0,
        rotationZ: axisZ ? -rotationDegrees/4 : 0,
        opacity: 0,
        scale: 0.5
      }, 0);

      // 회전 등장 애니메이션
      tl.to(char, {
        rotationX: axisX ? rotationDegrees : 0,
        rotationY: axisY ? rotationDegrees : 0,
        rotationZ: axisZ ? rotationDegrees : 0,
        opacity: 1,
        scale: 1.1,
        duration: animationDuration * 0.7,
        ease: 'power2.out'
      }, index * staggerDelay)

      // 최종 위치로 정착
      .to(char, {
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scale: 1,
        duration: animationDuration * 0.3,
        ease: 'back.out(1.7)'
      }, index * staggerDelay + animationDuration * 0.7);

      // 미묘한 떨림 효과
      tl.to(char, {
        rotationY: axisY ? ctx.gsap.utils.random(-5, 5) : 0,
        rotationX: axisX ? ctx.gsap.utils.random(-3, 3) : 0,
        duration: 0.1,
        ease: 'none',
        repeat: 2,
        yoyo: true
      }, index * staggerDelay + animationDuration * 0.8);
    });

    return tl;
  },

  cleanup(el) {
    if (el && window.gsap) {
      window.gsap.killTweensOf(el.querySelectorAll('.rotation-char'));
      const originalText = Array.from(el.querySelectorAll('.rotation-char'))
        .map(char => char.textContent)
        .join('');
      el.innerHTML = originalText;
    }
  }
};

function setupRotation3D(element, options) {
  if (!element) return;
  
  const container = document.createElement('div');
  container.className = 'rotation-container';
  container.style.transformStyle = 'preserve-3d';
  container.style.perspective = `${options?.perspective || 800}px`;
  
  element.appendChild(container);
}

function splitTextIntoCharacters(element) {
  const container = element.querySelector('.rotation-container') || element;
  const text = element.textContent || '';
  container.innerHTML = '';
  element.className = 'rotation-text';

  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    const charSpan = document.createElement('span');
    charSpan.className = 'rotation-char';
    charSpan.textContent = char === ' ' ? '\u00A0' : char;
    charSpan.style.display = 'inline-block';
    charSpan.style.transformStyle = 'preserve-3d';
    container.appendChild(charSpan);
  }
}