export const name = 'bobY';
export const version = '1.0.0';

export function animate(el, opts, ctx, duration) {
    const amp = Number(opts?.amplitudePx ?? 8);
    const cycles = Math.max(1, Number(opts?.cycles ?? 1));
    if (ctx?.gsap) {
      const tl = ctx.gsap.timeline({ paused: true });
      const seg = Math.max(0.0001, duration / (2 * cycles));
      tl.to(el, { y: amp, duration: seg, ease: 'sine.inOut' })
        .to(el, { y: 0, duration: seg, ease: 'sine.inOut' });
      tl.repeat(cycles - 1);
      return tl;
    }
    return (p) => {
      const ty = Math.sin(p * Math.PI * 2 * cycles) * amp;
      el.style.transform = `translateY(${ty}px)`;
    };
}

export function evalChannels(spec, p, ctx) {
  const amp = Number(spec?.params?.amplitudePx ?? 8);
  const cycles = Math.max(1, Number(spec?.params?.cycles ?? 1));
  return { ty: Math.sin(p * Math.PI * 2 * cycles) * amp };
}
