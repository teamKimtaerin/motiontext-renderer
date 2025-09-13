import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBaseWrapper,
  ensureEffectsRoot,
  applyDomSeparation,
  applyCSSVariableChannels,
  validatePluginDomAccess,
  legacyEnsureEffectsRoot,
} from '../DomSeparation';

describe('DomSeparation', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.className = 'test-container';
    document.body.appendChild(container);
  });

  describe('createBaseWrapper', () => {
    it('creates a new baseWrapper with default config', () => {
      const baseWrapper = createBaseWrapper(container);
      
      expect(baseWrapper).toBeInstanceOf(HTMLElement);
      expect(baseWrapper.className).toBe('mtx-base-wrapper');
      expect(baseWrapper.style.position).toBe('relative');
      expect(baseWrapper.style.display).toBe('inline-block');
      expect(baseWrapper.style.pointerEvents).toBe('none');
      expect(container.contains(baseWrapper)).toBe(true);
    });

    it('initializes CSS variables by default', () => {
      const baseWrapper = createBaseWrapper(container);
      
      // CSS 변수 확인
      expect(baseWrapper.style.getPropertyValue('--mtx-tx')).toBe('0px');
      expect(baseWrapper.style.getPropertyValue('--mtx-ty')).toBe('0px');
      expect(baseWrapper.style.getPropertyValue('--mtx-sx')).toBe('1');
      expect(baseWrapper.style.getPropertyValue('--mtx-sy')).toBe('1');
      expect(baseWrapper.style.getPropertyValue('--mtx-rot')).toBe('0deg');
      expect(baseWrapper.style.getPropertyValue('--mtx-opacity')).toBe('1');
      
      // transform 스타일 확인
      expect(baseWrapper.style.transform).toContain('var(--mtx-tx');
      expect(baseWrapper.style.transform).toContain('var(--mtx-ty');
      // jsdom은 opacity에 var()를 그대로 보존하지 않고 파싱 실패 시 'NaN'으로 나타날 수 있음
      // 따라서 CSS 변수 자체가 설정되었는지로 검증한다
      expect(baseWrapper.style.getPropertyValue('--mtx-opacity')).toBe('1');
    });

    it('preserves existing content when preserveExisting is true', () => {
      const childDiv = document.createElement('div');
      childDiv.textContent = 'existing content';
      container.appendChild(childDiv);
      
      const baseWrapper = createBaseWrapper(container, { preserveExisting: true });
      
      expect(baseWrapper.contains(childDiv)).toBe(true);
      expect(childDiv.textContent).toBe('existing content');
    });

    it('uses custom CSS classes when provided', () => {
      const baseWrapper = createBaseWrapper(container, {
        baseWrapperClass: 'custom-base-wrapper',
      });
      
      expect(baseWrapper.className).toBe('custom-base-wrapper');
    });

    it('returns existing baseWrapper if found', () => {
      const firstCall = createBaseWrapper(container);
      const secondCall = createBaseWrapper(container);
      
      expect(firstCall).toBe(secondCall);
      expect(container.querySelectorAll('.mtx-base-wrapper')).toHaveLength(1);
    });
  });

  describe('ensureEffectsRoot', () => {
    it('creates a new effectsRoot within baseWrapper', () => {
      const baseWrapper = createBaseWrapper(container);
      const effectsRoot = ensureEffectsRoot(baseWrapper);
      
      expect(effectsRoot).toBeInstanceOf(HTMLElement);
      expect(effectsRoot.className).toBe('mtx-effects-root');
      expect(effectsRoot.getAttribute('data-mtx-effects-root')).toBe('');
      expect(effectsRoot.style.position).toBe('relative');
      expect(effectsRoot.style.pointerEvents).toBe('none');
      expect(baseWrapper.contains(effectsRoot)).toBe(true);
    });

    it('returns existing effectsRoot if found', () => {
      const baseWrapper = createBaseWrapper(container);
      const firstCall = ensureEffectsRoot(baseWrapper);
      const secondCall = ensureEffectsRoot(baseWrapper);
      
      expect(firstCall).toBe(secondCall);
      expect(baseWrapper.querySelectorAll('.mtx-effects-root')).toHaveLength(1);
    });

    it('uses custom CSS class when provided', () => {
      const baseWrapper = createBaseWrapper(container);
      const effectsRoot = ensureEffectsRoot(baseWrapper, {
        effectsRootClass: 'custom-effects-root',
      });
      
      expect(effectsRoot.className).toBe('custom-effects-root');
    });
  });

  describe('applyDomSeparation', () => {
    it('creates both baseWrapper and effectsRoot', () => {
      const { baseWrapper, effectsRoot } = applyDomSeparation(container);
      
      expect(baseWrapper.className).toBe('mtx-base-wrapper');
      expect(effectsRoot.className).toBe('mtx-effects-root');
      expect(container.contains(baseWrapper)).toBe(true);
      expect(baseWrapper.contains(effectsRoot)).toBe(true);
    });

    it('returns the same elements on multiple calls', () => {
      const first = applyDomSeparation(container);
      const second = applyDomSeparation(container);
      
      expect(first.baseWrapper).toBe(second.baseWrapper);
      expect(first.effectsRoot).toBe(second.effectsRoot);
    });
  });

  describe('applyCSSVariableChannels', () => {
    it('applies channel values as CSS variables', () => {
      const baseWrapper = createBaseWrapper(container);
      
      applyCSSVariableChannels(baseWrapper, {
        tx: 10,
        ty: -5,
        sx: 1.2,
        rot: 45,
        opacity: 0.8,
        filter: 'blur(2px)',
      });
      
      expect(baseWrapper.style.getPropertyValue('--mtx-tx')).toBe('10px');
      expect(baseWrapper.style.getPropertyValue('--mtx-ty')).toBe('-5px');
      expect(baseWrapper.style.getPropertyValue('--mtx-sx')).toBe('1.2');
      expect(baseWrapper.style.getPropertyValue('--mtx-rot')).toBe('45deg');
      expect(baseWrapper.style.getPropertyValue('--mtx-opacity')).toBe('0.8');
      expect(baseWrapper.style.getPropertyValue('--mtx-filter')).toBe('blur(2px)');
    });

    it('handles undefined and null values gracefully', () => {
      const baseWrapper = createBaseWrapper(container);
      
      applyCSSVariableChannels(baseWrapper, {
        tx: undefined,
        ty: null,
        sx: 1.5,
      });
      
      // undefined/null 값은 설정되지 않아야 함
      expect(baseWrapper.style.getPropertyValue('--mtx-tx')).toBe('0px'); // 기본값 유지
      expect(baseWrapper.style.getPropertyValue('--mtx-ty')).toBe('0px'); // 기본값 유지
      expect(baseWrapper.style.getPropertyValue('--mtx-sx')).toBe('1.5');
    });

    it('handles custom channel types', () => {
      const baseWrapper = createBaseWrapper(container);
      
      applyCSSVariableChannels(baseWrapper, {
        customChannel: 'custom-value',
        anotherChannel: 123,
      });
      
      expect(baseWrapper.style.getPropertyValue('--mtx-customChannel')).toBe('custom-value');
      expect(baseWrapper.style.getPropertyValue('--mtx-anotherChannel')).toBe('123');
    });
  });

  describe('validatePluginDomAccess', () => {
    it('allows access to effectsRoot itself', () => {
      const { effectsRoot } = applyDomSeparation(container);
      
      expect(validatePluginDomAccess(effectsRoot, effectsRoot)).toBe(true);
    });

    it('allows access to children of effectsRoot', () => {
      const { effectsRoot } = applyDomSeparation(container);
      const childElement = document.createElement('div');
      effectsRoot.appendChild(childElement);
      
      expect(validatePluginDomAccess(childElement, effectsRoot)).toBe(true);
    });

    it('allows access to nested children of effectsRoot', () => {
      const { effectsRoot } = applyDomSeparation(container);
      const childElement = document.createElement('div');
      const nestedChild = document.createElement('span');
      childElement.appendChild(nestedChild);
      effectsRoot.appendChild(childElement);
      
      expect(validatePluginDomAccess(nestedChild, effectsRoot)).toBe(true);
    });

    it('denies access to elements outside effectsRoot', () => {
      const { baseWrapper, effectsRoot } = applyDomSeparation(container);
      const outsideElement = document.createElement('div');
      container.appendChild(outsideElement);
      
      expect(validatePluginDomAccess(baseWrapper, effectsRoot)).toBe(false);
      expect(validatePluginDomAccess(outsideElement, effectsRoot)).toBe(false);
      expect(validatePluginDomAccess(container, effectsRoot)).toBe(false);
    });
  });

  describe('legacyEnsureEffectsRoot', () => {
    it('creates effects root with legacy behavior', () => {
      const effectsRoot = legacyEnsureEffectsRoot(container);
      
      expect(effectsRoot.getAttribute('data-mtx-effects-root')).toBe('');
      expect(effectsRoot.style.position).toBe('relative');
      expect(effectsRoot.style.pointerEvents).toBe('none');
      expect(container.contains(effectsRoot)).toBe(true);
    });

    it('sets container position to relative if static', () => {
      container.style.position = 'static';
      legacyEnsureEffectsRoot(container);
      
      expect(container.style.position).toBe('relative');
    });

    it('preserves non-static container position', () => {
      container.style.position = 'absolute';
      legacyEnsureEffectsRoot(container);
      
      expect(container.style.position).toBe('absolute');
    });

    it('returns existing effects root', () => {
      const first = legacyEnsureEffectsRoot(container);
      const second = legacyEnsureEffectsRoot(container);
      
      expect(first).toBe(second);
      expect(container.querySelectorAll('[data-mtx-effects-root]')).toHaveLength(1);
    });
  });

  describe('CSS variable behavior', () => {
    it('properly handles decimal values', () => {
      const baseWrapper = createBaseWrapper(container);
      
      applyCSSVariableChannels(baseWrapper, {
        tx: 10.5,
        sy: 0.75,
        opacity: 0.333,
      });
      
      expect(baseWrapper.style.getPropertyValue('--mtx-tx')).toBe('10.5px');
      expect(baseWrapper.style.getPropertyValue('--mtx-sy')).toBe('0.75');
      expect(baseWrapper.style.getPropertyValue('--mtx-opacity')).toBe('0.333');
    });

    it('properly handles zero values', () => {
      const baseWrapper = createBaseWrapper(container);
      
      applyCSSVariableChannels(baseWrapper, {
        tx: 0,
        ty: 0,
        rot: 0,
        opacity: 0,
      });
      
      expect(baseWrapper.style.getPropertyValue('--mtx-tx')).toBe('0px');
      expect(baseWrapper.style.getPropertyValue('--mtx-ty')).toBe('0px');
      expect(baseWrapper.style.getPropertyValue('--mtx-rot')).toBe('0deg');
      expect(baseWrapper.style.getPropertyValue('--mtx-opacity')).toBe('0');
    });
  });
});
