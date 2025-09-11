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
   - `relStart/relEnd` → `time_offset: [start, end]`
   - 플러그인 `t0/t1` → `time_offset: [start, end]`

3. **노드 ID 의무화**
   - 모든 노드에 `id` 필드 필수 검증
   - 중복 ID 검출 및 에러 메시지

4. **기본 에셋 관리** (보안 제외)
   - 에셋 타입별 URL 해석 (`font`, `image`, `video`, `audio`)
   - `FontFace` 기본 등록/해제 (무결성 검증 없이)

#### 검증 기준
- [ ] `define.key` 참조가 올바른 값으로 치환됨
- [ ] 순환 참조 시 명확한 에러 메시지 출력
- [ ] 시간 배열 형태 검증 (`[start, end]`, start ≤ end)
- [ ] ID 중복 검사 통과
- [ ] 기본 폰트 로딩 동작 확인

#### 산출물
```
src/parser/DefineResolver.ts       # Define 참조 해석기
src/parser/FieldMigration.ts       # 필드명 변환 유틸
src/types/scenario-v2.ts           # v2.0 타입 정의
src/assets/AssetManager.ts         # 기본 에셋 관리 (보안 제외)
```

---

### M2.0.2: 파서 및 타입 시스템 업데이트 (2-3일)

**목표**: v2.0 스키마 완전 지원 및 상속 시스템 구현

#### 구현 항목
1. **ScenarioParser v2.0 업데이트**
   - 버전 감지 (`"2.0"`) 및 자동 마이그레이션
   - Define 섹션 파싱 및 검증
   - 새 필드명에 대한 스키마 검증

2. **상속 및 우선순위 시스템**
   - 값 결정 우선순위: 직접 명시 > define 참조 > 상속 > 기본값
   - 부모-자식 노드 간 속성 상속 엔진
   - 스타일/레이아웃 속성의 선택적 상속

3. **타입 시스템 확장**
   - v2.0 전용 타입 정의 (`scenario-v2.ts`)
   - Define 참조 타입 (`DefineReference<T>`)
   - 상속 가능한 속성 타입 마킹

4. **domLifetime 자동 계산**
   - 자식 노드 displayTime 기반 자동 계산
   - 플러그인 time_offset 고려한 창 확장
   - 수동 지정 시 오버라이드 지원

#### 검증 기준
- [ ] v1.3/v2.0 시나리오 모두 파싱 가능
- [ ] 상속 우선순위가 올바르게 적용됨
- [ ] domLifetime이 자동 계산됨 (수동 지정 시 우선)
- [ ] `pnpm typecheck` 타입 오류 없음
- [ ] 기존 데모 샘플이 변환되어 동작

#### 산출물
```
src/parser/ScenarioParserV2.ts     # v2.0 파서
src/parser/InheritanceEngine.ts    # 상속 시스템
src/types/scenario-v2.ts           # 확장된 타입 정의
src/utils/DomLifetimeCalculator.ts # domLifetime 계산기
```

---

### M2.0.3: 플러그인 시스템 v3.0 통합 (2-3일)

**목표**: DOM 분리 구조 및 채널 기반 합성 구현

#### 구현 항목
1. **DOM 경계 분리**
   - `baseWrapper`: 렌더러 전용 (레이아웃, 채널 합성)
   - `effectsRoot`: 플러그인 전용 (자유 DOM 조작)
   - 플러그인 샌드박스 기초 (M7에서 강화)

2. **채널 기반 합성 시스템**
   - CSS 변수 채널 (`--mtx-tx`, `--mtx-ty`, `--mtx-sx` 등)
   - 합성 모드 (`replace`, `add`, `multiply`)
   - 채널 충돌 방지 로직

3. **Plugin Context v3.0**
   - 확장된 컨텍스트 (scenario, channels, assets)
   - 기본 권한 시스템 (7가지 capabilities)
   - `time_offset` 배열 지원

4. **에셋 관리 통합** (기본 기능만)
   - `ctx.assets.getUrl()` API
   - 폰트 자동 등록/해제
   - 이미지/비디오 URL 해석

#### 검증 기준
- [ ] baseWrapper/effectsRoot 분리 구조 동작
- [ ] CSS 변수 채널을 통한 변환 합성
- [ ] 플러그인이 효과스루트 내에서만 DOM 조작
- [ ] 새로운 플러그인 컨텍스트로 기존 플러그인 동작
- [ ] 채널 충돌 없이 복수 플러그인 동작

#### 산출물
```
src/runtime/DomSeparation.ts       # DOM 경계 관리
src/composer/ChannelComposer.ts    # 채널 합성 엔진
src/runtime/PluginContextV3.ts     # v3.0 컨텍스트
src/assets/AssetResolver.ts        # 기본 에셋 해석
src/loader/dev/DevPluginV3.ts      # Dev 환경 v3.0 지원
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
- [ ] **Define 시스템**: 중복 제거, 순환 참조 방지, 에셋 로딩
- [ ] **시간 통일**: 모든 시간 필드가 [start, end] 배열로 동작
- [ ] **상속 시스템**: 우선순위 규칙이 올바르게 적용됨
- [ ] **플러그인 v3.0**: DOM 분리, 채널 합성, 새 컨텍스트
- [ ] **마이그레이션**: v1.3 → v2.0 완전 자동 변환

### 성능 검증
- [ ] **파싱 성능**: Define 해석 시간이 허용 범위 내
- [ ] **렌더링 성능**: 새 구조로 인한 성능 저하 없음
- [ ] **메모리 사용량**: 상속 시스템으로 인한 메모리 증가 최소화

### 호환성 검증
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
- [ ] `pnpm typecheck` / `pnpm build` 오류 없음
- [ ] 120개+ 테스트 모두 통과
- [ ] 메모리 누수 없는 안정적 동작
- [ ] 렌더링 성능 회귀 없음

### 사용성 성공
- [ ] 직관적인 마이그레이션 가이드
- [ ] 명확한 에러 메시지
- [ ] 개발자 친화적 API
- [ ] 완전한 하위 호환성

---

*이 계획은 살아있는 문서로, 구현 과정에서 피드백에 따라 조정될 수 있습니다.*