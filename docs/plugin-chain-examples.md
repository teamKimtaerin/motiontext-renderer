# Plugin Chain Composition — Worked Examples

이 문서는 pluginChain의 시간 창(window) 평가와 채널 합성 규칙(add/multiply/replace)의 실제 동작을 예제로 정리합니다. 구현 레퍼런스는 다음 코드를 참조하세요.

- composer: `src/composer/PluginChainComposer.ts:45`
- 시간 창 계산: `src/utils/time.ts:74`
- 빌트인 플러그인 샘플: `src/runtime/plugins/Builtin.ts:12`

## 1) 예제 A — fadeIn + pop(multiply) + waveY(add)

요소 구간: `absStart=2.0`, `absEnd=6.0` (길이 D=4.0s)

체인 정의(예: 데모 tilted_box와 유사):
```json
{
  "pluginChain": [
    { "name": "fadeIn", "relStartPct": 0.0, "relEndPct": 0.2 },
    { "name": "pop",    "relStartPct": 0.0, "relEndPct": 0.3, "compose": "multiply", "params": { "maxScale": 1.15 } },
    { "name": "waveY",  "relStartPct": 0.1, "relEndPct": 0.9, "compose": "add", "params": { "amplitudePx": 10, "frequency": 1.5 } }
  ]
}
```

시간 창 계산(`computeRelativeWindow`는 기본적으로 [absStart, absEnd]로 클램프):
- fadeIn: t0 = 2.0 + D*0.0 = 2.0, t1 = 6.0 + D*0.2 = 6.8 → 클램프 → [2.0, 6.0)
- pop(multiply): t0 = 2.0 + 0, t1 = 6.0 + 1.2 = 7.2 → 클램프 → [2.0, 6.0)
- waveY(add): t0 = 2.0 + 0.4 = 2.4, t1 = 6.0 + 3.6 = 9.6 → 클램프 → [2.4, 6.0)

합성 규칙(`composeChannels`):
- pop은 `multiply`: sx/sy는 누적 곱(초깃값 1)
- waveY는 `add`: ty는 누적 합(초깃값 0)
- fadeIn은 미지정 → `replace`: opacity는 뒤에서 지정되면 교체(여기선 단독 채널)

샘플 시점별 결과(개념/근사값):
- t=2.0s
  - fadeIn p=(2.0-2.0)/4=0 → opacity≈0
  - pop p=0 → sx=sy≈1.00 (maxScale=1.15 기준)
  - waveY 비활성
  - 합성: { opacity:0, sx:1.00, sy:1.00 }
- t=3.0s
  - fadeIn p=1/4=0.25 → opacity≈0.578 (easeOutCubic)
  - pop p=0.25 → sx≈sy≈1.12 (backOut·maxScale 1.15)
  - waveY p=(3.0-2.4)/(6.0-2.4)=0.166… → ty≈10px·sin(2π·1.5·0.166…)≈+10px
  - 합성: { opacity:~0.58, sx:~1.12, sy:~1.12, ty:~+10 }
- t=5.8s
  - fadeIn p=3.8/4=0.95 → opacity≈1.00
  - pop p≈0.95 → sx≈sy≈1.15 근접
  - waveY p=(5.8-2.4)/3.6≈0.944 → ty≈10px·sin(2π·1.5·0.944) (진동 위치)
  - 합성: { opacity:~1.00, sx:~1.15, sy:~1.15, ty:~(−10..+10) }

적용(`applyChannels`):
- transform = [baseTransform] → `scale(sx,sy)` → `translate(tx,ty)` → `rotate(rot)`
- opacity 있으면 CSS `opacity` 적용

특징 요약:
- 창이 겹치는 동안 pop의 스케일은 곱셈 누적, waveY의 이동은 덧셈 누적
- 동일 채널 충돌이 없으므로 replace 규칙은 영향 없음

## 2) 예제 B — 동일 채널 충돌: last‑wins vs compose

체인 정의:
```json
{
  "pluginChain": [
    { "name": "fadeIn",  "relStartPct": 0.0, "relEndPct": 0.8 },
    { "name": "fadeOut", "relStartPct": 0.2, "relEndPct": 1.0 }
  ]
}
```
- 0.2D~0.8D 구간에서 두 플러그인의 창이 겹침
- 두 플러그인 모두 `opacity` 채널을 출력, compose 미지정 → `replace`
- 합성기 순회가 체인 순서이므로, 겹치는 구간에서는 마지막 플러그인(fadeOut)의 `opacity`가 최종값이 됨(= last‑wins)
- 만약 `fadeOut`에 `compose:"multiply"`를 지정하면, 결과 `opacity`는 `fadeIn.opacity * fadeOut.opacity`로 누적됨

## 3) 예제 C — add/multiply 혼합 누적

체인 정의:
```json
{
  "pluginChain": [
    { "name": "pop",   "compose": "multiply", "params": { "maxScale": 1.2 } },
    { "name": "shakeX", "compose": "add",       "params": { "amplitudePx": 6, "cycles": 8 } }
  ]
}
```
- `sx/sy`는 곱셈 누적(스케일 효과 중첩)
- `tx`는 덧셈 누적(흔들림이 다른 이동과 합산)
- 동일 프레임에서 pop이 `sx,sy`, shakeX가 `tx`를 건드리므로 충돌 없음

## 구현 노트
- 활성 판단: `[t0, t1)` (반개구간), 끝 시점은 비활성 처리 (`src/utils/time.ts:108`)
- 창 계산 기본 클램프: `[absStart, absEnd]` 밖으로 넘치면 자동 절단 (`src/utils/time.ts:88`)
- 합성 순서: 체인 순서대로 순회 → compose 규칙 적용 → 마지막 결과만 DOM에 반영 (`src/composer/PluginChainComposer.ts:45`)
- 프레임 스냅 필요 시: `computeRelativeWindow(..., { snapToFrame:true, fps })`로 전환 가능

---

이 문서는 데모 샘플과 일치하는 체인 구성을 사용하여 합성 동작을 설명합니다. 실제 플러그인(외부 로더 기반)도 동일한 합성 규칙을 따르며, `evalFn` 주입 지점에서 채널을 산출하면 합성 파이프라인에 그대로 통합됩니다.

