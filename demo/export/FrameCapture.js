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
      width = 240,  // 🚀 극한 저해상도: 320 → 240 (2.5분 목표)
      height = 135, // 🚀 극한 저해상도: 180 → 135 (2.5분 목표)
      quality = 0.3, // 🚀 극한 저품질: 0.5 → 0.3 (속도 절대 우선)
      waitTime = 0 // DOM 대기 완전 제거 (5ms → 0ms)
    } = options;

    try {
      // 1. 비디오를 특정 시간으로 이동 (가상 시간 주입)
      await this.seekVideoToTime(timeInSeconds);
      
      // 2. DOM 업데이트 및 애니메이션이 적용될 때까지 대기
      await this.waitForRender(waitTime);

      // 3. 🚀 Hidden Canvas 방식: 메인 DOM을 건드리지 않고 백그라운드 캡처
      const hiddenContainer = await this.createHiddenContainer(width, height);
      
      try {
        // 4. html2canvas로 숨겨진 컨테이너 캡처
        console.log(`🎯 Hidden capture: ${width}x${height} (main container undisturbed)`);
        
        const canvas = await html2canvas(hiddenContainer, {
          width: width,
          height: height,
          scale: 1, // Hidden container는 이미 목표 크기로 설정됨
          useCORS: true, // CORS 문제 해결
          allowTaint: false,
          backgroundColor: '#000000', // 비디오 배경색과 일치
          logging: false, // 성능을 위해 로깅 비활성화
          removeContainer: false, // Hidden container는 별도로 정리
          imageTimeout: 3000, // 🚨 비디오 로딩 타임아웃 단축: 15초 → 3초
          foreignObjectRendering: false // 비디오 렌더링 방식 변경
        });

        // 5. Canvas를 데이터 URL로 변환 (JPEG 최적화)
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        console.log(`✅ Hidden capture completed: ${canvas.width}x${canvas.height}, ${dataUrl.length} chars`);
        return dataUrl;
        
      } catch (error) {
        console.error(`❌ Hidden capture error at ${timeInSeconds}s:`, error);
        throw new Error(`Hidden frame capture failed: ${error.message}`);
      } finally {
        // 6. Hidden Container 정리
        this.removeHiddenContainer(hiddenContainer);
      }
      
    } catch (error) {
      console.error(`❌ Outer capture error at ${timeInSeconds}s:`, error);
      throw new Error(`Frame capture failed: ${error.message}`);
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
        // 프레임 캡처 (첫 번째 프레임은 추가 대기 시간 적용) - 🚨 긴급 최적화
        const isFirstFrame = frameIndex === 0;
        const frameOptions = isFirstFrame ? 
          { ...options, waitTime: Math.max(50, (options.waitTime || 10) + 50) } : // 첫 프레임 최소 대기로 단축
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

        // 메모리 압박을 피하기 위해 더 자주 가비지 컬렉션 실행 - 🚨 긴급 최적화: 대기시간 제거
        if (frameIndex % 20 === 0) {
          // 강제 가비지 컬렉션 시도 (대기시간 없음)
          if (window.gc) {
            window.gc();
          }
          // 🚨 메모리 정리 대기시간 제거 (5ms → 0ms)
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
      
      // 이미 해당 시간에 있으면 바로 완료 (🚨 긴급 최적화: 허용 오차 더 확대)
      if (Math.abs(video.currentTime - timeInSeconds) < 0.1) {
        // 렌더러도 동기화
        if (this.renderer) {
          this.renderer.seek(timeInSeconds);
        }
        resolve();
        return;
      }
      
      // 비디오 프레임 준비 완료를 위한 이벤트 핸들러들
      const onSeeked = async () => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('canplay', onCanPlay);
        
        // 비디오 시킹 완료 후 렌더러도 동기화
        if (this.renderer) {
          console.log(`Syncing renderer to ${timeInSeconds}s`);
          await this.syncRendererWithRetry(timeInSeconds, 3);
        }
        
        // 비디오 프레임 안정화 대기 - 🚨 긴급 최적화: 100ms → 30ms
        setTimeout(() => {
          console.log(`Video seeked to ${timeInSeconds}s, actual: ${video.currentTime}s`);
          resolve();
        }, 30); // 🚨 프레임 안정화 대기시간 대폭 단축
      };
      
      const onCanPlay = async () => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('canplay', onCanPlay);
        
        if (this.renderer) {
          console.log(`Syncing renderer to ${timeInSeconds}s (canplay)`);
          await this.syncRendererWithRetry(timeInSeconds, 2);
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
      
      // 타임아웃 보호 - 🚨 긴급 최적화: 1초 → 300ms
      setTimeout(async () => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('canplay', onCanPlay);
        
        // 타임아웃 시에도 렌더러 동기화 시도
        if (this.renderer) {
          console.log(`Timeout sync renderer to ${timeInSeconds}s`);
          await this.syncRendererWithRetry(timeInSeconds, 1);
        }
        
        resolve();
      }, 300); // 🚨 시킹 타임아웃 대폭 단축
    });
  }

  /**
   * DOM 업데이트를 기다리는 헬퍼 함수
   * @param {number} waitTime - 대기 시간 (밀리초)
   * @returns {Promise<void>}
   */
  async waitForRender(waitTime = 150) {
    // 🎬 GSAP 애니메이션 완료 대기 강화
    console.log('⏳ Waiting for GSAP animations and DOM updates...');
    
    // 1. 기본 DOM 업데이트 대기 (더블 버퍼링)
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // 2. GSAP 애니메이션 활성 상태 체크 및 완료 대기
    await this.waitForGSAPAnimations();
    
    // 3. GSAP 애니메이션이 안정화될 때까지 대기 (더 긴 시간)
    await new Promise(resolve => setTimeout(resolve, Math.max(150, waitTime)));
    
    // 4. 추가 DOM 안정화 (GSAP 애니메이션 적용 완료)
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // 5. 비디오 프레임 안정화 (중요!)
    await new Promise(resolve => setTimeout(resolve, 100));
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // 6. 최종 GSAP 상태 검증
    await this.verifyGSAPAnimationState();
    
    console.log(`✅ Render wait completed: ${waitTime}ms + GSAP animation stabilization`);
  }

  /**
   * 🎬 GSAP 애니메이션 완료 감지 및 대기
   * @returns {Promise<void>}
   */
  async waitForGSAPAnimations() {
    const maxRetries = 10;
    const retryInterval = 50;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        // GSAP이 로드되어 있는지 확인
        if (typeof window.gsap !== 'undefined' && window.gsap.globalTimeline) {
          const isActive = window.gsap.globalTimeline.isActive();
          const activeTweens = window.gsap.globalTimeline.getChildren(true, true, false).filter(tween => 
            tween.isActive && tween.isActive()
          );

          console.log(`🎭 GSAP Status: Global active=${isActive}, Active tweens=${activeTweens.length}`);

          if (!isActive && activeTweens.length === 0) {
            console.log('✅ All GSAP animations completed');
            break;
          }

          // 활성 애니메이션이 있으면 추가 대기
          if (isActive || activeTweens.length > 0) {
            console.log(`⏳ Waiting for ${activeTweens.length} active GSAP animations...`);
            await new Promise(resolve => setTimeout(resolve, retryInterval * 2));
          }
        } else {
          console.log('⚠️ GSAP not available, using fallback timing');
          break;
        }
      } catch (error) {
        console.warn('⚠️ GSAP animation check failed:', error);
        break;
      }

      retries++;
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }

    if (retries >= maxRetries) {
      console.warn('⚠️ GSAP animation wait timeout, proceeding with capture');
    }
  }

  /**
   * 🎬 GSAP 애니메이션 상태 최종 검증
   * @returns {Promise<void>}
   */
  async verifyGSAPAnimationState() {
    try {
      if (typeof window.gsap !== 'undefined' && window.gsap.globalTimeline) {
        const isActive = window.gsap.globalTimeline.isActive();
        const activeTweens = window.gsap.globalTimeline.getChildren(true, true, false).filter(tween => 
          tween.isActive && tween.isActive()
        );

        if (isActive || activeTweens.length > 0) {
          console.warn(`⚠️ Animation verification: Still ${activeTweens.length} active tweens during capture`);
          // 추가 짧은 대기
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          console.log('✅ GSAP animation state verified: All animations stable');
        }
      }
    } catch (error) {
      console.warn('⚠️ GSAP animation verification failed:', error);
    }
  }

  /**
   * 🎬 렌더러 동기화 재시도 로직
   * @param {number} timeInSeconds - 동기화할 시간
   * @param {number} maxRetries - 최대 재시도 횟수
   * @returns {Promise<void>}
   */
  async syncRendererWithRetry(timeInSeconds, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 렌더러 시간 이동
        this.renderer.seek(timeInSeconds);
        
        // 동기화 완료 대기
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 동기화 검증
        if (this.renderer.getCurrentTime) {
          const rendererTime = this.renderer.getCurrentTime();
          const timeDiff = Math.abs(rendererTime - timeInSeconds);
          
          console.log(`🎭 Renderer sync attempt ${attempt}: target=${timeInSeconds}s, actual=${rendererTime}s, diff=${timeDiff.toFixed(3)}s`);
          
          if (timeDiff <= 0.15) {
            console.log(`✅ Renderer synchronized successfully on attempt ${attempt}`);
            
            // 추가 안정화 대기 (특히 복잡한 애니메이션의 경우)
            if (timeDiff > 0.05) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            return;
          } else if (attempt < maxRetries) {
            console.warn(`⚠️ Renderer sync mismatch (attempt ${attempt}/${maxRetries}), retrying...`);
            
            // 재시도 전 추가 대기
            await new Promise(resolve => setTimeout(resolve, 100 * attempt));
            
            // 강제 타임라인 업데이트 시도
            if (this.renderer.forceUpdate) {
              this.renderer.forceUpdate();
            }
          }
        } else {
          console.warn('⚠️ Renderer getCurrentTime method not available');
          return; // 검증할 수 없으면 그냥 진행
        }
      } catch (error) {
        console.error(`❌ Renderer sync error on attempt ${attempt}:`, error);
        if (attempt === maxRetries) {
          console.warn('⚠️ Renderer sync failed, proceeding anyway');
        }
      }
    }
    
    console.warn(`⚠️ Renderer sync failed after ${maxRetries} attempts`);
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
    
    // 컨테이너 크기 조정 및 강력한 오버플로우 제어
    container.style.width = `${targetWidth}px`;
    container.style.height = `${targetHeight}px`;
    container.style.position = 'relative';
    container.style.overflow = 'hidden'; // letterbox 부분 강제 자르기
    container.style.backgroundColor = '#000000'; // 배경 검정으로 설정
    
    // 비디오 크기 조정 및 절대 위치 지정 (오버사이즈 전략)
    video.style.position = 'absolute';
    video.style.top = '50%';
    video.style.left = '50%';
    video.style.width = '120%'; // 컨테이너보다 크게 설정  
    video.style.height = '120%'; // 컨테이너보다 크게 설정  
    video.style.objectFit = 'cover'; // 전체 화면 채움, 비율 유지
    video.style.objectPosition = 'center'; // 중앙 정렬
    // 전체 화면을 완전히 채우기 위한 강력한 확대
    video.style.transform = 'translate(-50%, -50%) scale(1.8)'; // 중앙 정렬 + 80% 확대
    video.style.transformOrigin = 'center'; // 중앙 기준 확대
    
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
   * 🚀 Hidden Container 생성 - 메인 DOM을 건드리지 않고 백그라운드 캡처
   * @param {number} width - 목표 너비
   * @param {number} height - 목표 높이
   * @returns {Promise<HTMLElement>} - 숨겨진 컨테이너
   */
  async createHiddenContainer(width, height) {
    console.log(`🏗️ Creating hidden container with animation state preservation: ${width}x${height}`);
    
    // 1. 숨겨진 컨테이너 생성
    const hiddenContainer = document.createElement('div');
    hiddenContainer.className = 'hidden-capture-container';
    hiddenContainer.style.cssText = `
      position: fixed;
      top: -10000px;
      left: -10000px;
      width: ${width}px;
      height: ${height}px;
      background: #000000;
      overflow: hidden;
      z-index: -9999;
      pointer-events: none;
      visibility: hidden;
    `;
    
    // 2. 메인 컨테이너 복제 (깊은 복제)
    const clonedContainer = this.container.cloneNode(true);
    clonedContainer.style.cssText = `
      width: ${width}px;
      height: ${height}px;
      position: relative;
      overflow: hidden;
      background: #000000;
    `;
    
    // 3. 🎬 애니메이션 상태 보존 - 활성 요소들의 computed style 복사
    await this.preserveAnimationStates(this.container, clonedContainer);
    
    // 4. 비디오 요소 설정
    const clonedVideo = clonedContainer.querySelector('video');
    if (clonedVideo) {
      // 원본 비디오와 동일한 currentTime 설정
      clonedVideo.currentTime = this.video.currentTime;
      clonedVideo.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        width: 120%;
        height: 120%;
        object-fit: cover;
        object-position: center;
        transform: translate(-50%, -50%);
        display: block;
        visibility: visible;
        opacity: 1;
      `;
      
      // 비디오 동기화
      await new Promise(resolve => {
        if (clonedVideo.readyState >= 2) {
          resolve();
        } else {
          clonedVideo.addEventListener('loadeddata', resolve, { once: true });
          clonedVideo.load();
        }
      });
    }
    
    // 5. 자막 컨테이너 설정
    const clonedCaptions = clonedContainer.querySelectorAll('.caption-overlay, #caption-container');
    clonedCaptions.forEach(caption => {
      caption.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: ${width}px;
        height: ${height}px;
        display: block;
        visibility: visible;
        opacity: 1;
        pointer-events: none;
      `;
    });
    
    // 6. DOM에 추가
    hiddenContainer.appendChild(clonedContainer);
    document.body.appendChild(hiddenContainer);
    
    // 7. 🎬 복제 후 GSAP 상태 최종 동기화
    await this.syncGSAPStateInHiddenContainer(hiddenContainer);
    
    console.log(`✅ Hidden container ready with animation states: video=${!!clonedVideo}, captions=${clonedCaptions.length}`);
    return hiddenContainer;
  }

  /**
   * 🎬 애니메이션 상태 보존 - 원본과 복제본 간 computed style 동기화
   * @param {HTMLElement} originalContainer - 원본 컨테이너
   * @param {HTMLElement} clonedContainer - 복제된 컨테이너
   * @returns {Promise<void>}
   */
  async preserveAnimationStates(originalContainer, clonedContainer) {
    console.log('🎭 Preserving animation states in cloned container...');
    
    try {
      // 애니메이션 요소들 찾기 (자막, 텍스트 요소들)
      const originalElements = originalContainer.querySelectorAll('[data-cue-id], .caption-text, .motion-text, [style*="transform"], [style*="opacity"]');
      const clonedElements = clonedContainer.querySelectorAll('[data-cue-id], .caption-text, .motion-text, [style*="transform"], [style*="opacity"]');
      
      console.log(`🔍 Found ${originalElements.length} animated elements to preserve`);
      
      for (let i = 0; i < Math.min(originalElements.length, clonedElements.length); i++) {
        const original = originalElements[i];
        const cloned = clonedElements[i];
        
        // Computed style 복사 (애니메이션이 적용된 최종 상태)
        const computedStyle = window.getComputedStyle(original);
        const importantProperties = [
          'transform', 'opacity', 'visibility', 'display',
          'left', 'top', 'right', 'bottom',
          'width', 'height', 'fontSize', 'color',
          'backgroundColor', 'border', 'borderRadius',
          'margin', 'padding', 'zIndex'
        ];
        
        importantProperties.forEach(prop => {
          const value = computedStyle.getPropertyValue(prop);
          if (value && value !== 'none' && value !== 'auto') {
            cloned.style.setProperty(prop, value, 'important');
          }
        });
        
        // GSAP 특정 데이터 속성 복사
        if (original.dataset) {
          Object.keys(original.dataset).forEach(key => {
            if (key.startsWith('gsap') || key.startsWith('tween')) {
              cloned.dataset[key] = original.dataset[key];
            }
          });
        }
      }
      
      console.log('✅ Animation states preserved successfully');
    } catch (error) {
      console.warn('⚠️ Animation state preservation failed:', error);
    }
  }

  /**
   * 🎬 Hidden Container에서 GSAP 상태 동기화
   * @param {HTMLElement} hiddenContainer - 숨겨진 컨테이너
   * @returns {Promise<void>}
   */
  async syncGSAPStateInHiddenContainer(hiddenContainer) {
    console.log('🎭 Syncing GSAP state in hidden container...');
    
    try {
      // Hidden container가 DOM에 추가된 후 한 프레임 대기
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // GSAP이 사용 가능한지 확인
      if (typeof window.gsap !== 'undefined') {
        // Hidden container 내의 모든 요소에 대해 GSAP refresh 시도
        const animatedElements = hiddenContainer.querySelectorAll('[data-cue-id], .caption-text, .motion-text');
        
        if (animatedElements.length > 0) {
          console.log(`🔄 Refreshing GSAP state for ${animatedElements.length} elements`);
          
          // GSAP ScrollTrigger나 기타 플러그인 refresh (있다면)
          if (window.gsap.ScrollTrigger && window.gsap.ScrollTrigger.refresh) {
            window.gsap.ScrollTrigger.refresh();
          }
          
          // 각 요소의 transform 등을 GSAP으로 재설정
          animatedElements.forEach((element, index) => {
            try {
              // 현재 computed style을 GSAP으로 설정
              const computedStyle = window.getComputedStyle(element);
              const transform = computedStyle.transform;
              const opacity = computedStyle.opacity;
              
              if (transform !== 'none') {
                window.gsap.set(element, { 
                  transform: transform,
                  opacity: opacity,
                  force3D: true // 하드웨어 가속 강제
                });
              }
            } catch (error) {
              console.warn(`⚠️ Failed to sync GSAP for element ${index}:`, error);
            }
          });
        }
        
        // 추가 안정화 대기
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('✅ GSAP state synchronized in hidden container');
    } catch (error) {
      console.warn('⚠️ GSAP state sync in hidden container failed:', error);
    }
  }

  /**
   * Hidden Container 제거
   * @param {HTMLElement} hiddenContainer - 제거할 컨테이너
   */
  removeHiddenContainer(hiddenContainer) {
    if (hiddenContainer && document.body.contains(hiddenContainer)) {
      document.body.removeChild(hiddenContainer);
      console.log(`🗑️ Hidden container removed`);
    }
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