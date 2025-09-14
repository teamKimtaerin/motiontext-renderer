# MotionText Renderer v2.0 이중 채널 시스템 구현 계획

## 🎯 목표

RendererV2에서 채널 기반 플러그인(Channel-based)과 DOM 기반 플러그인(DOM-based)을 모두 지원하는 이중 채널 시스템 구현

### 현재 상황
- ✅ v1.3 Renderer: DOM 플러그인 완전 지원 (effectsRoot + init/animate/cleanup)
- ❌ v2.0 RendererV2: 채널 기반만 지원 (evalChannels만 찾음)
- ✅ DomSeparation.ts: baseWrapper/effectsRoot 구조 완비됨

### 원하는 동작 예시
```json
{
  "pluginChain": [
    { "name": "spin", "timeOffset": [0, 1] },        // Channel-based
    { "name": "typewriter@1.0.0", "timeOffset": [0, 1] }  // DOM-based
  ]
}
```
→ 결과: **회전하면서 타이핑되는 텍스트**

---

## 🏗 아키텍처 설계

### DOM 구조
```html
<div class="mtx-text" data-node-id="text1">           <!-- Original Element -->
  <div class="mtx-base-wrapper">                      <!-- Channel Effects -->
    <div class="mtx-effects-root">                    <!-- DOM Plugin Area -->
      <!-- typewriter 플러그인이 이 영역을 조작 -->
      <span class="typewriter-container">
        <span class="typewriter-text">Hello</span>
        <span class="typewriter-cursor">|</span>
      </span>
    </div>
  </div>
</div>
```

### 채널 적용 방식
1. **채널 기반 효과** → baseWrapper에 CSS transform/opacity 적용
2. **DOM 기반 효과** → effectsRoot 내부 DOM 조작
3. **최종 결과** → baseWrapper(회전) + effectsRoot(타이핑)

---

## 📋 마일스톤별 구현 계획

### M1: DOM 구조 개선 ✅
**목표**: createElement에서 baseWrapper/effectsRoot 구조 생성

#### 작업 내용
1. **RendererV2.createElement() 수정**
   - 기존: 단순 div 생성
   - 변경: originalElement → baseWrapper → effectsRoot 구조

2. **DomSeparation.ts 활용**
   - `applyDomSeparation()` 사용
   - CSS 변수 기반 채널 시스템 활성화

#### 구현 세부사항
```typescript
private createElement(node: ResolvedNodeUnion): HTMLElement {
  // 1. 기본 요소 생성
  let originalElement = this.createOriginalElement(node);
  
  // 2. DOM 분리 아키텍처 적용
  const { baseWrapper, effectsRoot } = applyDomSeparation(originalElement);
  
  // 3. 텍스트 내용을 effectsRoot로 이동
  if (node.eType === 'text') {
    effectsRoot.textContent = node.text || '';
    originalElement.textContent = ''; // 중복 제거
  }
  
  // 4. 메타데이터 저장
  originalElement.dataset.nodeId = node.id;
  baseWrapper.dataset.baseWrapper = 'true';
  effectsRoot.dataset.effectsRoot = 'true';
  
  return originalElement;
}
```

#### 검증 기준
- [ ] baseWrapper, effectsRoot가 정상 생성됨
- [ ] CSS 변수가 baseWrapper에 초기화됨
- [ ] 텍스트가 effectsRoot에 정상 표시됨

---

### M2: 플러그인 타입 감지 시스템 ✅
**목표**: 플러그인이 채널 기반인지 DOM 기반인지 자동 감지

#### 작업 내용
1. **플러그인 타입 감지 함수**
   ```typescript
   private detectPluginType(plugin: PluginSpec): 'channel' | 'dom' | 'builtin' | 'unknown' {
     const registeredPlugin = devRegistry.resolve(plugin.name);
     
     if (this.isBuiltinPlugin(plugin.name)) return 'builtin';
     if (!registeredPlugin) return 'unknown';
     
     // v3.0 API - evalChannels 함수
     if (typeof registeredPlugin.module?.evalChannels === 'function') {
       return 'channel';
     }
     
     // v2.1 API - animate 함수 (+ init/cleanup)
     if (typeof registeredPlugin.module?.animate === 'function') {
       return 'dom';
     }
     
     return 'unknown';
   }
   ```

2. **플러그인 평가 분기 로직**
   ```typescript
   private evaluatePlugin(plugin: PluginSpec, progress: number, element: HTMLElement): Channels {
     const type = this.detectPluginType(plugin);
     
     switch (type) {
       case 'builtin':
         return this.evaluateBuiltinPlugin(plugin, progress);
       case 'channel':
         return this.evaluateChannelPlugin(plugin, progress, element);
       case 'dom':
         return this.evaluateDomPlugin(plugin, progress, element);
       default:
         console.warn(`[RendererV2] Unknown plugin: ${plugin.name}`);
         return {};
     }
   }
   ```

#### 검증 기준
- [ ] 내장 플러그인 → builtin으로 감지
- [ ] 외부 evalChannels 플러그인 → channel로 감지  
- [ ] 외부 animate 플러그인 → dom으로 감지

---

### M3: DOM 플러그인 라이프사이클 관리 ✅
**목표**: DOM 플러그인의 init/animate/cleanup 라이프사이클 완전 구현

#### 작업 내용
1. **플러그인 상태 관리**
   ```typescript
   interface DomPluginState {
     plugin: PluginSpec;
     initialized: boolean;
     seekFunction?: (progress: number) => void;
     context?: PluginContextV3;
   }
   
   private domPluginStates = new Map<string, Map<string, DomPluginState>>();
   // 구조: nodeId → pluginName → DomPluginState
   ```

2. **DOM 플러그인 평가 로직**
   ```typescript
   private evaluateDomPlugin(plugin: PluginSpec, progress: number, element: HTMLElement): Channels {
     const nodeId = element.dataset.nodeId!;
     const effectsRoot = element.querySelector('.mtx-effects-root') as HTMLElement;
     
     let state = this.getDomPluginState(nodeId, plugin.name);
     
     if (!state.initialized) {
       // 초기화
       this.initializeDomPlugin(state, plugin, effectsRoot);
     }
     
     // 진행도 적용
     if (state.seekFunction) {
       state.seekFunction(progress);
     }
     
     return {}; // DOM 플러그인은 채널 반환 안함
   }
   ```

3. **초기화 및 정리**
   ```typescript
   private initializeDomPlugin(state: DomPluginState, plugin: PluginSpec, effectsRoot: HTMLElement): void {
     const registeredPlugin = devRegistry.resolve(plugin.name)!;
     const context = this.createPluginContext(registeredPlugin.baseUrl);
     const resolvedParams = this.resolveAllDefines(plugin.params || {});
     
     try {
       // init 호출
       if (typeof registeredPlugin.module.init === 'function') {
         registeredPlugin.module.init(effectsRoot, resolvedParams, context);
       }
       
       // animate 호출하여 seek 함수 저장
       const seekFn = registeredPlugin.module.animate(
         effectsRoot, 
         resolvedParams, 
         context, 
         1.0 // duration은 별도 계산 필요
       );
       
       state.initialized = true;
       state.seekFunction = seekFn;
       state.context = context;
       
     } catch (error) {
       console.warn(`[RendererV2] DOM plugin init failed: ${plugin.name}`, error);
     }
   }
   ```

#### 검증 기준
- [ ] 플러그인별 초기화가 한 번만 수행됨
- [ ] seek 함수가 정상 저장됨
- [ ] 요소 언마운트시 cleanup 호출됨

---

### M4: 채널 합성 및 적용 ✅
**목표**: 채널 기반 효과를 baseWrapper에, DOM 효과는 effectsRoot에 정확히 적용

#### 작업 내용
1. **processNode에서 이중 채널 처리**
   ```typescript
   private processNode(node: ResolvedNodeUnion, cue: Cue, track: any, currentTime: number): void {
     // 기존 displayTime 체크...
     
     if (active && node.pluginChain?.length) {
       const channels = this.processPluginChain(node, currentTime, mountedElement.element);
       this.applyChannelsToElement(mountedElement.element, channels);
     }
   }
   ```

2. **플러그인 체인 처리**
   ```typescript
   private processPluginChain(node: ResolvedNodeUnion, currentTime: number, element: HTMLElement): Channels {
     const pluginChain = node.pluginChain || [];
     const accumulatedChannels: Channels = {};
     
     for (const plugin of pluginChain) {
       const [start, end] = node.displayTime ?? [-Infinity, Infinity];
       const pluginWindow = computePluginWindow([start, end], plugin.timeOffset);
       
       if (isWithinTimeRange(currentTime, pluginWindow)) {
         const progress = progressInTimeRange(currentTime, pluginWindow);
         const pluginChannels = this.evaluatePlugin(plugin, progress, element);
         
         // 채널 합성 (DOM 플러그인은 빈 객체 반환)
         this.mergeChannels(accumulatedChannels, pluginChannels, plugin.compose || 'replace');
       }
     }
     
     return accumulatedChannels;
   }
   ```

3. **채널 적용**
   ```typescript
   private applyChannelsToElement(element: HTMLElement, channels: Channels): void {
     const baseWrapper = element.querySelector('.mtx-base-wrapper') as HTMLElement;
     if (!baseWrapper) return;
     
     // CSS 변수를 통한 채널 적용
     applyCSSVariableChannels(baseWrapper, channels);
   }
   ```

#### 검증 기준
- [ ] 채널 기반 플러그인 효과가 baseWrapper에 적용됨
- [ ] DOM 플러그인 효과가 effectsRoot에서 동작함
- [ ] 두 효과가 독립적으로 동시 작동함

---

### M5: 테스트 및 검증 ✅
**목표**: spin + typewriter 조합을 포함한 다양한 시나리오 테스트

#### 테스트 시나리오
1. **기본 기능 테스트**
   - 채널 플러그인만 (fadeIn)
   - DOM 플러그인만 (typewriter)
   - 혼합 사용 (spin + typewriter)

2. **플러그인 체인 테스트**
   - 여러 채널 플러그인 조합
   - 여러 DOM 플러그인 조합 (충돌 확인)
   - 복잡한 혼합 체인

3. **edge case 테스트**
   - 존재하지 않는 플러그인
   - 잘못된 플러그인 파라미터
   - 요소 마운트/언마운트 반복

#### 성능 테스트
- [ ] 60fps 유지 (많은 플러그인 사용시)
- [ ] 메모리 누수 없음 (cleanup 정상 동작)
- [ ] DOM 조작 최적화

---

## 🚨 주의사항

### 기존 코드 호환성
- v2.0 네이티브 아키텍처 유지
- parseScenario, DefineResolver 등 기존 로직 보존
- 기존 채널 기반 내장 플러그인 동작 보장

### 성능 고려사항
- DOM 플러그인은 무거우므로 불필요한 호출 최소화
- seek 함수 캐싱으로 중복 초기화 방지
- requestAnimationFrame 활용한 부드러운 애니메이션

### 디버깅 지원
- 플러그인 타입별 디버그 로그
- DOM 구조 시각적 확인
- 플러그인 상태 추적

---

## 📝 구현 순서

1. **M1 DOM 구조** → 기반 마련
2. **M2 타입 감지** → 플러그인 분류
3. **M3 라이프사이클** → DOM 플러그인 지원
4. **M4 채널 적용** → 통합 동작
5. **M5 테스트** → 품질 보장

각 마일스톤마다 개별 테스트를 수행하여 단계적으로 검증하면서 진행합니다.