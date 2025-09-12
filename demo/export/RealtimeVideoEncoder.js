/**
 * 🎬 실시간 MediaRecorder 기반 비디오 인코더
 * FFmpeg.js 없이 브라우저 네이티브 MediaRecorder만 사용
 * SharedArrayBuffer 요구사항 완전 우회
 */
export class RealtimeVideoEncoder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.canvas = null;
    this.context = null;
    this.stream = null;
    this.isRecording = false;
    this.videoElement = null;
    this.containerElement = null;
    this.animationFrameId = null;
    
    // 실시간 합성을 위한 설정
    this.fps = 30;
    this.frameInterval = 1000 / this.fps; // 33.33ms
    this.lastFrameTime = 0;
    
    // 지원되는 MIME 타입 (MediaRecorder 호환)
    this.supportedMimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus', 
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4;codecs=h264,aac', // 일부 브라우저 지원
      'video/mp4'
    ];
  }

  /**
   * 🚀 실시간 인코더 초기화 (즉시 사용 가능)
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      console.log('🚀 실시간 MediaRecorder 인코더 초기화 중...');
      
      // 브라우저 지원 기능 확인
      const supportInfo = this.checkBrowserSupport();
      console.log('📊 브라우저 지원 정보:', supportInfo);
      
      if (!supportInfo.mediaRecorder) {
        throw new Error('MediaRecorder가 지원되지 않습니다');
      }

      if (!supportInfo.canvasCapture) {
        throw new Error('Canvas.captureStream이 지원되지 않습니다');
      }

      // SharedArrayBuffer 확인 (선택사항)
      if (supportInfo.sharedArrayBuffer) {
        console.log('✅ SharedArrayBuffer 지원됨 - 최고 성능 모드');
      } else {
        console.log('⚠️ SharedArrayBuffer 미지원 - 호환성 모드로 작동');
      }

      console.log('✅ 실시간 MediaRecorder 인코더 초기화 완료');

    } catch (error) {
      console.error('❌ 실시간 인코더 초기화 실패:', error);
      throw new Error(`실시간 인코더 초기화 실패: ${error.message}`);
    }
  }

  /**
   * 🎬 실시간 녹화 시작
   * @param {HTMLVideoElement} videoElement - 원본 비디오
   * @param {HTMLElement} containerElement - 애니메이션 컨테이너
   * @param {Object} options - 녹화 옵션
   * @returns {Promise<void>}
   */
  async startRealTimeRecording(videoElement, containerElement, options = {}) {
    const {
      width = 1280,
      height = 720,
      fps = 30,
      videoBitsPerSecond = 5000000, // 5Mbps
      audioBitsPerSecond = 128000   // 128Kbps
    } = options;

    try {
      console.log('🎬 실시간 녹화 시작:', { width, height, fps });
      
      if (this.isRecording) {
        throw new Error('이미 녹화가 진행 중입니다');
      }

      this.videoElement = videoElement;
      this.containerElement = containerElement;
      this.fps = fps;
      this.frameInterval = 1000 / fps;
      
      // 1. 녹화용 캔버스 생성
      this.createRecordingCanvas(width, height);
      
      // 2. 캔버스 스트림 생성
      this.stream = this.canvas.captureStream(fps);
      console.log(`🎥 Canvas stream 생성: ${this.stream.getVideoTracks().length}개 비디오 트랙`);
      
      // 3. MIME 타입 선택
      const mimeType = this.findSupportedMimeType();
      console.log(`🎯 선택된 MIME 타입: ${mimeType}`);
      
      // 4. MediaRecorder 생성 (간단한 옵션으로 시작)
      const recorderOptions = { mimeType };
      
      // 비트레이트는 선택적으로 적용 (호환성을 위해)
      if (MediaRecorder.isTypeSupported(mimeType)) {
        try {
          recorderOptions.videoBitsPerSecond = videoBitsPerSecond;
          recorderOptions.audioBitsPerSecond = audioBitsPerSecond;
        } catch (e) {
          console.warn('⚠️ 비트레이트 설정 실패, 기본값 사용');
        }
      }

      this.mediaRecorder = new MediaRecorder(this.stream, recorderOptions);
      
      // 5. 이벤트 리스너 설정
      this.setupMediaRecorderEvents();
      
      // 6. 실시간 프레임 합성 시작
      this.startFrameComposition();
      
      // 7. MediaRecorder 시작
      this.mediaRecorder.start(100); // 100ms 간격
      this.isRecording = true;
      
      console.log('✅ 실시간 녹화 시작 완료');

    } catch (error) {
      console.error('❌ 실시간 녹화 시작 실패:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * 🖼️ 녹화용 캔버스 생성
   * @param {number} width 
   * @param {number} height 
   */
  createRecordingCanvas(width, height) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.context = this.canvas.getContext('2d');
    
    // 캔버스를 DOM에 추가 (숨김 상태)
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '-10000px';
    this.canvas.style.left = '-10000px';
    this.canvas.style.zIndex = '-1000';
    this.canvas.style.pointerEvents = 'none';
    
    document.body.appendChild(this.canvas);
    
    console.log(`🖼️ 녹화용 캔버스 생성: ${width}x${height}`);
  }

  /**
   * 🎥 실시간 프레임 합성 시작
   */
  startFrameComposition() {
    const composeFrame = (currentTime) => {
      if (!this.isRecording) return;

      // FPS 제한
      if (currentTime - this.lastFrameTime >= this.frameInterval) {
        this.composeCurrentFrame();
        this.lastFrameTime = currentTime;
      }

      // 다음 프레임 요청
      this.animationFrameId = requestAnimationFrame(composeFrame);
    };

    this.animationFrameId = requestAnimationFrame(composeFrame);
    console.log('🎪 실시간 프레임 합성 시작');
  }

  /**
   * 🎨 현재 프레임 합성 (비디오 + 애니메이션)
   */
  composeCurrentFrame() {
    if (!this.context || !this.videoElement || !this.containerElement) return;

    try {
      // 캔버스 초기화
      this.context.fillStyle = '#000000';
      this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // 1. 원본 비디오 그리기
      if (this.videoElement.readyState >= 2) { // HAVE_CURRENT_DATA 이상
        this.context.drawImage(
          this.videoElement, 
          0, 0, 
          this.canvas.width, 
          this.canvas.height
        );
      }

      // 2. 애니메이션 오버레이 그리기 (간단한 방법)
      this.drawAnimationOverlay();

    } catch (error) {
      console.warn('⚠️ 프레임 합성 오류:', error);
    }
  }

  /**
   * 🎭 애니메이션 오버레이 그리기 (DOM → Canvas)
   */
  drawAnimationOverlay() {
    // 임시 구현: DOM 텍스트 요소들을 직접 캔버스에 그리기
    // 실제로는 html2canvas보다 빠른 방법을 사용해야 함
    
    try {
      // 컨테이너의 모든 텍스트 요소 찾기
      const textElements = this.containerElement.querySelectorAll('[data-cue-id]');
      
      textElements.forEach(element => {
        if (element.style.display !== 'none' && element.style.visibility !== 'hidden') {
          this.drawDOMElement(element);
        }
      });

    } catch (error) {
      console.warn('⚠️ 애니메이션 오버레이 그리기 실패:', error);
    }
  }

  /**
   * 🎨 DOM 요소를 캔버스에 그리기 (간단한 텍스트)
   * @param {HTMLElement} element 
   */
  drawDOMElement(element) {
    try {
      const rect = element.getBoundingClientRect();
      const containerRect = this.containerElement.getBoundingClientRect();
      
      // 컨테이너 기준 상대 위치 계산
      const x = (rect.left - containerRect.left) * (this.canvas.width / containerRect.width);
      const y = (rect.top - containerRect.top) * (this.canvas.height / containerRect.height);
      
      // 기본 텍스트 렌더링
      const computedStyle = window.getComputedStyle(element);
      
      this.context.fillStyle = computedStyle.color || '#ffffff';
      this.context.font = `${computedStyle.fontSize || '20px'} ${computedStyle.fontFamily || 'Arial'}`;
      this.context.textAlign = 'left';
      this.context.textBaseline = 'top';
      
      // 투명도 적용
      const opacity = parseFloat(computedStyle.opacity || '1');
      this.context.globalAlpha = opacity;
      
      // 텍스트 그리기
      const text = element.textContent || element.innerText || '';
      if (text.trim()) {
        this.context.fillText(text, x, y);
      }
      
      // 투명도 복원
      this.context.globalAlpha = 1;

    } catch (error) {
      console.warn('⚠️ DOM 요소 그리기 실패:', error);
    }
  }

  /**
   * 🔧 MediaRecorder 이벤트 설정
   */
  setupMediaRecorderEvents() {
    this.recordedChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
        console.log(`📦 데이터 청크: ${event.data.size} bytes (총: ${this.recordedChunks.length}개)`);
      }
    };

    this.mediaRecorder.onstart = () => {
      console.log('🎬 MediaRecorder 시작됨');
    };

    this.mediaRecorder.onstop = () => {
      console.log('⏹️ MediaRecorder 중지됨');
    };

    this.mediaRecorder.onerror = (event) => {
      console.error('❌ MediaRecorder 오류:', event.error);
    };
  }

  /**
   * 🎬 녹화 중지 및 비디오 생성
   * @returns {Promise<Blob>}
   */
  async stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) {
      throw new Error('진행 중인 녹화가 없습니다');
    }

    return new Promise((resolve, reject) => {
      // 정지 이벤트 대기
      this.mediaRecorder.onstop = () => {
        try {
          console.log(`📦 ${this.recordedChunks.length}개 청크 처리 중...`);
          
          // Blob 생성
          const mimeType = this.mediaRecorder.mimeType || 'video/webm';
          const videoBlob = new Blob(this.recordedChunks, { type: mimeType });
          
          console.log(`✅ 비디오 생성 완료: ${videoBlob.size} bytes (${mimeType})`);
          
          resolve(videoBlob);
        } catch (error) {
          reject(error);
        } finally {
          this.cleanup();
        }
      };

      // 프레임 합성 중지
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      // MediaRecorder 중지
      console.log('⏹️ MediaRecorder 중지 중...');
      this.mediaRecorder.stop();
      this.isRecording = false;
    });
  }

  /**
   * 🔍 지원되는 MIME 타입 찾기
   * @returns {string}
   */
  findSupportedMimeType() {
    for (const mimeType of this.supportedMimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }
    
    // fallback
    console.warn('⚠️ 지원되는 MIME 타입이 없습니다, 기본값 사용');
    return 'video/webm';
  }

  /**
   * 🔍 브라우저 지원 확인
   * @returns {Object}
   */
  checkBrowserSupport() {
    return {
      mediaRecorder: typeof MediaRecorder !== 'undefined',
      canvasCapture: typeof HTMLCanvasElement !== 'undefined' && 
                     HTMLCanvasElement.prototype.captureStream,
      sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
      crossOriginIsolated: typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated,
      requestAnimationFrame: typeof requestAnimationFrame !== 'undefined'
    };
  }

  /**
   * 📊 녹화 상태 정보
   * @returns {Object}
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      chunksCount: this.recordedChunks.length,
      totalSize: this.recordedChunks.reduce((total, chunk) => total + chunk.size, 0),
      mimeType: this.mediaRecorder?.mimeType || null,
      fps: this.fps
    };
  }

  /**
   * 🧹 리소스 정리
   */
  cleanup() {
    console.log('🧹 실시간 인코더 리소스 정리 중...');
    
    // 프레임 합성 중지
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // MediaRecorder 정리
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }
      this.mediaRecorder = null;
    }

    // 스트림 정리
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = null;
    }

    // 캔버스 정리
    if (this.canvas && document.body.contains(this.canvas)) {
      document.body.removeChild(this.canvas);
    }
    this.canvas = null;
    this.context = null;

    // 상태 초기화
    this.recordedChunks = [];
    this.isRecording = false;
    this.videoElement = null;
    this.containerElement = null;
    this.lastFrameTime = 0;

    console.log('✅ 실시간 인코더 정리 완료');
  }

  /**
   * 🔧 지원 기능 확인 (정적 메서드)
   * @returns {Object}
   */
  static getSupportInfo() {
    return {
      mediaRecorder: typeof MediaRecorder !== 'undefined',
      canvasCapture: typeof HTMLCanvasElement !== 'undefined' && 
                     HTMLCanvasElement.prototype.captureStream,
      sharedArrayBufferRequired: false, // 필요 없음!
      crossOriginIsolationRequired: false, // 선택사항
      ffmpegRequired: false // FFmpeg.js 없이 작동
    };
  }
}

export default RealtimeVideoEncoder;