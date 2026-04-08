import { getSessionUser } from '../features/auth/telegram-auth.js';
import { isValidStatsSessionId, normalizeStatsUserId, readStats, touchAndReadStats } from '../features/stats/store.js';

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

    var botToken = env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return json(500, {
        error: 'TELEGRAM_BOT_TOKEN is missing. Add it as a Pages secret.',
      });
    }

    var user = await getSessionUser(request, botToken);
    if (!user) {
      return json(401, { error: 'Unauthorized' });
    }

    if (request.method === 'GET') {
      return json(200, await readStats(env.DB));
    }

    if (request.method === 'POST') {
      try {
        var body = await request.json();
        var sessionId = body && typeof body.sessionId === 'string'
          ? body.sessionId.trim()
          : (body && typeof body.deviceId === 'string' ? body.deviceId.trim() : '');
        var userId = normalizeStatsUserId(user.id);
        if (!userId) {
          return json(400, { error: 'Invalid user id' });
        }
        if (!isValidStatsSessionId(sessionId)) {
          return json(400, { error: 'Invalid sessionId' });
        }

        return json(200, await touchAndReadStats(env.DB, userId, sessionId));
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
