/**
 * 🎬 Simplified Video Encoder System
 * MediaRecorder API 기반 실시간 비디오 생성 (WebCodecs 완전 제거)
 * 브라우저 표준 API만 사용하여 최대 호환성 보장
 */
export class VideoEncoder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.canvas = null;
    this.context = null;
    this.stream = null;
    this.isRecording = false;
    
    // 🎯 지원되는 MIME 타입 우선순위 (최대 호환성 기반)
    this.supportedMimeTypes = [
      'video/webm',                     // 가장 기본적이고 널리 지원됨
      'video/webm;codecs=vp8',         // VP8만 (오디오 없음)
      'video/webm;codecs=vp9',         // VP9만 (오디오 없음)  
      'video/webm;codecs=vp8,opus',    // VP8 + Opus
      'video/mp4',                      // 기본 MP4
      'video/webm;codecs=vp9,opus'     // VP9 + Opus (마지막)
    ];
  }

  /**
   * 🎬 실시간 녹화 시작 (Canvas 기반)
   * @param {HTMLCanvasElement} sourceCanvas - 녹화할 캔버스
   * @param {Object} options - 녹화 옵션
   * @returns {Promise<void>}
   */
  async startRecording(sourceCanvas, options = {}) {
    const {
      width = 1280,
      height = 720,
      fps = 30,
      videoBitsPerSecond = 5000000, // 5Mbps
      audioBitsPerSecond = 128000   // 128Kbps
    } = options;

    try {
      console.log('🎬 Starting MediaRecorder-based recording...', { width, height, fps });
      
      // 1. 기존 녹화 정리
      if (this.isRecording) {
        console.warn('⚠️ Previous recording still active, cleaning up...');
        this.cleanup();
      }
      
      // 2. 캔버스 설정 및 검증
      if (!sourceCanvas) {
        throw new Error('Source canvas is required');
      }
      
      this.canvas = sourceCanvas;
      this.context = this.canvas.getContext('2d');
      
      if (!this.context) {
        throw new Error('Failed to get canvas 2D context');
      }
      
      // 캔버스 크기 설정
      this.canvas.width = width;
      this.canvas.height = height;
      console.log(`🖼️ Canvas configured: ${this.canvas.width}x${this.canvas.height}`);
      
      // 3. 캔버스 스트림 생성 및 활성화
      if (!this.canvas.captureStream) {
        throw new Error('Canvas.captureStream is not supported in this browser');
      }
      
      // Canvas에 테스트 콘텐츠 그려서 스트림 활성화
      console.log('🎨 Drawing test content to activate canvas stream...');
      this.context.fillStyle = '#000000';
      this.context.fillRect(0, 0, width, height);
      this.context.fillStyle = '#ffffff';
      this.context.font = `${Math.min(width, height) / 10}px Arial`;
      this.context.textAlign = 'center';
      this.context.textBaseline = 'middle';
      this.context.fillText('준비 중...', width / 2, height / 2);
      
      // 스트림 생성
      this.stream = this.canvas.captureStream(fps);
      
      if (!this.stream) {
        throw new Error('Failed to create canvas stream');
      }
      
      // 스트림 상태 상세 검증
      const videoTracks = this.stream.getVideoTracks();
      console.log(`🎥 Canvas stream created: ${videoTracks.length} video tracks`);
      
      if (videoTracks.length === 0) {
        throw new Error('Canvas stream has no video tracks');
      }
      
      // 각 비디오 트랙 상태 확인
      videoTracks.forEach((track, index) => {
        console.log(`📹 Video track ${index}:`, {
          readyState: track.readyState,
          enabled: track.enabled,
          muted: track.muted,
          label: track.label
        });
        
        if (track.readyState !== 'live') {
          console.warn(`⚠️ Video track ${index} is not live: ${track.readyState}`);
        }
      });
      
      // 스트림 활성화를 위한 약간의 대기
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 4. MIME 타입 선택 및 검증
      const mimeType = this.findSupportedMimeType();
      console.log(`🎯 Selected MIME type: ${mimeType}`);
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.warn(`⚠️ MIME type ${mimeType} may not be fully supported`);
      }
      
      // 5. MediaRecorder 초기화 (fallback 전략)
      const audioTracks = this.stream.getAudioTracks();
      console.log(`🔊 Audio tracks: ${audioTracks.length}, Video tracks: ${videoTracks.length}`);
      
      let mediaRecorder = null;
      const attemptOptions = [
        // 시도 1: 기본 옵션만
        { mimeType: mimeType },
        // 시도 2: 비트레이트 포함
        { 
          mimeType: mimeType,
          videoBitsPerSecond: videoBitsPerSecond
        },
        // 시도 3: 최소 옵션
        {}
      ];
      
      for (let i = 0; i < attemptOptions.length; i++) {
        const options = attemptOptions[i];
        try {
          console.log(`📝 MediaRecorder attempt ${i + 1}:`, options);
          mediaRecorder = new MediaRecorder(this.stream, options);
          console.log('✅ MediaRecorder created successfully');
          break;
        } catch (error) {
          console.warn(`⚠️ MediaRecorder attempt ${i + 1} failed:`, error);
          if (i === attemptOptions.length - 1) {
            throw new Error(`All MediaRecorder initialization attempts failed. Last error: ${error.message}`);
          }
        }
      }
      
      this.mediaRecorder = mediaRecorder;
      this.recordedChunks = [];
      
      // 6. MediaRecorder 이벤트 핸들러 (Promise 기반)
      const recordingPromise = new Promise((resolve, reject) => {
        const startTimeout = setTimeout(() => {
          console.error('⏰ MediaRecorder start timeout after 10 seconds');
          reject(new Error('MediaRecorder start timeout after 10 seconds'));
        }, 10000); // 5초 → 10초로 증가
        
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            this.recordedChunks.push(event.data);
            console.log(`📦 Chunk recorded: ${event.data.size} bytes (total: ${this.recordedChunks.length})`);
          }
        };
        
        this.mediaRecorder.onstart = () => {
          clearTimeout(startTimeout);
          console.log('🎬 MediaRecorder started successfully');
          this.isRecording = true;
          resolve();
        };
        
        this.mediaRecorder.onstop = () => {
          console.log('⏹️ MediaRecorder stopped');
          this.isRecording = false;
        };
        
        this.mediaRecorder.onerror = (event) => {
          clearTimeout(startTimeout);
          console.error('❌ MediaRecorder error:', event);
          this.isRecording = false;
          reject(new Error(`MediaRecorder error: ${event.error?.message || 'Unknown error'}`));
        };
      });
      
      // 7. 녹화 시작 및 상태 모니터링
      console.log('▶️ Starting MediaRecorder...');
      console.log(`📊 MediaRecorder initial state: ${this.mediaRecorder.state}`);
      
      // MediaRecorder 상태 변화 추적
      const originalState = this.mediaRecorder.state;
      const stateChangeHandler = () => {
        console.log(`🔄 MediaRecorder state changed: ${originalState} → ${this.mediaRecorder.state}`);
      };
      this.mediaRecorder.addEventListener('start', stateChangeHandler);
      this.mediaRecorder.addEventListener('stop', stateChangeHandler);
      this.mediaRecorder.addEventListener('pause', stateChangeHandler);
      this.mediaRecorder.addEventListener('resume', stateChangeHandler);
      
      // 녹화 시작
      try {
        this.mediaRecorder.start(100); // 100ms 간격으로 청크 생성
        console.log('📡 MediaRecorder.start() called, waiting for onstart event...');
      } catch (startError) {
        console.error('❌ MediaRecorder.start() failed immediately:', startError);
        throw startError;
      }
      
      // 녹화 시작 완료까지 대기
      await recordingPromise;
      
      console.log('✅ Recording initialization completed successfully');
      console.log(`📊 Final MediaRecorder state: ${this.mediaRecorder.state}`);
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      throw new Error(`Recording start failed: ${error.message}`);
    }
  }

  /**
   * 🎬 캔버스에 프레임 그리기 (실시간 업데이트)
   * @param {string|HTMLVideoElement|HTMLCanvasElement} source - 그릴 소스
   * @param {number} currentTime - 현재 시간 (디버깅용)
   * @returns {Promise<void>}
   */
  async drawFrame(source, currentTime = 0) {
    if (!this.canvas || !this.context) {
      console.warn('⚠️ Canvas not initialized for drawing');
      return;
    }

    try {
      // 캔버스 클리어
      this.context.fillStyle = '#000000';
      this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      if (typeof source === 'string') {
        // Base64 이미지 데이터 URL인 경우
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = () => {
            this.context.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
            resolve();
          };
          img.onerror = reject;
          img.src = source;
        });
      } else if (source instanceof HTMLVideoElement) {
        // 비디오 요소인 경우
        this.context.drawImage(source, 0, 0, this.canvas.width, this.canvas.height);
      } else if (source instanceof HTMLCanvasElement) {
        // 캔버스 요소인 경우
        this.context.drawImage(source, 0, 0, this.canvas.width, this.canvas.height);
      } else {
        console.warn('⚠️ Unsupported source type for drawing');
      }
      
      // 디버깅: 현재 시간 표시 (선택적)
      if (currentTime > 0) {
        this.context.fillStyle = '#ffffff';
        this.context.font = '16px Arial';
        this.context.fillText(`Time: ${currentTime.toFixed(1)}s`, 10, 30);
      }
      
    } catch (error) {
      console.error('❌ Failed to draw frame:', error);
    }
  }

  /**
   * 🎬 녹화 중지 및 비디오 Blob 생성
   * @returns {Promise<Blob>} - 완성된 비디오 Blob
   */
  async stopRecording() {
    if (!this.mediaRecorder || !this.isRecording) {
      throw new Error('Recording is not active');
    }

    return new Promise((resolve, reject) => {
      // MediaRecorder 중지 이벤트 대기
      this.mediaRecorder.onstop = () => {
        try {
          console.log(`📦 Processing ${this.recordedChunks.length} recorded chunks...`);
          
          // Blob 생성
          const mimeType = this.mediaRecorder.mimeType || 'video/webm';
          const videoBlob = new Blob(this.recordedChunks, { type: mimeType });
          
          console.log(`✅ Video Blob created: ${videoBlob.size} bytes, type: ${mimeType}`);
          
          // 리소스 정리
          this.cleanup();
          
          resolve(videoBlob);
        } catch (error) {
          console.error('❌ Failed to create video blob:', error);
          reject(error);
        }
      };
      
      // 타임아웃 보호
      setTimeout(() => {
        if (this.isRecording) {
          console.warn('⚠️ Recording stop timeout, forcing stop');
          this.cleanup();
          reject(new Error('Recording stop timeout'));
        }
      }, 5000);
      
      // 녹화 중지
      console.log('⏹️ Stopping MediaRecorder...');
      this.mediaRecorder.stop();
    });
  }

  /**
   * 🔍 지원되는 MIME 타입 찾기
   * @returns {string} - 지원되는 첫 번째 MIME 타입
   */
  findSupportedMimeType() {
    for (const mimeType of this.supportedMimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }
    
    // 모든 타입이 지원되지 않으면 기본값 사용
    console.warn('⚠️ No preferred MIME type supported, using default');
    return 'video/webm'; // 최종 fallback
  }

  /**
   * 🔊 스트림에 오디오 트랙이 있는지 확인
   * @returns {boolean}
   */
  hasAudioTrack() {
    if (!this.stream) return false;
    return this.stream.getAudioTracks().length > 0;
  }

  /**
   * 📊 녹화 상태 정보
   * @returns {Object} - 현재 녹화 상태
   */
  getRecordingStatus() {
    return {
      isRecording: this.isRecording,
      chunksCount: this.recordedChunks.length,
      totalSize: this.recordedChunks.reduce((total, chunk) => total + chunk.size, 0),
      mimeType: this.mediaRecorder?.mimeType || null,
      state: this.mediaRecorder?.state || 'inactive'
    };
  }

  /**
   * 🧹 리소스 정리
   */
  cleanup() {
    console.log('🧹 Cleaning up VideoEncoder resources...');
    
    if (this.stream) {
      // 모든 트랙 중지
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log(`🛑 Stopped track: ${track.kind}`);
      });
      this.stream = null;
    }
    
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }
      this.mediaRecorder = null;
    }
    
    this.recordedChunks = [];
    this.canvas = null;
    this.context = null;
    this.isRecording = false;
    
    console.log('✅ VideoEncoder cleanup completed');
  }

  /**
   * 🔧 지원 기능 확인
   * @returns {Object} - 브라우저 지원 기능 정보
   */
  static getSupportInfo() {
    const support = {
      mediaRecorder: typeof MediaRecorder !== 'undefined',
      canvasCapture: typeof HTMLCanvasElement !== 'undefined' && 
                     HTMLCanvasElement.prototype.captureStream,
      supportedMimeTypes: []
    };
    
    if (support.mediaRecorder) {
      const testTypes = [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',  
        'video/webm',
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4'
      ];
      
      support.supportedMimeTypes = testTypes.filter(type => 
        MediaRecorder.isTypeSupported(type)
      );
    }
    
    return support;
  }
}

export default VideoEncoder;