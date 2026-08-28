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
const LISTEN_HOST = String(process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '')).trim();
const DATA_DIR = path.resolve(process.env.APP_DATA_DIR || path.join(ROOT, 'data'));
const USERS_DIR = path.join(DATA_DIR, 'local-shifts');
const SALARY_PARAMS_DIR = path.join(DATA_DIR, 'local-salary-params');
const PROFILE_DIR = path.join(DATA_DIR, 'local-profiles');
const POEKHALI_WARNINGS_DIR = path.join(DATA_DIR, 'poekhali-warnings');
const DEPOT_PACK_MATERIALS_DIR = path.join(DATA_DIR, 'depot-pack-materials');
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
  'sw-bootstrap-v394.js',
  'sw-bootstrap-v395.js',
  'sw-bootstrap-v396.js',
  'sw-bootstrap-v397.js',
  'sw-bootstrap-v398.js',
  'sw-bootstrap-v399.js',
  'sw-bootstrap-v400.js',
  'sw-bootstrap-v401.js',
  'sw-bootstrap-v402.js',
  'sw-bootstrap-v404.js',
  'sw-bootstrap-v405.js',
  'sw-bootstrap-v408.js',
  'sw-bootstrap-v410.js',
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
const AUTHENTICATED_PRESENCE_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const USER_PRESENCE_SESSION_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
const MAX_USER_PRESENCE_SESSIONS_PER_USER = 20;
const MAX_USER_PRESENCE_SESSIONS_GLOBAL = 20000;
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
  unionPercent: 0,
  welfarePercent: 0,
  alimonyPercent: 0,
};
const SALARY_PARAM_KEYS = Object.keys(DEFAULT_SALARY_PARAMS);
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://bloknot-mashinista-bot.ru';
const LOCAL_DEV_USER = {
  id: 'dev-local',
  first_name: 'Dev',
  last_name: '',
  username: 'devuser',
  display_name: 'Local Dev',
};

const SEO_PAGE_ROUTES = {
  '/uchet-marshrutov': 'docs/seo/uchet-marshrutov.html',
  '/zhurnal-smen-mashinista': 'docs/seo/zhurnal-smen-mashinista.html',
  '/grafik-smen-mashinista': 'docs/seo/grafik-smen-mashinista.html',
  '/prilozhenie-dlya-mashinista': 'docs/seo/prilozhenie-dlya-mashinista.html',
  '/dokumenty-mashinista': 'docs/seo/dokumenty-mashinista.html',
};
const RETIRED_SEO_PAGE_ROUTES = new Set([
  '/zarplata-mashinista',
  '/kalkulyator-zarplaty-mashinista',
  '/brigada-mashinista',
  '/poekhali-rezhim',
]);

let userPresenceStoreCache = null;
let userPresenceStoreLoaded = false;
let userPresenceStoreDirty = false;
let userPresenceStoreFlushTimer = null;
let userPresenceStoreWriteInFlight = false;
let userPresenceStoreFlushQueued = false;
const authenticatedPresenceLastTouch = new Map();

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
const MAX_LOGIN_REQUESTS = 1000;
const LOGIN_REQUEST_RATE_LIMIT_MAX = 20;
const LOGIN_REQUEST_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const PARTNER_INVITE_TTL_MS = 30 * 60 * 1000; // codes are read aloud, kept short-lived
const MAX_ACTIVE_PARTNER_INVITES_PER_USER = 5;
const MAX_ACTIVE_PARTNER_INVITES_GLOBAL = 5000;
const MAX_PARTNERSHIPS_PER_USER = 50;
const MAX_INBOX_ITEMS_PER_USER = 200;
const REDEEM_RATE_LIMIT_MAX = 12; // redeem attempts per window, per account
const REDEEM_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const ANALYTICS_RATE_LIMIT_MAX_EVENTS = 500;
const ANALYTICS_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const loginRequestAttemptsByClient = new Map();
const analyticsEventsBySid = new Map();

function requestRateKey(req) {
  const remote = String((req && req.socket && req.socket.remoteAddress) || '').trim().toLowerCase();
  const isLoopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  if (isLoopback) {
    const forwarded = String((req && req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim();
    if (forwarded && forwarded.length <= 64 && /^[a-f0-9:.]+$/i.test(forwarded)) return forwarded.toLowerCase();
  }
  return remote || 'unknown';
}

function allowWindowedCount(store, key, amount, limit, windowMs) {
  const now = Date.now();
  const normalizedKey = String(key || 'unknown').slice(0, 160);
  const current = store.get(normalizedKey);
  const row = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
  if (row.count + amount > limit) {
    store.set(normalizedKey, row);
    return false;
  }
  row.count += amount;
  store.set(normalizedKey, row);
  if (store.size > 5000) {
    for (const [storedKey, storedRow] of store) {
      if (!storedRow || storedRow.resetAt <= now) store.delete(storedKey);
      if (store.size <= 4000) break;
    }
  }
  return true;
}

function secureEqualText(actual, expected) {
  const actualBuffer = Buffer.from(String(actual || ''), 'utf8');
  const expectedBuffer = Buffer.from(String(expected || ''), 'utf8');
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

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
  if (Object.keys(store).length >= MAX_LOGIN_REQUESTS) {
    throw new Error('Login request capacity reached');
  }
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
  'locomotive_series', 'locomotive_sections', 'locomotive_number',
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
  for (const percentKey of ['unionPercent', 'welfarePercent', 'alimonyPercent']) {
    if (result[percentKey] > 100) {
      throw new Error(`Invalid salary param ${percentKey}`);
    }
  }
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

const DEFAULT_PROFILE = { firstName: '', lastName: '', role: '', depot: '', railwayId: '', depotId: '', avatar: '' };
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
  const railwayId = sanitizeProfileText(source.railwayId == null ? source.railway_id : source.railwayId, 80);
  const depotId = sanitizeProfileText(source.depotId == null ? source.depot_id : source.depotId, 160);

  let avatar = String(source.avatar == null ? '' : source.avatar).trim();
  if (avatar) {
    if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(avatar) && !/^https:\/\//i.test(avatar)) {
      throw new Error('Invalid avatar: expected data:image URL or https URL');
    }
    if (avatar.length > PROFILE_AVATAR_MAX_LEN) {
      throw new Error('Invalid avatar: image too large');
    }
  }

  return { firstName, lastName, role, depot, railwayId, depotId, avatar };
}

const DEPOT_PACK_REQUESTS_STATE_KEY = 'depot_pack_requests';
const MAX_DEPOT_PACK_REQUESTS = 5000;
const MAX_DEPOT_PACK_ATTACHMENTS = 8;
const MAX_DEPOT_PACK_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const MAX_DEPOT_PACK_TOTAL_BYTES = 120 * 1024 * 1024;
const MAX_DEPOT_PACK_STORED_BYTES_PER_USER = 300 * 1024 * 1024;
const MAX_DEPOT_PACK_STORED_BYTES_GLOBAL = 5 * 1024 * 1024 * 1024;
const MAX_DEPOT_PACK_UPLOAD_BYTES_PER_WINDOW = 250 * 1024 * 1024;
const MAX_DEPOT_PACK_ACTIVE_UPLOADS = 6;
const MAX_DOCUMENT_ATTACHMENTS = 3;
const MAX_DOCUMENT_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_DOCUMENT_TOTAL_BYTES = 60 * 1024 * 1024;
const MAX_ACTIVE_DOCUMENT_REQUESTS_PER_USER = 10;
const DEPOT_PACK_UPLOAD_WINDOW_MS = 30 * 60 * 1000;
const DEPOT_PACK_REVIEW_STATUSES = new Set(['new', 'reviewing', 'needs_info', 'accepted', 'published', 'rejected']);
const depotPackRequestAttempts = new Map();
const depotPackUploadAttempts = new Map();
const depotPackActiveUploads = new Set();

function allowDepotPackRequest(sid) {
  const key = normalizeSid(sid);
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const recent = (depotPackRequestAttempts.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= 6) {
    depotPackRequestAttempts.set(key, recent);
    return false;
  }
  recent.push(now);
  depotPackRequestAttempts.set(key, recent);
  if (depotPackRequestAttempts.size > 5000) {
    for (const [attemptKey, timestamps] of depotPackRequestAttempts) {
      if (!timestamps.some((timestamp) => now - timestamp < windowMs)) depotPackRequestAttempts.delete(attemptKey);
      if (depotPackRequestAttempts.size <= 4000) break;
    }
  }
  return true;
}

function readDepotPackRequests() {
  const value = getStorage().readAppState(DEPOT_PACK_REQUESTS_STATE_KEY, []);
  return Array.isArray(value) ? value : [];
}

function sanitizeDepotPackAttachmentName(value) {
  const normalized = String(value == null ? '' : value).replace(/\\/g, '/');
  return sanitizeProfileText(path.posix.basename(normalized), 180) || 'Материал без названия';
}

function sanitizeDepotPackAttachmentDescriptors(value, requestType) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error('Invalid attachments');
  const isDocument = requestType === 'documents';
  const maxAttachments = isDocument ? MAX_DOCUMENT_ATTACHMENTS : MAX_DEPOT_PACK_ATTACHMENTS;
  const maxAttachmentBytes = isDocument ? MAX_DOCUMENT_ATTACHMENT_BYTES : MAX_DEPOT_PACK_ATTACHMENT_BYTES;
  const maxTotalBytes = isDocument ? MAX_DOCUMENT_TOTAL_BYTES : MAX_DEPOT_PACK_TOTAL_BYTES;
  if (value.length > maxAttachments) throw new Error('Invalid attachments: too many files');
  let totalBytes = 0;
  return value.map((source) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new Error('Invalid attachment');
    }
    const size = Math.max(0, Math.floor(Number(source.size) || 0));
    if (!size || size > maxAttachmentBytes) {
      throw new Error('Invalid attachment size');
    }
    totalBytes += size;
    if (totalBytes > maxTotalBytes) throw new Error('Invalid attachments: total size too large');
    const kind = ['electronic-map', 'regime-map', 'document', 'other'].includes(source.kind) ? source.kind : 'other';
    return {
      id: crypto.randomBytes(10).toString('hex'),
      kind,
      originalName: sanitizeDepotPackAttachmentName(source.name),
      declaredMime: sanitizeProfileText(source.mime, 120),
      declaredSize: size,
      uploadedSize: 0,
      status: 'awaiting_upload',
      detectedFormat: '',
      automaticCheck: 'pending',
      reviewRequired: true,
      sha256: '',
      storageName: '',
    };
  });
}

function sanitizeDepotPackRequest(payload, sid, user) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Expected JSON object payload');
  }
  const railwayId = sanitizeProfileText(payload.railwayId == null ? payload.railway_id : payload.railwayId, 80);
  const depotId = sanitizeProfileText(payload.depotId == null ? payload.depot_id : payload.depotId, 160);
  const depotLabel = sanitizeProfileText(payload.depotLabel == null ? payload.depot_label : payload.depotLabel, 160);
  const armName = sanitizeProfileText(payload.armName == null ? payload.arm_name : payload.armName, 120);
  const notes = sanitizeProfileText(payload.notes, 600);
  const source = sanitizeProfileText(payload.source, 40) || 'profile';
  const requestType = ['materials', 'documents'].includes(payload.requestType) ? payload.requestType : 'demand';
  const attachments = sanitizeDepotPackAttachmentDescriptors(payload.attachments, requestType);
  const documentCategory = ['instructions', 'speeds', 'memos', 'reminders', 'folders'].includes(payload.documentCategory)
    ? payload.documentCategory
    : '';
  const scopeLevel = ['network', 'railway', 'depot'].includes(payload.scopeLevel) ? payload.scopeLevel : '';
  if (requestType !== 'documents' && !depotId && !depotLabel) throw new Error('Missing depot');
  if (requestType !== 'documents' && !armName && !notes) throw new Error('Missing service arm or materials');
  if (requestType === 'materials' && attachments.length === 0) throw new Error('Missing attachments');
  if (requestType === 'documents') {
    if (!armName) throw new Error('Missing document title');
    if (!documentCategory) throw new Error('Invalid document category');
    if (!scopeLevel) throw new Error('Invalid document scope');
    if (scopeLevel === 'railway' && !railwayId) throw new Error('Missing railway');
    if (scopeLevel === 'depot' && !depotId && !depotLabel) throw new Error('Missing depot');
    if (attachments.length === 0) throw new Error('Missing attachments');
  }
  return {
    id: crypto.randomBytes(12).toString('hex'),
    sid: normalizeSid(sid),
    submittedBy: displayNameForSid(sid, user) || ('ID ' + normalizeSid(sid)),
    railwayId,
    depotId,
    depotLabel,
    armName,
    notes,
    source,
    requestType,
    documentTitle: requestType === 'documents' ? armName : '',
    documentCategory,
    scope: requestType === 'documents' ? {
      level: scopeLevel,
      railway_id: scopeLevel === 'railway' || scopeLevel === 'depot' ? railwayId : '',
      depot_id: scopeLevel === 'depot' ? depotId : '',
      depot_label: scopeLevel === 'depot' ? depotLabel : '',
    } : null,
    attachments,
    status: attachments.length ? 'uploading' : 'new',
    createdAt: new Date().toISOString(),
  };
}

function writeDepotPackRequest(payload, sid, user) {
  const item = sanitizeDepotPackRequest(payload, sid, user);
  const requests = readDepotPackRequests();
  if (item.requestType === 'documents') {
    const activeStatuses = new Set(['uploading', 'new', 'reviewing', 'needs_info']);
    const activeCount = requests.filter((entry) => entry && entry.sid === item.sid && entry.requestType === 'documents' && activeStatuses.has(entry.status)).length;
    if (activeCount >= MAX_ACTIVE_DOCUMENT_REQUESTS_PER_USER) throw new Error('Active document limit exceeded');
  }
  if (item.requestType === 'demand') {
    const activeStatuses = new Set(['new', 'reviewing', 'needs_info', 'accepted']);
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const normalizeKey = (value) => String(value || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
    const duplicate = requests.slice().reverse().find((entry) => entry &&
      entry.sid === item.sid &&
      entry.requestType === 'demand' &&
      activeStatuses.has(entry.status) &&
      Date.parse(entry.createdAt || 0) >= cutoff &&
      normalizeKey(entry.depotId || entry.depotLabel) === normalizeKey(item.depotId || item.depotLabel) &&
      normalizeKey(entry.armName) === normalizeKey(item.armName));
    if (duplicate) return { item: duplicate, duplicate: true };
  }
  requests.push(item);
  const removed = requests.length > MAX_DEPOT_PACK_REQUESTS
    ? requests.slice(0, requests.length - MAX_DEPOT_PACK_REQUESTS)
    : [];
  const bounded = removed.length ? requests.slice(removed.length) : requests;
  getStorage().writeAppState(DEPOT_PACK_REQUESTS_STATE_KEY, bounded);
  removed.forEach((entry) => {
    if (!entry || !/^[a-f0-9]{24}$/.test(String(entry.id || ''))) return;
    fs.rm(path.join(DEPOT_PACK_MATERIALS_DIR, entry.id), { recursive: true, force: true }, () => {});
  });
  return { item, duplicate: false };
}

function replaceDepotPackRequest(updatedItem) {
  const requests = readDepotPackRequests();
  const index = requests.findIndex((item) => item && item.id === updatedItem.id);
  if (index < 0) throw new Error('Request not found');
  requests[index] = updatedItem;
  getStorage().writeAppState(DEPOT_PACK_REQUESTS_STATE_KEY, requests);
  return updatedItem;
}

function updateDepotPackRequestReview(item, payload, reviewer) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Expected JSON object payload');
  }
  const status = sanitizeProfileText(payload.status, 40);
  if (!DEPOT_PACK_REVIEW_STATUSES.has(status)) throw new Error('Invalid review status');
  item.status = status;
  item.reviewNotes = sanitizeProfileText(payload.reviewNotes, 800);
  item.reviewedAt = new Date().toISOString();
  item.reviewedBy = reviewer && reviewer.id != null ? String(reviewer.id) : '';
  replaceDepotPackRequest(item);
  return item;
}

function classifyDepotPackAttachment(buffer) {
  const startsWith = (...bytes) => bytes.every((byte, index) => buffer[index] === byte);
  const textPrefix = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf8').replace(/^\uFEFF/, '').trimStart().toLowerCase();
  if (startsWith(0x4d, 0x5a) || startsWith(0x7f, 0x45, 0x4c, 0x46) ||
      startsWith(0xcf, 0xfa, 0xed, 0xfe) || startsWith(0xfe, 0xed, 0xfa, 0xcf) || textPrefix.startsWith('#!')) {
    return { detectedFormat: 'executable-content', automaticCheck: 'blocked', securityFlag: 'executable-content', quarantineStatus: 'blocked' };
  }
  if (/^(?:<!doctype\s+html|<html\b|<svg\b|<\?xml[^>]*>\s*<svg\b)/i.test(textPrefix)) {
    return { detectedFormat: 'active-content', automaticCheck: 'blocked', securityFlag: 'active-content', quarantineStatus: 'blocked' };
  }
  if (buffer.length >= 15 && buffer.subarray(0, 15).toString('ascii') === 'ANDROID BACKUP\n') {
    return { detectedFormat: 'android-backup', automaticCheck: 'recognized', securityFlag: '', quarantineStatus: 'pending_review' };
  }
  if (startsWith(0x50, 0x4b, 0x03, 0x04) || startsWith(0x50, 0x4b, 0x05, 0x06) || startsWith(0x50, 0x4b, 0x07, 0x08)) {
    const archiveIndex = buffer.toString('latin1').toLowerCase();
    const isKnownEMap = archiveIndex.includes('data.xml') && archiveIndex.includes('profile.xml');
    return {
      detectedFormat: isKnownEMap ? 'emap-zip' : 'zip-archive',
      automaticCheck: isKnownEMap ? 'recognized' : 'manual',
      securityFlag: '',
      quarantineStatus: 'pending_review',
    };
  }
  if (startsWith(0x25, 0x50, 0x44, 0x46, 0x2d)) return { detectedFormat: 'pdf', automaticCheck: 'recognized', securityFlag: '', quarantineStatus: 'pending_review' };
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { detectedFormat: 'png', automaticCheck: 'recognized', securityFlag: '', quarantineStatus: 'pending_review' };
  if (startsWith(0xff, 0xd8, 0xff)) return { detectedFormat: 'jpeg', automaticCheck: 'recognized', securityFlag: '', quarantineStatus: 'pending_review' };
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { detectedFormat: 'webp', automaticCheck: 'recognized', securityFlag: '', quarantineStatus: 'pending_review' };
  }
  if (startsWith(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c)) return { detectedFormat: '7z-archive', automaticCheck: 'manual', securityFlag: '', quarantineStatus: 'pending_review' };
  if (buffer.length >= 7 && buffer.subarray(0, 7).toString('latin1') === 'Rar!\x1a\x07') return { detectedFormat: 'rar-archive', automaticCheck: 'manual', securityFlag: '', quarantineStatus: 'pending_review' };
  if (startsWith(0x1f, 0x8b)) return { detectedFormat: 'gzip-archive', automaticCheck: 'manual', securityFlag: '', quarantineStatus: 'pending_review' };
  return { detectedFormat: 'unknown', automaticCheck: 'manual', securityFlag: '', quarantineStatus: 'pending_review' };
}

function depotPackRequestForOwner(requestId, sid) {
  return readDepotPackRequests().find((item) => item && item.id === requestId && item.sid === normalizeSid(sid)) || null;
}

function depotPackStoredBytes(requests, sid) {
  return (requests || []).reduce((total, item) => {
    if (!item || (sid && item.sid !== sid)) return total;
    return total + (Array.isArray(item.attachments) ? item.attachments.reduce((sum, entry) => sum + Number(entry.uploadedSize || 0), 0) : 0);
  }, 0);
}

function beginDepotPackUpload(sid, reservedBytes) {
  const normalizedSid = normalizeSid(sid);
  const now = Date.now();
  const recent = (depotPackUploadAttempts.get(normalizedSid) || []).filter((entry) => now - entry.at < DEPOT_PACK_UPLOAD_WINDOW_MS);
  const recentBytes = recent.reduce((sum, entry) => sum + entry.bytes, 0);
  if (recentBytes + reservedBytes > MAX_DEPOT_PACK_UPLOAD_BYTES_PER_WINDOW) throw new Error('Upload rate limit exceeded');
  if (depotPackActiveUploads.size >= MAX_DEPOT_PACK_ACTIVE_UPLOADS || depotPackActiveUploads.has(normalizedSid)) {
    throw new Error('Upload already in progress');
  }
  recent.push({ at: now, bytes: reservedBytes });
  depotPackUploadAttempts.set(normalizedSid, recent);
  depotPackActiveUploads.add(normalizedSid);
  return () => depotPackActiveUploads.delete(normalizedSid);
}

async function sampleDepotPackAttachment(filePath, size) {
  const sampleBytes = Math.min(2 * 1024 * 1024, size);
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const head = Buffer.alloc(sampleBytes);
    await handle.read(head, 0, sampleBytes, 0);
    if (size <= sampleBytes) return head;
    const tail = Buffer.alloc(sampleBytes);
    await handle.read(tail, 0, sampleBytes, Math.max(0, size - sampleBytes));
    return Buffer.concat([head, tail]);
  } finally {
    await handle.close();
  }
}

function streamDepotPackAttachment(req, tempPath, maxBytes) {
  return new Promise((resolve, reject) => {
    let total = 0;
    let settled = false;
    const hash = crypto.createHash('sha256');
    const output = fs.createWriteStream(tempPath, { flags: 'wx', mode: 0o600 });
    const fail = (error) => {
      if (settled) return;
      settled = true;
      req.unpipe(output);
      output.destroy();
      req.resume();
      reject(error);
    };
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        fail(new Error('Payload too large'));
        return;
      }
      hash.update(chunk);
    });
    req.on('error', fail);
    output.on('error', fail);
    output.on('finish', () => {
      if (settled) return;
      settled = true;
      resolve({ size: total, sha256: hash.digest('hex') });
    });
    req.pipe(output);
  });
}

async function storeDepotPackAttachment(requestId, attachmentId, sid, req, contentLength) {
  const item = depotPackRequestForOwner(requestId, sid);
  if (!item) throw new Error('Request not found');
  const attachment = Array.isArray(item.attachments)
    ? item.attachments.find((entry) => entry && entry.id === attachmentId)
    : null;
  if (!attachment) throw new Error('Attachment not found');
  if (attachment.status === 'uploaded') throw new Error('Attachment already uploaded');
  const requestAttachmentLimit = item.requestType === 'documents' ? MAX_DOCUMENT_ATTACHMENT_BYTES : MAX_DEPOT_PACK_ATTACHMENT_BYTES;
  if (contentLength > requestAttachmentLimit) throw new Error('Payload too large');
  const requests = readDepotPackRequests();
  const otherBytes = item.attachments.reduce((sum, entry) => sum + (entry.id === attachmentId ? 0 : Number(entry.uploadedSize || 0)), 0);
  const userBytes = depotPackStoredBytes(requests, item.sid);
  const globalBytes = depotPackStoredBytes(requests);
  const allowedBytes = Math.min(
    requestAttachmentLimit,
    Number(attachment.declaredSize || requestAttachmentLimit),
    MAX_DEPOT_PACK_TOTAL_BYTES - otherBytes,
    MAX_DEPOT_PACK_STORED_BYTES_PER_USER - userBytes,
    MAX_DEPOT_PACK_STORED_BYTES_GLOBAL - globalBytes
  );
  if (allowedBytes <= 0 || (contentLength > 0 && contentLength > allowedBytes)) throw new Error('Storage quota exceeded');
  const releaseUpload = beginDepotPackUpload(item.sid, contentLength > 0 ? contentLength : MAX_DEPOT_PACK_ATTACHMENT_BYTES);

  const requestDir = path.join(DEPOT_PACK_MATERIALS_DIR, item.id);
  const storageName = `${attachment.id}.upload`;
  const finalPath = path.join(requestDir, storageName);
  const tempPath = path.join(requestDir, `${attachment.id}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  const lockPath = path.join(requestDir, `${attachment.id}.lock`);
  let lockHandle;
  try {
    await fs.promises.mkdir(requestDir, { recursive: true, mode: 0o700 });
    try {
      lockHandle = await fs.promises.open(lockPath, 'wx', 0o600);
    } catch (error) {
      if (error && error.code === 'EEXIST') throw new Error('Upload already in progress');
      throw error;
    }
    const stored = await streamDepotPackAttachment(req, tempPath, allowedBytes);
    if (!stored.size) throw new Error('Invalid attachment size');
    if (stored.size !== Number(attachment.declaredSize || 0)) throw new Error('Invalid attachment size');
    const classification = classifyDepotPackAttachment(await sampleDepotPackAttachment(tempPath, stored.size));
    await fs.promises.rename(tempPath, finalPath);

    attachment.uploadedSize = stored.size;
    attachment.status = 'uploaded';
    attachment.detectedFormat = classification.detectedFormat;
    attachment.automaticCheck = classification.automaticCheck;
    attachment.securityFlag = classification.securityFlag;
    attachment.quarantineStatus = classification.quarantineStatus;
    attachment.reviewRequired = true;
    attachment.sha256 = stored.sha256;
    attachment.storageName = storageName;
    attachment.uploadedAt = new Date().toISOString();
    replaceDepotPackRequest(item);
    return attachment;
  } catch (error) {
    await fs.promises.rm(tempPath, { force: true }).catch(() => {});
    if (fs.existsSync(finalPath) && attachment.status !== 'uploaded') await fs.promises.rm(finalPath, { force: true }).catch(() => {});
    throw error;
  } finally {
    if (lockHandle) await lockHandle.close().catch(() => {});
    await fs.promises.rm(lockPath, { force: true }).catch(() => {});
    releaseUpload();
  }
}

function publicDepotPackRequest(item) {
  return {
    id: item.id,
    status: item.status,
    createdAt: item.createdAt,
    requestType: item.requestType,
    documentTitle: item.documentTitle || '',
    documentCategory: item.documentCategory || '',
    scope: item.scope || null,
    attachments: Array.isArray(item.attachments) ? item.attachments.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      originalName: entry.originalName,
      status: entry.status,
      detectedFormat: entry.detectedFormat,
      automaticCheck: entry.automaticCheck,
      securityFlag: entry.securityFlag || '',
      quarantineStatus: entry.quarantineStatus || 'pending_review',
    })) : [],
  };
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

  const now = Date.now();
  const sessionCandidates = Object.keys(sourceSessions).map(sessionId => {
    if (!isValidSessionId(sessionId)) return;
    const row = sourceSessions[sessionId] || {};
    const userId = normalizeStatsUserId(row.userId);
    const firstSeenAt = typeof row.firstSeenAt === 'string' ? row.firstSeenAt : '';
    const lastSeenAt = typeof row.lastSeenAt === 'string' ? row.lastSeenAt : '';
    const lastSeenAtMs = Date.parse(lastSeenAt);
    if (!userId || !Number.isFinite(lastSeenAtMs) || now - lastSeenAtMs > USER_PRESENCE_SESSION_RETENTION_MS) return;
    return { sessionId, userId, firstSeenAt, lastSeenAt, lastSeenAtMs };
  }).filter(Boolean).sort((a, b) => b.lastSeenAtMs - a.lastSeenAtMs);

  const sessionsPerUser = new Map();
  let acceptedSessionCount = 0;
  sessionCandidates.forEach(candidate => {
    if (acceptedSessionCount >= MAX_USER_PRESENCE_SESSIONS_GLOBAL) return;
    const count = sessionsPerUser.get(candidate.userId) || 0;
    if (count >= MAX_USER_PRESENCE_SESSIONS_PER_USER) return;
    sessionsPerUser.set(candidate.userId, count + 1);
    const { sessionId, userId, firstSeenAt, lastSeenAt } = candidate;
    sessions[sessionId] = {
      userId,
      firstSeenAt: firstSeenAt || lastSeenAt,
      lastSeenAt,
    };
    acceptedSessionCount += 1;
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
        scope: sanitizeDocsScope(row.scope),
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
    const invites = Object.values(store);
    if (invites.length >= MAX_ACTIVE_PARTNER_INVITES_GLOBAL ||
        invites.filter((item) => item && item.inviterSid === sid).length >= MAX_ACTIVE_PARTNER_INVITES_PER_USER) {
      sendJson(res, 429, { error: 'Слишком много активных приглашений. Используйте один из уже созданных кодов.' });
      return;
    }
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

function sanitizeDocsScope(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const level = ['network', 'railway', 'depot', 'service_arm'].includes(source.level) ? source.level : 'network';
  const scope = { level };
  if (level === 'railway' || level === 'depot' || level === 'service_arm') {
    scope.railway_id = sanitizeProfileText(source.railway_id == null ? source.railwayId : source.railway_id, 80);
  }
  if (level === 'depot' || level === 'service_arm') {
    scope.depot_id = sanitizeProfileText(source.depot_id == null ? source.depotId : source.depot_id, 160);
  }
  if (level === 'service_arm') {
    scope.service_arm_id = sanitizeProfileText(source.service_arm_id == null ? source.serviceArmId : source.service_arm_id, 160);
  }
  if ((level === 'railway' && !scope.railway_id) ||
      (level === 'depot' && !scope.depot_id) ||
      (level === 'service_arm' && (!scope.depot_id || !scope.service_arm_id))) {
    return { level: 'network' };
  }
  return scope;
}

function touchAuthenticatedUserPresence(rawUserId) {
  const userId = normalizeStatsUserId(rawUserId);
  if (!userId) return;

  const nowMs = Date.now();
  const previousTouch = authenticatedPresenceLastTouch.get(userId) || 0;
  if (nowMs - previousTouch < AUTHENTICATED_PRESENCE_TOUCH_INTERVAL_MS) return;

  const sessionId = `auth_${crypto.createHash('sha256').update(userId).digest('hex').slice(0, 24)}`;
  touchUserPresence(userId, sessionId, 'unknown');
  authenticatedPresenceLastTouch.set(userId, nowMs);
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
    '/uchet-marshrutov',
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
    normalizedPath.startsWith('/assets/catalog/') ||
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

const APP_RELEASE_VERSION = 'v410';
const APP_URL = PUBLIC_SITE_URL;
const TELEGRAM_APP_URL = buildVersionedAppUrl('/');

function buildVersionedAppUrl(rawPath) {
  const target = new URL(safeRedirectTarget(rawPath || '/'), PUBLIC_SITE_URL);
  target.searchParams.set('app', APP_RELEASE_VERSION);
  return target.toString();
}

function readBufferWithLimit(req, maxBytes) {
  const limit = Math.max(1, Number(maxBytes) || (2 * 1024 * 1024));
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let rejected = false;
    req.on('data', (chunk) => {
      if (rejected) return;
      total += chunk.length;
      if (total > limit) {
        rejected = true;
        reject(new Error('Payload too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!rejected) resolve(Buffer.concat(chunks, total));
    });
    req.on('error', (error) => {
      if (!rejected) reject(error);
    });
  });
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
const WELCOME_PROMO_URL = `${APP_URL}/assets/welcome-promo-v392.png`;

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

function buildAppKeyboard() {
  return {
    inline_keyboard: [
    [{ text: '✈️ Открыть в Telegram', web_app: { url: TELEGRAM_APP_URL } }],
    [{ text: '🌐 Открыть в браузере', url: TELEGRAM_APP_URL }],
    ],
  };
}

function buildWelcomeMessage(chatId, firstName) {
  const greeting = firstName ? `👋 Привет, ${firstName}!` : '👋 Привет!';
  return {
    chat_id: chatId,
    photo: WELCOME_PROMO_URL,
    caption:
      `${greeting}\n\n` +
      'Блокнот машиниста — рабочий журнал без лишних обещаний.\n\n' +
      'Здесь можно:\n' +
      '📅 вносить и просматривать смены\n' +
      '🕒 считать рабочие, ночные и праздничные часы\n' +
      '💸 видеть примерный заработок на главной\n' +
      '📚 открывать документы и инструкции\n' +
      '🚆 запускать «Поехали» из последней смены\n\n' +
      '🔒 Записи привязаны к твоему Telegram-аккаунту.\n\n' +
      'Открой приложение по кнопке ниже.',
    reply_markup: buildAppKeyboard(),
  };
}

function buildPlainWelcomeText(firstName) {
  return (firstName ? `👋 Привет, ${firstName}!\n\n` : '👋 Привет!\n\n') +
    'Блокнот машиниста — смены, часы, календарь, документы и режим «Поехали». ' +
    'Примерный заработок показывается на главной.\n\n' +
    'Открой приложение по кнопке ниже.';
}

function buildBotReply(chatId, text) {
  return {
    chat_id: chatId,
    text,
    reply_markup: buildAppKeyboard(),
    disable_web_page_preview: true,
  };
}

function isPrivateTelegramChat(message) {
  return !!(message && message.chat && message.chat.type === 'private');
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

  // The old client heartbeat was removed with the compact profile UI. Keep
  // presence accurate from real authenticated API activity instead, while
  // throttling writes so ordinary sync requests do not churn SQLite.
  if (sid && pathname.startsWith('/api/')) {
    touchAuthenticatedUserPresence(sid);
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
      if (!allowWindowedCount(analyticsEventsBySid, sid, events.length, ANALYTICS_RATE_LIMIT_MAX_EVENTS, ANALYTICS_RATE_LIMIT_WINDOW_MS)) {
        sendJson(res, 429, { error: 'Too many analytics events' });
        return;
      }
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
    if (!webhookSecret) {
      logStructuredRateLimited('error', 'telegram.webhook.secret_missing', 'telegram.webhook.secret_missing', {});
      sendJson(res, 503, { ok: false, error: 'webhook unavailable' });
      return;
    }
    if (!secureEqualText(requestWebhookSecret, webhookSecret)) {
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
        } else if (/^\/start(?:@\w+)?(?:\s|$)/i.test(normalizedText)) {
          callTelegramApi(token, 'sendPhoto', buildWelcomeMessage(chatId, firstName))
            .then(result => {
              if (!result || result.ok !== true) {
                return callTelegramApi(token, 'sendMessage', {
                  ...buildBotReply(chatId, buildPlainWelcomeText(firstName)),
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
        } else if (isPrivateTelegramChat(message)) {
          callTelegramApi(token, 'sendMessage', buildBotReply(
            chatId,
            'Нажми «Открыть в Telegram» в сообщении или кнопку «Открыть» в меню бота.'
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
      if (!allowWindowedCount(loginRequestAttemptsByClient, requestRateKey(req), 1, LOGIN_REQUEST_RATE_LIMIT_MAX, LOGIN_REQUEST_RATE_LIMIT_WINDOW_MS)) {
        sendJson(res, 429, { error: 'Слишком много запросов на вход. Подождите немного.' });
        return;
      }
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
        const message = err && err.message ? err.message : 'Invalid payload';
        sendJson(res, message === 'Login request capacity reached' ? 503 : 400, { error: message });
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

  const depotPackAttachmentMatch = pathname.match(/^\/api\/depot-pack-requests\/([a-f0-9]{24})\/attachments\/([a-f0-9]{20})$/);
  if (depotPackAttachmentMatch) {
    if (!sid) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (req.method !== 'PUT') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    const contentLength = Number(req.headers['content-length'] || 0);
    if (contentLength > MAX_DEPOT_PACK_ATTACHMENT_BYTES) {
      sendJson(res, 413, { error: 'Файл больше 50 МБ' });
      return;
    }
    try {
      const attachment = await storeDepotPackAttachment(
        depotPackAttachmentMatch[1],
        depotPackAttachmentMatch[2],
        sid,
        req,
        contentLength
      );
      sendJson(res, 200, {
        ok: true,
        attachment: {
          id: attachment.id,
          status: attachment.status,
          detectedFormat: attachment.detectedFormat,
          automaticCheck: attachment.automaticCheck,
          securityFlag: attachment.securityFlag || '',
          quarantineStatus: attachment.quarantineStatus || 'pending_review',
        },
      });
    } catch (err) {
      const errorMessage = err && err.message ? err.message : 'Upload failed';
      const statusCode = errorMessage === 'Request not found' || errorMessage === 'Attachment not found'
        ? 404
        : (errorMessage === 'Attachment already uploaded' || errorMessage === 'Upload already in progress' ? 409
          : (errorMessage === 'Payload too large' || errorMessage === 'Storage quota exceeded' ? 413
            : (errorMessage === 'Upload rate limit exceeded' ? 429 : (/^Invalid/.test(errorMessage) ? 400 : 500))));
      const publicMessage = errorMessage === 'Payload too large' ? 'Файл больше допустимого размера'
        : (errorMessage === 'Storage quota exceeded' ? 'Лимит хранилища материалов исчерпан'
          : (errorMessage === 'Upload rate limit exceeded' ? 'Слишком большой объём загрузок. Попробуйте позже.' : errorMessage));
      sendJson(res, statusCode, { error: publicMessage });
    }
    return;
  }

  const depotPackCompleteMatch = pathname.match(/^\/api\/depot-pack-requests\/([a-f0-9]{24})\/complete$/);
  if (depotPackCompleteMatch) {
    if (!sid) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    const item = depotPackRequestForOwner(depotPackCompleteMatch[1], sid);
    if (!item) {
      sendJson(res, 404, { error: 'Request not found' });
      return;
    }
    if (!Array.isArray(item.attachments) || !item.attachments.length || item.attachments.some((entry) => entry.status !== 'uploaded')) {
      sendJson(res, 409, { error: 'Сначала загрузите все выбранные файлы' });
      return;
    }
    item.status = 'new';
    item.submittedAt = item.submittedAt || new Date().toISOString();
    replaceDepotPackRequest(item);
    sendJson(res, 200, { ok: true, request: publicDepotPackRequest(item) });
    return;
  }

  if (pathname === '/api/depot-pack-requests') {
    if (!sid) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    if (!allowDepotPackRequest(sid)) {
      sendJson(res, 429, { error: 'Слишком много предложений. Попробуйте позже.' });
      return;
    }
    try {
      const body = await readBody(req);
      const result = writeDepotPackRequest(body ? JSON.parse(body) : {}, sid, requestUser);
      sendJson(res, result.duplicate ? 200 : 201, {
        ok: true,
        duplicate: result.duplicate,
        request: publicDepotPackRequest(result.item),
      });
    } catch (err) {
      const errorMessage = err && err.message ? err.message : 'Invalid payload';
      const isValidationError = /^(Expected|Missing|Invalid|Active document limit exceeded)/.test(errorMessage);
      logStructuredRateLimited(isValidationError ? 'warn' : 'error', 'catalog.depot_pack_request_rejected', `${sid}:${errorMessage}`, {
        sid,
        error: toErrorMeta(err),
      });
      const statusCode = errorMessage === 'Active document limit exceeded' ? 429 : (isValidationError ? 400 : 500);
      const publicMessage = errorMessage === 'Active document limit exceeded'
        ? 'У вас уже 10 документов в очереди. Дождитесь проверки существующих заявок.'
        : errorMessage;
      sendJson(res, statusCode, { error: publicMessage });
    }
    return;
  }

  const adminDepotPackAttachmentMatch = pathname.match(/^\/api\/admin\/depot-pack-requests\/([a-f0-9]{24})\/attachments\/([a-f0-9]{20})$/);
  if (adminDepotPackAttachmentMatch) {
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
    const item = readDepotPackRequests().find((entry) => entry && entry.id === adminDepotPackAttachmentMatch[1]);
    const attachment = item && Array.isArray(item.attachments)
      ? item.attachments.find((entry) => entry && entry.id === adminDepotPackAttachmentMatch[2])
      : null;
    const filePath = attachment && attachment.storageName
      ? path.join(DEPOT_PACK_MATERIALS_DIR, item.id, attachment.storageName)
      : '';
    if (!attachment || !filePath || !fs.existsSync(filePath)) {
      sendJson(res, 404, { error: 'Attachment not found' });
      return;
    }
    if (attachment.quarantineStatus === 'blocked' && parsedUrl.query.acknowledgeRisk !== '1') {
      sendJson(res, 423, { error: 'Файл заблокирован карантином: обнаружено активное или исполняемое содержимое' });
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="material"; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
      'Content-Length': fs.statSync(filePath).size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Download-Options': 'noopen',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const adminDepotPackRequestMatch = pathname.match(/^\/api\/admin\/depot-pack-requests\/([a-f0-9]{24})$/);
  if (adminDepotPackRequestMatch) {
    if (!requestUser) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (!isAnalyticsAdmin(requestUser)) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }
    if (req.method !== 'PATCH') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    const item = readDepotPackRequests().find((entry) => entry && entry.id === adminDepotPackRequestMatch[1]);
    if (!item) {
      sendJson(res, 404, { error: 'Request not found' });
      return;
    }
    try {
      const body = await readBody(req);
      const updated = updateDepotPackRequestReview(item, body ? JSON.parse(body) : {}, requestUser);
      const { attachments, ...safeItem } = updated;
      sendJson(res, 200, {
        ok: true,
        request: {
          ...safeItem,
          attachments: Array.isArray(attachments) ? attachments.map((attachment) => {
            const { storageName, ...safeAttachment } = attachment;
            return safeAttachment;
          }) : [],
        },
      });
    } catch (err) {
      const errorMessage = err && err.message ? err.message : 'Invalid payload';
      sendJson(res, /^(Expected|Invalid)/.test(errorMessage) ? 400 : 500, { error: errorMessage });
    }
    return;
  }

  if (pathname === '/api/admin/depot-pack-requests') {
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
    const requests = readDepotPackRequests().slice().reverse().map((item) => ({
      ...item,
      attachments: Array.isArray(item.attachments) ? item.attachments.map((attachment) => {
        const { storageName, ...safeAttachment } = attachment;
        return safeAttachment;
      }) : [],
    }));
    sendJson(res, 200, { requests, total: requests.length });
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

  if (RETIRED_SEO_PAGE_ROUTES.has(pathname)) {
    res.writeHead(301, {
      'Location': '/prilozhenie-dlya-mashinista',
      'Cache-Control': 'public, max-age=3600',
    });
    res.end();
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

  const versionedShellMatch = normalized.match(/^\/(styles|scripts)\/v\d+\/(.+)$/);
  if (versionedShellMatch) {
    const namespace = versionedShellMatch[1];
    const relativePath = versionedShellMatch[2];
    const safeSegments = relativePath.split('/').every((segment) =>
      segment && segment !== '.' && segment !== '..' && /^[A-Za-z0-9._-]+$/.test(segment)
    );
    const validExtension = namespace === 'styles'
      ? relativePath.endsWith('.css')
      : /\.(?:js|mjs)$/.test(relativePath);
    if (!safeSegments || !validExtension) {
      sendText(res, 404, 'Not found');
      return;
    }
    normalized = `/${namespace}/${relativePath}`;
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
  const onListening = () => {
    const address = server.address();
    const actualPort = address && typeof address === 'object' ? address.port : listenPort;
    const actualHost = LISTEN_HOST || 'localhost';
    console.log(`Shift tracker server listening on http://${actualHost}:${actualPort}`);
  };
  return LISTEN_HOST ? server.listen(listenPort, LISTEN_HOST, onListening) : server.listen(listenPort, onListening);
}

if (require.main === module) {
  startServer();
}

module.exports = {
  server,
  startServer,
  closeStorage,
  buildWelcomeMessage,
  buildPlainWelcomeText,
};
