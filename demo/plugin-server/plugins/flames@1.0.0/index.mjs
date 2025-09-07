export default {
  name: 'flames',
  version: '1.0.0',
  init(el, opts, ctx) {
    // Mount a background gif image under effectsRoot
    const url = ctx?.assets?.getUrl ? ctx.assets.getUrl('assets/flame.gif') : null;
    if (!url) return;
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'flames';
    img.style.position = 'absolute';
    img.style.left = '0';
    img.style.top = '0';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    const baseOpacity = Number(opts?.baseOpacity ?? 0.8);
    // render behind the text content
    img.style.zIndex = '-1';
    img.style.opacity = String(baseOpacity);
    img.setAttribute('data-flames', '');
    el.appendChild(img);
  },
  animate(el, opts, ctx, duration) {
    const baseOpacity = Number(opts?.baseOpacity ?? 0.8);
    const flicker = Number(opts?.flicker ?? 0.3);
    const cycles = Math.max(1, Number(opts?.cycles ?? 12));
    const img = el.querySelector('img[data-flames]');
    if (ctx?.gsap && img) {
      const tl = ctx.gsap.timeline({ paused: true });
      const seg = Math.max(0.0001, duration / (2 * cycles));
      tl.set(img, { opacity: baseOpacity });
      tl.to(img, { opacity: Math.min(1, baseOpacity + flicker), duration: seg, ease: 'sine.inOut' })
        .to(img, { opacity: Math.max(0, baseOpacity - flicker), duration: seg, ease: 'sine.inOut' });
      tl.repeat(cycles - 1);
      return tl;
    }
    return (p) => {
      const image = el.querySelector('img[data-flames]');
      if (image) image.style.opacity = String(Math.max(0, Math.min(1, baseOpacity + (Math.random() - 0.5) * 2 * flicker)));
    };
  },
  cleanup(el) {
    const img = el.querySelector('img[data-flames]');
    if (img && img.parentElement === el) el.removeChild(img);
  }
};
