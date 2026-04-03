import { getSessionUser } from '../_shared/telegram-auth.js';

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status: status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function parseShifts(raw) {
  try {
    var parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

async function ensureSchema(db) {
  await db.exec(
    'CREATE TABLE IF NOT EXISTS user_shifts (\n' +
      '  user_id TEXT PRIMARY KEY,\n' +
      '  shifts_json TEXT NOT NULL,\n' +
      '  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP\n' +
      ');'
  );
  await db.exec(
    'CREATE TABLE IF NOT EXISTS shift_sets (\n' +
      '  sid TEXT PRIMARY KEY,\n' +
      '  shifts_json TEXT NOT NULL,\n' +
      '  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP\n' +
      ');'
  );
}

async function readLegacyGlobalShifts(db) {
  var row = await db.prepare(
    'SELECT shifts_json FROM shift_sets WHERE sid = ? LIMIT 1'
  ).bind('global').first();
  return row ? parseShifts(row.shifts_json) : [];
}

async function readUserShifts(db, userId) {
  var row = await db.prepare(
    'SELECT shifts_json FROM user_shifts WHERE user_id = ? LIMIT 1'
  ).bind(userId).first();
  if (row) {
    return parseShifts(row.shifts_json);
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
  await db.prepare(
    [
      'INSERT INTO user_shifts (user_id, shifts_json, updated_at)',
      'VALUES (?, ?, CURRENT_TIMESTAMP)',
      'ON CONFLICT(user_id) DO UPDATE SET',
      '  shifts_json = excluded.shifts_json,',
      '  updated_at = CURRENT_TIMESTAMP',
    ].join('\n')
  ).bind(userId, JSON.stringify(shifts)).run();
}

export async function onRequest(context) {
  var request = context.request;
  var env = context.env || {};
  var botToken = env.TELEGRAM_BOT_TOKEN;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  if (!env.DB) {
    return json(500, {
      error: 'D1 database binding is missing. Add DB in the Cloudflare Pages project settings.',
    });
  }

  if (!botToken) {
    return json(500, {
      error: 'TELEGRAM_BOT_TOKEN is missing. Add it as a Pages secret.',
    });
  }

  await ensureSchema(env.DB);

  var user = await getSessionUser(request, botToken);
  if (!user) {
    return json(401, { error: 'Unauthorized' });
  }

  if (request.method === 'GET') {
    var shifts = await readUserShifts(env.DB, user.id);
    return json(200, {
      user: user,
      shifts: shifts,
    });
  }

  if (request.method === 'PUT') {
    try {
      var body = await request.json();
      var shiftsValue = Array.isArray(body && body.shifts) ? body.shifts : null;

      if (!shiftsValue) {
        return json(400, { error: 'Expected { shifts: [] }' });
      }

      await writeUserShifts(env.DB, user.id, shiftsValue);
      return json(200, {
        ok: true,
        user: user,
        shifts: shiftsValue,
      });
    } catch (err) {
      return json(400, { error: err.message || 'Invalid payload' });
    }
  }

  return json(405, { error: 'Method not allowed' });
}
