const { spawn } = require('child_process');
const crypto = require('crypto');
const { chromium } = require('/tmp/pw-smoke/node_modules/playwright');

const root = '/opt/bloknot-mashinista';
const port = 3102;
const env = {
  ...process.env,
  PORT: String(port),
  TELEGRAM_BOT_TOKEN: 'testtoken',
  BM_ADMIN_TELEGRAM_IDS: '906498745',
};

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeToken(user) {
  const payload = JSON.stringify({ user, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 });
  const secret = crypto.createHash('sha256').update(env.TELEGRAM_BOT_TOKEN, 'utf8').digest();
  const signature = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  const encoded = Buffer.from(payload, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${encoded}.${signature}`;
}

async function bootstrapUser(page, user) {
  const token = makeToken(user);
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('shift_tracker_session_token', token);
    localStorage.setItem('shift_tracker_cached_user_v1', JSON.stringify(user));
  }, { token, user });
}

async function runScenario(browser, user, expectAdminVisible) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', err => {
    const text = err && err.message ? err.message : String(err);
    if (/401|403|Unauthorized|Forbidden/.test(text)) return;
    errors.push(text);
  });
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/401|403|Unauthorized|Forbidden/.test(text)) return;
    errors.push(text);
  });
  await bootstrapUser(page, user);
  await page.goto(`http://lvh.me:${port}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.locator('button[data-tab="instructions"]').click();
  await page.waitForTimeout(800);
  const entryVisible = await page.locator('#docsAdminEntryButton').isVisible().catch(() => false);
  if (entryVisible !== expectAdminVisible) {
    const currentUser = await page.evaluate(() => window.CURRENT_USER || null).catch(() => null);
    const entryClass = await page.locator('#docsAdminEntryButton').getAttribute('class').catch(() => 'missing');
    throw new Error(`admin button visibility mismatch for ${user.id}: got ${entryVisible}, expected ${expectAdminVisible}, currentUser=${JSON.stringify(currentUser)}, class=${entryClass}`);
  }
  if (expectAdminVisible) {
    await page.locator('#docsAdminEntryButton').click();
    await page.waitForTimeout(700);
    const shellVisible = await page.locator('#docsAdminShell').isVisible().catch(() => false);
    if (!shellVisible) throw new Error('admin shell did not open');
    const title = await page.locator('#docsAdminFormTitle').innerText().catch(() => '');
    if (!/Новый документ/i.test(title)) throw new Error('admin form not rendered');
  }
  if (errors.length) throw new Error('browser errors: ' + errors.join(' | '));
  await context.close();
}

async function main() {
  const server = spawn('node', ['server.js'], { cwd: root, env, stdio: 'ignore' });
  const browser = await chromium.launch({ headless: true });
  try {
    for (let i = 0; i < 40; i += 1) {
      try {
        const page = await browser.newPage();
        await page.goto(`http://lvh.me:${port}/`, { waitUntil: 'domcontentloaded', timeout: 2000 });
        await page.close();
        break;
      } catch (_) {
        await wait(200);
      }
    }
    await runScenario(browser, { id: '906498745', first_name: 'Egor', username: 'Egorsjj', is_admin: true }, true);
    await runScenario(browser, { id: '111111111', first_name: 'User', username: 'user', is_admin: false }, false);
    console.log('docs-admin-ui-smoke-ok');
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
