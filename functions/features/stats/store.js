var ONLINE_WINDOW_SECONDS = 120;

function toNonNegativeInt(value) {
  var n = Number(value);
  if (!isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function isValidStatsDeviceId(deviceId) {
  return typeof deviceId === 'string' && /^[a-z0-9_-]{12,64}$/i.test(deviceId);
}

async function ensureSchema(db) {
  await db.prepare(
    [
      'CREATE TABLE IF NOT EXISTS user_presence (',
      '  device_id TEXT PRIMARY KEY,',
      '  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,',
      '  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',
      ')',
    ].join('\n')
  ).run();

  await db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON user_presence(last_seen_at)'
  ).run();
}

async function readStatsRows(db) {
  var totalRow = await db.prepare('SELECT COUNT(*) AS count FROM user_presence').first();
  var onlineRow = await db.prepare(
    "SELECT COUNT(*) AS count FROM user_presence WHERE last_seen_at >= datetime('now', '-' || ? || ' seconds')"
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

export async function touchAndReadStats(db, deviceId) {
  await ensureSchema(db);
  await db.prepare(
    [
      'INSERT INTO user_presence (device_id, first_seen_at, last_seen_at)',
      'VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      'ON CONFLICT(device_id) DO UPDATE SET',
      '  last_seen_at = CURRENT_TIMESTAMP',
    ].join('\n')
  ).bind(deviceId).run();

  return readStatsRows(db);
}
