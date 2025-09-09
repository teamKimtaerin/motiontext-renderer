/**
 * Fade In Stagger Text Effect Plugin
 * 글자들이 하나씩 순차적으로 서서히 나타나는 클래식한 페이드인 애니메이션 효과
 * MotionText Renderer Plugin API v2.1
 */

export default {
  name: "fadein",
  version: "1.0.0",
  
  init(el, options, ctx) {
    // effectsRoot(el)에 초기 설정 적용
    if (!ctx.gsap) {
      console.error('GSAP is required for Fade In Stagger effect');
      return;
    }

    // 텍스트를 글자별로 분리
    splitTextIntoCharacters(el, ctx.gsap);
  },

  animate(el, options, ctx, duration) {
    if (!ctx.gsap || !el) {
      return (p) => {}; // 빈 함수 반환
    }

    const {
      staggerDelay = 0.1,
      animationDuration = 0.8,
      startOpacity = 0,
      scaleStart = 0.9,
      ease = 'power2.out'
    } = options;

    // GSAP 타임라인 생성
    const tl = ctx.gsap.timeline();
    const chars = el.querySelectorAll('.fade-char');

    if (chars.length === 0) return (p) => {};

    chars.forEach((char, index) => {
      // 초기 상태 설정
      tl.set(char, {
        opacity: startOpacity,
        scale: scaleStart,
        transformOrigin: 'center center',
        color: '#999999'
      }, 0);

      // 페이드 인 애니메이션
      tl.to(char, {
        opacity: 1,
        scale: 1,
        color: '#ffffff',
        duration: animationDuration,
        ease: ease,
        filter: 'brightness(1.3)',
        textShadow: '0 0 5px rgba(255,255,255,0.3)'
      }, index * staggerDelay);

      // 미묘한 펄스 효과
      tl.to(char, {
        scale: 1.03,
        duration: animationDuration * 0.2,
        ease: 'power2.out',
        yoyo: true,
        repeat: 1
      }, index * staggerDelay + animationDuration * 0.6);

      // 글로우 효과 제거
      tl.to(char, {
        filter: 'brightness(1)',
        textShadow: '0 0 0px rgba(255,255,255,0)',
        duration: 0.4,
        ease: 'power1.out'
      }, index * staggerDelay + animationDuration);
    });

    // 상대 타임라인 반환 (호스트가 진행 제어)
    return tl;
  },

  cleanup(el) {
    if (el && window.gsap) {
      window.gsap.killTweensOf(el.querySelectorAll('.fade-char'));
      // DOM 구조 복원
      const originalText = Array.from(el.querySelectorAll('.fade-char'))
        .map(char => char.textContent)
        .join('');
      el.innerHTML = originalText;
    }
  }
};

/**
 * 텍스트를 글자별로 분리하여 DOM 구조 생성
 */
function splitTextIntoCharacters(element, gsap) {
  if (!element) return;

  // Prefer text inside effectsRoot; if empty, collect from host text nodes
  let text = element.textContent || '';
  if (!text.trim() && element.parentElement) {
    let collected = '';
    const host = element.parentElement;
    const toRemove = [];
    for (const node of Array.from(host.childNodes)) {
      if (node.nodeType === 3) { collected += node.textContent || ''; toRemove.push(node); }
    }
    toRemove.forEach(n => host.removeChild(n));
    text = collected;
  }
  element.innerHTML = '';
  element.className = 'fade-in-stagger-text';

  if (!text.trim()) {
    element.textContent = '안녕하세요!';
    return;
  }

  // 각 글자를 개별 span으로 분리
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    const charSpan = document.createElement('span');
    charSpan.className = 'fade-char';
    charSpan.textContent = char === ' ' ? '\u00A0' : char; // 공백 처리
    charSpan.style.display = 'inline-block';
    charSpan.style.position = 'relative';
    element.appendChild(charSpan);
  }
}
