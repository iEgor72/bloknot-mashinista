'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_DIR = path.join(REPO_ROOT, 'ai-memory');
const SESSIONS_DIR = path.join(MEMORY_DIR, 'sessions');
const LOCAL_CONFIG_FILE = path.join(REPO_ROOT, '.agent-memory.local.json');

const FILES = {
  index: path.join(MEMORY_DIR, 'INDEX.md'),
  startHere: path.join(MEMORY_DIR, 'START_HERE.md'),
  context: path.join(MEMORY_DIR, 'AGENT_CONTEXT.md'),
  changelog: path.join(MEMORY_DIR, 'CHANGELOG.md'),
  projectState: path.join(MEMORY_DIR, 'PROJECT_STATE.md'),
  architecture: path.join(MEMORY_DIR, 'ARCHITECTURE.md'),
  methods: path.join(MEMORY_DIR, 'METHODS.md'),
  engineeringStyle: path.join(MEMORY_DIR, 'ENGINEERING_STYLE.md'),
  sessionProtocol: path.join(MEMORY_DIR, 'SESSION_PROTOCOL.md'),
  recentCommits: path.join(MEMORY_DIR, 'RECENT_COMMITS.md'),
  worktreeStatus: path.join(MEMORY_DIR, 'WORKTREE_STATUS.md')
};

function runCommand(command, options = {}) {
  const allowFailure = options.allowFailure === true;
  try {
    return execSync(command, {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      windowsHide: true
    }).trim();
  } catch (error) {
    if (allowFailure) {
      return '';
    }
    throw error;
  }
}

function runGit(args, allowFailure = true) {
  return runCommand(`git -c core.quotepath=off ${args}`, { allowFailure });
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFileIfMissing(filePath, content) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatTimestamp(date = new Date()) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absoluteOffset / 60));
  const offsetRemainder = pad(absoluteOffset % 60);
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
    `${sign}${offsetHours}:${offsetRemainder}`
  ].join(' ');
}

function formatDateOnly(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function readText(filePath, fallback = '') {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return fallback;
  }
}

function readTextFromRepo(relativePath, fallback = '') {
  return readText(path.join(REPO_ROOT, relativePath), fallback);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getPackageName() {
  const pkgPath = path.join(REPO_ROOT, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return path.basename(REPO_ROOT);
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.name || path.basename(REPO_ROOT);
  } catch (error) {
    return path.basename(REPO_ROOT);
  }
}

function escapeTableCell(value) {
  return String(value).replace(/\|/g, '\\|');
}

function getTrackedFiles() {
  const raw = runGit('ls-files');
  if (!raw) {
    return [];
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getTopLevelDistribution(files) {
  const counts = new Map();
  for (const file of files) {
    const top = file.includes('/') ? file.split('/')[0] : '(root)';
    counts.set(top, (counts.get(top) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function getCommitList(limit = 30) {
  const raw = runGit(
    `log -n ${limit} --date=iso-strict --pretty=format:%H%x1f%ad%x1f%an%x1f%s%x1e`
  );
  if (!raw) {
    return [];
  }

  return raw
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, date, author, subject] = record.split('\x1f');
      return {
        hash,
        shortHash: hash ? hash.slice(0, 7) : '',
        date,
        author,
        subject
      };
    });
}

function getHeadCommit() {
  const [head] = getCommitList(1);
  return head || null;
}

function getChangedFilesFromCommit(commitHash) {
  if (!commitHash) {
    return [];
  }
  const raw = runGit(`show --name-only --pretty=format: ${commitHash}`);
  if (!raw) {
    return [];
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function detectWorkingTreeFiles() {
  const raw = runGit('status --short');
  if (!raw) {
    return [];
  }

  const result = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    const payload = line.slice(3).trim();
    if (!payload) {
      continue;
    }
    if (payload.includes(' -> ')) {
      result.push(payload.split(' -> ')[1].trim());
    } else {
      result.push(payload);
    }
  }
  return uniqueList(result);
}

function uniqueList(items) {
  return Array.from(new Set((items || []).map((item) => String(item).trim()).filter(Boolean)));
}

function splitList(value) {
  if (!value) {
    return [];
  }
  return uniqueList(
    String(value)
      .split(/[,\n;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function parseCliArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const payload = token.slice(2);
    const separator = payload.indexOf('=');
    if (separator !== -1) {
      const key = payload.slice(0, separator);
      const value = payload.slice(separator + 1);
      args[key] = value;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[payload] = true;
    } else {
      args[payload] = next;
      index += 1;
    }
  }
  return args;
}

function readExcerpt(relativePath, maxLines = 35) {
  const text = readTextFromRepo(relativePath, '');
  if (!text) {
    return '';
  }
  return text.split(/\r?\n/).slice(0, maxLines).join('\n').trim();
}

function normalizeAssetPath(assetPath) {
  const raw = String(assetPath || '').trim();
  if (!raw) return '';
  const noHash = raw.split('#')[0];
  const noQuery = noHash.split('?')[0];
  const noDotPrefix = noQuery.replace(/^\.\//, '');
  if (noDotPrefix.startsWith('/')) {
    return noDotPrefix.slice(1);
  }
  return noDotPrefix;
}

function extractIndexScriptOrder() {
  const html = readTextFromRepo('index.html', '');
  if (!html) return [];
  const regex = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  const items = [];
  let match;
  while ((match = regex.exec(html))) {
    const normalized = normalizeAssetPath(match[1]);
    if (normalized) items.push(normalized);
  }
  return uniqueList(items);
}

function extractIndexStyleOrder() {
  const html = readTextFromRepo('index.html', '');
  if (!html) return [];
  const tagRegex = /<link\b[^>]*>/gi;
  const hrefRegex = /\bhref=["']([^"']+)["']/i;
  const relRegex = /\brel=["']([^"']+)["']/i;
  const items = [];
  let tagMatch;
  while ((tagMatch = tagRegex.exec(html))) {
    const tag = tagMatch[0];
    const relMatch = relRegex.exec(tag);
    if (!relMatch || !/stylesheet/i.test(relMatch[1])) continue;
    const hrefMatch = hrefRegex.exec(tag);
    if (!hrefMatch) continue;
    const normalized = normalizeAssetPath(hrefMatch[1]);
    if (normalized) items.push(normalized);
  }
  return uniqueList(items);
}

function getLineCount(relativePath) {
  const text = readTextFromRepo(relativePath, '');
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

function countMatches(text, pattern) {
  if (!text) return 0;
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function collectJsMetrics(trackedFiles) {
  const jsFiles = (trackedFiles || []).filter((file) => file.endsWith('.js'));
  const metrics = {
    fileCount: jsFiles.length,
    varCount: 0,
    letCount: 0,
    constCount: 0,
    iifeLikeFiles: 0,
    esmLikeFiles: 0,
    eventListenerCalls: 0,
    fetchCalls: 0,
    catchBlocks: 0
  };

  for (const file of jsFiles) {
    const text = readTextFromRepo(file, '');
    metrics.varCount += countMatches(text, /\bvar\b/g);
    metrics.letCount += countMatches(text, /\blet\b/g);
    metrics.constCount += countMatches(text, /\bconst\b/g);
    metrics.eventListenerCalls += countMatches(text, /\.addEventListener\s*\(/g);
    metrics.fetchCalls += countMatches(text, /\bfetch\s*\(/g);
    metrics.catchBlocks += countMatches(text, /\bcatch\s*\(/g);
    if (/\(function\s*\(/.test(text)) metrics.iifeLikeFiles += 1;
    if (/\bimport\b|\bexport\b/.test(text)) metrics.esmLikeFiles += 1;
  }

  return metrics;
}

function collectApiSurface(trackedFiles) {
  const apiFiles = (trackedFiles || []).filter((file) => file.startsWith('functions/api/') && file.endsWith('.js'));
  const clientScriptFiles = (trackedFiles || []).filter((file) => file.startsWith('scripts/') && file.endsWith('.js'));
  const clientCorpus = clientScriptFiles.map((file) => readTextFromRepo(file, '')).join('\n');

  const surface = [];
  for (const file of apiFiles.sort()) {
    const routeName = path.basename(file, '.js');
    const route = `/api/${routeName}`;
    const text = readTextFromRepo(file, '');
    const methods = uniqueList(
      Array.from(text.matchAll(/request\.method\s*===\s*'([A-Z]+)'/g)).map((match) => match[1])
    );
    surface.push({
      route,
      file,
      methods,
      referencedByFrontend: clientCorpus.includes(route)
    });
  }
  return surface;
}

function collectDbTables(trackedFiles) {
  const files = (trackedFiles || []).filter((file) => file.startsWith('functions/features/') && file.endsWith('.js'));
  const tableToFiles = new Map();
  for (const file of files) {
    const text = readTextFromRepo(file, '');
    const regex = /CREATE TABLE IF NOT EXISTS\s+([a-zA-Z0-9_]+)/gi;
    let match;
    while ((match = regex.exec(text))) {
      const table = match[1];
      if (!tableToFiles.has(table)) tableToFiles.set(table, new Set());
      tableToFiles.get(table).add(file);
    }
  }
  return Array.from(tableToFiles.entries())
    .map(([table, ownerFiles]) => ({ table, files: Array.from(ownerFiles).sort() }))
    .sort((a, b) => a.table.localeCompare(b.table));
}

function collectStorageKeys(trackedFiles) {
  const scriptFiles = (trackedFiles || []).filter((file) => file.startsWith('scripts/') && file.endsWith('.js'));
  const keyConstants = [];
  const keySet = new Set();
  const keyConstantRegex = /\b(?:const|let|var)\s+([A-Z0-9_]*STORAGE_KEY[A-Z0-9_]*)\s*=\s*['"]([^'"]+)['"]/g;
  const directCallRegex = /localStorage\.(?:getItem|setItem|removeItem)\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const file of scriptFiles) {
    const text = readTextFromRepo(file, '');
    let match;
    while ((match = keyConstantRegex.exec(text))) {
      const name = match[1];
      const value = match[2];
      keyConstants.push({ name, value, file });
      keySet.add(value);
    }
    while ((match = directCallRegex.exec(text))) {
      keySet.add(match[1]);
    }
  }

  return {
    constants: keyConstants.sort((a, b) => a.name.localeCompare(b.name)),
    allKeys: Array.from(keySet).sort()
  };
}

function collectTextLineCount(trackedFiles) {
  const textLike = (trackedFiles || []).filter((file) =>
    /\.(js|css|html|md|toml|json|py|webmanifest|gitignore)$/i.test(file)
  );
  let total = 0;
  for (const file of textLike) {
    total += getLineCount(file);
  }
  return {
    fileCount: textLike.length,
    totalLines: total
  };
}

function buildArchitectureDoc() {
  const now = new Date();
  const trackedFiles = getTrackedFiles();
  const scriptOrder = extractIndexScriptOrder();
  const styleOrder = extractIndexStyleOrder();
  const apiSurface = collectApiSurface(trackedFiles);
  const dbTables = collectDbTables(trackedFiles);
  const textStats = collectTextLineCount(trackedFiles);
  const swText = readTextFromRepo('sw.js', '');
  const swVersionMatch = swText.match(/CACHE_VERSION\s*=\s*'([^']+)'/);
  const cacheVersion = swVersionMatch ? swVersionMatch[1] : '(unknown)';
  const wranglerText = readTextFromRepo('wrangler.toml', '');
  const hasD1Binding = /\[\[d1_databases\]\]/.test(wranglerText);

  const scriptLines = scriptOrder.length
    ? scriptOrder.map((file) => `- \`${file}\` (${getLineCount(file)} lines)`).join('\n')
    : '- Script order not detected from index.html.';
  const styleLines = styleOrder.length
    ? styleOrder.map((file) => `- \`${file}\` (${getLineCount(file)} lines)`).join('\n')
    : '- Style order not detected from index.html.';
  const apiLines = apiSurface.length
    ? apiSurface
        .map((item) => {
          const methods = item.methods.length ? item.methods.join(', ') : 'n/a';
          const frontendTag = item.referencedByFrontend ? 'yes' : 'no';
          return `- \`${item.route}\` [${methods}] | frontend ref: ${frontendTag} | \`${item.file}\``;
        })
        .join('\n')
    : '- No API routes found.';
  const tableLines = dbTables.length
    ? dbTables
        .map((entry) => `- \`${entry.table}\` in ${entry.files.map((file) => `\`${file}\``).join(', ')}`)
        .join('\n')
    : '- No database table declarations found.';

  const lines = [
    '# Architecture',
    '',
    `Generated: ${formatTimestamp(now)}`,
    '',
    '## Snapshot',
    `- Tracked files: ${trackedFiles.length}`,
    `- Text-like files: ${textStats.fileCount}`,
    `- Text-like lines: ${textStats.totalLines}`,
    `- Service Worker cache version: \`${cacheVersion}\``,
    `- Wrangler D1 binding: ${hasD1Binding ? 'configured' : 'not found'}`,
    '',
    '## Runtime Topology',
    '- Browser app shell: `index.html` + deferred plain JS modules (no bundler).',
    '- Production backend: Cloudflare Pages Functions in `functions/api/*`.',
    '- Local fallback backend: `server.js` (Node HTTP server with local JSON storage).',
    '- PWA/offline runtime: `sw.js` + `scripts/sw-register.js`.',
    '',
    '## Frontend Load Order (from index.html)',
    scriptLines,
    '',
    '## CSS Layering (from index.html)',
    styleLines,
    '',
    '## API Surface',
    apiLines,
    '',
    '## Persistent Data Model',
    tableLines,
    '',
    '## Offline Strategy',
    '- Navigation: network-first with cached fallback (`networkFirstDocument`).',
    '- Static assets: stale-while-revalidate (`staleWhileRevalidate`).',
    '- Shell warmup: install + extended warmup via `WARMUP_CACHE` message.',
    '- Frontend keeps per-user local cache and pending queue keys prefixed with `shift_tracker_`.',
    '',
    '## Key Architectural Notes',
    '- Client modules share global state across files; script order is part of architecture.',
    '- `functions/api/docs.js` exists server-side, while current docs UI (`scripts/docs-app.js`) reads static `/assets/docs/manifest.json` directly.',
    '- Auth flow combines Telegram Login Widget, Telegram WebApp `initData`, bearer token, and secure cookie session.',
    ''
  ];

  return lines.join('\n');
}

function buildMethodsDoc() {
  const now = new Date();
  const authText = readTextFromRepo('scripts/auth.js', '');
  const appText = readTextFromRepo('scripts/app.js', '');
  const shiftFormText = readTextFromRepo('scripts/shift-form.js', '');
  const instructionsText = readTextFromRepo('scripts/instructions-app.js', '');
  const docsText = readTextFromRepo('scripts/docs-app.js', '');
  const swText = readTextFromRepo('sw.js', '');
  const statsStoreText = readTextFromRepo('functions/features/stats/store.js', '');
  const shiftsStoreText = readTextFromRepo('functions/features/shifts/store.js', '');

  const methodFlags = {
    webAppAuth: authText.includes('authenticateWithTelegramWebApp'),
    sessionRestore: authText.includes('restoreSession('),
    cachedShellBootstrap: authText.includes('bootstrapCachedShellFromStorage'),
    optimisticShiftRender:
      shiftFormText.includes('Optimistic render') || /render\(\);\s*\r?\n\s*saveShifts\s*\(/.test(shiftFormText),
    pendingQueue: appText.includes('pendingMutationIds'),
    russianStemmer: instructionsText.includes('stemRussianToken'),
    fuzzySearch: instructionsText.includes('boundedLevenshteinDistance'),
    docsOfflineCheck: docsText.includes('caches.match'),
    swNetworkFirst: swText.includes('networkFirstDocument'),
    swStaleWhileRevalidate: swText.includes('staleWhileRevalidate'),
    statsUpsert: statsStoreText.includes('ON CONFLICT(session_id) DO UPDATE'),
    legacyShiftMigration: shiftsStoreText.includes("readLegacyGlobalShifts")
  };

  const lines = [
    '# Methods',
    '',
    `Generated: ${formatTimestamp(now)}`,
    '',
    '## Authentication Methods',
    `- Telegram WebApp ` + (methodFlags.webAppAuth ? 'enabled' : 'not detected') + ' (`initData` verification).',
    `- Session restore from backend ` + (methodFlags.sessionRestore ? 'enabled' : 'not detected') + '.',
    '- Browser mode uses Telegram Login Widget callback (`/api/auth?mode=telegram-login`).',
    '',
    '## Data Sync Methods',
    '- Shift list uses authenticated API calls (`/api/shifts`) with bearer token.',
    `- Optimistic UI update on shift delete/save: ${methodFlags.optimisticShiftRender ? 'present' : 'not detected'}.`,
    `- Pending/offline mutation handling: ${methodFlags.pendingQueue ? 'present' : 'not detected'}.`,
    `- Cached shell bootstrap path: ${methodFlags.cachedShellBootstrap ? 'present' : 'not detected'}.`,
    '',
    '## Search and Docs Methods',
    `- Russian stemming for instruction search: ${methodFlags.russianStemmer ? 'present' : 'not detected'}.`,
    `- Fuzzy matching (bounded Levenshtein + chargrams): ${methodFlags.fuzzySearch ? 'present' : 'not detected'}.`,
    `- Docs offline cache state checks via Cache API: ${methodFlags.docsOfflineCheck ? 'present' : 'not detected'}.`,
    '',
    '## Offline and Caching Methods',
    `- SW navigation network-first: ${methodFlags.swNetworkFirst ? 'present' : 'not detected'}.`,
    `- SW stale-while-revalidate for assets: ${methodFlags.swStaleWhileRevalidate ? 'present' : 'not detected'}.`,
    '- Warm shell pre-cache + runtime warmup through service worker message channel.',
    '',
    '## Data Persistence Methods',
    `- Stats session upsert in D1: ${methodFlags.statsUpsert ? 'present' : 'not detected'}.`,
    `- Legacy ` + '`shift_sets.global`' + ` -> user migration: ${methodFlags.legacyShiftMigration ? 'present' : 'not detected'}.`,
    '- Session cookies + signed bearer token share one signature scheme.',
    '',
    '## Operational Methods',
    '- PM2 process file for VPS runtime (`ecosystem.config.js`).',
    '- Bot webhook bootstrap helper (`scripts/setup-bot-webhook.py`).',
    '- Dataset builder for instructions (`scripts/build-instructions-dataset.py`).',
    ''
  ];

  return lines.join('\n');
}

function buildEngineeringStyleDoc() {
  const now = new Date();
  const trackedFiles = getTrackedFiles();
  const jsMetrics = collectJsMetrics(trackedFiles);
  const storage = collectStorageKeys(trackedFiles);
  const totalDecl = jsMetrics.varCount + jsMetrics.letCount + jsMetrics.constCount;
  const varShare = totalDecl ? ((jsMetrics.varCount / totalDecl) * 100).toFixed(1) : '0.0';
  const letShare = totalDecl ? ((jsMetrics.letCount / totalDecl) * 100).toFixed(1) : '0.0';
  const constShare = totalDecl ? ((jsMetrics.constCount / totalDecl) * 100).toFixed(1) : '0.0';

  const storageLines = storage.constants.length
    ? storage.constants
        .slice(0, 24)
        .map((entry) => `- \`${entry.name}\` = \`${entry.value}\` (\`${entry.file}\`)`)
        .join('\n')
    : '- No explicit STORAGE_KEY constants detected in scripts.';

  const lines = [
    '# Engineering Style',
    '',
    `Generated: ${formatTimestamp(now)}`,
    '',
    '## Codebase Style Metrics',
    `- JS files: ${jsMetrics.fileCount}`,
    `- Declaration mix: var=${jsMetrics.varCount} (${varShare}%), let=${jsMetrics.letCount} (${letShare}%), const=${jsMetrics.constCount} (${constShare}%)`,
    `- IIFE-like files: ${jsMetrics.iifeLikeFiles}`,
    `- ESM-like files: ${jsMetrics.esmLikeFiles}`,
    `- addEventListener calls: ${jsMetrics.eventListenerCalls}`,
    `- fetch() calls: ${jsMetrics.fetchCalls}`,
    `- catch(...) blocks: ${jsMetrics.catchBlocks}`,
    '',
    '## Writing Style Traits',
    '- Defensive coding with frequent `try/catch` around platform-specific APIs (Telegram SDK, localStorage, viewport APIs).',
    '- Imperative, event-driven DOM code with direct `document.getElementById` / query selectors.',
    '- Shared global runtime state across deferred scripts; module boundaries are file-based, not bundler-based.',
    '- Extensive constants and small helper functions before side-effect handlers.',
    '- User-facing copy is primarily Russian; technical identifiers are English.',
    '',
    '## Naming and Data Conventions',
    '- Persistent frontend keys use `shift_tracker_*` prefix for localStorage namespacing.',
    '- Backend DB tables follow snake_case names (`user_shifts`, `stats_sessions`, `docs_files`).',
    '- API payloads are JSON, usually with explicit `ok/error` envelope and `no-store` cache headers.',
    '',
    '## Storage Key Constants (sample)',
    storageLines,
    '',
    '## Practical Constraints for Agents',
    '- Do not break script load order from `index.html`; many globals depend on declaration timing.',
    '- Preserve compatibility with Telegram WebApp runtime and mobile webview behavior.',
    '- Keep offline behavior stable: cache keys, service worker versioning, and pending queue contracts.',
    ''
  ];

  return lines.join('\n');
}

function buildSessionProtocolDoc() {
  const now = new Date();
  return [
    '# Session Protocol',
    '',
    `Generated: ${formatTimestamp(now)}`,
    '',
    '## Mandatory Preflight (start of every agent session)',
    '1. Run `npm run memory:preflight`.',
    '2. Read in order:',
    '   - `ai-memory/START_HERE.md`',
    '   - `ai-memory/PROJECT_STATE.md`',
    '   - `ai-memory/ARCHITECTURE.md`',
    '   - `ai-memory/METHODS.md`',
    '   - `ai-memory/ENGINEERING_STYLE.md`',
    '   - latest entries in `ai-memory/CHANGELOG.md`',
    '   - `ai-memory/WORKTREE_STATUS.md`',
    '',
    '## During Work',
    '- For each meaningful change, add note:',
    '  - `npm run memory:log -- --task "что сделано" --methods "как сделано" --files "a,b,c"`',
    '- If scope changes, add another note instead of editing past notes.',
    '',
    '## Session End',
    '1. Run `npm run memory:refresh`.',
    '2. If using git commit, `post-commit` hook will auto-append commit record.',
    '3. Optional explicit final note:',
    '   - `npm run memory:log -- --task "итог сессии" --methods "summary"`',
    '',
    '## Obsidian Sync',
    '- Ensure `.agent-memory.local.json` exists with correct vault path.',
    '- `memory:preflight`, `memory:refresh`, and `memory:log` sync memory to Obsidian when enabled.',
    ''
  ].join('\n');
}

function buildStartHereDoc() {
  return [
    '# START HERE',
    '',
    'Перед началом любой задачи:',
    '1. Запусти `npm run memory:preflight`.',
    '2. Прочитай `PROJECT_STATE.md`.',
    '3. Прочитай `ARCHITECTURE.md` и `METHODS.md`.',
    '4. Прочитай `ENGINEERING_STYLE.md`.',
    '5. Прочитай последние записи в `CHANGELOG.md`.',
    '6. Прочитай `WORKTREE_STATUS.md`.',
    '',
    'Во время работы:',
    '- После значимого изменения добавь запись: `npm run memory:log -- --task "что сделал" --methods "как сделал" --files "file1,file2"`.',
    '',
    'После завершения:',
    '- Обнови срез проекта: `npm run memory:refresh`.',
    '- Если делаешь коммит, запись в память добавится автоматически через `post-commit` hook.'
  ].join('\n');
}

function buildProjectState() {
  const now = new Date();
  const branch = runGit('branch --show-current') || '(unknown)';
  const trackedFiles = getTrackedFiles();
  const distribution = getTopLevelDistribution(trackedFiles);
  const head = getHeadCommit();
  const apiFiles = trackedFiles.filter((file) => file.startsWith('functions/api/') && file.endsWith('.js'));
  const clientScripts = trackedFiles.filter((file) => file.startsWith('scripts/') && file.endsWith('.js'));
  const readmeExcerpt = readExcerpt('README.md', 25);
  const scriptsReadmeExcerpt = readExcerpt('scripts/README.md', 35);

  const distributionLines = distribution.length
    ? distribution.map(([name, count]) => `- \`${name}\`: ${count}`).join('\n')
    : '- No tracked files found.';

  const apiLines = apiFiles.length
    ? apiFiles.map((file) => {
        const routeName = path.basename(file, '.js');
        return `- \`/api/${routeName}\` (${file})`;
      }).join('\n')
    : '- No API handlers found.';

  const scriptLines = clientScripts.length
    ? clientScripts.map((file) => `- \`${file}\``).join('\n')
    : '- No client scripts found.';

  const summaryLines = [
    '# Project State',
    '',
    `Generated: ${formatTimestamp(now)}`,
    '',
    '## Repository',
    `- Name: \`${getPackageName()}\``,
    `- Root: \`${REPO_ROOT}\``,
    `- Branch: \`${branch}\``,
    `- Tracked files: ${trackedFiles.length}`,
    head ? `- HEAD: \`${head.shortHash}\` (${head.subject})` : '- HEAD: unavailable',
    '',
    '## Top-Level File Map',
    distributionLines,
    '',
    '## API Surface',
    apiLines,
    '',
    '## Frontend Runtime Scripts',
    scriptLines
  ];

  if (readmeExcerpt) {
    summaryLines.push('', '## README Snapshot', '```text', readmeExcerpt, '```');
  }

  if (scriptsReadmeExcerpt) {
    summaryLines.push('', '## scripts/README.md Snapshot', '```text', scriptsReadmeExcerpt, '```');
  }

  summaryLines.push('');
  return summaryLines.join('\n');
}

function buildRecentCommits(limit = 30) {
  const now = new Date();
  const commits = getCommitList(limit);
  const lines = [
    '# Recent Commits',
    '',
    `Generated: ${formatTimestamp(now)}`,
    '',
    '| Hash | Date | Author | Message |',
    '| --- | --- | --- | --- |'
  ];

  if (!commits.length) {
    lines.push('| - | - | - | No commits found |');
  } else {
    for (const commit of commits) {
      lines.push(
        `| \`${escapeTableCell(commit.shortHash)}\` | ${escapeTableCell(commit.date)} | ${escapeTableCell(
          commit.author
        )} | ${escapeTableCell(commit.subject)} |`
      );
    }
  }

  lines.push('');
  return lines.join('\n');
}

function buildWorktreeStatus() {
  const now = new Date();
  const branch = runGit('branch --show-current') || '(unknown)';
  const status = runGit('status --short');
  const lines = [
    '# Worktree Status',
    '',
    `Generated: ${formatTimestamp(now)}`,
    '',
    `- Branch: \`${branch}\``,
    '',
    '## Pending Changes'
  ];

  if (!status) {
    lines.push('_Working tree is clean._');
  } else {
    lines.push('```text', status, '```');
  }

  lines.push('');
  return lines.join('\n');
}

function buildIndex() {
  const now = new Date();
  return [
    '# AI Memory Index',
    '',
    `Updated: ${formatTimestamp(now)}`,
    '',
    '- [START_HERE.md](START_HERE.md)',
    '- [PROJECT_STATE.md](PROJECT_STATE.md)',
    '- [ARCHITECTURE.md](ARCHITECTURE.md)',
    '- [METHODS.md](METHODS.md)',
    '- [ENGINEERING_STYLE.md](ENGINEERING_STYLE.md)',
    '- [SESSION_PROTOCOL.md](SESSION_PROTOCOL.md)',
    '- [RECENT_COMMITS.md](RECENT_COMMITS.md)',
    '- [WORKTREE_STATUS.md](WORKTREE_STATUS.md)',
    '- [CHANGELOG.md](CHANGELOG.md)',
    '- [AGENT_CONTEXT.md](AGENT_CONTEXT.md)',
    '- [sessions/](sessions/)'
  ].join('\n');
}

function ensureMemoryStructure() {
  ensureDir(MEMORY_DIR);
  ensureDir(SESSIONS_DIR);

  writeFileIfMissing(
    FILES.startHere,
    buildStartHereDoc()
  );

  writeFileIfMissing(
    FILES.context,
    [
      '# Agent Context',
      '',
      'Ручной слой памяти. Храни здесь стабильные договорённости:',
      '- архитектурные ограничения;',
      '- принятые конвенции;',
      '- технический долг;',
      '- риски и причины решений.'
    ].join('\n')
  );

  writeFileIfMissing(
    FILES.changelog,
    [
      '# Agent Changelog',
      '',
      'Append-only журнал действий ИИ-агентов по проекту.',
      'Каждая запись должна отвечать на вопросы: что, как, когда и в каких файлах.'
    ].join('\n')
  );
}

function appendSessionEntry(entry) {
  const date = entry.date instanceof Date ? entry.date : new Date();
  const day = formatDateOnly(date);
  const filePath = path.join(SESSIONS_DIR, `${day}.md`);
  const timePart = formatTimestamp(date).split(' ')[1];
  const files = entry.files && entry.files.length ? entry.files.join(', ') : 'none';
  const methods = entry.methods && entry.methods.length ? entry.methods.join(', ') : 'n/a';
  const line = `- ${timePart} | source=${entry.source || 'manual'} | task=${entry.task || 'unspecified'} | files=${files} | methods=${methods}`;

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `# Session ${day}\n\n`, 'utf8');
  }
  fs.appendFileSync(filePath, `${line}\n`, 'utf8');
}

function appendChangelogEntry(entry = {}) {
  ensureMemoryStructure();

  const now = entry.date instanceof Date ? entry.date : new Date();
  const timestamp = entry.timestamp || formatTimestamp(now);
  const task = entry.task ? String(entry.task).trim() : 'Manual update';
  const source = entry.source ? String(entry.source).trim() : 'manual';
  const methods = uniqueList(entry.methods || []);
  const files = uniqueList(entry.files || []);
  const branch = entry.branch || runGit('branch --show-current') || '(unknown)';
  const notes = entry.notes ? String(entry.notes).trim() : '';
  const commitHash = entry.commitHash ? String(entry.commitHash).trim() : '';
  const commitSubject = entry.commitSubject ? String(entry.commitSubject).trim() : '';
  const author = entry.author ? String(entry.author).trim() : '';
  const dedupeByCommit = entry.dedupeByCommit === true;

  const currentChangelog = readText(FILES.changelog, '');
  if (dedupeByCommit && commitHash && currentChangelog.includes(`- Commit: \`${commitHash}\``)) {
    return false;
  }

  const lines = [`## ${timestamp}`, '', `- Source: \`${source}\``, `- Task: ${task}`, `- Branch: \`${branch}\``];

  if (commitHash) {
    lines.push(`- Commit: \`${commitHash}\`${commitSubject ? ` (${commitSubject})` : ''}`);
  }
  if (author) {
    lines.push(`- Author: \`${author}\``);
  }
  if (methods.length) {
    lines.push(`- Methods: ${methods.map((method) => `\`${method}\``).join(', ')}`);
  }
  if (files.length) {
    lines.push(`- Files: ${files.map((file) => `\`${file}\``).join(', ')}`);
  } else {
    lines.push('- Files: _not specified_');
  }
  if (notes) {
    lines.push(`- Notes: ${notes}`);
  }

  const block = `${lines.join('\n')}\n`;
  const prefix = currentChangelog.endsWith('\n') ? '\n' : '\n\n';
  fs.appendFileSync(FILES.changelog, `${prefix}${block}`, 'utf8');

  appendSessionEntry({
    date: now,
    source,
    task,
    methods,
    files
  });

  return true;
}

function copyDirectory(sourceDir, targetDir) {
  ensureDir(targetDir);
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }
    if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function loadLocalConfig() {
  try {
    return readJson(LOCAL_CONFIG_FILE);
  } catch (error) {
    return null;
  }
}

function syncToObsidian() {
  const config = loadLocalConfig();
  if (!config || config.enabled === false) {
    return { enabled: false, reason: 'config-missing-or-disabled' };
  }

  const vaultPath = config.vaultPath ? path.resolve(String(config.vaultPath)) : '';
  if (!vaultPath || !fs.existsSync(vaultPath)) {
    return { enabled: false, reason: 'vault-not-found', vaultPath };
  }

  const projectFolder = config.projectFolder
    ? String(config.projectFolder)
    : `Projects${path.sep}${path.basename(REPO_ROOT)}`;
  const targetDir = path.resolve(vaultPath, projectFolder);
  copyDirectory(MEMORY_DIR, targetDir);
  return { enabled: true, targetDir };
}

function refreshMemory(options = {}) {
  ensureMemoryStructure();
  fs.writeFileSync(FILES.startHere, buildStartHereDoc(), 'utf8');
  fs.writeFileSync(FILES.index, buildIndex(), 'utf8');
  fs.writeFileSync(FILES.projectState, buildProjectState(), 'utf8');
  fs.writeFileSync(FILES.architecture, buildArchitectureDoc(), 'utf8');
  fs.writeFileSync(FILES.methods, buildMethodsDoc(), 'utf8');
  fs.writeFileSync(FILES.engineeringStyle, buildEngineeringStyleDoc(), 'utf8');
  fs.writeFileSync(FILES.sessionProtocol, buildSessionProtocolDoc(), 'utf8');
  fs.writeFileSync(FILES.recentCommits, buildRecentCommits(40), 'utf8');
  fs.writeFileSync(FILES.worktreeStatus, buildWorktreeStatus(), 'utf8');

  let sync = { enabled: false, reason: 'sync-skipped' };
  if (options.sync !== false) {
    sync = syncToObsidian();
  }

  return {
    generatedAt: formatTimestamp(new Date()),
    sync
  };
}

function installPostCommitHook() {
  const hooksDir = path.join(REPO_ROOT, '.git', 'hooks');
  ensureDir(hooksDir);

  const hookPath = path.join(hooksDir, 'post-commit');
  const markerStart = '# >>> agent-memory >>>';
  const markerEnd = '# <<< agent-memory <<<';
  const snippet = [
    markerStart,
    'REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"',
    'if [ -n "$REPO_ROOT" ]; then',
    '  node "$REPO_ROOT/tools/agent-memory/post-commit.js" >/dev/null 2>&1 || true',
    'fi',
    markerEnd,
    ''
  ].join('\n');

  let content = fs.existsSync(hookPath) ? fs.readFileSync(hookPath, 'utf8') : '#!/bin/sh\n';
  if (content.includes(markerStart)) {
    return {
      installed: false,
      reason: 'already-installed',
      hookPath
    };
  }

  if (!content.startsWith('#!')) {
    content = `#!/bin/sh\n\n${content}`;
  }
  if (!content.endsWith('\n')) {
    content += '\n';
  }

  content += `\n${snippet}`;
  fs.writeFileSync(hookPath, content, 'utf8');

  try {
    fs.chmodSync(hookPath, 0o755);
  } catch (error) {
    // ignore chmod errors on filesystems that do not support Unix mode bits
  }

  return {
    installed: true,
    reason: 'installed',
    hookPath
  };
}

module.exports = {
  FILES,
  LOCAL_CONFIG_FILE,
  MEMORY_DIR,
  REPO_ROOT,
  appendChangelogEntry,
  appendSessionEntry,
  detectWorkingTreeFiles,
  formatTimestamp,
  getChangedFilesFromCommit,
  getHeadCommit,
  installPostCommitHook,
  parseCliArgs,
  readText,
  refreshMemory,
  runGit,
  splitList,
  syncToObsidian
};
