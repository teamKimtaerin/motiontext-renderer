# MotionText Renderer

🎬 **고성능 비디오 오버레이 렌더링 엔진** - v2.0 Native Architecture

동영상 위에 정교한 자막, 애니메이션, 인터랙티브 효과를 실시간으로 렌더링하는 TypeScript 라이브러리입니다. 독창적인 DOM 분리 구조와 채널 기반 합성 시스템으로 플러그인 간 충돌을 방지하며, requestVideoFrameCallback 기반 정밀 동기화를 제공합니다.

## 🚀 핵심 아키텍처 철학

### **v2.0 Native Design**
- **Array-based Time**: 모든 시간 필드를 `[start, end]` 배열로 통일하여 성능 최적화
- **Inheritence Design** 하위 계층이 상위 계층의 필드를 상속 - 파일 크기 최적화
- **Define System**: 중복 제거와 에셋 관리를 위한 사전 해석 시스템

### **DOM 분리 아키텍처 (Plugin API v3.0)**
```
baseWrapper (렌더러 제어)
├── 레이아웃, 위치, 시간 동기화
├── CSS 변수 채널 관리 (--mtx-tx, --mtx-ty, --mtx-opacity)
└── effectsRoot (플러그인 샌드박스)
    └── 플러그인 자유 DOM 조작 영역
```

### **채널 기반 합성 시스템**
독립적인 변환 채널을 통해 여러 플러그인이 충돌 없이 동시 실행:
- **표준 채널**: tx/ty(이동), sx/sy(크기), rot(회전), opacity, filter
- **합성 모드**: replace/add/multiply로 채널별 조합 규칙 정의
- **샌드박스 보장**: 플러그인은 effectsRoot 하위만 접근 가능

### **렌더러-플러그인 책임 분리**
- **렌더러**: DOM 생명주기, 시간 계산, Define 해석, 레이아웃
- **플러그인**: 상대 진행도(0~1) 기반 순수 애니메이션 로직
- **컨텍스트**: 해석된 파라미터와 제한된 API만 플러그인에 노출

## ⚡ 구현 상세

### **1. requestVideoFrameCallback 동기화**
브라우저의 비디오 프레임과 완벽 동기화하여 티어링 없는 부드러운 렌더링:
```typescript
// TimelineControllerV2.ts
video.requestVideoFrameCallback((now, metadata) => {
  const currentTime = metadata.mediaTime;
  this.renderer.update(currentTime);
});
```

### **2. Define 시스템 사전 해석**
런타임 성능을 위해 "define.key" 참조를 파싱 단계에서 완전 해석:
```typescript
// 시나리오에서
"color": "define.brand_colors.primary"

// 플러그인에서 (이미 해석된 값)
options.color // "#FFD400" (실제 값)
```

### **3. domLifetime 기반 DOM 최적화**
필요한 시점에만 DOM 생성/해제하여 메모리 효율성 극대화:
```json
{
  "domLifetime": [0.5, 8.5],  // DOM 생성/해제 시점
  "displayTime": [1.0, 8.0]   // 실제 표시 시간
}
```

### **4. 타입 안전한 외부 플러그인 시스템**
ES Dynamic Import와 무결성 검증을 통한 안전한 플러그인 생태계:
```typescript
// 자동 플러그인 발견 및 로딩
const plugins = import.meta.glob('/plugins/*/index.mjs');
await registerExternalPluginsFromGlob(plugins);
```

## 🏗️ 주요 구현 성과

### **플러그인 생태계 (Plugin API v3.0)**
```typescript
export interface PluginRuntimeModule {
  name: string;
  version: string;

  animate: (element: HTMLElement, options: ResolvedOptions, ctx: PluginContext, duration: number)
    => TimelineLike | SeekApplier;

  init?: (element: HTMLElement, options: ResolvedOptions, ctx: PluginContext) => Promise<void> | void;
  cleanup?: (element: HTMLElement) => Promise<void> | void;
}
```

## 🧩 기술적 도전과제 해결

### **Challenge 1: 플러그인 간 충돌 방지**
**문제**: 여러 플러그인이 동일한 DOM 속성을 조작할 때 예측 불가능한 결과
**해결**: CSS 변수 채널 시스템으로 독립적 변환 경로 제공
```css
/* 플러그인A */ --mtx-tx: 10px;
/* 플러그인B */ --mtx-tx: 20px; (add 모드)
/* 최종 */ transform: translateX(calc(10px + 20px));
```

### **Challenge 2: 비디오-자막 동기화 정확도**
**문제**: setTimeout/setInterval 기반 동기화의 프레임 드롭
**해결**: requestVideoFrameCallback으로 하드웨어 레벨 동기화
```typescript
// 60fps 환경에서 16.67ms 정확도 보장
video.requestVideoFrameCallback(this.syncCallback);
```

### **Challenge 3: Define 참조의 성능 오버헤드**
**문제**: 런타임마다 "define.key" 문자열 파싱으로 인한 성능 저하
**해결**: 파싱 단계 사전 해석으로 런타임 참조 제거
```typescript
// Before: 매 프레임마다 파싱
const color = this.resolveDefine(options.color); // "define.brand.primary"

// After: 파싱 시점에 완료
const color = options.color; // "#FFD400" (이미 해석됨)
```

### **Challenge 4: 플러그인 샌드박스 보안**
**문제**: 악의적 플러그인의 상위 DOM 조작 위험
**해결**: effectsRoot 경계 강제와 PluginContext API 제한
```typescript
// 플러그인은 container(effectsRoot) 하위만 접근 가능
ctx.container; // effectsRoot 요소
// 상위 DOM 접근 불가 (baseWrapper 보호)
```

### **Challenge 5: 시간 표현의 일관성**
**문제**: v1.3의 absStart/absEnd, relStart/relEnd 등 복잡한 시간 필드
**해결**: v2.0에서 모든 시간을 `[start, end]` 배열로 통일
```json
// v1.3 (복잡)
{ "absStart": 1.0, "absEnd": 3.0, "relStart": 0, "relEnd": 0.5 }

// v2.0 (단순)
{ "displayTime": [1.0, 3.0], "timeOffset": ["0%", "50%"] }
```

## 📊 성능 벤치마크

### **v2.0 Native vs v1.3 Legacy**
- **메모리 사용량**: 40% 감소 (DOM 생명주기 최적화)
- **JSON 크기**: 75% 감소 (Define 중복 제거)

### **실제 사용 사례**
```json
// 800KB → 206KB (Define 시스템 적용)
{
  "define": {
    "speakerPalette": {
      "SPEAKER_01": "#4AA3FF",
      "SPEAKER_02": "#FF4D4D"
    }
  },
  "cues": [{
    "root": {
      "children": [{
        "pluginChain": [{
          "name": "cwi-color",
          "params": {
            "palette": "define.speakerPalette" // 참조로 재사용
          }
        }]
      }]
    }
  }]
}
```

## **TODO : 에셋 관리 시스템**
- **무결성 검증**: SHA-384 해시 기반 보안
- **FontFace 자동화**: 폰트 등록/해제 완전 자동화
- **지연 로딩**: 필요 시점 에셋 동적 로딩
- **다양한 에셋 타입**: font, image, video, audio 지원

## 🚀 설치 및 사용법

### **기본 설치**
```bash
pnpm add motiontext-renderer gsap
```

> **Peer Dependencies**: GSAP 3.12.0+ 필수

### **v2.0 시나리오 기본 사용법**
```typescript
import { MotionTextRenderer } from 'motiontext-renderer';

// v2.0 Native 렌더러 초기화
const renderer = new MotionTextRenderer(container);

// v2.0 시나리오 로드 (네이티브 처리)
const scenario = {
  "version": "2.0",
  "timebase": { "unit": "seconds", "fps": 30 },
  "stage": { "baseAspect": "16:9" },

  "define": {
    "brand_colors": {
      "primary": "#FFD400",
      "secondary": "#4AA3FF"
    }
  },

  "tracks": [{
    "id": "subtitle",
    "type": "subtitle",
    "layer": 10,
    "defaultStyle": { "fontSizeRel": 0.05 }
  }],

  "cues": [{
    "id": "greeting",
    "track": "subtitle",
    "domLifetime": [0.5, 5.5],
    "root": {
      "id": "text_root",
      "e_type": "text",
      "text": "안녕하세요!",
      "displayTime": [1.0, 5.0],
      "layout": {
        "position": { "x": 0.5, "y": 0.9 },
        "anchor": "bc"
      },
      "style": {
        "color": "define.brand_colors.primary"
      },
      "pluginChain": [{
        "name": "fadeIn",
        "time_offset": [0, 0.5]
      }]
    }
  }]
};

await renderer.loadConfig(scenario);
renderer.attachMedia(videoElement);
```

### **외부 플러그인 시스템 (Plugin API v3.0)**

타입 안전하고 확장 가능한 플러그인 생태계를 구축할 수 있습니다:

```typescript
import {
  configurePluginSource,
  registerExternalPlugin,
  registerExternalPluginsFromGlob
} from 'motiontext-renderer';

// 플러그인 소스 설정
configurePluginSource({
  mode: 'auto',  // 'server' | 'local' | 'auto'
  serverBase: 'https://cdn.example.com/plugins',
  localBase: '/static/plugins'
});

// 개별 플러그인 등록
registerExternalPlugin({
  name: 'myEffect',
  version: '2.0.0',
  module: await import('/plugins/myEffect@2.0.0/index.mjs'),
  baseUrl: '/plugins/myEffect@2.0.0/'
});

// 배치 플러그인 등록 (Vite)
const plugins = import.meta.glob('/plugins/*/index.mjs');
await registerExternalPluginsFromGlob(plugins);
```

### **플러그인 개발 (Plugin API v3.0)**
```typescript
// my-plugin/index.mjs
export default {
  name: 'myEffect',
  version: '2.0.0',

  animate(element, options, ctx, duration) {
    return (progress) => {
      // 채널 시스템 사용 (충돌 방지)
      ctx.channels?.set('opacity', progress, 'replace');
      ctx.channels?.set('tx', `${progress * 100}px`, 'add');

      // 직접 스타일 조작 (effectsRoot 내부만)
      element.style.color = options.color;
    };
  },

  async init(element, options, ctx) {
    // 에셋 로딩
    const texture = await ctx.assets.loadAsset('particle.png');
    this.textureUrl = URL.createObjectURL(texture);
  },

  cleanup(element) {
    // 메모리 정리
    if (this.textureUrl) URL.revokeObjectURL(this.textureUrl);
  }
};
```

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

3. **AI 편집기 환경 설정 (선택사항)**

AI 기반 자막 편집 기능을 사용하려면 환경변수를 설정하세요:

```bash
# .env 파일 생성
cp .env.example .env

# .env 파일에 API 키 설정
ANTHROPIC_API_KEY=sk-ant-your-api-key-here
```

4. **데모 서버 실행**
```bash
pnpm dev

# AI 편집기 사용 시 추가로 프록시 서버 실행
pnpm proxy:server
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

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

## 🔗 링크

- **GitHub**: https://github.com/teamKimtaerin/motiontext-renderer
- **NPM**: https://npmjs.com/package/motiontext-renderer
- **Issues**: https://github.com/teamKimtaerin/motiontext-renderer/issues

---