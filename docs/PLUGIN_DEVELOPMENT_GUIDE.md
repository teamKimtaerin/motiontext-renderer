# Plugin Development Guide

This guide describes how to develop plugins for MotionText Renderer v2.0.

## Plugin Export Structure (REQUIRED)

**All plugins MUST use named exports.** Default exports are not supported.

### ✅ Correct Plugin Structure

```javascript
export const name = 'my-plugin';
export const version = '2.0.0';

export function init(el, options, ctx) {
  // Initialize plugin (optional)
}

export function animate(el, options, ctx, duration) {
  // Return progress function or GSAP timeline
}

export function cleanup(el) {
  // Cleanup resources (optional)
}

export function evalChannels(spec, progress, ctx) {
  // Return channels for channel-based plugins (optional)
}
```

### ❌ Incorrect Plugin Structure (Not Supported)

```javascript
// DO NOT USE DEFAULT EXPORTS - These will not work
export default {
  name: 'my-plugin',
  version: '1.0.0',
  init(el, options, ctx) { ... },
  animate(el, options, ctx, duration) { ... }
};
```

## Plugin Types

### 1. DOM-based Plugins (Plugin API v2.1)

These plugins manipulate DOM elements directly and must implement the `animate` function:

```javascript
export const name = 'dom-plugin';
export const version = '2.0.0';

export function init(el, options, ctx) {
  // Setup DOM structure, split text into spans, etc.
  // el is the effectsRoot container
}

export function animate(el, options, ctx, duration) {
  // Return a seek function that accepts progress (0-1)
  return (progress) => {
    // Apply animations based on progress
    el.style.transform = `scale(${1 + progress * 0.5})`;
  };
}

export function cleanup(el) {
  // Clean up DOM, kill GSAP tweens, restore original text
  if (el && window.gsap) {
    window.gsap.killTweensOf(el.querySelectorAll('*'));
  }
}
```

### 2. Channel-based Plugins (Plugin API v3.0)

These plugins return channel values that are applied via CSS variables:

```javascript
export const name = 'channel-plugin';
export const version = '2.0.0';

export function evalChannels(spec, progress, ctx) {
  // Return channels object with numeric values
  return {
    tx: progress * 100,        // translateX
    ty: Math.sin(progress * Math.PI) * 20, // translateY
    sx: 1 + progress * 0.5,    // scaleX
    sy: 1 + progress * 0.5,    // scaleY
    rot: progress * 360,       // rotation in degrees
    opacity: progress          // opacity (0-1)
  };
}
```

## Plugin Context

The `ctx` parameter provides access to:

```javascript
{
  gsap: window.gsap,           // GSAP instance
  video: HTMLVideoElement,     // Video element
  stage: StageConfig,          // Stage configuration
  // Note: scenario.define and resolveDefine are NOT available
  // Define references are pre-resolved by the renderer
}
```

## Plugin Options

The `options` parameter contains the plugin parameters with all Define references pre-resolved:

```javascript
// Scenario JSON
{
  "pluginChain": [{
    "name": "my-plugin",
    "params": {
      "color": "define.colors.primary",  // This define reference...
      "scale": 1.5
    }
  }]
}

// options received by plugin (Define already resolved)
{
  color: "#FF0000",  // ...becomes the actual value
  scale: 1.5
}
```

## Required Exports

### Mandatory
- `name`: String identifier for the plugin
- `version`: Semantic version string
- At least one of: `animate` (DOM plugins) or `evalChannels` (channel plugins)

### Optional
- `init`: Setup function called once when plugin is first used
- `cleanup`: Cleanup function for resource management

## Plugin Manifest

Create a `manifest.json` alongside your `index.mjs`:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "type": "dom",
  "entry": "index.mjs",
  "pluginApi": "v3.0",
  "targets": ["web"],
  "capabilities": ["dom", "channels"],
  "peer": {
    "gsap": "^3.0.0"
  }
}
```

## DOM Structure

The renderer provides a dual-container structure:

```html
<div class="baseWrapper">        <!-- Renderer-controlled (layout, positioning) -->
  <div data-mtx-effects-root>    <!-- Plugin-controlled (effects, animations) -->
    <!-- Your plugin content goes here -->
  </div>
</div>
```

- **baseWrapper**: Controlled by renderer for layout and positioning
- **effectsRoot**: Available for plugin DOM manipulations

## Best Practices

1. **Always use named exports** - Default exports will not be recognized
2. **Handle missing dependencies gracefully** - Check if GSAP is available before using
3. **Clean up resources** - Implement cleanup function to kill tweens and restore DOM
4. **Return consistent types** - animate should return a progress function or GSAP timeline
5. **Preserve existing DOM** - When modifying text, preserve effectsRoot structure
6. **Use semantic versioning** - Follow semver for version strings

## Plugin Type Declaration

### Manifest Type Field
Declare your plugin's type in manifest.json for performance optimization:

```json
{
  "name": "my-plugin",
  "type": "channel"  // 'channel' | 'dom' | 'hybrid'
}
```

### Plugin Types

#### Channel Plugins (`"type": "channel"`)
- **Best for**: Simple transformations (rotation, scale, position, opacity)
- **Functions**: Only `evalChannels`
- **Performance**: Fastest, minimal overhead
- **Example**: Spin, pulse, basic fade effects

```json
// manifest.json
{ "type": "channel" }
```

#### DOM Plugins (`"type": "dom"`)
- **Best for**: Complex text manipulation, visual effects requiring DOM changes
- **Functions**: `init`, `animate`, `cleanup`
- **Performance**: Moderate overhead for DOM operations
- **Example**: Typewriter, glitch, particle effects

```json
// manifest.json
{ "type": "dom" }
```

#### Hybrid Plugins (`"type": "hybrid"`)
- **Best for**: Advanced effects needing both CSS channels and DOM manipulation
- **Functions**: Both `evalChannels` AND `init`/`animate`/`cleanup`
- **Performance**: Higher overhead, use only when necessary
- **Example**: Complex particle systems with container transforms

```json
// manifest.json
{ "type": "hybrid" }
```

### Type Priority Order
1. **Scenario plugin.type** - Takes highest priority
2. **Manifest type field** - Used if scenario doesn't specify
3. **Auto-detection** - Fallback based on available functions

### Performance Benefits
- **Channel plugins**: Skip DOM container creation
- **DOM plugins**: Skip channel evaluation setup
- **Hybrid plugins**: Initialize both systems only when needed
- **Debugging**: Clear indication of plugin execution mode

## Testing Your Plugin

1. Place your plugin in `demo/plugin-server/plugins/plugin-name@version/`
2. Include both `index.mjs` and `manifest.json`
3. Test with the demo page at `http://localhost:3000`
4. Use the plugin preview feature to generate test scenarios

## Migration from Default Exports

If you have existing plugins using default exports, convert them using this pattern:

```javascript
// Old (default export)
export default {
  name: 'my-plugin',
  version: '1.0.0',
  init(el, opts, ctx) { ... },
  animate(el, opts, ctx, duration) { ... },
  cleanup(el) { ... }
};

// New (named exports)
export const name = 'my-plugin';
export const version = '2.0.0';

export function init(el, opts, ctx) { ... }

export function animate(el, opts, ctx, duration) { ... }

export function cleanup(el) { ... }
```

## Error Handling

Common plugin loading errors:

- **"Unknown plugin: plugin-name"**: Plugin not found in registry - check name and location
- **Plugin not recognized**: Likely using default export instead of named exports
- **"No animate function"**: DOM plugins must export an animate function
- **"No evalChannels function"**: Channel plugins must export an evalChannels function

---

For more examples, see the built-in plugins in `demo/plugin-server/plugins/`.