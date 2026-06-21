#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactsDir = path.join(repoRoot, 'artifacts', 'offline-smoke');
const port = Number(process.env.OFFLINE_SMOKE_PORT || process.env.PORT || 49174);
const baseUrl = `http://127.0.0.1:${port}`;
const startupTimeoutMs = Number(process.env.OFFLINE_SMOKE_START_TIMEOUT_MS || 15000);
const uiTimeoutMs = Number(process.env.OFFLINE_SMOKE_UI_TIMEOUT_MS || 12000);

fs.mkdirSync(artifactsDir, { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  baseUrl,
  port,
  checks: {},
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  screenshots: {
    offlineReload: path.relative(repoRoot, path.join(artifactsDir, 'offline-reload.png')),
    bootFallback: path.relative(repoRoot, path.join(artifactsDir, 'boot-fallback.png')),
  },
  serverLog: path.relative(repoRoot, path.join(artifactsDir, 'server.log')),
};

let server;
let browser;
let context;
const serverLogStream = fs.createWriteStream(path.join(artifactsDir, 'server.log'), { flags: 'w' });
let selfTimeout;

function setPhase(phase) {
  report.phase = phase;
}

async function withTimeout(promise, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function closeContextSafely(activeContext, label) {
  if (!activeContext) return;
  try {
    await withTimeout(activeContext.close(), 5000, `${label} context close`);
  } catch (error) {
    report[`${label}CloseWarning`] = String(error && error.message ? error.message : error);
  }
}

function normalizeLocalPath(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    return new URL(rawUrl, 'https://bloknot-mashinista-bot.ru').pathname;
  } catch {
    return '';
  }
}

function extractQuotedUrls(source) {
  return [...source.matchAll(/['"]([^'"]+)['"]/g)]
    .map((match) => normalizeLocalPath(match[1]))
    .filter(Boolean);
}

function extractSwArrayUrls(swSource, arrayName) {
  const match = swSource.match(new RegExp(`const\\s+${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!match) throw new Error(`Could not find ${arrayName} in sw.js`);
  return new Set(extractQuotedUrls(match[1]));
}

function extractIndexShellAssets(htmlSource) {
  const urls = [...htmlSource.matchAll(/\b(?:href|src)=["'](\/[^"'?#]+)(?:\?[^"']*)?["']/g)]
    .map((match) => normalizeLocalPath(match[1]))
    .filter((url) => (
      url.startsWith('/styles/') ||
      url.startsWith('/scripts/') ||
      url.startsWith('/assets/') ||
      url === '/manifest.webmanifest' ||
      url === '/apple-touch-icon.png' ||
      url === '/icon-192.png' ||
      url === '/icon-512.png'
    ));
  return [...new Set(urls)].sort();
}

function verifyAppShellCacheCoverage() {
  const htmlSource = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
  const swSource = fs.readFileSync(path.join(repoRoot, 'sw.js'), 'utf8');
  const indexAssets = extractIndexShellAssets(htmlSource);
  const installUrls = extractSwArrayUrls(swSource, 'INSTALL_SHELL_URLS');
  const criticalUrls = extractSwArrayUrls(swSource, 'CRITICAL_INSTALL_URLS');
  const missingFromInstall = indexAssets.filter((url) => !installUrls.has(url));
  const missingFromCritical = indexAssets.filter((url) => !criticalUrls.has(url));

  report.checks.appShellAssetsCovered = {
    indexAssetCount: indexAssets.length,
    missingFromInstall,
    missingFromCritical,
  };

  if (missingFromInstall.length || missingFromCritical.length) {
    throw new Error(
      'PWA shell cache coverage mismatch: ' +
      `INSTALL missing [${missingFromInstall.join(', ') || 'none'}], ` +
      `CRITICAL missing [${missingFromCritical.join(', ') || 'none'}]`
    );
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

function seedOfflineStorageScript() {
  return () => {
    const now = new Date().toISOString();
    const userId = 'offline-smoke';
    localStorage.setItem('shift_tracker_session_token', 'offline-smoke-token');
    localStorage.setItem('shift_tracker_cached_user_v1', JSON.stringify({
      id: userId,
      display_name: 'Offline Smoke',
      username: 'offline-smoke',
      is_admin: false,
    }));
    localStorage.setItem(`shift_tracker_shifts_cache_v1_${userId}`, JSON.stringify({
      version: 1,
      userId,
      updatedAt: now,
      shifts: [{
        id: 'offline-smoke-shift',
        start_msk: '2026-04-21T08:00:00+03:00',
        end_msk: '2026-04-21T20:00:00+03:00',
        created_at: now,
        route: 'OFFLINE',
        notes: 'Offline smoke seed',
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
  };
}

async function mockApiRoutes(page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const now = new Date().toISOString();
    let body = { ok: true };
    if (url.pathname === '/api/shifts') {
      body = {
        sid: 'offline-smoke',
        shifts: [{
          id: 'offline-smoke-shift',
          start_msk: '2026-04-21T08:00:00+03:00',
          end_msk: '2026-04-21T20:00:00+03:00',
          created_at: now,
          route: 'OFFLINE',
          notes: 'Offline smoke seed',
        }],
      };
    } else if (url.pathname === '/api/salary-params') {
      body = { sid: 'offline-smoke', salaryParams: { tariffRate: 380, nightPercent: 40, classPercent: 5, districtPercent: 30, northPercent: 50, localPercent: 20 } };
    } else if (url.pathname === '/api/stats') {
      body = { totalUsers: 1, onlineUsers: 1, onlineWindowSeconds: 120, updatedAt: now };
    } else if (url.pathname === '/api/auth') {
      body = { user: { id: 'offline-smoke', display_name: 'Offline Smoke', username: 'offline-smoke' }, sessionToken: 'offline-smoke-token' };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(body),
    });
  });
}

function watchPage(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') report.consoleErrors.push(`[${label}] ${msg.text()}`);
  });
  page.on('pageerror', (error) => {
    report.pageErrors.push(`[${label}] ${String(error && error.stack ? error.stack : error)}`);
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    const requestUrl = request.url();
    let hostname = '';
    try {
      hostname = new URL(requestUrl).hostname;
    } catch {}
    if (hostname === 'telegram.org') return;
    report.requestFailures.push({
      label,
      url: requestUrl,
      method: request.method(),
      errorText: failure ? failure.errorText : 'unknown',
    });
  });
}

async function waitForServiceWorker(page) {
  const state = await page.evaluate(() => Promise.race([
    ('serviceWorker' in navigator
      ? navigator.serviceWorker.ready.then((registration) => {
          if (registration && registration.active) {
            registration.active.postMessage({ type: 'WARMUP_CACHE' });
          }
          return {
            supported: true,
            active: !!(registration && registration.active),
            controller: !!navigator.serviceWorker.controller,
          };
        })
      : Promise.resolve({ supported: false })),
    new Promise((resolve) => setTimeout(() => resolve({
      timeout: true,
      supported: 'serviceWorker' in navigator,
      controller: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
    }), 8000)),
  ]));
  report.checks.serviceWorkerReady = state;
  if (!state.supported || state.timeout || !state.active) {
    throw new Error(`Service worker did not become ready: ${JSON.stringify(state)}`);
  }
  await delay(1500);
  return state;
}

async function reloadAndKeepPage(page, label) {
  try {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: startupTimeoutMs });
    return;
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (!/ERR_ABORTED|frame was detached|navigation/i.test(message)) {
      throw error;
    }
    report[`${label}ReloadWarning`] = message.split('\n')[0];
    await page.waitForLoadState('domcontentloaded', { timeout: 4000 }).catch(() => {});
  }
}

async function assertAppShellVisible(page, label) {
  await page.waitForFunction(() => {
    const shell = document.getElementById('appShell');
    if (!shell || shell.classList.contains('hidden')) return false;
    const styles = getComputedStyle(shell);
    return styles.display !== 'none' && styles.visibility !== 'hidden';
  }, null, { timeout: uiTimeoutMs });

  const state = await page.evaluate(() => {
    const fallback = document.getElementById('bootFallback');
    const monthTitle = document.getElementById('monthTitle');
    return {
      title: document.title,
      href: location.href,
      online: navigator.onLine,
      bootComplete: document.documentElement.classList.contains('boot-complete'),
      fallbackVisible: fallback ? getComputedStyle(fallback).display !== 'none' : null,
      monthTitle: monthTitle ? monthTitle.textContent.trim() : '',
      bodyText: document.body ? document.body.innerText.slice(0, 600) : '',
    };
  });
  report.checks[label] = state;
  if (!state.bootComplete) throw new Error(`${label}: boot-complete class was not set`);
  if (state.fallbackVisible) throw new Error(`${label}: boot fallback is visible over app shell`);
  if (!state.monthTitle) throw new Error(`${label}: month title is empty`);
}

async function runOfflineReloadCheck() {
  setPhase('offline-reload:create-context');
  context = await browser.newContext();
  const page = await context.newPage();
  watchPage(page, 'offline-reload');
  await page.addInitScript(seedOfflineStorageScript());
  await mockApiRoutes(page);

  setPhase('offline-reload:first-load');
  const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: startupTimeoutMs });
  if (!response || !response.ok()) throw new Error(`GET ${baseUrl} failed with status ${response ? response.status() : 'none'}`);
  await assertAppShellVisible(page, 'onlineWarmup');
  setPhase('offline-reload:wait-sw');
  const swState = await waitForServiceWorker(page);
  if (!swState.controller) {
    setPhase('offline-reload:online-reload-for-controller');
    await reloadAndKeepPage(page, 'onlineControlled');
    setPhase('offline-reload:assert-controlled');
    await assertAppShellVisible(page, 'onlineControlledReload');
    const controlled = await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller));
    report.checks.onlineControlledReload.controller = controlled;
    if (!controlled) throw new Error('Service worker did not control the page after online reload');
  }

  setPhase('offline-reload:cdp-offline');
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  setPhase('offline-reload:offline-page-reload');
  await reloadAndKeepPage(page, 'offline');
  setPhase('offline-reload:assert-offline-shell');
  await assertAppShellVisible(page, 'offlineReload');
  await page.screenshot({ path: path.join(artifactsDir, 'offline-reload.png'), fullPage: true });
  setPhase('offline-reload:close-context');
  await closeContextSafely(context, 'offlineReload');
  context = null;
}

async function runBootFallbackCheck() {
  context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  watchPage(page, 'boot-fallback');
  await page.route('**/scripts/auth.js*', (route) => route.abort());
  await page.route('**/scripts/app.js*', (route) => route.abort());

  const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: startupTimeoutMs });
  if (!response || !response.ok()) throw new Error(`GET ${baseUrl} for fallback failed with status ${response ? response.status() : 'none'}`);

  await page.waitForFunction(() => {
    const fallback = document.getElementById('bootFallback');
    return !!fallback && getComputedStyle(fallback).display !== 'none';
  }, null, { timeout: uiTimeoutMs });

  const state = await page.evaluate(() => {
    const fallback = document.getElementById('bootFallback');
    return {
      title: document.title,
      fallbackText: fallback ? fallback.innerText : '',
      bootComplete: document.documentElement.classList.contains('boot-complete'),
      bootFallbackVisible: document.documentElement.classList.contains('boot-fallback-visible'),
      diagnostics: localStorage.getItem('shift_tracker_boot_diagnostics_v1') || '',
    };
  });
  report.checks.bootFallback = state;
  if (state.bootComplete) throw new Error('Fallback test unexpectedly marked boot complete');
  if (!/Открываем блокнот/.test(state.fallbackText)) throw new Error('Fallback text is missing expected title');
  if (!/fallback-visible/.test(state.diagnostics)) throw new Error('Fallback diagnostic was not recorded');
  await page.screenshot({ path: path.join(artifactsDir, 'boot-fallback.png'), fullPage: true });
  await closeContextSafely(context, 'bootFallback');
  context = null;
}

async function cleanup(exitCode = 0) {
  if (context) await closeContextSafely(context, 'cleanup');
  if (browser) {
    try {
      await withTimeout(browser.close(), 5000, 'browser close');
    } catch (error) {
      report.browserCloseWarning = String(error && error.message ? error.message : error);
    }
  }
  if (server && !server.killed) {
    server.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => server.once('exit', resolve)),
      delay(3000),
    ]);
  }
  serverLogStream.end();
  report.finishedAt = new Date().toISOString();
  report.ok = exitCode === 0;
  fs.writeFileSync(path.join(artifactsDir, 'report.json'), JSON.stringify(report, null, 2));
}

async function main() {
  setPhase('verify-cache-coverage');
  verifyAppShellCacheCoverage();

  setPhase('start-server');
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

  setPhase('wait-server');
  await waitForServer();
  setPhase('launch-browser');
  browser = await withTimeout(chromium.launch({ headless: true }), 15000, 'chromium launch');
  setPhase('offline-reload-check');
  await withTimeout(runOfflineReloadCheck(), 45000, 'offline reload check');
  setPhase('boot-fallback-check');
  await withTimeout(runBootFallbackCheck(), 30000, 'boot fallback check');

  setPhase('assert-errors');
  const unexpectedConsoleErrors = report.consoleErrors.filter((line) => {
    if (/Failed to load resource|net::ERR_FAILED/.test(line)) return false;
    if (/\[boot-fallback\].*Service worker registration failed/.test(line)) return false;
    return true;
  });
  const unexpectedPageErrors = report.pageErrors.filter((line) => !/^\[boot-fallback\]/.test(line));
  const unexpectedRequestFailures = report.requestFailures.filter((failure) => {
    if (failure.label === 'boot-fallback' && /\/scripts\/(auth|app)\.js/.test(failure.url)) return false;
    if (failure.label === 'offline-reload' && failure.url === `${baseUrl}/` && failure.errorText === 'net::ERR_ABORTED') return false;
    return true;
  });
  if (unexpectedConsoleErrors.length) throw new Error(`Unexpected console errors detected (${unexpectedConsoleErrors.length})`);
  if (unexpectedPageErrors.length) throw new Error(`Unhandled page errors detected (${unexpectedPageErrors.length})`);
  if (unexpectedRequestFailures.length) throw new Error(`Unexpected request failures detected (${unexpectedRequestFailures.length})`);
}

let exitCode = 0;
try {
  selfTimeout = setTimeout(() => {
    report.error = `offline smoke self-timeout at phase: ${report.phase || 'unknown'}`;
    cleanup(1).finally(() => process.exit(1));
  }, Number(process.env.OFFLINE_SMOKE_TOTAL_TIMEOUT_MS || 100000));
  await main();
} catch (error) {
  exitCode = 1;
  report.error = String(error && error.stack ? error.stack : error);
  console.error(report.error);
} finally {
  if (selfTimeout) clearTimeout(selfTimeout);
  await cleanup(exitCode);
  process.exit(exitCode);
}
