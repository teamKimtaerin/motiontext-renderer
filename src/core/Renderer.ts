import type { ScenarioFileV1_3, TextNode } from '../types/scenario';
import {
  applyNormalizedPosition,
  applyFlowContainer,
  applyGridContainer,
} from '../layout/LayoutEngine';
import { isWithin, computeRelativeWindow } from '../utils/time';
import {
  composeActive,
  type Channels,
  progress as prog,
} from '../composer/PluginChainComposer';
import { evalBuiltin } from '../runtime/plugins/Builtin';
import {
  applyChannels,
  applyTextStyle,
  applyGroupStyle,
} from '../runtime/StyleApply';
import { ensureEffectsRoot } from '../runtime/DomMount';
import { devRegistry } from '../loader/dev/DevPluginRegistry';
import { createDevContext } from '../loader/SandboxContext';
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
  effectsRoot?: HTMLElement;
  // map of pluginChain index -> seek applier
  _appliers?: Map<number, (_p: number) => void>;
}

export class Renderer {
  private container: HTMLElement;
  private scenario: ScenarioFileV1_3 | null = null;
  private stage: Stage;
  private trackManager: TrackManager;
  private mountedTextEls: MountedItem[] = [];
  private mountedGroups: { el: HTMLElement; node: any }[] = [];
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

  private resolveDefinitions(params: any): any {
    if (!this.scenario?.definitions || !params) return params;

    const resolved = { ...params };
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('definitions.')) {
        const path = value.slice('definitions.'.length);
        const resolvedValue = this.scenario.definitions[path];
        if (resolvedValue !== undefined) {
          resolved[key] = resolvedValue;
        }
      }
    }
    return resolved;
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
    this.mountedGroups = [];
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
      // Apply group visual style (box/padding/border) using stage height scale
      const containerHeight = this.container.clientHeight || 720;
      applyGroupStyle(groupEl, containerHeight, root.style, root.layout);
      this.mountedGroups.push({ el: groupEl, node: root });
      const children: any[] = Array.isArray(root.children) ? root.children : [];
      for (const ch of children) {
        if (ch.e_type !== 'text') continue;
        const el = document.createElement('div');
        el.textContent = ch.text ?? '';
        el.style.pointerEvents = 'none';
        // word-per-node: render inline and allow wrapping at group level
        el.style.whiteSpace = 'normal';
        el.style.display = 'none';
        (el.style as any).marginRight = '.33em';
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
        const effectsRoot = ensureEffectsRoot(el);
        groupEl.appendChild(el);
        this.mountedTextEls.push({
          node: ch,
          el,
          baseT,
          parent: groupEl,
          groupMode: flowIgnored ? 'absolute' : mode,
          overlap: trackObj?.overlapPolicy,
          rowGapPx: (groupEl as any).__rowGapPx,
          effectsRoot,
          _appliers: new Map(),
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
    // Update group-level styles that depend on stage height (padding/border radius)
    for (const g of this.mountedGroups) {
      try {
        applyGroupStyle(
          g.el,
          ph,
          (g.node as any).style,
          (g.node as any).layout
        );
      } catch (_err) {
        /* noop */
      }
    }
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
    const groupHasActive = new Map<HTMLElement, boolean>();
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
      el.style.display = active ? 'inline-block' : 'none';
      if (active) {
        groupHasActive.set(parent, true);
        const chain = (node as any).pluginChain as any[] | undefined;
        const fps = this.scenario?.timebase?.fps;
        const snap = this.scenario?.behavior?.snapToFrame ?? false;
        // EvalFn that prefers dev plugin evalChannels if present
        const ch: Channels = composeActive(
          chain as any,
          t,
          t0,
          t1,
          (spec, p) => {
            const reg = devRegistry.resolve(spec.name);
            if (reg && typeof reg.module?.evalChannels === 'function') {
              const ctx = createDevContext(
                reg.baseUrl,
                (el as any).__effectsRoot || el
              );
              try {
                const resolvedSpec = {
                  ...spec,
                  params: this.resolveDefinitions(spec.params),
                };
                return reg.module.evalChannels(resolvedSpec, p, ctx) || {};
              } catch {
                return {};
              }
            }
            return evalBuiltin(spec, p);
          },
          { fps, snapToFrame: snap }
        );
        // Drive default interface plugins (SeekApplier/Timeline)
        if (Array.isArray(chain) && chain.length) {
          const item = this.mountedTextEls.find((it) => it.el === el)!;
          const effectsRoot = item.effectsRoot || ensureEffectsRoot(el);
          item.effectsRoot = effectsRoot;
          const appliers =
            item._appliers || new Map<number, (_p: number) => void>();
          item._appliers = appliers;
          for (let i = 0; i < chain.length; i++) {
            const spec: any = chain[i];
            const reg = devRegistry.resolve(spec.name);
            if (!reg || !reg.module?.default) continue;
            // If dev path exposes evalChannels, prefer channel composition and skip default to avoid double applying
            if (typeof reg.module?.evalChannels === 'function') continue;
            const runtime = reg.module.default;
            const { t0: w0, t1: w1 } = computeRelativeWindow(t0, t1, spec, {
              fps,
              snapToFrame: snap,
            });
            if (!isWithin(t, w0, w1)) continue;
            // ensure applier
            let ap = appliers.get(i);
            if (!ap) {
              // ctx per plugin (baseUrl-specific)
              const ctx = createDevContext(reg.baseUrl, effectsRoot);
              const resolvedParams = this.resolveDefinitions(spec.params);
              try {
                if (typeof runtime.init === 'function')
                  runtime.init(effectsRoot, resolvedParams, ctx);
              } catch (_err) {
                /* noop */
              }
              let out: any = undefined;
              try {
                out = runtime.animate(
                  effectsRoot,
                  resolvedParams,
                  ctx,
                  Math.max(0, w1 - w0)
                );
              } catch (_err) {
                /* noop */
              }
              if (typeof out === 'function') {
                ap = out as (_p: number) => void;
              } else if (out && typeof out.progress === 'function') {
                ap = (pp: number) => {
                  try {
                    out.pause().progress(pp);
                  } catch (_err) {
                    /* noop */
                  }
                };
              } else {
                ap = (_pp: number) => {};
              }
              appliers.set(i, ap);
            }
            const pnow = prog(t, w0, w1);
            try {
              ap(pnow);
            } catch (_err) {
              /* noop */
            }
          }
        }
        let base = baseT;
        const m = groupOffsets.get(parent);
        const extra = m?.get(el) ?? 0;
        if (extra) base = `${base} translate(0px, ${Math.round(extra)}px)`;
        // Always apply channel-based composition to the element (default plugins act on effectsRoot)
        applyChannels(el, base, ch);
      }
    }
    // Toggle group container visibility based on child activity
    groups.forEach((_g, parent) => {
      const active = !!groupHasActive.get(parent);
      parent.style.display = active ? '' : 'none';
    });
  }

  dispose() {
    this.container.innerHTML = '';
    this.mountedTextEls = [];
    this.nodeTrackMap.clear();
    this.scenario = null;
  }
}
