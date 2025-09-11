import { describe, it, expect } from 'vitest';
import { parseScenario } from '../ScenarioParser';

describe('M3: ScenarioParser', () => {
  describe('parseScenario - Basic Structure', () => {
    it('should parse minimal valid scenario', () => {
      const input = {
        version: '1.3',
        tracks: [{ id: 'main', layer: 0 }],
        cues: [],
      };

      const result = parseScenario(input);

      expect(result.version).toBe('1.3');
      expect(result.timebase.unit).toBe('seconds');
      expect(result.stage.baseAspect).toBe('16:9');
      expect(result.tracks).toHaveLength(1);
      expect(result.cues).toHaveLength(0);
    });

    it('should handle complete scenario with all fields', () => {
      const input = {
        version: '1.3',
        timebase: { unit: 'tc', fps: 30 },
        stage: { baseAspect: '9:16', safeArea: { top: 0.1, bottom: 0.1 } },
        tracks: [
          {
            id: 'subtitle',
            type: 'subtitle',
            layer: 0,
            scaleMode: 'scaleWithVideo',
            overlapPolicy: 'push',
            defaultStyle: { fontSize: '16px' },
          },
        ],
        cues: [
          {
            id: 'cue1',
            track: 'subtitle',
            hintTime: { start: 0, end: 5 },
            root: {
              e_type: 'group',
              children: [
                { e_type: 'text', text: 'Hello', absStart: 0, absEnd: 2 },
              ],
            },
          },
        ],
      };

      const result = parseScenario(input);

      expect(result.timebase.unit).toBe('tc');
      expect(result.timebase.fps).toBe(30);
      expect(result.stage.baseAspect).toBe('9:16');
      expect(result.tracks[0].scaleMode).toBe('scaleWithVideo');
      expect(result.cues[0].hintTime).toEqual({ start: 0, end: 5 });
    });

    it('should apply default values when fields are missing', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [],
      };

      const result = parseScenario(input);

      expect(result.version).toBe('1.3');
      expect(result.timebase).toEqual({ unit: 'seconds', fps: undefined });
      expect(result.stage).toEqual({ baseAspect: '16:9', safeArea: undefined });
      expect(result.tracks[0].type).toBe('subtitle');
    });
  });

  describe('parseScenario - Version Validation', () => {
    it('should accept supported versions', () => {
      const input = {
        version: '1.3',
        tracks: [{ id: 'main', layer: 0 }],
        cues: [],
      };

      expect(() => parseScenario(input)).not.toThrow();
    });

    it('should reject unsupported versions', () => {
      const input = {
        version: '2.0',
        tracks: [{ id: 'main', layer: 0 }],
        cues: [],
      };

      expect(() => parseScenario(input)).toThrow('unsupported version: 2.0');
    });
  });

  describe('parseScenario - Timebase Validation', () => {
    it('should accept valid timebase units', () => {
      const seconds = {
        timebase: { unit: 'seconds' },
        tracks: [{ id: 'main', layer: 0 }],
        cues: [],
      };

      const tc = {
        timebase: { unit: 'tc', fps: 24 },
        tracks: [{ id: 'main', layer: 0 }],
        cues: [],
      };

      expect(() => parseScenario(seconds)).not.toThrow();
      expect(() => parseScenario(tc)).not.toThrow();
    });

    it('should reject invalid timebase units', () => {
      const input = {
        timebase: { unit: 'frames' },
        tracks: [{ id: 'main', layer: 0 }],
        cues: [],
      };

      expect(() => parseScenario(input)).toThrow("must be 'seconds' or 'tc'");
    });

    it('should handle numeric string fps conversion', () => {
      const input = {
        timebase: { unit: 'tc', fps: '29.97' },
        tracks: [{ id: 'main', layer: 0 }],
        cues: [],
      };

      const result = parseScenario(input);
      expect(result.timebase.fps).toBe(29.97);
    });
  });

  describe('parseScenario - Stage Validation', () => {
    it('should accept valid aspect ratios', () => {
      const aspects = ['16:9', '9:16', 'auto'];

      aspects.forEach((aspect) => {
        const input = {
          stage: { baseAspect: aspect },
          tracks: [{ id: 'main', layer: 0 }],
          cues: [],
        };

        const result = parseScenario(input);
        expect(result.stage.baseAspect).toBe(aspect);
      });
    });

    it('should reject invalid aspect ratios', () => {
      const input = {
        stage: { baseAspect: '4:3' },
        tracks: [{ id: 'main', layer: 0 }],
        cues: [],
      };

      expect(() => parseScenario(input)).toThrow(
        "must be '16:9'|'9:16'|'auto'"
      );
    });
  });

  describe('parseScenario - Track Validation', () => {
    it('should require tracks array', () => {
      const input = {
        version: '1.3',
        cues: [],
      };

      expect(() => parseScenario(input)).toThrow(
        'tracks: must be a non-empty array'
      );
    });

    it('should reject empty tracks array', () => {
      const input = {
        tracks: [],
        cues: [],
      };

      expect(() => parseScenario(input)).toThrow(
        'tracks: must be a non-empty array'
      );
    });

    it('should validate track fields', () => {
      const input = {
        tracks: [
          { id: 'track1', type: 'subtitle', layer: 0 },
          { id: 'track2', type: 'free', layer: 1 },
        ],
        cues: [],
      };

      const result = parseScenario(input);
      expect(result.tracks).toHaveLength(2);
      expect(result.tracks[0].type).toBe('subtitle');
      expect(result.tracks[1].type).toBe('free');
    });

    it('should reject duplicate track IDs', () => {
      const input = {
        tracks: [
          { id: 'same', layer: 0 },
          { id: 'same', layer: 1 },
        ],
        cues: [],
      };

      expect(() => parseScenario(input)).toThrow("duplicate 'same'");
    });

    it('should reject invalid track types', () => {
      const input = {
        tracks: [{ id: 'main', type: 'overlay', layer: 0 }],
        cues: [],
      };

      expect(() => parseScenario(input)).toThrow('subtitle|free');
    });

    it('should validate scale modes', () => {
      const validModes = ['scaleWithVideo', 'fixedPoint', 'cap'];

      validModes.forEach((mode) => {
        const input = {
          tracks: [{ id: 'main', layer: 0, scaleMode: mode }],
          cues: [],
        };

        const result = parseScenario(input);
        expect(result.tracks[0].scaleMode).toBe(mode);
      });

      const invalid = {
        tracks: [{ id: 'main', layer: 0, scaleMode: 'stretch' }],
        cues: [],
      };

      expect(() => parseScenario(invalid)).toThrow('scaleMode');
    });

    it('should validate overlap policies', () => {
      const validPolicies = ['ignore', 'push', 'stack'];

      validPolicies.forEach((policy) => {
        const input = {
          tracks: [{ id: 'main', layer: 0, overlapPolicy: policy }],
          cues: [],
        };

        const result = parseScenario(input);
        expect(result.tracks[0].overlapPolicy).toBe(policy);
      });

      const invalid = {
        tracks: [{ id: 'main', layer: 0, overlapPolicy: 'merge' }],
        cues: [],
      };

      expect(() => parseScenario(invalid)).toThrow('overlapPolicy');
    });
  });

  describe('parseScenario - Cue Processing', () => {
    it('should generate default cue IDs', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          { track: 'main', root: { e_type: 'group', children: [] } },
          { track: 'main', root: { e_type: 'group', children: [] } },
        ],
      };

      const result = parseScenario(input);
      expect(result.cues[0].id).toBe('cue-1');
      expect(result.cues[1].id).toBe('cue-2');
    });

    it('should validate track references', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          { track: 'nonexistent', root: { e_type: 'group', children: [] } },
        ],
      };

      expect(() => parseScenario(input)).toThrow("unknown track 'nonexistent'");
    });

    it('should use first track as default', () => {
      const input = {
        tracks: [
          { id: 'track1', layer: 0 },
          { id: 'track2', layer: 1 },
        ],
        cues: [{ root: { e_type: 'group', children: [] } }],
      };

      const result = parseScenario(input);
      expect(result.cues[0].track).toBe('track1');
    });

    it('should process hintTime correctly', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            hintTime: { start: '1.5', end: '3.5' },
            root: { e_type: 'group', children: [] },
          },
        ],
      };

      const result = parseScenario(input);
      expect(result.cues[0].hintTime).toEqual({ start: 1.5, end: 3.5 });
    });
  });

  describe('parseScenario - Node Processing', () => {
    it('should process text nodes with all fields', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              children: [
                {
                  e_type: 'text',
                  text: 'Test',
                  absStart: 0,
                  absEnd: 2,
                  style: { color: 'red' },
                  layout: { position: [0.5, 0.5] },
                },
              ],
            },
          },
        ],
      };

      const result = parseScenario(input);
      const textNode = result.cues[0].root.children[0];

      expect(textNode.e_type).toBe('text');
      expect(textNode.text).toBe('Test');
      expect(textNode.absStart).toBe(0);
      expect(textNode.absEnd).toBe(2);
    });

    it('should handle legacy field aliases', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              type: 'group', // legacy alias for e_type
              children: [
                {
                  type: 'text', // legacy alias for e_type
                  content: 'Legacy', // legacy alias for text
                },
              ],
            },
          },
        ],
      };

      const result = parseScenario(input);
      const textNode = result.cues[0].root.children[0];

      expect(textNode.e_type).toBe('text');
      expect(textNode.text).toBe('Legacy');
    });

    it('should validate time ranges', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              children: [
                {
                  e_type: 'text',
                  text: 'Test',
                  absStart: 5,
                  absEnd: 2, // Invalid: end before start
                },
              ],
            },
          },
        ],
      };

      expect(() => parseScenario(input)).toThrow('must be > absStart');
    });

    it('should process image nodes', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              children: [
                {
                  e_type: 'image',
                  src: 'image.png',
                  alt: 'Test image',
                  absStart: 0,
                  absEnd: 5,
                },
              ],
            },
          },
        ],
      };

      const result = parseScenario(input);
      const imageNode = result.cues[0].root.children[0];

      expect(imageNode.e_type).toBe('image');
      expect(imageNode.src).toBe('image.png');
      expect(imageNode.alt).toBe('Test image');
    });

    it('should require src for image nodes', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              children: [{ e_type: 'image' }],
            },
          },
        ],
      };

      expect(() => parseScenario(input)).toThrow('image.src required');
    });

    it('should process video nodes', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              children: [
                {
                  e_type: 'video',
                  src: 'video.mp4',
                  mute: true,
                  loop: false,
                  absStart: 0,
                  absEnd: 10,
                },
              ],
            },
          },
        ],
      };

      const result = parseScenario(input);
      const videoNode = result.cues[0].root.children[0];

      expect(videoNode.e_type).toBe('video');
      expect(videoNode.src).toBe('video.mp4');
      expect(videoNode.mute).toBe(true);
      expect(videoNode.loop).toBe(false);
    });

    it('should handle nested group nodes', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              name: 'outer',
              children: [
                {
                  e_type: 'group',
                  name: 'inner',
                  children: [
                    {
                      e_type: 'text',
                      text: 'Nested',
                    },
                  ],
                },
              ],
            },
          },
        ],
      };

      const result = parseScenario(input);
      const outerGroup = result.cues[0].root;
      const innerGroup = outerGroup.children[0];
      const textNode = innerGroup.children[0];

      expect(outerGroup.name).toBe('outer');
      expect(innerGroup.name).toBe('inner');
      expect(textNode.text).toBe('Nested');
    });

    it('should reject unsupported node types', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              children: [{ e_type: 'audio' }],
            },
          },
        ],
      };

      expect(() => parseScenario(input)).toThrow(
        'unsupported node type: audio'
      );
    });
  });

  describe('parseScenario - Layout Processing', () => {
    it('should normalize position array to object', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              layout: { position: [0.5, 0.8] },
              children: [],
            },
          },
        ],
      };

      const result = parseScenario(input);
      expect(result.cues[0].root.layout.position).toEqual({ x: 0.5, y: 0.8 });
    });

    it('should accept position object format', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              layout: { position: { x: 0.5, y: 0.8 } },
              children: [],
            },
          },
        ],
      };

      const result = parseScenario(input);
      expect(result.cues[0].root.layout.position).toEqual({ x: 0.5, y: 0.8 });
    });

    it('should validate position numbers', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              layout: { position: ['invalid', 0.5] },
              children: [],
            },
          },
        ],
      };

      expect(() => parseScenario(input)).toThrow('must be numbers');
    });

    it('should preserve all layout fields', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              layout: {
                mode: 'absolute',
                anchor: 'center',
                position: [0.5, 0.5],
                size: { width: 100, height: 50 },
                padding: 10,
                transform: 'rotate(45deg)',
                transformOrigin: 'center',
                zIndex: 10,
                overflow: 'hidden',
                safeAreaClamp: true,
                override: { mobile: {} },
              },
              children: [],
            },
          },
        ],
      };

      const result = parseScenario(input);
      const layout = result.cues[0].root.layout;

      expect(layout.mode).toBe('absolute');
      expect(layout.anchor).toBe('center');
      expect(layout.size).toEqual({ width: 100, height: 50 });
      expect(layout.zIndex).toBe(10);
      expect(layout.safeAreaClamp).toBe(true);
    });

    it('should convert string numbers in position', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              layout: { position: ['0.5', '0.8'] },
              children: [],
            },
          },
        ],
      };

      const result = parseScenario(input);
      expect(result.cues[0].root.layout.position).toEqual({ x: 0.5, y: 0.8 });
    });
  });

  describe('parseScenario - Plugin Processing', () => {
    it('should process single plugin spec', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              children: [
                {
                  e_type: 'text',
                  text: 'Test',
                  plugin: {
                    name: 'fade',
                    params: { duration: 1 },
                    relStart: 0,
                    relEnd: -0.5,
                    compose: 'add',
                  },
                },
              ],
            },
          },
        ],
      };

      const result = parseScenario(input);
      const plugin = result.cues[0].root.children[0].plugin;

      expect(plugin.name).toBe('fade');
      expect(plugin.params).toEqual({ duration: 1 });
      expect(plugin.relStart).toBe(0);
      expect(plugin.relEnd).toBe(-0.5);
      expect(plugin.compose).toBe('add');
    });

    it('should process plugin chain', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              children: [
                {
                  e_type: 'text',
                  text: 'Test',
                  pluginChain: [
                    { name: 'fade', relStartPct: 0, relEndPct: 0.2 },
                    { name: 'slide', relStartPct: 0.1, relEndPct: 0.3 },
                  ],
                },
              ],
            },
          },
        ],
      };

      const result = parseScenario(input);
      const chain = result.cues[0].root.children[0].pluginChain;

      expect(chain).toHaveLength(2);
      expect(chain[0].name).toBe('fade');
      expect(chain[1].name).toBe('slide');
    });

    it('should validate plugin name', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              children: [
                {
                  e_type: 'text',
                  text: 'Test',
                  plugin: { params: {} },
                },
              ],
            },
          },
        ],
      };

      expect(() => parseScenario(input)).toThrow('missing name');
    });

    it('should validate percentage ranges', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              children: [
                {
                  e_type: 'text',
                  text: 'Test',
                  plugin: { name: 'fade', relStartPct: 1.5 },
                },
              ],
            },
          },
        ],
      };

      expect(() => parseScenario(input)).toThrow('0..1');
    });

    it('should validate compose modes', () => {
      const validModes = ['add', 'multiply', 'replace'];

      validModes.forEach((mode) => {
        const input = {
          tracks: [{ id: 'main', layer: 0 }],
          cues: [
            {
              track: 'main',
              root: {
                e_type: 'group',
                children: [
                  {
                    e_type: 'text',
                    text: 'Test',
                    plugin: { name: 'fade', compose: mode },
                  },
                ],
              },
            },
          ],
        };

        const result = parseScenario(input);
        expect(result.cues[0].root.children[0].plugin.compose).toBe(mode);
      });

      const invalid = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              children: [
                {
                  e_type: 'text',
                  text: 'Test',
                  plugin: { name: 'fade', compose: 'overlay' },
                },
              ],
            },
          },
        ],
      };

      expect(() => parseScenario(invalid)).toThrow(
        'must be add|multiply|replace'
      );
    });
  });

  describe('parseScenario - EffectScope Processing', () => {
    it('should process breakout configuration', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              children: [
                {
                  e_type: 'text',
                  text: 'Test',
                  effectScope: {
                    breakout: {
                      mode: 'portal',
                      toLayer: 10,
                      coordSpace: 'stage',
                      zLift: 100,
                      clampStage: true,
                      return: 'end',
                      transfer: ['opacity'],
                    },
                  },
                },
              ],
            },
          },
        ],
      };

      const result = parseScenario(input);
      const effectScope = result.cues[0].root.children[0].effectScope;

      expect(effectScope.breakout.mode).toBe('portal');
      expect(effectScope.breakout.toLayer).toBe(10);
      expect(effectScope.breakout.clampStage).toBe(true);
    });

    it('should validate breakout modes', () => {
      const validModes = ['portal', 'lift'];

      validModes.forEach((mode) => {
        const input = {
          tracks: [{ id: 'main', layer: 0 }],
          cues: [
            {
              track: 'main',
              root: {
                e_type: 'group',
                children: [
                  {
                    e_type: 'text',
                    text: 'Test',
                    effectScope: { breakout: { mode } },
                  },
                ],
              },
            },
          ],
        };

        const result = parseScenario(input);
        expect(result.cues[0].root.children[0].effectScope.breakout.mode).toBe(
          mode
        );
      });

      const invalid = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              children: [
                {
                  e_type: 'text',
                  text: 'Test',
                  effectScope: { breakout: { mode: 'teleport' } },
                },
              ],
            },
          },
        ],
      };

      expect(() => parseScenario(invalid)).toThrow('portal|lift');
    });

    it('should convert string numbers in breakout', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              children: [
                {
                  e_type: 'text',
                  text: 'Test',
                  effectScope: {
                    breakout: { toLayer: '5', zLift: '50' },
                  },
                },
              ],
            },
          },
        ],
      };

      const result = parseScenario(input);
      const breakout = result.cues[0].root.children[0].effectScope.breakout;

      expect(breakout.toLayer).toBe(5);
      expect(breakout.zLift).toBe(50);
    });
  });

  describe('parseScenario - Optional Fields', () => {
    it('should pass through bindings', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [],
        bindings: [{ key: 'value' }],
      };

      const result = parseScenario(input);
      expect(result.bindings).toEqual([{ key: 'value' }]);
    });

    it('should pass through wordStream', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [],
        wordStream: { words: [], timings: [] },
      };

      const result = parseScenario(input);
      expect(result.wordStream).toEqual({ words: [], timings: [] });
    });
  });

  describe('parseScenario - Error Messages', () => {
    it('should provide path-specific error messages', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              children: [
                {
                  e_type: 'text',
                  text: 'Test',
                  layout: { position: ['not', 'numbers'] },
                },
              ],
            },
          },
        ],
      };

      expect(() => parseScenario(input)).toThrow(
        'scenario.cues[0].root.children[0].layout.position: must be numbers'
      );
    });

    it('should handle deeply nested errors', () => {
      const input = {
        tracks: [{ id: 'main', layer: 0 }],
        cues: [
          {
            track: 'main',
            root: {
              e_type: 'group',
              children: [
                {
                  e_type: 'group',
                  children: [
                    {
                      e_type: 'text',
                      pluginChain: [
                        { name: 'valid' },
                        { name: 'invalid', relStartPct: 2 },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      };

      expect(() => parseScenario(input)).toThrow(
        'scenario.cues[0].root.children[0].children[0].pluginChain[1].relStartPct: 0..1'
      );
    });
  });
});
