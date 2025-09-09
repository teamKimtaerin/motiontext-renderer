/**
 * AI 기반 자막 편집기 (클라이언트 MVP)
 * 브라우저에서 직접 Claude API를 호출하여 기존 자막을 자연어 요청으로 편집
 */

// Context 문서들을 인라인으로 포함 (간단한 MVP 구현)
const SYSTEM_CONTEXT = `
# MotionText Renderer 시스템 컨텍스트

당신은 MotionText Renderer v1.3의 자막 편집 전문가입니다.

## 핵심 개념
- JSON 스키마 v1.3 기반 시나리오 구조
- 절대 시간(absStart/absEnd)으로 요소 활성화 제어
- 플러그인 체인을 통한 애니메이션 효과 적용
- 정규화 좌표(0~1) 사용으로 모든 해상도 대응

## 플러그인 시스템
- 상대 시간 윈도우(relStartPct/relEndPct)로 타이밍 제어
- 합성 모드: replace(기본)/add(누적)/multiply(배수)
- 채널 기반 변환: tx/ty/sx/sy/rot/opacity

## 안전 규칙
- version, timebase, stage, tracks 메타데이터는 절대 변경 금지
- 기존 cue ID와 구조 유지
- absStart < absEnd 조건 준수
- 0~1 범위 정규화 좌표만 사용
`;

export interface EditResult {
  success: boolean;
  data?: any;
  error?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Claude API 클라이언트 (브라우저 직접 호출)
 */
export class ClaudeApiClient {
  private apiKey: string;
  private readonly baseUrl = 'https://api.anthropic.com/v1/messages';
  private readonly model = 'claude-3-sonnet-20240229';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async editSubtitle(currentJson: any, instruction: string): Promise<EditResult> {
    try {
      const prompt = this.buildPrompt(currentJson, instruction, SYSTEM_CONTEXT);
      
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4000,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `API Error ${response.status}: ${errorData.error?.message || response.statusText}`
        };
      }

      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      return {
        success: false,
        error: `Network Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private buildPrompt(currentJson: any, instruction: string, systemContext: string): string {
    // 사용 가능한 플러그인 목록
    const availablePlugins = [
      '내장 플러그인: fadeIn, fadeOut, pop, waveY, shakeX',
      '외부 플러그인: spin, bobY, pulse, flames, glow, glitch, elastic, magnetic, slideup, typewriter, cwi'
    ].join('\\n');

    return `${systemContext}

당신은 MotionText Renderer v1.3 자막 편집 전문가입니다.

현재 자막 시나리오:
\`\`\`json
${JSON.stringify(currentJson, null, 2)}
\`\`\`

편집 요청: "${instruction}"

편집 가능한 속성들:
1. 텍스트 내용 (text)
2. 시간 범위 (absStart, absEnd) 
3. 위치 (layout.position: {x: 0~1, y: 0~1})
4. 앵커 (layout.anchor: tl,tc,tr,cl,cc,cr,bl,bc,br)
5. 플러그인 효과 (pluginChain):
   ${availablePlugins}
6. 플러그인 매개변수 (params):
   - fadeIn/fadeOut: duration 등
   - pop: maxScale (기본 1.2)
   - waveY/bobY: amplitudePx, cycles
   - shakeX: amplitudePx, cycles
   - spin: fullTurns
   - pulse: maxScale, cycles
   - flames: baseOpacity, flicker, cycles
   - glow: color, intensity, pulse, cycles
7. 타이밍 (relStartPct, relEndPct: 0~1)
8. 합성 모드 (compose: "replace", "add", "multiply")
9. 스타일 (color, stroke, fontSizeRel)

편집 규칙:
1. JSON 스키마 v1.3 준수
2. version, timebase, stage, tracks 메타데이터 변경 금지
3. 요청된 부분만 선택적 수정
4. 기존 구조와 ID 유지
5. 올바른 타이밍 설정 (absStart < absEnd)
6. 정규화 좌표 사용 (0~1 범위)

응답 형식:
수정된 완전한 JSON을 \`\`\`json 블록 안에 반환하세요. 설명이나 주석 없이 JSON만 반환하세요.`;
  }

  private parseResponse(data: any): EditResult {
    try {
      const content = data.content?.[0]?.text;
      if (!content) {
        return { success: false, error: 'Claude API에서 빈 응답을 받았습니다.' };
      }

      // JSON 블록 추출
      const jsonMatch = content.match(/```json\\s*([\\s\\S]*?)\\s*```/);
      if (!jsonMatch) {
        return { success: false, error: '응답에서 JSON 블록을 찾을 수 없습니다.' };
      }

      const jsonStr = jsonMatch[1];
      const parsedJson = JSON.parse(jsonStr);

      // 기본 유효성 검증
      if (!parsedJson.version || !parsedJson.cues) {
        return { success: false, error: '잘못된 JSON 구조입니다.' };
      }

      return {
        success: true,
        data: parsedJson,
        usage: data.usage
      };
    } catch (error) {
      return {
        success: false,
        error: `응답 파싱 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

/**
 * AI 자막 편집기 메인 클래스
 */
export class AISubtitleEditor {
  private claudeApi: ClaudeApiClient | null = null;
  private originalConfig: any = null;
  private onConfigChange: (config: any) => void;

  constructor(onConfigChange: (config: any) => void) {
    this.onConfigChange = onConfigChange;
    this.loadApiKey();
  }

  /**
   * API 키 설정
   */
  setApiKey(apiKey: string): void {
    this.claudeApi = new ClaudeApiClient(apiKey);
    localStorage.setItem('claude-api-key', apiKey);
    this.updateStatus('API 키가 설정되었습니다');
    this.updateButtonState(true);
  }

  /**
   * API 키 로드
   */
  private loadApiKey(): void {
    const apiKey = localStorage.getItem('claude-api-key');
    if (apiKey) {
      this.claudeApi = new ClaudeApiClient(apiKey);
      this.updateStatus('준비됨');
      this.updateButtonState(true);
      
      // API 키 입력란에 마스킹된 키 표시
      const keyInput = document.getElementById('claude-api-key') as HTMLInputElement;
      if (keyInput) {
        keyInput.value = '●'.repeat(12) + apiKey.slice(-8);
      }
    }
  }

  /**
   * 현재 설정을 원본으로 저장
   */
  saveOriginalConfig(config: any): void {
    this.originalConfig = JSON.parse(JSON.stringify(config));
  }

  /**
   * 원본 설정으로 복원
   */
  restoreOriginal(): void {
    if (this.originalConfig) {
      this.onConfigChange(this.originalConfig);
      this.updateStatus('원본으로 복원되었습니다');
    }
  }

  /**
   * AI로 자막 편집
   */
  async applyEdit(instruction: string): Promise<void> {
    if (!this.claudeApi) {
      throw new Error('API 키가 설정되지 않았습니다');
    }

    if (!instruction.trim()) {
      throw new Error('편집 요청을 입력해주세요');
    }

    const currentConfig = this.getCurrentConfig();
    if (!currentConfig) {
      throw new Error('현재 설정을 불러올 수 없습니다');
    }

    this.showLoading(true);
    this.updateStatus('AI가 자막을 분석하고 편집중입니다...');

    try {
      const result = await this.claudeApi.editSubtitle(currentConfig, instruction);

      if (!result.success) {
        throw new Error(result.error);
      }

      // 편집된 설정 적용
      this.onConfigChange(result.data);
      
      const tokensUsed = result.usage ? 
        ` (토큰: ${result.usage.input_tokens + result.usage.output_tokens})` : '';
      this.updateStatus(`편집 완료${tokensUsed}`);

    } catch (error) {
      this.updateStatus(`편집 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      throw error;
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * 현재 설정 가져오기
   */
  private getCurrentConfig(): any {
    const editor = document.getElementById('config-editor') as HTMLTextAreaElement;
    if (!editor?.value) return null;
    
    try {
      return JSON.parse(editor.value);
    } catch {
      return null;
    }
  }

  /**
   * 로딩 상태 표시
   */
  private showLoading(show: boolean): void {
    const loading = document.getElementById('ai-loading');
    const result = document.getElementById('ai-result');
    
    if (loading && result) {
      if (show) {
        loading.style.display = 'inline';
        result.style.display = 'none';
      } else {
        loading.style.display = 'none';
        result.style.display = 'inline';
      }
    }
  }

  /**
   * 상태 메시지 업데이트
   */
  private updateStatus(message: string): void {
    const result = document.getElementById('ai-result');
    if (result) {
      result.textContent = message;
    }
  }

  /**
   * 편집 버튼 상태 업데이트
   */
  private updateButtonState(enabled: boolean): void {
    const button = document.getElementById('apply-ai-edit') as HTMLButtonElement;
    if (button) {
      button.disabled = !enabled;
    }
  }

  /**
   * API 키 유효성 확인
   */
  hasValidApiKey(): boolean {
    return !!this.claudeApi;
  }
}