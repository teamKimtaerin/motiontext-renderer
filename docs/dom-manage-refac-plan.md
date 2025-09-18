Option B – Renderer‑Owned DOM Wrapper Migration Plan

Goal: Centralize DOM lifecycle for DOM plugins by having the Renderer create and own a per‑plugin wrapper under each node’s `effectsRoot`, and pass that wrapper to plugins. Plugins render only inside the wrapper; the Renderer handles presence checks, cleanup, and reinitialization using the wrapper as the single source of truth.

Scope: DOM‑based plugins only (glow, flames, glitch, magnetic, etc.). Non‑DOM plugins unaffected.

Non‑Goals: Changing plugin public API shape (`init/animate/cleanup`), changing GSAP usage, or altering effect visuals.

Why: Prevent reinit loops and inconsistent marker conventions by removing the need for plugins to add their own presence markers. Improves reliability and separation of concerns.

---

Implementation Summary

- Renderer creates a child wrapper element per DOM plugin under a node’s `effectsRoot`:
  - Tag: `div` (or `span` if needed for inline), class: `mtx-plugin-root mtx-plugin-<name>`
  - Attributes: `data-mtx-plugin-root="<pluginName>"`, `data-node-key="<cueId>:<nodeId>"`
  - Z‑index layered above/below according to plugin order (see “Layering”).
- Renderer passes this wrapper as the `el` argument to `init/animate/cleanup` and sets `context.targetElement` to the same wrapper.
- Presence check becomes generic: look for `:scope > [data-mtx-plugin-root="<plugin>"]` only (remove plugin‑specific selectors like `[data-glow]`).
- Cleanup removes GSAP timelines and then the wrapper node. Plugins no longer remove their own root marker; they only clean what they created inside the wrapper (if needed).

---

Contract (Renderer ⇄ Plugin)

- Renderer guarantees:
  - `el` is the dedicated wrapper for the plugin and is a direct child of `effectsRoot`.
  - `context.targetElement === el`.
  - The wrapper exists for the whole lifetime of the effect; only Renderer creates/removes it.
- Plugin responsibilities:
  - Render DOM only inside `el` (no sibling mutations of `effectsRoot`).
  - Do not set/remove presence markers on `el` (Renderer owns those).
  - `cleanup(el)` must not remove `el`; it may clear its own children and kill tweens.

---

Renderer Changes (TypeScript)

- `src/core/RendererV2.ts`
  - Add `createDomPluginWrapper(effectsRoot, pluginName, nodeKey): HTMLElement`.
    - Creates `div[data-mtx-plugin-root="pluginName"]` if missing; sets `className` to `mtx-plugin-root mtx-plugin-<pluginName>` and `dataset.nodeKey` to `nodeKey`.
  - Replace `checkDomPluginElements(...)` with a single generic presence check:
    - `return !effectsRoot.querySelector(`:scope > [data-mtx-plugin-root="${pluginName}"]`);`
  - In `initializeDomPlugin(...)`:
    - Create/acquire wrapper and pass it as the first arg to `init/animate` (currently we pass `effectsRoot`).
    - Ensure GSAP timelines (if any) are paused; store in state.
  - In `cleanupDomPlugin(...)`:
    - Kill timelines, call plugin `cleanup(wrapper)`, then remove `wrapper` from DOM.
  - Layering: maintain order of wrappers equal to plugin order within a node:
    - Insert wrapper at a stable index (e.g., by scanning existing `[data-mtx-plugin-root]` siblings and placing after the last preceding plugin for that node).
  - Backward‑compat flag:
    - `rendererOptions.experimentalDomWrappers: boolean` (default false initially).
    - If false, behave as today. If true, use wrappers and generic presence check.

- `src/runtime/PluginContextV3.ts`
  - Confirm `targetElement?: HTMLElement` exists (already present in code paths). If absent, add and export in type.

---

Plugin Changes (per DOM plugin)

- Remove plugin‑managed presence markers (`data-glow`, `data-glitch`, `data-magnetic`, `data-flames`) from `init/cleanup`.
- Trust `el` to be the wrapper from Renderer; render inside it.
- Ensure `cleanup(el)` does not remove `el` itself — only kill tweens and optionally `el.innerHTML = ''`.
- Keep existing timelines and behavior otherwise unchanged.

---

Migration Phases

Phase 0 – Audit (1–2h)
- List DOM plugins and classify as DOM‑heavy (own structure) vs. light (only styles): glow, flames, glitch, magnetic → DOM‑heavy.
- Verify each plugin currently uses `el` consistently and doesn’t depend on modifying parent of `el` except for text shadow (glow) — see “Host Side Effects”.

Phase 1 – Renderer abstractions (0.5d)
- Add `experimentalDomWrappers` option and default to false.
- Implement `createDomPluginWrapper(...)` and generic presence check.
- Wire wrappers in `initializeDomPlugin(...)`, `manageDomPluginState(...)`, and `cleanupDomPlugin(...)` when flag is true.

Phase 2 – Dual‑mode compatibility (0.5d)
- When flag is true:
  - Pass wrapper as `el` to `init/animate/cleanup`.
  - Provide `context.targetElement = wrapper`.
- When flag is false: keep legacy behavior (plugins own markers and manage presence).

Phase 3 – Migrate core plugins (0.5–1d)
- Update DOM plugins to stop setting/removing markers and to render inside the wrapper only.
- Keep code branches behind an environment variable at first:
  - If `context.features?.domWrappers` present, skip marker logic.

Phase 4 – Flip default and remove legacy (0.5d)
- Make `experimentalDomWrappers` true by default after testing.
- Remove plugin‑specific checks in `checkDomPluginElements` and use the generic selector only.
- Remove legacy marker logic from plugins.

---

Testing Plan

- Unit: Vitest + jsdom
  - Renderer creates wrapper for `magnetic` and `glow` and passes it to `init`.
  - Presence check returns false once wrapper exists; no reinit loop during seek.
  - Cleanup removes wrapper and kills timeline.
- Integration (demo):
  - Load scenario with multiple DOM plugins; scrub back/forward quickly; ensure no console warnings and no persistent reinitialization.
  - Verify layering visually (glow under text, magnetic/glitch on text).

---

Layering Rules

- Default: wrappers are appended in plugin order within a node.
- For underlay (e.g., glow), set `style.zIndex = 0` and `position:absolute` with parent `effectsRoot` positioned; text glyphs remain above.
- For overlays (e.g., glitch layers), either keep `position:relative` and zIndex > text or render additional absolute children as needed.

---

Host Side Effects

- Some plugins (e.g., glow) modify the host text’s styles (text‑shadow). Allow this but keep DOM confined to the wrapper. Document that cross‑element style writes are permitted but should be idempotent and reset in `cleanup`.

---

Backwards Compatibility

- Renderer flag: `experimentalDomWrappers` off by default first; CI path exercises both modes.
- Plugins may temporarily keep marker code guarded by `if (!ctx?.features?.domWrappers)`.
- Renderer’s presence check accepts both legacy markers and the new generic selector during the transition.

---

Risks & Mitigations

- CSS positioning differences due to the extra wrapper.
  - Mitigate: wrapper defaults to `display:inline-block; position:relative;` to match previous expectations.
- Plugins that assumed `el` was `effectsRoot` may query outside.
  - Mitigate: keep `el.parentElement` as `effectsRoot` so relative selectors still work; update plugin docs.
- Z‑index conflicts between multiple wrappers.
  - Mitigate: enforce deterministic order and provide `zIndex` utility if needed.

---

Work Items (Checklists)

- RendererV2
  - [ ] Add `experimentalDomWrappers` option and plumbing.
  - [ ] Implement `createDomPluginWrapper(...)`.
  - [ ] Use wrapper in `initializeDomPlugin(...)` and `cleanupDomPlugin(...)` when flag is on.
  - [ ] Replace `checkDomPluginElements` with generic selector behind flag.
  - [ ] Maintain wrapper order and z‑index.

- PluginContextV3
  - [ ] Ensure `targetElement?: HTMLElement` is part of the exported type.
  - [ ] Add `features: { domWrappers: boolean }` to surface the flag to plugins.

- Plugins (core set)
  - [ ] glow – stop adding/removing `data-glow`, render in wrapper.
  - [ ] flames – stop adding/removing `data-flames`, render in wrapper.
  - [ ] glitch – stop adding/removing `data-glitch`, render in wrapper.
  - [ ] magnetic – stop adding/removing `data-magnetic`, render in wrapper.

- Tests
  - [ ] Unit tests for wrapper creation, presence check, cleanup.
  - [ ] Scrub stress test (seek progress rapidly) without reinit.

---

Acceptance Criteria

- With `experimentalDomWrappers=true`:
  - Renderer creates one wrapper per DOM plugin per node and passes it to plugin `init/animate/cleanup`.
  - Presence check uses only `:scope > [data-mtx-plugin-root="<name>"]`.
  - No reinit loops when scrubbing.
  - Cleanup removes wrapper; no DOM leftovers or running tweens.
- With `experimentalDomWrappers=false`:
  - Current behavior unchanged; legacy plugins continue to work.

---

Open Questions

- Do we need per‑plugin underlay/overlay policy baked into Renderer (e.g., `layer: 'underlay' | 'overlay'`), or keep styling inside plugins?
- Should we expose a helper in context to request a specific wrapper display mode (`inline-block` vs `block`)?

---

Notes for Future Me (AI‑friendly hints)

- Start in `src/core/RendererV2.ts`: search for `checkDomPluginElements` and `initializeDomPlugin` to insert the wrapper plumbing.
- Add the feature flag to the renderer options type and thread it through the constructor default.
- Keep both code paths during migration; guard with the flag and clean up later.
- Update two or three plugins first (glow, magnetic) to validate wrapper semantics before flipping the default.

