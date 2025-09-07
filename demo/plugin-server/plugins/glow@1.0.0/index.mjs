function hexToRgba(hex, alpha) {
  const m = String(hex).trim().replace('#','');
  const v = m.length === 3 ? m.split('').map(c=>c+c).join('') : m;
  const r = parseInt(v.slice(0,2),16) || 0;
  const g = parseInt(v.slice(2,4),16) || 0;
  const b = parseInt(v.slice(4,6),16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default {
  name: 'glow',
  version: '1.0.0',
  init(el, opts, ctx) {
    // create a radial gradient glow layer
    const color = opts?.color ?? '#00ffff';
    const intensity = Number(opts?.intensity ?? 0.4);
    const glow = document.createElement('div');
    glow.setAttribute('data-glow', '');
    glow.style.position = 'absolute';
    glow.style.left = '0';
    glow.style.top = '0';
    glow.style.width = '100%';
    glow.style.height = '100%';
    glow.style.pointerEvents = 'none';
    glow.style.zIndex = '-1'; // behind text glyphs
    glow.style.mixBlendMode = 'normal';
    glow.style.filter = 'blur(24px)';
    const c = hexToRgba(color, intensity);
    glow.style.background = `radial-gradient(circle at 50% 50%, ${c} 30%, rgba(0,0,0,0) 80%)`;
    glow.style.opacity = String(Math.max(0, Math.min(1, intensity)));
    el.appendChild(glow);

    // Also boost text glow via layered text-shadow on parent element
    const parent = el.parentElement;
    if (parent) {
      const base = intensity;
      const rgba1 = hexToRgba(color, Math.min(1, base));
      const rgba2 = hexToRgba(color, Math.min(1, base * 0.8));
      const rgba3 = hexToRgba(color, Math.min(1, base * 0.6));
      parent.style.textShadow = `0 0 6px ${rgba1}, 0 0 12px ${rgba2}, 0 0 18px ${rgba3}`;
    }
  },
  animate(el, opts, ctx, duration) {
    const pulse = !!opts?.pulse;
    const cycles = Math.max(1, Number(opts?.cycles ?? 8));
    const intensity = Number(opts?.intensity ?? 0.4);
    const glow = el.querySelector('[data-glow]');
    const parent = el.parentElement;
    if (ctx?.gsap && glow) {
      const tl = ctx.gsap.timeline({ paused: true });
      const seg = Math.max(0.0001, duration / (2 * cycles));
      if (!pulse) {
        tl.set(glow, { opacity: intensity });
        return tl;
      }
      const obj = { k: intensity };
      tl.to(obj, { k: Math.min(1, intensity + 0.3), duration: seg, ease: 'sine.inOut', onUpdate: () => {
        // update overlay opacity
        glow.style.opacity = String(obj.k);
        // and strengthen text-shadow accordingly
        if (parent) {
          const c1 = hexToRgba(opts?.color ?? '#00ffff', Math.min(1, obj.k));
          const c2 = hexToRgba(opts?.color ?? '#00ffff', Math.min(1, obj.k * 0.8));
          const c3 = hexToRgba(opts?.color ?? '#00ffff', Math.min(1, obj.k * 0.6));
          parent.style.textShadow = `0 0 6px ${c1}, 0 0 12px ${c2}, 0 0 18px ${c3}`;
        }
      }})
      .to(obj, { k: Math.max(0, intensity - 0.2), duration: seg, ease: 'sine.inOut', onUpdate: () => {
        glow.style.opacity = String(obj.k);
        if (parent) {
          const c1 = hexToRgba(opts?.color ?? '#00ffff', Math.min(1, obj.k));
          const c2 = hexToRgba(opts?.color ?? '#00ffff', Math.min(1, obj.k * 0.8));
          const c3 = hexToRgba(opts?.color ?? '#00ffff', Math.min(1, obj.k * 0.6));
          parent.style.textShadow = `0 0 6px ${c1}, 0 0 12px ${c2}, 0 0 18px ${c3}`;
        }
      }});
      tl.repeat(cycles - 1);
      return tl;
    }
    // Fallback: simple seek applier pulse
    return (p) => {
      const g = el.querySelector('[data-glow]');
      if (!g) return;
      if (!pulse) {
        g.style.opacity = String(intensity);
      } else {
        const y = 0.5 - 0.5 * Math.cos(p * Math.PI * 2 * cycles);
        const v = Math.max(0, Math.min(1, intensity - 0.2 + y * 0.45));
        g.style.opacity = String(v);
        if (parent) {
          const c1 = hexToRgba(opts?.color ?? '#00ffff', Math.min(1, v));
          const c2 = hexToRgba(opts?.color ?? '#00ffff', Math.min(1, v * 0.8));
          const c3 = hexToRgba(opts?.color ?? '#00ffff', Math.min(1, v * 0.6));
          parent.style.textShadow = `0 0 6px ${c1}, 0 0 12px ${c2}, 0 0 18px ${c3}`;
        }
      }
    };
  },
  cleanup(el) {
    const glow = el.querySelector('[data-glow]');
    if (glow && glow.parentElement === el) el.removeChild(glow);
  }
};
