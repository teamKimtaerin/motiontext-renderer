# MotionText Plugin Manifest.json 표준

## 개요

이 문서는 MotionText 플러그인의 `manifest.json` 파일 작성 표준을 정의합니다. 모든 플러그인은 이 표준을 따라 일관된 사용자 경험과 개발자 경험을 제공해야 합니다.

## 표준 구조

### 기본 Manifest 구조

```json
{
  "name": "plugin-name",
  "version": "2.0.0",
  "type": "dom|canvas|hybrid|channel",
  "pluginApi": "3.0",
  "minRenderer": "2.0.0",
  "entry": "index.mjs",
  "targets": ["text"],
  "capabilities": ["style-vars", "dom-manipulation"],
  "peer": { "gsap": "^3.12.0" },
  "preload": [],
  "timeOffset": [-0.3, 0.3],
  "schema": {
    // 파라미터 정의
  }
}
```

### Schema 파라미터 표준 형식

모든 schema 파라미터는 다음 형식을 따라야 합니다:

```json
"parameterName": {
  "type": "number|string|boolean|object",
  "default": "기본값",
  "min": 0,           // number 타입인 경우
  "max": 100,         // number 타입인 경우
  "step": 0.1,        // number 타입인 경우
  "pattern": "^regex$", // string 타입인 경우
  "ui": {
    "control": "slider|color|text|checkbox|object",
    "allowDefine": true,
    "unit": "px|Hz|%"  // 필요시
  },
  "i18n": {
    "label": {
      "ko": "한국어 라벨",
      "en": "English Label"
    },
    "description": {
      "ko": "한국어 설명",
      "en": "English Description"
    }
  }
}
```

## 데이터 타입별 가이드라인

### Number 타입

```json
"amplitude": {
  "type": "number",
  "default": 10,
  "min": 0,
  "max": 100,
  "step": 1,
  "ui": {
    "control": "slider",
    "allowDefine": true,
    "unit": "px"
  },
  "i18n": {
    "label": { "ko": "진폭", "en": "Amplitude" },
    "description": { "ko": "효과의 강도를 조절합니다", "en": "Controls the intensity of the effect" }
  }
}
```

### String 타입

```json
"textInput": {
  "type": "string",
  "default": "",
  "pattern": "^[a-zA-Z0-9]*$",
  "ui": {
    "control": "text",
    "allowDefine": true
  },
  "i18n": {
    "label": { "ko": "텍스트 입력", "en": "Text Input" },
    "description": { "ko": "입력할 텍스트", "en": "Text to input" }
  }
}
```

### Color 타입

```json
"color": {
  "type": "string",
  "default": "#FF0000",
  "pattern": "^#[0-9a-fA-F]{6}$",
  "ui": {
    "control": "color",
    "allowDefine": true
  },
  "i18n": {
    "label": { "ko": "색상", "en": "Color" },
    "description": { "ko": "효과에 사용할 색상", "en": "Color for the effect" }
  }
}
```

### Boolean 타입

```json
"enabled": {
  "type": "boolean",
  "default": true,
  "ui": {
    "control": "checkbox",
    "allowDefine": true
  },
  "i18n": {
    "label": { "ko": "활성화", "en": "Enabled" },
    "description": { "ko": "효과를 활성화합니다", "en": "Enables the effect" }
  }
}
```

### Object 타입 (중첩 파라미터)

```json
"complexParameter": {
  "type": "object",
  "default": { "scale": 1.5, "offset": 10 },
  "ui": {
    "control": "object",
    "allowDefine": true
  },
  "i18n": {
    "label": { "ko": "복합 파라미터", "en": "Complex Parameter" },
    "description": { "ko": "여러 값을 포함하는 설정", "en": "Settings containing multiple values" }
  },
  "properties": {
    "scale": {
      "type": "number",
      "default": 1.5,
      "min": 0.1,
      "max": 3.0,
      "step": 0.1,
      "ui": {
        "control": "slider",
        "allowDefine": true
      },
      "i18n": {
        "label": { "ko": "크기", "en": "Scale" },
        "description": { "ko": "확대/축소 비율", "en": "Scale ratio" }
      }
    },
    "offset": {
      "type": "number",
      "default": 10,
      "min": 0,
      "max": 50,
      "step": 1,
      "ui": {
        "control": "slider",
        "unit": "px",
        "allowDefine": true
      },
      "i18n": {
        "label": { "ko": "오프셋", "en": "Offset" },
        "description": { "ko": "위치 이동량", "en": "Position offset" }
      }
    }
  }
}
```

## UI 컨트롤 타입

### 지원되는 컨트롤 타입

| 컨트롤 | 데이터 타입 | 설명 |
|--------|-------------|------|
| `slider` | number | 슬라이더로 숫자 값 조절 |
| `color` | string | 색상 선택기 |
| `text` | string | 텍스트 입력 필드 |
| `checkbox` | boolean | 체크박스 |
| `object` | object | 중첩된 객체 파라미터 |

### UI 옵션

- `allowDefine: true` - 사용자가 직접 값을 입력할 수 있도록 허용
- `unit: "px|Hz|%"` - 값의 단위 표시 (슬라이더에만 적용)

## 네이밍 규칙

### 파라미터 이름
- **camelCase** 사용: `amplitudePx`, `animationDuration`
- **설명적 이름** 사용: `speed` 대신 `animationSpeed`
- **일관성 유지**: 유사한 기능은 유사한 이름 사용

### 라벨과 설명
- **한국어**: 명확하고 간결한 표현
- **영어**: 기술적 정확성과 이해도 고려
- **일관성**: 유사한 파라미터는 유사한 표현 사용

## 값 제약 가이드라인

### Number 타입 제약
- `min/max`: 의미 있는 범위 설정
- `step`: 사용자 경험을 고려한 적절한 간격
- `default`: 일반적으로 좋은 결과를 내는 값

### String 타입 제약
- `pattern`: 입력 검증이 필요한 경우 정규식 사용
- 색상의 경우: `^#[0-9a-fA-F]{6}$`

## 특수 플러그인 고려사항

### CWI (Character Word Index) 시리즈
CWI 플러그인들은 화자별 색상 시스템을 위한 추가 파라미터를 포함합니다:

```json
"speaker": {
  "type": "string",
  "default": "",
  "ui": { "control": "text", "allowDefine": true },
  "i18n": {
    "label": { "ko": "화자 ID", "en": "Speaker ID" },
    "description": { "ko": "화자별 색상을 적용할 때 사용되는 화자 식별자", "en": "Speaker identifier for color mapping" }
  }
},
"palette": {
  "type": "object",
  "default": {},
  "ui": { "control": "object", "allowDefine": true },
  "i18n": {
    "label": { "ko": "색상 팔레트", "en": "Color Palette" },
    "description": { "ko": "화자별 색상 매핑 객체", "en": "Speaker-to-color mapping object" }
  }
}
```

## 마이그레이션 가이드

### 기존 형식에서 표준 형식으로 변환

#### Before (레거시 형식)
```json
"amplitude": {
  "type": "number",
  "label": "진폭",
  "description": "효과의 강도",
  "default": 10,
  "min": 0,
  "max": 100
}
```

#### After (표준 형식)
```json
"amplitude": {
  "type": "number",
  "default": 10,
  "min": 0,
  "max": 100,
  "step": 1,
  "ui": {
    "control": "slider",
    "allowDefine": true
  },
  "i18n": {
    "label": { "ko": "진폭", "en": "Amplitude" },
    "description": { "ko": "효과의 강도", "en": "Effect intensity" }
  }
}
```

## 검증 체크리스트

플러그인 manifest.json 작성 시 다음 항목들을 확인하세요:

- [ ] 모든 파라미터에 `i18n` 객체 포함
- [ ] 한국어(`ko`)와 영어(`en`) 라벨/설명 모두 작성
- [ ] 적절한 `ui.control` 타입 지정
- [ ] `ui.allowDefine: true` 포함
- [ ] number 타입에 `min`, `max`, `step` 지정
- [ ] string 타입에 필요시 `pattern` 지정
- [ ] 의미 있는 `default` 값 설정
- [ ] 중첩 객체는 `properties` 필드로 정의
- [ ] 단위가 있는 값에 `ui.unit` 추가

## 예제 플러그인

완전한 예제는 `cwi-loud@2.0.0`, `cwi-bouncing@2.0.0` 등의 CWI 시리즈 플러그인을 참조하세요.

---

**버전**: 1.0
**최종 업데이트**: 2024년 1월
**담당자**: MotionText 개발팀