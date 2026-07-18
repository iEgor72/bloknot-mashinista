#!/usr/bin/env node

const path = require('path');
const {
  DATABASE_FILE_NAME,
  createSqliteStorage,
  inspectSqliteDatabase,
  restoreSqliteBackup,
} = require('../server/sqlite-storage');

const command = String(process.argv[2] || '').trim().toLowerCase();
const args = process.argv.slice(3);
const root = path.resolve(__dirname, '..');
const dataDir = path.resolve(process.env.APP_DATA_DIR || path.join(root, 'data'));
const databasePath = path.join(dataDir, DATABASE_FILE_NAME);

function usage() {
  console.log([
    'Usage:',
    '  node scripts/storage-maintenance.js backup [label]',
    '  node scripts/storage-maintenance.js check [database-or-backup-path]',
    '  node scripts/storage-maintenance.js restore <backup-path> --confirm',
    '',
    'Stop the application before restore. The previous database is retained as',
    'bloknot.sqlite3.before-restore-<timestamp>.',
  ].join('\n'));
}

async function main() {
  if (command === 'backup') {
    const storage = createSqliteStorage({ dataDir });
    try {
      const destination = await storage.createBackup(args[0] || 'manual');
      console.log(destination);
    } finally {
      storage.close();
    }
    return;
  }

  if (command === 'check') {
    const target = path.resolve(args[0] || databasePath);
    const result = inspectSqliteDatabase(target);
    console.log(JSON.stringify({ path: target, ...result }, null, 2));
    return;
  }

  if (command === 'restore') {
    const backupArg = args.find((arg) => arg !== '--confirm');
    if (!backupArg || !args.includes('--confirm')) {
      usage();
      process.exitCode = 2;
      return;
    }
    const result = restoreSqliteBackup({
      backupPath: path.resolve(backupArg),
      databasePath,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  usage();
  process.exitCode = 2;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
