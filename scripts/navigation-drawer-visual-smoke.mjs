#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactsDir = path.join(repoRoot, 'artifacts', 'navigation-drawer-qa');
const port = Number(process.env.NAV_QA_PORT || 4321);
const baseUrl = `http://127.0.0.1:${port}`;
const sourceImage = process.env.NAV_QA_SOURCE ||
  'C:\\Users\\shkur\\.codex\\generated_images\\01a04663-4301-7811-9fc6-76f7dc79ea71\\exec-cf59c0f1-17cf-4a3d-b731-7d62fae4f108.png';

fs.mkdirSync(artifactsDir, { recursive: true });

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    try {
      const response = await fetch(baseUrl, { redirect: 'manual' });
      if (response.status < 500) return;
    } catch {}
    await delay(150);
  }
  throw new Error('Local QA server did not start');
}

let server;
let browser;
try {
  server = spawn(process.execPath, ['server.js'], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
  });
  await waitForServer();

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const apiPaths = [];

  await page.addInitScript(() => {
    const userId = 'dev-local';
    const now = new Date().toISOString();
    localStorage.setItem('shift_tracker_session_token', 'navigation-qa-token');
    localStorage.setItem('shift_tracker_cached_user_v1', JSON.stringify({
      id: userId,
      first_name: 'Егор',
      display_name: 'Егор',
      username: 'navigation-qa',
    }));
    localStorage.setItem('shift_tracker_profile_v1', JSON.stringify({
      name: 'Егор',
      depot: 'ТЧЭ-9 · Комсомольск-на-Амуре',
      depotId: 'rzd:dvost:tche-9:komsomolsk-na-amure',
      railwayId: 'dvost',
    }));
    localStorage.setItem(`shift_tracker_shifts_cache_v1_${userId}`, JSON.stringify({
      version: 1,
      userId,
      updatedAt: now,
      shifts: [{
        id: 'qa-shift',
        start_msk: '2026-08-18T08:00',
        end_msk: '2026-08-18T20:00',
        route: 'Комсомольск-Сортировочный → Высокогорная',
        night_minutes: 120,
        holiday_minutes: 0,
      }],
    }));
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    apiPaths.push(url.pathname);
    let body = { ok: true };
    if (url.pathname === '/api/auth') {
      body = { user: { id: '999', first_name: 'Егор', display_name: 'Егор' }, sessionToken: 'navigation-qa-token' };
    } else if (url.pathname === '/api/shifts') {
      body = { sid: '999', shifts: [
        { id: 'qa-1', start_msk: '2026-08-04T08:00', end_msk: '2026-08-04T20:00', route: 'Комсомольск-Сортировочный → Высокогорная' },
        { id: 'qa-2', start_msk: '2026-08-11T20:00', end_msk: '2026-08-12T08:00', route: 'Высокогорная → Комсомольск-Сортировочный' },
        { id: 'qa-3', start_msk: '2026-08-18T08:00', end_msk: '2026-08-18T20:00', route: 'Комсомольск-Сортировочный → Волочаевка' },
        { id: 'qa-4', start_msk: '2026-08-25T20:00', end_msk: '2026-08-26T08:00', route: 'Волочаевка → Комсомольск-Сортировочный' },
      ] };
    } else if (url.pathname === '/api/salary-params') {
      body = { sid: '999', salaryParams: {
        tariffRate: 680,
        nightPercent: 40,
        classPercent: 5,
        districtPercent: 30,
        northPercent: 50,
        localPercent: 20,
      } };
    } else if (url.pathname === '/api/stats') {
      body = { totalUsers: 1248, onlineUsers: 16 };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('appShell') && !document.getElementById('appShell').classList.contains('hidden'));
  await page.waitForTimeout(500);
  await page.click('#btnOpenNavigationDrawer');
  await page.waitForFunction(() => {
    const drawer = document.getElementById('navigationDrawer');
    return drawer && Math.abs(drawer.getBoundingClientRect().left) < 1;
  });
  await page.evaluate(() => {
    const openGroups = new Set(['shifts', 'salary', 'profile', 'about']);
    document.querySelectorAll('[data-nav-group]').forEach((group) => {
      group.open = openGroups.has(group.dataset.navGroup);
    });
    document.getElementById('navigationDrawerSearch')?.blur();
  });
  await page.screenshot({ path: path.join(artifactsDir, 'drawer-mobile.png') });

  const drawerContract = await page.evaluate(() => ({
    bottomNavRemoved: !document.querySelector('.bottom-nav'),
    groups: [...document.querySelectorAll('[data-nav-group]')].map((group) => group.dataset.navGroup),
    addShiftVisible: !!document.querySelector('[data-nav-action="add-shift"]'),
    addDocumentVisible: !!document.getElementById('btnDocsContribute'),
    addMapVisible: !!document.querySelector('[data-nav-action="add-map"]'),
    menuExpanded: document.getElementById('btnOpenNavigationDrawer')?.getAttribute('aria-expanded'),
  }));
  if (!drawerContract.bottomNavRemoved || drawerContract.menuExpanded !== 'true' ||
      !drawerContract.addShiftVisible || !drawerContract.addDocumentVisible || !drawerContract.addMapVisible) {
    throw new Error(`Drawer contract failed: ${JSON.stringify(drawerContract)}`);
  }

  await page.fill('#navigationDrawerSearch', 'ву-45');
  const searchContract = await page.evaluate(() => ({
    vu45Visible: document.querySelector('[data-nav-action="vu45"]')?.getAttribute('data-search-hidden') !== 'true',
    shiftsHidden: document.querySelector('[data-nav-group="shifts"]')?.getAttribute('data-search-hidden') === 'true',
  }));
  if (!searchContract.vu45Visible || !searchContract.shiftsHidden) {
    throw new Error(`Drawer search contract failed: ${JSON.stringify(searchContract)}`);
  }
  await page.fill('#navigationDrawerSearch', 'несуществующий раздел');
  searchContract.emptyVisible = await page.evaluate(() => !document.getElementById('navigationDrawerEmpty')?.hidden);
  if (!searchContract.emptyVisible) throw new Error(`Drawer empty search state failed: ${JSON.stringify(searchContract)}`);
  await page.fill('#navigationDrawerSearch', '');
  searchContract.layoutRestored = await page.evaluate(() => {
    const expected = new Set(['shifts', 'salary', 'profile', 'about']);
    return [...document.querySelectorAll('[data-nav-group]')].every((group) => group.open === expected.has(group.dataset.navGroup));
  });
  if (!searchContract.layoutRestored) throw new Error(`Drawer search layout restore failed: ${JSON.stringify(searchContract)}`);

  await page.click('[data-nav-action="salary"][data-salary-anchor="top"]');
  await page.waitForFunction(() => {
    const drawer = document.getElementById('navigationDrawer');
    return !document.body.classList.contains('is-navigation-drawer-open') &&
      drawer && drawer.getBoundingClientRect().right <= 1;
  });
  await page.waitForFunction(() => document.querySelector('.tab-panel[data-tab="salary"]')?.classList.contains('active'));
  await page.waitForTimeout(380);
  await page.screenshot({ path: path.join(artifactsDir, 'salary-mobile.png'), fullPage: true });
  const salaryContract = await page.evaluate(() => ({
    year: typeof currentYear === 'number' ? currentYear : null,
    month: typeof currentMonth === 'number' ? currentMonth : null,
    shiftCount: (() => {
      const bounds = getMonthBounds(currentYear, currentMonth);
      return buildMonthCalculationShifts(currentYear, currentMonth, bounds).actualShifts.length;
    })(),
    displayedShiftCount: document.getElementById('salaryPageShiftCount')?.textContent || '',
    net: document.getElementById('salaryPageNet')?.textContent || '',
  }));
  await page.click('#btnOpenNavigationDrawer');
  await page.waitForFunction(() => Math.abs(document.getElementById('navigationDrawer').getBoundingClientRect().left) < 1);
  salaryContract.navigationActive = await page.evaluate(() => ({
    child: document.querySelector('[data-nav-action="salary"][data-salary-anchor="top"]')?.getAttribute('aria-current') === 'page',
    group: document.querySelector('[data-nav-group="salary"]')?.dataset.active === 'true',
  }));
  if (!salaryContract.navigationActive.child || !salaryContract.navigationActive.group) {
    throw new Error(`Salary navigation state failed: ${JSON.stringify(salaryContract)}`);
  }
  await page.evaluate(() => window.NavigationDrawer.close({ restoreFocus: false }));
  await page.waitForFunction(() => document.getElementById('navigationDrawer').getBoundingClientRect().right <= 1);
  const fabHit = await page.evaluate(() => {
    const element = document.getElementById('fab-add');
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const top = document.elementFromPoint(x, y);
    return {
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      position: style.position,
      zIndex: style.zIndex,
      opacity: style.opacity,
      pointerEvents: style.pointerEvents,
      topId: top?.id || '',
      topClass: typeof top?.className === 'string' ? top.className : '',
      hit: top === element || element.contains(top),
    };
  });
  if (!fabHit.hit) throw new Error(`Global add button is not clickable: ${JSON.stringify(fabHit)}`);
  await page.evaluate(() => document.getElementById('fab-add').click());
  await page.waitForFunction(() => document.querySelector('.tab-panel[data-tab="add"]')?.classList.contains('active'));
  const addShiftContract = await page.evaluate(() => ({
    active: document.querySelector('.tab-panel[data-tab="add"]')?.classList.contains('active') || false,
    fabHidden: getComputedStyle(document.getElementById('fab-add')).pointerEvents === 'none',
  }));
  if (!addShiftContract.active || !addShiftContract.fabHidden) {
    throw new Error(`Add-shift contract failed: ${JSON.stringify(addShiftContract)}`);
  }

  if (fs.existsSync(sourceImage)) {
    const sourceData = `data:image/png;base64,${fs.readFileSync(sourceImage).toString('base64')}`;
    const implementationPath = path.join(artifactsDir, 'drawer-mobile.png');
    const implementationData = `data:image/png;base64,${fs.readFileSync(implementationPath).toString('base64')}`;
    const comparison = await context.newPage();
    await comparison.setViewportSize({ width: 816, height: 900 });
    await comparison.setContent(`<!doctype html><meta charset="utf-8"><style>
      *{box-sizing:border-box}body{margin:0;background:#050a0f;color:#dbe7ef;font:600 14px system-ui}
      main{display:grid;grid-template-columns:390px 390px;gap:16px;padding:16px}
      figure{margin:0}figcaption{height:28px;text-align:center}img{display:block;width:390px;height:844px;object-fit:cover;object-position:top}
    </style><main><figure><figcaption>Целевой вариант</figcaption><img src="${sourceData}"></figure>
    <figure><figcaption>Реализация</figcaption><img src="${implementationData}"></figure></main>`);
    await comparison.screenshot({ path: path.join(artifactsDir, 'drawer-comparison.png') });
    await comparison.close();
  }

  fs.writeFileSync(path.join(artifactsDir, 'contract.json'), JSON.stringify({ drawerContract, searchContract, salaryContract, addShiftContract }, null, 2));
  console.log(JSON.stringify({ ok: true, artifactsDir, drawerContract, searchContract, salaryContract, addShiftContract, apiPaths }));
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) server.kill('SIGTERM');
}
