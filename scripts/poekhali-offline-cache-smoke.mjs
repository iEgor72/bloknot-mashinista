import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const origin = 'https://offline.test';
const route = '/assets/tracker/sections/dvost-postyshevo-komsomolsk.json';
const body = readFileSync(new URL('../assets/tracker/sections/dvost-postyshevo-komsomolsk.json', import.meta.url), 'utf8');
const workerSource = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const utilsSource = readFileSync(new URL('./poekhali-utils.js', import.meta.url), 'utf8');
function harness() {
  const stores = new Map();
  const key = x => new URL(typeof x === 'string' ? x : x.url, origin).pathname;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async match(x) { return store.get(key(x))?.clone(); },
        async put(x, r) { store.set(key(x), r.clone()); },
        async delete(x) { return store.delete(key(x)); },
        async keys() { return [...store.keys()].map(x => new Request(origin + x)); }
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); }
  };
  const env = { console, URL, Response, Request, Promise, setTimeout, clearTimeout, caches,
    self: { location: { origin }, addEventListener() {} },
    window: { location: { origin, href: origin + '/' }, caches },
    fetch: async () => new Response(body) };
  const context = vm.createContext(env);
  vm.runInContext(workerSource, context);
  vm.runInContext(utilsSource, context);
  return { env, context, caches, utils: env.window.PoekhaliUtils };
}
async function immediate(promise) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('cached route waited for network')), 200); })]); }
  finally { clearTimeout(timer); }
}
test('first visit persists real route; new page opens it with no network or a hanging network', async () => {
  const h = harness();
  assert.equal(await h.utils.fetchText(route), body);
  for (const fetch of [async () => { throw Error('offline'); }, () => new Promise(() => {})]) {
    h.env.fetch = fetch;
    vm.runInContext(utilsSource, h.context); // new page/module state, same disk cache
    assert.equal(await immediate(h.env.window.PoekhaliUtils.fetchText(route)), body);
  }
});
test('worker serves cached route for offline, HTTP errors, invalid JSON and hanging requests', async () => {
  const h = harness();
  const cache = await h.caches.open('poekhali-data-v1');
  await cache.put(route, new Response(body));
  for (const outcome of ['offline', 404, 503, 'html', 'hang']) {
    h.context.fetchWithRetry = async () => {
      if (outcome === 'offline') throw Error('offline');
      if (outcome === 'hang') return new Promise(() => {});
      return new Response(outcome === 'html' ? '<html>error</html>' : '', { status: typeof outcome === 'number' ? outcome : 200 });
    };
    const pending = [];
    const response = await immediate(h.context.trackerDataCacheFirst(new Request(origin + route), { waitUntil(p) { pending.push(p); } }));
    assert.equal(await response.text(), body);
    if (outcome !== 'hang') await Promise.all(pending);
    assert.equal(await (await cache.match(route)).text(), body);
  }
});
test('old shell data survives shell cache removal', async () => {
  const h = harness();
  const old = await h.caches.open('shift-tracker-shell-v417');
  await old.put(route, new Response(body));
  await h.context.preserveTrackerData();
  await h.caches.delete('shift-tracker-shell-v417');
  h.env.fetch = async () => { throw Error('offline'); };
  assert.equal(await immediate(h.utils.fetchText(route)), body);
});
test('failed first load can retry successfully, and malformed JSON is not saved', async () => {
  const h = harness();
  h.env.fetch = async () => new Response('<html>error</html>');
  await assert.rejects(h.utils.fetchText(route));
  assert.equal(await (await h.caches.open('poekhali-data-v1')).match(route), undefined);
  h.env.fetch = async () => new Response(body);
  assert.equal(await h.utils.fetchText(route), body);
});
test('all depot catalog dependencies are persisted for offline reopening', async () => {
  const h = harness();
  const paths = ['index.json', 'railways.json', 'depots.json', 'depot-packs/rzd-dvost-tche-9-komsomolsk-na-amure.json'];
  h.env.fetch = async url => new Response(readFileSync(new URL('../' + url.replace(/^\//, ''), import.meta.url), 'utf8'));
  const saved = new Map();
  for (const path of paths) saved.set(path, await h.utils.fetchText('/assets/catalog/' + path));
  h.env.fetch = async () => { throw Error('offline'); };
  for (const path of paths) assert.equal(await immediate(h.utils.fetchText('/assets/catalog/' + path)), saved.get(path));
});
test('manifest failure and partial catalog do not poison subsequent opening', async () => {
  const source = readFileSync(new URL('./poekhali-tracker.js', import.meta.url), 'utf8');
  const start = source.indexOf('  function loadManifest() {');
  const code = source.slice(start, source.indexOf('\n  function resetMapData()', start));
  const tracker = { manifestPromise: null };
  let phase = 'offline';
  const fallback = { id: 'fallback' };
  const context = vm.createContext({ tracker, DEFAULT_MAP: fallback, MAP_STORAGE_KEY: 'map',
    ASSET_PATHS: { manifest: 'manifest', sectionIndex: 'sections' },
    fetchText: async path => {
      if (phase === 'offline' || (phase === 'partial' && path === 'sections')) throw Error('offline');
      return JSON.stringify(path === 'manifest' ? { maps: [fallback] } : { maps: [{ id: 'postyshevo' }] });
    },
    normalizeMapConfig: x => x, buildSectionMapConfigs: x => x?.maps || [],
    isMapAutoSelectable: () => true, localStorage: { getItem() { return 'postyshevo'; } }, setCurrentMap() {}
  });
  vm.runInContext(code, context);
  await context.loadManifest();
  assert.equal(tracker.manifestPromise, null);
  phase = 'partial';
  await context.loadManifest();
  assert.equal(tracker.manifestPromise, null);
  phase = 'online';
  await context.loadManifest();
  assert.ok(tracker.availableMaps.some(x => x.id === 'postyshevo'));
});
