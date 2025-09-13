import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AssetManager } from '../AssetManager';

// Mock FontFace for Node.js environment
class MockFontFace {
  family: string;
  source: string;
  status: string = 'unloaded';

  constructor(family: string, source: string) {
    this.family = family;
    this.source = source;
  }

  async load(): Promise<MockFontFace> {
    this.status = 'loaded';
    return this;
  }
}

// Mock document.fonts for Node.js environment
const mockFonts = {
  fonts: new Set(),
  add: vi.fn((font: MockFontFace) => mockFonts.fonts.add(font)),
  delete: vi.fn((font: MockFontFace) => mockFonts.fonts.delete(font)),
  clear: vi.fn(() => mockFonts.fonts.clear())
};

// Global mocks
(global as any).FontFace = MockFontFace;
(global as any).document = { fonts: mockFonts };
(global as any).window = { location: { href: 'http://localhost:3000/' } };
(global as any).Image = class MockImage {
  private _src: string = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  get src(): string {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    // 기본적으로 성공으로 가정 (테스트에서 개별 설정)
    setTimeout(() => {
      if (this.onload) {
        this.onload();
      }
    }, 0);
  }
};

describe('AssetManager', () => {
  let manager: AssetManager;

  beforeEach(() => {
    manager = new AssetManager('http://localhost:3000/assets/');
    mockFonts.fonts.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('기본 기능', () => {
    it('AssetManager를 생성한다', () => {
      expect(manager).toBeInstanceOf(AssetManager);
      expect(manager.getLoadStats().total).toBe(0);
    });

    it('baseUrl을 올바르게 설정한다', () => {
      const managerWithoutBase = new AssetManager();
      expect(managerWithoutBase).toBeInstanceOf(AssetManager);
    });
  });

  describe('에셋 정의 추출', () => {
    it('Define 섹션에서 에셋을 추출한다', async () => {
      const defines = {
        main_font: {
          type: 'font',
          url: 'fonts/main.woff2'
        },
        logo_image: {
          type: 'image',
          url: 'images/logo.png'
        },
        bg_video: {
          type: 'video',
          url: 'videos/bg.mp4'
        },
        not_an_asset: {
          color: '#ff0000',
          size: 24
        }
      };

      await manager.loadAssetsFromDefines(defines);
      
      const stats = manager.getLoadStats();
      expect(stats.fonts).toBe(1);
      expect(stats.images).toBe(1);
      expect(stats.videos).toBe(1);
      expect(stats.total).toBe(3);
    });

    it('잘못된 에셋 정의를 무시한다', async () => {
      const defines = {
        invalid_asset: {
          type: 'unknown',
          url: 'test.file'
        },
        malformed: {
          url: 'test.file'
          // type 누락
        },
        not_object: 'string value'
      };

      await manager.loadAssetsFromDefines(defines);
      
      const stats = manager.getLoadStats();
      expect(stats.total).toBe(0);
    });
  });

  describe('폰트 로딩', () => {
    it('폰트를 로드하고 등록한다', async () => {
      const defines = {
        main_font: {
          type: 'font',
          url: 'fonts/main.woff2'
        }
      };

      await manager.loadAssetsFromDefines(defines);
      
      expect(manager.isFontLoaded('main_font')).toBe(true);
      expect(mockFonts.add).toHaveBeenCalledTimes(1);
      expect(manager.getAssetUrl('main_font', 'font')).toBe('main_font');
    });

    it('dispose 시 폰트를 제거한다', async () => {
      const defines = {
        test_font: {
          type: 'font',
          url: 'fonts/test.woff2'
        }
      };

      await manager.loadAssetsFromDefines(defines);
      expect(manager.isFontLoaded('test_font')).toBe(true);

      manager.dispose();
      expect(mockFonts.delete).toHaveBeenCalledTimes(1);
      expect(manager.getLoadStats().total).toBe(0);
    });
  });

  describe('이미지 프리로딩', () => {
    it('이미지를 프리로드한다', async () => {
      const defines = {
        test_image: {
          type: 'image',
          url: 'images/test.png'
        }
      };

      await manager.loadAssetsFromDefines(defines);
      
      expect(manager.getAssetUrl('test_image', 'image')).toBe('http://localhost:3000/assets/images/test.png');
      expect(manager.getLoadStats().images).toBe(1);
    });

    it('이미지 로드 실패를 처리한다', async () => {
      // Mock Image가 에러를 발생하도록 설정
      const originalImage = (global as any).Image;
      (global as any).Image = class FailingMockImage {
        private _src: string = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        get src(): string {
          return this._src;
        }

        set src(value: string) {
          this._src = value;
          setTimeout(() => {
            if (this.onerror) {
              this.onerror();
            }
          }, 0);
        }
      };

      const defines = {
        failing_image: {
          type: 'image',
          url: 'images/nonexistent.png'
        }
      };

      // 에러가 발생해도 전체 로드는 실패하지 않음 (경고만 출력)
      await expect(manager.loadAssetsFromDefines(defines)).resolves.not.toThrow();
      expect(manager.getLoadStats().images).toBe(0);

      // Restore original Image mock
      (global as any).Image = originalImage;
    });
  });

  describe('비디오/오디오 등록', () => {
    it('비디오와 오디오 URL을 등록한다', async () => {
      const defines = {
        bg_video: {
          type: 'video',
          url: 'videos/bg.mp4'
        },
        bg_audio: {
          type: 'audio',
          url: 'audio/bg.mp3'
        }
      };

      await manager.loadAssetsFromDefines(defines);
      
      expect(manager.getAssetUrl('bg_video', 'video')).toBe('http://localhost:3000/assets/videos/bg.mp4');
      expect(manager.getAssetUrl('bg_audio', 'audio')).toBe('http://localhost:3000/assets/audio/bg.mp3');
      expect(manager.getLoadStats().videos).toBe(1);
      expect(manager.getLoadStats().audios).toBe(1);
    });
  });

  describe('URL 해석', () => {
    it('절대 URL을 그대로 반환한다', async () => {
      const defines = {
        external_image: {
          type: 'image',
          url: 'https://example.com/image.png'
        },
        data_image: {
          type: 'image',
          url: 'data:image/png;base64,iVBOR...'
        }
      };

      await manager.loadAssetsFromDefines(defines);
      
      expect(manager.getAssetUrl('external_image')).toBe('https://example.com/image.png');
      expect(manager.getAssetUrl('data_image')).toBe('data:image/png;base64,iVBOR...');
    });

    it('baseUrl 없이 상대 URL을 처리한다', async () => {
      const managerNoBase = new AssetManager(); // baseUrl 없음
      
      const defines = {
        local_image: {
          type: 'image',
          url: 'images/local.png'
        }
      };

      await managerNoBase.loadAssetsFromDefines(defines);
      
      // window.location.href 기준으로 해석됨
      expect(managerNoBase.getAssetUrl('local_image')).toBe('http://localhost:3000/images/local.png');
      managerNoBase.dispose();
    });
  });

  describe('에셋 조회', () => {
    beforeEach(async () => {
      const defines = {
        test_font: { type: 'font', url: 'fonts/test.woff2' },
        test_image: { type: 'image', url: 'images/test.png' },
        test_video: { type: 'video', url: 'videos/test.mp4' },
        test_audio: { type: 'audio', url: 'audio/test.mp3' }
      };
      await manager.loadAssetsFromDefines(defines);
    });

    it('타입별로 에셋을 조회한다', () => {
      expect(manager.getAssetUrl('test_font', 'font')).toBe('test_font');
      expect(manager.getAssetUrl('test_image', 'image')).toBeTruthy();
      expect(manager.getAssetUrl('test_video', 'video')).toBeTruthy();
      expect(manager.getAssetUrl('test_audio', 'audio')).toBeTruthy();
    });

    it('타입 지정 없이 에셋을 조회한다', () => {
      expect(manager.getAssetUrl('test_image')).toBeTruthy();
      expect(manager.getAssetUrl('test_video')).toBeTruthy();
      expect(manager.getAssetUrl('test_audio')).toBeTruthy();
      expect(manager.getAssetUrl('test_font')).toBe('test_font');
    });

    it('존재하지 않는 에셋은 null을 반환한다', () => {
      expect(manager.getAssetUrl('nonexistent')).toBeNull();
      expect(manager.getAssetUrl('nonexistent', 'image')).toBeNull();
    });

    it('모든 에셋 키를 반환한다', () => {
      const allKeys = manager.getAllAssetKeys();
      expect(allKeys).toContain('test_font');
      expect(allKeys).toContain('test_image');
      expect(allKeys).toContain('test_video');
      expect(allKeys).toContain('test_audio');
      expect(allKeys).toHaveLength(4);

      const fontKeys = manager.getAllAssetKeys('font');
      expect(fontKeys).toEqual(['test_font']);

      const imageKeys = manager.getAllAssetKeys('image');
      expect(imageKeys).toEqual(['test_image']);
    });
  });

  describe('통계 및 유틸리티', () => {
    it('로드 통계를 반환한다', async () => {
      const defines = {
        font1: { type: 'font', url: 'fonts/1.woff2' },
        font2: { type: 'font', url: 'fonts/2.woff2' },
        image1: { type: 'image', url: 'images/1.png' },
        video1: { type: 'video', url: 'videos/1.mp4' }
      };

      await manager.loadAssetsFromDefines(defines);
      
      const stats = manager.getLoadStats();
      expect(stats.fonts).toBe(2);
      expect(stats.images).toBe(1);
      expect(stats.videos).toBe(1);
      expect(stats.audios).toBe(0);
      expect(stats.total).toBe(4);
    });

    it('에셋 컨텍스트를 반환한다', () => {
      const context = manager.getContext();
      expect(context.baseUrl).toBe('http://localhost:3000/assets/');
      expect(context.fonts).toBeInstanceOf(Map);
      expect(context.images).toBeInstanceOf(Map);
      expect(context.videos).toBeInstanceOf(Map);
      expect(context.audios).toBeInstanceOf(Map);
    });
  });
});