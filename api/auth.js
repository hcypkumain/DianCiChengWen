import {
  ensureUserTable,
  getSql,
  hashPassword,
  signToken,
  validateCredentials,
  verifyPassword,
} from './auth-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { action = 'login', phone, password } = normalizeRequestBody(req.body);
    const credentials = validateCredentials(phone, password);
    const sql = getSql();
    await ensureUserTable(sql);

    if (action === 'register') return register(sql, credentials, res);
    if (action === 'login') return login(sql, credentials, res);
    return res.status(400).json({ error: '未知操作' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || '请求失败' });
  }
}

async function register(sql, { phone, password }, res) {
  const passwordHash = hashPassword(password);
  try {
    const rows = await sql`
      INSERT INTO app_users (phone, password_hash)
      VALUES (${phone}, ${passwordHash})
      RETURNING id, phone
    `;
    const user = rows[0];
    return res.status(201).json({ token: signToken(user), user });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: '该手机号已注册' });
    throw error;
  }
}

async function login(sql, { phone, password }, res) {
  const rows = await sql`
    SELECT id, phone, password_hash
    FROM app_users
    WHERE phone = ${phone}
    LIMIT 1
  `;
  const user = rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: '手机号或密码不正确' });
  }
  return res.status(200).json({ token: signToken(user), user: { id: user.id, phone: user.phone } });
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
