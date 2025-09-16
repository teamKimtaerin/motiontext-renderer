// CWI Bouncing Plugin - Pop/bouncing wave animation
// Scales text with pop effect and vertical wave motion

const WHITE90 = 'rgba(255,255,255,0.9)';

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'style' && v && typeof v === 'object') Object.assign(el.style, v);
    else if (v != null) el.setAttribute(k, String(v));
  }
  for (const c of children) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return el;
}

function colorFor(state, opts, el) {
  if (opts?.color) return opts.color;
  
  // Try palette from params first
  let pal = state.palette || opts?.palette;
  
  // If no palette, try to find from parent elements with data-palette
  if (!pal) {
    let current = el?.parentElement;
    while (current && !pal) {
      const paletteData = current.getAttribute('data-palette');
      if (paletteData) {
        try {
          pal = JSON.parse(paletteData);
        } catch (e) {
          // ignore parse errors
        }
      }
      current = current.parentElement;
    }
  }
  
  // If still no palette, try to find from window.motionTextDefinitions (fallback)
  if (!pal && typeof window !== 'undefined' && window.motionTextDefinitions?.speakerPalette) {
    pal = window.motionTextDefinitions.speakerPalette;
  }
  
  // Use speaker color if available
  if (state.speaker && pal && pal[state.speaker]) {
    return pal[state.speaker];
  }
  
  // Default fallback
  return '#FFD400';
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

function ensureLetterSpans(span) {
  if (!span) return [];
  const existing = span.querySelectorAll(':scope > .cwi-letter');
  if (existing.length) return Array.from(existing);

  const text = span.textContent ?? '';
  span.textContent = '';

  const letters = [];
  for (const ch of text) {
    const letter = h('span', { class: 'cwi-letter' });
    letter.textContent = ch === ' ' ? '\u00A0' : ch;
    Object.assign(letter.style, {
      display: 'inline-block',
      color: WHITE90,
      transform: 'translate3d(0, 0, 0)',
    });
    letters.push(letter);
    span.appendChild(letter);
  }

  if (!letters.length) {
    const placeholder = h('span', { class: 'cwi-letter' }, '\u00A0');
    Object.assign(placeholder.style, { display: 'inline-block', color: WHITE90 });
    letters.push(placeholder);
    span.appendChild(placeholder);
  }

  span.dataset.cwiLetterized = 'true';
  return letters;
}

export const name = 'cwi-bouncing';
export const version = '1.0.0';

export function init(el, opts, ctx) {
    const root = el; // effectsRoot
    if (!root) return;
    
    // Wrap text content in a span within effectsRoot
    let span = root.querySelector(':scope > .cwi-word');
    if (!span) {
      let text = '';
      for (const node of Array.from(root.childNodes)) {
        if (node.nodeType === 3 /* TEXT_NODE */) {
          text += node.textContent || '';
          root.removeChild(node);
        }
      }
      span = h('span', { class: 'cwi-word' });
      span.textContent = text;
      Object.assign(span.style, {
        display: 'inline-block',
        color: WHITE90,
        transformOrigin: '50% 50%'
      });
      root.appendChild(span);
    }
    
    const letters = ensureLetterSpans(span);
    for (const letter of letters) {
      letter.style.color = 'inherit';
      letter.style.transform = 'translate3d(0px, 0px, 0px)';
    }

    const waveHeight = Number(opts?.waveHeight ?? (opts?.popScale ? opts.popScale * 8 : 12));

    el.__cwiBouncing = {
      root,
      span,
      letters,
      palette: opts?.palette || {},
      t0: Number(opts?.t0 ?? 0),
      t1: Number(opts?.t1 ?? 0),
      waveHeight: Number.isFinite(waveHeight) ? waveHeight : 12,
      speaker: opts?.speaker
    };
}

export function animate(el, opts, ctx, duration) {
    const state = el.__cwiBouncing;
    if (!state) return () => {};
    
    const span = state.span;
    const letters = state.letters || [];

    // Initial baseline
    span.style.color = WHITE90;
    span.style.transform = 'translate3d(0px, 0px, 0px)';
    span.style.opacity = '1';

    // Seek-applier driven by host progress p (0..1)
    return (p) => {
      const local = Math.max(0, Math.min(1, p || 0));
      span.style.color = colorFor(state, opts, el);

      if (!letters.length) {
        span.style.opacity = '1';
        return;
      }

      const total = letters.length || 1;
      const waveHeight = Math.max(0, Number(state.waveHeight ?? 12));
      // Sequential onset with overlap: each letter runs for letterDuration of the timeline
      const letterDuration = Math.max(0.2, Math.min(0.9, Number(opts?.letterDuration ?? 0.6)));
      const perDelay = total > 1 ? (1 - letterDuration) / (total - 1) : 0;

      letters.forEach((letter, idx) => {
        const start = idx * perDelay;
        const t = (local - start) / letterDuration;
        if (t <= 0 || t >= 1) {
          letter.style.transform = 'translate3d(0px, 0px, 0px)';
          return;
        }
        const eased = easeInOutCubic(t);
        const wave = Math.sin(eased * Math.PI);
        const lift = -waveHeight * wave;
        const sway = Math.sin(eased * Math.PI * 2) * 0.6;
        letter.style.transform = `translate3d(${sway}px, ${lift}px, 0px)`;
      });

      span.style.opacity = '1';
    };
}

export function cleanup(el) {
  if (el && el.__cwiBouncing) {
    el.__cwiBouncing = undefined;
  }
}
