/**
 * Magnetic Text Effect Plugin
 * 텍스트가 자기장에 끌리는 것처럼 움직이는 애니메이션 효과
 * MotionText Renderer Plugin API v2.1
 */

export default {
  name: "magnetic",
  version: "1.0.0",
  
  init(el, options, ctx) {
    if (!ctx.gsap) {
      console.error('GSAP is required for Magnetic effect');
      return;
    }
    splitTextIntoCharacters(el);
  },

  animate(el, options, ctx, duration) {
    if (!ctx.gsap || !el) {
      return (p) => {};
    }

    const {
      magnetStrength = 15,
      animationDuration = 1.2,
      attractionDelay = 0.1,
      elasticity = 0.8
    } = options;

    const tl = ctx.gsap.timeline();
    const chars = el.querySelectorAll('.magnetic-char');

    if (chars.length === 0) return (p) => {};

    chars.forEach((char, index) => {
      // 초기 상태
      tl.set(char, {
        x: 0,
        y: 0,
        rotation: 0,
        opacity: 0
      }, 0);

      // 등장 효과
      tl.to(char, {
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out'
      }, index * 0.05);

      // 자기장 끌림 효과
      tl.to(char, {
        x: () => ctx.gsap.utils.random(-magnetStrength, magnetStrength),
        y: () => ctx.gsap.utils.random(-magnetStrength/2, magnetStrength/2),
        rotation: () => ctx.gsap.utils.random(-15, 15),
        duration: animationDuration * 0.4,
        ease: `power2.out`
      }, index * attractionDelay)
      
      // 탄성 복귀 효과
      .to(char, {
        x: 0,
        y: 0,
        rotation: 0,
        duration: animationDuration * 0.6,
        ease: `elastic.out(${elasticity}, 0.3)`
      }, index * attractionDelay + animationDuration * 0.4);

      // 미묘한 자기장 진동 효과
      tl.to(char, {
        x: () => ctx.gsap.utils.random(-2, 2),
        y: () => ctx.gsap.utils.random(-1, 1),
        duration: 0.1,
        ease: 'none',
        repeat: 3,
        yoyo: true
      }, index * attractionDelay + animationDuration * 0.7);
    });

    return tl;
  },

  cleanup(el) {
    if (el && window.gsap) {
      window.gsap.killTweensOf(el.querySelectorAll('.magnetic-char'));
      const originalText = Array.from(el.querySelectorAll('.magnetic-char'))
        .map(char => char.textContent)
        .join('');
      el.innerHTML = originalText;
    }
  }
};

function splitTextIntoCharacters(element) {
  if (!element) return;
  const text = element.textContent || '';
  element.innerHTML = '';
  element.className = 'magnetic-text';

  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    const charSpan = document.createElement('span');
    charSpan.className = 'magnetic-char';
    charSpan.textContent = char === ' ' ? '\u00A0' : char;
    charSpan.style.display = 'inline-block';
    element.appendChild(charSpan);
  }
}