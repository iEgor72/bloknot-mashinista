import { isValidStatsDeviceId, readStats, touchAndReadStats } from '../features/stats/store.js';

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status: status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

export async function onRequest(context) {
  try {
    var request = context.request;
    var env = context.env || {};

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

    if (request.method === 'GET') {
      return json(200, await readStats(env.DB));
    }

    if (request.method === 'POST') {
      try {
        var body = await request.json();
        var deviceId = body && typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
        if (!isValidStatsDeviceId(deviceId)) {
          return json(400, { error: 'Invalid deviceId' });
        }

        return json(200, await touchAndReadStats(env.DB, deviceId));
      } catch (err) {
        return json(400, { error: err && err.message ? err.message : 'Invalid payload' });
      }
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    return json(500, {
      error: err && err.message ? err.message : 'Unexpected error',
      stack: err && err.stack ? String(err.stack) : null,
    });
  }
}
