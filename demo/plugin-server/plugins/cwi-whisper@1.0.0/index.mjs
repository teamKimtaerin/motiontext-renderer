// CWI Whisper Plugin - Small scale animation
// Scales text down to 0.6x base size

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

export default {
  name: 'cwi-whisper',
  version: '1.0.0',
  init(el, opts, ctx) {
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
    
    el.__cwiWhisper = {
      host,
      span,
      palette: opts?.palette || {},
      t0: Number(opts?.t0 ?? 0),
      t1: Number(opts?.t1 ?? 0),
      speaker: opts?.speaker
    };
  },
  animate(el, opts, ctx, duration) {
    const state = el.__cwiWhisper;
    if (!state) return () => {};
    
    const span = state.span;
    const D = Math.max(0.0001, Number(duration) || 0.0001);
    const t0 = Math.max(0, Number(state.t0 || 0));
    const t1 = Math.max(t0, Number(state.t1 || 0));

    // Initial baseline
    span.style.color = WHITE90;
    span.style.transform = 'translate(0px, 0px) scale(1, 1)';
    span.style.opacity = '1';

    // Seek-applier driven by host progress p (0..1)
    return (p) => {
      const now = p * D;
      const active = now >= t0 && now < t1;
      
      if (!active) {
        // Outside window, reset geometry
        span.style.transform = 'translate(0px, 0px) scale(1, 1)';
        span.style.opacity = '1';
        return;
      }

      // Active window transforms
      span.style.color = colorFor(state, opts, el);
      
      const s = 0.6; // 3%/5% = 0.6
      span.style.transform = `scale(${s}, ${s})`;
      span.style.opacity = '1';
    };
  },
  cleanup(el) {
    if (el && el.__cwiWhisper) {
      el.__cwiWhisper = undefined;
    }
  }
};