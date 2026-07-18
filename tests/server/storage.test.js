const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  DATABASE_FILE_NAME,
  createSqliteStorage,
  inspectSqliteDatabase,
  restoreSqliteBackup,
} = require('../../server/sqlite-storage');

function createTempDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `bloknot-${label}-`));
}

function removeTempDir(directory, label) {
  if (path.basename(directory).startsWith(`bloknot-${label}-`)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('legacy JSON import is idempotent and leaves source files untouched', () => {
  const dataDir = createTempDir('storage-import');
  try {
    const shiftsDir = path.join(dataDir, 'local-shifts');
    const profilesDir = path.join(dataDir, 'local-profiles');
    fs.mkdirSync(shiftsDir, { recursive: true });
    fs.mkdirSync(profilesDir, { recursive: true });
    const shifts = [{ id: 'legacy-1', start_msk: '2026-01-01T08:00:00', end_msk: '2026-01-01T20:00:00', created_at: '2026-01-01T00:00:00Z' }];
    const profile = { firstName: 'Legacy', lastName: 'User' };
    const presence = { users: { 42: { firstSeenAt: '2026-01-01T00:00:00Z', lastSeenAt: '2026-01-02T00:00:00Z', platform: 'android' } }, sessions: {} };
    fs.writeFileSync(path.join(shiftsDir, '42.json'), JSON.stringify(shifts));
    fs.writeFileSync(path.join(profilesDir, '42.json'), JSON.stringify(profile));
    fs.writeFileSync(path.join(dataDir, 'user-presence.json'), JSON.stringify(presence));

    const storage = createSqliteStorage({ dataDir });
    const config = {
      globalFiles: [{ path: path.join(dataDir, 'user-presence.json'), key: 'user_presence', fallback: {} }],
      userDirectories: [
        { path: shiftsDir, kind: 'shifts', fallback: [] },
        { path: profilesDir, kind: 'profile', fallback: {} },
      ],
    };
    const first = storage.importLegacyJson(config);
    const second = storage.importLegacyJson(config);

    assert.equal(first.imported.length, 3);
    assert.equal(first.errors.length, 0);
    assert.equal(second.imported.length, 0);
    assert.equal(second.skipped.length, 3);
    assert.deepEqual(storage.readShifts('42'), shifts);
    assert.deepEqual(storage.readUserState('profile', '42', {}), profile);
    assert.deepEqual(storage.readAppState('user_presence', {}), presence);
    assert.ok(fs.existsSync(path.join(shiftsDir, '42.json')));
    assert.ok(fs.existsSync(path.join(profilesDir, '42.json')));
    storage.close();
  } finally {
    removeTempDir(dataDir, 'storage-import');
  }
});

test('verified backup restores the previous durable state', async () => {
  const dataDir = createTempDir('storage-restore');
  try {
    let storage = createSqliteStorage({ dataDir });
    storage.writeAppState('marker', { value: 'before' });
    storage.replaceShifts('77', [{ id: 'before', start_msk: 'a', end_msk: 'b', created_at: 'c' }]);
    const backupPath = await storage.createBackup('test');
    storage.writeAppState('marker', { value: 'after' });
    storage.replaceShifts('77', [{ id: 'after', start_msk: 'd', end_msk: 'e', created_at: 'f' }]);
    storage.close();

    const databasePath = path.join(dataDir, DATABASE_FILE_NAME);
    const restore = restoreSqliteBackup({ backupPath, databasePath });
    assert.ok(restore.previousPath);
    assert.ok(fs.existsSync(restore.previousPath));
    assert.equal(inspectSqliteDatabase(databasePath).ok, true);

    storage = createSqliteStorage({ dataDir });
    assert.deepEqual(storage.readAppState('marker', {}), { value: 'before' });
    assert.equal(storage.readShifts('77')[0].id, 'before');
    storage.close();
  } finally {
    removeTempDir(dataDir, 'storage-restore');
  }
});

test('an empty journal keeps its owner for aggregate user statistics', () => {
  const dataDir = createTempDir('storage-empty-owner');
  try {
    const storage = createSqliteStorage({ dataDir });
    storage.replaceShifts('empty-user', []);
    assert.deepEqual(storage.readShifts('empty-user'), []);
    assert.deepEqual(storage.listShiftUserIds(), ['empty-user']);
    storage.close();
  } finally {
    removeTempDir(dataDir, 'storage-empty-owner');
  }
});
