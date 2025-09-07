# AI 부팅 프롬프트 — MotionText Renderer

이 문서는 VS Code를 새로 열어 컨텍스트가 초기화된 AI에게, 이 프로젝트를 신속히 재이해하고 연속적으로 작업을 이어가도록 지시하는 스타터 프롬프트입니다. 아래 순서를 그대로 따라 주세요.

## 0) 컨텍스트 로드(필독)
- 먼저 다음 문서들을 빠르게 훑고 핵심을 요약하세요.
  - `context/implement-plan.md` — 최신 로드맵/체크리스트/Next Up
  - `context/folder-structure.md` — 폴더/파일 책임
  - `context/scenario-json-spec-v-1-3.md` — 시나리오 스펙
  - `context/plugin-system-architecture-v-2.md` — 플러그인 아키텍처
  - 최근 변경 로그: 가장 최신 `context/change_log/*.md`

## 1) 현재 상태(요약 가이드)
- 완료: 타입셋(M1), 시간 유틸(M2), 데모 최소구동(M2.5), 컨트롤러(M2.6), 파서(M3), 합성(M4), 리팩토링(M5.5), 품질 보완(M5.6: Stage 안정화/테스트/메모리 누수 개선)
- 부분: 레이아웃(M5 일부 — anchor/size/transform/override/safeAreaClamp, flow/grid, overlap push/stack)
- 진행 중: 타임라인(M6 — 현재 rAF, rVFC로 전환 예정)
- Next Up: M6 rVFC → M7 보안 로더 → M8 포털

핵심 원칙(요약)
- 타임라인 소유권은 렌더러에 있음. 플러그인은 상대 Timeline/seek만 제공.
- pluginChain 충돌은 기본 last‑wins, 필요 시 compose:"add"/"multiply".
- breakout 기본 transfer:"move".
- 보안 로딩 순서: fetch → 해시/서명 검증 → Blob import.

## 2) 오늘의 목표 — M6 타임라인(rVFC) 전환
타임라인 정확도/드리프트 내성을 강화하고, 프레임 스냅 옵션을 준비합니다.

1) rVFC 루프 도입
   - `TimelineController`: rAF → `requestVideoFrameCallback` 기반 루프로 전환(폴백 rAF 유지)
   - mediaTime 기반 tick, pause/seek 호환성 유지
2) snapToFrame 옵션 연동
   - 시나리오 `behavior.snapToFrame`/`fps`를 전달해 `computeRelativeWindow`의 스냅 옵션과 접속
   - 경계 프레임에서 활성 판정/진행도 일관성 확인
3) 합성 파이프라인 검증
   - 플러그인은 여전히 progress만 전달; 합성기는 기존 규칙 유지(last‑wins/add/multiply)
4) 테스트/계측
   - rVFC tick 정확성(정지/시킹/배속) 단위 테스트
   - snapToFrame on/off 경계 프레임 스냅 샘플 케이스
   - 간단 로깅/Performance 계측으로 드리프트 확인

수용 기준
- `pnpm typecheck`/`pnpm build` 무오류, 데모 샘플 시각 동작 동일
- rVFC에서 일시정지/시킹/배속 시 진행도 즉시 반영(눈에 띄는 드리프트 없음)
- snapToFrame on/off 시 경계 프레임 매칭 확인

## 3) 작업 절차(운영)
- 계획 수립: update_plan을 사용해 위 항목(1→7)을 체크박스로 등록하고 진행 상태 갱신
- 변경은 작은 단위로: 단계별 패치/검증/문서 갱신 후 커밋(작업 메시지 예시는 아래 참고)
- 안전 가드: 기능 회귀(데모 동작 변화)가 감지되면 즉시 롤백 또는 스코프 축소
- 문서 우선: 완료 시 `context/implement-plan.md`의 M5.6 섹션 체크리스트를 반영하고, `context/change_log/`에 항목 추가

## 4) 유용한 명령
- 타입 검사: `pnpm typecheck`
- 테스트: `pnpm test` / `pnpm test:run` / `pnpm test:coverage`
- 개발 서버: `pnpm dev` (브라우저에서 데모 확인)
- 번들: `pnpm build`

## 5) 커밋 메시지 가이드(예시)
```
feat(timeline): migrate to rVFC loop; add snapToFrame support

- Timeline: replace rAF with requestVideoFrameCallback (fallback rAF); mediaTime-driven tick; pause/seek/rate compatible
- Behavior: wire behavior.snapToFrame/fps into window computation
- Tests: rVFC tick accuracy; snap boundary cases; no visual regressions in demos
- Docs: update implement-plan(M6) and ai-bootstrap-prompt
```

## 6) 참고 자료
- 합성 예제: `docs/plugin-chain-examples.md`

## 7) 시작 멘트(복사해서 첫 대화로 쓰세요)
```
이 프롬프트를 읽고 프로젝트 컨텍스트를 로드한 뒤, implement-plan의 M6 타임라인 전환 스프린트를 계획(update_plan)하고 1) rVFC 루프 도입부터 착수해 주세요. snapToFrame 연동/경계 테스트까지 포함하고, 데모 회귀를 수시로 확인해 주세요.
```
