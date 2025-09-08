# @teamkimtaerin/motiontext-renderer

## 0.3.0

### Minor Changes

- feat(dev): add plugin origin init (M6.8), server/local/auto modes, and local file import path
  - configureDevPlugins({ mode, serverBase, localBase }) to configure plugin source
  - server mode: fetch manifest/entry from serverBase
  - local mode: import project‑bundled plugins via import.meta.glob (no dev plugin server required)
  - auto mode: server first, fallback to local on failure
  - preloadFromScenario updated to honor strict mode ordering
  - demo adds runtime mode switch example and UI buttons

  Notes:
  - This is a dev‑only improvement for plugin loading convenience; production secure loader remains planned (M7).

## 0.2.0

### Minor Changes

- 2f9059c: Initial release of MotionText Renderer
  - Complete M1-M4 implementation with TypeScript types, time utilities, parser, and plugin chain composition
  - 120 tests passing across all core modules
  - 8 demo samples showcasing features from basic text to complex animations
  - Custom YouTube-style UI controller
  - Plugin system with built-in effects (fadeIn/fadeOut/pop/waveY/shakeX)
  - Comprehensive JSON v1.3 spec support

## 0.1.0

### Minor Changes

- Add core renderer functionality with GSAP integration
