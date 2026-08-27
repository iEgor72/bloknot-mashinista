#!/usr/bin/env node
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactsDir = path.join(repoRoot, 'artifacts', 'local-smoke');
const port = Number(process.env.SMOKE_PORT || process.env.PORT || 4317);
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
  profileInstallScreenshot: path.relative(repoRoot, path.join(artifactsDir, 'profile-install.png')),
  profileDepotScreenshot: path.relative(repoRoot, path.join(artifactsDir, 'profile-depot-catalog.png')),
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

async function clickElementCenter(page, selector, label) {
  const hit = await page.evaluate((targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!element) return { found: false };
    const rect = element.getBoundingClientRect();
    const x = rect.x + Math.min(rect.width - 8, Math.max(8, rect.width / 2));
    const y = rect.y + Math.min(rect.height - 8, Math.max(8, rect.height / 2));
    const top = document.elementFromPoint(x, y);
    const topMatches = top === element || element.contains(top);
    if (topMatches && typeof element.click === 'function') element.click();
    return {
      found: true,
      topMatches,
      x,
      y,
      width: rect.width,
      height: rect.height,
      topTag: top ? top.tagName : '',
      topId: top ? top.id : '',
      topClass: top ? String(top.className || '') : '',
    };
  }, selector);
  if (!hit.found || hit.width <= 0 || hit.height <= 0) {
    throw new Error(`${label || selector} has no clickable bounding box`);
  }
  if (!hit.topMatches) {
    throw new Error(`${label || selector} is covered at click point: ${JSON.stringify(hit)}`);
  }
}

async function waitForPageCondition(page, predicate, label, timeoutMs = uiTimeoutMs) {
  const start = Date.now();
  let lastError = '';
  while (Date.now() - start < timeoutMs) {
    try {
      if (await page.evaluate(predicate)) return;
    } catch (error) {
      lastError = String(error && error.message ? error.message : error);
    }
    await delay(100);
  }
  throw new Error(`${label} did not become ready within ${timeoutMs}ms${lastError ? `: ${lastError}` : ''}`);
}

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < startupTimeoutMs) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/`, { redirect: 'manual' }, 1500);
      if (response.ok) {
        report.checks.serverHttpOk = true;
        return;
      }
    } catch {}
    await delay(250);
  }
  throw new Error(`Server did not become ready within ${startupTimeoutMs}ms at ${baseUrl}`);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCacheControl(pathname) {
  const response = await fetchWithTimeout(`${baseUrl}${pathname}`, { cache: 'no-store' }, 5000);
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
    let serverExited = false;
    const serverExitPromise = new Promise((resolve) => {
      server.once('exit', () => {
        serverExited = true;
        resolve();
      });
    });
    server.kill('SIGTERM');
    await Promise.race([
      serverExitPromise,
      delay(3000).then(async () => {
        if (!serverExited) {
          try { server.kill('SIGKILL'); } catch {}
          await Promise.race([serverExitPromise, delay(1000)]);
        }
      }),
    ]);
  }
  serverLogStream.end();
  report.finishedAt = new Date().toISOString();
  report.ok = exitCode === 0;
  fs.writeFileSync(path.join(artifactsDir, 'report.json'), JSON.stringify(report, null, 2));
}

async function main() {
  let analyticsConsent = null;
  const analyticsEvents = [];
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

  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined
  });
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
    } else if (url.pathname === '/api/analytics/consent') {
      if (route.request().method() === 'PUT') {
        const payload = route.request().postDataJSON();
        analyticsConsent = { status: payload.status, policyVersion: '2026-07-23', updatedAt: now };
      }
      body = { ok: true, consent: analyticsConsent, policyVersion: '2026-07-23' };
    } else if (url.pathname === '/api/events') {
      const payload = route.request().postDataJSON();
      analyticsEvents.push(...(Array.isArray(payload.events) ? payload.events : []));
      body = { ok: true, accepted: Array.isArray(payload.events) ? payload.events.length : 0, receivedAt: now };
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

  await waitForPageCondition(page, () => !!document.getElementById('appShell'), 'app shell attached');
  await waitForPageCondition(page, () => {
    const shell = document.getElementById('appShell');
    return !!shell && !shell.classList.contains('hidden');
  }, 'app shell visible');
  report.checks.appShellVisible = true;

  const partialRouteTitles = await page.evaluate(() => ({
    departureOnly: getShiftTitle({ route_kind: 'trip', route_from: 'Горин', route_to: '' }),
    arrivalOnly: getShiftTitle({ route_kind: 'trip', route_from: '', route_to: 'Харпичан' }),
    fullRoute: getShiftTitle({ route_kind: 'trip', route_from: 'Горин', route_to: 'Харпичан' }),
  }));
  report.checks.partialRouteTitles = partialRouteTitles;
  assert(partialRouteTitles.departureOnly === 'Горин' &&
    partialRouteTitles.arrivalOnly === 'Харпичан' &&
    partialRouteTitles.fullRoute === 'Горин → Харпичан',
  'partial routes render as a station name without placeholder points or arrows', partialRouteTitles);

  const profileSummaryContract = await page.evaluate(() => {
    const card = document.getElementById('profileSummaryCard');
    const icon = document.querySelector('#profileSummaryCard .profile-summary-icon svg');
    const cardStyle = card ? getComputedStyle(card) : null;
    const iconStyle = icon ? getComputedStyle(icon) : null;
    return {
      cardPresent: !!card,
      iconPresent: !!icon,
      dividerPresent: !!document.querySelector('#profileSummaryCard .profile-summary-divider'),
      shiftValuePresent: !!document.getElementById('profileShiftCount'),
      shiftUnitPresent: !!document.getElementById('profileShiftCountUnit'),
      workedTotalPresent: !!document.getElementById('profileWorkedTotal'),
      cardDisplay: cardStyle?.display || '',
      cardMinHeight: Number.parseFloat(cardStyle?.minHeight || '0'),
      iconWidth: Number.parseFloat(iconStyle?.width || '0'),
      iconHeight: Number.parseFloat(iconStyle?.height || '0'),
    };
  });
  report.checks.profileSummary = profileSummaryContract;
  assert(profileSummaryContract.cardPresent && profileSummaryContract.iconPresent &&
    profileSummaryContract.dividerPresent && profileSummaryContract.shiftValuePresent &&
    profileSummaryContract.shiftUnitPresent && profileSummaryContract.workedTotalPresent,
  'profile summary uses the compact grouped layout', profileSummaryContract);
  assert(profileSummaryContract.cardDisplay === 'grid' &&
    profileSummaryContract.cardMinHeight > 0 && profileSummaryContract.cardMinHeight <= 120 &&
    profileSummaryContract.iconWidth > 0 && profileSummaryContract.iconWidth <= 48 &&
    profileSummaryContract.iconHeight > 0 && profileSummaryContract.iconHeight <= 48,
  'profile summary stylesheet keeps the card and calendar icon compact', profileSummaryContract);

  const profileAboutContract = await page.evaluate(() => ({
    userCountUsesSingleLineValue: !!document.querySelector('.profile-row-static > #profileUserCount.profile-row-value'),
    versionUsesSingleLineValue: !!document.querySelector('.profile-row-static > #profileVersion.profile-row-value'),
    staticRowsHaveNoSecondaryNotes: !document.querySelector('.profile-row-static .profile-row-note'),
  }));
  report.checks.profileAbout = profileAboutContract;
  assert(Object.values(profileAboutContract).every(Boolean),
    'profile about rows use compact single-line values without gray subtitles', profileAboutContract);

  const shiftsOverviewContract = await page.evaluate(() => {
    const overview = document.querySelector('.shifts-overview');
    const stats = getShiftOverviewStats([
      { id: 'overview-night', start_msk: '2026-02-02T13:00', end_msk: '2026-02-03T01:00' },
      { id: 'overview-holiday', start_msk: '2026-01-01T08:00', end_msk: '2026-01-01T20:00' },
      { id: 'overview-day', start_msk: '2026-02-04T08:00', end_msk: '2026-02-04T20:00' },
    ], null);
    return {
      chipCount: overview ? overview.querySelectorAll('.shifts-overview-chip').length : 0,
      display: overview ? getComputedStyle(overview).display : '',
      columns: overview ? getComputedStyle(overview).gridTemplateColumns : '',
      nightValuePresent: !!document.getElementById('shiftsOverviewNightCount'),
      holidayValuePresent: !!document.getElementById('shiftsOverviewHolidayCount'),
      stats,
    };
  });
  report.checks.shiftsOverview = shiftsOverviewContract;
  assert(shiftsOverviewContract.chipCount === 4 && shiftsOverviewContract.display === 'grid' &&
    /repeat\(2,|^[\d.]+px [\d.]+px$/.test(shiftsOverviewContract.columns) && shiftsOverviewContract.nightValuePresent &&
    shiftsOverviewContract.holidayValuePresent && shiftsOverviewContract.stats.count === 3 &&
    shiftsOverviewContract.stats.totalMinutes === 2160 && shiftsOverviewContract.stats.nightCount === 1 &&
    shiftsOverviewContract.stats.holidayCount === 1,
  'shifts overview shows correct total, night and holiday shift counts in a two-column grid', shiftsOverviewContract);

  const deductionContract = await page.evaluate(() => {
    const original = {
      unionPercent: appSettings.unionPercent,
      welfarePercent: appSettings.welfarePercent,
      alimonyPercent: appSettings.alimonyPercent,
    };
    appSettings.unionPercent = 0;
    appSettings.welfarePercent = 0;
    appSettings.alimonyPercent = 0;
    const withoutDeductions = calculateSalarySummaryByMinutes(6000, 0, 0, 160, 0);
    appSettings.unionPercent = 1;
    appSettings.welfarePercent = 1.5;
    appSettings.alimonyPercent = 25;
    const withDeductions = calculateSalarySummaryByMinutes(6000, 0, 0, 160, 0);
    appSettings.unionPercent = original.unionPercent;
    appSettings.welfarePercent = original.welfarePercent;
    appSettings.alimonyPercent = original.alimonyPercent;
    return {
      fieldsPresent: !!document.getElementById('settingUnionPercent') &&
        !!document.getElementById('settingWelfarePercent') &&
        !!document.getElementById('settingAlimonyPercent'),
      withoutDeductions,
      withDeductions,
    };
  });
  report.checks.salaryDeductions = deductionContract;
  assert(deductionContract.fieldsPresent, 'deduction settings fields present', deductionContract);
  const baseNet = deductionContract.withoutDeductions.netAmount;
  const configured = deductionContract.withDeductions;
  assert(Math.abs(configured.alimonyAmount - baseNet * 0.25) < 0.01, 'alimony deducted after NDFL', deductionContract);
  assert(Math.abs(configured.unionAmount - configured.contributionBaseAmount * 0.01) < 0.01, 'union contribution uses salary base', deductionContract);
  assert(Math.abs(configured.welfareAmount - configured.contributionBaseAmount * 0.015) < 0.01, 'welfare contribution uses salary base', deductionContract);
  assert(Math.abs(configured.netAmount - (baseNet - configured.alimonyAmount - configured.unionAmount - configured.welfareAmount)) < 0.01,
    'all deductions reduce take-home amount', deductionContract);

  const analyticsUi = await page.evaluate(() => ({
    dialogPresent: !!document.getElementById('analyticsConsentDialog'),
    profileRowPresent: !!document.getElementById('analyticsProfileRow'),
    userCounterPresent: !!document.getElementById('userStatsFooter'),
    runtimePresent: !!window.ProductAnalytics,
  }));
  report.checks.analyticsUiRemoved = analyticsUi;
  if (analyticsUi.dialogPresent || analyticsUi.profileRowPresent || analyticsUi.userCounterPresent || analyticsUi.runtimePresent) {
    throw new Error(`Analytics UI remains present: ${JSON.stringify(analyticsUi)}`);
  }

  const userFacingDataTools = await page.evaluate(() => {
    const profile = document.querySelector('.tab-panel[data-tab="profile"]');
    const gpsButton = document.getElementById('btnPoekhaliLive');
    const routeNote = document.querySelector('#optionalRouteCard .optional-note');
    const profileText = (profile?.textContent || '').replace(/\s+/g, ' ').trim();
    return {
      exportButtonPresent: !!document.getElementById('btnProfileExportGps'),
      clearButtonPresent: !!document.getElementById('btnProfileClearGps'),
      profileHasTechnicalCopy: /JSON|GPS-маршрут|резервн(?:ая|ой) копи|Версия кэша/i.test(profileText),
      gpsLabel: gpsButton?.getAttribute('aria-label') || '',
      routeNote: (routeNote?.textContent || '').replace(/\s+/g, ' ').trim(),
      exportApiPresent: typeof window.exportPoekhaliGpsCaptures === 'function'
    };
  });
  report.checks.userFacingDataToolsRemoved = userFacingDataTools;
  if (userFacingDataTools.exportButtonPresent || userFacingDataTools.clearButtonPresent ||
      userFacingDataTools.profileHasTechnicalCopy || userFacingDataTools.exportApiPresent) {
    throw new Error(`Technical GPS/backup controls remain user-facing: ${JSON.stringify(userFacingDataTools)}`);
  }
  if (/запис|контрольн/i.test(userFacingDataTools.gpsLabel) || /запис|контрольн/i.test(userFacingDataTools.routeNote)) {
    throw new Error(`GPS capture instructions remain user-facing: ${JSON.stringify(userFacingDataTools)}`);
  }

  const shiftFormContract = await page.evaluate(() => {
    const select = document.getElementById('inputLocoSeries');
    const form = document.getElementById('shiftFormSection');
    const has3te28 = !!select && Array.from(select.options).some((option) => option.value === '3ТЭ28');
    if (select && has3te28) {
      select.value = '3ТЭ28';
      select.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const consumptionText = typeof getFuelConsumptionInlineText === 'function'
      ? getFuelConsumptionInlineText({ consumptionLiters: 14, consumptionKg: 12.34 })
      : '';
    return {
      has3te28,
      fuelSections: form ? form.getAttribute('data-loco-sections') : '',
      consumptionText
    };
  });
  report.checks.shiftFormContract = shiftFormContract;
  if (!shiftFormContract.has3te28 || shiftFormContract.fuelSections !== '3') {
    throw new Error('3ТЭ28 is missing or is not configured as a three-section locomotive');
  }
  if (shiftFormContract.consumptionText !== '12,34 кг') {
    throw new Error(`Fuel consumption must be displayed in kilograms: ${shiftFormContract.consumptionText}`);
  }

  const shiftCardContract = await page.evaluate(() => {
    const originalShifts = Array.isArray(window.allShifts) ? window.allShifts.slice() : [];
    const oldShift = {
      id: 'fuel-card-old',
      start_msk: '2026-07-05T20:00',
      end_msk: '2026-07-06T08:00',
      created_at: '2026-07-06T08:01:00.000Z',
      locomotive_series: '3ТЭ10',
      locomotive_number: '1431',
      fuel_receive_coeff_a: '0.840',
      fuel_receive_liters_a: '5000',
      fuel_handover_coeff_a: '0.840',
      fuel_handover_liters_a: '2550'
    };
    const latestShift = {
      ...oldShift,
      id: 'fuel-card-latest',
      start_msk: '2026-07-12T20:00',
      end_msk: '2026-07-13T08:00',
      created_at: '2026-07-13T08:01:00.000Z'
    };
    const testShifts = [oldShift, latestShift];
    window.allShifts = testShifts;
    const latestId = getLatestManualShiftId(testShifts);
    const inspect = (shift) => {
      const root = document.createElement('div');
      root.innerHTML = buildShiftItemHtml(shift, false, null, Object.create(null), null, null, latestId);
      const rows = Array.from(root.querySelectorAll('.sc-row'));
      const fuelRow = rows.find((row) => row.querySelector('.sc-lab')?.textContent.trim() === 'Расход');
      return {
        poekhaliButtons: root.querySelectorAll('.shift-poekhali-btn').length,
        preparationButtons: root.querySelectorAll('.shift-poekhali-preview-btn').length,
        fuelText: (fuelRow?.querySelector('.sc-val')?.textContent || '').replace(/\s+/g, ' ').trim()
      };
    };
    renderShiftActionsMenu(oldShift.id);
    const oldMenuPoekhaliActions = document.querySelectorAll('#shiftActionsMenu [data-action="poekhali"]').length;
    renderShiftActionsMenu(latestShift.id);
    const latestMenuPoekhaliActions = document.querySelectorAll('#shiftActionsMenu [data-action="poekhali"]').length;
    const clickHost = document.createElement('div');
    clickHost.innerHTML = buildShiftItemHtml(latestShift, false, null, Object.create(null), null, null, latestId);
    let preparationOpenedFor = '';
    const originalPreparationOpen = window.openPoekhaliPreparationForShift;
    window.openPoekhaliPreparationForShift = (id) => {
      preparationOpenedFor = String(id || '');
      return true;
    };
    bindShiftListDetailHandlers(clickHost);
    clickHost.querySelector('.shift-poekhali-btn')?.click();
    window.openPoekhaliPreparationForShift = originalPreparationOpen;
    const result = {
      latestId,
      oldCard: inspect(oldShift),
      latestCard: inspect(latestShift),
      oldMenuPoekhaliActions,
      latestMenuPoekhaliActions,
      preparationOpenedFor
    };
    window.allShifts = originalShifts;
    return result;
  });
  report.checks.shiftCardContract = shiftCardContract;
  if (shiftCardContract.latestId !== 'fuel-card-latest') {
    throw new Error(`Latest shift was not determined by start time: ${JSON.stringify(shiftCardContract)}`);
  }
  if (shiftCardContract.oldCard.poekhaliButtons !== 0 || shiftCardContract.latestCard.poekhaliButtons !== 1) {
    throw new Error(`Poekhali must be available only from the latest shift: ${JSON.stringify(shiftCardContract)}`);
  }
  if (shiftCardContract.oldCard.preparationButtons !== 0 || shiftCardContract.latestCard.preparationButtons !== 0) {
    throw new Error(`Separate preparation button must be removed from shift cards: ${JSON.stringify(shiftCardContract)}`);
  }
  if (shiftCardContract.preparationOpenedFor !== 'fuel-card-latest') {
    throw new Error(`Single Poekhali button must open preparation before GPS: ${JSON.stringify(shiftCardContract)}`);
  }
  if (shiftCardContract.oldMenuPoekhaliActions !== 0 || shiftCardContract.latestMenuPoekhaliActions !== 0) {
    throw new Error(`Removed Poekhali menu action is still visible: ${JSON.stringify(shiftCardContract)}`);
  }
  if (shiftCardContract.oldCard.fuelText !== '2 058 кг' || shiftCardContract.latestCard.fuelText !== '2 058 кг') {
    throw new Error(`Shift card fuel consumption must use kilograms: ${JSON.stringify(shiftCardContract)}`);
  }
  await waitForPageCondition(page, () => {
    const panel = document.querySelector('.tab-panel[data-tab="home"]');
    if (!panel) return false;
    const styles = window.getComputedStyle(panel);
    return panel.classList.contains('active') && styles.display !== 'none' && styles.visibility !== 'hidden';
  }, 'home tab visible');
  report.checks.homeTabVisible = true;

  const monthTitleText = await page.evaluate(() => document.getElementById('monthTitle')?.textContent || '');
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
      items: items.map((item) => ({
        key: item.key || '',
        title: item.title || '',
        text: item.text || '',
        read: !!item.read,
      })),
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
  if (notificationState.keys.includes('offline_mode_fixed_2026_06_v2')) {
    throw new Error('Expired offline announcement stayed in notification inbox');
  }
  if (!notificationState.titles.includes('Свежая служебная заметка')) {
    throw new Error('Recent unread transient notification was removed unexpectedly');
  }

  const notificationBellPresent = !!(await page.$('#appTopBarBell'));
  report.checks.notificationBellRemoved = !notificationBellPresent;
  if (notificationBellPresent) {
  await clickElementCenter(page, '#appTopBarBell', 'notification bell button');
  await waitForPageCondition(page, () => {
    const overlay = document.getElementById('overlayNotifications');
    return !!overlay && (overlay.classList.contains('is-open') || overlay.classList.contains('visible'));
  }, 'notification sheet open');
  const notificationAfterOpen = await page.evaluate(() => {
    const overlay = document.getElementById('overlayNotifications');
    const list = document.getElementById('notifList');
    return {
      overlayClass: overlay ? overlay.className : '',
      overlayHidden: overlay ? overlay.classList.contains('hidden') : false,
      overlayAriaHidden: overlay ? overlay.getAttribute('aria-hidden') : '',
      bodyLocked: document.body.classList.contains('has-open-overlay'),
      listText: list ? list.textContent : '',
      rows: Array.from(document.querySelectorAll('#notifList .notif-row')).map((row) => ({
        title: (row.querySelector('.notif-row-title')?.textContent || '').trim(),
        visible: !!(row.offsetWidth || row.offsetHeight || row.getClientRects().length),
        className: row.className,
      })),
    };
  });
  report.checks.notificationsAfterOpen = notificationAfterOpen;
  if (!notificationAfterOpen.rows.some((row) => row.title === 'Оффлайн режим работает')) {
    throw new Error(`Offline notification row was not rendered after opening bell: ${JSON.stringify(notificationAfterOpen)}`);
  }
  const offlineRowIndex = notificationAfterOpen.rows.findIndex((row) => row.title === 'Оффлайн режим работает');
  await clickElementCenter(page, `#notifList .notif-row:nth-child(${offlineRowIndex + 1})`, 'offline notification row');
  const notificationInteraction = await page.evaluate(() => {
    const overlay = document.getElementById('overlayNotifications');
    const rows = Array.from(document.querySelectorAll('#notifList .notif-row'));
    const row = rows.find((node) => node.textContent.includes('Оффлайн режим работает'));
    const text = row ? row.querySelector('.notif-row-text') : null;
    const styles = text ? window.getComputedStyle(text) : null;
    const items = JSON.parse(localStorage.getItem('shift_tracker_notifications_v1') || '[]');
    const item = items.find((entry) => entry.key === 'offline_mode_fixed_2026_06_v2');
    return {
      overlayOpen: overlay ? (overlay.classList.contains('is-open') || overlay.classList.contains('visible')) : false,
      bodyLocked: document.body.classList.contains('has-open-overlay'),
      rowPresent: !!row,
      rowExpanded: row ? row.getAttribute('aria-expanded') === 'true' && row.classList.contains('is-expanded') : false,
      rowReadClass: row ? row.classList.contains('is-read') : false,
      rowUnreadClass: row ? row.classList.contains('is-unread') : false,
      textDisplay: styles ? styles.display : '',
      storedRead: item ? !!item.read : false,
    };
  });
  report.checks.notificationInteraction = notificationInteraction;
  if (!notificationInteraction.overlayOpen || !notificationInteraction.bodyLocked) {
    throw new Error('Notification sheet did not stay open after tapping a notification');
  }
  if (!notificationInteraction.rowPresent || !notificationInteraction.rowExpanded || notificationInteraction.textDisplay === '-webkit-box') {
    throw new Error('Notification row did not expand after tap');
  }
  if (!notificationInteraction.rowReadClass || notificationInteraction.rowUnreadClass || !notificationInteraction.storedRead) {
    throw new Error('Tapped notification was not marked as read');
  }

  await clickElementCenter(page, '#btnNotifClose', 'notification close button');
  const notificationAfterClose = await page.evaluate(() => {
    const items = JSON.parse(localStorage.getItem('shift_tracker_notifications_v1') || '[]');
    const readKeys = JSON.parse(localStorage.getItem('shift_tracker_notifications_read_v1') || '{}');
    const overlay = document.getElementById('overlayNotifications');
    return {
      overlayOpen: overlay ? (overlay.classList.contains('is-open') || overlay.classList.contains('visible')) : false,
      bodyLocked: document.body.classList.contains('has-open-overlay'),
      keys: items.map((item) => item.key || ''),
      readKeys,
    };
  });
  report.checks.notificationsAfterClose = notificationAfterClose;
  if (notificationAfterClose.overlayOpen || notificationAfterClose.bodyLocked) {
    throw new Error('Notification close left an overlay click lock active');
  }
  if (notificationAfterClose.keys.includes('offline_mode_fixed_2026_06_v2')) {
    throw new Error('Read offline announcement stayed in notification inbox after close');
  }
  if (!notificationAfterClose.readKeys.announcement_offline_mode_fixed_2026_06_v2) {
    throw new Error('Read key for tapped offline announcement was not persisted');
  }

  await page.evaluate(() => {
    window.appNotify(
      'Оффлайн режим работает',
      'Блокнот снова открывается без связи после одного запуска с интернетом.',
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
    throw new Error('Read updated offline system announcement was re-added to notification inbox');
  }
  if (!notificationAfterRead.readKeys.announcement_offline_mode_fixed_2026_06_v2) {
    throw new Error('Read key for updated offline announcement was not persisted');
  }

  await clickElementCenter(page, '#appTopBarBell', 'notification bell button after read');
  await waitForPageCondition(page, () => {
    const overlay = document.getElementById('overlayNotifications');
    return !!overlay && (overlay.classList.contains('is-open') || overlay.classList.contains('visible'));
  }, 'notification sheet open after read');
  await clickElementCenter(page, '#btnNotifMarkRead', 'notification mark-read button');
  const notificationAfterMarkAll = await page.evaluate(() => {
    const items = JSON.parse(localStorage.getItem('shift_tracker_notifications_v1') || '[]');
    const list = document.getElementById('notifList');
    return {
      itemCount: items.length,
      emptyVisible: !!(list && list.textContent.includes('Уведомлений нет')),
    };
  });
  report.checks.notificationsAfterMarkAll = notificationAfterMarkAll;
  if (notificationAfterMarkAll.itemCount !== 0 || !notificationAfterMarkAll.emptyVisible) {
    throw new Error('Mark all read did not archive visible notifications');
  }
  await clickElementCenter(page, '#btnNotifClose', 'notification close button after mark-all');
  const notificationAfterMarkAllClose = await page.evaluate(() => {
    const overlay = document.getElementById('overlayNotifications');
    return {
      overlayOpen: overlay ? (overlay.classList.contains('is-open') || overlay.classList.contains('visible')) : false,
      bodyLocked: document.body.classList.contains('has-open-overlay'),
    };
  });
  report.checks.notificationsAfterMarkAllClose = notificationAfterMarkAllClose;
  if (notificationAfterMarkAllClose.overlayOpen || notificationAfterMarkAllClose.bodyLocked) {
    throw new Error('Notification sheet stayed as a click blocker after mark-all close');
  }
  }
  const profileClickState = await page.evaluate(() => {
    const button = document.querySelector('.tab-btn[data-tab="profile"]');
    const rect = button ? button.getBoundingClientRect() : null;
    const x = rect ? rect.x + Math.min(rect.width - 8, Math.max(8, rect.width / 2)) : 0;
    const y = rect ? rect.y + Math.min(rect.height - 8, Math.max(8, rect.height / 2)) : 0;
    const top = rect ? document.elementFromPoint(x, y) : null;
    return {
      topMatches: !!(button && top && (top === button || button.contains(top))),
      bodyLocked: document.body.classList.contains('has-open-overlay'),
      overlayOpen: !!Array.from(document.querySelectorAll('.overlay')).find((overlay) => (
        !overlay.classList.contains('hidden') &&
        (overlay.classList.contains('is-open') || overlay.classList.contains('visible'))
      )),
      topTag: top ? top.tagName : '',
      topId: top ? top.id : '',
      topClass: top ? String(top.className || '') : '',
    };
  });
  report.checks.profileTabClickableAfterNotifications = profileClickState;
  if (!profileClickState.topMatches || profileClickState.bodyLocked || profileClickState.overlayOpen) {
    throw new Error(`Profile tab is covered after notification close: ${JSON.stringify(profileClickState)}`);
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

  const telegramInstallRequested = await page.evaluate(() => {
    const handlers = Object.create(null);
    const state = { addCalls: 0, checkCalls: 0 };
    const webApp = {
      version: '8.0',
      platform: 'android',
      initData: 'install-smoke',
      ready() {},
      expand() {},
      isVersionAtLeast() { return true; },
      addToHomeScreen() { state.addCalls += 1; },
      checkHomeScreenStatus(callback) {
        state.checkCalls += 1;
        callback('missed');
      },
      onEvent(type, handler) {
        if (!handlers[type]) handlers[type] = [];
        handlers[type].push(handler);
      },
      offEvent(type, handler) {
        handlers[type] = (handlers[type] || []).filter((candidate) => candidate !== handler);
      },
    };
    window.Telegram = { WebApp: webApp };
    window.__telegramInstallSmoke = { handlers, state };
    window.dispatchEvent(new Event('telegram-webapp-sdk-ready'));
    document.getElementById('btnProfileInstall').click();
    return {
      addCalls: state.addCalls,
      checkCalls: state.checkCalls,
      status: window.telegramHomeScreenStatus,
      guideOpen: document.getElementById('overlayAddScreen').classList.contains('is-open'),
    };
  });
  report.checks.telegramHomeScreenRequested = telegramInstallRequested;
  if (telegramInstallRequested.addCalls !== 1 || telegramInstallRequested.checkCalls < 1 || telegramInstallRequested.status !== 'missed' || telegramInstallRequested.guideOpen) {
    throw new Error(`Telegram home-screen request did not use native API: ${JSON.stringify(telegramInstallRequested)}`);
  }

  const telegramInstallAdded = await page.evaluate(() => {
    const smoke = window.__telegramInstallSmoke;
    for (const handler of smoke.handlers.homeScreenAdded || []) handler();
    const stored = JSON.parse(localStorage.getItem('shift_tracker_install_prompt_state_v1') || '{}');
    return {
      status: window.telegramHomeScreenStatus,
      profileInstallHidden: document.getElementById('profileInstallSection').classList.contains('hidden'),
      storedInstalled: stored.installed === true,
    };
  });
  report.checks.telegramHomeScreenAdded = telegramInstallAdded;
  if (telegramInstallAdded.status !== 'added' || !telegramInstallAdded.profileInstallHidden || !telegramInstallAdded.storedInstalled) {
    throw new Error(`Telegram home-screen success was not persisted: ${JSON.stringify(telegramInstallAdded)}`);
  }

  await page.evaluate(() => {
    const handlers = Object.create(null);
    const state = { addCalls: 0, checkCalls: 0 };
    const webApp = {
      version: '8.0',
      platform: 'tdesktop',
      initData: 'install-smoke',
      ready() {},
      expand() {},
      isVersionAtLeast() { return true; },
      addToHomeScreen() { state.addCalls += 1; },
      checkHomeScreenStatus(callback) {
        state.checkCalls += 1;
        callback('unsupported');
      },
      onEvent(type, handler) {
        if (!handlers[type]) handlers[type] = [];
        handlers[type].push(handler);
      },
      offEvent(type, handler) {
        handlers[type] = (handlers[type] || []).filter((candidate) => candidate !== handler);
      },
    };
    window.installPromptInstalled = false;
    window.installPromptDismissed = false;
    window.deferredInstallPromptEvent = null;
    localStorage.removeItem('shift_tracker_install_prompt_state_v1');
    window.Telegram = { WebApp: webApp };
    window.__telegramInstallSmoke = { handlers, state };
    window.dispatchEvent(new Event('telegram-webapp-sdk-ready'));
    document.getElementById('btnProfileInstall').click();
  });
  await page.waitForFunction(() => document.getElementById('overlayAddScreen').classList.contains('is-open'));
  const telegramInstallUnsupported = await page.evaluate(() => ({
    addCalls: window.__telegramInstallSmoke.state.addCalls,
    checkCalls: window.__telegramInstallSmoke.state.checkCalls,
    status: window.telegramHomeScreenStatus,
    guideOpen: document.getElementById('overlayAddScreen').classList.contains('is-open'),
    note: document.getElementById('installGuideRuntimeNote').textContent.trim(),
  }));
  report.checks.telegramHomeScreenUnsupported = telegramInstallUnsupported;
  if (telegramInstallUnsupported.addCalls !== 0 || telegramInstallUnsupported.checkCalls < 1 || telegramInstallUnsupported.status !== 'unsupported' || !telegramInstallUnsupported.guideOpen || !telegramInstallUnsupported.note.includes('не поддерживает')) {
    throw new Error(`Unsupported Telegram client did not fall back to guide: ${JSON.stringify(telegramInstallUnsupported)}`);
  }
  await page.evaluate(() => closeOverlay('overlayAddScreen'));

  report.checks.analyticsEvents = analyticsEvents.map((event) => event.eventName);
  if (analyticsEvents.length) {
    throw new Error(`Analytics events were still delivered: ${JSON.stringify(analyticsEvents)}`);
  }

  await clickElementCenter(page, '.tab-btn[data-tab="profile"]', 'profile tab for install screenshot');
  await page.waitForFunction(() => document.querySelector('.tab-btn[data-tab="profile"]')?.classList.contains('active'));
  await delay(2200);
  await page.screenshot({ path: path.join(artifactsDir, 'profile-install.png'), fullPage: true });
  await clickElementCenter(page, '#btnProfileEdit', 'profile edit');
  await page.waitForFunction(() => (
    document.getElementById('overlayProfileEdit')?.classList.contains('is-open') &&
    document.querySelectorAll('#inputProfileRailwayId option').length === 17
  ));
  await page.evaluate(() => {
    const railway = document.getElementById('inputProfileRailwayId');
    railway.value = 'dvost';
    railway.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelectorAll('#inputProfileDepotId option').length >= 5);
  await page.evaluate(() => {
    const depot = document.getElementById('inputProfileDepotId');
    depot.value = 'rzd:dvost:tche-9:komsomolsk-na-amure';
    depot.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => document.getElementById('profileDepotCoverageText')?.textContent.includes('3 плеча'));
  const profileDepotCatalog = await page.evaluate(() => ({
    railways: document.querySelectorAll('#inputProfileRailwayId option').length - 1,
    depotsOnRailway: document.querySelectorAll('#inputProfileDepotId option').length - 2,
    selectedDepot: document.getElementById('inputProfileDepotId')?.value || '',
    coverage: document.getElementById('profileDepotCoverageText')?.textContent.trim() || '',
    proposalVisible: !document.getElementById('btnProfileProposeArm')?.classList.contains('hidden'),
  }));
  report.checks.profileDepotCatalog = profileDepotCatalog;
  if (profileDepotCatalog.railways !== 16 || profileDepotCatalog.depotsOnRailway !== 3 ||
      profileDepotCatalog.selectedDepot !== 'rzd:dvost:tche-9:komsomolsk-na-amure' ||
      !profileDepotCatalog.coverage.includes('3 плеча') || !profileDepotCatalog.proposalVisible) {
    throw new Error(`Profile depot catalog contract failed: ${JSON.stringify(profileDepotCatalog)}`);
  }
  await page.evaluate(() => document.getElementById('profileDepotCoverage')?.scrollIntoView({ block: 'center' }));
  await delay(160);
  await page.screenshot({ path: path.join(artifactsDir, 'profile-depot-catalog.png'), fullPage: true });
  await page.evaluate(() => closeOverlay('overlayProfileEdit'));
  await clickElementCenter(page, '.tab-btn[data-tab="home"]', 'home tab after install screenshot');
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
