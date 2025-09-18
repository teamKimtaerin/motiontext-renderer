// CWI Color Plugin - Color transition animation
// Changes text color from white to speaker color during the specified time window

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

function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

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

function hexToRgb(hex) {
  const m = String(hex || '').trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return { r: 255, g: 255, b: 255 };
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function mixRgb(a, b, t) {
  const cl = (x) => Math.max(0, Math.min(255, Math.round(x)));
  return {
    r: cl(a.r + (b.r - a.r) * t),
    g: cl(a.g + (b.g - a.g) * t),
    b: cl(a.b + (b.b - a.b) * t),
  };
}

function rgbToCss({ r, g, b }) {
  return `rgb(${r}, ${g}, ${b})`;
}

const WHITE_RGB = { r: 255, g: 255, b: 255 };

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
      // Use CSS variables for per-letter transforms to allow composition
      // with other plugins (e.g., bouncing). Avoid hard-coded transform.
      transform: 'translateX(var(--letter-tx, 0px)) translateY(var(--letter-ty, 0px)) translateZ(0)',
    });
    letters.push(letter);
    span.appendChild(letter);
  }

  if (!letters.length) {
    const placeholder = h('span', { class: 'cwi-letter' }, '\u00A0');
    Object.assign(placeholder.style, {
      display: 'inline-block',
      color: WHITE90,
      transform: 'translateX(var(--letter-tx, 0px)) translateY(var(--letter-ty, 0px)) translateZ(0)'
    });
    letters.push(placeholder);
    span.appendChild(placeholder);
  }

  span.dataset.cwiLetterized = 'true';
  return letters;
}

export const name = 'cwi-color';
export const version = '2.0.0';

export function init(el, opts, ctx) {
    const root = el; // effectsRoot provided by renderer
    if (!root) return;
    
    // Wrap text content in a span inside effectsRoot
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
    // Ensure existing letters (if pre-letterized by another plugin) use var-based transform
    for (const letter of letters) {
      const tr = (letter.style && letter.style.transform) || '';
      if (!tr || /translate3d\(0px?,\s*0px?,/i.test(tr) || /translate3d\(0,\s*0,/.test(tr)) {
        letter.style.transform = 'translateX(var(--letter-tx, 0px)) translateY(var(--letter-ty, 0px)) translateZ(0)';
      }
    }
    for (const letter of letters) {
      letter.style.color = WHITE90;
    }

    el.__cwiColor = {
      root,
      span,
      letters,
      palette: opts?.palette || {},
      speaker: opts?.speaker
    };
}

export function animate(el, opts, ctx, duration) {
    const state = el.__cwiColor;
    if (!state) return () => {};
    
    const span = state.span;
    const letters = state.letters || [];
    const useBulk = Boolean(opts?.bulk);

    // Initial baseline
    span.style.color = WHITE90;
    span.style.opacity = '1';

    // Seek-applier driven by renderer progress p (0..1)
    // The renderer handles time_offset calculations and gives us clean relative progress
    return (progress) => {
      // progress is already 0-1 from the renderer's time_offset calculations
      // No need for absolute time calculations - just interpolate colors based on progress
      
      const targetColor = colorFor(state, opts, el);
      const to = hexToRgb(targetColor);
      const clamped = Math.max(0, Math.min(1, progress || 0));
      const total = letters.length || 1;
      // Slight epsilon so boundaries don't stick exactly at 0
      const scaled = clamped * total + 1e-4;

      if (useBulk) {
        if (clamped >= 0.985) {
          span.style.color = targetColor;
          for (const letter of letters) letter.style.color = targetColor;
          span.style.opacity = '1';
          return;
        }
        const mix = mixRgb(WHITE_RGB, to, easeOutCubic(clamped));
        const css = rgbToCss(mix);
        span.style.color = css;
        for (const letter of letters) letter.style.color = css;
        span.style.opacity = '1';
        return;
      }

      if (!letters.length) {
        span.style.color = clamped >= 1 ? targetColor : WHITE90;
        return;
      }

      // Near the end, ensure all letters are fully colored even if progress < 1
      // This prevents the last few letters from staying white when the renderer
      // doesn't deliver an exact 1.0 progress frame.
      if (clamped >= 0.985) {
        for (const letter of letters) letter.style.color = targetColor;
        span.style.opacity = '1';
        return;
      }

      letters.forEach((letter, idx) => {
        const local = Math.max(0, Math.min(1, scaled - idx));
        if (local <= 0) {
          letter.style.color = WHITE90;
        } else if (local >= 1) {
          letter.style.color = targetColor;
        } else {
          const c = mixRgb(WHITE_RGB, to, easeOutCubic(local));
          letter.style.color = rgbToCss(c);
        }
      });
      span.style.opacity = '1';
    };
}

export function cleanup(el) {
  if (el && el.__cwiColor) {
    el.__cwiColor = undefined;
  }
}
