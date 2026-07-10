import { spawn } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.POEKHALI_SMOKE_PORT || 4319);
const baseUrl = `http://127.0.0.1:${port}`;
const artifactDir = path.join(root, 'artifacts', 'poekhali-json-smoke');
const screenshotPath = path.join(artifactDir, 'postyshevo-novyi-urgal.png');
const postyshevoKomsomolskScreenshotPath = path.join(artifactDir, 'postyshevo-komsomolsk.png');
const reportPath = path.join(artifactDir, 'report.json');
const progressPath = path.join(artifactDir, 'progress.log');
const mapId = 'dvost-postyshevo-novyi-urgal-odd';
const preview = {
  mapId,
  lineCoordinate: 3307500,
  sector: 18,
  even: false,
  wayNumber: 1,
  savedAt: Date.now()
};
const shift = {
  id: 'poekhali-json-smoke-shift',
  route_kind: 'work',
  route_from: '',
  route_to: '',
  train_number: '2101',
  train_length: '71',
  train_axles: '284',
  train_weight: '6300',
  start_msk: new Date(Date.now() - 60_000).toISOString(),
  end_msk: new Date(Date.now() + 3_600_000).toISOString(),
  created_at: new Date().toISOString()
};
const sectionAssets = [
  '/assets/tracker/sections/index.json',
  '/assets/tracker/sections/dvost-volochaevka-ii-dzemgi.json',
  '/assets/tracker/sections/dvost-postyshevo-komsomolsk.json',
  '/assets/tracker/sections/dvost-postyshevo-novyi-urgal-odd.json',
  '/assets/tracker/sections/dvost-vysokogornaya-oune-via-sollu.json',
  '/assets/tracker/sections/dvost-vysokogornaya-oune-via-muli.json',
  '/assets/tracker/sections/dvost-oune-pivan.json',
  '/assets/tracker/sections/dvost-pivan-novyi-mir.json'
];

const report = {
  startedAt: new Date().toISOString(),
  baseUrl,
  mapId,
  checks: {},
  consoleErrors: [],
  pageErrors: [],
  requestFailures: []
};

const postyshevoKomsomolskSection = JSON.parse(await readFile(
  path.join(root, 'assets', 'tracker', 'sections', 'dvost-postyshevo-komsomolsk.json'),
  'utf8'
));
const correctedProfileAnchors = [
  { startM: 3718200, grade: 1.0 },
  { startM: 3810900, grade: -2.3 }
].map((expected) => {
  const element = postyshevoKomsomolskSection.elements.find((item) => Number(item.start_m) === expected.startM);
  const actualGrade = element ? Number(element.grad_permille) : NaN;
  if (!element || Math.abs(actualGrade - expected.grade) > 0.0001) {
    throw new Error(`PDF-corrected profile anchor ${expected.startM} expected ${expected.grade}‰, got ${actualGrade}`);
  }
  return { startM: expected.startM, grade: actualGrade };
});
report.checks.pdfCorrectedProfileAnchors = correctedProfileAnchors;

await mkdir(artifactDir, { recursive: true });
await writeFile(progressPath, '', 'utf8');
async function mark(message) {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  await appendFile(progressPath, line + '\n', 'utf8');
}
const server = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += String(chunk); });
server.stderr.on('data', (chunk) => { serverLog += String(chunk); });

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { redirect: 'manual' });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Server did not become ready at ${baseUrl}`);
}

let browser;
try {
  await waitForServer();
  await mark('server ready');
  browser = await chromium.launch({ headless: true });

  const defaultContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const defaultPage = await defaultContext.newPage();
  await defaultPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await defaultPage.waitForFunction(() => typeof window.startPoekhaliTrackerMode === 'function' && typeof window.setActiveTab === 'function', null, { timeout: 15_000 });
  await defaultPage.evaluate((testShift) => {
    window.allShifts = [testShift];
    if (typeof window.setSelectedPoekhaliShiftId === 'function') {
      window.setSelectedPoekhaliShiftId(testShift.id);
    }
    window.setActiveTab('poekhali');
    window.startPoekhaliTrackerMode();
  }, shift);
  await defaultPage.waitForFunction(() => {
    const mapButton = document.getElementById('btnPoekhaliMap');
    return mapButton && String(mapButton.title || '').includes('Комсомольск ТЧЭ-9');
  }, null, { timeout: 15_000 });
  const defaultSelection = await defaultPage.evaluate(() => ({
    storedMapId: localStorage.getItem('poekhali.mapId') || '',
    mapTitle: document.getElementById('btnPoekhaliMap')?.title || ''
  }));
  if (defaultSelection.storedMapId && defaultSelection.storedMapId !== 'komsomol-sk-tche-9') {
    throw new Error(`Draft JSON map was selected automatically: ${defaultSelection.storedMapId}`);
  }
  report.checks.draftSafety = {
    automaticMap: 'komsomol-sk-tche-9',
    draftMapsRequireManualSelection: true
  };
  await defaultPage.evaluate(() => {
    if (typeof window.stopPoekhaliTrackerMode === 'function') window.stopPoekhaliTrackerMode();
  });
  await defaultContext.close();
  await mark('draft maps excluded from automatic selection');

  const secondMapId = 'dvost-postyshevo-komsomolsk';
  const secondPreview = {
    mapId: secondMapId,
    // Section JSON stores official chainage and applies the legacy geometry
    // coordinate_offset_m (-1000) at runtime. Use a point inside (not exactly
    // on the shared boundary of) the official 3718200–3718700 +1.0‰ element.
    lineCoordinate: 3717250,
    sector: 18,
    even: true,
    wayNumber: 1,
    savedAt: Date.now()
  };
  const secondShift = {
    ...shift,
    id: 'poekhali-json-smoke-postyshevo-komsomolsk',
    train_number: '2102'
  };
  const secondContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await secondContext.addInitScript(({ storedMapId, storedPreview }) => {
    localStorage.setItem('poekhali.mapId', storedMapId);
    localStorage.setItem('poekhali.previewProjection', JSON.stringify(storedPreview));
  }, { storedMapId: secondMapId, storedPreview: secondPreview });
  const secondPage = await secondContext.newPage();
  await secondPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await mark('Postyshevo-Komsomolsk page loaded');
  await secondPage.waitForFunction(() => typeof window.startPoekhaliTrackerMode === 'function' && typeof window.setActiveTab === 'function', null, { timeout: 15_000 });
  await mark('Postyshevo-Komsomolsk tracker API ready');
  await Promise.race([
    secondPage.evaluate((testShift) => {
      window.allShifts = [testShift];
      if (typeof window.setSelectedPoekhaliShiftId === 'function') {
        window.setSelectedPoekhaliShiftId(testShift.id);
      }
      window.setActiveTab('poekhali');
      window.startPoekhaliTrackerMode();
    }, secondShift),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Postyshevo-Komsomolsk tracker start timeout')), 15_000))
  ]);
  await mark('Postyshevo-Komsomolsk tracker started');
  await secondPage.waitForFunction((expected) => {
    return window.poekhaliHud && window.poekhaliHud.hasProjection &&
      window.poekhaliHud.shift && window.poekhaliHud.shift.compositionType === 'train' &&
      localStorage.getItem('poekhali.mapId') === expected.mapId;
  }, { mapId: secondMapId }, { timeout: 20_000 });
  const secondState = await secondPage.evaluate(() => ({
    mapId: localStorage.getItem('poekhali.mapId') || '',
    mapTitle: document.getElementById('btnPoekhaliMap')?.title || '',
    headPos: String(window.poekhaliHud?.headPos || ''),
    gradeText: String(window.poekhaliHud?.gradeText || ''),
    compositionType: String(window.poekhaliHud?.shift?.compositionType || '')
  }));
  if (!secondState.mapTitle.includes('Постышево')) {
    throw new Error(`Unexpected Postyshevo-Komsomolsk map title: ${JSON.stringify(secondState)}`);
  }
  if (!secondState.headPos.includes('3718 км 2 пк')) {
    throw new Error(`Unexpected Postyshevo-Komsomolsk preview coordinate: ${JSON.stringify(secondState)}`);
  }
  if (!secondState.gradeText.includes('+1.0')) {
    throw new Error(`PDF-corrected +1.0‰ grade is not active: ${JSON.stringify(secondState)}`);
  }
  await secondPage.screenshot({ path: postyshevoKomsomolskScreenshotPath });
  secondState.screenshot = path.relative(root, postyshevoKomsomolskScreenshotPath);
  report.checks.postyshevoKomsomolsk = secondState;
  await secondPage.evaluate(() => {
    if (typeof window.stopPoekhaliTrackerMode === 'function') window.stopPoekhaliTrackerMode();
  });
  await secondContext.close();
  await mark('Postyshevo-Komsomolsk PDF sign correction ready');

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await context.addInitScript(({ storedMapId, storedPreview }) => {
    localStorage.setItem('poekhali.mapId', storedMapId);
    localStorage.setItem('poekhali.previewProjection', JSON.stringify(storedPreview));
    window.__poekhaliCanvasRotations = [];
    const originalRotate = CanvasRenderingContext2D.prototype.rotate;
    CanvasRenderingContext2D.prototype.rotate = function trackedRotate(angle) {
      if (this.canvas && this.canvas.id === 'poekhaliCanvas' && Number.isFinite(Number(angle))) {
        window.__poekhaliCanvasRotations.push(Number(angle));
        if (window.__poekhaliCanvasRotations.length > 4000) window.__poekhaliCanvasRotations.shift();
      }
      return originalRotate.call(this, angle);
    };
  }, { storedMapId: mapId, storedPreview: preview });

  const page = await context.newPage();
  let resolveCanvasCapture;
  let rejectCanvasCapture;
  const canvasCapture = new Promise((resolve, reject) => {
    resolveCanvasCapture = resolve;
    rejectCanvasCapture = reject;
  });
  let resolveCacheReport;
  let rejectCacheReport;
  const cacheReport = new Promise((resolve, reject) => {
    resolveCacheReport = resolve;
    rejectCacheReport = reject;
  });
  await page.route('**/__poekhali_canvas_capture__', async (route) => {
    try {
      const dataUrl = route.request().postData() || '';
      if (!dataUrl.startsWith('data:image/png;base64,')) throw new Error('Invalid canvas capture payload');
      await writeFile(screenshotPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
      resolveCanvasCapture();
      await route.fulfill({ status: 204, body: '' });
    } catch (error) {
      rejectCanvasCapture(error);
      await route.fulfill({ status: 500, body: 'capture failed' });
    }
  });
  await page.route('**/__poekhali_cache_report__', async (route) => {
    try {
      const payload = JSON.parse(route.request().postData() || '{}');
      resolveCacheReport(payload);
      await route.fulfill({ status: 204, body: '' });
    } catch (error) {
      rejectCacheReport(error);
      await route.fulfill({ status: 500, body: 'cache report failed' });
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => report.pageErrors.push(String(error && error.stack || error)));
  page.on('requestfailed', (request) => {
    const error = request.failure() && request.failure().errorText;
    if (error === 'net::ERR_ABORTED') return;
    report.requestFailures.push({ url: request.url(), error });
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await mark('page loaded');
  await page.waitForFunction(() => typeof window.startPoekhaliTrackerMode === 'function' && typeof window.setActiveTab === 'function', null, { timeout: 15_000 });
  await mark('tracker API ready');
  await Promise.race([page.evaluate((testShift) => {
    window.allShifts = [testShift];
    window.__poekhaliCanvasRotations = [];
    if (typeof window.setSelectedPoekhaliShiftId === 'function') {
      window.setSelectedPoekhaliShiftId(testShift.id);
    }
    window.setActiveTab('poekhali');
    window.startPoekhaliTrackerMode();
  }, shift), new Promise((_, reject) => setTimeout(() => reject(new Error('tracker start timeout')), 15_000))]);
  await mark('tracker started');

  await page.waitForFunction(
    (expected) => {
      const mapButton = document.getElementById('btnPoekhaliMap');
      const distinctAngles = new Set((window.__poekhaliCanvasRotations || [])
        .filter((value) => Number.isFinite(value) && Math.abs(value) > 0.0005)
        .map((value) => Number(value.toFixed(4)))).size;
      const ready = window.poekhaliHud && window.poekhaliHud.hasProjection &&
        window.poekhaliHud.shift && window.poekhaliHud.shift.compositionType === 'train' &&
        String(window.poekhaliHud.headPos || '').includes('3308 км 5 пк') &&
        distinctAngles >= 2 &&
        mapButton && String(mapButton.title || '').includes('Постышево') &&
        localStorage.getItem('poekhali.mapId') === expected.mapId;
      if (ready && !window.__poekhaliCanvasCaptureSent) {
        window.__poekhaliCanvasCaptureSent = true;
        const canvas = document.getElementById('poekhaliCanvas');
        if (canvas) {
          fetch('/__poekhali_canvas_capture__', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: canvas.toDataURL('image/png')
          }).catch(() => {});
        }
      }
      if (ready && !window.__poekhaliCacheCheckStarted) {
        window.__poekhaliCacheCheckStarted = true;
        (async () => {
          const registration = await navigator.serviceWorker.ready;
          if (registration.active) registration.active.postMessage({ type: 'WARMUP_CACHE' });
          const controlDeadline = Date.now() + 5_000;
          while (!navigator.serviceWorker.controller && Date.now() < controlDeadline) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          const controlled = Boolean(navigator.serviceWorker.controller);
          let networkFresh = false;
          const probeAsset = expected.assets.find((asset) => asset.includes('postyshevo-novyi-urgal'));
          const shellCacheName = (await caches.keys()).find((name) => name.startsWith('shift-tracker-shell-'));
          if (controlled && shellCacheName && probeAsset) {
            const shellCache = await caches.open(shellCacheName);
            await shellCache.put(probeAsset, new Response(JSON.stringify({ stale: true }), {
              headers: { 'Content-Type': 'application/json' }
            }));
            const probeResponse = await fetch(probeAsset, { cache: 'no-store' });
            const probeData = await probeResponse.json();
            networkFresh = probeData && probeData.id === expected.mapId;
          }
          const deadline = Date.now() + 15_000;
          let cached = 0;
          while (Date.now() < deadline) {
            const cacheNames = await caches.keys();
            cached = 0;
            for (const asset of expected.assets) {
              let found = false;
              for (const cacheName of cacheNames) {
                if (await (await caches.open(cacheName)).match(asset)) {
                  found = true;
                  break;
                }
              }
              if (found) cached += 1;
            }
            if (cached === expected.assets.length) break;
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
          fetch('/__poekhali_cache_report__', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cached, total: expected.assets.length, controlled, networkFresh })
          }).catch(() => {});
        })().catch(() => {});
      }
      if (ready && typeof window.stopPoekhaliTrackerMode === 'function') window.stopPoekhaliTrackerMode();
      return ready;
    },
    { mapId, assets: sectionAssets },
    { timeout: 20_000 }
  );
  await mark('JSON route and preview ready');

  report.checks.runtime = {
    mapTitle: 'Постышево — Новый Ургал (нечётное)',
    headPos: '3308 км 5 пк',
    hasProjection: true,
    compositionType: 'train',
    distinctTrainAngles: 'at least 2'
  };

  await mark('waiting for canvas capture');
  await Promise.race([
    canvasCapture,
    new Promise((_, reject) => setTimeout(() => reject(new Error('canvas capture timeout')), 5_000))
  ]);
  report.checks.screenshot = path.relative(root, screenshotPath);
  await mark('canvas captured');

  report.checks.offlineCache = await Promise.race([
    cacheReport,
    new Promise((_, reject) => setTimeout(() => reject(new Error('offline cache report timeout')), 20_000))
  ]);
  if (report.checks.offlineCache.cached !== sectionAssets.length) {
    throw new Error(`Only ${report.checks.offlineCache.cached}/${sectionAssets.length} section assets were cached`);
  }
  if (!report.checks.offlineCache.controlled || !report.checks.offlineCache.networkFresh) {
    throw new Error('Section JSON did not use a controlled network-first refresh');
  }
  await mark('offline section cache ready');

  report.ok = report.consoleErrors.length === 0 && report.pageErrors.length === 0;
  if (!report.ok) throw new Error('Browser errors were captured');
  await context.close();
} catch (error) {
  report.ok = false;
  report.error = String(error && error.stack || error);
  throw error;
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill();
  report.finishedAt = new Date().toISOString();
  report.serverLog = serverLog;
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
}

console.log(JSON.stringify(report, null, 2));
