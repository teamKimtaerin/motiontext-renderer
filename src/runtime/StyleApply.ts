// Applies composed style/layout transforms and CSS variables into DOM elements.
import type { Channels } from '../composer/PluginChainComposer';
import type { Style } from '../types/layout';

export function buildTransform(base: string | undefined, ch: Channels): string {
  const parts: string[] = [];
  if (base && base.length) parts.push(base);
  const sx = ch.sx ?? 1;
  const sy = ch.sy ?? 1;
  if (sx !== 1 || sy !== 1) parts.push(`scale(${sx}, ${sy})`);
  const tx = ch.tx ?? 0;
  const ty = ch.ty ?? 0;
  if (tx !== 0 || ty !== 0)
    parts.push(
      `translate(${Math.round(tx * 100) / 100}px, ${Math.round(ty * 100) / 100}px)`
    );
  const rot = ch.rot ?? 0;
  if (rot !== 0) parts.push(`rotate(${rot}deg)`);
  return parts.join(' ');
}

export function applyChannels(
  el: HTMLElement,
  baseTransform: string | undefined,
  ch: Channels
) {
  el.style.transform = buildTransform(baseTransform, ch);
  if (ch.opacity != null) el.style.opacity = String(ch.opacity);
}

export function applyTextStyle(
  el: HTMLElement,
  containerHeight: number,
  style?: Style,
  trackDefault?: Style
) {
  const s = { ...(trackDefault || {}), ...(style || {}) } as any;
  if (s.color) el.style.color = String(s.color);
  if (s.textShadow) el.style.textShadow = String(s.textShadow);
  // Typography
  if (s.fontFamily) el.style.fontFamily = String(s.fontFamily);
  if (s.fontWeight) el.style.fontWeight = String(s.fontWeight);
  if (s.lineHeight != null) el.style.lineHeight = String(s.lineHeight);
  // fontSize: support absolute(px, em, rem) via fontSize, or relative via fontSizeRel
  if (s.fontSize) el.style.fontSize = String(s.fontSize);
  else if (typeof s.fontSizeRel === 'number') {
    const px = Math.max(1, Math.round(containerHeight * s.fontSizeRel));
    el.style.fontSize = `${px}px`;
  }
  // Stroke: try -webkit-text-stroke if width provided, else fallback via stronger shadow if not present
  if (s.stroke && typeof s.stroke.widthRel === 'number') {
    const px = Math.max(1, Math.round(containerHeight * s.stroke.widthRel));
    (el.style as any).webkitTextStrokeWidth = `${px}px`;
    (el.style as any).webkitTextStrokeColor = String(s.stroke.color || '#000');
    (el.style as any).webkitTextFillColor = el.style.color || '#fff';
  } else if (!s.textShadow) {
    // Default readable outline if none specified
    el.style.textShadow = '0 0 2px #000, 0 0 4px #000, 0 0 8px #000';
  }
}
