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
const DOCS_ROOT_DIR = path.join(ROOT, 'assets', 'docs');
const DOCS_PUBLIC_UPLOADS_DIR = path.join(DOCS_ROOT_DIR, 'uploads');
const DOCS_FILES_DIR = DOCS_PUBLIC_UPLOADS_DIR;
const DOCS_DATA_DIR = path.join(DATA_DIR, 'docs');
const DOCS_CATALOG_FILE = path.join(DOCS_DATA_DIR, 'catalog.json');
const LEGACY_DOCS_MANIFEST_FILE = path.join(DOCS_ROOT_DIR, 'manifest.json');
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
const MAX_DOCS_PER_SECTION = 500;
const MAX_DOC_TITLE_LENGTH = 160;
const MAX_DOC_SUBTITLE_LENGTH = 240;
const MAX_DOC_ID_LENGTH = 64;
const MAX_DOC_UPLOAD_BYTES = 15 * 1024 * 1024;
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://bloknot-mashinista-bot.ru';
const SEO_PAGE_ROUTES = {
  '/uchet-marshrutov': 'docs/seo/uchet-marshrutov.html',
  '/zarplata-mashinista': 'docs/seo/zarplata-mashinista.html',
  '/zhurnal-smen-mashinista': 'docs/seo/zhurnal-smen-mashinista.html',
  '/kalkulyator-zarplaty-mashinista': 'docs/seo/kalkulyator-zarplaty-mashinista.html',
  '/grafik-smen-mashinista': 'docs/seo/grafik-smen-mashinista.html',
  '/prilozhenie-dlya-mashinista': 'docs/seo/prilozhenie-dlya-mashinista.html',
};
const DOC_SECTION_ORDER = ['speeds', 'folders', 'instructions', 'memos', 'reminders'];
const ALLOWED_DOC_UPLOAD_TYPES = Object.freeze({
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
});

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
    user: withAdminFlag(user),
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
    return withAdminFlag(payload.user);
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
  return withAdminFlag({
    id: String(id), first_name: first, last_name: last, username: uname,
    photo_url: params.get('photo_url') || '', auth_date: authDate,
    display_name: [first, last].join(' ').trim() || uname || ('ID ' + id),
  });
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
    return withAdminFlag({
      id: String(parsed.id), first_name: first, last_name: last, username: uname,
      photo_url: parsed.photo_url || '', auth_date: authDate,
      display_name: [first, last].join(' ').trim() || uname || ('ID ' + parsed.id),
    });
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
  if (!fs.existsSync(DOCS_DATA_DIR)) {
    fs.mkdirSync(DOCS_DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DOCS_FILES_DIR)) {
    fs.mkdirSync(DOCS_FILES_DIR, { recursive: true });
  }
}

function normalizeDocSection(rawSection) {
  const section = typeof rawSection === 'string' ? rawSection.trim().toLowerCase() : '';
  return DOC_SECTION_ORDER.includes(section) ? section : '';
}

function sanitizeDocText(rawValue, maxLength) {
  if (rawValue === undefined || rawValue === null) return '';
  const value = String(rawValue).trim().replace(/\s+/g, ' ');
  if (value.length > maxLength) throw new Error('Invalid document metadata');
  return value;
}

function slugifyDocBaseName(rawValue) {
  return String(rawValue || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .toLowerCase()
    .slice(0, 80);
}

function sanitizeDocId(rawValue) {
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value)) throw new Error('Invalid document id');
  return value.toLowerCase();
}

function sanitizeDocFilename(rawValue) {
  const value = String(rawValue || '').trim();
  const ext = path.extname(value).toLowerCase();
  const mimeType = ALLOWED_DOC_UPLOAD_TYPES[ext] || '';
  const base = slugifyDocBaseName(path.basename(value, ext));
  if (!ext || !mimeType || !base) throw new Error('Unsupported document file type');
  return {
    ext,
    mimeType,
    baseName: `${base}${ext}`,
    originalName: path.basename(value),
  };
}

function getAdminAllowlist() {
  return new Set(
    String(process.env.ADMIN_TELEGRAM_IDS || process.env.BM_ADMIN_TELEGRAM_IDS || process.env.OWNER_TELEGRAM_ID || '')
      .split(',')
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  );
}

function isAdminUser(user) {
  if (!user || !user.id) return false;
  return getAdminAllowlist().has(String(user.id));
}

function requireAdminUser(req, res) {
  const user = getUserFromRequest(req);
  if (!user) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return null;
  }
  if (!isAdminUser(user)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return null;
  }
  return user;
}

function createDocId() {
  return `doc_${crypto.randomBytes(8).toString('hex')}`.slice(0, MAX_DOC_ID_LENGTH);
}

function readLegacyDocsManifest() {
  try {
    const raw = fs.readFileSync(LEGACY_DOCS_MANIFEST_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function inferDocMimeType(filePathValue, fallback) {
  const ext = path.extname(String(filePathValue || '')).toLowerCase();
  return fallback || ALLOWED_DOC_UPLOAD_TYPES[ext] || (ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream');
}

function bootstrapDocsCatalog() {
  const legacy = readLegacyDocsManifest();
  const documents = [];
  DOC_SECTION_ORDER.forEach((section) => {
    const list = Array.isArray(legacy[section]) ? legacy[section] : [];
    list.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      const title = sanitizeDocText(item.title || item.name || '', MAX_DOC_TITLE_LENGTH) || 'Файл';
      const subtitle = sanitizeDocText(item.subtitle || '', MAX_DOC_SUBTITLE_LENGTH);
      const assetPath = typeof item.path === 'string' ? item.path.trim() : '';
      if (!assetPath.startsWith('/')) return;
      documents.push({
        id: createDocId(),
        section,
        title,
        subtitle,
        name: sanitizeDocText(item.name || title, MAX_DOC_TITLE_LENGTH) || title,
        storage: 'legacy',
        assetPath,
        mimeType: inferDocMimeType(assetPath, typeof item.mime_type === 'string' ? item.mime_type.trim() : ''),
        size: Number.isFinite(item.size) ? item.size : 0,
        updatedAt: typeof item.updated_at === 'string' ? item.updated_at : new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
        sortOrder: index,
        deleted: false,
      });
    });
  });
  return { version: 1, documents };
}

function sanitizeDocRecord(record, index) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error(`Invalid document record at index ${index}`);
  }
  const id = sanitizeDocId(record.id);
  const section = normalizeDocSection(record.section);
  const title = sanitizeDocText(record.title || record.name || '', MAX_DOC_TITLE_LENGTH) || 'Файл';
  const subtitle = sanitizeDocText(record.subtitle || '', MAX_DOC_SUBTITLE_LENGTH);
  const storage = record.storage === 'managed' ? 'managed' : 'legacy';
  const assetPath = typeof record.assetPath === 'string' ? record.assetPath.trim() : '';
  const storedFile = typeof record.storedFile === 'string' ? path.basename(record.storedFile.trim()) : '';
  if (!section) throw new Error(`Invalid document section at index ${index}`);
  if (storage === 'legacy' && !assetPath.startsWith('/')) throw new Error(`Invalid legacy path at index ${index}`);
  if (storage === 'managed' && !storedFile) throw new Error(`Invalid managed file at index ${index}`);
  const mimeType = inferDocMimeType(storedFile || assetPath, typeof record.mimeType === 'string' ? record.mimeType.trim() : '');
  const size = Number.isFinite(record.size) && record.size >= 0 ? Math.floor(record.size) : 0;
  const sortOrder = Number.isFinite(record.sortOrder) ? Math.floor(record.sortOrder) : index;
  return {
    id,
    section,
    title,
    subtitle,
    name: sanitizeDocText(record.name || title, MAX_DOC_TITLE_LENGTH) || title,
    storage,
    assetPath: storage === 'legacy' ? assetPath : '',
    storedFile: storage === 'managed' ? storedFile : '',
    mimeType,
    size,
    updatedAt: typeof record.updatedAt === 'string' && record.updatedAt ? record.updatedAt : new Date().toISOString().slice(0, 10),
    createdAt: typeof record.createdAt === 'string' && record.createdAt ? record.createdAt : new Date().toISOString(),
    sortOrder,
    deleted: Boolean(record.deleted),
  };
}

function readDocsCatalog() {
  ensureDirs();
  try {
    if (!fs.existsSync(DOCS_CATALOG_FILE)) return bootstrapDocsCatalog();
    const raw = fs.readFileSync(DOCS_CATALOG_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    const source = Array.isArray(parsed.documents) ? parsed.documents : [];
    return { version: 1, documents: source.map((record, index) => sanitizeDocRecord(record, index)) };
  } catch (err) {
    logStructuredRateLimited('error', 'storage.docs.catalog_read_failed', DOCS_CATALOG_FILE, { error: toErrorMeta(err) });
    return bootstrapDocsCatalog();
  }
}

function writeDocsCatalog(catalog) {
  const source = catalog && Array.isArray(catalog.documents) ? catalog.documents : [];
  const serialized = JSON.stringify({ version: 1, documents: source.map((record, index) => sanitizeDocRecord(record, index)) }, null, 2);
  atomicWriteFileSync(DOCS_CATALOG_FILE, serialized);
}

function getDocPublicPath(record) {
  if (record.storage === 'managed') {
    return `/api/docs/file/${encodeURIComponent(record.id)}`;
  }
  return record.assetPath;
}

function buildPublicDocsManifest() {
  try {
    if (fs.existsSync(DOCS_CATALOG_FILE)) {
      const rawCatalog = JSON.parse(fs.readFileSync(DOCS_CATALOG_FILE, 'utf8') || '{}');
      if (rawCatalog && Array.isArray(rawCatalog.items)) {
        return buildDocsPublicManifest(sanitizeDocsCatalog(rawCatalog));
      }
    }
  } catch (err) {
    logStructuredRateLimited('warn', 'docs.public_manifest.new_catalog_read_failed', DOCS_CATALOG_FILE, {
      file: DOCS_CATALOG_FILE,
      error: toErrorMeta(err),
    });
  }

  const catalog = readDocsCatalog();
  const manifest = {};
  DOC_SECTION_ORDER.forEach((section) => { manifest[section] = []; });
  const sectionCounts = new Map();
  catalog.documents
    .filter((record) => !record.deleted)
    .sort((a, b) => {
      if (a.section !== b.section) return DOC_SECTION_ORDER.indexOf(a.section) - DOC_SECTION_ORDER.indexOf(b.section);
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.title.localeCompare(b.title, 'ru');
    })
    .forEach((record) => {
      const nextCount = (sectionCounts.get(record.section) || 0) + 1;
      sectionCounts.set(record.section, nextCount);
      if (nextCount > MAX_DOCS_PER_SECTION) return;
      manifest[record.section].push({
        id: record.id,
        name: record.name || record.title,
        title: record.title,
        subtitle: record.subtitle,
        section: record.section,
        path: getDocPublicPath(record),
        mime_type: record.mimeType,
        size: record.size,
        updated_at: record.updatedAt,
      });
    });
  return manifest;
}

function findDocById(catalog, docId) {
  return catalog.documents.find((record) => record.id === docId && !record.deleted) || null;
}

function decodeBase64Upload(rawValue) {
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!value) throw new Error('Missing document content');
  const normalized = value.replace(/^data:[^;,]+;base64,/, '');
  const buffer = Buffer.from(normalized, 'base64');
  if (!buffer.length) throw new Error('Invalid document content');
  if (buffer.length > MAX_DOC_UPLOAD_BYTES) throw new Error('Document file too large');
  return buffer;
}

function storeManagedDocFile(docId, fileName, contentBuffer) {
  const fileInfo = sanitizeDocFilename(fileName);
  const storedFile = `${docId}${fileInfo.ext}`;
  fs.writeFileSync(path.join(DOCS_FILES_DIR, storedFile), contentBuffer);
  return {
    storedFile,
    mimeType: fileInfo.mimeType,
    originalName: fileInfo.originalName,
    size: contentBuffer.length,
  };
}

function removeManagedDocFile(storedFile) {
  if (!storedFile) return;
  const safeName = path.basename(storedFile);
  const target = path.join(DOCS_FILES_DIR, safeName);
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
  }
}

function buildAdminDocList(catalog) {
  return catalog.documents
    .filter((record) => !record.deleted)
    .sort((a, b) => {
      if (a.section !== b.section) return DOC_SECTION_ORDER.indexOf(a.section) - DOC_SECTION_ORDER.indexOf(b.section);
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.title.localeCompare(b.title, 'ru');
    })
    .map((record) => ({
      id: record.id,
      section: record.section,
      title: record.title,
      subtitle: record.subtitle,
      name: record.name,
      path: getDocPublicPath(record),
      mimeType: record.mimeType,
      size: record.size,
      updatedAt: record.updatedAt,
      storage: record.storage,
      sortOrder: record.sortOrder,
    }));
}

function normalizeSid(rawSid) {
  const sid = String(rawSid || 'default').trim();
  const safe = sid.replace(/[^a-zA-Z0-9_-]/g, '_');
  return safe.length > 0 ? safe : 'default';
}

function getAdminUserIds() {
  const raw = String(
    process.env.ADMIN_TELEGRAM_IDS
    || process.env.BM_ADMIN_TELEGRAM_IDS
    || process.env.OWNER_TELEGRAM_ID
    || ''
  ).trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map(value => normalizeStatsUserId(value))
      .filter(Boolean)
  );
}

function isAdminUserId(rawUserId) {
  const userId = normalizeStatsUserId(rawUserId);
  if (!userId) return false;
  return getAdminUserIds().has(userId);
}

function withAdminFlag(user) {
  if (!user || typeof user !== 'object') return null;
  return {
    ...user,
    is_admin: isAdminUserId(user.id),
  };
}

function getSafeDocSection(rawSection, fallback = 'instructions') {
  const section = typeof rawSection === 'string' ? rawSection.trim() : '';
  return DOC_SECTION_ORDER.includes(section) ? section : fallback;
}

function normalizeDocText(rawValue, maxLength) {
  const value = typeof rawValue === 'string' ? rawValue.replace(/\s+/g, ' ').trim() : '';
  if (!value) return '';
  return value.slice(0, maxLength);
}

function normalizeDocId(rawValue) {
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';
  const safe = value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, MAX_DOC_ID_LENGTH);
  return safe || crypto.randomBytes(8).toString('hex');
}

function normalizeOptionalDocId(rawValue) {
  if (rawValue === undefined || rawValue === null) return '';
  const value = typeof rawValue === 'string' ? rawValue.trim() : String(rawValue || '').trim();
  if (!value) return '';
  return normalizeDocId(value);
}

function normalizeDocOrder(rawValue, fallback = 0) {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(999999, Math.round(value)));
}

function normalizeDocRelativePath(rawPath) {
  const raw = typeof rawPath === 'string' ? rawPath.trim() : '';
  if (!raw) return '';
  const decoded = raw.replace(/\\/g, '/');
  const normalized = decoded.startsWith('/') ? decoded : '/' + decoded;
  if (!normalized.startsWith('/assets/docs/')) return '';
  const resolved = path.resolve(ROOT, '.' + normalized);
  if (!resolved.startsWith(DOCS_ROOT_DIR)) return '';
  return normalized;
}

function getDocAbsolutePathFromRelative(relativePath) {
  const safeRelative = normalizeDocRelativePath(relativePath);
  if (!safeRelative) return '';
  const absolute = path.resolve(ROOT, '.' + safeRelative);
  return absolute.startsWith(DOCS_ROOT_DIR) ? absolute : '';
}

function getDocFileTypeFromName(filename) {
  const ext = path.extname(String(filename || '')).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (ext === '.doc' || ext === '.docx') return 'doc';
  if (ext === '.xls' || ext === '.xlsx') return 'xls';
  if (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp') return 'img';
  return 'default';
}

function sanitizeUploadedBaseName(rawName) {
  const value = String(rawName || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^\p{L}\p{N}\s._()-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (value || 'document').slice(0, 80);
}

function buildDocStorageFileName(rawName) {
  const ext = path.extname(String(rawName || '')).toLowerCase();
  const allowedExt = ALLOWED_DOC_UPLOAD_TYPES[ext] ? ext : '';
  if (!allowedExt) throw new Error('Неподдерживаемый тип файла');
  const safeBase = sanitizeUploadedBaseName(rawName).replace(/[\s.()]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'document';
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeBase}${allowedExt}`;
}

function guessLegacyDocTitleAndSubtitle(section, item) {
  const safeName = normalizeDocText(item && item.name, MAX_DOC_TITLE_LENGTH);
  const relativePath = normalizeDocRelativePath(item && item.path);
  const fileBase = sanitizeUploadedBaseName(path.basename(relativePath || '', path.extname(relativePath || '')));
  const manualByPath = {
    '/assets/docs/instructions/2580p.docx': {
      title: 'Действия в аварийных и нестандартных ситуациях',
      subtitle: '2580р от 12.12.2017',
    },
    '/assets/docs/speeds/Скоростя БАМ Парк Д Приказ № 161.pdf': {
      title: 'Скорости БАМ',
      subtitle: 'Приказ №161 от 27.02.2026',
    },
    '/assets/docs/speeds/Скоростя ВСГ Парк Д Приказ № 161.pdf': {
      title: 'Скорости ВСГ',
      subtitle: 'Приказ №161 от 27.02.2026',
    },
    '/assets/docs/speeds/Скоростя ВЛЧ Приказ № 161.pdf': {
      title: 'Скорости ВЛЧ',
      subtitle: 'Приказ №161 от 27.02.2026',
    },
  };
  if (relativePath && manualByPath[relativePath]) return manualByPath[relativePath];
  if (section === 'folders') {
    return {
      title: safeName || fileBase || 'Папка',
      subtitle: 'Конспекты по безопасности движения',
    };
  }
  if (section === 'speeds') {
    return {
      title: safeName ? `Скорости ${safeName}` : (fileBase || 'Скорости'),
      subtitle: fileBase && fileBase !== safeName ? fileBase : '',
    };
  }
  if (section === 'memos') {
    return {
      title: safeName ? `Режимка ${safeName}` : (fileBase || 'Режимка'),
      subtitle: fileBase && fileBase !== safeName ? fileBase : '',
    };
  }
  return {
    title: safeName || fileBase || 'Документ',
    subtitle: fileBase && fileBase !== safeName ? fileBase : '',
  };
}

function sanitizeDocCatalogItem(rawItem, index, fallbackSection) {
  const item = rawItem && typeof rawItem === 'object' ? rawItem : {};
  const section = getSafeDocSection(item.section || fallbackSection, fallbackSection || 'instructions');
  const relativePath = normalizeDocRelativePath(item.path);
  const title = normalizeDocText(item.title, MAX_DOC_TITLE_LENGTH);
  const subtitle = normalizeDocText(item.subtitle, MAX_DOC_SUBTITLE_LENGTH);
  const name = normalizeDocText(item.name, MAX_DOC_TITLE_LENGTH) || title;
  const updatedAt = normalizeDocText(item.updated_at || item.updatedAt, 32) || new Date().toISOString().slice(0, 10);
  const addedAt = normalizeDocText(item.added_at || item.addedAt, 32) || updatedAt;
  const sourceName = normalizeDocText(item.source_name || item.sourceName || path.basename(relativePath || ''), 180);
  const mimeType = normalizeDocText(item.mime_type || item.mimeType, 160) || ALLOWED_DOC_UPLOAD_TYPES[path.extname(relativePath || '').toLowerCase()] || 'application/octet-stream';
  const size = Number(item.size);
  const versions = Array.isArray(item.versions) ? item.versions : [];
  return {
    id: normalizeDocId(item.id || `${section}-${index + 1}`),
    section,
    title: title || name || 'Документ',
    subtitle,
    name: name || title || 'Документ',
    path: relativePath,
    mime_type: mimeType,
    size: Number.isFinite(size) && size >= 0 ? Math.round(size) : 0,
    updated_at: updatedAt,
    added_at: addedAt,
    sort_order: normalizeDocOrder(item.sort_order, index),
    archived: item.archived === true,
    archived_at: item.archived ? normalizeDocText(item.archived_at, 32) : '',
    source_name: sourceName,
    versions: versions.slice(-10).map((version, versionIndex) => ({
      id: normalizeDocId(version.id || `v${versionIndex + 1}`),
      title: normalizeDocText(version.title, MAX_DOC_TITLE_LENGTH),
      subtitle: normalizeDocText(version.subtitle, MAX_DOC_SUBTITLE_LENGTH),
      path: normalizeDocRelativePath(version.path),
      mime_type: normalizeDocText(version.mime_type, 160),
      size: Number.isFinite(Number(version.size)) ? Math.max(0, Math.round(Number(version.size))) : 0,
      updated_at: normalizeDocText(version.updated_at, 32),
      source_name: normalizeDocText(version.source_name, 180),
    })).filter(version => version.path),
  };
}

function buildEmptyDocsCatalog() {
  return {
    version: 1,
    revision: 1,
    updated_at: new Date().toISOString(),
    items: [],
    activity: [],
  };
}

function sanitizeDocsCatalog(rawCatalog) {
  const source = rawCatalog && typeof rawCatalog === 'object' ? rawCatalog : {};
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const revision = Number.isFinite(Number(source.revision)) ? Math.max(1, Math.round(Number(source.revision))) : 1;
  const seenIds = new Set();
  const items = rawItems
    .map((item, index) => sanitizeDocCatalogItem(item, index, item && item.section))
    .filter(item => {
      if (!item.path) return false;
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });
  items.sort((a, b) => {
    const sectionDelta = DOC_SECTION_ORDER.indexOf(a.section) - DOC_SECTION_ORDER.indexOf(b.section);
    if (sectionDelta !== 0) return sectionDelta;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return String(a.title || '').localeCompare(String(b.title || ''), 'ru');
  });
  const activity = Array.isArray(source.activity) ? source.activity : [];
  return {
    version: 1,
    revision,
    updated_at: normalizeDocText(source.updated_at, 32) || new Date().toISOString(),
    items,
    activity: activity.slice(-80).map((entry, index) => ({
      id: normalizeDocId(entry && entry.id ? entry.id : `activity-${index + 1}`),
      at: normalizeDocText(entry && entry.at, 32) || new Date().toISOString(),
      action: normalizeDocText(entry && entry.action, 48) || 'update',
      item_id: normalizeDocId(entry && entry.item_id ? entry.item_id : `item-${index + 1}`),
      title: normalizeDocText(entry && entry.title, MAX_DOC_TITLE_LENGTH),
      section: getSafeDocSection(entry && entry.section, 'instructions'),
      actor: normalizeStatsUserId(entry && entry.actor),
    })),
  };
}

function migrateLegacyDocsManifest() {
  if (!fs.existsSync(LEGACY_DOCS_MANIFEST_FILE)) return buildEmptyDocsCatalog();
  try {
    const raw = JSON.parse(fs.readFileSync(LEGACY_DOCS_MANIFEST_FILE, 'utf8') || '{}');
    const items = [];
    DOC_SECTION_ORDER.forEach((section) => {
      const list = Array.isArray(raw[section]) ? raw[section] : [];
      list.slice(0, MAX_DOCS_PER_SECTION).forEach((entry, index) => {
        const meta = guessLegacyDocTitleAndSubtitle(section, entry || {});
        items.push(sanitizeDocCatalogItem({
          id: `${section}-${index + 1}`,
          section,
          title: meta.title,
          subtitle: meta.subtitle,
          name: entry && entry.name,
          path: entry && entry.path,
          mime_type: entry && entry.mime_type,
          size: entry && entry.size,
          updated_at: entry && entry.updated_at,
          added_at: entry && (entry.added_at || entry.date_added || entry.updated_at),
          sort_order: index,
          archived: false,
          source_name: entry && (entry.source_name || path.basename(String(entry.path || ''))),
        }, index, section));
      });
    });
    return sanitizeDocsCatalog({ version: 1, updated_at: new Date().toISOString(), items, activity: [] });
  } catch (err) {
    logStructuredRateLimited('error', 'docs.catalog.legacy_manifest_read_failed', LEGACY_DOCS_MANIFEST_FILE, {
      file: LEGACY_DOCS_MANIFEST_FILE,
      error: toErrorMeta(err),
    });
    return buildEmptyDocsCatalog();
  }
}

function ensureDocsCatalogDirs() {
  ensureDirs();
  if (!fs.existsSync(DOCS_DATA_DIR)) fs.mkdirSync(DOCS_DATA_DIR, { recursive: true });
  if (!fs.existsSync(DOCS_FILES_DIR)) fs.mkdirSync(DOCS_FILES_DIR, { recursive: true });
}

function loadDocsCatalog() {
  ensureDocsCatalogDirs();
  try {
    if (!fs.existsSync(DOCS_CATALOG_FILE)) {
      const migrated = migrateLegacyDocsManifest();
      atomicWriteFileSync(DOCS_CATALOG_FILE, JSON.stringify(migrated, null, 2));
      return migrated;
    }
    const raw = fs.readFileSync(DOCS_CATALOG_FILE, 'utf8');
    return sanitizeDocsCatalog(JSON.parse(raw || '{}'));
  } catch (err) {
    logStructuredRateLimited('error', 'docs.catalog.read_failed', DOCS_CATALOG_FILE, {
      file: DOCS_CATALOG_FILE,
      error: toErrorMeta(err),
    });
    return buildEmptyDocsCatalog();
  }
}

function saveDocsCatalog(catalog) {
  ensureDocsCatalogDirs();
  const nextRevisionBase = Number.isFinite(Number(catalog && catalog.revision)) ? Math.max(0, Math.round(Number(catalog.revision))) : 0;
  const safeCatalog = sanitizeDocsCatalog({
    ...catalog,
    revision: nextRevisionBase + 1,
    updated_at: new Date().toISOString(),
  });
  atomicWriteFileSync(DOCS_CATALOG_FILE, JSON.stringify(safeCatalog, null, 2));
  return safeCatalog;
}

function appendDocsActivity(catalog, action, item, actorUserId) {
  const nextActivity = Array.isArray(catalog.activity) ? catalog.activity.slice(-79) : [];
  nextActivity.push({
    id: crypto.randomBytes(6).toString('hex'),
    at: new Date().toISOString(),
    action,
    item_id: item && item.id ? item.id : '',
    title: item && item.title ? item.title : '',
    section: item && item.section ? item.section : 'instructions',
    actor: normalizeStatsUserId(actorUserId),
  });
  return nextActivity;
}

function buildDocsPublicManifest(catalog) {
  const grouped = {};
  DOC_SECTION_ORDER.forEach(section => {
    grouped[section] = [];
  });
  (catalog.items || []).forEach((item) => {
    if (item.archived || !item.path) return;
    if (!grouped[item.section]) grouped[item.section] = [];
    grouped[item.section].push({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      name: item.name || item.title,
      path: item.path,
      mime_type: item.mime_type,
      size: item.size,
      updated_at: item.updated_at,
      added_at: item.added_at,
      sort_order: item.sort_order,
      source_name: item.source_name,
    });
  });
  DOC_SECTION_ORDER.forEach(section => {
    grouped[section].sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return String(a.title || a.name || '').localeCompare(String(b.title || b.name || ''), 'ru');
    });
  });
  return grouped;
}

function ensureAdminRequest(req) {
  const user = getUserFromRequest(req);
  if (!user) {
    const error = new Error('Unauthorized');
    error.statusCode = 401;
    throw error;
  }
  if (!isAdminUserId(user.id)) {
    const error = new Error('Forbidden');
    error.statusCode = 403;
    throw error;
  }
  return withAdminFlag(user);
}

function parseDocsPayload(body) {
  const payload = body ? JSON.parse(body) : {};
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Expected JSON object payload');
  }
  return payload;
}

function readRequestedDocsRevision(payload) {
  if (!payload || payload.revision === undefined || payload.revision === null || payload.revision === '') return null;
  const value = Number(payload.revision);
  if (!Number.isFinite(value) || value < 1) throw new Error('Некорректная ревизия каталога');
  return Math.round(value);
}

function assertDocsRevision(catalog, payload) {
  const requestedRevision = readRequestedDocsRevision(payload);
  if (requestedRevision === null) return requestedRevision;
  const currentRevision = Number.isFinite(Number(catalog && catalog.revision)) ? Number(catalog.revision) : 1;
  if (requestedRevision !== currentRevision) {
    const error = new Error('Список уже изменился. Обновите раздел и повторите действие.');
    error.statusCode = 409;
    throw error;
  }
  return requestedRevision;
}

function normalizeDocTitleKey(value) {
  return normalizeDocText(value, MAX_DOC_TITLE_LENGTH).toLocaleLowerCase('ru').replace(/\s+/g, ' ').trim();
}

function assertDocTitleUnique(items, candidate, skipId) {
  const section = getSafeDocSection(candidate && candidate.section, 'instructions');
  const titleKey = normalizeDocTitleKey(candidate && candidate.title);
  if (!titleKey) return;
  const hasDuplicate = (Array.isArray(items) ? items : []).some((item) => {
    if (!item || item.archived) return false;
    if (skipId && item.id === skipId) return false;
    return item.section === section && normalizeDocTitleKey(item.title) === titleKey;
  });
  if (hasDuplicate) {
    const error = new Error('В этом разделе уже есть документ с таким названием. Измените название или замените существующий файл.');
    error.statusCode = 409;
    throw error;
  }
}

function sanitizeDocMutationPayload(payload, options = {}) {
  const section = getSafeDocSection(payload.section, 'instructions');
  const itemId = payload.id ? normalizeDocId(payload.id) : '';
  const title = normalizeDocText(payload.title, MAX_DOC_TITLE_LENGTH);
  const subtitle = normalizeDocText(payload.subtitle, MAX_DOC_SUBTITLE_LENGTH);
  const name = normalizeDocText(payload.name, MAX_DOC_TITLE_LENGTH) || title;
  const sourceName = normalizeDocText(payload.source_name || payload.file_name || payload.fileName, 180);
  const sortOrder = normalizeDocOrder(payload.sort_order, 0);
  const encodedFile = typeof payload.file_base64 === 'string' ? payload.file_base64.trim() : '';
  const mimeType = normalizeDocText(payload.mime_type, 160).toLowerCase();
  const archive = payload.archived === true;
  if (!options.allowMissingTitle && !title) {
    throw new Error('Укажите название документа');
  }
  return {
    id: itemId,
    section,
    title,
    subtitle,
    name: name || title,
    source_name: sourceName,
    sort_order: sortOrder,
    file_base64: encodedFile,
    mime_type: mimeType,
    archived: archive,
  };
}

function decodeUploadedDocFile(payload) {
  if (!payload.file_base64) return null;
  const sourceName = String(payload.source_name || '').trim();
  if (!sourceName) throw new Error('Укажите имя файла');
  const ext = path.extname(sourceName).toLowerCase();
  const expectedMime = ALLOWED_DOC_UPLOAD_TYPES[ext];
  if (!expectedMime) throw new Error('Неподдерживаемый тип файла');
  if (payload.mime_type && payload.mime_type !== expectedMime) {
    throw new Error('Тип файла не совпадает с расширением');
  }
  let buffer;
  try {
    buffer = Buffer.from(payload.file_base64, 'base64');
  } catch (err) {
    throw new Error('Не удалось прочитать файл');
  }
  if (!buffer.length) throw new Error('Файл пустой');
  if (buffer.length > MAX_DOC_UPLOAD_BYTES) throw new Error('Файл слишком большой');
  return {
    buffer,
    ext,
    mime_type: expectedMime,
    source_name: sourceName.slice(0, 180),
  };
}

function writeUploadedDocFile(section, upload) {
  ensureDocsCatalogDirs();
  const sectionDir = path.join(DOCS_FILES_DIR, section);
  if (!fs.existsSync(sectionDir)) fs.mkdirSync(sectionDir, { recursive: true });
  const fileName = buildDocStorageFileName(upload.source_name);
  const absolutePath = path.join(sectionDir, fileName);
  fs.writeFileSync(absolutePath, upload.buffer);
  const relativePath = '/assets/docs/uploads/' + encodeURIComponent(section) + '/' + encodeURIComponent(fileName).replace(/%2F/g, '/');
  return {
    path: relativePath,
    size: upload.buffer.length,
    mime_type: upload.mime_type,
    source_name: upload.source_name,
  };
}

function removeDocFileIfManaged(relativePath) {
  const absolutePath = getDocAbsolutePathFromRelative(relativePath);
  if (!absolutePath) return;
  if (!absolutePath.startsWith(DOCS_ROOT_DIR)) return;
  if (!fs.existsSync(absolutePath)) return;
  try {
    fs.unlinkSync(absolutePath);
  } catch (err) {
    logStructuredRateLimited('warn', 'docs.catalog.file_remove_failed', absolutePath, {
      file: absolutePath,
      error: toErrorMeta(err),
    });
  }
}

function replaceDocItemVersion(item, nextSnapshot) {
  const previous = {
    id: crypto.randomBytes(4).toString('hex'),
    title: item.title,
    subtitle: item.subtitle,
    path: item.path,
    mime_type: item.mime_type,
    size: item.size,
    updated_at: item.updated_at,
    source_name: item.source_name,
  };
  const versions = Array.isArray(item.versions) ? item.versions.slice(-9) : [];
  versions.push(previous);
  return {
    ...item,
    ...nextSnapshot,
    versions,
  };
}

function reorderDocsSectionItems(items, sectionOrderIds) {
  const orderMap = new Map();
  sectionOrderIds.forEach((id, index) => {
    const safeId = normalizeDocId(id);
    if (safeId) orderMap.set(safeId, index);
  });
  let fallbackIndex = orderMap.size;
  return items.map((item) => {
    if (item.archived) return item;
    if (orderMap.has(item.id)) {
      return { ...item, sort_order: orderMap.get(item.id) };
    }
    const next = { ...item, sort_order: fallbackIndex };
    fallbackIndex += 1;
    return next;
  });
}

function buildDocsAdminResponse(catalog) {
  return {
    version: catalog.version || 1,
    revision: Number.isFinite(Number(catalog.revision)) ? Number(catalog.revision) : 1,
    updated_at: catalog.updated_at,
    items: (catalog.items || []).slice().sort((a, b) => {
      const sectionDelta = DOC_SECTION_ORDER.indexOf(a.section) - DOC_SECTION_ORDER.indexOf(b.section);
      if (sectionDelta !== 0) return sectionDelta;
      if (a.archived !== b.archived) return a.archived ? 1 : -1;
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return String(a.title || '').localeCompare(String(b.title || ''), 'ru');
    }),
    activity: Array.isArray(catalog.activity) ? catalog.activity.slice().reverse() : [],
  };
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

function readBody(req, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > maxBytes) {
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

  if (pathname === '/assets/docs/manifest.json' && req.method === 'GET') {
    sendJson(res, 200, buildPublicDocsManifest());
    return;
  }

  if (pathname.startsWith('/api/docs/file/') && req.method === 'GET') {
    const docId = pathname.slice('/api/docs/file/'.length);
    try {
      const catalog = readDocsCatalog();
      const record = findDocById(catalog, sanitizeDocId(decodeURIComponent(docId)));
      if (!record || record.storage !== 'managed') {
        sendText(res, 404, 'Not found');
        return;
      }
      const filePath = path.join(DOCS_FILES_DIR, path.basename(record.storedFile));
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        sendText(res, 404, 'Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': record.mimeType || 'application/octet-stream',
        'Content-Length': record.size || fs.statSync(filePath).size,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      });
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      logStructuredRateLimited('warn', 'docs.file.read_failed', pathname, { error: toErrorMeta(err) });
      sendText(res, 404, 'Not found');
    }
    return;
  }

  if (pathname === '/api/admin/docs' || pathname === '/api/admin/docs/reorder' || /^\/api\/admin\/docs\/[^/]+(?:\/replace)?$/.test(pathname)) {
    let adminUser;
    try {
      adminUser = ensureAdminRequest(req);
      const catalog = loadDocsCatalog();

      if (pathname === '/api/admin/docs' && req.method === 'GET') {
        const adminCatalog = buildDocsAdminResponse(catalog);
        sendJson(res, 200, {
          ok: true,
          documents: adminCatalog.items,
          items: adminCatalog.items,
          activity: adminCatalog.activity,
          sections: DOC_SECTION_ORDER,
          adminUser: { id: String(adminUser.id) },
        });
        return;
      }

      if (pathname === '/api/admin/docs' && req.method === 'POST') {
        const payload = parseDocsPayload(await readBody(req, Math.ceil(MAX_DOC_UPLOAD_BYTES * 1.5) + 1024 * 1024));
        const mutation = sanitizeDocMutationPayload({
          ...payload,
          file_base64: payload.file_base64 || payload.contentBase64,
          source_name: payload.source_name || payload.fileName,
        }, { allowMissingTitle: true });
        const upload = decodeUploadedDocFile(mutation);
        if (!upload) throw new Error('Добавьте файл');
        const storedFile = writeUploadedDocFile(mutation.section, upload);
        const baseTitle = mutation.title || sanitizeUploadedBaseName(upload.source_name);
        const nextItem = sanitizeDocCatalogItem({
          id: mutation.id || `${mutation.section}-${Date.now()}`,
          section: mutation.section,
          title: baseTitle,
          subtitle: mutation.subtitle,
          name: mutation.name || baseTitle,
          path: storedFile.path,
          mime_type: storedFile.mime_type,
          size: storedFile.size,
          updated_at: new Date().toISOString().slice(0, 10),
          added_at: new Date().toISOString().slice(0, 10),
          sort_order: (catalog.items || []).filter(item => item.section === mutation.section && !item.archived).length,
          source_name: storedFile.source_name,
          archived: false,
          versions: [],
        }, (catalog.items || []).length, mutation.section);
        const savedCatalog = saveDocsCatalog({
          ...catalog,
          items: [...(catalog.items || []), nextItem],
          activity: appendDocsActivity(catalog, 'create', nextItem, adminUser.id),
        });
        sendJson(res, 201, { ok: true, document: savedCatalog.items.find(item => item.id === nextItem.id) || nextItem, catalog: buildDocsAdminResponse(savedCatalog) });
        return;
      }

      if (pathname === '/api/admin/docs/reorder' && req.method === 'POST') {
        const payload = parseDocsPayload(await readBody(req));
        const section = getSafeDocSection(payload.section, 'instructions');
        const activeItems = (catalog.items || []).filter(item => item.section === section && !item.archived);
        const reordered = reorderDocsSectionItems(activeItems, Array.isArray(payload.ids) ? payload.ids : []);
        const reorderedMap = new Map(reordered.map(item => [item.id, item]));
        const savedCatalog = saveDocsCatalog({
          ...catalog,
          items: (catalog.items || []).map(item => (item.section === section && reorderedMap.has(item.id) ? reorderedMap.get(item.id) : item)),
          activity: appendDocsActivity(catalog, 'reorder', { id: section, title: `Порядок: ${section}`, section }, adminUser.id),
        });
        sendJson(res, 200, { ok: true, documents: buildDocsAdminResponse(savedCatalog).items, catalog: buildDocsAdminResponse(savedCatalog) });
        return;
      }

      const match = pathname.match(/^\/api\/admin\/docs\/([^/]+)(?:\/(replace))?$/);
      const itemId = match ? normalizeOptionalDocId(decodeURIComponent(match[1])) : '';
      const itemIndex = itemId ? (catalog.items || []).findIndex(item => item.id === itemId) : -1;
      if (itemIndex === -1) {
        sendJson(res, 404, { error: 'Document not found' });
        return;
      }
      const currentItem = catalog.items[itemIndex];

      if (!match[2] && req.method === 'PATCH') {
        const payload = parseDocsPayload(await readBody(req));
        const mutation = sanitizeDocMutationPayload({
          ...currentItem,
          ...payload,
          id: currentItem.id,
          file_base64: payload.file_base64,
        }, { allowMissingTitle: false });
        const updatedItem = sanitizeDocCatalogItem(replaceDocItemVersion(currentItem, {
          section: mutation.section || currentItem.section,
          title: mutation.title || currentItem.title,
          subtitle: mutation.subtitle,
          name: mutation.name || mutation.title || currentItem.name,
          sort_order: currentItem.sort_order,
          updated_at: new Date().toISOString().slice(0, 10),
          source_name: mutation.source_name || currentItem.source_name,
          path: currentItem.path,
          mime_type: currentItem.mime_type,
          size: currentItem.size,
        }), itemIndex, mutation.section || currentItem.section);
        const nextItems = (catalog.items || []).slice();
        nextItems[itemIndex] = updatedItem;
        const savedCatalog = saveDocsCatalog({
          ...catalog,
          items: nextItems,
          activity: appendDocsActivity(catalog, 'update', updatedItem, adminUser.id),
        });
        sendJson(res, 200, { ok: true, document: updatedItem, catalog: buildDocsAdminResponse(savedCatalog) });
        return;
      }

      if (match[2] === 'replace' && req.method === 'POST') {
        const payload = parseDocsPayload(await readBody(req, Math.ceil(MAX_DOC_UPLOAD_BYTES * 1.5) + 1024 * 1024));
        const mutation = sanitizeDocMutationPayload({
          ...currentItem,
          ...payload,
          id: currentItem.id,
          file_base64: payload.file_base64 || payload.contentBase64,
          source_name: payload.source_name || payload.fileName || currentItem.source_name,
        }, { allowMissingTitle: false });
        const upload = decodeUploadedDocFile(mutation);
        if (!upload) throw new Error('Добавьте файл');
        const storedFile = writeUploadedDocFile(mutation.section || currentItem.section, upload);
        const replacedItem = sanitizeDocCatalogItem(replaceDocItemVersion(currentItem, {
          section: mutation.section || currentItem.section,
          title: mutation.title || currentItem.title,
          subtitle: mutation.subtitle,
          name: mutation.name || mutation.title || currentItem.name,
          path: storedFile.path,
          mime_type: storedFile.mime_type,
          size: storedFile.size,
          updated_at: new Date().toISOString().slice(0, 10),
          source_name: storedFile.source_name,
          sort_order: currentItem.sort_order,
        }), itemIndex, mutation.section || currentItem.section);
        const nextItems = (catalog.items || []).slice();
        nextItems[itemIndex] = replacedItem;
        const savedCatalog = saveDocsCatalog({
          ...catalog,
          items: nextItems,
          activity: appendDocsActivity(catalog, 'replace', replacedItem, adminUser.id),
        });
        if (currentItem.path && currentItem.path !== replacedItem.path) {
          removeDocFileIfManaged(currentItem.path);
        }
        sendJson(res, 200, { ok: true, document: replacedItem, catalog: buildDocsAdminResponse(savedCatalog) });
        return;
      }

      if (!match[2] && req.method === 'DELETE') {
        const nextItems = (catalog.items || []).slice();
        nextItems[itemIndex] = { ...currentItem, archived: true, archived_at: new Date().toISOString() };
        const savedCatalog = saveDocsCatalog({
          ...catalog,
          items: nextItems,
          activity: appendDocsActivity(catalog, 'archive', currentItem, adminUser.id),
        });
        sendJson(res, 200, { ok: true, catalog: buildDocsAdminResponse(savedCatalog) });
        return;
      }
    } catch (err) {
      const errorMessage = err && err.message ? err.message : 'Invalid payload';
      const statusCode = err && err.statusCode ? err.statusCode : (/^Unauthorized/.test(errorMessage) ? 401 : (/^Forbidden/.test(errorMessage) ? 403 : (/^(Invalid|Missing|Unsupported|Document file too large)/.test(errorMessage) ? 400 : 500)));
      logStructuredRateLimited(statusCode === 400 ? 'warn' : 'error', 'docs.admin.request_failed', `${req.method}:${pathname}:${errorMessage}`, {
        adminUserId: String(adminUser && adminUser.id ? adminUser.id : ''),
        error: toErrorMeta(err),
      });
      sendJson(res, statusCode, { error: errorMessage });
      return;
    }
    sendJson(res, 405, { error: 'Method not allowed' });
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

  if (pathname === '/api/docs') {
    if (req.method === 'GET') {
      const mode = typeof parsedUrl.query.mode === 'string' ? parsedUrl.query.mode.trim() : '';
      const catalog = loadDocsCatalog();
      if (mode === 'admin') {
        try {
          ensureAdminRequest(req);
          sendJson(res, 200, buildDocsAdminResponse(catalog));
        } catch (err) {
          sendJson(res, err && err.statusCode ? err.statusCode : 403, { error: err && err.message ? err.message : 'Forbidden' });
        }
        return;
      }
      sendJson(res, 200, buildDocsPublicManifest(catalog));
      return;
    }

    if (req.method === 'POST') {
      let adminUser;
      try {
        adminUser = ensureAdminRequest(req);
        const payload = parseDocsPayload(await readBody(req, Math.ceil(MAX_DOC_UPLOAD_BYTES * 1.5) + 1024 * 1024));
        const catalog = loadDocsCatalog();
        assertDocsRevision(catalog, payload);
        const files = Array.isArray(payload.files) && payload.files.length ? payload.files : [payload];
        const createdItems = [];
        let nextItems = Array.isArray(catalog.items) ? catalog.items.slice() : [];
        files.forEach((entry, index) => {
          const mutation = sanitizeDocMutationPayload(entry || {}, { allowMissingTitle: true });
          const upload = decodeUploadedDocFile(mutation);
          if (!upload) throw new Error('Добавьте файл');
          const storedFile = writeUploadedDocFile(mutation.section, upload);
          const baseTitle = mutation.title || sanitizeUploadedBaseName(upload.source_name);
          assertDocTitleUnique(nextItems, { section: mutation.section, title: baseTitle });
          const item = sanitizeDocCatalogItem({
            id: mutation.id || `${mutation.section}-${Date.now()}-${index + 1}`,
            section: mutation.section,
            title: baseTitle,
            subtitle: mutation.subtitle,
            name: mutation.name || baseTitle,
            path: storedFile.path,
            mime_type: storedFile.mime_type,
            size: storedFile.size,
            updated_at: new Date().toISOString().slice(0, 10),
            added_at: new Date().toISOString().slice(0, 10),
            sort_order: mutation.sort_order || nextItems.filter(row => row.section === mutation.section && !row.archived).length,
            source_name: storedFile.source_name,
            archived: false,
            versions: [],
          }, nextItems.length, mutation.section);
          nextItems.push(item);
          createdItems.push(item);
        });
        const savedCatalog = saveDocsCatalog({
          ...catalog,
          items: nextItems,
          activity: files.reduce((acc, _entry, index) => appendDocsActivity({ activity: acc }, 'create', createdItems[index], adminUser.id), Array.isArray(catalog.activity) ? catalog.activity.slice() : []),
        });
        sendJson(res, 201, { ok: true, created: createdItems, catalog: buildDocsAdminResponse(savedCatalog) });
      } catch (err) {
        const statusCode = err && err.statusCode ? err.statusCode : (/Unauthorized|Forbidden/.test(err && err.message ? err.message : '') ? 403 : 400);
        sendJson(res, statusCode, { error: err && err.message ? err.message : 'Invalid payload' });
      }
      return;
    }

    if (req.method === 'PUT') {
      let adminUser;
      try {
        adminUser = ensureAdminRequest(req);
        const payload = parseDocsPayload(await readBody(req, Math.ceil(MAX_DOC_UPLOAD_BYTES * 1.5) + 1024 * 1024));
        const action = typeof payload.action === 'string' ? payload.action.trim() : 'update';
        const catalog = loadDocsCatalog();
        let items = Array.isArray(catalog.items) ? catalog.items.slice() : [];

        assertDocsRevision(catalog, payload);

        if (action === 'reorder') {
          const section = getSafeDocSection(payload.section, 'instructions');
          const ids = Array.isArray(payload.ids) ? payload.ids : [];
          const activeItems = items.filter(item => item.section === section && !item.archived);
          if (!activeItems.length) throw new Error('В этом разделе пока нечего сортировать');
          items = items.map(item => item.section === section ? item : item);
          const reordered = reorderDocsSectionItems(activeItems, ids);
          const reorderedMap = new Map(reordered.map(item => [item.id, item]));
          items = items.map(item => item.section === section && reorderedMap.has(item.id) ? reorderedMap.get(item.id) : item);
          const savedCatalog = saveDocsCatalog({
            ...catalog,
            items,
            activity: appendDocsActivity(catalog, 'reorder', { id: section, title: `Порядок: ${section}`, section }, adminUser.id),
          });
          sendJson(res, 200, { ok: true, catalog: buildDocsAdminResponse(savedCatalog) });
          return;
        }

        const itemId = normalizeOptionalDocId(payload.id);
        const itemIndex = items.findIndex(item => item.id === itemId);
        if (itemIndex === -1) throw new Error('Документ не найден');
        const currentItem = items[itemIndex];

        if (action === 'restore') {
          const restoredItem = { ...currentItem, archived: false, archived_at: '' };
          items[itemIndex] = restoredItem;
          const savedCatalog = saveDocsCatalog({
            ...catalog,
            items,
            activity: appendDocsActivity(catalog, 'restore', restoredItem, adminUser.id),
          });
          sendJson(res, 200, { ok: true, item: restoredItem, catalog: buildDocsAdminResponse(savedCatalog) });
          return;
        }

        if (action === 'rollback') {
          const versionId = normalizeOptionalDocId(payload.version_id);
          const versions = Array.isArray(currentItem.versions) ? currentItem.versions : [];
          const version = versions.find(entry => entry.id === versionId);
          if (!version) throw new Error('Версия для отката не найдена');
          const rolledBack = replaceDocItemVersion(currentItem, {
            title: version.title || currentItem.title,
            subtitle: version.subtitle || '',
            path: version.path,
            mime_type: version.mime_type || currentItem.mime_type,
            size: version.size || currentItem.size,
            updated_at: new Date().toISOString().slice(0, 10),
            source_name: version.source_name || currentItem.source_name,
          });
          items[itemIndex] = sanitizeDocCatalogItem(rolledBack, itemIndex, rolledBack.section);
          const savedCatalog = saveDocsCatalog({
            ...catalog,
            items,
            activity: appendDocsActivity(catalog, 'rollback', items[itemIndex], adminUser.id),
          });
          sendJson(res, 200, { ok: true, item: items[itemIndex], catalog: buildDocsAdminResponse(savedCatalog) });
          return;
        }

        const mutation = sanitizeDocMutationPayload(payload, { allowMissingTitle: false });
        assertDocTitleUnique(items, { section: mutation.section || currentItem.section, title: mutation.title || currentItem.title }, currentItem.id);
        const upload = decodeUploadedDocFile(mutation);
        let nextSnapshot = {
          section: mutation.section || currentItem.section,
          title: mutation.title || currentItem.title,
          subtitle: mutation.subtitle,
          name: mutation.name || mutation.title || currentItem.name,
          sort_order: Number.isFinite(mutation.sort_order) ? mutation.sort_order : currentItem.sort_order,
          updated_at: new Date().toISOString().slice(0, 10),
          source_name: mutation.source_name || currentItem.source_name,
        };
        if (upload) {
          const storedFile = writeUploadedDocFile(mutation.section || currentItem.section, upload);
          nextSnapshot = {
            ...nextSnapshot,
            path: storedFile.path,
            mime_type: storedFile.mime_type,
            size: storedFile.size,
            source_name: storedFile.source_name,
          };
        }
        const updatedItem = sanitizeDocCatalogItem(replaceDocItemVersion(currentItem, nextSnapshot), itemIndex, nextSnapshot.section || currentItem.section);
        items[itemIndex] = updatedItem;
        const savedCatalog = saveDocsCatalog({
          ...catalog,
          items,
          activity: appendDocsActivity(catalog, upload ? 'replace' : 'update', updatedItem, adminUser.id),
        });
        if (upload && currentItem.path && currentItem.path !== updatedItem.path) {
          removeDocFileIfManaged(currentItem.path);
        }
        sendJson(res, 200, { ok: true, item: updatedItem, catalog: buildDocsAdminResponse(savedCatalog) });
      } catch (err) {
        const statusCode = err && err.statusCode ? err.statusCode : (/Unauthorized|Forbidden/.test(err && err.message ? err.message : '') ? 403 : 400);
        sendJson(res, statusCode, { error: err && err.message ? err.message : 'Invalid payload' });
      }
      return;
    }

    if (req.method === 'DELETE') {
      let adminUser;
      try {
        adminUser = ensureAdminRequest(req);
        const payload = parseDocsPayload(await readBody(req));
        const itemId = normalizeOptionalDocId(payload.id || parsedUrl.query.id);
        if (!itemId) throw new Error('Не указан документ');
        const permanent = payload.permanent === true || parsedUrl.query.mode === 'purge';
        const catalog = loadDocsCatalog();
        assertDocsRevision(catalog, payload);
        const itemIndex = catalog.items.findIndex(item => item.id === itemId);
        if (itemIndex === -1) throw new Error('Документ не найден');
        const item = catalog.items[itemIndex];
        let nextItems = catalog.items.slice();
        if (permanent) {
          nextItems.splice(itemIndex, 1);
        } else {
          nextItems[itemIndex] = { ...item, archived: true, archived_at: new Date().toISOString() };
        }
        const savedCatalog = saveDocsCatalog({
          ...catalog,
          items: nextItems,
          activity: appendDocsActivity(catalog, permanent ? 'purge' : 'archive', item, adminUser.id),
        });
        if (permanent) {
          removeDocFileIfManaged(item.path);
        }
        sendJson(res, 200, { ok: true, catalog: buildDocsAdminResponse(savedCatalog) });
      } catch (err) {
        const statusCode = err && err.statusCode ? err.statusCode : (/Unauthorized|Forbidden/.test(err && err.message ? err.message : '') ? 403 : 400);
        sendJson(res, statusCode, { error: err && err.message ? err.message : 'Invalid payload' });
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
