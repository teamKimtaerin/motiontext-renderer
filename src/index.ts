// Public entry for motiontext-renderer (M2.5 minimal slice)
import type { ScenarioFileV1_3, TextNode } from "./types/scenario";
import { parseScenario } from "./parser/ScenarioParser";
import { applyNormalizedPosition, applyFlowContainer, applyGridContainer } from "./layout/LayoutEngine";
import { TimelineController } from "./core/TimelineController";
export { MotionTextController } from "./controller";
import { isWithin } from "./utils/time";
import { composeActive, type Channels } from "./composer/PluginChainComposer";
import { evalBuiltin } from "./runtime/plugins/Builtin";
import { applyChannels } from "./runtime/StyleApply";
import type { Style } from "./types/layout";

// (reserved) type helpers can be added later

export class MotionTextRenderer {
  private container: HTMLElement;
  private scenario: ScenarioFileV1_3 | null = null;
  private media: HTMLVideoElement | null = null;
  private timeline = new TimelineController();
  private mountedTextEls: { node: TextNode; el: HTMLElement; baseT: string; parent: HTMLElement; groupMode: 'flow'|'grid'|'absolute'; overlap?: string; rowGapPx?: number }[] = [];
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
    this.ro = new ResizeObserver(() => this.scheduleOverlayBoundsUpdate());
    this.ro.observe(parent);
    if (this.media) {
      this.onLoadedMetaBound = () => this.scheduleOverlayBoundsUpdate();
      this.media.addEventListener('loadedmetadata', this.onLoadedMetaBound);
    }
    this.onFullscreenBound = () => this.scheduleOverlayBoundsUpdate();
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

  // Throttle overlay bounds update to avoid excessive work on rapid resize
  private _overlayUpdateTimer: number | null = null;
  private scheduleOverlayBoundsUpdate() {
    if (this._overlayUpdateTimer != null) return;
    this._overlayUpdateTimer = window.setTimeout(() => {
      this._overlayUpdateTimer = null;
      this.updateOverlayBounds();
    }, 50);
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
    // Skip if unchanged to avoid unnecessary reflow
    const box = `${left},${top},${width},${height}`;
    if ((this as any).__lastOverlayBox === box) return;
    (this as any).__lastOverlayBox = box;
    const s = this.container.style;
    s.position = 'absolute';
    s.pointerEvents = 'none';
    s.left = `${left}px`;
    s.top = `${top}px`;
    s.width = `${width}px`;
    s.height = `${height}px`;

    // Recompute base transforms for mounted nodes (reflow)
    this.recomputeMountedBases();
  }

  // Re-apply layout positioning to refresh base transform after overlay resize/reflow
  private recomputeMountedBases() {
    if (!this.scenario) return;
    const trackTypeById = new Map(this.scenario.tracks.map(t => [t.id, t.type] as const));
    const stageSafe = this.scenario.stage?.safeArea;
    const parent = this.container;
    const pw = parent.clientWidth, ph = parent.clientHeight;
    for (const item of this.mountedTextEls) {
      const tn = item.node;
      const cueTrackId = this.findCueTrackIdForNode(tn);
      const trackType = (cueTrackId ? trackTypeById.get(cueTrackId) : undefined) ?? "subtitle";
      const defaultAnchor = trackType === "subtitle" ? "bc" : "cc";
      const trackObj = this.scenario.tracks.find(tr => tr.id === cueTrackId);
      const keyObj = {
        pw, ph,
        anchor: defaultAnchor,
        layout: tn.layout ?? {},
        stageSafe,
        trackSafe: trackObj?.safeArea
      };
      const key = JSON.stringify(keyObj);
      if ((item.el as any).__mtxBaseKey === key) continue;
      applyNormalizedPosition(item.el, tn.layout, defaultAnchor, { stageSafe, trackSafe: trackObj?.safeArea });
      item.baseT = item.el.style.transform || "";
      (item.el as any).__mtxBaseKey = key;
    }
  }

  private remount() {
    this.container.innerHTML = "";
    this.mountedTextEls = [];
    if (!this.scenario) return;

    // Group-aware mounting: iterate cues and mount group containers, then children
    for (const cue of this.scenario.cues) {
      const trackObj = this.scenario.tracks.find(tr => tr.id === cue.track);
      const trackType = trackObj?.type ?? 'subtitle';
      const defaultAnchor = trackType === 'subtitle' ? 'bc' : 'cc';
      const root = cue.root;
      const groupEl = document.createElement('div');
      groupEl.style.pointerEvents = 'none';
      // position container (flow/grid/absolute), with overlapPolicy handling
      const mode = (root.layout?.mode ?? 'absolute') as 'flow'|'grid'|'absolute';
      const policy = trackObj?.overlapPolicy;
      const flowIgnored = (mode === 'flow' && policy === 'ignore');
      if (mode === 'flow' && !flowIgnored) {
        applyFlowContainer(groupEl, root.layout, defaultAnchor, {
          stageSafe: this.scenario.stage?.safeArea,
          trackSafe: trackObj?.safeArea
        });
        const gapRel = root.layout?.gapRel ?? 0;
        const ph = this.container.clientHeight || 0;
        (groupEl as any).__rowGapPx = Math.round(ph * gapRel);
      } else if (mode === 'grid') {
        applyGridContainer(groupEl, root.layout, defaultAnchor, {
          stageSafe: this.scenario.stage?.safeArea,
          trackSafe: trackObj?.safeArea
        });
      } else {
        applyNormalizedPosition(groupEl, root.layout, defaultAnchor, {
          stageSafe: this.scenario.stage?.safeArea,
          trackSafe: trackObj?.safeArea
        });
      }
      this.container.appendChild(groupEl);
      const children: any[] = Array.isArray(root.children) ? root.children : [];
      for (const ch of children) {
        if (ch.e_type !== 'text') continue;
        const el = document.createElement('div');
        el.textContent = ch.text ?? '';
        el.style.pointerEvents = 'none';
        el.style.whiteSpace = 'pre-wrap';
        el.style.display = 'none';
        this.applyTextStyle(el, ch.style, trackObj?.defaultStyle);
        // If container is flow and policy is not ignore, child follows flex stack.
        // If flow+ignore 또는 non-flow, child는 개별 absolute 배치.
        if (mode !== 'flow' || flowIgnored) {
          applyNormalizedPosition(el, ch.layout, defaultAnchor, {
            stageSafe: this.scenario.stage?.safeArea,
            trackSafe: trackObj?.safeArea
          });
          if (flowIgnored && (!ch.layout || !ch.layout.position)) {
            el.style.position = 'absolute';
            el.style.left = '50%';
            el.style.top = '50%';
            el.style.transform = 'translate(-50%, -50%)';
          }
        }
        const baseT = el.style.transform || '';
        groupEl.appendChild(el);
        this.mountedTextEls.push({ node: ch, el, baseT, parent: groupEl, groupMode: (flowIgnored ? 'absolute' : mode), overlap: trackObj?.overlapPolicy, rowGapPx: (groupEl as any).__rowGapPx });
      }
    }
  }

  private updateAt(t: number) {
    // compute push offsets per non-flow group if overlapPolicy is push/stack
    const groupOffsets = new Map<HTMLElement, Map<HTMLElement, number>>();
    const groups = new Map<HTMLElement, { items: { el: HTMLElement; node: TextNode }[]; mode: string; policy?: string; rowGapPx?: number }>();
    for (const it of this.mountedTextEls) {
      let g = groups.get(it.parent);
      if (!g) { g = { items: [], mode: it.groupMode, policy: it.overlap, rowGapPx: it.rowGapPx }; groups.set(it.parent, g); }
      g.items.push({ el: it.el, node: it.node });
    }
    groups.forEach((g, parent) => {
      if ((g.policy === 'push' || g.policy === 'stack') && g.mode !== 'flow') {
        let yOff = 0;
        const map = new Map<HTMLElement, number>();
        for (const { el } of g.items) {
          if (el.style.display === 'none') continue;
          map.set(el, yOff);
          const h = el.offsetHeight || 0;
          yOff += h + (g.rowGapPx ?? 0);
        }
        groupOffsets.set(parent, map);
      }
    });

    for (const { node, el, baseT, parent } of this.mountedTextEls) {
      const t0 = node.absStart ?? -Infinity;
      const t1 = node.absEnd ?? Infinity;
      const active = isWithin(t, t0, t1);
      el.style.display = active ? "block" : "none";
      if (active) {
        const chain = (node as any).pluginChain as any[] | undefined;
        const ch: Channels = composeActive(chain as any, t, t0, t1, (spec, p) => evalBuiltin(spec, p));
        let base = baseT;
        const m = groupOffsets.get(parent);
        const extra = m?.get(el) ?? 0;
        if (extra) base = `${base} translate(0px, ${Math.round(extra)}px)`;
        applyChannels(el, base, ch);
      }
    }
  }

  private applyTextStyle(el: HTMLElement, style?: Style, trackDefault?: Style) {
    const s = { ...(trackDefault || {}), ...(style || {}) } as any;
    if (s.color) el.style.color = String(s.color);
    if (s.textShadow) el.style.textShadow = String(s.textShadow);
    // Typography
    if (s.fontFamily) el.style.fontFamily = String(s.fontFamily);
    if (s.fontWeight) el.style.fontWeight = String(s.fontWeight);
    if (s.lineHeight != null) el.style.lineHeight = String(s.lineHeight);
    // fontSize: support absolute(px, em, rem) via fontSize, or relative via fontSizeRel
    const ph = this.container.clientHeight || 720;
    if (s.fontSize) el.style.fontSize = String(s.fontSize);
    else if (typeof s.fontSizeRel === 'number') {
      const px = Math.max(1, Math.round(ph * s.fontSizeRel));
      el.style.fontSize = `${px}px`;
    }
    // Stroke: try -webkit-text-stroke if width provided, else fallback via stronger shadow if not present
    if (s.stroke && typeof s.stroke.widthRel === 'number') {
      const px = Math.max(1, Math.round(ph * s.stroke.widthRel));
      (el.style as any).webkitTextStrokeWidth = `${px}px`;
      (el.style as any).webkitTextStrokeColor = String(s.stroke.color || '#000');
      (el.style as any).webkitTextFillColor = el.style.color || '#fff';
    } else if (!s.textShadow) {
      // Default readable outline if none specified
      el.style.textShadow = '0 0 2px #000, 0 0 4px #000, 0 0 8px #000';
    }
  }

  // collectTextNodes was used in the initial implementation; group-aware mounting supersedes it.

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
