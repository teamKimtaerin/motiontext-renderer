export default {
  name: 'pulse',
  version: '1.0.0',
  animate(el, opts, ctx, duration) {
    const maxScale = Number(opts?.maxScale ?? 1.2);
    const cycles = Math.max(1, Number(opts?.cycles ?? 1));
    if (ctx?.gsap) {
      const tl = ctx.gsap.timeline({ paused: true });
      const seg = Math.max(0.0001, duration / (2 * cycles));
      // Build a yoyo scale cycle with repeat
      tl.to(el, { scale: maxScale, duration: seg, ease: 'sine.inOut' })
        .to(el, { scale: 1, duration: seg, ease: 'sine.inOut' });
      tl.repeat(cycles - 1); // total cycles
      return tl; // host-driven: .pause().progress(p)
    }
    // Fallback to seek applier when gsap is not present
    return (p) => {
      const s = 1 + (maxScale - 1) * (0.5 - 0.5 * Math.cos(p * Math.PI * 2 * cycles));
      el.style.transform = `scale(${s}, ${s})`;
    };
  },
};

export function evalChannels(spec, p, ctx) {
  const maxScale = Number(spec?.params?.maxScale ?? 1.2);
  const cycles = Math.max(1, Number(spec?.params?.cycles ?? 1));
  const s = 1 + (maxScale - 1) * (0.5 - 0.5 * Math.cos(p * Math.PI * 2 * cycles));
  return { sx: s, sy: s };
}
