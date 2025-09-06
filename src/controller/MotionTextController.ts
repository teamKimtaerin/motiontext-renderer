// Controller UI overlay for MotionTextRenderer
// YouTube-style UI with react-icons SVG integration

import type { MotionTextRenderer } from "../index";

// Inline SVG icons from react-icons/md
const ICONS = {
  play: '<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="1em" width="1em"><path d="M8 5v14l11-7z"></path></svg>',
  pause: '<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="1em" width="1em"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>',
  volumeUp: '<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="1em" width="1em"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path></svg>',
  volumeOff: '<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="1em" width="1em"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"></path></svg>',
  closedCaption: '<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="1em" width="1em"><path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"></path></svg>',
  closedCaptionDisabled: '<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="1em" width="1em"><path d="M6.83 4H19c1.1 0 2 .9 2 2v12c0 .05-.01.1-.02.16L19 16.17V6H8.83L6.83 4zM20.49 23.31L17.17 20H5c-1.11 0-2-.9-2-2V6c0-.05.02-.1.02-.15L1.39 4.22 2.8 2.81l18.38 18.38-1.31 1.31-.68-.67zM9.5 10.5v.5h-2v1.17L6 10.67V10c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v.17l-1.5-1.5v.33zm7 0v.5h-2v1.17L13 10.67V10c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v.17l-1.5-1.5v.33z"></path></svg>',
  fullscreen: '<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="1em" width="1em"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"></path></svg>',
  fullscreenExit: '<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="1em" width="1em"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"></path></svg>'
};

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
  private volumePopupTimer: number | null = null;

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
    root.style.pointerEvents = "auto";
    root.style.zIndex = "30";
    root.style.color = "#fff";
    root.style.fontFamily = "Roboto, Arial, sans-serif";
    root.style.display = "flex";
    root.style.flexDirection = "column";

    // Progress bar (YouTube-style, at the very bottom)
    const progressContainer = document.createElement("div");
    progressContainer.className = "mtx-progress-container";
    
    const seek = document.createElement("input");
    seek.type = "range";
    seek.min = "0";
    seek.max = "0";
    seek.step = "0.01";
    seek.value = "0";
    seek.className = "mtx-progress-bar";
    seek.oninput = () => {
      const v = Number(seek.value);
      if (Number.isFinite(v)) {
        const dur = this.video.duration;
        if (Number.isFinite(dur) && dur > 0) {
          this.video.currentTime = Math.max(0, Math.min(dur, v));
        }
      }
    };
    this.seekEl = seek;
    progressContainer.appendChild(seek);

    // Control bar (YouTube-style layout)
    const controlBar = document.createElement("div");
    controlBar.className = "mtx-control-bar";
    
    // Left side controls
    const leftControls = document.createElement("div");
    leftControls.className = "mtx-controls-left";
    
    // Play/pause button
    const btnPlay = document.createElement("button");
    btnPlay.className = "mtx-btn mtx-play-btn";
    btnPlay.innerHTML = this.video.paused ? ICONS.play : ICONS.pause;
    btnPlay.setAttribute("aria-label", "재생/일시정지");
    btnPlay.onclick = () => {
      if (this.video.paused) this.video.play();
      else this.video.pause();
    };
    
    // Volume group (button + slider)
    const volumeGroup = document.createElement("div");
    volumeGroup.className = "mtx-volume-group";
    
    const btnVolume = document.createElement("button");
    btnVolume.className = "mtx-btn mtx-volume-btn";
    btnVolume.innerHTML = this.video.volume > 0 ? ICONS.volumeUp : ICONS.volumeOff;
    btnVolume.setAttribute("aria-label", "음소거");
    btnVolume.onclick = () => {
      this.video.muted = !this.video.muted;
      if (this.video.muted) {
        btnVolume.innerHTML = ICONS.volumeOff;
        this.video.volume = 0;
      } else {
        btnVolume.innerHTML = ICONS.volumeUp;
        this.video.volume = this.volumeEl?.value ? Number(this.volumeEl.value) : 1;
      }
    };
    
    const vol = document.createElement("input");
    vol.type = "range";
    vol.min = "0";
    vol.max = "1";
    vol.step = "0.01";
    vol.value = String(this.video.volume ?? 1);
    vol.className = "mtx-volume-slider";
    vol.oninput = () => {
      const v = Number(vol.value);
      if (Number.isFinite(v)) {
        this.video.volume = Math.max(0, Math.min(1, v));
        this.video.muted = v === 0;
        btnVolume.innerHTML = v > 0 ? ICONS.volumeUp : ICONS.volumeOff;
      }
    };
    this.volumeEl = vol;
    
    // Volume popup
    const volumePopup = document.createElement("div");
    volumePopup.className = "mtx-volume-popup";
    
    const volumeTrack = document.createElement("div");
    volumeTrack.className = "mtx-volume-track";
    
    const volVertical = document.createElement("input");
    volVertical.type = "range";
    volVertical.min = "0";
    volVertical.max = "1";
    volVertical.step = "0.01";
    volVertical.value = String(this.video.volume ?? 1);
    volVertical.className = "mtx-volume-vertical";
    volVertical.setAttribute("orient", "vertical");
    volVertical.oninput = () => {
      const v = Number(volVertical.value);
      if (Number.isFinite(v)) {
        this.video.volume = Math.max(0, Math.min(1, v));
        this.video.muted = v === 0;
        btnVolume.innerHTML = v > 0 ? ICONS.volumeUp : ICONS.volumeOff;
        // Update horizontal slider for consistency (if it exists)
        if (this.volumeEl) this.volumeEl.value = String(v);
        // Update visual progress with red gradient
        this.updateVolumeSliderVisual(volVertical, v);
      }
    };
    
    // Initialize volume slider visual
    this.updateVolumeSliderVisual(volVertical, Number(volVertical.value));
    
    volumeTrack.appendChild(volVertical);
    volumePopup.appendChild(volumeTrack);
    
    volumeGroup.appendChild(btnVolume);
    volumeGroup.appendChild(volumePopup);
    
    // Keep the old horizontal slider for backward compatibility but hide it
    vol.style.display = "none";
    volumeGroup.appendChild(vol);
    
    // Update volumeEl to point to the vertical slider
    this.volumeEl = volVertical;
    
    // Add precise hover events for volume popup control
    const onVolumeButtonEnter = () => this.showVolumePopup();
    const onVolumeGroupLeave = () => this.scheduleHideVolumePopup();
    const onVolumePopupEnter = () => this.cancelHideVolumePopup();
    
    btnVolume.addEventListener('mouseenter', onVolumeButtonEnter);
    volumeGroup.addEventListener('mouseleave', onVolumeGroupLeave);
    volumePopup.addEventListener('mouseenter', onVolumePopupEnter);
    
    this.cleanupFns.push(() => {
      btnVolume.removeEventListener('mouseenter', onVolumeButtonEnter);
      volumeGroup.removeEventListener('mouseleave', onVolumeGroupLeave);
      volumePopup.removeEventListener('mouseenter', onVolumePopupEnter);
    });
    
    // Time display
    const time = document.createElement("span");
    time.className = "mtx-time";
    this.timeLabel = time;
    
    leftControls.appendChild(btnPlay);
    leftControls.appendChild(volumeGroup);
    leftControls.appendChild(time);
    
    // Right side controls
    const rightControls = document.createElement("div");
    rightControls.className = "mtx-controls-right";
    
    // Captions button
    const btnSub = document.createElement("button");
    btnSub.className = "mtx-btn mtx-caption-btn";
    btnSub.innerHTML = this.captionsOn ? ICONS.closedCaption : ICONS.closedCaptionDisabled;
    btnSub.setAttribute("aria-pressed", String(this.captionsOn));
    btnSub.setAttribute("aria-label", "자막 토글");
    btnSub.onclick = () => {
      this.captionsOn = !this.captionsOn;
      this.renderer.setCaptionsVisible(this.captionsOn);
      btnSub.innerHTML = this.captionsOn ? ICONS.closedCaption : ICONS.closedCaptionDisabled;
      btnSub.setAttribute("aria-pressed", String(this.captionsOn));
    };
    
    // Fullscreen button
    const btnFs = document.createElement("button");
    btnFs.className = "mtx-btn mtx-fullscreen-btn";
    btnFs.innerHTML = document.fullscreenElement ? ICONS.fullscreenExit : ICONS.fullscreen;
    btnFs.setAttribute("aria-label", "전체화면");
    btnFs.onclick = () => {
      this.requestFullscreen();
    };
    
    rightControls.appendChild(btnSub);
    rightControls.appendChild(btnFs);
    
    controlBar.appendChild(leftControls);
    controlBar.appendChild(rightControls);
    
    root.appendChild(progressContainer);
    root.appendChild(controlBar);
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
      
      // Only handle keyboard events when controller or its children have focus
      if (!this.root.contains(document.activeElement) && 
          document.activeElement !== this.root) {
        return; // Ignore keyboard events when controller is not focused
      }
      
      // Show controls and reset hide timer on keyboard interaction
      this.showControls();
      this.scheduleHide();
      
      // Prevent event bubbling to avoid conflicts with other keyboard handlers
      e.stopPropagation();
      
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
    const onPlay = () => { btnPlay.innerHTML = ICONS.pause; };
    const onPause = () => { btnPlay.innerHTML = ICONS.play; };
    
    // reflect fullscreen icon
    const onFsChange = () => {
      btnFs.innerHTML = document.fullscreenElement ? ICONS.fullscreenExit : ICONS.fullscreen;
    };
    document.addEventListener("fullscreenchange", onFsChange);
    this.cleanupFns.push(() => document.removeEventListener("fullscreenchange", onFsChange));
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
    // Clear volume popup timer
    this.cancelHideVolumePopup();
    
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
      /* YouTube-style controls */
      [data-mtx-controls] {
        background: linear-gradient(transparent, rgba(0,0,0,0.7));
        padding: 0;
        transition: opacity 0.2s ease;
      }
      
      .mtx-progress-container {
        position: relative;
        height: 5px;
        padding: 35px 12px 20px;
      }
      
      .mtx-progress-bar {
        width: 100%;
        height: 3px;
        background: transparent;
        cursor: pointer;
        -webkit-appearance: none;
        appearance: none;
        transition: height 0.1s ease;
        outline: none;
      }
      
      .mtx-progress-bar:focus {
        outline: none;
        box-shadow: none;
      }
      
      .mtx-progress-bar::-webkit-slider-track {
        background: rgba(255,255,255,0.3);
        height: 3px;
        border-radius: 2px;
      }
      
      .mtx-progress-bar::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #ff0000;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.1s ease;
      }
      
      .mtx-progress-bar::-moz-range-track {
        background: rgba(255,255,255,0.3);
        height: 3px;
        border-radius: 2px;
        border: none;
      }
      
      .mtx-progress-bar::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #ff0000;
        cursor: pointer;
        border: none;
        opacity: 0;
        transition: opacity 0.1s ease;
      }
      
      .mtx-progress-bar::-moz-range-progress {
        background: #ff0000;
        height: 3px;
        border-radius: 2px;
      }
      
      .mtx-progress-container:hover .mtx-progress-bar {
        height: 5px;
      }
      
      .mtx-progress-container:hover .mtx-progress-bar::-webkit-slider-thumb,
      .mtx-progress-container:hover .mtx-progress-bar::-moz-range-thumb {
        opacity: 1;
      }
      
      .mtx-control-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 12px 12px;
        min-height: 40px;
      }
      
      .mtx-controls-left,
      .mtx-controls-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .mtx-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        padding: 0;
        background: transparent;
        border: none;
        border-radius: 50%;
        color: #fff;
        cursor: pointer;
        transition: background-color 0.1s ease, transform 0.1s ease;
        font-size: 18px;
      }
      
      .mtx-btn:hover {
        background: rgba(255,255,255,0.2);
        transform: scale(1.05);
      }
      
      .mtx-btn:active {
        transform: scale(0.95);
      }
      
      .mtx-btn[aria-pressed="true"]:not(.mtx-caption-btn) {
        background: rgba(255,255,255,0.3);
      }
      
      .mtx-volume-group {
        position: relative;
        display: flex;
        align-items: center;
      }
      
      .mtx-volume-popup {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%) translateY(10px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.15s ease-out, transform 0.15s ease-out;
        z-index: 50;
        margin-bottom: 5px;
      }
      
      .mtx-volume-track {
        position: relative;
        width: 32px;
        height: 100px;
        background: rgba(0,0,0,0.8);
        border-radius: 6px;
        padding: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .mtx-volume-vertical {
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        writing-mode: vertical-lr;
        direction: rtl;
        width: 4px;
        height: 84px;
        background: transparent;
        outline: none;
        border: none;
        border-radius: 2px;
        cursor: pointer;
      }
      
      .mtx-volume-vertical:focus {
        outline: none;
        box-shadow: none;
      }
      
      .mtx-volume-vertical::-webkit-slider-track {
        -webkit-appearance: none;
        width: 4px;
        height: 84px;
        background: rgba(255,255,255,0.3);
        border-radius: 2px;
        border: none;
      }
      
      .mtx-volume-vertical::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #fff;
        cursor: pointer;
        border: none;
        margin: 0;
      }
      
      .mtx-volume-vertical::-moz-range-track {
        width: 4px;
        height: 84px;
        background: rgba(255,255,255,0.3);
        border-radius: 2px;
        border: none;
      }
      
      .mtx-volume-vertical::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #fff;
        cursor: pointer;
        border: none;
        margin: 0;
      }
      
      .mtx-volume-vertical::-moz-range-progress {
        background: #ff0000;
        border-radius: 2px;
      }
      
      .mtx-time {
        font-size: 13px;
        font-weight: 400;
        color: #fff;
        margin-left: 8px;
        white-space: nowrap;
      }
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
      // Update progress bar visual fill (for webkit)
      if (Number.isFinite(dur) && dur > 0) {
        const progress = (cur / dur) * 100;
        this.seekEl.style.background = `linear-gradient(to right, #ff0000 0%, #ff0000 ${progress}%, rgba(255,255,255,0.3) ${progress}%, rgba(255,255,255,0.3) 100%)`;
      }
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
  
  private updateVolumeSliderVisual(slider: HTMLInputElement, value: number) {
    const percent = (1 - value) * 100;
    // Create YouTube-style red gradient for vertical slider
    // Since direction:rtl and writing-mode:vertical-lr, we need to reverse the gradient
    slider.style.background = `linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.3) ${percent}%, #ff0000 ${percent}%, #ff0000 100%)`;
    
    // Force override any browser default styles
    slider.style.setProperty('background', `linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.3) ${percent}%, #ff0000 ${percent}%, #ff0000 100%)`, 'important');
  }
  
  private showVolumePopup() {
    this.cancelHideVolumePopup();
    const popup = this.root?.querySelector('.mtx-volume-popup') as HTMLElement;
    if (popup) {
      popup.style.opacity = '1';
      popup.style.transform = 'translateX(-50%) translateY(0)';
      popup.style.pointerEvents = 'auto';
    }
  }
  
  private scheduleHideVolumePopup() {
    this.cancelHideVolumePopup();
    this.volumePopupTimer = window.setTimeout(() => {
      this.hideVolumePopup();
    }, 1000); // 1초 딜레이
  }
  
  private cancelHideVolumePopup() {
    if (this.volumePopupTimer) {
      window.clearTimeout(this.volumePopupTimer);
      this.volumePopupTimer = null;
    }
  }
  
  private hideVolumePopup() {
    const popup = this.root?.querySelector('.mtx-volume-popup') as HTMLElement;
    if (popup) {
      popup.style.opacity = '0';
      popup.style.transform = 'translateX(-50%) translateY(10px)';
      popup.style.pointerEvents = 'none';
    }
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
