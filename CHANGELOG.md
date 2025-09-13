# @teamkimtaerin/motiontext-renderer

## 1.0.0

### Major Changes

- # feat: MotionText Renderer v2.0 네이티브 구현

  ## 💔 호환성 변경사항 (Breaking Changes)

  ### v1.3 완전 제거
  - **완전한 v1.3 제거**: 하위 호환성 없음
  - **필드명 변경**:
    - `absStart/absEnd` → `displayTime: [start, end]`
    - `relStart/relEnd` → `time_offset: [start, end]`
    - `hintTime` → `domLifetime: [start, end]`
  - **API 변경**: v2.0 전용 지원을 갖춘 새로운 MotionTextRenderer 클래스

  ## 🚀 주요 개선사항

  ### 핵심 아키텍처 변환
  - **v2.0 네이티브 렌더러**: v1.3 변환 레이어 없이 v2.0 JSON 시나리오를 직접 처리
  - **배열 기반 시간 시스템**: 모든 시간 필드가 `[start, end]` 형식 사용
  - **플러그인 API v3.0**: 향상된 성능과 보안을 갖춘 단순화된 플러그인 인터페이스

  ### 새로운 기능
  - **Define 시스템**: 중앙화된 구성 관리로 최대 75% 파일 크기 감소
  - **17개 내장 플러그인**: CWI 시리즈를 포함한 완전한 애니메이션 라이브러리
  - **외부 플러그인 지원**: server/local/auto 모드를 통한 동적 로딩
  - **에셋 관리**: 폰트, 이미지, 오디오, 비디오 에셋 통합 관리

  ### 성능 개선
  - **네이티브 처리**: v1.3 변환 오버헤드 제거
  - **Define 사전 해석**: 런타임 참조 해석 최소화
  - **DOM 라이프사이클 최적화**: domLifetime 기반 효율적 관리

  ## 🔄 마이그레이션 방법

  v1.3에서 마이그레이션하려면:
  1. **마이그레이션 도구 사용**:
     ```typescript
     import { V13ToV20Migrator } from 'motiontext-renderer';
     const migrator = new V13ToV20Migrator();
     const v20Scenario = migrator.migrate(v13Scenario);
     ```
  2. **새로운 API 사용**:

     ```typescript
     // v1.3 (이전)
     const renderer = new MotionTextRenderer();

     // v2.0 (새로운 방식)
     import { MotionTextRenderer } from 'motiontext-renderer';
     const renderer = new MotionTextRenderer(containerElement);
     await renderer.loadConfig(scenarioV20Json);
     ```

  3. **시간 필드 업데이트**:

     ```typescript
     // v1.3
     { absStart: 1.0, absEnd: 5.0 }

     // v2.0
     { displayTime: [1.0, 5.0] }
     ```

  자세한 가이드는 `v2-migration-guide.md`를 참조하세요.

  ## 📊 통계
  - **135개 파일 변경**: 52,548개 추가, 6,516개 삭제
  - **120개 이상의 테스트**: 모든 모듈 포괄적 커버리지
  - **17개 내장 플러그인**: 완전한 애니메이션 효과 라이브러리

### Patch Changes

- fix(test): align with v2.0 spec for time semantics and stabilize JSDOM-based tests

  Summary
  - Update tests and small expectations to match the v2.0 spec described in `context/scenario-json-spec-v-2-0.md` and the scope in `PR_DESCRIPTION.md`.

  Details
  - time_offset semantics: migrate expectations to percentage strings (e.g. ["0%","60%"]), and ensure base-time interpretation uses the v2.0 rule (see spec “time_offset 철학 변경”).
  - DefineResolver: adjust circular-reference error assertion to include full reference path (e.g. "define.a -> define.a").
  - JSDOM stability: avoid replacing global `document`; mock `document.fonts`, `FontFace`, `Image`, and `Audio` in a scoped way for reliable behavior in Node test env.
  - Integration test: mock asset loading to prevent timeouts while still validating define-extraction and flow.
  - DomSeparation: assert CSS variable initialization directly instead of relying on computed opacity formatting in jsdom.

  Impact
  - No runtime API changes; patch-level update. Improves test reliability and aligns tests with the finalized v2.0 time and plugin semantics.

  References
  - v2.0 Spec: `context/scenario-json-spec-v-2-0.md`
  - PR overview: `PR_DESCRIPTION.md`

## 0.3.2

### Patch Changes

- 079029b: Add definitions section support and enhance CWI plugin system

  ## Definitions Section Support
  - **NEW**: Added `definitions` field to Scenario JSON v1.3 spec
  - **NEW**: Runtime definitions resolution in renderer (`"definitions.key"` → actual value)
  - **Performance**: Enables significant file size reduction by eliminating data duplication
  - **Example**: `"palette": "definitions.speakerPalette"` resolves to actual palette object

  ## CWI Plugin Enhancement
  - **BREAKING**: Split monolithic `cwi@1.0.0` plugin into 4 focused plugins:
    - `cwi-color@1.0.0` - Color transition animation
    - `cwi-loud@1.0.0` - Large scale with trembling (2.4x + vibration)
    - `cwi-whisper@1.0.0` - Small scale animation (0.6x)
    - `cwi-bouncing@1.0.0` - Pop/bouncing wave animation (1.15x + vertical motion)
  - Enhanced palette resolution with multi-level fallback system
  - Improved Korean labels and descriptions in plugin manifests

  ## File Size Optimization
  - **Performance**: Reduced `cwi_demo_full.json` file size by ~75% (800KB → 206KB)
  - **Maintenance**: Centralized palette management - change colors in one place
  - **Scalability**: Definitions section supports any shared data, not just palettes

  ## Technical Implementation
  - Added `definitions?: Record<string, any>` to `ScenarioFileV1_3` type
  - Updated `ScenarioParser.ts` to handle definitions section
  - Enhanced `Renderer.ts` with `resolveDefinitions()` method for both `init` and `evalChannels` paths
  - Updated 360+ plugin instances in sample files to use definitions references

  ## Migration Guide

  ### For CWI Plugins

  ```json
  // Before
  { "name": "cwi", "kind": "color" }

  // After
  { "name": "cwi-color" }
  ```

  ### For Palette Configuration

  ```json
  {
    "definitions": {
      "speakerPalette": {
        "SPEAKER_01": "#4AA3FF",
        "SPEAKER_02": "#FF4D4D"
      }
    },
    "cues": [
      {
        "pluginChain": [
          {
            "name": "cwi-color@1.0.0",
            "params": {
              "speaker": "SPEAKER_01",
              "palette": "definitions.speakerPalette"
            }
          }
        ]
      }
    ]
  }
  ```

## 0.3.1

### Patch Changes

- 9c95552: chore(dev): add pnpm scripts for verify (lint/format/typecheck/test) and release:all (verify+build+publish) to streamline local/CI releases.

## 0.3.0

### Minor Changes

- feat(dev): add plugin origin init (M6.8), server/local/auto modes, and local file import path
  - configureDevPlugins({ mode, serverBase, localBase }) to configure plugin source
  - server mode: fetch manifest/entry from serverBase
  - local mode: import project‑bundled plugins via import.meta.glob (no dev plugin server required)
  - auto mode: server first, fallback to local on failure
  - preloadFromScenario updated to honor strict mode ordering
  - demo adds runtime mode switch example and UI buttons

  Notes:
  - This is a dev‑only improvement for plugin loading convenience; production secure loader remains planned (M7).

## 0.2.0

### Minor Changes

- 2f9059c: Initial release of MotionText Renderer
  - Complete M1-M4 implementation with TypeScript types, time utilities, parser, and plugin chain composition
  - 120 tests passing across all core modules
  - 8 demo samples showcasing features from basic text to complex animations
  - Custom YouTube-style UI controller
  - Plugin system with built-in effects (fadeIn/fadeOut/pop/waveY/shakeX)
  - Comprehensive JSON v1.3 spec support

## 0.1.0

### Minor Changes

- Add core renderer functionality with GSAP integration
