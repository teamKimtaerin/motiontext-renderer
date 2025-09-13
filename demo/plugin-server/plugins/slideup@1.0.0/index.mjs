/**
 * Slide Up Text Effect Plugin
 * 텍스트가 아래에서 위로 슬라이드하면서 나타나는 애니메이션 효과
 * MotionText Renderer Plugin API v2.1
 */

export const name = "slideup";
export const version = "1.0.0";

export function init(el, options, ctx) {
    if (!ctx.gsap) {
      console.error('GSAP is required for Slide Up effect');
      return;
    }
    splitTextIntoWords(el);
}

export function animate(el, options, ctx, duration) {
    if (!ctx.gsap || !el) {
      return (p) => {};
    }

    const {
      slideDistance = 30,
      animationDuration = 1,
      staggerDelay = 0.12,
      easeType = 'power2.out',
      blurEffect = true
    } = options;

    const tl = ctx.gsap.timeline();
    const words = el.querySelectorAll('.slideup-word');

    if (words.length === 0) return (p) => {};

    words.forEach((word, index) => {
      // 초기 상태
      tl.set(word, {
        y: slideDistance,
        opacity: 0,
        filter: blurEffect ? 'blur(3px)' : 'none'
      }, 0);

      // 슬라이드 업 애니메이션
      tl.to(word, {
        y: 0,
        opacity: 1,
        filter: 'blur(0px)',
        duration: animationDuration,
        ease: easeType
      }, index * staggerDelay);

      // 미묘한 오버슈트 효과 (back.out 이징이 아닐 때)
      if (easeType !== 'back.out') {
        tl.to(word, {
          y: -2,
          duration: animationDuration * 0.2,
          ease: 'power1.out'
        }, index * staggerDelay + animationDuration * 0.8)
        .to(word, {
          y: 0,
          duration: animationDuration * 0.2,
          ease: 'power1.inOut'
        }, index * staggerDelay + animationDuration);
      }

      // 색상 페이드 인 효과
      tl.fromTo(word, {
        color: '#888888'
      }, {
        color: '#ffffff',
        duration: animationDuration * 0.6,
        ease: 'power1.out'
      }, index * staggerDelay + animationDuration * 0.2);
    });

    return tl;
}

export function cleanup(el) {
    if (el && window.gsap) {
      window.gsap.killTweensOf(el.querySelectorAll('.slideup-word'));
      const originalText = Array.from(el.querySelectorAll('.slideup-word'))
        .map(word => word.textContent)
        .join(' ');
      el.innerHTML = originalText;
    }
}

function splitTextIntoWords(element) {
  if (!element) return;
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
  element.className = 'slideup-text';

  const words = text.split(' ');
  words.forEach((word, wordIndex) => {
    const wordSpan = document.createElement('span');
    wordSpan.className = 'slideup-word';
    wordSpan.style.display = 'inline-block';
    wordSpan.style.overflow = 'hidden';
    wordSpan.textContent = word;
    element.appendChild(wordSpan);
    
    // 단어 사이에 공백 추가 (마지막 단어 제외)
    if (wordIndex < words.length - 1) {
      element.appendChild(document.createTextNode(' '));
    }
  });
}
