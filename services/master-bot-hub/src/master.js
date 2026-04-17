'use strict';

const path = require('path');
const { inferIntent, transcribeAudio } = require('./openai');
const { loadProjects, findProjectById } = require('./projects');
const {
  appendDialogMessage,
  createTask,
  getDialogHistory,
  updateTask,
  writeHandoff
} = require('./storage');
const { downloadVoiceMessage, sendMessage } = require('./telegram');

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function greetText() {
  return [
    'Привет. Я мастер-бот по проектам.',
    'Можем обсуждать идеи в обычном режиме, без команд.',
    'Когда ты формулируешь задачу на реализацию, я сам оформляю её для кодера и веду статус.'
  ].join('\n');
}

function buildHandoffMarkdown(task, project, sourceText) {
  const rules = Array.isArray(project && project.rules) ? project.rules : [];
  const lines = [
    `# Handoff ${task.id}`,
    '',
    `- Created: ${task.createdAt}`,
    `- Project: ${project ? project.id : '(not-set)'}`,
    `- Title: ${task.summary || task.request}`,
    `- Source: ${task.source}`,
    '',
    '## User Request',
    sourceText || task.request,
    '',
    '## Constraints'
  ];

  if (rules.length) {
    for (const rule of rules) {
      lines.push(`- ${rule}`);
    }
  } else {
    lines.push('- Keep existing behavior stable.');
  }

  lines.push('', '## Expected Result', '- Clear implementation summary', '- Changed file list', '- Verification notes');
  return lines.join('\n');
}

async function extractUserTextFromMessage(message) {
  const direct = normalizeText(message && message.text);
  if (direct) {
    return { text: direct, source: 'text' };
  }

  const voice = message && message.voice;
  if (!voice || !voice.file_id) {
    return { text: '', source: 'none' };
  }

  try {
    const { data, filename } = await downloadVoiceMessage(voice.file_id);
    const transcript = normalizeText(await transcribeAudio(data, filename));
    if (!transcript) {
      return { text: '', source: 'voice-empty' };
    }
    return { text: transcript, source: 'voice' };
  } catch (_) {
    return { text: '', source: 'voice-error' };
  }
}

function guessProjectFromText(text, projects) {
  const lower = String(text || '').toLowerCase();
  for (const project of projects) {
    if (project.id && lower.includes(project.id.toLowerCase())) return project;
    if (project.title && lower.includes(String(project.title).toLowerCase())) return project;
    if (project.id === 'bloknot' && (lower.includes('блокнот') || lower.includes('bloknot'))) return project;
  }
  return projects[0] || null;
}

async function handleIncomingUpdate(update) {
  const message = update && (update.message || update.edited_message);
  if (!message || !message.chat || !message.chat.id) return;

  const chatId = String(message.chat.id);
  const from = message.from || {};
  const userId = String(from.id || '').trim();
  const username = String(from.username || '').trim();
  const messageId = message.message_id;
  const originalText = normalizeText(message.text);

  if (/^\/start(?:@\w+)?$/i.test(originalText) || /^\/help(?:@\w+)?$/i.test(originalText)) {
    await sendMessage(chatId, greetText(), { replyToMessageId: messageId });
    return;
  }

  const extracted = await extractUserTextFromMessage(message);
  if (!extracted.text) {
    await sendMessage(
      chatId,
      'Не смог прочитать сообщение. Напиши текстом или проверь, что голосовое доступно для распознавания.',
      { replyToMessageId: messageId }
    );
    return;
  }

  const projects = loadProjects();
  const history = getDialogHistory(chatId, 14);
  const intent = await inferIntent({
    text: extracted.text,
    history,
    projects
  });

  let reply = normalizeText(intent && intent.reply) || 'Понял. Давай продолжим.';

  if (intent && intent.mode === 'task') {
    const chosenProject = findProjectById(intent.projectId) || guessProjectFromText(extracted.text, projects);
    if (!chosenProject) {
      reply = 'Понял задачу, но пока не найден проект для выполнения. Скажи в каком проекте делать.';
    } else {
      const task = createTask({
        source: 'telegram-master',
        projectId: chosenProject.id,
        request: extracted.text,
        summary: normalizeText(intent.summary) || extracted.text,
        executionType: normalizeText(intent.executionType) || 'coder',
        chatId,
        telegramUserId: userId,
        username
      });

      if (!task) {
        reply = 'Не удалось создать задачу. Повтори, пожалуйста, формулировку.';
      } else {
        const handoffBody = buildHandoffMarkdown(task, chosenProject, extracted.text);
        const handoffPath = writeHandoff(task, handoffBody);
        updateTask(task.id, {
          status: 'waiting_coder',
          noteBy: 'master-bot',
          note: `Handoff prepared: ${path.basename(handoffPath)}`
        });

        reply = [
          normalizeText(intent.reply) || 'Принял задачу и передал кодеру.',
          '',
          `Проект: ${chosenProject.title}`,
          `Номер: ${task.id}`,
          'Статус: передано кодеру'
        ].join('\n');
      }
    }
  }

  appendDialogMessage(chatId, 'user', extracted.text);
  appendDialogMessage(chatId, 'assistant', reply);

  await sendMessage(chatId, reply, { replyToMessageId: messageId });
}

module.exports = {
  handleIncomingUpdate
};
