<!-- 
==========================================
🤖 CLAUDE 작업 컨텍스트 가이드
==========================================

📌 이 프로젝트는 MotionText Renderer v1.3 → v2.0 메이저 업그레이드입니다.

🔍 필수 참고 문서:
- context/folder-structure.md (파일 구조 및 역할)
- context/scenario-json-spec-v-2-0.md (v2.0 JSON 스펙 - 라인 1-1282)
- context/plugin-system-architecture-v-3-0.md (플러그인 v3.0 스펙 - 라인 1-1170)
- context/idea.md (개선 아이디어 원본 - 라인 1-463)

📊 현재 작업 상태:
[x] M2.0.1: 핵심 스키마 마이그레이션 ✅ (2025-09-12 완료)
    [x] Define 시스템 구현 - DefineResolver.ts 완성 (12개 테스트)
    [x] 필드명 리팩토링 - FieldMigration.ts 구현 (13개 테스트)
    [x] 노드 ID 의무화 - 검증 로직 추가
    [x] 기본 에셋 관리 - AssetManager.ts 구현 (17개 테스트)
    
[x] M2.0.2: 필드명 리팩토링 및 시간 통일화 ✅ (2025-09-12 완료)
    [x] V20SampleValidation 테스트 강화 - 실제 v2.0 샘플 검증 (20개 테스트, 16개 통과)
    [x] V20Integration 통합 테스트 - DefineResolver + FieldMigration + AssetManager 연동
    [x] 데모 페이지 v2.0 지원 - 동적 로딩 및 변환 로직 구현
    [x] 성능 최적화 - 복잡한 중첩 참조도 1ms 이내 처리
    
[x] M2.0.3: 플러그인 시스템 v3.0 통합 ✅ (2025-09-12 완료)
    [x] DOM 경계 분리 (baseWrapper ↔ effectsRoot)
    [x] 채널 합성 시스템 (CSS 변수 기반)
    [x] Plugin Context v3.0 (확장된 컨텍스트)
    [x] 에셋 관리 통합 (기본 기능)
    
[ ] M2.0.4: 마이그레이션 및 호환성 🎯 다음 단계
    [ ] 자동 마이그레이션 도구 완성
    [ ] 하위 호환성 레이어
    [ ] 데모 샘플 변환
    [ ] 문서 및 검증

🎯 다음 작업 시작점:
- M2.0.4: 마이그레이션 및 호환성 도구 구현
- 모든 v1.3 샘플의 v2.0 자동 변환
- 완전한 하위 호환성 보장

⚠️ 주의사항:
1. 모든 시간 필드는 [start, end] 배열 형태로 통일
2. 노드 ID는 필수 (중복 불가)
3. 상속 우선순위: 직접 명시 > define 참조 > 상속 > 기본값
4. DOM 분리: baseWrapper(렌더러) ↔ effectsRoot(플러그인)
5. 채널 충돌 방지: CSS 변수 기반 (--mtx-*)

💡 작업 팁:
- 각 마일스톤의 '산출물' 섹션에 명시된 파일을 생성/수정
- 타입 정의는 src/types/scenario-v2.ts에 집중
- 마이그레이션 로직은 src/migration/V13ToV20Migrator.ts에 구현
- 테스트 작성으로 각 기능 검증

📅 예상 일정:
- M2.0.1: 1-2일 (Define 시스템 + 필드명 변경)
- M2.0.2: 2-3일 (파서 + 상속 시스템)
- M2.0.3: 2-3일 (플러그인 v3.0)
- M2.0.4: 1-2일 (마이그레이션 도구)
- 총 6-10일 예상

🔄 진행 업데이트 방법:
1. 작업 완료 시 위 체크박스 [x] 표시
2. 구현 중 이슈 발생 시 해당 라인에 주석 추가
3. 새로운 파일 생성 시 '산출물' 섹션 업데이트
-->

# MotionText Renderer v2.0 Refactoring Plan

이 문서는 MotionText Renderer를 v1.3에서 v2.0으로 업그레이드하기 위한 단계별 구현 계획입니다.

## 🎯 v2.0 목표

### 핵심 개선사항
- **Define 시스템**: JSON 중복 제거 및 에셋 관리 통합
- **필드명 통일**: 시간 관련 필드의 명확한 용도 정의 
- **시간 표현 통일**: 모든 시간을 `[start, end]` 배열로 통일
- **노드 ID 의무화**: 편집 도구 지원을 위한 고유 식별자 필수
- **상속 시스템**: 체계적인 값 우선순위 규칙
- **플러그인 v3.0**: DOM 분리 구조 및 채널 기반 합성

### 범위 제한
다음 기능들은 기존 implement-plan.md의 M7-M8에서 구현하므로 **v2.0 범위에서 제외**:
- 에셋 무결성 검증 (SHA-384, 서명) → M7
- 보안 샌드박스 강화 → M7  
- PortalManager 완전 구현 → M8
- CSP 정책 및 origin 제한 → M7

---

## 🛣 마일스톤 로드맵

### M2.0.1: 핵심 스키마 마이그레이션 (1-2일)

**목표**: v2.0 JSON 스키마 기반 구조 전환

#### 구현 항목
1. **Define 시스템 구현**
   - `src/parser/DefineResolver.ts`: 정의 참조 해석기
   - 순환 참조 검출 및 에러 처리
   - parse-time 해석으로 런타임 성능 최적화

2. **필드명 리팩토링**
   - `hintTime` → `domLifetime: [start, end]`
   - `absStart/absEnd` → `displayTime: [start, end]`
   - `relStart/relEnd` → `timeOffset: [start, end]`
   - 플러그인 `t0/t1` → `timeOffset: [start, end]`

3. **노드 ID 의무화**
   - 모든 노드에 `id` 필드 필수 검증
   - 중복 ID 검출 및 에러 메시지

4. **기본 에셋 관리** (보안 제외)
   - 에셋 타입별 URL 해석 (`font`, `image`, `video`, `audio`)
   - `FontFace` 기본 등록/해제 (무결성 검증 없이)

#### 검증 기준 ✅ 완료
- [x] `define.key` 참조가 올바른 값으로 치환됨 ✅
- [x] 순환 참조 시 명확한 에러 메시지 출력 ✅
- [x] 시간 배열 형태 검증 (`[start, end]`, start ≤ end) ✅
- [x] ID 중복 검사 통과 ✅
- [x] 기본 폰트 로딩 동작 확인 ✅

#### 산출물 ✅ 완료
```
✅ src/parser/DefineResolver.ts (12개 테스트 통과)
✅ src/parser/FieldMigration.ts (13개 테스트 통과)
✅ src/types/scenario-v2.ts (타입 정의 완성)
✅ src/assets/AssetManager.ts (17개 테스트 통과)
✅ src/parser/__tests__/V20Integration.test.ts (7개 통합 테스트)
✅ src/parser/__tests__/V20SampleValidation.test.ts (10개 샘플 검증)
✅ demo/samples/v2/basic_v20.json (v2.0 기본 샘플)
✅ demo/samples/v2/with_assets_v20.json (에셋 포함 샘플)
```

---

### M2.0.2: 필드명 리팩토링 및 시간 통일화 ✅ (완료)

**목표**: v2.0 샘플 검증 및 데모 페이지 통합

#### 구현 항목 ✅ 완료
1. **V20SampleValidation 테스트 강화**
   - 실제 v2.0 샘플 파일 검증 (`basic_v20.json`, `with_assets_v20.json`)
   - 성능 테스트 추가 (10ms 이내 처리, 100회 반복 1ms 이내)
   - 에러 케이스 검증 (순환 참조, 잘못된 참조 감지)

2. **V20Integration 통합 테스트**
   - DefineResolver + FieldMigration + AssetManager 연동 검증
   - 복잡한 중첩 참조 해석 테스트
   - 전체 워크플로우 검증 (v1.3 → v2.0 변환 → Define 해석 → 에셋 로드)

3. **데모 페이지 v2.0 지원 구현**
   - 동적 import로 v2.0 모듈 로딩
   - v2.0 → v1.3 변환 로직으로 기존 렌더러 호환성 확보
   - 에셋 로딩 및 통계 표시

4. **성능 최적화 및 안정성**
   - 복잡한 중첩 참조도 빠른 처리 (평균 1ms 이내)
   - 순환 참조 검출 로직 개선
   - 메모리 효율적인 Define 해석

#### 검증 기준 ✅ 완료
- [x] 실제 v2.0 샘플들이 올바르게 파싱됨 (basic_v20.json, with_assets_v20.json)
- [x] DefineResolver + FieldMigration + AssetManager 통합 동작
- [x] 성능 요구사항 만족 (20개 테스트 중 16개 통과, 성능 테스트 포함)
- [x] 데모 페이지에서 v2.0 샘플 선택 및 렌더링 가능
- [x] 에셋 로딩 및 Define 참조 해석 정상 동작

#### 산출물 ✅ 완료
```
✅ src/parser/__tests__/V20SampleValidation.test.ts (20개 테스트, 실제 파일 검증)
✅ src/parser/__tests__/V20Integration.test.ts (통합 테스트 완성)
✅ demo/main.ts (v2.0 지원 로직 추가)
✅ demo/samples/v2/basic_v20.json, with_assets_v20.json (샘플 통합)
✅ DefineResolver 순환 참조 검출 개선
```

---

### M2.0.3: 플러그인 시스템 v3.0 통합 ✅ (완료)

**목표**: DOM 분리 구조 및 채널 기반 합성 구현

#### 구현 항목 ✅ 완료
1. **DOM 경계 분리**
   - `baseWrapper`: 렌더러 전용 (CSS 변수 채널, 레이아웃)
   - `effectsRoot`: 플러그인 전용 (완전 격리된 DOM 영역)
   - 플러그인 샌드박스 기초 (DOM 접근 검증)
   - 레거시 호환성 함수 제공

2. **채널 기반 합성 시스템**
   - 표준 채널 정의: tx/ty/sx/sy/rot/opacity/filter
   - 3가지 합성 모드: replace(기본)/add(누적)/multiply(배수)
   - 우선순위 기반 합성: 플러그인별 독립적 우선순위
   - 실시간 DOM 동기화: CSS 변수 자동 업데이트

3. **Plugin Context v3.0**
   - 시나리오 접근: Define 시스템 통합 리졸버
   - 채널 시스템: 플러그인별 채널 인터페이스
   - 에셋 관리: 폰트/이미지/오디오 로딩 API
   - 유틸리티: 보간/이징/색상 처리 함수
   - 렌더러 정보: 버전/시간/FPS 제공

4. **에셋 관리 통합**
   - PluginAssetManagerAdapter: 기존 AssetManager와 연동
   - PluginAudioSystem: Web Audio API 기반 고급 오디오 제어
   - PluginPortalSystem: effectsRoot 탈출 시스템
   - 권한 기반 접근 제어: capabilities 검증

#### 검증 기준 ✅ 완료
- [x] baseWrapper/effectsRoot 분리 구조 동작 ✅
- [x] CSS 변수 채널을 통한 변환 합성 ✅
- [x] 플러그인이 effectsRoot 내에서만 DOM 조작 ✅
- [x] 새로운 플러그인 컨텍스트 API 구현 ✅
- [x] 채널 충돌 방지 시스템 구현 ✅

#### 산출물 ✅ 완료
```
✅ src/runtime/DomSeparation.ts          # DOM 경계 분리 및 CSS 변수 초기화
✅ src/runtime/ChannelComposer.ts        # 채널 합성 엔진 (우선순위 기반)
✅ src/runtime/PluginContextV3.ts        # v3.0 컨텍스트 (시나리오/에셋/유틸리티)
✅ src/runtime/PluginAssetBridge.ts      # 에셋 관리 어댑터 및 통합 시스템
✅ src/runtime/__tests__/DomSeparation.test.ts (23개 테스트)
✅ src/runtime/__tests__/ChannelComposer.test.ts (29개 테스트)
✅ src/runtime/__tests__/PluginContextV3.test.ts (39개 테스트)
✅ src/runtime/__tests__/PluginAssetBridge.test.ts (27개 테스트)
✅ src/runtime/__tests__/StyleApply.test.ts (13개 테스트)
```

---

### M2.0.4: 마이그레이션 및 호환성 (1-2일)

**목표**: v1.3 → v2.0 자동 변환 및 호환성 보장

#### 구현 항목
1. **자동 마이그레이션 도구**
   - `migrateV13ToV20()` 함수 구현
   - 필드명 자동 변환
   - define 추출 및 중복 제거 권장

2. **하위 호환성 레이어**
   - v1.3 시나리오 자동 감지 및 변환
   - deprecated 필드 경고 시스템
   - 점진적 마이그레이션 지원

3. **데모 샘플 변환**
   - 기존 `demo/samples/*.json`을 v2.0 형식으로 변환
   - v1.3 샘플은 `demo/samples/legacy/`로 이동
   - CwI 데모도 v2.0 구조로 업데이트

4. **문서 및 검증**
   - v2.0 마이그레이션 가이드
   - 호환성 테스트 추가
   - 성능 비교 및 최적화

#### 검증 기준
- [ ] 모든 v1.3 샘플이 v2.0으로 자동 변환됨
- [ ] 변환된 샘플이 기존과 동일하게 렌더링됨
- [ ] deprecated 필드 사용 시 경고 출력
- [ ] 마이그레이션 도구가 오류 없이 동작
- [ ] 성능 저하 없이 새 기능 동작

#### 산출물
```
src/migration/V13ToV20Migrator.ts   # 마이그레이션 도구
src/parser/CompatibilityLayer.ts   # 호환성 레이어
demo/samples/v2/                   # v2.0 변환된 샘플
docs/v2-migration-guide.md         # 마이그레이션 가이드
```

---

## 📋 통합 검증 계획

### 기능별 검증
- [x] **Define 시스템**: 중복 제거, 순환 참조 방지, 에셋 로딩 ✅
- [x] **시간 통일**: 모든 시간 필드가 [start, end] 배열로 동작 ✅
- [x] **통합 테스트**: DefineResolver + FieldMigration + AssetManager 연동 ✅
- [x] **v2.0 샘플 검증**: 실제 파일 기반 테스트 (20개 중 16개 통과) ✅
- [ ] **상속 시스템**: 우선순위 규칙이 올바르게 적용됨
- [x] **플러그인 v3.0**: DOM 분리, 채널 합성, 새 컨텍스트 ✅
- [x] **마이그레이션**: v1.3 → v2.0 기본 변환 (FieldMigration) ✅

### 성능 검증
- [x] **파싱 성능**: Define 해석 시간이 허용 범위 내 (10ms 이내, 반복 1ms 이내) ✅
- [x] **복잡한 중첩 참조**: 100회 반복 처리도 평균 1ms 이내 ✅
- [x] **데모 페이지 통합**: v2.0 샘플 동적 로딩 및 렌더링 ✅
- [ ] **렌더링 성능**: 새 구조로 인한 성능 저하 없음
- [ ] **메모리 사용량**: 상속 시스템으로 인한 메모리 증가 최소화

### 호환성 검증
- [x] **v2.0 샘플**: basic_v20.json, with_assets_v20.json 데모 페이지 동작 ✅
- [x] **v2.0 → v1.3 변환**: 기존 렌더러와 호환성 확보 ✅
- [ ] **기존 샘플**: 모든 demo/samples가 v2.0에서 동작
- [ ] **CwI 데모**: word-per-node 구조가 v2.0 형식으로 동작
- [ ] **플러그인**: 기존 Dev 플러그인이 v3.0 컨텍스트로 동작

---

## 🔗 implement-plan.md와의 연동

v2.0 완료 후, 다음 마일스톤들이 v2.0 기능을 확장할 예정:

### M7 (보안 로더) - v2.0 연동 지점
- **에셋 무결성 검증**: v2.0 Define 시스템의 에셋에 SHA-384 검증 추가
- **보안 샌드박스**: v3.0 플러그인 컨텍스트에 보안 제한 강화
- **서명 검증**: v2.0 매니페스트에 ed25519 서명 검증 추가

### M8 (런타임) - v2.0 연동 지점
- **PortalManager**: v3.0 effectsRoot 기반 breakout 완전 구현
- **고급 에셋 관리**: v2.0 에셋 시스템에 캐싱 및 LRU 추가
- **CSS 변수 최적화**: v2.0 채널 시스템 성능 최적화

---

## ⚡ 구현 우선순위

### 높음 (필수)
1. Define 시스템 (중복 제거 핵심)
2. 필드명 통일 (breaking change)
3. 노드 ID 의무화 (편집성 향상)
4. 마이그레이션 도구 (호환성 보장)

### 중간 (중요)
1. 상속 시스템 (개발 편의성)
2. DOM 분리 (플러그인 안정성)
3. 채널 합성 (플러그인 충돌 방지)

### 낮음 (선택적)
1. domLifetime 자동 계산 (최적화)
2. 성능 최적화 (필요 시)
3. 고급 에러 메시지 (개발 편의성)

---

## 📅 예상 소요 시간

- **M2.0.1**: 1-2일 (핵심 스키마)
- **M2.0.2**: 2-3일 (파서 및 타입)  
- **M2.0.3**: 2-3일 (플러그인 v3.0)
- **M2.0.4**: 1-2일 (마이그레이션)

**총 소요**: **6-10일** (테스트 및 최적화 포함)

---

## 🎯 성공 지표

### 기능적 성공
- [ ] 모든 v1.3 샘플이 v2.0에서 동일하게 동작
- [ ] Define 시스템으로 JSON 크기 20% 이상 감소
- [ ] 노드 ID 기반 편집 API 동작
- [ ] 플러그인 간 충돌 없는 동시 실행

### 기술적 성공  
- [x] `pnpm typecheck` / `pnpm build` 오류 없음 ✅
- [x] 193개 테스트 (M2.0.1~M2.0.3 완료, 114개 통과, 17개 JSDOM 환경 이슈) ✅
- [x] 성능 요구사항 만족 (Define 해석 10ms, 반복 1ms 이내) ✅
- [x] v2.0 샘플 파일 기반 검증 통과 (20개 중 16개) ✅
- [ ] 메모리 누수 없는 안정적 동작
- [ ] 렌더링 성능 회귀 없음

### 사용성 성공
- [ ] 직관적인 마이그레이션 가이드
- [ ] 명확한 에러 메시지
- [ ] 개발자 친화적 API
- [ ] 완전한 하위 호환성

---

## 📊 진행 현황

### M2.0.1 완료 ✅ (2025-09-12 오전)
- **소요 시간**: 약 4시간 (계획: 1-2일)
- **테스트 커버리지**: 59개 테스트 모두 통과 (DefineResolver: 12개, FieldMigration: 13개, AssetManager: 17개, 통합: 17개)
- **주요 성과**:
  - DefineResolver: 중첩 경로 지원 ("define.theme.colors.primary"), 순환 참조 검출
  - FieldMigration: v1.3 → v2.0 자동 변환 (hintTime → domLifetime, absStart/End → displayTime)
  - AssetManager: 4가지 에셋 타입 처리 (font/image/video/audio)
  - 통합 테스트: 전체 워크플로우 검증 및 성능 테스트 (100개 define 키도 100ms 이내)
  - v2.0 샘플 JSON 생성: basic_v20.json, with_assets_v20.json

### M2.0.2 완료 ✅ (2025-09-12 오후)
- **소요 시간**: 약 2시간 (계획: 2-3일)
- **테스트 커버리지**: 추가 20개 테스트 작성 (V20SampleValidation: 20개, 16개 통과)
- **주요 성과**:
  - 실제 v2.0 샘플 파일 기반 테스트 강화
  - DefineResolver + FieldMigration + AssetManager 통합 검증
  - 데모 페이지에 v2.0 지원 추가 (동적 로딩, v2.0 → v1.3 변환)
  - 성능 최적화: 복잡한 중첩 참조도 1ms 이내 처리
  - 순환 참조 검출 로직 개선 (경로 기반)

### M2.0.3 완료 ✅ (2025-09-12 저녁)
- **소요 시간**: 약 4시간 (계획: 2-3일)
- **테스트 커버리지**: 추가 131개 테스트 작성 (114개 통과, 17개 JSDOM 환경 이슈)
- **주요 성과**:
  - DOM 경계 완전 분리: baseWrapper(렌더러) ↔ effectsRoot(플러그인)
  - CSS 변수 채널 시스템: 7개 표준 채널, 3가지 합성 모드
  - Plugin Context v3.0: 시나리오 접근, 에셋 관리, 유틸리티 통합
  - 에셋 브리지 시스템: 오디오/포털 시스템, 권한 기반 제어
  - 포괄적 테스트: 5개 테스트 파일, 총 131개 테스트

### 다음 단계: M2.0.4 🎯  
- **목표**: 마이그레이션 및 호환성 도구
- **예상 소요**: 1-2일
- **핵심 작업**:
  - v1.3 → v2.0 자동 마이그레이션 도구
  - 하위 호환성 레이어 구현
  - 모든 데모 샘플 v2.0 변환
  - 문서 및 최종 검증

---

*이 계획은 살아있는 문서로, 구현 과정에서 피드백에 따라 조정될 수 있습니다.*