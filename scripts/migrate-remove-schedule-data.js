#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const dataDir = path.join(repoRoot, 'data');
const schedulesDir = path.join(dataDir, 'local-schedules');
const backupRoot = path.join(dataDir, 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(backupRoot, `schedule-removal-${timestamp}`);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function removeRecursive(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function main() {
  if (!fs.existsSync(schedulesDir)) {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: 'no schedule dir', schedulesDir }, null, 2));
    return;
  }

  ensureDir(backupDir);
  const backupTarget = path.join(backupDir, 'local-schedules');
  copyRecursive(schedulesDir, backupTarget);
  removeRecursive(schedulesDir);

  console.log(JSON.stringify({
    ok: true,
    removed: schedulesDir,
    backup: backupTarget,
  }, null, 2));
}

main();
