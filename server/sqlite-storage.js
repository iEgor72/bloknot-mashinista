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
  {
    version: 5,
    name: 'community scopes proposals reviews releases and elections',
    sql: `
      CREATE TABLE IF NOT EXISTS community_memberships (
        sid TEXT NOT NULL,
        scope_level TEXT NOT NULL CHECK (scope_level IN ('railway', 'depot', 'service_arm')),
        scope_key TEXT NOT NULL,
        railway_id TEXT NOT NULL DEFAULT '',
        depot_id TEXT NOT NULL DEFAULT '',
        service_arm_id TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN ('selected', 'pending', 'verified', 'suspended')),
        role TEXT NOT NULL CHECK (role IN ('member', 'reviewer', 'curator')),
        role_source TEXT NOT NULL DEFAULT 'self' CHECK (role_source IN ('self', 'admin', 'peer', 'election')),
        primary_scope INTEGER NOT NULL DEFAULT 0 CHECK (primary_scope IN (0, 1)),
        term_ends_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (sid, scope_level, scope_key)
      );

      CREATE INDEX IF NOT EXISTS community_memberships_scope_idx
        ON community_memberships (scope_level, scope_key, status, role);
      CREATE INDEX IF NOT EXISTS community_memberships_sid_idx
        ON community_memberships (sid, primary_scope DESC, updated_at DESC);

      CREATE TABLE IF NOT EXISTS community_proposals (
        id TEXT PRIMARY KEY,
        author_sid TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('document', 'speed', 'profile', 'object', 'geometry', 'section')),
        risk_level TEXT NOT NULL CHECK (risk_level IN ('normal', 'safety_restriction', 'safety_increase')),
        scope_level TEXT NOT NULL CHECK (scope_level IN ('network', 'railway', 'depot', 'service_arm', 'section')),
        scope_key TEXT NOT NULL,
        railway_id TEXT NOT NULL DEFAULT '',
        depot_id TEXT NOT NULL DEFAULT '',
        service_arm_id TEXT NOT NULL DEFAULT '',
        section_id TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        base_version TEXT NOT NULL DEFAULT '',
        change_payload TEXT NOT NULL DEFAULT '{}',
        evidence_payload TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL CHECK (status IN ('draft', 'reviewing', 'needs_info', 'accepted', 'published', 'rejected', 'disputed', 'withdrawn')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS community_proposals_scope_status_idx
        ON community_proposals (scope_level, scope_key, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS community_proposals_author_idx
        ON community_proposals (author_sid, updated_at DESC);

      CREATE TABLE IF NOT EXISTS community_reviews (
        proposal_id TEXT NOT NULL REFERENCES community_proposals(id) ON DELETE CASCADE,
        reviewer_sid TEXT NOT NULL,
        verdict TEXT NOT NULL CHECK (verdict IN ('confirm', 'needs_fix', 'reject', 'abstain')),
        notes TEXT NOT NULL DEFAULT '',
        review_weight INTEGER NOT NULL DEFAULT 1 CHECK (review_weight BETWEEN 0 AND 3),
        reviewer_role TEXT NOT NULL DEFAULT 'member' CHECK (reviewer_role IN ('member', 'reviewer', 'curator')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (proposal_id, reviewer_sid)
      );

      CREATE INDEX IF NOT EXISTS community_reviews_proposal_idx
        ON community_reviews (proposal_id, verdict, updated_at DESC);

      CREATE TABLE IF NOT EXISTS community_releases (
        id TEXT PRIMARY KEY,
        scope_level TEXT NOT NULL CHECK (scope_level IN ('network', 'railway', 'depot', 'service_arm', 'section')),
        scope_key TEXT NOT NULL,
        version INTEGER NOT NULL CHECK (version > 0),
        status TEXT NOT NULL CHECK (status IN ('published', 'rolled_back')),
        proposal_id TEXT REFERENCES community_proposals(id),
        payload TEXT NOT NULL DEFAULT '{}',
        payload_sha256 TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (scope_level, scope_key, version)
      );

      CREATE INDEX IF NOT EXISTS community_releases_scope_idx
        ON community_releases (scope_level, scope_key, version DESC);

      CREATE TABLE IF NOT EXISTS community_elections (
        id TEXT PRIMARY KEY,
        scope_level TEXT NOT NULL CHECK (scope_level IN ('depot', 'service_arm')),
        scope_key TEXT NOT NULL,
        railway_id TEXT NOT NULL DEFAULT '',
        depot_id TEXT NOT NULL DEFAULT '',
        service_arm_id TEXT NOT NULL DEFAULT '',
        election_kind TEXT NOT NULL DEFAULT 'curator' CHECK (election_kind IN ('curator', 'recall')),
        status TEXT NOT NULL CHECK (status IN ('draft', 'nominations', 'voting', 'closed', 'cancelled')),
        seats INTEGER NOT NULL DEFAULT 3 CHECK (seats BETWEEN 1 AND 7),
        quorum INTEGER NOT NULL DEFAULT 5 CHECK (quorum BETWEEN 2 AND 10000),
        starts_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        term_ends_at TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS community_elections_scope_idx
        ON community_elections (scope_level, scope_key, status, ends_at DESC);

      CREATE TABLE IF NOT EXISTS community_candidates (
        election_id TEXT NOT NULL REFERENCES community_elections(id) ON DELETE CASCADE,
        candidate_sid TEXT NOT NULL,
        nominated_by TEXT NOT NULL,
        statement TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN ('nominated', 'accepted', 'withdrawn', 'elected', 'not_elected')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (election_id, candidate_sid)
      );

      CREATE TABLE IF NOT EXISTS community_ballots (
        election_id TEXT NOT NULL REFERENCES community_elections(id) ON DELETE CASCADE,
        voter_sid TEXT NOT NULL,
        candidate_sid TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (election_id, voter_sid, candidate_sid),
        FOREIGN KEY (election_id, candidate_sid)
          REFERENCES community_candidates(election_id, candidate_sid) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS community_ballots_election_idx
        ON community_ballots (election_id, candidate_sid);

      CREATE TABLE IF NOT EXISTS community_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_sid TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        scope_key TEXT NOT NULL DEFAULT '',
        payload TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS community_audit_created_idx
        ON community_audit_log (created_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS community_audit_entity_idx
        ON community_audit_log (entity_type, entity_id, id DESC);
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
      upsertCommunityMembership: this.db.prepare(`
        INSERT INTO community_memberships
          (sid, scope_level, scope_key, railway_id, depot_id, service_arm_id, status, role,
           role_source, primary_scope, term_ends_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(sid, scope_level, scope_key) DO UPDATE SET
          railway_id = excluded.railway_id,
          depot_id = excluded.depot_id,
          service_arm_id = excluded.service_arm_id,
          status = excluded.status,
          role = excluded.role,
          role_source = excluded.role_source,
          primary_scope = excluded.primary_scope,
          term_ends_at = excluded.term_ends_at,
          updated_at = excluded.updated_at
      `),
      readCommunityMembership: this.db.prepare(`
        SELECT * FROM community_memberships WHERE sid = ? AND scope_level = ? AND scope_key = ?
      `),
      listCommunityMembershipsForSid: this.db.prepare(`
        SELECT * FROM community_memberships WHERE sid = ?
        ORDER BY primary_scope DESC, updated_at DESC, scope_level, scope_key
      `),
      listCommunityMemberships: this.db.prepare(`
        SELECT * FROM community_memberships
        ORDER BY updated_at DESC, sid, scope_level, scope_key LIMIT ?
      `),
      clearCommunityPrimaryMemberships: this.db.prepare(`
        UPDATE community_memberships SET primary_scope = 0, updated_at = ?
        WHERE sid = ? AND primary_scope = 1
      `),
      insertCommunityProposal: this.db.prepare(`
        INSERT INTO community_proposals
          (id, author_sid, kind, risk_level, scope_level, scope_key, railway_id, depot_id,
           service_arm_id, section_id, title, summary, base_version, change_payload,
           evidence_payload, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      readCommunityProposal: this.db.prepare('SELECT * FROM community_proposals WHERE id = ?'),
      listCommunityProposals: this.db.prepare(`
        SELECT * FROM community_proposals ORDER BY updated_at DESC, id DESC LIMIT ?
      `),
      updateCommunityProposalStatus: this.db.prepare(`
        UPDATE community_proposals SET status = ?, updated_at = ? WHERE id = ?
      `),
      upsertCommunityReview: this.db.prepare(`
        INSERT INTO community_reviews
          (proposal_id, reviewer_sid, verdict, notes, review_weight, reviewer_role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(proposal_id, reviewer_sid) DO UPDATE SET
          verdict = excluded.verdict,
          notes = excluded.notes,
          review_weight = excluded.review_weight,
          reviewer_role = excluded.reviewer_role,
          updated_at = excluded.updated_at
      `),
      listCommunityReviews: this.db.prepare(`
        SELECT * FROM community_reviews WHERE proposal_id = ? ORDER BY updated_at DESC, reviewer_sid
      `),
      insertCommunityRelease: this.db.prepare(`
        INSERT INTO community_releases
          (id, scope_level, scope_key, version, status, proposal_id, payload, payload_sha256, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      listCommunityReleases: this.db.prepare(`
        SELECT * FROM community_releases ORDER BY created_at DESC, id DESC LIMIT ?
      `),
      insertCommunityElection: this.db.prepare(`
        INSERT INTO community_elections
          (id, scope_level, scope_key, railway_id, depot_id, service_arm_id, election_kind,
           status, seats, quorum, starts_at, ends_at, term_ends_at, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      readCommunityElection: this.db.prepare('SELECT * FROM community_elections WHERE id = ?'),
      listCommunityElections: this.db.prepare(`
        SELECT * FROM community_elections ORDER BY updated_at DESC, id DESC LIMIT ?
      `),
      updateCommunityElectionStatus: this.db.prepare(`
        UPDATE community_elections SET status = ?, updated_at = ? WHERE id = ?
      `),
      upsertCommunityCandidate: this.db.prepare(`
        INSERT INTO community_candidates
          (election_id, candidate_sid, nominated_by, statement, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(election_id, candidate_sid) DO UPDATE SET
          statement = excluded.statement,
          status = excluded.status,
          updated_at = excluded.updated_at
      `),
      listCommunityCandidates: this.db.prepare(`
        SELECT c.*, COUNT(b.voter_sid) AS votes
        FROM community_candidates c
        LEFT JOIN community_ballots b
          ON b.election_id = c.election_id AND b.candidate_sid = c.candidate_sid
        WHERE c.election_id = ?
        GROUP BY c.election_id, c.candidate_sid
        ORDER BY votes DESC, c.created_at, c.candidate_sid
      `),
      updateCommunityCandidateStatus: this.db.prepare(`
        UPDATE community_candidates SET status = ?, updated_at = ?
        WHERE election_id = ? AND candidate_sid = ?
      `),
      countCommunityElectionVoters: this.db.prepare(`
        SELECT COUNT(DISTINCT voter_sid) AS value FROM community_ballots WHERE election_id = ?
      `),
      deleteCommunityBallotsForVoter: this.db.prepare(`
        DELETE FROM community_ballots WHERE election_id = ? AND voter_sid = ?
      `),
      insertCommunityBallot: this.db.prepare(`
        INSERT INTO community_ballots (election_id, voter_sid, candidate_sid, created_at)
        VALUES (?, ?, ?, ?)
      `),
      insertCommunityAudit: this.db.prepare(`
        INSERT INTO community_audit_log
          (actor_sid, action, entity_type, entity_id, scope_key, payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),
      listCommunityAudit: this.db.prepare(`
        SELECT * FROM community_audit_log ORDER BY id DESC LIMIT ?
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
    this.replaceCommunityBallotTransaction = this.db.transaction((electionId, voterSid, candidateSids, createdAt) => {
      this.statements.deleteCommunityBallotsForVoter.run(electionId, voterSid);
      candidateSids.forEach((candidateSid) => {
        this.statements.insertCommunityBallot.run(electionId, voterSid, candidateSid, createdAt);
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

  mapCommunityMembership(row) {
    if (!row) return null;
    return {
      sid: String(row.sid),
      scopeLevel: String(row.scope_level),
      scopeKey: String(row.scope_key),
      railwayId: String(row.railway_id || ''),
      depotId: String(row.depot_id || ''),
      serviceArmId: String(row.service_arm_id || ''),
      status: String(row.status),
      role: String(row.role),
      roleSource: String(row.role_source || 'self'),
      primary: Number(row.primary_scope) === 1,
      termEndsAt: row.term_ends_at ? String(row.term_ends_at) : '',
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  upsertCommunityMembership(membership) {
    const item = membership || {};
    const existing = this.statements.readCommunityMembership.get(
      String(item.sid), String(item.scopeLevel), String(item.scopeKey)
    );
    const now = String(item.updatedAt || new Date().toISOString());
    const createdAt = existing ? String(existing.created_at) : String(item.createdAt || now);
    this.statements.upsertCommunityMembership.run(
      String(item.sid), String(item.scopeLevel), String(item.scopeKey),
      String(item.railwayId || ''), String(item.depotId || ''), String(item.serviceArmId || ''),
      String(item.status || 'selected'), String(item.role || 'member'),
      String(item.roleSource || 'self'), item.primary ? 1 : 0,
      item.termEndsAt ? String(item.termEndsAt) : null, createdAt, now
    );
    return this.mapCommunityMembership(this.statements.readCommunityMembership.get(
      String(item.sid), String(item.scopeLevel), String(item.scopeKey)
    ));
  }

  listCommunityMembershipsForSid(sid) {
    return this.statements.listCommunityMembershipsForSid.all(String(sid)).map((row) => this.mapCommunityMembership(row));
  }

  listCommunityMemberships(limit) {
    const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 500));
    return this.statements.listCommunityMemberships.all(safeLimit).map((row) => this.mapCommunityMembership(row));
  }

  clearCommunityPrimaryMemberships(sid) {
    this.statements.clearCommunityPrimaryMemberships.run(new Date().toISOString(), String(sid));
  }

  mapCommunityProposal(row) {
    if (!row) return null;
    return {
      id: String(row.id),
      authorSid: String(row.author_sid),
      kind: String(row.kind),
      riskLevel: String(row.risk_level),
      scope: {
        level: String(row.scope_level),
        key: String(row.scope_key),
        railwayId: String(row.railway_id || ''),
        depotId: String(row.depot_id || ''),
        serviceArmId: String(row.service_arm_id || ''),
        sectionId: String(row.section_id || ''),
      },
      title: String(row.title),
      summary: String(row.summary || ''),
      baseVersion: String(row.base_version || ''),
      change: parsePayload(row.change_payload, {}),
      evidence: parsePayload(row.evidence_payload, {}),
      status: String(row.status),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  createCommunityProposal(proposal) {
    const item = proposal || {};
    const now = String(item.createdAt || new Date().toISOString());
    this.statements.insertCommunityProposal.run(
      String(item.id), String(item.authorSid), String(item.kind), String(item.riskLevel || 'normal'),
      String(item.scope.level), String(item.scope.key), String(item.scope.railwayId || ''),
      String(item.scope.depotId || ''), String(item.scope.serviceArmId || ''),
      String(item.scope.sectionId || ''), String(item.title), String(item.summary || ''),
      String(item.baseVersion || ''), JSON.stringify(item.change || {}), JSON.stringify(item.evidence || {}),
      String(item.status || 'reviewing'), now, String(item.updatedAt || now)
    );
    return this.mapCommunityProposal(this.statements.readCommunityProposal.get(String(item.id)));
  }

  readCommunityProposal(id) {
    return this.mapCommunityProposal(this.statements.readCommunityProposal.get(String(id)));
  }

  listCommunityProposals(limit) {
    const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 500));
    return this.statements.listCommunityProposals.all(safeLimit).map((row) => this.mapCommunityProposal(row));
  }

  updateCommunityProposalStatus(id, status) {
    this.statements.updateCommunityProposalStatus.run(String(status), new Date().toISOString(), String(id));
    return this.readCommunityProposal(id);
  }

  upsertCommunityReview(review) {
    const item = review || {};
    const existing = this.db.prepare(
      'SELECT created_at FROM community_reviews WHERE proposal_id = ? AND reviewer_sid = ?'
    ).get(String(item.proposalId), String(item.reviewerSid));
    const now = String(item.updatedAt || new Date().toISOString());
    this.statements.upsertCommunityReview.run(
      String(item.proposalId), String(item.reviewerSid), String(item.verdict), String(item.notes || ''),
      Math.max(0, Math.min(3, Number(item.weight) || 0)), String(item.reviewerRole || 'member'),
      existing ? String(existing.created_at) : String(item.createdAt || now), now
    );
    return this.listCommunityReviews(item.proposalId).find((row) => row.reviewerSid === String(item.reviewerSid));
  }

  listCommunityReviews(proposalId) {
    return this.statements.listCommunityReviews.all(String(proposalId)).map((row) => ({
      proposalId: String(row.proposal_id),
      reviewerSid: String(row.reviewer_sid),
      verdict: String(row.verdict),
      notes: String(row.notes || ''),
      weight: Number(row.review_weight) || 0,
      reviewerRole: String(row.reviewer_role || 'member'),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  }

  createCommunityRelease(release) {
    const item = release || {};
    const payloadText = JSON.stringify(item.payload || {});
    this.statements.insertCommunityRelease.run(
      String(item.id), String(item.scopeLevel), String(item.scopeKey), Number(item.version),
      String(item.status || 'published'), item.proposalId ? String(item.proposalId) : null,
      payloadText, crypto.createHash('sha256').update(payloadText).digest('hex'),
      String(item.createdBy), String(item.createdAt || new Date().toISOString())
    );
    return this.listCommunityReleases(100).find((row) => row.id === String(item.id));
  }

  listCommunityReleases(limit) {
    const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 100));
    return this.statements.listCommunityReleases.all(safeLimit).map((row) => ({
      id: String(row.id),
      scopeLevel: String(row.scope_level),
      scopeKey: String(row.scope_key),
      version: Number(row.version),
      status: String(row.status),
      proposalId: row.proposal_id ? String(row.proposal_id) : '',
      payload: parsePayload(row.payload, {}),
      payloadSha256: String(row.payload_sha256),
      createdBy: String(row.created_by),
      createdAt: String(row.created_at),
    }));
  }

  createCommunityElection(election) {
    const item = election || {};
    const now = String(item.createdAt || new Date().toISOString());
    this.statements.insertCommunityElection.run(
      String(item.id), String(item.scopeLevel), String(item.scopeKey), String(item.railwayId || ''),
      String(item.depotId || ''), String(item.serviceArmId || ''), String(item.kind || 'curator'),
      String(item.status || 'nominations'), Number(item.seats) || 3, Number(item.quorum) || 5,
      String(item.startsAt), String(item.endsAt), item.termEndsAt ? String(item.termEndsAt) : null,
      String(item.createdBy), now, String(item.updatedAt || now)
    );
    return this.readCommunityElection(item.id);
  }

  readCommunityElection(id) {
    const row = this.statements.readCommunityElection.get(String(id));
    if (!row) return null;
    return {
      id: String(row.id), scopeLevel: String(row.scope_level), scopeKey: String(row.scope_key),
      railwayId: String(row.railway_id || ''), depotId: String(row.depot_id || ''),
      serviceArmId: String(row.service_arm_id || ''), kind: String(row.election_kind),
      status: String(row.status), seats: Number(row.seats), quorum: Number(row.quorum),
      startsAt: String(row.starts_at), endsAt: String(row.ends_at),
      termEndsAt: row.term_ends_at ? String(row.term_ends_at) : '', createdBy: String(row.created_by),
      createdAt: String(row.created_at), updatedAt: String(row.updated_at),
      candidates: this.listCommunityCandidates(row.id),
    };
  }

  listCommunityElections(limit) {
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
    return this.statements.listCommunityElections.all(safeLimit).map((row) => this.readCommunityElection(row.id));
  }

  updateCommunityElectionStatus(id, status) {
    this.statements.updateCommunityElectionStatus.run(String(status), new Date().toISOString(), String(id));
    return this.readCommunityElection(id);
  }

  upsertCommunityCandidate(candidate) {
    const item = candidate || {};
    const now = String(item.updatedAt || new Date().toISOString());
    this.statements.upsertCommunityCandidate.run(
      String(item.electionId), String(item.candidateSid), String(item.nominatedBy),
      String(item.statement || ''), String(item.status || 'nominated'),
      String(item.createdAt || now), now
    );
    return this.listCommunityCandidates(item.electionId).find((row) => row.candidateSid === String(item.candidateSid));
  }

  listCommunityCandidates(electionId) {
    return this.statements.listCommunityCandidates.all(String(electionId)).map((row) => ({
      electionId: String(row.election_id), candidateSid: String(row.candidate_sid),
      nominatedBy: String(row.nominated_by), statement: String(row.statement || ''),
      status: String(row.status), votes: Number(row.votes) || 0,
      createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    }));
  }

  updateCommunityCandidateStatus(electionId, candidateSid, status) {
    this.statements.updateCommunityCandidateStatus.run(
      String(status), new Date().toISOString(), String(electionId), String(candidateSid)
    );
    return this.listCommunityCandidates(electionId)
      .find((row) => row.candidateSid === String(candidateSid)) || null;
  }

  countCommunityElectionVoters(electionId) {
    const row = this.statements.countCommunityElectionVoters.get(String(electionId));
    return Number(row && row.value) || 0;
  }

  replaceCommunityBallot(electionId, voterSid, candidateSids) {
    const choices = Array.from(new Set((Array.isArray(candidateSids) ? candidateSids : []).map(String)));
    this.replaceCommunityBallotTransaction(String(electionId), String(voterSid), choices, new Date().toISOString());
    return { electionId: String(electionId), choices: choices.length };
  }

  recordCommunityAudit(entry) {
    const item = entry || {};
    this.statements.insertCommunityAudit.run(
      String(item.actorSid), String(item.action), String(item.entityType), String(item.entityId),
      String(item.scopeKey || ''), JSON.stringify(item.payload || {}),
      String(item.createdAt || new Date().toISOString())
    );
  }

  listCommunityAudit(limit) {
    const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 100));
    return this.statements.listCommunityAudit.all(safeLimit).map((row) => ({
      id: Number(row.id), actorSid: String(row.actor_sid), action: String(row.action),
      entityType: String(row.entity_type), entityId: String(row.entity_id),
      scopeKey: String(row.scope_key || ''), payload: parsePayload(row.payload, {}),
      createdAt: String(row.created_at),
    }));
  }

  buildCommunityAdminOverview() {
    const scalar = (sql, params) => {
      const row = this.db.prepare(sql).get(...(params || []));
      return Number(row && row.value) || 0;
    };
    const grouped = (table, column) => {
      const result = {};
      this.db.prepare(`SELECT ${column} AS key, COUNT(*) AS value FROM ${table} GROUP BY ${column}`).all()
        .forEach((row) => { result[String(row.key)] = Number(row.value) || 0; });
      return result;
    };
    return {
      generatedAt: new Date().toISOString(),
      metrics: {
        memberships: scalar('SELECT COUNT(*) AS value FROM community_memberships'),
        verifiedMembers: scalar("SELECT COUNT(*) AS value FROM community_memberships WHERE status = 'verified'"),
        proposals: scalar('SELECT COUNT(*) AS value FROM community_proposals'),
        openProposals: scalar("SELECT COUNT(*) AS value FROM community_proposals WHERE status IN ('reviewing','needs_info','disputed')"),
        reviews: scalar('SELECT COUNT(*) AS value FROM community_reviews'),
        releases: scalar('SELECT COUNT(*) AS value FROM community_releases'),
        elections: scalar('SELECT COUNT(*) AS value FROM community_elections'),
      },
      membershipStatuses: grouped('community_memberships', 'status'),
      proposalStatuses: grouped('community_proposals', 'status'),
      memberships: this.listCommunityMemberships(250),
      proposals: this.listCommunityProposals(250),
      elections: this.listCommunityElections(100),
      releases: this.listCommunityReleases(100),
      audit: this.listCommunityAudit(100),
    };
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
