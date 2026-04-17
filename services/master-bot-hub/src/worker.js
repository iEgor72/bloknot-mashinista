'use strict';

const { execSync } = require('child_process');
const { config } = require('./config');
const { listTasks, updateTask } = require('./storage');
const { findProjectById } = require('./projects');
const { sendMessage } = require('./telegram');

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_MS || 15000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function runShell(command) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  }).trim();
}

function detectOpsAction(task) {
  const text = `${task.summary || ''} ${task.request || ''}`.toLowerCase();
  if (/(депло|выкат|обнови на сервер|pull на сервер)/.test(text)) return 'deploy';
  if (/(перезапус|рестарт|reload pm2)/.test(text)) return 'reload';
  if (/(статус|проверь сервис|проверка сервиса)/.test(text)) return 'status';
  return '';
}

function buildOpsCommand(project, action) {
  if (!project || project.id !== 'bloknot' || !project.vps || !project.vps.path || !project.vps.process) return '';
  const root = String(project.vps.path).trim();
  const proc = String(project.vps.process).trim();
  if (!root || !proc) return '';

  if (action === 'deploy') {
    return `cd ${root} && git pull --ff-only origin main && pm2 reload ${proc} --update-env`;
  }
  if (action === 'reload') {
    return `pm2 reload ${proc} --update-env`;
  }
  if (action === 'status') {
    return `pm2 status ${proc} --no-color`;
  }
  return '';
}

async function notify(task, text) {
  if (!task || !task.chatId || !text) return;
  try {
    await sendMessage(task.chatId, text);
  } catch (_) {
    // ignore telegram send errors in worker
  }
}

async function processQueuedTask(task) {
  const project = findProjectById(task.projectId);

  updateTask(task.id, {
    status: 'in_progress',
    noteBy: 'executor',
    note: `Picked by executor at ${nowIso()}`
  });

  if ((task.executionType || 'coder') !== 'ops') {
    const updated = updateTask(task.id, {
      status: 'waiting_coder',
      noteBy: 'executor',
      note: 'Forwarded to coder queue'
    });
    await notify(updated, `Задача ${task.id}\nСтатус: передано кодеру`);
    return;
  }

  const action = detectOpsAction(task);
  const command = buildOpsCommand(project, action);
  if (!command) {
    const failed = updateTask(task.id, {
      status: 'failed',
      result: 'Операционный сценарий не распознан или не разрешен для проекта.',
      noteBy: 'executor',
      note: 'Ops action not supported'
    });
    await notify(failed, `Задача ${task.id}\nСтатус: ошибка\nИтог: ${failed.result}`);
    return;
  }

  try {
    const output = runShell(command);
    const done = updateTask(task.id, {
      status: 'completed',
      result: output ? output.slice(0, 1500) : 'Выполнено без вывода',
      noteBy: 'executor',
      note: `Ops action '${action}' completed`
    });
    await notify(done, `Задача ${task.id}\nСтатус: готово\nИтог: ${done.result}`);
  } catch (error) {
    const failed = updateTask(task.id, {
      status: 'failed',
      result: error && error.message ? error.message : 'Unknown executor error',
      noteBy: 'executor',
      note: `Ops action '${action}' failed`
    });
    await notify(failed, `Задача ${task.id}\nСтатус: ошибка\nИтог: ${failed.result}`);
  }
}

async function loop() {
  console.log(`[master-worker] started, poll interval ${POLL_INTERVAL_MS}ms`);
  while (true) {
    try {
      const queued = listTasks({ status: 'queued', limit: 50 });
      for (const task of queued) {
        await processQueuedTask(task);
      }
    } catch (error) {
      console.error('[master-worker] loop error:', error && error.message ? error.message : error);
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

if (!config.telegramBotToken) {
  console.error('[master-worker] TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

loop().catch((error) => {
  console.error('[master-worker] fatal:', error && error.message ? error.message : error);
  process.exit(1);
});
