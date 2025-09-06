# MotionText Renderer

🎬 **웹 기반 애니메이션 자막/캡션 렌더러 라이브러리**

동영상 콘텐츠에 동적인 자막과 애니메이션 효과를 쉽게 추가할 수 있는 TypeScript 라이브러리입니다. 플러그인 시스템을 통해 확장 가능하며, 웹 표준을 준수하는 안전한 샌드박스 환경에서 동작합니다.

## ✨ 주요 기능

- 🎯 **정규화 좌표계**: 스테이지 기준 (0~1) 좌표로 모든 디바이스 지원
- ⏰ **정밀한 미디어 싱크**: requestVideoFrameCallback 기반 프레임 동기화
- 🔌 **동적 플러그인 시스템**: ES Dynamic Import + 무결성 검증
- 🛡️ **보안 샌드박스**: 플러그인 격리 실행 환경
- 🎭 **다층 레이어 시스템**: Track → Cue → Element 계층 구조
- 📦 **TypeScript 완전 지원**: 타입 안전성과 IntelliSense

## 🚀 설치

```bash
pnpm add @teamkimtaerin/motiontext-renderer
```

```bash
npm install @teamkimtaerin/motiontext-renderer
```

```bash
yarn add @teamkimtaerin/motiontext-renderer
```

> **참고**: GSAP은 라이브러리에 포함되어 있어 별도 설치가 불필요합니다.

## 📖 기본 사용법

```typescript
import { MotionTextRenderer } from '@teamkimtaerin/motiontext-renderer';

// 컨테이너 요소와 비디오 요소 준비
const container = document.getElementById('caption-container');
const video = document.getElementById('main-video');

// 렌더러 초기화
const renderer = new MotionTextRenderer(container);

// 설정 로드
const config = {
  version: '1.3',
  timebase: { unit: 'seconds' },
  stage: { baseAspect: '16:9' },
  tracks: [
    {
      id: 'subtitle',
      type: 'subtitle',
      layer: 1
    }
  ],
  cues: [
    {
      id: 'cue1',
      track: 'subtitle',
      hintTime: 0,
      root: {
        id: 'group1',
        type: 'group',
        children: [
          {
            id: 'text1',
            type: 'text',
            absStart: 0,
            absEnd: 3,
            content: '안녕하세요!',
            layout: {
              position: [0.5, 0.8]
            }
          }
        ]
      }
    }
  ]
};

await renderer.loadConfig(config);

// 비디오와 연동
renderer.attachMedia(video);

// 재생 시작
renderer.play();
```

---

## 🔧 개발 가이드

### 개발 환경 설정

1. **저장소 클론**
```bash
git clone https://github.com/teamKimtaerin/motiontext-renderer.git
cd motiontext-renderer
```

2. **의존성 설치**
```bash
pnpm install
```

3. **개발 서버 실행**
```bash
pnpm dev
```

### 개발 명령어

```bash
# 개발 모드 (Vite 개발 서버)
pnpm dev

# 빌드
pnpm build

# 코드 품질 검사
pnpm lint          # ESLint 실행
pnpm lint:fix      # ESLint 자동 수정
pnpm format        # Prettier 포맷팅
pnpm format:check  # 포맷팅 검사
pnpm typecheck     # TypeScript 타입 체크

# 정리
pnpm clean         # dist 폴더 삭제
```

---

## 📦 버전 관리 및 배포 가이드

이 프로젝트는 **Changesets**를 사용하여 Semantic Versioning을 자동화합니다.

### 🛠️ 기능 개발 시 워크플로우

1. **새 브랜치 생성 및 작업**
```bash
git checkout -b feature/새기능
# 코드 작업...
```

2. **변경사항 기록 (중요!)**
```bash
pnpm changeset
```
실행하면 대화형 프롬프트가 나타납니다:
- **패치(patch)**: 버그 수정 (1.0.0 → 1.0.1)
- **마이너(minor)**: 새 기능 (1.0.0 → 1.1.0) 
- **메이저(major)**: 브레이킹 체인지 (1.0.0 → 2.0.0)

3. **커밋 및 PR 생성**
```bash
git add .changeset/
git commit -m "feat: 새로운 기능 추가"
git push origin feature/새기능
# GitHub에서 PR 생성
```

4. **PR 머지**
   - CI 통과 확인
   - 코드 리뷰 완료
   - `main` 브랜치로 머지

### 🤖 자동 배포 프로세스

#### 1단계: 자동 버전 PR 생성
- `main` 브랜치에 push되면 **Changesets Bot**이 동작
- "Version Packages" PR이 자동 생성됩니다
- 이 PR에는 다음이 포함됩니다:
  - `package.json` 버전 자동 증가
  - `CHANGELOG.md` 자동 업데이트
  - 누적된 모든 변경사항 정리

#### 2단계: NPM 자동 배포
- **Version Packages** PR을 머지하면:
  - GitHub Actions가 자동 실행
  - 품질 검사 (lint, typecheck, build) 수행
  - NPM Registry에 자동 배포
  - Git 태그 자동 생성 (예: `v1.2.0`)

### 🔍 배포 상태 확인

```bash
# 현재 배포된 버전 확인
npm info @teamkimtaerin/motiontext-renderer

# 로컬 버전 확인  
pnpm version
```

### 📊 버전 히스토리 예시

```
v0.1.0 → feat: 초기 렌더러 구현
v0.1.1 → fix: 타입 정의 오류 수정  
v0.2.0 → feat: 플러그인 시스템 추가
v0.2.1 → fix: 메모리 누수 해결
v1.0.0 → feat!: API 재설계 (Breaking Change)
```

---

## 🏗️ CI/CD 파이프라인

### PR 검증 (.github/workflows/ci.yml)
모든 Pull Request에 대해 다음을 자동 검사:
- ✅ ESLint 규칙 준수
- ✅ Prettier 포맷팅
- ✅ TypeScript 타입 체크
- ✅ 빌드 성공 여부

### 자동 배포 (.github/workflows/release.yml)
`main` 브랜치 push 시 자동 실행:
1. 품질 검사 통과
2. 프로덕션 빌드 생성
3. Changesets로 버전 관리
4. NPM 배포 (NPM_TOKEN 필요)
5. GitHub Release 생성

### 🔐 필수 GitHub Secrets

리포지토리 Settings → Secrets에서 설정:
```
NPM_TOKEN=npm_xxxxxxxxxxxxxxx
```

NPM 토큰 생성 방법:
1. [npmjs.com](https://npmjs.com) 로그인
2. Profile → Access Tokens
3. "Generate New Token" → "Automation" 선택
4. 생성된 토큰을 GitHub Secrets에 추가

---

## 🎯 배포 시나리오 예제

### 시나리오 1: 버그 수정
```bash
# 1. 브랜치 생성 및 수정
git checkout -b fix/memory-leak
# 코드 수정...

# 2. 변경사항 기록
pnpm changeset
# → patch 선택
# → "메모리 누수 해결" 설명 입력

# 3. 커밋 및 PR
git add .
git commit -m "fix: 메모리 누수 해결"
git push

# 4. PR 머지 후 자동으로 v1.0.1로 배포
```

### 시나리오 2: 새 기능 추가
```bash
# 1. 기능 개발
git checkout -b feature/plugin-system
# 코드 작성...

# 2. 변경사항 기록
pnpm changeset  
# → minor 선택
# → "플러그인 시스템 추가" 설명

# 3. PR 머지 후 자동으로 v1.1.0으로 배포
```

### 시나리오 3: 긴급 수정
```bash
# hotfix 브랜치에서 작업
git checkout -b hotfix/critical-bug
pnpm changeset  # patch 선택
# PR 머지 즉시 패치 버전 배포
```

---

## 📁 프로젝트 구조

```
motiontext-renderer/
├── src/                    # 소스 코드
│   ├── index.ts           # 메인 진입점  
│   ├── core/              # 핵심 렌더링 엔진
│   │   └── renderer.ts    # 렌더러 클래스
│   └── types/             # TypeScript 타입 정의
│       └── index.ts       # 공용 타입 모음
├── dist/                  # 빌드 결과물 (자동 생성)
├── .changeset/            # 버전 관리 설정
├── .github/workflows/     # CI/CD 파이프라인
├── package.json           # 프로젝트 설정
├── tsconfig.json          # TypeScript 설정
├── vite.config.ts         # Vite 빌드 설정
└── README.md              # 이 파일
```

---

## 🤝 기여하기

1. Fork the Project
2. Create Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Make your changes
4. Record changeset (`pnpm changeset`)
5. Commit Changes (`git commit -m 'Add some AmazingFeature'`)
6. Push to Branch (`git push origin feature/AmazingFeature`)
7. Open a Pull Request

---

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

## 🔗 링크

- **GitHub**: https://github.com/teamKimtaerin/motiontext-renderer
- **NPM**: https://npmjs.com/package/@teamkimtaerin/motiontext-renderer
- **Issues**: https://github.com/teamKimtaerin/motiontext-renderer/issues

---

## 📞 지원

문의사항이나 버그 리포트는 [GitHub Issues](https://github.com/teamKimtaerin/motiontext-renderer/issues)를 이용해 주세요.

---

Made with ❤️ by Team Kimtaerin