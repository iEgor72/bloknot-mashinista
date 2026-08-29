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
const port = Number(process.env.OFFLINE_SMOKE_PORT || process.env.PORT || 4318);
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
    staleOfflineRuntime: path.relative(repoRoot, path.join(artifactsDir, 'stale-offline-runtime.png')),
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
    const today = new Date();
    const shiftDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
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
        start_msk: `${shiftDay}T08:00`,
        end_msk: `${shiftDay}T20:00`,
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
    const today = new Date();
    const shiftDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let body = { ok: true };
    if (url.pathname === '/api/shifts') {
      body = {
        sid: 'offline-smoke',
        shifts: [{
          id: 'offline-smoke-shift',
          start_msk: `${shiftDay}T08:00`,
          end_msk: `${shiftDay}T20:00`,
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
    if (!shell) return false;
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
      allShiftsCount: Array.isArray(window.allShifts) ? window.allShifts.length : -1,
      hasSeededShift: Array.isArray(window.allShifts) && window.allShifts.some((shift) => shift && shift.id === 'offline-smoke-shift'),
      seededShiftRendered: !!document.querySelector('[data-shift-id="offline-smoke-shift"]'),
      runtimeIntegrity: window.__SHIFT_TRACKER_RUNTIME_INTEGRITY || null,
      runtimeModules: Object.assign({}, window.__SHIFT_TRACKER_RUNTIME_MODULES || {}),
      bodyText: document.body ? document.body.innerText.slice(0, 600) : '',
    };
  });
  report.checks[label] = state;
  if (!state.bootComplete) throw new Error(`${label}: boot-complete class was not set`);
  if (state.fallbackVisible) throw new Error(`${label}: boot fallback is visible over app shell`);
  if (!state.monthTitle) throw new Error(`${label}: month title is empty`);
  return state;
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

  setPhase('offline-reload:mixed-cache-regression');
  const mixedCacheSeed = await page.evaluate(async () => {
    const version = typeof SHELL_CACHE_VERSION === 'string' ? SHELL_CACHE_VERSION : '';
    const liveResponse = await fetch('/scripts/v416/time-utils.js?mixed-cache-source=' + Date.now(), { cache: 'no-store' });
    const liveSource = await liveResponse.text();
    const staleSource = liveSource.replace(
      /if \(ft && ft\.consumptionKg > 0\) \{\s+pushRow\('Расход', ruNum\(ft\.consumptionKg\) \+ ' кг'\);/,
      "if (ft && ft.consumptionLiters > 0) {\n            pushRow('Расход', ruNum(ft.consumptionLiters) + ' л');"
    );
    if (staleSource === liveSource) throw new Error('Could not create stale time-utils fixture');

    const staleCacheName = 'shift-tracker-shell-v000-mixed-regression';
    const staleCache = await caches.open(staleCacheName);
    await staleCache.put('/scripts/v396/time-utils.js', new Response(staleSource, {
      status: 200,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    }));

    const currentCacheName = 'shift-tracker-shell-' + version;
    let runtimeKeys = [];
    let deleteResults = [];
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const currentCache = await caches.open(currentCacheName);
      await currentCache.put('/scripts/v416/time-utils.js', new Response(liveSource, {
        status: 200,
        headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
      }));
      const currentKeys = await currentCache.keys();
      runtimeKeys = currentKeys.filter((request) => new URL(request.url).pathname === '/scripts/v416/time-utils.js');
      if (runtimeKeys.length) {
        deleteResults = await Promise.all(runtimeKeys.map((request) => currentCache.delete(request)));
        if (deleteResults.every(Boolean)) break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return {
      version,
      staleCacheName,
      currentCacheName,
      controllerUrl: navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : '',
      runtimeKeys: runtimeKeys.map((request) => request.url),
      deletedCurrentRuntime: runtimeKeys.length > 0 && deleteResults.every(Boolean),
    };
  });
  if (!mixedCacheSeed.version || !mixedCacheSeed.deletedCurrentRuntime) {
    throw new Error(`Mixed-cache fixture was not prepared: ${JSON.stringify(mixedCacheSeed)}`);
  }

  await reloadAndKeepPage(page, 'mixedCache');
  await assertAppShellVisible(page, 'mixedCacheReload');
  const mixedCacheResult = await page.evaluate(async (staleCacheName) => {
    const html = buildShiftConsistHtml({
      locomotive_series: '3ТЭ10',
      locomotive_number: '1431',
      fuel_receive_coeff_a: '0.840',
      fuel_receive_liters_a: '5000',
      fuel_handover_coeff_a: '0.840',
      fuel_handover_liters_a: '2550',
    }, '', '12ч');
    const holder = document.createElement('div');
    holder.innerHTML = html;
    const text = (holder.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    await caches.delete(staleCacheName);
    return {
      text,
      hasKg: /Расход\s*2 058 кг/.test(text),
      hasLiters: /Расход\s*2 450 л/.test(text),
    };
  }, mixedCacheSeed.staleCacheName);
  report.checks.mixedVersionRuntimeIsolation = {
    ...mixedCacheSeed,
    ...mixedCacheResult,
  };
  if (!mixedCacheResult.hasKg || mixedCacheResult.hasLiters) {
    throw new Error(`PWA mixed-cache regression served stale runtime: ${JSON.stringify(mixedCacheResult)}`);
  }

  setPhase('offline-reload:mixed-runtime-self-repair');
  const repairSentinelKey = 'shift_tracker_runtime_repair_test_sentinel';
  const repairNavigation = page.waitForURL((url) => (
    url.searchParams.get('runtime_repair') === 'v416' && Boolean(url.searchParams.get('repair_nonce'))
  ), { timeout: uiTimeoutMs });
  const repairTrigger = await page.evaluate((sentinelKey) => {
    localStorage.setItem(sentinelKey, 'preserved');
    window.__SHIFT_TRACKER_RUNTIME_MODULES['time-utils'] = 'v000';
    window.__SHIFT_TRACKER_RUNTIME_MODULES.render = 'v000';
    window.__SHIFT_TRACKER_RUNTIME_MODULES['app-init'] = 'v000';
    return window.__SHIFT_TRACKER_VERIFY_RUNTIME();
  }, repairSentinelKey);
  if (repairTrigger.ok || repairTrigger.mismatches.length < 3) {
    throw new Error(`Mixed runtime was not detected: ${JSON.stringify(repairTrigger)}`);
  }
  await repairNavigation;
  await page.waitForLoadState('domcontentloaded');
  await assertAppShellVisible(page, 'mixedRuntimeRepairReload');
  const repairResult = await page.evaluate((sentinelKey) => {
    const integrity = window.__SHIFT_TRACKER_RUNTIME_INTEGRITY || {};
    const modules = window.__SHIFT_TRACKER_RUNTIME_MODULES || {};
    const required = Array.isArray(SHIFT_TRACKER_REQUIRED_RUNTIME_MODULES)
      ? SHIFT_TRACKER_REQUIRED_RUNTIME_MODULES.slice()
      : [];
    const html = buildShiftConsistHtml({
      locomotive_series: '3ТЭ10',
      locomotive_number: '1431',
      fuel_receive_coeff_a: '0.840',
      fuel_receive_liters_a: '5000',
      fuel_handover_coeff_a: '0.840',
      fuel_handover_liters_a: '2550',
    }, '', '12ч');
    const holder = document.createElement('div');
    holder.innerHTML = html;
    const text = (holder.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const staleModules = required.filter((name) => modules[name] !== SHELL_CACHE_VERSION);
    const result = {
      integrity,
      required,
      staleModules,
      sentinelPreserved: localStorage.getItem(sentinelKey) === 'preserved',
      hasKg: /Расход\s*2 058 кг/.test(text),
      hasLiters: /Расход\s*2 450 л/.test(text),
      href: location.href,
    };
    localStorage.removeItem(sentinelKey);
    return result;
  }, repairSentinelKey);
  report.checks.mixedRuntimeSelfRepair = {
    trigger: repairTrigger,
    result: repairResult,
  };
  if (!repairResult.integrity.ok || repairResult.staleModules.length || !repairResult.sentinelPreserved || !repairResult.hasKg || repairResult.hasLiters) {
    throw new Error(`Mixed runtime self-repair failed: ${JSON.stringify(repairResult)}`);
  }

  const repairedSwState = await waitForServiceWorker(page);
  if (!repairedSwState.controller) {
    await reloadAndKeepPage(page, 'mixedRuntimeRepairControlled');
    await assertAppShellVisible(page, 'mixedRuntimeRepairControlledReload');
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
  const offlineReloadState = await assertAppShellVisible(page, 'offlineReload');
  if (!offlineReloadState.hasSeededShift || !offlineReloadState.seededShiftRendered || offlineReloadState.allShiftsCount !== 1) {
    throw new Error(`Offline reload did not restore cached shifts: ${JSON.stringify(offlineReloadState)}`);
  }
  await page.screenshot({ path: path.join(artifactsDir, 'offline-reload.png'), fullPage: true });
  setPhase('offline-reload:close-context');
  await closeContextSafely(context, 'offlineReload');
  context = null;
}

async function runStaleOfflineRuntimeCheck() {
  setPhase('stale-offline-runtime:create-context');
  context = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  watchPage(page, 'stale-offline-runtime');
  await page.addInitScript(seedOfflineStorageScript());
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });
  });

  const liveSource = fs.readFileSync(path.join(repoRoot, 'scripts', 'time-utils.js'), 'utf8');
  const staleSource = liveSource.replace(
    /registerShiftTrackerRuntimeModule\('time-utils',\s*'v\d+'\)/,
    "registerShiftTrackerRuntimeModule('time-utils', 'v000')"
  );
  if (staleSource === liveSource) throw new Error('Could not create stale offline runtime fixture');
  await page.route('**/scripts/v416/time-utils.js*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript; charset=utf-8',
    body: staleSource,
  }));

  setPhase('stale-offline-runtime:first-load');
  const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: startupTimeoutMs });
  if (!response || !response.ok()) {
    throw new Error(`GET ${baseUrl} for stale offline runtime failed with status ${response ? response.status() : 'none'}`);
  }

  setPhase('stale-offline-runtime:assert-cached-shifts');
  const state = await assertAppShellVisible(page, 'staleOfflineRuntime');
  if (!state.runtimeModules || state.runtimeModules['time-utils'] !== 'v000') {
    throw new Error(`Stale offline runtime fixture was not served: ${JSON.stringify(state)}`);
  }
  if (!state.runtimeIntegrity || state.runtimeIntegrity.status !== 'degraded-offline') {
    throw new Error(`Stale offline runtime did not enter degraded-offline mode: ${JSON.stringify(state)}`);
  }
  if (!state.hasSeededShift || !state.seededShiftRendered || state.allShiftsCount !== 1) {
    throw new Error(`Stale offline runtime did not restore cached shifts: ${JSON.stringify(state)}`);
  }
  await page.screenshot({ path: path.join(artifactsDir, 'stale-offline-runtime.png'), fullPage: true });
  await closeContextSafely(context, 'staleOfflineRuntime');
  context = null;
}

async function runBootFallbackCheck() {
  context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  watchPage(page, 'boot-fallback');
  await page.route('**/scripts/v416/auth.js*', (route) => route.abort());
  await page.route('**/scripts/v416/app.js*', (route) => route.abort());

  const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: startupTimeoutMs });
  if (!response || !response.ok()) throw new Error(`GET ${baseUrl} for fallback failed with status ${response ? response.status() : 'none'}`);

  await delay(8500);

  const state = await page.evaluate(() => {
    const fallback = document.getElementById('bootFallback');
    const inner = fallback && fallback.querySelector ? fallback.querySelector('.boot-fallback-inner') : null;
    const appShell = document.getElementById('appShell');
    const authGate = document.getElementById('authGate');
    const fallbackRect = fallback ? fallback.getBoundingClientRect() : null;
    const innerRect = inner ? inner.getBoundingClientRect() : null;
    const fallbackStyles = fallback ? getComputedStyle(fallback) : null;
    const innerStyles = inner ? getComputedStyle(inner) : null;
    const appShellStyles = appShell ? getComputedStyle(appShell) : null;
    const authGateStyles = authGate ? getComputedStyle(authGate) : null;
    return {
      title: document.title,
      fallbackText: fallback ? fallback.innerText : '',
      bootComplete: document.documentElement.classList.contains('boot-complete'),
      bootFallbackVisible: document.documentElement.classList.contains('boot-fallback-visible'),
      fallbackDisplay: fallbackStyles ? fallbackStyles.display : '',
      fallbackPointerEvents: fallbackStyles ? fallbackStyles.pointerEvents : '',
      innerPointerEvents: innerStyles ? innerStyles.pointerEvents : '',
      appShellVisible: appShell ? appShellStyles.display !== 'none' && appShellStyles.visibility !== 'hidden' : false,
      authGateVisible: authGate ? authGateStyles.display !== 'none' && authGateStyles.visibility !== 'hidden' : false,
      fallbackRect: fallbackRect ? {
        width: fallbackRect.width,
        height: fallbackRect.height,
      } : null,
      innerRect: innerRect ? {
        width: innerRect.width,
        height: innerRect.height,
      } : null,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      diagnostics: localStorage.getItem('shift_tracker_boot_diagnostics_v1') || '',
    };
  });
  report.checks.bootFallback = state;
  if (state.bootComplete && state.fallbackDisplay !== 'none') {
    throw new Error('Fallback is visible after a usable boot surface completed startup');
  }
  if (state.bootComplete && !state.appShellVisible && !state.authGateVisible) {
    throw new Error('Boot completed without a visible app shell or auth gate');
  }
  if (!state.bootComplete) {
    if (!state.bootFallbackVisible || state.fallbackDisplay === 'none') {
      throw new Error('Slow boot did not expose either a usable UI or nonblocking fallback diagnostics');
    }
    if (!/Блокнот работает локально/.test(state.fallbackText)) throw new Error('Fallback text is missing expected title');
    if (state.fallbackPointerEvents !== 'none') throw new Error('Fallback container can intercept app interactions');
    if (state.fallbackRect && state.viewport && state.fallbackRect.height > state.viewport.height * 0.35) {
      throw new Error('Fallback takes too much vertical space and may block the app');
    }
    if (state.innerPointerEvents !== 'auto') throw new Error('Fallback action surface is not interactive');
    if (!/fallback-visible/.test(state.diagnostics)) throw new Error('Fallback diagnostic was not recorded');
  }
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
  browser = await withTimeout(chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined
  }), 15000, 'chromium launch');
  setPhase('offline-reload-check');
  await withTimeout(runOfflineReloadCheck(), 45000, 'offline reload check');
  setPhase('stale-offline-runtime-check');
  await withTimeout(runStaleOfflineRuntimeCheck(), 30000, 'stale offline runtime check');
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
    if (failure.label === 'boot-fallback' && /\/scripts\/v416\/(auth|app)\.js/.test(failure.url)) return false;
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
