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

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

function easeInCubic(x) { return x * x * x; }
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

export const name = 'cwi-whisper';
export const version = '2.0.0';

export function init(el, opts, ctx) {
    const root = el; // effectsRoot
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
    
    el.__cwiWhisper = {
      root,
      span,
      palette: opts?.palette || {},
      t0: Number(opts?.t0 ?? 0),
      t1: Number(opts?.t1 ?? 0),
      shrink: {
        scale: Math.max(0.1, Math.min(1, Number(opts?.shrink?.scale ?? 0.6))),
        drop: Math.max(0, Number(opts?.shrink?.drop ?? 6)),
      },
      flutter: {
        amp: Math.max(0, Number(opts?.flutter?.amp ?? 0.02)),
        freq: Math.max(1, Number(opts?.flutter?.freq ?? 8)),
      },
      speaker: opts?.speaker
    };
}

export function animate(el, opts, ctx, duration) {
    const state = el.__cwiWhisper;
    if (!state) return () => {};
    
    const span = state.span;

    // Initial baseline (color handled by cwi-color)
    span.style.transform = 'translate3d(0px, 0px, 0px) scale(1, 1)';
    span.style.opacity = '1';

    // Seek-applier driven by host progress p (0..1)
    return (p) => {
      const local = clamp01(p || 0);
      // Color is delegated to cwi-color plugin

      // Dramatic shape: fast shrink → hold with flutter → fast return
      const shrinkConf = state.shrink || { scale: 0.6, drop: 6 };
      const flutterConf = state.flutter || { amp: 0.02, freq: 8 };
      const minScale = Math.max(0.1, Math.min(1, Number(shrinkConf.scale || 0.6)));
      const dropMax = Math.max(0, Number(shrinkConf.drop || 6));
      const flutterAmp = Math.max(0, Number(flutterConf.amp || 0.02));
      const flutterFreq = Math.max(1, Number(flutterConf.freq || 8));

      const edge = 0.12; // 12% fast shrink/return → 더 빠르게 푹 꺼졌다 복귀
      const holdStart = edge;
      const holdEnd = 1 - edge;

      let factor = 0; // 0..1 amount of shrink towards minScale
      if (local < holdStart) {
        // fast shrink
        const t = local / holdStart;
        factor = easeOutCubic(t);
      } else if (local > holdEnd) {
        // fast return
        const t = (local - holdEnd) / (1 - holdEnd);
        factor = 1 - easeInCubic(t);
      } else {
        // hold at min
        factor = 1;
      }

      const baseScale = 1 - (1 - minScale) * factor;
      // 더 잘게 많이: 고주파, 저진폭 플러터 + 유지 구간 링(감쇠)
      const timePhase = local * Math.PI * (flutterFreq * 1.6);
      const flutter = (flutterAmp * 0.8) * factor * Math.sin(timePhase);

      let ring = 0;
      if (local >= holdStart && local <= holdEnd) {
        const tHold = (local - holdStart) / (holdEnd - holdStart);
        const ringAmp = 0.05;   // 최대 5% 진동 (최소점 주변)
        const ringFreq = 16;
        const ringDecay = 3.0;
        // whisper는 최소점 주변에서 위아래 미세 흔들림 → 스케일을 살짝 더 낮췄다가 회복하는 방향
        ring = -ringAmp * Math.exp(-ringDecay * tHold) * Math.sin(2 * Math.PI * ringFreq * tHold);
      }

      const scale = Math.max(minScale, baseScale - flutter + ring);
      const drop = dropMax * factor;
      span.style.transform = `translate3d(0px, ${drop}px, 0px) scale(${scale}, ${scale})`;
      span.style.opacity = '1';
    };
}

export function cleanup(el) {
  if (el && el.__cwiWhisper) {
    el.__cwiWhisper = undefined;
  }
}
