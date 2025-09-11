# motiontext-renderer 폴더 구조와 각 파일 역할

이 문서는 현재 리포지토리의 폴더/파일 구조와 각 파일의 책임을 정리합니다. 동작의 세부 규칙은 다음 문서를 기준으로 합니다.

- 시나리오(JSON) 상세 스펙: `context/scenario-json-spec-v-2-0.md`
- 플러그인 시스템 상세 스펙: `context/plugin-system-architecture-v-3-0.md`
- 개요 요약: `context/init-context.md`

핵심 원칙 요약:
- 타임라인 소유권은 렌더러에 있음. 플러그인은 상대 Timeline 또는 seek 함수형만 제공.
- pluginChain은 각 항목별 relStart/relEnd 또는 relStartPct/relEndPct로 실행 창(window)을 정의. 충돌 시 기본 last-wins, 필요시 compose: "add"/"multiply" 지정.
- breakout 기본 transfer는 "move".
- 보안 로딩 순서: fetch → 무결성(해시/서명) 검증 → Blob URL import.
 - 변환 순서: 레이아웃(base) → 플러그인(channels) 합성 순서 고정.

---

## 폴더 트리

```text
.
├─ context/
│  ├─ init-context.md
│  ├─ scenario-json-spec-v-2-0.md
│  ├─ plugin-system-architecture-v-3-0.md
│  ├─ ai-bootstrap-prompt.md
│  └─ folder-structure.md  ← (본 문서)
├─ demo/
│  ├─ index.html
│  ├─ main.ts
│  ├─ style.css
│  ├─ devPlugins.ts                 # (M6.5) Dev 플러그인 초기화/사전 로드 진입점
│  ├─ ui/                           # (M6.5, 선택) 데모 전용 UI 헬퍼
│  │  └─ safeAreaDev.ts
│  └─ samples/
│     ├─ basic.json
│     ├─ animated.json
│     ├─ animated_subtitle.json
│     ├─ animated_free_mixed.json
│     ├─ tilted_box.json
│     ├─ m5_layout_features.json
│     └─ plugin.json
│
│  └─ plugin-server/                # (M6.5) 로컬 플러그인 서버 루트 (Dev 전용)
│     ├─ server.js                  # Node http 정적 서버(ESM), CORS 허용
│     └─ plugins/
│        ├─ spin@1.0.0/
│        │  ├─ manifest.json
│        │  └─ index.mjs
│        ├─ bobY@1.0.0/
│        │  ├─ manifest.json
│        │  └─ index.mjs
│        └─ pulse@1.0.0/
│           ├─ manifest.json
│           └─ index.mjs
├─ dist/                     # 빌드 산출물(자동 생성)
├─ sample/
│  └─ scenario/scenario.json5
├─ src/
│  ├─ composer/
│  │  └─ PluginChainComposer.ts
│  ├─ core/
│  │  ├─ Composition.ts
│  │  ├─ CueGraph.ts
│  │  ├─ NodeRuntime.ts
│  │  ├─ Renderer.ts
│  │  ├─ SeekSync.ts
│  │  ├─ TrackManager.ts
│  │  ├─ Stage.ts
│  │  └─ TimelineController.ts
│  ├─ layout/
│  │  ├─ LayoutEngine.ts
│  │  └─ utils/
│  │     └─ anchors.ts
│  ├─ controller/
│  │  ├─ index.ts
│  │  └─ MotionTextController.ts
│  ├─ loader/
│  │  ├─ AssetFetcher.ts
│  │  ├─ CacheStore.ts
│  │  ├─ Integrity.ts
│  │  ├─ ManifestValidator.ts
│  │  ├─ PluginLoader.ts
│  │  └─ SandboxContext.ts
│  │  └─ dev/                      # (M6.5) Dev 전용 로더/레지스트리
│  │     ├─ DevPluginLoader.ts
│  │     └─ DevPluginRegistry.ts
│  ├─ parser/
│  │  └─ ScenarioParser.ts
│  ├─ runtime/
│  │  ├─ CssVars.ts
│  │  ├─ DomMount.ts
│  │  ├─ PortalManager.ts
│  │  ├─ StyleApply.ts
│  │  └─ plugins/
│  │     └─ __tests__/
│  │        └─ Builtin.test.ts
│  ├─ composer/
│  │  └─ __tests__/
│  │     └─ PluginChainComposer.test.ts
│  ├─ parser/
│  │  └─ __tests__/
│  │     └─ ScenarioParser.test.ts
│  ├─ runtime/
│  │  └─ __tests__/
│  │     └─ StyleApply.test.ts
│  ├─ types/
│  │  ├─ scenario.ts
│  │  ├─ index.ts
│  │  ├─ layout.ts
│  │  ├─ plugin.ts
│  │  └─ timeline.ts
│  ├─ utils/
│  │  ├─ json.ts
│  │  ├─ logging.ts
│  │  ├─ math.ts
│  │  └─ time.ts
│  └─ index.ts
├─ .changeset/
├─ .github/
├─ node_modules/
├─ CHANGELOG.md
├─ README.md
├─ package.json
├─ pnpm-lock.yaml
├─ tsconfig.json
└─ vite.config.ts
```

---

## src/ 모듈 책임

다음 설명은 파일별 “무엇을 담당하는가”를 요약한 것입니다. 실제 구현은 단계적으로 채워집니다.

### composer
- PluginChainComposer.ts: pluginChain의 시간상 활성 플러그인 집합을 평가하고, 채널별 합성 규칙을 적용하여 최종 값(accumulator)을 계산. 기본은 last-wins, 플러그인별 compose: add/multiply로 덮어씀.

### core
- Renderer.ts: 렌더링 오케스트레이션(마운트/업데이트). 파싱 결과와 Stage/TrackManager/Timeline을 조합해 그룹 컨테이너 배치, 자식 마운트, 프레임별 업데이트를 수행. `MotionTextRenderer`는 파사드로 위임.
- TimelineController.ts: 마스터 클락(mediaTime)과 requestVideoFrameCallback 루프를 관리. 시킹/배속/snapToFrame을 제어하며, 플러그인에는 상대 진행도만 전달.
- Composition.ts: 합성 규칙과 채널 정의의 공통 유틸. add/multiply/replace 및 last-wins의 기준 로직을 중앙화.
- SeekSync.ts: 절대 시간(absStart/absEnd)과 상대 진행도(progress) 간 매핑, 구간 창(window) 계산 보조.
- Stage.ts: 오버레이 콘텐츠 박스(bounds) 계산과 이벤트 발행(ResizeObserver/loadedmetadata/fullscreen). baseAspect 파싱과 컨텐트 rect 제공. 레이아웃 변환/클램프는 LayoutEngine에서 수행.
- TrackManager.ts: 겹침 정책(overlapPolicy: push/stack) 오프셋 계산 및 트랙 기본 스타일 조회. 표시 요소만 대상으로 Y 오프셋 누적을 계산하고 맵으로 반환.
- CueGraph.ts: Cue 루트 그룹 트리의 활성 창 결정(요소 absStart/absEnd 우선, hintTime 보조) 및 노드 순회.
- NodeRuntime.ts: Group/Text/Image/Video 등의 노드 mount/update/dispose 수명주기와 effectScope, layout.override 처리.

### layout
- LayoutEngine.ts: 레이아웃 모드(flow/grid/absolute/path), anchor, position/size/transform/override를 적용하여 최종 픽셀 레이아웃을 계산. 안전 영역(safeArea) 클램프 포함.
- utils/anchors.ts: 앵커 관련 공용 유틸(anchorTranslate/anchorFraction). LayoutEngine/Renderer 등에서 재사용.

### controller
- MotionTextController.ts: 비디오 컨테이너 위 오버레이 컨트롤(UI) 생성/마운트. 재생/일시정지, 자막 토글, 전체화면 요청 등 렌더러/플레이어 연동 진입점.
- index.ts: 컨트롤러 배럴(export) 엔트리.

### loader
- PluginLoader.ts: 보안 로딩 파이프라인 구현. manifest → 무결성 검증 → preload 자산 → entry 코드 fetch+검증 → Blob URL import → 플러그인 인터페이스 획득.
- Integrity.ts: SHA-384 해시와 선택적 ed25519 서명 검증 유틸. 로더에서 사용.
- ManifestValidator.ts: manifest.json 스키마/필수 필드(name/version/minRenderer/capabilities/schema) 검증.
- AssetFetcher.ts: preload 자산을 무결성 검증과 함께 가져오고 URL 해석을 보조.
- CacheStore.ts: 메모리+localStorage 기반 캐시. 키는 `plugin@version` 불변 전략.
- SandboxContext.ts: 플러그인에 제공되는 샌드박스 컨텍스트(gsap, container, assets.getUrl, portal, onSeek, timeScale 등) 구성. 컨테이너 DOM 범위로 접근 제한.

#### loader/dev (M6.5 Dev 전용)
- DevPluginRegistry.ts: 네임→모듈 매핑/조회/등록. 데모 환경에서 외부 플러그인 모듈을 레지스트리에 보관.
- DevPluginLoader.ts: 보안 검증 없이 manifest→entry를 fetch 후 Blob URL로 동적 import, 레지스트리에 등록. 향후 M7 정식 로더로 대체.

### parser
- ScenarioParser.ts: 시나리오(JSON v2.0) 파싱/스키마 검증 및 내부 구조로의 변환. 타입은 `src/types/scenario.ts` 참조.

### runtime
- PortalManager.ts: effectScope.breakout 구현. 기본 transfer: "move"로 재부모화, 필요 시 clone 처리. coordSpace 변환 처리.
- DomMount.ts: 노드/플러그인 컨테이너의 DOM 생성/마운트/정리 헬퍼.
- StyleApply.ts: 레이아웃(baseTransform)과 플러그인 합성(channels)을 일관된 순서로 반영. 텍스트 스타일 적용(applyTextStyle)과 변환 빌더(buildTransform) 제공.
- CssVars.ts: 공통 CSS 변수 명세와 조합 유틸.

### types
- scenario.ts: 시나리오(JSON v2.0) 구조 타입(Top-level, Track, Cue, Node, Layout, Style, EffectScope 등).
- plugin.ts: 플러그인 인터페이스/PluginSpec/PluginChain 런타임 계약 정의(상대 타이밍 창 포함).
- layout.ts: 레이아웃/스타일/브레이크아웃 타입 분리본. 구현 시 command 타입과 공유/재사용 가능하도록 설계.
- timeline.ts: 타임라인/시킹 계약 타입. 렌더러 소유 원칙 반영.
- index.ts: 타입 배럴(재export) 엔트리.

### utils
- time.ts: 프레임 스냅(snapToFrame), relStart/relEnd 및 pct 기반 창 계산, 클램프 유틸.
- math.ts: 합성, 보간, 클램프, 기타 수치 도우미.
- json.ts: 안전 파싱, 얕은/깊은 병합, 스키마 보조.
- logging.ts: 영역별 토글 가능한 경량 로깅 헬퍼.

### entry
- index.ts: 라이브러리 퍼블릭 엔트리(배럴/팩토리 노출 예정).

---

## 데모 전용(Dev) 플러그인 서버와 프론트 분리 (M6.5)

### plugin-server (Dev Only)
- 위치: `demo/plugin-server/`
- 역할: `plugins/<name>@<version>/` 디렉터리를 정적으로 서빙하는 경량 Node http 서버(ESM). CORS 허용, 간단 MIME 매핑.
- 실행(제안): `pnpm plugin:server` 스크립트로 `node demo/plugin-server/server.js` 실행.
- 보안: M7 무결성/서명 검증 미포함(개발용). 프로덕션 사용 금지.

### 데모 프론트 분리 포인트
- `demo/devPlugins.ts`: Dev 로더 초기화 및 사전 로드 진입점. `configureDevPlugins({ mode, serverBase, localBase })`로 원점 설정.
  - 환경변수(선택): `VITE_PLUGIN_MODE`(`server|local|auto`), `VITE_PLUGIN_ORIGIN`, `VITE_PLUGIN_LOCAL_BASE`
  - 기본값: `auto` 모드에서 서버 우선 시도 후 실패 시 로컬 폴더에서 직접 import 폴백
- `demo/ui/safeAreaDev.ts`(선택): Safe Area 데모 패널 로직 분리로 `main.ts` 슬림화.

---

## 기타 디렉터리
- demo/: 브라우저 데모 프로젝트(간단한 샘플 JSON과 구동 스크립트 포함).
- dist/: 빌드 산출물 출력 경로.
- sample/: 추가 샘플/시나리오 자료.
- context/: 설계/스펙 문서 모음(본 파일 포함).

---

## 구현 가이드 참고(요약)
- 타임라인: 마스터 클락은 mediaTime(requestVideoFrameCallback). 플러그인은 상대 타임라인 또는 seek만 제공.
- pluginChain: 각 항목별 실행 창(window)을 계산해 활성된 플러그인만 합성. 충돌은 기본 last-wins, compose로 add/multiply 지정 가능.
- breakout: 기본 transfer는 "move". portal/lift, coordSpace, return 타이밍 준수.
- 보안 로딩: manifest → 해시/서명 검증 → preload → entry 검증 → Blob import 순서 엄수.
