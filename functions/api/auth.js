import { ensureUserTable, getAuthEnv, getSql, hashPassword, signToken, validateCredentials, verifyPassword } from './auth-utils.js';

export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'OPTIONS') return corsResponse(null, 204);
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const env = getAuthEnv(context);
    const sql = getSql(env);
    await ensureUserTable(sql);
    const { action = 'login', phone, password } = await readJson(request);
    const credentials = validateCredentials(phone, password);

    if (action === 'register') return register(sql, env, credentials);
    if (action === 'login') return login(sql, env, credentials);
    return jsonResponse({ error: '未知操作' }, 400);
  } catch (error) {
    return jsonResponse({ error: error.message || '请求失败' }, error.statusCode || 500);
  }
}

async function register(sql, env, { phone, password }) {
  try {
    const rows = await sql`
      INSERT INTO app_users (phone, password_hash)
      VALUES (${phone}, ${hashPassword(password)})
      RETURNING id, phone
    `;
    const user = rows[0];
    return jsonResponse({ token: signToken(user, env.AUTH_SECRET), user }, 201);
  } catch (error) {
    if (error.code === '23505') return jsonResponse({ error: '该手机号已注册' }, 409);
    throw error;
  }
}

async function login(sql, env, { phone, password }) {
  const rows = await sql`SELECT id, phone, password_hash FROM app_users WHERE phone = ${phone} LIMIT 1`;
  const user = rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    return jsonResponse({ error: '手机号或密码不正确' }, 401);
  }
  return jsonResponse({ token: signToken(user, env.AUTH_SECRET), user: { id: user.id, phone: user.phone } });
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
