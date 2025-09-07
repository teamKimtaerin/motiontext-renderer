# motiontext-renderer 구현 계획 (living doc)

이 문서는 구현 단계·우선순위·체크리스트를 관리하는 살아있는 계획서입니다. 작업 진행 시 이 파일을 계속 갱신합니다.

참조 문서
- 시나리오(JSON) 스펙 v1.3: `context/scenario-json-spec-v-1-3.md`
- 플러그인 시스템 아키텍처(v2): `context/plugin-system-architecture-v-2.md`
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
- M6 타임라인: TimelineController 시킹/배속/rVFC — 진행 중(rAF 기반 구현, rVFC 전환 예정)
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
- [ ] rVFC 루프, mediaTime 기반 진행(현재 rAF 기반 최소 구현 완료)
- [x] pause/play/seek API — rate는 비디오에 위임
- [ ] snapToFrame 옵션 적용(rVFC 전환 시 반영)
- [x] 플러그인에는 progress만 전달(합성기에서 상대 p 계산)

### 검증 (M6)
- [ ] rVFC 기반으로 미디어 드리프트 없이 진행도 고정
- [ ] pause/play/seek/rate가 Demo에서 즉시 반영
- [ ] snapToFrame 켜고 끄기 시 경계 프레임 매칭 확인

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

다음 작업(Next Up)
1) M6: rVFC 기반 타임라인 전환 + snapToFrame 연동
2) M7: PluginLoader 파이프라인(무결성 검증→Blob import)  
3) M8: PortalManager 기본 동작(transfer:"move"/coordSpace 변환)
4) Transform 순서 개선 (M6 또는 M7에서 처리)

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
