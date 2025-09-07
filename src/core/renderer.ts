import type { ScenarioFileV1_3, TextNode } from '../types/scenario';
import {
  applyNormalizedPosition,
  applyFlowContainer,
  applyGridContainer,
} from '../layout/LayoutEngine';
import { isWithin } from '../utils/time';
import { composeActive, type Channels } from '../composer/PluginChainComposer';
import { evalBuiltin } from '../runtime/plugins/Builtin';
import { applyChannels, applyTextStyle } from '../runtime/StyleApply';
import type { Stage } from './Stage';
import type { TrackManager, GroupItem } from './TrackManager';

interface MountedItem {
  node: TextNode;
  el: HTMLElement;
  baseT: string;
  parent: HTMLElement;
  groupMode: 'flow' | 'grid' | 'absolute';
  overlap?: string;
  rowGapPx?: number;
}

export class Renderer {
  private container: HTMLElement;
  private scenario: ScenarioFileV1_3 | null = null;
  private stage: Stage;
  private trackManager: TrackManager;
  private mountedTextEls: MountedItem[] = [];
  private nodeTrackMap = new Map<TextNode, string>(); // O(1) lookup optimization

  constructor(
    container: HTMLElement,
    stage: Stage,
    trackManager: TrackManager
  ) {
    this.container = container;
    this.stage = stage;
    this.trackManager = trackManager;
  }

  setScenario(scenario: ScenarioFileV1_3) {
    this.scenario = scenario;
    this.buildNodeTrackMap();
  }

  // O(1) optimization for findCueTrackIdForNode
  private buildNodeTrackMap() {
    this.nodeTrackMap.clear();
    if (!this.scenario) return;

    for (const cue of this.scenario.cues) {
      const walk = (n: any) => {
        if (!n) return;
        if (n.e_type === 'text') {
          this.nodeTrackMap.set(n, cue.track);
        }
        const children: any[] = Array.isArray(n.children) ? n.children : [];
        for (const c of children) walk(c);
      };
      walk(cue.root);
    }
  }

  private findCueTrackIdForNode(target: TextNode): string | undefined {
    return this.nodeTrackMap.get(target);
  }

  remount() {
    this.container.innerHTML = '';
    this.mountedTextEls = [];
    if (!this.scenario) return;

    // Group-aware mounting: iterate cues and mount group containers, then children
    for (const cue of this.scenario.cues) {
      const trackObj = this.scenario.tracks.find((tr) => tr.id === cue.track);
      const trackType = trackObj?.type ?? 'subtitle';
      const defaultAnchor = trackType === 'subtitle' ? 'bc' : 'cc';
      const root = cue.root;
      const groupEl = document.createElement('div');
      groupEl.style.pointerEvents = 'none';
      // position container (flow/grid/absolute), with overlapPolicy handling
      const mode = (root.layout?.mode ?? 'absolute') as
        | 'flow'
        | 'grid'
        | 'absolute';
      const policy = trackObj?.overlapPolicy;
      const flowIgnored = mode === 'flow' && policy === 'ignore';
      if (mode === 'flow' && !flowIgnored) {
        applyFlowContainer(groupEl, root.layout, defaultAnchor, {
          stageSafe: this.scenario.stage?.safeArea,
          trackSafe: trackObj?.safeArea,
        });
        const gapRel = root.layout?.gapRel ?? 0;
        const ph = this.container.clientHeight || 0;
        (groupEl as any).__rowGapPx = Math.round(ph * gapRel);
      } else if (mode === 'grid') {
        applyGridContainer(groupEl, root.layout, defaultAnchor, {
          stageSafe: this.scenario.stage?.safeArea,
          trackSafe: trackObj?.safeArea,
        });
      } else {
        applyNormalizedPosition(groupEl, root.layout, defaultAnchor, {
          stageSafe: this.scenario.stage?.safeArea,
          trackSafe: trackObj?.safeArea,
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
        const containerHeight = this.container.clientHeight || 720;
        applyTextStyle(el, containerHeight, ch.style, trackObj?.defaultStyle);
        // If container is flow and policy is not ignore, child follows flex stack.
        // If flow+ignore 또는 non-flow, child는 개별 absolute 배치.
        if (mode !== 'flow' || flowIgnored) {
          applyNormalizedPosition(el, ch.layout, defaultAnchor, {
            stageSafe: this.scenario.stage?.safeArea,
            trackSafe: trackObj?.safeArea,
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
        this.mountedTextEls.push({
          node: ch,
          el,
          baseT,
          parent: groupEl,
          groupMode: flowIgnored ? 'absolute' : mode,
          overlap: trackObj?.overlapPolicy,
          rowGapPx: (groupEl as any).__rowGapPx,
        });
      }
    }
  }

  // Re-apply layout positioning to refresh base transform after overlay resize/reflow
  recomputeMountedBases() {
    if (!this.scenario) return;
    const contentRect = this.stage.getContentRect();
    if (!contentRect) return;
    const trackTypeById = new Map(
      this.scenario.tracks.map((t) => [t.id, t.type] as const)
    );
    const stageSafe = this.scenario.stage?.safeArea;
    const pw = contentRect.width,
      ph = contentRect.height;
    for (const item of this.mountedTextEls) {
      const tn = item.node;
      const cueTrackId = this.findCueTrackIdForNode(tn);
      const trackType =
        (cueTrackId ? trackTypeById.get(cueTrackId) : undefined) ?? 'subtitle';
      const defaultAnchor = trackType === 'subtitle' ? 'bc' : 'cc';
      const trackObj = this.scenario.tracks.find((tr) => tr.id === cueTrackId);
      const keyObj = {
        pw,
        ph,
        anchor: defaultAnchor,
        layout: tn.layout ?? {},
        stageSafe,
        trackSafe: trackObj?.safeArea,
      };
      const key = JSON.stringify(keyObj);
      if ((item.el as any).__mtxBaseKey === key) continue;
      applyNormalizedPosition(item.el, tn.layout, defaultAnchor, {
        stageSafe,
        trackSafe: trackObj?.safeArea,
      });
      item.baseT = item.el.style.transform || '';
      (item.el as any).__mtxBaseKey = key;
    }
  }

  update(t: number) {
    // compute push offsets per non-flow group if overlapPolicy is push/stack
    const groupOffsets = new Map<HTMLElement, Map<HTMLElement, number>>();
    const groups = new Map<
      HTMLElement,
      { items: GroupItem[]; mode: string; policy?: string; rowGapPx?: number }
    >();
    for (const it of this.mountedTextEls) {
      let g = groups.get(it.parent);
      if (!g) {
        g = {
          items: [],
          mode: it.groupMode,
          policy: it.overlap,
          rowGapPx: it.rowGapPx,
        };
        groups.set(it.parent, g);
      }
      g.items.push({ el: it.el, node: it.node });
    }
    groups.forEach((g, parent) => {
      if ((g.policy === 'push' || g.policy === 'stack') && g.mode !== 'flow') {
        const map = this.trackManager.computeGroupOffsets(
          g.items,
          g.rowGapPx ?? 0
        );
        groupOffsets.set(parent, map);
      }
    });

    for (const { node, el, baseT, parent } of this.mountedTextEls) {
      const t0 = node.absStart ?? -Infinity;
      const t1 = node.absEnd ?? Infinity;
      const active = isWithin(t, t0, t1);
      el.style.display = active ? 'block' : 'none';
      if (active) {
        const chain = (node as any).pluginChain as any[] | undefined;
        const ch: Channels = composeActive(chain as any, t, t0, t1, (spec, p) =>
          evalBuiltin(spec, p)
        );
        let base = baseT;
        const m = groupOffsets.get(parent);
        const extra = m?.get(el) ?? 0;
        if (extra) base = `${base} translate(0px, ${Math.round(extra)}px)`;
        applyChannels(el, base, ch);
      }
    }
  }

  dispose() {
    this.container.innerHTML = '';
    this.mountedTextEls = [];
    this.nodeTrackMap.clear();
    this.scenario = null;
  }
}
