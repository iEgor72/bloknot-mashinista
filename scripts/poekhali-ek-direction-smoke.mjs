import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.POEKHALI_EK_DIRECTION_SMOKE_PORT || 4321);
const baseUrl = `http://127.0.0.1:${port}`;
const artifactDir = path.join(root, 'artifacts', 'poekhali-ek-direction-smoke');
const reportPath = path.join(artifactDir, 'report.json');

const index = JSON.parse(await readFile(
  path.join(root, 'assets', 'tracker', 'sections', 'index.json'),
  'utf8'
));
const sectionById = new Map((index.sections || []).map((section) => [String(section.id || ''), section]));
const routes = (index.routes || []).filter((route) => String(route.id || '').startsWith('ek069-'));
if (routes.length !== 13) {
  throw new Error(`Expected 13 imported EK routes, found ${routes.length}`);
}

async function buildGpsFixture(route) {
  const variant = Array.isArray(route.variants) && route.variants.length ? route.variants[0] : route;
  const sectionIds = Array.isArray(variant.section_ids) ? variant.section_ids : [];
  for (const sectionId of sectionIds) {
    const descriptor = sectionById.get(String(sectionId || ''));
    if (!descriptor?.file) continue;
    const section = JSON.parse(await readFile(
      path.join(root, 'assets', 'tracker', 'sections', descriptor.file),
      'utf8'
    ));
    for (const geometryPath of section.geometry?.paths || []) {
      const points = Array.isArray(geometryPath.points) ? geometryPath.points : [];
      for (let startIndex = 0; startIndex < points.length - 1; startIndex += 1) {
        const start = points[startIndex];
        for (let endIndex = startIndex + 1; endIndex < points.length; endIndex += 1) {
          const end = points[endIndex];
          const delta = Number(end.ordinate) - Number(start.ordinate);
          if (!Number.isFinite(delta) || delta < 120) continue;
          return {
            sectionId: section.id,
            sector: Number(geometryPath.sector),
            start: { lat: Number(start.lat), lon: Number(start.lon), ordinate: Number(start.ordinate) },
            end: { lat: Number(end.lat), lon: Number(end.lon), ordinate: Number(end.ordinate) }
          };
        }
      }
    }
  }
  throw new Error(`No GPS pair with increasing ordinate found for ${route.id}`);
}

const fixtures = [];
for (const route of routes) {
  fixtures.push({
    id: String(route.id),
    title: String(route.name || route.title || route.id),
    from: String(route.from || ''),
    to: String(route.to || ''),
    gps: await buildGpsFixture(route)
  });
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

function gpsFix(point) {
  return {
    latitude: point.lat,
    longitude: point.lon,
    altitude: 40,
    accuracy: 5,
    speed: 20,
    heading: 90
  };
}

const report = {
  startedAt: new Date().toISOString(),
  baseUrl,
  routes: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: []
};

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined
  });

  for (const fixture of fixtures) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      serviceWorkers: 'block'
    });
    await context.addInitScript((mapId) => {
      localStorage.setItem('poekhali.mapId', mapId);
      localStorage.removeItem('poekhali.previewProjection');
      localStorage.removeItem('poekhali.lastProjection');
      const watchers = new Map();
      let nextWatchId = 1;
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          watchPosition(success, error, options) {
            const id = nextWatchId++;
            watchers.set(id, { success, error, options });
            return id;
          },
          clearWatch(id) {
            watchers.delete(id);
          },
          getCurrentPosition(success) {
            window.__poekhaliCurrentGpsSuccess = success;
          }
        }
      });
      window.__emitPoekhaliDirectionGps = (coords) => {
        const position = { timestamp: Date.now(), coords };
        for (const watcher of watchers.values()) watcher.success(position);
        if (!watchers.size && window.__poekhaliCurrentGpsSuccess) {
          window.__poekhaliCurrentGpsSuccess(position);
        }
      };
    }, fixture.id);

    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') report.consoleErrors.push(`${fixture.id}: ${message.text()}`);
    });
    page.on('pageerror', (error) => report.pageErrors.push(`${fixture.id}: ${error.message}`));
    page.on('requestfailed', (request) => {
      const url = request.url();
      if (!url.includes('/api/')) report.requestFailures.push(`${fixture.id}: ${url}`);
    });

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.waitForFunction(() => (
      typeof window.startPoekhaliTrackerMode === 'function' &&
      typeof window.getPoekhaliDirectionState === 'function' &&
      typeof window.setPoekhaliCoordinateDirection === 'function' &&
      typeof window.setActiveTab === 'function'
    ), null, { timeout: 15_000 });

    const shift = {
      id: `ek-direction-${fixture.id}`,
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
    await page.evaluate((testShift) => {
      window.allShifts = [testShift];
      window.setSelectedPoekhaliShiftId(testShift.id);
      window.setActiveTab('poekhali');
      window.startPoekhaliTrackerMode();
    }, shift);
    await page.waitForFunction((mapId) => (
      localStorage.getItem('poekhali.mapId') === mapId &&
      window.getPoekhaliDirectionState().mapId === mapId
    ), fixture.id, { timeout: 20_000 });

    await page.evaluate((coords) => window.__emitPoekhaliDirectionGps(coords), gpsFix(fixture.gps.start));
    await page.waitForTimeout(2700);
    await page.evaluate((coords) => window.__emitPoekhaliDirectionGps(coords), gpsFix(fixture.gps.end));
    await page.waitForFunction(() => {
      const state = window.getPoekhaliDirectionState();
      return state.directionSource === 'gps' && state.coordinateDirection === 1;
    }, null, { timeout: 8_000 });
    const increasing = await page.evaluate(() => window.getPoekhaliDirectionState());

    await page.waitForTimeout(2700);
    await page.evaluate((coords) => window.__emitPoekhaliDirectionGps(coords), gpsFix(fixture.gps.start));
    await page.waitForFunction(() => {
      const state = window.getPoekhaliDirectionState();
      return state.directionSource === 'gps' && state.coordinateDirection === -1;
    }, null, { timeout: 8_000 });
    const decreasing = await page.evaluate(() => window.getPoekhaliDirectionState());

    const manual = await page.evaluate(() => {
      const plus = window.setPoekhaliCoordinateDirection(1, { source: 'manual' });
      const minus = window.setPoekhaliCoordinateDirection(-1, { source: 'manual' });
      const auto = window.resetPoekhaliDirectionToAuto();
      return { plus, minus, auto };
    });
    if (
      increasing.parityEven !== false || decreasing.parityEven !== false ||
      increasing.parityBindingKnown !== false || decreasing.parityBindingKnown !== false ||
      manual.plus.coordinateDirection !== 1 || manual.plus.directionSource !== 'manual' ||
      manual.minus.coordinateDirection !== -1 || manual.minus.directionSource !== 'manual' ||
      manual.auto.directionSource !== 'auto'
    ) {
      throw new Error(`Direction/parity separation failed for ${fixture.id}: ${JSON.stringify({ increasing, decreasing, manual })}`);
    }

    let picker = null;
    if (fixture === fixtures[0]) {
      await page.evaluate(() => document.getElementById('btnPoekhaliDirection')?.click());
      await page.waitForFunction(() => (
        document.getElementById('poekhaliArmSheetTitle')?.textContent === 'Направление движения'
      ), null, { timeout: 5_000 });
      picker = await page.evaluate(() => ({
        title: document.getElementById('poekhaliArmSheetTitle')?.textContent || '',
        options: Array.from(document.querySelectorAll('.poekhali-direction-option')).map((element) => element.textContent.trim())
      }));
      if (picker.options.length !== 3 || !picker.options[0].includes('автоматически')) {
        throw new Error(`Direction picker is incomplete: ${JSON.stringify(picker)}`);
      }
    }

    report.routes.push({
      id: fixture.id,
      sectionId: fixture.gps.sectionId,
      sector: fixture.gps.sector,
      increasing,
      decreasing,
      manual,
      picker
    });
    await page.evaluate(() => window.stopPoekhaliTrackerMode());
    await context.close();
    console.log(`EK direction OK: ${fixture.id}`);
  }

  if (report.consoleErrors.length || report.pageErrors.length || report.requestFailures.length) {
    throw new Error(`Browser errors: ${JSON.stringify({
      consoleErrors: report.consoleErrors,
      pageErrors: report.pageErrors,
      requestFailures: report.requestFailures
    })}`);
  }
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.error = error?.stack || String(error);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  report.serverLog = serverLog;
  await mkdir(artifactDir, { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  if (browser) await browser.close().catch(() => {});
  server.kill();
  if (report.ok) {
    console.log(`Imported EK direction smoke passed: ${report.routes.length}/${fixtures.length} routes`);
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}
