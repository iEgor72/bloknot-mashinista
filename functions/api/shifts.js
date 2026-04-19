import { getSessionUser } from '../features/auth/telegram-auth.js';
import { loadShifts, saveShifts } from '../features/shifts/store.js';
import { parseShiftsPayload } from '../features/shifts/validation.js';

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

    var user = await getSessionUser(request, botToken);
    if (!user) {
      return json(401, { error: 'Unauthorized' });
    }

    if (request.method === 'GET') {
      var shifts = await loadShifts(env.DB, user.id);
      return json(200, {
        user: user,
        shifts: shifts,
      });
    }

    if (request.method === 'PUT') {
      try {
        var body = await request.json();
        var parsed = parseShiftsPayload(body);

        if (!parsed.ok) {
          return json(400, { error: parsed.error });
        }

        await saveShifts(env.DB, user.id, parsed.shifts);
        return json(200, {
          ok: true,
          user: user,
          shifts: parsed.shifts,
        });
      } catch (err) {
        return json(400, { error: err.message || 'Invalid payload' });
      }
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    return json(500, {
      error: err && err.message ? err.message : 'Unexpected error',
    });
  }
}
