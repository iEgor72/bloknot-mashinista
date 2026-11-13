import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { shell } = JSON.parse(await readFile(path.join(root, 'release.json'), 'utf8'));
const currentWorkerUrl = '/sw.js?v=' + shell;
const registerSource = await readFile(path.join(root, 'scripts', 'sw-register.js'), 'utf8');
const bootstrapSource = await readFile(path.join(root, 'sw-bootstrap-' + shell + '.js'), 'utf8');
const workerSource = await readFile(path.join(root, 'sw.js'), 'utf8');
const indexSource = await readFile(path.join(root, 'index.html'), 'utf8');

function createHarness(source, initialController) {
  const listeners = {};
  const storage = new Map();
  let reloads = 0;
  const never = new Promise(() => {});
  const serviceWorker = {
    controller: initialController,
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    register() {
      return never;
    }
  };
  const sessionStorage = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    }
  };
  const window = {
    __SHIFT_TRACKER_SW_URL: currentWorkerUrl,
    navigator: {},
    sessionStorage,
    location: {
      reload() {
        reloads += 1;
      }
    },
    addEventListener() {},
    setInterval() { return 1; },
    setTimeout() { return 1; }
  };
  const context = vm.createContext({
    console: { info() {}, warn() {} },
    Date,
    encodeURIComponent,
    fetch() { return never; },
    navigator: { serviceWorker },
    Promise,
    sessionStorage,
    setInterval: window.setInterval,
    setTimeout: window.setTimeout,
    window
  });
  vm.runInContext(source, context, { filename: 'service-worker-upgrade-runtime.js' });
  return {
    listeners,
    serviceWorker,
    get reloads() { return reloads; }
  };
}

const firstInstall = createHarness(bootstrapSource, null);
assert.equal(typeof firstInstall.listeners.controllerchange, 'function');
firstInstall.serviceWorker.controller = { scriptURL: currentWorkerUrl };
firstInstall.listeners.controllerchange();
assert.equal(firstInstall.reloads, 0, 'first service-worker takeover must not reload startup');

const upgrade = createHarness(bootstrapSource, { scriptURL: '/sw.js?v=v404' });
assert.equal(typeof upgrade.listeners.controllerchange, 'function');
upgrade.serviceWorker.controller = { scriptURL: currentWorkerUrl };
upgrade.listeners.controllerchange();
upgrade.listeners.controllerchange();
assert.equal(upgrade.reloads, 1, 'controller upgrade must reload only once');

const currentRegisterUpgrade = createHarness(registerSource, { scriptURL: '/sw.js?v=v404' });
currentRegisterUpgrade.serviceWorker.controller = { scriptURL: currentWorkerUrl };
currentRegisterUpgrade.listeners.controllerchange();
assert.equal(currentRegisterUpgrade.reloads, 1, 'current sw-register runtime must also reload once');

for (const file of ['poekhali-tracker', 'poekhali-station-names', 'poekhali-backup', 'shift-form', 'vu45-calculator', 'vu45-ui', 'render']) {
  assert.ok(workerSource.includes(`'/scripts/${shell}/${file}.js'`));
}
assert.ok(!workerSource.includes(`'/scripts/${shell}/partners.js'`));
assert.doesNotMatch(workerSource, /client\.navigate\s*\(/);
assert.match(workerSource, /COHERENT_RUNTIME_URLS/);
assert.match(workerSource, /currentVersionOnly:\s*true/);
assert.match(workerSource, /url\.pathname\.startsWith\('\/assets\/catalog\/'\)/);
assert.match(workerSource, /Refusing to activate an incomplete runtime cache/);
assert.ok(indexSource.includes(`<script src="/sw-bootstrap-${shell}.js" defer></script>`));

assert.ok(indexSource.includes(`href="/styles/${shell}/56-profile.css"`));
assert.ok(indexSource.includes(`href="/styles/${shell}/58-vu45.css"`));
assert.doesNotMatch(indexSource, new RegExp(`href="/styles/(?!${shell}/)`));
assert.ok(workerSource.includes(`'/styles/${shell}/56-profile.css'`));
assert.ok(indexSource.includes(`src="/scripts/${shell}/render.js"`));
assert.ok(indexSource.includes(`src="/scripts/${shell}/poekhali-station-names.js"`));
assert.doesNotMatch(indexSource, new RegExp(`src="/scripts/(?!${shell}/)`));

const designSource = await readFile(path.join(root, 'styles', '50-design-refresh.css'), 'utf8');
assert.doesNotMatch(designSource, new RegExp(`/styles/(?!${shell}/)`), 'CSS imports must use the current shell version');
console.log(`Service-worker v404→${shell} coherent runtime and versioned shell checks passed.`);
