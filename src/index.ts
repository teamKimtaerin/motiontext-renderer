// Public entry for motiontext-renderer (M2.5 minimal slice)
import type { ScenarioFileV1_3 } from "./types/scenario";
import { parseScenario } from "./parser/ScenarioParser";
import { TimelineController } from "./core/TimelineController";
import { Stage } from "./core/Stage";
import { TrackManager } from "./core/TrackManager";
import { Renderer } from "./core/Renderer";
import gsap from "gsap";
export { MotionTextController } from "./controller";

// (reserved) type helpers can be added later

export class MotionTextRenderer {
  private container: HTMLElement;
  private scenario: ScenarioFileV1_3 | null = null;
  private media: HTMLVideoElement | null = null;
  private timeline = new TimelineController();
  private stage = new Stage();
  private trackManager = new TrackManager();
  private renderer: Renderer;
  private unsub: (() => void) | null = null;
  private stageBoundsUnsub: (() => void) | null = null;
  private controlSafeBottomPx = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    // Enforce GSAP presence (peer dependency)
    if (!gsap) {
      throw new Error("GSAP is required as a peer dependency. Install 'gsap' and ensure it is available to the host app.");
    }
    this.stage.setContainer(container);
    this.renderer = new Renderer(container, this.stage, this.trackManager);
    this.stageBoundsUnsub = this.stage.onBoundsChange(() => this.renderer.recomputeMountedBases());
    // Do not override container positioning; demo CSS positions it absolutely.
  }

  async loadConfig(config: any) {
    // Normalize incoming config to Scenario v1.3
    this.scenario = parseScenario(config);
    this.stage.setScenario(this.scenario);
    this.trackManager.setScenario(this.scenario);
    this.renderer.setScenario(this.scenario);
    this.renderer.remount();
    if (this.media) {
      this.renderer.update(this.media.currentTime);
      // Attach-only start policy: do not auto-start timeline here
    }
  }

  attachMedia(video: HTMLVideoElement) {
    this.media = video;
    this.timeline.attachMedia(video);
    this.stage.setMedia(video);
    if (this.unsub) {
      try { this.unsub(); } finally { this.unsub = null; }
    }
    this.unsub = this.timeline.onTick((t) => this.renderer.update(t));
    this.renderer.update(video.currentTime);
    // If video is already playing at attach time, start timeline loop
    if (!video.paused) {
      this.timeline.ensurePlaying();
    }
  }

  play() {
    this.timeline.play();
  }

  pause() {
    this.timeline.pause();
  }

  seek(timeSec: number) {
    this.timeline.seek(timeSec);
    this.renderer.update(timeSec);
  }

  setRate(rate: number) {
    this.timeline.setRate(rate);
  }

  dispose() {
    this.pause();
    // Timeline 분리를 Stage/Renderer 이전에 처리 (관례상 안전)
    if (this.media) {
      this.timeline.detachMedia();
      this.media = null;
    }
    if (this.unsub) this.unsub();
    this.unsub = null;
    if (this.stageBoundsUnsub) this.stageBoundsUnsub();
    this.stageBoundsUnsub = null;
    this.renderer.dispose();
    this.scenario = null;
    this.stage.dispose();
  }

  setCaptionsVisible(visible: boolean) {
    this.container.style.visibility = visible ? "visible" : "hidden";
  }

  // Allow controller to reserve bottom safe area in pixels (e.g., controller height)
  setControlSafeBottom(px: number) {
    this.controlSafeBottomPx = Math.max(0, Math.floor(px || 0));
    // Expose to CSS so layout can offset bottom-anchored items
    this.container.style.setProperty('--mtx-safe-bottom-px', `${this.controlSafeBottomPx}px`);
  }

  // (Orchestration methods moved to core/Renderer.ts)
}

export type { ScenarioFileV1_3 };
