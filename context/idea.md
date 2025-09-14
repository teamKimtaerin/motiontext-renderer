# MotionText Renderer v1.4 스펙 개선 아이디어

## 🎯 개선 목표

### 현재 문제점
1. **중복성**: 동일한 스타일/레이아웃이 반복 정의됨
2. **시간 표현 혼재**: absStart/absEnd, relStart/relEnd, t0/t1 등 일관성 부족  
3. **용도 불명확**: hintTime, absStart/absEnd의 역할이 애매함
4. **편집 어려움**: 노드 식별자 부족으로 편집이 복잡함
5. **플러그인 복잡도**: 플러그인 내부에서 시간 계산 처리로 복잡도 증가

---

## 🔧 주요 개선사항

### 1. Define 필드 - 중복 제거 및 에셋 관리

**목적**: JSON 파일 내 중복된 정의를 변수화하고 에셋 관리 통합

```json
{
  "define": {
    "caption_style": {
      "boxBg": "rgba(0,0,0,0.9)",
      "border": {
        "widthRel": 0,
        "color": "#000", 
        "radiusRel": 0.0125
      }
    },
    "custom_font": {
      "type": "font",
      "family": "BrandFont", 
      "src": "assets/brand.woff2",
      "preload": true,
      "integrity": "sha384-abc123...",
      "fallback": ["Arial", "sans-serif"]
    },
    "flame_effect": {
      "type": "image",
      "src": "assets/flame.gif",
      "preload": false,
      "integrity": "sha384-def456..."
    },
    "common_timing": [2.0, 5.0],
    "fade_animation": {
      "name": "fadeIn",
      "timeOffset": [0, 0.5],
      "capabilities": ["style-vars"]
    }
  },
  "tracks": [
    {
      "id": "subtitle",
      "defaultStyle": {
        "fontFamily": "define.custom_font",
        "boxBg": "define.caption_style.boxBg"
      }
    }
  ],
  "cues": [
    {
      "root": {
        "id": "group1", 
        "eType": "group",
        "style": "define.caption_style",
        "displayTime": "define.common_timing",
        "pluginChain": ["define.fade_animation"]
      }
    }
  ]
}
```

**동작**: 
- 렌더러가 "define.key" 형태의 값을 발견하면 define 필드에서 해당 키를 찾아 값을 치환
- 에셋 타입(font/image/video)별 자동 preload 및 무결성 검증
- FontFace 자동 등록/해제 및 fallback 처리

---

### 2. 필드명 리팩토링 - 명확한 용도 정의

| 기존 필드 | 새 필드명 | 용도 |
|-----------|-----------|------|
| `hintTime` | `domLifetime: [start, end]` | Cue DOM 요소의 생성/삭제 시점 |
| `absStart/absEnd` | `displayTime: [start, end]` | 노드가 화면에 표시될 시간 구간 |
| `relStart/relEnd` | `timeOffset: [start, end]` | 플러그인 실행 시점 오프셋 |
| `t0/t1` | `timeOffset: [start, end]` | 플러그인 매개변수 통일 |

---

### 3. 상속 및 우선순위 시스템

**값 결정 우선순위** (높음 → 낮음):
1. **직접 명시**: `"color": "#ff0000"` - 해당 위치에서 직접 작성한 값
2. **define 참조**: `"color": "define.brand_color"` - 명시적 참조 선택
3. **상속값**: 부모 노드에서 전달받은 값 (자동)
4. **기본값**: 시스템 기본값

**상속 규칙**: 모든 하위 노드는 상위 노드의 값을 기본값으로 상속받음

```json
{
  "root": {
    "id": "parent_group",
    "eType": "group", 
    "displayTime": [0.0, 5.0],
    "style": {
      "color": "#ffffff",
      "fontSizeRel": 0.05
    },
    "children": [
      {
        "id": "child1",
        "eType": "text",
        "text": "전체 구간 표시",
        // displayTime 생략 → [0.0, 5.0] 상속
        // style 상속받음
      },
      {
        "id": "child2", 
        "eType": "text",
        "text": "부분 구간 표시",
        "displayTime": [1.0, 3.0], // 명시적 지정
        "style": {
          "color": "#ff0000" // color만 오버라이드, 나머지는 상속
        }
      }
    ]
  }
}
```

---

### 4. 시간 표현 통일

**기존**:
```json
{
  "absStart": 2.0,
  "absEnd": 5.0,
  "relStart": 0.0,
  "relEnd": 1.0
}
```

**개선**:
```json
{
  "displayTime": [2.0, 5.0],
  "timeOffset": [0.0, 1.0]
}
```

**상대값 지원**: % 접미사로 상대값 표현
```json
{
  "displayTime": ["50%", "100%"], // 부모 구간의 50%~100% 지점
  "size": { "width": "80%", "height": "auto" }
}
```

---

### 5. 노드 ID 의무화

**목적**: 편집 도구에서 노드 식별 및 조작을 위한 고유 ID

```json
{
  "root": {
    "id": "main_caption", // 필수 필드
    "eType": "group",
    "children": [
      {
        "id": "word_1", // 모든 노드에 ID 필수
        "eType": "text",
        "text": "안녕하세요"
      }
    ]
  }
}
```

---

### 6. 플러그인 시스템 (v2.1 호환)

**기존 문제**: 플러그인마다 t0/t1, relStart/relEnd 등 다른 시간 매개변수 사용

**v2.1 기반 개선**:
- DOM 경계 분리: `baseWrapper` (렌더러) ↔ `effectsRoot` (플러그인)
- 시간 계산은 렌더러에서 담당, 플러그인은 즉시 실행
- 채널 충돌 방지를 위한 권한 기반 시스템

```json
{
  "pluginChain": [
    {
      "name": "fadeIn",
      "timeOffset": [0, 0.5],
      "params": { "startOpacity": 0.0 },
      "compose": "replace", // v2.1 합성 규칙
      "domScope": "effectsRoot", // DOM 조작 범위 명시
      "capabilities": ["style-vars"], // CSS 변수 채널 사용 권한
      "targets": ["text", "image"] // 적용 가능한 노드 타입
    },
    {
      "name": "slideUp",
      "timeOffset": [0.2, 0.8],
      "params": { "distance": "20%" },
      "compose": "add", // 변환값 누적
      "domScope": "effectsRoot",
      "capabilities": ["portal-breakout"], // breakout 권한
      "targets": ["text"]
    }
  ]
}
```

**DOM 구조 명세**:
```json
{
  "domArchitecture": {
    "version": "2.1",
    "baseWrapper": {
      "purpose": "레이아웃, 앵커, 채널(transform/opacity) 관리",
      "managedBy": "renderer",
      "cssVars": ["--mtx-sx", "--mtx-sy", "--mtx-tx", "--mtx-ty", "--mtx-rot", "--mtx-opacity"]
    },
    "effectsRoot": {
      "purpose": "플러그인 전용 DOM 조작 영역",
      "managedBy": "plugins",
      "allowedOperations": ["innerHTML", "style", "classList", "appendChild"]
    }
  }
}
```

**채널 충돌 방지**:
```json
{
  "channelComposition": {
    "strategy": "dom-separation", // 기본: DOM 분리
    "fallbackStrategy": "css-variables", // 폴백: CSS 변수 채널
    "conflictResolution": "last-wins" // 동일 채널 충돌 시
  }
}
```

---

### 7. domLifetime의 명확한 역할과 자동 계산

**기존 hintTime**: 용도가 모호함
**새로운 domLifetime**: Cue DOM 요소의 생성/삭제 시점 관리

```json
{
  "cues": [
    {
      "id": "caption_001",
      "track": "subtitle",
      "domLifetime": [1.8, 8.2], // DOM 생성~삭제 구간
      "root": {
        "id": "caption_group",
        "displayTime": [2.5, 7.5], // 실제 화면 표시 구간
        "children": [
          {
            "id": "text1",
            "displayTime": [2.0, 4.0],
            "pluginChain": [
              {
                "name": "fadeIn",
                "timeOffset": [-0.2, 0.0] // 표시 전 0.2초부터 시작
              }
            ]
          }
        ]
      }
    }
  ]
}
```

**domLifetime 자동 계산 규칙**:
```typescript
function calculateDomLifetime(cue: Cue): [number, number] {
  const childDisplayTimes = getAllChildDisplayTimes(cue.root);
  const pluginStartTimes = getAllPluginStartTimes(cue.root);
  
  // 시작: min(자식 displayTime 최소값, baseTime-timeOffset 최소값)
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
- domLifetime[0] - behavior.preloadMs = DOM 생성 시작
- domLifetime[1] + behavior.disposeMs = DOM 해제 시작
- 수동 지정 시 자동 계산값을 오버라이드

---

## 🔄 마이그레이션 가이드

### v1.3 → v1.4 변환 매핑

| v1.3 | v1.4 |
|------|------|
| `hintTime` | `domLifetime: [start, end]` |
| `absStart, absEnd` | `displayTime: [start, end]` |
| `relStart, relEnd` | `timeOffset: [start, end]` |
| 플러그인 `t0, t1` | `timeOffset: [start, end]` |

### 자동 변환 스크립트

```typescript
function migrateV13ToV14(scenario: ScenarioV13): ScenarioV14 {
  // hintTime → domLifetime (배열 형태로 변환)
  scenario.cues.forEach(cue => {
    if (cue.hintTime) {
      if (typeof cue.hintTime === 'object' && 'start' in cue.hintTime) {
        // 객체 형태 → 배열 형태
        cue.domLifetime = [cue.hintTime.start || 0, cue.hintTime.end || 0];
      }
      delete cue.hintTime;
    } else {
      // 자동 계산 적용
      cue.domLifetime = calculateDomLifetime(cue);
    }
  });
  
  // absStart/absEnd → displayTime
  walkNodes(scenario, node => {
    if (node.absStart !== undefined && node.absEnd !== undefined) {
      node.displayTime = [node.absStart, node.absEnd];
      delete node.absStart;
      delete node.absEnd;
    }
  });
  
  // 플러그인 시간 통일
  walkNodes(scenario, node => {
    if (node.pluginChain) {
      node.pluginChain.forEach(plugin => {
        // 다양한 시간 표현 → timeOffset 통일
        if (plugin.relStart !== undefined || plugin.relEnd !== undefined) {
          plugin.timeOffset = [plugin.relStart || 0, plugin.relEnd || 0];
          delete plugin.relStart;
          delete plugin.relEnd;
        }
        if (plugin.params?.t0 !== undefined || plugin.params?.t1 !== undefined) {
          plugin.timeOffset = [plugin.params.t0 || 0, plugin.params.t1 || 0];
          delete plugin.params.t0;
          delete plugin.params.t1;
        }
      });
    }
  });
}
```

---

## 📋 구현 우선순위

### **Phase 1: 기반 구조** (v1.4.0-alpha)
- Define 필드 및 참조 해석기 구현
- 버전 관리 체계 (`version: "1.4"`, `pluginApiVersion: "2.1"`)
- 필드명 변경 (domLifetime, displayTime, timeOffset)
- 상속 및 우선순위 시스템

### **Phase 2: 플러그인 통합** (v1.4.0-beta)  
- DOM 분리 구조 (baseWrapper/effectsRoot)
- v2.1 플러그인 API 호환성
- 채널 충돌 방지 시스템
- 권한 기반 capabilities/targets

### **Phase 3: 에셋 & 보안** (v1.4.0-rc)
- 에셋 관리 시스템 (font/image preload)
- 무결성 검증 (`integrity`, `signature`)
- 샌드박스 보안 규칙
- FontFace 자동 등록/해제

### **Phase 4: 완성 & 도구** (v1.4.0)
- 마이그레이션 도구 (v1.3→v1.4)
- 편집기 지원 API
- 성능 최적화
- 문서화 및 예제

---

## 🔒 보안 및 버전 체계

### **버전 관리**
```json
{
  "version": "1.4",
  "pluginApiVersion": "2.1", // 플러그인 런타임 API 세대
  "minRenderer": ">=1.4.0",  // 최소 렌더러 버전 요구사항
  "compatibility": {
    "backwardCompat": ["1.3"], // 자동 변환 지원
    "pluginCompat": ["2.0", "2.1"] // 지원하는 플러그인 API
  }
}
```

### **보안 체계**
```json
{
  "security": {
    "integrityValidation": true,  // 에셋 무결성 검증
    "pluginSandbox": {
      "domScope": "effectsRoot",   // DOM 접근 제한
      "capabilityBased": true,     // 권한 기반 API 접근
      "cspCompliant": true         // CSP 정책 준수
    },
    "assetPolicy": {
      "allowedOrigins": ["self", "cdn.example.com"],
      "integrityRequired": true,   // Prod 환경에서 필수
      "fallbackStrategy": "disable" // 검증 실패 시 비활성화
    }
  }
}
```

---

## 💡 추가 고려사항

### 1. 하위 호환성
- **단계적 전환**: v1.3 → v1.4 자동 마이그레이션
- **경고 시스템**: deprecated 필드 사용 시 경고
- **폴백 지원**: 구 필드명도 일시적 지원 (v1.5에서 제거 예정)

### 2. 성능 최적화
- **파싱 시점 해석**: define 참조를 런타임이 아닌 파싱 단계에서 해석
- **에셋 프리로딩**: 병렬 로딩 및 우선순위 기반 스케줄링
- **메모리 관리**: LRU 기반 에셋 캐시 및 참조 카운팅

### 3. 에러 처리 강화
- **순환 참조 검출**: `define.a → define.b → define.a` 방지
- **타입 안전성**: 스키마 기반 검증 및 명확한 오류 메시지
- **복구 전략**: 에러 발생 시 fallback 동작 정의

### 4. 개발자 도구
- **편집기 지원**: 노드 ID 기반 검색/수정 API
- **자동완성**: define 키 및 플러그인 파라미터 IntelliSense  
- **시각화 도구**: 상속 관계 및 시간축 표시
- **디버깅**: 플러그인별 로그 분리 및 성능 프로파일링

---

*이 문서는 MotionText Renderer v1.4 스펙 개선을 위한 초안입니다. 피드백과 추가 아이디어를 환영합니다.*