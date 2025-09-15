// Minimal layout helpers for M2.5: apply normalized position to absolute element.
// Future: handle flow/grid/override/transform/safeArea.

import type { Layout, Anchor, LayoutConstraints } from '../types/layout';
import { anchorTranslate, anchorFraction } from './utils/anchors';
import { mergeConstraints, shouldBreakout } from './DefaultConstraints';

type SafeArea =
  | { top?: number; bottom?: number; left?: number; right?: number }
  | undefined;

export interface ApplyLayoutOptions {
  stageSafe?: SafeArea;
  trackSafe?: SafeArea;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const maxN = (a?: number, b?: number) =>
  a == null ? (b ?? 0) : b == null ? a : Math.max(a, b);

// (anchorTranslate and anchorFraction moved to utils/anchors.ts)

export function applyNormalizedPosition(
  el: HTMLElement,
  layout?: Layout,
  defaultAnchor: Anchor = 'cc',
  opts: ApplyLayoutOptions = {}
) {
  if (!layout || !layout.position) return;
  let { x, y } = layout.position;
  if (typeof x !== 'number' || typeof y !== 'number') return;

  // safeAreaClamp: clamp anchor point within effective safe rectangle
  if (layout.safeAreaClamp) {
    const ss = opts.stageSafe ?? {};
    const ts = opts.trackSafe ?? {};
    const effLeft = maxN(ss.left, ts.left);
    const effRight = maxN(ss.right, ts.right);
    const effTop = maxN(ss.top, ts.top);
    const effBottom = maxN(ss.bottom, ts.bottom);
    const xmin = clamp01(effLeft ?? 0);
    const xmax = 1 - clamp01(effRight ?? 0);
    const ymin = clamp01(effTop ?? 0);
    const ymax = 1 - clamp01(effBottom ?? 0);
    // If size is known, clamp so that the whole element stays within safe box
    const parent = el.parentElement;
    const pw = parent?.clientWidth ?? 0;
    const ph = parent?.clientHeight ?? 0;
    // normalized size if specified; else measure (when connected)
    let wN = typeof layout.size?.width === 'number' ? layout.size!.width! : 0;
    let hN = typeof layout.size?.height === 'number' ? layout.size!.height! : 0;
    if ((!wN || !hN) && el.isConnected && pw > 0 && ph > 0) {
      const bw = el.offsetWidth;
      const bh = el.offsetHeight;
      if (!wN && bw > 0) wN = bw / pw;
      if (!hN && bh > 0) hN = bh / ph;
    }
    const { ax, ay } = anchorFraction(
      (layout.anchor as Anchor) || defaultAnchor
    );
    // Horizontal clamp
    if (wN > 0) {
      // Calculate the bounds for the anchor point position
      const xmin2 = xmin + (1 - ax) * wN; // minimum anchor position (considering element extends away from anchor)
      const xmax2 = xmax - ax * wN; // maximum anchor position (considering element extends toward anchor)
      x = Math.min(Math.max(x, xmin2), xmax2);
    } else {
      x = Math.min(Math.max(x, xmin), xmax);
    }
    // Vertical clamp
    if (hN > 0) {
      // For anchor point clamping, we need to ensure the entire element stays within safe bounds
      // For bottom anchor (ay = 1.0): anchor point is at element bottom, element extends upward
      // For top anchor (ay = 0.0): anchor point is at element top, element extends downward
      // For center anchor (ay = 0.5): anchor point is at element center

      // Calculate the bounds for the anchor point position
      const ymin2 = ymin + (1 - ay) * hN; // minimum anchor position (considering element extends away from anchor)
      const ymax2 = ymax - ay * hN; // maximum anchor position (considering element extends toward anchor)
      y = Math.min(Math.max(y, ymin2), ymax2);
    } else {
      y = Math.min(Math.max(y, ymin), ymax);
    }
  }

  el.style.position = 'absolute';
  el.style.left = `${Math.round(x * 10000) / 100}%`;
  el.style.top = `${Math.round(y * 10000) / 100}%`;

  // size (normalized percent) or auto
  if (layout.size) {
    if (layout.size.width != null) {
      el.style.width =
        typeof layout.size.width === 'number'
          ? `${layout.size.width * 100}%`
          : 'auto';
    }
    if (layout.size.height != null) {
      el.style.height =
        typeof layout.size.height === 'number'
          ? `${layout.size.height * 100}%`
          : 'auto';
    }
  }

  if (layout.overflow) el.style.overflow = layout.overflow;
  if (layout.transformOrigin) el.style.transformOrigin = layout.transformOrigin;
  const anchor = (layout.anchor as Anchor) || defaultAnchor;
  const { tx, ty } = anchorTranslate(anchor);
  // compose additional layout.transform (translate/rotate/scale/skew minimal)
  const parts: string[] = [`translate(${tx}%, ${ty}%)`];
  const tr = layout.transform;
  if (tr?.translate) {
    const dx = tr.translate.x ?? 0;
    const dy = tr.translate.y ?? 0;
    if (dx || dy) parts.push(`translate(${dx * 100}%, ${dy * 100}%)`);
  }
  if (tr?.scale) {
    const sx = tr.scale.x ?? 1;
    const sy = tr.scale.y ?? 1;
    if (sx !== 1 || sy !== 1) parts.push(`scale(${sx}, ${sy})`);
  }
  if (tr?.rotate?.deg != null) {
    parts.push(`rotate(${tr.rotate.deg}deg)`);
  }
  if (tr?.skew) {
    const xDeg = tr.skew.xDeg ?? 0;
    const yDeg = tr.skew.yDeg ?? 0;
    if (xDeg || yDeg) parts.push(`skew(${xDeg}deg, ${yDeg}deg)`);
  }

  // override support (absolute offset/transform applied after group rules)
  const ov = layout.override;
  if (ov?.mode === 'absolute') {
    if (ov.offset) {
      const ox = ov.offset.x ?? 0;
      const oy = ov.offset.y ?? 0;
      if (ox || oy) parts.push(`translate(${ox * 100}%, ${oy * 100}%)`);
    }
    if (ov.transform) {
      const ot = ov.transform;
      if (ot.translate) {
        const dx = ot.translate.x ?? 0;
        const dy = ot.translate.y ?? 0;
        if (dx || dy) parts.push(`translate(${dx * 100}%, ${dy * 100}%)`);
      }
      if (ot.scale) {
        const sx = ot.scale.x ?? 1;
        const sy = ot.scale.y ?? 1;
        if (sx !== 1 || sy !== 1) parts.push(`scale(${sx}, ${sy})`);
      }
      if (ot.rotate?.deg != null) parts.push(`rotate(${ot.rotate.deg}deg)`);
      if (ot.skew) {
        const sx = ot.skew.xDeg ?? 0,
          sy = ot.skew.yDeg ?? 0;
        if (sx || sy) parts.push(`skew(${sx}deg, ${sy}deg)`);
      }
    }
  }
  el.style.transform = parts.join(' ');
}

// New constraints-based layout system
export interface LayoutWithConstraintsOptions extends ApplyLayoutOptions {
  parentConstraints?: LayoutConstraints;
  hasEffectScope?: boolean;
}

/**
 * Apply layout with constraints system (Flutter-like)
 * This is the new unified layout function that handles constraints
 */
export function applyLayoutWithConstraints(
  el: HTMLElement,
  layout?: Layout,
  constraints?: LayoutConstraints,
  defaultAnchor: Anchor = 'cc',
  opts: LayoutWithConstraintsOptions = {}
) {
  // Merge provided constraints with parent constraints
  const effectiveConstraints = constraints
    ? mergeConstraints(opts.parentConstraints, constraints)
    : opts.parentConstraints;

  // Check if this element should breakout of parent constraints
  if (
    effectiveConstraints &&
    shouldBreakout(effectiveConstraints, opts.hasEffectScope || false)
  ) {
    // TODO: Implement portal/breakout system
    // For now, fall back to absolute positioning
    applyNormalizedPosition(el, layout, defaultAnchor, opts);
    return;
  }

  // Determine layout mode from constraints or layout
  const mode = layout?.mode || effectiveConstraints?.mode || 'absolute';

  switch (mode) {
    case 'flow':
      applyFlowContainerWithConstraints(
        el,
        layout,
        effectiveConstraints,
        defaultAnchor,
        opts
      );
      break;
    case 'grid':
      applyGridContainerWithConstraints(
        el,
        layout,
        effectiveConstraints,
        defaultAnchor,
        opts
      );
      break;
    case 'absolute':
    default:
      applyNormalizedPosition(el, layout, defaultAnchor, opts);
      break;
  }

  // Group의 자식 레이아웃 적용 (그룹 자체 positioning과 독립적)
  if (layout?.childrenLayout) {
    // If wrapping is requested (explicit or implied for horizontal), constrain container max width
    const cl: any = layout.childrenLayout as any;
    const wantWrap = (cl?.wrap ?? (cl?.direction === 'horizontal')) && !!el.parentElement;
    if (wantWrap) {
      const pw = el.parentElement.clientWidth || 0;
      const safe = constraints?.safeArea || {};
      const safeL = Math.max(0, Number(safe.left || 0));
      const safeR = Math.max(0, Number(safe.right || 0));
      const widthFactorFromSafe = Math.max(0, 1 - (safeL + safeR));
      const widthFactorFromConstraint = constraints?.maxWidth ?? 1;
      const widthFactorFromLayout = typeof cl.maxWidthRel === 'number' ? cl.maxWidthRel : 1;
      const widthFactor = Math.min(widthFactorFromSafe, widthFactorFromConstraint, widthFactorFromLayout);
      const mw = Math.round(pw * widthFactor);
      el.style.maxWidth = `${mw}px`;
      // Allow natural height growth for multi-line
      el.style.width = 'auto';
    }
    applyChildrenLayout(el, layout.childrenLayout);
  }
}

/**
 * Apply flow layout with constraints
 */
function applyFlowContainerWithConstraints(
  el: HTMLElement,
  layout?: Layout,
  constraints?: LayoutConstraints,
  defaultAnchor: Anchor = 'cc',
  opts: ApplyLayoutOptions = {}
) {
  // Apply base positioning first
  applyNormalizedPosition(el, layout, defaultAnchor, opts);

  // Set up flex container
  el.style.display = 'flex';

  // Direction from constraints or default vertical
  const direction = constraints?.direction || 'vertical';
  el.style.flexDirection = direction === 'vertical' ? 'column' : 'row';

  // Anchor-based alignment
  const anchor = layout?.anchor || constraints?.anchor || defaultAnchor;

  // Cross-axis alignment (수평 정렬)
  const alignMap: Record<string, string> = {
    tl: 'flex-start',
    tc: 'center',
    tr: 'flex-end',
    cl: 'flex-start',
    cc: 'center',
    cr: 'flex-end',
    bl: 'flex-start',
    bc: 'center',
    br: 'flex-end',
  };
  el.style.alignItems = alignMap[anchor] || 'center';

  // Main-axis alignment (수직 정렬 - flow direction 기준)
  const justifyMap: Record<string, string> = {
    tl: 'flex-start',
    tc: 'flex-start',
    tr: 'flex-start',
    cl: 'center',
    cc: 'center',
    cr: 'center',
    bl: 'flex-end',
    bc: 'flex-end',
    br: 'flex-end',
  };
  el.style.justifyContent = justifyMap[anchor] || 'center';

  // Gap from constraints or layout
  const gap = constraints?.gap || layout?.gapRel || 0;
  if (gap && el.parentElement) {
    const ph = el.parentElement.clientHeight || 0;
    const gapProp = direction === 'vertical' ? 'rowGap' : 'columnGap';
    el.style[gapProp] = `${Math.round(ph * gap)}px`;
  }

  // Apply size constraints
  applyConstraintSizing(el, constraints);
}

/**
 * Apply grid layout with constraints
 */
function applyGridContainerWithConstraints(
  el: HTMLElement,
  layout?: Layout,
  constraints?: LayoutConstraints,
  defaultAnchor: Anchor = 'cc',
  opts: ApplyLayoutOptions = {}
) {
  // Apply base positioning first
  applyNormalizedPosition(el, layout, defaultAnchor, opts);

  // Set up grid container
  el.style.display = 'grid';
  (el.style as any).gridTemplateColumns = 'repeat(auto-fit, minmax(0, 1fr))';

  // Gap from constraints
  const gap = constraints?.gap || layout?.gapRel || 0;
  if (gap && el.parentElement) {
    const ph = el.parentElement.clientHeight || 0;
    const gapPx = Math.round(ph * gap);
    (el.style as any).rowGap = `${gapPx}px`;
    (el.style as any).columnGap = `${gapPx}px`;
  }

  // Anchor-based grid alignment
  const anchor = layout?.anchor || constraints?.anchor || defaultAnchor;
  const hmap: Record<string, string> = {
    tl: 'start',
    tc: 'center',
    tr: 'end',
    cl: 'start',
    cc: 'center',
    cr: 'end',
    bl: 'start',
    bc: 'center',
    br: 'end',
  };
  (el.style as any).justifyItems = hmap[anchor] || 'center';

  // Apply size constraints
  applyConstraintSizing(el, constraints);
}

/**
 * Apply size constraints to element
 */
function applyConstraintSizing(
  el: HTMLElement,
  constraints?: LayoutConstraints
) {
  if (!constraints) return;

  // Apply max/min constraints
  if (constraints.maxWidth !== undefined) {
    el.style.maxWidth = `${constraints.maxWidth * 100}%`;
  }
  if (constraints.maxHeight !== undefined) {
    el.style.maxHeight = `${constraints.maxHeight * 100}%`;
  }
  if (constraints.minWidth !== undefined) {
    el.style.minWidth = `${constraints.minWidth * 100}%`;
  }
  if (constraints.minHeight !== undefined) {
    el.style.minHeight = `${constraints.minHeight * 100}%`;
  }

  // Apply padding from constraints
  if (constraints.padding) {
    const px = constraints.padding.x || 0;
    const py = constraints.padding.y || 0;
    if (el.parentElement) {
      const pw = el.parentElement.clientWidth || 0;
      const ph = el.parentElement.clientHeight || 0;
      el.style.padding = `${Math.round(ph * py)}px ${Math.round(pw * px)}px`;
    }
  }
}

// Apply flow container: absolute place the group, then stack children vertically
export function applyFlowContainer(
  el: HTMLElement,
  layout?: Layout,
  defaultAnchor: Anchor = 'cc',
  opts: ApplyLayoutOptions = {}
) {
  // Position the container itself like absolute element
  applyNormalizedPosition(el, layout, defaultAnchor, opts);
  // Stack children
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  const anchor = (layout?.anchor as Anchor) || defaultAnchor;
  // alignItems based on horizontal anchor
  const alignMap: Record<string, string> = {
    tl: 'flex-start',
    tc: 'center',
    tr: 'flex-end',
    cl: 'flex-start',
    cc: 'center',
    cr: 'flex-end',
    bl: 'flex-start',
    bc: 'center',
    br: 'flex-end',
  };
  el.style.alignItems = alignMap[anchor] || 'center';
  // gapRel to px using container parent height
  const gapRel = layout?.gapRel ?? 0;
  if (gapRel && el.parentElement) {
    const ph = el.parentElement.clientHeight || 0;
    el.style.rowGap = `${Math.round(ph * gapRel)}px`;
  } else {
    el.style.rowGap = '';
  }
}

// Apply grid container (1차: 간단 행 우선, auto-fit 2열 기본)
export function applyGridContainer(
  el: HTMLElement,
  layout?: Layout,
  defaultAnchor: Anchor = 'cc',
  opts: ApplyLayoutOptions = {}
) {
  applyNormalizedPosition(el, layout, defaultAnchor, opts);
  el.style.display = 'grid';
  // 기본 2열 그리드, 필요한 경우 확장 가능
  (el.style as any).gridTemplateColumns = 'repeat(auto-fit, minmax(0, 1fr))';
  const gapRel = layout?.gapRel ?? 0;
  if (gapRel && el.parentElement) {
    const ph = el.parentElement.clientHeight || 0;
    const gapPx = Math.round(ph * gapRel);
    (el.style as any).rowGap = `${gapPx}px`;
    (el.style as any).columnGap = `${gapPx}px`;
  } else {
    (el.style as any).rowGap = '';
    (el.style as any).columnGap = '';
  }
  // anchor에 따라 그리드 정렬
  const anchor = (layout?.anchor as Anchor) || defaultAnchor;
  const hmap: Record<string, string> = {
    tl: 'start',
    tc: 'center',
    tr: 'end',
    cl: 'start',
    cc: 'center',
    cr: 'end',
    bl: 'start',
    bc: 'center',
    br: 'end',
  };
  (el.style as any).justifyItems = hmap[anchor] || 'center';
}

/**
 * Apply children layout to element (for group elements)
 * This allows groups to control how their children are arranged independently of their own positioning
 */
export function applyChildrenLayout(
  el: HTMLElement,
  childrenLayout: NonNullable<Layout['childrenLayout']>
): void {
  // Persist layout spec on the element for later refresh after mutations
  try { (el as any).__mtxChildrenLayout = childrenLayout; } catch { /* noop */ }
  const cw: any = childrenLayout as any;
  const {
    mode = 'flow',
    direction = 'horizontal',
    gap = 0,
    align = 'center',
    justify = 'center',
  } = childrenLayout;
  const wrap = cw?.wrap ?? (direction === 'horizontal');

  switch (mode) {
    case 'flow': {
      // Set up flexbox for children
      el.style.display = 'flex';
      el.style.flexDirection = direction === 'horizontal' ? 'row' : 'column';
      el.style.flexWrap = wrap && direction === 'horizontal' ? 'wrap' : 'nowrap';

      // Alignment
      const alignItems =
        align === 'start'
          ? 'flex-start'
          : align === 'end'
            ? 'flex-end'
            : 'center';
      const justifyContent =
        justify === 'start'
          ? 'flex-start'
          : justify === 'end'
            ? 'flex-end'
            : justify === 'space-between'
              ? 'space-between'
              : 'center';

      el.style.alignItems = alignItems;
      el.style.justifyContent = justifyContent;

      // Gap: apply per-child right margin for robust spacing and proper wrapping
      if (gap && el.parentElement) {
        const containerSize =
          direction === 'horizontal'
            ? el.parentElement.clientWidth || 0
            : el.parentElement.clientHeight || 0;
        const gapPx = Math.round(containerSize * gap);
        const gapProp = direction === 'horizontal' ? 'columnGap' : 'rowGap';
        // Clear native gap to prevent double spacing when margins are applied
        (el.style as any)[gapProp] = '';

        // Additionally, enforce fixed spacing using margins so visual space stays uniform
        const children = Array.from(el.children) as HTMLElement[];
        for (let i = 0; i < children.length; i++) {
          const c = children[i];
          // Normalize spacing-related properties to avoid inherited CSS affecting layout
          c.style.padding = '0px';
          c.style.flex = '0 0 auto';
          if (direction === 'horizontal') {
            c.style.marginLeft = '0px';
            c.style.marginRight = `${gapPx}px`;
            c.style.marginTop = '';
          } else {
            c.style.marginTop = i === 0 ? '0' : `${gapPx}px`;
            c.style.marginLeft = '';
            c.style.marginRight = '';
          }
        }
      }
      break;
    }

    case 'grid': {
      el.style.display = 'grid';
      el.style.gridTemplateColumns = 'repeat(auto-fit, minmax(0, 1fr))';

      if (gap && el.parentElement) {
        const containerSize = el.parentElement.clientHeight || 0;
        const gapPx = Math.round(containerSize * gap);
        (el.style as any).rowGap = `${gapPx}px`;
        (el.style as any).columnGap = `${gapPx}px`;
      }
      break;
    }

    case 'stack':
    default:
      // Stack children on top of each other (default behavior)
      // No special CSS needed, children will use their own positioning
      break;
  }
}
