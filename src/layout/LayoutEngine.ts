// Minimal layout helpers for M2.5: apply normalized position to absolute element.
// Future: handle flow/grid/override/transform/safeArea.

import type { Layout, Anchor } from "../types/layout";

function anchorTranslate(anchor: Anchor): { tx: number; ty: number } {
  switch (anchor) {
    case "tl":
      return { tx: 0, ty: 0 };
    case "tc":
      return { tx: -50, ty: 0 };
    case "tr":
      return { tx: -100, ty: 0 };
    case "cl":
      return { tx: 0, ty: -50 };
    case "cc":
      return { tx: -50, ty: -50 };
    case "cr":
      return { tx: -100, ty: -50 };
    case "bl":
      return { tx: 0, ty: -100 };
    case "bc":
      return { tx: -50, ty: -100 };
    case "br":
      return { tx: -100, ty: -100 };
    default:
      return { tx: -50, ty: -50 };
  }
}

export function applyNormalizedPosition(el: HTMLElement, layout?: Layout, defaultAnchor: Anchor = "cc") {
  if (!layout || !layout.position) return;
  const { x, y } = layout.position;
  if (typeof x !== "number" || typeof y !== "number") return;
  el.style.position = "absolute";
  el.style.left = `${Math.round(x * 10000) / 100}%`;
  el.style.top = `${Math.round(y * 10000) / 100}%`;
  const anchor = (layout.anchor as Anchor) || defaultAnchor;
  const { tx, ty } = anchorTranslate(anchor);
  el.style.transform = `translate(${tx}%, ${ty}%)`;
}
