const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createSqliteStorage } = require('./server/sqlite-storage');
const {
  ANALYTICS_POLICY_VERSION,
  ANALYTICS_RETENTION_DAYS,
  sanitizeAnalyticsBatch,
  sanitizeConsentPayload,
  isAnalyticsAdmin,
} = require('./server/analytics');

const ROOT = __dirname;

function loadDotEnvFile() {
  const envFile = path.join(ROOT, '.env');
  if (!fs.existsSync(envFile)) return;
  try {
    const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
    lines.forEach((line) => {
      const trimmed = String(line || '').trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
      const eqIndex = trimmed.indexOf('=');
      const key = trimmed.slice(0, eqIndex).trim();
      if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) return;
      let value = trimmed.slice(eqIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    });
  } catch (err) {
    console.warn('[env] failed to load .env:', err && err.message ? err.message : err);
  }
}

loadDotEnvFile();

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.resolve(process.env.APP_DATA_DIR || path.join(ROOT, 'data'));
const USERS_DIR = path.join(DATA_DIR, 'local-shifts');
const SALARY_PARAMS_DIR = path.join(DATA_DIR, 'local-salary-params');
const PROFILE_DIR = path.join(DATA_DIR, 'local-profiles');
const POEKHALI_WARNINGS_DIR = path.join(DATA_DIR, 'poekhali-warnings');
const USER_STATS_FILE = path.join(DATA_DIR, 'user-presence.json');
const LOGIN_REQUESTS_FILE = path.join(DATA_DIR, 'auth-login-requests.json');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');
const PARTNERSHIPS_FILE = path.join(DATA_DIR, 'partnerships.json');
const PARTNER_INVITES_FILE = path.join(DATA_DIR, 'partner-invites.json');
const PARTNER_STATE_DIR = path.join(DATA_DIR, 'partner-state');
const SHIFT_INBOX_DIR = path.join(DATA_DIR, 'shift-inbox');
const ADMIN_POEKHALI_MAP_FILE = path.join(DATA_DIR, 'admin-poekhali-map.json');
const DOCS_ROOT_DIR = path.join(ROOT, 'assets', 'docs');
const DOCS_STATIC_MANIFEST_FILE = path.join(DOCS_ROOT_DIR, 'manifest.json');
const DOCS_MANIFEST_FILE = path.join(DATA_DIR, 'docs-manifest.json');
const ADMIN_DOC_FILES_DIR = path.join(DATA_DIR, 'admin-docs');
const DOC_MIME_BY_EXTENSION = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};
const DOC_DISPLAY_META_BY_PATH = {
  '/assets/docs/instructions/1357р безопасное нахождение на ж.д. путях.docx': {
    title: 'Безопасное нахождение на ж.д. путях',
    caption: '1357р',
  },
  '/assets/docs/instructions/2580p.docx': {
    title: 'Действия в аварийных и нестандартных ситуациях',
    caption: '2580р от 12.12.2017',
  },
  '/assets/docs/instructions/ИОТ ТЧЭ-9-002-2023.pdf': {
    title: 'Инструкция по охране труда',
    caption: 'ИОТ ТЧЭ-9-002-2023',
  },
  '/assets/docs/instructions/ИОТ ТЧЭ-9-003-2023.pdf': {
    title: 'Инструкция по охране труда',
    caption: 'ИОТ ТЧЭ-9-003-2023',
  },
  '/assets/docs/instructions/ПТЭ приказ 250.pdf': {
    title: 'ПТЭ',
    caption: 'приказ 250',
  },
  '/assets/docs/instructions/Распоряжение ЦТ-5р Методика КСОТ-П.pdf': {
    title: 'Методика КСОТ-П',
    caption: 'Распоряжение ЦТ-5р',
  },
  '/assets/docs/speeds/Скоростя БАМ Парк Д Приказ № 161.pdf': {
    title: 'Скорости БАМ',
    caption: 'Приказ №161 от 27.02.2026',
  },
  '/assets/docs/speeds/Скоростя ВСГ Парк Д Приказ № 161.pdf': {
    title: 'Скорости ВСГ',
    caption: 'Приказ №161 от 27.02.2026',
  },
  '/assets/docs/speeds/Скоростя ВЛЧ Приказ № 161.pdf': {
    title: 'Скорости ВЛЧ',
    caption: 'Приказ №161 от 27.02.2026',
  },
  '/assets/docs/memos/БАМ кмс-пост-1.pdf': {
    title: 'Режимка БАМ',
    caption: '',
  },
  '/assets/docs/memos/ВСКГ- КСМ новый 2 пассажир.pdf': {
    title: 'Режимка ВСГ',
    caption: '',
  },
  '/assets/docs/memos/КСМ-ВЛЧ 2.pdf': {
    title: 'Режимка ВЛЧ',
    caption: '',
  },
};
const PUBLIC_TOP_LEVEL_FILES = new Set([
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'sw-bootstrap-v373.js',
  'sw-bootstrap-v374.js',
  'sw-bootstrap-v375.js',
  'sw-bootstrap-v376.js',
  'sw-bootstrap-v377.js',
  'sw-bootstrap-v378.js',
  'sw-bootstrap-v379.js',
  'sw-bootstrap-v380.js',
  'sw-bootstrap-v381.js',
  'sw-bootstrap-v382.js',
  'sw-bootstrap-v383.js',
  'sw-bootstrap-v384.js',
  'sw-bootstrap-v385.js',
  'sw-bootstrap-v386.js',
  'sw-bootstrap-v387.js',
  'sw-bootstrap-v388.js',
  'sw-bootstrap-v389.js',
  'sw-bootstrap-v390.js',
  'sw-bootstrap-v391.js',
  'sw-bootstrap-v392.js',
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
const MAX_SHIFT_FIELD_COUNT = 260;
const MAX_SHIFT_ID_LENGTH = 128;
const MAX_SHIFT_TEXT_LENGTH = 512;
const MAX_SHIFT_NOTES_LENGTH = 4000;
const MAX_SHIFT_ISO_LENGTH = 40;
const MAX_POEKHALI_WARNINGS_PER_PAYLOAD = 1000;
const MAX_POEKHALI_WARNING_ID_LENGTH = 128;
const MAX_POEKHALI_WARNING_TEXT_LENGTH = 240;
const DEFAULT_SALARY_PARAMS = {
  tariffRate: 380,
  monthlyNormHours: 0,
  nightPercent: 40,
  classPercent: 5,
  zonePercent: 0,
  bamPercent: 0,
  districtPercent: 30,
  northPercent: 50,
  localPercent: 20,
  komPerTrip: 0,
};
const SALARY_PARAM_KEYS = Object.keys(DEFAULT_SALARY_PARAMS);
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://bloknot-mashinista-bot.ru';
const TELEGRAM_BOT_USERNAME = (process.env.PUBLIC_TELEGRAM_BOT_USERNAME || 'bloknot_mashinista_bot').replace(/^@+/, '').trim();
const TELEGRAM_BOT_URL = normalizePublicUrl(process.env.PUBLIC_TELEGRAM_BOT_URL) || (TELEGRAM_BOT_USERNAME ? `https://t.me/${TELEGRAM_BOT_USERNAME}` : '');
const NEWS_CHANNEL_URL = normalizePublicUrl(process.env.PUBLIC_NEWS_CHANNEL_URL);
const DISCUSSION_CHAT_URL = normalizePublicUrl(process.env.PUBLIC_DISCUSSION_CHAT_URL);
const SUPPORT_ADMIN_CHAT_ID = String(process.env.TELEGRAM_SUPPORT_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID || '').trim();
const LOCAL_DEV_USER = {
  id: 'dev-local',
  first_name: 'Dev',
  last_name: '',
  username: 'devuser',
  display_name: 'Local Dev',
};

const SEO_PAGE_ROUTES = {
  '/uchet-marshrutov': 'docs/seo/uchet-marshrutov.html',
  '/zarplata-mashinista': 'docs/seo/zarplata-mashinista.html',
  '/zhurnal-smen-mashinista': 'docs/seo/zhurnal-smen-mashinista.html',
  '/kalkulyator-zarplaty-mashinista': 'docs/seo/zarplata-mashinista.html',
  '/grafik-smen-mashinista': 'docs/seo/grafik-smen-mashinista.html',
  '/prilozhenie-dlya-mashinista': 'docs/seo/prilozhenie-dlya-mashinista.html',
  '/dokumenty-mashinista': 'docs/seo/dokumenty-mashinista.html',
  '/brigada-mashinista': 'docs/seo/brigada-mashinista.html',
  '/poekhali-rezhim': 'docs/seo/poekhali-rezhim.html',
};

let userPresenceStoreCache = null;
let userPresenceStoreLoaded = false;
let userPresenceStoreDirty = false;
let userPresenceStoreFlushTimer = null;
let userPresenceStoreWriteInFlight = false;
let userPresenceStoreFlushQueued = false;

function normalizePublicUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'tg:') {
      return parsed.toString();
    }
  } catch (_) {}
  return '';
}

let shiftUserIdsCache = new Set();
let shiftUserIdsCacheExpiresAtMs = 0;
const structuredLogRateLimit = new Map();
let appStorage = null;
let storageBackupTimer = null;

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
const LOGIN_REQUEST_TTL_MS = 15 * 60 * 1000;
const PARTNER_INVITE_TTL_MS = 30 * 60 * 1000; // codes are read aloud, kept short-lived
const MAX_PARTNERSHIPS_PER_USER = 50;
const MAX_INBOX_ITEMS_PER_USER = 200;
const REDEEM_RATE_LIMIT_MAX = 12; // redeem attempts per window, per account
const REDEEM_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

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

function isLocalRequest(req) {
  const host = String((req && req.headers && req.headers.host) || '').split(':')[0].toLowerCase();
  const remote = String((req && req.socket && req.socket.remoteAddress) || '').toLowerCase();
  return host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    remote === '127.0.0.1' ||
    remote === '::1' ||
    remote === '::ffff:127.0.0.1';
}

function isLocalAuthBypassEnabled(req) {
  if (process.env.AUTH_DISABLED === '1' || process.env.LOCAL_AUTH_BYPASS === '1') return true;
  if (process.env.NODE_ENV === 'production') return false;
  return isLocalRequest(req);
}

function getLocalDevUserFromRequest(req) {
  return isLocalAuthBypassEnabled(req) ? { ...LOCAL_DEV_USER } : null;
}

function getUserFromRequest(req) {
  const localDevUser = getLocalDevUserFromRequest(req);
  if (localDevUser) return localDevUser;
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

function initializeStorage() {
  if (appStorage) return appStorage;
  ensureDirs();
  appStorage = createSqliteStorage({
    dataDir: DATA_DIR,
    logger(event, meta) {
      logStructured('info', event, meta);
    },
  });
  const report = appStorage.importLegacyJson({
    globalFiles: [
      { path: LOGIN_REQUESTS_FILE, key: 'auth_login_requests', fallback: {} },
      { path: FEEDBACK_FILE, key: 'feedback', fallback: [] },
      { path: PARTNERSHIPS_FILE, key: 'partnerships', fallback: { pairings: {} } },
      { path: PARTNER_INVITES_FILE, key: 'partner_invites', fallback: {} },
      { path: USER_STATS_FILE, key: 'user_presence', fallback: { users: {}, sessions: {} } },
      { path: ADMIN_POEKHALI_MAP_FILE, key: 'admin_poekhali_map', fallback: null },
      { path: DOCS_MANIFEST_FILE, key: 'docs_manifest', fallback: null },
    ],
    userDirectories: [
      { path: USERS_DIR, kind: 'shifts', fallback: [] },
      { path: SALARY_PARAMS_DIR, kind: 'salary_params', fallback: {} },
      { path: PROFILE_DIR, kind: 'profile', fallback: {} },
      { path: POEKHALI_WARNINGS_DIR, kind: 'poekhali_warnings', fallback: [] },
      { path: PARTNER_STATE_DIR, kind: 'partner_state', fallback: {} },
      { path: SHIFT_INBOX_DIR, kind: 'shift_inbox', fallback: [] },
    ],
  });

  if (process.env.DISABLE_STORAGE_BACKUPS !== '1') {
    if (report.imported.length) {
      appStorage.createBackup('legacy-import').catch((error) => {
        logStructuredRateLimited('error', 'storage.backup_failed', 'legacy-import', { error: toErrorMeta(error) });
      });
    }
    storageBackupTimer = setInterval(() => {
      appStorage.createBackup('automatic').catch((error) => {
        logStructuredRateLimited('error', 'storage.backup_failed', 'automatic', { error: toErrorMeta(error) });
      });
    }, 24 * 60 * 60 * 1000);
    if (typeof storageBackupTimer.unref === 'function') storageBackupTimer.unref();
  }
  return appStorage;
}

function getStorage() {
  return appStorage || initializeStorage();
}

function closeStorage() {
  if (storageBackupTimer) {
    clearInterval(storageBackupTimer);
    storageBackupTimer = null;
  }
  if (appStorage) {
    appStorage.close();
    appStorage = null;
  }
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

  const scheduleFieldSet = new Set([
    'schedule_generated',
    'isScheduleDerived',
    'schedule_period_id',
    'schedule_origin_date_key',
    'schedule_origin_period_id',
    'schedule_code',
    'scheduleDateKey',
  ]);
  const sanitizedInput = {};
  Object.keys(shift).forEach((key) => {
    if (scheduleFieldSet.has(key)) return;
    sanitizedInput[key] = shift[key];
  });

  const keys = Object.keys(sanitizedInput);
  if (!keys.length || keys.length > MAX_SHIFT_FIELD_COUNT) {
    throw new Error(`Invalid shift at index ${index}`);
  }

  const sanitized = {};
  keys.forEach((key) => {
    if (key === 'pending') return;
    const value = sanitizedInput[key];
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
  if (!fs.existsSync(SALARY_PARAMS_DIR)) {
    fs.mkdirSync(SALARY_PARAMS_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROFILE_DIR)) {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
  }
  if (!fs.existsSync(POEKHALI_WARNINGS_DIR)) {
    fs.mkdirSync(POEKHALI_WARNINGS_DIR, { recursive: true });
  }
  if (!fs.existsSync(PARTNER_STATE_DIR)) {
    fs.mkdirSync(PARTNER_STATE_DIR, { recursive: true });
  }
  if (!fs.existsSync(SHIFT_INBOX_DIR)) {
    fs.mkdirSync(SHIFT_INBOX_DIR, { recursive: true });
  }
}

function normalizeSid(rawSid) {
  const sid = String(rawSid || 'default').trim();
  const safe = sid.replace(/[^a-zA-Z0-9_-]/g, '_');
  return safe.length > 0 ? safe : 'default';
}

function readLoginRequestsStore() {
  try {
    const parsed = getStorage().readAppState('auth_login_requests', {});
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    logStructuredRateLimited('error', 'auth.login_requests.read_failed', LOGIN_REQUESTS_FILE, {
      file: LOGIN_REQUESTS_FILE,
      error: toErrorMeta(err),
    });
    return {};
  }
}

function writeLoginRequestsStore(store) {
  getStorage().writeAppState('auth_login_requests', store || {});
}

function pruneLoginRequestsStore(store) {
  const source = store && typeof store === 'object' ? store : {};
  const now = Date.now();
  const next = {};
  Object.keys(source).forEach((requestId) => {
    const item = source[requestId] || {};
    const expiresAtMs = Date.parse(item.expiresAt || '');
    const consumedAtMs = Date.parse(item.consumedAt || '');
    if (Number.isFinite(consumedAtMs) && now - consumedAtMs > 60 * 1000) return;
    if (Number.isFinite(expiresAtMs) && expiresAtMs < now - 60 * 1000) return;
    next[requestId] = item;
  });
  return next;
}

function createPwaLoginRequest(returnPath) {
  const requestId = crypto.randomBytes(18).toString('hex');
  const store = pruneLoginRequestsStore(readLoginRequestsStore());
  const nowIso = new Date().toISOString();
  store[requestId] = {
    id: requestId,
    createdAt: nowIso,
    expiresAt: new Date(Date.now() + LOGIN_REQUEST_TTL_MS).toISOString(),
    returnPath: safeRedirectTarget(returnPath),
    status: 'pending',
    user: null,
    approvedAt: '',
    consumedAt: '',
  };
  writeLoginRequestsStore(store);
  return store[requestId];
}

function approvePwaLoginRequest(requestId, user) {
  if (!requestId || !user || !user.id) return null;
  const store = pruneLoginRequestsStore(readLoginRequestsStore());
  const item = store[requestId];
  if (!item) return null;
  const expiresAtMs = Date.parse(item.expiresAt || '');
  if (Number.isFinite(expiresAtMs) && expiresAtMs < Date.now()) {
    delete store[requestId];
    writeLoginRequestsStore(store);
    return null;
  }
  item.status = 'approved';
  item.user = {
    id: String(user.id),
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    username: user.username || '',
    photo_url: user.photo_url || '',
    display_name: user.display_name || [user.first_name || '', user.last_name || ''].join(' ').trim() || user.username || ('ID ' + user.id),
  };
  item.approvedAt = new Date().toISOString();
  store[requestId] = item;
  writeLoginRequestsStore(store);
  return item;
}

function consumePwaLoginRequest(requestId) {
  if (!requestId) return { status: 'missing' };
  const store = pruneLoginRequestsStore(readLoginRequestsStore());
  const item = store[requestId];
  if (!item) {
    writeLoginRequestsStore(store);
    return { status: 'missing' };
  }
  const expiresAtMs = Date.parse(item.expiresAt || '');
  if (Number.isFinite(expiresAtMs) && expiresAtMs < Date.now()) {
    delete store[requestId];
    writeLoginRequestsStore(store);
    return { status: 'expired' };
  }
  if (item.status !== 'approved' || !item.user || !item.user.id) {
    writeLoginRequestsStore(store);
    return { status: 'pending' };
  }
  item.status = 'consumed';
  item.consumedAt = new Date().toISOString();
  store[requestId] = item;
  writeLoginRequestsStore(store);
  return { status: 'approved', user: item.user, returnPath: safeRedirectTarget(item.returnPath) };
}

// ── Crew partner pairing (Phase 1: linking, address book, active pointer) ──

function displayNameFromSessionUser(user) {
  if (!user || typeof user !== 'object') return '';
  const explicit = String(user.display_name || '').trim();
  if (explicit) return explicit;
  const composed = [user.first_name || '', user.last_name || ''].join(' ').trim();
  if (composed) return composed;
  const uname = String(user.username || '').trim();
  if (uname) return uname;
  return user.id ? ('ID ' + String(user.id)) : '';
}

function displayNameFromProfile(profile) {
  const firstName = String(profile && profile.firstName ? profile.firstName : '').trim();
  const lastName = String(profile && profile.lastName ? profile.lastName : '').trim();
  return [firstName, lastName].join(' ').trim();
}

function displayNameForSid(sid, user) {
  const profileName = sid ? displayNameFromProfile(readProfile(sid)) : '';
  return profileName || displayNameFromSessionUser(user);
}

function readPartnershipsStore() {
  const store = getStorage().readAppState('partnerships', { pairings: {} });
  if (!store.pairings || typeof store.pairings !== 'object' || Array.isArray(store.pairings)) {
    store.pairings = {};
  }
  return store;
}

function writePartnershipsStore(store) {
  getStorage().writeAppState('partnerships', store || { pairings: {} });
}

function updatePartnerLabelsForSid(sid, label) {
  const normalizedSid = normalizeSid(sid);
  const nextLabel = String(label || '').trim();
  if (!normalizedSid || !nextLabel) return;
  const store = readPartnershipsStore();
  const pairings = store.pairings || {};
  let changed = false;
  Object.keys(pairings).forEach((id) => {
    const pairing = pairings[id];
    if (!pairing || pairing.status !== 'active' || !Array.isArray(pairing.members) || !pairing.members.includes(normalizedSid)) return;
    if (!pairing.labels || typeof pairing.labels !== 'object' || Array.isArray(pairing.labels)) {
      pairing.labels = {};
    }
    if (pairing.labels[normalizedSid] !== nextLabel) {
      pairing.labels[normalizedSid] = nextLabel;
      changed = true;
    }
  });
  if (changed) writePartnershipsStore(store);
}

function readPartnerInvitesStore() {
  const store = getStorage().readAppState('partner_invites', {});
  return store && typeof store === 'object' && !Array.isArray(store) ? store : {};
}

function writePartnerInvitesStore(store) {
  getStorage().writeAppState('partner_invites', store || {});
}

function prunePartnerInvitesStore(store) {
  const source = store && typeof store === 'object' ? store : {};
  const now = Date.now();
  const next = {};
  Object.keys(source).forEach((code) => {
    const item = source[code] || {};
    if (item.consumedAt) return;
    const expiresAtMs = Date.parse(item.expiresAt || '');
    if (Number.isFinite(expiresAtMs) && expiresAtMs < now) return;
    next[code] = item;
  });
  return next;
}

function readPartnerState(sid) {
  const state = getStorage().readUserState('partner_state', normalizeSid(sid), {});
  return { activePairingId: typeof state.activePairingId === 'string' ? state.activePairingId : '' };
}

function writePartnerState(sid, state) {
  const payload = { activePairingId: state && typeof state.activePairingId === 'string' ? state.activePairingId : '' };
  getStorage().writeUserState('partner_state', normalizeSid(sid), payload);
}

// Codes are dictated aloud in a noisy cab, so they are digits only (easy to say,
// no letter/locale confusion). Six digits, short-lived and single-use.
function generatePartnerInviteCode(existing) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i += 1) {
      code += String(bytes[i] % 10);
    }
    if (!existing || !existing[code]) return code;
  }
  return String(100000 + (crypto.randomBytes(3).readUIntBE(0, 3) % 900000));
}

function findActivePairingBetween(store, sidA, sidB) {
  const pairings = store.pairings || {};
  return Object.keys(pairings).find((id) => {
    const p = pairings[id];
    return p && p.status === 'active' && Array.isArray(p.members) &&
      p.members.includes(sidA) && p.members.includes(sidB);
  }) || '';
}

function listUserPairingIds(store, sid) {
  const pairings = store.pairings || {};
  return Object.keys(pairings).filter((id) => {
    const p = pairings[id];
    return p && p.status === 'active' && Array.isArray(p.members) && p.members.includes(sid);
  });
}

// Shape a pairing for the requesting user: surface the *other* member and trust direction.
function presentPairingForUser(pairing, sid, activePairingId) {
  const partnerSid = (pairing.members || []).find((m) => m !== sid) || '';
  const labels = pairing.labels || {};
  const trust = pairing.trust || {};
  return {
    pairingId: pairing.id,
    partnerLabel: labels[partnerSid] || ('ID ' + partnerSid),
    isActive: pairing.id === activePairingId,
    iTrustPartner: trust[sid] === 'trusted',
    partnerTrustsMe: trust[partnerSid] === 'trusted',
    createdAt: pairing.createdAt || '',
  };
}

// Only neutral, factual shift fields cross between crew members. Money/rates are
// never shared (each person's pay is computed locally from their own salary params),
// and personal poekhali tracking stays private.
const SHARED_SHIFT_FACT_KEYS = new Set([
  'start_msk', 'end_msk',
  'locomotive_series', 'locomotive_number',
  'train_number', 'train_weight', 'train_axles', 'train_length',
  'notes', 'route_kind', 'route_from', 'route_to', 'code',
  'fuel_receive_coeff', 'fuel_receive_coeff_a', 'fuel_receive_coeff_b', 'fuel_receive_coeff_v',
  'fuel_receive_liters_a', 'fuel_receive_liters_b', 'fuel_receive_liters_v',
  'fuel_handover_coeff', 'fuel_handover_coeff_a', 'fuel_handover_coeff_b', 'fuel_handover_coeff_v',
  'fuel_handover_liters_a', 'fuel_handover_liters_b', 'fuel_handover_liters_v',
]);

function sanitizeSharedShiftFacts(shift) {
  if (!shift || typeof shift !== 'object' || Array.isArray(shift)) {
    throw new Error('Invalid shift payload');
  }
  const facts = {};
  SHARED_SHIFT_FACT_KEYS.forEach((key) => {
    const value = shift[key];
    if (value === undefined || value === null || value === '') return;
    if (key === 'start_msk' || key === 'end_msk') {
      validateIsoLikeString(value, key);
    } else if (key === 'notes') {
      validateShiftText(value, key, MAX_SHIFT_NOTES_LENGTH);
    } else if (typeof value === 'string') {
      validateShiftText(value, key, MAX_SHIFT_TEXT_LENGTH);
    } else if (typeof value === 'number') {
      validateShiftNumber(value, key);
    } else {
      return; // booleans / other types are not part of shared facts
    }
    facts[key] = value;
  });
  if (!facts.start_msk || !facts.end_msk) {
    throw new Error('Missing shift times');
  }
  return facts;
}

function readShiftInbox(sid) {
  try {
    const parsed = getStorage().readUserState('shift_inbox', normalizeSid(sid), []);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logStructuredRateLimited('error', 'storage.inbox.read_failed', normalizeSid(sid), { sid: normalizeSid(sid), error: toErrorMeta(err) });
    return [];
  }
}

function writeShiftInbox(sid, items) {
  const list = Array.isArray(items) ? items.slice(-MAX_INBOX_ITEMS_PER_USER) : [];
  getStorage().writeUserState('shift_inbox', normalizeSid(sid), list);
}

// In-memory throttle so a numeric redeem code cannot be brute-forced. Per account.
const redeemAttemptsBySid = new Map();
function allowRedeemAttempt(sid) {
  const now = Date.now();
  const recent = (redeemAttemptsBySid.get(sid) || []).filter((t) => now - t < REDEEM_RATE_LIMIT_WINDOW_MS);
  if (recent.length >= REDEEM_RATE_LIMIT_MAX) {
    redeemAttemptsBySid.set(sid, recent);
    return false;
  }
  recent.push(now);
  redeemAttemptsBySid.set(sid, recent);
  if (redeemAttemptsBySid.size > 5000) redeemAttemptsBySid.clear(); // crude cap
  return true;
}

function sanitizeAndValidateSalaryParamsPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Expected JSON object payload');
  }
  const source = payload.salaryParams && typeof payload.salaryParams === 'object' && !Array.isArray(payload.salaryParams)
    ? payload.salaryParams
    : payload;
  const result = {};
  SALARY_PARAM_KEYS.forEach((key) => {
    const rawValue = source[key];
    const parsed = rawValue === '' || rawValue === null || rawValue === undefined
      ? DEFAULT_SALARY_PARAMS[key]
      : Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1000000) {
      throw new Error(`Invalid salary param ${key}`);
    }
    result[key] = parsed;
  });
  return result;
}

function readSalaryParams(sid) {
  try {
    return sanitizeAndValidateSalaryParamsPayload(
      getStorage().readUserState('salary_params', normalizeSid(sid), DEFAULT_SALARY_PARAMS)
    );
  } catch (err) {
    logStructuredRateLimited('error', 'storage.salary_params.read_failed', normalizeSid(sid), {
      sid: normalizeSid(sid),
      error: toErrorMeta(err),
    });
    return { ...DEFAULT_SALARY_PARAMS };
  }
}

function writeSalaryParams(sid, salaryParams) {
  getStorage().writeUserState(
    'salary_params',
    normalizeSid(sid),
    sanitizeAndValidateSalaryParamsPayload(salaryParams)
  );
}

const DEFAULT_PROFILE = { firstName: '', lastName: '', role: '', depot: '', avatar: '' };
// Avatar is stored as a data URL (cropped image) or a remote https URL. Cap the
// size so a single profile file can't balloon: ~1.5MB of base64 ≈ ~1.1MB image.
const PROFILE_AVATAR_MAX_LEN = 1500000;
const PROFILE_TEXT_MAX_LEN = 120;
const PROFILE_NAME_MAX_LEN = 80;

function sanitizeProfileText(value, maxLen = PROFILE_TEXT_MAX_LEN) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function sanitizeProfilePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Expected JSON object payload');
  }
  const source = payload.profile && typeof payload.profile === 'object' && !Array.isArray(payload.profile)
    ? payload.profile
    : payload;

  const firstName = sanitizeProfileText(source.firstName == null ? source.first_name : source.firstName, PROFILE_NAME_MAX_LEN);
  const lastName = sanitizeProfileText(source.lastName == null ? source.last_name : source.lastName, PROFILE_NAME_MAX_LEN);
  const role = sanitizeProfileText(source.role, PROFILE_TEXT_MAX_LEN);
  const depot = sanitizeProfileText(source.depot, PROFILE_TEXT_MAX_LEN);

  let avatar = String(source.avatar == null ? '' : source.avatar).trim();
  if (avatar) {
    if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(avatar) && !/^https:\/\//i.test(avatar)) {
      throw new Error('Invalid avatar: expected data:image URL or https URL');
    }
    if (avatar.length > PROFILE_AVATAR_MAX_LEN) {
      throw new Error('Invalid avatar: image too large');
    }
  }

  return { firstName, lastName, role, depot, avatar };
}

function readProfile(sid) {
  try {
    return sanitizeProfilePayload(getStorage().readUserState('profile', normalizeSid(sid), DEFAULT_PROFILE));
  } catch (err) {
    logStructuredRateLimited('error', 'storage.profile.read_failed', normalizeSid(sid), {
      sid: normalizeSid(sid),
      error: toErrorMeta(err),
    });
    return { ...DEFAULT_PROFILE };
  }
}

function writeProfile(sid, profile) {
  getStorage().writeUserState('profile', normalizeSid(sid), sanitizeProfilePayload(profile));
}

function normalizeDateOnly(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(text)) return text.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return '';
}

function normalizeIsoish(value) {
  const text = String(value || '').trim();
  return text && text.length <= MAX_SHIFT_ISO_LENGTH ? text : '';
}

function sanitizePoekhaliWarningItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const sector = Number(item.sector);
  const start = Number(item.start);
  const end = Number(item.end);
  const speed = Number(item.speed);
  if (!Number.isFinite(sector) || !Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(speed)) return null;

  const left = Math.min(Math.max(0, Math.round(start)), Math.max(0, Math.round(end)));
  let right = Math.max(Math.max(0, Math.round(start)), Math.max(0, Math.round(end)));
  if (left === right) right = left + 100;

  const nowIso = new Date().toISOString();
  const id = String(item.id || '').trim().slice(0, MAX_POEKHALI_WARNING_ID_LENGTH);
  if (!id) return null;

  return {
    id,
    mapId: String(item.mapId || '').trim().slice(0, MAX_SHIFT_ID_LENGTH),
    shiftId: String(item.shiftId || '').trim().slice(0, MAX_SHIFT_ID_LENGTH),
    sector,
    coordinate: left,
    start: left,
    end: right,
    length: Math.max(0, right - left),
    speed: Math.max(1, Math.min(200, Math.round(speed))),
    name: String(item.name || item.note || '').trim().slice(0, MAX_POEKHALI_WARNING_TEXT_LENGTH),
    note: String(item.note || item.name || '').trim().slice(0, MAX_POEKHALI_WARNING_TEXT_LENGTH),
    enabled: item.enabled !== false,
    validUntil: normalizeDateOnly(item.validUntil || item.until || item.dateTo),
    createdAt: normalizeIsoish(item.createdAt) || nowIso,
    updatedAt: normalizeIsoish(item.updatedAt) || normalizeIsoish(item.createdAt) || nowIso,
    deletedAt: normalizeIsoish(item.deletedAt),
    source: 'warning',
  };
}

function sanitizeAndValidatePoekhaliWarningsPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Expected JSON object payload');
  }
  const source = Array.isArray(payload.warnings) ? payload.warnings : [];
  if (source.length > MAX_POEKHALI_WARNINGS_PER_PAYLOAD) {
    throw new Error('Too many Poekhali warnings');
  }
  return source
    .map((item) => sanitizePoekhaliWarningItem(item))
    .filter(Boolean)
    .sort((a, b) => {
      if (a.mapId !== b.mapId) return a.mapId.localeCompare(b.mapId);
      if (a.shiftId !== b.shiftId) return a.shiftId.localeCompare(b.shiftId);
      if (a.sector !== b.sector) return a.sector - b.sector;
      if (a.start !== b.start) return a.start - b.start;
      return a.id.localeCompare(b.id);
    });
}

function readPoekhaliWarnings(sid) {
  try {
    return sanitizeAndValidatePoekhaliWarningsPayload({
      warnings: getStorage().readUserState('poekhali_warnings', normalizeSid(sid), []),
    });
  } catch (err) {
    logStructuredRateLimited('error', 'storage.poekhali_warnings.read_failed', normalizeSid(sid), {
      sid: normalizeSid(sid),
      error: toErrorMeta(err),
    });
    return [];
  }
}

function writePoekhaliWarnings(sid, warnings) {
  const normalized = sanitizeAndValidatePoekhaliWarningsPayload({ warnings: Array.isArray(warnings) ? warnings : [] });
  getStorage().writeUserState('poekhali_warnings', normalizeSid(sid), normalized);
  return normalized;
}

function readShifts(sid) {
  try {
    const parsed = getStorage().readShifts(normalizeSid(sid));
    if (!Array.isArray(parsed)) {
      logStructuredRateLimited('warn', 'storage.shifts.invalid_shape', normalizeSid(sid), { sid: normalizeSid(sid) });
      return [];
    }
    return parsed;
  } catch (err) {
    logStructuredRateLimited('error', 'storage.shifts.read_failed', normalizeSid(sid), {
      sid: normalizeSid(sid),
      error: toErrorMeta(err),
    });
    return [];
  }
}

function writeShifts(sid, shifts) {
  getStorage().replaceShifts(normalizeSid(sid), Array.isArray(shifts) ? shifts : []);
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
    getStorage().listShiftUserIds().forEach((rawSid) => {
      const uid = normalizeStatsUserId(rawSid);
      if (!uid || uid === 'default') return;
      next.add(uid);
    });
  } catch (e) {
    logStructuredRateLimited('error', 'storage.shifts.list_user_ids_failed', 'sqlite', {
      error: toErrorMeta(e),
    });
  }

  shiftUserIdsCache = next;
  shiftUserIdsCacheExpiresAtMs = nowMs + SHIFT_USER_IDS_CACHE_TTL_MS;
  return shiftUserIdsCache;
}

const KNOWN_PLATFORMS = new Set(['ios', 'android', 'desktop', 'unknown']);

function normalizePlatform(value) {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return KNOWN_PLATFORMS.has(v) ? v : 'unknown';
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
      platform: normalizePlatform(row.platform),
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
        platform: 'unknown',
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
  try {
    const parsed = getStorage().readAppState('user_presence', { users: {}, sessions: {} });
    return sanitizeUserPresenceStore(parsed);
  } catch (err) {
    logStructuredRateLimited('error', 'storage.user_presence.read_failed', 'sqlite', {
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

  userPresenceStoreWriteInFlight = true;
  userPresenceStoreDirty = false;
  const snapshot = sanitizeUserPresenceStore(userPresenceStoreCache);
  let err = null;
  try {
    getStorage().writeAppState('user_presence', snapshot);
  } catch (error) {
    err = error;
  }
  {
    userPresenceStoreWriteInFlight = false;
    if (err) {
      userPresenceStoreDirty = true;
      logStructuredRateLimited('error', 'storage.user_presence.write_failed', 'sqlite', {
        error: toErrorMeta(err),
      });
    } else {
      userPresenceStoreCache = snapshot;
    }

    if (userPresenceStoreDirty || userPresenceStoreFlushQueued) {
      userPresenceStoreFlushQueued = false;
      scheduleUserPresenceStoreFlush(USER_PRESENCE_FLUSH_DELAY_MS);
    }
  }
}

function flushUserPresenceStoreSyncOnShutdown() {
  if (!userPresenceStoreLoaded || !userPresenceStoreCache || !userPresenceStoreDirty) return;
  if (userPresenceStoreFlushTimer) {
    clearTimeout(userPresenceStoreFlushTimer);
    userPresenceStoreFlushTimer = null;
  }
  try {
    const snapshot = sanitizeUserPresenceStore(userPresenceStoreCache);
    getStorage().writeAppState('user_presence', snapshot);
    userPresenceStoreCache = snapshot;
    userPresenceStoreDirty = false;
  } catch (e) {
    logStructuredRateLimited('error', 'storage.user_presence.shutdown_flush_failed', 'sqlite', {
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

  const platforms = { ios: 0, android: 0, desktop: 0, unknown: 0 };
  allUserIds.forEach(uid => {
    const platform = normalizePlatform((users[uid] || {}).platform);
    platforms[platform] = (platforms[platform] || 0) + 1;
  });

  return {
    totalUsers: allUserIds.size,
    onlineUsers: Object.keys(onlineUserMap).length,
    onlineWindowSeconds: Math.floor(ONLINE_WINDOW_MS / 1000),
    platforms,
    updatedAt: new Date().toISOString(),
  };
}

function readUserPresenceStats() {
  return buildUserPresenceStats(readUserPresenceStore());
}

function readJsonFileForAdmin(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    logStructuredRateLimited('warn', 'admin.read_json_failed', filePath, {
      file: filePath,
      error: toErrorMeta(err),
    });
    return fallback;
  }
}

function readDocsManifestForAdmin() {
  const dynamicManifest = getStorage().readAppState('docs_manifest', null);
  if (dynamicManifest && typeof dynamicManifest === 'object' && !Array.isArray(dynamicManifest)) {
    return enrichDocsManifestDisplay(sanitizeDocsManifest(dynamicManifest), false);
  }
  return enrichDocsManifestDisplay(sanitizeDocsManifest(readJsonFileForAdmin(DOCS_STATIC_MANIFEST_FILE, {})), true);
}

function sendDocsManifest(res) {
  sendJson(res, 200, readDocsManifestForAdmin());
}

function enrichDocsManifestDisplay(manifest, forceKnownTitles) {
  const source = manifest && typeof manifest === 'object' && !Array.isArray(manifest) ? manifest : {};
  const result = {};
  Object.keys(source).forEach(category => {
    if (!Array.isArray(source[category])) return;
    result[category] = source[category].map(item => {
      const row = item && typeof item === 'object' && !Array.isArray(item) ? { ...item } : {};
      const meta = DOC_DISPLAY_META_BY_PATH[row.path] || null;
      if (meta) {
        if (forceKnownTitles || !String(row.name || '').trim()) {
          row.name = meta.title;
        }
        if (!String(row.caption || '').trim()) {
          row.caption = meta.caption;
        }
      }
      return row;
    });
  });
  return result;
}

function getDefaultPoekhaliMapConfig() {
  return {
    version: 1,
    routes: [
      { id: 'bam-silinka-halgaso', title: 'Силинка - Хальгасо', sector: 18, start: 3787846, end: 3801977, kind: 'route' },
      { id: 'bam-holoni', title: 'Холони', sector: 18, start: 3751329, end: 3775256, kind: 'station' },
      { id: 'bam-halgaso-lian-holoni', title: 'Хальгасо - Лиан - Холони', sector: 18, start: 3763395, end: 3789976, kind: 'route' },
    ],
    speedRules: [],
    objects: [],
    updatedAt: '',
  };
}

function sanitizePoekhaliMapConfig(payload) {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const defaults = getDefaultPoekhaliMapConfig();
  const normalizeId = (value, fallback) => String(value || fallback).trim().replace(/[^\w.-]+/g, '-').slice(0, 80) || fallback;
  const normalizeNumber = (value, fallback, min, max) => {
    const number = Math.round(Number(value));
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  };
  const routes = (Array.isArray(source.routes) ? source.routes : defaults.routes).slice(0, 80).map((item, index) => {
    const row = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
    const start = normalizeNumber(row.start, 0, 0, 10000000);
    const end = normalizeNumber(row.end, start + 100, 0, 10000000);
    return {
      id: normalizeId(row.id, `route-${index + 1}`),
      title: String(row.title || '').trim().slice(0, 140),
      sector: normalizeNumber(row.sector, 18, 1, 999999),
      start: Math.min(start, end),
      end: Math.max(start, end),
      kind: String(row.kind || 'route').trim().slice(0, 40),
    };
  }).filter(item => item.title);
  const speedRules = (Array.isArray(source.speedRules) ? source.speedRules : []).slice(0, 500).map((item, index) => {
    const row = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
    const start = normalizeNumber(row.start || row.coordinate, 0, 0, 10000000);
    const end = normalizeNumber(row.end, start, 0, 10000000);
    const left = Math.min(start, end);
    const right = Math.max(start, end);
    return {
      id: normalizeId(row.id, `speed-${index + 1}`),
      routeId: normalizeId(row.routeId, ''),
      sector: normalizeNumber(row.sector, 18, 1, 999999),
      coordinate: left,
      start: left,
      end: right,
      length: Math.max(0, right - left),
      speed: normalizeNumber(row.speed, 60, 5, 160),
      wayNumber: row.wayNumber ? normalizeNumber(row.wayNumber, 0, 1, 2) : 0,
      name: String(row.name || '').trim().slice(0, 160),
    };
  }).filter(item => item.routeId && item.end >= item.start);
  const objects = (Array.isArray(source.objects) ? source.objects : []).slice(0, 500).map((item, index) => {
    const row = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
    const coordinate = normalizeNumber(row.coordinate, 0, 0, 10000000);
    const length = normalizeNumber(row.length, 0, 0, 5000);
    return {
      id: normalizeId(row.id, `object-${index + 1}`),
      routeId: normalizeId(row.routeId, ''),
      sector: normalizeNumber(row.sector, 18, 1, 999999),
      type: String(row.type || '1').trim().slice(0, 8),
      coordinate,
      length,
      end: coordinate + length,
      name: String(row.name || '').trim().slice(0, 160),
      wayNumber: row.wayNumber ? normalizeNumber(row.wayNumber, 0, 1, 2) : 0,
    };
  }).filter(item => item.routeId && item.name);
  return {
    version: 1,
    routes,
    speedRules,
    objects,
    updatedAt: String(source.updatedAt || '').slice(0, 40),
  };
}

function readPoekhaliMapConfig() {
  return sanitizePoekhaliMapConfig(
    getStorage().readAppState('admin_poekhali_map', getDefaultPoekhaliMapConfig())
  );
}

function sanitizeDocsManifest(payload) {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const result = {};
  Object.keys(source).forEach(category => {
    const safeCategory = sanitizeDocsCategory(category);
    if (!safeCategory || !Array.isArray(source[category])) return;
    result[safeCategory] = source[category].slice(0, 300).map(item => {
      const row = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
      return {
        name: String(row.name || '').trim().slice(0, 180),
        caption: String(row.caption || row.subtitle || '').trim().slice(0, 280),
        path: String(row.path || '').trim().slice(0, 500),
        mime_type: String(row.mime_type || '').trim().slice(0, 120),
        size: Math.max(0, Math.round(Number(row.size) || 0)),
        updated_at: String(row.updated_at || '').trim().slice(0, 40),
      };
    }).filter(item => item.name && (item.path.startsWith('/assets/docs/') || item.path.startsWith('/admin-docs/')));
  });
  return result;
}

function sanitizeDocsCategory(category) {
  return String(category || '').trim().replace(/[^\w-]+/g, '').slice(0, 40);
}

async function handlePartnersApi(req, res, pathname, sid, user) {
  if (!sid) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  // POST /api/partners/invite → generate a short code the partner types in.
  if (pathname === '/api/partners/invite' && req.method === 'POST') {
    const store = prunePartnerInvitesStore(readPartnerInvitesStore());
    const code = generatePartnerInviteCode(store);
    const nowIso = new Date().toISOString();
    store[code] = {
      code,
      inviterSid: sid,
      inviterName: displayNameForSid(sid, user),
      createdAt: nowIso,
      expiresAt: new Date(Date.now() + PARTNER_INVITE_TTL_MS).toISOString(),
      consumedAt: '',
    };
    writePartnerInvitesStore(store);
    sendJson(res, 200, { code, expiresAt: store[code].expiresAt });
    return;
  }

  // POST /api/partners/redeem { code } → create a mutual pairing.
  if (pathname === '/api/partners/redeem' && req.method === 'POST') {
    if (!allowRedeemAttempt(sid)) {
      sendJson(res, 429, { error: 'Слишком много попыток. Подождите немного и попробуйте снова.' });
      return;
    }
    let body;
    try {
      const raw = await readBody(req);
      body = raw ? JSON.parse(raw) : {};
    } catch (err) {
      sendJson(res, 400, { error: 'Invalid payload' });
      return;
    }
    const code = String((body && body.code) || '').trim().toUpperCase();
    if (!code) {
      sendJson(res, 400, { error: 'Введите код приглашения' });
      return;
    }
    const invitesStore = prunePartnerInvitesStore(readPartnerInvitesStore());
    const invite = invitesStore[code];
    if (!invite || invite.consumedAt) {
      writePartnerInvitesStore(invitesStore);
      sendJson(res, 404, { error: 'Код не найден или уже использован' });
      return;
    }
    if (invite.inviterSid === sid) {
      sendJson(res, 400, { error: 'Нельзя связать аккаунт сам с собой' });
      return;
    }

    const store = readPartnershipsStore();
    if (listUserPairingIds(store, sid).length >= MAX_PARTNERSHIPS_PER_USER) {
      sendJson(res, 400, { error: 'Слишком много участников в бригаде' });
      return;
    }
    let pairingId = findActivePairingBetween(store, sid, invite.inviterSid);
    if (!pairingId) {
      pairingId = crypto.randomBytes(12).toString('hex');
      store.pairings[pairingId] = {
        id: pairingId,
        members: [invite.inviterSid, sid],
        status: 'active',
        trust: { [invite.inviterSid]: 'pending', [sid]: 'pending' },
        labels: {
          [invite.inviterSid]: invite.inviterName || ('ID ' + invite.inviterSid),
          [sid]: displayNameForSid(sid, user) || ('ID ' + sid),
        },
        createdAt: new Date().toISOString(),
      };
      writePartnershipsStore(store);
    }

    invite.consumedAt = new Date().toISOString();
    invite.consumedBySid = sid;
    invitesStore[code] = invite;
    writePartnerInvitesStore(invitesStore);

    // Fresh pairing is most likely the crew they are working with right now.
    writePartnerState(sid, { activePairingId: pairingId });
    const inviterState = readPartnerState(invite.inviterSid);
    if (!inviterState.activePairingId) {
      writePartnerState(invite.inviterSid, { activePairingId: pairingId });
    }

    const activePairingId = readPartnerState(sid).activePairingId;
    sendJson(res, 200, { pairing: presentPairingForUser(store.pairings[pairingId], sid, activePairingId) });
    return;
  }

  // GET /api/partners → address book + which pairing is active.
  if (pathname === '/api/partners' && req.method === 'GET') {
    const store = readPartnershipsStore();
    const activePairingId = readPartnerState(sid).activePairingId;
    const partners = listUserPairingIds(store, sid)
      .map((id) => presentPairingForUser(store.pairings[id], sid, activePairingId))
      .sort((a, b) => String(a.partnerLabel).localeCompare(String(b.partnerLabel), 'ru'));
    sendJson(res, 200, { partners, activePairingId });
    return;
  }

  // POST /api/partners/active { pairingId|null } → switch the active crew pointer.
  if (pathname === '/api/partners/active' && req.method === 'POST') {
    let body;
    try {
      const raw = await readBody(req);
      body = raw ? JSON.parse(raw) : {};
    } catch (err) {
      sendJson(res, 400, { error: 'Invalid payload' });
      return;
    }
    const pairingId = body && body.pairingId ? String(body.pairingId) : '';
    if (pairingId) {
      const store = readPartnershipsStore();
      const pairing = store.pairings[pairingId];
      if (!pairing || pairing.status !== 'active' || !Array.isArray(pairing.members) || !pairing.members.includes(sid)) {
        sendJson(res, 404, { error: 'Пара не найдена' });
        return;
      }
    }
    writePartnerState(sid, { activePairingId: pairingId });
    sendJson(res, 200, { ok: true, activePairingId: pairingId });
    return;
  }

  // DELETE /api/partners/:id → unpair (archive). Both members lose the link.
  const unpairMatch = pathname.match(/^\/api\/partners\/([a-f0-9]{12,64})$/i);
  if (unpairMatch && req.method === 'DELETE') {
    const pairingId = unpairMatch[1];
    const store = readPartnershipsStore();
    const pairing = store.pairings[pairingId];
    if (!pairing || !Array.isArray(pairing.members) || !pairing.members.includes(sid)) {
      sendJson(res, 404, { error: 'Пара не найдена' });
      return;
    }
    pairing.status = 'archived';
    pairing.archivedAt = new Date().toISOString();
    store.pairings[pairingId] = pairing;
    writePartnershipsStore(store);
    // Clear the active pointer for any member that was pointing at this pairing.
    (pairing.members || []).forEach((memberSid) => {
      if (readPartnerState(memberSid).activePairingId === pairingId) {
        writePartnerState(memberSid, { activePairingId: '' });
      }
    });
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}

async function handleShiftShareApi(req, res, pathname, sid, user) {
  if (!sid) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  // POST /api/shifts/share { shift, sourceId } → deliver facts to the active partner's inbox.
  if (pathname === '/api/shifts/share' && req.method === 'POST') {
    let body;
    try {
      const raw = await readBody(req);
      body = raw ? JSON.parse(raw) : {};
    } catch (err) {
      sendJson(res, 400, { error: 'Invalid payload' });
      return;
    }

    // A queued offline share carries the pairing it was meant for, so it reaches the
    // intended partner even if the active pointer changed before it was delivered.
    // Anti-leak still holds: the pairing must be active and include the caller.
    const requestedPairingId = body && body.pairingId ? String(body.pairingId) : '';
    const targetPairingId = requestedPairingId || readPartnerState(sid).activePairingId;
    if (!targetPairingId) {
      sendJson(res, 409, { error: 'Бригада не выбрана' });
      return;
    }
    const store = readPartnershipsStore();
    const pairing = store.pairings[targetPairingId];
    if (!pairing || pairing.status !== 'active' || !Array.isArray(pairing.members) || !pairing.members.includes(sid)) {
      sendJson(res, 409, { error: 'Пара недоступна' });
      return;
    }
    const partnerSid = pairing.members.find((m) => m !== sid) || '';
    if (!partnerSid) {
      sendJson(res, 409, { error: 'Участник бригады не найден' });
      return;
    }

    let facts;
    try {
      facts = sanitizeSharedShiftFacts(body && body.shift);
    } catch (err) {
      sendJson(res, 400, { error: err && err.message ? err.message : 'Invalid shift' });
      return;
    }

    const sourceId = body && body.sourceId ? String(body.sourceId).slice(0, MAX_SHIFT_ID_LENGTH) : '';
    const inbox = readShiftInbox(partnerSid);
    const nowIso = new Date().toISOString();
    // If the recipient already trusts this sender, the shift lands automatically.
    const autoAccept = (pairing.trust || {})[partnerSid] === 'trusted';
    const proposal = {
      id: crypto.randomBytes(10).toString('hex'),
      sharedBy: sid,
      sharedByName: displayNameForSid(sid, user) || ('ID ' + sid),
      pairingId: targetPairingId,
      sourceId,
      facts,
      autoAccept,
      createdAt: nowIso,
    };
    // Re-sharing an edited shift updates the existing proposal instead of piling up.
    let replaced = false;
    const next = inbox.map((item) => {
      if (sourceId && item && item.sharedBy === sid && item.sourceId === sourceId) {
        replaced = true;
        return { ...proposal, id: item.id, createdAt: item.createdAt };
      }
      return item;
    });
    if (!replaced) next.push(proposal);
    writeShiftInbox(partnerSid, next);

    const partnerLabel = (pairing.labels || {})[partnerSid] || ('ID ' + partnerSid);
    sendJson(res, 200, { ok: true, delivered: true, to: partnerLabel });
    return;
  }

  // GET /api/shifts/inbox → proposals waiting for me.
  if (pathname === '/api/shifts/inbox' && req.method === 'GET') {
    const items = readShiftInbox(sid).map((item) => ({
      id: item.id,
      sharedBy: item.sharedBy || '',
      sharedByName: item.sharedByName || '',
      pairingId: item.pairingId || '',
      sourceId: item.sourceId || '',
      facts: item.facts || {},
      autoAccept: !!item.autoAccept,
      createdAt: item.createdAt || '',
    }));
    sendJson(res, 200, { items });
    return;
  }

  // POST /api/shifts/inbox/resolve { id, action } → remove a proposal once handled client-side.
  if (pathname === '/api/shifts/inbox/resolve' && req.method === 'POST') {
    let body;
    try {
      const raw = await readBody(req);
      body = raw ? JSON.parse(raw) : {};
    } catch (err) {
      sendJson(res, 400, { error: 'Invalid payload' });
      return;
    }
    const id = body && body.id ? String(body.id) : '';
    if (!id) {
      sendJson(res, 400, { error: 'Missing id' });
      return;
    }
    const action = body && body.action ? String(body.action) : '';
    const inbox = readShiftInbox(sid);
    const target = inbox.find((item) => item && item.id === id);

    // Accepting a partner's shift earns trust in that direction: from now on this
    // partner's shifts auto-land instead of waiting in the inbox.
    if (action === 'accept' && target && target.pairingId) {
      const store = readPartnershipsStore();
      const pairing = store.pairings[target.pairingId];
      if (pairing && Array.isArray(pairing.members) && pairing.members.includes(sid)) {
        if (!pairing.trust || typeof pairing.trust !== 'object') pairing.trust = {};
        if (pairing.trust[sid] !== 'trusted') {
          pairing.trust[sid] = 'trusted';
          store.pairings[target.pairingId] = pairing;
          writePartnershipsStore(store);
        }
      }
    }

    const next = inbox.filter((item) => item && item.id !== id);
    writeShiftInbox(sid, next);
    sendJson(res, 200, { ok: true, remaining: next.length });
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}

function touchUserPresence(userId, sessionId, platform) {
  const store = readUserPresenceStore();
  const nowIso = new Date().toISOString();
  const existingUser = store.users[userId];
  const existingSession = store.sessions[sessionId];

  const reportedPlatform = normalizePlatform(platform);
  const knownPlatform = existingUser ? normalizePlatform(existingUser.platform) : 'unknown';
  const resolvedPlatform = reportedPlatform !== 'unknown' ? reportedPlatform : knownPlatform;

  store.users[userId] = {
    firstSeenAt: existingUser && typeof existingUser.firstSeenAt === 'string' && existingUser.firstSeenAt ? existingUser.firstSeenAt : nowIso,
    lastSeenAt: nowIso,
    platform: resolvedPlatform,
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
  closeStorage();
  process.exit(0);
});

process.on('SIGTERM', () => {
  flushUserPresenceStoreSyncOnShutdown();
  closeStorage();
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
  const urls = [
    '/',
    '/prilozhenie-dlya-mashinista',
    '/dokumenty-mashinista',
    '/brigada-mashinista',
    '/poekhali-rezhim',
    '/uchet-marshrutov',
    '/zarplata-mashinista',
    '/zhurnal-smen-mashinista',
    '/grafik-smen-mashinista',
  ];
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

function getPublicFileCacheControl(filePath, publicPath) {
  const normalizedPath = String(publicPath || '').replace(/\\/g, '/');
  const ext = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath).toLowerCase();
  const shellFallbackCache = 'public, max-age=86400, stale-while-revalidate=604800, stale-if-error=604800';

  if (
    normalizedPath === '/' ||
    normalizedPath === '/index.html' ||
    baseName === 'index.html' ||
    normalizedPath === '/sw.js' ||
    baseName === 'sw.js' ||
    normalizedPath === '/scripts/app-constants.js' ||
    normalizedPath === '/scripts/app-init.js' ||
    normalizedPath === '/scripts/app.js' ||
    normalizedPath === '/scripts/auth.js' ||
    normalizedPath === '/scripts/sw-register.js' ||
    (normalizedPath.startsWith('/scripts/') && (ext === '.js' || ext === '.mjs')) ||
    /^\/sw-bootstrap-v\d+\.js$/.test(normalizedPath)
  ) {
    return 'no-store';
  }

  if (
    normalizedPath === '/manifest.webmanifest' ||
    normalizedPath.startsWith('/styles/') ||
    normalizedPath.startsWith('/scripts/') ||
    normalizedPath.startsWith('/assets/fonts/') ||
    normalizedPath.startsWith('/assets/tracker/') ||
    normalizedPath === '/apple-touch-icon.png' ||
    normalizedPath === '/icon-192.png' ||
    normalizedPath === '/icon-512.png' ||
    ext === '.woff' ||
    ext === '.woff2'
  ) {
    return shellFallbackCache;
  }

  return 'no-store';
}

function serveFile(res, filePath, publicPath) {
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
    'Cache-Control': getPublicFileCacheControl(filePath, publicPath),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  fs.createReadStream(filePath).pipe(res);
}

function serveAdminDocFile(res, pathname) {
  let relativePath;
  try {
    relativePath = decodeURIComponent(String(pathname || '').replace(/^\/admin-docs\/?/, ''));
  } catch (_) {
    sendText(res, 400, 'Bad request');
    return;
  }
  const filePath = path.resolve(path.join(ADMIN_DOC_FILES_DIR, relativePath));
  const rootPath = path.resolve(ADMIN_DOC_FILES_DIR);
  if (!filePath.startsWith(rootPath + path.sep)) {
    sendText(res, 403, 'Forbidden');
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendText(res, 404, 'Not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': DOC_MIME_BY_EXTENSION[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  fs.createReadStream(filePath).pipe(res);
}

function readBody(req) {
  return readBodyWithLimit(req, 2 * 1024 * 1024);
}

function readBodyWithLimit(req, maxBytes) {
  const limit = Math.max(1, Number(maxBytes) || (2 * 1024 * 1024));
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const APP_RELEASE_VERSION = 'v392';
const APP_URL = PUBLIC_SITE_URL;
const TELEGRAM_APP_URL = buildVersionedAppUrl('/');

function buildVersionedAppUrl(rawPath) {
  const target = new URL(safeRedirectTarget(rawPath || '/'), PUBLIC_SITE_URL);
  target.searchParams.set('app', APP_RELEASE_VERSION);
  return target.toString();
}
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

function buildCommunityLinks() {
  return {
    appUrl: TELEGRAM_APP_URL,
    siteUrl: PUBLIC_SITE_URL,
    botUrl: TELEGRAM_BOT_URL,
    newsChannelUrl: NEWS_CHANNEL_URL,
    discussionChatUrl: DISCUSSION_CHAT_URL,
    supportEnabled: !!SUPPORT_ADMIN_CHAT_ID,
  };
}

function buildCommunityKeyboard() {
  const keyboard = [
    [{ text: '✈️ Открыть в Telegram', web_app: { url: TELEGRAM_APP_URL } }],
    [{ text: '🌐 Открыть в браузере', url: TELEGRAM_APP_URL }],
  ];
  if (NEWS_CHANNEL_URL) {
    keyboard.push([{ text: '📣 Новости', url: NEWS_CHANNEL_URL }]);
  }
  if (DISCUSSION_CHAT_URL) {
    keyboard.push([{ text: '💬 Обсуждение', url: DISCUSSION_CHAT_URL }]);
  }
  if (TELEGRAM_BOT_URL) {
    keyboard.push([{ text: '🤖 Открыть бота', url: TELEGRAM_BOT_URL }]);
  }
  return { inline_keyboard: keyboard };
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
      'Открывай приложение по кнопке ниже. Новости и обсуждение будут здесь же.',
    reply_markup: buildCommunityKeyboard(),
  };
}

function buildPlainWelcomeText(firstName) {
  return (firstName ? `👋 Привет, ${firstName}!\n\n` : '👋 Привет!\n\n') +
    'Блокнот Машиниста помогает вести смены, смотреть часы и хранить рабочую историю в одном месте.\n\n' +
    'Команды:\n' +
    '/start — открыть приложение\n' +
    '/news — новости проекта\n' +
    '/chat — обсуждение и обратная связь\n' +
    '/bug — сообщить о проблеме\n' +
    '/idea — предложить идею';
}

function buildCommunityReply(chatId, text) {
  return {
    chat_id: chatId,
    text,
    reply_markup: buildCommunityKeyboard(),
    disable_web_page_preview: true,
  };
}

function isPrivateTelegramChat(message) {
  return !!(message && message.chat && message.chat.type === 'private');
}

function formatTelegramUserForReport(message) {
  const from = message && message.from ? message.from : {};
  const parts = [];
  if (from.first_name || from.last_name) parts.push([from.first_name || '', from.last_name || ''].join(' ').trim());
  if (from.username) parts.push('@' + from.username);
  if (from.id) parts.push('id ' + String(from.id));
  return parts.filter(Boolean).join(' · ') || 'unknown';
}

function storeTelegramFeedback(message, chatId, kind, text) {
  const trimmedText = String(text || '').trim();
  if (!trimmedText) return;
  const from = message && message.from ? message.from : {};
  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
    kind: kind === 'bug' ? 'bug' : 'idea',
    text: trimmedText.slice(0, 4000),
    createdAt: new Date().toISOString(),
    chatId: chatId === undefined || chatId === null ? '' : String(chatId),
    user: {
      id: from.id === undefined || from.id === null ? '' : String(from.id),
      username: String(from.username || '').slice(0, 64),
      firstName: String(from.first_name || '').slice(0, 80),
      lastName: String(from.last_name || '').slice(0, 80),
    },
  };

  try {
    const current = getStorage().readAppState('feedback', []);
    const items = Array.isArray(current) ? current : [];
    items.push(entry);
    const capped = items.slice(-1000);
    getStorage().writeAppState('feedback', capped);
  } catch (err) {
    logStructuredRateLimited('error', 'storage.feedback.write_failed', `feedback:${kind}`, {
      kind,
      error: toErrorMeta(err),
    });
  }
}

async function handleTelegramFeedbackCommand(token, message, chatId, normalizedText, kind) {
  const commandPattern = kind === 'bug' ? /^\/bug(?:@\w+)?\s*/i : /^\/idea(?:@\w+)?\s*/i;
  const text = String(normalizedText || '').replace(commandPattern, '').trim();
  const promptText = kind === 'bug'
    ? 'Опиши проблему после команды /bug: что не работает, где открыл приложение, Android/iPhone, Telegram или браузер.'
    : 'Напиши идею после команды /idea: что хочется добавить или изменить.';
  if (!text) {
    await callTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: promptText,
      disable_web_page_preview: true,
    });
    return;
  }

  storeTelegramFeedback(message, chatId, kind, text);

  if (SUPPORT_ADMIN_CHAT_ID) {
    const title = kind === 'bug' ? '🐞 Баг-репорт' : '💡 Идея';
    await callTelegramApi(token, 'sendMessage', {
      chat_id: SUPPORT_ADMIN_CHAT_ID,
      text:
        `${title}\n\n` +
        `От: ${formatTelegramUserForReport(message)}\n` +
        `Чат: ${String(chatId || '')}\n\n` +
        text,
      disable_web_page_preview: true,
    });
  }

  const fallback = DISCUSSION_CHAT_URL
    ? '\n\nДля обсуждения с другими пользователями можно также написать в общий чат.'
    : '';
  await callTelegramApi(token, 'sendMessage', {
    chat_id: chatId,
    text: SUPPORT_ADMIN_CHAT_ID
      ? 'Принял. Передал сообщение администратору.' + fallback
      : 'Принял. Админ-чат пока не настроен, поэтому лучше продублировать сообщение в обсуждении.' + fallback,
    reply_markup: buildCommunityKeyboard(),
    disable_web_page_preview: true,
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const parsedUrl = {
    pathname: requestUrl.pathname,
    query: Object.fromEntries(requestUrl.searchParams.entries()),
  };
  const pathname = parsedUrl.pathname || '/';
  const requestUser = getUserFromRequest(req);
  const telegramUserId = requestUser ? String(requestUser.id || '') : '';
  const sid = telegramUserId ? normalizeSid(telegramUserId) : '';
  const allowedCorsOrigin = getAllowedCorsOrigin(req);

  if (allowedCorsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedCorsOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/api/partners' || pathname.startsWith('/api/partners/')) {
    await handlePartnersApi(req, res, pathname, sid, requestUser);
    return;
  }

  if (pathname === '/api/shifts/share' || pathname.startsWith('/api/shifts/inbox')) {
    await handleShiftShareApi(req, res, pathname, sid, requestUser);
    return;
  }

  if (pathname === '/api/poekhali-map-overrides') {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    sendJson(res, 200, readPoekhaliMapConfig());
    return;
  }

  if (pathname === '/api/community') {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    sendJson(res, 200, buildCommunityLinks());
    return;
  }

  if (pathname === '/api/analytics/consent') {
    if (!sid) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (req.method === 'GET') {
      sendJson(res, 200, {
        consent: getStorage().readAnalyticsConsent(sid),
        policyVersion: ANALYTICS_POLICY_VERSION,
      });
      return;
    }
    if (req.method === 'PUT') {
      try {
        const body = await readBody(req);
        const consent = sanitizeConsentPayload(body ? JSON.parse(body) : {});
        const saved = getStorage().writeAnalyticsConsent(sid, consent.status, consent.policyVersion);
        if (consent.status === 'denied') getStorage().deleteAnalyticsForUser(sid, true);
        sendJson(res, 200, { ok: true, consent: saved });
      } catch (err) {
        sendJson(res, 400, { error: err && err.message ? err.message : 'Invalid consent payload' });
      }
      return;
    }
    if (req.method === 'DELETE') {
      const removed = getStorage().deleteAnalyticsForUser(sid, true);
      const consent = getStorage().writeAnalyticsConsent(sid, 'denied', ANALYTICS_POLICY_VERSION);
      sendJson(res, 200, { ok: true, removed, consent });
      return;
    }
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (pathname === '/api/events') {
    if (!sid) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    const consent = getStorage().readAnalyticsConsent(sid);
    if (!consent || consent.status !== 'granted' || consent.policyVersion !== ANALYTICS_POLICY_VERSION) {
      sendJson(res, 403, { error: 'Analytics consent required', policyVersion: ANALYTICS_POLICY_VERSION });
      return;
    }
    try {
      const body = await readBody(req);
      const events = sanitizeAnalyticsBatch(body ? JSON.parse(body) : {});
      const result = getStorage().recordAnalyticsEvents(sid, events, ANALYTICS_RETENTION_DAYS);
      sendJson(res, 200, { ok: true, accepted: result.inserted, receivedAt: result.receivedAt });
    } catch (err) {
      logStructuredRateLimited('warn', 'analytics.invalid_payload', sid, {
        sid,
        error: toErrorMeta(err),
      });
      sendJson(res, 400, { error: err && err.message ? err.message : 'Invalid analytics payload' });
    }
    return;
  }

  if (pathname === '/api/admin/analytics') {
    if (!requestUser) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (!isAnalyticsAdmin(requestUser)) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    sendJson(res, 200, getStorage().buildAnalyticsDashboard(parsedUrl.query.days));
    return;
  }

  if (pathname === '/analytics') {
    if (req.method !== 'GET') {
      sendText(res, 405, 'Method not allowed');
      return;
    }
    const dashboardPath = path.join(ROOT, 'admin', 'analytics.html');
    if (!fs.existsSync(dashboardPath)) {
      sendText(res, 404, 'Панель аналитики не найдена.');
      return;
    }
    sendText(res, 200, fs.readFileSync(dashboardPath, 'utf8'), 'text/html; charset=utf-8');
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
        const loginMatch = normalizedText.match(/^\/start(?:@\w+)?\s+login_([a-f0-9]{24,64})$/i);
        if (loginMatch) {
          const approved = approvePwaLoginRequest(loginMatch[1], {
            id: String(fromUserId || ''),
            first_name: firstName || '',
            last_name: (message && message.from && message.from.last_name) || '',
            username: (message && message.from && message.from.username) || '',
            display_name: [firstName || '', (message && message.from && message.from.last_name) || ''].join(' ').trim() || ((message && message.from && message.from.username) || '') || ('ID ' + String(fromUserId || '')),
          });
          callTelegramApi(token, 'sendMessage', {
            chat_id: chatId,
            text: approved
              ? '✅ Вход для PWA подтверждён. Вернись в приложение «Блокнот» на главном экране — оно само подхватит сессию.'
              : '⚠️ Этот запрос на вход уже устарел или не найден. Открой PWA снова и запроси вход ещё раз.',
            reply_markup: approved ? {
              inline_keyboard: [
                [{ text: '🌐 Открыть Блокнот', url: buildVersionedAppUrl(approved.returnPath) }],
                [{ text: '✈️ Открыть в Telegram', web_app: { url: TELEGRAM_APP_URL } }],
              ],
            } : undefined,
          }).catch((err) => {
            logStructuredRateLimited('error', 'telegram.webhook.send_login_confirm_failed', `login:${chatId || 'unknown'}`, {
              chatId: chatId || null,
              error: toErrorMeta(err),
            });
          });
        } else if (/^\/(?:start|help)(?:@\w+)?(?:\s|$)/i.test(normalizedText)) {
          callTelegramApi(token, 'sendPhoto', buildWelcomeMessage(chatId, firstName))
            .then(result => {
              if (!result || result.ok !== true) {
                return callTelegramApi(token, 'sendMessage', {
                  ...buildCommunityReply(chatId, buildPlainWelcomeText(firstName)),
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
        } else if (/^\/news(?:@\w+)?$/i.test(normalizedText)) {
          callTelegramApi(token, 'sendMessage', buildCommunityReply(
            chatId,
            NEWS_CHANNEL_URL
              ? 'Новости проекта публикуются в канале.'
              : 'Канал новостей еще не подключен. Пока важные ссылки доступны ниже.'
          )).catch((err) => {
            logStructuredRateLimited('error', 'telegram.webhook.send_news_failed', `news:${chatId || 'unknown'}`, {
              chatId: chatId || null,
              error: toErrorMeta(err),
            });
          });
        } else if (/^\/chat(?:@\w+)?$/i.test(normalizedText)) {
          callTelegramApi(token, 'sendMessage', buildCommunityReply(
            chatId,
            DISCUSSION_CHAT_URL
              ? 'Обсуждение и обратная связь открыты в группе.'
              : 'Группа обсуждения еще не подключена. Пока можно написать сюда через /bug или /idea.'
          )).catch((err) => {
            logStructuredRateLimited('error', 'telegram.webhook.send_chat_failed', `chat:${chatId || 'unknown'}`, {
              chatId: chatId || null,
              error: toErrorMeta(err),
            });
          });
        } else if (/^\/bug(?:@\w+)?(?:\s|$)/i.test(normalizedText)) {
          handleTelegramFeedbackCommand(token, message, chatId, normalizedText, 'bug').catch((err) => {
            logStructuredRateLimited('error', 'telegram.webhook.send_bug_failed', `bug:${chatId || 'unknown'}`, {
              chatId: chatId || null,
              error: toErrorMeta(err),
            });
          });
        } else if (/^\/idea(?:@\w+)?(?:\s|$)/i.test(normalizedText)) {
          handleTelegramFeedbackCommand(token, message, chatId, normalizedText, 'idea').catch((err) => {
            logStructuredRateLimited('error', 'telegram.webhook.send_idea_failed', `idea:${chatId || 'unknown'}`, {
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
        } else if (isPrivateTelegramChat(message)) {
          callTelegramApi(token, 'sendMessage', buildCommunityReply(
            chatId,
            'Используй кнопку «Открыть мини-апп» в сообщении или в меню бота. Для обратной связи: /bug или /idea.'
          )).catch((err) => {
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

  if (pathname === '/api/auth/pwa-login-request') {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) { sendJson(res, 500, { error: 'TELEGRAM_BOT_TOKEN not configured' }); return; }

    if (req.method === 'POST') {
      try {
        const body = await readBody(req);
        const payload = body ? JSON.parse(body) : {};
        const loginRequest = createPwaLoginRequest(payload && payload.return ? payload.return : '/');
        sendJson(res, 200, {
          ok: true,
          requestId: loginRequest.id,
          status: loginRequest.status,
          botUrl: `https://t.me/bloknot_mashinista_bot?start=login_${loginRequest.id}`,
          expiresAt: loginRequest.expiresAt,
        });
      } catch (err) {
        sendJson(res, 400, { error: err.message || 'Invalid payload' });
      }
      return;
    }

    if (req.method === 'GET') {
      const requestId = String(parsedUrl.query.request || '').trim();
      const result = consumePwaLoginRequest(requestId);
      if (result.status === 'approved' && result.user) {
        const sessionToken = createSessionToken(result.user);
        sendJson(res, 200, { ok: true, status: 'approved', user: result.user, sessionToken }, {
          'Set-Cookie': buildSessionCookie(sessionToken),
        });
        return;
      }
      if (result.status === 'pending') {
        sendJson(res, 202, { ok: true, status: 'pending' });
        return;
      }
      if (result.status === 'expired') {
        sendJson(res, 410, { error: 'Login request expired', status: 'expired' });
        return;
      }
      sendJson(res, 404, { error: 'Login request not found', status: 'missing' });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (pathname === '/api/auth') {
    const localDevUser = getLocalDevUserFromRequest(req);
    if (localDevUser) {
      if (req.method === 'DELETE') {
        res.writeHead(204, {
          'Cache-Control': 'no-store',
          'Set-Cookie': buildSessionCookie('', 0),
        });
        res.end();
        return;
      }
      if (req.method === 'GET' || req.method === 'POST') {
        sendJson(res, 200, { user: localDevUser, sessionToken: '' });
        return;
      }
    }

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
      const sessionToken = createSessionToken(user);
      sendJson(res, 200, { user, sessionToken }, {
        'Set-Cookie': buildSessionCookie(sessionToken),
      });
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

  if (pathname === '/api/poekhali-warnings') {
    if (!sid) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, { sid, warnings: readPoekhaliWarnings(sid) });
      return;
    }

    if (req.method === 'PUT') {
      try {
        const body = await readBody(req);
        const payload = body ? JSON.parse(body) : {};
        const warnings = writePoekhaliWarnings(sid, payload && payload.warnings);
        sendJson(res, 200, { ok: true, sid, warnings });
      } catch (err) {
        const errorMessage = err && err.message ? err.message : 'Invalid payload';
        const isValidationError = /^(Expected|Too many|Invalid|Missing|Payload too large)/.test(errorMessage);
        logStructuredRateLimited(isValidationError ? 'warn' : 'error', 'storage.poekhali_warnings.write_rejected', `${sid}:${errorMessage}`, {
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

  if (pathname === '/api/salary-params') {
    if (!sid) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, { sid, salaryParams: readSalaryParams(sid) });
      return;
    }

    if (req.method === 'PUT') {
      try {
        const body = await readBody(req);
        const payload = body ? JSON.parse(body) : {};
        const salaryParams = sanitizeAndValidateSalaryParamsPayload(payload);
        writeSalaryParams(sid, salaryParams);
        sendJson(res, 200, { ok: true, sid, salaryParams });
      } catch (err) {
        const errorMessage = err && err.message ? err.message : 'Invalid payload';
        const isValidationError = /^(Expected|Invalid|Missing)/.test(errorMessage);
        logStructuredRateLimited(isValidationError ? 'warn' : 'error', 'storage.salary_params.write_rejected', `${sid}:${errorMessage}`, {
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

  if (pathname === '/api/profile') {
    if (!sid) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, { sid, profile: readProfile(sid) });
      return;
    }

    if (req.method === 'PUT') {
      try {
        const body = await readBody(req);
        const payload = body ? JSON.parse(body) : {};
        const profile = sanitizeProfilePayload(payload);
        writeProfile(sid, profile);
        updatePartnerLabelsForSid(sid, displayNameForSid(sid, requestUser) || ('ID ' + sid));
        sendJson(res, 200, { ok: true, sid, profile });
      } catch (err) {
        const errorMessage = err && err.message ? err.message : 'Invalid payload';
        const isValidationError = /^(Expected|Invalid|Missing)/.test(errorMessage);
        logStructuredRateLimited(isValidationError ? 'warn' : 'error', 'storage.profile.write_rejected', `${sid}:${errorMessage}`, {
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
        const platform = normalizePlatform(payload.platform);
        if (!userId) {
          sendJson(res, 400, { error: 'Invalid userId' });
          return;
        }
        if (!isValidSessionId(sessionId)) {
          sendJson(res, 400, { error: 'Invalid sessionId' });
          return;
        }
        sendJson(res, 200, touchUserPresence(userId, sessionId, platform));
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
    serveFile(res, path.join(ROOT, SEO_PAGE_ROUTES[pathname]), pathname);
    return;
  }

  if (pathname === '/assets/docs/manifest.json') {
    sendDocsManifest(res);
    return;
  }

  if (pathname.startsWith('/admin-docs/')) {
    serveAdminDocFile(res, pathname);
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

  serveFile(res, filePath, normalized);
});

function startServer(port) {
  initializeStorage();
  const listenPort = port === undefined ? PORT : port;
  return server.listen(listenPort, () => {
    const address = server.address();
    const actualPort = address && typeof address === 'object' ? address.port : listenPort;
    console.log(`Shift tracker server listening on http://localhost:${actualPort}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  server,
  startServer,
  closeStorage,
};
