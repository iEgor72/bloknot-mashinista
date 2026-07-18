const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BOT_TOKEN = '123456789:test-server-bot-token';
const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bloknot-server-api-'));

process.env.APP_DATA_DIR = testDataDir;
process.env.DISABLE_STORAGE_BACKUPS = '1';
process.env.NODE_ENV = 'production';
process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
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

test('community links use a versioned app entry URL', async () => {
  const result = await jsonRequest('/api/community');
  assert.equal(result.response.status, 200);
  const appUrl = new URL(result.body.appUrl);
  assert.equal(appUrl.pathname, '/');
  assert.equal(appUrl.searchParams.get('app'), 'v387');
});

test('shift-card runtime is never HTTP-cached and renders fuel in kilograms', async () => {
  const response = await fetch(baseUrl + '/scripts/time-utils.js?v=v387');
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
