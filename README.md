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
pnpm add motiontext-renderer
```

```bash
npm install motiontext-renderer
```

```bash
yarn add motiontext-renderer
```

> 참고: 이 라이브러리는 GSAP을 피어 의존성으로 요구합니다. 호스트 앱에 GSAP을 설치하세요.
>
> 설치: `pnpm add gsap` (또는 npm/yarn)

## 📖 기본 사용법

```typescript
import { MotionTextRenderer } from 'motiontext-renderer';

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

### 🔌 외부(커스텀) 플러그인 등록/원점 설정

프로덕션 사용처에서 커스텀 플러그인을 등록하거나, 플러그인 원점(server/local/auto)을 설정할 수 있는 공개 API를 제공합니다.

```ts
import {
  configurePluginSource,         // 원점 설정 (server/local/auto)
  registerExternalPlugin,        // 단일 플러그인 등록
  registerExternalPluginsFromGlob // 다건 등록 (예: import.meta.glob)
} from 'motiontext-renderer';

// 1) 원점 설정 (선택)
configurePluginSource({
  mode: 'auto',                  // 'server' | 'local' | 'auto'
  serverBase: 'https://plugins.example.com',
  localBase: '/plugins/'         // 번들/정적 경로
});

// 2) 플러그인 등록 (단일)
//   - module: { default: { name, version, animate... }, evalChannels? }
//   - baseUrl: assets.getUrl()의 기준 URL
registerExternalPlugin({
  name: 'myEffect',
  version: '1.0.0',
  module: await import('/plugins/myEffect@1.0.0/index.mjs'),
  baseUrl: '/plugins/myEffect@1.0.0/'
});

// 3) 플러그인 일괄 등록 (Vite dev 예시)
const PLUGINS = import.meta.glob('/plugins/*/index.mjs');
await registerExternalPluginsFromGlob(PLUGINS);
```

### 📦 내장 CWI 플러그인 시리즈

Caption with Intention (CWI) 플러그인들은 단어별 발화 강도에 따른 다양한 애니메이션을 제공합니다:

- **cwi-color@1.0.0**: 색상 변화 (흰색 → 화자별 색상)
- **cwi-loud@1.0.0**: 큰 소리 효과 (2.4배 확대 + 진동)
- **cwi-whisper@1.0.0**: 속삭임 효과 (0.6배 축소)
- **cwi-bouncing@1.0.0**: 바운싱 효과 (1.15배 확대 + 상하 움직임)

#### 사용 예시

```json
{
  "definitions": {
    "speakerPalette": {
      "SPEAKER_01": "#4AA3FF",
      "SPEAKER_02": "#FF4D4D",
      "SPEAKER_03": "#FFD400"
    }
  },
  "cues": [{
    "root": {
      "children": [{
        "e_type": "text",
        "text": "Hello",
        "pluginChain": [
          {
            "name": "cwi-loud@1.0.0",
            "params": {
              "speaker": "SPEAKER_01",
              "t0": 0.5,
              "t1": 0.8
            }
          },
          {
            "name": "cwi-color@1.0.0", 
            "params": {
              "speaker": "SPEAKER_01",
              "t0": 0.5,
              "t1": 0.8
            }
          }
        ]
      }]
    }
  }]
}
```

#### Definitions 섹션을 통한 최적화

`definitions` 섹션을 사용하면 공통 데이터를 중앙에서 관리할 수 있습니다:

```json
{
  "definitions": {
    "speakerPalette": {
      "SPEAKER_01": "#4AA3FF",
      "SPEAKER_02": "#FF4D4D"  
    }
  },
  "cues": [{
    "root": {
      "children": [{
        "pluginChain": [{
          "name": "cwi-color@1.0.0",
          "params": {
            "speaker": "SPEAKER_01",
            "palette": "definitions.speakerPalette"
          }
        }]
      }]
    }
  }]
}
```

**주요 이점:**
- **중복 제거**: palette를 한 번만 정의하고 참조로 재사용
- **파일 크기 감소**: 기존 대비 약 75% 크기 감소 (예: 800KB → 206KB)
- **유지보수 개선**: palette 중앙 관리로 색상 변경 용이
- **런타임 해결**: 렌더러가 `"definitions.speakerPalette"` 문자열을 실제 객체로 치환

모드 개요
- server: `serverBase`에서 `plugins/<name@version>/manifest.json`을 받아 entry(index.mjs)를 로드합니다. CDN/별도 플러그인 서버를 쓰는 배포 환경에 적합합니다.
- local: 번들 또는 정적 경로에 포함된 플러그인을 직접 import합니다. 서버 없이도 동작하며, 앱이 제공하는 정적 자산에서 즉시 로딩할 때 적합합니다.
- auto: 서버 우선 시도 후 실패하면 로컬로 폴백합니다. 개발/시연 환경에서 편리합니다.

언제 어떤 모드를 쓸까
- 배포용 CDN/전용 서버가 있고, 플러그인 교체·무효화·버전 고정이 필요: server
- 앱 번들에 플러그인을 포함하거나, 프록시/오프라인 환경: local
- 개발 중 서버가 있을 때/없을 때를 모두 고려: auto

플러그인 모듈 규약(요약, v2.1)
```js
// index.mjs (예시)
export default {
  name: 'myEffect',
  version: '1.0.0',
  init(el, opts, ctx) {
    // effectsRoot(el) 하위만 조작 (샌드박스)
  },
  animate(el, opts, ctx, duration) {
    // 0..1 진행을 받는 seek 함수형 또는 GSAP Timeline 반환
    return (p) => {
      el.style.opacity = String(Math.min(1, Math.max(0, p)));
    };
  },
  cleanup(el) {}
};
```

자산 URL과 baseUrl
- `registerExternalPlugin`의 `baseUrl`은 플러그인 내부 `ctx.assets.getUrl('path')` 해석 기준이 됩니다.
- server 모드에서는 manifest의 entry/자산 경로를 기준으로 자동 계산됩니다.
- `registerExternalPluginsFromGlob`는 기본 파서로 `.../<name>@<version>/index.mjs`를 인식해 `baseUrl=.../<name>@<version>/`로 설정합니다. 다른 디렉터리 구조라면 `parse` 콜백을 전달해 직접 지정하세요.

서버 모드용 최소 manifest 예시
```json
{
  "name": "myEffect",
  "version": "1.0.0",
  "entry": "index.mjs"
}
```
서버는 `plugins/<name>@<version>/manifest.json`와 `index.mjs`(및 필요 자산)를 정적으로 서빙하면 됩니다.

다건 등록(번들러별 팁)
- Vite: `import.meta.glob('/plugins/*/index.mjs')`를 권장 (비동기 로더 맵 생성)
- Webpack/기타: 정적 import 후 `registerExternalPlugin`을 반복 호출하거나, 동적 import 가능한 경로 규칙을 사용하여 로더 맵을 구성하세요.

SSR/Next.js 주의
- 클라이언트에서만 등록하세요. 예: `if (typeof window !== 'undefined') await registerExternalPluginsFromGlob(...)`.

트러블슈팅
- “Failed to fetch dynamically imported module”: 경로/도메인(서버 모드), 정적 파일 위치(local 모드) 확인. 서버 모드라면 CORS/경로(`plugins/<name@version>/...`)를 점검하세요.
- “not found @ version”: 시나리오 JSON의 `plugin.name`이 `myEffect@1.0.0`처럼 버전까지 포함되어야 합니다(혹은 동일 name 키로 등록).
- 로컬 경로 404 (Vite dev): dev root에 맞는 경로인지 확인하고, 가능하면 글롭(registrar)을 사용하세요.

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

### Dev 플러그인 원점 설정 (M6.8)

데모/개발 환경에서 플러그인 소스(서버/로컬)를 init으로 설정합니다.

- 환경변수로 설정(권장):
```bash
# 서버 우선, 실패 시 로컬 폴백(auto)
pnpm dev

# 서버만 사용
VITE_PLUGIN_MODE=server VITE_PLUGIN_ORIGIN=http://localhost:3300 pnpm dev

# 로컬 폴더만 사용
VITE_PLUGIN_MODE=local VITE_PLUGIN_LOCAL_BASE=./demo/plugin-server/plugins/ pnpm dev
```

- 코드에서 설정(`demo/devPlugins.ts`):
```ts
import { configureDevPlugins } from '../src/loader/dev/DevPluginConfig';

configureDevPlugins({
  mode: 'auto',
  serverBase: 'http://localhost:3300',
  localBase: './demo/plugin-server/plugins/',
});
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
npm info motiontext-renderer

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
- **NPM**: https://npmjs.com/package/motiontext-renderer
- **Issues**: https://github.com/teamKimtaerin/motiontext-renderer/issues

---

## 📞 지원

문의사항이나 버그 리포트는 [GitHub Issues](https://github.com/teamKimtaerin/motiontext-renderer/issues)를 이용해 주세요.

---

Made with ❤️ by Team Kimtaerin
