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
- M2.5 데모 최소구동: MotionTextRenderer 스켈레톤 + Text 노드 렌더 — 진행 예정
- M2.6 커스텀 컨트롤러(Controller UI): 플레이어|렌더러|컨트롤러 3층 구조, 전체화면/자막 토글/시킹 연동 — 진행 예정
- M3 파서: ScenarioParser + 검증(`src/parser/ScenarioParser.ts`) — 진행 예정
- M4 합성: PluginChainComposer(채널 합성, last-wins/compose) — 진행 예정
- M5 레이아웃 최소: Stage/LayoutEngine 정규화→px 변환 — 진행 예정
- M6 타임라인: TimelineController 시킹/배속/rvfc — 진행 예정
- M7 보안 로더: Integrity/Manifest/Asset/PluginLoader 파이프라인 — 진행 예정
- M8 런타임: PortalManager/DomMount/StyleApply/CssVars — 진행 예정
- M9 렌더러: Renderer 오케스트레이션(트랙/큐/노드/플러그인 통합) — 진행 예정
- M10 데모 연동: demo/main.ts에 기본 구동/샘플 시나리오 — 진행 예정
- M11 문서/예제: README 사용 가이드, 간단 예제 — 진행 예정

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
- [ ] `src/core/Renderer.ts`: 최소 오케스트레이션(텍스트 노드만 지원, 플러그인/브레이크아웃 제외)
- [x] `src/parser/ScenarioParser.ts`: v1.3 일부 필수 필드만 검증/정규화(version/timebase/stage/tracks/cues)
- [x] `src/layout/LayoutEngine.ts`: `position{x,y}`만 픽셀로 매핑(앵커 기본값, 오버플로우 clip)
- [x] `src/core/TimelineController.ts`: rVFC 루프에서 `mediaTime` 구독 및 텍스트 활성/비활성 토글
- [x] `demo/main.ts`: 샘플 JSON을 v1.3 스펙 키(e_type/text/layout.position{x,y})로 정렬 또는 dev-only 어댑터로 변환
      (ScenarioParser가 dev-only 어댑터 역할 수행)
- [ ] 수용 기준: 비디오 재생 시 지정 구간에 텍스트가 나타나고/사라짐(플러그인 없이)

검증
- [x] `pnpm dev`로 데브 서버 실행, 콘솔 에러 0
- [x] Demo에서 basic 샘플 로드 → absStart~absEnd 동안만 텍스트 표시
- [x] 일시정지/재생/시킹 시 텍스트 표시 상태가 정확히 동기화
- [ ] 창 크기 변경 시 텍스트 위치가 스테이지 정규화 좌표에 맞게 유지

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
 - [ ] 정규화→픽셀 변환, anchor/transform 파이프라인 정비
 - [ ] translate/size/overflow/transformOrigin 지원
 - [ ] override(mode:"absolute") 오프셋/변환 적용, keepUpright(텍스트) 설계
 - [ ] safeAreaClamp 처리(stage/track.safeArea 통합), subtitle 기본 overflow:"clip"
 - [ ] flow/grid 모드 1차 구현(간단 스택/갭), overlapPolicy(push/stack) 연동

### 세부 TODO (M5)
  - [ ] 파이프라인: anchor → translate(%) → scale → rotate → skew → override(translate/scale/rotate/skew) → pluginChain
  - [ ] translate: 정규화(0..1) → % 변환, 누적 순서 보장
  - [ ] size: width/height 정규화(0..1)/auto 지원, 기준(track/stage) 정의
  - [ ] overflow: clip|visible 처리; subtitle 기본 clip, free는 기본 visible
  - [ ] transformOrigin: 문자열(예: "50% 50%") 파싱/반영, anchor와 상호작용 정리
  - [ ] override(mode:"absolute"): offset{x,y}(%) + transform 누적; Text `keepUpright`(M5.1)
  - [ ] safeAreaClamp: stage.safeArea ∧ track.safeArea 병합 후 position/size 클램프
  - [ ] flow(1차): 세로 스택+gapRel, anchor 기준 정렬, overlapPolicy(push/stack) 최소 연동
  - [ ] grid(1차): 간단 2D 배치(행 우선), gapRel 적용(선택)
  - [ ] 스테이지 메트릭: baseAspect auto→ 비디오/컨테이너 비율 사용, 리사이즈/전체화면 시 Reflow
  - [ ] Reflow: ResizeObserver + throttle, 레이아웃 재계산 경로 고정

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

## 6) 타임라인 컨트롤 (M6)
- [ ] rVFC 루프, mediaTime 기반 진행
- [ ] seek(rate)/pause/play/snapToFrame API
- [ ] 플러그인에는 progress만 전달(타이머 금지)

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
- [ ] DomMount/StyleApply/CssVars: DOM/스타일 반영

### 검증 (M8)
- [ ] breakout transfer 기본값이 move로 동작(clone 지정 시 복제 확인)
- [ ] coordSpace별 좌표 변환이 올바르게 적용
- [ ] unmount/dispose에서 DOM/리스너 누수 없음

## 9) 렌더러 통합 (M9)
- [ ] Track/Cue/Node 런타임 연결, 활성 창 계산
- [ ] PluginLoader/Composer/Layout/Timeline 연동

### 검증 (M9)
- [ ] 복합 샘플 시나리오에서 전 구간 오류/경고 없이 재생
- [ ] 대량 토큰(wordStream) 케이스에서 프레임 드랍 없이 안정 재생
- [ ] 시킹/배속/리사이즈 복합 상호작용에서도 동기 정확성 유지

## 10) 데모/문서 (M10~M11)
- [ ] demo/main.ts 연동, 샘플 JSON 구동 확인
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

다음 작업(Next Up)
1) M2.5 최소 구동 구현 후 `pnpm dev`로 데모 확인
2) 이어서 M3 ScenarioParser 기본 파싱/검증
