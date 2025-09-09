/**
 * Claude API 프록시 서버
 * CORS 문제 해결을 위한 간단한 프록시
 */

import express from 'express';
import cors from 'cors';

const app = express();
const port = 3002;

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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('프록시 오류:', error);
    res.status(500).json({ error: 'Proxy server error' });
  }
});

app.listen(port, () => {
  console.log(`🔄 Claude API 프록시 서버가 http://localhost:${port} 에서 실행중입니다.`);
});