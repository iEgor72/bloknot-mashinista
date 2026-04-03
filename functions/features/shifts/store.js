function parseShifts(raw) {
  try {
    var parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function sanitizeShift(shift) {
  var copy = {};
  var keys = Object.keys(shift || {});
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] === 'pending') continue;
    copy[keys[i]] = shift[keys[i]];
  }
  return copy;
}

function sanitizeShifts(shifts) {
  var list = [];
  for (var i = 0; i < (shifts || []).length; i++) {
    list.push(sanitizeShift(shifts[i]));
  }
  return list;
}

async function ensureSchema(db) {
  await db.prepare(
    'CREATE TABLE IF NOT EXISTS user_shifts (user_id TEXT PRIMARY KEY, shifts_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)'
  ).run();
  await db.prepare(
    'CREATE TABLE IF NOT EXISTS shift_sets (sid TEXT PRIMARY KEY, shifts_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)'
  ).run();
}

async function readLegacyGlobalShifts(db) {
  var row = await db.prepare(
    'SELECT shifts_json FROM shift_sets WHERE sid = ? LIMIT 1'
  ).bind('global').first();
  return row ? sanitizeShifts(parseShifts(row.shifts_json)) : [];
}

async function readUserShifts(db, userId) {
  var row = await db.prepare(
    'SELECT shifts_json FROM user_shifts WHERE user_id = ? LIMIT 1'
  ).bind(userId).first();
  if (row) {
    return sanitizeShifts(parseShifts(row.shifts_json));
  }

  var legacyShifts = await readLegacyGlobalShifts(db);
  if (legacyShifts.length > 0) {
    await db.prepare(
      [
        'INSERT INTO user_shifts (user_id, shifts_json, updated_at)',
        'VALUES (?, ?, CURRENT_TIMESTAMP)',
        'ON CONFLICT(user_id) DO UPDATE SET',
        '  shifts_json = excluded.shifts_json,',
        '  updated_at = CURRENT_TIMESTAMP',
      ].join('\n')
    ).bind(userId, JSON.stringify(legacyShifts)).run();

    await db.prepare('DELETE FROM shift_sets WHERE sid = ?').bind('global').run();
    return legacyShifts;
  }

  return [];
}

async function writeUserShifts(db, userId, shifts) {
  var sanitized = sanitizeShifts(shifts);
  await db.prepare(
    [
      'INSERT INTO user_shifts (user_id, shifts_json, updated_at)',
      'VALUES (?, ?, CURRENT_TIMESTAMP)',
      'ON CONFLICT(user_id) DO UPDATE SET',
      '  shifts_json = excluded.shifts_json,',
      '  updated_at = CURRENT_TIMESTAMP',
    ].join('\n')
  ).bind(userId, JSON.stringify(sanitized)).run();
}

export async function loadShifts(db, userId) {
  await ensureSchema(db);
  return readUserShifts(db, userId);
}

export async function saveShifts(db, userId, shifts) {
  await ensureSchema(db);
  await writeUserShifts(db, userId, shifts);
  return shifts;
}
