const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../sw.js'), 'utf8');
function harness() {
  const entries = new Map();
  const stats = { active: 0, maximum: 0, requests: 0 };
  const cache = {
    async match(key) { return entries.get(typeof key === 'string' ? key : new URL(key.url).pathname)?.clone(); },
    async put(key, response) { entries.set(typeof key === 'string' ? key : key.url, response.clone()); },
    async delete(key) { return entries.delete(key); }
  };
  const context = vm.createContext({
    self: { location: { origin: 'https://example.test' }, addEventListener() {} },
    caches: { async open() { return cache; } },
    console: { info() {}, warn() {} }, URL, Response, Map, Set, Promise, AbortController, setTimeout, clearTimeout,
    Request: class extends Request { constructor(input, options) { super(typeof input === 'string' ? new URL(input, 'https://example.test') : input, options); } },
    async fetch() {
      stats.requests++; stats.active++; stats.maximum = Math.max(stats.maximum, stats.active);
      await new Promise(resolve => setTimeout(resolve, 5)); stats.active--;
      return new Response('/* working code */', { headers: { 'content-type': 'text/javascript' } });
    }
  });
  vm.runInContext(source, context);
  return { context, cache, entries, stats };
}
test('overlapping warmups share work and never exceed four background transfers', async () => {
  const h = harness();
  vm.runInContext("resolveShellUrls = async () => Array.from({length: 24}, (_, i) => '/scripts/v420/test-' + i + '.js')", h.context);
  await vm.runInContext("Promise.all([warmShellCache({mode:'shell'}), warmShellCache({mode:'shell'}), warmShellCache({mode:'full'})])", h.context);
  assert.equal(h.stats.maximum, 4);
  assert.equal(h.stats.requests, 24, 'already populated files must not download again');
});
test('empty and HTML code responses fail the coherence audit', async () => {
  const h = harness();
  await h.cache.put('/scripts/v420/empty.js', new Response(''));
  await h.cache.put('/scripts/v420/html.js', new Response('<html>error</html>', { headers: { 'content-type': 'text/html' } }));
  const audit = await vm.runInContext("(async () => auditCachedShellUrls(await caches.open('test'), ['/scripts/v420/empty.js', '/scripts/v420/html.js']))()", h.context);
  assert.equal(audit.ok, false); assert.equal(audit.missing.length, 2);
});
test('versioned startup uses good cache without network and repairs an empty entry online', async () => {
  const h = harness(); const key = '/scripts/v420/app-init.js';
  await h.cache.put(key, new Response('/* cached */'));
  await vm.runInContext("versionedShellCacheFirst(new Request('/scripts/v420/app-init.js'))", h.context);
  assert.equal(h.stats.requests, 0);
  await h.cache.put(key, new Response(''));
  await vm.runInContext("versionedShellCacheFirst(new Request('/scripts/v420/app-init.js'))", h.context);
  assert.equal(h.stats.requests, 1); assert.equal(await (await h.cache.match(key)).text(), '/* working code */');
});
test('failed cache replacement preserves the previous working response', async () => {
  const h = harness(); const key = '/scripts/v420/app.js';
  await h.cache.put(key, new Response('/* old working code */'));
  h.cache.put = async () => { throw new Error('storage failure'); };
  h.context.testCache = h.cache;
  await assert.rejects(vm.runInContext("putShellCacheResponse(testCache, '/scripts/v420/app.js', new Response('/* new code */'))", h.context));
  assert.equal(await (await h.cache.match(key)).text(), '/* old working code */');
});

