/**
 * AI 기반 자막 편집기 (클라이언트 MVP)
 * 브라우저에서 직접 Claude API를 호출하여 기존 자막을 자연어 요청으로 편집
 */

// 상세하고 안전한 시스템 컨텍스트 (안정성 우선)
const SYSTEM_CONTEXT = `
당신은 MotionText Renderer v1.3 JSON 스키마를 전문으로 다루는 자막 편집 전문가입니다.

⚠️ 중요한 규칙들 (절대 위반 금지):
1. version, timebase, stage, tracks 섹션은 절대로 변경하지 마세요
2. 모든 기존 ID값들을 정확히 유지하세요 (cue.id, track id 등)
3. absStart < absEnd 조건을 반드시 지켜주세요
4. 모든 좌표값은 0~1 사이 정규화된 값만 사용하세요
5. 기존 JSON 구조와 중첩 레벨을 정확히 유지하세요

🎭 사용 가능한 플러그인들:
- fadeIn, fadeOut: 투명도 애니메이션
- pop: 스케일 효과 (backOut 이징)
- waveY, shakeX: 움직임 효과
- spin, pulse: 회전 및 박동 효과
- flames, glow: 시각적 효과

📊 플러그인 타이밍 설정:
- relStartPct, relEndPct: 0~1 사이 값 (상대적 시간)
- relStart, relEnd: 초 단위 시간 (절대적 시간)

💡 편집 원칙:
- 사용자 요청을 정확히 이해하고 적절한 플러그인 적용
- 기존 스타일과 조화로운 변경
- JSON 형식과 구문을 완벽하게 유지
`;

// 안전 모드: 기본 프롬프트도 더 상세하게
const SAFE_MODE_CONTEXT = `
⚠️ 안전 모드 활성화 ⚠️

다음 JSON을 매우 신중하게 편집해주세요:
- 기존 구조를 완전히 보존
- ID 값들 절대 변경 금지  
- 문법 오류 없이 유효한 JSON 반환
- 요청사항만 최소한으로 적용
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
    
    // 중대형 파일(50KB+)에서 diff 방식 사용 (안정성 우선)
    if (jsonSize > 50000) {
      console.log(`🛡️ 파일 크기 ${(jsonSize/1024).toFixed(1)}KB > 50KB, 안전한 Diff 모드 사용`);
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

  /**
   * Diff 기반 대용량 JSON 파일 편집 (100KB+)
   * Claude Sonnet 4의 1M 컨텍스트와 128K 출력을 활용한 최적화된 접근
   */
  async editSubtitleWithDiff(currentJson: any, instruction: string): Promise<EditResult> {
    try {
      const jsonSize = JSON.stringify(currentJson).length;
      console.log(`🛡️ 안전한 Diff 모드 시작: ${(jsonSize/1024).toFixed(1)}KB 파일 처리`);
      
      // 1단계: 분석 및 변경 계획 수립
      const analysisResult = await this.analyzeLargeJsonAndPlan(currentJson, instruction);
      
      if (!analysisResult.success) {
        console.warn(`⚠️ 분석 실패, 안전 모드로 폴백 시도`);
        return this.fallbackToSafeMode(currentJson, instruction);
      }
      
      console.log(`📋 변경 계획 수립 완료:`, analysisResult.plan);
      
      // 2단계: 계획에 따른 실제 diff 적용
      const diffResult = await this.applyDiffBasedOnPlan(currentJson, analysisResult.plan, instruction);
      
      if (!diffResult.success) {
        console.warn(`⚠️ Diff 적용 실패, 안전 모드로 폴백 시도`);
        return this.fallbackToSafeMode(currentJson, instruction);
      }
      
      return diffResult;
      
    } catch (error) {
      console.error(`🚨 Diff 처리 중 예외 발생, 안전 모드로 폴백:`, error);
      return this.fallbackToSafeMode(currentJson, instruction);
    }
  }

  /**
   * 1단계: 대용량 JSON 분석 및 변경 계획 수립
   */
  private async analyzeLargeJsonAndPlan(currentJson: any, instruction: string): Promise<EditResult & { plan?: any }> {
    const summary = this.createJsonSummary(currentJson);
    const sampleCues = currentJson.cues?.slice(0, 3) || []; // 처음 3개 cue만 샘플로
    
    const analysisPrompt = `${SYSTEM_CONTEXT}

🔍 대용량 JSON 분석 및 편집 계획 수립

파일 정보:
${summary}

샘플 구조 (처음 3개 cue):
\`\`\`json
{
  "version": "${currentJson.version}",
  "timebase": ${JSON.stringify(currentJson.timebase, null, 2)},
  "stage": ${JSON.stringify(currentJson.stage, null, 2)},
  "tracks": ${JSON.stringify(currentJson.tracks, null, 2)},
  "cues": ${JSON.stringify(sampleCues, null, 2)}
}
\`\`\`

편집 요청: "${instruction}"

**임무**: 이 요청을 효율적으로 처리할 상세 계획을 수립하세요.

응답 형식:
\`\`\`json
{
  "analysis": "파일 구조와 요청 분석",
  "strategy": "적용할 전략 (전체/부분/선택적)",
  "targets": ["영향받을 요소들 (예: cue 인덱스, 플러그인, 스타일)"],
  "changes": [
    {
      "type": "plugin_add|text_modify|style_change",
      "target": "적용 대상 (all_cues|specific_range|condition)",
      "details": "구체적 변경 내용",
      "example": "변경 예시"
    }
  ],
  "estimatedImpact": "예상 영향도 (low|medium|high)"
}
\`\`\``;

    const response = await fetch(this.proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        apiKey: this.apiKey,
        payload: {
          model: this.model,
          messages: [{ role: 'user', content: analysisPrompt }],
          max_tokens: 4096, // 계획 수립용 중간 크기
          temperature: 0.1,
          stream: false
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `분석 단계 실패 ${response.status}: ${errorData.error?.message || response.statusText}`
      };
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;
    
    if (!content) {
      return { success: false, error: '분석 응답이 비어있습니다.' };
    }

    // JSON 계획 추출
    const jsonMatch = content.match(/```(?:json)?[\s\r\n]*([\s\S]*?)[\s\r\n]*```/);
    if (!jsonMatch || !jsonMatch[1]) {
      return { success: false, error: '분석 결과에서 계획을 추출할 수 없습니다.' };
    }

    try {
      const plan = JSON.parse(jsonMatch[1]);
      return {
        success: true,
        plan,
        usage: data.usage
      };
    } catch (error) {
      return {
        success: false,
        error: `계획 파싱 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 2단계: 계획 기반 Diff 적용
   */
  private async applyDiffBasedOnPlan(currentJson: any, plan: any, instruction: string): Promise<EditResult> {
    const summary = this.createJsonSummary(currentJson);
    
    // 전략에 따른 처리 방식 결정 (안정성 우선: 선택적 처리를 기본으로)
    if (plan.estimatedImpact === 'high' && plan.strategy === 'full') {
      // 전체 처리: 1M 컨텍스트 활용 (확실히 필요한 경우만)
      console.log('🛡️ 전체 Diff 선택 - 대규모 변경 (안전 모드)');
      return this.applyFullJsonDiff(currentJson, plan, instruction, summary);
    } else {
      // 선택적 처리: 기본 전략 (안정성 우선)
      console.log('🎯 선택적 Diff 선택 - 안정성 우선');
      return this.applySelectiveDiff(currentJson, plan, instruction, summary);
    }
  }

  /**
   * 선택적 Diff 적용 (효율적)
   */
  private async applySelectiveDiff(currentJson: any, plan: any, instruction: string, summary: string): Promise<EditResult> {
    console.log('🎯 선택적 Diff 적용 모드');
    
    // 변경이 필요한 부분만 추출
    const relevantParts = this.extractRelevantParts(currentJson, plan);
    
    const selectivePrompt = `${SYSTEM_CONTEXT}

🎯 선택적 편집 모드 (효율 최적화)

파일 정보: ${summary}

변경 계획:
${JSON.stringify(plan, null, 2)}

관련 부분만 추출된 JSON:
\`\`\`json
${JSON.stringify(relevantParts, null, 2)}
\`\`\`

편집 요청: "${instruction}"

**중요**: 위 계획에 따라 관련 부분만 수정하고, 전체 JSON 구조를 유지하여 반환하세요.

완전한 수정된 JSON:
\`\`\`json
{수정된 전체 JSON}
\`\`\``;

    return this.executePromptWithLargeOutput(selectivePrompt);
  }

  /**
   * 전체 JSON Diff 적용 (1M 컨텍스트 활용)
   */
  private async applyFullJsonDiff(currentJson: any, plan: any, instruction: string, summary: string): Promise<EditResult> {
    console.log('🚀 전체 JSON Diff 적용 모드 (1M 컨텍스트)');
    
    const fullPrompt = `${SYSTEM_CONTEXT}

🚀 전체 JSON 편집 모드 (1M 컨텍스트 + 128K 출력)

파일 정보: ${summary}

변경 계획:
${JSON.stringify(plan, null, 2)}

전체 JSON (1M 컨텍스트 활용):
\`\`\`json
${JSON.stringify(currentJson, null, 2)}
\`\`\`

편집 요청: "${instruction}"

**지침**:
1. 위 계획을 정확히 따라 편집
2. 모든 기존 구조와 ID 유지
3. version, timebase, stage, tracks 절대 변경 금지
4. 128K 출력 한도 내에서 완전한 JSON 반환

완전히 수정된 JSON:
\`\`\`json
{수정된 전체 JSON - 128K 출력 활용}
\`\`\``;

    return this.executePromptWithLargeOutput(fullPrompt);
  }

  /**
   * 대용량 출력을 위한 프롬프트 실행
   */
  private async executePromptWithLargeOutput(prompt: string): Promise<EditResult> {
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
          max_tokens: 32768, // 128K 출력 대비 32K로 안전 설정
          temperature: 0.1,
          stream: false
        },
        // 128K 출력 지원 헤더
        additionalHeaders: {
          'anthropic-beta': 'output-128k-2025-02-19'
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `Diff 적용 실패 ${response.status}: ${errorData.error?.message || response.statusText}`
      };
    }

    const data = await response.json();
    return this.parseResponse(data);
  }

  /**
   * 계획에 따라 관련 부분 추출
   */
  private extractRelevantParts(currentJson: any, plan: any): any {
    const result = {
      version: currentJson.version,
      timebase: currentJson.timebase,
      stage: currentJson.stage,
      tracks: currentJson.tracks,
      cues: []
    };

    // 계획의 targets에 따라 관련 cue들 추출 (안정성 우선: 더 많이 처리)
    if (plan.targets?.includes('all_cues')) {
      // 안정성 우선: 전체 요청은 5개씩 처리
      result.cues = currentJson.cues?.slice(0, 5) || [];
      console.log(`🛡️ 안정성 모드: 전체 ${currentJson.cues?.length}개 중 첫 5개 처리`);
    } else {
      // 선택적 요청: 3개씩 처리
      result.cues = currentJson.cues?.slice(0, 3) || [];
      console.log(`📝 선택적 모드: 첫 3개 cue 처리 (안전한 청크)`);
    }

    return result;
  }

  /**
   * 안전 모드: Diff 실패 시 폴백 전략
   * 가장 작은 단위로 안전하게 처리
   */
  private async fallbackToSafeMode(currentJson: any, instruction: string): Promise<EditResult> {
    console.log(`🆘 안전 모드 활성화: 최소 단위로 안전하게 처리`);
    
    try {
      // 첫 번째 cue만 추출해서 안전하게 처리
      const safeJson = {
        version: currentJson.version,
        timebase: currentJson.timebase,
        stage: currentJson.stage,
        tracks: currentJson.tracks,
        cues: currentJson.cues?.slice(0, 1) || [] // 가장 안전한 1개만
      };
      
      const safePrompt = `${SAFE_MODE_CONTEXT}

현재 JSON:
\`\`\`json
${JSON.stringify(safeJson, null, 2)}
\`\`\`

편집 요청: "${instruction}"

⚠️ 중요 지침:
1. 위 JSON 구조를 정확히 유지하세요
2. ID, version, timebase, stage, tracks는 절대 변경 금지
3. 요청사항을 최소한으로만 적용하세요
4. 완전한 유효한 JSON으로 응답하세요

수정된 완전한 JSON:
\`\`\`json
{
  "version": "1.3",
  "timebase": ...,
  "stage": ...,
  "tracks": ...,
  "cues": [...]
}
\`\`\``;

      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: this.apiKey,
          payload: {
            model: this.model,
            messages: [{ role: 'user', content: safePrompt }],
            max_tokens: 8192, // 더 여유있게
            temperature: 0.1, // 더 보수적으로
            stream: false
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `안전 모드도 실패 ${response.status}: ${errorData.error?.message || response.statusText}`
        };
      }

      const data = await response.json();
      const result = this.parseResponse(data);
      
      if (result.success) {
        console.log(`✅ 안전 모드 성공: 1개 cue 처리 완료`);
        
        // 원본 JSON에 안전하게 병합
        if (result.data?.cues?.[0]) {
          const mergedJson = JSON.parse(JSON.stringify(currentJson));
          mergedJson.cues[0] = result.data.cues[0];
          result.data = mergedJson;
        }
      }
      
      return result;
      
    } catch (error) {
      return {
        success: false,
        error: `안전 모드 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
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
   * 서버 연결 초기화
   */
  initializeClient(): void {
    this.claudeApi = new ClaudeApiClient();
    this.updateStatus('준비됨 (환경변수 API 키 사용)');
    this.updateButtonState(true);
  }

  /**
   * 클라이언트 초기화 로드
   */
  private loadApiKey(): void {
    // 환경변수에서 API 키를 읽는 방식으로 변경
    this.initializeClient();
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