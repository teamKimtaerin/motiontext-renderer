# @teamkimtaerin/motiontext-renderer

## 0.3.2

### Patch Changes

- 079029b: Add definitions section support and enhance CWI plugin system

  ## Definitions Section Support
  - **NEW**: Added `definitions` field to Scenario JSON v1.3 spec
  - **NEW**: Runtime definitions resolution in renderer (`"definitions.key"` → actual value)
  - **Performance**: Enables significant file size reduction by eliminating data duplication
  - **Example**: `"palette": "definitions.speakerPalette"` resolves to actual palette object

  ## CWI Plugin Enhancement
  - **BREAKING**: Split monolithic `cwi@1.0.0` plugin into 4 focused plugins:
    - `cwi-color@1.0.0` - Color transition animation
    - `cwi-loud@1.0.0` - Large scale with trembling (2.4x + vibration)
    - `cwi-whisper@1.0.0` - Small scale animation (0.6x)
    - `cwi-bouncing@1.0.0` - Pop/bouncing wave animation (1.15x + vertical motion)
  - Enhanced palette resolution with multi-level fallback system
  - Improved Korean labels and descriptions in plugin manifests

  ## File Size Optimization
  - **Performance**: Reduced `cwi_demo_full.json` file size by ~75% (800KB → 206KB)
  - **Maintenance**: Centralized palette management - change colors in one place
  - **Scalability**: Definitions section supports any shared data, not just palettes

  ## Technical Implementation
  - Added `definitions?: Record<string, any>` to `ScenarioFileV1_3` type
  - Updated `ScenarioParser.ts` to handle definitions section
  - Enhanced `Renderer.ts` with `resolveDefinitions()` method for both `init` and `evalChannels` paths
  - Updated 360+ plugin instances in sample files to use definitions references

  ## Migration Guide

  ### For CWI Plugins

  ```json
  // Before
  { "name": "cwi", "kind": "color" }

  // After
  { "name": "cwi-color" }
  ```

  ### For Palette Configuration

  ```json
  {
    "definitions": {
      "speakerPalette": {
        "SPEAKER_01": "#4AA3FF",
        "SPEAKER_02": "#FF4D4D"
      }
    },
    "cues": [
      {
        "pluginChain": [
          {
            "name": "cwi-color@1.0.0",
            "params": {
              "speaker": "SPEAKER_01",
              "palette": "definitions.speakerPalette"
            }
          }
        ]
      }
    ]
  }
  ```

## 0.3.1

### Patch Changes

- 9c95552: chore(dev): add pnpm scripts for verify (lint/format/typecheck/test) and release:all (verify+build+publish) to streamline local/CI releases.

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
