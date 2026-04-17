#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { appendChangelogEntry, parseCliArgs, refreshMemory, REPO_ROOT } = require('./lib');

const PID_FILE = path.join(REPO_ROOT, '.agent-memory.watcher.pid');
const DEBOUNCE_MS = 8000;
const MAX_FILES_PER_ENTRY = 120;

const IGNORED_PREFIXES = [
  '.git/',
  'node_modules/',
  'ai-memory/',
  '.netlify/',
  '.wrangler/',
  'data/',
  '.claude/'
];

const IGNORED_EXACT = new Set([
  '.git',
  'node_modules',
  'ai-memory',
  '.netlify',
  '.wrangler',
  'data',
  '.claude',
  '.agent-memory.watcher.pid'
]);

function readPid() {
  try {
    const raw = fs.readFileSync(PID_FILE, 'utf8').trim();
    const pid = Number(raw);
    return Number.isInteger(pid) && pid > 0 ? pid : 0;
  } catch (error) {
    return 0;
  }
}

function writePid(pid) {
  fs.writeFileSync(PID_FILE, `${pid}\n`, 'utf8');
}

function removePidIfOwned() {
  try {
    const current = readPid();
    if (current === process.pid && fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch (error) {
    // ignore cleanup errors
  }
}

function isPidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

function stopPid(pid) {
  if (!pid || !isPidAlive(pid)) return false;
  try {
    process.kill(pid);
    return true;
  } catch (error) {
    return false;
  }
}

function normalizeRelativePath(fileName) {
  const raw = String(fileName || '').trim();
  if (!raw) return '';
  const rel = raw.replace(/\\/g, '/').replace(/^\.\//, '');
  return rel;
}

function shouldIgnorePath(relativePath) {
  if (!relativePath) return true;
  if (IGNORED_EXACT.has(relativePath)) return true;
  for (const prefix of IGNORED_PREFIXES) {
    if (relativePath.startsWith(prefix)) return true;
  }
  return false;
}

function spawnDaemon() {
  const existing = readPid();
  if (existing && isPidAlive(existing)) {
    console.log(`[memory-watch] already running (pid ${existing})`);
    return;
  }
  if (existing && !isPidAlive(existing)) {
    removePidIfOwned();
    try {
      fs.unlinkSync(PID_FILE);
    } catch (error) {}
  }

  const child = spawn(process.execPath, [__filename, '--run'], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();
  console.log(`[memory-watch] started daemon (pid ${child.pid})`);
}

function printStatus() {
  const pid = readPid();
  if (!pid) {
    console.log('[memory-watch] status: stopped');
    return;
  }
  if (isPidAlive(pid)) {
    console.log(`[memory-watch] status: running (pid ${pid})`);
  } else {
    console.log(`[memory-watch] status: stale pid file (${pid}), watcher is not running`);
  }
}

function stopDaemon() {
  const pid = readPid();
  if (!pid) {
    console.log('[memory-watch] already stopped');
    return;
  }

  const stopped = stopPid(pid);
  try {
    fs.unlinkSync(PID_FILE);
  } catch (error) {}

  if (stopped) {
    console.log(`[memory-watch] stopped (pid ${pid})`);
  } else {
    console.log(`[memory-watch] pid ${pid} was not running`);
  }
}

function runWatcher() {
  const previous = readPid();
  if (previous && previous !== process.pid && isPidAlive(previous)) {
    console.log(`[memory-watch] another watcher is already running (pid ${previous})`);
    process.exit(0);
    return;
  }

  writePid(process.pid);

  let timer = null;
  let busy = false;
  const changedFiles = new Set();

  function queueRefresh(relativePath) {
    if (relativePath && !shouldIgnorePath(relativePath)) {
      changedFiles.add(relativePath);
    }

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(async () => {
      timer = null;
      if (busy) {
        queueRefresh('');
        return;
      }

      busy = true;
      const files = Array.from(changedFiles).sort();
      changedFiles.clear();

      try {
        if (files.length) {
          const sampledFiles = files.slice(0, MAX_FILES_PER_ENTRY);
          const notes =
            files.length > sampledFiles.length
              ? `Changed files total: ${files.length} (logged first ${sampledFiles.length}).`
              : '';

          appendChangelogEntry({
            source: 'file-watcher',
            task: 'Auto-refresh memory after local file changes',
            methods: ['fs.watch recursive', 'debounced memory refresh'],
            files: sampledFiles,
            notes
          });
        }

        refreshMemory();
        console.log(
          `[memory-watch] refreshed at ${new Date().toISOString()} (${files.length} changed file${
            files.length === 1 ? '' : 's'
          })`
        );
      } catch (error) {
        console.error('[memory-watch] refresh failed:', error && error.message ? error.message : error);
      } finally {
        busy = false;
      }
    }, DEBOUNCE_MS);
  }

  const watcher = fs.watch(
    REPO_ROOT,
    { recursive: true },
    (eventType, fileName) => {
      const relativePath = normalizeRelativePath(fileName);
      if (!relativePath) return;
      if (shouldIgnorePath(relativePath)) return;
      queueRefresh(relativePath);
    }
  );

  watcher.on('error', (error) => {
    console.error('[memory-watch] watcher error:', error && error.message ? error.message : error);
  });

  const shutdown = () => {
    try {
      watcher.close();
    } catch (error) {}
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    removePidIfOwned();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', removePidIfOwned);

  console.log(`[memory-watch] running (pid ${process.pid})`);
}

function main() {
  const args = parseCliArgs();

  if (args.stop) {
    stopDaemon();
    return;
  }

  if (args.status) {
    printStatus();
    return;
  }

  if (args.daemon) {
    spawnDaemon();
    return;
  }

  runWatcher();
}

main();
