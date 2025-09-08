# motiontext-renderer 구현 계획 (living doc)

이 문서는 구현 단계·우선순위·체크리스트를 관리하는 살아있는 계획서입니다. 작업 진행 시 이 파일을 계속 갱신합니다.

참조 문서
- 시나리오(JSON) 스펙 v1.3: `context/scenario-json-spec-v-1-3.md`
- 플러그인 시스템 아키텍처(v2.1): `context/plugin-system-architecture-v-2-1.md`
- 개요 요약: `context/init-context.md`
- 폴더/파일 역할: `context/folder-structure.md`

핵심 규칙(요약)
- 타임라인 소유권은 렌더러에 있음. 플러그인은 상대 Timeline 또는 seek 함수형만 제공.
- pluginChain: 각 항목이 `relStart/relEnd` 또는 `relStartPct/relEndPct`로 실행 창(window)을 정의. 겹칠 경우 기본 last-wins, 필요 시 `compose:"add"|"multiply"`.
- breakout: 기본 `transfer:"move"`.
- 보안: fetch → 해시/서명 검증 → Blob URL import 순서 준수.

---

로드맵(마일스톤)
- M0 Scaffold: src 구조 정리 및 문서 링크 정비 — 완료
- M1 타입 정의: v1.3 타입셋 정식화(`src/types/*`) — 완료
- M2 시간 유틸: 창(t0/t1)·pct·snap helpers(`src/utils/time.ts`) — 완료
- M2.5 데모 최소구동: MotionTextRenderer 스켈레톤 + Text 노드 렌더 — 완료(핵심 기능 동작)
- M2.6 커스텀 컨트롤러(Controller UI): 플레이어|렌더러|컨트롤러 3층 구조, 전체화면/자막 토글/시킹 연동 — 완료
- M3 파서: ScenarioParser + 검증(`src/parser/ScenarioParser.ts`) — 완료
- M4 합성: PluginChainComposer(채널 합성, last-wins/compose) — 완료
- M5 레이아웃 최소: LayoutEngine 정규화→px/% 변환, safeAreaClamp/flow/grid/override — 부분 완료(Stage 모듈 분리 대기)
- M5.5 리팩토링: 경계 정리/중복 제거/모듈화 — 완료
- M5.6 품질 보완/최적화: 이벤트/성능/타입/테스트 보강 — 완료
- M6 타임라인: TimelineController 시킹/배속/rVFC — 완료(rVFC 도입, snapToFrame 연동, 테스트 통과)
- M6.5 로컬 플러그인 서버/데모 통합: dev 전용 경량 서버 + 동적 로딩 연동 — 완료(보안 검증 제외)
- M6.7 Caption with Intention 데모: 전용 영상 교체, CwI 3대 애니메이션 플러그인(pop/wave, loud, whisper), 캡션 박스 + 박스 탈출 구현 — 진행중
- M7 보안 로더: Integrity/Manifest/Asset/PluginLoader 파이프라인 — 예정
- M8 런타임: PortalManager/DomMount/CssVars — 예정(StyleApply 일부 사용 중)
- M9 렌더러: 오케스트레이션(트랙/큐/노드/플러그인 통합) — 부분 완료(`MotionTextRenderer` 내 구현, `core/Renderer.ts` 보류)
- M10 데모 연동: demo/main.ts 샘플/컨트롤러/세이프에어리어 — 부분 완료
- M11 문서/예제: README 사용 가이드 — 예정

---

세부 작업 항목(체크리스트)

## 1) 타입 정의 (M1)
- [x] `src/types/scenario.ts`: Top-level, Track, Cue, Node(Group/Text/Image/Video), Layout, Style, EffectScope
- [x] `src/types/plugin.ts`: PluginSpec/PluginChain, runtime 인터페이스(init/animate/cleanup, seek 대안)
- [x] `src/types/layout.ts`: 레이아웃/스타일 파생 타입 분리(선택)
- [x] `src/types/timeline.ts`: 타임라인/시킹 계약 타입

수용 기준
- [ ] 샘플 JSON들이 타입 에러 없이 파싱 대상 구조에 맞게 타이핑됨
- [ ] 필수/선택 필드 구분 반영, 기본값 주석 명시

검증
- [x] `pnpm typecheck`가 오류 없이 통과
- [x] `pnpm lint`에서 오류 0 (경고는 허용 범위 확인)
- [x] `pnpm build`가 타입 에러 없이 완료(번들 생성 여부 확인)

## 2) 시간 유틸 (M2)
- [x] `computeRelativeWindow(absStart, absEnd, spec)` → `{t0,t1}`
- [x] `snapToFrame(t, fps)` / `clampRange([t0,t1])`
- [x] 0≤pct≤1, t0≤t1 검증 및 친절한 오류 메시지

검증
- [x] `pnpm typecheck` 통과 (외부 모듈 의존 없음)
- [ ] 임시 콘솔 테스트: `computeRelativeWindow(2,5,{relStart:0,relEnd:0})` → `{t0:2,t1:5}` (M2.5 데모 페이지 콘솔에서 실행 예정)
- [ ] 퍼센트 케이스: `computeRelativeWindow(2,5,{relStartPct:0.1,relEndPct:0.0})` → `{t0:2+0.3,t1:5}` (동일)
- [ ] 오류 케이스: relStartPct<0 또는 >1 입력 시 명확한 에러 메시지 (동일)

## 2.5) 데모 최소구동 (M2.5)
- [x] `src/index.ts`: `MotionTextRenderer` 스켈레톤 내보내기(API: `loadConfig`, `attachMedia`, `play`, `pause`, `seek`, `dispose`)
- [ ] `src/core/Renderer.ts`: 최소 오케스트레이션(텍스트 전용) — 현재 `MotionTextRenderer`에 통합, 별도 파일 보류
- [x] `src/parser/ScenarioParser.ts`: v1.3 필수 필드 검증/정규화(version/timebase/stage/tracks/cues)
- [x] `src/layout/LayoutEngine.ts`: M2.5 범위의 position/anchor 중심(실제 구현은 M5 기능 일부 포함)
- [x] `src/core/TimelineController.ts`: rAF 루프에서 `mediaTime` 구독 및 텍스트 활성/비활성 토글(rVFC 전환 예정)
- [x] `demo/main.ts`: 샘플 JSON 선택/적용, 컨트롤러 마운트(ScenarioParser가 dev-only 어댑터 역할 수행)
- [x] 수용 기준: absStart~absEnd 구간에 텍스트 표시/비표시(기본 플러그인 없이)

검증
- [x] 샘플 로드/적용 플로우 동작(코드 상 구현)
- [x] 일시정지/재생/시킹 시 표시 상태 동기화(코드 상 구현)
- [x] 전체화면/리사이즈 시 오버레이 박스 동기 재배치(`updateOverlayBounds`)
- [ ] 브라우저 수동 검증(네트워크/환경 의존) 추가 확인

## 2.6) 커스텀 컨트롤러(Controller UI) (M2.6)
- [x] 폴더 생성: `src/controller/` (`MotionTextController.ts`, `index.ts`)
- [x] 렌더러 API: `setCaptionsVisible(visible)` 추가
- [ ] 플레이어 어댑터: `player/HtmlVideoAdapter` (선택)
- [x] 컨트롤 UI: mount/unmount + play/pause, captions toggle, fullscreen 버튼
- [x] 이벤트 연동: Video 이벤트(timeupdate/loadedmetadata/volumechange)로 UI 동기화
- [x] 전체화면 대응: `requestFullscreen` + `fullscreenchange` 반영
- [x] 접근성: aria-pressed/label, 키보드 핸들러(스페이스/좌우/ESC)
- [x] 시킹/볼륨: range 입력으로 currentTime/volume 제어, 시간 표시

검증
- [ ] 네이티브 컨트롤 숨김 상태에서 모든 조작 가능(데모에선 유지, 라이브러리는 오버레이만 제공)
- [ ] 전체화면 전환 시 자막이 영상 위에 유지되고 크기/좌표 정상
- [ ] 자막 토글 시 즉시 반영, 성능 저하 없음
 - [x] 오버레이를 영상 표시 영역(video content box)에 정렬(레터박스 구간 무시)

2.6 추가 과제 (요청 반영)
- [x] 키보드 조작(비전체화면 포함): 컨테이너 클릭/호버 시 Space/←/→/ESC 동작
- [x] 컨트롤 오토 히드: 호버 시 표시, 이탈/유휴시 일정 시간 후 숨김(전체/일반 공통)
- [x] 전체화면 유휴 시 커서 숨김, 움직이면 재표시
- [x] 데모 패널: 초기부터 단일 재생 버튼만 표시(일시정지 버튼 제거)

## 3) 파서/검증 (M3)
- [x] `parseScenario(json)`: 스키마 유효성 + 기본값 채움 + 친절한 오류
- [x] 시간 필드 정합성 검증(absStart<absEnd), hintTime 형식 검증
- [x] plugin/pluginChain/effectScope 필드 정합성만 검증(창 계산은 런타임 위임)

검증
- [x] 정상 케이스: 샘플 JSON이 파서 통과, 내부 구조 생성됨
- [x] 오류 케이스: version 불일치/track 참조 불일치/필수 필드 누락 시 명확한 에러 메시지
- [x] `pnpm typecheck`/`pnpm lint` 통과

## 4) 합성(PluginChain) (M4)
- [x] 활성 플러그인 필터링(현재 시간 in 창)
- [x] 채널(accumulator) 합성: replace(기본)/add/multiply
- [x] last-wins 보장 및 채널 초기값 규칙 정의

검증
- [x] 시간 창이 겹치지 않는 두 플러그인 → 독립 반영(데모에서 확인)
- [x] 겹칠 때 compose 미지정 → 뒤 플러그인이 교체(last-wins)
- [x] compose:"add"/"multiply" 각각에서 누적 결과가 기대와 일치
- [x] 데모용 내장 플러그인(fadeIn/pop/waveY/shakeX)로 시각적 확인

## 5) 레이아웃/스테이지 (M5)
 - [x] 정규화→픽셀 변환, anchor/transform 파이프라인 정비
 - [x] translate/size/overflow/transformOrigin 지원
 - [x] override(mode:"absolute") 오프셋/변환 적용(기본), keepUpright(텍스트) 설계 예정
 - [x] safeAreaClamp 처리(stage/track.safeArea 병합) — position 기준 클램프
 - [x] safeAreaClamp에 size 클램프(일반 anchor/측정 포함)
 - [x] flow/grid 모드 1차 구현(세로 스택/간단 2열 + gapRel)
 - [x] overlapPolicy(push/stack) 최소 연동(비-flow 그룹에서 활성 요소 translateY 누적)
 - [x] overlapPolicy(ignore) 기초 지원(flow 그룹은 absolute 전환 + child layout 미지정 시 중심 겹치기)

### 세부 TODO (M5)
  - [x] 파이프라인: anchor → translate(%) → scale → rotate → skew → override(translate/scale/rotate/skew) → pluginChain
  - [x] translate: 정규화(0..1) → % 변환, 누적 순서 보장
  - [x] size: width/height 정규화(0..1)/auto 지원, 기준(track/stage) 정의
  - [x] overflow: clip|visible 처리; subtitle 기본 clip, free는 기본 visible
  - [x] transformOrigin: 문자열(예: "50% 50%") 반영, anchor와 상호작용 정리(기본)
  - [x] override(mode:"absolute"): offset{x,y}(%) + transform 누적; Text `keepUpright`(M5.1)
  - [x] safeAreaClamp: stage.safeArea ∧ track.safeArea 병합 후 position/size 클램프(일반)
  - [x] flow(1차): 세로 스택+gapRel, anchor 기준 정렬
  - [x] grid(1차): 간단 2D 배치(행 우선), gapRel 적용
  - [x] 스테이지 메트릭/리플로우: fullscreen/리사이즈 시 Overlay bounds 반영 후 base transform 재계산
  - [x] Reflow 최적화(1차): ResizeObserver throttle(50ms)
  - [x] Reflow 최적화(2차-1): overlay 박스 무변화 시 스킵
  - [x] Reflow 최적화(2차-2): 요소 레이아웃 키(pw/ph/anchor/layout/safeArea) 캐시로 base transform 재계산 스킵
  - [x] overlapPolicy(push/stack): 동일 그룹/트랙 내 시간상 겹침 시 아래 요소 밀어내기(비-flow)
  - [x] overlapPolicy(ignore): flow 무시 모드 지원(겹침 허용, child layout 미지정 시 중심 배치)

### 검증 (M5)
- 위치/크기/변환이 파이프라인 순서대로 누적 적용되는지 확인(시각 검증 샘플)
- safeAreaClamp: stage/track safeArea 지정 시 경계 이탈 방지 확인
- subtitle 기본 overflow: clip 동작, free는 기본 visible 유지
- flow 모드: `gapRel` 반영된 세로 스택, push/stack에 따른 충돌 처리 최소 동작 확인
- 전체화면/리사이즈: overlay/video content box와 레이아웃이 동기 재배치

### 추가 검증 (M5)
- [ ] 다양한 앵커에 대해 position 적용 결과가 기대 위치에 렌더
- [ ] safeArea 지정 시 텍스트가 스테이지 경계 내로 클램프
- [ ] 창 리사이즈 시 비율 유지 및 좌표 재계산 검증

## 5.5) 코드 리팩토링/경계 정리 (M5.5)

목표(스코프)
- Stage 경계 책임 분리: 오버레이 bounds 계산/리스너(rz/fullscreen/metadata) → `src/core/Stage.ts`로 이동.
- Track 겹침 정책 분리: push/stack 오프셋 누적 로직 → `src/core/TrackManager.ts`로 이동(비-flow 그룹 대상).
- 스타일/변환 일원화: 텍스트 스타일 적용(`applyTextStyle`)을 `src/runtime/StyleApply.ts`(또는 `CssVars.ts`)로 이관, 변환 합성 규칙을 단일 빌더로 통일.
- 앵커 유틸 재사용: `anchorTranslate`/`anchorFraction`을 공용 유틸로 분리(`src/layout/anchors.ts` 등) 후 중복 제거.
- 오케스트레이션 분리: 마운트/업데이트 루프를 `src/core/Renderer.ts`로 추출, `MotionTextRenderer`는 파사드(타임라인/Stage/Renderer 조립)로 축소.
- 타입/네이밍 정리: OverlapPolicy/Anchor/Channels 등 공개 타입 정합성 검토 및 배럴 정리.

체크리스트
- [x] Stage.extract: overlay bounds 계산/리스너(`installOverlayBinding`/`updateBounds`)를 `Stage.ts`로 이전, `onBoundsChange` 공개 API 확정(참고: `recomputeMountedBases`는 Renderer에 유지).
- [x] TrackManager.applyOverlapPolicy(parentGroup): 활성 요소 순서→Y 오프셋 맵 반환(행간 gap 포함) 구현(`computeGroupOffsets`).
- [x] StyleApply: `applyTextStyle(el, style, trackDefault)` 이관 및 테스트, `buildTransform(base, channels)`로 합성 순서 고정.
- [x] Anchors: `anchorTranslate`/`anchorFraction` 공용화, LayoutEngine/Renderer에서 재사용.
- [x] Renderer.ts: 그룹 컨테이너 배치(flow/grid/absolute)와 자식 mount/update를 책임, index.ts는 파사드로 단순화.
- [ ] import 경로/순환 의존 점검 및 수정, 폴더 역할 문서 업데이트(`context/folder-structure.md`).

수용 기준
- [ ] `pnpm typecheck`/`pnpm build` 무오류, 데모 샘플(basic/animated/tilted_box/m5_layout_features) 동작 동일.
- [ ] 전체화면/리사이즈 시 오버레이 정렬/세이프에어리어 동작 회귀 없음.
- [ ] `src/index.ts` 코드량/책임 축소, `core/Stage.ts`/`core/TrackManager.ts`/`core/Renderer.ts`에 역할이 명확히 분리.

소요/리스크
- 예상 0.5~1일. 동작 동일성을 유지하는 내부 구조 리팩토링으로 리스크 낮음(수동 데모 검증 포함).
 
## 5.6) 품질 보완/최적화 (M5.6)

목표(스코프)
- Stage 이벤트/바인딩 안정성 강화:
  - `onBoundsChange(cb)`가 구독 해지 함수(unsubscribe)를 반환하도록 개선, 메모리 누수 방지
  - `setContainer`/`setMedia` 재바인딩 안전성(Idempotent) 보장
- 테스트 보강(필수):
  - anchors: `anchorTranslate/anchorFraction` 경계값 단위 테스트
  - Stage: content rect 산출 및 구독/해지 테스트

체크리스트
- [x] Stage: `onBoundsChange()`에서 unsubscribe 반환, 재바인딩 안전성 구현
- [x] Stage: 중복 바인딩 방지 (_boundParent/_boundMedia 추적)
- [x] Stage: resizeThrottleMs 스펙 반영 (기본 80ms)
- [x] Stage: `configure()` Dead API 제거
- [x] index.ts: Stage 구독 저장 및 dispose에서 해지
- [x] 테스트 추가: anchors 유틸리티 경계값 단위 테스트 (9개 앵커 포인트)
- [x] 테스트 추가: Stage content rect 순수 함수 테스트 (letterbox/pillarbox 케이스)
- [x] Transform 순서 Known Issue 문서화 (implement-plan.md)

수용 기준
- [x] `pnpm typecheck`/`pnpm build` 무오류 (통과)
- [x] 129개 테스트 모두 통과 (Stage 4개, anchors 5개 추가)
- [x] Stage 구독/해지가 메모리 누수 없이 정상 동작

소요/리스크
- 소요: 0.2일 내외(1-2시간, 테스트 포함). 메모리 누수 방지 및 핵심 안정성 개선으로 리스크 매우 낮음.

## 6) 타임라인 컨트롤 (M6)
- [x] rVFC 루프 + rAF 폴백, mediaTime 기반 진행
- [x] pause/play/seek/rate API (rate는 video.playbackRate 위임), ended 이벤트 중지 처리
- [x] snapToFrame 옵션 적용(Scenario.behavior.snapToFrame + timebase.fps 전달 → computeRelativeWindow)
- [x] 플러그인에는 progress만 전달(합성기에서 상대 p 계산)

### 검증 (M6)
- [x] rVFC 기반으로 미디어 드리프트 없이 진행도 고정(단위 테스트 기반)
- [x] pause/play/seek/rate 즉시 반영(테스트로 확인), ended 중지
- [x] snapToFrame on/off 시 [t0,t1) 경계 판정 일관성 확인(테스트로 확인)

## 6.5) 로컬 플러그인 서버 + 데모 통합 (M6.5)

목표(스코프)
- 데모 환경에서만 사용할 경량 플러그인 배포 서버를 `demo/plugin-server/`에 구현하고, 플러그인을 fetch→Blob import로 로드해 실행 확인.
- v2.1 규약 준수: baseWrapper/effectsRoot 경계, targets/capabilities, Dev용 evalChannels 병행.
- 보안 검증(M7의 무결성/서명)은 제외하고 빠른 반복/검증을 위한 개발 편의 단계 제공.

설계/구조 (v2.1 기준)
- 서버: Node 내장 `http` 정적 서빙 + CORS 허용. 루트 `demo/plugin-server/plugins/` 아래 버전 디렉토리.
  - 예: `plugins/spin@1.0.0/{manifest.json,index.mjs,assets/...}`
  - MIME: `.json=application/json`, `.mjs=text/javascript`, 나머지 기본값.
  - CORS: `Access-Control-Allow-Origin:*`, `Cache-Control: public, max-age=0`(dev)
- 매니페스트(예시 최소):
  ```json
  {
    "name": "spin",
    "version": "1.0.0",
    "pluginApi": "2.1",
    "entry": "index.mjs",
    "targets": ["text"],
    "capabilities": ["channels-eval"],
    "preload": []
  }
  ```
- 엔트리(Dev + v2.1 병행):
  - 기본(default) v2.1: `{ name, version, init?, animate, cleanup?, schema? }` (animate는 GSAP Timeline 또는 SeekApplier)
  - 보조(named) Dev: `export function evalChannels(spec, p, ctx): Channels` (tx,ty,sx,sy,rot,opacity)
  - 우선순위: Dev 단계에서는 evalChannels가 있으면 채널 합성 경로 사용, 없으면 default 인터페이스를 mount하여 SeekApplier/Timeline로 구동
- DOM 경계/합성 규칙:
  - baseWrapper: 레이아웃/앵커/호스트 채널(transform/opacity) 전용
  - effectsRoot: 플러그인 전용 루트(plugins mount). 플러그인은 baseWrapper transform/opacity 직접 수정 금지
  - 선택: CSS 변수 채널(`--mtx-*`) 사용 시 style-vars 권한으로 합성과 충돌 최소화
- 자산 규약:
  - `ctx.assets.getUrl(relPath)`로 manifest 기준 절대 URL 제공
  - font는 Dev 단계에서 `FontFace` 등록 허용(Prod는 M7에서 무결성/캐시)
- main.ts 부피 감소: Dev 플러그인 초기화(`devPlugins.ts`), SafeArea UI(`ui/safeAreaDev.ts`) 분리로 가독성/유지보수성 향상(선택 적용).
- 샘플 자산 경로: 기존 `demo/samples/assets/` 유지. 플러그인 패키지 자산은 서버 쪽 `plugins/*/assets/`에만 둬서 책임 분리.
- 플러그인 서버 접속 설정: `devPlugins.ts`에서 `const PLUGIN_ORIGIN = 'http://localhost:3300'` 상수로 중앙화(환경별 오버라이드 용이).

리팩토링 포인트(데모 서버)
- 플러그인 단위 디렉터리: `<name>@<version>` 고정 → 후속 M7 캐시/불변 버전 정책과 정렬.
- 서버 ESM 일관화: 루트 `package.json`이 `type:"module"`이므로 `server.js`도 ESM import 사용.
- 간단한 MIME 매핑과 404/디렉터리 인덱싱 차단(보안 최소 가드) 추가.

구현 체크리스트
1) 서버 스켈레톤
   - [x] `demo/plugin-server/server.js`: 포트 `3300` 기본, `plugins/` 정적 서빙, CORS 헤더 추가
   - [x] `package.json` 스크립트 추가: `"plugin:server": "node demo/plugin-server/server.js"`
2) 샘플 플러그인 3종 (v2.1 + Dev 병행)
   - [x] `spin@1.0.0`: 회전(채널 `rot`) — default 타임라인 + named evalChannels
   - [x] `bobY@1.0.0`: 상하 바운스(채널 `ty`) — default 타임라인 + named evalChannels
   - [x] `pulse@1.0.0`: 확대/축소(채널 `sx/sy`) — default 타임라인 + named evalChannels
   - [x] (선택) `flames@1.0.0`: assets/flame.gif 오버레이(assets.getUrl 사용), targets:["text"], capabilities:["portal-breakout"]
   - [x] (추가) `glow@1.0.0`: 발광(pulse) 오버레이 + text-shadow 보강
3) Dev 로더/레지스트리(보안 제외)
   - [x] `src/loader/DevPluginRegistry.ts`: 네임→모듈 매핑, `register/resolve/has` 제공
   - [x] `src/loader/DevPluginLoader.ts`: `loadFrom(manifestUrl)` → manifest fetch → entry fetch→Blob→dynamic import → 레지스트리 등록 (+ peer gsap 범위 경고)
   - [x] `src/loader/SandboxContext.ts`(Dev): `{ container(effectsRoot), assets.getUrl, gsap? }` 주입
   - [x] `src/loader/dev/PreloadFromScenario.ts`: 시나리오 기반 필요 플러그인 자동 프리로드
4) Renderer 연동(선택 플래그, v2.1 경계 반영)
   - [x] Text 노드 mount 시 `effectsRoot` 생성(간소), baseWrapper는 현 텍스트 엘리먼트 유지
   - [x] 플러그인 평가 시 순서: 레지스트리 조회 → evalChannels 존재 시 채널 합성 사용 → 없으면 default 인터페이스 mount/구동
   - [x] default 인터페이스(SeekApplier/Timeline): 창(window)별 p 계산해 인스턴스별 applier/timeline 주행(호스트 강제)
   - [x] 채널(transform/opacity)은 baseWrapper에 적용, 타임라인은 effectsRoot만 조작(충돌 방지)
   - [x] 채널 합성과 타임라인 동시 사용 시 transform 충돌 방지 로직 반영
5) 데모 통합
   - [x] `demo/devPlugins.ts`: 시나리오 스캔 기반 프리로드(`preloadPluginsForScenario`)
   - [x] 샘플 JSON: `plugin_local.json`/`plugin_showcase.json` 추가 및 강화(순차/콤보/멀티 영역)
   - [x] 데모 셀렉터 옵션 추가 및 정상 동작 확인
6) 문서/가드
   - [x] `README.md` GSAP 피어 의존 안내
   - [x] `context/*` 문서에서 v2 → v2.1 링크 갱신 및 보강

수용 기준
- `pnpm dev` + `pnpm plugin:server` 동시 실행 시 데모에서 `plugin_local.json` 선택 → 외부 플러그인이 적용되어 눈에 띄는 애니메이션이 재생됨.
- 네트워크 오류/플러그인 미등록 시에도 빌트인/무효 처리로 안전 폴백(에러 토스트/콘솔 경고).
- default(v2.1)와 evalChannels(Dev) 경로 모두 동작 검증(한 개 이상 샘플 플러그인).
- assets.getUrl로 불러온 이미지/폰트 자산 사용 케이스 1건 이상 검증(Dev 환경)
- 코드베이스 타입/빌드 무오류(`pnpm typecheck`/`pnpm build`).

선행 필요 여부(후속 마일스톤 의존성)
- M7(무결성/서명) 선행 불필요. 본 단계는 보안 검증 제외 Dev 전용 로더/서버로 동작.
- v2.1 런타임 계약(default export)과 Dev `evalChannels` 모두 지원하되, PortalManager 본격 동작은 M8에서 완료.

소요/리스크
- 소요: 0.5일 내외(서버/샘플/로더/연동/데모 반영).
- 리스크: Dev 인터페이스(`evalChannels`)와 default 인터페이스 간 차이 → M7~M8에서 마이그레이션/경계 테스트 필요. 보안 미적용 상태를 반드시 문서화.

## 6.7) Caption with Intention 데모 (CwI)

목표(스코프)
- 데모 샘플 영상을 `demo/samples/assets/friends.mp4`로 교체.
- CwI 3대 애니메이션을 제공하는 dev 플러그인 구현:
  - pop/wave: 글자별 발화 시점에 맞춘 1.15x 팝(파도타기 느낌)
  - loud: 큰 볼륨 구간에서 확대 + 미세 떨림(트램블)
  - whisper: 속삭임 구간에서 축소
- `tmp/real.json`을 읽어 시나리오 v1.3 구조로 변환한 데모 JSON 추가(`demo/samples/cwi_demo.json`).

-설계/구조
- 캡션 박스(Containing Box) 구성
  - Track 활용: `tracks: [{ id:'captions', type:'subtitle', layer: 20, overlapPolicy:'ignore', defaultStyle:{ /* box style */ } }]`
  - Cue/root 그룹은 `absolute` + `anchor:'bc'` + `position:{x:0.5,y:0.9~0.95}`로 하단 20% 작업 영역에 배치
  - 박스 규칙: 기본 `overflow:'clip'`, 배경 `boxBg: rgba(0,0,0,0.9)`, 내부 패딩 `padding:{ x:0.02, y:0.01 }`
  - 줄 정책: 기본 1줄, 필요 시 최대 2줄(플러그인 내부에서 토큰 래핑으로 처리)
  - Work Area: `stage.safeArea.top = 0.8`로 하단 20% 확보(+ track.safeArea로 좌/우 여백 선택 적용)
- Loud 토큰의 박스 탈출
  - 의도: loud 효과는 박스를 “뚫고” 상단으로 확대되어 보임
  - 시나리오 표기: 해당 노드/플러그인에 `effectScope.breakout:{ mode:'portal', toLayer: 30, coordSpace:'stage', transfer:'clone', return:'end' }` 권장
  - Dev 구현(PortalManager 미완성 시): 플러그인에서 span을 임시 복제하여 overlay 루트로 올리는 경량 포털(fallback) 적용 후 종료 시 복귀
- 플러그인: `demo/plugin-server/plugins/cwi@1.0.0/`
  - `manifest.json`: pluginApi 2.1, targets:["text"], capabilities:[]
  - `index.mjs`: effectsRoot 내부에서 토큰(span) DOM을 생성하여 선행 흰색 문장 표기 후, 시킹에 따라 글자별 색상/스케일/트램블을 적용
  - params: 
    - `tokens: [{ ch:string, t0:number, t1:number, speaker?:string, kind?:'pop'|'loud'|'whisper', color?:string, volumeDb?:number, pitchHz?:number, offscreen?:boolean }]`
    - `palette?: Record<string,string>` (speaker→color 매핑)
    - `typeSize?: { min:number, base:number, max:number }` (상대 화면 높이 비율)
    - `popScale?: number`(기본 1.15), `tremble?: { ampPx:number, freq:number }`
  - Font(Roboto Flex): 데모에서는 Google Fonts 사용 가능
    - `<link href="https://fonts.googleapis.com/css2?family=Roboto+Flex&display=swap" rel="stylesheet" />`
    - 필요 시 로컬 폰트(`demo/samples/assets/Instal Font - RobotoFlex.ttf`)를 `FontFace`로 등록하는 대체 경로도 허용

- 시나리오 구성:
  - 하단 20% 작업영역: `stage.safeArea.top=0.8` + 필요 시 노드 `layout.safeAreaClamp=true`
  - 캡션 박스는 `captions` 트랙의 cue/root 그룹에서 구성(배경/clip/패딩), 텍스트 노드에는 실제 문자열은 넣지 않고 플러그인이 토큰 DOM 렌더
  - 텍스트 노드: `pluginChain:[{ name:'cwi', params, /* loud 토큰에 한해 breakout 권장 */ }]`

체크리스트
- [ ] `demo/index.html`의 비디오 src를 `samples/assets/friends.mp4`로 지정
- [ ] `cwi@1.0.0` 플러그인(manifest/index.mjs) 구현 및 dev 로더 동작 확인
- [ ] `tmp/real.json` → `demo/samples/cwi_demo.json` 변환 로직/정적 산출물 추가
- [ ] `demo/main.ts` 샘플 목록에 `cwi_demo` 추가 및 preload 연동

-수용 기준
- [ ] 재생 시 글자별 발화 타이밍에 맞춰 색상 전환과 모션(pop/loud/whisper)이 체감 가능
- [ ] 일반/whisper 토큰은 캡션 박스 클립 내에서 동작하고, loud 토큰만 박스를 탈출해 확대 연출됨
- [ ] 데모에서 `cwi_demo` 선택 시 오류 없이 로드/재생
- [ ] 기존 샘플 동작 회귀 없음

소요/리스크
- 소요: 0.5일 내외(플러그인 DOM/seek 처리 + JSON 변환)
- 리스크: 문자 수가 많을 경우 DOM 업데이트 비용 증가 → 필요 시 requestIdleCallback 등 최적화 후속

---

## 7) 보안 로더 (M7)
- [ ] ManifestValidator: 필수 필드/버전/peer/minRenderer 체크
- [ ] Integrity: SHA-384, 선택 ed25519 서명
- [ ] AssetFetcher: preload + 무결성 검증
- [ ] PluginLoader: fetch→검증→Blob→import 순서 엄수

### 검증 (M7)
- [ ] 정상 manifest: 해시 일치 → import 성공
- [ ] 해시 불일치/서명 실패: import 차단 + 폴백 동작
- [ ] preload 자산 무결성 검사 실패 시 캐치 및 사용자 친화적 오류

## 8) 런타임 (M8)
- [ ] PortalManager: breakout(mode/coordSpace/return/transfer)
- [ ] DomMount/CssVars: DOM/스타일 반영(StyleApply 일부 사용 중)

### 검증 (M8)
- [ ] breakout transfer 기본값이 move로 동작(clone 지정 시 복제 확인)
- [ ] coordSpace별 좌표 변환이 올바르게 적용
- [ ] unmount/dispose에서 DOM/리스너 누수 없음

## 9) 렌더러 통합 (M9)
- [x] Track/Cue/Node 기본 연결, 활성 창 계산(`MotionTextRenderer` 내)
- [ ] PluginLoader/Timeline(rVFC)/Stage 모듈 정식 연동

### 검증 (M9)
- [ ] 복합 샘플 시나리오에서 전 구간 오류/경고 없이 재생
- [ ] 대량 토큰(wordStream) 케이스에서 프레임 드랍 없이 안정 재생
- [ ] 시킹/배속/리사이즈 복합 상호작용에서도 동기 정확성 유지

## 10) 데모/문서 (M10~M11)
- [x] demo/main.ts 연동, 샘플(JSON) 구동/선택 UI
- [ ] README에 사용법/주의사항/보안 흐름 추가

### 검증 (M10~M11)
- [ ] Demo에서 주요 기능(로드/재생/시킹/플러그인/브레이크아웃)이 시나리오별로 확인 가능
- [ ] README의 설치/사용 예제가 실제로 동작
- [ ] 배포 패키지에는 demo 제외(files: ["dist"]) 유지

---

진행 로그
- [x] M0 Scaffold: src 구조 및 문서 정리(2025-09-06)
- [x] M1 타입 정의 완료(2025-09-06)
- [x] M2 시간 유틸 완료(2025-09-06)
- [x] M2.6 커스텀 컨트롤러 1차 완료(2025-09-06)
- [x] M3 ScenarioParser 정식 도입(2025-09-06)
- [x] M2.5 데모 최소 구동/샘플 연동(2025-09-07)
- [x] M4 합성(PluginChain, last-wins/compose) 적용(2025-09-07)
- [x] M5 레이아웃 엔진 1차( position/anchor/size/transform/override/safeAreaClamp, flow/grid, overlap push/stack )(2025-09-07)
- [x] M5.5 리팩토링: 핵심 모듈 분리 및 아키텍처 개선(2025-09-07)
- [x] M5.6 품질 보완/최적화: Stage 안정성 강화 및 테스트 보강(2025-09-07)
- [x] M6 타임라인: rVFC 전환 + snapToFrame 연동 + 테스트 통과(2025-09-07)

다음 작업(Next Up)
1) M7: PluginLoader 파이프라인(무결성 검증→Blob import)  
2) M8: PortalManager 기본 동작(transfer:"move"/coordSpace 변환)
3) Transform 순서 개선 (M7 또는 M8에서 처리)

---

## Known Issues (향후 해결 예정)

### Transform 순서 불일치 (M6에서 검토 예정)
**문제**: 현재 `buildTransform()` 순서는 `base → scale → translate(px) → rotate`이지만, CSS transform의 우측부터 적용 특성상 translate가 scale의 영향을 받는 구조입니다.

**현재 동작**: 
```javascript
// StyleApply.ts:5
buildTransform(base, {sx: 2, tx: 100, rot: 45})
// → "base scale(2, 2) translate(100px, 50px) rotate(45deg)"
// 실제 적용: rotate(45deg) → translate(200px, 100px) → scale(2, 2) → base
//           ^^^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^ 
//           rotate 후          translate는 scale 영향 받음
```

**의도했던 동작**: "픽셀 이동이 스케일 영향 X"  
**올바른 순서**: `base → translate → scale → rotate` 또는 matrix 변환 사용

**영향**: 플러그인의 translate(px) 채널이 layout scale과 의도와 다르게 상호작용 가능

**M6 해결 방안**: 
- 순서 변경 후 기존 테스트/데모 영향 분석
- 또는 matrix 기반 변환으로 완전 재설계
- 스펙 문서와 구현 일치성 확보

### Plugin Window 프리컴퓨트 (성능 최적화)
**현재 상태**: 매 프레임마다 각 노드의 pluginSpec 시간 창(t0, t1) 계산  
**최적화 기회**: 노드 단위로 `(t0,t1,D)` 사전 계산 후 in-range/progress만 계산  
**우선도**: 낮음 (현재 성능 문제 없음)

### TrackManager 오프셋 캐싱
**현재 상태**: push/stack 정책 시 매번 `computeGroupOffsets()` 재계산  
**최적화 기회**: (표시상태/높이/rowGap) 키 기반 결과 캐싱  
**우선도**: 낮음 (push/stack 정책 드물게 사용)
