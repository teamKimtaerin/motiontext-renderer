import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DefaultScenarioInfo,
  DefaultAssetManager,
  createPluginContextV3,
  defaultUtils,
} from '../PluginContextV3';
import type { ScenarioFileV1_3 } from '../../types/scenario';

describe('DefaultScenarioInfo', () => {
  it('exposes scenario version', () => {
    const scenario = { version: '1.3' } as any;
    const info = new DefaultScenarioInfo(scenario);
    expect(info.version).toBe('1.3');
  });
});

describe('DefaultAssetManager', () => {
  let assetManager: DefaultAssetManager;

  beforeEach(() => {
    assetManager = new DefaultAssetManager('https://example.com/assets/');
  });

  describe('getUrl', () => {
    it('resolves relative URLs against base URL', () => {
      expect(assetManager.getUrl('image.png')).toBe('https://example.com/assets/image.png');
      expect(assetManager.getUrl('fonts/font.woff2')).toBe('https://example.com/assets/fonts/font.woff2');
    });

    it('handles absolute URLs', () => {
      expect(assetManager.getUrl('https://other.com/image.png')).toBe('https://other.com/image.png');
    });

    it('handles URLs starting with /', () => {
      expect(assetManager.getUrl('/absolute/path.png')).toBe('https://example.com/absolute/path.png');
    });
  });

  describe('font loading', () => {
    it('creates FontFace with correct parameters', async () => {
      // FontFace 모킹
      global.FontFace = vi.fn().mockImplementation(() => ({
        load: vi.fn().mockResolvedValue(undefined),
      }));
      
      // document.fonts 모킹 (전체 document를 대체하지 않음)
      Object.defineProperty(document as any, 'fonts', {
        value: { add: vi.fn() },
        configurable: true,
      });

      await assetManager.loadFont({
        family: 'CustomFont',
        src: 'custom-font.woff2',
        weight: 'bold',
        style: 'italic',
      });

      expect(global.FontFace).toHaveBeenCalledWith(
        'CustomFont',
        'url("https://example.com/assets/custom-font.woff2")',
        { weight: 'bold', style: 'italic' }
      );
    });

    it('uses default weight and style when not provided', async () => {
      global.FontFace = vi.fn().mockImplementation(() => ({
        load: vi.fn().mockResolvedValue(undefined),
      }));
      
      Object.defineProperty(document as any, 'fonts', {
        value: { add: vi.fn() },
        configurable: true,
      });

      await assetManager.loadFont({
        family: 'CustomFont',
        src: 'custom-font.woff2',
      });

      expect(global.FontFace).toHaveBeenCalledWith(
        'CustomFont',
        'url("https://example.com/assets/custom-font.woff2")',
        { weight: 'normal', style: 'normal' }
      );
    });
  });

  describe('image preloading', () => {
    it('preloads image successfully', async () => {
      // Image 모킹
      const mockImage = {
        addEventListener: vi.fn(),
        onload: null as any,
        onerror: null as any,
        src: '',
      };

      global.Image = vi.fn().mockImplementation(() => {
        const img = { ...mockImage };
        
        Object.defineProperty(img, 'src', {
          get() { return this._src; },
          set(value) {
            this._src = value;
            setTimeout(() => {
              if (this.onload) this.onload();
            }, 0);
          },
        });
        
        return img;
      });

      const img = await assetManager.preloadImage('test.png');
      expect(img.src).toBe('https://example.com/assets/test.png');
    });

    it('handles image load errors', async () => {
      const mockImage = {
        addEventListener: vi.fn(),
        onload: null as any,
        onerror: null as any,
        src: '',
      };

      global.Image = vi.fn().mockImplementation(() => {
        const img = { ...mockImage };
        
        Object.defineProperty(img, 'src', {
          get() { return this._src; },
          set(value) {
            this._src = value;
            // trigger error immediately to ensure rejection path
            if (this.onerror) this.onerror(new Error('mock error'));
          },
        });
        
        return img;
      });

      await expect(assetManager.preloadImage('nonexistent.png')).rejects.toBeDefined();
    });
  });

  describe('audio preloading', () => {
    it('preloads audio successfully', async () => {
      // Audio 모킹
      const mockAudio = {
        load: vi.fn(),
        oncanplaythrough: null as any,
        onerror: null as any,
        src: '',
      };

      global.Audio = vi.fn().mockImplementation(() => {
        const audio = { ...mockAudio };
        
        Object.defineProperty(audio, 'src', {
          get() { return this._src; },
          set(value) {
            this._src = value;
            setTimeout(() => {
              if (this.oncanplaythrough) this.oncanplaythrough();
            }, 0);
          },
        });
        
        return audio;
      });

      const audio = await assetManager.preloadAudio('test.mp3');
      expect(audio.src).toBe('https://example.com/assets/test.mp3');
    });
  });
});

describe('defaultUtils', () => {
  describe('interpolate', () => {
    it('interpolates numbers', () => {
      expect(defaultUtils.interpolate(0, 10, 0.5)).toBe(5);
      expect(defaultUtils.interpolate(10, 0, 0.25)).toBe(7.5);
      expect(defaultUtils.interpolate(-5, 5, 0.75)).toBe(2.5);
    });

    it('interpolates arrays', () => {
      const from = [0, 10];
      const to = [20, 30];
      const result = defaultUtils.interpolate(from, to, 0.5);
      
      expect(result).toEqual([10, 20]);
    });

    it('interpolates objects', () => {
      const from = { x: 0, y: 10 };
      const to = { x: 20, y: 30 };
      const result = defaultUtils.interpolate(from, to, 0.5);
      
      expect(result).toEqual({ x: 10, y: 20 });
    });

    it('uses threshold for non-numeric values', () => {
      expect(defaultUtils.interpolate('a', 'b', 0.3)).toBe('a');
      expect(defaultUtils.interpolate('a', 'b', 0.7)).toBe('b');
    });

    it('applies easing functions', () => {
      // easeIn 테스트 (t^2)
      const result = defaultUtils.interpolate(0, 10, 0.5, 'easeIn');
      expect(result).toBe(2.5); // 0 + (10-0) * (0.5^2)
    });
  });

  describe('easing functions', () => {
    it('linear easing', () => {
      expect(defaultUtils.easing.linear(0.5)).toBe(0.5);
    });

    it('easeIn easing', () => {
      expect(defaultUtils.easing.easeIn(0.5)).toBe(0.25);
    });

    it('easeOut easing', () => {
      expect(defaultUtils.easing.easeOut(0.5)).toBe(0.75);
    });

    it('easeInOut easing', () => {
      expect(defaultUtils.easing.easeInOut(0.25)).toBe(0.125); // 2 * 0.25^2
      expect(defaultUtils.easing.easeInOut(0.75)).toBe(0.875); // -1 + (4-2*0.75)*0.75
    });
  });

  describe('color utilities', () => {
    describe('parse', () => {
      it('parses hex colors', () => {
        expect(defaultUtils.color.parse('#ff0000')).toEqual({
          r: 255, g: 0, b: 0, a: 1
        });
        
        expect(defaultUtils.color.parse('#f00')).toEqual({
          r: 255, g: 0, b: 0, a: 1
        });
      });

      it('parses rgb colors', () => {
        expect(defaultUtils.color.parse('rgb(255, 128, 0)')).toEqual({
          r: 255, g: 128, b: 0, a: 1
        });
        
        expect(defaultUtils.color.parse('rgba(255, 128, 0, 0.5)')).toEqual({
          r: 255, g: 128, b: 0, a: 0.5
        });
      });

      it('returns null for invalid colors', () => {
        expect(defaultUtils.color.parse('invalid')).toBeNull();
      });
    });

    describe('format', () => {
      it('formats rgb when alpha is 1', () => {
        const result = defaultUtils.color.format({ r: 255, g: 128, b: 0, a: 1 });
        expect(result).toBe('rgb(255, 128, 0)');
      });

      it('formats rgba when alpha is not 1', () => {
        const result = defaultUtils.color.format({ r: 255, g: 128, b: 0, a: 0.5 });
        expect(result).toBe('rgba(255, 128, 0, 0.5)');
      });

      it('rounds color values', () => {
        const result = defaultUtils.color.format({ r: 255.7, g: 127.3, b: 0.8, a: 1 });
        expect(result).toBe('rgb(256, 127, 1)');
      });
    });

    describe('interpolate', () => {
      it('interpolates between valid colors', () => {
        const result = defaultUtils.color.interpolate('#ff0000', '#00ff00', 0.5);
        expect(result).toBe('rgb(128, 128, 0)');
      });

      it('uses threshold for invalid colors', () => {
        expect(defaultUtils.color.interpolate('invalid', '#ff0000', 0.3)).toBe('invalid');
        expect(defaultUtils.color.interpolate('invalid', '#ff0000', 0.7)).toBe('#ff0000');
      });
    });
  });
});

describe('createPluginContextV3', () => {
  let container: HTMLElement;
  let scenario: ScenarioFileV1_3;

  beforeEach(() => {
    // JSDOM 환경에서만 실행
    if (typeof document !== 'undefined') {
      container = document.createElement('div');
    }
    
    scenario = {
      version: '1.3',
      timebase: { unit: 'seconds', fps: 30 },
      stage: { baseAspect: '16:9' },
      tracks: [],
      cues: [],
    } as any;
  });

  it('creates complete plugin context', () => {
    const context = createPluginContextV3({
      container,
      scenario,
      baseUrl: 'https://example.com/',
      renderer: {
        version: '2.0.0',
        currentTime: 1.5,
        duration: 10,
        timeScale: 1,
        fps: 30,
      },
    });

    expect(context.container).toBe(container);
    expect(context.scenario).toBeInstanceOf(DefaultScenarioInfo);
    expect(context.assets).toBeInstanceOf(DefaultAssetManager);
    expect(context.renderer.version).toBe('2.0.0');
    expect(context.utils).toBe(defaultUtils);
  });

  it('includes optional systems when provided', () => {
    const mockChannels = {} as any;
    const mockPortal = {} as any;
    const mockAudio = {} as any;

    const context = createPluginContextV3({
      container,
      scenario,
      baseUrl: 'https://example.com/',
      renderer: {
        version: '2.0.0',
        currentTime: 0,
        duration: 0,
        timeScale: 1,
      },
      channels: mockChannels,
      portal: mockPortal,
      audio: mockAudio,
    });

    expect(context.channels).toBe(mockChannels);
    expect(context.portal).toBe(mockPortal);
    expect(context.audio).toBe(mockAudio);
  });

  it('includes peer dependencies', () => {
    const context = createPluginContextV3({
      container,
      scenario,
      baseUrl: 'https://example.com/',
      renderer: {
        version: '2.0.0',
        currentTime: 0,
        duration: 0,
        timeScale: 1,
      },
      peerDeps: {
        gsap: 'mock-gsap',
        lottie: 'mock-lottie',
      },
    });

    expect(context.gsap).toBe('mock-gsap');
    expect(context.lottie).toBe('mock-lottie');
  });

  it('includes onSeek callback when provided', () => {
    const mockOnSeek = vi.fn();

    const context = createPluginContextV3({
      container,
      scenario,
      baseUrl: 'https://example.com/',
      renderer: {
        version: '2.0.0',
        currentTime: 0,
        duration: 0,
        timeScale: 1,
      },
      onSeek: mockOnSeek,
    });

    expect(context.onSeek).toBe(mockOnSeek);
  });
});
