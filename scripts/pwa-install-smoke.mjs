import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium, devices } from '@playwright/test';

const require = createRequire(import.meta.url);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bloknot-install-smoke-'));
const baseUrl = 'http://127.0.0.1:' + (process.env.PWA_SMOKE_PORT || '4326');
const botToken = '123456:test-install-only';
Object.assign(process.env, { APP_DATA_DIR: dataDir, DISABLE_STORAGE_BACKUPS: '1', NODE_ENV: 'production', PUBLIC_SITE_URL: baseUrl, TELEGRAM_BOT_TOKEN: botToken });
const app = require('../server.js');
const artifacts = path.resolve('artifacts/pwa-install');
fs.mkdirSync(artifacts, { recursive: true });
let browser;
function initData(id) {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: 'Иван' }) });
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const check = [...params.keys()].sort().map(k => k + '=' + params.get(k)).join('\n');
  params.set('hash', crypto.createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}
async function issue(context, id = 81001) {
  const auth = await context.request.post(baseUrl + '/api/auth', { data: { initData: initData(id) } });
  assert.equal(auth.status(), 200);
  const result = await context.request.post(baseUrl + '/api/auth/install-handoff', { data: {} });
  assert.equal(result.status(), 200);
  return (await result.json()).url;
}
try {
  app.startServer(Number(new URL(baseUrl).port));
  await new Promise(resolve => app.server.once('listening', resolve));
  browser = await chromium.launch({ headless: true });
  const telegram = await browser.newContext();
  const url = await issue(telegram);
  const target = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await target.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.getByText('Вход выполнен', { exact: true }).waitFor();
  assert.equal(page.url(), baseUrl + '/install');
  const cookies = await target.cookies();
  assert.ok(cookies.some(c => c.name === 'bm_session' && c.httpOnly && c.expires > Date.now() / 1000));
  assert.equal(await page.locator('#loginButton').isVisible(), false);
  await page.screenshot({ path: path.join(artifacts, 'android-install.png'), fullPage: true });

  // Test the UI contract with an explicit browser-event mock, not a real OS install.
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = () => { window.__promptCalled = true; return Promise.resolve(); };
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);
  });
  await page.locator('#installButton').click();
  assert.equal(await page.evaluate(() => window.__promptCalled), true);
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await page.getByText('Блокнот готов к работе', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('Вход выполнен', { exact: true }).waitFor();

  // Model iOS cookie copying using a fresh context with cookies only (no localStorage).
  const ios = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: undefined });
  await ios.addCookies(cookies);
  const iphone = await ios.newPage();
  await iphone.goto(baseUrl + '/install');
  await iphone.getByText('Вход выполнен', { exact: true }).waitFor();
  assert.match(await iphone.locator('#instructions').innerText(), /Поделиться/);
  assert.equal(await iphone.locator('#installButton').isVisible(), false);
  await iphone.screenshot({ path: path.join(artifacts, 'iphone-install.png'), fullPage: true });

  // No Telegram SDK wait in the installed/browser runtime, even with legacy bad bearer.
  await page.route('https://telegram.org/**', route => route.abort());
  await page.addInitScript(() => localStorage.setItem('shift_tracker_session_token', 'invalid.token'));
  await page.goto(baseUrl + '/?app=v418');
  await page.waitForFunction(() => typeof window.ensureAuthenticated === 'function');
  const runtimeResult = await page.evaluate(async () => {
    AUTH_ENV_STATE = 'prod';
    authBootstrapPromise = null;
    let waited = false;
    const old = waitForTelegramInitData;
    waitForTelegramInitData = () => { waited = true; return Promise.resolve(''); };
    const user = await ensureAuthenticated(5000, { silent: true });
    waitForTelegramInitData = old;
    return { waited, id: user.id };
  });
  assert.deepEqual(runtimeResult, { waited: false, id: '81001' });

  // Failed background validation must preserve the cached app and allow a retry.
  await page.route('**/api/auth', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  const offline = await page.evaluate(async () => {
    authBootstrapPromise = null;
    const id = CURRENT_USER.id;
    await ensureAuthenticated(2000, { silent: true });
    return { id: CURRENT_USER.id, previous: id, unavailable: authNetworkUnavailable, retryable: authBootstrapPromise === null };
  });
  assert.equal(offline.id, offline.previous);
  assert.equal(offline.unavailable, true);
  assert.equal(offline.retryable, true);
  await page.unroute('**/api/auth');

  const fresh = await browser.newContext();
  const expired = await fresh.newPage();
  await expired.goto(url);
  await expired.locator('#loginButton').waitFor({ state: 'visible' });
  assert.match(await expired.locator('#detail').innerText(), /использована|устарела/);
  assert.equal(await expired.locator('#installButton').isVisible(), false);

  // Simulate a bot approval in the isolated test database, without contacting Telegram.
  const pending = await fresh.request.post(baseUrl + '/api/auth/pwa-login-request', { data: { return: '/install' } });
  const requestId = (await pending.json()).requestId;
  await expired.evaluate(id => localStorage.setItem('shift_tracker_pwa_login_request_v1', id), requestId);
  const Database = require('better-sqlite3');
  const db = new Database(path.join(dataDir, 'bloknot.sqlite3'));
  const requests = JSON.parse(db.prepare("SELECT payload FROM app_state WHERE key = 'auth_login_requests'").get().payload);
  requests[requestId].status = 'approved';
  requests[requestId].user = { id: '81002', first_name: 'Иван' };
  db.prepare("UPDATE app_state SET payload = ? WHERE key = 'auth_login_requests'").run(JSON.stringify(requests));
  db.close();
  await expired.reload();
  await expired.getByText('Вход выполнен', { exact: true }).waitFor();
  assert.equal(await expired.evaluate(() => localStorage.getItem('shift_tracker_pwa_login_request_v1')), null);
  assert.equal((await (await fresh.request.get(baseUrl + '/api/auth')).json()).user.id, '81002');

  // A transient API outage is a retry state, not another Telegram login.
  const failing = await fresh.newPage();
  await failing.route('**/api/auth', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await failing.goto(baseUrl + '/install');
  await failing.locator('#retryButton').waitFor({ state: 'visible' });
  assert.equal(await failing.locator('#loginButton').isVisible(), false);
  assert.deepEqual(errors, []);
  console.log('PWA install smoke passed: cross-context handoff, cookie-only restart, replay, iPhone guide, native-event UI, stale bearer, no Telegram wait, network retry. OS installation is not simulated.');
} finally {
  if (browser) await browser.close();
  if (app.server.listening) await new Promise(resolve => app.server.close(resolve));
  app.closeStorage();
  if (path.basename(dataDir).startsWith('bloknot-install-smoke-')) fs.rmSync(dataDir, { recursive: true, force: true });
}

