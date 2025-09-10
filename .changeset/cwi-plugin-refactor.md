---
"motiontext-renderer": patch
---

Add definitions section support and enhance CWI plugin system

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
  "cues": [{
    "pluginChain": [{
      "name": "cwi-color@1.0.0",
      "params": {
        "speaker": "SPEAKER_01",
        "palette": "definitions.speakerPalette"
      }
    }]
  }]
}
```