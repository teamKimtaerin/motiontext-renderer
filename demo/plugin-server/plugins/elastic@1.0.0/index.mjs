/**
 * Elastic Bounce Text Effect Plugin
 * 텍스트가 탄성있게 튀면서 나타나는 애니메이션 효과
 * MotionText Renderer Plugin API v2.1
 */

export default {
  name: "elastic",
  version: "1.0.0",
  
  init(el, options, ctx) {
    // effectsRoot(el)에 초기 설정 적용
    if (!ctx.gsap) {
      console.error('GSAP is required for Elastic Bounce effect');
      return;
    }

    // 텍스트를 단어별로 분리
    splitTextIntoWords(el);
  },

  animate(el, options, ctx, duration) {
    if (!ctx.gsap || !el) {
      return (p) => {}; // 빈 함수 반환
    }

    const {
      bounceStrength = 0.7,
      animationDuration = 1.5,
      staggerDelay = 0.1,
      startScale = 0,
      overshoot = 1.3
    } = options;

    // GSAP 타임라인 생성
    const tl = ctx.gsap.timeline();
    const words = el.querySelectorAll('.bounce-word');

    if (words.length === 0) return (p) => {};

    words.forEach((word, index) => {
      // 초기 상태 설정
      tl.set(word, {
        scale: startScale,
        transformOrigin: 'center bottom',
        opacity: 0
      }, 0);

      // 탄성 바운스 애니메이션
      tl.to(word, {
        scale: overshoot,
        opacity: 1,
        duration: animationDuration * 0.4,
        ease: `elastic.out(${bounceStrength}, 0.3)`,
        rotation: ctx.gsap.utils.random(-3, 3) // 미묘한 회전 효과
      }, index * staggerDelay)
      .to(word, {
        scale: 1,
        rotation: 0,
        duration: animationDuration * 0.3,
        ease: `elastic.out(${bounceStrength}, 0.2)`
      }, index * staggerDelay + animationDuration * 0.4);

      // 색상 변화 효과
      tl.fromTo(word, {
        color: '#666666'
      }, {
        color: '#ffffff',
        duration: animationDuration * 0.6,
        ease: 'power2.out'
      }, index * staggerDelay + animationDuration * 0.2);

      // 미묘한 그림자 효과
      tl.to(word, {
        textShadow: '0 2px 8px rgba(255,255,255,0.2)',
        duration: animationDuration * 0.3,
        ease: 'power1.out'
      }, index * staggerDelay + animationDuration * 0.5)
      .to(word, {
        textShadow: '0 0 0px rgba(255,255,255,0)',
        duration: 0.5,
        ease: 'power1.out'
      }, index * staggerDelay + animationDuration * 0.8);
    });

    // 상대 타임라인 반환 (호스트가 진행 제어)
    return tl;
  },

  cleanup(el) {
    if (el && window.gsap) {
      window.gsap.killTweensOf(el.querySelectorAll('.bounce-word'));
      // DOM 구조 복원
      const originalText = Array.from(el.querySelectorAll('.bounce-word'))
        .map(word => word.textContent)
        .join(' ');
      el.innerHTML = originalText;
    }
  }
};

/**
 * 텍스트를 단어별로 분리하여 DOM 구조 생성
 */
function splitTextIntoWords(element) {
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
  element.className = 'elastic-bounce-text';

  if (!text.trim()) {
    element.textContent = '안녕하세요!';
    return;
  }

  const words = text.split(' ');
  words.forEach((word, wordIndex) => {
    const wordSpan = document.createElement('span');
    wordSpan.className = 'bounce-word';
    wordSpan.style.display = 'inline-block';
    wordSpan.style.margin = '0 0.1em';
    wordSpan.textContent = word;
    element.appendChild(wordSpan);
    
    // 단어 사이에 공백 추가 (마지막 단어 제외)
    if (wordIndex < words.length - 1) {
      element.appendChild(document.createTextNode(' '));
    }
  });
}
