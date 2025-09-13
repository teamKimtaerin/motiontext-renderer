// Plugin Asset Bridge (Plugin System v3.0)
// 기존 AssetManager를 플러그인 시스템과 연결하는 브리지

import { AssetManager } from '../assets/AssetManager';
import type { AssetManager as PluginAssetManager } from './PluginContextV3';

/**
 * 플러그인용 AssetManager 어댑터
 * 기존 AssetManager를 플러그인 인터페이스에 맞게 래핑
 */
export class PluginAssetManagerAdapter implements PluginAssetManager {
  constructor(
    _coreAssetManager: AssetManager, // TODO: 향후 코어 AssetManager 통합시 사용
    private pluginBaseUrl: string,
    private capabilities: string[] = []
  ) {}

  /**
   * 에셋 URL 생성 (플러그인 baseUrl 기준)
   */
  getUrl(path: string): string {
    return new URL(path, this.pluginBaseUrl).toString();
  }

  /**
   * 폰트 로드 및 등록 (권한 필요: asset-loading)
   */
  async loadFont(fontSpec: {
    family: string;
    src: string;
    weight?: string;
    style?: string;
  }): Promise<void> {
    if (!this.hasCapability('asset-loading')) {
      throw new Error('Plugin does not have asset-loading capability');
    }

    const fontUrl = this.getUrl(fontSpec.src);
    const fontFace = new FontFace(fontSpec.family, `url("${fontUrl}")`, {
      weight: fontSpec.weight || 'normal',
      style: fontSpec.style || 'normal',
    });

    await fontFace.load();
    document.fonts.add(fontFace);

    // 플러그인이 로드한 폰트 추적 (정리를 위해)
    this.trackLoadedFont(fontSpec.family, fontFace);
  }

  /**
   * 이미지 프리로드 (권한 필요: asset-loading)
   */
  async preloadImage(url: string): Promise<HTMLImageElement> {
    if (!this.hasCapability('asset-loading')) {
      throw new Error('Plugin does not have asset-loading capability');
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = this.getUrl(url);
    });
  }

  /**
   * 오디오 프리로드 (권한 필요: asset-loading)
   */
  async preloadAudio(url: string): Promise<HTMLAudioElement> {
    if (!this.hasCapability('asset-loading')) {
      throw new Error('Plugin does not have asset-loading capability');
    }

    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.oncanplaythrough = () => resolve(audio);
      audio.onerror = () => reject(new Error(`Failed to load audio: ${url}`));
      audio.src = this.getUrl(url);
      audio.load();
    });
  }

  /**
   * 플러그인이 로드한 폰트 추적
   */
  private loadedFonts = new Set<FontFace>();

  private trackLoadedFont(_family: string, fontFace: FontFace): void {
    this.loadedFonts.add(fontFace);
  }

  /**
   * 플러그인이 로드한 모든 폰트 정리
   */
  cleanup(): void {
    for (const fontFace of this.loadedFonts) {
      document.fonts.delete(fontFace);
    }
    this.loadedFonts.clear();
  }

  /**
   * 권한 확인
   */
  private hasCapability(capability: string): boolean {
    return this.capabilities.includes(capability);
  }
}

/**
 * 플러그인용 오디오 시스템
 * Web Audio API를 사용한 고급 오디오 제어
 */
export class PluginAudioSystem {
  private audioContext: AudioContext | null = null;
  private loadedAudioBuffers = new Map<string, AudioBuffer>();
  private playingSources = new Map<string, AudioBufferSourceNode>();
  private gainNodes = new Map<string, GainNode>();

  constructor(
    private assetAdapter: PluginAssetManagerAdapter,
    private capabilities: string[] = []
  ) {}

  /**
   * 오디오 컨텍스트 초기화 (지연 초기화)
   */
  private async getAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();

      // 브라우저 autoplay 정책으로 인한 일시정지 상태 해제
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    }

    return this.audioContext;
  }

  /**
   * 오디오 재생
   */
  async play(
    url: string,
    options: {
      volume?: number;
      loop?: boolean;
      startTime?: number;
    } = {}
  ): Promise<void> {
    if (!this.hasCapability('asset-loading')) {
      throw new Error('Plugin does not have asset-loading capability');
    }

    const audioContext = await this.getAudioContext();

    // 기존 재생 중단
    this.stop(url);

    // 오디오 버퍼 로드 (캐시 활용)
    let audioBuffer = this.loadedAudioBuffers.get(url);
    if (!audioBuffer) {
      audioBuffer = await this.loadAudioBuffer(url);
      this.loadedAudioBuffers.set(url, audioBuffer);
    }

    // 소스 노드 생성
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.loop = options.loop || false;

    // 게인 노드 생성 (볼륨 제어용)
    const gainNode = audioContext.createGain();
    gainNode.gain.value = options.volume ?? 1.0;

    // 노드 연결: source → gain → destination
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // 재생 시작
    const startTime = options.startTime || 0;
    source.start(0, startTime);

    // 추적용 저장
    this.playingSources.set(url, source);
    this.gainNodes.set(url, gainNode);

    // 재생 완료 시 정리
    source.onended = () => {
      this.playingSources.delete(url);
      this.gainNodes.delete(url);
    };
  }

  /**
   * 오디오 일시정지 (Web Audio API는 일시정지 미지원, 정지만 가능)
   */
  pause(url: string): void {
    this.stop(url);
  }

  /**
   * 볼륨 설정
   */
  setVolume(url: string, volume: number): void {
    const gainNode = this.gainNodes.get(url);
    if (gainNode) {
      gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * 오디오 정지
   */
  stop(url: string): void {
    const source = this.playingSources.get(url);
    if (source) {
      try {
        source.stop();
      } catch (e) {
        // 이미 정지된 경우 무시
      }
    }

    this.playingSources.delete(url);
    this.gainNodes.delete(url);
  }

  /**
   * 오디오 버퍼 로드
   */
  private async loadAudioBuffer(url: string): Promise<AudioBuffer> {
    const audioContext = await this.getAudioContext();
    const fullUrl = this.assetAdapter.getUrl(url);

    const response = await fetch(fullUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * 모든 오디오 정리
   */
  cleanup(): void {
    // 모든 재생 중인 오디오 정지
    for (const url of this.playingSources.keys()) {
      this.stop(url);
    }

    // 오디오 컨텍스트 정리
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.loadedAudioBuffers.clear();
  }

  /**
   * 권한 확인
   */
  private hasCapability(capability: string): boolean {
    return this.capabilities.includes(capability);
  }
}

/**
 * 플러그인용 포털 시스템
 * effectsRoot 밖으로 탈출하여 전체 화면 효과 구현
 */
export class PluginPortalSystem {
  private breakoutElement: HTMLElement | null = null;
  private originalParent: HTMLElement | null = null;

  constructor(
    _effectsRoot: HTMLElement, // TODO: effectsRoot 기반 portal 관리시 사용
    private stageContainer: HTMLElement,
    private capabilities: string[] = []
  ) {}

  /**
   * effectsRoot 밖으로 탈출
   */
  breakout(
    options: {
      zIndex?: number;
      className?: string;
      appendTo?: 'body' | 'stage';
    } = {}
  ): HTMLElement {
    if (!this.hasCapability('portal-breakout')) {
      throw new Error('Plugin does not have portal-breakout capability');
    }

    // 이미 탈출 상태면 기존 요소 반환
    if (this.breakoutElement) {
      return this.breakoutElement;
    }

    // 탈출용 컨테이너 생성
    this.breakoutElement = document.createElement('div');
    this.breakoutElement.className = options.className || 'mtx-plugin-breakout';

    // 기본 스타일 설정
    this.breakoutElement.style.position = 'absolute';
    this.breakoutElement.style.top = '0';
    this.breakoutElement.style.left = '0';
    this.breakoutElement.style.width = '100%';
    this.breakoutElement.style.height = '100%';
    this.breakoutElement.style.pointerEvents = 'none';
    this.breakoutElement.style.zIndex = String(options.zIndex || 1000);

    // 부모 요소 결정
    const targetParent =
      options.appendTo === 'body' ? document.body : this.stageContainer;

    targetParent.appendChild(this.breakoutElement);
    this.originalParent = targetParent;

    return this.breakoutElement;
  }

  /**
   * 탈출 상태 해제
   */
  return(): void {
    if (this.breakoutElement && this.originalParent) {
      this.originalParent.removeChild(this.breakoutElement);
      this.breakoutElement = null;
      this.originalParent = null;
    }
  }

  /**
   * 현재 탈출 상태인지 확인
   */
  get isBreakout(): boolean {
    return this.breakoutElement !== null;
  }

  /**
   * 정리 (플러그인 종료 시 호출)
   */
  cleanup(): void {
    this.return();
  }

  /**
   * 권한 확인
   */
  private hasCapability(capability: string): boolean {
    return this.capabilities.includes(capability);
  }
}

/**
 * 플러그인 에셋 시스템 통합 팩토리
 */
export function createPluginAssetSystems(config: {
  coreAssetManager: AssetManager;
  pluginBaseUrl: string;
  effectsRoot: HTMLElement;
  stageContainer: HTMLElement;
  capabilities: string[];
}) {
  const assetAdapter = new PluginAssetManagerAdapter(
    config.coreAssetManager,
    config.pluginBaseUrl,
    config.capabilities
  );

  const audioSystem = new PluginAudioSystem(assetAdapter, config.capabilities);

  const portalSystem = new PluginPortalSystem(
    config.effectsRoot,
    config.stageContainer,
    config.capabilities
  );

  return {
    assets: assetAdapter,
    audio: audioSystem,
    portal: portalSystem,
    cleanup: () => {
      assetAdapter.cleanup();
      audioSystem.cleanup();
      portalSystem.cleanup();
    },
  };
}
