# MotionText Renderer v2.0 마이그레이션 가이드

이 가이드는 MotionText Renderer v1.3에서 v2.0으로 마이그레이션하는 방법을 설명합니다. 마이그레이션 과정은 자동화되어 있으며 기존 시나리오를 보존하면서 구조를 현대화합니다.

## 개요

v2.0에서 도입된 주요 개선사항:
- **Define 섹션**: 더 나은 유지보수성을 위한 중앙집중식 상수 정의
- **시간 배열**: 모든 시간 필드에 대한 일관된 `[start, end]` 형식
- **노드 ID**: 모든 노드에 대한 필수 고유 식별자
- **향상된 타입 안전성**: 더 나은 유효성 검사 및 오류 처리

## 자동 마이그레이션

마이그레이션은 v1.3 시나리오를 감지하고 v2.0 형식으로 변환하는 `CompatibilityLayer`에 의해 자동으로 처리됩니다.

### 빠른 시작

```typescript
import { CompatibilityLayer } from 'motiontext-renderer';

// 자동 감지 및 마이그레이션
const layer = new CompatibilityLayer();
const result = layer.process(v13Scenario);

console.log('원본 버전:', result.originalVersion); // "1.3"
console.log('마이그레이션 여부:', result.wasMigrated);     // true
console.log('최종 시나리오:', result.scenario);         // v2.0 형식
```

### 마이그레이션 옵션

다양한 옵션으로 마이그레이션 동작을 제어할 수 있습니다:

```typescript
const layer = new CompatibilityLayer({
  autoMigrate: true,        // 자동 마이그레이션 활성화/비활성화
  showWarnings: true,       // 유효성 검사 경고 표시
  allowDeprecated: false,   // 엄격 모드에서 deprecated 필드 허용
  migrationOptions: {
    defineStrategy: 'conservative',  // 'aggressive' | 'conservative' | 'none'
    minDuplicateCount: 5,           // Define 추출을 위한 최소 발생 횟수
    generateNodeIds: true,          // 누락된 노드 ID 자동 생성
    showWarnings: true              // 마이그레이션별 경고
  }
});
```

## 필드 변경사항

### 시간 필드

**v1.3 형식:**
```json
{
  "absStart": 2.0,
  "absEnd": 6.0,
  "relStart": 0.1,
  "relEnd": 0.8,
  "hintTime": 5.0
}
```

**v2.0 형식:**
```json
{
  "displayTime": [2.0, 6.0],
  "time_offset": [0.1, 0.8],
  "domLifetime": [5.0, 10.0]
}
```

### 노드 구조

**v1.3 형식:**
```json
{
  "root": {
    "type": "text",
    "content": "Hello World"
  }
}
```

**v2.0 형식:**
```json
{
  "root": {
    "id": "generated-node-id",
    "type": "text", 
    "content": "Hello World"
  }
}
```

### Define 섹션

마이그레이션은 중복 값을 중앙집중식 `define` 섹션으로 자동 추출합니다:

**이전 (v1.3):**
```json
{
  "tracks": [
    { "defaultStyle": { "color": "#ffffff" } },
    { "defaultStyle": { "color": "#ffffff" } },
    { "defaultStyle": { "color": "#ffffff" } }
  ]
}
```

**이후 (v2.0):**
```json
{
  "define": {
    "color_1": "#ffffff"
  },
  "tracks": [
    { "defaultStyle": { "color": "define.color_1" } },
    { "defaultStyle": { "color": "define.color_1" } },  
    { "defaultStyle": { "color": "define.color_1" } }
  ]
}
```

## Define 추출 전략

### Conservative (기본값)

보수적 전략은 의미 있는 중복만 추출하면서 시맨틱한 의미를 보존합니다:

- ✅ **추출**: 색상 코드, 긴 텍스트 (20자 초과), 복잡한 객체
- ❌ **보존**: 시맨틱 타입 (`text`, `group`), 앵커 (`cc`, `tl`), 짧은 문자열

```typescript
const migrator = new V13ToV20Migrator({
  defineStrategy: 'conservative'  // 기본값
});
```

**예시**: `type: "text"`가 10번 나타남 → **추출되지 않음** (시맨틱 값)
**예시**: `color: "#ff0000"`이 5번 나타남 → **추출됨** (중복 값)

### Aggressive

여러 번 나타나는 모든 값을 추출합니다:

```typescript  
const migrator = new V13ToV20Migrator({
  defineStrategy: 'aggressive',
  minDuplicateCount: 2  // 2회 이상 나타나는 값 추출
});
```

### None

Define 추출을 완전히 비활성화합니다:

```typescript
const migrator = new V13ToV20Migrator({
  defineStrategy: 'none'
});
```

## 버전 감지

`CompatibilityLayer`는 여러 휴리스틱을 사용하여 시나리오 버전을 자동 감지합니다:

### 명시적 버전
```json
{ "version": "1.3" }  // v1.3으로 감지
{ "version": "2.0" }  // v2.0으로 감지
```

### v2.0 기능
- `define` 섹션 존재
- `displayTime: [1, 5]`와 같은 시간 배열
- 일관된 노드 ID

### v1.3 기능
- 폐기된 필드들: `hintTime`, `absStart`, `absEnd`, `relStart`, `relEnd`
- 누락된 노드 ID
- 레거시 시간 형식

### 폴백
명확한 지표가 없는 시나리오는 호환성을 위해 기본적으로 v1.3으로 간주됩니다.

## 마이그레이션 스크립트

기존 파일들의 일괄 마이그레이션:

```bash
# 모든 샘플 파일 마이그레이션
npx tsx scripts/migrate-samples.ts

# 수동 마이그레이션
npx tsx -e "
import { V13ToV20Migrator } from './src/migration/V13ToV20Migrator.js';
import fs from 'fs';

const scenario = JSON.parse(fs.readFileSync('my-scenario.json', 'utf8'));
const migrator = new V13ToV20Migrator({ defineStrategy: 'conservative' });
const result = migrator.migrate(scenario);

fs.writeFileSync('my-scenario-v2.json', JSON.stringify(result.scenario, null, 2));
console.log('마이그레이션 완료!');
"
```

## 정적 헬퍼 메서드

### 빠른 처리
```typescript
// 기본 옵션으로 기본 마이그레이션
const v2Scenario = CompatibilityLayer.processQuick(v13Scenario);

// 조용한 처리 (경고 없음)
const v2Scenario = CompatibilityLayer.processSilent(v13Scenario);
```

### 버전 감지
```typescript
if (CompatibilityLayer.isV13(scenario)) {
  console.log('v1.3 시나리오입니다');
}

if (CompatibilityLayer.isV20(scenario)) {
  console.log('v2.0 시나리오입니다'); 
}
```

### 직접 마이그레이션
```typescript
// 커스텀 옵션으로 빠른 마이그레이션
const result = V13ToV20Migrator.migrateQuick(v13Scenario, {
  defineStrategy: 'aggressive',
  minDuplicateCount: 3
});
```

## 마이그레이션 통계

마이그레이션 프로세스는 상세한 통계를 제공합니다:

```typescript
const result = migrator.migrate(v13Scenario);

console.log('추출된 define 수:', result.extractedDefines);
console.log('생성된 노드 ID 수:', result.generatedIds);  
console.log('경고:', result.warnings);
console.log('변환된 폐기 필드:', result.deprecatedFields);
```

## 유효성 검사 및 경고

v2.0은 일반적인 문제를 포착하는 향상된 유효성 검사를 포함합니다:

### 시간 배열 유효성 검사
```javascript
// 잘못됨: 배열 길이 오류
"displayTime": [1]           // 경고: expected [start, end]

// 잘못됨: start > end  
"displayTime": [5, 1]        // 경고: start (5) > end (1)

// 잘못됨: 숫자가 아닌 값
"displayTime": ["1", "5"]    // 경고: values must be numbers
```

### 누락된 필드
```javascript
// 경고: define 섹션 누락 (v2.0에 권장)
{ "version": "2.0", "cues": [] }  // define 섹션 없음

// 경고: 노드 ID 누락
{ "type": "text", "content": "..." }  // "id" 필드 없음
```

## 하위 호환성

`CompatibilityLayer`는 원활한 호환성을 보장합니다:

- v2.0 시나리오는 (유효성 검사와 함께) 변경 없이 통과
- v1.3 시나리오는 자동으로 마이그레이션
- 동일한 애플리케이션 내에서 혼합 사용 지원
- 원본 파일 보존 (백업 권장)

## 모범 사례

### 1. 원본 파일 백업
```bash
# 마이그레이션 전 백업 생성
mkdir legacy/
cp *.json legacy/
```

### 2. 보수적 전략 사용
```typescript
// 프로덕션에 권장
const migrator = new V13ToV20Migrator({
  defineStrategy: 'conservative'  // 가독성 보존
});
```

### 3. 마이그레이션 결과 검토
```typescript
const result = layer.process(scenario);

// 경고 확인
if (result.warnings.length > 0) {
  console.log('마이그레이션 경고:', result.warnings);
}

// 중요 필드 확인
console.log('Define 키:', Object.keys(result.scenario.define));
```

### 4. 마이그레이션 후 검증
```typescript
import { ScenarioParser } from 'motiontext-renderer';

const parser = new ScenarioParser();
try {
  const validated = parser.parseScenario(migratedJson);
  console.log('마이그레이션 성공!');
} catch (error) {
  console.error('마이그레이션 검증 실패:', error.message);
}
```

## 문제 해결

### 일반적인 문제

**문제**: `Unsupported scenario version: 3.0`
**해결책**: v1.3과 v2.0만 지원됩니다. 버전 필드를 확인하세요.

**문제**: Define 추출이 너무 공격적
**해결책**: `defineStrategy: 'conservative'` 또는 `'none'` 사용

**문제**: 마이그레이션 후 노드 ID 누락
**해결책**: 마이그레이션 옵션에서 `generateNodeIds: true` 활성화

**문제**: 시간 유효성 검사 경고
**해결책**: 시간 배열 형식 검토: `start <= end`인 `[start, end]`

### 디버그 모드

마이그레이션 문제를 해결하기 위한 상세 로깅 활성화:

```typescript
const migrator = new V13ToV20Migrator({
  showWarnings: true,           // 모든 경고 표시
  debugMode: true               // 상세 로깅 (사용 가능한 경우)
});
```

## API 참조

### CompatibilityLayer

```typescript
class CompatibilityLayer {
  constructor(options?: CompatibilityOptions)
  process(scenario: CompatibleScenario | string): CompatibilityResult
  
  static isV13(scenario: any): boolean
  static isV20(scenario: any): boolean
  static processQuick(scenario: CompatibleScenario): ScenarioV2
  static processSilent(scenario: CompatibleScenario): ScenarioV2
}
```

### V13ToV20Migrator  

```typescript
class V13ToV20Migrator {
  constructor(options?: MigrationOptions)
  migrate(scenario: ScenarioFileV1_3): MigrationResult
  
  static migrateQuick(scenario: ScenarioFileV1_3, options?: MigrationOptions): ScenarioV2
}
```

## 지원

마이그레이션 문제나 질문:

1. 사용 예제는 [테스트 파일들](src/migration/__tests__/)을 확인하세요
2. 참조용 [샘플 마이그레이션](demo/samples/)을 검토하세요  
3. 특정 시나리오 구조에 대한 이슈를 개설하세요

---

**마이그레이션이 성공적으로 완료되었습니다!** 🎉

v1.3 시나리오가 이제 완전한 하위 호환성을 유지하면서 향상된 v2.0 기능 세트를 위해 준비되었습니다.