// Public entry for motiontext-renderer (M2.5 minimal slice)
import type { ScenarioFileV1_3, TextNode, Cue } from "./types/scenario";
import { parseScenario } from "./parser/ScenarioParser";
import { applyNormalizedPosition } from "./layout/LayoutEngine";
import { TimelineController } from "./core/TimelineController";
export { MotionTextController } from "./controller";
import { isWithin } from "./utils/time";

// (reserved) type helpers can be added later

export class MotionTextRenderer {
  private container: HTMLElement;
  private scenario: ScenarioFileV1_3 | null = null;
  private media: HTMLVideoElement | null = null;
  private timeline = new TimelineController();
  private mountedTextEls: { node: TextNode; el: HTMLElement }[] = [];
  private unsub: (() => void) | null = null;
  private ro: ResizeObserver | null = null;
  private onLoadedMetaBound: (() => void) | null = null;
  private onFullscreenBound: (() => void) | null = null;
  private controlSafeBottomPx = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    // Do not override container positioning; demo CSS positions it absolutely.
  }

  async loadConfig(config: any) {
    // Normalize incoming config to Scenario v1.3
    this.scenario = parseScenario(config);
    this.remount();
    if (this.media) this.updateAt(this.media.currentTime);
    this.updateOverlayBounds();
  }

  attachMedia(video: HTMLVideoElement) {
    this.media = video;
    this.timeline.attachMedia(video);
    if (this.unsub) this.unsub();
    this.unsub = this.timeline.onTick((t) => this.updateAt(t));
    this.updateAt(video.currentTime);
    this.installOverlayBinding();
  }

  play() {
    this.timeline.play();
  }

  pause() {
    this.timeline.pause();
  }

  seek(timeSec: number) {
    this.timeline.seek(timeSec);
    this.updateAt(timeSec);
  }

  dispose() {
    this.pause();
    if (this.unsub) this.unsub();
    this.unsub = null;
    this.container.innerHTML = "";
    this.mountedTextEls = [];
    this.scenario = null;
    this.teardownOverlayBinding();
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

  // Bind overlay to actual displayed video rect to avoid letterbox cut-off
  private installOverlayBinding() {
    if (!('ResizeObserver' in window)) return;
    const parent = this.container.parentElement;
    if (!parent) return;
    if (this.ro) this.ro.disconnect();
    this.ro = new ResizeObserver(() => this.updateOverlayBounds());
    this.ro.observe(parent);
    if (this.media) {
      this.onLoadedMetaBound = () => this.updateOverlayBounds();
      this.media.addEventListener('loadedmetadata', this.onLoadedMetaBound);
    }
    this.onFullscreenBound = () => this.updateOverlayBounds();
    document.addEventListener('fullscreenchange', this.onFullscreenBound);
    this.updateOverlayBounds();
  }

  private teardownOverlayBinding() {
    if (this.ro) { this.ro.disconnect(); this.ro = null; }
    if (this.media && this.onLoadedMetaBound) this.media.removeEventListener('loadedmetadata', this.onLoadedMetaBound);
    this.onLoadedMetaBound = null;
    if (this.onFullscreenBound) document.removeEventListener('fullscreenchange', this.onFullscreenBound);
    this.onFullscreenBound = null;
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

  private updateOverlayBounds() {
    const parent = this.container.parentElement;
    if (!parent) return;
    const cw = parent.clientWidth;
    const ch = parent.clientHeight;
    if (!cw || !ch) return;
    let va: number | null = null;
    if (this.media && this.media.videoWidth && this.media.videoHeight) va = this.media.videoWidth / this.media.videoHeight;
    else va = this.parseAspectFromStage() ?? 16 / 9;
    const ca = cw / ch;
    let width = cw, height = ch, left = 0, top = 0;
    if (ca > (va ?? ca)) {
      height = ch; width = Math.round(ch * (va ?? ca)); left = Math.round((cw - width) / 2); top = 0;
    } else {
      width = cw; height = Math.round(cw / (va ?? ca)); left = 0; top = Math.round((ch - height) / 2);
    }

    // Note: Do NOT shrink overlay for controller; keep overlay matched to video
    // Caption safe area is applied via transform on items using CSS var
    const s = this.container.style;
    s.position = 'absolute';
    s.pointerEvents = 'none';
    s.left = `${left}px`;
    s.top = `${top}px`;
    s.width = `${width}px`;
    s.height = `${height}px`;
  }

  private remount() {
    this.container.innerHTML = "";
    this.mountedTextEls = [];
    if (!this.scenario) return;

    const trackTypeById = new Map(this.scenario.tracks.map(t => [t.id, t.type] as const));
    const textNodes = this.collectTextNodes(this.scenario.cues);
    for (const tn of textNodes) {
      const cueTrackId = this.findCueTrackIdForNode(tn);
      const trackType = (cueTrackId ? trackTypeById.get(cueTrackId) : undefined) ?? "subtitle";
      // Note: findCueTrackIdForNode is a temporary helper; in M2.5 we approximate by scanning cues
      const el = document.createElement("div");
      el.textContent = tn.text ?? "";
      el.style.pointerEvents = "none";
      el.style.whiteSpace = "pre-wrap";
      el.style.color = tn.style?.color ?? "#fff";
      el.style.display = "none"; // hidden by default
      const defaultAnchor = trackType === "subtitle" ? "bc" : "cc";
      applyNormalizedPosition(el, tn.layout, defaultAnchor);
      this.container.appendChild(el);
      this.mountedTextEls.push({ node: tn, el });
    }
  }

  private updateAt(t: number) {
    for (const { node, el } of this.mountedTextEls) {
      const t0 = node.absStart ?? -Infinity;
      const t1 = node.absEnd ?? Infinity;
      const active = isWithin(t, t0, t1);
      el.style.display = active ? "block" : "none";
    }
  }

  private collectTextNodes(cues: Cue[]): TextNode[] {
    const out: TextNode[] = [];
    const visit = (n: any) => {
      if (!n) return;
      if (n.e_type === "text") out.push(n as TextNode);
      const children: any[] = Array.isArray(n.children) ? n.children : [];
      for (const c of children) visit(c);
    };
    for (const c of cues) visit(c.root);
    return out;
  }

  // Temporary: find the cue that contains this node to derive trackId; O(N) but fine for demo
  private findCueTrackIdForNode(target: TextNode): string | undefined {
    if (!this.scenario) return undefined;
    for (const cue of this.scenario.cues) {
      let found = false;
      const walk = (n: any) => {
        if (found || !n) return;
        if (n === target) { found = true; return; }
        const children: any[] = Array.isArray(n.children) ? n.children : [];
        for (const c of children) walk(c);
      };
      walk(cue.root);
      if (found) return cue.track;
    }
    return undefined;
  }
}

export type { ScenarioFileV1_3 };
