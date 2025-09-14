// Caption with Intention (CwI) — per-word plugin (hotfix)
// - Assumes host element is a Text node representing a single word.
// - Params: { kind: 'pop' | 'loud' | 'whisper' | 'color', speaker?, palette?, color?, popScale?, tremble?, t0?, t1? }
// - Uses GSAP via ctx.gsap. The renderer drives progress() directly for seeking accuracy.

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

function px(n) { return `${Math.round(n)}px`; }

function colorFor(state, opts) {
  if (opts?.color) return opts.color;
  const pal = state.palette || {};
  if (state.speaker && pal[state.speaker]) return pal[state.speaker];
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

function buildPopTimeline(gsap, span, popScale = 1.15) {
  const tl = gsap.timeline({ paused: true });
  tl.eventCallback('onUpdate', () => {
    const q = tl.progress();
    const s = 1 + (popScale - 1) * (1 - Math.pow(1 - Math.min(1, q * 1.2), 3));
    const ty = Math.sin(q * Math.PI * 2) * 3;
    span.style.transform = `translate(0px, ${ty}px) scale(${s}, ${s})`;
    span.style.opacity = '1';
  });
  return tl;
}

function buildWhisperTimeline(gsap, span) {
  const tl = gsap.timeline({ paused: true });
  tl.eventCallback('onUpdate', () => {
    const s = 0.6; // 3% / 5% = 0.6
    span.style.transform = `scale(${s}, ${s})`;
    span.style.opacity = '1';
  });
  return tl;
}

function buildLoudTimeline(gsap, span, tremble) {
  const amp = Number(tremble?.ampPx ?? 1.5);
  const freq = Number(tremble?.freq ?? 12);
  const baseScale = 2.4; // 12% / 5%
  const tl = gsap.timeline({ paused: true });
  tl.eventCallback('onUpdate', () => {
    const q = tl.progress();
    const s = baseScale + 0.1 * Math.sin(q * Math.PI);
    const dx = amp * Math.sin(q * 2 * Math.PI * freq);
    const dy = amp * 0.6 * Math.cos(q * 2 * Math.PI * freq);
    span.style.transform = `translate(${dx}px, ${dy - 8}px) scale(${s}, ${s})`;
    span.style.opacity = '1';
  });
  return tl;
}

function buildColorTimeline(gsap, span, fromCss = WHITE90, toCss = '#FFD400', t0 = 0, t1 = 1, D = 1) {
  const tl = gsap.timeline({ paused: true });
  const from = /^rgb/.test(fromCss) ? (function () {
    const m = fromCss.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
    return hexToRgb('#ffffff');
  })() : hexToRgb(fromCss);
  const to = /^rgb/.test(toCss) ? (function () {
    const m = toCss.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
    return hexToRgb('#ffffff');
  })() : hexToRgb(toCss);
  tl.eventCallback('onUpdate', () => {
    const q = tl.progress();
    const now = q * (D || 0.0001);
    const w = Math.max(0.0001, (t1 - t0) || 0.0001);
    const pr = now <= t0 ? 0 : now >= t1 ? 1 : (now - t0) / w; // 0..1 within [t0,t1]
    const eased = easeOutCubic(pr);
    const c = mixRgb(from, to, eased);
    span.style.color = rgbToCss(c);
    span.style.opacity = '1';
  });
  return tl;
}

export const name = 'cwi';
export const version = '1.0.0';

export function init(el, opts, ctx) {
    const host = el.parentElement; // effectsRoot is child of host text element
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
    el.__cwi = {
      host,
      span,
      palette: opts?.palette || {},
      kind: String(opts?.kind || 'pop'),
      t0: Number(opts?.t0 ?? 0), // seconds relative to cue window
      t1: Number(opts?.t1 ?? 0),
      popScale: Number(opts?.popScale ?? 1.15),
      tremble: Object.assign({ ampPx: 1.5, freq: 12 }, opts?.tremble || {}),
      speaker: opts?.speaker
    };
}

export function animate(el, opts, ctx, duration) {
    const state = el.__cwi;
    if (!state) return () => {};
    const span = state.span;
    const kind = String(state.kind || opts?.kind || 'pop');
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
      // progress within window 0..1
      const w = Math.max(0.0001, (t1 - t0) || 0.0001);
      const pw = (now - t0) / w;

      if (kind === 'color' || kind === 'colorChange') {
        // Before window: white, During: interpolate, After: keep speaker color
        if (now < t0) {
          span.style.color = WHITE90;
        } else if (now >= t1) {
          span.style.color = colorFor(state, opts);
        } else {
          const from = hexToRgb('#ffffff');
          const to = hexToRgb(colorFor(state, opts));
          const c = mixRgb(from, to, easeOutCubic(pw));
          span.style.color = rgbToCss(c);
        }
        span.style.opacity = '1';
        // Do not touch transform here (allow transform plugins to control it)
        return;
      }

      // Non-color kinds also enforce speaker color during active window only
      if (!active) {
        // Outside window, reset geometry but don't force color (color plugin may persist)
        span.style.transform = 'translate(0px, 0px) scale(1, 1)';
        span.style.opacity = '1';
        return;
      }

      // Active window transforms
      span.style.color = colorFor(state, opts);
      if (kind === 'whisper') {
        const s = 0.6; // 3%/5%
        span.style.transform = `scale(${s}, ${s})`;
        span.style.opacity = '1';
        return;
      }
      if (kind === 'loud') {
        const baseScale = 2.4; // 12%/5%
        const trem = state.tremble || { ampPx: 1.5, freq: 12 };
        const s = baseScale + 0.1 * Math.sin(pw * Math.PI);
        const dx = trem.ampPx * Math.sin(pw * 2 * Math.PI * trem.freq);
        const dy = trem.ampPx * 0.6 * Math.cos(pw * 2 * Math.PI * trem.freq);
        span.style.transform = `translate(${dx}px, ${dy - 8}px) scale(${s}, ${s})`;
        span.style.opacity = '1';
        return;
      }
      // pop (default)
      const popScale = state.popScale || 1.15;
      const s = 1 + (popScale - 1) * (1 - Math.pow(1 - Math.min(1, pw * 1.2), 3));
      const ty = Math.sin(pw * Math.PI * 2) * 3;
      span.style.transform = `translate(0px, ${ty}px) scale(${s}, ${s})`;
      span.style.opacity = '1';
    };
}

export function cleanup(el) {
    if (el && el.__cwi) {
      el.__cwi = undefined;
    }
}
