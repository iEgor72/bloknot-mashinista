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

test('analytics migration stores consent, sessions, events, and dashboard aggregates', () => {
  const dataDir = createTempDir('storage-analytics');
  try {
    const storage = createSqliteStorage({ dataDir });
    const consent = storage.writeAnalyticsConsent('42', 'granted', '2026-07-23');
    assert.equal(consent.status, 'granted');
    assert.equal(storage.readAnalyticsConsent('42').policyVersion, '2026-07-23');

    const occurredAt = new Date().toISOString();
    const result = storage.recordAnalyticsEvents('42', [{
      eventId: 'event:storage-test-0001',
      sessionId: 'session:storage-test-0001',
      eventName: 'app_opened',
      occurredAt,
      platform: 'android',
      appVersion: 'v390',
      properties: { source: 'test' },
    }], 180);
    assert.equal(result.inserted, 1);
    const heartbeat = storage.recordAnalyticsEvents('42', [{
      eventId: 'event:storage-heartbeat-0001',
      sessionId: 'session:storage-test-0001',
      eventName: 'session_heartbeat',
      occurredAt: new Date(Date.parse(occurredAt) + 30000).toISOString(),
      platform: 'android',
      appVersion: 'v390',
      properties: {},
    }], 180);
    assert.equal(heartbeat.inserted, 0);
    const sameSessionId = 'session:storage-shared-0001';
    const oldStart = new Date(Date.now() - 40 * 86400000).toISOString();
    const oldReturn = new Date(Date.parse(oldStart) + 31 * 86400000).toISOString();
    storage.recordAnalyticsEvents('older-user', [{
      eventId: 'event:storage-test-0002', sessionId: sameSessionId, eventName: 'app_opened', occurredAt: oldStart,
      platform: 'desktop', appVersion: 'v390', properties: {},
    }, {
      eventId: 'event:storage-test-0003', sessionId: sameSessionId, eventName: 'session_ended', occurredAt: oldReturn,
      platform: 'desktop', appVersion: 'v390', properties: {},
    }], 180);
    storage.recordAnalyticsEvents('second-user', [{
      eventId: 'event:storage-test-0004', sessionId: sameSessionId, eventName: 'app_opened', occurredAt,
      platform: 'ios', appVersion: 'v390', properties: {},
    }], 180);
    const dashboard = storage.buildAnalyticsDashboard(90);
    assert.equal(dashboard.metrics.activeUsers, 3);
    assert.equal(dashboard.metrics.sessions, 3);
    assert.equal(dashboard.retention.d30, 100);
    assert.equal(dashboard.recentEvents.length, 4);
    assert.equal(dashboard.users.length, 3);
    assert.ok(dashboard.users.every((row) => /^[a-f0-9]{10}$/.test(row.userKey)));
    assert.equal(storage.deleteAnalyticsForUser('42', true).removedEvents, 1);
    assert.equal(storage.readAnalyticsConsent('42').status, 'granted');
    storage.close();
  } finally {
    removeTempDir(dataDir, 'storage-analytics');
  }
});

test('analytics retention caps events and sessions for one account', () => {
  const dataDir = createTempDir('storage-analytics-cap');
  try {
    const storage = createSqliteStorage({ dataDir });
    const now = new Date().toISOString();
    const insertEvent = storage.db.prepare(`
      INSERT INTO analytics_events
        (event_id, sid, session_id, event_name, occurred_at, received_at, platform, app_version, properties)
      VALUES (?, 'bounded-user', ?, 'app_opened', ?, ?, 'unknown', '', '{}')
    `);
    const insertSession = storage.db.prepare(`
      INSERT INTO analytics_sessions
        (sid, session_id, started_at, last_seen_at, ended_at, platform, app_version)
      VALUES ('bounded-user', ?, ?, ?, NULL, 'unknown', '')
    `);
    storage.db.transaction(() => {
      for (let index = 0; index < 10020; index += 1) {
        insertEvent.run(`event:cap-${String(index).padStart(12, '0')}`, `session:cap-${String(index % 220).padStart(12, '0')}`, now, now);
      }
      for (let index = 0; index < 220; index += 1) {
        insertSession.run(`session:cap-${String(index).padStart(12, '0')}`, now, now);
      }
    })();

    storage.recordAnalyticsEvents('bounded-user', [{
      eventId: 'event:cap-trigger-0001',
      sessionId: 'session:cap-trigger-0001',
      eventName: 'app_opened',
      occurredAt: now,
      platform: 'unknown',
      appVersion: '',
      properties: {},
    }], 180);

    const eventCount = storage.db.prepare('SELECT COUNT(*) AS count FROM analytics_events WHERE sid = ?').get('bounded-user').count;
    const sessionCount = storage.db.prepare('SELECT COUNT(*) AS count FROM analytics_sessions WHERE sid = ?').get('bounded-user').count;
    assert.equal(eventCount, 10000);
    assert.equal(sessionCount, 200);
    storage.close();
  } finally {
    removeTempDir(dataDir, 'storage-analytics-cap');
  }
});

test('community migration stores scoped memberships, proposals, reviews, releases, and elections', () => {
  const dataDir = createTempDir('storage-community');
  try {
    const storage = createSqliteStorage({ dataDir });
    const scope = {
      level: 'service_arm',
      key: 'service_arm:rzd:dvost:tche-9:komsomolsk-na-amure:komsomolsk-vysokogornaya',
      railwayId: 'dvost',
      depotId: 'rzd:dvost:tche-9:komsomolsk-na-amure',
      serviceArmId: 'komsomolsk-vysokogornaya',
      sectionId: '',
    };

    const selected = storage.upsertCommunityMembership({
      sid: 'driver-1',
      scopeLevel: 'depot',
      scopeKey: scope.depotId,
      railwayId: scope.railwayId,
      depotId: scope.depotId,
      status: 'selected',
      role: 'member',
      primary: true,
    });
    assert.equal(selected.status, 'selected');
    const reviewer = storage.upsertCommunityMembership({
      sid: 'driver-2',
      scopeLevel: 'service_arm',
      scopeKey: scope.key,
      railwayId: scope.railwayId,
      depotId: scope.depotId,
      serviceArmId: scope.serviceArmId,
      status: 'verified',
      role: 'reviewer',
      roleSource: 'admin',
    });
    assert.equal(reviewer.role, 'reviewer');
    assert.equal(storage.listCommunityMembershipsForSid('driver-1').length, 1);

    const proposal = storage.createCommunityProposal({
      id: 'proposal:storage-community-0001',
      authorSid: 'driver-1',
      kind: 'speed',
      riskLevel: 'safety_increase',
      scope,
      title: 'Отмена ограничения 40 км/ч',
      summary: 'Установить 60 км/ч после отмены приказом',
      baseVersion: '12',
      change: { fromKmpk: '123 км 4 ПК', toKmpk: '124 км 2 ПК', fromSpeed: 40, toSpeed: 60 },
      evidence: { orderNumber: '161', orderDate: '2026-08-27' },
      status: 'reviewing',
    });
    assert.equal(proposal.change.toSpeed, 60);

    const review = storage.upsertCommunityReview({
      proposalId: proposal.id,
      reviewerSid: 'driver-2',
      verdict: 'confirm',
      notes: 'Приказ получал',
      weight: 1,
      reviewerRole: 'reviewer',
    });
    assert.equal(review.verdict, 'confirm');
    assert.equal(storage.listCommunityReviews(proposal.id).length, 1);

    const release = storage.createCommunityRelease({
      id: 'release:storage-community-0001',
      scopeLevel: scope.level,
      scopeKey: scope.key,
      version: 1,
      proposalId: proposal.id,
      payload: { proposalIds: [proposal.id] },
      createdBy: 'curator-1',
    });
    assert.match(release.payloadSha256, /^[a-f0-9]{64}$/);

    const startsAt = new Date(Date.now() - 60000).toISOString();
    const endsAt = new Date(Date.now() + 86400000).toISOString();
    const election = storage.createCommunityElection({
      id: 'election:storage-community-0001',
      scopeLevel: 'service_arm',
      scopeKey: scope.key,
      railwayId: scope.railwayId,
      depotId: scope.depotId,
      serviceArmId: scope.serviceArmId,
      status: 'voting',
      seats: 3,
      quorum: 5,
      startsAt,
      endsAt,
      createdBy: 'admin-1',
    });
    assert.equal(election.seats, 3);
    storage.upsertCommunityCandidate({
      electionId: election.id,
      candidateSid: 'driver-2',
      nominatedBy: 'driver-1',
      statement: 'Работаю на плече 12 лет',
      status: 'accepted',
    });
    storage.replaceCommunityBallot(election.id, 'driver-1', ['driver-2']);
    assert.equal(storage.readCommunityElection(election.id).candidates[0].votes, 1);

    storage.recordCommunityAudit({
      actorSid: 'driver-1', action: 'proposal.created', entityType: 'proposal',
      entityId: proposal.id, scopeKey: scope.key,
    });
    const overview = storage.buildCommunityAdminOverview();
    assert.equal(overview.metrics.memberships, 2);
    assert.equal(overview.metrics.proposals, 1);
    assert.equal(overview.metrics.reviews, 1);
    assert.equal(overview.metrics.releases, 1);
    assert.equal(overview.metrics.elections, 1);
    assert.equal(overview.audit[0].action, 'proposal.created');
    storage.close();
  } finally {
    removeTempDir(dataDir, 'storage-community');
  }
});
