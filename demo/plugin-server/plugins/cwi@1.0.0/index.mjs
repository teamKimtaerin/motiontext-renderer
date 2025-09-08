// Caption with Intention (CwI) dev plugin
// - Renders a caption line inside a box and animates per-word timing
// - Effects: pop/wave, loud (scale + tremble; breakout via portal clone), whisper (scale down)

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

function getOrCreatePortal(root) {
  let p = root.querySelector(':scope > .cwi-portal');
  if (!p) {
    p = h('div', { class: 'cwi-portal' });
    Object.assign(p.style, {
      position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
      pointerEvents: 'none', overflow: 'visible', zIndex: '1000'
    });
    root.appendChild(p);
  }
  return p;
}

function px(n) { return `${Math.round(n)}px`; }

export default {
  name: 'cwi',
  version: '1.0.0',
  init(el, opts, ctx) {
    // Build caption box wrapper
    const box = h('div', { class: 'cwi-box' });
    Object.assign(box.style, {
      position: 'relative',
      display: 'inline-block',
      background: 'rgba(0,0,0,0.9)',
      color: WHITE90,
      padding: '0.25em 1.5em',
      borderRadius: '0px',
      overflow: 'clip',
      transformOrigin: '50% 50%'
    });
    const line = h('div', { class: 'cwi-line' });
    Object.assign(line.style, {
      // allow wrapping within stage-bounded width (set via maxWidth in px)
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
      fontFamily: `'Roboto Flex', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif`,
      fontWeight: '400'
    });
    box.appendChild(line);
    el.appendChild(box);

    // Store stage element for dynamic sizing
    function findStageElement(element) {
      let current = element;
      while (current && current !== document.body) {
        if (current.classList && current.classList.contains('stage')) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    }

    const stageEl = findStageElement(el);

    const tokens = Array.isArray(opts?.tokens) ? opts.tokens : [];
    // Create spans according to tokens (word order)
    const spans = tokens.map((t, i) => {
      const sp = h('span', { 'data-i': String(i) }, t.ch || t.word || '');
      Object.assign(sp.style, { display: 'inline-block', marginRight: '.33em', color: WHITE90 });
      line.appendChild(sp);
      return sp;
    });

    // Dynamic font size calculation based on Design System
    function updateFontSize() {
      if (!stageEl) return;
      const stageHeight = stageEl.getBoundingClientRect().height;
      const baseFontSize = stageHeight * 0.05; // 5% of stage height
      line.style.fontSize = `${baseFontSize}px`;
      
      // Update padding proportionally
      const paddingEm = 0.25;
      const paddingHorEm = 1.5;
      box.style.padding = `${baseFontSize * paddingEm}px ${baseFontSize * paddingHorEm}px`;
      // Clamp max line width to ~95% of stage width to avoid edge clipping
      const stageWidth = stageEl.getBoundingClientRect().width;
      const maxFrac = 0.95;
      box.style.maxWidth = `${Math.max(1, Math.floor(stageWidth * maxFrac))}px`;
    }

    // Initial font size setup
    updateFontSize();

    // Create ResizeObserver for dynamic updates
    const resizeObserver = new ResizeObserver(() => {
      updateFontSize();
    });
    
    if (stageEl) {
      resizeObserver.observe(stageEl);
    }

    el.__cwi = {
      box, line, spans,
      tokens,
      palette: opts?.palette || {},
      popScale: Number(opts?.popScale ?? 1.15),
      tremble: Object.assign({ ampPx: 1.5, freq: 12 }, opts?.tremble || {}),
      portal: getOrCreatePortal(el),
      clones: new Map(), // idx -> HTMLElement
      stageEl,
      resizeObserver,
      updateFontSize,
    };
  },
  animate(el, opts, ctx, duration) {
    const state = el.__cwi;
    if (!state) return () => {};
    const tokens = state.tokens || [];
    const spans = state.spans || [];
    const palette = state.palette || {};
    const popScale = state.popScale || 1.15;
    const tremble = state.tremble || { ampPx: 1.5, freq: 12 };
    const portal = state.portal;
    const stageEl = state.stageEl;

    // Get current stage height for dynamic scaling
    function getBaseFontSize() {
      if (!stageEl) return 24; // fallback
      const stageHeight = stageEl.getBoundingClientRect().height;
      return stageHeight * 0.05; // 5% base font size
    }

    function colorFor(tok) {
      if (tok?.color) return tok.color;
      if (tok?.speaker && palette[tok.speaker]) return palette[tok.speaker];
      return '#FFD400'; // default yellowish for demo
    }

    function ensureClone(i, span) {
      let c = state.clones.get(i);
      if (c) return c;
      c = h('span');
      c.textContent = span.textContent || '';
      // Copy a subset of styles for visual fidelity
      const cs = getComputedStyle(span);
      Object.assign(c.style, {
        position: 'absolute',
        whiteSpace: 'nowrap',
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        letterSpacing: cs.letterSpacing,
        lineHeight: cs.lineHeight,
        color: cs.color,
        transformOrigin: '50% 50%',
        pointerEvents: 'none',
        zIndex: '1001',
      });
      portal.appendChild(c);
      state.clones.set(i, c);
      return c;
    }

    function removeClone(i) {
      const c = state.clones.get(i);
      if (!c) return;
      if (c.parentElement) c.parentElement.removeChild(c);
      state.clones.delete(i);
    }

    return (p) => {
      const tNow = Math.max(0, Math.min(1, p)) * Math.max(0, duration);
      const rootRect = el.getBoundingClientRect();
      for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i] || {};
        const sp = spans[i];
        if (!sp) continue;
        const t0 = Number(tok.t0 ?? tok.start ?? 0);
        const t1 = Number(tok.t1 ?? tok.end ?? 0);
        const active = tNow >= t0 && tNow < t1 && t1 > t0;
        // base style
        sp.style.color = active ? colorFor(tok) : WHITE90;
        sp.style.transform = 'translate(0,0) scale(1,1)';
        sp.style.opacity = '1';

        if (active) {
          const q = (tNow - t0) / (t1 - t0);
          const kind = String(tok.kind || tok.animation_type || 'pop');
          if (kind === 'loud') {
            // Breakout via portal clone
            const clone = ensureClone(i, sp);
            // Position clone at span's screen coords
            const r = sp.getBoundingClientRect();
            clone.style.left = px(r.left - rootRect.left);
            clone.style.top = px(r.top - rootRect.top);
            clone.style.color = colorFor(tok);
            // Loud: scale up to 240% (12% of stage height / 5% base = 2.4) with tremble
            const baseScale = 2.4;
            const scale = baseScale + 0.1 * Math.sin(q * Math.PI);
            const dx = tremble.ampPx * Math.sin(q * 2 * Math.PI * tremble.freq);
            const dy = tremble.ampPx * 0.6 * Math.cos(q * 2 * Math.PI * tremble.freq);
            clone.style.transform = `translate(${dx}px, ${dy - 8}px) scale(${scale}, ${scale})`;
            // hide original while loud is active
            sp.style.opacity = '0';
          } else {
            // Remove stray clone if any
            removeClone(i);
            // POP/WAVE or WHISPER inside box
            if (kind === 'whisper') {
              // Whisper: scale down to 60% (3% of stage height / 5% base = 0.6)
              const s = 0.6;
              sp.style.transform = `scale(${s}, ${s})`;
            } else {
              // pop/wave - normal size with animation
              const s = 1 + (popScale - 1) * easeOutCubic(Math.min(1, q * 1.2));
              const ty = Math.sin(q * Math.PI * 2) * 3; // small vertical wave
              sp.style.transform = `translate(0px, ${ty}px) scale(${s}, ${s})`;
            }
          }
        } else {
          // inactive
          removeClone(i);
        }
      }
    };
  },
  cleanup(el) {
    if (el && el.__cwi) {
      // Clean up clones
      for (const [i, c] of el.__cwi.clones.entries()) {
        if (c.parentElement) c.parentElement.removeChild(c);
      }
      
      // Disconnect ResizeObserver
      if (el.__cwi.resizeObserver) {
        el.__cwi.resizeObserver.disconnect();
      }
      
      el.__cwi = undefined;
    }
  }
};
