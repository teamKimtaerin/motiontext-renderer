# 시나리오(JSON) 스펙 v1.3 ⚠️ 레거시

**⚠️ 중요 알림**: 이 문서는 v1.3 레거시 스펙입니다. **v2.0 최신 스펙을 사용하세요**: [`context/scenario-json-spec-v-2-0.md`](./scenario-json-spec-v-2-0.md)

**v2.0 주요 개선사항:**
- Define 시스템으로 중복 제거 및 에셋 관리 통합  
- 시간 필드 통일: `timeOffset: [start, end]` 배열 형태
- 노드 ID 의무화로 편집 도구 지원 강화
- 상속 시스템으로 체계적인 값 우선순위 규칙
- 플러그인 API v3.0 호환성

---

# 시나리오(JSON) 스펙 v1.3 (레거시)

## **0) 철학 요약**

- **좌표계**: 스테이지(Stage = 영상 콘텐츠 박스) 기준 정규화 좌표(0~1).
- **시간**: 요소(특히 단어/스티커)는 **절대 시간** absStart/absEnd로 활성화.
- **레이어링**: track.layer > cue.layout.zIndex > element.layout.zIndex.
- **트랙 역할**:
    - subtitle = 고정 룩(하단 자막 등).
    - free = 편집자가 임의 위치·크기·회전으로 놓는 스티커/효과.
- **탈출 효과**: 특정 요소는 **breakout(포털/리프트)** 로 자막 박스 클립을 무시하고 밖으로 연출.

---

## **1) 최상위 구조**

```tsx
{
  version: "1.3",
  timebase: { unit: "seconds" | "tc", fps?: number },  // 기본 seconds
  stage: {
    baseAspect: "16:9" | "9:16" | "auto",
    safeArea?: { top?: number, bottom?: number, left?: number, right?: number } // 0~1
  },
  behavior?: {
    preloadMs?: number,           // 활성 전 프리롤(기본 300)
    resizeThrottleMs?: number,    // 리사이즈 반응(기본 80)
    snapToFrame?: boolean         // true면 t0/t1 프레임 스냅
  },
  definitions?: Record<string, any>, // (선택) 공통 데이터 정의 (palette, 상수 등)
  tracks: Track[],
  wordStream?: WordStream,        // (선택) ASR/align 결과 대량 입력
  bindings?: BindingRule[],       // (선택) wordStream을 트리에 바인딩하는 규칙
  cues: Cue[]
}
```

### **Track**

```tsx
type Track = {
  id: string
  type: "subtitle" | "free"
  layer: number                 // 레이어 우선순위(클수록 위)
  scaleMode?: "scaleWithVideo" | "fixedPoint" | "cap" // 기본 scaleWithVideo
  overlapPolicy?: "ignore" | "push" | "stack"        // 기본 ignore
  defaultStyle?: Style          // 트랙 기본 스타일(자식이 상속)
  safeArea?: { top?:number, bottom?:number, left?:number, right?:number }
}
```

### **Cue**

```tsx
type Cue = {
  id: string
  track: string                 // 트랙 id
  hintTime?: { start?: number, end?: number } // 프리롤/에디팅 힌트(실행 시간은 자식의 abs가 우선)
  root: GroupNode               // cue의 루트 그룹(한 개)
}
```

### **노드 공통**

```tsx
type BaseNode = {
  name?: string
  style?: Style
  layout?: Layout
  plugin?: PluginSpec
  pluginChain?: PluginSpec[]     // NEW: 복수 플러그인(체인) 지원
  effectScope?: EffectScope     // breakout 등
  children?: Node[]             // Group/Text/Image/Video/Shape...
}
```

### **Group / Text / Image / Video**

```tsx
type GroupNode = BaseNode & { eType: "group" }

type TextNode  = BaseNode & {
  eType: "text"
  text: string
  absStart?: number
  absEnd?: number
  tokenId?: number              // wordStream 매칭용(선택)
}

type ImageNode = BaseNode & {
  eType: "image"
  src: string
  absStart?: number
  absEnd?: number
  alt?: string
}

type VideoNode = BaseNode & {
  eType: "video"
  src: string
  absStart?: number
  absEnd?: number
  mute?: boolean
  loop?: boolean
}

type Node = GroupNode | TextNode | ImageNode | VideoNode /* ...확장 가능 */
```

### **Layout (좌표·크기·변환)**

```tsx
type Layout = {
  mode?: "flow" | "grid" | "absolute" | "path" | "polar"   // 기본 flow(자막), free는 보통 absolute
  anchor?: "tl"|"tc"|"tr"|"cl"|"cc"|"cr"|"bl"|"bc"|"br"
  position?: { x: number, y: number }                      // 0~1 (stage 기준 정규화)
  size?: { width?: number | "auto", height?: number | "auto" } // 정규화, auto 허용
  padding?: { x?: number, y?: number }                     // 정규화
  gapRel?: number                                          // flow/grid 간격
  transform?: {
    translate?: { x?: number, y?: number }                 // 정규화 오프셋
    rotate?: { deg: number }
    scale?: { x?: number, y?: number }
    skew?: { xDeg?: number, yDeg?: number }
  }
  transformOrigin?: string                                 // ex) "50% 50%"
  zIndex?: number
  overflow?: "clip" | "visible"                            // 기본 clip(자막)
  safeAreaClamp?: boolean                                   // true면 스테이지 경계로 클램프
  override?: {                                              // 자식이 그룹 규칙 탈출 시 사용
    mode: "absolute",
    offset?: { x?: number, y?: number },
    transform?: Layout["transform"],
    keepUpright?: boolean                                   // 텍스트만 월드축 기준으로 세우기
  }
}
```

### **Style (주요 필드)**

```tsx
type Style = {
  fontFamily?: string
  fontWeight?: number | string
  fontSizeRel?: number           // stage 높이/폭 기준 비율
  lineHeight?: number
  color?: string
  textShadow?: string
  boxBg?: string
  stroke?: { widthRel: number, color: string }
  border?: { widthRel: number, color: string, radiusRel?: number }
  align?: "left" | "center" | "right"
  whiteSpace?: "wrap" | "nowrap"
}
```

### **Plugin / EffectScope**

```tsx
type PluginSpec = {
  name: string                   // 플러그인 식별자
  params?: Record<string, any>   // 플러그인 고유 파라미터
  // NEW: 상대 시간 윈도우(요소의 absStart/absEnd에 대한 오프셋)
  // relStart는 absStart에 더해지고, relEnd는 absEnd에 더해진다(초 단위).
  // 퍼센트 기반도 선택 지원: relStartPct/relEndPct (0..1, 요소 구간 길이에 비례)
  relStart?: number              // seconds offset from absStart (default 0)
  relEnd?: number                // seconds offset from absEnd   (default 0)
  relStartPct?: number           // 0..1, (absStart + D*relStartPct)
  relEndPct?: number             // 0..1, (absEnd   + D*relEndPct)
  compose?: "add" | "multiply" | "replace" // 기본: "replace" (겹치면 뒤가 이김, last-wins)
}

type EffectScope = {
  breakout?: {
    mode: "portal" | "lift"         // 권장: portal(임시 재부모화)
    toLayer?: number                // portal일 때 보낼 상위 레이어(z)
    coordSpace?: "group" | "stage"  // 변환 기준 좌표계
    zLift?: number                  // lift일 때 상대 z 인상
    clampStage?: boolean            // 스테이지 경계 클램프
    return?: "end" | "manual"       // end면 absEnd에 복귀
    transfer?: "move" | "clone"     // NEW: 기본 move(원본 재부모화). clone은 복제 후 연출
  }
}
```

### **WordStream / Bindings (선택)**

```tsx
type WordStream = {
  source?: string                // asr-whisperx 등
  language?: string
  tokens: { id:number, text:string, t0:number, t1:number }[]
}

type BindingRule = {
  target: string                 // 예: "cueId.root.children[0]" 또는 노드 path
  fromWordStream: {
    range: { startId:number, endId:number }
    layoutPerToken?: Partial<Layout>
    pluginPerToken?: PluginSpec
    overrides?: { id:number, plugin?:PluginSpec, style?:Style, layout?:Partial<Layout> }[]
  }
}
```

---

## **2) 시간 규칙**

- **활성 조건**: 요소는 absStart ≤ t < absEnd에서만 활성.
- **우선순위**: absStart/absEnd > hintTime > 부모 cue 시간.
- snapToFrame: true면 absStart/absEnd를 근접 프레임으로 정규화.
- **pluginChain 타이밍**: 각 플러그인 p에 대해 실제 창(window)은  
  t0 = absStart + (p.relStart ?? D*(p.relStartPct ?? 0)) ,  
  t1 = absEnd   + (p.relEnd   ?? D*(p.relEndPct   ?? 0))  (D = absEnd-absStart).  
  렌더러는 이 창에만 해당 플러그인의 효과를 적용한다.

---

## **3) 리사이즈/전체화면**

- 스테이지 크기 변경 시: 정규화 좌표 → 픽셀 재계산, transform 재적용.
- 자막(고정 룩) 트랙은 대체로 overflow:"clip", 스티커는 자유.

---

## **4) 합성/충돌**

- 레이어 우선순위: **track.layer > cue.zIndex > element.zIndex**.
- overlapPolicy:
    - ignore: 겹침 방치(스티커/효과).
    - push: 동일 트랙 내 자동 밀어내기(자막 추천).
    - stack: 세로 스택/간격 자동 배치.

### **PluginChain 충돌 규칙 (v0: 단순 운영)**
- **창이 겹치지 않으면 충돌 아님**: 각 플러그인의 실행 창(window)이 시간상 겹치지 않으면 그대로 독립 실행.
- **겹치면 체인 뒤가 이김 (last-wins)**: 동일 속성을 동시에 건드릴 때는 `pluginChain`에서 **뒤에 있는 플러그인**의 값이 최종 반영됨.
- **합성 모드(선택)**: 특정 속성은 합산/곱셈이 필요할 수 있음. 그 플러그인에서만 `compose`를 명시해 기본 규칙을 덮어씀.
  - `compose: "add"` → 수치값 덧셈(예: translateX/rotate 등)
  - `compose: "multiply"` → 배율/불투명도 등
  - 미지정 시 **"replace"**(교체)로 처리
- **권장 구현(의사코드)**:
  ```ts
  let acc = {}; // 채널별 누적값
  for (const p of pluginChainActiveNow /* 시간창 겹치는 것만 */) {
    const v = computeNow(p); // {tx, ty, rot, sx, sy, opacity, ...}
    for (const k in v) {
      const mode = p.compose ?? "replace";
      if (mode === "add") acc[k] = (acc[k] ?? 0) + v[k];
      else if (mode === "multiply") acc[k] = (acc[k] ?? 1) * v[k];
      else acc[k] = v[k]; // replace (last-wins)
    }
  }
  applyToDom(acc); // 프레임당 1회 최종 반영
  ```
- **운영 팁**: 우선은 이 단순 규칙으로 시작하고, 필요 시 `priority`나 세분 채널(tx/ty/rot/...)을 도입해 확장한다.

---

# **예시 JSON (실전 케이스 3종 포함)**

```json
{
  "version": "1.3",
  "timebase": { "unit": "seconds", "fps": 30 },
  "stage": {
    "baseAspect": "16:9",
    "safeArea": { "top": 0.06, "bottom": 0.16, "left": 0.06, "right": 0.06 }
  },
  "behavior": { "preloadMs": 300, "resizeThrottleMs": 80, "snapToFrame": false },

  "definitions": {
    "speakerPalette": {
      "SPEAKER_01": "#4AA3FF",
      "SPEAKER_02": "#FF4D4D", 
      "SPEAKER_03": "#FFD400",
      "SPEAKER_04": "#FF8A00"
    }
  },

  "tracks": [
    {
      "id": "subtitle-ko",
      "type": "subtitle",
      "layer": 10,
      "overlapPolicy": "push",
      "defaultStyle": {
        "fontFamily": "Pretendard",
        "fontWeight": 800,
        "fontSizeRel": 0.042,
        "lineHeight": 1.18,
        "boxBg": "rgba(0,0,0,0.90)",
        "textShadow": "0 4px 12px rgba(0,0,0,0.35)",
        "boxPaddingRel": 0.018
      },
      "safeArea": { "bottom": 0.10 }
    },
    {
      "id": "free-stickers",
      "type": "free",
      "layer": 200,
      "overlapPolicy": "ignore",
      "defaultStyle": {}
    }
  ],

  "wordStream": {
    "source": "asr-whisperx",
    "language": "ko",
    "tokens": [
      { "id": 1, "text": "저는",    "t0": 2.60, "t1": 3.00 },
      { "id": 2, "text": "개발자로", "t0": 3.00, "t1": 3.60 },
      { "id": 3, "text": "일하고",  "t0": 3.60, "t1": 4.00 },
      { "id": 4, "text": "있는",    "t0": 4.00, "t1": 4.20 },
      { "id": 5, "text": "홍길동입니다", "t0": 4.20, "t1": 4.90 }
    ]
  },

  "cues": [
    {
      "id": "sub-001",
      "track": "subtitle-ko",
      "hintTime": { "start": 2.50, "end": 5.20 },
      "root": {
        "eType": "group",
        "name": "caption-box",
        "layout": {
          "mode": "flow",
          "anchor": "bc",
          "position": { "x": 0.50, "y": 0.88 },
          "size": { "width": 0.86, "height": "auto" },
          "overflow": "clip",
          "zIndex": 0
        },
        "children": [
          { "eType": "text", "tokenId": 1, "text": "저는",        "absStart": 2.60, "absEnd": 3.00 },
          {
            "eType": "text",
            "tokenId": 2,
            "text": "개발자로",
            "absStart": 3.00,
            "absEnd": 3.60,
            "pluginChain": [
              {
                "name": "waveText",
                "params": { "amplitudeRel": 0.02, "stagger": 0.02 },
                "relStart": 0.0,
                "relEnd": 0.0
              },
              {
                "name": "growPop",
                "params": { "maxScale": 2.2, "ease": "back.out(1.7)" },
                "relStart": 0.10,
                "relEnd": 0.0
              }
            ],
            "effectScope": {
              "breakout": {
                "mode": "portal",
                "toLayer": 220,
                "coordSpace": "stage",
                "clampStage": true,
                "return": "end",
                "transfer": "move"
              }
            }
          },
          { "eType": "text", "tokenId": 3, "text": "일하고",      "absStart": 3.60, "absEnd": 4.00 },
          { "eType": "text", "tokenId": 4, "text": "있는",        "absStart": 4.00, "absEnd": 4.20 },
          { "eType": "text", "tokenId": 5, "text": "홍길동입니다", "absStart": 4.20, "absEnd": 4.90,
            "plugin": { "name": "wordHighlight", "params": { "style": "solid" } } }
        ]
      }
    },

    {
      "id": "sticker-tilted-banner",
      "track": "free-stickers",
      "root": {
        "eType": "group",
        "name": "tilted-sticker",
        "layout": {
          "mode": "absolute",
          "anchor": "cc",
          "position": { "x": 0.57, "y": 0.28 },
          "size": { "width": 0.62, "height": "auto" },
          "transform": { "rotate": { "deg": -18 }, "scale": { "x": 1.0, "y": 1.0 } },
          "transformOrigin": "50% 50%",
          "zIndex": 5,
          "overflow": "clip"
        },
        "children": [
          {
            "eType": "text",
            "text": "개발자 홍길동 ✈️",
            "absStart": 2.00, "absEnd": 4.20,
            "style": {
              "fontFamily": "Cafe24Shiningstar",
              "fontWeight": 400,
              "fontSizeRel": 0.06,
              "stroke": { "widthRel": 0.004, "color": "#00E0FF" },
              "color": "#FFFFFF"
            },
            "plugin": { "name": "handDrawReveal", "params": { "direction": "ltr", "duration": 0.9, "wobble": 0.015 } }
          },
          {
            "eType": "image",
            "src": "assets/paper_plane.png",
            "absStart": 2.20, "absEnd": 4.20,
            "layout": {
              "override": {
                "mode": "absolute",
                "offset": { "x": 0.25, "y": -0.03 },
                "transform": { "rotate": { "deg": 8 }, "scale": { "x": 0.8, "y": 0.8 } }
              },
              "zIndex": 7
            },
            "plugin": { "name": "arcFly", "params": { "arcRel": 0.12, "ease": "power2.out" } }
          }
        ]
      }
    }
  ]
}
```

### **타임라인 계약 요약 (GSAP 운용)**
- 마스터 클락: video mediaTime (requestVideoFrameCallback 우선).
- 플러그인은 타이머를 직접 구동하지 않고, **상대 Timeline(0~1)** 또는 **seek 함수형**을 제공한다.
- 렌더러는 각 요소의 전체 길이 D와 각 pluginChain 창(window)에 맞춰 **마스터 타임라인 하나**를 구성하고, 매 프레임 `progress`를 mediaTime으로 강제한다.
- 속성 충돌은 래퍼 레이어 분리 또는 CSS 변수 합성으로 방지한다.
---

## **5) 검증/구현 체크리스트**

- position/size는 0~1 정규화(예외: "auto").
- 활성 판정은 **요소의 absStart/absEnd** 기준.
- 프리롤 preloadMs 전에 DOM/폰트/이미지 준비.
- 레이어링: track.layer > cue.zIndex > element.zIndex.
- subtitle 트랙은 기본 overflow:"clip", 필요 요소만 effectScope.breakout 사용.
- 회전/스케일 변환은 그룹에, 단어/이미지의 미세 조정은 layout.override.
- 대량 단어는 wordStream + bindings(선택)로 자동 전개.
- snapToFrame 옵션을 방송/편집 파이프라인에 맞춰 설정.
- [ ] pluginChain의 각 항목이 relStart/relEnd(또는 pct)로 계산된 창(window) 내에서만 실행되는지.
- [ ] breakout은 기본 transfer:"move"로 원본 잔상이 남지 않도록 재부모화되는지.
- [ ] pluginChain 충돌 시 기본 규칙이 **last-wins**로 동작하는지(순서 바뀌면 결과도 바뀌는지).
- [ ] `compose` 지정 항목이 add/multiply로 누적되는지, 미지정은 replace로 교체되는지.
