/**
 * Screen Capture System
 * getDisplayMedia API를 활용한 실시간 화면 캡처 시스템
 * html2canvas 대신 브라우저 네이티브 화면 캡처 사용
 */
export class ScreenCapture {
  constructor(videoElement, containerElement) {
    this.video = videoElement;
    this.container = containerElement;
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
  }

  /**
   * 화면 영역 캡처를 위한 스트림 시작
   * @param {Object} options - 캡처 옵션
   * @returns {Promise<void>}
   */
  async startCapture(options = {}) {
    const {
      width = 1920,
      height = 1080,
      frameRate = 30
    } = options;

    try {
      // getDisplayMedia로 화면 캡처 스트림 요청
      this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: width },
          height: { ideal: height },
          frameRate: { ideal: frameRate }
        },
        audio: false // 비디오만 캡처
      });

      console.log('Screen capture stream started:', {
        width: this.mediaStream.getVideoTracks()[0].getSettings().width,
        height: this.mediaStream.getVideoTracks()[0].getSettings().height,
        frameRate: this.mediaStream.getVideoTracks()[0].getSettings().frameRate
      });

      return true;
    } catch (error) {
      console.error('Failed to start screen capture:', error);
      throw new Error(`Screen capture failed: ${error.message}`);
    }
  }

  /**
   * MediaRecorder를 이용한 구간 녹화
   * @param {number} startTime - 시작 시간 (초)
   * @param {number} duration - 녹화 시간 (초)
   * @param {Function} onProgress - 진행률 콜백
   * @returns {Promise<Blob>} - 녹화된 비디오 Blob
   */
  async recordSegment(startTime, duration, onProgress = null) {
    if (!this.mediaStream) {
      throw new Error('Screen capture stream not started');
    }

    return new Promise((resolve, reject) => {
      // 녹화된 청크 초기화
      this.recordedChunks = [];

      // MediaRecorder 설정
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: mimeType,
        videoBitsPerSecond: 8000000 // 8Mbps
      });

      // 데이터 수집
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      // 녹화 완료 처리
      this.mediaRecorder.onstop = () => {
        const videoBlob = new Blob(this.recordedChunks, { 
          type: mimeType 
        });
        console.log(`Recording completed: ${videoBlob.size} bytes`);
        resolve(videoBlob);
      };

      // 에러 처리
      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        reject(event.error);
      };

      // 진행률 업데이트 (100ms마다)
      let progressInterval;
      if (onProgress) {
        const startRecordTime = Date.now();
        progressInterval = setInterval(() => {
          const elapsed = (Date.now() - startRecordTime) / 1000;
          const progress = Math.min(elapsed / duration, 1);
          
          onProgress({
            progress,
            elapsed,
            remaining: Math.max(duration - elapsed, 0),
            currentTime: startTime + elapsed
          });
        }, 100);
      }

      // 녹화 시작
      console.log(`Starting recording: ${duration}s from ${startTime}s`);
      
      // 비디오를 시작 시간으로 이동
      this.video.currentTime = startTime;
      this.video.play();

      // 조금 기다린 후 녹화 시작 (비디오 시킹 완료 대기)
      setTimeout(() => {
        this.mediaRecorder.start(100); // 100ms마다 데이터 수집
        this.isRecording = true;

        // 녹화 시간이 끝나면 자동 정지
        setTimeout(() => {
          if (this.isRecording && this.mediaRecorder) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            if (progressInterval) {
              clearInterval(progressInterval);
            }
            // 비디오 일시정지
            this.video.pause();
          }
        }, duration * 1000);
      }, 500); // 비디오 시킹을 위한 0.5초 대기
    });
  }

  /**
   * 지원되는 MIME 타입 확인
   * @returns {string} - 지원되는 MIME 타입
   */
  getSupportedMimeType() {
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        console.log('Using MIME type:', mimeType);
        return mimeType;
      }
    }

    return 'video/webm'; // fallback
  }

  /**
   * 화면 캡처 중지
   */
  stopCapture() {
    if (this.isRecording && this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
      });
      this.mediaStream = null;
    }

    console.log('Screen capture stopped');
  }

  /**
   * 브라우저 지원 여부 확인
   * @returns {boolean}
   */
  static isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }

  /**
   * 리소스 정리
   */
  dispose() {
    this.stopCapture();
    this.video = null;
    this.container = null;
    this.recordedChunks = [];
  }
}

export default ScreenCapture;