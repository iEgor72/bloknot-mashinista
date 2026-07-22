const ANALYTICS_POLICY_VERSION = '2026-07-23';
const ANALYTICS_RETENTION_DAYS = 180;
const MAX_ANALYTICS_EVENTS_PER_BATCH = 50;
const MAX_ANALYTICS_PROPERTIES = 24;

const ALLOWED_ANALYTICS_EVENTS = new Set([
  'app_opened',
  'session_started',
  'session_heartbeat',
  'session_ended',
  'screen_viewed',
  'shift_form_started',
  'shift_form_field_used',
  'shift_form_abandoned',
  'shift_form_validation_failed',
  'shift_saved',
  'first_shift_saved',
  'third_shift_saved',
  'shift_edited',
  'shift_deleted',
  'shift_sync_failed',
  'salary_opened',
  'salary_params_changed',
  'docs_opened',
  'partner_invite_created',
  'partner_connected',
  'shift_shared',
  'poekhali_opened',
  'poekhali_started',
  'gps_permission_result',
  'poekhali_error',
  'paywall_viewed',
  'subscription_started',
  'payment_succeeded',
  'payment_failed',
]);

const ALLOWED_PROPERTY_KEYS = new Set([
  'tab',
  'source',
  'action',
  'reason',
  'field',
  'filledFields',
  'fieldCount',
  'shiftCount',
  'durationMinutes',
  'entryDurationMs',
  'isFirst',
  'isEditing',
  'hasRoute',
  'hasLocomotive',
  'hasTrain',
  'hasFuel',
  'hasNote',
  'offline',
  'result',
  'errorCode',
  'category',
  'documentId',
  'permission',
]);

const PROPERTY_ENUMS = {
  tab: new Set(['home', 'poekhali', 'add', 'instructions', 'shifts', 'partners', 'profile']),
  source: new Set(['referrer', 'direct', 'telegram', 'web', 'tab', 'form', 'screen', 'settings', 'button', 'btnProfileSalarySettings', 'btnOpenSalarySettings']),
  action: new Set(['add', 'edit', 'delete']),
  reason: new Set(['required_time', 'invalid_date', 'end_before_start', 'tab_changed', 'pagehide', 'unknown']),
  field: new Set(['start', 'end', 'route', 'locomotive', 'train', 'fuel', 'note', 'other']),
  result: new Set(['success', 'queued', 'delivered', 'fix_received']),
  errorCode: new Set(['delete_failed', 'save_failed', 'gps_denied', 'gps_timeout', 'gps_unavailable']),
  category: new Set(['landing', 'file', 'instructions', 'speeds', 'memos', 'reminders', 'folders', 'favorites']),
  permission: new Set(['granted', 'denied', 'unavailable']),
};

const PROPERTY_NUMBERS = {
  fieldCount: [0, 16],
  shiftCount: [0, 100000],
  durationMinutes: [0, 43200],
  entryDurationMs: [0, 86400000],
};

const PROPERTY_BOOLEANS = new Set([
  'isFirst', 'isEditing', 'hasRoute', 'hasLocomotive', 'hasTrain', 'hasFuel', 'hasNote', 'offline',
]);

const SAFE_FIELD_NAMES = new Set(['start', 'end', 'route', 'locomotive', 'train', 'fuel', 'note', 'other']);

function cleanShortString(value, maxLength) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength);
}

function normalizePlatform(value) {
  const platform = cleanShortString(value, 24).toLowerCase();
  return ['ios', 'android', 'desktop', 'unknown'].includes(platform) ? platform : 'unknown';
}

function sanitizePropertyValue(key, value) {
  if (PROPERTY_BOOLEANS.has(key)) return typeof value === 'boolean' ? value : undefined;
  if (PROPERTY_NUMBERS[key]) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    return Math.max(PROPERTY_NUMBERS[key][0], Math.min(PROPERTY_NUMBERS[key][1], value));
  }
  if (PROPERTY_ENUMS[key]) {
    const text = cleanShortString(value, 64);
    return PROPERTY_ENUMS[key].has(text) ? text : undefined;
  }
  if (key === 'filledFields') {
    if (!Array.isArray(value)) return undefined;
    return [...new Set(value.map((item) => cleanShortString(item, 24)).filter((item) => SAFE_FIELD_NAMES.has(item)))].slice(0, 16);
  }
  if (key === 'documentId') {
    const text = cleanShortString(value, 32);
    return /^doc_[a-z0-9]{1,20}$/.test(text) ? text : undefined;
  }
  return undefined;
}

function sanitizeProperties(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  Object.keys(value).slice(0, MAX_ANALYTICS_PROPERTIES * 2).forEach((key) => {
    if (!ALLOWED_PROPERTY_KEYS.has(key) || Object.keys(result).length >= MAX_ANALYTICS_PROPERTIES) return;
    const sanitized = sanitizePropertyValue(key, value[key]);
    if (sanitized !== undefined) result[key] = sanitized;
  });
  return result;
}

function sanitizeAnalyticsEvent(value, nowMs) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid analytics event');
  }
  const eventId = cleanShortString(value.eventId, 96);
  const sessionId = cleanShortString(value.sessionId, 96);
  const eventName = cleanShortString(value.eventName, 64);
  if (!/^[a-zA-Z0-9:_-]{12,96}$/.test(eventId)) throw new Error('Invalid analytics eventId');
  if (!/^[a-zA-Z0-9:_-]{8,96}$/.test(sessionId)) throw new Error('Invalid analytics sessionId');
  if (!ALLOWED_ANALYTICS_EVENTS.has(eventName)) throw new Error('Unsupported analytics event');
  const occurredMs = Date.parse(value.occurredAt || '');
  const safeNow = Number(nowMs) || Date.now();
  if (!Number.isFinite(occurredMs) || occurredMs < safeNow - 30 * 86400000 || occurredMs > safeNow + 5 * 60000) {
    throw new Error('Invalid analytics occurredAt');
  }
  return {
    eventId,
    sessionId,
    eventName,
    occurredAt: new Date(occurredMs).toISOString(),
    platform: normalizePlatform(value.platform),
    appVersion: cleanShortString(value.appVersion, 32),
    properties: sanitizeProperties(value.properties),
  };
}

function sanitizeAnalyticsBatch(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.events)) {
    throw new Error('Expected analytics events array');
  }
  if (payload.events.length > MAX_ANALYTICS_EVENTS_PER_BATCH) {
    throw new Error('Too many analytics events');
  }
  const nowMs = Date.now();
  return payload.events.map((event) => sanitizeAnalyticsEvent(event, nowMs));
}

function sanitizeConsentPayload(payload) {
  const status = cleanShortString(payload && payload.status, 16).toLowerCase();
  if (status !== 'granted' && status !== 'denied') throw new Error('Invalid analytics consent status');
  return { status, policyVersion: ANALYTICS_POLICY_VERSION };
}

function analyticsAdminIds() {
  const raw = [
    process.env.ANALYTICS_ADMIN_IDS || '',
    process.env.TELEGRAM_ADMIN_CHAT_ID || '',
    process.env.TELEGRAM_SUPPORT_CHAT_ID || '',
  ].join(',');
  return new Set(raw.split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean));
}

function isAnalyticsAdmin(user) {
  const id = user && user.id !== undefined && user.id !== null ? String(user.id).trim() : '';
  return !!id && analyticsAdminIds().has(id);
}

module.exports = {
  ANALYTICS_POLICY_VERSION,
  ANALYTICS_RETENTION_DAYS,
  sanitizeAnalyticsBatch,
  sanitizeConsentPayload,
  isAnalyticsAdmin,
};
