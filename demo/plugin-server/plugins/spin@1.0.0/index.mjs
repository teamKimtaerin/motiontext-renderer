export default {
  name: 'spin',
  version: '1.0.0',
  init(el, opts, ctx) {
    // no-op for dev
  },
  animate(el, opts, ctx, duration) {
    const turns = Number(opts?.fullTurns ?? 1);
    if (ctx?.gsap) {
      const tl = ctx.gsap.timeline({ paused: true });
      tl.to(el, { rotate: 360 * turns, duration, ease: 'none' });
      return tl; // host-driven progress
    }
    // Fallback seek applier if gsap missing
    return (p) => {
      const deg = p * 360 * turns;
      el.style.transform = `rotate(${deg}deg)`;
    };
  },
  cleanup(el) {
    // no-op
  }
};

export function evalChannels(spec, p, ctx) {
  const turns = Number(spec?.params?.fullTurns ?? 1);
  return { rot: 360 * p * turns };
}
