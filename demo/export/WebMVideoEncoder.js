import WebMWriter from 'webm-writer';

/**
 * 🎬 WebM Writer 기반 비디오 인코더
 * FFmpeg.js 대안 - SharedArrayBuffer 없이 작동
 * 순수 브라우저 API만 사용하여 최대 호환성 보장
 */
export class WebMVideoEncoder {
  constructor() {
    this.videoWriter = null;
    this.frames = [];
    this.isRecording = false;
    this.isProcessing = false;
    
    // 기본 설정
    this.defaultOptions = {
      fps: 30,
      width: 1280,
      height: 720,
      quality: 0.8, // WebM 품질 (0.0 ~ 1.0)
      format: 'webm' // webm만 지원
    };
  }

  /**
   * 🚀 WebM Writer 초기화 (즉시 사용 가능)
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      console.log('🚀 WebM Writer 초기화 중...');
      
      // 브라우저 지원 확인
      const supportInfo = this.checkBrowserSupport();
      console.log('📊 브라우저 지원 정보:', supportInfo);
      
      if (!supportInfo.basicSupport) {
        throw new Error('브라우저가 기본 요구사항을 지원하지 않습니다');
      }

      if (!supportInfo.canvasToBlob) {
        console.warn('⚠️ Canvas.toBlob 지원이 제한적입니다');
      }

      console.log('✅ WebM Writer 초기화 완료 (FFmpeg 없이 작동)');

    } catch (error) {
      console.error('❌ WebM Writer 초기화 실패:', error);
      throw new Error(`WebM Writer 초기화 실패: ${error.message}`);
    }
  }

  /**
   * 🎬 비디오 녹화 시작
   * @param {Object} options - 녹화 옵션
   * @returns {Promise<void>}
   */
  async startRecording(options = {}) {
    const config = { ...this.defaultOptions, ...options };
    
    if (this.isRecording) {
      throw new Error('이미 녹화가 진행 중입니다');
    }

    try {
      console.log('🎬 WebM Writer 기반 녹화 시작:', config);
      
      // WebM Writer 인스턴스 생성
      this.videoWriter = new WebMWriter({
        quality: config.quality,
        fileWriter: null, // Blob으로 반환
        fd: null,
        frameRate: config.fps,
        transparent: false // 투명도 지원 안함 (성능상)
      });

      this.frames = [];
      this.isRecording = true;
      this.config = config;
      
      console.log('✅ WebM Writer 녹화 준비 완료 - 프레임 추가 대기 중');

    } catch (error) {
      console.error('❌ WebM Writer 녹화 시작 실패:', error);
      throw new Error(`WebM 녹화 시작 실패: ${error.message}`);
    }
  }

  /**
   * 🖼️ 프레임 추가 (Canvas에서)
   * @param {HTMLCanvasElement} canvas - 캡처할 캔버스
   * @param {number} timestamp - 프레임 타임스탬프 (초)
   * @returns {Promise<void>}
   */
  async addFrame(canvas, timestamp = 0) {
    if (!this.isRecording) {
      throw new Error('녹화가 시작되지 않았습니다');
    }

    try {
      // Canvas를 WebM Writer에 직접 추가
      this.videoWriter.addFrame(canvas);
      
      this.frames.push({
        timestamp: timestamp,
        index: this.frames.length
      });

      if (this.frames.length % 10 === 0) { // 10프레임마다 로그
        console.log(`📸 프레임 추가: ${this.frames.length}개 (${timestamp.toFixed(3)}s)`);
      }

    } catch (error) {
      console.error('❌ 프레임 추가 실패:', error);
      throw error;
    }
  }

  /**
   * 🎬 녹화 완료 및 WebM 생성
   * @param {Function} onProgress - 진행률 콜백
   * @returns {Promise<Blob>} - 완성된 WebM Blob
   */
  async stopRecording(onProgress = null) {
    if (!this.isRecording) {
      throw new Error('진행 중인 녹화가 없습니다');
    }

    if (this.frames.length === 0) {
      throw new Error('추가된 프레임이 없습니다');
    }

    try {
      console.log(`🎬 WebM 비디오 생성 시작: ${this.frames.length}개 프레임`);
      
      this.isProcessing = true;
      
      // 진행률 업데이트
      const updateProgress = (stage, progress, message = '') => {
        if (onProgress) {
          onProgress({ stage, progress, message });
        }
      };

      updateProgress('processing', 0.1, 'WebM 인코딩 시작...');

      // WebM 비디오 완료
      const webmBlob = await this.videoWriter.complete();
      
      updateProgress('processing', 0.9, 'WebM 파일 생성 중...');

      if (!webmBlob || webmBlob.size === 0) {
        throw new Error('WebM 파일 생성에 실패했습니다');
      }

      updateProgress('processing', 1.0, 'WebM 생성 완료!');

      console.log(`✅ WebM 생성 완료: ${webmBlob.size} bytes`);
      
      return webmBlob;

    } catch (error) {
      console.error('❌ WebM 생성 실패:', error);
      throw new Error(`WebM 생성 실패: ${error.message}`);
    } finally {
      // 리소스 정리
      this.cleanup();
    }
  }

  /**
   * 🔍 브라우저 지원 기능 확인
   * @returns {Object}
   */
  checkBrowserSupport() {
    const support = {
      basicSupport: true,
      webAssembly: false, // WebM Writer는 WebAssembly 불필요
      canvasToBlob: typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype.toBlob,
      canvasGetContext: typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype.getContext,
      webmSupport: this.checkWebMSupport(),
      arraybuffer: typeof ArrayBuffer !== 'undefined'
    };

    // 기본 지원 여부 계산
    support.basicSupport = support.canvasToBlob && support.canvasGetContext && support.arraybuffer;
    
    return support;
  }

  /**
   * 🎥 WebM 포맷 지원 확인
   * @returns {boolean}
   */
  checkWebMSupport() {
    try {
      const video = document.createElement('video');
      return video.canPlayType('video/webm') !== '';
    } catch {
      return false;
    }
  }

  /**
   * 📊 현재 상태 정보
   * @returns {Object}
   */
  getStatus() {
    return {
      isInitialized: true, // WebM Writer는 항상 사용 가능
      isRecording: this.isRecording,
      isProcessing: this.isProcessing,
      framesCount: this.frames.length,
      hasAudio: false, // WebM Writer는 오디오 미지원
      audioSize: 0
    };
  }

  /**
   * 🧹 리소스 정리
   */
  cleanup() {
    console.log('🧹 WebM Writer 리소스 정리 중...');
    
    this.frames = [];
    this.isRecording = false;
    this.isProcessing = false;
    this.config = null;

    if (this.videoWriter) {
      try {
        // WebM Writer 정리 (필요시)
        this.videoWriter = null;
      } catch (error) {
        console.warn('⚠️ WebM Writer 정리 중 오류:', error);
      }
    }

    console.log('✅ WebM Writer 정리 완료');
  }

  /**
   * 🔧 지원 기능 확인 (정적 메서드)
   * @returns {Object}
   */
  static getSupportInfo() {
    return {
      webmWriter: typeof WebMWriter !== 'undefined',
      canvasToBlob: typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype.toBlob,
      webAssemblyRequired: false, // FFmpeg와 달리 WebAssembly 불필요
      sharedArrayBufferRequired: false, // SharedArrayBuffer 불필요
      crossOriginIsolatedRequired: false // Cross-Origin Isolation 불필요
    };
  }

  /**
   * 📊 파일 크기 추정 (WebM 기준)
   * @param {number} width - 비디오 너비
   * @param {number} height - 비디오 높이
   * @param {number} fps - 프레임레이트
   * @param {number} duration - 지속시간 (초)
   * @param {number} quality - 품질 (0.0 ~ 1.0)
   * @returns {string} - 추정 파일 크기
   */
  static estimateFileSize(width, height, fps, duration, quality = 0.8) {
    try {
      // WebM의 일반적인 압축률 (VP8/VP9)
      const pixels = width * height;
      const framesTotal = fps * duration;
      
      // 품질에 따른 바이트 per 픽셀 계산
      const bytesPerPixel = 0.1 + (quality * 0.3); // 0.1 ~ 0.4
      
      // 총 크기 계산 (WebM 압축 고려)
      const totalBytes = pixels * framesTotal * bytesPerPixel * 0.7; // WebM 압축률 30%
      
      if (totalBytes < 1024 * 1024) {
        return `${Math.round(totalBytes / 1024)} KB`;
      } else if (totalBytes < 1024 * 1024 * 1024) {
        return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
      } else {
        return `${(totalBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      }
      
    } catch (error) {
      console.warn('⚠️ 파일 크기 추정 실패:', error);
      return '크기 계산 불가';
    }
  }
}

export default WebMVideoEncoder;