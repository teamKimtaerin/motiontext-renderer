/**
 * Claude API 프록시 서버
 * CORS 문제 해결을 위한 간단한 프록시
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const port = 3002;

// 로그 저장 함수
function saveResponse(request, response, error = null) {
  try {
    const timestamp = new Date().toISOString();
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const outputDir = path.join(process.cwd(), 'output');
    const logFile = path.join(outputDir, `claude_responses_${date}.txt`);
    
    // output 디렉토리가 없으면 생성
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    let logEntry = `\n${'='.repeat(80)}\n`;
    logEntry += `🕐 시간: ${timestamp}\n`;
    logEntry += `📝 모델: ${request.model || 'unknown'}\n`;
    
    // 요청 정보
    if (request.messages && request.messages[0]) {
      const content = request.messages[0].content;
      const contentPreview = content.length > 500 ? content.substring(0, 500) + '...' : content;
      logEntry += `📤 요청 길이: ${content.length}자\n`;
      logEntry += `📤 요청 미리보기:\n${contentPreview}\n\n`;
    }
    
    // 토큰 정보
    if (request.max_tokens) {
      logEntry += `🎯 최대 출력 토큰: ${request.max_tokens}\n`;
    }
    
    // 응답 정보
    if (error) {
      logEntry += `❌ 오류: ${error}\n`;
    } else if (response) {
      const content = response.content?.[0]?.text || '';
      const contentPreview = content.length > 1000 ? content.substring(0, 1000) + '...' : content;
      
      logEntry += `✅ 응답 성공\n`;
      logEntry += `📥 응답 길이: ${content.length}자\n`;
      
      if (response.usage) {
        logEntry += `🔢 토큰 사용량:\n`;
        logEntry += `  - 입력: ${response.usage.input_tokens || 0}\n`;
        logEntry += `  - 출력: ${response.usage.output_tokens || 0}\n`;
        logEntry += `  - 총합: ${(response.usage.input_tokens || 0) + (response.usage.output_tokens || 0)}\n`;
      }
      
      logEntry += `📥 응답 미리보기:\n${contentPreview}\n`;
      
      // JSON 블록 추출 시도
      const jsonMatch = content.match(/```(?:json)?[\s\r\n]*([\s\S]*?)[\s\r\n]*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          logEntry += `✅ JSON 파싱 성공 (${jsonMatch[1].length}자)\n`;
          if (parsed.cues) {
            logEntry += `📊 수정된 Cue 개수: ${parsed.cues.length}\n`;
          }
        } catch (e) {
          logEntry += `❌ JSON 파싱 실패: ${e.message}\n`;
        }
      }
    }
    
    logEntry += `${'='.repeat(80)}\n`;
    
    // 파일에 append
    fs.appendFileSync(logFile, logEntry, 'utf8');
    console.log(`📝 응답 로그 저장됨: ${logFile}`);
    
  } catch (err) {
    console.error('로그 저장 실패:', err);
  }
}

// CORS 허용
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Claude API 프록시
app.post('/proxy/claude', async (req, res) => {
  try {
    const { apiKey, payload, additionalHeaders } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key required' });
    }

    // Base headers
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    };

    // Add extended headers for large JSON support
    if (additionalHeaders) {
      Object.assign(headers, additionalHeaders);
    }

    // Claude API 대용량 요청을 위한 긴 타임아웃 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2분 타임아웃
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
      // Node.js fetch 타임아웃 설정
      timeout: 120000 // 2분
    });
    
    clearTimeout(timeoutId);

    const data = await response.json();
    
    if (!response.ok) {
      // 오류 응답도 로깅
      saveResponse(payload, null, `HTTP ${response.status}: ${data.error?.message || response.statusText}`);
      return res.status(response.status).json(data);
    }

    // 성공 응답 로깅
    saveResponse(payload, data);
    res.json(data);
  } catch (error) {
    console.error('🔥 프록시 오류:', error.message);
    
    // 상세한 에러 정보 제공
    let errorMessage = 'Proxy server error';
    let statusCode = 500;
    
    if (error.name === 'AbortError' || error.code === 'UND_ERR_HEADERS_TIMEOUT') {
      errorMessage = 'Claude API timeout - 요청이 너무 크거나 복잡합니다. 더 작은 단위로 나누어 시도해보세요.';
      statusCode = 408; // Request Timeout
      console.error('⏰ 타임아웃: 2분 초과, 요청 크기를 줄여야 합니다.');
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Claude API connection refused';
      statusCode = 502; // Bad Gateway
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Claude API not found - 네트워크 연결을 확인해주세요';
      statusCode = 503; // Service Unavailable
    }
    
    // 에러도 로깅
    saveResponse(req.body?.payload || {}, null, `${errorMessage}: ${error.message}`);
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(port, () => {
  console.log(`🔄 Claude API 프록시 서버가 http://localhost:${port} 에서 실행중입니다.`);
  console.log(`⏰ 시작 시간: ${new Date().toLocaleString()}`);
  console.log(`🔍 상태 확인: curl http://localhost:${port}/proxy/claude`);
  console.log(`🛑 종료하려면: Ctrl+C`);
  
  // 주기적 상태 로그 (선택적)
  setInterval(() => {
    console.log(`💚 서버 활성 상태 - ${new Date().toLocaleTimeString()}`);
  }, 30000); // 30초마다
});