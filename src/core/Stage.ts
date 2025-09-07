import type { ScenarioFileV1_3 } from '../types/scenario';

export interface ContentRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface StageConfig {
  baseAspect?: string;
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

  configure(config: StageConfig) {
    this.scenario = {
      ...this.scenario,
      stage: { ...this.scenario?.stage, baseAspect: config.baseAspect },
    } as ScenarioFileV1_3;
  }

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

  onBoundsChange(listener: (_rect: ContentRect) => void) {
    this._boundsChangeListeners.push(listener);
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

    const ca = cw / ch;
    let width = cw,
      height = ch,
      left = 0,
      top = 0;
    if (ca > (va ?? ca)) {
      height = ch;
      width = Math.round(ch * (va ?? ca));
      left = Math.round((cw - width) / 2);
      top = 0;
    } else {
      width = cw;
      height = Math.round(cw / (va ?? ca));
      left = 0;
      top = Math.round((ch - height) / 2);
    }

    return { left, top, width, height };
  }

  dispose() {
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

    if (this.ro) this.ro.disconnect();
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
    if (this.ro) {
      this.ro.disconnect();
      this.ro = null;
    }
    if (this.media && this.onLoadedMetaBound) {
      this.media.removeEventListener('loadedmetadata', this.onLoadedMetaBound);
    }
    this.onLoadedMetaBound = null;
    if (this.onFullscreenBound) {
      document.removeEventListener('fullscreenchange', this.onFullscreenBound);
    }
    this.onFullscreenBound = null;
  }

  private scheduleBoundsUpdate() {
    if (this._updateTimer != null) return;
    this._updateTimer = window.setTimeout(() => {
      this._updateTimer = null;
      this.updateBounds();
    }, 50);
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
