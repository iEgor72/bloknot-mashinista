var ONLINE_WINDOW_SECONDS = 120;

function toNonNegativeInt(value) {
  var n = Number(value);
  if (!isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function isValidStatsSessionId(sessionId) {
  return typeof sessionId === 'string' && /^[a-z0-9_-]{12,64}$/i.test(sessionId);
}

export function normalizeStatsUserId(userId) {
  if (userId === undefined || userId === null) return '';
  var id = String(userId).trim();
  return id ? id : '';
}

async function ensureSchema(db) {
  await db.prepare(
    [
      'CREATE TABLE IF NOT EXISTS stats_users (',
      '  user_id TEXT PRIMARY KEY,',
      '  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,',
      '  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',
      ')',
    ].join('\n')
  ).run();

  await db.prepare(
    [
      'CREATE TABLE IF NOT EXISTS stats_sessions (',
      '  session_id TEXT PRIMARY KEY,',
      '  user_id TEXT NOT NULL,',
      '  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,',
      '  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',
      ')',
    ].join('\n')
  ).run();

  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_stats_sessions_user_last_seen ON stats_sessions(user_id, last_seen_at)'
  ).run();
  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_stats_sessions_last_seen ON stats_sessions(last_seen_at)'
  ).run();
}

async function readStatsRows(db) {
  var totalRow = await db.prepare('SELECT COUNT(*) AS count FROM stats_users').first();
  var onlineRow = await db.prepare(
    [
      'SELECT COUNT(DISTINCT user_id) AS count',
      'FROM stats_sessions',
      "WHERE last_seen_at >= datetime('now', '-' || ? || ' seconds')",
    ].join('\n')
  ).bind(ONLINE_WINDOW_SECONDS).first();

  return {
    totalUsers: toNonNegativeInt(totalRow && totalRow.count),
    onlineUsers: toNonNegativeInt(onlineRow && onlineRow.count),
    onlineWindowSeconds: ONLINE_WINDOW_SECONDS,
    updatedAt: new Date().toISOString(),
  };
}

export async function readStats(db) {
  await ensureSchema(db);
  return readStatsRows(db);
}

export async function touchAndReadStats(db, userId, sessionId) {
  await ensureSchema(db);

  await db.prepare(
    [
      'INSERT INTO stats_users (user_id, first_seen_at, last_seen_at)',
      'VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      'ON CONFLICT(user_id) DO UPDATE SET',
      '  last_seen_at = CURRENT_TIMESTAMP',
    ].join('\n')
  ).bind(userId).run();

  await db.prepare(
    [
      'INSERT INTO stats_sessions (session_id, user_id, first_seen_at, last_seen_at)',
      'VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      'ON CONFLICT(session_id) DO UPDATE SET',
      '  user_id = excluded.user_id,',
      '  last_seen_at = CURRENT_TIMESTAMP',
    ].join('\n')
  ).bind(sessionId, userId).run();

  return readStatsRows(db);
}
