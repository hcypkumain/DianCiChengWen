import https from 'node:https';
import { buildSystemPrompt, buildUserPrompt } from '../src/lib/prompt.js';
import { requireAuth } from './auth-utils.js';

const PROVIDER = process.env.AI_PROVIDER || 'dasein';
const API_KEY = process.env.AI_API_KEY || '';
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://www.daseinai.xyz/v1';
const AI_MODEL = process.env.AI_MODEL || 'gpt-5.4';
const TIMEOUT_MS = 55000;

const PROVIDER_CONFIG = {
  claude: { hostname: 'api.anthropic.com', path: '/v1/messages', model: 'claude-sonnet-4-6' },
  openai: { hostname: 'api.openai.com', path: '/v1/chat/completions', model: 'gpt-4o-mini' },
  deepseek: { hostname: 'api.deepseek.com', path: '/v1/chat/completions', model: 'deepseek-chat' },
  dasein: { hostname: 'www.daseinai.xyz', path: '/v1/chat/completions', model: 'gpt-5.4' },
  zhipu: { hostname: 'open.bigmodel.cn', path: '/api/paas/v4/chat/completions', model: 'glm-4-plus' },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!API_KEY) return res.status(500).json({ error: '未配置 AI_API_KEY' });
  const cfg = getProviderConfig();
  if (!cfg) return res.status(500).json({ error: `不支持的 provider: ${PROVIDER}` });

  try {
    requireAuth(req);
    const options = normalizeRequestBody(req.body);
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(options);
    const targetCount = options.wordCount === 'custom' ? options.customWordCount || 200 : options.wordCount || 200;
    const maxTokens = Math.min(Math.max(600, Number(targetCount) * 2), 1500);
    const effectiveCfg = options.model ? { ...cfg, model: options.model } : cfg;
    const text = PROVIDER === 'claude'
      ? await callClaude(effectiveCfg, systemPrompt, userPrompt, maxTokens)
      : await callOpenAICompat(effectiveCfg, systemPrompt, userPrompt, maxTokens);
    return res.status(200).json({ text: sanitizeOutputText(text) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || '生成失败，请重试' });
  }
}

function sanitizeOutputText(text) {
  if (!text) return '';
  return String(text)
    .normalize('NFC')
    .replace(/\uFEFF/g, '')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\uFFFD+/g, '')
    .trim();
}

function normalizeRequestBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

function getProviderConfig() {
  if (AI_BASE_URL) return buildOpenAICompatConfig(AI_BASE_URL, AI_MODEL || 'chatgpt-5.4');
  if (/^https?:\/\//.test(PROVIDER)) return buildOpenAICompatConfig(PROVIDER, AI_MODEL || 'chatgpt-5.4');
  const cfg = PROVIDER_CONFIG[PROVIDER];
  if (!cfg) return null;
  return AI_MODEL ? { ...cfg, model: AI_MODEL } : cfg;
}

function buildOpenAICompatConfig(baseUrl, model) {
  const url = new URL(baseUrl);
  const normalizedPath = url.pathname.replace(/\/$/, '');
  const path = normalizedPath.endsWith('/chat/completions')
    ? normalizedPath
    : `${normalizedPath || '/v1'}/chat/completions`;
  return { hostname: url.hostname, path, model };
}

function callClaude(cfg, systemPrompt, userPrompt, maxTokens) {
  const body = JSON.stringify({ model: cfg.model, max_tokens: maxTokens, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] });
  return request(cfg.hostname, cfg.path, {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    'anthropic-version': '2023-06-01',
    'Content-Length': Buffer.byteLength(body),
  }, body).then(({ status, parsed }) => {
    if (status >= 400) throw new Error(parsed.error?.message || JSON.stringify(parsed).slice(0, 200));
    if (parsed.content?.[0]?.text) return parsed.content[0].text;
    throw new Error('Claude返回格式异常');
  });
}

function callOpenAICompat(cfg, systemPrompt, userPrompt, maxTokens) {
  const thinking = PROVIDER === 'zhipu' && /z1|thinking|rumination|5\.|4\.6/.test(cfg.model);
  const isStrictCompat = PROVIDER === 'dasein' || Boolean(AI_BASE_URL) || /^https?:\/\//.test(PROVIDER);
  const payload = isStrictCompat ? {
    model: cfg.model,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    max_tokens: maxTokens,
  } : {
    model: cfg.model,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    ...(thinking ? { temperature: 1, max_completion_tokens: maxTokens } : { temperature: 0.7, top_p: 0.9, max_tokens: maxTokens }),
  };
  const body = JSON.stringify(payload);
  return request(cfg.hostname, cfg.path, {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
    'Content-Length': Buffer.byteLength(body),
  }, body).then(({ status, parsed }) => {
    if (status >= 400) throw new Error(extractApiError(parsed));
    const msg = parsed.choices?.[0]?.message;
    if (typeof msg?.content === 'string' && msg.content.trim()) return msg.content;
    if (typeof msg?.reasoning_content === 'string' && msg.reasoning_content.trim()) return msg.content?.trim() ? msg.content : msg.reasoning_content;
    if (Array.isArray(msg?.content)) {
      const block = msg.content.find((item) => item.type === 'text' && item.text?.trim());
      if (block) return block.text;
    }
    if (typeof parsed.choices?.[0]?.text === 'string' && parsed.choices[0].text.trim()) return parsed.choices[0].text;
    throw new Error(`${cfg.model} 返回格式无法识别`);
  });
}

function extractApiError(parsed) {
  const message = parsed?.error?.message || parsed?.message || parsed?.detail || parsed?.error;
  if (typeof message === 'string') return message;
  return JSON.stringify(parsed).slice(0, 500);
}

function request(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', timeout: TIMEOUT_MS, headers }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); });
      response.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        try {
          resolve({ status: response.statusCode, parsed: JSON.parse(data) });
        } catch {
          reject(new Error(`JSON解析失败: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    req.on('error', (error) => reject(new Error('网络错误: ' + error.message)));
    req.write(body);
    req.end();
  });
}
