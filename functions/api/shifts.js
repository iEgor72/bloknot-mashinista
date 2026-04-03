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

function normalizeSid(rawSid) {
  const sid = String(rawSid || 'default').trim();
  const safe = sid.replace(/[^a-zA-Z0-9_-]/g, '_');
  return safe.length > 0 ? safe : 'default';
}

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
  const url = new URL(request.url);
  const sid = normalizeSid(url.searchParams.get('sid'));

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

  if (request.method === 'GET') {
    const row = await env.DB.prepare(
      'SELECT shifts_json FROM shift_sets WHERE sid = ? LIMIT 1'
    ).bind(sid).first();

    const shifts = row && row.shifts_json ? JSON.parse(row.shifts_json) : [];
    return json(200, { sid, shifts: Array.isArray(shifts) ? shifts : [] });
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
      ).bind(sid, JSON.stringify(shifts)).run();

      return json(200, { ok: true, sid, shifts });
    } catch (err) {
      return json(400, { error: err.message || 'Invalid payload' });
    }
  }

  return json(405, { error: 'Method not allowed' });
}
