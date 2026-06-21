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
const port = Number(process.env.SMOKE_PORT || process.env.PORT || 49173);
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

const serverLogStream = fs.createWriteStream(path.join(artifactsDir, 'server.log'), { flags: 'w' });
let server;
let browser;
let context;

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

async function fetchCacheControl(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`GET ${pathname} failed with status ${response.status}`);
  return response.headers.get('cache-control') || '';
}

async function verifyPwaControlHeaders() {
  const checks = {};
  for (const pathname of [
    '/',
    '/index.html',
    '/sw.js',
    '/scripts/app-constants.js',
    '/scripts/auth.js',
    '/scripts/app.js',
    '/scripts/app-init.js',
    '/scripts/sw-register.js',
  ]) {
    const cacheControl = await fetchCacheControl(pathname);
    checks[pathname] = cacheControl;
    if (!cacheControl.toLowerCase().includes('no-store')) {
      throw new Error(`${pathname} should be served with Cache-Control: no-store, got ${cacheControl || 'empty'}`);
    }
  }
  report.checks.pwaControlHeaders = checks;
}

async function cleanup(exitCode = 0) {
  if (context) await context.close().catch(() => {});
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
  verifyAppShellCacheCoverage();

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
  await verifyPwaControlHeaders();

  browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript(() => {
    const now = new Date().toISOString();
    const userId = '999';
    localStorage.setItem('shift_tracker_session_token', 'local-smoke-token');
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
    const oldTs = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const legacyAnnouncementTs = Date.now() - 13 * 24 * 60 * 60 * 1000;
    const recentTs = Date.now() - 5 * 60 * 1000;
    localStorage.setItem('shift_tracker_notifications_v1', JSON.stringify([
      {
        id: 'old-system-announcement',
        key: 'nav_refresh_2026_06_v1',
        readKey: 'announcement_nav_refresh_2026_06',
        title: 'Большое обновление',
        text: 'Retired announcement seed',
        tone: 'success',
        ts: oldTs,
        read: false,
      },
      {
        id: 'legacy-poekhali-announcement',
        title: 'Поехали',
        text: 'Если смена уже создана, из неё можно открыть рабочий экран «Поехали»...',
        tone: 'success',
        ts: legacyAnnouncementTs,
        read: false,
      },
      {
        id: 'legacy-brigade-announcement',
        title: 'Бригада',
        text: 'Можно связаться по короткому коду и делиться сменами внутри приложения...',
        tone: 'success',
        ts: legacyAnnouncementTs,
        read: false,
      },
      {
        id: 'legacy-docs-announcement',
        title: 'Документы и Папки',
        text: 'Раздел «Папки» теперь подписан как материалы по нарушениям БД...',
        tone: 'info',
        ts: legacyAnnouncementTs,
        read: false,
      },
      {
        id: 'legacy-feedback-announcement',
        title: 'Помощь и обратная связь',
        text: 'В Профиле появился блок «Помощь и связь»...',
        tone: 'info',
        ts: legacyAnnouncementTs,
        read: false,
      },
      {
        id: 'legacy-big-update-announcement',
        title: 'Большое обновление',
        text: 'Обновили навигацию и карточку смены...',
        tone: 'success',
        ts: legacyAnnouncementTs,
        read: false,
      },
      {
        id: 'old-read-transient',
        title: 'Старое прочитанное',
        text: 'Should be archived',
        tone: 'info',
        ts: oldTs,
        read: true,
      },
      {
        id: 'recent-unread-transient',
        title: 'Свежая служебная заметка',
        text: 'Should stay in the inbox',
        tone: 'info',
        ts: recentTs,
        read: false,
      },
    ]));
    localStorage.setItem('shift_tracker_notifications_read_v1', JSON.stringify({
      announcement_nav_refresh_2026_06: oldTs,
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

  const bootFallbackState = await page.evaluate(() => {
    const fallback = document.getElementById('bootFallback');
    return {
      bootComplete: document.documentElement.classList.contains('boot-complete'),
      bootFallbackVisible: document.documentElement.classList.contains('boot-fallback-visible'),
      fallbackDisplay: fallback ? getComputedStyle(fallback).display : '',
    };
  });
  report.checks.bootFallback = bootFallbackState;
  if (!bootFallbackState.bootComplete) throw new Error('Boot did not complete after the app shell rendered');
  if (bootFallbackState.bootFallbackVisible || bootFallbackState.fallbackDisplay !== 'none') {
    throw new Error('Boot fallback is visible over a usable app shell');
  }

  const notificationState = await page.evaluate(() => {
    const raw = localStorage.getItem('shift_tracker_notifications_v1') || '[]';
    const items = JSON.parse(raw);
    return {
      keys: items.map((item) => item.key || ''),
      titles: items.map((item) => item.title || ''),
      unreadCount: items.filter((item) => !item.read).length,
      count: items.length,
    };
  });
  report.checks.notificationsInitial = notificationState;
  if (notificationState.keys.includes('nav_refresh_2026_06_v1')) {
    throw new Error('Retired system announcement stayed in notification inbox');
  }
  if (notificationState.titles.includes('Старое прочитанное')) {
    throw new Error('Read notification stayed in notification inbox');
  }
  for (const retiredTitle of ['Поехали', 'Бригада', 'Документы и Папки', 'Помощь и обратная связь', 'Большое обновление']) {
    if (notificationState.titles.includes(retiredTitle)) {
      throw new Error(`Retired legacy announcement stayed in notification inbox: ${retiredTitle}`);
    }
  }
  if (notificationState.keys.includes('offline_mode_restored_2026_06_v1')) {
    throw new Error('Old offline announcement stayed in notification inbox');
  }
  if (!notificationState.keys.includes('offline_mode_fixed_2026_06_v2')) {
    throw new Error('Updated offline announcement was not seeded');
  }
  if (!notificationState.titles.includes('Свежая служебная заметка')) {
    throw new Error('Recent unread transient notification was removed unexpectedly');
  }

  await page.evaluate(() => {
    const items = JSON.parse(localStorage.getItem('shift_tracker_notifications_v1') || '[]');
    const nextItems = items.map((item) => (
      item && item.key === 'offline_mode_fixed_2026_06_v2'
        ? { ...item, read: true }
        : item
    ));
    const readKeys = JSON.parse(localStorage.getItem('shift_tracker_notifications_read_v1') || '{}');
    readKeys.announcement_offline_mode_fixed_2026_06_v2 = Date.now();
    localStorage.setItem('shift_tracker_notifications_v1', JSON.stringify(nextItems));
    localStorage.setItem('shift_tracker_notifications_read_v1', JSON.stringify(readKeys));
    window.appNotify(
      'Оффлайн режим обновлён',
      'Кэш обновился до v378. Откройте Блокнот один раз при интернете.',
      'success',
      {
        key: 'offline_mode_fixed_2026_06_v2',
        readKey: 'announcement_offline_mode_fixed_2026_06_v2',
        replace: true,
      }
    );
  });
  const notificationAfterRead = await page.evaluate(() => {
    const items = JSON.parse(localStorage.getItem('shift_tracker_notifications_v1') || '[]');
    const readKeys = JSON.parse(localStorage.getItem('shift_tracker_notifications_read_v1') || '{}');
    return {
      keys: items.map((item) => item.key || ''),
      readKeys,
    };
  });
  report.checks.notificationsAfterRead = notificationAfterRead;
  if (notificationAfterRead.keys.includes('offline_mode_fixed_2026_06_v2')) {
    throw new Error('Read updated offline system announcement stayed in notification inbox');
  }
  if (!notificationAfterRead.readKeys.announcement_offline_mode_fixed_2026_06_v2) {
    throw new Error('Read key for updated offline announcement was not persisted');
  }

  const overlayRecoveryState = await page.evaluate(() => {
    const overlay = document.getElementById('overlayNotifications');
    const backdrop = document.getElementById('shiftActionsBackdrop');
    if (overlay) overlay.classList.add('hidden', 'is-open', 'visible');
    if (backdrop) backdrop.classList.remove('hidden');
    document.body.classList.add('has-open-overlay');
    if (typeof window.__shiftTrackerSyncOverlayUiState === 'function') {
      window.__shiftTrackerSyncOverlayUiState();
    }
    return {
      bodyLocked: document.body.classList.contains('has-open-overlay'),
      overlayOpen: overlay ? (overlay.classList.contains('is-open') || overlay.classList.contains('visible')) : false,
      backdropHidden: backdrop ? backdrop.classList.contains('hidden') : true,
    };
  });
  report.checks.overlayRecovery = overlayRecoveryState;
  if (overlayRecoveryState.bodyLocked || overlayRecoveryState.overlayOpen || !overlayRecoveryState.backdropHidden) {
    throw new Error('Overlay recovery did not release stale click blockers');
  }

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
