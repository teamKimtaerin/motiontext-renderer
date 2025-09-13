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

다음은 핵심 파일 역할과 사용 상태입니다. (상태: 사용 중/레거시/테스트 전용/보류)

### composer
- PluginChainComposer.ts — v1.3 기반 합성기. 상태: 레거시(테스트/참고용).
- PluginChainComposerV2.ts — v2.0 time_offset + 채널 시스템 합성기. 상태: 사용 중.

### core
- RendererV2.ts — v2.0 네이티브 렌더러. 상태: 사용 중(퍼블릭 엔트리에서 사용).
- TimelineControllerV2.ts — v2.0 타임라인 제어(rVFC 루프). 상태: 사용 중.
- CueManagerV2.ts — domLifetime 기반 DOM 생명주기 관리. 상태: 사용 중.
- Renderer.ts, TimelineController.ts — v1.3 구현. 상태: 레거시(테스트/참고).
- Composition.ts, SeekSync.ts — 시간/합성 유틸(플레이스홀더). 상태: 보류/문서용.
- Stage.ts — 콘텐츠 박스 계산 및 바운드 이벤트. 상태: 사용 중.
- TrackManager.ts — 트랙 겹침/기본 스타일. 상태: 사용 중.
- CueGraph.ts — 트리 활성 창 계산. 상태: 현재 직접 참조 없음(정리 검토).
- NodeRuntime.ts — 노드 수명주기/override. 상태: 레거시.

### layout
- LayoutEngine.ts — flow/grid/absolute/path, safeAreaClamp 포함. 상태: 사용 중.
- utils/anchors.ts — 앵커 유틸. 상태: 사용 중.

### controller
- MotionTextController.ts — 플레이어 UI 오버레이. 상태: 사용 중(퍼블릭 export).
- index.ts — 배럴. 상태: 사용 중.

### loader
- PluginLoader.ts, ManifestValidator.ts, Integrity.ts, AssetFetcher.ts, CacheStore.ts — 플러그인/자산 로딩 구성요소. 상태: 부분 사용(Dev/향후 보안 로더 고도화 대상).
- SandboxContext.ts — 샌드박스 컨텍스트(Dev 전용 v1.3 경로). 상태: 레거시(Dev).

#### loader/dev (개발용)
- DevPluginRegistry.ts — 외부 플러그인 레지스트리. 상태: 사용 중(퍼블릭 API에서 등록).
- DevPluginLoader.ts, LocalPluginLoader.ts — Dev 로딩 경로. 상태: 사용/보조.
- PreloadFromScenario(.ts/.V2.ts), DevPluginConfig.ts — Dev 원점 설정/사전 로드. 상태: 사용 중.

### parser
- ScenarioParserV2.ts — v2.0 네이티브 파서. 상태: 사용 중(엔트리에서 사용).
- ScenarioParser.ts — v1.3 파서. 상태: 테스트/마이그레이션용.
- DefineResolver.ts, CompatibilityLayer.ts, FieldMigration.ts, InheritanceV2.ts, ValidationV2.ts — 보조/이행 유틸. 상태: 사용 중.

### runtime
- ChannelComposer.ts — 채널 기반 합성 보조. 상태: 사용 중.
- PluginContextV3.ts, PluginAssetBridge.ts — 플러그인 컨텍스트/자산 브리지. 상태: 사용 중.
- PortalManager.ts, DomMount.ts, DomSeparation.ts — DOM 구성/분리/포털. 상태: 사용 중.
- StyleApply.ts, CssVars.ts — 스타일 적용과 CSS 변수. 상태: 사용 중.
- plugins/Builtin.ts, plugins/BuiltinV2.ts — 내장 플러그인 평가기. 상태: 사용 중.

### assets
- AssetManager.ts — Define 섹션 기반 에셋 로드/프리로드, FontFace 등록. 상태: 사용 중(엔트리에서 사용).

### migration
- V13ToV20Migrator.ts — v1.3 → v2.0 자동 마이그레이션 도구. 상태: 사용 중(테스트/스크립트에서 활용).

### types
- scenario-v2.ts — v2.0 네이티브 타입. 상태: 사용 중.
- plugin-v3.ts — 플러그인 v3.0 타입. 상태: 사용 중.
- scenario.ts, plugin.ts — v1.3/구 API 타입. 상태: 레거시/호환.
- layout.ts, timeline.ts, index.ts — 공통 타입 및 배럴. 상태: 사용 중.

### utils
- time-v2.ts — v2.0 시간 유틸([start,end], time_offset 등). 상태: 사용 중.
- time.ts — v1.3 시간 유틸. 상태: 레거시(테스트/호환).
- math.ts, json.ts, logging.ts — 공통 유틸. 상태: 사용 중.

### entry
- index.ts — 퍼블릭 엔트리. v2.0 파서/렌더러 사용, 외부 플러그인 등록 API(export) 제공. 상태: 사용 중.

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

### 데모 프론트 분리 포인트
- `demo/devPlugins.ts`: Dev 로더 초기화 및 사전 로드 진입점. `configureDevPlugins({ mode, serverBase, localBase })`로 원점 설정.
  - 환경변수(선택): `VITE_PLUGIN_MODE`(`server|local|auto`), `VITE_PLUGIN_ORIGIN`, `VITE_PLUGIN_LOCAL_BASE`
  - 기본값: `auto` 모드에서 서버 우선 시도 후 실패 시 로컬 폴더에서 직접 import 폴백
- `demo/ui/safeAreaDev.ts`(선택): Safe Area 데모 패널 로직 분리로 `main.ts` 슬림화.

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
