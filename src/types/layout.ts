// Types for layout, style, effect scope (breakout), per spec v1.3
// Reference: context/명령파일(JSON) 스펙 v1 3.md

export type LayoutMode = 'flow' | 'grid' | 'absolute' | 'path' | 'polar';

export type Anchor =
  | 'tl'
  | 'tc'
  | 'tr'
  | 'cl'
  | 'cc'
  | 'cr'
  | 'bl'
  | 'bc'
  | 'br';

export interface Vec2Rel {
  x?: number; // normalized 0..1 unless otherwise noted
  y?: number;
}

export interface SizeRel {
  width?: number | 'auto';
  height?: number | 'auto';
}

export interface TransformSpec {
  translate?: Vec2Rel; // normalized offset
  rotate?: { deg: number };
  scale?: { x?: number; y?: number };
  skew?: { xDeg?: number; yDeg?: number };
}

export interface LayoutOverrideSpec {
  // When child escapes group rules
  mode: 'absolute';
  offset?: Vec2Rel;
  transform?: TransformSpec;
  keepUpright?: boolean; // text: keep upright relative to world axis
}

export interface Layout {
  mode?: LayoutMode; // default: flow (subtitle), free is usually absolute
  anchor?: Anchor;
  position?: Required<Vec2Rel>; // normalized 0..1 (stage-based)
  size?: SizeRel; // normalized, auto allowed
  padding?: Vec2Rel; // normalized
  gapRel?: number; // spacing for flow/grid
  transform?: TransformSpec;
  transformOrigin?: string; // e.g., "50% 50%"
  zIndex?: number;
  overflow?: 'clip' | 'visible'; // default clip (subtitle)
  safeAreaClamp?: boolean;
  override?: LayoutOverrideSpec;
}

export interface StyleStroke {
  widthRel: number;
  color: string;
}

export interface StyleBorder {
  widthRel: number;
  color: string;
  radiusRel?: number;
}

export interface Style {
  fontFamily?: string;
  fontWeight?: number | string;
  fontSizeRel?: number; // relative to stage dims
  lineHeight?: number;
  color?: string;
  textShadow?: string;
  boxBg?: string;
  stroke?: StyleStroke;
  border?: StyleBorder;
  align?: 'left' | 'center' | 'right';
  whiteSpace?: 'wrap' | 'nowrap';
}

export interface EffectScopeBreakout {
  mode: 'portal' | 'lift'; // preferred: portal (temporary reparent)
  toLayer?: number; // portal destination layer (z)
  coordSpace?: 'group' | 'stage'; // transform basis
  zLift?: number; // for lift mode
  clampStage?: boolean; // clamp to stage bounds
  return?: 'end' | 'manual'; // auto return at absEnd or manual
  transfer?: 'move' | 'clone'; // default move, clone = duplicate then effect
}

export interface EffectScope {
  breakout?: EffectScopeBreakout;
}

// ============================================================================
// Layout Constraints System (Flutter-like)
// ============================================================================

export type ConstraintMode = 'strict' | 'flexible' | 'breakout';
export type FlowDirection = 'vertical' | 'horizontal';

export interface LayoutConstraints {
  mode?: LayoutMode; // flow, grid, absolute
  direction?: FlowDirection; // for flow mode
  maxWidth?: number; // normalized (0-1)
  maxHeight?: number; // normalized (0-1)
  minWidth?: number; // normalized (0-1)  
  minHeight?: number; // normalized (0-1)
  gap?: number; // normalized gap for flow/grid
  padding?: Vec2Rel; // internal padding
  anchor?: Anchor; // default anchor for children
  constraintMode?: ConstraintMode; // how strict the constraints are
  breakoutEnabled?: boolean; // allow children to escape via portal
  safeArea?: { top?: number; bottom?: number; left?: number; right?: number };
}
