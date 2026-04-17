const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(ROOT, 'data');
const USERS_DIR = path.join(DATA_DIR, 'local-shifts');
const USER_STATS_FILE = path.join(DATA_DIR, 'user-presence.json');
const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const USER_PRESENCE_FLUSH_DELAY_MS = 2500;
const SHIFT_USER_IDS_CACHE_TTL_MS = 30 * 1000;

let userPresenceStoreCache = null;
let userPresenceStoreLoaded = false;
let userPresenceStoreDirty = false;
let userPresenceStoreFlushTimer = null;
let userPresenceStoreWriteInFlight = false;
let userPresenceStoreFlushQueued = false;

let shiftUserIdsCache = new Set();
let shiftUserIdsCacheExpiresAtMs = 0;

// Load .env file if present (simple key=value parser, no deps)
(function loadDotEnv() {
  const envFile = path.join(ROOT, '.env');
  if (!fs.existsSync(envFile)) return;
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) process.env[key] = val;
  }
})();

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function sha256Buf(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest();
}

function hmacSha256Hex(keyBuf, message) {
  return crypto.createHmac('sha256', keyBuf).update(message, 'utf8').digest('hex');
}

function base64UrlEncode(str) {
  return Buffer.from(str, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createSessionToken(user) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const payload = JSON.stringify({
    user,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });
  const secret = sha256Buf(botToken);
  return base64UrlEncode(payload) + '.' + hmacSha256Hex(secret, payload);
}

// Decode and validate a session token, returns full user object or null
function decodeSessionToken(tokenValue, botToken) {
  if (!tokenValue || !botToken || tokenValue.indexOf('.') === -1) return null;
  const dotIdx = tokenValue.indexOf('.');
  const payloadB64 = tokenValue.slice(0, dotIdx);
  const signature = tokenValue.slice(dotIdx + 1).toLowerCase();
  let payloadJson;
  try {
    payloadJson = Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch (e) { return null; }
  const secretBytes = sha256Buf(botToken);
  if (hmacSha256Hex(secretBytes, payloadJson) !== signature) return null;
  try {
    const payload = JSON.parse(payloadJson);
    if (!payload || !payload.user || !payload.exp) return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload.user;
  } catch (e) { return null; }
}

function getUserFromRequest(req) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return null;
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;
  return decodeSessionToken(authHeader.slice(7).trim(), botToken);
}

function getUserIdFromRequest(req) {
  const user = getUserFromRequest(req);
  return user ? String(user.id || '') : null;
}

// Verify Telegram Login Widget params
function verifyTelegramLoginParams(params, botToken) {
  const hash = params.get('hash');
  if (!hash) return null;
  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Date.now() / 1000 - authDate > 86400) return null;
  const allowed = new Set(['auth_date', 'first_name', 'hash', 'id', 'last_name', 'photo_url', 'username']);
  const keys = [];
  for (const [k] of params) { if (allowed.has(k) && k !== 'hash') keys.push(k); }
  keys.sort();
  const checkString = keys.map(k => `${k}=${params.get(k)}`).join('\n');
  const secret = sha256Buf(botToken);
  if (hmacSha256Hex(secret, checkString) !== hash.toLowerCase()) return null;
  const id = params.get('id');
  if (!id) return null;
  const first = params.get('first_name') || '';
  const last = params.get('last_name') || '';
  const uname = params.get('username') || '';
  return {
    id: String(id), first_name: first, last_name: last, username: uname,
    photo_url: params.get('photo_url') || '', auth_date: authDate,
    display_name: [first, last].join(' ').trim() || uname || ('ID ' + id),
  };
}

// Verify Telegram WebApp initData
function verifyTelegramWebAppInitData(initData, botToken) {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Date.now() / 1000 - authDate > 86400) return null;
  const keys = [];
  for (const [k] of params) { if (k !== 'hash') keys.push(k); }
  keys.sort();
  const checkString = keys.map(k => `${k}=${params.get(k)}`).join('\n');
  const secret = crypto.createHmac('sha256', Buffer.from('WebAppData', 'utf8')).update(botToken, 'utf8').digest();
  if (hmacSha256Hex(secret, checkString) !== hash.toLowerCase()) return null;
  try {
    const parsed = JSON.parse(params.get('user') || 'null');
    if (!parsed || !parsed.id) return null;
    const first = parsed.first_name || '';
    const last = parsed.last_name || '';
    const uname = parsed.username || '';
    return {
      id: String(parsed.id), first_name: first, last_name: last, username: uname,
      photo_url: parsed.photo_url || '', auth_date: authDate,
      display_name: [first, last].join(' ').trim() || uname || ('ID ' + parsed.id),
    };
  } catch (e) { return null; }
}

function safeRedirectTarget(raw) {
  const v = String(raw || '/');
  if (!v || v[0] !== '/' || v.startsWith('//')) return '/';
  return v;
}

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_DIR)) {
    fs.mkdirSync(USERS_DIR, { recursive: true });
  }
}

function normalizeSid(rawSid) {
  const sid = String(rawSid || 'default').trim();
  const safe = sid.replace(/[^a-zA-Z0-9_-]/g, '_');
  return safe.length > 0 ? safe : 'default';
}

function getUserFile(sid) {
  ensureDirs();
  return path.join(USERS_DIR, `${normalizeSid(sid)}.json`);
}

function readShifts(sid) {
  const file = getUserFile(sid);
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function writeShifts(sid, shifts) {
  const file = getUserFile(sid);
  const sanitized = Array.isArray(shifts)
    ? shifts.map(shift => {
        const copy = {};
        Object.keys(shift || {}).forEach(key => {
          if (key === 'pending') return;
          copy[key] = shift[key];
        });
        return copy;
      })
    : [];
  fs.writeFileSync(file, JSON.stringify(sanitized, null, 2), 'utf8');
  rememberShiftUserId(normalizeSid(sid));
}

function normalizeStatsUserId(rawUserId) {
  if (rawUserId === undefined || rawUserId === null) return '';
  const id = String(rawUserId).trim();
  if (!id || id === 'guest') return '';
  return id;
}

function isValidSessionId(rawSessionId) {
  return typeof rawSessionId === 'string' && /^[a-z0-9_-]{12,64}$/i.test(rawSessionId);
}

function rememberShiftUserId(rawUserId) {
  const userId = normalizeStatsUserId(rawUserId);
  if (!userId || userId === 'default') return;
  shiftUserIdsCache.add(userId);
  shiftUserIdsCacheExpiresAtMs = Date.now() + SHIFT_USER_IDS_CACHE_TTL_MS;
}

function listShiftUserIds() {
  const nowMs = Date.now();
  if (shiftUserIdsCache.size && shiftUserIdsCacheExpiresAtMs > nowMs) {
    return shiftUserIdsCache;
  }

  const next = new Set();
  try {
    if (fs.existsSync(USERS_DIR)) {
      fs.readdirSync(USERS_DIR).forEach(fname => {
        if (!fname.endsWith('.json')) return;
        const uid = normalizeStatsUserId(fname.slice(0, -5));
        if (!uid || uid === 'default') return;
        next.add(uid);
      });
    }
  } catch (e) {}

  shiftUserIdsCache = next;
  shiftUserIdsCacheExpiresAtMs = nowMs + SHIFT_USER_IDS_CACHE_TTL_MS;
  return shiftUserIdsCache;
}

function sanitizeUserPresenceStore(rawStore) {
  const source = rawStore && typeof rawStore === 'object' ? rawStore : {};
  const sourceUsers = source.users && typeof source.users === 'object' ? source.users : {};
  const sourceSessions = source.sessions && typeof source.sessions === 'object' ? source.sessions : {};
  const users = {};
  const sessions = {};

  Object.keys(sourceUsers).forEach(userId => {
    const normalizedUserId = normalizeStatsUserId(userId);
    if (!normalizedUserId) return;
    const row = sourceUsers[userId] || {};
    const firstSeenAt = typeof row.firstSeenAt === 'string' ? row.firstSeenAt : '';
    const lastSeenAt = typeof row.lastSeenAt === 'string' ? row.lastSeenAt : '';
    if (!lastSeenAt) return;
    users[normalizedUserId] = {
      firstSeenAt: firstSeenAt || lastSeenAt,
      lastSeenAt: lastSeenAt,
    };
  });

  Object.keys(sourceSessions).forEach(sessionId => {
    if (!isValidSessionId(sessionId)) return;
    const row = sourceSessions[sessionId] || {};
    const userId = normalizeStatsUserId(row.userId);
    const firstSeenAt = typeof row.firstSeenAt === 'string' ? row.firstSeenAt : '';
    const lastSeenAt = typeof row.lastSeenAt === 'string' ? row.lastSeenAt : '';
    if (!userId || !lastSeenAt) return;
    sessions[sessionId] = {
      userId,
      firstSeenAt: firstSeenAt || lastSeenAt,
      lastSeenAt,
    };
    if (!users[userId]) {
      users[userId] = {
        firstSeenAt: firstSeenAt || lastSeenAt,
        lastSeenAt,
      };
    } else {
      const knownLastSeenMs = Date.parse(users[userId].lastSeenAt || '');
      const sessionLastSeenMs = Date.parse(lastSeenAt);
      if (Number.isFinite(sessionLastSeenMs) && (!Number.isFinite(knownLastSeenMs) || sessionLastSeenMs > knownLastSeenMs)) {
        users[userId].lastSeenAt = lastSeenAt;
      }
    }
  });

  return { users, sessions };
}

function loadUserPresenceStoreFromDisk() {
  ensureDirs();
  try {
    if (!fs.existsSync(USER_STATS_FILE)) {
      return { users: {}, sessions: {} };
    }
    const raw = fs.readFileSync(USER_STATS_FILE, 'utf8');
    const parsed = raw ? JSON.parse(raw) : {};
    return sanitizeUserPresenceStore(parsed);
  } catch (err) {
    return { users: {}, sessions: {} };
  }
}

function readUserPresenceStore() {
  if (!userPresenceStoreLoaded || !userPresenceStoreCache) {
    userPresenceStoreCache = loadUserPresenceStoreFromDisk();
    userPresenceStoreLoaded = true;
  }
  return userPresenceStoreCache;
}

function scheduleUserPresenceStoreFlush(delayMs) {
  if (userPresenceStoreWriteInFlight) {
    userPresenceStoreFlushQueued = true;
    return;
  }
  if (userPresenceStoreFlushTimer) return;

  const timeoutMs = typeof delayMs === 'number' ? delayMs : USER_PRESENCE_FLUSH_DELAY_MS;
  userPresenceStoreFlushTimer = setTimeout(() => {
    userPresenceStoreFlushTimer = null;
    flushUserPresenceStoreNow();
  }, timeoutMs);
  if (typeof userPresenceStoreFlushTimer.unref === 'function') {
    userPresenceStoreFlushTimer.unref();
  }
}

function flushUserPresenceStoreNow() {
  if (!userPresenceStoreLoaded || !userPresenceStoreCache || !userPresenceStoreDirty) return;
  if (userPresenceStoreWriteInFlight) {
    userPresenceStoreFlushQueued = true;
    return;
  }

  ensureDirs();
  userPresenceStoreWriteInFlight = true;
  userPresenceStoreDirty = false;
  const snapshot = sanitizeUserPresenceStore(userPresenceStoreCache);
  const serialized = JSON.stringify(snapshot, null, 2);

  fs.writeFile(USER_STATS_FILE, serialized, 'utf8', (err) => {
    userPresenceStoreWriteInFlight = false;
    if (err) {
      userPresenceStoreDirty = true;
    } else {
      userPresenceStoreCache = snapshot;
    }

    if (userPresenceStoreDirty || userPresenceStoreFlushQueued) {
      userPresenceStoreFlushQueued = false;
      scheduleUserPresenceStoreFlush(USER_PRESENCE_FLUSH_DELAY_MS);
    }
  });
}

function flushUserPresenceStoreSyncOnShutdown() {
  if (!userPresenceStoreLoaded || !userPresenceStoreCache || !userPresenceStoreDirty) return;
  if (userPresenceStoreFlushTimer) {
    clearTimeout(userPresenceStoreFlushTimer);
    userPresenceStoreFlushTimer = null;
  }
  try {
    ensureDirs();
    const snapshot = sanitizeUserPresenceStore(userPresenceStoreCache);
    fs.writeFileSync(USER_STATS_FILE, JSON.stringify(snapshot, null, 2), 'utf8');
    userPresenceStoreCache = snapshot;
    userPresenceStoreDirty = false;
  } catch (e) {}
}

function writeUserPresenceStore(store) {
  userPresenceStoreCache = sanitizeUserPresenceStore(store);
  userPresenceStoreLoaded = true;
  userPresenceStoreDirty = true;
  scheduleUserPresenceStoreFlush();
}

function buildUserPresenceStats(store) {
  const nowMs = Date.now();
  const users = (store && store.users) || {};
  const sessions = (store && store.sessions) || {};
  const onlineUserMap = {};

  Object.keys(sessions).forEach(sessionId => {
    const row = sessions[sessionId] || {};
    const userId = normalizeStatsUserId(row.userId);
    if (!userId) return;
    const seenMs = Date.parse(row.lastSeenAt || '');
    if (Number.isFinite(seenMs) && nowMs - seenMs <= ONLINE_WINDOW_MS) {
      onlineUserMap[userId] = true;
    }
  });

  // Count all unique users: presence store + anyone who has a shifts file
  const allUserIds = new Set(Object.keys(users).filter(id => id && id !== 'guest' && id !== 'default'));
  listShiftUserIds().forEach(uid => allUserIds.add(uid));

  return {
    totalUsers: allUserIds.size,
    onlineUsers: Object.keys(onlineUserMap).length,
    onlineWindowSeconds: Math.floor(ONLINE_WINDOW_MS / 1000),
    updatedAt: new Date().toISOString(),
  };
}

function readUserPresenceStats() {
  return buildUserPresenceStats(readUserPresenceStore());
}

function touchUserPresence(userId, sessionId) {
  const store = readUserPresenceStore();
  const nowIso = new Date().toISOString();
  const existingUser = store.users[userId];
  const existingSession = store.sessions[sessionId];

  store.users[userId] = {
    firstSeenAt: existingUser && typeof existingUser.firstSeenAt === 'string' && existingUser.firstSeenAt ? existingUser.firstSeenAt : nowIso,
    lastSeenAt: nowIso,
  };
  store.sessions[sessionId] = {
    userId,
    firstSeenAt: existingSession && typeof existingSession.firstSeenAt === 'string' && existingSession.firstSeenAt ? existingSession.firstSeenAt : nowIso,
    lastSeenAt: nowIso,
  };

  if (existingSession && normalizeStatsUserId(existingSession.userId) !== userId) {
    store.sessions[sessionId].userId = userId;
  }

  writeUserPresenceStore(store);
  return buildUserPresenceStats(store);
}

process.on('SIGINT', () => {
  flushUserPresenceStoreSyncOnShutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  flushUserPresenceStoreSyncOnShutdown();
  process.exit(0);
});

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendText(res, statusCode, body, contentType) {
  res.writeHead(statusCode, {
    'Content-Type': contentType || 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendText(res, 404, 'Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };

  res.writeHead(200, {
    'Content-Type': types[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(filePath).pipe(res);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const APP_URL = 'https://bloknot-mashinista-bot.ru';

function callTelegramApi(token, method, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${token}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ ok: false }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function buildWelcomeMessage(chatId, firstName) {
  const greeting = firstName ? `👋 Привет, ${firstName}!` : '👋 Привет!';
  return {
    chat_id: chatId,
    text:
      `${greeting} Это Блокнот машиниста — электронный учёт рабочих смен.\n\n` +
      'Что здесь можно делать:\n' +
      '📅 вести журнал смен с датами и часами\n' +
      '⏱ следить за нормой и переработкой\n' +
      '⛽️ записывать расход топлива\n' +
      '📚 круглосуточный доступ к важным документам и инструкциям\n\n' +
      '🔒 Данные привязаны к твоему Telegram-аккаунту и доступны с любого устройства.',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✈️ Открыть в Telegram', web_app: { url: APP_URL } }],
        [{ text: '🌐 Открыть в браузере', url: APP_URL }],
      ],
    },
  };
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname || '/';
  const telegramUserId = getUserIdFromRequest(req);
  const sid = telegramUserId
    ? normalizeSid(telegramUserId)
    : normalizeSid(parsedUrl.query && parsedUrl.query.sid);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/api/telegram-webhook') {
    if (req.method !== 'POST') {
      sendJson(res, 200, { ok: true });
      return;
    }
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      sendJson(res, 500, { ok: false, error: 'no token' });
      return;
    }
    try {
      const body = await readBody(req);
      const update = body ? JSON.parse(body) : {};
      const message = update && update.message;
      const text = (message && message.text) || '';
      const chatId = message && message.chat && message.chat.id;
      const firstName = (message && message.from && message.from.first_name) || '';
      const fromUserId = message && message.from && message.from.id;
      const normalizedText = String(text || '').trim();
      if (chatId) {
        if (normalizedText.startsWith('/start') || normalizedText.startsWith('/help')) {
          callTelegramApi(token, 'sendMessage', buildWelcomeMessage(chatId, firstName)).catch(() => {});
        } else if (/^\/myid(?:@\w+)?$/i.test(normalizedText)) {
          callTelegramApi(token, 'sendMessage', {
            chat_id: chatId,
            text: `Ваш Telegram ID: ${String(fromUserId || '')}`,
          }).catch(() => {});
        } else {
          callTelegramApi(token, 'sendMessage', {
            chat_id: chatId,
            text: 'Используй кнопку «Открыть мини-апп» в сообщении или в меню бота.',
          }).catch(() => {});
        }
      }
    } catch (_) {}
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === '/api/auth') {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) { sendJson(res, 500, { error: 'TELEGRAM_BOT_TOKEN not configured' }); return; }

    if (req.method === 'GET') {
      const mode = parsedUrl.query.mode;
      const hasTelegramParams = ['id', 'auth_date', 'hash'].every(k => parsedUrl.query[k]);

      if (mode === 'telegram-login' || hasTelegramParams) {
        // Login Widget callback — verify params, create token, redirect with ?_st=
        const params = new URLSearchParams(Object.entries(parsedUrl.query).map(([k, v]) => [k, String(v)]));
        const user = verifyTelegramLoginParams(params, botToken);
        if (!user) { sendJson(res, 401, { error: 'Telegram login verification failed' }); return; }
        const sessionToken = createSessionToken(user);
        const returnPath = safeRedirectTarget(parsedUrl.query.return);
        const sep = returnPath.includes('?') ? '&' : '?';
        res.writeHead(302, { 'Location': returnPath + sep + '_st=' + encodeURIComponent(sessionToken), 'Cache-Control': 'no-store' });
        res.end();
        return;
      }

      // Check existing session (Bearer token)
      const user = getUserFromRequest(req);
      if (!user) { sendJson(res, 401, { error: 'Unauthorized' }); return; }
      sendJson(res, 200, { user, sessionToken: createSessionToken(user) });
      return;
    }

    if (req.method === 'POST') {
      try {
        const body = await readBody(req);
        const payload = body ? JSON.parse(body) : {};
        const initData = payload && typeof payload.initData === 'string' ? payload.initData : '';
        if (!initData) { sendJson(res, 400, { error: 'Expected { initData: "..." }' }); return; }
        const user = verifyTelegramWebAppInitData(initData, botToken);
        if (!user) { sendJson(res, 401, { error: 'Telegram WebApp verification failed' }); return; }
        sendJson(res, 200, { user, sessionToken: createSessionToken(user) });
      } catch (err) {
        sendJson(res, 400, { error: err.message || 'Invalid payload' });
      }
      return;
    }

    if (req.method === 'DELETE') { res.writeHead(204, { 'Cache-Control': 'no-store' }); res.end(); return; }
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (pathname === '/api/shifts') {
    if (req.method === 'GET') {
      sendJson(res, 200, { sid, shifts: readShifts(sid) });
      return;
    }

    if (req.method === 'PUT') {
      try {
        const body = await readBody(req);
        const payload = body ? JSON.parse(body) : {};
        const shifts = Array.isArray(payload.shifts) ? payload.shifts : null;
        if (!shifts) {
          sendJson(res, 400, { error: 'Expected { shifts: [] }' });
          return;
        }

        writeShifts(sid, shifts);
        sendJson(res, 200, { ok: true, sid, shifts });
      } catch (err) {
        sendJson(res, 400, { error: err.message || 'Invalid payload' });
      }
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (pathname === '/api/stats') {
    if (req.method === 'GET') {
      sendJson(res, 200, readUserPresenceStats());
      return;
    }

    if (req.method === 'POST') {
      try {
        const body = await readBody(req);
        const payload = body ? JSON.parse(body) : {};
        const userId = normalizeStatsUserId(payload && payload.userId);
        const sessionId = typeof payload.sessionId === 'string'
          ? payload.sessionId.trim()
          : (typeof payload.deviceId === 'string' ? payload.deviceId.trim() : '');
        if (!userId) {
          sendJson(res, 400, { error: 'Invalid userId' });
          return;
        }
        if (!isValidSessionId(sessionId)) {
          sendJson(res, 400, { error: 'Invalid sessionId' });
          return;
        }
        sendJson(res, 200, touchUserPresence(userId, sessionId));
      } catch (err) {
        sendJson(res, 400, { error: err.message || 'Invalid payload' });
      }
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const normalized = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const filePath = path.join(ROOT, normalized);

  if (!filePath.startsWith(ROOT)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Shift tracker server listening on http://localhost:${PORT}`);
});
