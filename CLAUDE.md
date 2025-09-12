# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# MotionText Renderer – Current Status & Context

## 🎯 프로젝트 개요

**MotionText Renderer**는 동영상 위에 정교한 자막과 애니메이션 효과를 렌더링하는 TypeScript 라이브러리입니다.

### 📊 현재 상태 (2025-09-07)
- **✅ M1-M4 완료**: 타입 시스템, 시간 유틸리티, 파서, 플러그인 체인 합성
- **🧪 120개 테스트 통과**: 모든 핵심 모듈 검증 완료
- **🎬 8개 데모 샘플**: 기본 텍스트부터 복잡한 애니메이션까지
- **🎮 커스텀 컨트롤러**: YouTube 스타일 UI/UX 구현

---

## 🏗 구현된 아키텍처

### 핵심 모듈 (완료 ✅)

#### 1. 타입 시스템 (M1)
```typescript
// src/types/scenario.ts - v1.3 JSON 스펙 타입 정의
interface Scenario {
  version: "1.3";
  timebase: { unit: "seconds", fps?: number };
  stage: { baseAspect: "16:9" | "9:16" | "auto" };
  tracks: Track[];
  cues: Cue[];
}
```

#### 2. 시간 유틸리티 (M2)
```typescript
// src/utils/time.ts - 시간 창 계산 및 진행도 관리
computeRelativeWindow(absStart, absEnd, spec) // 상대→절대 시간 변환
progress(now, t0, t1) // 0~1 진행도 계산
```

#### 3. 파서/검증 (M3)
```typescript
// src/parser/ScenarioParser.ts - 견고한 JSON 검증
parseScenario(json): Scenario // 스키마 검증 + 기본값 + 오류 처리
- 46개 테스트로 모든 케이스 검증
- absStart < absEnd, 트랙 참조, 필수 필드 체크
- 친절한 경로 기반 오류 메시지
```

#### 4. 플러그인 체인 (M4)
```typescript
// src/composer/PluginChainComposer.ts - 시간 창 기반 합성
composeActive(chain, now, absStart, absEnd, evalFn)
- 3가지 합성 모드: replace(기본)/add/multiply
- 22개 테스트로 합성 로직 검증

// src/runtime/plugins/Builtin.ts - 내장 플러그인
fadeIn/fadeOut: 투명도 애니메이션
pop: backOut 이징 스케일 효과
waveY: 사인파 상하 움직임
shakeX: 빠른 좌우 진동
```

#### 5. 스타일 적용 (M4)
```typescript
// src/runtime/StyleApply.ts - CSS 변환 최적화
buildTransform(base, channels) // 효율적 CSS transform 생성
applyChannels(element, baseTransform, channels) // DOM 적용
- 불필요한 변환 생략으로 성능 최적화
```

#### 6. 레이아웃 엔진 (일부 구현)
```typescript
// src/layout/LayoutEngine.ts - 정규화 좌표→픽셀 변환
- 앵커 기반 위치 계산 (tl/tc/tr/cl/cc/cr/bl/bc/br)
- rotate/scale/skew 변환 파이프라인
- M5에서 size/overflow/translate/safeArea 완전 구현 예정
```

#### 7. 데모 & 컨트롤러
```typescript
// src/controller/ - YouTube 스타일 UI
- 재생/일시정지/시킹/볼륨/전체화면 컨트롤
- 키보드 조작 (Space/←/→/ESC)
- 오토 히드 & 커서 숨김
- 자막 토글 기능
```

---

## 🧪 테스트 현황

**총 120개 테스트 모두 통과 ✅**

| 모듈 | 테스트 수 | 검증 영역 |
|------|----------|----------|
| `time.test.ts` | 20개 | 시간 창 계산, 진행도, 프레임 스냅 |
| `ScenarioParser.test.ts` | 46개 | JSON 스키마, 기본값, 오류 처리 |
| `PluginChainComposer.test.ts` | 22개 | 시간 필터링, 합성 모드 |
| `Builtin.test.ts` | 19개 | 5개 내장 플러그인 동작 |
| `StyleApply.test.ts` | 13개 | CSS transform 생성 |

---

## 🎬 데모 샘플

**8개 시나리오로 기능 검증**

1. **basic.json** - 단순 텍스트 렌더링
2. **animated.json** - fadeIn 플러그인 체인
3. **animated_subtitle.json** - 자막 체인 (fadeIn/pop/waveY)
4. **animated_free_mixed.json** - free 트랙 다위치 배치
5. **tilted_box.json** - 초기 30° 기울기 + 체인
6. **plugin.json** - 플러그인 합성 데모
7. **m5_layout_features.json** - M5 레이아웃 기능 프리뷰
8. **기타** - 다양한 시간 창 및 합성 케이스

---

## ⚠️ 핵심 설계 원칙

### 시간 기반 활성화
- **절대 시간**: 모든 요소는 `absStart` ~ `absEnd`로 활성화
- **상대 시간**: 플러그인은 `relStart/relEnd` 또는 `relStartPct/relEndPct`
- **마스터 클록**: `video.mediaTime` (requestVideoFrameCallback)

### 플러그인 계약
- **타임라인 소유권**: 렌더러가 동기화 담당, 플러그인은 상대 Timeline만 반환
- **채널 추상화**: `tx/ty/sx/sy/rot/opacity` 독립적 변환
- **합성 모드**: replace(last-wins)/add(누적)/multiply(배수)

### 보안 모델 (M7에서 구현 예정)
- **무결성 검증**: SHA-384 해시, 선택적 ed25519 서명
- **샌드박스**: 플러그인은 컨테이너 DOM만 접근, Portal API로 탈출
- **동적 로딩**: fetch → 검증 → Blob URL → import 순서

---

## 🚀 다음 마일스톤

### M5: 완전한 레이아웃 엔진 (진행 예정)
- translate/size/overflow/transformOrigin 파이프라인
- safeAreaClamp (stage/track 세이프 에어리어 병합)  
- flow/grid 레이아웃 모드
- overlapPolicy (push/stack/ignore)

### M6: 타임라인 컨트롤러 (진행 예정)
- requestVideoFrameCallback 기반 동기화
- seek/pause/play/rate API
- snapToFrame 옵션
- 드리프트 없는 배속 재생

### M7: 보안 로더 (진행 예정)
- ManifestValidator + AssetFetcher
- 무결성 검증 파이프라인
- 메모리 + localStorage 캐싱

### M8: 런타임 (진행 예정)
- PortalManager (breakout 시스템)
- DomMount/StyleApply 최적화
- CSS 변수 기반 테마

### M9-M11: 통합 & 문서화 (진행 예정)
- 전체 렌더러 오케스트레이션
- README 사용 가이드
- 배포 패키지 최적화

---

## 📦 JSON 스펙 요약

```json
{
  "version": "1.3",
  "timebase": { "unit": "seconds", "fps": 30 },
  "stage": { "baseAspect": "16:9" },
  "tracks": [
    { 
      "id": "subtitle", 
      "type": "subtitle", 
      "layer": 10,
      "overlapPolicy": "push",
      "defaultStyle": { "fontSizeRel": 0.05 }
    }
  ],
  "cues": [
    {
      "id": "cue-1",
      "track": "subtitle", 
      "root": {
        "e_type": "text",
        "text": "Hello World",
        "absStart": 1.0,
        "absEnd": 5.0,
        "layout": { 
          "position": { "x": 0.5, "y": 0.9 },
          "anchor": "bc"
        },
        "pluginChain": [
          { "name": "fadeIn", "relStart": 0, "relEnd": -1 }
        ]
      }
    }
  ]
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
├── types/           # M1: TypeScript 타입 정의
├── utils/time.ts    # M2: 시간 계산 유틸리티
├── parser/          # M3: ScenarioParser (JSON 검증)
├── composer/        # M4: PluginChainComposer (합성)
├── runtime/         # M4: StyleApply, plugins/Builtin
├── layout/          # M5: LayoutEngine (일부 구현)
├── controller/      # 커스텀 UI 컨트롤러
└── index.ts         # 메인 API 진입점

demo/
├── index.html       # 8개 샘플 선택 드롭다운
├── main.ts          # 데모 통합 로직
└── samples/         # JSON 시나리오 파일들

__tests__/           # 120개 테스트 (5개 모듈)
```

---

## 💡 사용 예시

```typescript
import { MotionTextRenderer } from 'motiontext-renderer';

// 렌더러 초기화
const renderer = new MotionTextRenderer();

// 비디오 연결
await renderer.attachMedia(videoElement);

// 시나리오 로드
await renderer.loadConfig(scenarioJson);

// 재생/일시정지/시킹
renderer.play();
renderer.pause();
renderer.seek(10.5);
```

---

## 📈 성능 특징

- **비활성 플러그인 조기 필터링**: 시간 창 밖 플러그인 스킵
- **CSS 변환 최적화**: 불필요한 transform 생략
- **리플로우 최소화**: ResizeObserver + throttle (M5)
- **테스트 주도**: 120개 테스트로 회귀 방지

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
- **Vitest**: 120개 테스트 (5개 모듈별 분할)
- **단일 테스트**: `pnpm test src/utils/__tests__/time.test.ts` 
- **커버리지**: `pnpm test:coverage` (c8 기반)

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

*최종 업데이트: 2025-09-09 - M4 플러그인 체인 합성 완료*
- @refactoringv2.md 앞쪽에 서술된 프롬프트를 보고 컨텍스트를 불러올 것, @refactoringv2.md 에 작업 완료사항을 업데이트할 것
- 패키지매니저로 pnpm을 쓸 것