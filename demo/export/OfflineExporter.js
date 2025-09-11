import { FrameCapture } from './FrameCapture.js';
import { VideoEncoder } from './VideoEncoder.js';
import { ScreenCapture } from './ScreenCapture.js';

/**
 * Offline Video Exporter
 * 현재 렌더링된 HTML 오버레이 + 애니메이션을 MP4로 내보내는 메인 엔진
 */
export class OfflineExporter {
  constructor(videoElement, containerElement, renderer = null) {
    this.video = videoElement;
    this.container = containerElement;
    this.renderer = renderer; // MotionText 렌더러 인스턴스
    this.frameCapture = new FrameCapture(videoElement, containerElement, renderer);
    this.screenCapture = new ScreenCapture(videoElement, containerElement);
    this.videoEncoder = new VideoEncoder();
    this.isExporting = false;
    this.currentExportId = null;
    this.abortController = null;
    this.captureMode = 'frame'; // 'frame' or 'screen'
    
    // 외부에서 videoEncoder 접근 가능하도록 public으로 노출
    // this.videoEncoder는 이미 public이므로 추가 작업 불필요
  }

  /**
   * 캡처 모드 설정
   * @param {string} mode - 'frame' (html2canvas) 또는 'screen' (Screen Capture API)
   */
  setCaptureMode(mode) {
    if (['frame', 'screen'].includes(mode)) {
      this.captureMode = mode;
      console.log(`Capture mode set to: ${mode}`);
    } else {
      throw new Error('Invalid capture mode. Use "frame" or "screen"');
    }
  }

  /**
   * Screen Capture 지원 여부 확인
   * @returns {boolean}
   */
  isScreenCaptureSupported() {
    return ScreenCapture.isSupported();
  }

  /**
   * 현재 로드된 시나리오를 MP4로 내보내기
   * @param {Object} options - 내보내기 옵션
   * @param {Function} onProgress - 진행률 콜백 
   * @returns {Promise<Blob>} - 생성된 MP4 비디오 Blob
   */
  async exportVideo(options = {}, onProgress = null) {
    if (this.isExporting) {
      throw new Error('Export already in progress');
    }

    const {
      fps = 30,
      width = 1920,
      height = 1080,
      quality = 0.95,
      startTime = 0,
      endTime = null,
      filename = 'motiontext-export',
      downloadAutomatically = true
    } = options;

    // 실제 내보낼 시간 계산
    const videoDuration = this.video.duration || 10;
    const exportDuration = (endTime !== null ? Math.min(endTime, videoDuration) : videoDuration) - startTime;
    const exportId = Date.now().toString();

    console.log(`Starting export: ${exportDuration}s at ${fps}fps (${width}x${height})`);

    this.isExporting = true;
    this.currentExportId = exportId;
    this.abortController = new AbortController();

    try {
      let currentStage = 'preparation';
      
      // 진행률 업데이트 헬퍼
      const updateProgress = (stage, progress, details = {}) => {
        if (onProgress && !this.abortController.signal.aborted) {
          onProgress({
            exportId,
            stage,
            progress,
            details,
            timestamp: Date.now()
          });
        }
      };

      updateProgress('preparation', 0, { 
        message: '내보내기 준비 중...', 
        duration: exportDuration,
        totalFrames: Math.ceil(exportDuration * fps)
      });

      let videoBlob;

      if (this.captureMode === 'screen' && this.isScreenCaptureSupported()) {
        // Screen Capture API 모드 (빠른 실시간 캡처)
        currentStage = 'screen_capture';
        updateProgress(currentStage, 0, { message: 'Screen Capture 준비 중...', mode: 'screen' });

        // Screen Capture 시작
        await this.screenCapture.startCapture({ width, height, frameRate: fps });
        
        updateProgress(currentStage, 0.1, { message: '화면 캡처 시작 - 사용자 승인 필요' });

        // 실시간 녹화 수행
        videoBlob = await this.screenCapture.recordSegment(startTime, exportDuration, (progress) => {
          if (this.abortController.signal.aborted) {
            this.screenCapture.stopCapture();
            throw new Error('Export cancelled by user');
          }
          
          updateProgress('screen_capture', 0.1 + (progress.progress * 0.9), {
            message: `화면 캡처 중... ${progress.currentTime.toFixed(1)}/${(startTime + exportDuration).toFixed(1)}s`,
            currentTime: progress.currentTime.toFixed(2),
            remaining: progress.remaining.toFixed(1),
            mode: 'screen'
          });
        });

        this.screenCapture.stopCapture();
        updateProgress('completed', 1, { message: '화면 캡처 완료!', mode: 'screen' });

      } else {
        // 기존 Frame Capture 모드 (html2canvas 기반)
        currentStage = 'capturing';
        updateProgress(currentStage, 0, { message: '프레임 캡처 시작...', mode: 'frame' });

        const captureOptions = {
          width,
          height,
          quality,
          waitTime: Math.max(100, Math.min(200, 1000 / fps)) // 애니메이션 정착을 위한 대기 시간 증가
        };

        const frames = await this.frameCapture.captureFrameSequence(
          exportDuration, 
          fps, 
          captureOptions,
          (captureProgress) => {
            if (this.abortController.signal.aborted) {
              throw new Error('Export cancelled by user');
            }
            
            updateProgress('capturing', captureProgress.progress * 0.7, {
              message: `프레임 캡처 중... ${captureProgress.current}/${captureProgress.total}`,
              currentFrame: captureProgress.current,
              totalFrames: captureProgress.total,
              currentTime: captureProgress.currentTime.toFixed(2),
              estimatedTimeLeft: this.formatTime(captureProgress.estimatedTimeLeft || 0),
              mode: 'frame'
            });
          },
          startTime // startTime을 마지막 매개변수로 전달
        );

        if (this.abortController.signal.aborted) {
          throw new Error('Export cancelled by user');
        }

        // 2단계: 비디오 인코딩
        currentStage = 'encoding';
        updateProgress(currentStage, 0.7, { message: '비디오 인코딩 시작...', mode: 'frame' });

        const encodingOptions = {
          fps,
          width,
          height,
          bitrate: Math.min(10000000, width * height * fps * 0.1), // 해상도에 따른 비트레이트 조정
          quality: quality
        };

        videoBlob = await this.videoEncoder.encodeFramesToVideo(
          frames,
          encodingOptions,
          (encodingProgress) => {
            if (this.abortController.signal.aborted) {
              throw new Error('Export cancelled by user');
            }
            
            updateProgress('encoding', 0.7 + (encodingProgress.progress * 0.3), {
              message: `비디오 인코딩 중... ${Math.round(encodingProgress.progress * 100)}%`,
              encodingProgress: encodingProgress.progress,
              mode: 'frame'
            });
          }
        );
      }

      if (this.abortController.signal.aborted) {
        throw new Error('Export cancelled by user');
      }

      // 3단계: 완료 처리
      currentStage = 'finalizing';
      updateProgress(currentStage, 0.95, { message: '내보내기 완료 처리 중...' });

      // 자동 다운로드
      if (downloadAutomatically) {
        const finalFilename = `${filename}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.mp4`;
        this.videoEncoder.createDownloadUrl(videoBlob, finalFilename);
      }

      // 메모리 정리
      this.cleanup();

      updateProgress('completed', 1.0, {
        message: '내보내기 완료!',
        filename: filename,
        fileSize: this.formatFileSize(videoBlob.size),
        duration: exportDuration,
        resolution: `${width}x${height}`,
        fps: fps
      });

      console.log(`Export completed successfully: ${videoBlob.size} bytes`);
      return videoBlob;

    } catch (error) {
      console.error('Export failed:', error);
      this.cleanup();
      
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
      this.isExporting = false;
      this.currentExportId = null;
      this.abortController = null;
    }
  }

  /**
   * 내보내기 취소
   */
  cancelExport() {
    if (this.isExporting && this.abortController) {
      this.abortController.abort();
      console.log('Export cancelled by user');
    }
  }

  /**
   * 현재 내보내기 상태 확인
   * @returns {boolean}
   */
  isExportInProgress() {
    return this.isExporting;
  }

  /**
   * 내보내기 지원 정보 반환
   * @returns {Object}
   */
  getSupportInfo() {
    return {
      ...this.videoEncoder.getSupportInfo(),
      maxResolution: this.getMaxSupportedResolution(),
      recommendedSettings: this.getRecommendedSettings()
    };
  }

  /**
   * 권장 설정 반환
   * @returns {Object}
   */
  getRecommendedSettings() {
    const containerRect = this.container.getBoundingClientRect();
    const aspectRatio = containerRect.width / containerRect.height;
    
    let recommendedWidth, recommendedHeight;
    
    if (aspectRatio > 1.5) {
      // 16:9 or wider
      recommendedWidth = 1920;
      recommendedHeight = 1080;
    } else if (aspectRatio < 0.8) {
      // 9:16 or taller (vertical)
      recommendedWidth = 1080;
      recommendedHeight = 1920;
    } else {
      // Square-ish
      recommendedWidth = 1080;
      recommendedHeight = 1080;
    }

    return {
      resolution: {
        width: recommendedWidth,
        height: recommendedHeight,
        aspectRatio: aspectRatio.toFixed(2)
      },
      fps: 30,
      quality: 0.95,
      estimatedFileSize: this.estimateFileSize(recommendedWidth, recommendedHeight, 30, this.video.duration || 10)
    };
  }

  /**
   * 최대 지원 해상도 반환 (메모리 기반 추정)
   * @returns {Object}
   */
  getMaxSupportedResolution() {
    const memoryMB = navigator.deviceMemory || 4; // GB
    const maxPixels = Math.min(3840 * 2160, memoryMB * 1000000); // 메모리에 따른 최대 픽셀수
    
    if (maxPixels >= 3840 * 2160) return { width: 3840, height: 2160, name: '4K UHD' };
    if (maxPixels >= 2560 * 1440) return { width: 2560, height: 1440, name: '1440p QHD' };
    if (maxPixels >= 1920 * 1080) return { width: 1920, height: 1080, name: '1080p FHD' };
    return { width: 1280, height: 720, name: '720p HD' };
  }

  /**
   * 파일 크기 추정
   * @param {number} width 
   * @param {number} height 
   * @param {number} fps 
   * @param {number} duration 
   * @returns {string}
   */
  estimateFileSize(width, height, fps, duration) {
    const pixelsPerSecond = width * height * fps;
    const bitsPerPixel = 0.1; // H.264 추정값
    const estimatedBits = pixelsPerSecond * bitsPerPixel * duration;
    const estimatedBytes = estimatedBits / 8;
    
    return this.formatFileSize(estimatedBytes);
  }

  /**
   * 파일 크기 포맷팅
   * @param {number} bytes 
   * @returns {string}
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 시간 포맷팅 (밀리초 → 읽기 쉬운 형태)
   * @param {number} ms 
   * @returns {string}
   */
  formatTime(ms) {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  /**
   * 메모리 정리
   */
  cleanup() {
    // 캡처된 프레임들 메모리 해제는 가비지 컬렉션에 맡김
    if (typeof window !== 'undefined' && window.gc) {
      window.gc();
    }
  }

  /**
   * 리소스 해제
   */
  dispose() {
    this.cancelExport();
    this.frameCapture?.dispose();
    this.videoEncoder?.dispose();
    this.video = null;
    this.container = null;
  }
}

export default OfflineExporter;