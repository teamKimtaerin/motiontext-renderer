/**
 * Video Encoder System
 * 캡처된 프레임들을 MP4 비디오로 인코딩하는 시스템
 * WebCodecs API 우선, 미지원시 Canvas-based MP4 생성
 */
export class VideoEncoder {
  constructor() {
    this.isWebCodecsSupported = this.checkWebCodecsSupport();
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.forceEncodingMode = null; // 'auto', 'webcodecs', 'mediarecorder'
  }

  /**
   * WebCodecs API 지원 여부 확인 (강화된 검증)
   * @returns {boolean}
   */
  checkWebCodecsSupport() {
    try {
      if (typeof window === 'undefined') return false;
      
      // 기본 API 존재 확인
      if (!('VideoEncoder' in window) ||
          !('VideoDecoder' in window) ||
          !('EncodedVideoChunk' in window) ||
          !('VideoFrame' in window)) {
        return false;
      }
      
      // VideoEncoder 인스턴스 생성 및 메서드 확인
      const testEncoder = new VideoEncoder({
        output: () => {},
        error: () => {}
      });
      
      // configure 메서드 존재 확인
      if (typeof testEncoder.configure !== 'function') {
        console.warn('WebCodecs: VideoEncoder.configure method not available');
        return false;
      }
      
      // 기본 설정 테스트
      try {
        testEncoder.configure({
          codec: 'avc1.42E01E',
          width: 640,
          height: 480,
          bitrate: 1000000,
          framerate: 30
        });
        testEncoder.close();
        return true;
      } catch (configError) {
        console.warn('WebCodecs: Configuration test failed:', configError);
        testEncoder.close();
        return false;
      }
      
    } catch (error) {
      console.warn('WebCodecs: Support check failed:', error);
      return false;
    }
  }

  /**
   * 인코딩 모드 설정
   * @param {string} mode - 'auto', 'webcodecs', 'mediarecorder'
   */
  setEncodingMode(mode) {
    this.forceEncodingMode = mode;
    console.log(`Encoding mode set to: ${mode}`);
  }

  /**
   * 프레임 배열을 MP4로 인코딩
   * @param {string[]} frameDataUrls - Base64 인코딩된 이미지 데이터 URL 배열
   * @param {Object} options - 인코딩 옵션
   * @param {Function} onProgress - 진행률 콜백
   * @returns {Promise<Blob>} - MP4 비디오 Blob
   */
  async encodeFramesToVideo(frameDataUrls, options = {}, onProgress = null) {
    const {
      fps = 30,
      width = 1920,
      height = 1080,
      bitrate = 5000000, // 5Mbps
      codec = 'avc1.42E01E', // H.264 Baseline
      quality = 0.8
    } = options;

    console.log(`Starting video encoding: ${frameDataUrls.length} frames at ${fps}fps`);

    // 인코딩 모드 결정
    const shouldUseWebCodecs = this.shouldUseWebCodecs();
    
    if (shouldUseWebCodecs) {
      try {
        console.log('Attempting WebCodecs encoding...');
        return await this.encodeWithWebCodecs(frameDataUrls, { fps, width, height, bitrate, codec }, onProgress);
      } catch (webCodecsError) {
        console.warn('WebCodecs encoding failed, falling back to MediaRecorder:', webCodecsError.message);
        
        // 강제 WebCodecs 모드가 아닌 경우에만 폴백
        if (this.forceEncodingMode === 'webcodecs') {
          throw new Error(`WebCodecs 인코딩 실패: ${webCodecsError.message}`);
        }
        
        // 사용자에게 폴백 알림
        if (onProgress) {
          onProgress({
            current: 0,
            total: frameDataUrls.length,
            progress: 0,
            stage: 'encoding',
            fallbackMessage: 'WebCodecs 실패, MediaRecorder로 전환 중...'
          });
        }
        
        // MediaRecorder로 폴백
        return await this.encodeWithMediaRecorder(frameDataUrls, { fps, width, height, quality }, onProgress);
      }
    } else {
      console.log('Using MediaRecorder encoding...');
      return await this.encodeWithMediaRecorder(frameDataUrls, { fps, width, height, quality }, onProgress);
    }
  }

  /**
   * 인코딩 방식 결정 로직
   * @returns {boolean} - WebCodecs 사용 여부
   */
  shouldUseWebCodecs() {
    if (this.forceEncodingMode === 'mediarecorder') {
      return false;
    }
    if (this.forceEncodingMode === 'webcodecs') {
      return true; // 지원되지 않아도 강제 시도
    }
    // 'auto' 모드: 지원 여부에 따라 결정
    return this.isWebCodecsSupported;
  }

  /**
   * WebCodecs API를 사용한 인코딩 (Chrome/Edge 전용)
   * @param {string[]} frameDataUrls 
   * @param {Object} config 
   * @param {Function} onProgress 
   * @returns {Promise<Blob>}
   */
  async encodeWithWebCodecs(frameDataUrls, config, onProgress) {
    return new Promise(async (resolve, reject) => {
      const { fps, width, height, bitrate, codec } = config;
      const encodedChunks = [];
      let frameIndex = 0;

      try {
        // VideoEncoder 설정
        const encoder = new VideoEncoder({
          output: (chunk, metadata) => {
            encodedChunks.push(new Uint8Array(chunk.byteLength));
            chunk.copyTo(encodedChunks[encodedChunks.length - 1]);
            
            // 진행률 업데이트
            if (onProgress) {
              onProgress({
                current: encodedChunks.length,
                total: frameDataUrls.length,
                progress: encodedChunks.length / frameDataUrls.length,
                stage: 'encoding'
              });
            }
          },
          error: (error) => {
            console.error('VideoEncoder error:', error);
            reject(new Error(`Video encoding failed: ${error.message}`));
          }
        });

        // 인코더 구성
        encoder.configure({
          codec: codec,
          width: width,
          height: height,
          bitrate: bitrate,
          framerate: fps,
          hardwareAcceleration: 'prefer-hardware',
          bitrateMode: 'variable'
        });

        // 각 프레임을 순차적으로 인코딩
        for (const frameDataUrl of frameDataUrls) {
          const bitmap = await this.createImageBitmap(frameDataUrl);
          const videoFrame = new VideoFrame(bitmap, {
            timestamp: (frameIndex * 1000000) / fps, // 마이크로초 단위
            duration: 1000000 / fps
          });

          encoder.encode(videoFrame);
          videoFrame.close();
          bitmap.close();
          frameIndex++;
        }

        // 인코딩 완료 대기
        await encoder.flush();
        encoder.close();

        // 인코딩된 청크들을 Blob으로 결합
        const totalLength = encodedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combinedArray = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of encodedChunks) {
          combinedArray.set(chunk, offset);
          offset += chunk.length;
        }

        const videoBlob = new Blob([combinedArray], { type: 'video/mp4' });
        console.log(`WebCodecs encoding completed: ${videoBlob.size} bytes`);
        resolve(videoBlob);

      } catch (error) {
        console.error('WebCodecs encoding error:', error);
        reject(new Error(`WebCodecs encoding failed: ${error.message}`));
      }
    });
  }

  /**
   * MediaRecorder를 사용한 인코딩 (fallback, 모든 브라우저 지원)
   * @param {string[]} frameDataUrls 
   * @param {Object} config 
   * @param {Function} onProgress 
   * @returns {Promise<Blob>}
   */
  async encodeWithMediaRecorder(frameDataUrls, config, onProgress) {
    return new Promise(async (resolve, reject) => {
      const { fps, width, height, quality } = config;
      
      try {
        // Canvas 스트림 생성
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const stream = canvas.captureStream(fps);

        // MediaRecorder 설정
        const options = {
          mimeType: 'video/webm;codecs=vp9', // WebM VP9 (광범위한 지원)
          videoBitsPerSecond: 5000000 // 5Mbps
        };

        // 지원되지 않는 경우 fallback
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = 'video/webm'; // 기본 WebM
        }

        this.recordedChunks = [];
        this.mediaRecorder = new MediaRecorder(stream, options);

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          const videoBlob = new Blob(this.recordedChunks, { type: options.mimeType });
          console.log(`MediaRecorder encoding completed: ${videoBlob.size} bytes`);
          resolve(videoBlob);
        };

        this.mediaRecorder.onerror = (error) => {
          console.error('MediaRecorder error:', error);
          reject(new Error(`MediaRecorder encoding failed: ${error.message}`));
        };

        // 녹화 시작
        this.mediaRecorder.start(1000); // 1초마다 데이터 청크 생성

        // 각 프레임을 Canvas에 그리기
        const frameInterval = 1000 / fps;
        for (let i = 0; i < frameDataUrls.length; i++) {
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = frameDataUrls[i];
          });

          // Canvas에 이미지 그리기
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // 프레임 레이트에 맞춰 대기
          if (i < frameDataUrls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, frameInterval));
          }

          // 진행률 업데이트
          if (onProgress) {
            onProgress({
              current: i + 1,
              total: frameDataUrls.length,
              progress: (i + 1) / frameDataUrls.length,
              stage: 'encoding'
            });
          }
        }

        // 녹화 중지
        this.mediaRecorder.stop();
        stream.getTracks().forEach(track => track.stop());

      } catch (error) {
        console.error('MediaRecorder encoding error:', error);
        reject(new Error(`MediaRecorder encoding failed: ${error.message}`));
      }
    });
  }

  /**
   * 데이터 URL에서 ImageBitmap 생성
   * @param {string} dataUrl 
   * @returns {Promise<ImageBitmap>}
   */
  async createImageBitmap(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const bitmap = await createImageBitmap(img);
          resolve(bitmap);
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  /**
   * 비디오 다운로드를 위한 Blob URL 생성
   * @param {Blob} videoBlob 
   * @param {string} filename 
   * @returns {string} - Blob URL
   */
  createDownloadUrl(videoBlob, filename = 'exported-video.mp4') {
    const url = URL.createObjectURL(videoBlob);
    
    // 자동 다운로드 링크 생성
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // 메모리 해제를 위해 URL 정리 (지연)
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 10000);
    
    return url;
  }

  /**
   * 인코딩 지원 정보 반환
   * @returns {Object}
   */
  getSupportInfo() {
    return {
      webCodecs: this.isWebCodecsSupported,
      mediaRecorder: typeof MediaRecorder !== 'undefined',
      supportedMimeTypes: this.getSupportedMimeTypes()
    };
  }

  /**
   * 지원되는 MIME 타입들 반환
   * @returns {string[]}
   */
  getSupportedMimeTypes() {
    const types = [
      'video/mp4;codecs=avc1.42E01E',
      'video/mp4;codecs=avc1.42001E',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];

    return types.filter(type => {
      if (typeof MediaRecorder !== 'undefined') {
        return MediaRecorder.isTypeSupported(type);
      }
      return false;
    });
  }

  /**
   * 리소스 정리
   */
  dispose() {
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      this.mediaRecorder = null;
    }
    this.recordedChunks = [];
  }
}

export default VideoEncoder;