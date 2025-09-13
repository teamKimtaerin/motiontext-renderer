// Default layout constraints for different track types
// Flutter-like constraint system implementation

import type { LayoutConstraints } from '../types/layout';
import type { TrackType } from '../types/scenario-v2';

/**
 * Get default layout constraints for a track type
 */
export function getDefaultTrackConstraints(trackType: TrackType): LayoutConstraints {
  switch (trackType) {
    case 'subtitle':
      return {
        mode: 'flow',
        direction: 'vertical',
        maxWidth: 0.8, // 80% of stage width
        maxHeight: 0.4, // 40% of stage height
        minWidth: 0.1,
        minHeight: 0.05,
        gap: 0.02, // 2% gap between subtitle lines
        padding: { x: 0.02, y: 0.015 }, // internal padding
        anchor: 'bc', // bottom-center default for subtitles
        constraintMode: 'flexible', // allow some flexibility
        breakoutEnabled: false, // subtitles shouldn't escape bounds
        safeArea: { bottom: 0.1, left: 0.05, right: 0.05 } // safe area for subtitles
      };
      
    case 'free':
      return {
        mode: 'absolute',
        direction: 'vertical',
        maxWidth: 1.0, // full stage width
        maxHeight: 1.0, // full stage height
        minWidth: 0,
        minHeight: 0,
        gap: 0,
        padding: { x: 0, y: 0 },
        anchor: 'cc', // center-center default for free elements
        constraintMode: 'breakout', // allow breaking constraints
        breakoutEnabled: true, // free elements can escape via portal
        safeArea: undefined // no safe area restrictions
      };
      
    default:
      // Fallback to free track constraints
      return getDefaultTrackConstraints('free');
  }
}

/**
 * Merge parent constraints with child constraints
 * Child constraints override parent constraints where specified
 */
export function mergeConstraints(
  parentConstraints?: LayoutConstraints,
  childConstraints?: LayoutConstraints
): LayoutConstraints {
  if (!parentConstraints && !childConstraints) {
    return getDefaultTrackConstraints('free');
  }
  
  if (!parentConstraints) {
    return { ...childConstraints! };
  }
  
  if (!childConstraints) {
    return { ...parentConstraints };
  }
  
  // Child overrides parent
  return {
    mode: childConstraints.mode ?? parentConstraints.mode,
    direction: childConstraints.direction ?? parentConstraints.direction,
    maxWidth: childConstraints.maxWidth ?? parentConstraints.maxWidth,
    maxHeight: childConstraints.maxHeight ?? parentConstraints.maxHeight,
    minWidth: childConstraints.minWidth ?? parentConstraints.minWidth,
    minHeight: childConstraints.minHeight ?? parentConstraints.minHeight,
    gap: childConstraints.gap ?? parentConstraints.gap,
    padding: childConstraints.padding ?? parentConstraints.padding,
    anchor: childConstraints.anchor ?? parentConstraints.anchor,
    constraintMode: childConstraints.constraintMode ?? parentConstraints.constraintMode,
    breakoutEnabled: childConstraints.breakoutEnabled ?? parentConstraints.breakoutEnabled,
    safeArea: childConstraints.safeArea ?? parentConstraints.safeArea
  };
}

/**
 * Check if a layout should break out of parent constraints
 */
export function shouldBreakout(
  constraints: LayoutConstraints,
  hasEffectScope: boolean
): boolean {
  return (
    constraints.constraintMode === 'breakout' ||
    (constraints.breakoutEnabled && hasEffectScope)
  );
}

/**
 * Calculate effective constraints considering parent limits
 */
export function calculateEffectiveConstraints(
  parentConstraints: LayoutConstraints,
  childConstraints: LayoutConstraints
): LayoutConstraints {
  const merged = mergeConstraints(parentConstraints, childConstraints);
  
  // If parent is strict, child cannot exceed parent limits
  if (parentConstraints.constraintMode === 'strict') {
    return {
      ...merged,
      maxWidth: Math.min(merged.maxWidth ?? 1, parentConstraints.maxWidth ?? 1),
      maxHeight: Math.min(merged.maxHeight ?? 1, parentConstraints.maxHeight ?? 1),
      constraintMode: 'strict' // inherit strict mode
    };
  }
  
  return merged;
}