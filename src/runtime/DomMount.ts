// DOM mounting utilities for nodes and plugin containers.

export function ensureEffectsRoot(el: HTMLElement): HTMLElement {
  let root = el.querySelector(':scope > [data-mtx-effects-root]') as HTMLElement | null;
  if (!root) {
    root = document.createElement('div');
    root.setAttribute('data-mtx-effects-root', '');
    root.style.position = 'absolute';
    root.style.left = '0';
    root.style.top = '0';
    root.style.width = '100%';
    root.style.height = '100%';
    root.style.pointerEvents = 'none';
    // Ensure parent is positioned so absolute child anchors correctly
    const pos = getComputedStyle(el).position;
    if (pos === 'static') el.style.position = 'relative';
    el.appendChild(root);
  }
  return root;
}
