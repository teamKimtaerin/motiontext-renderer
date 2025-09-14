# MotionText Renderer v1.3 → v2.0 마이그레이션 프롬프트

이 프롬프트는 다른 프로젝트에서 motiontext-renderer를 v1.3에서 v2.0으로 안전하게 마이그레이션하기 위해 AI 또는 담당 개발자에게 그대로 전달할 작업 지시서입니다. 코드/JSON/플러그인/빌드까지 일괄 전환하고, 검증 기준과 체크리스트를 포함합니다.

## 목적
- v1.3 시나리오(JSON)와 코드 전반을 v2.0 체계로 전환
- 자동 마이그레이션 API 활용 + 수동 검토 지점 명확화
- 플러그인 API v3.0 대응(필요 시)

## 필수 배경(요약)
- 시간 필드 통일: `[start, end]` 배열 사용 (`displayTime`, `timeOffset`, `domLifetime`)
- Define 시스템 도입: `"define.key"` 참조로 색상/폰트/스타일/에셋을 중앙 관리
- 노드 ID 의무화: 모든 노드에 고유 `id` 필요
- 플러그인 API v3.0: DOM 분리(baseWrapper/effectsRoot), 채널 합성(CSS 변수), capabilities 기반 권한

### baseTime 핵심 요약
- `timeOffset`은 노드의 `displayTime`과 독립적인 기준 구간인 `baseTime`을 사용합니다.
- 오프셋 표기는 두 가지만 허용됩니다: 절대 초(number; 음수 허용) 또는 퍼센트 문자열(`"50%"`).
- 퍼센트는 `baseTime` 길이에 대한 비율입니다. `baseTime`이 지정되지 않으면 해당 노드의 `displayTime`을 기준으로 사용합니다.

## 입력(대상)
- 기존 v1.3 시나리오 JSON 파일들
- v1.3 전용 코드(파서/타입/유틸 직접 참조 등)
- 커스텀 플러그인(있다면) 및 manifest

## 수행 단계
1) 의존성 업데이트
- 패키지 업데이트: `motiontext-renderer@^2` 로 올리고 `gsap@^3.12`가 peer로 설치되어 있는지 확인
- 타입스크립트(권장): `typescript@^5` 유지

2) 자동 마이그레이션 적용(권장)
- CompatibilityLayer 또는 V13ToV20Migrator 사용해 v1.3 → v2.0 변환

```ts
import { CompatibilityLayer, V13ToV20Migrator } from 'motiontext-renderer';

// 간단 경로(자동 감지 + 변환)
const v2Scenario = CompatibilityLayer.processQuick(v13Scenario);

// 세부 옵션 제어
const migrator = new V13ToV20Migrator({
  defineStrategy: 'conservative', // 'aggressive' | 'conservative' | 'none'
  minDuplicateCount: 5,
  generateNodeIds: true,
  showWarnings: true,
});
const { scenario: migrated, warnings } = migrator.migrate(v13Scenario);
```

3) 필드 매핑(수동 점검 체크리스트)
- hintTime → domLifetime: `[start, end]` 윈도우로 환산(없으면 최소 창 자동 부여 가능)
- absStart/absEnd → displayTime: `[start, end]`
- relStart/relEnd(+ relStartPct/relEndPct, t0/t1) → timeOffset: `[start, end]`
- 누락된 노드 `id` 생성 및 중복 검증
- 반복 값은 `define`으로 추출하여 `"define.key"` 참조로 치환

### baseTime 선택 가이드(마이그레이션 시)
- 기본 규칙: 해당 플러그인이 붙는 노드의 `displayTime`을 `baseTime`으로 사용합니다.
- 그룹/큐/스테이지 레벨 플러그인처럼 노드가 모호한 경우:
  - 큐 루트에 붙는 플러그인 → 큐 루트 노드의 `displayTime`
  - 트랙/스테이지 전역 플러그인 → 명시적 `baseTime` 구간을 정의하거나, 연출 의도에 맞는 상위 구간으로 고정(권장: 시나리오 전체 길이)
- 퍼센트 변환: v1.3의 `relStartPct/relEndPct`가 있었다면, `timeOffset`을 `"{pct*100}%"` 문자열로 변환하세요.
- 절대 초 변환: v1.3의 `relStart/relEnd`(초)는 그대로 숫자 배열로 옮기면 됩니다. 음수도 허용됩니다.

예시)
```jsonc
// v1.3
{
  "absStart": 2, "absEnd": 6,
  "pluginChain": [{ "name": "fadeIn", "relStart": 0.1, "relEnd": 0.8 }]
}

// v2.0 (baseTime = node.displayTime = [2,6])
{
  "displayTime": [2, 6],
  "pluginChain": [{ "name": "fadeIn", "timeOffset": [0.1, 0.8] }]
}

// v1.3 (퍼센트)
{
  "absStart": 0, "absEnd": 10,
  "pluginChain": [{ "name": "glow", "relStartPct": 0.2, "relEndPct": 1.0 }]
}

// v2.0 (퍼센트 문자열, baseTime 길이 기준 = 10s)
{
  "displayTime": [0, 10],
  "pluginChain": [{ "name": "glow", "timeOffset": ["20%", "100%"] }]
}
```

4) 시나리오 유효성 검사
- v2 파서로 최종 JSON 검증 및 친절한 오류 메시지 확인

```ts
import { ScenarioParserV2 } from 'motiontext-renderer';

const parser = new ScenarioParserV2();
const parsed = parser.parseScenario(migrated);
```

5) 런타임/렌더러 코드 전환
- v1.3 전용 엔트리/타입 참조 제거 → v2 API로 통일
- `RendererV2` + `parseScenario` 조합 사용. 필요 시 커스텀 컨트롤러 연동

6) 커스텀 플러그인(v3.0로 업그레이드, 있다면)
- manifest: `pluginApi: "3.0"`, `targets`, `capabilities` 최신 규약으로 갱신
- 런타임 인터페이스: DOM 분리 영역(effectsRoot) 사용, 채널 합성 사용 가능
- Define 참조는 렌더러가 해석 후 실제 값으로 전달됨(options는 해석 완료된 값)

```jsonc
// manifest.json 예시
{
  "name": "my-plugin",
  "version": "1.0.0",
  "pluginApi": "3.0",
  "minRenderer": "2.0.0",
  "targets": ["text", "group"],
  "capabilities": ["style-vars", "portal-breakout"],
  "schema": { "intensity": { "type": "number", "default": 1 } }
}
```

```ts
// v3.0 런타임(요지)
export default {
  name: 'my-plugin',
  version: '1.0.0',
  animate(el, options, ctx, duration) {
    return (p: number) => {
      ctx.channels?.set('opacity', p, 'replace');
    };
  },
};
```

## 수락 기준(검증 체크리스트)
- 타입 검사/번들: `pnpm typecheck`, `pnpm build` 무오류
- 마이그레이션 경고 검토: 중요 경고 0건 또는 사유 명확
- 시나리오 로딩/재생: v2 JSON만으로 정상 렌더링, 타임라인/시킹/리사이즈 안정
- 플러그인 동작: 채널/DOM 기반 모두 재생성, DOM 분리 규칙 준수

## 주의사항 & 팁
- 시간 배열은 항상 `start <= end` 검증. 문자열 퍼센트(`"50%"`) 사용 시 기준 구간 확인
- `timeOffset` 음수 허용: `[-0.2, 0.8]`처럼 애니메이션을 `baseTime` 시작 이전부터 준비할 수 있습니다.
- Define 추출은 과도하게 하면 가독성 저하. 기본은 conservative 권장
- v1.3 JSON을 혼용하지 말고 전량 v2.0으로 변환 후 유지
- Node ID는 편집/디버그 핵심 키. 충돌/누락 금지

## 배치 마이그레이션 스크립트 예시
```bash
# 예: 프로젝트 내 모든 *.json 변환(노드 스크립트)
node -e '
const { V13ToV20Migrator } = require("motiontext-renderer");
const fs = require("fs"), path = require("path");
const migrator = new V13ToV20Migrator({ defineStrategy: "conservative" });
function walk(dir){ for(const f of fs.readdirSync(dir)){ const p=path.join(dir,f); const s=fs.statSync(p); if(s.isDirectory()) walk(p); else if(f.endsWith(".json")){ const j=JSON.parse(fs.readFileSync(p,"utf8")); const r=migrator.migrate(j); fs.writeFileSync(p.replace(/\.json$/, '.v2.json'), JSON.stringify(r.scenario,null,2)); console.log("migrated:", p); } } }
walk(process.cwd());
'
```

## 문제 해결(요약)
- Unsupported scenario version: 버전 필드 확인. v1.3/v2.0만 지원
- 시간 배열 경고: `[start, end]` 형식, 타입/순서 점검
- Define 분리 과도: 전략을 `conservative` 또는 `none`으로 조정
- 노드 ID 누락: `generateNodeIds: true` 옵션 사용 또는 수동 생성

## 참고
- 시나리오 v2.0 스펙: 시간/노드/레이아웃/상속/Define 규약
- 플러그인 v3.0 아키텍처: DOM 분리/채널/권한/manifest 규약
- 이 저장소의 `v2-migration-guide.md`는 상세 가이드와 코드 예시를 포함합니다

---
이 프롬프트를 붙여넣어, 프로젝트 전반의 v1.3 산출물을 v2.0으로 자동 변환한 뒤 수동 검토 지점만 점검하세요. 필요한 경우, 경고 로그를 기반으로 Define/시간/노드 ID를 보수적으로 조정하세요.

## 부록 — 이 레포에서 바로 활용 가능한 코드 위치(외부 프로젝트 재사용)

- `src/parser/ScenarioParserV2.ts:1`: v2 전용 파서. `parseScenario`, `safeParseScenario`, `parseScenarioDebug` 제공. Define 해석 → Validation → 상속 순으로 안전한 v2 시나리오 객체를 반환.
- `src/parser/CompatibilityLayer.ts:1`: v1.3/v2.0 자동 감지 + 마이그레이션 오케스트레이터. `process`, `processQuick`, `processSilent`, `isV13`, `isV20` 제공.
- `src/migration/V13ToV20Migrator.ts:1`: v1.3 → v2.0 마이그레이션 엔진. Define 추출 전략, 노드 ID 생성, 통계/경고 출력 포함. `migrate`, `migrateQuick` 제공.
- `src/parser/FieldMigration.ts:1`: 필드 단위 변환 유틸. `hintTime/domLifetime`, `abs*/displayTime`, `rel*/timeOffset`, `t0/t1` 처리 + `validateTimeRange/validateNodeIds` 등 검증기 포함.
- `src/parser/DefineResolver.ts:1`: `"define.key"` 참조를 실제 값으로 해석. `resolveScenario`, 병합 해석 보조 제공.
- `src/parser/ValidationV2.ts:1`: v2 스키마 검증기. 시간 배열/ID/트랙 참조/논리 검증. 외부 파이프라인에서도 단독 사용 가능.
- `src/parser/InheritanceV2.ts:1`: v2 상속 적용기. 트랙 기본값 → 부모 → 노드 우선순위로 값 결정을 적용.
- `src/types/scenario-v2.ts:1`: v2 네이티브 타입. `TimeRange`, `Scenario`, `Node`들, `baseTime`, `timeOffset` 등 정의 포함.
- `src/types/plugin-v3.ts:1`: 플러그인 v3.0 타입. 채널/권한/capabilities/manifest 타입 명세.
- `scripts/migrate-samples.ts:1`: 샘플 폴더 일괄 마이그레이션 예제 스크립트(tsx). 외부 프로젝트에서도 경로만 조정해 재사용 가능.
- `demo/scenarioGenerator.ts:1`: 플러그인 manifest에 맞춘 시나리오 생성 유틸. `loadPluginManifest`, `generatePreviewScenario`, `generateLoopedScenario`, `validateAndNormalizeParams` 등 제공.
- `src/assets/AssetManager.ts:1`: Define 에셋(font/image/video/audio) 로딩/등록 유틸. 외부에서도 에셋 프리로드/URL 해석에 활용 가능.
- `src/runtime/PluginContextV3.ts:1`: 플러그인 런타임 컨텍스트 인터페이스와 유틸 개요. 커스텀 런타임/플러그인 테스트에 참고.

빠른 사용 예
```ts
// 1) 마이그레이션만 필요할 때
import { V13ToV20Migrator } from 'motiontext-renderer/src/migration/V13ToV20Migrator';
const migrator = new V13ToV20Migrator({ defineStrategy: 'conservative', generateNodeIds: true });
const { scenario: v2 } = migrator.migrate(v13);

// 2) 버전 자동 감지 + v2 파싱까지 한번에
import { CompatibilityLayer } from 'motiontext-renderer/src/parser/CompatibilityLayer';
import { parseScenario } from 'motiontext-renderer/src/parser/ScenarioParserV2';
const { scenario } = new CompatibilityLayer().process(maybeV13);
const parsed = parseScenario(scenario);

// 3) 플러그인 프리뷰용 시나리오 생성
import { generatePreviewScenario } from 'motiontext-renderer/demo/scenarioGenerator';
const preview = generatePreviewScenario('fadeIn', { text: 'Hello', position:{x:0.5,y:0.5}, size:{width:480,height:200}, pluginParams:{} }, 3);
```
