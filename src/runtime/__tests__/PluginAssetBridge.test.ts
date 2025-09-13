import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PluginAssetManagerAdapter,
  PluginAudioSystem,
  PluginPortalSystem,
  createPluginAssetSystems,
} from '../PluginAssetBridge';
import { AssetManager } from '../../assets/AssetManager';

describe('PluginAssetManagerAdapter', () => {
  let coreAssetManager: AssetManager;
  let adapter: PluginAssetManagerAdapter;

  beforeEach(() => {
    coreAssetManager = new AssetManager();
    adapter = new PluginAssetManagerAdapter(
      coreAssetManager,
      'https://plugin.example.com/',
      ['asset-loading']
    );
  });

  describe('getUrl', () => {
    it('resolves URLs against plugin base URL', () => {
      expect(adapter.getUrl('asset.png')).toBe('https://plugin.example.com/asset.png');
      expect(adapter.getUrl('fonts/font.woff2')).toBe('https://plugin.example.com/fonts/font.woff2');
    });
  });

  describe('loadFont', () => {
    beforeEach(() => {
      global.FontFace = vi.fn().mockImplementation(() => ({
        load: vi.fn().mockResolvedValue(undefined),
      }));
      // Do not replace the whole document; just define fonts set
      Object.defineProperty(document as any, 'fonts', {
        value: { add: vi.fn() },
        configurable: true,
        writable: false,
      });
    });

    afterEach(() => {
      // cleanup mocked fonts
      try {
        // @ts-expect-error cleanup
        delete (document as any).fonts;
      } catch (_e) {
        void 0; // ignore cleanup errors in JSDOM
      }
    });

    it('loads font when asset-loading capability is present', async () => {
      await adapter.loadFont({
        family: 'PluginFont',
        src: 'plugin-font.woff2',
        weight: 'bold',
      });

      expect(global.FontFace).toHaveBeenCalledWith(
        'PluginFont',
        'url("https://plugin.example.com/plugin-font.woff2")',
        { weight: 'bold', style: 'normal' }
      );
      expect(global.document.fonts.add).toHaveBeenCalled();
    });

    it('throws error when asset-loading capability is missing', async () => {
      const adapterWithoutCapability = new PluginAssetManagerAdapter(
        coreAssetManager,
        'https://plugin.example.com/',
        []
      );

      await expect(adapterWithoutCapability.loadFont({
        family: 'PluginFont',
        src: 'plugin-font.woff2',
      })).rejects.toThrow('does not have asset-loading capability');
    });
  });

  describe('preloadImage', () => {
    beforeEach(() => {
      global.Image = vi.fn().mockImplementation(() => ({
        set src(value) {
          this._src = value;
          setTimeout(() => this.onload?.(), 0);
        },
        get src() { return this._src; },
        onload: null,
        onerror: null,
      }));
    });

    it('preloads image when capability is present', async () => {
      const img = await adapter.preloadImage('test.png');
      expect(img.src).toBe('https://plugin.example.com/test.png');
    });

    it('throws error when capability is missing', async () => {
      const adapterWithoutCapability = new PluginAssetManagerAdapter(
        coreAssetManager,
        'https://plugin.example.com/',
        []
      );

      await expect(adapterWithoutCapability.preloadImage('test.png'))
        .rejects.toThrow('does not have asset-loading capability');
    });
  });

  describe('preloadAudio', () => {
    beforeEach(() => {
      global.Audio = vi.fn().mockImplementation(() => ({
        load: vi.fn(),
        set src(value) {
          this._src = value;
          setTimeout(() => this.oncanplaythrough?.(), 0);
        },
        get src() { return this._src; },
        oncanplaythrough: null,
        onerror: null,
      }));
    });

    it('preloads audio when capability is present', async () => {
      const audio = await adapter.preloadAudio('test.mp3');
      expect(audio.src).toBe('https://plugin.example.com/test.mp3');
    });

    it('throws error when capability is missing', async () => {
      const adapterWithoutCapability = new PluginAssetManagerAdapter(
        coreAssetManager,
        'https://plugin.example.com/',
        []
      );

      await expect(adapterWithoutCapability.preloadAudio('test.mp3'))
        .rejects.toThrow('does not have asset-loading capability');
    });
  });

  describe('cleanup', () => {
    it('removes all loaded fonts', async () => {
      const mockFontFace1 = { load: vi.fn().mockResolvedValue(undefined) };
      const mockFontFace2 = { load: vi.fn().mockResolvedValue(undefined) };
      
      global.FontFace = vi.fn()
        .mockReturnValueOnce(mockFontFace1)
        .mockReturnValueOnce(mockFontFace2);
      
      Object.defineProperty(document as any, 'fonts', {
        value: {
          add: vi.fn(),
          delete: vi.fn(),
        },
        configurable: true,
      });

      await adapter.loadFont({
        family: 'Font1',
        src: 'font1.woff2',
      });

      await adapter.loadFont({
        family: 'Font2',
        src: 'font2.woff2',
      });

      adapter.cleanup();

      expect(global.document.fonts.delete).toHaveBeenCalledWith(mockFontFace1);
      expect(global.document.fonts.delete).toHaveBeenCalledWith(mockFontFace2);
      expect(global.document.fonts.delete).toHaveBeenCalledTimes(2);
    });
  });
});

describe('PluginAudioSystem', () => {
  let adapter: PluginAssetManagerAdapter;
  let audioSystem: PluginAudioSystem;
  let mockAudioContext: any;

  beforeEach(() => {
    adapter = new PluginAssetManagerAdapter(
      new AssetManager(),
      'https://plugin.example.com/',
      ['asset-loading']
    );
    audioSystem = new PluginAudioSystem(adapter, ['asset-loading']);

    // AudioContext 모킹
    mockAudioContext = {
      state: 'running',
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        loop: false,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      })),
      createGain: vi.fn(() => ({
        gain: { value: 1 },
        connect: vi.fn(),
      })),
      destination: {},
      decodeAudioData: vi.fn().mockResolvedValue({}),
    };

    global.AudioContext = vi.fn().mockReturnValue(mockAudioContext);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    });
  });

  describe('play', () => {
    it('throws error when capability is missing', async () => {
      const systemWithoutCapability = new PluginAudioSystem(adapter, []);

      await expect(systemWithoutCapability.play('test.mp3'))
        .rejects.toThrow('does not have asset-loading capability');
    });

    it('loads and plays audio successfully', async () => {
      await audioSystem.play('test.mp3', { volume: 0.8, loop: true });

      expect(global.fetch).toHaveBeenCalledWith('https://plugin.example.com/test.mp3');
      expect(mockAudioContext.decodeAudioData).toHaveBeenCalled();
      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
    });

    it('caches audio buffers', async () => {
      await audioSystem.play('test.mp3');
      await audioSystem.play('test.mp3'); // 두 번째 호출

      expect(global.fetch).toHaveBeenCalledTimes(1); // 한 번만 로드
      expect(mockAudioContext.decodeAudioData).toHaveBeenCalledTimes(1);
    });
  });

  describe('setVolume', () => {
    it('updates gain node volume', async () => {
      await audioSystem.play('test.mp3');
      
      const gainNode = mockAudioContext.createGain.mock.results[0].value;
      
      audioSystem.setVolume('test.mp3', 0.5);
      
      expect(gainNode.gain.value).toBe(0.5);
    });

    it('clamps volume between 0 and 1', async () => {
      await audioSystem.play('test.mp3');
      
      const gainNode = mockAudioContext.createGain.mock.results[0].value;
      
      audioSystem.setVolume('test.mp3', -0.5);
      expect(gainNode.gain.value).toBe(0);
      
      audioSystem.setVolume('test.mp3', 1.5);
      expect(gainNode.gain.value).toBe(1);
    });
  });

  describe('stop', () => {
    it('stops playing audio', async () => {
      await audioSystem.play('test.mp3');
      
      const sourceNode = mockAudioContext.createBufferSource.mock.results[0].value;
      
      audioSystem.stop('test.mp3');
      
      expect(sourceNode.stop).toHaveBeenCalled();
    });

    it('handles already stopped audio gracefully', () => {
      // 이미 정지된 오디오에 대해 stop() 호출 시 에러가 발생하지 않아야 함
      expect(() => audioSystem.stop('nonexistent.mp3')).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('stops all playing audio and closes context', async () => {
      await audioSystem.play('test1.mp3');
      await audioSystem.play('test2.mp3');
      
      const sourceNodes = mockAudioContext.createBufferSource.mock.results.map(r => r.value);
      
      audioSystem.cleanup();
      
      sourceNodes.forEach(node => {
        expect(node.stop).toHaveBeenCalled();
      });
      expect(mockAudioContext.close).toHaveBeenCalled();
    });
  });
});

describe('PluginPortalSystem', () => {
  let effectsRoot: HTMLElement;
  let stageContainer: HTMLElement;
  let portalSystem: PluginPortalSystem;

  beforeEach(() => {
    document.body.innerHTML = '';
  
    stageContainer = document.createElement('div');
    stageContainer.className = 'stage';
    document.body.appendChild(stageContainer);
    
    effectsRoot = document.createElement('div');
    effectsRoot.className = 'effects-root';
    stageContainer.appendChild(effectsRoot);
    
    portalSystem = new PluginPortalSystem(
      effectsRoot,
      stageContainer,
      ['portal-breakout']
    );
  });

  describe('breakout', () => {
    it('throws error when capability is missing', () => {
      const systemWithoutCapability = new PluginPortalSystem(
        effectsRoot,
        stageContainer,
        []
      );

      expect(() => systemWithoutCapability.breakout())
        .toThrow('does not have portal-breakout capability');
    });

    it('creates breakout element in stage container', () => {
      const breakoutEl = portalSystem.breakout();
      
      expect(breakoutEl.className).toBe('mtx-plugin-breakout');
      expect(breakoutEl.style.position).toBe('absolute');
      expect(breakoutEl.style.zIndex).toBe('1000');
      expect(stageContainer.contains(breakoutEl)).toBe(true);
    });

    it('creates breakout element in body when specified', () => {
      const breakoutEl = portalSystem.breakout({ appendTo: 'body' });
      
      expect(document.body.contains(breakoutEl)).toBe(true);
      expect(stageContainer.contains(breakoutEl)).toBe(false);
    });

    it('uses custom className and zIndex', () => {
      const breakoutEl = portalSystem.breakout({
        className: 'custom-breakout',
        zIndex: 2000,
      });
      
      expect(breakoutEl.className).toBe('custom-breakout');
      expect(breakoutEl.style.zIndex).toBe('2000');
    });

    it('returns same element on multiple calls', () => {
      const first = portalSystem.breakout();
      const second = portalSystem.breakout();
      
      expect(first).toBe(second);
    });

    it('updates isBreakout status', () => {
      expect(portalSystem.isBreakout).toBe(false);
      
      portalSystem.breakout();
      expect(portalSystem.isBreakout).toBe(true);
    });
  });

  describe('return', () => {
    it('removes breakout element', () => {
      const breakoutEl = portalSystem.breakout();
      expect(stageContainer.contains(breakoutEl)).toBe(true);
      
      portalSystem.return();
      expect(stageContainer.contains(breakoutEl)).toBe(false);
      expect(portalSystem.isBreakout).toBe(false);
    });

    it('handles return without breakout gracefully', () => {
      expect(() => portalSystem.return()).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('cleans up breakout element', () => {
      const breakoutEl = portalSystem.breakout();
      expect(portalSystem.isBreakout).toBe(true);
      
      portalSystem.cleanup();
      expect(portalSystem.isBreakout).toBe(false);
      expect(stageContainer.contains(breakoutEl)).toBe(false);
    });
  });
});

describe('createPluginAssetSystems', () => {
  let coreAssetManager: AssetManager;
  let effectsRoot: HTMLElement;
  let stageContainer: HTMLElement;

  beforeEach(() => {
    coreAssetManager = new AssetManager();
    
    document.body.innerHTML = '';
    stageContainer = document.createElement('div');
    effectsRoot = document.createElement('div');
    stageContainer.appendChild(effectsRoot);
    document.body.appendChild(stageContainer);
  });

  it('creates all plugin asset systems', () => {
    const systems = createPluginAssetSystems({
      coreAssetManager,
      pluginBaseUrl: 'https://plugin.example.com/',
      effectsRoot,
      stageContainer,
      capabilities: ['asset-loading', 'portal-breakout'],
    });

    expect(systems.assets).toBeInstanceOf(PluginAssetManagerAdapter);
    expect(systems.audio).toBeInstanceOf(PluginAudioSystem);
    expect(systems.portal).toBeInstanceOf(PluginPortalSystem);
    expect(typeof systems.cleanup).toBe('function');
  });

  it('cleanup function calls cleanup on all systems', () => {
    const systems = createPluginAssetSystems({
      coreAssetManager,
      pluginBaseUrl: 'https://plugin.example.com/',
      effectsRoot,
      stageContainer,
      capabilities: ['asset-loading', 'portal-breakout'],
    });

    // 각 시스템의 cleanup 메서드를 spy로 모킹
    const assetCleanupSpy = vi.spyOn(systems.assets, 'cleanup');
    const audioCleanupSpy = vi.spyOn(systems.audio, 'cleanup');
    const portalCleanupSpy = vi.spyOn(systems.portal, 'cleanup');

    systems.cleanup();

    expect(assetCleanupSpy).toHaveBeenCalled();
    expect(audioCleanupSpy).toHaveBeenCalled();
    expect(portalCleanupSpy).toHaveBeenCalled();
  });
});
