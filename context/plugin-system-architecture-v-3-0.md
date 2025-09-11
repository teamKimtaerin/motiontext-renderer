# Plugin System Architecture v3.0 

이 문서는 MotionText Renderer v2.0과 함께 사용되는 Plugin API v3.0의 아키텍처를 정의합니다.

## 🆕 v2.1 → v3.0 주요 변경사항

### 시나리오 JSON v2.0 통합
- **Define 시스템 호환**: 플러그인이 시나리오의 define 필드에서 정의된 에셋과 변수를 참조 가능
- **상속 시스템 연동**: 플러그인 파라미터도 시나리오의 상속 우선순위 규칙을 따름
- **시간 표현 통일**: 플러그인의 시간 관련 모든 필드를 `[start, end]` 배열 형태로 통일

### 강화된 권한 시스템
- **세밀한 capabilities**: 기존 3개에서 7개로 확장하여 더 정밀한 권한 제어
- **targets 확장**: stage 레벨 플러그인 지원으로 전역 효과 가능
- **DOM 아키텍처 고도화**: CSS 변수 채널 시스템 정식 채택

### 에셋 관리 통합
- **무결성 검증**: SHA-384 해시 검증이 기본값으로 변경 (개발 환경 제외)
- **FontFace 자동화**: 폰트 등록/해제 완전 자동화
- **에셋 타입 확장**: audio 타입 추가

---

## 🎯 핵심 원칙

### 렌더러 독립성
- **타임라인 소유권**: 모든 시간 제어는 렌더러가 담당. 플러그인은 상대 타임라인 또는 seek 함수만 제공.
- **진행도 기반**: 플러그인 내부에서 절대 시간을 직접 계산하지 않음. 호스트가 전달하는 progress(0~1)만 사용.
- **재진입 안전**: 임의의 시점으로 점프, 역방향 재생, 배속 변경에 모두 대응.

### DOM 경계 분리
- **baseWrapper**: 렌더러 전용 영역. 레이아웃, 앵커, 채널 합성 담당.
- **effectsRoot**: 플러그인 전용 영역. 자유로운 DOM 조작 허용.
- **샌드박스**: 플러그인은 effectsRoot 하위만 접근 가능. 상위 DOM 조작 금지.

### 채널 기반 합성
- **표준 채널**: tx/ty/sx/sy/rot/opacity/filter 등 독립적 변환 채널
- **충돌 방지**: CSS 변수를 통한 채널 분리로 플러그인 간 간섭 최소화
- **합성 모드**: replace/add/multiply로 채널별 합성 규칙 정의

---

## 📦 패키지 구조

```
plugins/
  advanced-text-effects@2.0.0/
    manifest.json
    index.mjs
    assets/
      particles.png
      custom-font.woff2
      background.mp4
      effect-sound.mp3
```

### manifest.json v3.0 Schema

```json
{
  "name": "advanced-text-effects",
  "version": "2.0.0",
  "pluginApi": "3.0",
  "minRenderer": "2.0.0",
  "entry": "index.mjs",
  "targets": ["text", "image", "group"],
  "capabilities": [
    "style-vars",
    "portal-breakout", 
    "dom-manipulation",
    "asset-loading"
  ],
  "peer": { 
    "gsap": "^3.12.0",
    "lottie-web": "^5.9.0"
  },
  "preload": [
    "assets/custom-font.woff2",
    "assets/particles.png"
  ],
  "lazyLoad": [
    "assets/background.mp4",
    "assets/effect-sound.mp3"
  ],
  "integrity": {
    "entry": "sha384-abc123...",
    "assets": {
      "assets/particles.png": "sha384-def456...",
      "assets/custom-font.woff2": "sha384-ghi789...",
      "assets/background.mp4": "sha384-jkl012...",
      "assets/effect-sound.mp3": "sha384-mno345..."
    },
    "signature": "base64(ed25519_signature)"   
  },
  "schema": {
    "intensity": {
      "type": "number",
      "default": 1.0,
      "min": 0.0,
      "max": 5.0,
      "ui": {
        "control": "slider",
        "step": 0.1,
        "unit": "x",
        "group": "animation"
      },
      "i18n": {
        "label": { "en": "Intensity", "ko": "강도" },
        "description": { 
          "en": "Effect intensity level", 
          "ko": "효과 강도 수준" 
        }
      }
    },
    "color": {
      "type": "string",
      "default": "define.brand_colors.primary",
      "pattern": "^(#[0-9a-fA-F]{6}|define\\..+|rgba?\\(.+\\))$",
      "ui": {
        "control": "color",
        "group": "appearance"
      }
    },
    "enableParticles": {
      "type": "boolean", 
      "default": true,
      "dependencies": {
        "particleCount": { "when": true }
      }
    },
    "particleCount": {
      "type": "integer",
      "default": 50,
      "min": 10,
      "max": 200
    }
  }
}
```

### 새로운 필드 설명

#### `pluginApi` (string, required)
플러그인 API 버전. v3.0에서는 `"3.0"` 고정.

#### `targets` (array, required)  
플러그인이 적용 가능한 노드 타입:
- `"text"`: 텍스트 노드
- `"image"`: 이미지 노드  
- `"video"`: 비디오 노드
- `"group"`: 그룹 노드
- `"stage"`: 스테이지 전역 (배경 효과, 글로벌 필터 등)

#### `capabilities` (array, required)
플러그인이 사용할 권한 목록:

- **`"style-vars"`**: CSS 변수 채널 조작 권한. 권장 기본 권한.
- **`"portal-breakout"`**: breakout/포털 시스템 사용 권한
- **`"dom-manipulation"`**: 고급 DOM 조작 (innerHTML, 동적 생성 등)
- **`"asset-loading"`**: 런타임 에셋 동적 로딩
- **`"audio-playback"`**: 오디오 재생 제어  
- **`"external-api"`**: 외부 API 호출 (XMLHttpRequest, fetch 등)
- **`"performance-timing"`**: 성능 측정 및 프로파일링 API

#### `lazyLoad` (array, optional)
지연 로딩할 에셋 목록. 실제 사용 시점에 로드.

#### `schema` 확장
- **`dependencies`**: 조건부 필드 표시
- **`ui`**: 편집기 UI 메타데이터
- **`i18n`**: 다국어 라벨 및 설명
- **`pattern`**: 문자열 값 검증 정규식

---

## 🔌 Runtime Interface

### Plugin Context v3.0

```typescript
export interface PluginContext {
  // 기본 컨테이너 (effectsRoot)
  container: HTMLElement;
  
  // 에셋 관리
  assets: {
    getUrl: (path: string) => string;
    loadAsset: (path: string) => Promise<any>;
    preloadAsset: (path: string) => Promise<void>;
    getAssetType: (path: string) => 'image' | 'video' | 'font' | 'audio';
  };
  
  // 시나리오 데이터 접근
  scenario: {
    define: Record<string, any>;
    resolveDefine: (path: string) => any;
    version: string;
  };
  
  // 포털 시스템 (권한 필요)
  portal?: {
    breakout: (options: BreakoutOptions) => void;
    return: () => void;
  };
  
  // 채널 시스템
  channels?: {
    set: (channel: string, value: any, mode?: 'replace' | 'add' | 'multiply') => void;
    get: (channel: string) => any;
    available: string[];
  };
  
  // 오디오 시스템 (권한 필요)
  audio?: {
    play: (url: string, options?: AudioOptions) => Promise<void>;
    pause: (url: string) => void;
    setVolume: (url: string, volume: number) => void;
  };
  
  // 렌더러 정보
  renderer: {
    version: string;
    timeScale: number;
    currentTime: number;
    duration: number;
  };
  
  // 유틸리티
  utils: {
    interpolate: (from: any, to: any, progress: number) => any;
    easing: Record<string, (t: number) => number>;
  };
  
  // Peer 의존성 (manifest.json의 peer 필드 기준)
  gsap?: any;
  lottie?: any;
  [peerDep: string]: any;
}
```

### Plugin Module Interface v3.0

```typescript
export interface PluginRuntimeModule {
  name: string;
  version: string;
  
  // 초기화 (선택적)
  init?: (
    element: HTMLElement, 
    options: any, 
    ctx: PluginContext
  ) => Promise<void> | void;
  
  // 애니메이션 생성 (필수)
  animate: (
    element: HTMLElement,
    options: any,
    ctx: PluginContext,
    duration: number
  ) => TimelineLike | SeekApplier | Promise<TimelineLike | SeekApplier>;
  
  // 정리 (선택적)
  cleanup?: (element: HTMLElement) => Promise<void> | void;
  
  // 스키마 (선택적, manifest와 동일)
  schema?: Record<string, SchemaField>;
  
  // 에러 핸들링 (선택적)
  onError?: (error: Error, context: string) => void;
}

// 타임라인 인터페이스 (GSAP 호환)
export interface TimelineLike {
  pause(): this;
  progress(value?: number): number | this;
  duration(value?: number): number | this;
}

// Seek 함수형 인터페이스
export type SeekApplier = (progress: number) => void;
```

### Define 시스템 연동

플러그인에서 시나리오의 define 필드를 참조하는 방법:

```javascript
export default {
  name: "enhanced-text",
  version: "1.0.0",
  
  init(el, options, ctx) {
    // Define 값 직접 해석
    const brandColor = ctx.scenario.resolveDefine("define.brand_colors.primary");
    const customFont = ctx.scenario.resolveDefine("define.custom_fonts.heading");
    
    // 에셋이면 URL 변환
    if (customFont?.type === 'font') {
      const fontUrl = ctx.assets.getUrl(customFont.src);
      // FontFace는 렌더러가 자동 등록하므로 family 이름만 사용
      el.style.fontFamily = customFont.family;
    }
  },
  
  animate(el, options, ctx, duration) {
    // 파라미터에서도 define 참조 가능
    const effectColor = ctx.scenario.resolveDefine(options.color || "#ffffff");
    
    return (progress) => {
      // CSS 변수 채널 사용 (권한 필요)
      if (ctx.channels) {
        ctx.channels.set('opacity', progress, 'replace');
        ctx.channels.set('filter', `hue-rotate(${progress * 360}deg)`, 'replace');
      }
      
      // effectsRoot에 직접 스타일 적용
      el.style.color = effectColor;
    };
  }
};
```

---

## 🧱 DOM Architecture

### 표준 DOM 구조

```html
<!-- baseWrapper: 렌더러 관리 영역 -->
<div class="mtx-base-wrapper" style="
  --mtx-tx: 10px; 
  --mtx-ty: -5px; 
  --mtx-sx: 1.2; 
  --mtx-sy: 1.0;
  --mtx-rot: 15deg; 
  --mtx-opacity: 0.8;
  transform: translateX(var(--mtx-tx)) translateY(var(--mtx-ty)) 
             scaleX(var(--mtx-sx)) scaleY(var(--mtx-sy)) 
             rotate(var(--mtx-rot));
  opacity: var(--mtx-opacity);
">
  
  <!-- effectsRoot: 플러그인 관리 영역 -->
  <div class="mtx-effects-root">
    <span class="text-content">Hello World</span>
    <!-- 플러그인이 추가한 요소들 -->
    <div class="particle-container">...</div>
    <canvas class="effect-overlay"></canvas>
  </div>
  
</div>
```

### CSS 변수 채널 시스템

**표준 채널**:
```css
/* 변환 채널 */
--mtx-tx: 0px;      /* translateX */
--mtx-ty: 0px;      /* translateY */
--mtx-sx: 1;        /* scaleX */
--mtx-sy: 1;        /* scaleY */
--mtx-rot: 0deg;    /* rotate */

/* 시각 효과 채널 */
--mtx-opacity: 1;
--mtx-filter: none;
--mtx-mix-blend-mode: normal;

/* 색상 채널 */
--mtx-color: inherit;
--mtx-background: transparent;
--mtx-border-color: transparent;

/* 사용자 정의 채널 (플러그인별) */
--mtx-plugin-{pluginName}-{channelName}: {value};
```

**채널 사용 예제**:
```javascript
// 플러그인에서 채널 설정
ctx.channels.set('tx', `${Math.sin(progress * Math.PI) * 20}px`, 'add');
ctx.channels.set('opacity', Math.cos(progress * Math.PI), 'multiply');
ctx.channels.set('filter', `blur(${progress * 5}px)`, 'replace');

// 사용자 정의 채널
ctx.channels.set('plugin-particles-density', progress * 100, 'replace');
```

### 합성 모드

- **`replace`**: 기존 값을 새 값으로 교체 (기본값)
- **`add`**: 기존 값에 새 값을 더함 (transform 변환에 유용)
- **`multiply`**: 기존 값에 새 값을 곱함 (opacity, scale에 유용)

---

## 🖼 에셋 관리

### 에셋 타입별 처리

#### Font Assets
```json
{
  "define": {
    "custom_font": {
      "type": "font",
      "family": "CustomBrand",
      "src": "assets/custom-brand.woff2",
      "preload": true,
      "integrity": "sha384-...",
      "fallback": ["Arial", "sans-serif"],
      "display": "swap"
    }
  }
}
```

**자동 처리**:
1. 렌더러가 자동으로 `FontFace` 객체 생성 및 등록
2. `document.fonts.add()` 호출
3. 플러그인에서는 `family` 이름으로 직접 사용
4. 컴포넌트 해제 시 자동으로 폰트 등록 해제

#### Image Assets
```json
{
  "define": {
    "particle_texture": {
      "type": "image",
      "src": "assets/particles.png",
      "preload": false,
      "integrity": "sha384-...",
      "alt": "Particle texture for effects"
    }
  }
}
```

#### Video Assets
```json
{
  "define": {
    "background_video": {
      "type": "video", 
      "src": "assets/background.mp4",
      "preload": false,
      "integrity": "sha384-...",
      "mimeType": "video/mp4",
      "poster": "assets/background-poster.jpg"
    }
  }
}
```

#### Audio Assets (v3.0 신규)
```json
{
  "define": {
    "effect_sound": {
      "type": "audio",
      "src": "assets/effect.mp3", 
      "preload": false,
      "integrity": "sha384-...",
      "mimeType": "audio/mpeg",
      "loop": false,
      "volume": 0.7
    }
  }
}
```

### 런타임 에셋 API

```javascript
export default {
  async init(el, options, ctx) {
    // 에셋 타입 확인
    const assetType = ctx.assets.getAssetType('assets/texture.png');
    
    // 지연 로딩
    const videoBlob = await ctx.assets.loadAsset('assets/background.mp4');
    const videoUrl = URL.createObjectURL(videoBlob);
    
    // 오디오 재생 (권한 필요)
    if (ctx.audio && options.enableSound) {
      await ctx.audio.play('assets/effect.mp3', {
        loop: false,
        volume: 0.5
      });
    }
  },
  
  animate(el, options, ctx, duration) {
    return (progress) => {
      // 에셋 URL 사용
      const textureUrl = ctx.assets.getUrl('assets/particles.png');
      el.style.backgroundImage = `url(${textureUrl})`;
      
      // 오디오 볼륨 조절
      if (ctx.audio) {
        ctx.audio.setVolume('assets/effect.mp3', progress);
      }
    };
  }
};
```

---

## 🌟 Portal & Breakout System

### Breakout 설정

```json
{
  "effectScope": {
    "breakout": {
      "mode": "portal",
      "toLayer": 1000,
      "coordSpace": "stage",
      "return": {
        "when": "complete", 
        "transition": { "duration": 0.3, "easing": "ease-out" }
      },
      "transfer": "move"
    }
  }
}
```

### 플러그인에서 Portal 사용

```javascript
export default {
  animate(el, options, ctx, duration) {
    return (progress) => {
      // Breakout 트리거 (권한 필요)
      if (progress > 0.5 && ctx.portal) {
        ctx.portal.breakout({
          toLayer: 1500,
          coordSpace: 'stage',
          transfer: 'clone'  // 복제 모드
        });
      }
      
      // 특정 조건에서 복귀
      if (progress > 0.9 && ctx.portal) {
        ctx.portal.return();
      }
    };
  }
};
```

---

## ⚡ 성능 최적화

### 로딩 전략

```typescript
// 렌더러의 로딩 최적화
class PluginLoader {
  async loadPlugin(name: string, version: string) {
    // 1. 캐시 확인
    const cached = this.cache.get(`${name}@${version}`);
    if (cached) return cached;
    
    // 2. Manifest 로딩
    const manifest = await this.fetchManifest(name, version);
    
    // 3. 무결성 검증 (프로덕션)
    if (this.isProduction) {
      await this.verifyIntegrity(manifest);
    }
    
    // 4. Preload 에셋 병렬 로딩
    await Promise.all(
      manifest.preload.map(asset => this.preloadAsset(asset))
    );
    
    // 5. Entry 로딩 및 동적 import
    const entryBlob = await this.fetchEntry(manifest);
    const entryUrl = URL.createObjectURL(entryBlob);
    const module = await import(entryUrl);
    
    // 6. 캐시 저장 및 반환
    this.cache.set(`${name}@${version}`, module);
    return module.default;
  }
}
```

### 메모리 관리

```javascript
// 플러그인에서 메모리 효율적 구현
export default {
  init(el, options, ctx) {
    // 무거운 객체는 WeakMap 사용
    this.heavyObjects = new WeakMap();
    this.heavyObjects.set(el, new ParticleSystem());
  },
  
  cleanup(el) {
    // 명시적 정리
    const particles = this.heavyObjects.get(el);
    if (particles) {
      particles.dispose();
      this.heavyObjects.delete(el);
    }
    
    // 타이머, 이벤트 리스너 정리
    this.clearAllTimers();
    this.removeAllListeners();
    
    // Blob URL 해제
    this.createdUrls.forEach(url => URL.revokeObjectURL(url));
    this.createdUrls.clear();
  }
};
```

### 렌더링 최적화

```javascript
export default {
  animate(el, options, ctx, duration) {
    // RequestAnimationFrame 기반 최적화
    let rafId;
    const heavyUpdate = () => {
      // GPU 가속 사용
      el.style.willChange = 'transform, opacity';
      
      // 배치 DOM 업데이트
      requestAnimationFrame(() => {
        this.updateParticles();
        this.updateEffects();
        el.style.willChange = 'auto'; // 정리
      });
    };
    
    return (progress) => {
      // 빈번한 업데이트는 throttle
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        heavyUpdate();
      });
      
      // 채널 사용으로 리플로우 최소화
      ctx.channels?.set('tx', `${progress * 100}px`);
      ctx.channels?.set('opacity', progress);
    };
  }
};
```

---

## 🛡 보안 & 샌드박스

### CSP (Content Security Policy) 호환

**개발 환경**:
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' blob: 'unsafe-eval';
  img-src 'self' data: blob: https://*.example.com;
  font-src 'self' data: blob: https://*.example.com;
  media-src 'self' blob: https://*.example.com;
  connect-src 'self' https://*.example.com;
">
```

**프로덕션 환경**:
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' blob:;
  img-src 'self' data: blob: https://trusted-cdn.com;
  font-src 'self' data: blob: https://trusted-cdn.com;
  media-src 'self' blob: https://trusted-cdn.com;
  connect-src 'self' https://api.trusted-service.com;
">
```

### 무결성 검증

```typescript
class IntegrityValidator {
  async verifyAsset(url: string, expectedHash: string): Promise<boolean> {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    
    // SHA-384 해시 계산
    const hashBuffer = await crypto.subtle.digest('SHA-384', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashBase64 = btoa(String.fromCharCode(...hashArray));
    
    return `sha384-${hashBase64}` === expectedHash;
  }
  
  async verifySignature(data: string, signature: string, publicKey: string): Promise<boolean> {
    // Ed25519 서명 검증 (선택적)
    const key = await crypto.subtle.importKey(
      'raw',
      this.base64ToArrayBuffer(publicKey),
      { name: 'Ed25519' },
      false,
      ['verify']
    );
    
    return await crypto.subtle.verify(
      'Ed25519',
      key,
      this.base64ToArrayBuffer(signature),
      new TextEncoder().encode(data)
    );
  }
}
```

### 에러 격리

```javascript
// 렌더러의 플러그인 에러 처리
class PluginRuntime {
  async executePlugin(plugin, element, options, ctx) {
    try {
      return await plugin.animate(element, options, ctx);
    } catch (error) {
      console.error(`Plugin ${plugin.name} failed:`, error);
      
      // 플러그인 자체 에러 핸들러 호출
      if (plugin.onError) {
        plugin.onError(error, 'animate');
      }
      
      // 폴백 애니메이션 반환
      return this.createFallbackAnimation();
    }
  }
  
  createFallbackAnimation() {
    return (progress) => {
      // 최소한의 안전한 애니메이션
      return { opacity: progress };
    };
  }
}
```

---

## 🔧 개발 도구 지원

### Schema 기반 편집기 통합

```json
{
  "schema": {
    "effect_type": {
      "type": "string",
      "enum": ["fade", "slide", "zoom", "rotate"],
      "default": "fade",
      "ui": {
        "control": "select",
        "group": "animation",
        "order": 1
      },
      "i18n": {
        "label": { "en": "Effect Type", "ko": "효과 유형" },
        "options": {
          "fade": { "en": "Fade", "ko": "페이드" },
          "slide": { "en": "Slide", "ko": "슬라이드" },
          "zoom": { "en": "Zoom", "ko": "확대/축소" },
          "rotate": { "en": "Rotate", "ko": "회전" }
        }
      }
    },
    "color_primary": {
      "type": "string",
      "default": "define.brand_colors.primary",
      "ui": {
        "control": "color",
        "allowDefine": true,
        "group": "appearance",
        "order": 2
      }
    },
    "enable_particles": {
      "type": "boolean",
      "default": false,
      "dependencies": {
        "particle_count": { "when": true },
        "particle_size": { "when": true }
      }
    }
  }
}
```

### TypeScript 선언 파일

```typescript
// plugins.d.ts
declare module 'motiontext-plugin-*' {
  export interface PluginOptions {
    [key: string]: any;
  }
  
  export interface PluginModule {
    name: string;
    version: string;
    init?: (el: HTMLElement, options: PluginOptions, ctx: PluginContext) => void | Promise<void>;
    animate: (el: HTMLElement, options: PluginOptions, ctx: PluginContext, duration: number) => TimelineLike | SeekApplier;
    cleanup?: (el: HTMLElement) => void | Promise<void>;
    schema?: Record<string, SchemaField>;
    onError?: (error: Error, context: string) => void;
  }
  
  const plugin: PluginModule;
  export default plugin;
}
```

### 디버깅 지원

```javascript
export default {
  name: "debug-enhanced-plugin",
  version: "1.0.0",
  
  animate(el, options, ctx, duration) {
    // 디버그 정보 제공
    if (ctx.renderer.debug) {
      console.group(`[${this.name}] Animation Start`);
      console.log('Element:', el);
      console.log('Options:', options);
      console.log('Duration:', duration);
      console.groupEnd();
    }
    
    const startTime = performance.now();
    
    return (progress) => {
      // 성능 모니터링
      if (ctx.renderer.debug && progress === 1) {
        const endTime = performance.now();
        console.log(`[${this.name}] Animation completed in ${endTime - startTime}ms`);
      }
      
      // 채널 디버그 정보
      if (ctx.channels?.debug) {
        ctx.channels.debug('tx', progress * 100);
        ctx.channels.debug('opacity', progress);
      }
    };
  }
};
```

---

## 🔄 마이그레이션 가이드

### v2.1 → v3.0 변경 사항

#### 1. Manifest 업데이트

**v2.1**:
```json
{
  "pluginApi": "2.1",
  "targets": ["text"],
  "capabilities": ["style-vars"]
}
```

**v3.0**:
```json
{
  "pluginApi": "3.0",
  "minRenderer": "2.0.0",
  "targets": ["text"],
  "capabilities": ["style-vars"],
  "lazyLoad": ["assets/heavy-texture.png"],
  "schema": {
    "color": {
      "default": "define.brand_colors.primary"
    }
  }
}
```

#### 2. Define 시스템 활용

**v2.1**:
```javascript
animate(el, options, ctx, duration) {
  const color = options.color || '#ffffff';
  // ...
}
```

**v3.0**:
```javascript
animate(el, options, ctx, duration) {
  // Define 참조 자동 해석
  const color = ctx.scenario.resolveDefine(options.color || '#ffffff');
  // ...
}
```

#### 3. 에셋 API 업데이트

**v2.1**:
```javascript
init(el, options, ctx) {
  const url = ctx.assets.getUrl('texture.png');
}
```

**v3.0**:
```javascript
async init(el, options, ctx) {
  // 지연 로딩 지원
  const blob = await ctx.assets.loadAsset('texture.png');
  const url = URL.createObjectURL(blob);
  
  // 타입 확인
  if (ctx.assets.getAssetType('texture.png') === 'image') {
    // 이미지 처리
  }
}
```

#### 4. 오디오 지원 추가

```javascript
// v3.0 신규 기능
export default {
  init(el, options, ctx) {
    if (ctx.audio && options.enableSound) {
      ctx.audio.play('assets/effect.mp3', {
        volume: 0.5,
        loop: false
      });
    }
  },
  
  animate(el, options, ctx, duration) {
    return (progress) => {
      if (ctx.audio) {
        // 진행도에 따른 볼륨 조절
        ctx.audio.setVolume('assets/effect.mp3', progress * 0.8);
      }
    };
  }
};
```

---

## 📝 완전한 예제

### 고급 텍스트 효과 플러그인

```json
// manifest.json
{
  "name": "advanced-text-fx",
  "version": "2.0.0", 
  "pluginApi": "3.0",
  "minRenderer": "2.0.0",
  "entry": "index.mjs",
  "targets": ["text", "group"],
  "capabilities": [
    "style-vars",
    "dom-manipulation", 
    "asset-loading",
    "audio-playback"
  ],
  "preload": [
    "assets/glow-font.woff2"
  ],
  "lazyLoad": [
    "assets/particles.png",
    "assets/whoosh.mp3"
  ],
  "schema": {
    "effect": {
      "type": "string",
      "enum": ["glow", "particles", "typewriter"],
      "default": "glow"
    },
    "color": {
      "type": "string",
      "default": "define.brand_colors.accent"
    },
    "intensity": {
      "type": "number",
      "default": 1.0,
      "min": 0.1,
      "max": 3.0
    },
    "enableSound": {
      "type": "boolean", 
      "default": false
    }
  }
}
```

```javascript
// index.mjs
export default {
  name: "advanced-text-fx",
  version: "2.0.0",
  
  async init(el, options, ctx) {
    // Define 색상 해석
    this.effectColor = ctx.scenario.resolveDefine(options.color);
    
    // 글로우 폰트 적용
    const glowFont = ctx.scenario.resolveDefine("define.glow_font");
    if (glowFont?.type === 'font') {
      el.style.fontFamily = glowFont.family;
    }
    
    // 효과별 초기화
    switch (options.effect) {
      case 'particles':
        await this.initParticles(el, ctx);
        break;
      case 'typewriter':
        this.initTypewriter(el, ctx);
        break;
    }
    
    // 사운드 준비
    if (options.enableSound && ctx.audio) {
      await ctx.assets.preloadAsset('assets/whoosh.mp3');
    }
  },
  
  animate(el, options, ctx, duration) {
    const intensity = options.intensity;
    
    return (progress) => {
      switch (options.effect) {
        case 'glow':
          this.animateGlow(el, progress, intensity, ctx);
          break;
        case 'particles':
          this.animateParticles(el, progress, intensity, ctx);
          break;
        case 'typewriter':
          this.animateTypewriter(el, progress, ctx);
          break;
      }
      
      // 사운드 트리거
      if (progress === 0.1 && options.enableSound && ctx.audio) {
        ctx.audio.play('assets/whoosh.mp3', { volume: intensity * 0.3 });
      }
    };
  },
  
  animateGlow(el, progress, intensity, ctx) {
    const glowSize = Math.sin(progress * Math.PI) * 20 * intensity;
    const opacity = Math.min(progress * 2, 1);
    
    // CSS 변수 채널 사용
    ctx.channels?.set('filter', 
      `drop-shadow(0 0 ${glowSize}px ${this.effectColor})`, 'replace');
    ctx.channels?.set('opacity', opacity, 'multiply');
  },
  
  async initParticles(el, ctx) {
    // 파티클 텍스처 로드
    const textureBlob = await ctx.assets.loadAsset('assets/particles.png');
    this.particleTexture = URL.createObjectURL(textureBlob);
    
    // 파티클 컨테이너 생성
    this.particleContainer = document.createElement('div');
    this.particleContainer.className = 'particles';
    this.particleContainer.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      background-image: url(${this.particleTexture});
    `;
    
    el.appendChild(this.particleContainer);
  },
  
  animateParticles(el, progress, intensity, ctx) {
    if (!this.particleContainer) return;
    
    const density = progress * intensity * 100;
    const spread = Math.sin(progress * Math.PI) * 50;
    
    this.particleContainer.style.opacity = progress;
    this.particleContainer.style.transform = `scale(${1 + spread * 0.01})`;
    
    // 사용자 정의 채널로 파티클 밀도 제어
    ctx.channels?.set('plugin-particles-density', density, 'replace');
  },
  
  initTypewriter(el, ctx) {
    this.originalText = el.textContent;
    this.textLength = this.originalText.length;
  },
  
  animateTypewriter(el, progress, ctx) {
    const visibleChars = Math.floor(progress * this.textLength);
    el.textContent = this.originalText.slice(0, visibleChars);
    
    // 커서 효과
    if (progress < 1 && Math.floor(Date.now() / 500) % 2) {
      el.textContent += '|';
    }
  },
  
  cleanup(el) {
    // 생성된 URL 해제
    if (this.particleTexture) {
      URL.revokeObjectURL(this.particleTexture);
    }
    
    // DOM 정리
    if (this.particleContainer) {
      this.particleContainer.remove();
    }
    
    // 원본 텍스트 복원
    if (this.originalText) {
      el.textContent = this.originalText;
    }
  }
};
```

---

## 🔮 향후 확장 계획

### v3.1 예정 기능

- **WebGL 지원**: GPU 가속 효과를 위한 WebGL 컨텍스트 제공
- **WebRTC 연동**: 실시간 스트리밍 오버레이 지원  
- **AI/ML 통합**: TensorFlow.js를 통한 실시간 효과 생성
- **VR/AR 호환**: 3D 변환 및 공간 오디오 지원

### 성능 목표

- **로딩 시간**: 플러그인 로딩 < 100ms (캐시 적중 시)
- **렌더링 성능**: 60fps 유지 (모바일 포함)
- **메모리 사용량**: 플러그인당 < 50MB
- **배터리 효율**: 모바일 디바이스에서 최적화된 전력 사용

---

*이 문서는 MotionText Renderer v2.0과 함께 사용되는 Plugin API v3.0의 완전한 명세서입니다. 시나리오 JSON에 대한 자세한 내용은 [Scenario JSON v2.0 Specification](./scenario-json-spec-v-2-0.md)을 참조하세요.*