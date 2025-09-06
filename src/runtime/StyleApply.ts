// Applies composed style/layout transforms and CSS variables into DOM elements.
import type { Channels } from "../composer/PluginChainComposer";

export function buildTransform(base: string | undefined, ch: Channels): string {
  const parts: string[] = [];
  if (base && base.length) parts.push(base);
  const sx = ch.sx ?? 1;
  const sy = ch.sy ?? 1;
  if (sx !== 1 || sy !== 1) parts.push(`scale(${sx}, ${sy})`);
  const tx = ch.tx ?? 0;
  const ty = ch.ty ?? 0;
  if (tx !== 0 || ty !== 0) parts.push(`translate(${Math.round(tx * 100) / 100}px, ${Math.round(ty * 100) / 100}px)`);
  const rot = ch.rot ?? 0;
  if (rot !== 0) parts.push(`rotate(${rot}deg)`);
  return parts.join(" ");
}

export function applyChannels(el: HTMLElement, baseTransform: string | undefined, ch: Channels) {
  el.style.transform = buildTransform(baseTransform, ch);
  if (ch.opacity != null) el.style.opacity = String(ch.opacity);
}

