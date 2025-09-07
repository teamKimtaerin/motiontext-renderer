// Minimal timeline controller for M2.5.
// rAF loop while playing + media event listeners for paused seeks.

export class TimelineController {
  private rafId: number | null = null;
  private subscribers = new Set<(_timeSec: number) => void>();
  private video: HTMLVideoElement | null = null;
  private running = false;

  // bound handlers for add/remove
  private onTimeUpdateBound = () => this.notify();
  private onSeekedBound = () => this.notify(true);
  private onLoadedMetaBound = () => this.notify(true);
  private onRateChangeBound = () => this.notify();
  private onPlayBound = () => this.play();
  private onPauseBound = () => this.pause();

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
    this.video = null;
    this.pause();
  }

  onTick(cb: (_timeSec: number) => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  private loop = () => {
    if (!this.running) return;
    this.notify();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private notify(force = false) {
    const t = this.video ? this.video.currentTime : 0;
    // If not running, we still notify on media events (force=true) to reflect paused scrubs
    if (!this.running && !force) return;
    this.subscribers.forEach((fn) => fn(t));
  }

  play() {
    if (this.running) return;
    this.running = true;
    this.rafId = requestAnimationFrame(this.loop);
  }

  pause() {
    this.running = false;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    // still notify once to reflect paused position
    this.notify(true);
  }

  seek(_timeSec: number) {
    if (this.video) this.video.currentTime = _timeSec;
    // notify after programmatic seek
    this.notify(true);
  }
}
