# MotionText Renderer - 프로젝트 컨텍스트 및 설정 계획

## 🎯 프로젝트 개요
- **프로젝트명**: motiontext-renderer
- **목적**: 웹 기반 애니메이션 자막/캡션 렌더러 라이브러리
- **배포 방식**: NPM 패키지로 공개 배포
- **Repository**: https://github.com/teamKimtaerin/motiontext-renderer

## 📋 현재 상태
- 빈 리포지토리로 시작
- CLAUDE.md 파일 이전 완료 (렌더러 스펙 포함)

## 🏗️ 프로젝트 구조 계획

### 1. Git-flow 브랜치 전략
```
main (production) - 안정된 배포 버전
├── develop - 개발 통합 브랜치  
│   ├── feature/* - 기능 개발 브랜치
│   ├── release/* - 릴리즈 준비 브랜치
│   └── hotfix/* - 긴급 수정 브랜치
```

### 2. 디렉토리 구조
```
motiontext-renderer/
├── src/                    # 소스 코드
│   ├── core/              # 코어 렌더링 엔진
│   │   ├── renderer.ts    # 메인 렌더러
│   │   ├── timeline.ts    # 타임라인 관리
│   │   └── sync.ts        # 미디어 싱크
│   ├── plugins/           # 플러그인 시스템
│   │   ├── loader.ts      # 동적 로더
│   │   ├── sandbox.ts     # 샌드박스 환경
│   │   └── manifest.ts    # 매니페스트 검증
│   ├── components/        # UI 컴포넌트
│   │   ├── Stage.ts       # 스테이지 컨테이너
│   │   ├── Track.ts       # 트랙 레이어
│   │   └── Cue.ts         # 큐 요소
│   ├── types/             # TypeScript 타입 정의
│   └── utils/             # 유틸리티 함수
├── dist/                   # 빌드 출력
├── examples/               # 사용 예제
├── docs/                   # 문서
├── tests/                  # 테스트
│   ├── unit/              
│   ├── integration/       
│   └── e2e/               
└── .github/               # GitHub Actions CI/CD
    └── workflows/
```

### 3. 기술 스택
- **Language**: TypeScript
- **Build Tool**: Vite/Rollup
- **Test**: Vitest + Playwright (E2E)
- **Linting**: ESLint + Prettier
- **Package Manager**: pnpm (빠른 설치, 효율적인 디스크 사용)
- **Animation**: GSAP (플러그인에서 사용)
- **Documentation**: TypeDoc

### 4. CI/CD 파이프라인

#### GitHub Actions Workflows

**a) PR 검증 (`.github/workflows/pr-check.yml`)**
- 트리거: PR to develop/main
- 단계:
  1. 코드 체크아웃
  2. 의존성 설치
  3. 린트 실행
  4. 타입 체크
  5. 단위/통합 테스트
  6. 빌드 검증
  7. 번들 크기 체크

**b) 개발 배포 (`.github/workflows/dev-deploy.yml`)**
- 트리거: push to develop
- 단계:
  1. 전체 테스트 스위트 실행
  2. 빌드
  3. NPM 베타 버전 배포 (태그: beta)
  4. 문서 사이트 업데이트

**c) 프로덕션 릴리즈 (`.github/workflows/release.yml`)**
- 트리거: push to main 또는 태그 생성
- 단계:
  1. 전체 테스트 + E2E
  2. 프로덕션 빌드
  3. NPM 정식 버전 배포
  4. GitHub Release 생성
  5. Changelog 업데이트

**d) 보안 스캔 (`.github/workflows/security.yml`)**
- 트리거: 일일 스케줄 + PR
- 단계:
  1. 의존성 취약점 스캔
  2. 코드 보안 분석
  3. 라이선스 검증

### 5. 설정 파일 목록

**필수 설정 파일들:**
- `package.json` - 프로젝트 메타데이터 및 스크립트
- `tsconfig.json` - TypeScript 설정
- `vite.config.ts` - 빌드 설정
- `.eslintrc.json` - 린트 규칙
- `.prettierrc` - 코드 포맷팅
- `vitest.config.ts` - 테스트 설정
- `.gitignore` - Git 제외 파일
- `.npmignore` - NPM 배포 제외 파일
- `.nvmrc` - Node 버전 고정
- `pnpm-workspace.yaml` - 모노레포 설정 (옵션)

### 6. NPM 배포 전략

**버전 관리:**
- Semantic Versioning (semver) 준수
- 자동 버전 범프: `standard-version` 사용
- 베타: `1.0.0-beta.1`
- 정식: `1.0.0`

**배포 스크립트:**
```json
{
  "scripts": {
    "build": "vite build",
    "test": "vitest",
    "lint": "eslint src --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "pnpm test && pnpm build",
    "release": "standard-version",
    "release:beta": "standard-version --prerelease beta"
  }
}
```

### 7. 개발 명령어
```bash
# 개발 서버
pnpm dev

# 빌드
pnpm build

# 테스트
pnpm test
pnpm test:watch
pnpm test:coverage

# 린트/포맷
pnpm lint
pnpm format

# 타입 체크
pnpm typecheck

# 릴리즈
pnpm release:beta  # 베타 버전
pnpm release       # 정식 버전
```

### 8. 초기 설정 작업 순서

1. **기본 프로젝트 초기화**
   - package.json 생성
   - TypeScript 설정
   - 린트/포맷터 설정

2. **Git-flow 브랜치 생성**
   - develop 브랜치 생성
   - 기본 브랜치 보호 규칙 설정

3. **CI/CD 워크플로우 작성**
   - PR 검증 워크플로우
   - 배포 워크플로우

4. **프로젝트 구조 생성**
   - 디렉토리 구조 생성
   - 기본 진입점 파일 작성

5. **개발 환경 검증**
   - 빌드 테스트
   - 로컬 개발 서버 확인

6. **NPM 배포 준비**
   - NPM 계정 설정
   - 패키지 이름 확인
   - 배포 자동화 설정

## 🔑 핵심 고려사항

1. **무결성 보장**: 플러그인 해시 검증 시스템
2. **샌드박싱**: 플러그인 격리 실행 환경
3. **성능**: 동적 로딩 & 캐싱 전략
4. **타입 안정성**: 엄격한 TypeScript 설정
5. **트리 쉐이킹**: ESM 모듈로 최적화
6. **브라우저 호환성**: 모던 브라우저 타겟
7. **문서화**: API 문서 자동 생성

## 📝 다음 단계

이 컨텍스트를 기반으로 `/Users/jactio/develop/crafton_jungle/my_own_weaphone/motiontext-renderer` 디렉토리에서 작업을 시작하세요.

1. 이 문서를 참고하여 초기 설정 진행
2. CLAUDE.md의 렌더러 스펙을 기반으로 구현
3. 단계별로 기능을 추가하며 테스트 작성
4. CI/CD 파이프라인을 통한 자동화된 품질 관리