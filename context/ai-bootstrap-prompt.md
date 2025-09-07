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
- 완료: 타입셋(M1), 시간 유틸(M2), 데모 최소구동(M2.5), 컨트롤러(M2.6), 파서(M3), 합성(M4), 리팩토링(M5.5)
- 부분: 레이아웃(M5 일부 — anchor/size/transform/override/safeAreaClamp, flow/grid, overlap push/stack)
- 진행 중: 타임라인(M6 — 현재 rAF, rVFC로 전환 예정)
- Next Up: M5.6 품질 보완/최적화 → M6 rVFC → M7 보안 로더 → M8 포털

핵심 원칙(요약)
- 타임라인 소유권은 렌더러에 있음. 플러그인은 상대 Timeline/seek만 제공.
- pluginChain 충돌은 기본 last‑wins, 필요 시 compose:"add"/"multiply".
- breakout 기본 transfer:"move".
- 보안 로딩 순서: fetch → 해시/서명 검증 → Blob import.

## 2) 오늘의 목표 — M5.6 품질 보완/최적화 스프린트
아래 항목으로 이벤트/성능/타입/테스트 품질을 보강합니다(기능 회귀 없이 내부 품질 개선).

1) Stage 안정성
   - `onBoundsChange(cb)`가 구독 해지 함수를 반환하도록 개선, 재바인딩(Idempotent) 안전성 확인
   - `configure({ baseAspect })` 사용성 재검토(가능하면 `setScenario()` 일원화) 및 문서 정리
2) Transform 순서 검증
   - `buildTransform`: base(layout) → scale → translate(px) → rotate 순서가 의도(픽셀 이동이 스케일 영향 X)에 부합하는지 확인 및 테스트
3) Plugin 창(window) 프리컴퓨트
   - 노드 단위로 각 `pluginSpec`의 `(t0,t1,D)` 캐시 → 프레임마다 in-range/진행도만 계산
   - 필요 시 `composeActive` 오버로드(사전 계산 창 입력) 설계
4) TrackManager 성능 최적화
   - `computeGroupOffsets` 결과를 (표시 상태/높이/rowGap) 키로 캐시, 변화 없으면 재계산 스킵
5) 타입 엄격화
   - `GroupItem.node: any` → `TextNode`로 좁히기 등 공개 API 타입 명확화
6) 문서/주석 동기화
   - `src/index.ts` 상단 주석 최신화, `context/folder-structure.md`/`context/init-context.md` 업데이트, change_log 추가
7) 테스트 보강
   - anchors 유닛 테스트, StyleApply transform 스냅샷, TrackManager 오프셋 케이스, Stage content rect 산출 케이스 추가

수용 기준
- `pnpm typecheck`/`pnpm build` 무오류, 데모 샘플 동작 동일(basic/animated/tilted_box/m5_layout_features)
- 전체화면/리사이즈/시킹 시 동작 회귀 없음
- 불필요한 창 계산/오프셋 재계산 감소(로그/계측으로 확인)

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
perf(core, composer): precompute plugin windows; cache group offsets; add tests

- Stage: onBoundsChange unsubscribe + idempotent rebind; index header/doc sync
- Composer: accept precomputed windows for composeActive; reduce per-frame overhead
- TrackManager: cache offsets by height/rowGap/visibility
- StyleApply: verify transform order; add snapshot tests
- Tests/Docs: anchors/style/trackmanager/stage cases; update implement-plan(M5.6)
```

## 6) 참고 자료
- 합성 예제: `docs/plugin-chain-examples.md`

## 7) 시작 멘트(복사해서 첫 대화로 쓰세요)
```
이 프롬프트를 읽고 프로젝트 컨텍스트를 로드한 뒤, implement-plan의 M5.6 품질 보완/최적화 스프린트를 계획(update_plan)하고 1) Stage 구독 해지/재바인딩 안전성부터 착수해 주세요. 변경 전후로 데모 동작 회귀가 없는지 확인하고, 단계별로 테스트/문서/로그를 갱신하며 진행해 주세요.
```
