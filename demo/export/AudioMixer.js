import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

/**
 * 🔊 Audio Mixer Engine
 * FFmpeg.js를 활용한 오디오 추출 및 비디오-오디오 병합 엔진
 * 원본 비디오의 오디오 트랙을 보존하여 최종 MP4에 포함
 */
export class AudioMixer {
  constructor() {
    this.ffmpeg = new FFmpeg();
    this.isLoaded = false;
    this.isLoading = false;
  }

  /**
   * FFmpeg 라이브러리 초기화
   * @returns {Promise<boolean>} 로딩 성공 여부
   */
  async loadFFmpeg() {
    if (this.isLoaded) return true;
    if (this.isLoading) {
      // 이미 로딩 중이면 완료까지 대기
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.isLoaded;
    }

    try {
      this.isLoading = true;
      console.log('🔄 Loading FFmpeg.js...');

      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      
      // FFmpeg 코어 라이브러리 로드
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
      });

      this.isLoaded = true;
      console.log('✅ FFmpeg.js loaded successfully');
      return true;

    } catch (error) {
      console.error('❌ Failed to load FFmpeg.js:', error);
      this.isLoaded = false;
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 🎵 원본 비디오에서 오디오 추출
   * @param {string} videoUrl - 원본 비디오 URL 또는 Blob URL
   * @param {Function} onProgress - 진행률 콜백
   * @returns {Promise<Uint8Array>} 추출된 오디오 데이터
   */
  async extractAudioFromVideo(videoUrl, onProgress = null) {
    if (!this.isLoaded) {
      const loadResult = await this.loadFFmpeg();
      if (!loadResult) {
        throw new Error('FFmpeg.js 로딩 실패');
      }
    }

    try {
      console.log('🎵 Extracting audio from original video...');
      
      if (onProgress) {
        onProgress({ stage: 'audio_extraction', progress: 0.1, message: '원본 비디오 분석 중...' });
      }

      // 원본 비디오를 FFmpeg 파일 시스템에 작성
      console.log('🎬 Fetching original video from:', videoUrl);
      const videoResponse = await fetch(videoUrl);
      
      if (!videoResponse.ok) {
        throw new Error(`비디오 페치 실패: ${videoResponse.status} ${videoResponse.statusText}`);
      }
      
      const videoData = new Uint8Array(await videoResponse.arrayBuffer());
      console.log(`📁 Video data size: ${Math.round(videoData.length / 1024 / 1024)}MB`);
      
      await this.ffmpeg.writeFile('input_video.mp4', videoData);

      if (onProgress) {
        onProgress({ stage: 'audio_extraction', progress: 0.3, message: '오디오 트랙 추출 중...' });
      }

      // 오디오 추출 명령 실행 (고품질 AAC)
      await this.ffmpeg.exec([
        '-i', 'input_video.mp4',
        '-vn', // 비디오 스트림 제거
        '-acodec', 'aac', // AAC 코덱 사용
        '-b:a', '192k', // 192kbps 비트레이트
        '-ac', '2', // 스테레오
        '-ar', '48000', // 48kHz 샘플레이트
        'extracted_audio.aac'
      ]);

      if (onProgress) {
        onProgress({ stage: 'audio_extraction', progress: 0.8, message: '오디오 데이터 읽기 중...' });
      }

      // 추출된 오디오 데이터 읽기
      const audioData = await this.ffmpeg.readFile('extracted_audio.aac');
      
      // 임시 파일 정리
      await this.ffmpeg.deleteFile('input_video.mp4');
      await this.ffmpeg.deleteFile('extracted_audio.aac');

      if (onProgress) {
        onProgress({ stage: 'audio_extraction', progress: 1.0, message: '오디오 추출 완료!' });
      }

      console.log(`✅ Audio extraction completed: ${audioData.length} bytes`);
      return audioData;

    } catch (error) {
      console.error('❌ Audio extraction failed:', error);
      throw new Error(`오디오 추출 실패: ${error.message}`);
    }
  }

  /**
   * 🎬 비디오와 오디오 병합
   * @param {Blob} videoBlob - 캡처된 비디오 Blob (무음)
   * @param {Uint8Array} audioData - 추출된 오디오 데이터
   * @param {Object} options - 병합 옵션
   * @param {Function} onProgress - 진행률 콜백
   * @returns {Promise<Blob>} 오디오가 포함된 최종 MP4 Blob
   */
  async mergeVideoWithAudio(videoBlob, audioData, options = {}, onProgress = null) {
    if (!this.isLoaded) {
      const loadResult = await this.loadFFmpeg();
      if (!loadResult) {
        throw new Error('FFmpeg.js 로딩 실패');
      }
    }

    const {
      videoBitrate = '5000k',
      audioBitrate = '192k',
      outputFormat = 'mp4'
    } = options;

    try {
      console.log('🎬 Merging video with audio...');
      
      if (onProgress) {
        onProgress({ stage: 'video_audio_merge', progress: 0.1, message: '비디오 및 오디오 준비 중...' });
      }

      // 비디오와 오디오를 FFmpeg 파일 시스템에 작성
      const videoData = new Uint8Array(await videoBlob.arrayBuffer());
      console.log('📹 Captured video size:', Math.round(videoData.length / 1024 / 1024) + 'MB');
      console.log('🔊 Audio data size:', Math.round(audioData.length / 1024) + 'KB');
      
      await this.ffmpeg.writeFile('input_video.webm', videoData);
      await this.ffmpeg.writeFile('input_audio.aac', audioData);

      if (onProgress) {
        onProgress({ stage: 'video_audio_merge', progress: 0.3, message: '비디오-오디오 동기화 중...' });
      }

      // 비디오-오디오 병합 명령 실행
      await this.ffmpeg.exec([
        '-i', 'input_video.webm',
        '-i', 'input_audio.aac', 
        '-c:v', 'libx264', // H.264 비디오 코덱
        '-c:a', 'aac', // AAC 오디오 코덱
        '-b:v', videoBitrate, // 비디오 비트레이트
        '-b:a', audioBitrate, // 오디오 비트레이트
        '-shortest', // 짧은 스트림에 맞춤 (중요!)
        '-preset', 'fast', // 빠른 인코딩
        '-movflags', '+faststart', // 웹 최적화
        `output.${outputFormat}`
      ]);

      if (onProgress) {
        onProgress({ stage: 'video_audio_merge', progress: 0.8, message: '최종 파일 생성 중...' });
      }

      // 병합된 비디오 데이터 읽기
      const mergedVideoData = await this.ffmpeg.readFile(`output.${outputFormat}`);
      
      // 임시 파일 정리
      await this.ffmpeg.deleteFile('input_video.webm');
      await this.ffmpeg.deleteFile('input_audio.aac');
      await this.ffmpeg.deleteFile(`output.${outputFormat}`);

      if (onProgress) {
        onProgress({ stage: 'video_audio_merge', progress: 1.0, message: '병합 완료!' });
      }

      // Blob으로 변환하여 반환
      const finalBlob = new Blob([mergedVideoData], { type: `video/${outputFormat}` });
      
      console.log(`✅ Video-audio merge completed: ${finalBlob.size} bytes`);
      return finalBlob;

    } catch (error) {
      console.error('❌ Video-audio merge failed:', error);
      throw new Error(`비디오-오디오 병합 실패: ${error.message}`);
    }
  }

  /**
   * 🚀 원스톱 오디오 병합 프로세스
   * @param {string} originalVideoUrl - 원본 비디오 URL
   * @param {Blob} capturedVideoBlob - 캡처된 비디오 Blob 
   * @param {Object} options - 옵션
   * @param {Function} onProgress - 진행률 콜백
   * @returns {Promise<Blob>} 완성된 MP4 Blob
   */
  async processVideoWithAudio(originalVideoUrl, capturedVideoBlob, options = {}, onProgress = null) {
    try {
      // 1단계: 원본 비디오에서 오디오 추출
      const audioData = await this.extractAudioFromVideo(originalVideoUrl, (progress) => {
        if (onProgress) {
          onProgress({
            ...progress,
            overallProgress: progress.progress * 0.4 // 전체의 40%
          });
        }
      });

      // 2단계: 비디오와 오디오 병합
      const finalVideo = await this.mergeVideoWithAudio(capturedVideoBlob, audioData, options, (progress) => {
        if (onProgress) {
          onProgress({
            ...progress,
            overallProgress: 0.4 + (progress.progress * 0.6) // 전체의 40% + 60%
          });
        }
      });

      return finalVideo;

    } catch (error) {
      console.error('❌ Audio processing failed:', error);
      throw error;
    }
  }

  /**
   * FFmpeg 버전 및 지원 정보 확인
   * @returns {Promise<Object>} 지원 정보
   */
  async getSupportInfo() {
    if (!this.isLoaded) {
      return {
        loaded: false,
        supported: typeof FFmpeg !== 'undefined',
        version: null
      };
    }

    try {
      // FFmpeg 버전 확인
      await this.ffmpeg.exec(['-version']);
      return {
        loaded: true,
        supported: true,
        version: 'FFmpeg.js 0.12.6'
      };
    } catch (error) {
      return {
        loaded: true,
        supported: false,
        error: error.message
      };
    }
  }

  /**
   * 🧹 리소스 정리
   */
  dispose() {
    if (this.ffmpeg && this.isLoaded) {
      // FFmpeg 인스턴스는 자동으로 정리됨
      this.isLoaded = false;
    }
  }
}

export default AudioMixer;