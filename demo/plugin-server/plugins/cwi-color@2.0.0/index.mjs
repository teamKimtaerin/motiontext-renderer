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

export const name = 'cwi-color';
export const version = '1.0.0';

export function init(el, opts, ctx) {
    const host = el.parentElement;
    if (!host) return;
    
    // Wrap text content in a span so we can transform without touching host/base transform
    let span = host.querySelector(':scope > .cwi-word');
    if (!span) {
      // Preserve effectsRoot if present
      const effectsRoot = host.querySelector(':scope > [data-mtx-effects-root]');
      // Gather existing text nodes into a single string
      let text = '';
      for (const node of Array.from(host.childNodes)) {
        if (node.nodeType === 3 /* TEXT_NODE */) {
          text += node.textContent || '';
          host.removeChild(node);
        }
      }
      span = h('span', { class: 'cwi-word' });
      span.textContent = text;
      Object.assign(span.style, {
        display: 'inline-block',
        color: WHITE90,
        transformOrigin: '50% 50%'
      });
      if (effectsRoot) host.insertBefore(span, effectsRoot);
      else host.appendChild(span);
    }
    
    el.__cwiColor = {
      host,
      span,
      palette: opts?.palette || {},
      speaker: opts?.speaker
    };
}

export function animate(el, opts, ctx, duration) {
    const state = el.__cwiColor;
    if (!state) return () => {};
    
    const span = state.span;

    // Initial baseline
    span.style.color = WHITE90;
    span.style.opacity = '1';

    // Seek-applier driven by renderer progress p (0..1)
    // The renderer handles time_offset calculations and gives us clean relative progress
    return (progress) => {
      // progress is already 0-1 from the renderer's time_offset calculations
      // No need for absolute time calculations - just interpolate colors based on progress
      
      if (progress <= 0) {
        // Before animation starts: white
        span.style.color = WHITE90;
      } else if (progress >= 1) {
        // After animation ends: target color
        span.style.color = colorFor(state, opts, el);
      } else {
        // During animation: interpolate from white to target color
        const from = hexToRgb('#ffffff');
        const to = hexToRgb(colorFor(state, opts, el));
        const c = mixRgb(from, to, easeOutCubic(progress));
        span.style.color = rgbToCss(c);
      }
      span.style.opacity = '1';
    };
}

export function cleanup(el) {
  if (el && el.__cwiColor) {
    el.__cwiColor = undefined;
  }
}