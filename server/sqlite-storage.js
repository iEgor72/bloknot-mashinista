const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const DATABASE_FILE_NAME = 'bloknot.sqlite3';
const BACKUP_DIR_NAME = 'backups';

const MIGRATIONS = [
  {
    version: 1,
    name: 'initial durable state',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_state (
        kind TEXT NOT NULL,
        sid TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (kind, sid)
      );

      CREATE TABLE IF NOT EXISTS shifts (
        sid TEXT NOT NULL,
        shift_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (sid, shift_id)
      );

      CREATE INDEX IF NOT EXISTS shifts_sid_position_idx
        ON shifts (sid, position);

      CREATE TABLE IF NOT EXISTS legacy_imports (
        source_path TEXT PRIMARY KEY,
        source_sha256 TEXT NOT NULL,
        target_kind TEXT NOT NULL,
        target_key TEXT NOT NULL,
        imported_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    name: 'preserve empty shift journal owners',
    sql: `
      CREATE TABLE IF NOT EXISTS shift_owners (
        sid TEXT PRIMARY KEY,
        updated_at TEXT NOT NULL
      );

      INSERT OR IGNORE INTO shift_owners (sid, updated_at)
      SELECT DISTINCT sid, MAX(updated_at) FROM shifts GROUP BY sid;
    `,
  },
];

function cloneFallback(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function parsePayload(payload, fallback) {
  try {
    return JSON.parse(payload);
  } catch (_) {
    return cloneFallback(fallback);
  }
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function safeIsoForFileName(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function inspectSqliteDatabase(databasePath) {
  const db = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const integrityRows = db.pragma('integrity_check');
    const integrity = integrityRows.map((row) => String(row.integrity_check || '')).filter(Boolean);
    if (integrity.length !== 1 || integrity[0].toLowerCase() !== 'ok') {
      throw new Error(`SQLite integrity check failed: ${integrity.join('; ') || 'unknown error'}`);
    }
    const migrations = db.prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version').all();
    return { ok: true, migrations };
  } finally {
    db.close();
  }
}

function restoreSqliteBackup(options) {
  const backupPath = path.resolve(options && options.backupPath ? options.backupPath : '');
  const databasePath = path.resolve(options && options.databasePath ? options.databasePath : '');
  if (!backupPath || !databasePath || backupPath === databasePath) {
    throw new Error('Backup and database paths must be different');
  }
  if (!fs.existsSync(backupPath) || !fs.statSync(backupPath).isFile()) {
    throw new Error(`Backup not found: ${backupPath}`);
  }

  inspectSqliteDatabase(backupPath);
  ensureDirectory(path.dirname(databasePath));

  const stamp = safeIsoForFileName(new Date());
  const restoreTempPath = `${databasePath}.restore-${process.pid}-${Date.now()}.tmp`;
  const previousPath = fs.existsSync(databasePath) ? `${databasePath}.before-restore-${stamp}` : '';
  const sidecars = ['-wal', '-shm'];
  fs.copyFileSync(backupPath, restoreTempPath);
  inspectSqliteDatabase(restoreTempPath);

  if (previousPath) fs.renameSync(databasePath, previousPath);
  if (previousPath) {
    sidecars.forEach((suffix) => {
      const sidecarPath = databasePath + suffix;
      if (fs.existsSync(sidecarPath)) fs.renameSync(sidecarPath, previousPath + suffix);
    });
  }
  try {
    fs.renameSync(restoreTempPath, databasePath);
  } catch (error) {
    if (previousPath && fs.existsSync(previousPath) && !fs.existsSync(databasePath)) {
      fs.renameSync(previousPath, databasePath);
      sidecars.forEach((suffix) => {
        if (fs.existsSync(previousPath + suffix)) fs.renameSync(previousPath + suffix, databasePath + suffix);
      });
    }
    throw error;
  }

  return { databasePath, backupPath, previousPath };
}

class SqliteStorage {
  constructor(options) {
    const config = options || {};
    this.dataDir = path.resolve(config.dataDir || path.join(process.cwd(), 'data'));
    this.databasePath = path.resolve(config.databasePath || path.join(this.dataDir, DATABASE_FILE_NAME));
    this.backupDir = path.resolve(config.backupDir || path.join(this.dataDir, BACKUP_DIR_NAME));
    this.logger = typeof config.logger === 'function' ? config.logger : null;
    this.closed = false;

    ensureDirectory(this.dataDir);
    ensureDirectory(this.backupDir);
    this.backupBeforeSchemaMigration();
    this.db = new Database(this.databasePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = FULL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.applyMigrations();
    this.prepareStatements();
  }

  log(event, meta) {
    if (this.logger) this.logger(event, meta || {});
  }

  backupBeforeSchemaMigration() {
    if (!fs.existsSync(this.databasePath) || fs.statSync(this.databasePath).size === 0) return;
    let currentVersion = 0;
    try {
      const existing = new Database(this.databasePath, { readonly: true, fileMustExist: true });
      try {
        const hasMigrations = existing.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get();
        if (hasMigrations) {
          const row = existing.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations').get();
          currentVersion = Number(row && row.version) || 0;
        }
      } finally {
        existing.close();
      }
    } catch (_) {
      return;
    }

    const targetVersion = MIGRATIONS[MIGRATIONS.length - 1].version;
    if (currentVersion >= targetVersion) return;
    const destination = path.join(this.backupDir, `pre-migration-v${currentVersion}-${safeIsoForFileName(new Date())}.sqlite3`);
    fs.copyFileSync(this.databasePath, destination);
    this.log('storage.pre_migration_backup_created', { destination, currentVersion, targetVersion });
  }

  applyMigrations() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
    const applied = new Set(this.db.prepare('SELECT version FROM schema_migrations').all().map((row) => Number(row.version)));
    const record = this.db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)');

    MIGRATIONS.forEach((migration) => {
      if (applied.has(migration.version)) return;
      this.db.transaction(() => {
        this.db.exec(migration.sql);
        record.run(migration.version, migration.name, new Date().toISOString());
      })();
      this.log('storage.migration_applied', { version: migration.version, name: migration.name });
    });
  }

  prepareStatements() {
    this.statements = {
      readAppState: this.db.prepare('SELECT payload FROM app_state WHERE key = ?'),
      hasAppState: this.db.prepare('SELECT 1 AS present FROM app_state WHERE key = ?'),
      writeAppState: this.db.prepare(`
        INSERT INTO app_state (key, payload, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
      `),
      readUserState: this.db.prepare('SELECT payload FROM user_state WHERE kind = ? AND sid = ?'),
      hasUserState: this.db.prepare('SELECT 1 AS present FROM user_state WHERE kind = ? AND sid = ?'),
      writeUserState: this.db.prepare(`
        INSERT INTO user_state (kind, sid, payload, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(kind, sid) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
      `),
      deleteShifts: this.db.prepare('DELETE FROM shifts WHERE sid = ?'),
      insertShift: this.db.prepare('INSERT INTO shifts (sid, shift_id, position, payload, updated_at) VALUES (?, ?, ?, ?, ?)'),
      readShifts: this.db.prepare('SELECT payload FROM shifts WHERE sid = ? ORDER BY position, shift_id'),
      upsertShiftOwner: this.db.prepare(`
        INSERT INTO shift_owners (sid, updated_at) VALUES (?, ?)
        ON CONFLICT(sid) DO UPDATE SET updated_at = excluded.updated_at
      `),
      listShiftUserIds: this.db.prepare('SELECT sid FROM shift_owners ORDER BY sid'),
      shiftCount: this.db.prepare('SELECT COUNT(*) AS count FROM shifts WHERE sid = ?'),
      readLegacyImport: this.db.prepare('SELECT source_path FROM legacy_imports WHERE source_path = ?'),
      writeLegacyImport: this.db.prepare(`
        INSERT INTO legacy_imports (source_path, source_sha256, target_kind, target_key, imported_at)
        VALUES (?, ?, ?, ?, ?)
      `),
    };
    this.replaceShiftsTransaction = this.db.transaction((sid, shifts) => {
      this.statements.deleteShifts.run(sid);
      const now = new Date().toISOString();
      this.statements.upsertShiftOwner.run(sid, now);
      shifts.forEach((shift, position) => {
        this.statements.insertShift.run(sid, String(shift.id), position, JSON.stringify(shift), now);
      });
    });
  }

  readAppState(key, fallback) {
    const row = this.statements.readAppState.get(String(key));
    return row ? parsePayload(row.payload, fallback) : cloneFallback(fallback);
  }

  hasAppState(key) {
    return !!this.statements.hasAppState.get(String(key));
  }

  writeAppState(key, value) {
    this.statements.writeAppState.run(String(key), JSON.stringify(value), new Date().toISOString());
  }

  readUserState(kind, sid, fallback) {
    const row = this.statements.readUserState.get(String(kind), String(sid));
    return row ? parsePayload(row.payload, fallback) : cloneFallback(fallback);
  }

  hasUserState(kind, sid) {
    return !!this.statements.hasUserState.get(String(kind), String(sid));
  }

  writeUserState(kind, sid, value) {
    this.statements.writeUserState.run(String(kind), String(sid), JSON.stringify(value), new Date().toISOString());
  }

  readShifts(sid) {
    return this.statements.readShifts.all(String(sid)).map((row) => parsePayload(row.payload, null)).filter(Boolean);
  }

  replaceShifts(sid, shifts) {
    const list = Array.isArray(shifts) ? shifts : [];
    this.replaceShiftsTransaction(String(sid), list);
  }

  listShiftUserIds() {
    return this.statements.listShiftUserIds.all().map((row) => String(row.sid));
  }

  importLegacyJson(config) {
    const settings = config || {};
    const report = { imported: [], skipped: [], errors: [] };
    const globalFiles = Array.isArray(settings.globalFiles) ? settings.globalFiles : [];
    const userDirectories = Array.isArray(settings.userDirectories) ? settings.userDirectories : [];

    const importOne = (sourcePath, targetKind, targetKey, apply) => {
      const absolutePath = path.resolve(sourcePath);
      if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) return;
      if (this.statements.readLegacyImport.get(absolutePath)) {
        report.skipped.push(absolutePath);
        return;
      }
      try {
        const raw = fs.readFileSync(absolutePath, 'utf8');
        const parsed = raw.trim() ? JSON.parse(raw) : null;
        const imported = apply(parsed);
        if (!imported) {
          report.skipped.push(absolutePath);
          return;
        }
        const digest = crypto.createHash('sha256').update(raw).digest('hex');
        this.statements.writeLegacyImport.run(absolutePath, digest, targetKind, targetKey, new Date().toISOString());
        report.imported.push(absolutePath);
      } catch (error) {
        report.errors.push({ sourcePath: absolutePath, message: error.message || String(error) });
      }
    };

    this.db.transaction(() => {
      globalFiles.forEach((item) => {
        importOne(item.path, 'app_state', item.key, (value) => {
          if (this.hasAppState(item.key)) return false;
          this.writeAppState(item.key, value === null ? item.fallback : value);
          return true;
        });
      });

      userDirectories.forEach((item) => {
        if (!fs.existsSync(item.path) || !fs.statSync(item.path).isDirectory()) return;
        fs.readdirSync(item.path, { withFileTypes: true }).forEach((entry) => {
          if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.json') return;
          const sid = path.basename(entry.name, '.json');
          const sourcePath = path.join(item.path, entry.name);
          importOne(sourcePath, item.kind, sid, (value) => {
            if (item.kind === 'shifts') {
              if (Number(this.statements.shiftCount.get(sid).count) > 0) return false;
              if (!Array.isArray(value)) throw new Error('Expected legacy shifts array');
              this.replaceShifts(sid, value);
              return true;
            }
            if (this.hasUserState(item.kind, sid)) return false;
            this.writeUserState(item.kind, sid, value === null ? item.fallback : value);
            return true;
          });
        });
      });
    })();

    if (report.imported.length || report.errors.length) {
      this.log('storage.legacy_import_finished', report);
    }
    return report;
  }

  async createBackup(label) {
    if (this.closed) throw new Error('Storage is closed');
    ensureDirectory(this.backupDir);
    const safeLabel = String(label || 'manual').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 48) || 'manual';
    const destination = path.join(this.backupDir, `${safeLabel}-${safeIsoForFileName(new Date())}.sqlite3`);
    await this.db.backup(destination);
    inspectSqliteDatabase(destination);
    this.log('storage.backup_created', { destination });
    return destination;
  }

  checkpoint() {
    if (!this.closed) this.db.pragma('wal_checkpoint(TRUNCATE)');
  }

  close() {
    if (this.closed) return;
    this.checkpoint();
    this.db.close();
    this.closed = true;
  }
}

function createSqliteStorage(options) {
  return new SqliteStorage(options);
}

module.exports = {
  DATABASE_FILE_NAME,
  createSqliteStorage,
  inspectSqliteDatabase,
  restoreSqliteBackup,
};
