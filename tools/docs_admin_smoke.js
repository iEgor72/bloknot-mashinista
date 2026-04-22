const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = '/opt/bloknot-mashinista';
const port = 3101;
const env = {
  ...process.env,
  PORT: String(port),
  TELEGRAM_BOT_TOKEN: 'testtoken',
  BM_ADMIN_TELEGRAM_IDS: '906498745',
};

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function request(url, options = {}) {
  const result = spawnSync('curl', ['-sS', '-X', options.method || 'GET', ...(options.headers || []).flatMap(([k, v]) => ['-H', `${k}: ${v}`]), ...(options.body ? ['--data', options.body] : []), url], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'curl failed');
  return JSON.parse(result.stdout || '{}');
}

function requestRaw(url, options = {}) {
  const result = spawnSync('curl', ['-sS', '-i', '-X', options.method || 'GET', ...(options.headers || []).flatMap(([k, v]) => ['-H', `${k}: ${v}`]), ...(options.body ? ['--data', options.body] : []), url], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'curl failed');
  const splitIndex = result.stdout.indexOf('\r\n\r\n') >= 0 ? result.stdout.indexOf('\r\n\r\n') : result.stdout.indexOf('\n\n');
  const head = splitIndex >= 0 ? result.stdout.slice(0, splitIndex) : '';
  const body = splitIndex >= 0 ? result.stdout.slice(splitIndex).replace(/^\r?\n\r?\n/, '') : result.stdout;
  const statusLine = head.split(/\r?\n/)[0] || '';
  const status = Number((statusLine.match(/\s(\d{3})\s/) || [])[1] || 0);
  let parsed = {};
  try { parsed = body ? JSON.parse(body) : {}; } catch (_) {}
  return { status, body: parsed };
}

function cleanupGeneratedFiles() {
  fs.rmSync(path.join(root, 'assets/docs/uploads'), { recursive: true, force: true });
  fs.rmSync(path.join(root, 'data/docs'), { recursive: true, force: true });
}

function makeToken() {
  const user = { id: '906498745', first_name: 'Egor', username: 'Egorsjj', is_admin: true };
  const payload = JSON.stringify({ user, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 });
  const secret = crypto.createHash('sha256').update(env.TELEGRAM_BOT_TOKEN, 'utf8').digest();
  const signature = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  const encoded = Buffer.from(payload, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${encoded}.${signature}`;
}

async function main() {
  cleanupGeneratedFiles();
  const server = spawn('node', ['server.js'], { cwd: root, env, stdio: 'ignore' });
  try {
    for (let i = 0; i < 30; i += 1) {
      const ping = spawnSync('curl', ['-sS', `http://127.0.0.1:${port}/`], { encoding: 'utf8' });
      if (ping.status === 0) break;
      await wait(200);
    }
    const token = makeToken();
    const nonAdminToken = (function makeNonAdminToken() {
      const user = { id: '111111111', first_name: 'User', username: 'user', is_admin: false };
      const payload = JSON.stringify({ user, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 });
      const secret = crypto.createHash('sha256').update(env.TELEGRAM_BOT_TOKEN, 'utf8').digest();
      const signature = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
      const encoded = Buffer.from(payload, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
      return `${encoded}.${signature}`;
    })();
    const auth = [['Authorization', `Bearer ${token}`], ['Content-Type', 'application/json']];
    const publicManifest = request(`http://127.0.0.1:${port}/api/docs`);
    const adminBefore = request(`http://127.0.0.1:${port}/api/docs?mode=admin`, { headers: [['Authorization', `Bearer ${token}`]] });
    const createResult = request(`http://127.0.0.1:${port}/api/docs`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        revision: adminBefore.revision,
        title: 'Тестовый документ',
        subtitle: 'Проверка',
        section: 'reminders',
        file_name: 'test.pdf',
        source_name: 'test.pdf',
        mime_type: 'application/pdf',
        file_base64: 'JVBERi0xLjQKJUVPRgo='
      })
    });
    if (!createResult.ok || !Array.isArray(createResult.created) || !createResult.created.length) {
      throw new Error('create failed: ' + JSON.stringify(createResult));
    }
    const created = createResult.created[0];
    const updateResult = request(`http://127.0.0.1:${port}/api/docs`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({
        revision: createResult.catalog && createResult.catalog.revision,
        id: created.id,
        title: 'Тестовый документ 2',
        subtitle: 'Обновлено',
        section: 'reminders',
        sort_order: 0
      })
    });
    const rollbackResult = request(`http://127.0.0.1:${port}/api/docs`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({
        action: 'rollback',
        revision: updateResult.catalog && updateResult.catalog.revision,
        id: created.id,
        version_id: updateResult.item && updateResult.item.versions && updateResult.item.versions[0] ? updateResult.item.versions[0].id : ''
      })
    });
    const archiveResult = request(`http://127.0.0.1:${port}/api/docs`, {
      method: 'DELETE',
      headers: auth,
      body: JSON.stringify({ id: created.id, revision: rollbackResult.catalog && rollbackResult.catalog.revision })
    });
    const restoreResult = request(`http://127.0.0.1:${port}/api/docs`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ action: 'restore', revision: archiveResult.catalog && archiveResult.catalog.revision, id: created.id })
    });
    const staleUpdate = requestRaw(`http://127.0.0.1:${port}/api/docs`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ revision: 1, id: created.id, title: 'Неверная ревизия', subtitle: '', section: 'reminders', sort_order: 0 })
    });
    const forbiddenCreate = requestRaw(`http://127.0.0.1:${port}/api/docs`, {
      method: 'POST',
      headers: [['Authorization', `Bearer ${nonAdminToken}`], ['Content-Type', 'application/json']],
      body: JSON.stringify({ title: 'forbidden', section: 'reminders', file_name: 'test.pdf', source_name: 'test.pdf', mime_type: 'application/pdf', file_base64: 'JVBERi0xLjQKJUVPRgo=' })
    });
    const adminAfter = request(`http://127.0.0.1:${port}/api/docs?mode=admin`, { headers: [['Authorization', `Bearer ${token}`]] });
    if (!publicManifest || typeof publicManifest !== 'object') throw new Error('public manifest missing');
    if (!Array.isArray(adminBefore.items)) throw new Error('admin list missing');
    if (!updateResult.ok || !updateResult.item || updateResult.item.title !== 'Тестовый документ 2') throw new Error('update failed');
    if (!rollbackResult.ok || !rollbackResult.item || rollbackResult.item.title !== 'Тестовый документ') throw new Error('rollback failed');
    if (!archiveResult.ok) throw new Error('archive failed');
    if (!restoreResult.ok || !restoreResult.item || restoreResult.item.archived) throw new Error('restore failed');
    if (staleUpdate.status !== 409) throw new Error('stale revision guard failed: ' + JSON.stringify(staleUpdate));
    if (forbiddenCreate.status !== 403) throw new Error('non-admin guard failed: ' + JSON.stringify(forbiddenCreate));
    if (!Array.isArray(adminAfter.items) || !adminAfter.items.some(item => item.id === created.id)) throw new Error('restored item missing');
    console.log(`docs-admin-smoke-ok ${adminBefore.items.length}->${adminAfter.items.length}`);
  } finally {
    server.kill('SIGTERM');
    cleanupGeneratedFiles();
  }
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
