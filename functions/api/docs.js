import { getSessionUser } from '../features/auth/telegram-auth.js';
import { listDocFiles, saveDocFile, deleteDocFile, getDocFile } from '../features/docs/store.js';

var VALID_FOLDERS = ['speeds', 'folders', 'memos', 'regimki', 'instructions'];
var TG_API = 'https://api.telegram.org/bot';
var DOCS_CHAT_ID = '-1003809954655';

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status: status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function isAdmin(user, env) {
  var adminId = env && env.ADMIN_TELEGRAM_ID;
  if (!adminId) return false;
  return String(user.id) === String(adminId);
}

// Send file to Telegram storage channel, returns { file_id, file_unique_id, mime_type, file_size }
async function uploadToTelegram(botToken, fileBlob, fileName) {
  var form = new FormData();
  form.append('chat_id', DOCS_CHAT_ID);
  form.append('document', fileBlob, fileName);
  // Pin caption so we can find files manually in the channel if needed
  form.append('caption', fileName);

  var resp = await fetch(TG_API + botToken + '/sendDocument', {
    method: 'POST',
    body: form,
  });

  var data = await resp.json();
  if (!data.ok) {
    throw new Error('Telegram upload failed: ' + (data.description || 'unknown error'));
  }

  var doc = data.result && data.result.document;
  if (!doc) throw new Error('Telegram did not return document info');

  return {
    file_id: doc.file_id,
    file_unique_id: doc.file_unique_id,
    mime_type: doc.mime_type || 'application/octet-stream',
    file_size: doc.file_size || 0,
  };
}

// Get temporary download URL from Telegram (valid ~1 hour)
async function getTelegramFileUrl(botToken, file_id) {
  var resp = await fetch(TG_API + botToken + '/getFile?file_id=' + encodeURIComponent(file_id));
  var data = await resp.json();
  if (!data.ok || !data.result || !data.result.file_path) {
    throw new Error('Cannot get file path from Telegram');
  }
  return 'https://api.telegram.org/file/bot' + botToken + '/' + data.result.file_path;
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
    if (!env.DB) {
      return json(500, { error: 'DB binding is missing' });
    }

    var user = await getSessionUser(request, botToken);
    if (!user) {
      return json(401, { error: 'Unauthorized' });
    }

    var url = new URL(request.url);

    // ── GET /api/docs?folder=speeds — list files ────────────────────────────
    if (request.method === 'GET') {
      // Proxy file bytes: ?download=<tg_file_id>
      var downloadFileId = url.searchParams.get('download');
      if (downloadFileId) {
        var dlUrl = await getTelegramFileUrl(botToken, downloadFileId);
        var fileResp = await fetch(dlUrl);
        if (!fileResp.ok) {
          return json(502, { error: 'Telegram fetch failed: ' + fileResp.status });
        }
        var contentType = fileResp.headers.get('content-type') || 'application/octet-stream';
        return new Response(fileResp.body, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'private, max-age=3600',
          },
        });
      }

      // Single file temp URL: ?file_id=xxx  (kept for compatibility)
      var reqFileId = url.searchParams.get('file_id');
      if (reqFileId) {
        var dlUrl = await getTelegramFileUrl(botToken, reqFileId);
        return json(200, { url: dlUrl });
      }

      var folder = url.searchParams.get('folder') || 'speeds';
      if (!VALID_FOLDERS.includes(folder)) {
        return json(400, { error: 'Invalid folder' });
      }

      var files = await listDocFiles(env.DB, folder);
      return json(200, {
        files: files,
        folder: folder,
        is_admin: isAdmin(user, env),
      });
    }

    // ── POST /api/docs?action=send&id=123 — send file to user's Telegram chat ─
    if (request.method === 'POST' && url.searchParams.get('action') === 'send') {
      var sendId = parseInt(url.searchParams.get('id'), 10);
      if (!sendId) return json(400, { error: 'Missing id' });

      var fileRow = await getDocFile(env.DB, sendId);
      if (!fileRow) return json(404, { error: 'File not found' });

      var sendResp = await fetch(TG_API + botToken + '/sendDocument', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: user.id,
          document: fileRow.file_id,
          caption: fileRow.name,
        }),
      });
      var sendData = await sendResp.json();
      if (!sendData.ok) {
        throw new Error(sendData.description || 'Telegram error');
      }
      return json(200, { ok: true });
    }

    // ── POST /api/docs?folder=speeds — upload file (admin only) ─────────────
    if (request.method === 'POST') {
      if (!isAdmin(user, env)) {
        return json(403, { error: 'Только администратор может загружать файлы' });
      }

      var folder = url.searchParams.get('folder') || 'speeds';
      if (!VALID_FOLDERS.includes(folder)) {
        return json(400, { error: 'Invalid folder' });
      }

      var formData = await request.formData();
      var file = formData.get('file');
      if (!file || typeof file === 'string') {
        return json(400, { error: 'Файл не передан' });
      }

      var fileName = (file.name || 'file').slice(0, 200);
      var tgResult = await uploadToTelegram(botToken, file, fileName);

      var id = await saveDocFile(env.DB, {
        folder: folder,
        name: fileName,
        file_id: tgResult.file_id,
        file_unique_id: tgResult.file_unique_id,
        mime_type: tgResult.mime_type,
        file_size: tgResult.file_size,
        uploaded_by: String(user.id),
      });

      return json(200, {
        ok: true,
        id: id,
        name: fileName,
        folder: folder,
        file_id: tgResult.file_id,
        mime_type: tgResult.mime_type,
        file_size: tgResult.file_size,
      });
    }

    // ── DELETE /api/docs?id=123 — delete file (admin only) ──────────────────
    if (request.method === 'DELETE') {
      if (!isAdmin(user, env)) {
        return json(403, { error: 'Только администратор может удалять файлы' });
      }

      var id = parseInt(url.searchParams.get('id'), 10);
      if (!id) {
        return json(400, { error: 'Missing id parameter' });
      }

      var existing = await getDocFile(env.DB, id);
      if (!existing) {
        return json(404, { error: 'Файл не найден' });
      }

      await deleteDocFile(env.DB, id);
      return json(200, { ok: true, id: id });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    return json(500, {
      error: err && err.message ? err.message : 'Unexpected error',
    });
  }
}
