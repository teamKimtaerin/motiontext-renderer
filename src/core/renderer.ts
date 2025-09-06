/**
 * Core MotionText Renderer implementation
 * Based on CLAUDE.md specification
 */

import gsap from 'gsap';
import type { RendererConfig, PluginContext } from '../types';

export class MotionTextRenderer {
  private config: RendererConfig | null = null;
  private container: HTMLElement | null = null;
  private mediaElement: HTMLVideoElement | null = null;
  private mainTimeline: gsap.core.Timeline;

  /**
   * Initialize the renderer with configuration
   */
  constructor(container: HTMLElement) {
    this.container = container;
    this.mainTimeline = gsap.timeline({ paused: true });
    this.setupContainer();
  }

  /**
   * Load and parse configuration
   */
  async loadConfig(config: RendererConfig): Promise<void> {
    this.validateConfig(config);
    this.config = config;
  }

  /**
   * Attach media element for synchronization
   */
  attachMedia(mediaElement: HTMLVideoElement): void {
    this.mediaElement = mediaElement;
    this.setupMediaSync();
  }

  /**
   * Start rendering
   */
  play(): void {
    if (!this.config || !this.mediaElement) {
      throw new Error('Renderer not properly initialized');
    }
    this.mainTimeline.play();
  }

  /**
   * Pause rendering
   */
  pause(): void {
    this.mainTimeline.pause();
  }

  /**
   * Seek to specific time
   */
  seek(time: number): void {
    this.mainTimeline.seek(time);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.mainTimeline.kill();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  /**
   * Get plugin context with GSAP instance
   * Used when loading and executing plugins
   */
  // @ts-expect-error - Will be used when plugin system is implemented
  private getPluginContext(): PluginContext {
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    return {
      gsap,
      container: this.container,
      assets: {
        getUrl: (path: string) => path, // TODO: Implement asset URL resolution
      },
      portal: {
        breakout: (_element: HTMLElement, _config: any) => {
          // TODO: Implement portal breakout system
        },
      },
      onSeek: (_callback: () => void) => {
        // TODO: Implement seek callback registration
      },
      timeScale: 1.0,
    };
  }

  private setupContainer(): void {
    if (!this.container) return;

    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
  }

  private validateConfig(config: RendererConfig): void {
    if (config.version !== '1.3') {
      throw new Error(`Unsupported config version: ${config.version}`);
    }

    if (!config.stage || !config.tracks || !config.cues) {
      throw new Error('Invalid configuration: missing required properties');
    }
  }

  private setupMediaSync(): void {
    if (!this.mediaElement) return;

    const mediaElement: HTMLVideoElement = this.mediaElement; // Explicitly typed

    // Sync timeline with media time
    const syncTimeline = () => {
      if (mediaElement) {
        this.mainTimeline.seek(mediaElement.currentTime);
      }
    };

    // Use requestVideoFrameCallback for precise sync if available
    if ('requestVideoFrameCallback' in mediaElement) {
      const updateFrame = () => {
        syncTimeline();
        if (mediaElement && 'requestVideoFrameCallback' in mediaElement) {
          (mediaElement as any).requestVideoFrameCallback(updateFrame);
        }
      };
      (mediaElement as any).requestVideoFrameCallback(updateFrame);
    } else {
      // Fallback to timeupdate event
      (mediaElement as HTMLVideoElement).addEventListener(
        'timeupdate',
        syncTimeline
      );
    }

    // Handle play/pause sync
    mediaElement.addEventListener('play', () => this.play());
    mediaElement.addEventListener('pause', () => this.pause());
    mediaElement.addEventListener('seeked', () => syncTimeline());
  }
}
