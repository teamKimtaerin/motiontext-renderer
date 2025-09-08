// DOM mounting utilities for nodes and plugin containers.

export function ensureEffectsRoot(el: HTMLElement): HTMLElement {
  let root = el.querySelector(
    ':scope > [data-mtx-effects-root]'
  ) as HTMLElement | null;
  if (!root) {
    root = document.createElement('div');
    root.setAttribute('data-mtx-effects-root', '');
    // In-flow container so host element can size to content.
    // Absolute positioning here caused zero-width hosts and vertical wrapping.
    root.style.position = 'relative';
    root.style.pointerEvents = 'none';
    // If host is static, allow anchoring relative to itself when needed
    const pos = getComputedStyle(el).position;
    if (pos === 'static') el.style.position = 'relative';
    el.appendChild(root);
  }
  return root;
}
