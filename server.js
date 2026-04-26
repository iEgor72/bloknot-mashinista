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
const SALARY_PARAMS_DIR = path.join(DATA_DIR, 'local-salary-params');
const POEKHALI_LEARNING_DIR = path.join(DATA_DIR, 'poekhali-learning');
const POEKHALI_WARNINGS_DIR = path.join(DATA_DIR, 'poekhali-warnings');
const POEKHALI_RUNS_DIR = path.join(DATA_DIR, 'poekhali-runs');
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
const MAX_SHIFT_FIELD_COUNT = 260;
const MAX_SHIFT_ID_LENGTH = 128;
const MAX_SHIFT_TEXT_LENGTH = 512;
const MAX_SHIFT_NOTES_LENGTH = 4000;
const MAX_SHIFT_ISO_LENGTH = 40;
const MAX_POEKHALI_LEARNING_MAPS = 64;
const MAX_POEKHALI_LEARNING_SECTORS_PER_MAP = 512;
const MAX_POEKHALI_LEARNING_SAMPLES_PER_SECTOR = 450;
const MAX_POEKHALI_LEARNING_RAW_TRACKS_PER_MAP = 160;
const MAX_POEKHALI_LEARNING_RAW_SAMPLES_PER_TRACK = 1800;
const MAX_POEKHALI_LEARNING_USER_SECTIONS_PER_MAP = 240;
const MAX_POEKHALI_LEARNING_USER_POINTS_PER_SECTION = 1800;
const MAX_POEKHALI_LEARNING_USER_PROFILE_SEGMENTS_PER_SECTION = 1800;
const MAX_POEKHALI_LEARNING_USER_OBJECTS_PER_SECTION = 420;
const MAX_POEKHALI_LEARNING_USER_SPEEDS_PER_SECTION = 420;
const MAX_POEKHALI_LEARNING_USER_HISTORY_PER_SECTION = 80;
const MAX_POEKHALI_LEARNING_MAP_ID_LENGTH = 128;
const MAX_POEKHALI_LEARNING_SHIFT_ID_LENGTH = 128;
const MAX_POEKHALI_LEARNING_RUN_ID_LENGTH = 128;
const MAX_POEKHALI_WARNINGS_PER_PAYLOAD = 1000;
const MAX_POEKHALI_WARNING_ID_LENGTH = 128;
const MAX_POEKHALI_WARNING_TEXT_LENGTH = 240;
const MAX_POEKHALI_RUNS_PER_PAYLOAD = 500;
const MAX_POEKHALI_RUN_ID_LENGTH = 128;
const MAX_POEKHALI_RUN_POINTS_PER_RUN = 1800;
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
  if (!fs.existsSync(POEKHALI_LEARNING_DIR)) {
    fs.mkdirSync(POEKHALI_LEARNING_DIR, { recursive: true });
  }
  if (!fs.existsSync(POEKHALI_WARNINGS_DIR)) {
    fs.mkdirSync(POEKHALI_WARNINGS_DIR, { recursive: true });
  }
  if (!fs.existsSync(POEKHALI_RUNS_DIR)) {
    fs.mkdirSync(POEKHALI_RUNS_DIR, { recursive: true });
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

function getUserSalaryParamsFile(sid) {
  ensureDirs();
  return path.join(SALARY_PARAMS_DIR, `${normalizeSid(sid)}.json`);
}

function getUserPoekhaliLearningFile(sid) {
  ensureDirs();
  return path.join(POEKHALI_LEARNING_DIR, `${normalizeSid(sid)}.json`);
}

function getUserPoekhaliWarningsFile(sid) {
  ensureDirs();
  return path.join(POEKHALI_WARNINGS_DIR, `${normalizeSid(sid)}.json`);
}

function getUserPoekhaliRunsFile(sid) {
  ensureDirs();
  return path.join(POEKHALI_RUNS_DIR, `${normalizeSid(sid)}.json`);
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
  const file = getUserSalaryParamsFile(sid);
  try {
    if (!fs.existsSync(file)) return { ...DEFAULT_SALARY_PARAMS };
    const raw = fs.readFileSync(file, 'utf8');
    return sanitizeAndValidateSalaryParamsPayload(JSON.parse(raw || '{}'));
  } catch (err) {
    logStructuredRateLimited('error', 'storage.salary_params.read_failed', file, {
      sid: normalizeSid(sid),
      file,
      error: toErrorMeta(err),
    });
    return { ...DEFAULT_SALARY_PARAMS };
  }
}

function writeSalaryParams(sid, salaryParams) {
  const file = getUserSalaryParamsFile(sid);
  const serialized = JSON.stringify(sanitizeAndValidateSalaryParamsPayload(salaryParams), null, 2);
  atomicWriteFileSync(file, serialized);
}

function normalizeLearningTrackState(value) {
  let state = String(value || '').toLowerCase();
  if (state === 'on-track') state = 'ontrack';
  if (state === 'neartrack') state = 'near';
  if (state === 'off-track') state = 'offtrack';
  if (state === 'ontrack' || state === 'near' || state === 'offtrack') return state;
  return 'ontrack';
}

function sanitizeFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizePoekhaliLearningSample(sample, fallbackMapId) {
  if (!sample || typeof sample !== 'object' || Array.isArray(sample)) return null;

  const sector = Number(sample.sector);
  const coordinate = Number(sample.coordinate);
  const lat = Number(sample.lat);
  const lon = Number(sample.lon);
  if (!Number.isFinite(sector) || !Number.isFinite(coordinate) || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  const roundedCoordinate = Math.max(0, Math.round(coordinate));
  const meters = ((roundedCoordinate % 1000) + 1000) % 1000;
  const mapId = String(sample.mapId || fallbackMapId || '').slice(0, MAX_POEKHALI_LEARNING_MAP_ID_LENGTH);
  const shiftId = String(sample.shiftId || '').slice(0, MAX_POEKHALI_LEARNING_SHIFT_ID_LENGTH);

  return {
    mapId,
    sector,
    coordinate: roundedCoordinate,
    km: Math.floor(roundedCoordinate / 1000),
    pk: Math.floor(meters / 100) + 1,
    lat,
    lon,
    altitude: sample.altitude === null || sample.altitude === undefined || sample.altitude === ''
      ? null
      : sanitizeFiniteNumber(sample.altitude, null),
    accuracy: Math.max(0, Math.round(sanitizeFiniteNumber(sample.accuracy, 0))),
    speed: sanitizeFiniteNumber(sample.speed, 0),
    distance: sample.distance === null || sample.distance === undefined || sample.distance === ''
      ? null
      : Math.round(sanitizeFiniteNumber(sample.distance, 0)),
    trackState: normalizeLearningTrackState(sample.trackState),
    shiftId,
    ts: sanitizeFiniteNumber(sample.ts, Date.now()),
  };
}

function normalizePoekhaliRawTrackKey(value) {
  const key = String(value || '').trim().replace(/[^\w.:-]+/g, '-').slice(0, 160);
  return key || `raw-${Date.now()}`;
}

function sanitizePoekhaliRawLearningSample(sample, fallbackMapId) {
  if (!sample || typeof sample !== 'object' || Array.isArray(sample)) return null;

  const lat = Number(sample.lat);
  const lon = Number(sample.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  const nearestSector = Number(sample.nearestSector);
  const nearestCoordinate = Number(sample.nearestCoordinate);
  const roundedNearestCoordinate = Number.isFinite(nearestCoordinate)
    ? Math.max(0, Math.round(nearestCoordinate))
    : null;
  const meters = roundedNearestCoordinate === null
    ? null
    : ((roundedNearestCoordinate % 1000) + 1000) % 1000;

  return {
    mapId: String(sample.mapId || fallbackMapId || '').slice(0, MAX_POEKHALI_LEARNING_MAP_ID_LENGTH),
    lat,
    lon,
    altitude: sample.altitude === null || sample.altitude === undefined || sample.altitude === ''
      ? null
      : sanitizeFiniteNumber(sample.altitude, null),
    accuracy: Math.max(0, Math.round(sanitizeFiniteNumber(sample.accuracy, 0))),
    speed: sanitizeFiniteNumber(sample.speed, 0),
    distance: sample.distance === null || sample.distance === undefined || sample.distance === ''
      ? null
      : Math.round(sanitizeFiniteNumber(sample.distance, 0)),
    trackState: 'raw',
    shiftId: String(sample.shiftId || '').slice(0, MAX_POEKHALI_LEARNING_SHIFT_ID_LENGTH),
    runId: String(sample.runId || '').slice(0, MAX_POEKHALI_LEARNING_RUN_ID_LENGTH),
    nearestSector: Number.isFinite(nearestSector) ? nearestSector : null,
    nearestCoordinate: roundedNearestCoordinate,
    nearestKm: roundedNearestCoordinate === null ? null : Math.floor(roundedNearestCoordinate / 1000),
    nearestPk: meters === null ? null : Math.floor(meters / 100) + 1,
    ts: sanitizeFiniteNumber(sample.ts, Date.now()),
  };
}

function thinPayloadArray(items, maxItems) {
  const source = Array.isArray(items) ? items.filter(Boolean) : [];
  const max = Math.max(2, Math.round(Number(maxItems) || 0));
  if (source.length <= max) return source.slice();
  const result = [];
  let lastIndex = -1;
  for (let i = 0; i < max; i += 1) {
    const index = Math.round((i * (source.length - 1)) / (max - 1));
    if (index === lastIndex) continue;
    result.push(source[index]);
    lastIndex = index;
  }
  return result;
}

function sanitizePoekhaliUserPoint(point, fallbackSector) {
  if (!point || typeof point !== 'object' || Array.isArray(point)) return null;
  const lat = Number(point.lat);
  const lon = Number(point.lon);
  const ordinate = Number(point.ordinate !== undefined ? point.ordinate : point.coordinate);
  const sector = Number.isFinite(Number(point.sector)) ? Number(point.sector) : Number(fallbackSector);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(ordinate) || !Number.isFinite(sector)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return {
    lat,
    lon,
    ordinate: Math.max(0, Math.round(ordinate)),
    sector,
    altitude: point.altitude === null || point.altitude === undefined || point.altitude === ''
      ? null
      : sanitizeFiniteNumber(point.altitude, null),
    accuracy: Math.max(0, Math.round(sanitizeFiniteNumber(point.accuracy, 0))),
    ts: Math.max(0, sanitizeFiniteNumber(point.ts, 0)),
  };
}

function sanitizePoekhaliUserProfileSegment(segment, fallbackSector) {
  if (!segment || typeof segment !== 'object' || Array.isArray(segment)) return null;
  let start = Math.max(0, Math.round(Number(segment.start)));
  let end = Math.max(0, Math.round(Number(segment.end)));
  const sector = Number.isFinite(Number(segment.sector)) ? Number(segment.sector) : Number(fallbackSector);
  let length = Math.max(0, Math.round(sanitizeFiniteNumber(segment.length, Math.abs(end - start))));
  const grade = sanitizeFiniteNumber(segment.grade, NaN);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(length) || !Number.isFinite(grade) || !Number.isFinite(sector)) return null;
  if (end < start) {
    const swap = start;
    start = end;
    end = swap;
  }
  length = Math.max(1, end - start);
  return {
    start,
    end,
    length,
    grade: Math.max(-45, Math.min(45, grade)),
    sector,
    userSection: true,
    altitudeMissing: !!segment.altitudeMissing,
    sampleCount: Math.max(1, Math.round(sanitizeFiniteNumber(segment.sampleCount, 1))),
  };
}

function sanitizePoekhaliUserObject(item, fallbackSector) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const coordinate = Math.max(0, Math.round(Number(item.coordinate)));
  const length = Math.max(0, Math.round(sanitizeFiniteNumber(item.length, 0)));
  const sector = Number.isFinite(Number(item.sector)) ? Number(item.sector) : Number(fallbackSector);
  const type = String(item.type || '').trim().slice(0, 16);
  const name = String(item.name || '').trim().slice(0, 80);
  if (!Number.isFinite(coordinate) || !Number.isFinite(sector) || !type || !name) return null;
  const speed = sanitizeFiniteNumber(item.speed, NaN);
  const id = normalizePoekhaliRawTrackKey(item.id || item.key || `obj-${sector}-${type}-${coordinate}-${name}`).slice(0, 128);
  return {
    id,
    fileKey: 'user',
    sector,
    type,
    name,
    coordinate,
    length,
    end: coordinate + length,
    speed: Number.isFinite(speed) ? speed : null,
    source: sanitizePoekhaliUserEntitySource(item.source),
  };
}

function sanitizePoekhaliUserSpeed(rule, fallbackSector) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return null;
  const coordinate = Math.max(0, Math.round(Number(rule.coordinate)));
  let end = Math.round(sanitizeFiniteNumber(rule.end, NaN));
  const length = Math.max(0, Math.round(sanitizeFiniteNumber(rule.length, 0)));
  if (!Number.isFinite(end)) end = coordinate + length;
  end = Math.max(coordinate, end);
  const sector = Number.isFinite(Number(rule.sector)) ? Number(rule.sector) : Number(fallbackSector);
  const speed = sanitizeFiniteNumber(rule.speed, NaN);
  if (!Number.isFinite(coordinate) || !Number.isFinite(end) || !Number.isFinite(speed) || !Number.isFinite(sector)) return null;
  const id = normalizePoekhaliRawTrackKey(rule.id || rule.key || `speed-${sector}-${coordinate}-${end}-${Math.round(speed)}`).slice(0, 128);
  return {
    id,
    sector,
    wayNumber: Math.max(0, Math.round(sanitizeFiniteNumber(rule.wayNumber, 0))),
    coordinate,
    length: Math.max(0, end - coordinate),
    end,
    speed,
    name: String(rule.name || Math.round(speed)).trim().slice(0, 80),
    source: sanitizePoekhaliUserEntitySource(rule.source),
  };
}

function sanitizePoekhaliUserEntitySource(source) {
  const value = String(source || 'user').trim().toLowerCase();
  if (value === 'document' || value === 'doc') return 'document';
  if (value === 'regime' || value === 'rk') return 'regime';
  if (value === 'emap' || value === 'object' || value === 'speed') return 'emap';
  return 'user';
}

function sanitizePoekhaliUserHistoryItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const ts = Math.max(0, sanitizeFiniteNumber(item.ts || item.time, 0));
  const action = String(item.action || '').trim().slice(0, 48);
  const detail = String(item.detail || item.note || '').trim().slice(0, 160);
  if (!ts || !action) return null;
  return { ts, action, detail };
}

function sanitizePoekhaliUserSection(section, fallbackMapId, fallbackKey) {
  if (!section || typeof section !== 'object' || Array.isArray(section)) return null;
  const sector = Number(section.sector);
  if (!Number.isFinite(sector)) return null;
  let points = thinPayloadArray(
    Array.isArray(section.routePoints) ? section.routePoints : Array.isArray(section.points) ? section.points : [],
    MAX_POEKHALI_LEARNING_USER_POINTS_PER_SECTION,
  ).map((point) => sanitizePoekhaliUserPoint(point, sector)).filter(Boolean)
    .sort((a, b) => a.ordinate - b.ordinate || a.ts - b.ts);
  if (points.length < 2) return null;
  points = points.map((point, index) => ({ ...point, sector, position: index }));

  const profileSource = Array.isArray(section.profileSegments)
    ? section.profileSegments
    : Array.isArray(section.profile)
      ? section.profile
      : [];
  const profileSegments = thinPayloadArray(profileSource, MAX_POEKHALI_LEARNING_USER_PROFILE_SEGMENTS_PER_SECTION)
    .map((segment) => sanitizePoekhaliUserProfileSegment(segment, sector))
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  const objects = thinPayloadArray(section.objects, MAX_POEKHALI_LEARNING_USER_OBJECTS_PER_SECTION)
    .map((item) => sanitizePoekhaliUserObject(item, sector))
    .filter(Boolean)
    .sort((a, b) => a.coordinate - b.coordinate || String(a.type || '').localeCompare(String(b.type || '')));
  const speeds = thinPayloadArray(section.speeds, MAX_POEKHALI_LEARNING_USER_SPEEDS_PER_SECTION)
    .map((rule) => sanitizePoekhaliUserSpeed(rule, sector))
    .filter(Boolean)
    .sort((a, b) => a.coordinate - b.coordinate || a.speed - b.speed);
  const history = thinPayloadArray(section.history, MAX_POEKHALI_LEARNING_USER_HISTORY_PER_SECTION)
    .map((item) => sanitizePoekhaliUserHistoryItem(item))
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts)
    .slice(-MAX_POEKHALI_LEARNING_USER_HISTORY_PER_SECTION);
  const updatedAt = Math.max(0, sanitizeFiniteNumber(section.updatedAt, 0));
  const verifiedAt = Math.max(0, sanitizeFiniteNumber(section.verifiedAt, 0));
  const referenceSector = sanitizeFiniteNumber(section.referenceSector, NaN);
  const id = normalizePoekhaliRawTrackKey(section.id || fallbackKey || `user-${sector}`);
  return {
    id,
    mapId: String(section.mapId || fallbackMapId || '').slice(0, MAX_POEKHALI_LEARNING_MAP_ID_LENGTH),
    sector,
    referenceSector: Number.isFinite(referenceSector) ? referenceSector : null,
    title: String(section.title || `GPS участок ${Math.round(sector)}`).trim().slice(0, 80),
    sourceTrackKey: String(section.sourceTrackKey || '').slice(0, 160),
    createdAt: Math.max(0, sanitizeFiniteNumber(section.createdAt, verifiedAt || updatedAt)),
    updatedAt: updatedAt || verifiedAt,
    verifiedAt,
    routePoints: points,
    profileSegments,
    objects,
    speeds,
    history,
  };
}

function sanitizeAndValidatePoekhaliLearningPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Expected JSON object payload');
  }

  const source = payload.learning && typeof payload.learning === 'object' && !Array.isArray(payload.learning)
    ? payload.learning
    : payload;
  const maps = source.maps && typeof source.maps === 'object' && !Array.isArray(source.maps)
    ? source.maps
    : {};
  const mapIds = Object.keys(maps);
  if (mapIds.length > MAX_POEKHALI_LEARNING_MAPS) {
    throw new Error('Too many Poekhali learning maps');
  }

  const normalized = {
    version: 1,
    maps: {},
  };

  mapIds.forEach((rawMapId) => {
    const mapId = String(rawMapId || '').trim().slice(0, MAX_POEKHALI_LEARNING_MAP_ID_LENGTH);
    if (!mapId) return;

    const map = maps[rawMapId] && typeof maps[rawMapId] === 'object' && !Array.isArray(maps[rawMapId])
      ? maps[rawMapId]
      : {};
    const sectors = map.sectors && typeof map.sectors === 'object' && !Array.isArray(map.sectors)
      ? map.sectors
      : {};
    const rawTracks = map.rawTracks && typeof map.rawTracks === 'object' && !Array.isArray(map.rawTracks)
      ? map.rawTracks
      : {};
    const userSections = map.userSections && typeof map.userSections === 'object' && !Array.isArray(map.userSections)
      ? map.userSections
      : {};
    const sectorKeys = Object.keys(sectors);
    if (sectorKeys.length > MAX_POEKHALI_LEARNING_SECTORS_PER_MAP) {
      throw new Error('Too many Poekhali learning sectors');
    }
    const rawTrackKeys = Object.keys(rawTracks);
    if (rawTrackKeys.length > MAX_POEKHALI_LEARNING_RAW_TRACKS_PER_MAP) {
      throw new Error('Too many Poekhali raw learning tracks');
    }
    const userSectionKeys = Object.keys(userSections);
    if (userSectionKeys.length > MAX_POEKHALI_LEARNING_USER_SECTIONS_PER_MAP) {
      throw new Error('Too many Poekhali user learning sections');
    }

    const nextMap = {
      updatedAt: Math.max(0, sanitizeFiniteNumber(map.updatedAt, 0)),
      sectors: {},
      rawTracks: {},
      userSections: {},
    };

    sectorKeys.forEach((sectorKey) => {
      const bucket = sectors[sectorKey] && typeof sectors[sectorKey] === 'object' && !Array.isArray(sectors[sectorKey])
        ? sectors[sectorKey]
        : {};
      const samples = Array.isArray(bucket.samples) ? bucket.samples : [];
      let normalizedSamples = samples
        .map((sample) => sanitizePoekhaliLearningSample(sample, mapId))
        .filter(Boolean)
        .sort((a, b) => a.coordinate - b.coordinate || a.ts - b.ts);

      if (normalizedSamples.length > MAX_POEKHALI_LEARNING_SAMPLES_PER_SECTOR) {
        normalizedSamples = normalizedSamples.slice(normalizedSamples.length - MAX_POEKHALI_LEARNING_SAMPLES_PER_SECTOR);
      }
      if (!normalizedSamples.length) return;

      const safeSectorKey = String(sectorKey || normalizedSamples[0].sector);
      const updatedAt = Math.max(0, sanitizeFiniteNumber(bucket.updatedAt, nextMap.updatedAt));
      nextMap.sectors[safeSectorKey] = {
        samples: normalizedSamples,
        updatedAt,
        verifiedAt: Math.max(0, sanitizeFiniteNumber(bucket.verifiedAt, 0)),
        verifiedSamples: Math.max(0, Math.round(sanitizeFiniteNumber(bucket.verifiedSamples, 0))),
        verifiedProfileSegments: Math.max(0, Math.round(sanitizeFiniteNumber(bucket.verifiedProfileSegments, 0))),
      };
      nextMap.updatedAt = Math.max(nextMap.updatedAt, updatedAt);
    });

    rawTrackKeys.forEach((rawTrackKey) => {
      const bucket = rawTracks[rawTrackKey] && typeof rawTracks[rawTrackKey] === 'object' && !Array.isArray(rawTracks[rawTrackKey])
        ? rawTracks[rawTrackKey]
        : {};
      const samples = Array.isArray(bucket.samples) ? bucket.samples : [];
      let normalizedSamples = samples
        .map((sample) => sanitizePoekhaliRawLearningSample(sample, mapId))
        .filter(Boolean)
        .sort((a, b) => a.ts - b.ts);

      if (normalizedSamples.length > MAX_POEKHALI_LEARNING_RAW_SAMPLES_PER_TRACK) {
        normalizedSamples = normalizedSamples.slice(normalizedSamples.length - MAX_POEKHALI_LEARNING_RAW_SAMPLES_PER_TRACK);
      }
      if (!normalizedSamples.length) return;

      const safeRawTrackKey = normalizePoekhaliRawTrackKey(rawTrackKey);
      const updatedAt = Math.max(0, sanitizeFiniteNumber(bucket.updatedAt, nextMap.updatedAt));
      nextMap.rawTracks[safeRawTrackKey] = {
        samples: normalizedSamples,
        updatedAt,
        promotedAt: Math.max(0, sanitizeFiniteNumber(bucket.promotedAt, 0)),
      };
      nextMap.updatedAt = Math.max(nextMap.updatedAt, updatedAt);
    });

    userSectionKeys.forEach((sectionKey) => {
      const normalizedSection = sanitizePoekhaliUserSection(userSections[sectionKey], mapId, sectionKey);
      if (!normalizedSection) return;
      nextMap.userSections[normalizedSection.id] = normalizedSection;
      nextMap.updatedAt = Math.max(nextMap.updatedAt, normalizedSection.updatedAt || 0);
    });

    if (Object.keys(nextMap.sectors).length || Object.keys(nextMap.rawTracks).length || Object.keys(nextMap.userSections).length) {
      normalized.maps[mapId] = nextMap;
    }
  });

  return normalized;
}

function readPoekhaliLearning(sid) {
  const file = getUserPoekhaliLearningFile(sid);
  try {
    if (!fs.existsSync(file)) return { version: 1, maps: {} };
    const raw = fs.readFileSync(file, 'utf8');
    return sanitizeAndValidatePoekhaliLearningPayload(JSON.parse(raw || '{}'));
  } catch (err) {
    logStructuredRateLimited('error', 'storage.poekhali_learning.read_failed', file, {
      sid: normalizeSid(sid),
      file,
      error: toErrorMeta(err),
    });
    return { version: 1, maps: {} };
  }
}

function writePoekhaliLearning(sid, learning) {
  const file = getUserPoekhaliLearningFile(sid);
  const normalized = sanitizeAndValidatePoekhaliLearningPayload(learning);
  atomicWriteFileSync(file, JSON.stringify(normalized, null, 2));
  return normalized;
}

function readPoekhaliLearningFile(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return sanitizeAndValidatePoekhaliLearningPayload(JSON.parse(raw || '{}'));
  } catch (err) {
    logStructuredRateLimited('warn', 'storage.poekhali_learning.shared_read_failed', file, {
      file,
      error: toErrorMeta(err),
    });
    return { version: 1, maps: {} };
  }
}

function getPoekhaliLearningSampleSharedKey(sample) {
  return [
    sample.mapId,
    Math.round(Number(sample.sector) || 0),
    Math.round((Number(sample.coordinate) || 0) / 20),
  ].join(':');
}

function chooseBetterPoekhaliLearningSample(current, incoming) {
  if (!current) return incoming;
  const currentAccuracy = Number.isFinite(Number(current.accuracy)) && Number(current.accuracy) > 0
    ? Number(current.accuracy)
    : 9999;
  const incomingAccuracy = Number.isFinite(Number(incoming.accuracy)) && Number(incoming.accuracy) > 0
    ? Number(incoming.accuracy)
    : 9999;
  if (incomingAccuracy + 2 < currentAccuracy) return incoming;
  if (Math.abs(incomingAccuracy - currentAccuracy) <= 2 && (Number(incoming.ts) || 0) >= (Number(current.ts) || 0)) {
    return incoming;
  }
  return current;
}

function mergeSharedPoekhaliLearningBucket(baseBucket, incomingBucket, mapId) {
  const byKey = new Map();
  let updatedAt = 0;
  let verifiedAt = 0;
  let verifiedSamples = 0;
  let verifiedProfileSegments = 0;
  [baseBucket, incomingBucket].forEach((bucket) => {
    if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) return;
    updatedAt = Math.max(updatedAt, Math.max(0, sanitizeFiniteNumber(bucket.updatedAt, 0)));
    const bucketVerifiedAt = Math.max(0, sanitizeFiniteNumber(bucket.verifiedAt, 0));
    if (bucketVerifiedAt >= verifiedAt) {
      verifiedAt = bucketVerifiedAt;
      verifiedSamples = Math.max(0, Math.round(sanitizeFiniteNumber(bucket.verifiedSamples, 0)));
      verifiedProfileSegments = Math.max(0, Math.round(sanitizeFiniteNumber(bucket.verifiedProfileSegments, 0)));
    }
    (Array.isArray(bucket.samples) ? bucket.samples : []).forEach((item) => {
      const sample = sanitizePoekhaliLearningSample(item, mapId);
      if (!sample) return;
      const key = getPoekhaliLearningSampleSharedKey(sample);
      byKey.set(key, chooseBetterPoekhaliLearningSample(byKey.get(key), sample));
    });
  });
  let samples = Array.from(byKey.values()).sort((a, b) => a.coordinate - b.coordinate || a.ts - b.ts);
  samples = thinPayloadArray(samples, MAX_POEKHALI_LEARNING_SAMPLES_PER_SECTOR);
  if (!samples.length) return null;
  return {
    samples,
    updatedAt: updatedAt || samples[samples.length - 1].ts || 0,
    verifiedAt,
    verifiedSamples,
    verifiedProfileSegments,
  };
}

function getPoekhaliSharedSectionKey(section) {
  return `shared-${Math.round(Number(section && section.sector) || 0)}`;
}

function getPoekhaliSharedSectionScore(section) {
  if (!section) return -1;
  const verifiedBonus = section.verifiedAt ? 100000000000000 : 0;
  const pointBonus = Array.isArray(section.routePoints) ? section.routePoints.length * 1000 : 0;
  return verifiedBonus + pointBonus + Math.max(Number(section.updatedAt) || 0, Number(section.verifiedAt) || 0);
}

function mergeSharedPoekhaliUserSection(current, incoming, sharedKey) {
  if (!incoming) return current || null;
  const next = !current || getPoekhaliSharedSectionScore(incoming) >= getPoekhaliSharedSectionScore(current)
    ? incoming
    : current;
  return {
    ...next,
    id: sharedKey,
    title: next.title || `GPS участок ${Math.round(Number(next.sector) || 0)}`,
  };
}

function buildSharedPoekhaliLearning(stores) {
  const shared = { version: 1, maps: {} };
  (Array.isArray(stores) ? stores : []).forEach((store) => {
    const normalized = sanitizeAndValidatePoekhaliLearningPayload(store);
    Object.keys(normalized.maps || {}).forEach((mapId) => {
      const sourceMap = normalized.maps[mapId] || {};
      if (!shared.maps[mapId]) {
        shared.maps[mapId] = {
          updatedAt: 0,
          sectors: {},
          rawTracks: {},
          userSections: {},
        };
      }
      const targetMap = shared.maps[mapId];
      targetMap.updatedAt = Math.max(targetMap.updatedAt, Math.max(0, sanitizeFiniteNumber(sourceMap.updatedAt, 0)));
      Object.keys(sourceMap.sectors || {}).forEach((sectorKey) => {
        const mergedBucket = mergeSharedPoekhaliLearningBucket(targetMap.sectors[sectorKey], sourceMap.sectors[sectorKey], mapId);
        if (!mergedBucket) return;
        targetMap.sectors[sectorKey] = mergedBucket;
        targetMap.updatedAt = Math.max(targetMap.updatedAt, mergedBucket.updatedAt || 0);
      });
      Object.keys(sourceMap.userSections || {}).forEach((sectionKey) => {
        const section = sanitizePoekhaliUserSection(sourceMap.userSections[sectionKey], mapId, sectionKey);
        if (!section) return;
        const sharedKey = getPoekhaliSharedSectionKey(section);
        const mergedSection = mergeSharedPoekhaliUserSection(targetMap.userSections[sharedKey], section, sharedKey);
        if (!mergedSection) return;
        targetMap.userSections[sharedKey] = mergedSection;
        targetMap.updatedAt = Math.max(targetMap.updatedAt, mergedSection.updatedAt || 0, mergedSection.verifiedAt || 0);
      });
    });
  });
  Object.keys(shared.maps || {}).forEach((mapId) => {
    const map = shared.maps[mapId];
    const sectorKeys = Object.keys(map.sectors || {});
    if (sectorKeys.length > MAX_POEKHALI_LEARNING_SECTORS_PER_MAP) {
      const keep = new Set(sectorKeys
        .sort((a, b) => (Number(map.sectors[b].updatedAt) || 0) - (Number(map.sectors[a].updatedAt) || 0))
        .slice(0, MAX_POEKHALI_LEARNING_SECTORS_PER_MAP));
      sectorKeys.forEach((key) => {
        if (!keep.has(key)) delete map.sectors[key];
      });
    }
    const sectionKeys = Object.keys(map.userSections || {});
    if (sectionKeys.length > MAX_POEKHALI_LEARNING_USER_SECTIONS_PER_MAP) {
      const keep = new Set(sectionKeys
        .sort((a, b) => getPoekhaliSharedSectionScore(map.userSections[b]) - getPoekhaliSharedSectionScore(map.userSections[a]))
        .slice(0, MAX_POEKHALI_LEARNING_USER_SECTIONS_PER_MAP));
      sectionKeys.forEach((key) => {
        if (!keep.has(key)) delete map.userSections[key];
      });
    }
    if (!Object.keys(map.sectors || {}).length && !Object.keys(map.userSections || {}).length) {
      delete shared.maps[mapId];
    }
  });
  const mapKeys = Object.keys(shared.maps || {});
  if (mapKeys.length > MAX_POEKHALI_LEARNING_MAPS) {
    const keep = new Set(mapKeys
      .sort((a, b) => (Number(shared.maps[b].updatedAt) || 0) - (Number(shared.maps[a].updatedAt) || 0))
      .slice(0, MAX_POEKHALI_LEARNING_MAPS));
    mapKeys.forEach((key) => {
      if (!keep.has(key)) delete shared.maps[key];
    });
  }
  return sanitizeAndValidatePoekhaliLearningPayload(shared);
}

function readSharedPoekhaliLearning(sid) {
  ensureDirs();
  const excludedSid = normalizeSid(sid);
  let files = [];
  try {
    files = fs.readdirSync(POEKHALI_LEARNING_DIR)
      .filter((name) => name.endsWith('.json'))
      .filter((name) => path.basename(name, '.json') !== excludedSid)
      .map((name) => path.join(POEKHALI_LEARNING_DIR, name));
  } catch (err) {
    logStructuredRateLimited('warn', 'storage.poekhali_learning.shared_scan_failed', excludedSid, {
      sid: excludedSid,
      error: toErrorMeta(err),
    });
    return { version: 1, maps: {} };
  }
  return buildSharedPoekhaliLearning(files.map((file) => readPoekhaliLearningFile(file)));
}

function normalizeDateOnly(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
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
    mapId: String(item.mapId || '').trim().slice(0, MAX_POEKHALI_LEARNING_MAP_ID_LENGTH),
    shiftId: String(item.shiftId || '').trim().slice(0, MAX_POEKHALI_LEARNING_SHIFT_ID_LENGTH),
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
  const file = getUserPoekhaliWarningsFile(sid);
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    return sanitizeAndValidatePoekhaliWarningsPayload({ warnings: JSON.parse(raw || '[]') });
  } catch (err) {
    logStructuredRateLimited('error', 'storage.poekhali_warnings.read_failed', file, {
      sid: normalizeSid(sid),
      file,
      error: toErrorMeta(err),
    });
    return [];
  }
}

function writePoekhaliWarnings(sid, warnings) {
  const file = getUserPoekhaliWarningsFile(sid);
  const normalized = sanitizeAndValidatePoekhaliWarningsPayload({ warnings: Array.isArray(warnings) ? warnings : [] });
  atomicWriteFileSync(file, JSON.stringify(normalized, null, 2));
  return normalized;
}

function sanitizePoekhaliRunPoint(point) {
  if (!point || typeof point !== 'object' || Array.isArray(point)) return null;
  const sector = Number(point.sector);
  const coordinate = Number(point.coordinate);
  if (!Number.isFinite(sector) || !Number.isFinite(coordinate)) return null;
  const roundedCoordinate = Math.max(0, Math.round(coordinate));
  const meters = ((roundedCoordinate % 1000) + 1000) % 1000;
  const lat = Number(point.lat);
  const lon = Number(point.lon);
  const result = {
    sector,
    coordinate: roundedCoordinate,
    km: Math.floor(roundedCoordinate / 1000),
    pk: Math.floor(meters / 100) + 1,
    ts: sanitizeFiniteNumber(point.ts, Date.now()),
  };
  if (Number.isFinite(lat) && lat >= -90 && lat <= 90) result.lat = lat;
  if (Number.isFinite(lon) && lon >= -180 && lon <= 180) result.lon = lon;
  const accuracy = Number(point.accuracy);
  if (Number.isFinite(accuracy)) result.accuracy = Math.max(0, Math.round(accuracy));
  const speedKmh = Number(point.speedKmh);
  if (Number.isFinite(speedKmh)) result.speedKmh = Math.max(0, Math.round(speedKmh));
  return result;
}

function sanitizePoekhaliRunItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const id = String(item.id || '').trim().slice(0, MAX_POEKHALI_RUN_ID_LENGTH);
  if (!id) return null;
  const nowIso = new Date().toISOString();
  const startedAt = normalizeIsoish(item.startedAt) || normalizeIsoish(item.createdAt) || nowIso;
  const status = ['active', 'paused', 'finished'].includes(String(item.status || '')) ? String(item.status) : 'finished';
  const points = thinPayloadArray(
    Array.isArray(item.points) ? item.points : [],
    MAX_POEKHALI_RUN_POINTS_PER_RUN,
  )
    .map((point) => sanitizePoekhaliRunPoint(point))
    .filter(Boolean)
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const startPoint = sanitizePoekhaliRunPoint(item.startPoint) || points[0] || null;
  const endPoint = sanitizePoekhaliRunPoint(item.endPoint || item.lastPoint) || points[points.length - 1] || null;
  const lastPoint = sanitizePoekhaliRunPoint(item.lastPoint || item.endPoint || item.startPoint) || endPoint || startPoint;

  return {
    id,
    shiftId: String(item.shiftId || '').trim().slice(0, MAX_POEKHALI_LEARNING_SHIFT_ID_LENGTH),
    mapId: String(item.mapId || '').trim().slice(0, MAX_POEKHALI_LEARNING_MAP_ID_LENGTH),
    mapTitle: String(item.mapTitle || '').trim().slice(0, MAX_SHIFT_TEXT_LENGTH),
    route: String(item.route || '').trim().slice(0, MAX_SHIFT_TEXT_LENGTH),
    trainNumber: String(item.trainNumber || '').trim().slice(0, 32),
    loco: String(item.loco || '').trim().slice(0, MAX_SHIFT_TEXT_LENGTH),
    weight: String(item.weight || '').trim().slice(0, 32),
    axles: String(item.axles || '').trim().slice(0, 32),
    conditionalLength: Math.max(0, Math.round(sanitizeFiniteNumber(item.conditionalLength, 0))),
    lengthMeters: Math.max(0, Math.round(sanitizeFiniteNumber(item.lengthMeters, 0))),
    lengthLabel: String(item.lengthLabel || '').trim().slice(0, 64),
    lengthSource: String(item.lengthSource || '').trim().slice(0, 64),
    compositionType: String(item.compositionType || '').trim().slice(0, 64),
    compositionReadiness: String(item.compositionReadiness || '').trim().slice(0, 64),
    direction: String(item.direction || '').trim().slice(0, 16),
    track: String(item.track || '').trim().slice(0, 24),
    status,
    startedAt,
    endedAt: normalizeIsoish(item.endedAt),
    durationMs: Math.max(0, Math.round(sanitizeFiniteNumber(item.durationMs, 0))),
    movingDurationMs: Math.max(0, Math.round(sanitizeFiniteNumber(item.movingDurationMs, 0))),
    idleDurationMs: Math.max(0, Math.round(sanitizeFiniteNumber(item.idleDurationMs, 0))),
    distanceMeters: Math.max(0, Math.round(sanitizeFiniteNumber(item.distanceMeters, 0))),
    maxSpeedKmh: Math.max(0, Math.round(sanitizeFiniteNumber(item.maxSpeedKmh, 0))),
    averageSpeedKmh: Math.max(0, Math.round(sanitizeFiniteNumber(item.averageSpeedKmh, 0) * 10) / 10),
    technicalSpeedKmh: Math.max(0, Math.round(sanitizeFiniteNumber(item.technicalSpeedKmh, 0) * 10) / 10),
    overspeedMaxKmh: Math.max(0, Math.round(sanitizeFiniteNumber(item.overspeedMaxKmh, 0))),
    overspeedDurationMs: Math.max(0, Math.round(sanitizeFiniteNumber(item.overspeedDurationMs, 0))),
    overspeedDistanceMeters: Math.max(0, Math.round(sanitizeFiniteNumber(item.overspeedDistanceMeters, 0))),
    warningsCount: Math.max(0, Math.round(sanitizeFiniteNumber(item.warningsCount, 0))),
    alertCount: Math.max(0, Math.round(sanitizeFiniteNumber(item.alertCount, 0))),
    lastAlertKind: String(item.lastAlertKind || '').trim().slice(0, 32),
    lastAlertLevel: String(item.lastAlertLevel || '').trim().slice(0, 16),
    lastAlertTitle: String(item.lastAlertTitle || '').trim().slice(0, 80),
    lastAlertText: String(item.lastAlertText || '').trim().slice(0, 160),
    lastAlertDistanceMeters: Math.max(0, Math.round(sanitizeFiniteNumber(item.lastAlertDistanceMeters, 0))),
    lastAlertAt: normalizeIsoish(item.lastAlertAt),
    activeRestrictionLabel: String(item.activeRestrictionLabel || '').trim().slice(0, 64),
    activeRestrictionSource: String(item.activeRestrictionSource || '').trim().slice(0, 32),
    activeRestrictionSpeedKmh: Math.max(0, Math.round(sanitizeFiniteNumber(item.activeRestrictionSpeedKmh, 0))),
    activeRestrictionSector: Math.max(0, Math.round(sanitizeFiniteNumber(item.activeRestrictionSector, 0))),
    activeRestrictionStart: Math.max(0, Math.round(sanitizeFiniteNumber(item.activeRestrictionStart, 0))),
    activeRestrictionEnd: Math.max(0, Math.round(sanitizeFiniteNumber(item.activeRestrictionEnd, 0))),
    activeRestrictionDistanceToEnd: Math.max(0, Math.round(sanitizeFiniteNumber(item.activeRestrictionDistanceToEnd, 0))),
    activeRestrictionUpdatedAt: normalizeIsoish(item.activeRestrictionUpdatedAt),
    nextRestrictionLabel: String(item.nextRestrictionLabel || '').trim().slice(0, 64),
    nextRestrictionSource: String(item.nextRestrictionSource || '').trim().slice(0, 32),
    nextRestrictionSpeedKmh: Math.max(0, Math.round(sanitizeFiniteNumber(item.nextRestrictionSpeedKmh, 0))),
    nextRestrictionSector: Math.max(0, Math.round(sanitizeFiniteNumber(item.nextRestrictionSector, 0))),
    nextRestrictionCoordinate: Math.max(0, Math.round(sanitizeFiniteNumber(item.nextRestrictionCoordinate, 0))),
    nextRestrictionDistanceMeters: Math.max(0, Math.round(sanitizeFiniteNumber(item.nextRestrictionDistanceMeters, 0))),
    nextRestrictionEtaSeconds: Math.max(0, Math.round(sanitizeFiniteNumber(item.nextRestrictionEtaSeconds, 0))),
    nextRestrictionUpdatedAt: normalizeIsoish(item.nextRestrictionUpdatedAt),
    nextSignalName: String(item.nextSignalName || '').trim().slice(0, 64),
    nextSignalSource: String(item.nextSignalSource || '').trim().slice(0, 32),
    nextSignalSector: Math.max(0, Math.round(sanitizeFiniteNumber(item.nextSignalSector, 0))),
    nextSignalCoordinate: Math.max(0, Math.round(sanitizeFiniteNumber(item.nextSignalCoordinate, 0))),
    nextSignalDistanceMeters: Math.max(0, Math.round(sanitizeFiniteNumber(item.nextSignalDistanceMeters, 0))),
    nextSignalEtaSeconds: Math.max(0, Math.round(sanitizeFiniteNumber(item.nextSignalEtaSeconds, 0))),
    nextStationName: String(item.nextStationName || '').trim().slice(0, 96),
    nextStationSource: String(item.nextStationSource || '').trim().slice(0, 32),
    nextStationSector: Math.max(0, Math.round(sanitizeFiniteNumber(item.nextStationSector, 0))),
    nextStationCoordinate: Math.max(0, Math.round(sanitizeFiniteNumber(item.nextStationCoordinate, 0))),
    nextStationDistanceMeters: Math.max(0, Math.round(sanitizeFiniteNumber(item.nextStationDistanceMeters, 0))),
    nextStationEtaSeconds: Math.max(0, Math.round(sanitizeFiniteNumber(item.nextStationEtaSeconds, 0))),
    nextTargetKind: String(item.nextTargetKind || '').trim().slice(0, 32),
    nextTargetLabel: String(item.nextTargetLabel || '').trim().slice(0, 96),
    nextTargetSource: String(item.nextTargetSource || '').trim().slice(0, 32),
    nextTargetSector: Math.max(0, Math.round(sanitizeFiniteNumber(item.nextTargetSector, 0))),
    nextTargetCoordinate: Math.max(0, Math.round(sanitizeFiniteNumber(item.nextTargetCoordinate, 0))),
    nextTargetDistanceMeters: Math.max(0, Math.round(sanitizeFiniteNumber(item.nextTargetDistanceMeters, 0))),
    nextTargetEtaSeconds: Math.max(0, Math.round(sanitizeFiniteNumber(item.nextTargetEtaSeconds, 0))),
    nextTargetUpdatedAt: normalizeIsoish(item.nextTargetUpdatedAt),
    routeFromName: String(item.routeFromName || '').trim().slice(0, 96),
    routeToName: String(item.routeToName || '').trim().slice(0, 96),
    routeStatus: String(item.routeStatus || '').trim().slice(0, 32),
    routeFromCoordinate: Math.max(0, Math.round(sanitizeFiniteNumber(item.routeFromCoordinate, 0))),
    routeToCoordinate: Math.max(0, Math.round(sanitizeFiniteNumber(item.routeToCoordinate, 0))),
    routeDistanceMeters: Math.max(0, Math.round(sanitizeFiniteNumber(item.routeDistanceMeters, 0))),
    routePassedMeters: Math.max(0, Math.round(sanitizeFiniteNumber(item.routePassedMeters, 0))),
    routeRemainingMeters: Math.max(0, Math.round(sanitizeFiniteNumber(item.routeRemainingMeters, 0))),
    routeOutsideMeters: Math.max(0, Math.round(sanitizeFiniteNumber(item.routeOutsideMeters, 0))),
    routeProgressPct: Math.max(0, Math.min(100, Math.round(sanitizeFiniteNumber(item.routeProgressPct, 0) * 10) / 10)),
    routeEtaSeconds: Math.max(0, Math.round(sanitizeFiniteNumber(item.routeEtaSeconds, 0))),
    points,
    startPoint,
    endPoint,
    lastPoint,
    createdAt: normalizeIsoish(item.createdAt) || startedAt,
    updatedAt: normalizeIsoish(item.updatedAt) || normalizeIsoish(item.endedAt) || startedAt,
    deletedAt: normalizeIsoish(item.deletedAt),
  };
}

function sanitizeAndValidatePoekhaliRunsPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Expected JSON object payload');
  }
  const source = Array.isArray(payload.runs) ? payload.runs : [];
  if (source.length > MAX_POEKHALI_RUNS_PER_PAYLOAD) {
    throw new Error('Too many Poekhali runs');
  }
  return source
    .map((item) => sanitizePoekhaliRunItem(item))
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = Date.parse(a.startedAt || a.createdAt || '') || 0;
      const bTime = Date.parse(b.startedAt || b.createdAt || '') || 0;
      if (aTime !== bTime) return bTime - aTime;
      return a.id.localeCompare(b.id);
    });
}

function readPoekhaliRuns(sid) {
  const file = getUserPoekhaliRunsFile(sid);
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    return sanitizeAndValidatePoekhaliRunsPayload({ runs: JSON.parse(raw || '[]') });
  } catch (err) {
    logStructuredRateLimited('error', 'storage.poekhali_runs.read_failed', file, {
      sid: normalizeSid(sid),
      file,
      error: toErrorMeta(err),
    });
    return [];
  }
}

function writePoekhaliRuns(sid, runs) {
  const file = getUserPoekhaliRunsFile(sid);
  const normalized = sanitizeAndValidatePoekhaliRunsPayload({ runs: Array.isArray(runs) ? runs : [] });
  atomicWriteFileSync(file, JSON.stringify(normalized, null, 2));
  return normalized;
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

  if (pathname === '/api/poekhali-learning') {
    if (!sid) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, {
        sid,
        learning: readPoekhaliLearning(sid),
        sharedLearning: readSharedPoekhaliLearning(sid),
      });
      return;
    }

    if (req.method === 'PUT') {
      try {
        const body = await readBody(req);
        const payload = body ? JSON.parse(body) : {};
        const learning = writePoekhaliLearning(sid, payload);
        sendJson(res, 200, {
          ok: true,
          sid,
          learning,
          sharedLearning: readSharedPoekhaliLearning(sid),
        });
      } catch (err) {
        const errorMessage = err && err.message ? err.message : 'Invalid payload';
        const isValidationError = /^(Expected|Too many|Invalid|Missing|Payload too large)/.test(errorMessage);
        logStructuredRateLimited(isValidationError ? 'warn' : 'error', 'storage.poekhali_learning.write_rejected', `${sid}:${errorMessage}`, {
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

  if (pathname === '/api/poekhali-runs') {
    if (!sid) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, { sid, runs: readPoekhaliRuns(sid) });
      return;
    }

    if (req.method === 'PUT') {
      try {
        const body = await readBody(req);
        const payload = body ? JSON.parse(body) : {};
        const runs = writePoekhaliRuns(sid, payload && payload.runs);
        sendJson(res, 200, { ok: true, sid, runs });
      } catch (err) {
        const errorMessage = err && err.message ? err.message : 'Invalid payload';
        const isValidationError = /^(Expected|Too many|Invalid|Missing|Payload too large)/.test(errorMessage);
        logStructuredRateLimited(isValidationError ? 'warn' : 'error', 'storage.poekhali_runs.write_rejected', `${sid}:${errorMessage}`, {
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
