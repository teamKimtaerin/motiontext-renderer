// Timeline controller
// - Prefer requestVideoFrameCallback (rVFC) with mediaTime for ticking
// - Fallback to rAF
// - While paused or seeking, notify subscribers via media events

export class TimelineController {
  private rafId: number | null = null;
  private vfcId: number | null = null;
  private vfcGen: number = 0; // generation token to avoid stale callbacks
  private subscribers = new Set<(_timeSec: number) => void>();
  private video: HTMLVideoElement | null = null;
  private running = false;

  // bound handlers for add/remove
  private onTimeUpdateBound = () => this.notify();
  private onSeekedBound = () => {
    this.notify(true);
    if (this.running) this.scheduleVfc();
  };
  private onLoadedMetaBound = () => {
    this.notify(true);
    if (this.running) this.scheduleVfc();
  };
  private onRateChangeBound = () => this.notify();
  private onPlayBound = () => this.play();
  private onPauseBound = () => this.pause();
  private onEndedBound = () => this.handleEnded();

  attachMedia(video: HTMLVideoElement) {
    // detach previous
    if (this.video) this.detachMedia();
    this.video = video;
    // subscribe to media events so UI scrubbing while paused still updates
    video.addEventListener('timeupdate', this.onTimeUpdateBound);
    video.addEventListener('seeked', this.onSeekedBound);
    video.addEventListener('loadedmetadata', this.onLoadedMetaBound);
    video.addEventListener('ratechange', this.onRateChangeBound);
    video.addEventListener('play', this.onPlayBound);
    video.addEventListener('pause', this.onPauseBound);
    video.addEventListener('ended', this.onEndedBound);
    // initial notify
    this.notify(true);
  }

  detachMedia() {
    const v = this.video;
    if (!v) return;
    v.removeEventListener('timeupdate', this.onTimeUpdateBound);
    v.removeEventListener('seeked', this.onSeekedBound);
    v.removeEventListener('loadedmetadata', this.onLoadedMetaBound);
    v.removeEventListener('ratechange', this.onRateChangeBound);
    v.removeEventListener('play', this.onPlayBound);
    v.removeEventListener('pause', this.onPauseBound);
    v.removeEventListener('ended', this.onEndedBound);
    this.video = null;
    this.pause();
  }

  onTick(cb: (_timeSec: number) => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  private publish(timeSec: number) {
    this.subscribers.forEach((fn) => fn(timeSec));
  }

  private loopRaf = () => {
    if (!this.running) return;
    const t = this.video ? this.video.currentTime : 0;
    this.publish(t);
    this.rafId = requestAnimationFrame(this.loopRaf);
  };

  private cancelVfc() {
    const v = this.video as any;
    if (
      this.vfcId != null &&
      v &&
      typeof v.cancelVideoFrameCallback === 'function'
    ) {
      v.cancelVideoFrameCallback(this.vfcId);
    }
    this.vfcId = null;
  }

  private scheduleVfc() {
    if (!this.running) return;
    const v = this.video as any;
    if (!v || typeof v.requestVideoFrameCallback !== 'function') return;
    // Always cancel any prior reservation then request a fresh callback with new generation
    this.cancelVfc();
    const gen = ++this.vfcGen;
    const cb = (_now: number, metadata: any) => {
      if (!this.running || gen !== this.vfcGen) return; // stale or stopped
      const mediaTime: number | undefined = metadata?.mediaTime;
      const t =
        typeof mediaTime === 'number' && Number.isFinite(mediaTime)
          ? mediaTime
          : this.video
            ? this.video.currentTime
            : 0;
      this.publish(t);
      // schedule next only if still same generation and running
      const vv = this.video as any;
      if (
        vv &&
        typeof vv.requestVideoFrameCallback === 'function' &&
        this.running &&
        gen === this.vfcGen
      ) {
        this.vfcId = vv.requestVideoFrameCallback(cb);
      }
    };
    this.vfcId = v.requestVideoFrameCallback(cb);
  }

  isRunning(): boolean {
    return this.running;
  }

  private notify(force = false) {
    const t = this.video ? this.video.currentTime : 0;
    // If not running, we still notify on media events (force=true) to reflect paused scrubs
    if (!this.running && !force) return;
    this.publish(t);
  }

  play() {
    if (this.running) return;
    this.running = true;
    const v = this.video as any;
    const hasVfc = !!(v && typeof v.requestVideoFrameCallback === 'function');
    if (hasVfc) {
      this.scheduleVfc();
    } else {
      this.rafId = requestAnimationFrame(this.loopRaf);
    }
  }

  private stop(notifyOnce: boolean) {
    this.running = false;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    const v = this.video as any;
    if (
      this.vfcId != null &&
      v &&
      typeof v.cancelVideoFrameCallback === 'function'
    ) {
      v.cancelVideoFrameCallback(this.vfcId);
    }
    this.vfcId = null;
    if (notifyOnce) this.notify(true);
  }

  pause() {
    this.stop(true);
  }

  private handleEnded() {
    // Ended: stop without extra notify to avoid duplicate final publish
    this.stop(false);
  }

  seek(_timeSec: number) {
    if (this.video) this.video.currentTime = _timeSec;
    // notify after programmatic seek
    this.notify(true);
  }

  setRate(_rate: number) {
    if (this.video && Number.isFinite(_rate) && _rate > 0) {
      this.video.playbackRate = _rate;
      this.notify();
    }
  }

  // Idempotent helpers for Tell-Don't-Ask style API
  ensurePlaying() {
    if (!this.running) this.play();
  }

  ensureStopped() {
    if (this.running) this.pause();
  }
}
