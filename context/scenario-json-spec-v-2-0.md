# MotionText Renderer — Scenario JSON v2.0 Specification

이 문서는 MotionText Renderer v2.0의 시나리오(JSON) 스펙을 정의합니다.

## 🆕 v2.0 주요 변경사항

### Breaking Changes
- **필드명 변경**: `hintTime` → `domLifetime`, `absStart/absEnd` → `displayTime`, `relStart/relEnd` → `timeOffset`
- **시간 표현 통일**: 모든 시간은 `[start, end]` 배열 형태로 통일
- **timeOffset 철학 변경 (중요)**:
  - `timeOffset`은 이제 노드의 `displayTime`과 독립적인 기준인 `baseTime`을 사용합니다.
  - 오프셋 요소는 두 가지 표기만 허용합니다: 절대 초(number; 음수 허용) 또는 퍼센트 문자열(`"50%"`).
  - 퍼센트(`%`)는 `baseTime` 길이에 대한 비율입니다. `baseTime`이 없으면 노드의 `displayTime`을 기준으로 사용합니다.
  - 숫자는 초 단위 절대 오프셋으로 해석됩니다(기준은 `baseTime` 시작 시각).
- **노드 ID 의무화**: 모든 노드에 `id` 필드 필수
- **Define 시스템**: 중복 제거 및 에셋 관리를 위한 변수 시스템 도입
- **상속 시스템**: 체계적인 값 우선순위 및 상속 규칙 정립

### 플러그인 API 호환성
- **Plugin API v3.0**: DOM 분리 구조 기반 새로운 플러그인 인터페이스
- **채널 충돌 방지**: baseWrapper/effectsRoot DOM 분리로 안전한 플러그인 실행
- **권한 기반 시스템**: capabilities와 targets를 통한 세밀한 권한 제어

### 레이아웃 시스템 철학 (New in v2.0)
- **Track as Policy Provider**: Track이 high-level 레이아웃 정책 제공
- **Flutter-like Constraints**: Parent-child 간 크기 협상 메커니즘
- **Portal/Breakout**: 제약을 벗어나는 동적 효과 지원
- **상속과 오버라이드**: 계층적 레이아웃 규칙과 명시적 오버라이드 공존

---

## 📋 Top-level Schema

```json
{
  "version": "2.0",
  "pluginApiVersion": "3.0",
  "timebase": {
    "unit": "seconds",
    "fps": 30
  },
  "stage": {
    "baseAspect": "16:9"
  },
  "define": {
    // 변수 정의 섹션 (신규)
  },
  "tracks": [
    // Track 정의들
  ],
  "cues": [
    // Cue 정의들
  ]
}
```

### Fields

#### `version` (string, required)
시나리오 스펙 버전. v2.0에서는 `"2.0"` 고정값.

#### `pluginApiVersion` (string, required)
사용할 플러그인 API 버전. v2.0에서는 `"3.0"` 권장.

#### `timebase` (object, required)
시간 단위 및 프레임률 정의.

```json
{
  "unit": "seconds",
  "fps": 30
}
```

- `unit`: 항상 `"seconds"`
- `fps`: (선택) 프레임률. snapToFrame 기능에서 사용.

#### `stage` (object, required)
렌더링 스테이지(영상 콘텐츠 박스) 정의.

```json
{
  "baseAspect": "16:9"
}
```

- `baseAspect`: 기본 종횡비 (`"16:9"`, `"9:16"`, `"auto"`)

#### `define` (object, optional)
재사용 가능한 변수들을 정의하는 섹션. 중복 제거 및 에셋 관리에 사용.

```json
{
  "define": {
    "brand_color": "#ff6b35",
    "caption_style": {
      "boxBg": "rgba(0,0,0,0.9)",
      "border": {
        "radiusRel": 0.0125
      }
    },
    "main_font": {
      "type": "font",
      "family": "BrandFont",
      "src": "assets/brand.woff2",
      "preload": true,
      "integrity": "sha384-abc123...",
      "fallback": ["Arial", "sans-serif"]
    },
    "common_timing": [2.0, 5.0],
    "fade_effect": {
      "name": "fadeIn",
      "timeOffset": ["0%", "50%"],
      "params": { "startOpacity": 0.0 }
    }
  }
}
```

**에셋 타입**:
- `font`: 폰트 에셋 (자동 FontFace 등록)
- `image`: 이미지 에셋 
- `video`: 비디오 에셋
- `audio`: 오디오 에셋

**참조 방법**: `"define.키명"` 형태로 참조
```json
{
  "style": {
    "color": "define.brand_color",
    "boxBg": "define.caption_style.boxBg"
  },
  "displayTime": "define.common_timing",
  "pluginChain": ["define.fade_effect"]
}
```

#### `tracks` (array, required)
트랙 정의들의 배열.

#### `cues` (array, required)
큐 정의들의 배열.

---

## 🎭 Track

트랙은 역할별 레이어, 기본 스타일, 그리고 **레이아웃 제약조건(Layout Constraints)**을 정의합니다. v2.0에서는 Flutter-like constraints 시스템을 도입하여 parent-child 간 layout negotiation을 지원합니다.

```json
{
  "id": "subtitle",
  "type": "subtitle",
  "layer": 10,
  "overlapPolicy": "push",
  "defaultStyle": {
    "fontSizeRel": 0.05,
    "color": "define.brand_color"
  },
  "defaultConstraints": {
    "mode": "flow",
    "direction": "vertical",
    "maxWidth": 0.8,
    "anchor": "bc",
    "gap": 0.02,
    "constraintMode": "flexible",
    "breakoutEnabled": false,
    "safeArea": { "bottom": 0.1, "left": 0.05, "right": 0.05 }
  }
}
```

### Fields

#### `id` (string, required)
트랙의 고유 식별자.

#### `type` (string, required)
트랙 타입:
- `"subtitle"`: 자막용 트랙 (세이프 에어리어, 기본 폰트 적용)
- `"free"`: 자유 배치용 트랙 (스티커, 효과 등)

#### `layer` (number, required)
트랙의 z-index 레이어. 높을수록 앞쪽에 표시.

#### `overlapPolicy` (string, optional)
겹침 처리 정책:
- `"push"`: 겹치는 요소를 밀어냄 (기본값)
- `"stack"`: 겹쳐서 표시
- `"ignore"`: 겹침 무시

#### `defaultStyle` (object, optional)
이 트랙의 모든 요소에 적용될 기본 스타일. Style 객체 규격 따름.

#### `defaultConstraints` (object, optional)
이 트랙의 모든 요소에 적용될 기본 레이아웃 제약조건. LayoutConstraints 객체 규격 따름.

**트랙별 기본 제약조건**:

**Subtitle Track** (자막 전용):
```json
{
  "mode": "flow",
  "direction": "vertical", 
  "maxWidth": 0.8,
  "maxHeight": 0.4,
  "gap": 0.02,
  "anchor": "bc",
  "constraintMode": "flexible",
  "breakoutEnabled": false,
  "safeArea": { "bottom": 0.1, "left": 0.05, "right": 0.05 }
}
```

**Free Track** (자유 배치):
```json
{
  "mode": "absolute",
  "maxWidth": 1.0,
  "maxHeight": 1.0,
  "anchor": "cc", 
  "constraintMode": "breakout",
  "breakoutEnabled": true
}
```

---

## 🎬 Cue

큐는 시간 기반 컨텐츠 그룹을 정의합니다.

```json
{
  "id": "caption_001",
  "track": "subtitle",
  "domLifetime": [1.8, 8.2],
  "root": {
    // Node 정의
  }
}
```

### Fields

#### `id` (string, required)
큐의 고유 식별자.

#### `track` (string, required)
이 큐가 속할 트랙의 ID.

#### `domLifetime` (array, optional)
큐의 DOM 요소 생성/삭제 시점 `[start, end]`.

**자동 계산**: 생략 시 자동으로 계산됩니다.
```typescript
function calculateDomLifetime(cue: Cue): [number, number] {
  const childDisplayTimes = getAllChildDisplayTimes(cue.root);
  const pluginStartTimes = getAllPluginStartTimes(cue.root);
  
  // 시작: min(자식 displayTime 최소값, 플러그인 시작 시간 최소값)
  const minStart = Math.min(
    Math.min(...childDisplayTimes.map(t => t[0])),
    Math.min(...pluginStartTimes)
  );
  
  // 종료: 자식 displayTime 최대값
  const maxEnd = Math.max(...childDisplayTimes.map(t => t[1]));
  
  return [minStart, maxEnd];
}
```

**동작**:
- `domLifetime[0] - preloadMs` = DOM 생성 시작
- `domLifetime[1] + disposeMs` = DOM 해제 시작

#### `root` (Node, required)
큐의 루트 노드. Group 타입이어야 합니다.

---

## 🌳 Node

노드는 렌더링 트리의 기본 단위입니다. 모든 노드는 고유한 ID를 가져야 합니다.

### 공통 Fields

#### `id` (string, required)
노드의 고유 식별자. 편집 도구에서 노드 식별에 사용.

#### `eType` (string, required)
노드 타입:
- `"group"`: 그룹 노드 (자식 노드들의 컨테이너)
- `"text"`: 텍스트 노드
- `"image"`: 이미지 노드
- `"video"`: 비디오 노드

#### `displayTime` (array, optional)
노드가 화면에 표시될 시간 구간 `[start, end]`.

**상속 규칙**: 생략 시 부모 노드의 `displayTime`을 상속받습니다.

**상대값 지원**: `%` 접미사로 부모 구간 대비 상대값 표현 가능.
```json
{
  "displayTime": ["50%", "100%"]  // 부모 구간의 50%~100% 지점
}
```

#### `layout` (Layout, optional)
레이아웃 설정. 생략 시 부모로부터 상속.

#### `style` (Style, optional)
스타일 설정. 생략 시 부모 및 트랙 기본값으로부터 상속.

#### `pluginChain` (array, optional)
적용할 플러그인들의 체인.

#### `effectScope` (EffectScope, optional)
특수 효과 범위 및 breakout 설정.

---

### Group Node

그룹 노드는 자식 노드들의 컨테이너 역할을 합니다.

```json
{
  "id": "main_caption",
  "eType": "group",
  "displayTime": [0.0, 5.0],
  "layout": {
    "position": { "x": 0.5, "y": 0.9 },
    "anchor": "bc"
  },
  "style": {
    "boxBg": "define.caption_style.boxBg",
    "border": "define.caption_style.border"
  },
  "children": [
    {
      "id": "word_1",
      "eType": "text",
      "text": "안녕하세요"
      // displayTime 생략 → [0.0, 5.0] 상속
      // style 상속받음
    },
    {
      "id": "word_2",
      "eType": "text",
      "text": "반갑습니다",
      "displayTime": [1.0, 3.0], // 명시적 지정
      "style": {
        "color": "#ff0000" // color만 오버라이드
      }
    }
  ]
}
```

#### Additional Fields

##### `children` (array, optional)
자식 노드들의 배열.

---

### Text Node

텍스트를 렌더링하는 노드입니다.

```json
{
  "id": "greeting_text",
  "eType": "text",
  "text": "안녕하세요!",
  "displayTime": [1.0, 3.0],
  "pluginChain": [
    {
      "name": "fadeIn",
      "timeOffset": ["0%", "50%"],
      "params": { "startOpacity": 0.0 }
    }
  ]
}
```

#### Additional Fields

##### `text` (string, required)
표시할 텍스트 내용.

---

### Image Node

이미지를 렌더링하는 노드입니다.

```json
{
  "id": "logo_image",
  "eType": "image",
  "src": "define.company_logo",
  "displayTime": [2.0, 8.0],
  "layout": {
    "size": { "width": "200px", "height": "auto" }
  }
}
```

#### Additional Fields

##### `src` (string, required)
이미지 소스. 직접 URL이거나 `define` 참조.

##### `alt` (string, optional)
대체 텍스트.

---

### Video Node

비디오를 렌더링하는 노드입니다.

```json
{
  "id": "intro_video",
  "eType": "video",
  "src": "define.intro_clip",
  "displayTime": [0.0, 10.0],
  "autoplay": true,
  "muted": true
}
```

#### Additional Fields

##### `src` (string, required)
비디오 소스. 직접 URL이거나 `define` 참조.

##### `autoplay` (boolean, optional)
자동 재생 여부. 기본값 `false`.

##### `muted` (boolean, optional)
음소거 여부. 기본값 `false`.

##### `loop` (boolean, optional)
반복 재생 여부. 기본값 `false`.

---

## 🎨 Layout & Constraints System

v2.0에서는 Flutter-like constraints 시스템을 도입하여 다음과 같은 계층적 레이아웃을 지원합니다:

### 레이아웃 시스템 아키텍처

```
Track (High-level Policy)
  ↓ defaultConstraints 제공
Group Layout (Mid-level Container)
  ↓ constraints negotiation
Child Layouts (Low-level Elements)
  ↓ portal/breakout (필요시)
Stage/Layer (Escape mechanism)
```

### 레이아웃 정의

레이아웃은 노드의 위치, 크기, 변환, 그리고 자식 요소들에 대한 제약조건을 정의합니다.

```json
{
  "layout": {
    "position": { "x": 0.5, "y": 0.9 },
    "size": { "width": "80%", "height": "auto" },
    "anchor": "bc",
    "transform": {
      "rotate": 15,
      "scale": { "x": 1.2, "y": 1.0 }
    },
    "overflow": "hidden",
    "transformOrigin": "center",
    "override": {
      "zIndex": 100
    }
  }
}
```

### Fields

#### `position` (object, optional)
정규화된 좌표계 (0~1) 기준 위치.

```json
{
  "x": 0.5,  // 중앙 (50%)
  "y": 0.9   // 하단 근처 (90%)
}
```

**상대값 지원**: 문자열로 `%`, `px` 단위 지원.
```json
{
  "x": "50%",
  "y": "100px"
}
```

#### `size` (object, optional)
크기 설정.

```json
{
  "width": "80%",    // 부모의 80%
  "height": "auto",  // 자동 (종횡비 유지)
  "maxWidth": "500px",
  "maxHeight": "300px"
}
```

#### `anchor` (string, optional)
앵커 포인트:
- `"tl"`, `"tc"`, `"tr"` (상단 좌/중/우)
- `"cl"`, `"cc"`, `"cr"` (중앙 좌/중/우)
- `"bl"`, `"bc"`, `"br"` (하단 좌/중/우)

기본값: `"cc"` (중앙)

#### `transform` (object, optional)
변환 설정.

```json
{
  "rotate": 15,           // 회전 (도)
  "scale": {              // 스케일
    "x": 1.2,
    "y": 1.0
  },
  "skew": {               // 기울이기 (도)
    "x": 5,
    "y": 0
  },
  "translate": {          // 이동
    "x": "10px",
    "y": "-5px"
  }
}
```

#### `overflow` (string, optional)
오버플로우 처리:
- `"visible"`: 보임 (기본값)
- `"hidden"`: 숨김
- `"scroll"`: 스크롤

#### `transformOrigin` (string, optional)
변환 기준점:
- `"center"`: 중앙 (기본값)
- `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`
- 좌표값: `"50% 50%"`, `"10px 20px"`

#### `override` (object, optional)
CSS 속성 직접 오버라이드.

```json
{
  "override": {
    "zIndex": 100,
    "filter": "blur(2px)",
    "mixBlendMode": "multiply"
  }
}
```

---

## 🏗 Layout Constraints (New in v2.0)

Layout Constraints는 Flutter-like 레이아웃 시스템의 핵심으로, parent-child 간 크기 협상과 breakout 메커니즘을 지원합니다.

```json
{
  "defaultConstraints": {
    "mode": "flow",
    "direction": "vertical",
    "maxWidth": 0.8,
    "maxHeight": 0.4,
    "minWidth": 0.1,
    "minHeight": 0.05,
    "gap": 0.02,
    "padding": { "x": 0.02, "y": 0.015 },
    "anchor": "bc",
    "constraintMode": "flexible",
    "breakoutEnabled": false,
    "safeArea": { "bottom": 0.1, "left": 0.05, "right": 0.05 }
  }
}
```

### Fields

#### `mode` (string, optional)
레이아웃 모드:
- `"flow"`: 수직/수평 플로우 레이아웃 (자막에 적합)
- `"grid"`: 그리드 레이아웃 (복수 요소 정렬)
- `"absolute"`: 절대 위치 레이아웃 (자유 배치)

#### `direction` (string, optional)
플로우 방향 (mode가 "flow"일 때):
- `"vertical"`: 세로 배치 (기본값)
- `"horizontal"`: 가로 배치

#### `maxWidth`, `maxHeight` (number, optional)
최대 크기 제한 (0~1 정규화값).

#### `minWidth`, `minHeight` (number, optional)
최소 크기 제한 (0~1 정규화값).

#### `gap` (number, optional)
자식 요소 간 간격 (0~1 정규화값).

#### `padding` (object, optional)
내부 여백:
```json
{ "x": 0.02, "y": 0.015 }
```

#### `anchor` (string, optional)
자식 요소들의 기본 앵커 포인트.

#### `constraintMode` (string, optional)
제약 모드:
- `"strict"`: 엄격한 제약 (자식이 부모 크기 초과 불가)
- `"flexible"`: 유연한 제약 (일부 초과 허용)
- `"breakout"`: breakout 허용 (portal 시스템 활용)

#### `breakoutEnabled` (boolean, optional)
자식 요소의 breakout 허용 여부.

#### `safeArea` (object, optional)
세이프 에어리어 설정:
```json
{ "top": 0.05, "bottom": 0.1, "left": 0.05, "right": 0.05 }
```

### Constraints 상속 시스템

```
1. Track defaultConstraints (기본 정책)
   ↓
2. Parent Layout constraints (컨테이너 제약)
   ↓ 
3. Node Layout (노드별 오버라이드)
   ↓
4. 실제 DOM 적용 (effective constraints)
```

### Breakout 시스템

특정 조건에서 자식 요소가 부모 constraints를 벗어날 수 있습니다:

```json
{
  "effectScope": {
    "breakout": {
      "mode": "portal",
      "toLayer": 1000,
      "coordSpace": "stage"
    }
  }
}
```

**동작 원리**:
1. 자식이 `constraintMode: "breakout"` 또는 `effectScope.breakout` 설정
2. 렌더러가 해당 요소를 target layer로 portal
3. 원래 좌표 공간 기준으로 위치 재계산
4. 효과 완료 후 원래 위치로 복귀 (선택적)

---

## 🎭 Style

스타일은 노드의 시각적 표현을 정의합니다.

```json
{
  "style": {
    "color": "define.brand_color",
    "fontFamily": "define.main_font",
    "fontSizeRel": 0.05,
    "fontWeight": 700,
    "textAlign": "center",
    "textShadow": "2px 2px 4px rgba(0,0,0,0.5)",
    "boxBg": "rgba(0,0,0,0.9)",
    "border": {
      "widthRel": 0.002,
      "color": "#ffffff",
      "radiusRel": 0.0125
    },
    "opacity": 1.0
  }
}
```

### Text Style Fields

#### `color` (string, optional)
텍스트 색상. CSS 색상값 또는 `define` 참조.

#### `fontFamily` (string, optional)
폰트 패밀리. CSS font-family 또는 `define` 참조.

#### `fontSizeRel` (number, optional)
상대적 폰트 크기 (스테이지 높이 대비).

#### `fontSize` (string, optional)
절대적 폰트 크기 (`"24px"`, `"1.5em"` 등).

#### `fontWeight` (number | string, optional)
폰트 굵기 (`400`, `700`, `"bold"` 등).

#### `fontStyle` (string, optional)
폰트 스타일 (`"normal"`, `"italic"` 등).

#### `textAlign` (string, optional)
텍스트 정렬 (`"left"`, `"center"`, `"right"`).

#### `textShadow` (string, optional)
텍스트 그림자. CSS text-shadow 값.

#### `lineHeight` (number | string, optional)
줄 간격.

#### `letterSpacing` (string, optional)
글자 간격.

### Box Style Fields

#### `boxBg` (string, optional)
배경색. CSS 색상값 또는 `define` 참조.

#### `border` (object, optional)
테두리 설정.

```json
{
  "border": {
    "widthRel": 0.002,      // 상대적 두께 (스테이지 크기 대비)
    "width": "2px",         // 절대적 두께
    "color": "#ffffff",     // 테두리 색상
    "radiusRel": 0.0125,    // 상대적 라운딩
    "radius": "8px",        // 절대적 라운딩
    "style": "solid"        // 테두리 스타일
  }
}
```

#### `padding` (object, optional)
내부 여백.

```json
{
  "padding": {
    "top": "8px",
    "right": "12px", 
    "bottom": "8px",
    "left": "12px"
  }
}
```

또는 축약형:
```json
{
  "padding": "8px 12px"  // CSS 축약 표기
}
```

---

## 📎 Appendix — childrenLayout 확장: 줄바꿈/간격/세이프 에어리어 (v2.1 제안)

본 확장 섹션은 자막과 같이 단어 단위 노드를 수평으로 배치하면서
줄바꿈과 균일한 간격, 좌우 세이프 에어리어를 동시에 만족시키기 위한
권장 표기와 동작 규칙을 정의합니다. v2.0 스펙과 상호운용을 해치지 않는
선에서 확장 필드를 도입합니다.

### 확장 필드 (Group.layout.childrenLayout)

```json
{
  "childrenLayout": {
    "mode": "flow",
    "direction": "horizontal",
    "wrap": true,           // [확장] 수평 플로우에서 줄바꿈 허용
    "gap": 0.012,           // 자식 간 간격(정규화)
    "maxWidthRel": 0.9,     // [확장] 컨테이너 최대폭(부모 폭 대비 비율)
    "align": "center",
    "justify": "center"
  }
}
```

- `wrap` (boolean, optional) — 수평 플로우에서 여러 줄 줄바꿈을 허용합니다.
  - 기본값: `false` (명시 사용 권장)
- `maxWidthRel` (number, optional) — 컨테이너의 최대 폭을 부모 폭 대비 비율로 지정합니다.
  - 생략 시 트랙 제약과 세이프 에어리어로부터 자동 산출됩니다.
- `gap` (number, optional) — 자식 간 간격(정규화 값).
  - 해석 기준: 수평 플로우에서는 부모 “폭”, 수직 플로우에서는 부모 “높이” 기준으로 px 환산.

### 폭 계산 규칙 (wrap=true일 때)

컨테이너의 실제 최대 폭 `effectiveMaxWidth`는 아래 요소의 최솟값으로 계산합니다.

```
effectiveMaxWidth = min(
  track.defaultConstraints.maxWidth,
  1 - safeArea.left - safeArea.right,
  childrenLayout.maxWidthRel? // 명시된 경우만 고려
) × parentWidth
```

- `layout.size.width`가 명시된 경우, 그 폭은 존중하고 `max-width`는 상한으로만 적용합니다.
- `wrap=false`이면 위 계산을 적용하지 않아도 됩니다(단일 라인).

### 작성 규칙 (Authoring Recommendations)

- 트랙(`subtitle`)의 `defaultConstraints`에 다음을 명시합니다.
  - `safeArea.left/right` 및 `maxWidth` (예: 0.8)
- 문장 그룹(root)에는 다음만 기술해도 충분합니다.
  - `childrenLayout`: `{ mode:'flow', direction:'horizontal', wrap:true, gap:… , align/justify }`
- 단어 노드는 텍스트에 공백을 포함하지 않습니다(간격은 전적으로 `gap`으로 제어).
- 글자(문자) 간 간격이 필요하면 표준 필드 `style.letterSpacing`을 사용합니다.

### 상호운용성 및 폴백

- `wrap`, `maxWidthRel`을 모르는 엔진에서는 해당 필드를 무시해도 자연스러운 표시가 가능합니다.
  - 줄바꿈이 비활성화될 수 있으나, 트랙의 `maxWidth`와 `safeArea`가 적용되어 잘려 보이지 않도록 합니다.
- `gap` 해석 기준은 본 문서에 명시된대로 고정하며, 구현체는 동일한 기준을 따릅니다.

### 검증/권고 사항

- `wrap:true`인데 트랙에 `maxWidth`와 `safeArea.left/right`가 모두 비어 있으면 경고를 권장합니다
  (폭이 과도하게 넓어질 수 있음).
- `gap`이 음수/비수치인 경우 0으로 보정하는 것을 권장합니다.

### 예시

```json
{
  "tracks": [
    {
      "id": "caption",
      "type": "subtitle",
      "layer": 1,
      "defaultStyle": { "fontSizeRel": 0.07 },
      "defaultConstraints": {
        "mode": "flow",
        "direction": "vertical",
        "maxWidth": 0.8,
        "safeArea": { "left": 0.05, "right": 0.05, "bottom": 0.1 },
        "anchor": "bc"
      }
    }
  ],
  "cues": [
    {
      "id": "cue-1",
      "track": "caption",
      "root": {
        "eType": "group",
        "layout": {
          "anchor": "bc",
          "position": { "x": 0.5, "y": 0.925 },
          "safeAreaClamp": true,
          "childrenLayout": {
            "mode": "flow",
            "direction": "horizontal",
            "wrap": true,
            "gap": 0.012,
            "align": "center",
            "justify": "center"
          }
        },
        "children": [
          { "id": "w1", "eType": "text", "text": "You",     "displayTime": [0, 2] },
          { "id": "w2", "eType": "text", "text": "know,",  "displayTime": [0.2, 2] },
          { "id": "w3", "eType": "text", "text": "we",      "displayTime": [0.4, 2] }
        ]
      }
    }
  ]
}
```

본 확장 규칙을 적용하면 “줄바꿈 + 균일 간격 + 좌우 세이프 에어리어 준수”가 일관되게 구현됩니다.

#### `margin` (object, optional)
외부 여백. `padding`과 동일한 형식.

### Visual Effects Fields

#### `opacity` (number, optional)
투명도 (0.0~1.0).

#### `filter` (string, optional)
CSS 필터 효과.

```json
{
  "filter": "blur(2px) brightness(1.2)"
}
```

#### `mixBlendMode` (string, optional)
혼합 모드 (`"multiply"`, `"screen"`, `"overlay"` 등).

#### `clipPath` (string, optional)
클리핑 경로. CSS clip-path 값.

---

## 🔌 Plugin Chain

플러그인 체인은 노드에 적용할 애니메이션 및 효과를 정의합니다.

### Plugin API v3.0 기반

v2.0에서는 Plugin API v3.0을 기반으로 하며, DOM 분리 구조를 통해 안전하고 효율적인 플러그인 실행을 보장합니다.

```json
{
  "pluginChain": [
    {
      "name": "fadeIn",
      "timeOffset": ["0%", "50%"],
      "params": { 
        "startOpacity": 0.0,
        "endOpacity": 1.0
      },
      "compose": "replace",
      "domScope": "effectsRoot",
      "capabilities": ["style-vars"],
      "targets": ["text", "image"]
    },
    {
      "name": "slideUp", 
      "timeOffset": ["20%", "80%"],
      "params": {
        "distance": "20%",
        "easing": "back.out(1.7)"
      },
      "compose": "add",
      "domScope": "effectsRoot",
      "capabilities": ["portal-breakout"],
      "targets": ["text"]
    }
  ]
}
```

### Plugin Spec Fields

#### `name` (string, required)
플러그인 이름. 로더에서 플러그인을 식별하는 데 사용.

#### `baseTime` (array, optional)
플러그인 오프셋의 기준 시간 구간 `[start, end]` (초). 생략 시 현재 노드의 `displayTime`이 기준이 됩니다.

#### `timeOffset` (array, required)
플러그인 실행 오프셋 `[start, end]`. 각 항목은 다음 두 표기 중 하나를 사용합니다:
- 숫자(number): 기준 시작 시각(`baseTime[0]`)으로부터의 "초" 단위 절대 오프셋 (음수 허용)
- 퍼센트 문자열(`"50%"`): `baseTime` 길이에 대한 비율

**절대 시간으로 변환 규칙**:
```ts
// baseTime = [b0, b1], duration = (b1 - b0)
// bound 가 퍼센트면 b0 + duration * (pct/100)
// bound 가 숫자면   b0 + seconds
```

예시:
```json
{
  "baseTime": [2.0, 6.0],
  "timeOffset": ["0%", "50%"]   // 최종 실행 창: [2.0, 4.0]
}
{
  "baseTime": [2.0, 6.0],
  "timeOffset": [-1.0, 2.0]      // 최종 실행 창: [1.0, 4.0]
}
// baseTime 미지정 → node.displayTime 사용
{
  "timeOffset": ["80%", "100%"] // 노드 구간의 80%~100%
}
```

#### `params` (object, optional)
플러그인에 전달할 매개변수.

#### `compose` (string, optional)
채널 합성 모드:
- `"replace"`: 기존값 교체 (기본값)
- `"add"`: 기존값에 더함
- `"multiply"`: 기존값에 곱함

#### `domScope` (string, optional)
플러그인이 조작할 수 있는 DOM 영역:
- `"effectsRoot"`: 플러그인 전용 영역 (기본값, 권장)
- `"baseWrapper"`: 렌더러 관리 영역 (제한적)

#### `capabilities` (array, optional)
플러그인이 사용할 수 있는 기능 목록:
- `"style-vars"`: CSS 변수 채널 조작
- `"portal-breakout"`: breakout 시스템 사용
- `"dom-manipulation"`: 고급 DOM 조작
- `"asset-loading"`: 에셋 동적 로딩

#### `targets` (array, optional)
플러그인이 적용 가능한 노드 타입 목록:
- `"text"`: 텍스트 노드
- `"image"`: 이미지 노드
- `"video"`: 비디오 노드
- `"group"`: 그룹 노드

#### `priority` (number, optional)
같은 시간대의 플러그인들 사이의 실행 우선순위. 높을수록 나중에 실행.

---

## ⛳ 퍼센트 표기 원칙 (요약)

- 시나리오에서 "비율"을 표현할 때는 `%` 접미사를 붙인 문자열을 사용합니다.
- 숫자 리터럴은 단위가 있는 "절대값"으로 해석됩니다.
- 시간 관련 필드에서 이 원칙이 우선 적용됩니다:
  - `displayTime`: 절대 초 배열, 단 자식 노드에서는 부모 대비 `%` 상대 표기 허용
  - `baseTime`: 절대 초 배열
  - `timeOffset`: 각 원소가 초(숫자) 또는 퍼센트 문자열(기준은 `baseTime`)

---

## 🌟 Effect Scope

특수 효과 범위와 breakout 시스템을 정의합니다.

```json
{
  "effectScope": {
    "breakout": {
      "mode": "portal",
      "toLayer": 1000,
      "coordSpace": "stage",
      "return": {
        "when": "complete",
        "transition": { "duration": 0.3 }
      },
      "transfer": "move"
    }
  }
}
```

### Fields

#### `breakout` (object, optional)
breakout 설정.

##### `mode` (string, required)
breakout 모드:
- `"portal"`: 포털을 통한 레이어 이동
- `"lift"`: 현재 위치에서 z-index만 상승

##### `toLayer` (number, required)
목표 레이어 (z-index).

##### `coordSpace` (string, optional)
좌표 공간:
- `"stage"`: 스테이지 기준 (기본값)
- `"track"`: 트랙 기준
- `"parent"`: 부모 그룹 기준

##### `return` (object, optional)
복귀 설정.

```json
{
  "return": {
    "when": "complete",     // 복귀 시점
    "transition": {         // 복귀 애니메이션
      "duration": 0.3,
      "easing": "ease-out"
    }
  }
}
```

##### `transfer` (string, optional)
전송 방식:
- `"move"`: 이동 (기본값)
- `"clone"`: 복제

---

## 🔄 상속 및 우선순위 시스템

v2.0의 핵심 기능 중 하나인 체계적인 값 상속과 우선순위 시스템입니다.

### 우선순위 (높음 → 낮음)

1. **직접 명시**: 해당 위치에서 직접 작성한 값
2. **Define 참조**: `"define.키명"` 형태의 명시적 참조
3. **상속값**: 부모 노드에서 전달받은 값 (자동)
4. **기본값**: 시스템/트랙 기본값

### 상속 동작

```json
{
  "define": {
    "brand_color": "#ff6b35",
    "caption_box": {
      "boxBg": "rgba(0,0,0,0.9)",
      "border": { "radiusRel": 0.0125 }
    }
  },
  "tracks": [
    {
      "id": "subtitle",
      "defaultStyle": {
        "fontSizeRel": 0.05,
        "color": "#ffffff"
      }
    }
  ],
  "cues": [
    {
      "root": {
        "id": "parent_group",
        "eType": "group",
        "displayTime": [0.0, 5.0],
        "style": {
          "color": "define.brand_color",  // #ff6b35 (define 참조)
          "fontWeight": 700               // 직접 명시
        },
        "children": [
          {
            "id": "child1",
            "eType": "text",
            "text": "자식 노드 1"
            // displayTime: [0.0, 5.0] (상속)
            // color: #ff6b35 (상속)
            // fontWeight: 700 (상속)
            // fontSizeRel: 0.05 (트랙 기본값)
          },
          {
            "id": "child2",
            "eType": "text", 
            "text": "자식 노드 2",
            "displayTime": [1.0, 3.0],    // 직접 명시 (최고 우선순위)
            "style": {
              "color": "#ff0000"          // 직접 명시 (상속값 오버라이드)
              // fontWeight: 700 (상속)
              // fontSizeRel: 0.05 (트랙 기본값)
            }
          }
        ]
      }
    }
  ]
}
```

### Define 참조 해석

참조 해석은 파싱 단계에서 수행되며, 점 표기법을 통해 중첩된 객체에 접근할 수 있습니다.

```json
{
  "define": {
    "theme": {
      "colors": {
        "primary": "#ff6b35",
        "secondary": "#4a90e2"
      },
      "fonts": {
        "heading": "Arial Black",
        "body": "Arial"
      }
    }
  }
}
```

**참조 예시**:
- `"define.theme.colors.primary"` → `"#ff6b35"`
- `"define.theme.fonts.heading"` → `"Arial Black"`

### 순환 참조 방지

Define 참조에서 순환 참조를 감지하고 오류를 발생시킵니다.

```json
// ❌ 오류: 순환 참조
{
  "define": {
    "a": "define.b",
    "b": "define.a"
  }
}
```

---

## ⚙️ 에셋 관리

v2.0에서는 통합된 에셋 관리 시스템을 제공합니다.

### 에셋 정의

```json
{
  "define": {
    "brand_font": {
      "type": "font",
      "family": "BrandFont",
      "src": "https://cdn.example.com/fonts/brand.woff2",
      "preload": true,
      "integrity": "sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC",
      "fallback": ["Arial", "sans-serif"]
    },
    "background_video": {
      "type": "video",
      "src": "https://cdn.example.com/videos/bg.mp4",
      "preload": false,
      "integrity": "sha384-abc123...",
      "mimeType": "video/mp4"
    },
    "logo_image": {
      "type": "image", 
      "src": "assets/logo.png",
      "preload": true,
      "integrity": "sha384-def456...",
      "alt": "Company Logo"
    }
  }
}
```

### 에셋 타입별 처리

#### Font Assets
- 자동 `FontFace` 등록 및 해제
- `family` 이름으로 CSS에서 사용 가능
- `fallback` 폰트 체인 지원
- 로딩 실패 시 fallback으로 우아한 저하

#### Image/Video Assets
- 무결성 검증 (SHA-384)
- 선택적 preload
- MIME 타입 검증
- 에러 핸들링 및 폴백

### 보안

- **무결성 검증**: SHA-384 해시 필수 (프로덕션)
- **오리진 제한**: 허용된 도메인에서만 로딩
- **CSP 준수**: Content Security Policy 호환
- **폴백 전략**: 검증 실패 시 비활성화 또는 기본값 사용

---

## 🔧 마이그레이션 가이드

### v1.3 → v2.0 변환

v1.3 시나리오를 v2.0으로 마이그레이션하는 자동 변환 규칙입니다.

#### 필드명 매핑

| v1.3 | v2.0 | 비고 |
|------|------|------|
| `hintTime` | `domLifetime: [start, end]` | 배열 형태로 변환 |
| `absStart`, `absEnd` | `displayTime: [start, end]` | 배열로 통합 |
| `relStart`, `relEnd` | `timeOffset: [start, end]` | 퍼센트 문자열 권장(`"0%"~"100%"`) |
| 플러그인 `t0`, `t1` | `timeOffset: [start, end]` | 초 단위(숫자) 또는 퍼센트 문자열 |

#### 자동 변환 스크립트

```typescript
function migrateV13ToV20(scenario: ScenarioV13): ScenarioV20 {
  const migrated: ScenarioV20 = {
    version: "2.0",
    pluginApiVersion: "3.0",
    timebase: scenario.timebase,
    stage: scenario.stage,
    tracks: scenario.tracks,
    cues: []
  };

  // Cue 변환
  scenario.cues.forEach(cue => {
    const newCue: CueV20 = {
      id: cue.id,
      track: cue.track,
      root: migrateNode(cue.root)
    };

    // hintTime → domLifetime 변환
    if (cue.hintTime) {
      if (typeof cue.hintTime === 'object' && 'start' in cue.hintTime) {
        newCue.domLifetime = [cue.hintTime.start || 0, cue.hintTime.end || 0];
      }
    } else {
      // 자동 계산
      newCue.domLifetime = calculateDomLifetime(newCue);
    }

    migrated.cues.push(newCue);
  });

  return migrated;
}

function migrateNode(node: NodeV13): NodeV20 {
  const newNode: NodeV20 = {
    id: node.id || generateId(), // ID 의무화
    eType: node.eType,
    ...node
  };

  // absStart/absEnd → displayTime 변환
  if (node.absStart !== undefined && node.absEnd !== undefined) {
    newNode.displayTime = [node.absStart, node.absEnd];
    delete newNode.absStart;
    delete newNode.absEnd;
  }

  // pluginChain 시간 필드 통일
  if (node.pluginChain) {
    newNode.pluginChain = node.pluginChain.map(plugin => {
      const newPlugin = { ...plugin };

      // relStart/relEnd → timeOffset 변환 (퍼센트 문자열)
      if (plugin.relStart !== undefined || plugin.relEnd !== undefined) {
        const s = plugin.relStart ?? 0;
        const e = plugin.relEnd ?? 0;
        newPlugin.timeOffset = [`${s * 100}%`, `${e * 100}%`];
        delete newPlugin.relStart;
        delete newPlugin.relEnd;
      }

      // 매개변수 내 t0/t1 → timeOffset 변환 (초 단위)
      if (plugin.params?.t0 !== undefined || plugin.params?.t1 !== undefined) {
        newPlugin.timeOffset = [plugin.params.t0 || 0, plugin.params.t1 || 0];
        delete newPlugin.params.t0;
        delete newPlugin.params.t1;
      }

      return newPlugin;
    });
  }

  // 자식 노드 재귀 변환
  if ('children' in node && node.children) {
    newNode.children = node.children.map(migrateNode);
  }

  return newNode;
}
```

### 호환성 주의사항

#### Breaking Changes
- 모든 노드에 `id` 필수
- 시간 필드 구조 변경 (`absStart/absEnd` → `displayTime`)
- 플러그인 API 버전 업 (v2.1 → v3.0)

#### 권장 마이그레이션 절차

1. **백업**: 기존 v1.3 시나리오 백업
2. **자동 변환**: 마이그레이션 도구 실행
3. **검증**: 변환된 시나리오 테스트
4. **수동 조정**: 필요 시 define 필드 및 상속 구조 최적화
5. **플러그인 업데이트**: Plugin API v3.0 호환 플러그인으로 업데이트

---

## 📝 예제

### 완전한 v2.0 시나리오 예제

```json
{
  "version": "2.0",
  "pluginApiVersion": "3.0",
  "timebase": {
    "unit": "seconds",
    "fps": 30
  },
  "stage": {
    "baseAspect": "16:9"
  },
  "define": {
    "brand_colors": {
      "primary": "#ff6b35",
      "secondary": "#4a90e2", 
      "accent": "#f7931e"
    },
    "heading_font": {
      "type": "font",
      "family": "BrandBold",
      "src": "assets/brand-bold.woff2",
      "preload": true,
      "integrity": "sha384-abc123...",
      "fallback": ["Arial Black", "sans-serif"]
    },
    "caption_style": {
      "boxBg": "rgba(0,0,0,0.85)",
      "border": {
        "radiusRel": 0.01,
        "color": "rgba(255,255,255,0.2)"
      },
      "padding": "8px 16px"
    },
    "main_timing": [1.0, 8.0],
    "entrance_effect": {
      "name": "slideUpFade",
      "timeOffset": ["0%", "80%"],
      "params": {
        "distance": "30px",
        "startOpacity": 0.0,
        "endOpacity": 1.0,
        "easing": "back.out(1.7)"
      }
    }
  },
  "tracks": [
    {
      "id": "subtitle",
      "type": "subtitle", 
      "layer": 10,
      "overlapPolicy": "push",
      "defaultStyle": {
        "fontSizeRel": 0.045,
        "color": "#ffffff",
        "textAlign": "center",
        "fontFamily": "define.heading_font"
      }
    },
    {
      "id": "effects",
      "type": "free",
      "layer": 20,
      "overlapPolicy": "ignore"
    }
  ],
  "cues": [
    {
      "id": "intro_caption",
      "track": "subtitle",
      "domLifetime": [0.5, 8.5],
      "root": {
        "id": "intro_group",
        "eType": "group",
        "displayTime": "define.main_timing",
        "layout": {
          "position": { "x": 0.5, "y": 0.85 },
          "anchor": "bc"
        },
        "style": "define.caption_style",
        "children": [
          {
            "id": "greeting_word",
            "eType": "text",
            "text": "안녕하세요",
            "displayTime": [1.0, 4.0],
            "style": {
              "color": "define.brand_colors.primary"
            },
            "pluginChain": [
              "define.entrance_effect"
            ]
          },
          {
            "id": "name_word", 
            "eType": "text",
            "text": "김철수입니다",
            "displayTime": [3.0, 7.0],
            "style": {
              "color": "define.brand_colors.secondary",
              "fontWeight": 700
            },
            "pluginChain": [
              {
                "name": "slideUpFade",
                "timeOffset": ["0%", "60%"],
                "params": {
                  "distance": "20px",
                  "delay": 0.2
                }
              },
              {
                "name": "emphasis",
                "timeOffset": ["70%", "100%"],
                "params": {
                  "scale": 1.1,
                  "glowColor": "define.brand_colors.accent"
                }
              }
            ]
          }
        ]
      }
    },
    {
      "id": "logo_overlay",
      "track": "effects", 
      "domLifetime": [0.0, 10.0],
      "root": {
        "id": "logo_container",
        "eType": "image",
        "src": "define.company_logo",
        "displayTime": [0.5, 9.5],
        "layout": {
          "position": { "x": 0.9, "y": 0.1 },
          "anchor": "tr",
          "size": { "width": "120px", "height": "auto" }
        },
        "style": {
          "opacity": 0.8
        },
        "pluginChain": [
          {
            "name": "fadeIn",
            "timeOffset": ["0%", "50%"]
          }
        ],
        "effectScope": {
          "breakout": {
            "mode": "portal",
            "toLayer": 1000,
            "coordSpace": "stage"
          }
        }
      }
    }
  ]
}
```

---

## 🏗 구현 참고사항

### DOM 아키텍처 (Plugin API v3.0)

v2.0에서는 Plugin API v3.0의 DOM 분리 구조를 채택합니다.

```html
<!-- 렌더러 관리 영역 -->
<div class="baseWrapper" style="--mtx-tx: 0px; --mtx-ty: 0px; --mtx-sx: 1; --mtx-sy: 1; --mtx-rot: 0deg; --mtx-opacity: 1;">
  
  <!-- 플러그인 관리 영역 -->
  <div class="effectsRoot">
    <!-- 플러그인이 자유롭게 조작할 수 있는 영역 -->
    <span>실제 텍스트 내용</span>
  </div>
  
</div>
```

### 채널 시스템

채널은 독립적인 변환 속성들을 분리하여 플러그인 간 충돌을 방지합니다.

**표준 채널**:
- `tx`, `ty`: 이동 (translate)
- `sx`, `sy`: 크기 (scale)
- `rot`: 회전 (rotate)
- `opacity`: 투명도
- `filter`: CSS 필터

**합성 모드**:
- `replace`: 마지막 값으로 교체 (기본값)
- `add`: 값을 누적하여 더함
- `multiply`: 값을 곱함

### 성능 고려사항

- **파싱 시점 해석**: define 참조는 런타임이 아닌 파싱 단계에서 해석
- **DOM 재사용**: domLifetime을 통한 효율적 DOM 생명주기 관리  
- **에셋 프리로딩**: 병렬 로딩 및 우선순위 기반 스케줄링
- **메모리 관리**: LRU 기반 에셋 캐시

---

*이 문서는 MotionText Renderer v2.0 시나리오 스펙을 정의합니다. 플러그인 개발에 대한 자세한 내용은 [Plugin System Architecture v3.0](./plugin-system-architecture-v-3-0.md)을 참조하세요.*
