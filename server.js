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
const SCHEDULES_DIR = path.join(DATA_DIR, 'local-schedules');
const USER_STATS_FILE = path.join(DATA_DIR, 'user-presence.json');
const PUBLIC_TOP_LEVEL_FILES = new Set([
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'bot_avatar.svg',
  '_redirects',
  'googled7576eb3c69566bc.html',
  'yandex_de378ce11c15bc59.html',
]);
const PUBLIC_TOP_LEVEL_DIRS = new Set(['assets', 'scripts', 'styles', 'docs']);
const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const USER_PRESENCE_FLUSH_DELAY_MS = 2500;
const SHIFT_USER_IDS_CACHE_TTL_MS = 30 * 1000;
const STRUCTURED_LOG_TTL_MS = 30 * 1000;
const MAX_SHIFTS_PER_PAYLOAD = 500;
const MAX_SHIFT_FIELD_COUNT = 64;
const MAX_SHIFT_ID_LENGTH = 128;
const MAX_SHIFT_TEXT_LENGTH = 512;
const MAX_SHIFT_NOTES_LENGTH = 4000;
const MAX_SHIFT_ISO_LENGTH = 40;
const MAX_SCHEDULE_PERIODS_PER_PAYLOAD = 256;
const MAX_SCHEDULE_OVERRIDES_PER_PAYLOAD = 3660;
const MAX_SCHEDULE_ID_LENGTH = 128;
const MAX_SCHEDULE_PATTERN_LENGTH = 64;
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://bloknot-mashinista-bot.ru';
const SEO_PAGE_ROUTES = {
  '/uchet-marshrutov': 'docs/seo/uchet-marshrutov.html',
  '/zarplata-mashinista': 'docs/seo/zarplata-mashinista.html',
  '/zhurnal-smen-mashinista': 'docs/seo/zhurnal-smen-mashinista.html',
  '/kalkulyator-zarplaty-mashinista': 'docs/seo/kalkulyator-zarplaty-mashinista.html',
  '/grafik-smen-mashinista': 'docs/seo/grafik-smen-mashinista.html',
  '/prilozhenie-dlya-mashinista': 'docs/seo/prilozhenie-dlya-mashinista.html',
};

let userPresenceStoreCache = null;
let userPresenceStoreLoaded = false;
let userPresenceStoreDirty = false;
let userPresenceStoreFlushTimer = null;
let userPresenceStoreWriteInFlight = false;
let userPresenceStoreFlushQueued = false;

let shiftUserIdsCache = new Set();
let shiftUserIdsCacheExpiresAtMs = 0;
const structuredLogRateLimit = new Map();

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
  } catch (e) {
    logStructuredRateLimited('warn', 'auth.session.decode_base64_failed', 'auth.session.decode_base64_failed', { error: toErrorMeta(e) });
    return null;
  }
  const secretBytes = sha256Buf(botToken);
  if (hmacSha256Hex(secretBytes, payloadJson) !== signature) return null;
  try {
    const payload = JSON.parse(payloadJson);
    if (!payload || !payload.user || !payload.exp) return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload.user;
  } catch (e) {
    logStructuredRateLimited('warn', 'auth.session.invalid_payload', 'auth.session.invalid_payload', { error: toErrorMeta(e) });
    return null;
  }
}

function parseCookies(req) {
  const header = req && req.headers ? (req.headers.cookie || '') : '';
  if (!header) return {};
  return header.split(';').reduce((acc, part) => {
    const trimmed = String(part || '').trim();
    if (!trimmed) return acc;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return acc;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!key) return acc;
    try {
      acc[key] = decodeURIComponent(value);
    } catch (_) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function buildSessionCookie(tokenValue, maxAgeSeconds) {
  const safeToken = encodeURIComponent(String(tokenValue || ''));
  const maxAge = Number.isFinite(maxAgeSeconds) ? Math.max(0, Math.floor(maxAgeSeconds)) : SESSION_TTL_SECONDS;
  const parts = [
    `bm_session=${safeToken}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (maxAge === 0) {
    parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  }
  if (APP_URL.startsWith('https://')) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function getUserFromRequest(req) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return null;
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return decodeSessionToken(authHeader.slice(7).trim(), botToken);
  }
  const cookies = parseCookies(req);
  if (!cookies || !cookies.bm_session) return null;
  return decodeSessionToken(cookies.bm_session, botToken);
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
  } catch (e) {
    logStructuredRateLimited('warn', 'auth.webapp.invalid_user_json', 'auth.webapp.invalid_user_json', { error: toErrorMeta(e) });
    return null;
  }
}

function safeRedirectTarget(raw) {
  const v = String(raw || '/');
  if (!v || v[0] !== '/' || v.startsWith('//')) return '/';
  return v;
}

function toErrorMeta(error) {
  if (!error) return null;
  return {
    name: error.name || 'Error',
    message: error.message || String(error),
    code: error.code || '',
  };
}

function logStructured(level, event, meta) {
  const payload = {
    level: level || 'info',
    event: event || 'server.log',
    ts: new Date().toISOString(),
    ...(meta && typeof meta === 'object' ? meta : {}),
  };
  const line = JSON.stringify(payload);
  if (level === 'error' || level === 'warn') {
    console.error(line);
    return;
  }
  console.log(line);
}

function logStructuredRateLimited(level, event, rateKey, meta) {
  const cacheKey = `${level}:${event}:${rateKey || ''}`;
  const now = Date.now();
  const nextAllowedAt = structuredLogRateLimit.get(cacheKey) || 0;
  if (nextAllowedAt > now) return;
  structuredLogRateLimit.set(cacheKey, now + STRUCTURED_LOG_TTL_MS);
  logStructured(level, event, meta);
}

function atomicWriteFileSync(filePath, content) {
  ensureDirs();
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function atomicWriteFile(filePath, content, callback) {
  ensureDirs();
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFile(tmpPath, content, 'utf8', (writeErr) => {
    if (writeErr) {
      callback(writeErr);
      return;
    }
    fs.rename(tmpPath, filePath, (renameErr) => {
      if (!renameErr) {
        callback(null);
        return;
      }
      fs.unlink(tmpPath, () => callback(renameErr));
    });
  });
}

function validateIsoLikeString(value, fieldName) {
  if (typeof value !== 'string' || !value || value.length > MAX_SHIFT_ISO_LENGTH) {
    throw new Error(`Invalid ${fieldName}`);
  }
}

function validateShiftText(value, fieldName, maxLength) {
  if (typeof value !== 'string' || value.length > (maxLength || MAX_SHIFT_TEXT_LENGTH)) {
    throw new Error(`Invalid ${fieldName}`);
  }
}

function validateShiftNumber(value, fieldName) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${fieldName}`);
  }
}

function sanitizeAndValidateShift(shift, index) {
  if (!shift || typeof shift !== 'object' || Array.isArray(shift)) {
    throw new Error(`Invalid shift at index ${index}`);
  }

  const keys = Object.keys(shift);
  if (!keys.length || keys.length > MAX_SHIFT_FIELD_COUNT) {
    throw new Error(`Invalid shift at index ${index}`);
  }

  const sanitized = {};
  keys.forEach((key) => {
    if (key === 'pending') return;
    const value = shift[key];
    if (value === undefined) return;

    if (key === 'id') {
      if (typeof value !== 'string' || !value.trim() || value.length > MAX_SHIFT_ID_LENGTH) {
        throw new Error(`Invalid shift id at index ${index}`);
      }
    } else if (key === 'start_msk' || key === 'end_msk' || key === 'created_at') {
      validateIsoLikeString(value, key);
    } else if (key === 'notes') {
      validateShiftText(value, key, MAX_SHIFT_NOTES_LENGTH);
    } else if (typeof value === 'string') {
      validateShiftText(value, key, MAX_SHIFT_TEXT_LENGTH);
    } else if (typeof value === 'number') {
      validateShiftNumber(value, key);
    } else if (typeof value === 'boolean' || value === null) {
      // allowed
    } else {
      throw new Error(`Invalid field ${key} at index ${index}`);
    }

    sanitized[key] = value;
  });

  if (!sanitized.id) {
    throw new Error(`Missing shift id at index ${index}`);
  }
  if (!sanitized.start_msk || !sanitized.end_msk || !sanitized.created_at) {
    throw new Error(`Missing required shift fields at index ${index}`);
  }

  return sanitized;
}

function sanitizeAndValidateShiftsPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Expected JSON object payload');
  }
  if (!Array.isArray(payload.shifts)) {
    throw new Error('Expected { shifts: [] }');
  }
  if (payload.shifts.length > MAX_SHIFTS_PER_PAYLOAD) {
    throw new Error('Too many shifts in one request');
  }
  return payload.shifts.map((shift, index) => sanitizeAndValidateShift(shift, index));
}

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_DIR)) {
    fs.mkdirSync(USERS_DIR, { recursive: true });
  }
  if (!fs.existsSync(SCHEDULES_DIR)) {
    fs.mkdirSync(SCHEDULES_DIR, { recursive: true });
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

function getUserScheduleFile(sid) {
  ensureDirs();
  return path.join(SCHEDULES_DIR, `${normalizeSid(sid)}.json`);
}

function createEmptyScheduleStore() {
  return { version: 1, periods: [], overrides: {} };
}

function normalizeScheduleDateKey(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function normalizeScheduleTimeValue(raw, fallback = '') {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

function normalizeScheduleCode(raw) {
  let value = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (value === 'Д') value = 'D';
  if (value === 'Н') value = 'N';
  if (value === 'В') value = 'V';
  return ['AUTO', 'D', 'N', 'V'].includes(value) ? value : '';
}

function normalizeSchedulePattern(raw) {
  const source = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  let result = '';
  for (const char of source) {
    const code = normalizeScheduleCode(char);
    if (code && code !== 'AUTO') result += code;
  }
  return result.slice(0, MAX_SCHEDULE_PATTERN_LENGTH);
}

function sanitizeSchedulePeriod(period, index) {
  if (!period || typeof period !== 'object' || Array.isArray(period)) {
    throw new Error(`Invalid schedule period at index ${index}`);
  }
  const id = typeof period.id === 'string' ? period.id.trim() : '';
  const startDate = normalizeScheduleDateKey(period.startDate);
  const endDate = normalizeScheduleDateKey(period.endDate);
  const pattern = normalizeSchedulePattern(period.pattern);
  const startTime = normalizeScheduleTimeValue(period.startTime, '08:00');
  const endTime = normalizeScheduleTimeValue(period.endTime, '20:00');
  if (!id || id.length > MAX_SCHEDULE_ID_LENGTH) throw new Error(`Invalid schedule period id at index ${index}`);
  if (!startDate) throw new Error(`Invalid schedule startDate at index ${index}`);
  if (period.endDate && !endDate) throw new Error(`Invalid schedule endDate at index ${index}`);
  if (endDate && endDate < startDate) throw new Error(`Invalid schedule range at index ${index}`);
  if (!pattern) throw new Error(`Invalid schedule pattern at index ${index}`);
  return {
    id,
    startDate,
    endDate,
    pattern,
    startTime,
    endTime,
  };
}

function sanitizeScheduleOverrides(rawOverrides) {
  const source = rawOverrides && typeof rawOverrides === 'object' && !Array.isArray(rawOverrides) ? rawOverrides : {};
  const result = {};
  const dateKeys = Object.keys(source);
  if (dateKeys.length > MAX_SCHEDULE_OVERRIDES_PER_PAYLOAD) {
    throw new Error('Too many schedule overrides in one request');
  }
  dateKeys.forEach((dateKey) => {
    const safeDate = normalizeScheduleDateKey(dateKey);
    if (!safeDate) return;
    const row = source[dateKey];
    if (!row || typeof row !== 'object' || Array.isArray(row)) return;
    const code = normalizeScheduleCode(row.code);
    const startTime = normalizeScheduleTimeValue(row.startTime);
    const endTime = normalizeScheduleTimeValue(row.endTime);
    if (!code && !startTime && !endTime) return;
    result[safeDate] = {
      code,
      startTime,
      endTime,
    };
  });
  return result;
}

function sanitizeAndValidateSchedulePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Expected JSON object payload');
  }
  const source = payload.schedule && typeof payload.schedule === 'object' && !Array.isArray(payload.schedule)
    ? payload.schedule
    : payload;
  const rawPeriods = Array.isArray(source.periods) ? source.periods : [];
  if (rawPeriods.length > MAX_SCHEDULE_PERIODS_PER_PAYLOAD) {
    throw new Error('Too many schedule periods in one request');
  }
  const periods = rawPeriods.map((period, index) => sanitizeSchedulePeriod(period, index));
  periods.sort((a, b) => {
    if (a.startDate < b.startDate) return -1;
    if (a.startDate > b.startDate) return 1;
    return String(a.id).localeCompare(String(b.id));
  });
  return {
    version: 1,
    periods,
    overrides: sanitizeScheduleOverrides(source.overrides),
  };
}

function readScheduleStore(sid) {
  const file = getUserScheduleFile(sid);
  try {
    if (!fs.existsSync(file)) return createEmptyScheduleStore();
    const raw = fs.readFileSync(file, 'utf8');
    return sanitizeAndValidateSchedulePayload(JSON.parse(raw || '{}'));
  } catch (err) {
    logStructuredRateLimited('error', 'storage.schedule.read_failed', file, {
      sid: normalizeSid(sid),
      file,
      error: toErrorMeta(err),
    });
    return createEmptyScheduleStore();
  }
}

function writeScheduleStore(sid, schedule) {
  const file = getUserScheduleFile(sid);
  const serialized = JSON.stringify(sanitizeAndValidateSchedulePayload(schedule), null, 2);
  atomicWriteFileSync(file, serialized);
}

function readShifts(sid) {
  const file = getUserFile(sid);
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) {
      logStructuredRateLimited('warn', 'storage.shifts.invalid_file_shape', file, { sid: normalizeSid(sid), file });
      return [];
    }
    return parsed;
  } catch (err) {
    logStructuredRateLimited('error', 'storage.shifts.read_failed', file, {
      sid: normalizeSid(sid),
      file,
      error: toErrorMeta(err),
    });
    return [];
  }
}

function writeShifts(sid, shifts) {
  const file = getUserFile(sid);
  const serialized = JSON.stringify(Array.isArray(shifts) ? shifts : [], null, 2);
  atomicWriteFileSync(file, serialized);
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
  } catch (e) {
    logStructuredRateLimited('error', 'storage.shifts.list_user_ids_failed', USERS_DIR, {
      dir: USERS_DIR,
      error: toErrorMeta(e),
    });
  }

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
    logStructuredRateLimited('error', 'storage.user_presence.read_failed', USER_STATS_FILE, {
      file: USER_STATS_FILE,
      error: toErrorMeta(err),
    });
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

  atomicWriteFile(USER_STATS_FILE, serialized, (err) => {
    userPresenceStoreWriteInFlight = false;
    if (err) {
      userPresenceStoreDirty = true;
      logStructuredRateLimited('error', 'storage.user_presence.write_failed', USER_STATS_FILE, {
        file: USER_STATS_FILE,
        error: toErrorMeta(err),
      });
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
    atomicWriteFileSync(USER_STATS_FILE, JSON.stringify(snapshot, null, 2));
    userPresenceStoreCache = snapshot;
    userPresenceStoreDirty = false;
  } catch (e) {
    logStructuredRateLimited('error', 'storage.user_presence.shutdown_flush_failed', USER_STATS_FILE, {
      file: USER_STATS_FILE,
      error: toErrorMeta(e),
    });
  }
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

function sendJson(res, statusCode, payload, extraHeaders) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...(extraHeaders && typeof extraHeaders === 'object' ? extraHeaders : {}),
  });
  res.end(body);
}

function sendText(res, statusCode, body, contentType) {
  res.writeHead(statusCode, {
    'Content-Type': contentType || 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  res.end(body);
}

function isPublicFilePath(filePath) {
  const relativePath = path.relative(ROOT, filePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) return false;

  const segments = relativePath.split(path.sep).filter(Boolean);
  if (!segments.length) return false;
  if (segments.some(segment => segment.startsWith('.'))) return false;

  if (segments.length === 1) {
    return PUBLIC_TOP_LEVEL_FILES.has(segments[0]);
  }

  return PUBLIC_TOP_LEVEL_DIRS.has(segments[0]);
}

function buildSeoSitemapXml() {
  const urls = ['/', '/uchet-marshrutov', '/zarplata-mashinista', '/zhurnal-smen-mashinista', '/kalkulyator-zarplaty-mashinista', '/grafik-smen-mashinista', '/prilozhenie-dlya-mashinista'];
  const now = new Date().toISOString();
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((pathname) => {
      return [
        '  <url>',
        `    <loc>${PUBLIC_SITE_URL}${pathname}</loc>`,
        `    <lastmod>${now}</lastmod>`,
        `    <changefreq>${pathname === '/' ? 'weekly' : 'monthly'}</changefreq>`,
        `    <priority>${pathname === '/' ? '0.8' : '0.7'}</priority>`,
        '  </url>'
      ].join('\n');
    }),
    '</urlset>'
  ].join('\n');
}

function serveFile(res, filePath) {
  if (!isPublicFilePath(filePath)) {
    sendText(res, 404, 'Not found');
    return;
  }

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
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };

  res.writeHead(200, {
    'Content-Type': types[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
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
const APP_ORIGIN = (() => {
  try {
    return new URL(APP_URL).origin;
  } catch (_) {
    return '';
  }
})();
const ALLOWED_CORS_ORIGINS = new Set([
  APP_ORIGIN,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8788',
  'http://127.0.0.1:8788',
].filter(Boolean));
const WELCOME_PROMO_URL = `${APP_URL}/assets/welcome-promo.jpg`;

function getAllowedCorsOrigin(req) {
  const origin = req && req.headers ? req.headers.origin : '';
  if (!origin) return '';
  return ALLOWED_CORS_ORIGINS.has(origin) ? origin : '';
}

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
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          logStructuredRateLimited('warn', 'telegram.api.invalid_json', method, {
            method,
            statusCode: res.statusCode || 0,
            error: toErrorMeta(e),
          });
          resolve({ ok: false });
        }
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
    photo: WELCOME_PROMO_URL,
    caption:
      `${greeting}\n\n` +
      'Блокнот Машиниста помогает спокойно вести свою рабочую историю.\n\n' +
      'В приложении можно:\n' +
      '📅 записывать смены и поездки\n' +
      '🕒 смотреть часы и историю по месяцам\n' +
      '💸 сверять расчёт по своим записям\n' +
      '📚 быстро открывать документы и инструкции\n' +
      '📝 сохранять заметки по сменам\n\n' +
      '🔒 Данные привязаны к твоему Telegram-аккаунту.\n\n' +
      'Открывай приложение по кнопке ниже.',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✈️ Открыть в Telegram', web_app: { url: APP_URL } }],
        [{ text: '🤖 Открыть бота', url: 'https://t.me/bloknot_mashinista_bot' }],
        [{ text: '🌐 Открыть в браузере', url: APP_URL }],
      ],
    },
  };
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname || '/';
  const telegramUserId = getUserIdFromRequest(req);
  const sid = telegramUserId ? normalizeSid(telegramUserId) : '';
  const allowedCorsOrigin = getAllowedCorsOrigin(req);

  if (allowedCorsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedCorsOrigin);
    res.setHeader('Vary', 'Origin');
  }
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
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
    const requestWebhookSecret = req.headers['x-telegram-bot-api-secret-token'] || '';
    if (!token) {
      sendJson(res, 500, { ok: false, error: 'no token' });
      return;
    }
    if (webhookSecret && requestWebhookSecret !== webhookSecret) {
      sendJson(res, 403, { ok: false, error: 'forbidden' });
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
          callTelegramApi(token, 'sendPhoto', buildWelcomeMessage(chatId, firstName))
            .then(result => {
              if (!result || result.ok !== true) {
                return callTelegramApi(token, 'sendMessage', {
                  chat_id: chatId,
                  text: (firstName ? `👋 Привет, ${firstName}!\n\n` : '👋 Привет!\n\n') +
                    'Блокнот Машиниста помогает вести смены, смотреть часы и хранить свою рабочую историю в одном месте.\n\nЕсли удобнее, начни через бота: https://t.me/bloknot_mashinista_bot',
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: '✈️ Открыть в Telegram', web_app: { url: APP_URL } }],
                      [{ text: '🤖 Открыть бота', url: 'https://t.me/bloknot_mashinista_bot' }],
                      [{ text: '🌐 Открыть в браузере', url: APP_URL }],
                    ],
                  },
                });
              }
              return null;
            })
            .catch((err) => {
              logStructuredRateLimited('error', 'telegram.webhook.send_welcome_failed', `welcome:${chatId || 'unknown'}`, {
                chatId: chatId || null,
                error: toErrorMeta(err),
              });
            });
        } else if (/^\/myid(?:@\w+)?$/i.test(normalizedText)) {
          callTelegramApi(token, 'sendMessage', {
            chat_id: chatId,
            text: `Ваш Telegram ID: ${String(fromUserId || '')}`,
          }).catch((err) => {
            logStructuredRateLimited('error', 'telegram.webhook.send_myid_failed', `myid:${chatId || 'unknown'}`, {
              chatId: chatId || null,
              error: toErrorMeta(err),
            });
          });
        } else {
          callTelegramApi(token, 'sendMessage', {
            chat_id: chatId,
            text: 'Используй кнопку «Открыть мини-апп» в сообщении или в меню бота.',
          }).catch((err) => {
            logStructuredRateLimited('error', 'telegram.webhook.send_default_reply_failed', `default:${chatId || 'unknown'}`, {
              chatId: chatId || null,
              error: toErrorMeta(err),
            });
          });
        }
      }
    } catch (err) {
      logStructuredRateLimited('error', 'telegram.webhook.request_failed', `webhook:${req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown'}`, {
        error: toErrorMeta(err),
      });
    }
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
        const params = new URLSearchParams(Object.entries(parsedUrl.query).map(([k, v]) => [k, String(v)]));
        const user = verifyTelegramLoginParams(params, botToken);
        if (!user) { sendJson(res, 401, { error: 'Telegram login verification failed' }); return; }
        const sessionToken = createSessionToken(user);
        const returnPath = safeRedirectTarget(parsedUrl.query.return);
        res.writeHead(302, {
          'Location': returnPath,
          'Cache-Control': 'no-store',
          'Set-Cookie': buildSessionCookie(sessionToken),
        });
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
        const sessionToken = createSessionToken(user);
        sendJson(res, 200, { user, sessionToken }, {
          'Set-Cookie': buildSessionCookie(sessionToken),
        });
      } catch (err) {
        logStructuredRateLimited('warn', 'auth.webapp.invalid_payload', 'auth.webapp.invalid_payload', {
          error: toErrorMeta(err),
        });
        sendJson(res, 400, { error: err.message || 'Invalid payload' });
      }
      return;
    }

    if (req.method === 'DELETE') {
      res.writeHead(204, {
        'Cache-Control': 'no-store',
        'Set-Cookie': buildSessionCookie('', 0),
      });
      res.end();
      return;
    }
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (pathname === '/api/shifts') {
    if (!sid) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, { sid, shifts: readShifts(sid) });
      return;
    }

    if (req.method === 'PUT') {
      try {
        const body = await readBody(req);
        const payload = body ? JSON.parse(body) : {};
        const shifts = sanitizeAndValidateShiftsPayload(payload);
        writeShifts(sid, shifts);
        sendJson(res, 200, { ok: true, sid, shifts });
      } catch (err) {
        const errorMessage = err && err.message ? err.message : 'Invalid payload';
        const isValidationError = /^(Expected|Too many|Invalid|Missing)/.test(errorMessage);
        logStructuredRateLimited(isValidationError ? 'warn' : 'error', 'storage.shifts.write_rejected', `${sid}:${errorMessage}`, {
          sid,
          error: toErrorMeta(err),
        });
        sendJson(res, isValidationError ? 400 : 500, { error: errorMessage });
      }
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (pathname === '/api/schedule') {
    if (!sid) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, { sid, schedule: readScheduleStore(sid) });
      return;
    }

    if (req.method === 'PUT') {
      try {
        const body = await readBody(req);
        const payload = body ? JSON.parse(body) : {};
        const schedule = sanitizeAndValidateSchedulePayload(payload);
        writeScheduleStore(sid, schedule);
        sendJson(res, 200, { ok: true, sid, schedule });
      } catch (err) {
        const errorMessage = err && err.message ? err.message : 'Invalid payload';
        const isValidationError = /^(Expected|Too many|Invalid|Missing)/.test(errorMessage);
        logStructuredRateLimited(isValidationError ? 'warn' : 'error', 'storage.schedule.write_rejected', `${sid}:${errorMessage}`, {
          sid,
          error: toErrorMeta(err),
        });
        sendJson(res, isValidationError ? 400 : 500, { error: errorMessage });
      }
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (pathname === '/api/stats') {
    if (!sid) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, readUserPresenceStats());
      return;
    }

    if (req.method === 'POST') {
      try {
        const body = await readBody(req);
        const payload = body ? JSON.parse(body) : {};
        const userId = normalizeStatsUserId(telegramUserId);
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
        logStructuredRateLimited('warn', 'stats.invalid_payload', 'stats.invalid_payload', {
          sid,
          error: toErrorMeta(err),
        });
        sendJson(res, 400, { error: err.message || 'Invalid payload' });
      }
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (pathname === '/robots.txt') {
    sendText(
      res,
      200,
      [
        'User-agent: *',
        'Allow: /',
        'Sitemap: ' + PUBLIC_SITE_URL + '/sitemap.xml'
      ].join('\n'),
      'text/plain; charset=utf-8'
    );
    return;
  }

  if (pathname === '/sitemap.xml') {
    sendText(res, 200, buildSeoSitemapXml(), 'application/xml; charset=utf-8');
    return;
  }

  if (SEO_PAGE_ROUTES[pathname]) {
    serveFile(res, path.join(ROOT, SEO_PAGE_ROUTES[pathname]));
    return;
  }

  let normalized;
  try {
    normalized = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  } catch (err) {
    logStructuredRateLimited('warn', 'http.bad_pathname', pathname, {
      pathname,
      error: toErrorMeta(err),
    });
    sendText(res, 400, 'Bad request');
    return;
  }

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
