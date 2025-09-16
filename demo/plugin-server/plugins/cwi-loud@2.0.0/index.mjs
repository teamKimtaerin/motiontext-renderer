// CWI Loud Plugin - Large scale with trembling animation
// Scales text to 2.4x base size with vibration effect

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

function easeInCubic(x) { return x * x * x; }
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

export const name = 'cwi-loud';
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
    
    el.__cwiLoud = {
      root,
      span,
      palette: opts?.palette || {},
      t0: Number(opts?.t0 ?? 0),
      t1: Number(opts?.t1 ?? 0),
      pulse: {
        scale: Math.max(1.1, Number(opts?.pulse?.scale ?? 2.15)),
        lift: Math.max(0, Number(opts?.pulse?.lift ?? 12)),
      },
      tremble: {
        ampPx: Math.max(0, Number(opts?.tremble?.ampPx ?? 1.5)),
        freq: Math.max(1, Number(opts?.tremble?.freq ?? 12)),
      },
      speaker: opts?.speaker
    };
}

export function animate(el, opts, ctx, duration) {
    const state = el.__cwiLoud;
    if (!state) return () => {};
    
    const span = state.span;

    // Initial baseline
    span.style.color = WHITE90;
    span.style.transform = 'translate3d(0px, 0px, 0px) scale(1, 1)';
    span.style.opacity = '1';

    // Seek-applier driven by host progress p (0..1)
    return (p) => {
      const local = clamp01(p || 0);
      span.style.color = colorFor(state, opts, el);

      // Dramatic shape: fast grow → hold with tremble → fast shrink
      const pulseConf = state.pulse || { scale: 2.15, lift: 12 };
      const trem = state.tremble || { ampPx: 1.5, freq: 12 };
      const maxScale = Math.max(1.01, Number(pulseConf.scale || 2.15));
      const lift = Math.max(0, Number(pulseConf.lift || 12));
      const edge = 0.12; // 12% rise, 12% fall, 76% hold → 더 빠른 팍! 성장/복귀
      const holdStart = edge;
      const holdEnd = 1 - edge;

      let factor = 0; // 0..1 scale factor towards peak
      if (local < holdStart) {
        // fast grow
        const t = local / holdStart;
        factor = easeOutCubic(t);
      } else if (local > holdEnd) {
        // fast shrink
        const t = (local - holdEnd) / (1 - holdEnd);
        factor = 1 - easeInCubic(t);
      } else {
        // hold at peak
        factor = 1;
      }

      const baseScale = 1 + (maxScale - 1) * factor;
      const crest = Math.pow(factor, 1.5);
      const timePhase = local * Math.PI * trem.freq;
      // 기본 잔떨림: 더 잘게(고주파), 살짝(저진폭)
      const scaleJitter = 0.03 * crest * Math.sin(timePhase * 1.2);

      // 푸딩 느낌의 링(overshoot): 유지 구간에서만 고주파+감쇠 진동
      let ring = 0;
      if (local >= holdStart && local <= holdEnd) {
        const tHold = (local - holdStart) / (holdEnd - holdStart);
        const ringAmp = 0.06;      // 최대 6% 추가 진동
        const ringFreq = 18;       // 잘게 많이
        const ringDecay = 3.0;     // 유지 구간 따라 점차 잦아듦
        ring = ringAmp * Math.exp(-ringDecay * tHold) * Math.sin(2 * Math.PI * ringFreq * tHold);
      }

      const scale = baseScale + scaleJitter + ring;

      // 위치 미세 떨림도 살짝 가미(고주파, 소진폭)
      const dx = trem.ampPx * 0.8 * crest * Math.sin(timePhase * 1.6);
      const dy = -lift * factor + trem.ampPx * 0.5 * crest * Math.cos(timePhase * 1.9);
      span.style.transform = `translate3d(${dx}px, ${dy}px, 0px) scale(${scale}, ${scale})`;
      span.style.opacity = '1';
    };
}

export function cleanup(el) {
  if (el && el.__cwiLoud) {
    el.__cwiLoud = undefined;
  }
}
