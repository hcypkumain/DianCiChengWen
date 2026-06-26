import { buildSystemPrompt, buildUserPrompt } from '../../src/lib/prompt.js';
import { getAuthEnv, requireAuth } from './auth-utils.js';

const DEFAULT_BASE_URL = 'https://www.daseinai.xyz/v1';
const DEFAULT_PROVIDER = 'dasein';
const DEFAULT_MODEL = 'gpt-5.4';

export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'OPTIONS') return corsResponse(null, 204);
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const env = getEnv(context);
  const apiKey = env.AI_API_KEY || '';
  if (!apiKey) return jsonResponse({ error: '未配置 AI_API_KEY' }, 500);

  try {
    requireAuth(request, getAuthEnv(context));
    const options = await readJson(request);
    const cfg = getProviderConfig(env, options);
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(options);
    const targetCount = options.wordCount === 'custom' ? options.customWordCount || 200 : options.wordCount || 200;
    const maxTokens = Math.min(Math.max(600, Number(targetCount) * 2), 1500);
    const text = await callOpenAICompat(cfg, apiKey, systemPrompt, userPrompt, maxTokens);
    return jsonResponse({ text: sanitizeOutputText(text) });
  } catch (error) {
    return jsonResponse({ error: error.message || '生成失败，请重试' }, error.statusCode || 500);
  }
}

function getEnv(context) {
  return {
    AI_API_KEY: context.env?.AI_API_KEY || globalThis.process?.env?.AI_API_KEY || '',
    AI_PROVIDER: context.env?.AI_PROVIDER || globalThis.process?.env?.AI_PROVIDER || DEFAULT_PROVIDER,
    AI_BASE_URL: context.env?.AI_BASE_URL || globalThis.process?.env?.AI_BASE_URL || DEFAULT_BASE_URL,
    AI_MODEL: context.env?.AI_MODEL || globalThis.process?.env?.AI_MODEL || DEFAULT_MODEL,
  };
}

async function readJson(request) {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function getProviderConfig(env, options) {
  const provider = env.AI_PROVIDER || DEFAULT_PROVIDER;
  const baseUrl = env.AI_BASE_URL || (/^https?:\/\//.test(provider) ? provider : DEFAULT_BASE_URL);
  const model = options.model || env.AI_MODEL || DEFAULT_MODEL;
  return buildOpenAICompatConfig(baseUrl, model);
}

function buildOpenAICompatConfig(baseUrl, model) {
  const url = new URL(baseUrl);
  const normalizedPath = url.pathname.replace(/\/$/, '');
  const path = normalizedPath.endsWith('/chat/completions')
    ? normalizedPath
    : `${normalizedPath || '/v1'}/chat/completions`;
  return { url: `${url.origin}${path}`, model };
}

async function callOpenAICompat(cfg, apiKey, systemPrompt, userPrompt, maxTokens) {
  const response = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
    }),
  });

  const rawText = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(`JSON解析失败: ${rawText.slice(0, 200)}`);
  }

  if (!response.ok) throw new Error(extractApiError(parsed));
  const msg = parsed.choices?.[0]?.message;
  if (typeof msg?.content === 'string' && msg.content.trim()) return msg.content;
  if (typeof msg?.reasoning_content === 'string' && msg.reasoning_content.trim()) return msg.content?.trim() ? msg.content : msg.reasoning_content;
  if (Array.isArray(msg?.content)) {
    const block = msg.content.find((item) => item.type === 'text' && item.text?.trim());
    if (block) return block.text;
  }
  if (typeof parsed.choices?.[0]?.text === 'string' && parsed.choices[0].text.trim()) return parsed.choices[0].text;
  throw new Error(`${cfg.model} 返回格式无法识别`);
}

function extractApiError(parsed) {
  const message = parsed?.error?.message || parsed?.message || parsed?.detail || parsed?.error;
  if (typeof message === 'string') return message;
  return JSON.stringify(parsed).slice(0, 500);
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

function jsonResponse(data, status = 200) {
  return corsResponse(JSON.stringify(data), status, { 'Content-Type': 'application/json; charset=utf-8' });
}

function corsResponse(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...headers,
    },
  });
}
