import html2canvas from 'html2canvas';

/**
 * 🚀 Optimized Capture Engine
 * 스마트 프레임 스키핑과 시간 가속을 통한 고속 MP4 내보내기 엔진
 */
export class OptimizedCapture {
  constructor(videoElement, containerElement, renderer = null) {
    this.video = videoElement;
    this.container = containerElement;
    this.renderer = renderer;
    
    // 성능 최적화 설정
    this.config = {
      // 🚀 초극단적 스키핑 설정 (5분 영상 → 2분 처리 목표)
      minFrameInterval: 15.0, // 15초 최소 간격 (기존 5초 → 15초, 3배 확대)
      changeDetectionThreshold: 3.0, // 변화 감지 임계값 3배 확대 (2.0 → 3.0)
      staticFrameMaxDuration: 45.0, // 정적 구간 45초까지 허용 (30초 → 45초)
      
      // 🏃‍♂️ 극한 가속 설정 (2분 목표)
      accelerationFactor: 150, // 150배 가속 (기존 100배 → 150배)
      fastDOMWaitTime: 0, // DOM 대기 시간 완전 제거 (유지)
      quickSeekTolerance: 0.3, // 빠른 시킹 허용 오차 확대 (0.2초 → 0.3초)
      
      // 🗂️ 메가 배치 처리 설정
      batchSize: 300, // 배치 크기 확대 (200 → 300개)
      memoryLimit: 700 * 1024 * 1024, // 메모리 한계 확대 (500MB → 700MB)
    };
    
    this.keyframes = []; // 캡처해야 할 키프레임 목록
    this.capturedFrames = []; // 캡처된 프레임 배치
    this.totalBytesUsed = 0; // 메모리 사용량 추적
  }

  /**
   * 🎯 CwI 자막 시나리오 분석 및 키프레임 추출
   * @param {Object} scenario - CwI 시나리오 JSON 데이터 
   * @param {number} startTime - 시작 시간
   * @param {number} endTime - 종료 시간
   * @param {number} fps - 목표 프레임레이트
   * @returns {Array} 최적화된 키프레임 목록
   */
  analyzeScenarioForKeyframes(scenario, startTime = 0, endTime = null, fps = 30) {
    console.log('🔍 Analyzing CwI scenario for smart keyframes...');
    
    const keyframes = [];
    const frameInterval = 1 / fps;
    const videoDuration = endTime || this.video.duration || 10;
    
    // 1️⃣ 자막 활성 구간 분석
    const subtitleEvents = this.extractSubtitleEvents(scenario);
    console.log(`Found ${subtitleEvents.length} subtitle events`);
    
    // 2️⃣ 키프레임 생성 전략
    let currentTime = startTime;
    
    // 시작 프레임 (필수)
    keyframes.push({
      time: currentTime,
      reason: 'video_start',
      priority: 'high',
      batchId: 0
    });
    
    // 🚀 극한 키프레임 생성: 자막 시작/끝만 + 20초마다 1개 (2분 목표)
    const ULTRA_MINIMAL_INTERVAL = 20.0; // 20초마다 1개 키프레임 (기존 10초 → 20초, 50% 추가 축소)
    
    // 자막 이벤트는 시작/끝만 캡처 (중간 과정 완전 제거)
    subtitleEvents.forEach((event, index) => {
      // 🎯 자막 시작만 (pre-start 제거)
      if (event.start > currentTime + frameInterval) {
        keyframes.push({
          time: event.start,
          reason: 'subtitle_start',
          eventId: index,
          priority: 'high',
          batchId: Math.floor(keyframes.length / this.config.batchSize)
        });
      }
      
      // 🎯 자막 종료만 (극한 스킵: 3초 이상만) - 2분 목표
      if (event.end > event.start + 3.0) { // 3초 이상인 긴 자막만 종료 프레임 캡처 (2초 → 3초)
        keyframes.push({
          time: event.end,
          reason: 'subtitle_end',
          eventId: index,
          priority: 'medium', // 우선순위 하향 (high → medium)
          batchId: Math.floor(keyframes.length / this.config.batchSize)
        });
      }
      
      currentTime = Math.max(currentTime, event.end);
    });
    
    // 🌊 빈 구간 보완: 20초마다 1개씩만 추가 (5초 → 20초)
    let fillTime = startTime;
    while (fillTime < videoDuration - ULTRA_MINIMAL_INTERVAL) {
      fillTime += ULTRA_MINIMAL_INTERVAL;
      
      // 기존 자막 키프레임과 겹치지 않는 경우만 (허용 오차 확대 1초 → 2초)
      const hasNearbyKeyframe = keyframes.some(kf => Math.abs(kf.time - fillTime) < 2.0);
      if (!hasNearbyKeyframe) {
        keyframes.push({
          time: fillTime,
          reason: 'interval_fill',
          priority: 'low',
          batchId: Math.floor(keyframes.length / this.config.batchSize)
        });
      }
    }
    
    // 종료 프레임 (필수)
    if (videoDuration > currentTime + frameInterval) {
      keyframes.push({
        time: videoDuration - frameInterval,
        reason: 'video_end',
        priority: 'high', 
        batchId: Math.floor(keyframes.length / this.config.batchSize)
      });
    }
    
    // 3️⃣ 키프레임 최적화 및 정렬
    const optimizedKeyframes = this.optimizeKeyframes(keyframes, frameInterval);
    
    console.log(`✅ Keyframe analysis complete: ${optimizedKeyframes.length} keyframes (${Math.round((1 - optimizedKeyframes.length / (videoDuration * fps)) * 100)}% reduction)`);
    
    this.keyframes = optimizedKeyframes;
    return optimizedKeyframes;
  }

  /**
   * 📊 시나리오에서 자막 이벤트 추출
   */
  extractSubtitleEvents(scenario) {
    const events = [];
    
    if (!scenario.cues) return events;
    
    scenario.cues.forEach(cue => {
      if (cue.hintTime) {
        events.push({
          start: cue.hintTime.start,
          end: cue.hintTime.end,
          cueId: cue.id,
          hasAnimation: this.hasComplexAnimation(cue)
        });
      }
    });
    
    return events.sort((a, b) => a.start - b.start);
  }

  /**
   * 🎨 CwI 애니메이션 프레임 생성 (변화점 기반)
   */
  generateAnimationFrames(event, fps) {
    const frames = [];
    const duration = event.end - event.start;
    const frameInterval = 1 / fps;
    
    // CwI 애니메이션 특성 고려 (pop, whisper, loud 효과)
    if (event.hasAnimation && duration > 0.5) {
      // 애니메이션 시작 후 0.2초까지 집중 캡처 (pop 효과)
      const intensiveEnd = Math.min(event.start + 0.2, event.end);
      let time = event.start + frameInterval;
      
      while (time < intensiveEnd) {
        frames.push({
          time,
          reason: 'animation_intensive',
          eventId: event.cueId,
          priority: 'medium'
        });
        time += frameInterval;
      }
      
      // 나머지 구간은 간헐적 샘플링 (0.1초마다)
      time = intensiveEnd + 0.1;
      while (time < event.end - 0.1) {
        frames.push({
          time,
          reason: 'animation_sample',
          eventId: event.cueId,
          priority: 'low'
        });
        time += 0.1;
      }
    }
    
    return frames;
  }

  /**
   * 🔧 키프레임 최적화 (중복 제거, 우선순위 정렬)
   */
  optimizeKeyframes(keyframes, frameInterval) {
    // 시간순 정렬
    keyframes.sort((a, b) => a.time - b.time);
    
    // 중복 및 너무 가까운 키프레임 제거
    const optimized = [];
    let lastTime = -1;
    
    for (const frame of keyframes) {
      if (frame.time - lastTime >= frameInterval * 0.8) { // 최소 간격 보장
        optimized.push(frame);
        lastTime = frame.time;
      } else if (frame.priority === 'high') {
        // 고우선순위 프레임은 이전 프레임 대체
        if (optimized.length > 0) {
          optimized[optimized.length - 1] = frame;
        } else {
          optimized.push(frame);
        }
        lastTime = frame.time;
      }
    }
    
    return optimized;
  }

  /**
   * ⚡ 고속 프레임 캡처 (시간 가속 + 스마트 스키핑)
   * @param {Object} options - 캡처 옵션
   * @param {Function} onProgress - 진행률 콜백
   * @returns {Promise<Array>} 캡처된 프레임 배열
   */
  async captureOptimizedFrames(options = {}, onProgress = null) {
    const {
      width = 640,  // 🚨 극단적 최적화: 1920 → 640
      height = 360, // 🚨 극단적 최적화: 1080 → 360  
      quality = 0.7, // 🚨 품질 낮춤: 0.9 → 0.7
      scenario = null
    } = options;
    
    if (!this.keyframes.length && scenario) {
      this.analyzeScenarioForKeyframes(scenario, 0, this.video.duration, 30);
    }
    
    console.log(`🚀 Starting optimized capture: ${this.keyframes.length} keyframes`);
    
    const allFrames = [];
    const totalFrames = this.keyframes.length;
    let currentBatch = [];
    let currentBatchId = 0;
    
    // 원본 스타일 저장
    const originalStyles = this.saveOriginalStyles();
    
    try {
      // 고속 캡처 모드로 컨테이너 준비
      this.prepareForFastCapture(width, height);
      
      for (let i = 0; i < totalFrames; i++) {
        const keyframe = this.keyframes[i];
        
        try {
          // ⚡ 고속 시킹 (대기시간 최소화)
          await this.fastSeekToTime(keyframe.time);
          
          // ⚡ 빠른 DOM 안정화 (5ms만 대기)
          await this.fastWaitForRender(this.config.fastDOMWaitTime);
          
          // 🎯 프레임 캡처
          const frameData = await this.captureFrameFast(keyframe.time, { width, height, quality });
          
          // 배치에 추가
          currentBatch.push({
            data: frameData,
            time: keyframe.time,
            keyframe: keyframe
          });
          
          this.totalBytesUsed += this.estimateFrameSize(frameData);
          
          // 배치 완료 또는 메모리 한계 체크
          if (currentBatch.length >= this.config.batchSize || 
              this.totalBytesUsed > this.config.memoryLimit ||
              keyframe.batchId !== currentBatchId) {
            
            // 배치를 결과에 추가
            allFrames.push(...currentBatch);
            
            // 진행률 업데이트
            if (onProgress) {
              onProgress({
                stage: 'capturing',
                progress: (i + 1) / totalFrames,
                currentFrame: i + 1,
                totalFrames,
                batchCompleted: currentBatchId,
                memoryUsed: this.totalBytesUsed,
                currentTime: keyframe.time
              });
            }
            
            // 배치 리셋 (메모리 절약)
            currentBatch = [];
            currentBatchId = keyframe.batchId;
            this.totalBytesUsed = 0;
            
            // 가비지 컬렉션 힌트
            if (window.gc) window.gc();
            
            // 짧은 휴식 (UI 응답성 보장)
            await new Promise(resolve => setTimeout(resolve, 1));
          }
          
        } catch (error) {
          console.warn(`⚠️ Failed to capture keyframe at ${keyframe.time}s:`, error);
          
          // 실패한 프레임은 이전 프레임으로 대체
          if (currentBatch.length > 0) {
            const lastFrame = currentBatch[currentBatch.length - 1];
            currentBatch.push({
              data: lastFrame.data,
              time: keyframe.time,
              keyframe: keyframe,
              fallback: true
            });
          }
        }
      }
      
      // 남은 배치 처리
      if (currentBatch.length > 0) {
        allFrames.push(...currentBatch);
      }
      
      console.log(`✅ Optimized capture completed: ${allFrames.length} frames captured`);
      
      return allFrames;
      
    } finally {
      // 원본 스타일 복원
      this.restoreOriginalStyles(originalStyles);
    }
  }

  /**
   * ⚡ 고속 시킹 (대기시간 최소화)
   */
  async fastSeekToTime(timeInSeconds) {
    return new Promise((resolve) => {
      const video = this.video;
      
      // 허용 오차 내에 있으면 바로 완료
      if (Math.abs(video.currentTime - timeInSeconds) < this.config.quickSeekTolerance) {
        if (this.renderer) {
          this.renderer.seek(timeInSeconds);
        }
        resolve();
        return;
      }
      
      // 빠른 시킹
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        
        if (this.renderer) {
          this.renderer.seek(timeInSeconds);
        }
        
        resolve();
      };
      
      video.addEventListener('seeked', onSeeked);
      video.currentTime = timeInSeconds;
      
      // 200ms 타임아웃 (기존 1초 → 200ms)
      setTimeout(() => {
        video.removeEventListener('seeked', onSeeked);
        if (this.renderer) {
          this.renderer.seek(timeInSeconds);
        }
        resolve();
      }, 200);
    });
  }

  /**
   * ⚡ 빠른 DOM 안정화 (최소 대기)
   */
  async fastWaitForRender(waitTime = 5) {
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    await new Promise(resolve => requestAnimationFrame(resolve));
  }

  /**
   * 🎯 고속 프레임 캡처 (Hidden Canvas 방식)
   */
  async captureFrameFast(timeInSeconds, options = {}) {
    const { width = 240, height = 135, quality = 0.3 } = options; // 🚀 극한 저해상도 240x135, 품질 0.3 (2.5분 목표)
    
    try {
      // 1. 🚀 Hidden Container 생성 (메인 DOM 건드리지 않음)
      const hiddenContainer = await this.createHiddenContainerFast(width, height);
      
      try {
        // 2. html2canvas로 숨겨진 컨테이너 캡처
        const canvas = await html2canvas(hiddenContainer, {
          width: width,
          height: height,
          scale: 1, // Hidden container는 이미 목표 크기로 설정됨
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#000000',
          logging: false, // 성능을 위해 로깅 비활성화
          removeContainer: false, // Hidden container는 별도로 정리
          imageTimeout: 2000, // 🚨 타임아웃 단축: 2초
          foreignObjectRendering: false
        });

        // 3. Canvas를 데이터 URL로 변환
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // 🔍 캡처된 데이터 검증
        if (!dataUrl || dataUrl.length < 1000) {
          console.warn(`⚠️ 의심스러운 프레임 데이터 at ${timeInSeconds}s:`, {
            dataUrlLength: dataUrl?.length || 0,
            canvasSize: `${canvas.width}x${canvas.height}`
          });
        } else {
          console.log(`✅ Frame captured at ${timeInSeconds}s: ${Math.round(dataUrl.length/1024)}KB`);
        }
        
        return dataUrl;
        
      } finally {
        // 4. Hidden Container 정리
        this.removeHiddenContainerFast(hiddenContainer);
      }
      
    } catch (error) {
      console.error(`❌ Fast capture error at ${timeInSeconds}s:`, error);
      throw new Error(`Fast frame capture failed: ${error.message}`);
    }
  }

  /**
   * 🎨 고속 캡처를 위한 컨테이너 준비 (메인 UI 건드리지 않음)
   */
  prepareForFastCapture(width, height) {
    // ⚠️ 메인 컨테이너는 수정하지 않음 - Hidden Container만 사용
    // 기존 코드에서 메인 UI 변경 로직 제거하여 사이드 이펙트 방지
    console.log(`🎯 Fast capture prepared for ${width}x${height} (Hidden Container Only)`);
  }

  /**
   * 🔧 헬퍼 함수들
   */
  hasComplexAnimation(cue) {
    // CwI 플러그인 체인이 있는지 확인
    const checkNode = (node) => {
      if (node.pluginChain && node.pluginChain.length > 0) return true;
      if (node.plugin) return true;
      if (node.children) {
        return node.children.some(child => checkNode(child));
      }
      return false;
    };
    
    return checkNode(cue.root);
  }

  estimateFrameSize(dataUrl) {
    // Base64 문자열 크기 추정
    return dataUrl.length * 0.75; // Base64 는 원본의 약 133% 크기
  }

  saveOriginalStyles() {
    // 기존 FrameCapture와 동일한 로직
    const video = this.video;
    const container = this.container;
    const captionContainer = container.querySelector('#caption-container');
    
    return {
      container: {
        width: container.style.width || getComputedStyle(container).width,
        height: container.style.height || getComputedStyle(container).height,
        position: container.style.position,
        overflow: container.style.overflow,
        willChange: container.style.willChange
      },
      video: {
        width: video.style.width || video.getAttribute('width') + 'px',
        height: video.style.height || video.getAttribute('height') + 'px',
        objectFit: video.style.objectFit,
        position: video.style.position,
        transform: video.style.transform,
        willChange: video.style.willChange
      },
      caption: captionContainer ? {
        width: captionContainer.style.width,
        height: captionContainer.style.height
      } : null
    };
  }

  restoreOriginalStyles(originalStyles) {
    if (!originalStyles) return;
    
    const video = this.video;
    const container = this.container;
    const captionContainer = container.querySelector('#caption-container');
    
    // 스타일 복원
    Object.assign(container.style, originalStyles.container);
    Object.assign(video.style, originalStyles.video);
    
    if (captionContainer && originalStyles.caption) {
      Object.assign(captionContainer.style, originalStyles.caption);
    }
    
    container.offsetHeight; // Force reflow
  }

  /**
   * 🚀 Fast Hidden Container 생성 (OptimizedCapture 전용)
   * @param {number} width - 목표 너비
   * @param {number} height - 목표 높이
   * @returns {Promise<HTMLElement>} - 숨겨진 컨테이너
   */
  async createHiddenContainerFast(width, height) {
    // 1. 숨겨진 컨테이너 생성
    const hiddenContainer = document.createElement('div');
    hiddenContainer.className = 'hidden-optimized-container';
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
    
    // 2. 메인 컨테이너 복제 (간소화된 버전)
    const clonedContainer = this.container.cloneNode(true);
    clonedContainer.style.cssText = `
      width: ${width}px;
      height: ${height}px;
      position: relative;
      overflow: hidden;
      background: #000000;
    `;
    
    // 3. 비디오 요소 설정 (빠른 설정)
    const clonedVideo = clonedContainer.querySelector('video');
    if (clonedVideo) {
      // 원본 비디오와 동기화
      clonedVideo.currentTime = this.video.currentTime;
      clonedVideo.muted = true; // 오디오 재생 방지
      
      // 원본 비디오 소스 확인 및 설정
      if (this.video.src) {
        clonedVideo.src = this.video.src;
      } else if (this.video.currentSrc) {
        clonedVideo.src = this.video.currentSrc;
      }
      
      console.log('🎬 Cloned video setup:', {
        originalTime: this.video.currentTime,
        clonedTime: clonedVideo.currentTime,
        videoSrc: clonedVideo.src
      });
      
      clonedVideo.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        transform: translate(-50%, -50%);
        display: block;
        visibility: visible;
        opacity: 1;
      `;
    }
    
    // 4. 자막 컨테이너 설정 (빠른 설정)
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
    
    // 5. DOM에 추가
    hiddenContainer.appendChild(clonedContainer);
    document.body.appendChild(hiddenContainer);
    
    return hiddenContainer;
  }

  /**
   * Fast Hidden Container 제거
   * @param {HTMLElement} hiddenContainer - 제거할 컨테이너
   */
  removeHiddenContainerFast(hiddenContainer) {
    if (hiddenContainer && document.body.contains(hiddenContainer)) {
      document.body.removeChild(hiddenContainer);
    }
  }

  /**
   * 🧹 리소스 정리
   */
  dispose() {
    this.keyframes = [];
    this.capturedFrames = [];
    this.totalBytesUsed = 0;
    this.video = null;
    this.container = null;
    this.renderer = null;
  }
}

export default OptimizedCapture;