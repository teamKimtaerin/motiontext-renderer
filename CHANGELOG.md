# motiontext-renderer

## 1.4.0

### Minor Changes

- Add clear() method for explicit scenario cleanup
  - Add `clear()` method to MotionTextRenderer public API for removing current scenario while keeping renderer alive
  - Add `clear()` method to RendererV2 internal API for comprehensive cleanup
  - Enables explicit scenario removal without requiring a new scenario load
  - Maintains renderer instance for reuse after clearing
  - Provides alternative to `dispose()` which terminates the entire renderer

## 1.3.1

### Patch Changes

- Fix style inheritance priority to respect node-specific styles over track defaults
  - Fixed mergeStyles() and mergeBoxStyles() functions to prioritize node-specific styles over track defaults
  - Node-specific styles now correctly override track defaultStyle/defaultBoxStyle
  - Resolves issue where group nodes' individual styles were ignored in favor of track defaults
  - Maintains backward compatibility with existing scenarios

  Fixes: Style inheritance priority not respecting the intended hierarchy in v2.0 scenarios

## 1.3.0

### Minor Changes

- a027c4c: feat: implement track-based boxStyle inheritance system
  - Split Style interface into TextStyle and BoxStyle for better separation of concerns
  - Add defaultBoxStyle to Track type for group node styling defaults
  - Implement boxStyle inheritance only for group nodes (text nodes inherit text styles only)
  - Add backward compatibility for legacy combined styles with automatic splitting
  - Update RendererV2 to use separate text and box style application functions
  - Add comprehensive test suite for boxStyle inheritance scenarios
  - Create demo sample showcasing boxStyle inheritance across multiple cues

  This enables track-level box styling management where group nodes inherit box styles from their track while text nodes only inherit text styles, allowing for consistent container styling with individual group customization when needed.

## 1.2.2

### Patch Changes

- fix: relative time offset calculation for plugin end boundaries
  - Fixed percentage-based time offset calculation when applied to end boundaries
  - Negative percentages on end boundaries now correctly shorten the window from the end
  - Example: base [2,4] with '-20%' offset now correctly calculates to 3.6 instead of wrong value
  - Added comprehensive test cases for edge cases in time offset calculations

## 1.2.1

### Patch Changes

- fix: demo plugin preview now reads timeOffset from manifest.json

  Demo plugin previews now use timeOffset values from manifest.json files instead of hardcoded ['0%', '100%']. Default fallback is now ['0%', '0%'] to match updated calculation base.
  - Updated generatePreviewScenario and generateLoopedScenario functions
  - Added timeOffset field to PluginManifest interface
  - Changed default timeOffset from ['0%', '100%'] to ['0%', '0%']

## 1.2.0

### Minor Changes

- # Plugin System Enhancement and Hybrid Plugin Architecture

  ## 🚀 New Features
  - **Hybrid Plugin Architecture**: Added support for hybrid plugins that combine DOM manipulation with channel-based effects
  - **Enhanced Plugin Composition**: Improved plugin chain composition with better timeOffset handling
  - **CWI Plugin Series Updates**: Major updates to cwi-bouncing, cwi-color, cwi-loud, and cwi-whisper plugins
  - **Plugin Standard Compliance**: Updated all plugins to follow MANIFEST_STANDARD.md specifications

  ## 🔧 Technical Improvements
  - **Channel-based Animation System**: Enhanced channel composer for better plugin effect merging
  - **CSS Variable Integration**: Plugins now use CSS variables for better transform composition
  - **Plugin Lifecycle Management**: Improved plugin initialization and cleanup processes
  - **Time Calculation Refinements**: Better timing formulas for plugin activation windows

  ## 🎨 Plugin Enhancements
  - **CWI Bouncing**: Converted to hybrid plugin with improved letter animation and CSS variable support
  - **CWI Color**: Enhanced color palette system with better speaker color mapping
  - **CWI Loud/Whisper**: Improved scaling and animation effects
  - **Spin Plugin**: Better rotation handling with standard channel keys (tx, ty, sx, sy)

  ## 📊 Demo Improvements
  - **New Sample Scenarios**: Added plugin_test_combined.json and cwi_sentence_wave.json
  - **Plugin Archives**: Organized v1.0.0 plugins into archived folder structure
  - **Enhanced Thumbnails**: Added SVG thumbnails for multiple plugins

  ## 🐛 Bug Fixes
  - Fixed plugin version exports consistency
  - Resolved transform inheritance conflicts between DOM and channel plugins
  - Improved plugin timing calculation accuracy
  - Fixed manifest form validation issues

  This update significantly enhances the plugin system architecture and provides better developer experience for creating animated text effects.

## 1.1.1

### Patch Changes

- Fix: Apply box-related CSS properties only to group elements
  - Added support for backgroundColor, padding, borderRadius and other CSS properties on group nodes
  - Box styles (boxStyle) now apply only to group containers, not inherited by children
  - Added camelCase to kebab-case converter for CSS property names
  - Prevents each text element from having individual boxes when boxStyle is defined on parent group
