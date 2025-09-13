# motiontext-renderer 폴더 구조와 각 파일 역할 (업데이트)

이 문서는 리포지토리의 실제 구조와 각 모듈의 현재 역할/사용 상태를 최신 기준으로 정리합니다.

참고 스펙 문서:
- 시나리오(JSON) v2.0: `context/scenario-json-spec-v-2-0.md`
- 플러그인 시스템 v3.0: `context/plugin-system-architecture-v-3-0.md`
- 개요: `context/init-context.md`

핵심 원칙:
- 타임라인 소유권은 렌더러. 플러그인은 상대 진행도/seek만 제공.
- pluginChain 충돌 기본 last‑wins, 필요 시 compose:`add`/`multiply`.
- breakout 기본 transfer:`move`.
- 로딩 순서: fetch → 무결성 검증(향후) → Blob URL import.
- 적용 순서: 레이아웃(base) → 플러그인(channels).

---

## 폴더 트리 (요약)

```text
.
├─ context/
│  ├─ init-context.md
│  ├─ scenario-json-spec-v-2-0.md
│  ├─ plugin-system-architecture-v-3-0.md
│  ├─ ai-bootstrap-prompt.md
│  └─ folder-structure.md  ← (본 문서)
├─ demo/
│  ├─ index.html, main.ts, style.css
│  ├─ devPlugins.ts                 # Dev 플러그인 원점 설정/사전 등록
│  ├─ aiEditor.ts                   # AI 편집기 데모(로깅/대용량 diff 흐름)
│  ├─ proxy-server.js               # Claude API 프록시(개발 전용)
│  ├─ scenarioGenerator.ts          # 샘플 시나리오 생성 유틸
│  ├─ samples/                      # 데모 JSON 샘플 모음
│  └─ plugin-server/                # 로컬 플러그인 서버(Dev)
│     ├─ server.js
│     └─ plugins/                   # 여러 내장/데모 플러그인
│        └─ fadein@1.0.0, glow@1.0.0, cwi-* 등
├─ dist/                     # 빌드 산출물(자동 생성)
├─ docs/                            # 문서
├─ src/
│  ├─ composer/
│  │  ├─ PluginChainComposer.ts
│  │  └─ PluginChainComposerV2.ts
│  ├─ core/
│  │  ├─ Composition.ts
│  │  ├─ CueGraph.ts
│  │  ├─ NodeRuntime.ts
│  │  ├─ Renderer.ts
│  │  ├─ RendererV2.ts
│  │  ├─ SeekSync.ts
│  │  ├─ TrackManager.ts
│  │  ├─ Stage.ts
│  │  ├─ TimelineController.ts
│  │  └─ TimelineControllerV2.ts
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
│  │  ├─ ScenarioParser.ts         # v1.3 파서(레거시, 테스트/마이그레이션용)
│  │  ├─ ScenarioParserV2.ts       # v2.0 네이티브 파서(실사용)
│  │  ├─ DefineResolver.ts, CompatibilityLayer.ts, FieldMigration.ts, InheritanceV2.ts, ValidationV2.ts
│  ├─ runtime/
│  │  ├─ ChannelComposer.ts, CssVars.ts, DomMount.ts, DomSeparation.ts, PortalManager.ts, StyleApply.ts
│  │  ├─ PluginAssetBridge.ts, PluginContextV3.ts
│  │  └─ plugins/ (Builtin.ts, BuiltinV2.ts 등)
│  ├─ composer/
│  │  └─ __tests__/
│  │     └─ PluginChainComposer.test.ts
│  ├─ parser/
│  │  └─ __tests__/
│  │     └─ ScenarioParser.test.ts
│  ├─ runtime/
│  │  └─ __tests__/
│  │     └─ StyleApply.test.ts
│  ├─ assets/
│  │  ├─ AssetManager.ts
│  │  └─ __tests__/AssetManager.test.ts
│  ├─ types/
│  │  ├─ scenario-v2.ts (실사용), scenario.ts(v1.3 호환)
│  │  ├─ plugin-v3.ts (실사용), plugin.ts(구 API)
│  │  ├─ layout.ts, timeline.ts, index.ts
│  ├─ utils/
│  │  ├─ json.ts
│  │  ├─ logging.ts
│  │  ├─ math.ts
│  │  ├─ time.ts
│  │  └─ time-v2.ts
│  └─ index.ts                      # 퍼블릭 엔트리(네이티브 v2.0)
├─ .changeset/
├─ .github/
├─ node_modules/
├─ CHANGELOG.md
├─ README.md
├─ package.json
├─ pnpm-lock.yaml
├─ tsconfig.json
├─ scripts/                         # 유지보수 스크립트 (예: migrate-samples.ts)
├─ output/                          # 개발 런타임 로그(자동 생성, git-ignore)
└─ vite.config.ts, vitest.config.ts
```

---

## src/ 모듈 책임

다음은 핵심 파일의 역할입니다. (레거시/테스트/보류 항목만 표기)

### composer
- PluginChainComposer.ts — v1.3 기반 합성기. 상태: 레거시(테스트/참고용).
- PluginChainComposerV2.ts — v2.0 time_offset 기반 플러그인 창 계산 → 진행도 평가 → 채널 병합(ComposeMode 적용) 및 디버그 로깅/최대 활성 개수 제한 제공.

### core
- RendererV2.ts — v2.0 네이티브 렌더러: 타임라인 tick에 맞춰 큐/노드 마운트·업데이트·정리, 채널 적용과 DOM/채널 플러그인 호출, Define 참조 해석, 디버그 로깅을 조율.
- TimelineControllerV2.ts — requestVideoFrameCallback 기반 타임라인 루프; attach/detach, fps/snapToFrame 옵션, 업데이트 콜백 관리.
- CueManagerV2.ts — 각 큐의 domLifetime 창을 바탕으로 DOM 생성/보존/지연 정리와 메모리 제한 가드 수행.
- Renderer.ts, TimelineController.ts — v1.3 구현. 상태: 레거시(테스트/참고).
- Composition.ts, SeekSync.ts — 시간/합성 유틸(플레이스홀더). 상태: 보류/문서용.
- Stage.ts — 비디오 비율 또는 stage 설정으로 overlay content rect 계산, resize/fullscreen/metadata 이벤트로 bounds 변경 알림 및 컨테이너 스타일 갱신.
- TrackManager.ts — 트랙 overlap 정책(push/stack) 오프셋 계산과 트랙 기본 스타일 제공.
- CueGraph.ts — Cue 트리 활성 창 계산 유틸. 상태: 현재 직접 참조 없음(정리 검토).
- NodeRuntime.ts — 노드 수명주기/override. 상태: 레거시.

### layout
- LayoutEngine.ts — flow/grid/absolute/path 레이아웃 계산; anchor, position/size/transform/override/safeAreaClamp 처리.
- utils/anchors.ts — anchor 기준 좌표/이동 계산 유틸.

### controller
- MotionTextController.ts — YouTube 스타일 컨트롤 UI(재생/일시정지, 음량, 전체화면, 자막 토글, 진행 바/시간 표시)와 스타일 주입/이벤트 바인딩 제공.
- index.ts — 컨트롤러 배럴(export) 엔트리.

### loader
- PluginLoader.ts — manifest → 무결성 검증 → preload 자산 → entry fetch+Blob import → 플러그인 인터페이스 획득 파이프라인.
- ManifestValidator.ts — manifest 스키마/필수 필드(name/version/minRenderer/capabilities/schema) 검증.
- Integrity.ts — SHA‑384 해시 및 선택적 ed25519 서명 검증 유틸 초안.
- AssetFetcher.ts — preload 자산 fetch + URL 해석 및 무결성 보조.
- CacheStore.ts — 메모리+localStorage 기반 캐시(`plugin@version` 키 전략).
- SandboxContext.ts — 샌드박스 컨텍스트(Dev 전용 v1.3 경로). 상태: 레거시(Dev).

#### loader/dev (개발용)
- DevPluginRegistry.ts — 외부 플러그인 등록/조회 레지스트리(퍼블릭 API에서 사용).
- DevPluginLoader.ts, LocalPluginLoader.ts — 개발 환경에서 manifest 또는 로컬 경로로부터 동적 import → 레지스트리 등록 유틸.
- PreloadFromScenario(.ts/.V2.ts), DevPluginConfig.ts — 데모에서 플러그인 원점(server/local/auto) 설정과 사전 로드 지원.

### parser
- ScenarioParserV2.ts — v2.0 네이티브 파서(엔트리에서 사용); 스키마 검증, 기본값 채움, 친절한 오류 메시지 제공.
- ScenarioParser.ts — v1.3 파서. 상태: 테스트/마이그레이션용.
- DefineResolver.ts, CompatibilityLayer.ts, FieldMigration.ts, InheritanceV2.ts, ValidationV2.ts — 정의 해석/호환성/필드 변환/상속/검증 보조 유틸.

### runtime
- ChannelComposer.ts — 채널 상태/우선순위/합성 규칙 관리 및 최종 CSS 변수 값 산출.
- PluginContextV3.ts — 플러그인 v3.0 컨텍스트 생성(시나리오/에셋/채널/포털/오디오/유틸/peerDeps 바인딩).
- PluginAssetBridge.ts — 플러그인에서 사용할 에셋 접근(폰트/이미지/오디오 프리로드 등) 어댑터.
- DomMount.ts — 노드/플러그인 effectsRoot DOM 생성과 안전한 장착.
- DomSeparation.ts — baseWrapper/effectsRoot 분리 및 CSS 변수 기반 transform/opacity 적용 헬퍼.
- StyleApply.ts, CssVars.ts — 채널→CSS 변환, 텍스트/그룹 스타일 적용과 공통 CSS 변수 명세.
- plugins/Builtin.ts, plugins/BuiltinV2.ts — 기본 제공 이펙트(fade/slide/scale/pop/shake 등) 채널 평가기.
- PortalManager.ts — breakout/portal 관리 스텁. 상태: 보류(M8에서 구현 예정).

### assets
- AssetManager.ts — Define 섹션에서 에셋 추출 → 폰트/이미지/비디오/오디오 등록·프리로드, FontFace 동적 로드.

### migration
- V13ToV20Migrator.ts — v1.3 → v2.0 자동 마이그레이션(Define 추출, 노드 ID 생성, 경고/검증 포함). 테스트/스크립트에서 활용.

### types
- scenario-v2.ts — v2.0 네이티브 타입 집합.
- plugin-v3.ts — 플러그인 v3.0 타입(채널/권한 등).
- scenario.ts, plugin.ts — v1.3/구 API 타입. 상태: 레거시/호환.
- layout.ts, timeline.ts, index.ts — 공통 타입 및 배럴 export.

### utils
- time-v2.ts — v2.0 시간 유틸([start,end] 구간/오프셋/진행도/겹침/union/프레임 스냅핑).
- time.ts — v1.3 시간 유틸. 상태: 레거시(테스트/호환).
- math.ts, json.ts, logging.ts — 수치/JSON/로깅 공통 유틸.

### entry
- index.ts — 퍼블릭 엔트리: `parseScenario`(v2.0) + `RendererV2` 조합, 글로벌 설정 및 외부 플러그인 등록/글롭 등록 API 제공.

---

## 데모/서버 (Dev 전용)

### plugin-server
- 위치: `demo/plugin-server/`
- 역할: `plugins/<name>@<version>/` 정적 서빙(Node http, CORS, 간단 MIME).
- 실행: `pnpm plugin:server` → `node demo/plugin-server/server.js`
- 보안: 개발용. 프로덕션 사용 금지(무결성/서명 검증 미포함).

### proxy-server
- 위치: `demo/proxy-server.js`
- 역할: Claude API 프록시 + 로깅/타임아웃.
- 실행: `pnpm proxy:server`

### 데모 프론트
- `demo/main.ts`, `index.html`, `style.css` — 기본 데모.
- `demo/aiEditor.ts` — 대용량 편집/로깅 데모.
- `demo/devPlugins.ts` — 플러그인 원점 설정/등록.
- `demo/scenarioGenerator.ts` — 샘플 생성.
- `demo/samples/` — 샘플 JSON.
- 실행(제안): `pnpm plugin:server` 스크립트로 `node demo/plugin-server/server.js` 실행.
- 보안: M7 무결성/서명 검증 미포함(개발용). 프로덕션 사용 금지.

### 데모 프론트 포인트
- `demo/devPlugins.ts`: Dev 로더 초기화 및 사전 로드 진입점. `configureDevPlugins({ mode, serverBase, localBase })`로 원점 설정.
  - 환경변수(선택): `VITE_PLUGIN_MODE`(`server|local|auto`), `VITE_PLUGIN_ORIGIN`, `VITE_PLUGIN_LOCAL_BASE`
  - 기본값: `auto` 모드에서 서버 우선 시도 후 실패 시 로컬 폴더에서 직접 import 폴백

---

## 기타 디렉터리
- docs/ — 프로젝트 문서.
- dist/ — 빌드 산출물.
- output/ — 개발 런타임 로그(자동 생성, git‑ignore).
- scripts/ — 유지보수 스크립트(예: `migrate-samples.ts`).
- context/ — 설계/스펙 문서(본 파일 포함).

---

## 구현 가이드 참고(요약)
- 타임라인: rVFC 기반(mediaTime). 플러그인은 상대 진행/seek만.
- pluginChain: 활성 창 계산 → 합성(last‑wins/compose).
- breakout: 기본 transfer:`move`, coordSpace/return 준수.
- 로딩: manifest → 해시/서명 검증(로드맵) → preload → Blob import.
