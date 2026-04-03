const SESSION_COOKIE = '__Host-shift_auth';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function utf8(input) {
  return new TextEncoder().encode(String(input));
}

function bytesToHex(bytes) {
  return Array.from(bytes, function (byte) {
    return byte.toString(16).padStart(2, '0');
  }).join('');
}

function base64UrlEncode(value) {
  var binary = '';
  var bytes = value instanceof Uint8Array ? value : utf8(value);
  for (var i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  var normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4) normalized += '=';
  var binary = atob(normalized);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  var result = 0;
  for (var i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function parseCookies(header) {
  var cookies = {};
  if (!header) return cookies;
  var parts = String(header).split(';');
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (!part) continue;
    var idx = part.indexOf('=');
    if (idx === -1) continue;
    var key = part.slice(0, idx).trim();
    var val = part.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(val);
  }
  return cookies;
}

function buildDataCheckString(params, excludedKeys) {
  var keys = [];
  params.forEach(function (_value, key) {
    if (excludedKeys.has(key)) return;
    keys.push(key);
  });
  keys.sort();
  return keys
    .map(function (key) {
      return key + '=' + params.get(key);
    })
    .join('\n');
}

async function sha256Bytes(input) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(input)));
}

async function hmacHex(rawKeyBytes, message) {
  var key = await crypto.subtle.importKey(
    'raw',
    rawKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  var signature = await crypto.subtle.sign('HMAC', key, utf8(message));
  return bytesToHex(new Uint8Array(signature));
}

async function telegramLoginSecret(botToken) {
  return sha256Bytes(botToken);
}

async function telegramWebAppSecret(botToken) {
  var key = await crypto.subtle.importKey(
    'raw',
    utf8('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  var signature = await crypto.subtle.sign('HMAC', key, utf8(botToken));
  return new Uint8Array(signature);
}

function parseTelegramUserFromLoginParams(params) {
  var id = params.get('id');
  if (!id) return null;
  return {
    id: String(id),
    first_name: params.get('first_name') || '',
    last_name: params.get('last_name') || '',
    username: params.get('username') || '',
    photo_url: params.get('photo_url') || '',
    auth_date: Number(params.get('auth_date') || 0) || 0,
  };
}

function parseTelegramUserFromWebApp(initDataParams) {
  var userRaw = initDataParams.get('user');
  if (!userRaw) return null;
  try {
    var parsed = JSON.parse(userRaw);
    if (!parsed || typeof parsed !== 'object' || parsed.id === undefined || parsed.id === null) {
      return null;
    }
    return {
      id: String(parsed.id),
      first_name: parsed.first_name || '',
      last_name: parsed.last_name || '',
      username: parsed.username || '',
      photo_url: parsed.photo_url || '',
      auth_date: Number(initDataParams.get('auth_date') || 0) || 0,
    };
  } catch (err) {
    return null;
  }
}

function normalizeUser(user) {
  if (!user || !user.id) return null;
  return {
    id: String(user.id),
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    username: user.username || '',
    photo_url: user.photo_url || '',
    display_name: [user.first_name || '', user.last_name || ''].join(' ').trim() || user.username || ('ID ' + String(user.id)),
    auth_date: Number(user.auth_date || 0) || 0,
  };
}

async function verifyTelegramLoginParams(params, botToken) {
  var hash = params.get('hash');
  if (!hash) return null;
  var authDate = Number(params.get('auth_date') || 0) || 0;
  if (!authDate) return null;
  if (Date.now() / 1000 - authDate > 60 * 60 * 24) return null;

  var checkString = buildDataCheckString(params, new Set(['hash']));
  var secret = await telegramLoginSecret(botToken);
  var expected = await hmacHex(secret, checkString);
  if (!timingSafeEqual(expected, hash.toLowerCase())) return null;

  return normalizeUser(parseTelegramUserFromLoginParams(params));
}

async function verifyTelegramWebAppInitData(initData, botToken) {
  if (!initData) return null;
  var params = new URLSearchParams(initData);
  var hash = params.get('hash');
  if (!hash) return null;
  var authDate = Number(params.get('auth_date') || 0) || 0;
  if (!authDate) return null;
  if (Date.now() / 1000 - authDate > 60 * 60 * 24) return null;

  var checkString = buildDataCheckString(params, new Set(['hash']));
  var secret = await telegramWebAppSecret(botToken);
  var expected = await hmacHex(secret, checkString);
  if (!timingSafeEqual(expected, hash.toLowerCase())) return null;

  return normalizeUser(parseTelegramUserFromWebApp(params));
}

function createSessionValue(user, botToken) {
  var payload = JSON.stringify({
    user: normalizeUser(user),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });
  return sha256Bytes(botToken).then(function (secret) {
    return hmacHex(secret, payload).then(function (signature) {
      return base64UrlEncode(payload) + '.' + signature;
    });
  });
}

async function readSessionValue(cookieValue, botToken) {
  if (!cookieValue || cookieValue.indexOf('.') === -1) return null;
  var parts = cookieValue.split('.');
  if (parts.length !== 2) return null;

  var payloadJson = '';
  try {
    payloadJson = new TextDecoder().decode(base64UrlDecode(parts[0]));
  } catch (err) {
    return null;
  }

  var secret = await sha256Bytes(botToken);
  var expected = await hmacHex(secret, payloadJson);
  if (!timingSafeEqual(expected, parts[1])) return null;

  try {
    var payload = JSON.parse(payloadJson);
    if (!payload || !payload.user || !payload.exp || payload.exp * 1000 < Date.now()) {
      return null;
    }
    return normalizeUser(payload.user);
  } catch (err) {
    return null;
  }
}

function buildSessionCookie(user, botToken) {
  return createSessionValue(user, botToken).then(function (value) {
    return [
      SESSION_COOKIE + '=' + encodeURIComponent(value),
      'HttpOnly',
      'Path=/',
      'SameSite=Lax',
      'Secure',
      'Max-Age=' + SESSION_TTL_SECONDS,
    ].join('; ');
  });
}

function clearSessionCookie() {
  return [
    SESSION_COOKIE + '=',
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Secure',
    'Max-Age=0',
  ].join('; ');
}

async function getSessionUser(request, botToken) {
  var cookies = parseCookies(request.headers.get('Cookie'));
  return readSessionValue(cookies[SESSION_COOKIE], botToken);
}

function safeRedirectTarget(rawValue) {
  var value = String(rawValue || '/');
  if (!value) return '/';
  if (value[0] !== '/') return '/';
  if (value.indexOf('//') === 0) return '/';
  return value;
}

export {
  SESSION_COOKIE,
  buildSessionCookie,
  clearSessionCookie,
  getSessionUser,
  normalizeUser,
  parseCookies,
  safeRedirectTarget,
  verifyTelegramLoginParams,
  verifyTelegramWebAppInitData,
};
