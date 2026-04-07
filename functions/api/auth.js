import {
  buildSessionCookie,
  clearSessionCookie,
  createSessionToken,
  getSessionUser,
  safeRedirectTarget,
  verifyTelegramLoginParams,
  verifyTelegramWebAppInitData,
} from '../features/auth/telegram-auth.js';

function isAdmin(user, env) {
  var adminId = env && env.ADMIN_TELEGRAM_ID;
  if (!adminId) return false;
  return String(user.id) === String(adminId);
}

function json(status, payload, extraHeaders) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      ...(extraHeaders || {}),
    },
  });
}

function redirect(target, cookieValue) {
  var headers = {
    Location: target,
    'Cache-Control': 'no-store',
  };
  if (cookieValue) {
    headers['Set-Cookie'] = cookieValue;
  }
  return new Response(null, {
    status: 302,
    headers: headers,
  });
}

async function getBotToken(env) {
  var token = env && env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is missing. Add it as a Pages secret.');
  }
  return token;
}

export async function onRequest(context) {
  try {
    var request = context.request;
    var env = context.env || {};
    var url = new URL(request.url);
    var botToken;

    try {
      botToken = await getBotToken(env);
    } catch (err) {
      return json(500, { error: err.message || 'Telegram bot token is missing' });
    }

    if (request.method === 'GET') {
      var mode = url.searchParams.get('mode');
      var authKeys = ['id', 'auth_date', 'hash'];
      var hasTelegramLoginParams = authKeys.every(function (key) {
        return url.searchParams.has(key);
      });

      if (mode === 'telegram-login' || hasTelegramLoginParams) {
        var user = await verifyTelegramLoginParams(url.searchParams, botToken);
        if (!user) {
          return json(401, { error: 'Telegram login verification failed' });
        }

        var sessionToken = await createSessionToken(user, botToken);
        var sessionCookie = await buildSessionCookie(user, botToken);
        var target = safeRedirectTarget(url.searchParams.get('return'));
        return redirect(target, sessionCookie);
      }

      var sessionUser = await getSessionUser(request, botToken);
      if (!sessionUser) {
        return json(401, { error: 'Unauthorized' });
      }

      var enrichedSessionUser = Object.assign({}, sessionUser, { is_admin: isAdmin(sessionUser, env) });
      return json(200, {
        user: enrichedSessionUser,
        sessionToken: await createSessionToken(sessionUser, botToken),
      });
    }

    if (request.method === 'POST') {
      try {
        var body = await request.json();
        var initData = body && body.initData ? String(body.initData) : '';
        if (!initData) {
          return json(400, { error: 'Expected { initData: "..." }' });
        }

        var userFromWebApp = await verifyTelegramWebAppInitData(initData, botToken);
        if (!userFromWebApp) {
          return json(401, { error: 'Telegram WebApp verification failed' });
        }

        var sessionTokenFromWebApp = await createSessionToken(userFromWebApp, botToken);
        var cookie = await buildSessionCookie(userFromWebApp, botToken);
        var enrichedWebAppUser = Object.assign({}, userFromWebApp, { is_admin: isAdmin(userFromWebApp, env) });
        return json(200, {
          user: enrichedWebAppUser,
          sessionToken: sessionTokenFromWebApp,
        }, {
          'Set-Cookie': cookie,
        });
      } catch (err) {
        return json(400, { error: err.message || 'Invalid payload' });
      }
    }

    if (request.method === 'DELETE') {
      return new Response(null, {
        status: 204,
        headers: {
          'Cache-Control': 'no-store',
          'Set-Cookie': clearSessionCookie(),
        },
      });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    return json(500, {
      error: err && err.message ? err.message : 'Unexpected error',
      stack: err && err.stack ? String(err.stack) : null,
    });
  }
}
