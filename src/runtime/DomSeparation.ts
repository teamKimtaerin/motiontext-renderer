// DOM 경계 분리 시스템 (Plugin System v3.0)
// baseWrapper (렌더러 영역) ↔ effectsRoot (플러그인 영역) 분리 관리

export interface DomSeparationConfig {
  enableCSSVariables?: boolean; // CSS 변수 채널 활성화 (기본: true)
  baseWrapperClass?: string; // baseWrapper CSS 클래스
  effectsRootClass?: string; // effectsRoot CSS 클래스
  preserveExisting?: boolean; // 기존 DOM 구조 보존 여부
}

export interface ChannelValues {
  tx?: number; // translateX (px)
  ty?: number; // translateY (px)
  sx?: number; // scaleX
  sy?: number; // scaleY
  rot?: number; // rotate (deg)
  opacity?: number; // 0~1
  filter?: string; // CSS filter
  [key: string]: any; // 커스텀 채널
}

const DEFAULT_CONFIG: Required<DomSeparationConfig> = {
  enableCSSVariables: true,
  baseWrapperClass: 'mtx-base-wrapper',
  effectsRootClass: 'mtx-effects-root',
  preserveExisting: false,
};

/**
 * DOM 경계 분리를 위한 baseWrapper 생성
 * baseWrapper는 렌더러가 관리하며, CSS 변수를 통해 채널 값을 제공
 */
export function createBaseWrapper(
  originalElement: HTMLElement,
  config: DomSeparationConfig = {}
): HTMLElement {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // 기존 baseWrapper 찾기
  let baseWrapper = originalElement.querySelector(
    `.${cfg.baseWrapperClass}`
  ) as HTMLElement | null;

  if (!baseWrapper) {
    baseWrapper = document.createElement('div');
    baseWrapper.className = cfg.baseWrapperClass;
    
    // 기본 스타일 설정
    baseWrapper.style.position = 'relative';
    baseWrapper.style.display = 'inline-block';
    baseWrapper.style.pointerEvents = 'none';
    
    // CSS 변수 기반 transform 초기화
    if (cfg.enableCSSVariables) {
      initializeCSSVariables(baseWrapper);
    }

    // 기존 콘텐츠 이동 또는 새로 생성
    if (cfg.preserveExisting && originalElement.children.length > 0) {
      // 기존 자식을 baseWrapper로 이동
      while (originalElement.firstChild) {
        baseWrapper.appendChild(originalElement.firstChild);
      }
    }
    
    originalElement.appendChild(baseWrapper);
  }

  return baseWrapper;
}

/**
 * 플러그인 전용 effectsRoot 생성
 * effectsRoot는 플러그인이 관리하며, baseWrapper 내부에 위치
 */
export function ensureEffectsRoot(
  baseWrapper: HTMLElement,
  config: DomSeparationConfig = {}
): HTMLElement {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  let effectsRoot = baseWrapper.querySelector(
    `.${cfg.effectsRootClass}`
  ) as HTMLElement | null;

  if (!effectsRoot) {
    effectsRoot = document.createElement('div');
    effectsRoot.className = cfg.effectsRootClass;
    effectsRoot.setAttribute('data-mtx-effects-root', '');
    
    // effectsRoot 기본 스타일
    effectsRoot.style.position = 'relative';
    effectsRoot.style.pointerEvents = 'none';
    effectsRoot.style.width = '100%';
    effectsRoot.style.height = '100%';

    baseWrapper.appendChild(effectsRoot);
  }

  return effectsRoot;
}

/**
 * CSS 변수 기반 채널 시스템 초기화
 */
function initializeCSSVariables(baseWrapper: HTMLElement): void {
  const defaultChannels: ChannelValues = {
    tx: 0,
    ty: 0,
    sx: 1,
    sy: 1,
    rot: 0,
    opacity: 1,
  };

  // CSS 변수 설정
  Object.entries(defaultChannels).forEach(([key, value]) => {
    const cssVar = `--mtx-${key}`;
    let cssValue: string;
    
    switch (key) {
      case 'tx':
      case 'ty':
        cssValue = `${value}px`;
        break;
      case 'rot':
        cssValue = `${value}deg`;
        break;
      default:
        cssValue = String(value);
    }
    
    baseWrapper.style.setProperty(cssVar, cssValue);
  });

  // transform 및 opacity CSS 설정
  baseWrapper.style.transform = 
    'translateX(var(--mtx-tx, 0px)) ' +
    'translateY(var(--mtx-ty, 0px)) ' +
    'scaleX(var(--mtx-sx, 1)) ' +
    'scaleY(var(--mtx-sy, 1)) ' +
    'rotate(var(--mtx-rot, 0deg))';
  
  baseWrapper.style.opacity = 'var(--mtx-opacity, 1)';
  baseWrapper.style.filter = 'var(--mtx-filter, none)';
}

/**
 * 채널 값을 CSS 변수로 적용
 */
export function applyCSSVariableChannels(
  baseWrapper: HTMLElement,
  channels: ChannelValues
): void {
  Object.entries(channels).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    
    const cssVar = `--mtx-${key}`;
    let cssValue: string;

    switch (key) {
      case 'tx':
      case 'ty':
        cssValue = `${value}px`;
        break;
      case 'rot':
        cssValue = `${value}deg`;
        break;
      case 'sx':
      case 'sy':
      case 'opacity':
        cssValue = String(value);
        break;
      case 'filter':
        cssValue = String(value);
        break;
      default:
        cssValue = String(value);
    }

    baseWrapper.style.setProperty(cssVar, cssValue);
  });
}

/**
 * 기존 ensureEffectsRoot와의 호환성을 위한 래퍼
 * @deprecated 대신 createBaseWrapper + ensureEffectsRoot 사용
 */
export function legacyEnsureEffectsRoot(el: HTMLElement): HTMLElement {
  // 기존 방식: data-mtx-effects-root 직접 생성
  let root = el.querySelector(
    ':scope > [data-mtx-effects-root]'
  ) as HTMLElement | null;
  
  if (!root) {
    root = document.createElement('div');
    root.setAttribute('data-mtx-effects-root', '');
    root.style.position = 'relative';
    root.style.pointerEvents = 'none';
    
    if (getComputedStyle(el).position === 'static') {
      el.style.position = 'relative';
    }
    
    el.appendChild(root);
  }
  
  return root;
}

/**
 * DOM 분리 아키텍처 적용
 * originalElement → baseWrapper → effectsRoot 구조 생성
 */
export function applyDomSeparation(
  originalElement: HTMLElement,
  config: DomSeparationConfig = {}
): { baseWrapper: HTMLElement; effectsRoot: HTMLElement } {
  const baseWrapper = createBaseWrapper(originalElement, config);
  const effectsRoot = ensureEffectsRoot(baseWrapper, config);
  
  return { baseWrapper, effectsRoot };
}

/**
 * 플러그인이 접근할 수 있는 DOM 영역인지 검증
 */
export function validatePluginDomAccess(
  element: HTMLElement,
  effectsRoot: HTMLElement
): boolean {
  // effectsRoot 자신이거나 그 하위 요소인지 확인
  return element === effectsRoot || effectsRoot.contains(element);
}