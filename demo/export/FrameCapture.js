import html2canvas from 'html2canvas';

/**
 * Frame Capture System
 * DOM 영역을 html2canvas로 스냅샷 캡처하는 시스템
 */
export class FrameCapture {
  constructor(videoElement, containerElement, renderer = null) {
    this.video = videoElement;
    this.container = containerElement;
    this.renderer = renderer; // MotionText 렌더러 인스턴스
    this.canvas = null;
  }

  /**
   * 특정 시간의 프레임을 캡처
   * @param {number} timeInSeconds - 캡처할 시간 (초)
   * @param {Object} options - 캡처 옵션
   * @returns {Promise<string>} - Base64 인코딩된 이미지 데이터 URL
   */
  async captureFrame(timeInSeconds, options = {}) {
    const {
      width = 960,  // 극단적 최적화: 1920 → 960 (절반 해상도)
      height = 540, // 극단적 최적화: 1080 → 540 (절반 해상도)
      quality = 0.85, // 품질 약간 낮춤 (0.95 → 0.85)
      waitTime = 40 // DOM 업데이트 대기 시간(ms) - 최적화: 150ms → 40ms
    } = options;

    // 원본 컨테이너 크기 저장
    const originalStyles = this.saveOriginalStyles();

    try {
      // 1. 비디오를 특정 시간으로 이동 (가상 시간 주입)
      await this.seekVideoToTime(timeInSeconds);
      
      // 2. 컨테이너를 목표 해상도로 임시 조정
      this.resizeContainerForCapture(width, height);
      
      // 3. DOM 업데이트 및 애니메이션이 적용될 때까지 대기
      await this.waitForRender(waitTime);

      // 3. html2canvas로 DOM 영역 캡처 (비디오 + 자막 컨테이너)
      // CSS 스케일링 계산 (현재 DOM 크기 대비 목표 해상도)
      const containerRect = this.container.getBoundingClientRect();
      const scaleX = width / containerRect.width;
      const scaleY = height / containerRect.height;
      const scale = Math.min(scaleX, scaleY); // 종횡비 유지를 위해 작은 값 선택
      
      console.log(`Capture scaling: container=${containerRect.width}x${containerRect.height}, target=${width}x${height}, scale=${scale.toFixed(2)}`);
      
      const canvas = await html2canvas(this.container, {
        width: width,
        height: height,
        scale: scale,
        useCORS: false, // 로컬 비디오 파일의 CORS 문제 해결
        allowTaint: true,
        backgroundColor: '#000000', // 비디오 배경색과 일치
        logging: true, // 디버깅을 위해 일시적으로 활성화
        removeContainer: true,
        imageTimeout: 15000, // 비디오 로딩 대기 시간 증가: 3초 → 15초
        foreignObjectRendering: false, // 비디오 렌더링 방식 변경
        onclone: (clonedDoc) => {
          // 클론된 문서에서 컨테이너 크기 강제 설정
          const clonedContainer = clonedDoc.querySelector('.video-container');
          if (clonedContainer) {
            clonedContainer.style.width = `${width}px`;
            clonedContainer.style.height = `${height}px`;
            clonedContainer.style.position = 'relative';
            clonedContainer.style.overflow = 'hidden';
          }
          
          // 클론된 문서에서 비디오 요소가 올바르게 보이도록 설정
          const clonedVideos = clonedDoc.querySelectorAll('video');
          clonedVideos.forEach(video => {
            video.style.display = 'block';
            video.style.visibility = 'visible';
            video.style.opacity = '1';
            video.style.width = `${width}px`;
            video.style.height = `${height}px`;
            video.style.objectFit = 'fill'; // 전체 영역을 채우도록 강제
            // 현재 시간과 동기화
            video.currentTime = timeInSeconds;
            // 비디오 로딩 상태 강제 설정
            video.load();
          });
          
          // 자막 컨테이너도 목표 크기로 설정
          const clonedCaptions = clonedDoc.querySelectorAll('.caption-overlay');
          clonedCaptions.forEach(caption => {
            caption.style.display = 'block';
            caption.style.visibility = 'visible';
            caption.style.opacity = '1';
            caption.style.pointerEvents = 'none';
            caption.style.width = `${width}px`;
            caption.style.height = `${height}px`;
            caption.style.position = 'absolute';
            caption.style.top = '0';
            caption.style.left = '0';
          });
          
          console.log(`Clone document prepared: ${clonedVideos.length} videos, ${clonedCaptions.length} captions at ${width}x${height}`);
        }
      });

      // 4. Canvas를 데이터 URL로 변환 (JPEG 최적화)
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      
      // 디버깅: 첫 번째와 중간 프레임 콘솔에 출력 및 미리보기
      if (timeInSeconds === 0 || timeInSeconds % 5 === 0) {
        console.log(`Frame captured at ${timeInSeconds}s: ${dataUrl.substring(0, 50)}...`);
        console.log(`Canvas dimensions: ${canvas.width}x${canvas.height}`);
        console.log(`Data URL length: ${dataUrl.length} chars`);
        
        // 디버깅용: 프레임 미리보기 생성 (첫 번째와 5초마다)
        const debugImg = new Image();
        debugImg.src = dataUrl;
        debugImg.style.maxWidth = '200px';
        debugImg.style.border = `2px solid ${timeInSeconds === 0 ? 'blue' : 'green'}`;
        debugImg.style.margin = '5px';
        debugImg.title = `Debug: Frame at ${timeInSeconds}s`;
        
        // DOM에 임시로 추가 (5초 후 제거)
        document.body.appendChild(debugImg);
        setTimeout(() => {
          if (document.body.contains(debugImg)) {
            document.body.removeChild(debugImg);
          }
        }, 5000);
        
        // 프레임이 완전히 검은색인지 확인
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, Math.min(canvas.width, 100), Math.min(canvas.height, 100));
        const isBlack = this.checkIfFrameIsBlack(imageData);
        console.log(`Frame at ${timeInSeconds}s is ${isBlack ? 'BLACK' : 'not black'}`);
      }
      
      return dataUrl;

    } catch (error) {
      console.error(`Error capturing frame at ${timeInSeconds}s:`, error);
      throw new Error(`Frame capture failed: ${error.message}`);
    } finally {
      // 4. 원본 크기로 복원
      this.restoreOriginalStyles(originalStyles);
    }
  }

  /**
   * 여러 프레임을 연속적으로 캡처
   * @param {number} duration - 총 시간 (초)
   * @param {number} fps - 프레임 레이트
   * @param {Object} options - 캡처 옵션
   * @param {Function} onProgress - 진행률 콜백 (progress: 0-1)
   * @param {number} startTime - 시작 시간 (초) - 기본값 0
   * @returns {Promise<string[]>} - 캡처된 프레임들의 데이터 URL 배열
   */
  async captureFrameSequence(duration, fps = 30, options = {}, onProgress = null, startTime = 0) {
    const frames = [];
    const totalFrames = Math.ceil(duration * fps);
    const frameInterval = 1 / fps;

    console.log(`Starting frame capture: ${totalFrames} frames @ ${fps}fps from ${startTime}s to ${startTime + duration}s`);

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      const currentTime = startTime + (frameIndex * frameInterval);
      
      try {
        // 프레임 캡처 (첫 번째 프레임은 추가 대기 시간 적용)
        const isFirstFrame = frameIndex === 0;
        const frameOptions = isFirstFrame ? 
          { ...options, waitTime: (options.waitTime || 100) + 200 } : // 첫 프레임 추가 대기
          options;
          
        const frameData = await this.captureFrame(currentTime, frameOptions);
        frames.push(frameData);

        // 진행률 업데이트
        const progress = (frameIndex + 1) / totalFrames;
        if (onProgress) {
          onProgress({
            current: frameIndex + 1,
            total: totalFrames,
            progress: progress,
            currentTime: currentTime,
            estimatedTimeLeft: this.estimateTimeLeft(frameIndex, totalFrames, Date.now())
          });
        }

        // 메모리 압박을 피하기 위해 더 자주 가비지 컬렉션 실행
        if (frameIndex % 10 === 0) {
          // 강제 가비지 컬렉션 시도
          if (window.gc) {
            window.gc();
          }
          // 메모리 정리를 위한 약간의 대기
          await new Promise(resolve => setTimeout(resolve, 5));
        }

      } catch (error) {
        console.error(`Failed to capture frame ${frameIndex} at time ${currentTime}s:`, error);
        // 실패한 프레임은 이전 프레임으로 대체 (fallback)
        const lastFrame = frames[frames.length - 1];
        if (lastFrame) {
          frames.push(lastFrame);
        } else {
          // 첫 번째 프레임이 실패한 경우 빈 캔버스 생성
          frames.push(this.createEmptyFrame(options.width || 1920, options.height || 1080));
        }
      }
    }

    console.log(`Frame capture completed: ${frames.length}/${totalFrames} frames`);
    return frames;
  }

  /**
   * 비디오와 렌더러를 특정 시간으로 정확하게 이동
   * @param {number} timeInSeconds - 이동할 시간 (초)
   * @returns {Promise<void>}
   */
  async seekVideoToTime(timeInSeconds) {
    return new Promise(async (resolve) => {
      const video = this.video;
      
      // 이미 해당 시간에 있으면 바로 완료 (성능 최적화: 허용 오차 확대)
      if (Math.abs(video.currentTime - timeInSeconds) < 0.05) {
        // 렌더러도 동기화
        if (this.renderer) {
          this.renderer.seek(timeInSeconds);
        }
        resolve();
        return;
      }
      
      // 비디오 프레임 준비 완료를 위한 이벤트 핸들러들
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('canplay', onCanPlay);
        
        // 비디오 시킹 완료 후 렌더러도 동기화
        if (this.renderer) {
          console.log(`Syncing renderer to ${timeInSeconds}s`);
          this.renderer.seek(timeInSeconds);
          
          // 렌더러 상태 확인
          setTimeout(() => {
            if (this.renderer && this.renderer.getCurrentTime) {
              const rendererTime = this.renderer.getCurrentTime();
              console.log(`Renderer sync check: target=${timeInSeconds}s, actual=${rendererTime}s`);
              if (Math.abs(rendererTime - timeInSeconds) > 0.1) {
                console.warn(`⚠️ Renderer sync mismatch! Target: ${timeInSeconds}s, Actual: ${rendererTime}s`);
              }
            }
          }, 50);
        }
        
        // 비디오 프레임 안정화 대기
        setTimeout(() => {
          console.log(`Video seeked to ${timeInSeconds}s, actual: ${video.currentTime}s`);
          resolve();
        }, 100); // 프레임 안정화를 위한 추가 대기
      };
      
      const onCanPlay = () => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('canplay', onCanPlay);
        
        if (this.renderer) {
          console.log(`Syncing renderer to ${timeInSeconds}s (canplay)`);
          this.renderer.seek(timeInSeconds);
          
          // 렌더러 상태 확인 (canplay)
          setTimeout(() => {
            if (this.renderer && this.renderer.getCurrentTime) {
              const rendererTime = this.renderer.getCurrentTime();
              console.log(`Renderer sync check (canplay): target=${timeInSeconds}s, actual=${rendererTime}s`);
            }
          }, 50);
        }
        
        setTimeout(() => {
          console.log(`Video ready at ${timeInSeconds}s, actual: ${video.currentTime}s`);
          resolve();
        }, 100);
      };
      
      // 비디오 시간 이동
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('canplay', onCanPlay);
      video.currentTime = timeInSeconds;
      
      // 타임아웃 보호 (1초 후 강제 완료 - 비디오 로딩 대기 시간 증가)
      setTimeout(() => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('canplay', onCanPlay);
        
        // 타임아웃 시에도 렌더러 동기화 시도
        if (this.renderer) {
          console.log(`Timeout sync renderer to ${timeInSeconds}s`);
          this.renderer.seek(timeInSeconds);
        }
        
        resolve();
      }, 1000);
    });
  }

  /**
   * DOM 업데이트를 기다리는 헬퍼 함수
   * @param {number} waitTime - 대기 시간 (밀리초)
   * @returns {Promise<void>}
   */
  async waitForRender(waitTime = 50) {
    // DOM 업데이트 보장 (더블 버퍼링)
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // GSAP 애니메이션 완료를 위한 대기 시간 (렌더러 동기화 고려)
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // 비디오 프레임과 애니메이션 정착을 위한 추가 대기
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => setTimeout(resolve, 50)); // 비디오 프레임 안정화
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    console.log(`Render wait completed: ${waitTime}ms + frame stabilization`);
  }

  /**
   * 빈 프레임 생성 (fallback용)
   * @param {number} width 
   * @param {number} height 
   * @returns {string} - 빈 프레임의 데이터 URL
   */
  createEmptyFrame(width = 1920, height = 1080) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // 검은 배경
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    return canvas.toDataURL('image/png');
  }

  /**
   * 남은 시간 추정 (진행률 표시용)
   * @param {number} currentFrame 
   * @param {number} totalFrames 
   * @param {number} startTime 
   * @returns {number} - 예상 남은 시간 (밀리초)
   */
  estimateTimeLeft(currentFrame, totalFrames, startTime) {
    if (currentFrame === 0) return 0;
    
    const elapsed = Date.now() - startTime;
    const avgTimePerFrame = elapsed / (currentFrame + 1);
    const remainingFrames = totalFrames - (currentFrame + 1);
    
    return Math.round(remainingFrames * avgTimePerFrame);
  }

  /**
   * 원본 컨테이너 스타일 저장
   * @returns {Object} - 저장된 스타일 정보
   */
  saveOriginalStyles() {
    const video = this.video;
    const container = this.container;
    const captionContainer = container.querySelector('#caption-container');
    
    return {
      container: {
        width: container.style.width || getComputedStyle(container).width,
        height: container.style.height || getComputedStyle(container).height,
        position: container.style.position,
        overflow: container.style.overflow
      },
      video: {
        width: video.style.width || video.getAttribute('width') + 'px',
        height: video.style.height || video.getAttribute('height') + 'px',
        objectFit: video.style.objectFit
      },
      caption: captionContainer ? {
        width: captionContainer.style.width,
        height: captionContainer.style.height
      } : null
    };
  }

  /**
   * 컨테이너를 캡처용 크기로 조정
   * @param {number} targetWidth - 목표 너비
   * @param {number} targetHeight - 목표 높이
   */
  resizeContainerForCapture(targetWidth, targetHeight) {
    const video = this.video;
    const container = this.container;
    const captionContainer = container.querySelector('#caption-container');
    
    console.log(`Resizing container for capture: ${targetWidth}x${targetHeight}`);
    
    // 컨테이너 크기 조정
    container.style.width = `${targetWidth}px`;
    container.style.height = `${targetHeight}px`;
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    
    // 비디오 크기 조정
    video.style.width = `${targetWidth}px`;
    video.style.height = `${targetHeight}px`;
    video.style.objectFit = 'fill'; // 전체 영역을 채우도록
    
    // 자막 컨테이너 크기 조정
    if (captionContainer) {
      captionContainer.style.width = `${targetWidth}px`;
      captionContainer.style.height = `${targetHeight}px`;
    }
    
    // 강제 레이아웃 업데이트
    container.offsetHeight; // Force reflow
  }

  /**
   * 원본 스타일로 복원
   * @param {Object} originalStyles - 저장된 원본 스타일
   */
  restoreOriginalStyles(originalStyles) {
    if (!originalStyles) return;
    
    const video = this.video;
    const container = this.container;
    const captionContainer = container.querySelector('#caption-container');
    
    console.log('Restoring original container styles');
    
    // 컨테이너 복원
    Object.assign(container.style, originalStyles.container);
    
    // 비디오 복원
    Object.assign(video.style, originalStyles.video);
    
    // 자막 컨테이너 복원
    if (captionContainer && originalStyles.caption) {
      Object.assign(captionContainer.style, originalStyles.caption);
    }
    
    // 강제 레이아웃 업데이트
    container.offsetHeight; // Force reflow
  }

  /**
   * 프레임이 검은색인지 확인하는 헬퍼 함수
   * @param {ImageData} imageData - 체크할 이미지 데이터
   * @returns {boolean} - 검은색 여부
   */
  checkIfFrameIsBlack(imageData) {
    const data = imageData.data;
    let blackPixels = 0;
    const totalPixels = data.length / 4;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (r + g + b) / 3;
      
      if (brightness < 30) { // 매우 어두운 픽셀
        blackPixels++;
      }
    }
    
    const blackRatio = blackPixels / totalPixels;
    return blackRatio > 0.9; // 90% 이상이 검은색이면 검은 프레임으로 간주
  }

  /**
   * 리소스 정리
   */
  dispose() {
    this.video = null;
    this.container = null;
    this.renderer = null;
    this.canvas = null;
  }
}

export default FrameCapture;