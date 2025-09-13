import type { DefineAsset, AssetContext } from '../types/scenario-v2';

/**
 * AssetManager
 *
 * 기본 에셋 관리 (보안 검증 제외)
 * - 에셋 타입별 URL 해석 (font, image, video, audio)
 * - FontFace 기본 등록/해제 (무결성 검증 없이)
 * - Define 섹션의 에셋 참조 처리
 *
 * 참고: M7에서 SHA-384 해시 및 서명 검증 추가 예정
 */
export class AssetManager {
  private readonly context: AssetContext;
  private readonly loadedFonts = new Map<string, FontFace>();
  private readonly baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
    this.context = {
      baseUrl,
      fonts: new Map(),
      images: new Map(),
      videos: new Map(),
      audios: new Map(),
    };
  }

  /**
   * Define 섹션에서 에셋을 추출하고 로드
   * @param defines Define 섹션 객체
   * @returns Promise<void>
   */
  async loadAssetsFromDefines(defines: Record<string, any>): Promise<void> {
    const assets = this.extractAssetsFromDefines(defines);
    await this.loadAssets(assets);
  }

  /**
   * Define 섹션에서 에셋 정의 추출
   * @param defines Define 섹션 객체
   * @returns 추출된 에셋 배열
   */
  private extractAssetsFromDefines(
    defines: Record<string, any>
  ): Array<{ key: string; asset: DefineAsset }> {
    const assets: Array<{ key: string; asset: DefineAsset }> = [];

    for (const [key, value] of Object.entries(defines)) {
      if (this.isAssetDefinition(value)) {
        assets.push({ key, asset: value as DefineAsset });
      }
    }

    return assets;
  }

  /**
   * 값이 에셋 정의인지 확인
   * @param value 확인할 값
   * @returns 에셋 정의인 경우 true
   */
  private isAssetDefinition(value: any): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof value.type === 'string' &&
      ['font', 'image', 'video', 'audio'].includes(value.type) &&
      typeof value.url === 'string'
    );
  }

  /**
   * 에셋 배열을 순차적으로 로드
   * @param assets 로드할 에셋 배열
   */
  private async loadAssets(
    assets: Array<{ key: string; asset: DefineAsset }>
  ): Promise<void> {
    for (const { key, asset } of assets) {
      try {
        await this.loadSingleAsset(key, asset);
      } catch (error) {
        console.warn(`Failed to load asset "${key}":`, error);
        // 에셋 로드 실패는 에러를 발생시키지 않고 경고만 출력
        // 프로덕션에서는 로깅 시스템으로 대체
      }
    }
  }

  /**
   * 개별 에셋을 로드
   * @param key 에셋 키
   * @param asset 에셋 정의
   */
  private async loadSingleAsset(
    key: string,
    asset: DefineAsset
  ): Promise<void> {
    const resolvedUrl = this.resolveUrl(asset.url || asset.src);

    switch (asset.type) {
      case 'font':
        await this.loadFont(key, resolvedUrl);
        break;
      case 'image':
        await this.preloadImage(key, resolvedUrl);
        break;
      case 'video':
        this.registerVideo(key, resolvedUrl);
        break;
      case 'audio':
        this.registerAudio(key, resolvedUrl);
        break;
      default:
        throw new Error(`Unsupported asset type: ${(asset as any).type}`);
    }
  }

  /**
   * 폰트 로드 및 등록
   * @param key 폰트 키
   * @param url 폰트 URL
   */
  private async loadFont(key: string, url: string): Promise<void> {
    // M7에서 무결성 검증 추가 예정
    // if (asset.integrity) {
    //   await this.verifyIntegrity(url, asset.integrity);
    // }

    try {
      const fontFace = new FontFace(key, `url(${url})`);
      await fontFace.load();

      // 브라우저 폰트 컨테이너에 추가
      document.fonts.add(fontFace);

      // 컨텍스트에 등록
      this.context.fonts.set(key, fontFace);
      this.loadedFonts.set(key, fontFace);
    } catch (error) {
      throw new Error(`Failed to load font "${key}" from ${url}: ${error}`);
    }
  }

  /**
   * 이미지 프리로드
   * @param key 이미지 키
   * @param url 이미지 URL
   */
  private async preloadImage(key: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        this.context.images.set(key, url);
        resolve();
      };

      img.onerror = () => {
        reject(new Error(`Failed to preload image: ${url}`));
      };

      img.src = url;
    });
  }

  /**
   * 비디오 URL 등록 (프리로드 없음)
   * @param key 비디오 키
   * @param url 비디오 URL
   */
  private registerVideo(key: string, url: string): void {
    this.context.videos.set(key, url);
  }

  /**
   * 오디오 URL 등록 (프리로드 없음)
   * @param key 오디오 키
   * @param url 오디오 URL
   */
  private registerAudio(key: string, url: string): void {
    this.context.audios.set(key, url);
  }

  /**
   * 상대 URL을 절대 URL로 해석
   * @param url 해석할 URL
   * @returns 절대 URL
   */
  private resolveUrl(url: string): string {
    // 이미 절대 URL인 경우 그대로 반환
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('data:')
    ) {
      return url;
    }

    // 상대 URL인 경우 baseUrl과 결합
    if (this.baseUrl) {
      return new URL(url, this.baseUrl).href;
    }

    // baseUrl이 없으면 현재 페이지 기준
    return new URL(url, window.location.href).href;
  }

  /**
   * 에셋 URL 조회 (플러그인에서 사용)
   * @param key 에셋 키
   * @param type 에셋 타입 (선택적)
   * @returns 에셋 URL 또는 null
   */
  getAssetUrl(key: string, type?: DefineAsset['type']): string | null {
    // 타입별 우선 검색
    if (type) {
      switch (type) {
        case 'font':
          return this.context.fonts.has(key) ? key : null; // 폰트는 family name으로 사용
        case 'image':
          return this.context.images.get(key) || null;
        case 'video':
          return this.context.videos.get(key) || null;
        case 'audio':
          return this.context.audios.get(key) || null;
      }
    }

    // 타입 지정 없이 모든 타입에서 검색
    return (
      this.context.images.get(key) ||
      this.context.videos.get(key) ||
      this.context.audios.get(key) ||
      (this.context.fonts.has(key) ? key : null)
    );
  }

  /**
   * 폰트 로드 상태 확인
   * @param key 폰트 키
   * @returns 로드된 경우 true
   */
  isFontLoaded(key: string): boolean {
    return this.loadedFonts.has(key);
  }

  /**
   * 모든 로드된 폰트 제거 (클린업용)
   */
  dispose(): void {
    // 로드된 폰트들을 브라우저에서 제거
    for (const fontFace of this.loadedFonts.values()) {
      document.fonts.delete(fontFace);
    }

    // 컨텍스트 클리어
    this.context.fonts.clear();
    this.context.images.clear();
    this.context.videos.clear();
    this.context.audios.clear();
    this.loadedFonts.clear();
  }

  /**
   * 에셋 컨텍스트 반환 (플러그인 컨텍스트에서 사용)
   * @returns 에셋 컨텍스트
   */
  getContext(): AssetContext {
    return this.context;
  }

  /**
   * 로드 통계 반환
   * @returns 로드된 에셋 통계
   */
  getLoadStats(): {
    fonts: number;
    images: number;
    videos: number;
    audios: number;
    total: number;
  } {
    const stats = {
      fonts: this.context.fonts.size,
      images: this.context.images.size,
      videos: this.context.videos.size,
      audios: this.context.audios.size,
      total: 0,
    };

    stats.total = stats.fonts + stats.images + stats.videos + stats.audios;
    return stats;
  }

  /**
   * 모든 에셋 키 목록 반환
   * @param type 특정 타입만 필터링 (선택적)
   * @returns 에셋 키 배열
   */
  getAllAssetKeys(type?: DefineAsset['type']): string[] {
    if (type) {
      switch (type) {
        case 'font':
          return Array.from(this.context.fonts.keys());
        case 'image':
          return Array.from(this.context.images.keys());
        case 'video':
          return Array.from(this.context.videos.keys());
        case 'audio':
          return Array.from(this.context.audios.keys());
        default:
          return [];
      }
    }

    // 모든 타입의 키 합계
    return [
      ...this.context.fonts.keys(),
      ...this.context.images.keys(),
      ...this.context.videos.keys(),
      ...this.context.audios.keys(),
    ];
  }
}
