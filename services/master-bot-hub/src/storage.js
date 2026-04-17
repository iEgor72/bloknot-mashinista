'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { config } = require('./config');

const STATE_FILE = path.join(config.dataDir, 'state.json');
const HANDOFF_DIR = path.join(config.dataDir, 'handoffs');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function createEmptyState() {
  return {
    createdAt: nowIso(),
    updatedAt: nowIso(),
    counters: {
      task: 0
    },
    dialogs: {},
    tasks: []
  };
}

function ensureStateFile() {
  ensureDir(config.dataDir);
  ensureDir(HANDOFF_DIR);
  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(createEmptyState(), null, 2), 'utf8');
  }
}

function readState() {
  ensureStateFile();
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = raw ? JSON.parse(raw) : createEmptyState();
    if (!parsed || typeof parsed !== 'object') return createEmptyState();
    if (!parsed.dialogs || typeof parsed.dialogs !== 'object') parsed.dialogs = {};
    if (!Array.isArray(parsed.tasks)) parsed.tasks = [];
    if (!parsed.counters || typeof parsed.counters !== 'object') parsed.counters = { task: 0 };
    if (!Number.isFinite(parsed.counters.task)) parsed.counters.task = 0;
    return parsed;
  } catch (error) {
    return createEmptyState();
  }
}

function writeState(state) {
  const safeState = state && typeof state === 'object' ? state : createEmptyState();
  safeState.updatedAt = nowIso();
  ensureStateFile();
  const tempFile = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(safeState, null, 2), 'utf8');
  fs.renameSync(tempFile, STATE_FILE);
  return safeState;
}

function getDialog(state, chatId) {
  const key = String(chatId || '').trim();
  if (!key) return null;
  if (!state.dialogs[key]) {
    state.dialogs[key] = {
      history: []
    };
  }
  if (!Array.isArray(state.dialogs[key].history)) {
    state.dialogs[key].history = [];
  }
  return state.dialogs[key];
}

function appendDialogMessage(chatId, role, content) {
  const state = readState();
  const dialog = getDialog(state, chatId);
  if (!dialog) return null;
  const text = String(content || '').trim();
  if (!text) return null;
  dialog.history.push({
    role: String(role || 'user').trim() || 'user',
    content: text,
    at: nowIso()
  });
  dialog.history = dialog.history.slice(-40);
  writeState(state);
  return dialog.history;
}

function getDialogHistory(chatId, limit = 12) {
  const state = readState();
  const dialog = getDialog(state, chatId);
  if (!dialog) return [];
  const safeLimit = Math.max(1, Math.min(40, Number(limit) || 12));
  return dialog.history.slice(-safeLimit);
}

function nextTaskId(state) {
  state.counters.task = Number(state.counters.task || 0) + 1;
  const seq = String(state.counters.task).padStart(5, '0');
  const rand = crypto.randomBytes(2).toString('hex');
  return `t-${seq}-${rand}`;
}

function createTask(payload) {
  const state = readState();
  const id = nextTaskId(state);
  const task = {
    id,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    status: 'queued',
    source: String(payload && payload.source || 'telegram').trim() || 'telegram',
    projectId: String(payload && payload.projectId || '').trim(),
    request: String(payload && payload.request || '').trim(),
    summary: String(payload && payload.summary || '').trim(),
    executionType: String(payload && payload.executionType || 'coder').trim() || 'coder',
    chatId: String(payload && payload.chatId || '').trim(),
    telegramUserId: String(payload && payload.telegramUserId || '').trim(),
    username: String(payload && payload.username || '').trim(),
    notes: [],
    result: ''
  };

  if (!task.request) return null;

  state.tasks.unshift(task);
  state.tasks = state.tasks.slice(0, 1000);
  writeState(state);
  return task;
}

function listTasks(options = {}) {
  const state = readState();
  const status = String(options.status || '').trim();
  const limit = Math.max(1, Math.min(200, Number(options.limit) || 20));
  const source = Array.isArray(state.tasks) ? state.tasks : [];
  const filtered = status ? source.filter((task) => task.status === status) : source;
  return filtered.slice(0, limit);
}

function findTaskById(taskId) {
  const state = readState();
  const id = String(taskId || '').trim();
  const task = state.tasks.find((item) => item.id === id) || null;
  return { state, task };
}

function updateTask(taskId, patch = {}) {
  const state = readState();
  const id = String(taskId || '').trim();
  const idx = state.tasks.findIndex((item) => item.id === id);
  if (idx < 0) return null;

  const current = state.tasks[idx];
  const next = {
    ...current,
    updatedAt: nowIso()
  };

  if (patch.status) next.status = String(patch.status).trim();
  if (patch.result !== undefined) next.result = String(patch.result || '').trim();

  const noteText = String(patch.note || '').trim();
  if (noteText) {
    const by = String(patch.noteBy || 'system').trim() || 'system';
    next.notes = (Array.isArray(current.notes) ? current.notes : []).concat([
      {
        at: next.updatedAt,
        by,
        text: noteText
      }
    ]).slice(-100);
  }

  state.tasks[idx] = next;
  writeState(state);
  return next;
}

function claimNextTask(claimBy) {
  const state = readState();
  const idx = state.tasks.findIndex((task) => task.status === 'queued' || task.status === 'waiting_coder');
  if (idx < 0) return null;
  const current = state.tasks[idx];
  const next = {
    ...current,
    status: 'in_progress',
    updatedAt: nowIso(),
    notes: (Array.isArray(current.notes) ? current.notes : []).concat([
      {
        at: nowIso(),
        by: String(claimBy || 'coder').trim() || 'coder',
        text: 'Task claimed'
      }
    ]).slice(-100)
  };
  state.tasks[idx] = next;
  writeState(state);
  return next;
}

function writeHandoff(task, body) {
  ensureStateFile();
  const id = String(task && task.id || '').trim();
  if (!id) return '';
  const filePath = path.join(HANDOFF_DIR, `${id}.md`);
  fs.writeFileSync(filePath, String(body || '').trim() + '\n', 'utf8');
  return filePath;
}

module.exports = {
  appendDialogMessage,
  claimNextTask,
  createTask,
  findTaskById,
  getDialogHistory,
  listTasks,
  updateTask,
  writeHandoff,
  STATE_FILE,
  HANDOFF_DIR
};
