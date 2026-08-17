#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactsDir = path.join(repoRoot, 'artifacts', 'prod-cache-smoke');
const baseUrl = (process.env.PROD_URL || 'https://bloknot-mashinista-bot.ru').replace(/\/+$/, '');
const timeoutMs = Number(process.env.PROD_CACHE_SMOKE_TIMEOUT_MS || 15000);

fs.mkdirSync(artifactsDir, { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  baseUrl,
  checks: {},
};

function extractVersion(source, name) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*['"]([^'"]+)['"]`));
  if (!match) throw new Error(`Could not find ${name}`);
  return match[1];
}

function readExpectedVersion() {
  const constantsSource = fs.readFileSync(path.join(repoRoot, 'scripts', 'app-constants.js'), 'utf8');
  const swSource = fs.readFileSync(path.join(repoRoot, 'sw.js'), 'utf8');
  const shellVersion = extractVersion(constantsSource, 'SHELL_CACHE_VERSION');
  const swVersion = extractVersion(swSource, 'CACHE_VERSION');
  if (shellVersion !== swVersion) {
    throw new Error(`Local version mismatch: SHELL_CACHE_VERSION=${shellVersion}, CACHE_VERSION=${swVersion}`);
  }
  return shellVersion;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      url,
      text,
      headers: Object.fromEntries(response.headers.entries()),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHead(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal, cache: 'no-store' });
    return {
      ok: response.ok,
      status: response.status,
      url,
      headers: Object.fromEntries(response.headers.entries()),
    };
  } finally {
    clearTimeout(timer);
  }
}

function assertOk(result, label) {
  if (!result.ok) throw new Error(`${label} failed with status ${result.status} (${result.url})`);
}

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`${label} missing ${needle}`);
}

function assertHeaderIncludes(headers, name, needle, label) {
  const value = headers[name.toLowerCase()] || '';
  if (!value.toLowerCase().includes(needle.toLowerCase())) {
    throw new Error(`${label} expected ${name} to include ${needle}, got ${value || 'empty'}`);
  }
}

async function main() {
  const version = readExpectedVersion();
  report.checks.expectedVersion = version;

  const root = await fetchText(`${baseUrl}/`);
  assertOk(root, 'root');
  assertHeaderIncludes(root.headers, 'cache-control', 'no-store', 'root HTML');
  report.checks.root = {
    status: root.status,
    cacheControl: root.headers['cache-control'] || '',
    cfCacheStatus: root.headers['cf-cache-status'] || '',
  };

  for (const scriptPath of [
    `/scripts/${version}/app-constants.js`,
    `/scripts/${version}/auth.js`,
    `/scripts/${version}/time-utils.js`,
    `/scripts/${version}/app.js`,
    `/scripts/${version}/render.js`,
    `/scripts/${version}/app-init.js`,
    `/scripts/${version}/sw-register.js`,
    `/sw-bootstrap-${version}.js`,
  ]) {
    assertIncludes(root.text, scriptPath, 'root HTML');
  }
  assertIncludes(root.text, `/styles/${version}/56-profile.css`, 'root HTML');

  const profileStyle = await fetchText(`${baseUrl}/styles/${version}/56-profile.css`);
  assertOk(profileStyle, 'versioned profile stylesheet');
  assertIncludes(profileStyle.text, '.profile-summary-card', 'versioned profile stylesheet');
  assertIncludes(profileStyle.text, '.profile-summary-icon svg', 'versioned profile stylesheet');

  const constants = await fetchText(`${baseUrl}/scripts/${version}/app-constants.js`);
  assertOk(constants, 'versioned app constants');
  assertHeaderIncludes(constants.headers, 'cache-control', 'no-store', 'versioned app constants');
  assertIncludes(constants.text, `SHELL_CACHE_VERSION = '${version}'`, 'versioned app constants');

  const auth = await fetchText(`${baseUrl}/scripts/${version}/auth.js`);
  assertOk(auth, 'versioned auth runtime');
  assertHeaderIncludes(auth.headers, 'cache-control', 'no-store', 'versioned auth runtime');

  const app = await fetchText(`${baseUrl}/scripts/${version}/app.js`);
  assertOk(app, 'versioned app runtime');
  assertHeaderIncludes(app.headers, 'cache-control', 'no-store', 'versioned app runtime');

  const timeUtils = await fetchText(`${baseUrl}/scripts/${version}/time-utils.js`);
  assertOk(timeUtils, 'versioned time utils runtime');
  assertHeaderIncludes(timeUtils.headers, 'cache-control', 'no-store', 'versioned time utils runtime');
  assertIncludes(timeUtils.text, "ruNum(ft.consumptionKg) + ' кг'", 'versioned time utils runtime');
  if (timeUtils.text.includes("ruNum(ft.consumptionLiters) + ' л'")) {
    throw new Error('Versioned time utils runtime still renders shift-card consumption in liters');
  }

  const render = await fetchText(`${baseUrl}/scripts/${version}/render.js`);
  assertOk(render, 'versioned render runtime');
  assertHeaderIncludes(render.headers, 'cache-control', 'no-store', 'versioned render runtime');
  assertIncludes(render.text, "formatFuelKgSignedValue(totals.consumptionKg) + ' кг'", 'versioned render runtime');

  const appInit = await fetchText(`${baseUrl}/scripts/${version}/app-init.js`);
  assertOk(appInit, 'versioned app init');
  assertHeaderIncludes(appInit.headers, 'cache-control', 'no-store', 'versioned app init');
  assertIncludes(appInit.text, 'offline_mode_fixed_2026_06_v2', 'versioned app init');
  assertIncludes(appInit.text, 'Оффлайн режим работает', 'versioned app init');
  if (/Кэш обновился|v378/i.test(appInit.text)) {
    throw new Error('Versioned app init still contains technical offline announcement copy');
  }

  const sw = await fetchText(`${baseUrl}/sw.js?v=${version}`);
  assertOk(sw, 'versioned service worker');
  assertHeaderIncludes(sw.headers, 'cache-control', 'no-store', 'versioned service worker');
  assertIncludes(sw.text, `CACHE_VERSION = '${version}'`, 'versioned service worker');

  const swRegister = await fetchText(`${baseUrl}/scripts/${version}/sw-register.js`);
  assertOk(swRegister, 'versioned service worker register');
  assertHeaderIncludes(swRegister.headers, 'cache-control', 'no-store', 'versioned service worker register');
  assertIncludes(swRegister.text, 'checkLiveShellVersion', 'versioned service worker register');

  const bootstrapHead = await fetchHead(`${baseUrl}/sw-bootstrap-${version}.js`);
  assertOk(bootstrapHead, 'service worker bootstrap');
  assertHeaderIncludes(bootstrapHead.headers, 'cache-control', 'no-store', 'service worker bootstrap');

  report.checks.versionedAppConstants = {
    status: constants.status,
    cacheControl: constants.headers['cache-control'] || '',
    cfCacheStatus: constants.headers['cf-cache-status'] || '',
  };
  report.checks.versionedProfileStylesheet = {
    status: profileStyle.status,
    cacheControl: profileStyle.headers['cache-control'] || '',
    cfCacheStatus: profileStyle.headers['cf-cache-status'] || '',
  };
  report.checks.versionedAuthRuntime = {
    status: auth.status,
    cacheControl: auth.headers['cache-control'] || '',
    cfCacheStatus: auth.headers['cf-cache-status'] || '',
  };
  report.checks.versionedAppRuntime = {
    status: app.status,
    cacheControl: app.headers['cache-control'] || '',
    cfCacheStatus: app.headers['cf-cache-status'] || '',
  };
  report.checks.versionedShiftCardRuntime = {
    timeUtilsStatus: timeUtils.status,
    renderStatus: render.status,
    timeUtilsCacheControl: timeUtils.headers['cache-control'] || '',
    renderCacheControl: render.headers['cache-control'] || '',
    unit: 'кг',
  };
  report.checks.versionedServiceWorker = {
    status: sw.status,
    cacheControl: sw.headers['cache-control'] || '',
    cfCacheStatus: sw.headers['cf-cache-status'] || '',
  };
  report.checks.versionedAppInit = {
    status: appInit.status,
    cacheControl: appInit.headers['cache-control'] || '',
    cfCacheStatus: appInit.headers['cf-cache-status'] || '',
  };
  report.checks.versionedServiceWorkerRegister = {
    status: swRegister.status,
    cacheControl: swRegister.headers['cache-control'] || '',
    cfCacheStatus: swRegister.headers['cf-cache-status'] || '',
  };
  report.checks.serviceWorkerBootstrap = {
    status: bootstrapHead.status,
    cacheControl: bootstrapHead.headers['cache-control'] || '',
    cfCacheStatus: bootstrapHead.headers['cf-cache-status'] || '',
  };
}

let exitCode = 0;
try {
  await main();
} catch (error) {
  exitCode = 1;
  report.error = String(error && error.stack ? error.stack : error);
  console.error(report.error);
} finally {
  report.finishedAt = new Date().toISOString();
  report.ok = exitCode === 0;
  fs.writeFileSync(path.join(artifactsDir, 'report.json'), JSON.stringify(report, null, 2));
  process.exit(exitCode);
}
