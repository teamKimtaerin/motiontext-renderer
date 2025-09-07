# 플러그인 인증 시스템 (v2.1)

MotionText Renderer의 플러그인 시스템은 무결성 검증과 서명 기반 인증을 통해 악성 코드 실행을 방지하고 안전한 동적 로딩을 보장합니다. 본 문서는 v2.1 아키텍처를 기반으로 한 플러그인 인증 방식을 상세히 설명합니다.

## 📋 목차

1. [인증 개요](#인증-개요)
2. [무결성 검증 (Integrity Verification)](#무결성-검증)
3. [디지털 서명 (Digital Signature)](#디지털-서명)
4. [로딩 시퀀스](#로딩-시퀀스)
5. [개발 vs 프로덕션 모드](#개발-vs-프로덕션-모드)
6. [보안 정책](#보안-정책)
7. [구현 예시](#구현-예시)

---

## 인증 개요

플러그인 인증 시스템은 **이중 보안**을 제공합니다:

1. **무결성 검증** (Integrity): 파일이 변조되지 않았음을 보장
2. **출처 인증** (Authenticity): 신뢰할 수 있는 개발자가 서명했음을 증명

### 보안 목표

- ✅ **코드 주입 방지**: 악성 스크립트 실행 차단
- ✅ **공급망 보안**: 패키지 변조 탐지
- ✅ **샌드박싱**: 플러그인 실행 범위 제한
- ✅ **롤백 안전성**: 검증 실패 시 안전한 폴백

---

## 무결성 검증

### SHA-384 해시 검증

모든 플러그인 파일(엔트리, 에셋)은 SHA-384 해시로 무결성을 검증합니다.

```json
{
  "name": "flames",
  "version": "1.0.0",
  "entry": "index.mjs",
  "integrity": {
    "entry": "sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC",
    "assets": {
      "assets/flame.gif": "sha384-B2yxGD2iJj9l8M5JVgR2L8mH5q2C7vE9NdG8m1K5S9Q3hJ2wP7cX1vR6t8Z4nF0A",
      "assets/fire.woff2": "sha384-X5yRTZ3iYj1l2M3JVgQ1L7mG3q1C5vD8NcF7m0J4R8P2gI1wO6bW0vQ5s7Y3mE9Z"
    }
  }
}
```

### 해시 계산 과정

1. **파일 다운로드**: fetch API로 원본 파일 받기
2. **해시 계산**: Web Crypto API의 `crypto.subtle.digest('SHA-384', buffer)`
3. **Base64 인코딩**: `btoa(String.fromCharCode(...new Uint8Array(hash)))`
4. **매니페스트 비교**: 계산된 해시와 매니페스트의 integrity 값 비교

```typescript
async function verifyIntegrity(url: string, expectedHash: string): Promise<boolean> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  
  const hashBuffer = await crypto.subtle.digest('SHA-384', buffer);
  const hashArray = new Uint8Array(hashBuffer);
  const computedHash = 'sha384-' + btoa(String.fromCharCode(...hashArray));
  
  return computedHash === expectedHash;
}
```

---

## 디지털 서명

### Ed25519 서명 검증

플러그인 매니페스트는 Ed25519 알고리즘으로 서명됩니다. 이는 RSA보다 빠르고 안전한 현대적 서명 방식입니다.

```json
{
  "integrity": {
    "entry": "sha384-...",
    "assets": { ... },
    "signature": "base64_encoded_ed25519_signature"
  }
}
```

### 서명 생성 과정 (개발자)

1. **매니페스트 정규화**: integrity 객체를 제외한 모든 필드를 JSON으로 직렬화
2. **해시 계산**: 정규화된 매니페스트를 SHA-256으로 해싱  
3. **서명 생성**: Ed25519 개인키로 해시에 서명
4. **Base64 인코딩**: 서명을 Base64로 인코딩하여 매니페스트에 추가

```typescript
// 개발자 도구에서 사용하는 서명 생성 예시
async function signManifest(manifest: object, privateKey: CryptoKey): Promise<string> {
  // signature 필드를 제외한 정규화된 매니페스트
  const normalized = JSON.stringify(manifest, null, 2);
  const messageBuffer = new TextEncoder().encode(normalized);
  
  // SHA-256 해시 계산
  const hashBuffer = await crypto.subtle.digest('SHA-256', messageBuffer);
  
  // Ed25519 서명 생성
  const signatureBuffer = await crypto.subtle.sign(
    'Ed25519', 
    privateKey, 
    hashBuffer
  );
  
  return btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
}
```

### 서명 검증 과정 (렌더러)

```typescript
async function verifySignature(
  manifest: object, 
  signature: string, 
  publicKey: CryptoKey
): Promise<boolean> {
  // 매니페스트에서 signature 제거 후 정규화
  const { integrity, ...manifestWithoutIntegrity } = manifest;
  const { signature: _, ...integrityWithoutSignature } = integrity;
  
  const verifiableManifest = {
    ...manifestWithoutIntegrity,
    integrity: integrityWithoutSignature
  };
  
  const normalized = JSON.stringify(verifiableManifest, null, 2);
  const messageBuffer = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', messageBuffer);
  
  // Base64 디코딩
  const signatureBuffer = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
  
  // Ed25519 서명 검증
  return await crypto.subtle.verify(
    'Ed25519',
    publicKey,
    signatureBuffer,
    hashBuffer
  );
}
```

---

## 로딩 시퀀스

플러그인 로딩은 다음과 같은 단계적 검증을 거칩니다:

### 1. 매니페스트 다운로드 및 검증

```typescript
async function loadPlugin(pluginUrl: string): Promise<PluginModule> {
  // 1. 매니페스트 fetch
  const manifestResponse = await fetch(`${pluginUrl}/manifest.json`);
  const manifest = await manifestResponse.json();
  
  // 2. 서명 검증 (프로덕션 모드)
  if (isProduction) {
    const isValidSignature = await verifySignature(
      manifest, 
      manifest.integrity.signature, 
      trustedPublicKey
    );
    if (!isValidSignature) {
      throw new SecurityError('Invalid plugin signature');
    }
  }
  
  return manifest;
}
```

### 2. 에셋 프리로드 및 무결성 검증

```typescript
async function preloadAssets(manifest: PluginManifest): Promise<void> {
  for (const assetPath of manifest.preload || []) {
    const assetUrl = `${manifest.baseUrl}/${assetPath}`;
    const expectedHash = manifest.integrity.assets[assetPath];
    
    if (!expectedHash) {
      throw new SecurityError(`Missing integrity hash for asset: ${assetPath}`);
    }
    
    const isValid = await verifyIntegrity(assetUrl, expectedHash);
    if (!isValid) {
      throw new SecurityError(`Asset integrity check failed: ${assetPath}`);
    }
    
    // 폰트 에셋인 경우 FontFace로 등록
    if (assetPath.match(/\.(woff2?|ttf|otf)$/)) {
      await loadFontAsset(assetUrl, assetPath);
    }
  }
}
```

### 3. 엔트리 모듈 로드 및 실행

```typescript
async function loadEntryModule(manifest: PluginManifest): Promise<PluginModule> {
  const entryUrl = `${manifest.baseUrl}/${manifest.entry}`;
  const expectedHash = manifest.integrity.entry;
  
  // 무결성 검증
  const isValid = await verifyIntegrity(entryUrl, expectedHash);
  if (!isValid) {
    throw new SecurityError('Entry module integrity check failed');
  }
  
  // Blob URL을 통한 안전한 동적 import
  const moduleResponse = await fetch(entryUrl);
  const moduleCode = await moduleResponse.text();
  const blob = new Blob([moduleCode], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  
  try {
    const module = await import(blobUrl);
    return module.default || module;
  } finally {
    // 메모리 해제
    URL.revokeObjectURL(blobUrl);
  }
}
```

---

## 개발 vs 프로덕션 모드

### 개발 모드 (Dev)

```typescript
const devConfig = {
  skipSignatureVerification: true,  // 서명 검증 생략
  skipIntegrityCheck: false,        // 무결성은 여전히 검증
  allowSelfSigned: true,           // 자체 서명 인증서 허용
  corsPolicy: '*',                 // CORS 제한 완화
  csp: {
    'script-src': "'self' blob:",  // Blob URL 허용
    'img-src': '*',               // 이미지 소스 제한 없음
    'font-src': '*'               // 폰트 소스 제한 없음
  }
};
```

**개발 모드 특징:**
- 빠른 반복 개발을 위해 서명 검증 생략
- 무결성 검증은 유지하여 기본적인 보안 보장
- localhost, file:// 프로토콜 허용

### 프로덕션 모드 (Prod)

```typescript
const prodConfig = {
  skipSignatureVerification: false, // 서명 검증 필수
  skipIntegrityCheck: false,        // 무결성 검증 필수
  allowSelfSigned: false,          // 신뢰할 수 있는 CA만 허용
  corsPolicy: 'same-origin',       // 엄격한 CORS 정책
  trustedSources: [                // 화이트리스트 기반 소스 제한
    'https://plugins.motiontext.io',
    'https://cdn.motiontext.io'
  ],
  csp: {
    'script-src': "'self'",        // 동일 출처만 허용
    'img-src': "'self' https:",    // HTTPS 이미지만 허용
    'font-src': "'self' https:"    // HTTPS 폰트만 허용
  }
};
```

**프로덕션 모드 특징:**
- 모든 보안 검증 활성화
- 신뢰할 수 있는 소스만 허용
- 엄격한 CSP (Content Security Policy) 적용

---

## 보안 정책

### CSP (Content Security Policy) 설정

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' blob:;
  img-src 'self' https: data:;
  font-src 'self' https:;
  connect-src 'self' https://plugins.motiontext.io;
  object-src 'none';
  base-uri 'self';
">
```

### 샌드박스 격리

플러그인은 다음과 같은 제한된 환경에서 실행됩니다:

```typescript
interface PluginSandbox {
  // 허용된 접근
  container: HTMLElement;          // effectsRoot만 조작 가능
  assets: AssetManager;           // 검증된 에셋만 접근
  portal?: PortalManager;         // 권한이 있는 경우에만
  
  // 금지된 접근
  // - window, document 전역 객체 직접 조작
  // - baseWrapper DOM 수정
  // - 외부 네트워크 요청
  // - localStorage, sessionStorage 직접 접근
  // - 타이머 (setTimeout, setInterval) 생성
}
```

### 권한 시스템

플러그인은 매니페스트에서 필요한 권한을 선언해야 합니다:

```json
{
  "capabilities": [
    "portal-breakout",    // PortalManager 사용 허용
    "channels-eval",      // 채널 기반 합성 허용 (개발용)
    "style-vars"          // CSS 변수 조작 허용
  ]
}
```

### 메모리 보호

```typescript
class PluginMemoryGuard {
  private domNodeLimit = 100;      // DOM 노드 생성 제한
  private listenerLimit = 50;      // 이벤트 리스너 등록 제한
  private timelineLimit = 10;      // 타임라인 인스턴스 제한
  
  checkLimits(plugin: PluginInstance) {
    if (plugin.domNodes.size > this.domNodeLimit) {
      throw new SecurityError('DOM node limit exceeded');
    }
    if (plugin.eventListeners.size > this.listenerLimit) {
      throw new SecurityError('Event listener limit exceeded');
    }
  }
}
```

---

## 구현 예시

### 완전한 플러그인 로더

```typescript
export class SecurePluginLoader {
  private trustedKeys = new Map<string, CryptoKey>();
  private loadedPlugins = new Map<string, PluginModule>();
  
  async loadPlugin(pluginId: string, version: string): Promise<PluginModule> {
    const cacheKey = `${pluginId}@${version}`;
    
    // 캐시된 플러그인 확인
    if (this.loadedPlugins.has(cacheKey)) {
      return this.loadedPlugins.get(cacheKey)!;
    }
    
    try {
      // 1. 매니페스트 로드
      const manifest = await this.loadManifest(pluginId, version);
      
      // 2. 서명 검증 (프로덕션만)
      if (!isDevelopment()) {
        await this.verifySignature(manifest);
      }
      
      // 3. 에셋 프리로드
      await this.preloadAssets(manifest);
      
      // 4. 엔트리 모듈 로드
      const module = await this.loadEntryModule(manifest);
      
      // 5. 모듈 검증
      this.validateModule(module, manifest);
      
      // 6. 캐싱
      this.loadedPlugins.set(cacheKey, module);
      
      return module;
      
    } catch (error) {
      console.error(`Plugin loading failed: ${pluginId}@${version}`, error);
      throw new PluginLoadError(`Failed to load plugin: ${error.message}`);
    }
  }
  
  private async verifySignature(manifest: PluginManifest): Promise<void> {
    const publicKey = this.trustedKeys.get(manifest.publisher);
    if (!publicKey) {
      throw new SecurityError('Untrusted publisher');
    }
    
    const isValid = await verifySignature(
      manifest, 
      manifest.integrity.signature, 
      publicKey
    );
    
    if (!isValid) {
      throw new SecurityError('Invalid plugin signature');
    }
  }
  
  private validateModule(module: any, manifest: PluginManifest): void {
    // API 버전 호환성 검사
    if (manifest.pluginApi !== '2.1') {
      throw new VersionError('Unsupported plugin API version');
    }
    
    // 필수 exports 검사
    if (!module.animate || typeof module.animate !== 'function') {
      throw new ValidationError('Missing required animate function');
    }
    
    // 스키마 검증
    if (manifest.schema && !this.validateSchema(module.schema, manifest.schema)) {
      throw new ValidationError('Schema validation failed');
    }
  }
}
```

### 에러 처리 및 폴백

```typescript
export class PluginErrorHandler {
  handleLoadError(error: Error, pluginId: string): PluginModule {
    // 로깅
    this.logSecurityIncident({
      type: 'plugin_load_failed',
      pluginId,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    // 폴백 플러그인 반환
    return this.createFallbackPlugin(pluginId);
  }
  
  private createFallbackPlugin(pluginId: string): PluginModule {
    return {
      name: pluginId,
      version: '0.0.0-fallback',
      animate: () => (progress: number) => {
        // 아무 효과 없는 pass-through
      },
      cleanup: () => {}
    };
  }
}
```

---

## 결론

MotionText Renderer의 플러그인 인증 시스템은 **다층 보안**을 통해 안전한 동적 코드 실행을 보장합니다:

1. **SHA-384 무결성 검증**으로 파일 변조 방지
2. **Ed25519 디지털 서명**으로 출처 인증
3. **샌드박스 격리**로 피해 범위 제한
4. **권한 기반 접근 제어**로 최소 권한 원칙 준수
5. **개발/프로덕션 모드 분리**로 개발 편의성과 보안성 양립

이러한 종합적인 보안 체계를 통해 플러그인 생태계의 신뢰성을 확보하고, 사용자와 개발자 모두에게 안전한 확장 환경을 제공합니다.