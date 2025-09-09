/**
 * Typewriter Text Effect Plugin
 * 타자기처럼 글자가 하나씩 타이핑되는 애니메이션 효과
 * MotionText Renderer Plugin API v2.1
 */

export default {
  name: "typewriter",
  version: "1.0.0",
  
  init(el, options, ctx) {
    console.log('[Typewriter Plugin] ✅ INIT CALLED', { 
      el, 
      options, 
      ctx,
      hasGsap: !!ctx?.gsap,
      gsapTimeline: typeof ctx?.gsap?.timeline
    });
    if (!ctx.gsap) {
      console.error('[Typewriter Plugin] ❌ GSAP is required for Typewriter effect');
      return;
    }
    console.log('[Typewriter Plugin] Setting up typewriter structure...');
    setupTypewriterStructure(el, options);
    console.log('[Typewriter Plugin] Structure setup complete');
  },

  animate(el, options, ctx, duration) {
    console.log('[Typewriter Plugin] 🎬 ANIMATE CALLED', { 
      el, 
      options, 
      ctx, 
      duration,
      hasGsap: !!ctx?.gsap,
      hasElement: !!el
    });
    const {
      typingSpeed = 0.05,
      cursorBlink = true,
      showCursor = true,
      soundEffect = false
    } = options;

    const container = el.querySelector('.typewriter-container');
    const textSpan = container?.querySelector('.typewriter-text');
    const cursor = container?.querySelector('.typewriter-cursor');
    if (!container || !textSpan) return (p) => {};

    const fullText = textSpan.dataset.fullText || '';
    // 초기 상태
    textSpan.textContent = '';
    if (cursor && showCursor) cursor.style.opacity = '1';

    // SeekApplier: 진행도에 따라 텍스트 길이 결정
    return (p) => {
      const D = Math.max(0.0001, Number(duration) || 0.0001);
      const t = Math.max(0, Math.min(D, p * D));
      const i = Math.max(0, Math.min(fullText.length, Math.floor(t / typingSpeed)));
      const prev = textSpan.textContent || '';
      const next = fullText.substring(0, i);
      if (prev !== next) {
        textSpan.textContent = next;
        // 사운드 효과 자리 (필요시 구현)
        // if (soundEffect && i > 0 && fullText.charAt(i-1) !== ' ') {}
        // 작은 강조 효과
        if (ctx.gsap && next && next.length) {
          try {
            ctx.gsap.to(textSpan, { textShadow: '0 0 5px rgba(255,255,255,0.5)', duration: 0.08, yoyo: true, repeat: 1, ease: 'power2.out' });
          } catch {}
        }
      }
      if (cursor && showCursor) {
        const blink = cursorBlink ? (Math.floor((t * 2) % 2) === 0 ? 1 : 0) : 1; // 2Hz blink
        cursor.style.opacity = String(blink);
      }
    };
  },

  cleanup(el) {
    if (el && window.gsap) {
      window.gsap.killTweensOf(el.querySelectorAll('*'));
      const container = el.querySelector('.typewriter-container');
      const textSpan = container?.querySelector('.typewriter-text');
      if (textSpan && textSpan.dataset.fullText) {
        el.innerHTML = textSpan.dataset.fullText;
      }
    }
  }
};

function setupTypewriterStructure(element, options) {
  if (!element) return;

  // Prefer existing text inside effects root; if empty, fallback to host text
  let text = element.textContent || '';
  const host = element.parentElement;
  if ((!text || !text.trim()) && host) {
    // Gather only text nodes from host, but preserve existing element children (like effectsRoot)
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
  const { showCursor = true, cursorChar = '|' } = options;
  
  element.innerHTML = '';
  element.className = 'typewriter-effect';

  const container = document.createElement('span');
  container.className = 'typewriter-container';
  container.style.display = 'inline-block';

  const textSpan = document.createElement('span');
  textSpan.className = 'typewriter-text';
  textSpan.dataset.fullText = text || '타이핑 효과 테스트';
  textSpan.textContent = '';

  container.appendChild(textSpan);

  if (showCursor) {
    const cursor = document.createElement('span');
    cursor.className = 'typewriter-cursor';
    cursor.textContent = cursorChar;
    cursor.style.color = '#ffffff';
    cursor.style.fontWeight = 'normal';
    container.appendChild(cursor);
  }

  element.appendChild(container);
}
