// Public entry for motiontext-renderer (M2.5 minimal slice)
import type { ScenarioFileV1_3, TextNode, Cue } from "./types/scenario";
import { parseScenario } from "./parser/ScenarioParser";
import { applyNormalizedPosition } from "./layout/LayoutEngine";
import { TimelineController } from "./core/TimelineController";
import { isWithin } from "./utils/time";

// (reserved) type helpers can be added later

export class MotionTextRenderer {
  private container: HTMLElement;
  private scenario: ScenarioFileV1_3 | null = null;
  // reserved for future use
  // private media: HTMLVideoElement | null = null;
  private timeline = new TimelineController();
  private mountedTextEls: { node: TextNode; el: HTMLElement }[] = [];
  private unsub: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    // Do not override container positioning; demo CSS positions it absolutely.
  }

  async loadConfig(config: any) {
    // Normalize incoming config to Scenario v1.3
    this.scenario = parseScenario(config);
    this.remount();
  }

  attachMedia(video: HTMLVideoElement) {
    // this.media = video;
    this.timeline.attachMedia(video);
    if (this.unsub) this.unsub();
    this.unsub = this.timeline.onTick((t) => this.updateAt(t));
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
  }

  private remount() {
    this.container.innerHTML = "";
    this.mountedTextEls = [];
    if (!this.scenario) return;

    const trackTypeById = new Map(this.scenario.tracks.map(t => [t.id, t.type] as const));
    const textNodes = this.collectTextNodes(this.scenario.cues);
    console.debug("[Renderer] mounting text nodes:", textNodes.length);
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
