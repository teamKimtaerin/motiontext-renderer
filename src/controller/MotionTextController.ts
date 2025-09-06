// Controller UI overlay for MotionTextRenderer
// Minimal scaffold for M2.6: creates an overlay root and exposes basic APIs.

import type { MotionTextRenderer } from "../index";

export interface MotionTextControllerOptions {
  captionsVisible?: boolean;
}

export class MotionTextController {
  private video: HTMLVideoElement;
  private renderer: MotionTextRenderer;
  private container: HTMLElement; // container wrapping video + overlay
  private root: HTMLElement | null = null;
  private styleEl: HTMLStyleElement | null = null;
  private captionsOn = true;
  private timeLabel: HTMLElement | null = null;
  private seekEl: HTMLInputElement | null = null;
  private volumeEl: HTMLInputElement | null = null;
  private cleanupFns: Array<() => void> = [];
  private prevVideoStyle: Partial<CSSStyleDeclaration> | null = null;
  private idleTimer: number | null = null;
  private idleMs = 2200;
  // hovered flag reserved for future logic

  constructor(video: HTMLVideoElement, renderer: MotionTextRenderer, container: HTMLElement, opts: MotionTextControllerOptions = {}) {
    this.video = video;
    this.renderer = renderer;
    this.container = container;
    if (opts.captionsVisible != null) this.captionsOn = !!opts.captionsVisible;
  }

  mount() {
    if (this.root) return;
    this.injectStyles();
    const root = document.createElement("div");
    root.setAttribute("data-mtx-controls", "");
    root.style.position = "absolute";
    root.style.left = "0";
    root.style.right = "0";
    root.style.bottom = "0";
    root.style.padding = "8px";
    root.style.display = "flex";
    root.style.gap = "8px";
    root.style.alignItems = "center";
    root.style.justifyContent = "flex-start";
    root.style.pointerEvents = "auto";
    root.style.zIndex = "30";
    root.style.color = "#fff";
    root.style.background = "linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.0))";

    // Basic controls (play/pause, captions, fullscreen)
    const btnPlay = document.createElement("button");
    btnPlay.textContent = "▶︎/❚❚";
    btnPlay.setAttribute("aria-label", "재생/일시정지");
    btnPlay.onclick = () => {
      if (this.video.paused) this.video.play();
      else this.video.pause();
    };

    const btnSub = document.createElement("button");
    btnSub.textContent = this.captionsOn ? "자막 켬" : "자막 끔";
    btnSub.setAttribute("aria-pressed", String(this.captionsOn));
    btnSub.onclick = () => {
      this.captionsOn = !this.captionsOn;
      this.renderer.setCaptionsVisible(this.captionsOn);
      btnSub.textContent = this.captionsOn ? "자막 켬" : "자막 끔";
      btnSub.setAttribute("aria-pressed", String(this.captionsOn));
    };

    const btnFs = document.createElement("button");
    btnFs.textContent = "⛶";
    btnFs.setAttribute("aria-label", "전체화면");
    btnFs.onclick = () => {
      this.requestFullscreen();
    };

    // time label
    const time = document.createElement("span");
    time.style.marginLeft = "8px";
    time.style.marginRight = "auto";
    this.timeLabel = time;

    // seek
    const seek = document.createElement("input");
    seek.type = "range";
    seek.min = "0";
    seek.max = "0";
    seek.step = "0.01";
    seek.value = "0";
    seek.style.flex = "1 1 auto";
    seek.oninput = () => {
      const v = Number(seek.value);
      if (Number.isFinite(v)) {
        // set currentTime proportionally when duration known
        const dur = this.video.duration;
        if (Number.isFinite(dur) && dur > 0) {
          this.video.currentTime = Math.max(0, Math.min(dur, v));
        }
      }
    };
    this.seekEl = seek;

    // volume
    const vol = document.createElement("input");
    vol.type = "range";
    vol.min = "0";
    vol.max = "1";
    vol.step = "0.01";
    vol.value = String(this.video.volume ?? 1);
    vol.style.width = "120px";
    vol.oninput = () => {
      const v = Number(vol.value);
      if (Number.isFinite(v)) this.video.volume = Math.max(0, Math.min(1, v));
    };
    this.volumeEl = vol;

    // layout containers
    // Top bar (buttons + time)
    const bar = document.createElement("div");
    bar.style.display = "flex";
    bar.style.alignItems = "center";
    bar.style.gap = "8px";
    bar.appendChild(btnPlay);
    bar.appendChild(btnSub);
    bar.appendChild(time);
    bar.appendChild(vol);
    bar.appendChild(btnFs);

    // Bottom seek spans full width
    const seekRow = document.createElement("div");
    seekRow.style.display = "flex";
    seekRow.style.alignItems = "center";
    seekRow.style.gap = "8px";
    seekRow.appendChild(seek);

    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.appendChild(bar);
    root.appendChild(seekRow);
    this.container.appendChild(root);
    this.root = root;

    // Initial captions visibility
    this.renderer.setCaptionsVisible(this.captionsOn);

    // Events to keep UI in sync
    const onTime = () => this.updateUI();
    const onMeta = () => this.updateUI(true);
    this.video.addEventListener("timeupdate", onTime);
    this.video.addEventListener("seeked", onTime);
    this.video.addEventListener("durationchange", onMeta);
    this.video.addEventListener("loadedmetadata", onMeta);
    this.video.addEventListener("volumechange", onMeta);
    document.addEventListener("fullscreenchange", onMeta);
    this.cleanupFns.push(() => {
      this.video.removeEventListener("timeupdate", onTime);
      this.video.removeEventListener("seeked", onTime);
      this.video.removeEventListener("durationchange", onMeta);
      this.video.removeEventListener("loadedmetadata", onMeta);
      this.video.removeEventListener("volumechange", onMeta);
      document.removeEventListener("fullscreenchange", onMeta);
    });

    // Keyboard accessibility
    const onKey = (e: KeyboardEvent) => {
      if (!this.root) return;
      if (e.key === " ") { // Space
        e.preventDefault();
        if (this.video.paused) this.video.play(); else this.video.pause();
      } else if (e.key === "ArrowRight") {
        this.video.currentTime = Math.min((this.video.duration || Infinity), this.video.currentTime + 5);
      } else if (e.key === "ArrowLeft") {
        this.video.currentTime = Math.max(0, this.video.currentTime - 5);
      } else if (e.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen();
      }
    };
    root.tabIndex = 0; // focusable for key events
    root.addEventListener("keydown", onKey);
    this.cleanupFns.push(() => root.removeEventListener("keydown", onKey));
    // Focus root on enter/click so keys work also in non-fullscreen when interacting
    const focusRoot = () => root.focus({ preventScroll: true });
    const onEnter = () => { this.showControls(); focusRoot(); };
    const onLeave = () => { this.scheduleHide(); };
    const onMove = () => { this.showControls(); this.scheduleHide(); };
    this.container.addEventListener("mouseenter", onEnter);
    this.container.addEventListener("mouseleave", onLeave);
    this.container.addEventListener("mousemove", onMove);
    this.container.addEventListener("click", focusRoot);
    this.cleanupFns.push(() => {
      this.container.removeEventListener("mouseenter", onEnter);
      this.container.removeEventListener("mouseleave", onLeave);
      this.container.removeEventListener("mousemove", onMove);
      this.container.removeEventListener("click", focusRoot);
    });

    // reflect play/pause icon
    const onPlay = () => { (btnPlay.textContent = "❚❚"); };
    const onPause = () => { (btnPlay.textContent = "►"); };
    this.video.addEventListener("play", onPlay);
    this.video.addEventListener("pause", onPause);
    this.cleanupFns.push(() => {
      this.video.removeEventListener("play", onPlay);
      this.video.removeEventListener("pause", onPause);
    });

    // First paint and reserve safe bottom for captions
    this.updateUI(true);
    this.reserveCaptionSafeArea();

    // Apply native-like fit behavior only in fullscreen so video centers with symmetric letterboxing
    const applyFsFit = () => {
      const fs = !!document.fullscreenElement;
      if (fs) {
        if (!this.prevVideoStyle) {
          this.prevVideoStyle = {
            width: this.video.style.width,
            height: this.video.style.height,
            objectFit: this.video.style.objectFit as any,
            backgroundColor: this.video.style.backgroundColor,
          } as Partial<CSSStyleDeclaration>;
        }
        this.video.style.width = "100%";
        this.video.style.height = "100%";
        (this.video.style as any).objectFit = "contain";
        this.video.style.backgroundColor = "#000";
      } else if (this.prevVideoStyle) {
        this.video.style.width = this.prevVideoStyle.width ?? "";
        this.video.style.height = this.prevVideoStyle.height ?? "";
        (this.video.style as any).objectFit = (this.prevVideoStyle as any).objectFit ?? "";
        this.video.style.backgroundColor = this.prevVideoStyle.backgroundColor ?? "";
      }
    };
    applyFsFit();
    const onFs = () => applyFsFit();
    document.addEventListener("fullscreenchange", onFs);
    this.cleanupFns.push(() => document.removeEventListener("fullscreenchange", onFs));

    // start with controls visible then schedule hide
    this.showControls();
    this.scheduleHide();
  }

  unmount() {
    if (this.root && this.root.parentElement) this.root.parentElement.removeChild(this.root);
    this.root = null;
    if (this.styleEl && this.styleEl.parentNode) this.styleEl.parentNode.removeChild(this.styleEl);
    this.styleEl = null;
    this.cleanupFns.forEach((fn) => {
      try { fn(); } catch (e) { /* noop */ }
    });
    this.cleanupFns = [];
  }

  setCaptionsVisible(visible: boolean) {
    this.captionsOn = !!visible;
    this.renderer.setCaptionsVisible(this.captionsOn);
  }

  async requestFullscreen() {
    const el: any = this.container as any;
    if (document.fullscreenElement) {
      await document.exitFullscreen?.();
      return;
    }
    await el.requestFullscreen?.();
  }

  private injectStyles() {
    if (this.styleEl) return;
    // legacy css (unused)
    const el = document.createElement("style");
    el.setAttribute("data-mtx-controls-style", "");
    // overwrite with white-themed controls and full-width seek bar
    el.textContent = `
      [data-mtx-controls] { color:#fff; padding: 10px 12px; }
      [data-mtx-controls] button { background: rgba(255,255,255,0.18); color:#fff; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; }
      [data-mtx-controls] button[aria-pressed="true"] { background: rgba(255,255,255,0.9); color:#000; }
      [data-mtx-controls] input[type=range] { width: 100%; }
    `;
    document.head.appendChild(el);
    this.styleEl = el;
  }

  destroy() {
    this.unmount();
  }

  private updateUI(reset = false) {
    const dur = this.video.duration;
    const cur = this.video.currentTime;
    if (this.timeLabel) this.timeLabel.textContent = `${this.fmt(cur)} / ${Number.isFinite(dur) ? this.fmt(dur) : "0:00"}`;
    if (this.seekEl) {
      if (reset && Number.isFinite(dur)) this.seekEl.max = String(dur);
      if (Number.isFinite(cur)) this.seekEl.value = String(cur);
    }
    if (this.volumeEl) this.volumeEl.value = String(this.video.volume ?? 1);
    // Keep caption safe area updated (controller height may vary in fullscreen)
    this.reserveCaptionSafeArea();
  }

  private fmt(t: number): string {
    if (!Number.isFinite(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  private reserveCaptionSafeArea() {
    if (!this.root) return;
    const rect = this.root.getBoundingClientRect();
    // Pass the current controller height to renderer so it can shrink caption overlay
    this.renderer.setControlSafeBottom(rect.height);
  }

  private showControls() {
    if (!this.root) return;
    this.root.style.opacity = "1";
    this.root.style.pointerEvents = "auto";
    // Show mouse cursor again
    this.container.style.cursor = "auto";
  }

  private scheduleHide() {
    if (this.idleTimer != null) window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => this.hideControls(), this.idleMs);
  }

  private hideControls() {
    if (!this.root) return;
    this.root.style.opacity = "0";
    this.root.style.pointerEvents = "none";
    // Hide cursor only in fullscreen
    if (document.fullscreenElement) this.container.style.cursor = "none";
  }
}
