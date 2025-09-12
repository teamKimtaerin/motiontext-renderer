# MotionText Renderer v2.0 네이티브 리팩토링 계획

---
## 🤖 Claude Code 작업 지침

### 📄 프로젝트 맥락
이 문서는 **MotionText Renderer**를 v1.3에서 v2.0으로 완전히 리팩토링하는 계획입니다. 현재 v2.0 인프라는 대부분 구현되어 있지만, **핵심 렌더러 코어가 여전히 v1.3 기반**으로 동작하고 있는 상태입니다.

### 🎯 핵심 목표
- **v1.3 완전 제거**: 모든 v1.3 타입과 코드를 제거하여 깔끔한 v2.0 전용 코드베이스 구축
- **네이티브 v2.0**: `v2.0 JSON → v2.0 파서 → v2.0 렌더러` 직접 처리 (변환 레이어 제거)
- **일관성 확보**: displayTime, domLifetime, time_offset 등 v2.0 필드명 완전 적용

### 📚 필수 참조 문서
작업 전에 다음 문서들을 반드시 확인하세요:

1. **[context/folder-structure.md](context/folder-structure.md)** - 프로젝트 구조와 각 모듈의 책임
2. **[context/scenario-json-spec-v-2-0.md](context/scenario-json-spec-v-2-0.md)** - v2.0 JSON 시나리오 스펙
3. **[context/plugin-system-architecture-v-3-0.md](context/plugin-system-architecture-v-3-0.md)** - Plugin API v3.0 스펙

### 🛠 작업 원칙
1. **타입 안전성**: 모든 코드는 TypeScript strict mode 통과
2. **Breaking Changes**: v1.3 호환성 완전 포기 (명확한 API 경계)
3. **변수명 일관성**: 
   - `absStart/absEnd` → `displayTime: [number, number]`
   - `relStart/relEnd` → `time_offset: [number, number]`
   - `hintTime` → `domLifetime: [number, number]`
4. **책임 분리**: 렌더러(레이아웃/타임라인) vs 플러그인(효과/애니메이션) 명확화

### ✅ 현재 상태 체크리스트
**완료된 v2.0 인프라:**
- [x] DefineResolver.ts - Define 시스템
- [x] FieldMigration.ts - v1.3→v2.0 변환 도구
- [x] scenario-v2.ts - v2.0 타입 정의
- [x] AssetManager.ts - 에셋 관리
- [x] PluginContextV3.ts - 플러그인 v3.0 컨텍스트
- [x] ChannelComposer.ts - CSS 변수 채널 시스템

**🔴 작업 현황:**
- [x] **M1**: 타입 시스템 v2.0 전환 ✅ (scenario-v2-native.ts, plugin-v3.ts 생성 완료)
- [ ] **M2**: ScenarioParser v2.0 네이티브 재구현
- [x] **M3**: 시간 유틸리티 v2.0 (배열 기반) ✅ (time-v2.ts + 36개 테스트 완료)
- [ ] **M4**: Renderer.ts 코어 v2.0 네이티브
- [ ] **M5**: PluginChainComposer v2.0 time_offset 기반
- [ ] **M6**: 데모 통합 및 샘플 v2.0 변환
- [ ] **M7**: 테스트 마이그레이션 및 최적화

**🚧 진행 중:**
- M1 일부: import 경로 업데이트 (대규모 파일 수정 필요)
- M2 준비: ScenarioParserV2, ValidationV2, InheritanceV2 파일 생성 예정

### 🚨 주의사항
- 기존 v1.3 코드를 **완전히 제거**하세요 (deprecated 유지 X)
- 모든 시간 필드는 `[start, end]` 배열 형태로 통일
- DOM 구조: baseWrapper(렌더러) + effectsRoot(플러그인) 분리 원칙
- 플러그인은 상대 진행도(0~1)만 받고 절대 시간 계산 금지

### 💡 작업 흐름
1. **M1 타입 시스템부터 시작** - 이후 모든 모듈이 이 타입에 의존
2. **순차적 진행** - 하위 의존성부터 상위로 단계적 업데이트
3. **철저한 테스트** - 각 단계마다 기능 동작 검증
4. **문서 동기화** - 코드 변경 시 관련 문서도 함께 업데이트

---

## 🎯 목표

MotionText Renderer를 v2.0 시나리오를 네이티브로 지원하는 렌더러로 전면 재구현합니다.
- **v1.3 하위 호환성 완전 제거** (깔끔한 코드베이스)
- **v2.0 필드명 일관성** (displayTime, domLifetime, time_offset)
- **렌더러와 플러그인 간 책임 경계 명확화**

## 📊 현재 상황 (v2plan.md 기준)

### ✅ 이미 완료된 작업들

#### v2.0 인프라 (M2.0.1~M2.0.3 완료)
- **DefineResolver.ts** - Define 시스템 구현 완료
- **FieldMigration.ts** - v1.3→v2.0 필드 변환 완료
- **scenario-v2.ts** - v2.0 타입 정의 완료
- **AssetManager.ts** - 에셋 관리 시스템 완료
- **PluginContextV3.ts** - 플러그인 v3.0 컨텍스트 완료
- **ChannelComposer.ts** - CSS 변수 채널 시스템 완료
- **V13ToV20Migrator.ts** - 마이그레이션 도구 완료
- **CompatibilityLayer.ts** - 호환성 레이어 완료

### ❌ 핵심 문제: 렌더러 코어가 여전히 v1.3

```typescript
// 현재 Renderer.ts (문제)
const t0 = node.absStart ?? -Infinity;  // v1.3 필드
const t1 = node.absEnd ?? Infinity;     // v1.3 필드

// 현재 time.ts (문제)
function computeRelativeWindow(absStart: number, absEnd: number, ...)

// 현재 PluginChainComposer.ts (문제)
spec.relStart, spec.relEnd  // v1.3 필드
```

## 🛣️ 리팩토링 마일스톤

### M1: 타입 시스템 v2.0 전환 (1일)

#### 목표
v2.0 전용 타입 시스템으로 완전 전환, v1.3 타입 제거

#### 작업 내용
1. **타입 정의 교체**
   ```typescript
   // src/types/index.ts
   export * from './scenario-v2';  // v2.0 타입만 export
   // ScenarioFileV1_3 제거
   ```

2. **인터페이스 통일**
   ```typescript
   // 기존 (v1.3)
   interface TextNode {
     absStart?: number;
     absEnd?: number;
   }
   
   // 변경 (v2.0)
   interface TextNodeV2 {
     displayTime: [number, number];
     id: string;  // 필수
   }
   ```

3. **플러그인 타입 v3.0**
   ```typescript
   interface PluginSpecV3 {
     name: string;
     time_offset?: [number, number];  // relStart/relEnd 제거
     params?: Record<string, any>;
     compose?: 'replace' | 'add' | 'multiply';
   }
   ```

#### 산출물
- `src/types/scenario-v2-native.ts` - v2.0 전용 타입
- `src/types/plugin-v3.ts` - 플러그인 v3.0 타입
- 모든 import 경로 업데이트

---

### M2: 파서 v2.0 네이티브 (1일)

#### 목표
ScenarioParser를 v2.0 전용으로 재구현

#### 작업 내용
1. **parseScenario v2.0 전용**
   ```typescript
   export function parseScenario(input: any): ScenarioV2 {
     // v2.0만 지원
     if (input.version !== '2.0') {
       throw new Error('Only v2.0 scenarios are supported. Use migration tools for v1.3.');
     }
     
     // DefineResolver 통합
     const resolver = new DefineResolver();
     const resolved = resolver.resolveScenario(input);
     
     // 시간 배열 검증
     validateTimeArrays(resolved);
     
     // 노드 ID 검증
     validateNodeIds(resolved);
     
     return resolved;
   }
   ```

2. **시간 배열 검증**
   ```typescript
   function validateTimeArrays(scenario: ScenarioV2) {
     // displayTime, domLifetime, time_offset 검증
     // [start, end] 형식, start <= end
   }
   ```

3. **상속 시스템 구현**
   ```typescript
   // 우선순위: 직접 명시 > define 참조 > 부모 상속 > 트랙 기본값
   function applyInheritance(node: NodeV2, parent?: NodeV2, track?: TrackV2) {
     // displayTime 상속
     if (!node.displayTime && parent?.displayTime) {
       node.displayTime = parent.displayTime;
     }
     // style 상속
     node.style = mergeStyles(track?.defaultStyle, parent?.style, node.style);
   }
   ```

#### 산출물
- `src/parser/ScenarioParserV2.ts` - v2.0 전용 파서
- `src/parser/ValidationV2.ts` - v2.0 검증 로직
- `src/parser/InheritanceV2.ts` - 상속 시스템

---

### M3: 시간 유틸리티 v2.0 (0.5일)

#### 목표
시간 관련 함수들을 v2.0 시간 배열 기반으로 재구현

#### 작업 내용
1. **computeRelativeWindow v2.0**
   ```typescript
   // 기존 (v1.3)
   computeRelativeWindow(absStart: number, absEnd: number, spec)
   
   // 변경 (v2.0)
   computeRelativeWindow(
     displayTime: [number, number],
     timeOffset?: [number, number],
     options?: TimeOptions
   )
   ```

2. **isWithin v2.0**
   ```typescript
   // 기존
   isWithin(t: number, t0: number, t1: number)
   
   // 변경
   isWithinTimeRange(t: number, timeRange: [number, number])
   ```

3. **progress 함수 개선**
   ```typescript
   // 변수명 명확화
   progressInTimeRange(
     currentTime: number,
     timeRange: [number, number]
   ): number  // 0~1
   ```

#### 산출물
- `src/utils/time-v2.ts` - v2.0 시간 유틸리티
- 기존 time.ts는 deprecated 처리

---

### M4: 렌더러 코어 v2.0 네이티브 (2일)

#### 목표
Renderer.ts를 v2.0 필드 직접 처리하도록 재구현

#### 작업 내용
1. **Renderer.ts v2.0 변환**
   ```typescript
   // src/core/Renderer.ts
   class Renderer {
     private scenario: ScenarioV2;  // v2.0 타입
     
     update(currentTime: number) {
       for (const { node, el } of this.mountedTextEls) {
         // v2.0 필드 직접 사용
         const [displayStart, displayEnd] = node.displayTime ?? [-Infinity, Infinity];
         const active = isWithinTimeRange(currentTime, [displayStart, displayEnd]);
         
         if (active) {
           // 플러그인 처리
           const channels = this.processPlugins(node, currentTime);
           applyChannels(el, channels);
         }
       }
     }
     
     private processPlugins(node: NodeV2, currentTime: number): Channels {
       const plugins = node.pluginChain || [];
       return composeActiveV2(
         plugins,
         currentTime,
         node.displayTime,
         this.evalPlugin.bind(this)
       );
     }
   }
   ```

2. **변수명 리팩토링**
   ```typescript
   // 명확한 변수명 사용
   - t0, t1 → displayStart, displayEnd
   - absStart, absEnd → 완전 제거
   - relStart, relEnd → 완전 제거
   - hintTime → 완전 제거
   ```

3. **DOM 생명주기 v2.0**
   ```typescript
   // Cue의 domLifetime 처리
   manageCueLifecycle(cue: CueV2, currentTime: number) {
     const [domStart, domEnd] = cue.domLifetime ?? [0, Infinity];
     
     if (currentTime >= domStart && !this.isMounted(cue)) {
       this.mountCue(cue);
     }
     
     if (currentTime > domEnd && this.isMounted(cue)) {
       this.unmountCue(cue);
     }
   }
   ```

#### 산출물
- `src/core/RendererV2.ts` - v2.0 네이티브 렌더러
- `src/core/TimelineControllerV2.ts` - v2.0 타임라인
- `src/core/CueManagerV2.ts` - domLifetime 관리

---

### M5: 플러그인 시스템 v2.0 통합 (1일)

#### 목표
플러그인 체인 컴포저를 v2.0 time_offset 기반으로 재구현

#### 작업 내용
1. **PluginChainComposer v2.0**
   ```typescript
   export function composeActiveV2(
     chain: PluginSpecV3[],
     currentTime: number,
     displayTime: [number, number],
     evalFn: PluginEvalFn,
     options?: ComposerOptions
   ): Channels {
     const channels: Channels = {};
     
     for (const plugin of chain) {
       const [offsetStart, offsetEnd] = plugin.time_offset ?? [0, 1];
       const pluginWindow = computePluginWindow(displayTime, [offsetStart, offsetEnd]);
       
       if (isWithinTimeRange(currentTime, pluginWindow)) {
         const progress = progressInTimeRange(currentTime, pluginWindow);
         const pluginChannels = evalFn(plugin, progress);
         
         // 합성 모드에 따른 채널 병합
         mergeChannels(channels, pluginChannels, plugin.compose || 'replace');
       }
     }
     
     return channels;
   }
   ```

2. **내장 플러그인 v2.0 업데이트**
   ```typescript
   // src/runtime/plugins/BuiltinV2.ts
   export function evalBuiltinV2(spec: PluginSpecV3, progress: number): Channels {
     switch (spec.name) {
       case 'fadeIn':
         return { opacity: progress };
       case 'fadeOut':
         return { opacity: 1 - progress };
       // ...
     }
   }
   ```

3. **DOM 분리 원칙 적용**
   ```typescript
   // 렌더러: baseWrapper 제어 (레이아웃, 위치)
   // 플러그인: effectsRoot 제어 (효과, 애니메이션)
   ```

#### 산출물
- `src/composer/PluginChainComposerV2.ts`
- `src/runtime/plugins/BuiltinV2.ts`
- 기존 플러그인 v3.0 마이그레이션

---

### M6: 데모 및 통합 (1일)

#### 목표
데모 페이지가 v2.0을 직접 처리하도록 업데이트

#### 작업 내용
1. **demo/main.ts v2.0 네이티브**
   ```typescript
   async function loadConfiguration(config: RendererConfig) {
     // v2.0 직접 처리 (변환 없음)
     if (config.version === '2.0') {
       renderer = new MotionTextRendererV2(captionContainer);
       await renderer.loadConfig(config);
       renderer.attachMedia(video);
     } else {
       throw new Error('Only v2.0 scenarios are supported');
     }
   }
   ```

2. **모든 샘플 v2.0 변환**
   - `demo/samples/*.json` → v2.0 형식으로 변환
   - legacy 폴더 제거 또는 별도 보관

3. **index.ts export 정리**
   ```typescript
   // src/index.ts
   export { MotionTextRendererV2 as MotionTextRenderer } from './core/RendererV2';
   export { ScenarioV2 } from './types/scenario-v2-native';
   // v1.3 관련 export 모두 제거
   ```

#### 산출물
- 모든 샘플 파일 v2.0 변환 완료
- 데모 페이지 v2.0 네이티브 지원
- API 문서 업데이트

---

### M7: 테스트 및 최적화 (1일)

#### 목표
모든 테스트를 v2.0 기준으로 재작성 및 성능 최적화

#### 작업 내용
1. **테스트 마이그레이션**
   - 모든 테스트를 v2.0 시나리오 기준으로 재작성
   - v1.3 관련 테스트 제거

2. **성능 최적화**
   - 시간 배열 캐싱
   - Define 참조 사전 해석
   - DOM 업데이트 최소화

3. **문서화**
   - v2.0 API 레퍼런스
   - 마이그레이션 가이드 최종본
   - 플러그인 개발 가이드 v3.0

#### 산출물
- 모든 테스트 v2.0 통과
- 성능 벤치마크 결과
- 완전한 문서화

---

## 📋 검증 기준

### 기능 검증
- [ ] v2.0 시나리오 네이티브 렌더링
- [ ] displayTime, domLifetime, time_offset 정상 동작
- [ ] Define 시스템 완전 통합
- [ ] 상속 시스템 정상 동작
- [ ] 플러그인 v3.0 호환성

### 성능 검증
- [ ] v1.3 대비 성능 저하 없음
- [ ] 메모리 사용량 안정적
- [ ] 60fps 유지

### 코드 품질
- [ ] TypeScript 엄격 모드 통과
- [ ] 일관된 v2.0 변수명
- [ ] 명확한 렌더러/플러그인 책임 분리
- [ ] v1.3 코드 완전 제거

---

## ⚡ 구현 우선순위

### Phase 1: 기반 구축 (M1-M3)
- 타입 시스템 v2.0 전환
- 파서 v2.0 네이티브
- 시간 유틸리티 v2.0

### Phase 2: 코어 구현 (M4-M5)
- 렌더러 코어 v2.0
- 플러그인 시스템 v2.0

### Phase 3: 통합 및 마무리 (M6-M7)
- 데모 통합
- 테스트 및 최적화
- 문서화

---

## 📅 예상 일정

- **M1**: 1일 (타입 시스템)
- **M2**: 1일 (파서)
- **M3**: 0.5일 (시간 유틸리티)
- **M4**: 2일 (렌더러 코어)
- **M5**: 1일 (플러그인)
- **M6**: 1일 (데모 통합)
- **M7**: 1일 (테스트/최적화)

**총 예상**: 7.5일

---

## 🎯 최종 목표

### Before (현재)
```
v2.0 JSON → CompatibilityLayer → v1.3 변환 → v1.3 렌더러
```

### After (목표)
```
v2.0 JSON → v2.0 파서 → v2.0 렌더러 (네이티브)
```

### 핵심 원칙
1. **No v1.3**: v1.3 코드 완전 제거
2. **Native v2.0**: 변환 없이 직접 처리
3. **Clear Separation**: 렌더러/플러그인 책임 명확화
4. **Consistent Naming**: v2.0 필드명 일관성

---

## 🚀 시작 지점

1. **먼저 타입 시스템 교체** (M1)
2. **그 다음 파서 재구현** (M2)
3. **순차적으로 하위 모듈 업데이트**
4. **마지막에 통합 및 테스트**

이 계획을 통해 MotionText Renderer는 진정한 v2.0 네이티브 렌더러로 거듭나게 됩니다.