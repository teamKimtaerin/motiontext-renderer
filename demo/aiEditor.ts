/**
 * AI 기반 자막 편집기 (클라이언트 MVP)
 * 브라우저에서 직접 Claude API를 호출하여 기존 자막을 자연어 요청으로 편집
 */

// 축소된 시스템 컨텍스트 (Rate Limit 방지)
const SYSTEM_CONTEXT = `
자막 JSON 편집 전문가입니다.

규칙:
- version, timebase, stage, tracks 절대 변경 금지
- 기존 ID와 구조 유지
- absStart < absEnd 준수
- 좌표는 0~1 범위만 사용

플러그인: fadeIn, fadeOut, pop, waveY, shakeX, spin, pulse, flames, glow
타이밍: relStartPct/relEndPct (0~1)
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
  private readonly proxyUrl = 'http://localhost:3002/proxy/claude';
  private readonly model = 'claude-sonnet-4-20250514'; // Claude Sonnet 4 with 1M context window beta

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async editSubtitle(currentJson: any, instruction: string): Promise<EditResult> {
    const jsonSize = JSON.stringify(currentJson).length;
    
    // 큰 파일(100KB+)은 diff 방식으로 처리
    if (jsonSize > 100000) {
      return this.editSubtitleWithDiff(currentJson, instruction);
    }
    try {
      const prompt = this.buildPrompt(currentJson, instruction, SYSTEM_CONTEXT);
      
      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: this.apiKey,
          payload: {
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 32768, // Large output for complex JSON files
            temperature: 0.1,
            stream: false // Disable streaming for JSON parsing reliability
          },
          // Extended output headers for large JSON handling
          additionalHeaders: {
            'anthropic-beta': 'output-128k-2025-02-19'
          }
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
    const jsonSize = JSON.stringify(currentJson).length;
    
    // For large JSON files (>50KB), use compression strategy
    if (jsonSize > 50000) {
      return this.buildLargeJsonPrompt(currentJson, instruction, systemContext);
    }
    
    return `${systemContext}

현재 JSON:
\`\`\`json
${JSON.stringify(currentJson, null, 2)}
\`\`\`

요청: "${instruction}"

IMPORTANT: 수정된 전체 JSON을 반드시 \`\`\`json 블록으로 감싸서 반환하세요.

\`\`\`json
{
  "version": "1.3",
  ...
}
\`\`\``;
  }

  private parseResponse(data: any): EditResult {
    try {
      const content = data.content?.[0]?.text;
      if (!content) {
        return { success: false, error: 'Claude API에서 빈 응답을 받았습니다.' };
      }

      // JSON 블록 추출 - 여러 방법 시도
      let jsonStr = this.extractJsonFromContent(content);
      
      if (!jsonStr) {
        // 디버깅을 위해 응답의 시작과 끝 부분을 확인
        const start = content.substring(0, 1000);
        const end = content.substring(Math.max(0, content.length - 1000));
        console.error('Claude 응답 시작부분:', start);
        console.error('Claude 응답 끝부분:', end);
        console.error('```json 포함 여부:', content.includes('```json'));
        console.error('```포함 여부:', content.includes('```'));
        console.error('{ 위치:', content.indexOf('{'));
        console.error('} 마지막 위치:', content.lastIndexOf('}'));
        
        return { success: false, error: `응답에서 JSON 블록을 찾을 수 없습니다. 응답 길이: ${content.length}자. 콘솔을 확인하세요.` };
      }

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

  /**
   * 다양한 방법으로 JSON 추출 시도
   */
  private extractJsonFromContent(content: string): string | null {
    // 방법 1: 기본 JSON 코드 블록
    let jsonMatch = content.match(/```(?:json)?[\s\r\n]*([\s\S]*?)[\s\r\n]*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        JSON.parse(jsonMatch[1]);
        return jsonMatch[1];
      } catch (e) {
        // 파싱 실패하면 다른 방법 시도
      }
    }

    // 방법 2: 첫 번째 { 부터 마지막 } 까지
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
      const potentialJson = content.substring(firstBrace, lastBrace + 1);
      try {
        JSON.parse(potentialJson);
        return potentialJson;
      } catch (e) {
        // 파싱 실패
      }
    }

    // 방법 3: ```json 이후부터 문서 끝까지 (잘린 응답 처리)
    const jsonStart = content.indexOf('```json');
    if (jsonStart !== -1) {
      const afterJsonStart = content.substring(jsonStart + 7);
      const firstBraceAfter = afterJsonStart.indexOf('{');
      if (firstBraceAfter !== -1) {
        const potentialJson = afterJsonStart.substring(firstBraceAfter);
        // 마지막 }로 끝나는지 확인하고, 없으면 추가
        const lastBraceInContent = potentialJson.lastIndexOf('}');
        if (lastBraceInContent !== -1) {
          try {
            const jsonToParse = potentialJson.substring(0, lastBraceInContent + 1);
            JSON.parse(jsonToParse);
            return jsonToParse;
          } catch (e) {
            // 파싱 실패
          }
        }
      }
    }

    return null;
  }

  /**
   * 대용량 JSON 파일을 위한 최적화된 프롬프트 생성
   */
  private buildLargeJsonPrompt(currentJson: any, instruction: string, systemContext: string): string {
    // JSON 구조 요약 생성
    const summary = this.createJsonSummary(currentJson);
    
    return `${systemContext}

대용량 JSON 편집 요청:

구조 요약:
${summary}

전체 JSON (1M 컨텍스트 활용):
\`\`\`json
${JSON.stringify(currentJson, null, 2)}
\`\`\`

편집 요청: "${instruction}"

응답 형식:
1. 변경사항 설명 (간략히)
2. 수정된 전체 JSON (\`\`\`json 블록 사용)

IMPORTANT: 반드시 완전한 JSON을 반환하세요.`;
  }

  /**
   * JSON 구조 요약 생성 (큰 파일 처리용)
   */
  private createJsonSummary(json: any): string {
    const summary = {
      version: json.version,
      tracks: json.tracks?.length || 0,
      cues: json.cues?.length || 0,
      totalElements: 0
    };

    // 각 cue의 요소 개수 계산
    if (json.cues) {
      json.cues.forEach((cue: any) => {
        if (cue.root?.children) {
          summary.totalElements += cue.root.children.length;
        } else if (cue.root?.e_type) {
          summary.totalElements += 1;
        }
      });
    }

    return `- Tracks: ${summary.tracks}개
- Cues: ${summary.cues}개
- 총 텍스트 요소: ${summary.totalElements}개
- 파일 크기: ${(JSON.stringify(json).length / 1024).toFixed(1)}KB`;
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
   * AI로 자막 편집 (대용량 파일 지원)
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
    
    const jsonSize = JSON.stringify(currentConfig).length;
    if (jsonSize > 100000) { // 100KB+
      this.updateStatus(`대용량 JSON 파일 처리중... (${(jsonSize/1024).toFixed(1)}KB)`);
    } else {
      this.updateStatus('AI가 자막을 분석하고 편집중입니다...');
    }

    try {
      const result = await this.claudeApi.editSubtitle(currentConfig, instruction);

      if (!result.success) {
        throw new Error(result.error);
      }

      // 편집된 설정 자동 적용
      this.updateStatus('편집 결과를 적용하고 있습니다...');
      this.onConfigChange(result.data);
      
      const tokensUsed = result.usage ? 
        ` (토큰: ${result.usage.input_tokens + result.usage.output_tokens})` : '';
      
      // 성공 알림
      this.updateStatus(`✅ 편집 완료 및 자동 적용${tokensUsed}`);
      this.showSuccessNotification(`AI 편집이 완료되어 자동으로 적용되었습니다!${tokensUsed}`);

    } catch (error) {
      this.updateStatus(`편집 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      this.showErrorNotification(`편집 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
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
   * 성공 알림 표시
   */
  private showSuccessNotification(message: string): void {
    // 간단한 브라우저 알림
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('MotionText AI Editor', {
        body: message,
        icon: '🎬'
      });
    }
    
    // 시각적 알림 (임시 메시지)
    this.showTemporaryMessage(message, 'success');
  }

  /**
   * 에러 알림 표시
   */
  private showErrorNotification(message: string): void {
    // 시각적 알림
    this.showTemporaryMessage(message, 'error');
  }

  /**
   * 임시 메시지 표시
   */
  private showTemporaryMessage(message: string, type: 'success' | 'error'): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: bold;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      animation: slideIn 0.3s ease-out;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // 5초 후 자동 제거
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);
    
    // CSS 애니메이션 추가
    if (!document.querySelector('#ai-notification-styles')) {
      const style = document.createElement('style');
      style.id = 'ai-notification-styles';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * API 키 유효성 확인
   */
  hasValidApiKey(): boolean {
    return !!this.claudeApi;
  }
}