import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registerSource = await readFile(path.join(root, 'scripts', 'sw-register.js'), 'utf8');
const bootstrapSource = await readFile(path.join(root, 'sw-bootstrap-v386.js'), 'utf8');
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
    __SHIFT_TRACKER_SW_URL: '/sw.js?v=v386',
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
firstInstall.serviceWorker.controller = { scriptURL: '/sw.js?v=v386' };
firstInstall.listeners.controllerchange();
assert.equal(firstInstall.reloads, 0, 'first service-worker takeover must not reload startup');

const upgrade = createHarness(bootstrapSource, { scriptURL: '/sw.js?v=v385' });
assert.equal(typeof upgrade.listeners.controllerchange, 'function');
upgrade.serviceWorker.controller = { scriptURL: '/sw.js?v=v386' };
upgrade.listeners.controllerchange();
upgrade.listeners.controllerchange();
assert.equal(upgrade.reloads, 1, 'controller upgrade must reload only once');

const currentRegisterUpgrade = createHarness(registerSource, { scriptURL: '/sw.js?v=v385' });
currentRegisterUpgrade.serviceWorker.controller = { scriptURL: '/sw.js?v=v386' };
currentRegisterUpgrade.listeners.controllerchange();
assert.equal(currentRegisterUpgrade.reloads, 1, 'current sw-register runtime must also reload once');

assert.match(workerSource, /'\/scripts\/poekhali-tracker\.js'/);
assert.match(workerSource, /'\/scripts\/poekhali-backup\.js'/);
assert.match(workerSource, /'\/scripts\/shift-form\.js'/);
assert.doesNotMatch(workerSource, /client\.navigate\s*\(/);
assert.match(workerSource, /COHERENT_RUNTIME_URLS/);
assert.match(workerSource, /currentVersionOnly:\s*true/);
assert.match(workerSource, /Refusing to activate an incomplete runtime cache/);
assert.match(indexSource, /<script src="\/sw-bootstrap-v386\.js" defer><\/script>/);

console.log('Service-worker v385→v386 coherent-runtime upgrade smoke passed.');
