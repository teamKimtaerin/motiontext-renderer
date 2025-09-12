# 플러그인 시스템 아키텍처 v2.1 ⚠️ 레거시

**⚠️ 중요 알림**: 이 문서는 v2.1 레거시 스펙입니다. **v3.0 최신 스펙을 사용하세요**: [`context/plugin-system-architecture-v-3-0.md`](./plugin-system-architecture-v-3-0.md)

**v3.0 주요 개선사항:**
- 시나리오 v2.0과 완전 호환성 (Define 시스템, 노드 ID 지원)
- 확장된 7가지 권한 시스템 (style-vars, portal-breakout, dom-manipulation 등)
- 에셋 관리 통합 (font/image/video/audio + integrity)
- 향상된 플러그인 컨텍스트 (scenario, channels, audio, asset APIs)
- 마이그레이션 자동화 도구 포함

---

# 플러그인 시스템 아키텍처 v2.1 (레거시)

동적 로딩, 무결성(후속), 에셋 관리, 샌드박싱을 유지하면서 텍스트/이미지/비디오 등 다양한 요소를 독립적으로 확장할 수 있도록 v2를 보완한 스펙입니다. v2.1은 “렌더러 독립성 + 플러그인 확장성”을 강하게 보장하기 위해 DOM 경계, 타임라인 계약, 에셋 규약을 명확히 합니다.

---

## 🆚 v2 → v2.1 변경 핵심
- 표준 DOM 래퍼 구조 도입: `baseWrapper`(호스트 전용) → `effectsRoot`(플러그인 전용)
- 대상/권한 명세 강화: `targets`(text/image/video/group/stage) + `capabilities`(portal-breakout/channels-eval/style-vars)
- 채널 합성과의 공존 규칙: transform/opacity는 호스트 채널 전용, 플러그인은 자신의 `effectsRoot`만 조작
- CSS 변수 채널(옵션): `--mtx-sx/ty/sx/sy/rot/opacity`로 합성 충돌 방지 경로 제공
- 에셋 규약: `ctx.assets.getUrl()`, preload 범주(image/video/font), FontFace 등록/해제, 캐시 키 명세
- 타임라인 불변식: 내부 타이머 금지, 재진입/역주행/점프 안전, host‑driven progress 보장
- 버전 명시: `pluginApi:"2.1"` 추가, `minRenderer`와 분리

---

## 🎯 핵심 개념
- 동적 로딩: ES Dynamic Import + Blob URL (M7에서 무결성/서명 검증 추가)
- 샌드박스: 플러그인은 `effectsRoot` 하위만 조작, 컨테이너 밖 접근 금지
- 타임라인 계약: animate는 상대 타임라인/SeekApplier만 제공, 진행은 호스트가 강제
- 플러그인 체인: relStart/relEnd/pct 창(window), last‑wins/compose(add/multiply/replace)

---

## 📦 패키지/매니페스트

```
plugins/
  flames@1.0.0/
    manifest.json
    index.mjs
    assets/
      flame.gif
      fire.woff2
```

manifest.json (v2.1 예시)
```json
{
  "name": "flames",
  "version": "1.0.0",
  "pluginApi": "2.1",
  "minRenderer": "1.3.0",
  "entry": "index.mjs",
  "targets": ["text", "image"],
  "capabilities": ["portal-breakout", "style-vars"],
  "peer": { "gsap": "^3.12.0" },
  "preload": ["assets/flame.gif", "assets/fire.woff2"],
  "integrity": {
    "entry": "sha384-…",
    "assets": {
      "assets/flame.gif": "sha384-…",
      "assets/fire.woff2": "sha384-…"
    },
    "signature": "base64(ed25519_signature)"   
  },
  "schema": {
    "intensity": { "type": "number", "default": 1, "min": 0, "max": 5 }
  }
}
```

필드 보충
- pluginApi: 플러그인 런타임 API 세대. 렌더러 버전과 독립 관리.
- targets: 플러그인이 적용 가능한 노드 유형 선언 ["text"|"image"|"video"|"group"|"stage"].
- capabilities:
  - "portal-breakout": PortalManager 사용 허용
  - "channels-eval": (Dev/경량) 채널 기반 합성 경로 제공
  - "style-vars": CSS 변수 채널을 통한 합성(권장)
- integrity: M7에서 검증. Dev 단계에서는 생략 가능.

---

## 🔌 런타임 인터페이스(contract)

```ts
export interface PluginContext {
  container: HTMLElement;               // effectsRoot (플러그인 전용 DOM 루트)
  assets: { getUrl: (path: string) => string };
  portal?: unknown;                     // PortalManager 핸들(권한 필요)
  onSeek?: (fn: (p: number) => void) => void;
  timeScale?: number;
  gsap?: any;                           // peer로 제공
}

export interface PluginRuntimeModule {
  name: string;
  version: string;
  init?: (el: HTMLElement, options: any, ctx: PluginContext) => void;
  animate: (
    el: HTMLElement,
    options: any,
    ctx: PluginContext,
    duration: number
  ) => TimelineLike | SeekApplier;      // 상대 타임라인 또는 순수 seek 함수형
  cleanup?: (el: HTMLElement) => void;
  schema?: Record<string, unknown>;
}
```

불변식
- Host‑driven: 진행은 전적으로 호스트가 강제. 플러그인은 자체 타이머(rAF/setTimeout)로 독자 주행하지 않음.
- Reentrant: progress는 0..1 어디로든 점프/역주행 가능, 언제든 반영.
- Scoped DOM: `container`(=effectsRoot) 하위만 조작, 상위/baseWrapper 변경 금지.
- Optional dev path: `export function evalChannels(spec, p, ctx)` (capabilities:"channels-eval" 시)

---

## 🧱 DOM 경계(Wrapper)와 합성 규칙

- 호스트 래퍼 구조(표준):
  - baseWrapper: 레이아웃/앵커/세이프에어리어/호스트 채널(transform/opacity) 전용
  - effectsRoot: 플러그인이 mount되는 전용 루트 (PortalManager가 이동/복귀 관리)
- 금지 규칙: 플러그인은 baseWrapper의 `transform/opacity`에 직접 관여하지 않음.
- 채널 합성(HOST): tx/ty/sx/sy/rot/opacity는 호스트가 `composeActive()`로 계산 후 baseWrapper에 적용.
- CSS 변수 채널(옵션):
  - 예약 변수: `--mtx-sx`, `--mtx-sy`, `--mtx-tx`, `--mtx-ty`, `--mtx-rot`, `--mtx-opacity`
  - baseWrapper transform은 CSS var로 구성하고, 플러그인은 style-vars 권한이 있을 때 해당 변수를 애니메이션 가능(충돌 최소화)

---

## 🖼 에셋 규약(assets/)

- URL 해석: `ctx.assets.getUrl(relPath)`는 manifest URL 기준 상대경로를 절대 URL로 반환.
- preload 범주: `image`/`video`/`font`
  - image/video: 일반 fetch (M7: 무결성 검증 후 캐시)
  - font: `new FontFace(name, url)` → `document.fonts.add()` 등록, dispose 시 해제 권장
- 캐시 키: `plugin@version + path (+ integrity)`
- 실패 폴백: asset fetch 실패 시 플러그인은 자체 비주얼을 비활성/완만 degrade, 호스트는 렌더링을 지속

---

## 🔒 샌드박스/포털(PortalManager)

- breakout: `{ mode: "portal"|"lift", toLayer?, coordSpace?:"group"|"stage", return:"end"|"manual", transfer:"move"|"clone" }`
- 권장 기본: `portal` + `transfer:"move"`
- 좌표 변환: coordSpace에 따라 위치·스케일 보정
- 복귀: `return:"end"` 시 absEnd에서 자동 복귀, `manual`은 플러그인이 명시
- 포인터/클리핑: stage 레이어에서의 pointerEvents/clip 규칙은 호스트가 고정

---

## ⚡ 최적화 전략

- 프리로딩: manifest의 `preload`만 우선 로딩(폰트/스프라이트 등)
- 선택적 로딩: 실제 시나리오에서 사용된 플러그인만 로딩
- 백그라운드 프리페치: 우선순위 낮은 플러그인은 유휴 시점에 점진 로드
- 캐싱: 버전별 불변 키(`plugin@version`)와 LRU 메모리 관리, 로컬 스토리지/IndexedDB 사용 가능
- 자산 최적화: GIF 지양, 스프라이트/비디오/애니메이션 SVG 권장, 폰트는 FontFace preload

---

## 🛡 보안/CSP

- Dev: CORS `*`, script-src에 `blob:` 허용 필요, img-src/font-src 적절히 열기
- Prod(M7): integrity 검증 성공 후에만 Blob import 허용, origin 정책/캐시 불변성 준수

---

## 🚦 에러/폴백/격리

- init/animate 오류는 해당 플러그인 인스턴스만 격리/폴백, 전체 렌더링은 지속
- cleanup는 멱등해야 하며, dispose 타임아웃/가드 권장
- 로더/실행 로그는 플러그인별 범주로 구분 가능하도록 제공

---

## ⚡ 성능/메모리 가드(권장)

- 인스턴스당 DOM/타임라인/리스너 상한 권고치, 초과 시 경고 로깅
- 에셋/폰트 참조 카운팅 기반 해제

---

## 🔢 버전/호환성

- pluginApi: "2.1" 등 세대 표기, 렌더러는 지원 범위를 비교해 호환성 판단
- minRenderer: semver 범위로 명시(예: ">=1.3.0")
- peer: 안 맞으면 경고 또는 차단(정책 선택), degrade 경로 문서화

---

## 🧪 예시 코드

manifest.json (간단)
```json
{
  "name": "bobY",
  "version": "1.0.0",
  "pluginApi": "2.1",
  "entry": "index.mjs",
  "targets": ["text"],
  "capabilities": ["channels-eval"],
  "preload": []
}
```

index.mjs (default + evalChannels 병행)
```js
export default {
  name: "bobY",
  version: "1.0.0",
  init(el, opts, ctx) {
    // effectsRoot(el)에 초기 DOM 삽입 또는 클래스 적용 가능
  },
  animate(el, opts, ctx, duration) {
    // GSAP Timeline 또는 순수 seek 함수형 중 택1
    // Dev 단계에서는 간단히 seek 함수형으로 제공
    return (p) => {
      // p: 0..1 (상대 진행)
      // style-vars 권한이 있으면 CSS 변수를 조정해 합성과 충돌 최소화
      // el.style.setProperty('--mtx-ty', String(Math.sin(p * Math.PI * 2) * 10));
    };
  },
  cleanup(el) { /* detach, timers kill 등 */ }
};

export function evalChannels(spec, p, ctx) {
  const amp = (spec?.params?.amplitudePx ?? 8);
  const ty = Math.sin(p * Math.PI * 2) * amp;
  return { ty };
}
```

---

## 🔁 로딩 시퀀스(요약)

1) manifest fetch (Dev: 무결성 생략, Prod: 무결성/서명 검증)  
2) preload 자산 fetch(+검증) 및 등록(FontFace 등)  
3) entry fetch → Blob URL → dynamic import  
4) targets/capabilities 검사 → 컨텍스트(sandbox) 생성  
5) init → animate 획득 (또는 evalChannels)  
6) 진행은 렌더러가 강제(seek/tick), 포털/샌드박스 규칙 준수

---

## 🔧 마이그레이션 가이드(v2 → v2.1)

- DOM 경계 준수: baseWrapper transform/opacity는 호스트 채널 전용, 플러그인은 effectsRoot만 조작
- targets/capabilities 선언 추가: 적용 대상/권한 명시
- optional: CSS 변수 채널 사용(style-vars)로 합성 충돌 리스크 최소화
- 에셋: getUrl 사용, FontFace 등록/해제 경로 준수, preload를 manifest에 명시
- pluginApi 필드 추가("2.1")

---

본 문서는 Dev 단계의 빠른 반복을 지원하면서도, 이후 M7(무결성/서명/캐시)로 자연스럽게 수렴하는 안전하고 확장 가능한 플러그인 실행 모델을 규정합니다.

---

## 📝 파라미터 스키마 확장(편집기 연동)

- 유효성: min/max, enum, dependency, required
- UI 메타: control(slider/select/color), step, unit, group/collapsible
- i18n 라벨/설명: 다국어 키 지원(예: `i18n.ko.description`)
- 에디터 자동화: 스키마 기반으로 UI 생성 및 검증 자동화
