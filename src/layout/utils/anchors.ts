// Anchor utility functions for layout positioning
import type { Anchor } from "../../types/layout";

export function anchorTranslate(anchor: Anchor): { tx: number; ty: number } {
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

export function anchorFraction(anchor: Anchor): { ax: number; ay: number } {
  switch (anchor) {
    case 'tl': return { ax: 0, ay: 0 };
    case 'tc': return { ax: 0.5, ay: 0 };
    case 'tr': return { ax: 1, ay: 0 };
    case 'cl': return { ax: 0, ay: 0.5 };
    case 'cc': return { ax: 0.5, ay: 0.5 };
    case 'cr': return { ax: 1, ay: 0.5 };
    case 'bl': return { ax: 0, ay: 1 };
    case 'bc': return { ax: 0.5, ay: 1 };
    case 'br': return { ax: 1, ay: 1 };
    default:   return { ax: 0.5, ay: 0.5 };
  }
}