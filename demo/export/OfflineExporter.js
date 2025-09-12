import { FFmpegVideoEncoder } from './FFmpegVideoEncoder.js';
import { WebMVideoEncoder } from './WebMVideoEncoder.js';
import { RealtimeVideoEncoder } from './RealtimeVideoEncoder.js';
import html2canvas from 'html2canvas';

/**
 * 🎬 하이브리드 오프라인 비디오 내보내기
 * FFmpeg.js (우선) → WebM Writer (대안) 자동 전환 시스템
 * MediaRecorder 호환성 문제를 완전히 해결
 */
export class OfflineExporter {
  constructor(videoElement, containerElement, renderer = null) {
    this.video = videoElement;
    this.container = containerElement;
    this.renderer = renderer;
    
    // 하이브리드 인코더 시스템
    this.realtimeEncoder = new RealtimeVideoEncoder(); // 최우선 실시간 인코더
    this.ffmpegEncoder = new FFmpegVideoEncoder();
    this.webmEncoder = new WebMVideoEncoder();
    this.activeEncoder = null; // 현재 사용 중인 인코더
    this.encoderType = null; // 'realtime', 'ffmpeg', 또는 'webm'
    
    this.isExporting = false;
    this.currentExportId = null;
    this.abortController = null;
    this.exportCanvas = null;
    
    // 캡처 상태 추적
    this.capturedFrames = 0;
    this.totalFrames = 0;
    this.startTime = 0;
    this.exportStartTime = 0;
  }

  /**
   * 🎬 하이브리드 비디오 내보내기 (FFmpeg → WebM Writer 자동 전환)
   * @param {Object} options - 내보내기 옵션
   * @param {Function} onProgress - 진행률 콜백
   * @returns {Promise<Blob>} - 완성된 비디오 Blob
   */
  async exportVideo(options = {}, onProgress = null) {
    if (this.isExporting) {
      throw new Error('이미 내보내기가 진행 중입니다');
    }

    const {
      fps = 30,
      width = 1280,
      height = 720,
      quality = 0.8,
      startTime = 0,
      endTime = null,
      filename = 'motiontext-export',
      downloadAutomatically = true,
      format = 'mp4', // mp4 또는 webm (webm으로 fallback 가능)
      includeAudio = true, // 오디오 포함 여부 (WebM Writer는 미지원)
      preferEncoder = 'auto' // 'realtime', 'ffmpeg', 'webm', 'auto'
    } = options;

    // 실제 내보낼 시간 계산
    const videoDuration = this.video.duration || 10;
    const exportEndTime = endTime !== null ? Math.min(endTime, videoDuration) : videoDuration;
    const exportDuration = exportEndTime - startTime;
    const exportId = Date.now().toString();

    console.log(`🎬 FFmpeg 기반 내보내기 시작: ${exportDuration}s at ${fps}fps (${width}x${height})`);
    console.log(`📍 내보내기 범위: ${startTime}s → ${exportEndTime}s`);

    this.isExporting = true;
    this.currentExportId = exportId;
    this.abortController = new AbortController();
    this.exportStartTime = Date.now();
    
    // 총 프레임 수 계산
    this.totalFrames = Math.ceil(exportDuration * fps);
    this.capturedFrames = 0;

    try {
      // 진행률 업데이트 헬퍼
      const updateProgress = (stage, progress, message = '') => {
        if (onProgress && !this.abortController.signal.aborted) {
          onProgress({
            exportId,
            stage,
            progress: Math.max(0, Math.min(1, progress)),
            message,
            timestamp: Date.now(),
            framesProcessed: this.capturedFrames,
            totalFrames: this.totalFrames
          });
        }
      };

      updateProgress('initialization', 0.0, '인코더 선택 중...');

      // 1단계: 최적 인코더 선택
      const selectedEncoder = await this.selectBestEncoder(preferEncoder, format, includeAudio);
      this.activeEncoder = selectedEncoder.encoder;
      this.encoderType = selectedEncoder.type;
      
      updateProgress('initialization', 0.05, `${selectedEncoder.name} 초기화 중...`);
      console.log(`🎯 선택된 인코더: ${selectedEncoder.name} (${selectedEncoder.reason})`);

      // 2단계: 선택된 인코더 초기화
      await this.activeEncoder.initialize();
      updateProgress('initialization', 0.1, `${selectedEncoder.name} 초기화 완료`);

      // 3단계: 내보내기용 캔버스 생성
      this.exportCanvas = this.createExportCanvas(width, height);
      updateProgress('initialization', 0.15, '캔버스 설정 완료');

      // 4단계: 인코더 녹화 시작 (실시간 인코더 전용 로직 추가)
      let encoderOptions;
      
      if (this.encoderType === 'realtime') {
        // 실시간 인코더는 비디오+컨테이너 요소 필요
        encoderOptions = {
          width, height, fps,
          videoBitsPerSecond: parseInt(this.calculateVideoBitrate(width, height, fps, quality)) * 1000,
          audioBitsPerSecond: includeAudio ? 128000 : 0
        };
        
        // 실시간 녹화 시작 (기존 captureFrames 과정을 우회)
        await this.activeEncoder.startRealTimeRecording(this.video, this.container, encoderOptions);
        updateProgress('initialization', 0.2, '실시간 녹화 시작됨');
        
      } else if (this.encoderType === 'ffmpeg') {
        encoderOptions = {
          fps, width, height, format,
          videoBitrate: this.calculateVideoBitrate(width, height, fps, quality),
          audioBitrate: '128k'
        };
        await this.activeEncoder.startRecording(encoderOptions);
        
      } else {
        // WebM Writer
        encoderOptions = {
          fps, width, height, quality, format: 'webm'
        };
        await this.activeEncoder.startRecording(encoderOptions);
      }
      updateProgress('initialization', 0.2, `${selectedEncoder.name} 인코더 준비 완료`);

      // 5단계: 오디오 추출 (FFmpeg만 지원)
      if (includeAudio && this.encoderType === 'ffmpeg') {
        updateProgress('audio', 0.25, '원본 비디오에서 오디오 추출 중...');
        try {
          await this.activeEncoder.extractAudio(this.video, startTime, exportDuration);
          updateProgress('audio', 0.3, '오디오 추출 완료');
        } catch (error) {
          console.warn('⚠️ 오디오 추출 실패 - 비디오만 내보내기:', error.message);
          updateProgress('audio', 0.3, '오디오 추출 실패 - 비디오만 진행');
        }
      } else if (includeAudio && this.encoderType === 'webm') {
        console.warn('⚠️ WebM Writer는 오디오를 지원하지 않습니다 - 비디오만 진행');
        updateProgress('audio', 0.3, 'WebM Writer - 오디오 미지원');
      } else {
        updateProgress('audio', 0.3, '오디오 생략');
      }

      // 5단계: 프레임 처리 (실시간은 자동, 다른 인코더는 수동 캡처)
      if (this.encoderType === 'realtime') {
        // 실시간 인코더: 실제 비디오 재생을 통해 자동 캡처
        updateProgress('capture', 0.3, '실시간 녹화 진행 중...');
        await this.realtimeVideoCapture(startTime, exportEndTime, updateProgress);
        
      } else {
        // 기존 프레임별 캡처 방식 (FFmpeg, WebM Writer)
        updateProgress('capture', 0.3, '프레임 캡처 시작...');
        await this.captureFrames({
          startTime,
          endTime: exportEndTime,
          fps,
          updateProgress
        });
      }

      // 6단계: 비디오 생성
      const encoderName = this.encoderType === 'realtime' ? '실시간 MediaRecorder' : 
                          this.encoderType === 'ffmpeg' ? 'FFmpeg' : 'WebM Writer';
      updateProgress('encoding', 0.8, `${encoderName} 비디오 인코딩 시작...`);
      
      const videoBlob = await this.activeEncoder.stopRecording((encoderProgress) => {
        // 인코더 진행률을 전체 진행률에 반영 (80% ~ 95%)
        const overallProgress = 0.8 + (encoderProgress.progress * 0.15);
        updateProgress('encoding', overallProgress, encoderProgress.message || `${encoderName} 인코딩 중...`);
      });

      // 7단계: 완료 및 다운로드
      updateProgress('finalization', 0.95, '내보내기 완료, 파일 준비 중...');
      
      const fileSizeMB = Math.round(videoBlob.size / 1024 / 1024);
      const processingTime = Math.round((Date.now() - this.exportStartTime) / 1000);
      
      updateProgress('finalization', 1.0, 
        `내보내기 완료! (${fileSizeMB}MB, ${processingTime}초 소요)`);

      // 8단계: 자동 다운로드 (선택적)
      if (downloadAutomatically) {
        const actualFormat = this.encoderType === 'webm' ? 'webm' : format;
        const extension = actualFormat === 'webm' ? 'webm' : 'mp4';
        this.downloadBlob(videoBlob, `${filename}.${extension}`);
      }

      console.log(`✅ ${encoderName} 내보내기 완료: ${videoBlob.size} bytes (${processingTime}초)`);
      return videoBlob;

    } catch (error) {
      console.error('❌ FFmpeg 내보내기 실패:', error);
      
      if (onProgress) {
        onProgress({
          exportId,
          stage: 'error',
          progress: 0,
          error: error.message,
          timestamp: Date.now()
        });
      }
      
      throw error;
    } finally {
      // 리소스 정리
      this.cleanup();
    }
  }

  /**
   * 🚀 실시간 비디오 캡처 (MediaRecorder 전용)
   * @param {number} startTime - 시작 시간
   * @param {number} endTime - 종료 시간  
   * @param {Function} updateProgress - 진행률 업데이트
   * @returns {Promise<void>}
   */
  async realtimeVideoCapture(startTime, endTime, updateProgress) {
    const duration = endTime - startTime;
    
    console.log(`🚀 실시간 비디오 캡처: ${startTime}s → ${endTime}s (${duration}s)`);
    
    try {
      // 비디오 시작 위치로 이동
      this.video.currentTime = startTime;
      await this.waitForVideoSeek();
      
      // 렌더러 동기화
      if (this.renderer) {
        this.renderer.seek(startTime);
        console.log(`🎭 렌더러 동기화: ${startTime}s`);
      }
      
      // 실시간 재생 시작
      console.log('🎬 실시간 재생 시작...');
      this.video.play();
      
      // 재생 완료까지 대기하며 진행률 업데이트
      const startPlayTime = Date.now();
      let lastProgressTime = Date.now();
      
      return new Promise((resolve, reject) => {
        const checkProgress = () => {
          try {
            if (this.abortController.signal.aborted) {
              this.video.pause();
              reject(new Error('사용자에 의해 취소됨'));
              return;
            }
            
            const currentTime = this.video.currentTime;
            const playProgress = Math.min(1, Math.max(0, (currentTime - startTime) / duration));
            
            // 진행률 업데이트 (30% ~ 80% 구간)
            const overallProgress = 0.3 + (playProgress * 0.5);
            
            // 1초마다 진행률 업데이트
            if (Date.now() - lastProgressTime > 1000) {
              updateProgress('capture', overallProgress, 
                `실시간 캡처 진행 중... ${Math.round(playProgress * 100)}% (${currentTime.toFixed(1)}s/${endTime}s)`);
              lastProgressTime = Date.now();
            }
            
            // 종료 조건 확인
            if (currentTime >= endTime || this.video.ended || this.video.paused) {
              console.log(`✅ 실시간 캡처 완료: ${currentTime.toFixed(3)}s`);
              this.video.pause();
              this.video.currentTime = startTime; // 원래 위치로 복원
              resolve();
              return;
            }
            
            // 다음 체크
            setTimeout(checkProgress, 100); // 100ms마다 체크
            
          } catch (error) {
            this.video.pause();
            reject(error);
          }
        };
        
        // 진행 체크 시작
        setTimeout(checkProgress, 100);
      });
      
    } catch (error) {
      console.error('❌ 실시간 비디오 캡처 실패:', error);
      this.video.pause();
      throw error;
    }
  }

  /**
   * 🎯 프레임별 정확한 캡처
   * @param {Object} params - 캡처 파라미터
   * @returns {Promise<void>}
   */
  async captureFrames({ startTime, endTime, fps, updateProgress }) {
    const duration = endTime - startTime;
    const frameInterval = 1 / fps; // 프레임 간격 (초)
    
    console.log(`🎯 정확한 프레임 캡처: ${duration}s, ${fps}fps, 총 ${this.totalFrames}개 프레임`);
    
    // 비디오 준비
    this.video.currentTime = startTime;
    await this.waitForVideoSeek();
    
    // 렌더러 동기화
    if (this.renderer) {
      this.renderer.seek(startTime);
      console.log(`🎭 렌더러 동기화: ${startTime}s`);
    }

    // 정확한 시간별 프레임 캡처
    for (let frameIndex = 0; frameIndex < this.totalFrames; frameIndex++) {
      // 중단 신호 체크
      if (this.abortController.signal.aborted) {
        console.log('🛑 프레임 캡처 중단됨');
        break;
      }

      // 정확한 프레임 시간 계산
      const frameTime = startTime + (frameIndex * frameInterval);
      
      if (frameTime > endTime) {
        break; // 끝 시간 초과
      }

      // 비디오 시간 설정
      this.video.currentTime = frameTime;
      await this.waitForVideoSeek();
      
      // 렌더러 동기화 (있다면)
      if (this.renderer) {
        this.renderer.seek(frameTime);
      }

      // 약간의 안정화 대기
      await new Promise(resolve => setTimeout(resolve, 50));

      // 현재 프레임 캡처
      await this.captureCurrentFrame(frameTime);
      
      // 활성화된 인코더에 프레임 추가
      await this.activeEncoder.addFrame(this.exportCanvas, frameTime - startTime);
      
      this.capturedFrames++;

      // 진행률 업데이트 (30% ~ 80% 구간)
      const captureProgress = this.capturedFrames / this.totalFrames;
      const overallProgress = 0.3 + (captureProgress * 0.5);
      
      updateProgress('capture', overallProgress, 
        `프레임 캡처 중... ${this.capturedFrames}/${this.totalFrames} (${Math.round(captureProgress * 100)}%)`);

      console.log(`📸 프레임 캡처: ${frameIndex + 1}/${this.totalFrames} (${frameTime.toFixed(3)}s)`);
    }

    console.log(`✅ 프레임 캡처 완료: ${this.capturedFrames}개 프레임`);
  }

  /**
   * 🖼️ 현재 화면을 캔버스에 캡처
   * @param {number} currentTime - 현재 시간 (디버깅용)
   * @returns {Promise<void>}
   */
  async captureCurrentFrame(currentTime = 0) {
    try {
      // html2canvas로 정확한 DOM 캡처
      await html2canvas(this.container, {
        canvas: this.exportCanvas, // 기존 캔버스 재사용
        width: this.exportCanvas.width,
        height: this.exportCanvas.height,
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#000000',
        logging: false,
        foreignObjectRendering: true, // 비디오 요소 렌더링 개선
        ignoreElements: (element) => {
          // 불필요한 요소들 제외 (컨트롤러, 커서 등)
          return element.classList && (
            element.classList.contains('video-controls') ||
            element.classList.contains('cursor') ||
            element.classList.contains('export-progress')
          );
        }
      });
      
    } catch (error) {
      console.warn('⚠️ 프레임 캡처 실패:', error);
      
      // Fallback: 검은 화면 그리기
      const ctx = this.exportCanvas.getContext('2d');
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, this.exportCanvas.width, this.exportCanvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('캡처 오류', this.exportCanvas.width / 2, this.exportCanvas.height / 2);
      ctx.fillText(`시간: ${currentTime.toFixed(2)}s`, this.exportCanvas.width / 2, this.exportCanvas.height / 2 + 30);
    }
  }

  /**
   * 📐 내보내기용 캔버스 생성
   * @param {number} width - 캔버스 너비
   * @param {number} height - 캔버스 높이
   * @returns {HTMLCanvasElement}
   */
  createExportCanvas(width, height) {
    console.log(`🖼️ 내보내기 캔버스 생성: ${width}x${height}`);
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.position = 'fixed';
    canvas.style.top = '-10000px';
    canvas.style.left = '-10000px';
    canvas.style.zIndex = '-9999';
    canvas.style.pointerEvents = 'none';
    
    // DOM에 추가 (html2canvas가 요구함)
    document.body.appendChild(canvas);
    
    return canvas;
  }

  /**
   * 🎯 비트레이트 계산 (품질 기반)
   * @param {number} width - 비디오 너비
   * @param {number} height - 비디오 높이
   * @param {number} fps - 프레임레이트
   * @param {number} quality - 품질 (0.0 ~ 1.0)
   * @returns {string} - 비트레이트 문자열 (예: "5000k")
   */
  calculateVideoBitrate(width, height, fps, quality) {
    const pixels = width * height;
    const baseRate = pixels * fps * 0.1; // 기본 비트레이트
    const qualityMultiplier = 0.5 + (quality * 1.5); // 0.5x ~ 2.0x
    const finalBitrate = Math.round(baseRate * qualityMultiplier / 1000); // kbps
    
    return `${Math.max(500, Math.min(50000, finalBitrate))}k`; // 500k ~ 50M 제한
  }

  /**
   * ⏳ 비디오 시킹 완료 대기
   * @returns {Promise<void>}
   */
  async waitForVideoSeek() {
    return new Promise((resolve) => {
      const onSeeked = () => {
        this.video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      
      if (this.video.readyState >= 2) {
        resolve();
      } else {
        this.video.addEventListener('seeked', onSeeked);
      }
      
      // 타임아웃 보호
      setTimeout(resolve, 1000);
    });
  }

  /**
   * 💾 Blob 파일 다운로드
   * @param {Blob} blob - 다운로드할 블롭
   * @param {string} filename - 파일명
   */
  downloadBlob(blob, filename) {
    console.log(`💾 다운로드: ${filename} (${Math.round(blob.size / 1024 / 1024)}MB)`);
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // 메모리 해제
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    
    console.log(`✅ 다운로드 시작: ${filename}`);
  }

  /**
   * 🛑 내보내기 중단
   */
  cancelExport() {
    if (!this.isExporting) {
      console.warn('⚠️ 진행 중인 내보내기가 없습니다');
      return;
    }
    
    console.log('🛑 FFmpeg 내보내기 취소 중...');
    
    if (this.abortController) {
      this.abortController.abort();
    }
    
    this.cleanup();
    console.log('✅ 내보내기 취소됨');
  }

  /**
   * 🧹 리소스 정리 및 상태 복원
   */
  cleanup() {
    console.log('🧹 FFmpeg 내보내기 리소스 정리 중...');
    
    // 1. 내보내기 상태 초기화
    this.isExporting = false;
    this.currentExportId = null;
    this.capturedFrames = 0;
    this.totalFrames = 0;
    this.exportStartTime = 0;
    
    // 2. AbortController 정리
    if (this.abortController) {
      try {
        if (!this.abortController.signal.aborted) {
          this.abortController.abort();
        }
      } catch (error) {
        console.warn('⚠️ AbortController 정리 오류:', error);
      }
      this.abortController = null;
    }
    
    // 3. 활성화된 인코더 정리
    if (this.activeEncoder) {
      try {
        this.activeEncoder.cleanup();
      } catch (error) {
        console.warn(`⚠️ ${this.encoderType} 인코더 정리 오류:`, error);
      }
    }
    
    // 인코더 레퍼런스 정리
    this.activeEncoder = null;
    this.encoderType = null;
    
    // 4. Export Canvas 정리
    if (this.exportCanvas) {
      try {
        if (document.body.contains(this.exportCanvas)) {
          document.body.removeChild(this.exportCanvas);
          console.log('🗑️ 내보내기 캔버스 제거됨');
        }
      } catch (error) {
        console.warn('⚠️ 캔버스 정리 오류:', error);
      }
      this.exportCanvas = null;
    }
    
    // 5. 비디오 상태 복원
    if (this.video) {
      try {
        console.log('📹 비디오 상태 복원 중...');
        
        this.video.pause();
        this.video.playbackRate = 1.0;
        
        if (this.video.muted) {
          this.video.muted = false;
        }
        
        console.log('✅ 비디오 상태 복원 완료');
      } catch (error) {
        console.error('❌ 비디오 상태 복원 실패:', error);
      }
    }
    
    // 6. 렌더러 상태 복원
    if (this.renderer) {
      try {
        console.log('🎭 렌더러 상태 복원...');
        // 필요시 추가 복원 로직
      } catch (error) {
        console.warn('⚠️ 렌더러 상태 복원 오류:', error);
      }
    }
    
    console.log('✅ FFmpeg 리소스 정리 완료');
  }

  /**
   * 📊 내보내기 상태 정보
   * @returns {Object}
   */
  getExportStatus() {
    return {
      isExporting: this.isExporting,
      currentExportId: this.currentExportId,
      capturedFrames: this.capturedFrames,
      totalFrames: this.totalFrames,
      exportStartTime: this.exportStartTime,
      encoderStatus: this.videoEncoder ? this.videoEncoder.getStatus() : null
    };
  }

  /**
   * 📊 파일 크기 추정 (FFmpeg 기반)
   * @param {number} width - 비디오 너비
   * @param {number} height - 비디오 높이  
   * @param {number} fps - 프레임레이트
   * @param {number} duration - 지속시간 (초)
   * @param {number} quality - 품질 (0.0 ~ 1.0)
   * @returns {string} - 추정 파일 크기
   */
  estimateFileSize(width, height, fps, duration, quality = 0.8) {
    try {
      // FFmpeg H.264 인코딩 기준 추정
      const bitrate = this.calculateVideoBitrate(width, height, fps, quality);
      const bitrateNum = parseInt(bitrate) * 1000; // bps로 변환
      
      // 비디오 크기 (비트)
      const videoBits = bitrateNum * duration;
      
      // 오디오 크기 (128kbps 가정)
      const audioBits = 128000 * duration;
      
      // 총 크기 (바이트)
      const totalBytes = (videoBits + audioBits) / 8;
      
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

  /**
   * ⏰ 시간 포맷팅 유틸리티
   * @param {number} milliseconds - 밀리초
   * @returns {string} - 포맷된 시간 문자열
   */
  formatTime(milliseconds) {
    try {
      if (!milliseconds || milliseconds < 0) {
        return '0초';
      }

      const totalSeconds = Math.round(milliseconds / 1000);
      
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const parts = [];

      if (hours > 0) {
        parts.push(`${hours}시간`);
      }
      
      if (minutes > 0) {
        parts.push(`${minutes}분`);
      }
      
      if (seconds > 0 || parts.length === 0) {
        parts.push(`${seconds}초`);
      }

      return parts.join(' ');
      
    } catch (error) {
      console.warn('⚠️ 시간 포맷팅 실패:', error);
      return '시간 계산 불가';
    }
  }

  /**
   * 🎯 최적 인코더 선택 (핵심 로직 - 실시간 우선)
   * @param {string} preferEncoder - 선호 인코더 ('auto', 'realtime', 'ffmpeg', 'webm')
   * @param {string} format - 요청된 포맷 ('mp4', 'webm')
   * @param {boolean} includeAudio - 오디오 포함 여부
   * @returns {Promise<Object>} - 선택된 인코더 정보
   */
  async selectBestEncoder(preferEncoder, format, includeAudio) {
    console.log(`🔍 인코더 선택 중... (선호: ${preferEncoder}, 포맷: ${format}, 오디오: ${includeAudio})`);

    // 수동 선택인 경우
    if (preferEncoder === 'realtime') {
      return {
        encoder: this.realtimeEncoder,
        type: 'realtime',
        name: 'MediaRecorder 실시간',
        reason: '수동 선택됨'
      };
    } else if (preferEncoder === 'ffmpeg') {
      return {
        encoder: this.ffmpegEncoder,
        type: 'ffmpeg',
        name: 'FFmpeg.js',
        reason: '수동 선택됨'
      };
    } else if (preferEncoder === 'webm') {
      return {
        encoder: this.webmEncoder,
        type: 'webm',
        name: 'WebM Writer',
        reason: '수동 선택됨'
      };
    }

    // 자동 선택 ('auto') - 실시간 인코더 우선
    try {
      // 1순위: MediaRecorder 실시간 인코더 (FFmpeg.js 우회, 최고 성능)
      console.log('🚀 실시간 인코더 호환성 테스트 중...');
      
      try {
        const realtimeSupport = this.realtimeEncoder.checkBrowserSupport();
        console.log('📊 실시간 인코더 브라우저 지원:', realtimeSupport);
        
        if (realtimeSupport.mediaRecorder && realtimeSupport.canvasCapture) {
          // 실시간 인코더 초기화 (즉시 완료)
          await this.realtimeEncoder.initialize();
          
          const reason = includeAudio ? 
            '실시간 + 오디오 지원' : 
            '최고 성능 실시간 처리';

          return {
            encoder: this.realtimeEncoder,
            type: 'realtime',
            name: 'MediaRecorder 실시간',
            reason: reason
          };
        } else {
          throw new Error(`브라우저 지원 부족: MediaRecorder=${realtimeSupport.mediaRecorder}, CanvasCapture=${realtimeSupport.canvasCapture}`);
        }

      } catch (realtimeError) {
        console.warn('⚠️ 실시간 인코더 초기화 실패:', realtimeError.message);
        console.log('🔄 FFmpeg.js로 대체 시도...');
      }

      // 2순위: FFmpeg.js 시도 (오디오 지원, 더 많은 포맷 지원)
      if (includeAudio || format === 'mp4') {
        console.log('🧪 FFmpeg.js 호환성 테스트 중...');
        
        try {
          // 빠른 호환성 테스트 (실제 초기화 없이)
          const ffmpegSupport = this.ffmpegEncoder.checkBrowserSupport();
          console.log('📊 FFmpeg 브라우저 지원:', ffmpegSupport);
          
          if (ffmpegSupport.basicSupport && ffmpegSupport.sharedArrayBuffer) {
            // FFmpeg 초기화 테스트 (타임아웃 5초)
            const initPromise = this.ffmpegEncoder.initialize();
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('초기화 타임아웃')), 5000);
            });

            await Promise.race([initPromise, timeoutPromise]);

            return {
              encoder: this.ffmpegEncoder,
              type: 'ffmpeg',
              name: 'FFmpeg.js',
              reason: '실시간 실패 - FFmpeg 대체'
            };

          } else {
            throw new Error(`브라우저 지원 부족: SharedArrayBuffer=${ffmpegSupport.sharedArrayBuffer}`);
          }

        } catch (ffmpegError) {
          console.warn('⚠️ FFmpeg.js 초기화 실패:', ffmpegError.message);
          console.log('🔄 WebM Writer로 대체합니다...');
        }
      }

      // 3순위: WebM Writer (최후의 대안)
      console.log('🧪 WebM Writer 호환성 테스트 중...');
      
      const webmSupport = this.webmEncoder.checkBrowserSupport();
      console.log('📊 WebM Writer 브라우저 지원:', webmSupport);
      
      if (webmSupport.basicSupport) {
        // WebM Writer는 초기화가 즉시 완료됨
        await this.webmEncoder.initialize();
        
        const reason = includeAudio ? 
          '모든 인코더 실패 - 오디오 제외 WebM' : 
          '최후 대안 WebM';

        return {
          encoder: this.webmEncoder,
          type: 'webm',
          name: 'WebM Writer',
          reason: reason
        };
      } else {
        throw new Error('WebM Writer도 지원되지 않음');
      }

    } catch (error) {
      console.error('❌ 모든 인코더 실패:', error);
      throw new Error(`지원되는 인코더가 없습니다: ${error.message}`);
    }
  }

  /**
   * 🔧 지원 기능 확인
   * @returns {Object}
   */
  static getSupportInfo() {
    return {
      ...RealtimeVideoEncoder.getSupportInfo(),
      ...FFmpegVideoEncoder.getSupportInfo(),
      ...WebMVideoEncoder.getSupportInfo(),
      html2canvas: typeof html2canvas !== 'undefined',
      hybridEncoder: true,
      realtimeFirst: true // 실시간 인코더 우선
    };
  }
}

export default OfflineExporter;