import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

/**
 * 🎬 FFmpeg.js 기반 비디오 인코더
 * MediaRecorder 호환성 문제를 해결하는 안정적인 대안
 * 프레임별 캡처 → FFmpeg 변환 방식
 */
export class FFmpegVideoEncoder {
  constructor() {
    this.ffmpeg = null;
    this.isInitialized = false;
    this.frames = [];
    this.audioData = null;
    this.isProcessing = false;
    
    // 기본 설정
    this.defaultOptions = {
      fps: 30,
      width: 1280,
      height: 720,
      videoBitrate: '5000k',
      audioBitrate: '128k',
      format: 'mp4' // mp4, webm 지원
    };
  }

  /**
   * 🚀 FFmpeg 초기화 (디버깅 개선)
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // 1. 브라우저 지원 여부 사전 체크
      console.log('🔍 브라우저 지원 기능 확인 중...');
      const supportInfo = this.checkBrowserSupport();
      console.log('📊 브라우저 지원 정보:', supportInfo);
      
      if (!supportInfo.basicSupport) {
        throw new Error('브라우저가 기본 요구사항을 지원하지 않습니다');
      }

      if (!supportInfo.sharedArrayBuffer) {
        console.warn('⚠️ SharedArrayBuffer가 지원되지 않습니다 - 성능이 제한될 수 있습니다');
      }

      console.log('🚀 FFmpeg.js 초기화 시작...');
      
      this.ffmpeg = new FFmpeg();
      
      // 상세 로깅 설정
      this.ffmpeg.on('log', ({ type, message }) => {
        console.log(`[FFmpeg ${type}] ${message}`);
      });

      // 진행률 추적
      this.ffmpeg.on('progress', (progress) => {
        console.log(`FFmpeg 진행률: ${Math.round(progress.ratio * 100)}% - ${progress.time}/${progress.duration}`);
      });

      // 2. WASM 파일 URL 검증
      const baseURL = '/ffmpeg';
      const coreURL = `${baseURL}/ffmpeg-core.js`;
      const wasmURL = `${baseURL}/ffmpeg-core.wasm`;
      
      console.log('📂 WASM 파일 접근성 확인 중...');
      await this.validateWasmFiles(coreURL, wasmURL);
      
      // 3. 타임아웃이 있는 FFmpeg 로드
      console.log('⏳ FFmpeg WASM 로딩 중... (최대 30초)');
      
      const loadPromise = this.ffmpeg.load({
        coreURL: await toBlobURL(coreURL, 'text/javascript'),
        wasmURL: await toBlobURL(wasmURL, 'application/wasm'),
      });

      // 30초 타임아웃 적용
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('FFmpeg 초기화 30초 타임아웃'));
        }, 30000);
      });

      await Promise.race([loadPromise, timeoutPromise]);

      this.isInitialized = true;
      console.log('✅ FFmpeg.js 초기화 완료!');

    } catch (error) {
      console.error('❌ FFmpeg.js 초기화 실패:', error);
      
      // 상세한 오류 분석
      if (error.message.includes('SharedArrayBuffer')) {
        console.error('💡 해결책: Cross-Origin Isolation 헤더가 필요합니다');
      } else if (error.message.includes('fetch')) {
        console.error('💡 해결책: WASM 파일 경로를 확인하세요');
      } else if (error.message.includes('timeout')) {
        console.error('💡 해결책: 네트워크 연결을 확인하거나 대안 방법을 사용하세요');
      }
      
      throw new Error(`FFmpeg 초기화 실패: ${error.message}`);
    }
  }

  /**
   * 🔍 브라우저 지원 기능 확인
   * @returns {Object}
   */
  checkBrowserSupport() {
    const support = {
      basicSupport: true,
      webAssembly: typeof WebAssembly !== 'undefined',
      sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
      crossOriginIsolated: typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated,
      canvasCapture: typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype.toBlob,
      fetch: typeof fetch !== 'undefined'
    };

    // 기본 지원 여부 계산
    support.basicSupport = support.webAssembly && support.canvasCapture && support.fetch;
    
    return support;
  }

  /**
   * 📂 WASM 파일 접근성 검증
   * @param {string} coreURL 
   * @param {string} wasmURL 
   * @returns {Promise<void>}
   */
  async validateWasmFiles(coreURL, wasmURL) {
    try {
      // Core JS 파일 확인
      const coreResponse = await fetch(coreURL, { method: 'HEAD' });
      if (!coreResponse.ok) {
        throw new Error(`Core JS 파일 접근 실패: ${coreResponse.status}`);
      }
      console.log('✅ ffmpeg-core.js 접근 가능');

      // WASM 파일 확인  
      const wasmResponse = await fetch(wasmURL, { method: 'HEAD' });
      if (!wasmResponse.ok) {
        throw new Error(`WASM 파일 접근 실패: ${wasmResponse.status}`);
      }
      console.log('✅ ffmpeg-core.wasm 접근 가능');

    } catch (error) {
      console.error('❌ WASM 파일 검증 실패:', error);
      throw new Error(`WASM 파일 접근 불가: ${error.message}`);
    }
  }

  /**
   * 🎬 비디오 내보내기 시작
   * @param {Object} options - 내보내기 옵션
   * @returns {Promise<void>}
   */
  async startRecording(options = {}) {
    const config = { ...this.defaultOptions, ...options };
    
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isProcessing) {
      throw new Error('이미 처리 중입니다');
    }

    console.log('🎬 FFmpeg 기반 녹화 시작:', config);
    
    this.frames = [];
    this.audioData = null;
    this.isProcessing = true;
    this.config = config;
    
    console.log('✅ 녹화 준비 완료 - 프레임 추가 대기 중');
  }

  /**
   * 🖼️ 프레임 추가 (Canvas에서)
   * @param {HTMLCanvasElement} canvas - 캡처할 캔버스
   * @param {number} timestamp - 프레임 타임스탬프 (초)
   * @returns {Promise<void>}
   */
  async addFrame(canvas, timestamp = 0) {
    if (!this.isProcessing) {
      throw new Error('녹화가 시작되지 않았습니다');
    }

    try {
      // Canvas를 PNG Blob으로 변환
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/png');
      });

      if (!blob) {
        throw new Error('Canvas를 Blob으로 변환 실패');
      }

      // Blob을 ArrayBuffer로 변환
      const arrayBuffer = await blob.arrayBuffer();
      
      this.frames.push({
        data: new Uint8Array(arrayBuffer),
        timestamp: timestamp,
        filename: `frame_${String(this.frames.length).padStart(6, '0')}.png`
      });

      console.log(`📸 프레임 추가: ${this.frames.length}개 (${timestamp.toFixed(3)}s)`);

    } catch (error) {
      console.error('❌ 프레임 추가 실패:', error);
      throw error;
    }
  }

  /**
   * 🔊 원본 비디오에서 오디오 추출
   * @param {HTMLVideoElement} videoElement - 원본 비디오
   * @param {number} startTime - 시작 시간 (초)
   * @param {number} duration - 지속 시간 (초)
   * @returns {Promise<void>}
   */
  async extractAudio(videoElement, startTime = 0, duration = null) {
    try {
      console.log('🔊 원본 비디오에서 오디오 추출 중...');

      // 비디오 소스 URL 가져오기
      const videoURL = videoElement.src || videoElement.currentSrc;
      if (!videoURL) {
        console.warn('⚠️ 비디오 소스 URL을 찾을 수 없음 - 오디오 없이 진행');
        return;
      }

      // 원본 비디오를 FFmpeg에 로드
      const videoResponse = await fetch(videoURL);
      if (!videoResponse.ok) {
        throw new Error('비디오 파일 다운로드 실패');
      }

      const videoData = new Uint8Array(await videoResponse.arrayBuffer());
      await this.ffmpeg.writeFile('input_video.mp4', videoData);

      // 오디오 추출 명령
      const extractArgs = [
        '-i', 'input_video.mp4',
        '-vn', // 비디오 스트림 제외
        '-acodec', 'aac',
        '-b:a', this.config.audioBitrate,
      ];

      // 시간 범위 설정
      if (startTime > 0) {
        extractArgs.push('-ss', startTime.toString());
      }
      
      if (duration !== null) {
        extractArgs.push('-t', duration.toString());
      }

      extractArgs.push('extracted_audio.aac');

      await this.ffmpeg.exec(extractArgs);
      
      // 추출된 오디오 데이터 읽기
      this.audioData = await this.ffmpeg.readFile('extracted_audio.aac');
      
      console.log('✅ 오디오 추출 완료:', this.audioData.length, 'bytes');

    } catch (error) {
      console.warn('⚠️ 오디오 추출 실패 - 오디오 없이 진행:', error.message);
      this.audioData = null;
    }
  }

  /**
   * 🎬 녹화 완료 및 비디오 생성
   * @param {Function} onProgress - 진행률 콜백
   * @returns {Promise<Blob>} - 완성된 비디오 Blob
   */
  async stopRecording(onProgress = null) {
    if (!this.isProcessing) {
      throw new Error('진행 중인 녹화가 없습니다');
    }

    if (this.frames.length === 0) {
      throw new Error('추가된 프레임이 없습니다');
    }

    try {
      console.log(`🎬 비디오 생성 시작: ${this.frames.length}개 프레임`);
      
      // 진행률 업데이트
      const updateProgress = (stage, progress, message = '') => {
        if (onProgress) {
          onProgress({ stage, progress, message });
        }
      };

      updateProgress('processing', 0.1, '프레임 데이터 준비 중...');

      // 1단계: 모든 프레임을 FFmpeg에 저장
      for (let i = 0; i < this.frames.length; i++) {
        const frame = this.frames[i];
        await this.ffmpeg.writeFile(frame.filename, frame.data);
        
        if (i % 10 === 0) { // 10프레임마다 진행률 업데이트
          const progress = 0.1 + (i / this.frames.length) * 0.3;
          updateProgress('processing', progress, `프레임 저장 중... ${i+1}/${this.frames.length}`);
        }
      }

      updateProgress('processing', 0.4, 'FFmpeg 비디오 인코딩 시작...');

      // 2단계: FFmpeg 명령으로 비디오 생성
      const ffmpegArgs = [
        '-framerate', this.config.fps.toString(),
        '-i', 'frame_%06d.png',
        '-c:v', this.config.format === 'webm' ? 'libvpx-vp9' : 'libx264',
        '-b:v', this.config.videoBitrate,
        '-pix_fmt', 'yuv420p',
      ];

      // 오디오가 있으면 추가
      if (this.audioData) {
        await this.ffmpeg.writeFile('audio.aac', this.audioData);
        ffmpegArgs.push('-i', 'audio.aac');
        ffmpegArgs.push('-c:a', 'aac');
        ffmpegArgs.push('-b:a', this.config.audioBitrate);
        ffmpegArgs.push('-shortest'); // 비디오와 오디오 중 짧은 것에 맞춤
      }

      const outputFile = `output.${this.config.format}`;
      ffmpegArgs.push(outputFile);

      // FFmpeg 실행
      updateProgress('processing', 0.5, 'FFmpeg 인코딩 실행 중...');
      
      // 진행률 추적을 위한 이벤트 리스너 설정
      this.ffmpeg.on('progress', (progress) => {
        const overallProgress = 0.5 + (progress.ratio * 0.4);
        updateProgress('processing', overallProgress, `인코딩 중... ${Math.round(progress.ratio * 100)}%`);
      });

      await this.ffmpeg.exec(ffmpegArgs);

      updateProgress('processing', 0.9, '비디오 파일 생성 완료, 읽는 중...');

      // 3단계: 완성된 비디오 읽기
      const videoData = await this.ffmpeg.readFile(outputFile);
      
      // 비디오 Blob 생성
      const mimeType = this.config.format === 'webm' ? 'video/webm' : 'video/mp4';
      const videoBlob = new Blob([videoData], { type: mimeType });

      updateProgress('processing', 1.0, '비디오 생성 완료!');

      console.log(`✅ 비디오 생성 완료: ${videoBlob.size} bytes (${mimeType})`);
      
      return videoBlob;

    } catch (error) {
      console.error('❌ 비디오 생성 실패:', error);
      throw new Error(`비디오 생성 실패: ${error.message}`);
    } finally {
      // 리소스 정리
      this.cleanup();
    }
  }

  /**
   * 📊 현재 상태 정보
   * @returns {Object}
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isProcessing: this.isProcessing,
      framesCount: this.frames.length,
      hasAudio: !!this.audioData,
      audioSize: this.audioData ? this.audioData.length : 0
    };
  }

  /**
   * 🧹 리소스 정리
   */
  cleanup() {
    console.log('🧹 FFmpeg 리소스 정리 중...');
    
    this.frames = [];
    this.audioData = null;
    this.isProcessing = false;
    this.config = null;

    // FFmpeg 임시 파일들 정리
    if (this.ffmpeg && this.isInitialized) {
      try {
        // 모든 임시 파일 삭제 시도 (에러 무시)
        this.ffmpeg.listDir('/').then(files => {
          files.forEach(file => {
            if (file.name && !file.isDir) {
              this.ffmpeg.deleteFile(file.name).catch(() => {});
            }
          });
        }).catch(() => {});
      } catch (error) {
        console.warn('⚠️ FFmpeg 파일 정리 중 오류:', error);
      }
    }

    console.log('✅ FFmpeg 정리 완료');
  }

  /**
   * 🔧 지원 기능 확인
   * @returns {Object}
   */
  static getSupportInfo() {
    return {
      ffmpeg: typeof FFmpeg !== 'undefined',
      sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
      webAssembly: typeof WebAssembly !== 'undefined',
      crossOriginIsolated: typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated
    };
  }
}

export default FFmpegVideoEncoder;