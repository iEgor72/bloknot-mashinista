const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const DATABASE_FILE_NAME = 'bloknot.sqlite3';
const BACKUP_DIR_NAME = 'backups';
const MAX_ANALYTICS_EVENTS_PER_USER = 10000;
const MAX_ANALYTICS_SESSIONS_PER_USER = 200;

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
  {
    version: 3,
    name: 'privacy-safe product analytics',
    sql: `
      CREATE TABLE IF NOT EXISTS analytics_consents (
        sid TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('granted', 'denied')),
        policy_version TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS analytics_sessions (
        session_id TEXT PRIMARY KEY,
        sid TEXT NOT NULL,
        started_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        ended_at TEXT,
        platform TEXT NOT NULL DEFAULT 'unknown',
        app_version TEXT NOT NULL DEFAULT ''
      );

      CREATE INDEX IF NOT EXISTS analytics_sessions_sid_last_seen_idx
        ON analytics_sessions (sid, last_seen_at);

      CREATE TABLE IF NOT EXISTS analytics_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        sid TEXT NOT NULL,
        session_id TEXT NOT NULL,
        event_name TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        received_at TEXT NOT NULL,
        platform TEXT NOT NULL DEFAULT 'unknown',
        app_version TEXT NOT NULL DEFAULT '',
        properties TEXT NOT NULL DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS analytics_events_occurred_idx
        ON analytics_events (occurred_at);

      CREATE INDEX IF NOT EXISTS analytics_events_sid_occurred_idx
        ON analytics_events (sid, occurred_at);

      CREATE INDEX IF NOT EXISTS analytics_events_name_occurred_idx
        ON analytics_events (event_name, occurred_at);
    `,
  },
  {
    version: 4,
    name: 'scope analytics sessions by user',
    sql: `
      CREATE TABLE analytics_sessions_v4 (
        sid TEXT NOT NULL,
        session_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        ended_at TEXT,
        platform TEXT NOT NULL DEFAULT 'unknown',
        app_version TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (sid, session_id)
      );

      INSERT INTO analytics_sessions_v4
        (sid, session_id, started_at, last_seen_at, ended_at, platform, app_version)
      SELECT sid, session_id, started_at, last_seen_at, ended_at, platform, app_version
      FROM analytics_sessions;

      DROP TABLE analytics_sessions;
      ALTER TABLE analytics_sessions_v4 RENAME TO analytics_sessions;

      CREATE INDEX analytics_sessions_sid_last_seen_idx
        ON analytics_sessions (sid, last_seen_at);
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
      readAnalyticsConsent: this.db.prepare(`
        SELECT status, policy_version, updated_at FROM analytics_consents WHERE sid = ?
      `),
      writeAnalyticsConsent: this.db.prepare(`
        INSERT INTO analytics_consents (sid, status, policy_version, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET
          status = excluded.status,
          policy_version = excluded.policy_version,
          updated_at = excluded.updated_at
      `),
      insertAnalyticsEvent: this.db.prepare(`
        INSERT OR IGNORE INTO analytics_events
          (event_id, sid, session_id, event_name, occurred_at, received_at, platform, app_version, properties)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      upsertAnalyticsSession: this.db.prepare(`
        INSERT INTO analytics_sessions
          (session_id, sid, started_at, last_seen_at, ended_at, platform, app_version)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(sid, session_id) DO UPDATE SET
          started_at = CASE
            WHEN excluded.started_at < analytics_sessions.started_at THEN excluded.started_at
            ELSE analytics_sessions.started_at
          END,
          last_seen_at = CASE
            WHEN excluded.last_seen_at > analytics_sessions.last_seen_at THEN excluded.last_seen_at
            ELSE analytics_sessions.last_seen_at
          END,
          ended_at = COALESCE(excluded.ended_at, analytics_sessions.ended_at),
          platform = CASE WHEN excluded.platform != 'unknown' THEN excluded.platform ELSE analytics_sessions.platform END,
          app_version = CASE WHEN excluded.app_version != '' THEN excluded.app_version ELSE analytics_sessions.app_version END
      `),
      deleteExpiredAnalyticsEvents: this.db.prepare('DELETE FROM analytics_events WHERE received_at < ?'),
      trimAnalyticsEventsForUser: this.db.prepare(`
        DELETE FROM analytics_events
        WHERE sid = ? AND id NOT IN (
          SELECT id FROM analytics_events WHERE sid = ? ORDER BY id DESC LIMIT ?
        )
      `),
      trimAnalyticsSessionsForUser: this.db.prepare(`
        DELETE FROM analytics_sessions
        WHERE sid = ? AND session_id NOT IN (
          SELECT session_id FROM analytics_sessions WHERE sid = ? ORDER BY last_seen_at DESC LIMIT ?
        )
      `),
      deleteAnalyticsEventsForUser: this.db.prepare('DELETE FROM analytics_events WHERE sid = ?'),
      deleteAnalyticsSessionsForUser: this.db.prepare('DELETE FROM analytics_sessions WHERE sid = ?'),
      deleteAnalyticsConsentForUser: this.db.prepare('DELETE FROM analytics_consents WHERE sid = ?'),
    };
    this.replaceShiftsTransaction = this.db.transaction((sid, shifts) => {
      this.statements.deleteShifts.run(sid);
      const now = new Date().toISOString();
      this.statements.upsertShiftOwner.run(sid, now);
      shifts.forEach((shift, position) => {
        this.statements.insertShift.run(sid, String(shift.id), position, JSON.stringify(shift), now);
      });
    });
    this.recordAnalyticsEventsTransaction = this.db.transaction((sid, events, receivedAt) => {
      let inserted = 0;
      events.forEach((event) => {
        if (event.eventName !== 'session_heartbeat') {
          const result = this.statements.insertAnalyticsEvent.run(
            event.eventId,
            sid,
            event.sessionId,
            event.eventName,
            event.occurredAt,
            receivedAt,
            event.platform,
            event.appVersion,
            JSON.stringify(event.properties || {})
          );
          inserted += Number(result.changes) || 0;
        }
        this.statements.upsertAnalyticsSession.run(
          event.sessionId,
          sid,
          event.occurredAt,
          event.occurredAt,
          event.eventName === 'session_ended' ? event.occurredAt : null,
          event.platform,
          event.appVersion
        );
      });
      return inserted;
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

  readAnalyticsConsent(sid) {
    const row = this.statements.readAnalyticsConsent.get(String(sid));
    return row ? {
      status: String(row.status),
      policyVersion: String(row.policy_version),
      updatedAt: String(row.updated_at),
    } : null;
  }

  writeAnalyticsConsent(sid, status, policyVersion) {
    const updatedAt = new Date().toISOString();
    this.statements.writeAnalyticsConsent.run(String(sid), String(status), String(policyVersion), updatedAt);
    return { status: String(status), policyVersion: String(policyVersion), updatedAt };
  }

  recordAnalyticsEvents(sid, events, retentionDays) {
    const receivedAt = new Date().toISOString();
    const inserted = this.recordAnalyticsEventsTransaction(String(sid), events, receivedAt);
    const days = Math.max(30, Math.min(730, Number(retentionDays) || 180));
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    this.statements.deleteExpiredAnalyticsEvents.run(cutoff);
    this.statements.trimAnalyticsEventsForUser.run(String(sid), String(sid), MAX_ANALYTICS_EVENTS_PER_USER);
    this.statements.trimAnalyticsSessionsForUser.run(String(sid), String(sid), MAX_ANALYTICS_SESSIONS_PER_USER);
    return { inserted, receivedAt };
  }

  deleteAnalyticsForUser(sid, preserveConsent) {
    const userId = String(sid);
    const removedEvents = Number(this.statements.deleteAnalyticsEventsForUser.run(userId).changes) || 0;
    const removedSessions = Number(this.statements.deleteAnalyticsSessionsForUser.run(userId).changes) || 0;
    if (!preserveConsent) this.statements.deleteAnalyticsConsentForUser.run(userId);
    return { removedEvents, removedSessions };
  }

  buildAnalyticsDashboard(days) {
    const periodDays = Math.max(1, Math.min(365, Number(days) || 30));
    const now = Date.now();
    const startAt = new Date(now - periodDays * 86400000).toISOString();
    const previousStartAt = new Date(now - periodDays * 2 * 86400000).toISOString();
    const db = this.db;
    const scalar = (sql, params) => {
      const row = db.prepare(sql).get(...(params || []));
      return Number(row && row.value) || 0;
    };
    const uniqueUsers = (from, to) => scalar(
      'SELECT COUNT(DISTINCT sid) AS value FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ?',
      [from, to]
    );
    const eventCount = (name) => scalar(
      'SELECT COUNT(*) AS value FROM analytics_events WHERE event_name = ? AND occurred_at >= ?',
      [name, startAt]
    );
    const activeSince = (daysBack) => scalar(
      'SELECT COUNT(DISTINCT sid) AS value FROM analytics_events WHERE occurred_at >= ?',
      [new Date(now - daysBack * 86400000).toISOString()]
    );
    const featureRows = db.prepare(`
      SELECT event_name AS eventName, COUNT(*) AS events, COUNT(DISTINCT sid) AS users
      FROM analytics_events
      WHERE occurred_at >= ?
      GROUP BY event_name
      ORDER BY users DESC, events DESC, event_name
    `).all(startAt).map((row) => ({
      eventName: String(row.eventName),
      events: Number(row.events) || 0,
      users: Number(row.users) || 0,
    }));
    const daily = db.prepare(`
      SELECT substr(occurred_at, 1, 10) AS day,
             COUNT(DISTINCT sid) AS users,
             SUM(CASE WHEN event_name = 'shift_saved' THEN 1 ELSE 0 END) AS shifts
      FROM analytics_events
      WHERE occurred_at >= ?
      GROUP BY substr(occurred_at, 1, 10)
      ORDER BY day
    `).all(startAt).map((row) => ({
      day: String(row.day),
      users: Number(row.users) || 0,
      shifts: Number(row.shifts) || 0,
    }));
    const retentionRows = db.prepare(`
      WITH first_seen AS (
        SELECT sid, MIN(occurred_at) AS first_at
        FROM analytics_events
        GROUP BY sid
      )
      SELECT
        COUNT(*) AS cohort,
        SUM(CASE WHEN first_at <= ? THEN 1 ELSE 0 END) AS d1_eligible,
        SUM(CASE WHEN first_at <= ? AND EXISTS (
          SELECT 1 FROM analytics_events e
          WHERE e.sid = f.sid AND julianday(e.occurred_at) >= julianday(f.first_at, '+1 day')
        ) THEN 1 ELSE 0 END) AS d1_returned,
        SUM(CASE WHEN first_at <= ? THEN 1 ELSE 0 END) AS d7_eligible,
        SUM(CASE WHEN first_at <= ? AND EXISTS (
          SELECT 1 FROM analytics_events e
          WHERE e.sid = f.sid AND julianday(e.occurred_at) >= julianday(f.first_at, '+7 day')
        ) THEN 1 ELSE 0 END) AS d7_returned,
        SUM(CASE WHEN first_at <= ? THEN 1 ELSE 0 END) AS d30_eligible,
        SUM(CASE WHEN first_at <= ? AND EXISTS (
          SELECT 1 FROM analytics_events e
          WHERE e.sid = f.sid AND julianday(e.occurred_at) >= julianday(f.first_at, '+30 day')
        ) THEN 1 ELSE 0 END) AS d30_returned
      FROM first_seen f
      WHERE f.first_at >= ?
    `).get(
      new Date(now - 86400000).toISOString(),
      new Date(now - 86400000).toISOString(),
      new Date(now - 7 * 86400000).toISOString(),
      new Date(now - 7 * 86400000).toISOString(),
      new Date(now - 30 * 86400000).toISOString(),
      new Date(now - 30 * 86400000).toISOString(),
      startAt
    ) || {};
    const cohort = Number(retentionRows.cohort) || 0;
    const d1Eligible = Number(retentionRows.d1_eligible) || 0;
    const d7Eligible = Number(retentionRows.d7_eligible) || 0;
    const d30Eligible = Number(retentionRows.d30_eligible) || 0;
    const retention = {
      cohort,
      eligible: { d1: d1Eligible, d7: d7Eligible, d30: d30Eligible },
      d1: d1Eligible ? Math.round((Number(retentionRows.d1_returned) || 0) * 1000 / d1Eligible) / 10 : 0,
      d7: d7Eligible ? Math.round((Number(retentionRows.d7_returned) || 0) * 1000 / d7Eligible) / 10 : 0,
      d30: d30Eligible ? Math.round((Number(retentionRows.d30_returned) || 0) * 1000 / d30Eligible) / 10 : 0,
    };
    const consentRows = db.prepare(`
      SELECT status, COUNT(*) AS count FROM analytics_consents GROUP BY status
    `).all();
    const consents = { granted: 0, denied: 0 };
    consentRows.forEach((row) => { consents[String(row.status)] = Number(row.count) || 0; });
    const users = db.prepare(`
      SELECT sid,
             MIN(occurred_at) AS firstSeenAt,
             MAX(occurred_at) AS lastSeenAt,
             COUNT(*) AS events,
             COUNT(DISTINCT session_id) AS sessions,
             COUNT(DISTINCT substr(occurred_at, 1, 10)) AS activeDays,
             SUM(CASE WHEN event_name = 'shift_saved' THEN 1 ELSE 0 END) AS shifts
      FROM analytics_events
      GROUP BY sid
      ORDER BY lastSeenAt DESC
      LIMIT 100
    `).all().map((row) => {
      const lastSeenMs = Date.parse(row.lastSeenAt || '');
      const inactiveDays = Number.isFinite(lastSeenMs) ? Math.max(0, Math.floor((now - lastSeenMs) / 86400000)) : null;
      return {
        userKey: crypto.createHash('sha256').update(String(row.sid)).digest('hex').slice(0, 10),
        firstSeenAt: String(row.firstSeenAt || ''),
        lastSeenAt: String(row.lastSeenAt || ''),
        inactiveDays,
        lifecycle: inactiveDays === null ? 'unknown' : inactiveDays <= 7 ? 'active' : inactiveDays <= 30 ? 'cooling' : 'churned',
        events: Number(row.events) || 0,
        sessions: Number(row.sessions) || 0,
        activeDays: Number(row.activeDays) || 0,
        shifts: Number(row.shifts) || 0,
      };
    });
    const recentEvents = db.prepare(`
      SELECT sid, event_name AS eventName, occurred_at AS occurredAt, properties
      FROM analytics_events
      WHERE occurred_at >= ?
      ORDER BY occurred_at DESC, id DESC
      LIMIT 200
    `).all(startAt).map((row) => ({
      userKey: crypto.createHash('sha256').update(String(row.sid)).digest('hex').slice(0, 10),
      eventName: String(row.eventName),
      occurredAt: String(row.occurredAt),
      properties: parsePayload(row.properties, {}),
    }));
    const averageSessionMinutes = db.prepare(`
      SELECT AVG(MAX(0, (julianday(COALESCE(ended_at, last_seen_at)) - julianday(started_at)) * 1440)) AS value
      FROM analytics_sessions
      WHERE last_seen_at >= ?
    `).get(startAt);
    return {
      generatedAt: new Date().toISOString(),
      periodDays,
      periodStart: startAt,
      metrics: {
        activeUsers: uniqueUsers(startAt, new Date(now + 1000).toISOString()),
        previousActiveUsers: uniqueUsers(previousStartAt, startAt),
        dau: activeSince(1),
        wau: activeSince(7),
        mau: activeSince(30),
        sessions: scalar('SELECT COUNT(*) AS value FROM analytics_sessions WHERE last_seen_at >= ?', [startAt]),
        averageSessionMinutes: Math.round((Number(averageSessionMinutes && averageSessionMinutes.value) || 0) * 10) / 10,
        shiftsSaved: eventCount('shift_saved'),
        firstShifts: eventCount('first_shift_saved'),
        syncErrors: eventCount('shift_sync_failed'),
      },
      funnel: [
        { eventName: 'app_opened', label: 'Открыли приложение', users: featureRows.find((row) => row.eventName === 'app_opened')?.users || 0 },
        { eventName: 'shift_form_started', label: 'Начали смену', users: featureRows.find((row) => row.eventName === 'shift_form_started')?.users || 0 },
        { eventName: 'first_shift_saved', label: 'Сохранили первую смену', users: featureRows.find((row) => row.eventName === 'first_shift_saved')?.users || 0 },
        { eventName: 'salary_opened', label: 'Открыли расчёт', users: featureRows.find((row) => row.eventName === 'salary_opened')?.users || 0 },
        { eventName: 'third_shift_saved', label: 'Сохранили третью смену', users: featureRows.find((row) => row.eventName === 'third_shift_saved')?.users || 0 },
      ],
      retention,
      consents,
      daily,
      events: featureRows,
      users,
      recentEvents,
    };
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
