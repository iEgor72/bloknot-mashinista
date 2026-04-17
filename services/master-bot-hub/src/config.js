'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function loadDotEnv() {
  const envFile = path.join(ROOT, '.env');
  if (!fs.existsSync(envFile)) return;
  const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = String(line || '').trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

function toPath(value, fallbackRelative) {
  const raw = String(value || '').trim();
  const base = raw || fallbackRelative;
  if (path.isAbsolute(base)) return base;
  return path.resolve(ROOT, base);
}

const config = {
  rootDir: ROOT,
  port: Number(process.env.PORT || 3100),
  telegramBotToken: String(process.env.TELEGRAM_BOT_TOKEN || '').trim(),
  telegramWebhookSecret: String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim(),
  openaiApiKey: String(process.env.OPENAI_API_KEY || '').trim(),
  openaiModel: String(process.env.OPENAI_MODEL || 'gpt-5.2').trim(),
  openaiTranscribeModel: String(process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe').trim(),
  dataDir: toPath(process.env.MASTER_DATA_DIR, './data'),
  projectsFile: toPath(process.env.MASTER_PROJECTS_FILE, './config/projects.json'),
  internalApiKey: String(process.env.MASTER_INTERNAL_API_KEY || '').trim()
};

module.exports = {
  config
};
