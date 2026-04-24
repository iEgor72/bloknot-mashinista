#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactsDir = path.join(repoRoot, 'artifacts', 'local-smoke');
const port = Number(process.env.SMOKE_PORT || process.env.PORT || 4173);
const baseUrl = `http://127.0.0.1:${port}`;
const startupTimeoutMs = Number(process.env.SMOKE_START_TIMEOUT_MS || 15000);
const uiTimeoutMs = Number(process.env.SMOKE_UI_TIMEOUT_MS || 12000);

fs.mkdirSync(artifactsDir, { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  baseUrl,
  port,
  checks: {},
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  serverLog: path.relative(repoRoot, path.join(artifactsDir, 'server.log')),
  screenshot: path.relative(repoRoot, path.join(artifactsDir, 'smoke-home.png')),
};

const serverLogStream = fs.createWriteStream(path.join(artifactsDir, 'server.log'), { flags: 'w' });
let server;
let browser;

function isIgnorableRequestFailure(failure) {
  try {
    const url = new URL(failure.url);
    return url.hostname === 'telegram.org';
  } catch {
    return false;
  }
}

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < startupTimeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/`, { redirect: 'manual' });
      if (response.ok) {
        report.checks.serverHttpOk = true;
        return;
      }
    } catch {}
    await delay(250);
  }
  throw new Error(`Server did not become ready within ${startupTimeoutMs}ms at ${baseUrl}`);
}

async function cleanup(exitCode = 0) {
  if (browser) await browser.close().catch(() => {});
  if (server && !server.killed) {
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));
  }
  serverLogStream.end();
  report.finishedAt = new Date().toISOString();
  report.ok = exitCode === 0;
  fs.writeFileSync(path.join(artifactsDir, 'report.json'), JSON.stringify(report, null, 2));
}

async function main() {
  server = spawn(process.execPath, ['server.js'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.stdout.on('data', (chunk) => serverLogStream.write(chunk));
  server.stderr.on('data', (chunk) => serverLogStream.write(chunk));
  server.on('exit', (code, signal) => {
    report.serverExit = { code, signal };
  });

  await waitForServer();

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.addInitScript(() => {
    const now = new Date().toISOString();
    const userId = '999';
    localStorage.setItem('shift_tracker_cached_user_v1', JSON.stringify({
      id: userId,
      display_name: 'Smoke User',
      username: 'smoke-user',
      is_admin: false,
    }));
    localStorage.setItem(`shift_tracker_shifts_cache_v1_${userId}`, JSON.stringify({
      version: 1,
      userId,
      updatedAt: now,
      shifts: [{
        id: 'smoke-seed-shift',
        start_msk: '2026-04-20T08:00:00+03:00',
        end_msk: '2026-04-20T20:00:00+03:00',
        created_at: now,
        route: 'SMOKE',
        notes: 'Local smoke seed',
        pending: false,
      }],
    }));
    localStorage.setItem(`shift_tracker_shifts_meta_v1_${userId}`, JSON.stringify({
      version: 1,
      userId,
      isOffline: false,
      isSyncing: false,
      hasPending: false,
      lastSyncStatus: 'synced',
      lastError: '',
      lastSyncAt: now,
    }));
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const now = new Date().toISOString();
    let body = { ok: true };
    if (url.pathname === '/api/shifts') {
      body = { sid: '999', shifts: [] };
    } else if (url.pathname === '/api/salary-params') {
      body = { sid: '999', salaryParams: { tariffRate: 380, nightPercent: 40, classPercent: 5, districtPercent: 30, northPercent: 50, localPercent: 20 } };
    } else if (url.pathname === '/api/stats') {
      body = { totalUsers: 1, onlineUsers: 1, onlineWindowSeconds: 120, updatedAt: now };
    } else if (url.pathname === '/api/auth') {
      body = { user: { id: '999', first_name: 'Smoke', username: 'smoke-user', display_name: 'Smoke User' }, sessionToken: 'local-smoke-token' };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(body),
    });
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') report.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => {
    report.pageErrors.push(String(error && error.stack ? error.stack : error));
  });
  page.on('requestfailed', (request) => {
    const failure = {
      url: request.url(),
      method: request.method(),
      errorText: request.failure() ? request.failure().errorText : 'unknown',
    };
    if (!isIgnorableRequestFailure(failure)) report.requestFailures.push(failure);
  });

  const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: startupTimeoutMs });
  report.checks.pageStatus = response ? response.status() : null;
  if (!response || !response.ok()) throw new Error(`GET ${baseUrl} failed with status ${report.checks.pageStatus}`);

  await page.waitForSelector('#appShell', { state: 'attached', timeout: uiTimeoutMs });
  await page.waitForFunction(() => {
    const shell = document.getElementById('appShell');
    return !!shell && !shell.classList.contains('hidden');
  }, null, { timeout: uiTimeoutMs });
  report.checks.appShellVisible = true;

  await page.waitForSelector('[data-tab="home"]', { state: 'visible', timeout: uiTimeoutMs });
  report.checks.homeTabVisible = true;

  const monthTitleText = await page.locator('#monthTitle').textContent();
  report.checks.monthTitlePresent = !!(monthTitleText && monthTitleText.trim());
  if (!report.checks.monthTitlePresent) throw new Error('Month title is empty; root UI did not finish rendering');

  const authGateHidden = await page.evaluate(() => {
    const gate = document.getElementById('authGate');
    if (!gate) return false;
    const styles = window.getComputedStyle(gate);
    return gate.classList.contains('hidden') || styles.display === 'none' || styles.visibility === 'hidden';
  });
  report.checks.authGateHidden = authGateHidden;
  if (!authGateHidden) throw new Error('Auth gate remained visible in local smoke run');

  await page.screenshot({ path: path.join(artifactsDir, 'smoke-home.png'), fullPage: true });

  if (report.consoleErrors.length) throw new Error(`Console errors detected (${report.consoleErrors.length})`);
  if (report.pageErrors.length) throw new Error(`Unhandled page errors detected (${report.pageErrors.length})`);
  if (report.requestFailures.length) throw new Error(`Network failures detected (${report.requestFailures.length})`);
}

let exitCode = 0;
try {
  await main();
} catch (error) {
  exitCode = 1;
  report.error = String(error && error.stack ? error.stack : error);
  console.error(report.error);
} finally {
  await cleanup(exitCode);
  process.exit(exitCode);
}
