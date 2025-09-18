외부 프로젝트에서 렌더러가 띄우는 애니메이션을 쉽게 수정할 수 있는 에디터를 만들고자 함.
현재 영상 화면에서 DOM에 출력되고있는 애니메이션들을 추적해서 크기, 회전 등을 재조정할 수 있게 하고자 하고,
현재 떠올린 방법은 렌더러 코드를 수정해서 렌더러에 출력되는 애니메이션들에 시나리오의 node, cue 별 id를 따서 DOM에 해당 id를 기록함.
렌더러가 pause된걸 감지하면, 외부 에디터 코드는 1.현재 렌더러 위에 렌더링 된 DOM 중 visible된 cue들을 추적, 각 cue의 크기 위치, 회전 들을 뽑아와서 같은 크기 위치 회전 모양으로 react-moveable등을 이용해서 에디팅 박스를 씌움, 에디팅 박스의 크기, 위치 각도를 수정할 때마다, 시나리오 파일에 해당 cue(node)를 id로 찾아서 값을 수정 => 자막편집이 용이하도록

===== 아래는 AI 답변 ======
DOM 트래킹 기반 자막 편집기 구현 계획                                                         │
     │                                                                                               │
     │ 현재 방식의 가능성 평가 ✅                                                                     │
     │                                                                                               │
     │ 제안하신 방법은 충분히 구현 가능합니다. RendererV2의 현재 구조를 보면:                        │
     │                                                                                               │
     │ 1. 이미 DOM에 ID가 저장되고 있음:                                                             │
     │   - dataset.nodeId: 각 노드의 고유 ID                                                         │
     │   - dataset.nodeKey: cue와 node의 복합 ID (cueId:nodeId)                                      │
     │   - data-cue-id, data-node-id: 추가 메타데이터                                                │
     │ 2. DOM 구조가 체계적:                                                                         │
     │   - .mtx-base-wrapper: 레이아웃/위치 담당                                                     │
     │   - .mtx-effects-root: 애니메이션 효과 담당                                                   │
     │   - 명확한 계층 구조로 트래킹 용이                                                            │
     │ 3. 이미 구현된 관련 기능:                                                                     │
     │   - mountedElements Map으로 현재 렌더링된 요소들 추적                                         │
     │   - 각 요소의 위치, 크기, 변환 정보가 실시간 업데이트                                         │
     │                                                                                               │
     │ 개선된 구현 방안                                                                              │
     │                                                                                               │
     │ 1단계: 렌더러 확장 - 편집기 인터페이스 추가                                                   │
     │                                                                                               │
     │ // src/core/RendererV2.ts에 편집기 API 추가                                                   │
     │ class RendererV2 {                                                                            │
     │   // 현재 보이는 요소들의 정보 제공                                                           │
     │   getVisibleElements(): EditorElement[] {                                                     │
     │     const elements = [];                                                                      │
     │     for (const [nodeId, mounted] of this.mountedElements) {                                   │
     │       const rect = mounted.element.getBoundingClientRect();                                   │
     │       elements.push({                                                                         │
     │         cueId: mounted.cueId,                                                                 │
     │         nodeId: mounted.node.id,                                                              │
     │         element: mounted.element,                                                             │
     │         bounds: rect,                                                                         │
     │         transform: this.extractTransform(mounted.element),                                    │
     │         layout: mounted.node.layout,                                                          │
     │         style: mounted.node.style                                                             │
     │       });                                                                                     │
     │     }                                                                                         │
     │     return elements;                                                                          │
     │   }                                                                                           │
     │                                                                                               │
     │   // 실시간 업데이트를 위한 이벤트 에미터                                                     │
     │   onElementsChanged(callback: (elements: EditorElement[]) => void) {                          │
     │     this.editorCallbacks.push(callback);                                                      │
     │   }                                                                                           │
     │ }                                                                                             │
     │                                                                                               │
     │ 2단계: 편집기 오버레이 컴포넌트 구현                                                          │
     │                                                                                               │
     │ // src/editor/EditorOverlay.tsx                                                               │
     │ import Moveable from 'react-moveable';                                                        │
     │                                                                                               │
     │ export function EditorOverlay({ renderer }) {                                                 │
     │   const [selectedElements, setSelectedElements] = useState([]);                               │
     │                                                                                               │
     │   // 비디오 일시정지 감지                                                                     │
     │   useEffect(() => {                                                                           │
     │     const handlePause = () => {                                                               │
     │       const visibleElements = renderer.getVisibleElements();                                  │
     │       setSelectedElements(visibleElements);                                                   │
     │     };                                                                                        │
     │                                                                                               │
     │     renderer.timeline.on('pause', handlePause);                                               │
     │   }, [renderer]);                                                                             │
     │                                                                                               │
     │   // Moveable로 편집 박스 렌더링                                                              │
     │   return selectedElements.map(el => (                                                         │
     │     <Moveable                                                                                 │
     │       key={el.nodeId}                                                                         │
     │       target={el.element}                                                                     │
     │       draggable={true}                                                                        │
     │       scalable={true}                                                                         │
     │       rotatable={true}                                                                        │
     │       onDrag={({ target, transform }) => {                                                    │
     │         // DOM 직접 업데이트 (실시간 미리보기)                                                │
     │         target.style.transform = transform;                                                   │
     │       }}                                                                                      │
     │       onDragEnd={({ target }) => {                                                            │
     │         // 시나리오 업데이트                                                                  │
     │         updateScenarioNode(el.cueId, el.nodeId, {                                             │
     │           layout: extractLayoutFromDOM(target)                                                │
     │         });                                                                                   │
     │       }}                                                                                      │
     │     />                                                                                        │
     │   ));                                                                                         │
     │ }                                                                                             │
     │                                                                                               │
     │ 3단계: 시나리오 동기화 시스템                                                                 │
     │                                                                                               │
     │ // src/editor/ScenarioSync.ts                                                                 │
     │ class ScenarioSyncManager {                                                                   │
     │   private scenario: Scenario;                                                                 │
     │   private renderer: RendererV2;                                                               │
     │                                                                                               │
     │   // DOM 변경사항을 시나리오에 반영                                                           │
     │   updateFromDOM(cueId: string, nodeId: string, changes: Partial<ResolvedNodeUnion>) {         │
     │     const cue = this.scenario.cues.find(c => c.id === cueId);                                 │
     │     if (!cue) return;                                                                         │
     │                                                                                               │
     │     const node = this.findNodeById(cue.root, nodeId);                                         │
     │     if (!node) return;                                                                        │
     │                                                                                               │
     │     // 변경사항 적용                                                                          │
     │     Object.assign(node, changes);                                                             │
     │                                                                                               │
     │     // 렌더러 리로드 (또는 부분 업데이트)                                                     │
     │     this.renderer.updateNode(cueId, nodeId, node);                                            │
     │   }                                                                                           │
     │                                                                                               │
     │   // 실시간 핫 리로드                                                                         │
     │   hotReload(partialScenario: Partial<Scenario>) {                                             │
     │     // 변경된 부분만 업데이트                                                                 │
     │     this.renderer.patchScenario(partialScenario);                                             │
     │   }                                                                                           │
     │ }                                                                                             │
     │                                                                                               │
     │ 4단계: 양방향 바인딩 구현                                                                     │
     │                                                                                               │
     │ // src/editor/TwoWayBinding.ts                                                                │
     │ class TwoWayBinding {                                                                         │
     │   // DOM → 시나리오                                                                           │
     │   extractTransformFromDOM(element: HTMLElement) {                                             │
     │     const matrix = new DOMMatrix(getComputedStyle(element).transform);                        │
     │     return {                                                                                  │
     │       position: { x: matrix.m41, y: matrix.m42 },                                             │
     │       scale: { x: matrix.a, y: matrix.d },                                                    │
     │       rotation: Math.atan2(matrix.b, matrix.a) * (180/Math.PI)                                │
     │     };                                                                                        │
     │   }                                                                                           │
     │                                                                                               │
     │   // 시나리오 → DOM (즉시 반영)                                                               │
     │   applyTransformToDOM(element: HTMLElement, layout: Layout) {                                 │
     │     const { position, anchor, rotation, scale } = layout;                                     │
     │     // CSS transform 생성 및 적용                                                             │
     │     const transform = this.buildTransform(position, rotation, scale);                         │
     │     element.style.transform = transform;                                                      │
     │   }                                                                                           │
     │ }                                                                                             │
     │                                                                                               │
     │ 추가 개선 사항                                                                                │
     │                                                                                               │
     │ 1. 편집 히스토리 관리                                                                         │
     │                                                                                               │
     │ - Undo/Redo 기능을 위한 변경 이력 추적                                                        │
     │ - Command 패턴으로 모든 편집 작업 기록                                                        │
     │                                                                                               │
     │ 2. 실시간 협업 지원                                                                           │
     │                                                                                               │
     │ - WebSocket으로 다중 사용자 편집 동기화                                                       │
     │ - Operational Transform 또는 CRDT 활용                                                        │
     │                                                                                               │
     │ 3. 스냅핑 & 가이드라인                                                                        │
     │                                                                                               │
     │ - 다른 요소들과의 정렬 가이드                                                                 │
     │ - 그리드 스냅핑 옵션                                                                          │
     │                                                                                               │
     │ 4. 프리셋 & 템플릿                                                                            │
     │                                                                                               │
     │ - 자주 쓰는 레이아웃 저장/불러오기                                                            │
     │ - 애니메이션 프리셋 라이브러리                                                                │
     │                                                                                               │
     │ 5. 성능 최적화                                                                                │
     │                                                                                               │
     │ - Virtual DOM diffing으로 최소한의 업데이트만 수행                                            │
     │ - requestIdleCallback으로 무거운 계산 분산                                                    │
     │                                                                                               │
     │ 구현 우선순위                                                                                 │
     │                                                                                               │
     │ 1. Phase 1: 기본 트래킹 & 선택 (1주)                                                          │
     │ 2. Phase 2: Moveable 통합 & 실시간 편집 (1주)                                                 │
     │ 3. Phase 3: 시나리오 동기화 & 저장 (1주)                                                      │
     │ 4. Phase 4: 고급 기능 (히스토리, 스냅핑 등) (2주)                                             │
     │                                                                                               │
     │ 이 방식으로 구현하면 렌더러 코드 수정을 최소화하면서도 강력한 편집 기능을 제공할 수 있습니다. │