import { getAuthEnv, getAuthKV, hashPassword, signToken, userKey, validateCredentials, verifyPassword } from './auth-utils.js';

export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'OPTIONS') return corsResponse(null, 204);
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const env = getAuthEnv(context);
    const kv = getAuthKV(context, env);
    const { action = 'login', phone, password } = await readJson(request);
    const credentials = validateCredentials(phone, password);

    if (action === 'register') return register(kv, env, credentials);
    if (action === 'login') return login(kv, env, credentials);
    return jsonResponse({ error: '未知操作' }, 400);
  } catch (error) {
    return jsonResponse({ error: error.message || '请求失败' }, error.statusCode || 500);
  }
}

async function register(kv, env, { phone, password }) {
  const key = await userKey(phone);
  const existing = await readUser(kv, key);
  if (existing) return jsonResponse({ error: '该手机号已注册' }, 409);

  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    phone,
    passwordHash: await hashPassword(password),
    createdAt: now,
    updatedAt: now,
  };
  await writeUser(kv, key, user);
  return jsonResponse({ token: await signToken(user, env.AUTH_SECRET), user: publicUser(user) }, 201);
}

async function login(kv, env, { phone, password }) {
  const user = await readUser(kv, await userKey(phone));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return jsonResponse({ error: '手机号或密码不正确' }, 401);
  }
  return jsonResponse({ token: await signToken(user, env.AUTH_SECRET), user: publicUser(user) });
}

async function readUser(kv, key) {
  const value = await kv.get(key);
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function writeUser(kv, key, user) {
  await kv.put(key, JSON.stringify(user));
}

function publicUser(user) {
  return { id: user.id, phone: user.phone };
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
