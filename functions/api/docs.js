import { getSessionUser } from '../features/auth/telegram-auth.js';

var VALID_FOLDERS = ['speeds', 'folders', 'memos', 'regimki', 'instructions'];

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status: status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function isAdmin(user, env) {
  var adminId = env && env.ADMIN_TELEGRAM_ID;
  if (!adminId) return false;
  return String(user.id) === String(adminId);
}

function sanitizeFileName(name) {
  // Keep Cyrillic, Latin, digits, dots, dashes, underscores — replace everything else
  return (name || 'file')
    .replace(/[^a-zA-Z0-9а-яёА-ЯЁ.\-_\s]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 200);
}

export async function onRequest(context) {
  try {
    var request = context.request;
    var env = context.env || {};
    var botToken = env.TELEGRAM_BOT_TOKEN;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }

    if (!botToken) {
      return json(500, { error: 'TELEGRAM_BOT_TOKEN is missing' });
    }

    if (!env.DOCS_BUCKET) {
      return json(500, { error: 'DOCS_BUCKET binding is missing. Create an R2 bucket and bind it as DOCS_BUCKET in Cloudflare Pages settings.' });
    }

    var user = await getSessionUser(request, botToken);
    if (!user) {
      return json(401, { error: 'Unauthorized' });
    }

    var url = new URL(request.url);
    var folder = url.searchParams.get('folder') || 'general';
    if (!VALID_FOLDERS.includes(folder)) {
      return json(400, { error: 'Invalid folder. Use one of: ' + VALID_FOLDERS.join(', ') });
    }

    // ── GET: list files in folder ───────────────────────────────────────────
    if (request.method === 'GET') {
      var prefix = folder + '/';
      var listed = await env.DOCS_BUCKET.list({ prefix: prefix });
      var files = (listed.objects || []).map(function(obj) {
        return {
          key: obj.key,
          name: obj.key.slice(prefix.length),
          size: obj.size,
          uploaded: obj.uploaded ? obj.uploaded.toISOString() : null,
        };
      });
      return json(200, { files: files, folder: folder });
    }

    // ── POST: upload file (admin only) ──────────────────────────────────────
    if (request.method === 'POST') {
      if (!isAdmin(user, env)) {
        return json(403, { error: 'Forbidden: admin only' });
      }

      var contentType = request.headers.get('Content-Type') || '';
      if (contentType.indexOf('multipart/form-data') === -1) {
        return json(400, { error: 'Expected multipart/form-data' });
      }

      var formData = await request.formData();
      var file = formData.get('file');
      if (!file || typeof file === 'string') {
        return json(400, { error: 'No file provided' });
      }

      var safeName = sanitizeFileName(file.name || 'file');
      var key = folder + '/' + safeName;

      await env.DOCS_BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || 'application/octet-stream' },
      });

      return json(200, { ok: true, key: key, name: safeName, folder: folder });
    }

    // ── DELETE: remove file (admin only) ───────────────────────────────────
    if (request.method === 'DELETE') {
      if (!isAdmin(user, env)) {
        return json(403, { error: 'Forbidden: admin only' });
      }

      var key = url.searchParams.get('key');
      if (!key) {
        return json(400, { error: 'Missing key parameter' });
      }

      // Security: key must start with a valid folder to prevent path traversal
      var keyFolder = key.split('/')[0];
      if (!VALID_FOLDERS.includes(keyFolder)) {
        return json(400, { error: 'Invalid key' });
      }

      await env.DOCS_BUCKET.delete(key);
      return json(200, { ok: true, key: key });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    return json(500, {
      error: err && err.message ? err.message : 'Unexpected error',
    });
  }
}
