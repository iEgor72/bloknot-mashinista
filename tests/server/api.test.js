const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const BOT_TOKEN = '123456789:test-server-bot-token';
const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bloknot-server-api-'));

process.env.APP_DATA_DIR = testDataDir;
process.env.DISABLE_STORAGE_BACKUPS = '1';
process.env.NODE_ENV = 'production';
process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
process.env.TELEGRAM_ADMIN_CHAT_ID = '9001';
process.env.PUBLIC_APP_URL = 'http://127.0.0.1';

const application = require('../../server');

let baseUrl = '';

function signInitData(user) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: `test-${user.id}`,
    user: JSON.stringify(user),
  });
  const keys = Array.from(params.keys()).sort();
  const checkString = keys.map((key) => `${key}=${params.get(key)}`).join('\n');
  const secret = crypto.createHmac('sha256', Buffer.from('WebAppData', 'utf8')).update(BOT_TOKEN, 'utf8').digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(checkString, 'utf8').digest('hex'));
  return params.toString();
}

async function jsonRequest(pathname, options) {
  const response = await fetch(baseUrl + pathname, options);
  const text = await response.text();
  return {
    response,
    body: text ? JSON.parse(text) : null,
  };
}

async function authenticate(user) {
  const result = await jsonRequest('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: signInitData(user) }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.user.id, String(user.id));
  assert.ok(result.body.sessionToken);
  return result.body.sessionToken;
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

test.before(async () => {
  const server = application.startServer(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (application.server.listening) {
    await new Promise((resolve, reject) => application.server.close((error) => error ? reject(error) : resolve()));
  }
  application.closeStorage();
  if (path.basename(testDataDir).startsWith('bloknot-server-api-')) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
});

test('public contact surface points only to the Telegram bot', async () => {
  const response = await fetch(baseUrl + '/prilozhenie-dlya-mashinista');
  const source = await response.text();
  assert.equal(response.status, 200);
  assert.match(source, /https:\/\/t\.me\/bloknot_mashinista_bot/);
  assert.doesNotMatch(source, /https:\/\/t\.me\/bloknot_mashinista"/);
  assert.doesNotMatch(source, /https:\/\/t\.me\/\+nbBBi51NbzVhZjVi/);

  const homeResponse = await fetch(baseUrl + '/');
  const homeSource = await homeResponse.text();
  assert.equal(homeResponse.status, 200);
  assert.match(homeSource, /\/assets\/seo\/landing-overview-v392\.png/);
  assert.doesNotMatch(homeSource, /landing-overview\.jpg|новости|обсуждение|бригада/i);

  const routesResponse = await fetch(baseUrl + '/uchet-marshrutov');
  const routesSource = await routesResponse.text();
  assert.equal(routesResponse.status, 200);
  assert.match(routesSource, /\/assets\/seo\/landing-routes-v392\.png/);
  assert.doesNotMatch(routesSource, /landing-salary-screen\.jpg|калькулятор зарплаты/i);
});

test('versioned style namespace serves the current shell stylesheet', async () => {
  const response = await fetch(baseUrl + '/styles/v417/56-profile.css');
  const source = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/css/i);
  assert.match(source, /\.profile-summary-card/);
  assert.match(source, /\.profile-summary-icon svg/);

  const versionedRuntime = await fetch(baseUrl + '/scripts/v417/render.js');
  assert.equal(versionedRuntime.status, 200);
  assert.match(await versionedRuntime.text(), /renderProfileSummary/);

  const traversalAttempt = await fetch(baseUrl + '/scripts/v417/..%2Fserver.js');
  assert.equal(traversalAttempt.status, 404);

  const previousBootstrap = await fetch(baseUrl + '/sw-bootstrap-v397.js');
  assert.equal(previousBootstrap.status, 200);

  const priorReleaseBootstrap = await fetch(baseUrl + '/sw-bootstrap-v398.js');
  assert.equal(priorReleaseBootstrap.status, 200);
  assert.match(await previousBootstrap.text(), /var version = 'v397'/);

  const immediatelyPreviousBootstrap = await fetch(baseUrl + '/sw-bootstrap-v404.js');
  assert.equal(immediatelyPreviousBootstrap.status, 200);
  assert.match(await immediatelyPreviousBootstrap.text(), /var version = 'v404'/);
});

test('Telegram welcome message advertises only the current product scope', () => {
  const welcome = application.buildWelcomeMessage(42, 'Иван');
  assert.match(welcome.photo, /\/assets\/welcome-promo-v392\.png$/);
  assert.match(welcome.caption, /вносить и просматривать смены/);
  assert.match(welcome.caption, /рабочие, ночные и праздничные часы/);
  assert.match(welcome.caption, /примерный заработок на главной/);
  assert.match(welcome.caption, /«Поехали» из последней смены/);
  assert.doesNotMatch(welcome.caption, /таймер|напарник|бригада|канал|отдельн\w* калькулятор/i);

  const fallback = application.buildPlainWelcomeText('Иван');
  assert.match(fallback, /смены, часы, календарь, документы и режим «Поехали»/i);
  assert.match(fallback, /Примерный заработок показывается на главной/);
});

test('shift-card runtime is never HTTP-cached and renders fuel in kilograms', async () => {
  const response = await fetch(baseUrl + '/scripts/time-utils.js?v=v393');
  const source = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') || '', /no-store/i);
  assert.match(source, /ruNum\(ft\.consumptionKg\) \+ ' кг'/);
  assert.doesNotMatch(source, /ruNum\(ft\.consumptionLiters\) \+ ' л'/);
});

test('auth rejects unsigned requests and accepts valid Telegram initData', async () => {
  const unauthorized = await jsonRequest('/api/shifts');
  assert.equal(unauthorized.response.status, 401);

  const invalid = await jsonRequest('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: 'auth_date=1&hash=bad' }),
  });
  assert.equal(invalid.response.status, 401);

  const token = await authenticate({ id: 1001, first_name: 'Иван', username: 'ivan_test' });
  const session = await jsonRequest('/api/auth', { headers: bearer(token) });
  assert.equal(session.response.status, 200);
  assert.equal(session.body.user.id, '1001');
  assert.match(session.response.headers.get('set-cookie') || '', /bm_session=/);
});

test('Telegram webhook fails closed without its secret and rejects a wrong secret', async () => {
  const previousSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  try {
    const unavailable = await jsonRequest('/api/telegram-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(unavailable.response.status, 503);

    process.env.TELEGRAM_WEBHOOK_SECRET = 'test-webhook-secret';
    const forbidden = await jsonRequest('/api/telegram-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'wrong-secret',
      },
      body: '{}',
    });
    assert.equal(forbidden.response.status, 403);

    const accepted = await jsonRequest('/api/telegram-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
      },
      body: '{}',
    });
    assert.equal(accepted.response.status, 200);
  } finally {
    if (previousSecret === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
    else process.env.TELEGRAM_WEBHOOK_SECRET = previousSecret;
  }
});

test('authenticated API activity updates user presence without a client heartbeat', async () => {
  const token = await authenticate({ id: 1010, first_name: 'Активность' });
  const shifts = await jsonRequest('/api/shifts', { headers: bearer(token) });
  assert.equal(shifts.response.status, 200);

  const stats = await jsonRequest('/api/stats', { headers: bearer(token) });
  assert.equal(stats.response.status, 200);
  assert.ok(stats.body.totalUsers >= 1);
  assert.ok(stats.body.onlineUsers >= 1);
});

test('salary settings persist deduction percentages and reject values above 100', async () => {
  const token = await authenticate({ id: 1002, first_name: 'Расчёт' });
  const saved = await jsonRequest('/api/salary-params', {
    method: 'PUT',
    headers: { ...bearer(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ salaryParams: { tariffRate: 420, unionPercent: 1, welfarePercent: 1.5, alimonyPercent: 25 } }),
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.body.salaryParams.tariffRate, 420);
  assert.equal(saved.body.salaryParams.unionPercent, 1);
  assert.equal(saved.body.salaryParams.welfarePercent, 1.5);
  assert.equal(saved.body.salaryParams.alimonyPercent, 25);

  const loaded = await jsonRequest('/api/salary-params', { headers: bearer(token) });
  assert.equal(loaded.response.status, 200);
  assert.equal(loaded.body.salaryParams.unionPercent, 1);
  assert.equal(loaded.body.salaryParams.welfarePercent, 1.5);
  assert.equal(loaded.body.salaryParams.alimonyPercent, 25);

  const invalid = await jsonRequest('/api/salary-params', {
    method: 'PUT',
    headers: { ...bearer(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ salaryParams: { alimonyPercent: 101 } }),
  });
  assert.equal(invalid.response.status, 400);
});

test('profile keeps canonical railway and depot ids alongside the legacy depot label', async () => {
  const token = await authenticate({ id: 1003, first_name: 'Профиль' });
  const saved = await jsonRequest('/api/profile', {
    method: 'PUT',
    headers: { ...bearer(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile: {
      firstName: 'Алексей',
      role: 'Машинист',
      depot: 'ТЧЭ-9 Комсомольск-на-Амуре',
      railwayId: 'dvost',
      depotId: 'rzd:dvost:tche-9:komsomolsk-na-amure',
    } }),
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.body.profile.railwayId, 'dvost');
  assert.equal(saved.body.profile.depotId, 'rzd:dvost:tche-9:komsomolsk-na-amure');

  const loaded = await jsonRequest('/api/profile', { headers: bearer(token) });
  assert.equal(loaded.response.status, 200);
  assert.equal(loaded.body.profile.depot, 'ТЧЭ-9 Комсомольск-на-Амуре');
  assert.equal(loaded.body.profile.railwayId, 'dvost');
  assert.equal(loaded.body.profile.depotId, 'rzd:dvost:tche-9:komsomolsk-na-amure');
});

test('depot pack proposals are authenticated and visible only to an admin', async () => {
  const userToken = await authenticate({ id: 6101, first_name: 'Участок' });
  const adminToken = await authenticate({ id: 9001, first_name: 'Администратор' });
  const unauthorized = await jsonRequest('/api/depot-pack-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ depotLabel: 'ТЧЭ-9', armName: 'Комсомольск — Волочаевка' }),
  });
  assert.equal(unauthorized.response.status, 401);

  const submitted = await jsonRequest('/api/depot-pack-requests', {
    method: 'POST',
    headers: { ...bearer(userToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      railwayId: 'dvost',
      depotId: 'rzd:dvost:tche-9:komsomolsk-na-amure',
      depotLabel: 'ТЧЭ-9 · Комсомольск-на-Амуре',
      armName: 'Комсомольск — Советская Гавань',
      notes: 'Есть профиль и режимная карта',
      source: 'poekhali-arm-picker',
    }),
  });
  assert.equal(submitted.response.status, 201);
  assert.equal(submitted.body.request.status, 'new');

  const duplicate = await jsonRequest('/api/depot-pack-requests', {
    method: 'POST',
    headers: { ...bearer(userToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      railwayId: 'dvost',
      depotId: 'rzd:dvost:tche-9:komsomolsk-na-amure',
      depotLabel: 'ТЧЭ-9 · Комсомольск-на-Амуре',
      armName: '  Комсомольск — Советская Гавань  ',
      notes: 'Повторное нажатие',
    }),
  });
  assert.equal(duplicate.response.status, 200);
  assert.equal(duplicate.body.duplicate, true);
  assert.equal(duplicate.body.request.id, submitted.body.request.id);

  const forbidden = await jsonRequest('/api/admin/depot-pack-requests', { headers: bearer(userToken) });
  assert.equal(forbidden.response.status, 403);
  const dashboard = await jsonRequest('/api/admin/depot-pack-requests', { headers: bearer(adminToken) });
  assert.equal(dashboard.response.status, 200);
  assert.ok(dashboard.body.total >= 1);
  assert.equal(dashboard.body.requests[0].depotId, 'rzd:dvost:tche-9:komsomolsk-na-amure');
  assert.equal(dashboard.body.requests[0].armName, 'Комсомольск — Советская Гавань');

  const forbiddenReview = await jsonRequest(`/api/admin/depot-pack-requests/${submitted.body.request.id}`, {
    method: 'PATCH',
    headers: { ...bearer(userToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'reviewing' }),
  });
  assert.equal(forbiddenReview.response.status, 403);
  const reviewed = await jsonRequest(`/api/admin/depot-pack-requests/${submitted.body.request.id}`, {
    method: 'PATCH',
    headers: { ...bearer(adminToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'reviewing', reviewNotes: 'Проверяем наличие исходной ЭК' }),
  });
  assert.equal(reviewed.response.status, 200);
  assert.equal(reviewed.body.request.status, 'reviewing');
  assert.equal(reviewed.body.request.reviewNotes, 'Проверяем наличие исходной ЭК');
});

test('depot pack materials accept unknown formats for manual review and stay admin-only', async () => {
  const userToken = await authenticate({ id: 6102, first_name: 'Материалы' });
  const adminToken = await authenticate({ id: 9001, first_name: 'Администратор' });
  const unknownMaterial = Buffer.from('PROPRIETARY-EMAP\u0000route-data\u0001v1', 'utf8');

  const draft = await jsonRequest('/api/depot-pack-requests', {
    method: 'POST',
    headers: { ...bearer(userToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestType: 'materials',
      depotLabel: 'ТЧЭ-9 · Комсомольск-на-Амуре',
      armName: 'Комсомольск — Новый участок',
      notes: 'Формат электронной карты из другого приложения',
      attachments: [{
        kind: 'electronic-map',
        name: 'карта.railmap',
        mime: 'application/octet-stream',
        size: unknownMaterial.length,
      }],
    }),
  });
  assert.equal(draft.response.status, 201);
  assert.equal(draft.body.request.status, 'uploading');
  assert.equal(draft.body.request.attachments.length, 1);

  const requestId = draft.body.request.id;
  const attachmentId = draft.body.request.attachments[0].id;
  const uploaded = await jsonRequest(`/api/depot-pack-requests/${requestId}/attachments/${attachmentId}`, {
    method: 'PUT',
    headers: { ...bearer(userToken), 'Content-Type': 'application/octet-stream' },
    body: unknownMaterial,
  });
  assert.equal(uploaded.response.status, 200);
  assert.equal(uploaded.body.attachment.detectedFormat, 'unknown');
  assert.equal(uploaded.body.attachment.automaticCheck, 'manual');

  const completed = await jsonRequest(`/api/depot-pack-requests/${requestId}/complete`, {
    method: 'POST',
    headers: bearer(userToken),
  });
  assert.equal(completed.response.status, 200);
  assert.equal(completed.body.request.status, 'new');

  const dashboard = await jsonRequest('/api/admin/depot-pack-requests', { headers: bearer(adminToken) });
  const stored = dashboard.body.requests.find((item) => item.id === requestId);
  assert.ok(stored);
  assert.equal(stored.attachments[0].originalName, 'карта.railmap');
  assert.equal(stored.attachments[0].detectedFormat, 'unknown');
  assert.equal(stored.attachments[0].reviewRequired, true);
  assert.equal(Object.hasOwn(stored.attachments[0], 'storageName'), false);

  const forbiddenDownload = await fetch(baseUrl + `/api/admin/depot-pack-requests/${requestId}/attachments/${attachmentId}`, {
    headers: bearer(userToken),
  });
  assert.equal(forbiddenDownload.status, 403);
  const downloaded = await fetch(baseUrl + `/api/admin/depot-pack-requests/${requestId}/attachments/${attachmentId}`, {
    headers: bearer(adminToken),
  });
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.headers.get('content-type'), 'application/octet-stream');
  assert.equal(downloaded.headers.get('x-content-type-options'), 'nosniff');
  assert.match(downloaded.headers.get('content-security-policy') || '', /sandbox/);
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), unknownMaterial);
});

test('active or executable depot materials stay quarantined and cannot be downloaded accidentally', async () => {
  const userToken = await authenticate({ id: 6103, first_name: 'Карантин' });
  const adminToken = await authenticate({ id: 9001, first_name: 'Администратор' });
  const executableMaterial = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
  const draft = await jsonRequest('/api/depot-pack-requests', {
    method: 'POST',
    headers: { ...bearer(userToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestType: 'materials',
      depotLabel: 'ТЧЭ-1 · Проверка',
      notes: 'Проверка карантина',
      attachments: [{ kind: 'other', name: '../../карта.exe', mime: 'application/octet-stream', size: executableMaterial.length }],
    }),
  });
  assert.equal(draft.response.status, 201);
  assert.equal(draft.body.request.attachments[0].originalName, 'карта.exe');

  const requestId = draft.body.request.id;
  const attachmentId = draft.body.request.attachments[0].id;
  const uploaded = await jsonRequest(`/api/depot-pack-requests/${requestId}/attachments/${attachmentId}`, {
    method: 'PUT',
    headers: { ...bearer(userToken), 'Content-Type': 'application/octet-stream' },
    body: executableMaterial,
  });
  assert.equal(uploaded.response.status, 200);
  assert.equal(uploaded.body.attachment.detectedFormat, 'executable-content');
  assert.equal(uploaded.body.attachment.securityFlag, 'executable-content');
  assert.equal(uploaded.body.attachment.quarantineStatus, 'blocked');

  const blocked = await jsonRequest(`/api/admin/depot-pack-requests/${requestId}/attachments/${attachmentId}`, {
    headers: bearer(adminToken),
  });
  assert.equal(blocked.response.status, 423);

  const acknowledged = await fetch(baseUrl + `/api/admin/depot-pack-requests/${requestId}/attachments/${attachmentId}?acknowledgeRisk=1`, {
    headers: bearer(adminToken),
  });
  assert.equal(acknowledged.status, 200);
  assert.deepEqual(Buffer.from(await acknowledged.arrayBuffer()), executableMaterial);
});

test('community documents keep their audience scope and enter moderation before publication', async () => {
  const userToken = await authenticate({ id: 6104, first_name: 'Автор' });
  const adminToken = await authenticate({ id: 9001, first_name: 'Администратор' });
  const documentFile = Buffer.from('%PDF-1.7\ncommunity document\n%%EOF', 'utf8');

  const invalidDepotScope = await jsonRequest('/api/depot-pack-requests', {
    method: 'POST',
    headers: { ...bearer(userToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestType: 'documents',
      armName: 'Местная инструкция',
      documentCategory: 'instructions',
      scopeLevel: 'depot',
      attachments: [{ kind: 'document', name: 'instruction.pdf', mime: 'application/pdf', size: documentFile.length }],
    }),
  });
  assert.equal(invalidDepotScope.response.status, 400);

  const oversized = await jsonRequest('/api/depot-pack-requests', {
    method: 'POST',
    headers: { ...bearer(userToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestType: 'documents',
      armName: 'Слишком большой документ',
      documentCategory: 'instructions',
      scopeLevel: 'network',
      attachments: [{ kind: 'document', name: 'large.bin', mime: 'application/octet-stream', size: 25 * 1024 * 1024 + 1 }],
    }),
  });
  assert.equal(oversized.response.status, 400);

  const draft = await jsonRequest('/api/depot-pack-requests', {
    method: 'POST',
    headers: { ...bearer(userToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestType: 'documents',
      railwayId: 'dvost',
      depotId: 'rzd:dvost:tche-9:komsomolsk-na-amure',
      depotLabel: 'ТЧЭ-9 · Комсомольск-на-Амуре',
      armName: 'Инструкция по охране труда ТЧЭ-9',
      notes: 'Действующая редакция, проверить дату утверждения',
      documentCategory: 'instructions',
      scopeLevel: 'depot',
      source: 'documents',
      attachments: [{ kind: 'document', name: 'ИОТ-ТЧЭ-9.pdf', mime: 'application/pdf', size: documentFile.length }],
    }),
  });
  assert.equal(draft.response.status, 201);
  assert.equal(draft.body.request.requestType, 'documents');
  assert.equal(draft.body.request.documentTitle, 'Инструкция по охране труда ТЧЭ-9');
  assert.deepEqual(draft.body.request.scope, {
    level: 'depot',
    railway_id: 'dvost',
    depot_id: 'rzd:dvost:tche-9:komsomolsk-na-amure',
    depot_label: 'ТЧЭ-9 · Комсомольск-на-Амуре',
  });

  const requestId = draft.body.request.id;
  const attachmentId = draft.body.request.attachments[0].id;
  const uploaded = await jsonRequest(`/api/depot-pack-requests/${requestId}/attachments/${attachmentId}`, {
    method: 'PUT',
    headers: { ...bearer(userToken), 'Content-Type': 'application/pdf' },
    body: documentFile,
  });
  assert.equal(uploaded.response.status, 200);
  assert.equal(uploaded.body.attachment.detectedFormat, 'pdf');
  assert.equal(uploaded.body.attachment.quarantineStatus, 'pending_review');

  const completed = await jsonRequest(`/api/depot-pack-requests/${requestId}/complete`, {
    method: 'POST',
    headers: bearer(userToken),
  });
  assert.equal(completed.response.status, 200);
  assert.equal(completed.body.request.status, 'new');

  const dashboard = await jsonRequest('/api/admin/depot-pack-requests', { headers: bearer(adminToken) });
  const stored = dashboard.body.requests.find((item) => item.id === requestId);
  assert.ok(stored);
  assert.equal(stored.documentCategory, 'instructions');
  assert.equal(stored.scope.level, 'depot');
  assert.equal(stored.status, 'new');
});

test('analytics requires consent, deduplicates events, and exposes only admin aggregates', async () => {
  const userToken = await authenticate({ id: 6001, first_name: 'Аналитика' });
  const adminToken = await authenticate({ id: 9001, first_name: 'Администратор' });
  const occurredAt = new Date().toISOString();
  const event = {
    eventId: 'event:analytics-test-0001',
    sessionId: 'session:analytics-test-0001',
    eventName: 'shift_saved',
    occurredAt,
    platform: 'android',
    appVersion: 'v390',
    properties: {
      shiftCount: 1,
      hasRoute: true,
      source: 'Маршрут Владивосток — Москва',
      filledFields: ['route', 'note', 'секретное поле'],
      route_from: 'Не должно попасть в аналитику',
    },
  };

  const withoutConsent = await jsonRequest('/api/events', {
    method: 'POST',
    headers: { ...bearer(userToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: [event] }),
  });
  assert.equal(withoutConsent.response.status, 403);

  const consent = await jsonRequest('/api/analytics/consent', {
    method: 'PUT',
    headers: { ...bearer(userToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'granted' }),
  });
  assert.equal(consent.response.status, 200);
  assert.equal(consent.body.consent.status, 'granted');

  const firstBatch = await jsonRequest('/api/events', {
    method: 'POST',
    headers: { ...bearer(userToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: [event] }),
  });
  const duplicateBatch = await jsonRequest('/api/events', {
    method: 'POST',
    headers: { ...bearer(userToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: [event] }),
  });
  assert.equal(firstBatch.response.status, 200);
  assert.equal(firstBatch.body.accepted, 1);
  assert.equal(duplicateBatch.body.accepted, 0);

  const database = new Database(path.join(testDataDir, 'bloknot.sqlite3'), { readonly: true });
  const stored = database.prepare('SELECT properties FROM analytics_events WHERE event_id = ?').get(event.eventId);
  database.close();
  assert.deepEqual(JSON.parse(stored.properties), { shiftCount: 1, hasRoute: true, filledFields: ['route', 'note'] });

  const forbiddenDashboard = await jsonRequest('/api/admin/analytics?days=30', { headers: bearer(userToken) });
  assert.equal(forbiddenDashboard.response.status, 403);
  const dashboard = await jsonRequest('/api/admin/analytics?days=30', { headers: bearer(adminToken) });
  assert.equal(dashboard.response.status, 200);
  assert.equal(dashboard.body.metrics.shiftsSaved, 1);
  assert.equal(dashboard.body.consents.granted, 1);
  assert.equal(dashboard.body.recentEvents[0].userKey.length, 10);

  const publicShell = await fetch(baseUrl + '/analytics');
  assert.equal(publicShell.status, 200);
  assert.match(await publicShell.text(), /shift_tracker_session_token/);
  const adminPage = await fetch(baseUrl + '/analytics', { headers: bearer(adminToken) });
  assert.equal(adminPage.status, 200);
  assert.match(await adminPage.text(), /Статистика приложения/);
});

test('analytics denial removes raw events and prevents further collection', async () => {
  const userToken = await authenticate({ id: 6001, first_name: 'Аналитика' });
  const denied = await jsonRequest('/api/analytics/consent', {
    method: 'PUT',
    headers: { ...bearer(userToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'denied' }),
  });
  assert.equal(denied.response.status, 200);

  const rejected = await jsonRequest('/api/events', {
    method: 'POST',
    headers: { ...bearer(userToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: [{
      eventId: 'event:analytics-test-0002',
      sessionId: 'session:analytics-test-0001',
      eventName: 'app_opened',
      occurredAt: new Date().toISOString(),
      platform: 'android',
      properties: {},
    }] }),
  });
  assert.equal(rejected.response.status, 403);

  const database = new Database(path.join(testDataDir, 'bloknot.sqlite3'), { readonly: true });
  const count = database.prepare('SELECT COUNT(*) AS count FROM analytics_events WHERE sid = ?').get('6001').count;
  database.close();
  assert.equal(count, 0);
});

test('shift sync atomically replaces and reads a user journal', async () => {
  const token = await authenticate({ id: 2001, first_name: 'Машинист' });
  const first = {
    id: 'shift-a',
    start_msk: '2026-07-18T08:00:00',
    end_msk: '2026-07-18T20:00:00',
    created_at: '2026-07-18T07:55:00Z',
    route_from: 'Постышево',
    route_to: 'Комсомольск',
  };
  const second = {
    id: 'shift-b',
    start_msk: '2026-07-19T20:00:00',
    end_msk: '2026-07-20T08:00:00',
    created_at: '2026-07-19T19:55:00Z',
    notes: 'Ночная смена',
  };

  const put = await jsonRequest('/api/shifts', {
    method: 'PUT',
    headers: { ...bearer(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ shifts: [first, second] }),
  });
  assert.equal(put.response.status, 200);
  assert.deepEqual(put.body.shifts, [first, second]);

  const get = await jsonRequest('/api/shifts', { headers: bearer(token) });
  assert.equal(get.response.status, 200);
  assert.deepEqual(get.body.shifts, [first, second]);

  const replace = await jsonRequest('/api/shifts', {
    method: 'PUT',
    headers: { ...bearer(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ shifts: [second] }),
  });
  assert.equal(replace.response.status, 200);
  const afterReplace = await jsonRequest('/api/shifts', { headers: bearer(token) });
  assert.deepEqual(afterReplace.body.shifts, [second]);
});

test('crew pairing and shared-shift inbox survive the SQLite flow', async () => {
  const driverToken = await authenticate({ id: 3001, first_name: 'Алексей' });
  const assistantToken = await authenticate({ id: 3002, first_name: 'Сергей' });

  const invite = await jsonRequest('/api/partners/invite', {
    method: 'POST',
    headers: { ...bearer(driverToken), 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(invite.response.status, 200);
  assert.match(invite.body.code, /^\d{6}$/);

  const redeem = await jsonRequest('/api/partners/redeem', {
    method: 'POST',
    headers: { ...bearer(assistantToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: invite.body.code }),
  });
  assert.equal(redeem.response.status, 200);
  assert.ok(redeem.body.pairing.pairingId);

  const driverPartners = await jsonRequest('/api/partners', { headers: bearer(driverToken) });
  const assistantPartners = await jsonRequest('/api/partners', { headers: bearer(assistantToken) });
  assert.equal(driverPartners.body.partners.length, 1);
  assert.equal(assistantPartners.body.partners.length, 1);

  const sharedFacts = {
    start_msk: '2026-07-18T08:00:00',
    end_msk: '2026-07-18T20:00:00',
    locomotive_series: '3ТЭ28',
    route_from: 'Постышево',
    route_to: 'Комсомольск',
  };
  const share = await jsonRequest('/api/shifts/share', {
    method: 'POST',
    headers: { ...bearer(driverToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId: 'shared-shift-1', shift: sharedFacts }),
  });
  assert.equal(share.response.status, 200);

  const inbox = await jsonRequest('/api/shifts/inbox', { headers: bearer(assistantToken) });
  assert.equal(inbox.response.status, 200);
  assert.equal(inbox.body.items.length, 1);
  assert.deepEqual(inbox.body.items[0].facts, sharedFacts);

  const resolve = await jsonRequest('/api/shifts/inbox/resolve', {
    method: 'POST',
    headers: { ...bearer(assistantToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: inbox.body.items[0].id, action: 'accept' }),
  });
  assert.equal(resolve.response.status, 200);

  await jsonRequest('/api/shifts/share', {
    method: 'POST',
    headers: { ...bearer(driverToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId: 'shared-shift-2', shift: sharedFacts }),
  });
  const trustedInbox = await jsonRequest('/api/shifts/inbox', { headers: bearer(assistantToken) });
  assert.equal(trustedInbox.body.items.length, 1);
  assert.equal(trustedInbox.body.items[0].autoAccept, true);
});
