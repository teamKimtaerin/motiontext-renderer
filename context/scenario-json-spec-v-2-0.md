# MotionText Renderer — Scenario JSON v2.0 Specification

이 문서는 MotionText Renderer v2.0의 시나리오(JSON) 스펙을 정의합니다.

## 🆕 v2.0 주요 변경사항

### Breaking Changes
- **필드명 변경**: `hintTime` → `domLifetime`, `absStart/absEnd` → `displayTime`, `relStart/relEnd` → `time_offset`
- **시간 표현 통일**: 모든 시간은 `[start, end]` 배열 형태로 통일
- **노드 ID 의무화**: 모든 노드에 `id` 필드 필수
- **Define 시스템**: 중복 제거 및 에셋 관리를 위한 변수 시스템 도입
- **상속 시스템**: 체계적인 값 우선순위 및 상속 규칙 정립

### 플러그인 API 호환성
- **Plugin API v3.0**: DOM 분리 구조 기반 새로운 플러그인 인터페이스
- **채널 충돌 방지**: baseWrapper/effectsRoot DOM 분리로 안전한 플러그인 실행
- **권한 기반 시스템**: capabilities와 targets를 통한 세밀한 권한 제어

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
      "time_offset": [0, 0.5],
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

트랙은 역할별 레이어와 기본 스타일을 정의합니다.

```json
{
  "id": "subtitle",
  "type": "subtitle",
  "layer": 10,
  "overlapPolicy": "push",
  "defaultStyle": {
    "fontSizeRel": 0.05,
    "color": "define.brand_color"
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

#### `e_type` (string, required)
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
  "e_type": "group",
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
      "e_type": "text",
      "text": "안녕하세요"
      // displayTime 생략 → [0.0, 5.0] 상속
      // style 상속받음
    },
    {
      "id": "word_2",
      "e_type": "text",
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
  "e_type": "text",
  "text": "안녕하세요!",
  "displayTime": [1.0, 3.0],
  "pluginChain": [
    {
      "name": "fadeIn",
      "time_offset": [0, 0.5],
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
  "e_type": "image",
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
  "e_type": "video",
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

## 🎨 Layout

레이아웃은 노드의 위치, 크기, 변환을 정의합니다.

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
      "time_offset": [0, 0.5],
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
      "time_offset": [0.2, 0.8],
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

#### `time_offset` (array, required)
플러그인 실행 시점 오프셋 `[start, end]`.

**절대 시간으로 변환**:
```typescript
const pluginStart = nodeDisplayTime[0] + time_offset[0];
const pluginEnd = nodeDisplayTime[1] + time_offset[1];
```

**상대값 지원**: `%` 접미사 사용 가능.
```json
{
  "time_offset": ["0%", "50%"]  // 노드 전체 구간의 0%~50%
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
        "e_type": "group",
        "displayTime": [0.0, 5.0],
        "style": {
          "color": "define.brand_color",  // #ff6b35 (define 참조)
          "fontWeight": 700               // 직접 명시
        },
        "children": [
          {
            "id": "child1",
            "e_type": "text",
            "text": "자식 노드 1"
            // displayTime: [0.0, 5.0] (상속)
            // color: #ff6b35 (상속)
            // fontWeight: 700 (상속)
            // fontSizeRel: 0.05 (트랙 기본값)
          },
          {
            "id": "child2",
            "e_type": "text", 
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
| `relStart`, `relEnd` | `time_offset: [start, end]` | 배열로 통합 |
| 플러그인 `t0`, `t1` | `time_offset: [start, end]` | 매개변수 통일 |

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
    e_type: node.e_type,
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

      // relStart/relEnd → time_offset 변환
      if (plugin.relStart !== undefined || plugin.relEnd !== undefined) {
        newPlugin.time_offset = [plugin.relStart || 0, plugin.relEnd || 0];
        delete newPlugin.relStart;
        delete newPlugin.relEnd;
      }

      // 매개변수 내 t0/t1 → time_offset 변환
      if (plugin.params?.t0 !== undefined || plugin.params?.t1 !== undefined) {
        newPlugin.time_offset = [plugin.params.t0 || 0, plugin.params.t1 || 0];
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
      "time_offset": [0, 0.8],
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
        "e_type": "group",
        "displayTime": "define.main_timing",
        "layout": {
          "position": { "x": 0.5, "y": 0.85 },
          "anchor": "bc"
        },
        "style": "define.caption_style",
        "children": [
          {
            "id": "greeting_word",
            "e_type": "text",
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
            "e_type": "text",
            "text": "김철수입니다",
            "displayTime": [3.0, 7.0],
            "style": {
              "color": "define.brand_colors.secondary",
              "fontWeight": 700
            },
            "pluginChain": [
              {
                "name": "slideUpFade",
                "time_offset": [0, 0.6],
                "params": {
                  "distance": "20px",
                  "delay": 0.2
                }
              },
              {
                "name": "emphasis",
                "time_offset": ["70%", "100%"],
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
        "e_type": "image",
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
            "time_offset": [0, 0.5]
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