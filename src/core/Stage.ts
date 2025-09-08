import type { ScenarioFileV1_3 } from '../types/scenario';

export interface ContentRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Pure function for content rect calculation (testable)
export function computeContentRect(
  containerWidth: number,
  containerHeight: number,
  videoAspect: number
): ContentRect {
  const ca = containerWidth / containerHeight;
  let width = containerWidth,
    height = containerHeight,
    left = 0,
    top = 0;

  if (ca > videoAspect) {
    height = containerHeight;
    width = Math.round(containerHeight * videoAspect);
    left = Math.round((containerWidth - width) / 2);
    top = 0;
  } else {
    width = containerWidth;
    height = Math.round(containerWidth / videoAspect);
    left = 0;
    top = Math.round((containerHeight - height) / 2);
  }

  return { left, top, width, height };
}

export class Stage {
  private container: HTMLElement | null = null;
  private media: HTMLVideoElement | null = null;
  private scenario: ScenarioFileV1_3 | null = null;
  private ro: ResizeObserver | null = null;
  private onLoadedMetaBound: (() => void) | null = null;
  private onFullscreenBound: (() => void) | null = null;
  private _updateTimer: number | null = null;
  private _lastBox: string | null = null;
  private _boundsChangeListeners: ((_rect: ContentRect) => void)[] = [];
  private _boundParent: HTMLElement | null = null;
  private _boundMedia: HTMLVideoElement | null = null;

  setContainer(container: HTMLElement) {
    this.container = container;
    this.installOverlayBinding();
  }

  setMedia(media: HTMLVideoElement) {
    this.media = media;
    this.installOverlayBinding();
  }

  setScenario(scenario: ScenarioFileV1_3) {
    this.scenario = scenario;
  }

  onBoundsChange(listener: (_rect: ContentRect) => void): () => void {
    this._boundsChangeListeners.push(listener);
    return () => {
      const idx = this._boundsChangeListeners.indexOf(listener);
      if (idx >= 0) this._boundsChangeListeners.splice(idx, 1);
    };
  }

  getContentRect(): ContentRect | null {
    if (!this.container?.parentElement) return null;
    const parent = this.container.parentElement;
    const cw = parent.clientWidth;
    const ch = parent.clientHeight;
    if (!cw || !ch) return null;

    let va: number | null = null;
    if (this.media && this.media.videoWidth && this.media.videoHeight) {
      va = this.media.videoWidth / this.media.videoHeight;
    } else {
      va = this.parseAspectFromStage() ?? 16 / 9;
    }

    return computeContentRect(cw, ch, va);
  }

  dispose() {
    // 방어적 타이머 정리
    if (this._updateTimer != null) {
      clearTimeout(this._updateTimer);
      this._updateTimer = null;
    }
    this.teardownOverlayBinding();
    this._boundsChangeListeners = [];
    this.container = null;
    this.media = null;
    this.scenario = null;
  }

  private installOverlayBinding() {
    if (!('ResizeObserver' in window)) return;
    const parent = this.container?.parentElement;
    if (!parent) return;

    // Prevent duplicate binding - only rebind if target changed
    if (parent === this._boundParent && this.media === this._boundMedia) {
      return;
    }

    // Clean up previous bindings completely
    this.teardownOverlayBinding();

    // Track new binding targets
    this._boundParent = parent;
    this._boundMedia = this.media;

    // Set up new bindings
    // Mark overlay container as stage for plugin runtime sizing
    if (this.container) {
      this.container.classList.add('stage');
    }
    this.ro = new ResizeObserver(() => this.scheduleBoundsUpdate());
    this.ro.observe(parent);

    if (this.media) {
      this.onLoadedMetaBound = () => this.scheduleBoundsUpdate();
      this.media.addEventListener('loadedmetadata', this.onLoadedMetaBound);
    }

    this.onFullscreenBound = () => this.scheduleBoundsUpdate();
    document.addEventListener('fullscreenchange', this.onFullscreenBound);

    this.updateBounds();
  }

  private teardownOverlayBinding() {
    // 타이머 정리
    if (this._updateTimer != null) {
      clearTimeout(this._updateTimer);
      this._updateTimer = null;
    }
    if (this.ro) {
      this.ro.disconnect();
      this.ro = null;
    }
    if (this._boundMedia && this.onLoadedMetaBound) {
      this._boundMedia.removeEventListener(
        'loadedmetadata',
        this.onLoadedMetaBound
      );
    }
    this.onLoadedMetaBound = null;
    if (this.onFullscreenBound) {
      document.removeEventListener('fullscreenchange', this.onFullscreenBound);
    }
    this.onFullscreenBound = null;

    // Reset tracking
    this._boundParent = null;
    this._boundMedia = null;
    // Remove stage marker class
    if (this.container) {
      this.container.classList.remove('stage');
    }
  }

  private scheduleBoundsUpdate() {
    if (this._updateTimer != null) return;
    const throttleMs = this.scenario?.behavior?.resizeThrottleMs ?? 80;
    this._updateTimer = window.setTimeout(() => {
      this._updateTimer = null;
      this.updateBounds();
    }, throttleMs);
  }

  private updateBounds() {
    const rect = this.getContentRect();
    if (!rect) return;

    const box = `${rect.left},${rect.top},${rect.width},${rect.height}`;
    if (this._lastBox === box) return;
    this._lastBox = box;

    if (this.container) {
      const s = this.container.style;
      s.position = 'absolute';
      s.pointerEvents = 'none';
      s.left = `${rect.left}px`;
      s.top = `${rect.top}px`;
      s.width = `${rect.width}px`;
      s.height = `${rect.height}px`;
    }

    this._boundsChangeListeners.forEach((listener) => listener(rect));
  }

  private parseAspectFromStage(): number | null {
    const a = this.scenario?.stage?.baseAspect;
    if (!a || a === 'auto') return null;
    const m = String(a).match(/^(\d+)\s*:\s*(\d+)$/);
    if (!m) return null;
    const w = Number(m[1]);
    const h = Number(m[2]);
    if (!w || !h) return null;
    return w / h;
  }
}
