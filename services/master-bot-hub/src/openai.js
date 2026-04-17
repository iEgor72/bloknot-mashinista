'use strict';

const { config } = require('./config');

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions';

function extractOutputText(payload) {
  if (!payload || typeof payload !== 'object') return '';
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const parts = [];
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray(item && item.content) ? item.content : [];
    for (const chunk of content) {
      if (chunk && typeof chunk.text === 'string') {
        parts.push(chunk.text);
      }
    }
  }
  return parts.join('\n').trim();
}

function maybeJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    const match = raw.match(/\{[\s\S]*\}$/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (__) {
      return null;
    }
  }
}

function guessProjectId(messageText, projects) {
  const text = String(messageText || '').toLowerCase();
  for (const project of projects || []) {
    const id = String(project.id || '').toLowerCase();
    const title = String(project.title || '').toLowerCase();
    if (id && text.includes(id)) return project.id;
    if (title && text.includes(title)) return project.id;
    if (id === 'bloknot' && (text.includes('блокнот') || text.includes('bloknot'))) return project.id;
  }
  return '';
}

function inferIntentHeuristic(args) {
  const text = String(args.text || '').trim();
  const projects = Array.isArray(args.projects) ? args.projects : [];
  const lower = text.toLowerCase();
  const projectId = guessProjectId(text, projects);
  const taskVerb = /(добав|сдела|исправ|почин|измен|созда|реализ|настро|обнов|удал|перенес|оптимиз|депло|перезапус|собер|проверь)/i.test(lower);
  const isTask = !!(taskVerb && (projectId || lower.length > 20));

  if (isTask) {
    const summary = text.length > 140 ? `${text.slice(0, 137).trim()}...` : text;
    return {
      mode: 'task',
      projectId: projectId || (projects[0] ? projects[0].id : ''),
      executionType: 'coder',
      summary,
      reply: 'Принял. Сформировал задачу и передаю кодеру в работу.',
      confidence: 0.62
    };
  }

  return {
    mode: 'chat',
    projectId: '',
    executionType: 'chat',
    summary: '',
    reply: 'Понял. Давай обсудим детали, а когда решишь делать — я сам оформлю задачу кодеру.',
    confidence: 0.45
  };
}

async function callOpenAiForIntent(args) {
  if (!config.openaiApiKey) return null;

  const projects = Array.isArray(args.projects) ? args.projects : [];
  const projectHint = projects.length
    ? projects.map((p) => `- ${p.id}: ${p.title}`).join('\n')
    : '- (нет зарегистрированных проектов)';

  const systemPrompt = [
    'Ты управляющий агент разработки в Telegram.',
    'Определи, является ли сообщение обычным диалогом или задачей для кодера.',
    'Верни СТРОГО JSON без markdown.',
    'JSON схема:',
    '{"mode":"chat|task","reply":"...","project_id":"...","execution_type":"coder|ops","summary":"...","confidence":0..1}',
    'Правила:',
    '- mode=task только если пользователь просит реально выполнить изменение/действие.',
    '- reply должен быть коротким и дружелюбным на русском.',
    '- project_id выбирай из списка проектов ниже.',
    '- execution_type="coder" для задач изменения кода/архитектуры.',
    '- execution_type="ops" только для операционных действий (перезапуск/деплой/статус).',
    '- summary: короткая формулировка задачи без воды.',
    '- Для chat mode project_id="" и summary="".',
    'Проекты:',
    projectHint
  ].join('\n');

  const body = {
    model: config.openaiModel,
    input: [
      {
        role: 'system',
        content: [
          { type: 'input_text', text: systemPrompt }
        ]
      },
      {
        role: 'user',
        content: [
          { type: 'input_text', text: `История:\n${args.historyText || '(пусто)'}\n\nНовое сообщение:\n${args.text || ''}` }
        ]
      }
    ],
    reasoning: { effort: 'low' },
    max_output_tokens: 350
  };

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiApiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`OpenAI intent HTTP ${response.status}`);
  }

  const payload = await response.json();
  const text = extractOutputText(payload);
  const parsed = maybeJson(text);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('OpenAI intent JSON parse failed');
  }

  const mode = String(parsed.mode || '').trim();
  if (mode !== 'chat' && mode !== 'task') {
    throw new Error('OpenAI intent mode is invalid');
  }

  return {
    mode,
    projectId: String(parsed.project_id || '').trim(),
    executionType: String(parsed.execution_type || 'coder').trim() || 'coder',
    summary: String(parsed.summary || '').trim(),
    reply: String(parsed.reply || '').trim(),
    confidence: Number(parsed.confidence || 0)
  };
}

function composeHistory(history) {
  const lines = [];
  for (const item of history || []) {
    if (!item || !item.role || !item.content) continue;
    lines.push(`${item.role}: ${String(item.content).replace(/\s+/g, ' ').trim()}`);
  }
  return lines.slice(-12).join('\n');
}

async function inferIntent(args) {
  const historyText = composeHistory(args.history || []);
  const payload = {
    text: args.text,
    historyText,
    projects: args.projects
  };

  try {
    const ai = await callOpenAiForIntent(payload);
    if (ai) return ai;
  } catch (_) {}

  return inferIntentHeuristic({
    text: args.text,
    projects: args.projects
  });
}

async function transcribeAudio(buffer, filename) {
  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is missing');
  }

  const form = new FormData();
  form.append('model', config.openaiTranscribeModel);
  form.append('file', new Blob([buffer]), filename || 'voice.ogg');

  const response = await fetch(TRANSCRIBE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`
    },
    body: form
  });

  if (!response.ok) {
    throw new Error(`OpenAI transcribe HTTP ${response.status}`);
  }

  const payload = await response.json();
  return String(payload && payload.text || '').trim();
}

module.exports = {
  inferIntent,
  transcribeAudio
};
