# AI 부팅 프롬프트 — MotionText Renderer

이 문서는 VS Code를 새로 열어 컨텍스트가 초기화된 AI에게, 이 프로젝트를 신속히 재이해하고 연속적으로 작업을 이어가도록 지시하는 스타터 프롬프트입니다. 아래 순서를 그대로 따라 주세요.

## 0) 컨텍스트 로드(필독)
- 먼저 다음 문서들을 빠르게 훑고 핵심을 요약하세요.
  - `context/implement-plan.md` — 최신 로드맵/체크리스트/Next Up
  - `context/folder-structure.md` — 폴더/파일 책임
  - `context/scenario-json-spec-v-1-3.md` — 시나리오 스펙
  - `context/plugin-system-architecture-v-2-1.md` — 플러그인 아키텍처
  - 최근 변경 로그: 가장 최신 `context/change_log/*.md`

## 1) 현재 상태(요약 가이드)
- 완료: 타입셋(M1), 시간 유틸(M2), 데모 최소구동(M2.5), 컨트롤러(M2.6), 파서(M3), 합성(M4), 리팩토링(M5.5), 품질 보완(M5.6: Stage 안정화/테스트/메모리 누수 개선), 타임라인(M6: rVFC 전환/attach-only/ensurePlaying/세대 토큰/snapToFrame 연동)
- 부분: 레이아웃(M5 일부 — anchor/size/transform/override/safeAreaClamp, flow/grid, overlap push/stack)
- Next Up: M6.7.hotfix(CwI word-per-node) → M7 보안 로더 → M8 포털

핵심 원칙(요약)
- 타임라인 소유권은 렌더러에 있음. 플러그인은 상대 Timeline/seek만 제공.
- pluginChain 충돌은 기본 last‑wins, 필요 시 compose:"add"/"multiply".
- breakout 기본 transfer:"move".
- 보안 로딩 순서: fetch → 해시/서명 검증 → Blob import.

## 2) 오늘의 목표 — M6.7 핫픽스: CwI 구조 개편 (word‑per‑node)
현재 cwi 플러그인이 tokens 파라미터로 모든 단어를 내부 span으로 생성합니다. 이를 "단어=Text 노드" 구조로 바꾸고 각 단어에 cwi 애니메이션을 부착합니다. 구형 JSON은 사용하지 않으며, 신 구조로 일괄 이관합니다.

1) 스키마
   - 시나리오(JSON): 캡션 그룹 하위에 단어 Text 노드 배열, 각 노드에 `absStart/absEnd`와 `pluginChain`(cwi) 부착
2) 플러그인(cwi)
   - tokens 경로 제거, `params.kind`로 단일 텍스트 애니메이션(pop/whisper/loud)
   - 색상: `params.speaker` + `palette`(선택) 기반, 기본 노랑 유지
3) 데모 샘플
   - `cwi_demo.json`/`cwi_demo_full.json`을 word‑per‑node 구조로 변환(구형 JSON 폐기)
   - 부모 그룹에서 캡션 박스 스타일(배경/패딩/라운딩) 유지, 단어 노드는 배경 없음
4) 레이아웃/안전영역
   - safeAreaClamp와 리사이즈 시 재배치 회귀 확인, 수평/수직 클리핑 제거
5) 검증
   - 재생 리듬/모션이 기존과 시각적으로 근접, 전체화면/창 크기 변경에서도 안정

수용 기준
- `pnpm typecheck`/`pnpm build` 무오류
- 새 구조 JSON만 로드/재생(구형 JSON 미지원)
- 특정 단어만 다른 애니메이션으로 JSON만 수정해 반영 가능

- 계획 수립: update_plan으로 M6.7.hotfix 세부 항목(스키마→플러그인→샘플→검증)을 등록·추적
- 작은 단위 변경: 단계별 패치/검증/문서 갱신 후 커밋(아래 메시지 가이드 참고)
- 회귀 가드: 레이아웃/세이프에어리어/플레이 제어 회귀 시 즉시 롤백 또는 스코프 축소
- 문서 우선: 완료 시 `context/implement-plan.md`의 6.7.hotfix 섹션 체크리스트 갱신, `context/change_log/` 추가

## 4) 유용한 명령
- 타입 검사: `pnpm typecheck`
- 테스트: `pnpm test` / `pnpm test:run` / `pnpm test:coverage`
- 개발 서버: `pnpm dev` (브라우저에서 데모 확인)
- 번들: `pnpm build`

## 5) 커밋 메시지 가이드(예시)
```
feat(cwi-hotfix): refactor to word-per-node architecture

- Schema: express words as Text nodes with {absStart,absEnd}+cwi(kind)
- Plugin: per-word {kind,speaker?,palette?}; remove tokens/span path
- Demo: migrate cwi_demo(_full) to new structure; keep box styles at group
- Docs: update implement-plan(6.7.hotfix) and ai-bootstrap-prompt
```

## 6) 참고 자료
- 합성 예제: `docs/plugin-chain-examples.md`

## 7) 시작 멘트(복사해서 첫 대화로 쓰세요)
```
이 프롬프트를 읽고 컨텍스트를 로드한 뒤, implement-plan의 6.7.hotfix(CwI word‑per‑node)를 계획(update_plan)하고 1) 스키마/어댑터부터 착수해 주세요. 샘플 변환과 회귀 검증까지 포함해 주세요.
```
