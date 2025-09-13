# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# MotionText Renderer – Current Status & Context

## 🎯 프로젝트 개요

**MotionText Renderer**는 동영상 위에 정교한 자막과 애니메이션 효과를 렌더링하는 TypeScript 라이브러리입니다.

### 📊 현재 상태 (2025-09-13)
- **✅ M1-M6 완료**: 타입 시스템, 시간 유틸리티, 파서, 플러그인 체인 합성, v2.0 네이티브 렌더러
- **🧪 120개 테스트 통과**: 모든 핵심 모듈 검증 완료
- **🎬 17개 플러그인**: 내장 플러그인 + 외부 플러그인 로더 시스템
- **🎮 커스텀 컨트롤러**: YouTube 스타일 UI/UX 구현
- **⚡ v2.0 Native**: v2.0 JSON을 직접 처리하는 네이티브 렌더러 완성

---

## 🏗 구현된 아키텍처

### 핵심 모듈 (완료 ✅)

#### 1. v2.0 Native 타입 시스템
```typescript
// src/types/scenario-v2.ts - v2.0 JSON 스펙 타입 정의
interface Scenario {
  version: "2.0";
  timebase: { unit: "seconds", fps?: number };
  stage: { baseAspect: "16:9" | "9:16" | "auto" };
  tracks: Track[];
  cues: Cue[];
  define?: DefineSection; // Define 시스템
}

// v2.0의 시간 배열 기반 설계
displayTime: [number, number]; // [start, end]
domLifetime?: [number, number]; // DOM 생명주기
time_offset?: [number, number]; // 플러그인 상대 시간
```

#### 2. v2.0 시간 유틸리티 (M3)
```typescript
// src/utils/time-v2.ts - 배열 기반 시간 계산
isWithinTimeRange(time: number, range: [number, number]): boolean
progressInTimeRange(time: number, range: [number, number]): number
computePluginWindow(displayTime: [number, number], offset: [number, number]): [number, number]
```

#### 3. v2.0 Native 파서/검증 (M2)
```typescript
// src/parser/ScenarioParserV2.ts - v2.0 전용 파서
parseScenario(json): Scenario // 스키마 검증 + DefineResolver 통합
- DefineResolver를 통한 "define.key" 참조 해석
- InheritanceV2로 스타일/시간 상속 처리
- ValidationV2로 v2.0 필드 검증
```

#### 4. v2.0 Native 렌더러 코어 (M4)
```typescript
// src/core/RendererV2.ts - v2.0 네이티브 렌더러
class RendererV2 {
  // v2.0 필드 직접 처리 (변환 없음)
  private processNode(node: ResolvedNodeUnion, currentTime: number) {
    const [start, end] = node.displayTime ?? [-Infinity, Infinity];
    const active = isWithinTimeRange(currentTime, [start, end]);
    // ...
  }
}

// src/core/TimelineControllerV2.ts - requestVideoFrameCallback 동기화
// src/core/CueManagerV2.ts - domLifetime 기반 DOM 생명주기
```

#### 5. Plugin API v3.0 (M5)
```typescript
// src/composer/PluginChainComposerV2.ts - time_offset 기반 합성
composeActivePlugins(chain: PluginSpec[], currentTime: number, displayTime: [number, number])

// src/runtime/plugins/BuiltinV2.ts - 17개 내장 플러그인
fadeIn, fadeOut, pop, waveY, shakeX, // 기본 애니메이션
cwi-color, cwi-loud, cwi-whisper, cwi-bouncing, // CWI 시리즈
elastic, flames, glitch, glow, magnetic, pulse, rotation, scalepop, slideup, spin, typewriter
```

#### 6. 외부 플러그인 시스템 (M6.5)
```typescript
// src/loader/dev/DevPluginRegistry.ts + DevPluginLoader.ts
// 3가지 모드: server/local/auto
// PluginContextV3로 assets.getUrl() 지원
configurePluginSource({ mode: 'auto', serverBase: 'http://localhost:3300' });
registerExternalPlugin({ name, version, module, baseUrl });
```

#### 7. Define 사전 해석 시스템 (M5.5)
```typescript
// RendererV2에서 플러그인 호출 전 Define 참조 완전 해석
resolveAllDefines(pluginParams) // "define.speakerPalette" → 실제 객체
// 플러그인은 해석된 값만 받아서 코드 단순화
```

---

## 🧪 테스트 현황

**총 120개+ 테스트 모두 통과 ✅**

| 모듈 | 테스트 수 | 검증 영역 |
|------|----------|----------|
| `time-v2.test.ts` | 36개 | v2.0 시간 배열 계산, 진행도 |
| `V20Integration.test.ts` | 25개 | v2.0 통합 시나리오 |
| `V20SampleValidation.test.ts` | 20개 | Define 시스템 + 샘플 검증 |
| `PluginChainComposerV2.test.ts` | 28개 | v2.0 플러그인 합성 |
| `기타 모듈` | 30개+ | 파서, 레이아웃, DOM 처리 |

---

## 🎬 데모 샘플

**v2.0 샘플로 전환 완료**

1. **basic.json** - v2.0 기본 텍스트 렌더링
2. **animated_subtitle.json** - v2.0 자막 체인 (fadeIn/pop/waveY)
3. **plugin_showcase.json** - 17개 플러그인 데모
4. **cwi_demo_full.json** - CWI 시리즈 완전 데모
5. **with_assets_v20.json** - Define 시스템 + 에셋 관리
6. **m5_layout_features.json** - 레이아웃 엔진 기능

---

## ⚠️ 핵심 설계 원칙

### v2.0 Native Architecture
- **No v1.3**: v1.3 코드 완전 제거, v2.0만 지원
- **배열 기반 시간**: 모든 시간 필드는 `[start, end]` 형태
- **Define 시스템**: "define.key" 참조를 런타임에 해석
- **Plugin API v3.0**: 단순화된 플러그인 인터페이스

### 렌더러와 플러그인 책임 분리
- **렌더러**: baseWrapper 제어 (레이아웃, 위치, DOM 생명주기)
- **플러그인**: effectsRoot 제어 (애니메이션, 시각 효과)
- **Define 해석**: 렌더러가 사전 해석 후 플러그인에 전달

### 플러그인 계약
- **상대 진행도**: 플러그인은 0~1 progress만 받음
- **해석된 파라미터**: Define 참조는 렌더러가 사전 해석
- **샌드박스**: effectsRoot 하위만 조작 가능

---

## 🚀 다음 마일스톤

### M7: 테스트 마이그레이션 및 최적화 (진행 예정)
- 모든 테스트를 v2.0 기준으로 재작성
- 성능 최적화 (시간 배열 캐싱, DOM 업데이트 최소화)
- v1.3 레거시 코드 완전 제거

### M8: 프로덕션 준비
- 메모리 사용량 최적화
- 에러 핸들링 강화
- 문서화 완료

---

## 📦 JSON 스펙 요약

```json
{
  "version": "2.0",
  "timebase": { "unit": "seconds", "fps": 30 },
  "stage": { "baseAspect": "16:9" },
  "define": {
    "speakerColors": {
      "SPEAKER_01": "#4AA3FF",
      "SPEAKER_02": "#FF4D4D"
    }
  },
  "tracks": [{
    "id": "subtitle",
    "type": "subtitle",
    "layer": 10,
    "defaultStyle": { "fontSize": "2rem" }
  }],
  "cues": [{
    "id": "cue-1",
    "track": "subtitle",
    "displayTime": [1.0, 5.0],
    "domLifetime": [0.5, 5.5],
    "root": {
      "id": "text1",
      "e_type": "text",
      "text": "Hello World",
      "layout": {
        "position": { "x": 0.5, "y": 0.9 },
        "anchor": "bc"
      },
      "pluginChain": [{
        "name": "fadeIn",
        "time_offset": [0, 0.5]
      }]
    }
  }]
}
```

---

## 🛠 개발 명령어

```bash
# 개발 서버 실행 (localhost:3000, demo 모드)
pnpm dev

# 플러그인 서버 실행 (개발용)
pnpm plugin:server

# 테스트 실행
pnpm test              # 전체 테스트 (Vitest watch 모드)
pnpm test:run          # 단일 실행 (CI용)
pnpm test:ui           # Vitest UI
pnpm test:coverage     # 커버리지 포함

# 코드 품질
pnpm lint              # ESLint 실행
pnpm lint:fix          # ESLint 자동 수정
pnpm format            # Prettier 포맷팅
pnpm format:check      # 포맷팅 검사
pnpm typecheck         # TypeScript 타입 체크

# 빌드
pnpm build             # 라이브러리 빌드 (ES/CJS)
pnpm dev:build         # 빌드 watch 모드
pnpm clean             # dist 폴더 정리

# 통합 검증
pnpm verify            # lint + format + typecheck + test (CI 동일)

# 릴리스 관리
pnpm changeset         # 변경사항 기록
pnpm version           # 버전 업데이트
pnpm release           # NPM 배포
```

---

## 📁 프로젝트 구조

```
src/
├── types/              # v2.0 타입 정의
│   ├── scenario-v2.ts  # v2.0 시나리오 타입
│   ├── plugin-v3.ts    # Plugin API v3.0
│   └── layout.ts       # 레이아웃 타입
├── core/               # v2.0 렌더러 코어
│   ├── RendererV2.ts   # 메인 렌더러
│   ├── TimelineControllerV2.ts  # 시간 동기화
│   └── CueManagerV2.ts # DOM 생명주기
├── parser/             # v2.0 파서
│   ├── ScenarioParserV2.ts  # v2.0 전용 파서
│   ├── DefineResolver.ts    # Define 시스템
│   └── InheritanceV2.ts     # 상속 처리
├── utils/
│   └── time-v2.ts      # v2.0 시간 유틸리티
├── composer/
│   └── PluginChainComposerV2.ts  # v2.0 플러그인 합성
├── runtime/
│   ├── plugins/BuiltinV2.ts      # 17개 내장 플러그인
│   └── PluginContextV3.ts        # Plugin API v3.0 컨텍스트
├── loader/dev/         # 개발용 플러그인 로더
└── index.ts            # v2.0 Native API 진입점

demo/
├── index.html          # 데모 페이지
├── main.ts             # v2.0 전용 데모 로직
├── samples/            # v2.0 샘플 파일들
└── plugin-server/      # 17개 플러그인 서버
```

---

## 💡 사용 예시

```typescript
import { MotionTextRenderer } from 'motiontext-renderer';

// 렌더러 초기화
const renderer = new MotionTextRenderer(containerElement);

// v2.0 시나리오 로드 (네이티브 처리)
await renderer.loadConfig(scenarioV20Json);

// 비디오 연결 (requestVideoFrameCallback 동기화)
renderer.attachMedia(videoElement);

// 외부 플러그인 등록
import { registerExternalPlugin } from 'motiontext-renderer';

registerExternalPlugin({
  name: 'myEffect',
  version: '1.0.0',
  module: await import('/plugins/myEffect@1.0.0/index.mjs'),
  baseUrl: '/plugins/myEffect@1.0.0/'
});
```

---

## 📈 성능 특징

- **v2.0 Native**: 변환 레이어 없이 직접 처리로 성능 최적화
- **Define 사전 해석**: 런타임 참조 해석 최소화
- **시간 배열 캐싱**: computePluginWindow 결과 캐시
- **DOM 생명주기**: domLifetime 기반 효율적 DOM 관리
- **플러그인 필터링**: 시간 창 밖 플러그인 조기 제외

---

---

## 🛠️ 개발 환경 설정

### 필수 요구사항
- **Node.js**: >= 18.0.0
- **pnpm**: >= 8.0.0 (필수, npm/yarn 사용 불가)
- **TypeScript**: 프로젝트에 포함됨

### 개발 서버 모드
- **Demo 모드**: `pnpm dev` → `demo/` 폴더를 루트로 Vite 서버 실행 (port 3000)
- **라이브러리 빌드**: `pnpm build` → ES/CJS 모듈 생성 (`dist/`)

### 테스트 환경
- **Vitest**: jsdom 환경에서 120개+ 테스트
- **단일 테스트**: `pnpm test src/utils/__tests__/time-v2.test.ts`
- **커버리지**: `pnpm test:coverage` (v8 기반)

### 플러그인 개발
- **로컬 서버**: `pnpm plugin:server` → `http://localhost:3300`
- **플러그인 경로**: `demo/plugin-server/plugins/<name@version>/`
- **매니페스트**: `manifest.json` + `index.mjs` 필수

---

## ⚡ 성능 및 디버깅

### 빌드 최적화
- **Terser 압축**: 프로덕션 빌드 활성화
- **소스맵**: 디버깅용 `.map` 파일 생성
- **외부 의존성**: GSAP은 peerDependency로 제외
- **트리쉐이킹**: ES 모듈 기반 데드코드 제거

### 타입 안전성
- **Strict 모드**: `tsconfig.json`에서 엄격한 타입 체크
- **Path alias**: `@/*` → `src/*` 매핑
- **Declaration 생성**: `.d.ts` 파일 자동 생성

---

*최종 업데이트: 2025-09-13 - M6 v2.0 네이티브 렌더러 완성*
- @refactoringv2.md 앞쪽에 서술된 프롬프트를 보고 컨텍스트를 불러올 것, @refactoringv2.md 에 작업 완료사항을 업데이트할 것
- 패키지매니저로 pnpm을 쓸 것