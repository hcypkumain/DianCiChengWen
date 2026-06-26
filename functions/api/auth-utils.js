import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
let sqlClient;
let schemaReady;

export function getAuthEnv(context = {}) {
  return {
    DATABASE_URL: context.env?.DATABASE_URL || context.env?.POSTGRES_URL || globalThis.process?.env?.DATABASE_URL || globalThis.process?.env?.POSTGRES_URL || '',
    AUTH_SECRET: context.env?.AUTH_SECRET || context.env?.JWT_SECRET || globalThis.process?.env?.AUTH_SECRET || globalThis.process?.env?.JWT_SECRET || context.env?.DATABASE_URL || 'local-dev-auth-secret',
  };
}

export function getSql(env) {
  if (!env.DATABASE_URL) throw new Error('未配置 DATABASE_URL');
  if (!sqlClient) sqlClient = neon(env.DATABASE_URL);
  return sqlClient;
}

export async function ensureUserTable(sql) {
  if (!schemaReady) {
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS app_users (
        id BIGSERIAL PRIMARY KEY,
        phone TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  }
  await schemaReady;
}

export function validateCredentials(phone, password) {
  const normalizedPhone = String(phone || '').trim().replace(/[\s-]/g, '');
  if (!/^\+?\d{6,20}$/.test(normalizedPhone)) throw new Error('请输入有效手机号');
  if (String(password || '').length < 6) throw new Error('密码至少需要 6 位');
  return { phone: normalizedPhone, password: String(password) };
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [salt, hash] = String(storedHash || '').split(':');
  if (!salt || !hash) return false;
  const actual = Buffer.from(hash, 'hex');
  const expected = scryptSync(password, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function signToken(user, secret) {
  const payload = { uid: user.id, phone: user.phone, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifyToken(token, secret) {
  const [encodedPayload, signature] = String(token || '').split('.');
  if (!encodedPayload || !signature) return null;
  const expected = createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload.uid || !payload.phone || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAuth(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  const user = verifyToken(token, env.AUTH_SECRET);
  if (!user) {
    const error = new Error('请先登录');
    error.statusCode = 401;
    throw error;
  }
  return user;
}
