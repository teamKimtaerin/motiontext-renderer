/**
 * Scale Pop Text Effect Plugin
 * 텍스트가 순차적으로 크게 튀어올랐다가 원래 크기로 돌아오는 애니메이션 효과
 * MotionText Renderer Plugin API v2.1
 */

export const name = "scalepop";
export const version = "1.0.0";

export function init(el, options, ctx) {
    if (!ctx.gsap) {
      console.error('GSAP is required for Scale Pop effect');
      return;
    }
    splitTextIntoCharacters(el);
}

export function animate(el, options, ctx, duration) {
    if (!ctx.gsap || !el) {
      return (p) => {};
    }

    const {
      popScale = 1.5,
      animationDuration = 1.2,
      staggerDelay = 0.08,
      bounceStrength = 0.6,
      colorPop = true
    } = options;

    const tl = ctx.gsap.timeline();
    const chars = el.querySelectorAll('.scalepop-char');

    if (chars.length === 0) return (p) => {};

    chars.forEach((char, index) => {
      // 초기 상태
      tl.set(char, {
        scale: 0,
        opacity: 0,
        transformOrigin: 'center center'
      }, 0);

      // 등장 애니메이션
      tl.to(char, {
        scale: popScale,
        opacity: 1,
        duration: animationDuration * 0.4,
        ease: 'back.out(2)'
      }, index * staggerDelay);

      // 색상 팝 효과
      if (colorPop) {
        tl.to(char, {
          color: '#ffff99',
          textShadow: '0 0 10px rgba(255,255,153,0.8)',
          duration: animationDuration * 0.2,
          ease: 'power2.out'
        }, index * staggerDelay + animationDuration * 0.1)
        .to(char, {
          color: '#ffffff',
          textShadow: '0 0 0px rgba(255,255,153,0)',
          duration: animationDuration * 0.4,
          ease: 'power2.out'
        }, index * staggerDelay + animationDuration * 0.3);
      }

      // 원래 크기로 축소 (바운스 효과)
      tl.to(char, {
        scale: 1,
        duration: animationDuration * 0.6,
        ease: `elastic.out(${bounceStrength}, 0.3)`
      }, index * staggerDelay + animationDuration * 0.4);

      // 미묘한 2차 팝 효과
      tl.to(char, {
        scale: 1.1,
        duration: 0.1,
        ease: 'power2.out',
        yoyo: true,
        repeat: 1
      }, index * staggerDelay + animationDuration * 0.8);
    });

    return tl;
}

export function cleanup(el) {
    if (el && window.gsap) {
      window.gsap.killTweensOf(el.querySelectorAll('.scalepop-char'));
      const originalText = Array.from(el.querySelectorAll('.scalepop-char'))
        .map(char => char.textContent)
        .join('');
      el.innerHTML = originalText;
    }
}

function splitTextIntoCharacters(element) {
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
  element.className = 'scalepop-text';

  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    const charSpan = document.createElement('span');
    charSpan.className = 'scalepop-char';
    charSpan.textContent = char === ' ' ? '\u00A0' : char;
    charSpan.style.display = 'inline-block';
    element.appendChild(charSpan);
  }
}
