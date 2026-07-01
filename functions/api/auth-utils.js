const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 100000;
const PASSWORD_HASH_BYTES = 32;
const DEFAULT_KV_BINDING = 'DIANCI_AUTH_KV';

export function getAuthEnv(context = {}) {
  return {
    AUTH_SECRET: context.env?.AUTH_SECRET || context.env?.JWT_SECRET || globalThis.process?.env?.AUTH_SECRET || globalThis.process?.env?.JWT_SECRET || 'local-dev-auth-secret',
    KV_BINDING: context.env?.KV_BINDING || globalThis.process?.env?.KV_BINDING || DEFAULT_KV_BINDING,
  };
}

export function getAuthKV(context = {}, env = getAuthEnv(context)) {
  const kv = context.env?.[env.KV_BINDING] || globalThis[env.KV_BINDING];
  if (!kv) {
    throw new Error(`未绑定 EdgeOne KV：请创建 KV namespace，并以变量名 ${env.KV_BINDING} 绑定到项目`);
  }
  return kv;
}

export function validateCredentials(phone, password) {
  const normalizedPhone = String(phone || '').trim().replace(/[\s-]/g, '');
  if (!/^\+?\d{6,20}$/.test(normalizedPhone)) throw new Error('请输入有效手机号');
  if (String(password || '').length < 6) throw new Error('密码至少需要 6 位');
  return { phone: normalizedPhone, password: String(password) };
}

export async function userKey(phone) {
  return `user_${await sha256Hex(phone)}`;
}

export async function hashPassword(password) {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = bytesToBase64Url(saltBytes);
  const hash = await derivePasswordHash(password, salt);
  return `pbkdf2:${PASSWORD_ITERATIONS}:${salt}:${hash}`;
}

export async function verifyPassword(password, storedHash) {
  const [scheme, iterations, salt, hash] = String(storedHash || '').split(':');
  if (scheme !== 'pbkdf2' || Number(iterations) !== PASSWORD_ITERATIONS) return false;
  if (!salt || !hash) return false;
  const expected = await derivePasswordHash(password, salt);
  return timingSafeEqualString(hash, expected);
}

export async function signToken(user, secret) {
  const payload = { uid: user.id, phone: user.phone, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS };
  const encodedPayload = bytesToBase64Url(textEncode(JSON.stringify(payload)));
  const signature = await hmacSha256(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function verifyToken(token, secret) {
  const [encodedPayload, signature] = String(token || '').split('.');
  if (!encodedPayload || !signature) return null;
  const expected = await hmacSha256(encodedPayload, secret);
  if (!timingSafeEqualString(signature, expected)) return null;
  try {
    const payload = JSON.parse(textDecode(base64UrlToBytes(encodedPayload)));
    if (!payload.uid || !payload.phone || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function requireAuth(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  const user = await verifyToken(token, env.AUTH_SECRET);
  if (!user) {
    const error = new Error('请先登录');
    error.statusCode = 401;
    throw error;
  }
  return user;
}

async function derivePasswordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', textEncode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: textEncode(salt), iterations: PASSWORD_ITERATIONS },
    key,
    PASSWORD_HASH_BYTES * 8,
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

async function hmacSha256(value, secret) {
  const key = await crypto.subtle.importKey('raw', textEncode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, textEncode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', textEncode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualString(a, b) {
  const left = textEncode(String(a || ''));
  const right = textEncode(String(b || ''));
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    diff |= (left[i] || 0) ^ (right[i] || 0);
  }
  return diff === 0;
}

function textEncode(value) {
  return new TextEncoder().encode(String(value));
}

function textDecode(value) {
  return new TextDecoder().decode(value);
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const base64 = String(value).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(value).length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
