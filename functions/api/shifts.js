const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: CORS_HEADERS,
  });
}

const GLOBAL_SID = 'global';

async function ensureSchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS shift_sets (
      sid TEXT PRIMARY KEY,
      shifts_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  if (!env || !env.DB) {
    return json(500, {
      error: 'D1 database binding is missing. Add DB in the Cloudflare Pages project settings.',
    });
  }

  await ensureSchema(env.DB);

  async function readMergedShifts() {
    const rows = await env.DB.prepare(
      'SELECT sid, shifts_json FROM shift_sets ORDER BY updated_at DESC'
    ).all();

    const merged = [];
    const seen = new Set();
    const items = Array.isArray(rows && rows.results) ? rows.results : [];

    for (const row of items) {
      let parsed = [];
      try {
        parsed = row && row.shifts_json ? JSON.parse(row.shifts_json) : [];
      } catch (e) {
        parsed = [];
      }

      for (const shift of Array.isArray(parsed) ? parsed : []) {
        if (!shift || !shift.id || seen.has(shift.id)) continue;
        seen.add(shift.id);
        merged.push(shift);
      }
    }

    return merged;
  }

  if (request.method === 'GET') {
    const merged = await readMergedShifts();
    await env.DB.prepare(
      `
        INSERT INTO shift_sets (sid, shifts_json, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(sid) DO UPDATE SET
          shifts_json = excluded.shifts_json,
          updated_at = CURRENT_TIMESTAMP
      `
    ).bind(GLOBAL_SID, JSON.stringify(merged)).run();

    return json(200, { sid: GLOBAL_SID, shifts: merged });
  }

  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const shifts = Array.isArray(body && body.shifts) ? body.shifts : null;

      if (!shifts) {
        return json(400, { error: 'Expected { shifts: [] }' });
      }

      await env.DB.prepare(
        `
          INSERT INTO shift_sets (sid, shifts_json, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(sid) DO UPDATE SET
            shifts_json = excluded.shifts_json,
            updated_at = CURRENT_TIMESTAMP
        `
      ).bind(GLOBAL_SID, JSON.stringify(shifts)).run();

      return json(200, { ok: true, sid: GLOBAL_SID, shifts });
    } catch (err) {
      return json(400, { error: err.message || 'Invalid payload' });
    }
  }

  return json(405, { error: 'Method not allowed' });
}
