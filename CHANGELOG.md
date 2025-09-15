# motiontext-renderer

## 1.1.1

### Patch Changes

- Fix: Apply box-related CSS properties only to group elements
  - Added support for backgroundColor, padding, borderRadius and other CSS properties on group nodes
  - Box styles (boxStyle) now apply only to group containers, not inherited by children
  - Added camelCase to kebab-case converter for CSS property names
  - Prevents each text element from having individual boxes when boxStyle is defined on parent group
