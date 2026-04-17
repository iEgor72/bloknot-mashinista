'use strict';

const http = require('http');
const url = require('url');
const { config } = require('./config');
const { handleIncomingUpdate } = require('./master');
const { claimNextTask, listTasks, updateTask } = require('./storage');
const { loadProjects } = require('./projects');
const { sendMessage } = require('./telegram');

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function isAuthorizedInternal(req) {
  const required = String(config.internalApiKey || '').trim();
  if (!required) return false;
  const provided = String(req.headers['x-internal-key'] || '').trim();
  return provided && provided === required;
}

function formatTaskStatusForUser(status) {
  const map = {
    queued: 'принято',
    waiting_coder: 'передано кодеру',
    in_progress: 'в работе',
    completed: 'готово',
    failed: 'ошибка',
    canceled: 'отменено'
  };
  return map[String(status || '').trim()] || String(status || 'unknown');
}

async function notifyTaskResult(task) {
  if (!task || !task.chatId) return;
  const text = [
    `Задача ${task.id}`,
    `Статус: ${formatTaskStatusForUser(task.status)}`,
    task.result ? `Итог: ${task.result}` : ''
  ].filter(Boolean).join('\n');

  try {
    await sendMessage(task.chatId, text);
  } catch (_) {
    // ignore Telegram send failures in internal callback
  }
}

function getWebhookPath() {
  const secret = String(config.telegramWebhookSecret || '').trim();
  return secret ? `/telegram/webhook/${secret}` : '/telegram/webhook';
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '/';

  if (req.method === 'GET' && pathname === '/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'master-bot-hub',
      webhookPath: getWebhookPath(),
      hasOpenAI: !!config.openaiApiKey,
      hasTelegram: !!config.telegramBotToken
    });
    return;
  }

  if (req.method === 'POST' && pathname === getWebhookPath()) {
    if (!config.telegramBotToken) {
      sendJson(res, 503, { ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' });
      return;
    }

    try {
      const raw = await readBody(req);
      const update = raw ? JSON.parse(raw) : {};
      await handleIncomingUpdate(update);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error && error.message ? error.message : 'Invalid payload' });
    }
    return;
  }

  if (pathname.startsWith('/internal/')) {
    if (!isAuthorizedInternal(req)) {
      sendJson(res, 401, { ok: false, error: 'Unauthorized internal API access' });
      return;
    }

    if (req.method === 'GET' && pathname === '/internal/projects') {
      sendJson(res, 200, { ok: true, projects: loadProjects() });
      return;
    }

    if (req.method === 'GET' && pathname === '/internal/tasks') {
      const status = parsed.query && parsed.query.status ? String(parsed.query.status) : '';
      const limit = parsed.query && parsed.query.limit ? Number(parsed.query.limit) : 20;
      sendJson(res, 200, { ok: true, tasks: listTasks({ status, limit }) });
      return;
    }

    if (req.method === 'POST' && pathname === '/internal/tasks/claim') {
      try {
        const raw = await readBody(req);
        const payload = raw ? JSON.parse(raw) : {};
        const by = payload && payload.by ? String(payload.by) : 'coder';
        const task = claimNextTask(by);
        if (!task) {
          sendJson(res, 200, { ok: true, task: null });
          return;
        }
        sendJson(res, 200, { ok: true, task });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error && error.message ? error.message : 'Invalid payload' });
      }
      return;
    }

    const completeMatch = pathname.match(/^\/internal\/tasks\/([A-Za-z0-9_-]+)\/complete$/);
    if (req.method === 'POST' && completeMatch) {
      try {
        const taskId = completeMatch[1];
        const raw = await readBody(req);
        const payload = raw ? JSON.parse(raw) : {};
        const status = String(payload && payload.status || 'completed').trim();
        const result = String(payload && payload.result || '').trim();
        const noteBy = String(payload && payload.noteBy || 'coder').trim();
        const updated = updateTask(taskId, {
          status,
          result,
          noteBy,
          note: result || `Task marked as ${status}`
        });
        if (!updated) {
          sendJson(res, 404, { ok: false, error: 'Task not found' });
          return;
        }
        await notifyTaskResult(updated);
        sendJson(res, 200, { ok: true, task: updated });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error && error.message ? error.message : 'Invalid payload' });
      }
      return;
    }

    sendJson(res, 404, { ok: false, error: 'Internal route not found' });
    return;
  }

  sendJson(res, 404, { ok: false, error: 'Not found' });
});

server.listen(config.port, () => {
  console.log(`[master-bot-hub] listening on http://0.0.0.0:${config.port}`);
  console.log(`[master-bot-hub] webhook path: ${getWebhookPath()}`);
});
