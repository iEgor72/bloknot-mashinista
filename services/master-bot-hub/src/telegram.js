'use strict';

const https = require('https');
const { config } = require('./config');

function telegramRequest(method, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload || {});
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${config.telegramBotToken}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : { ok: false };
          if (!parsed.ok) {
            reject(new Error(`Telegram API ${method} failed`));
            return;
          }
          resolve(parsed.result);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sendMessage(chatId, text, options = {}) {
  const payload = {
    chat_id: chatId,
    text: String(text || ''),
    disable_web_page_preview: true
  };
  if (options.replyToMessageId) {
    payload.reply_to_message_id = options.replyToMessageId;
  }
  return telegramRequest('sendMessage', payload);
}

async function getFileInfo(fileId) {
  return telegramRequest('getFile', { file_id: fileId });
}

function downloadFileByPath(filePath) {
  return new Promise((resolve, reject) => {
    const safePath = String(filePath || '').replace(/^\/+/, '');
    if (!safePath) {
      reject(new Error('filePath is empty'));
      return;
    }
    const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${safePath}`;
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Telegram file download HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function downloadVoiceMessage(fileId) {
  const info = await getFileInfo(fileId);
  const filePath = info && info.file_path ? String(info.file_path) : '';
  if (!filePath) {
    throw new Error('Telegram file_path missing');
  }
  const data = await downloadFileByPath(filePath);
  const filename = filePath.split('/').pop() || 'voice.ogg';
  return { data, filename };
}

module.exports = {
  downloadVoiceMessage,
  sendMessage
};
