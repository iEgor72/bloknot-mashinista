function json(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function buildBaseUrl(request) {
  var url = new URL(request.url);
  return url.origin;
}

function buildReply(chatId, baseUrl) {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text:
      'Блокнот машиниста готов.\n\n' +
      'Открывай мини-апп кнопкой ниже и добавляй смены откуда удобно. ' +
      'Если откроешь сайт в браузере, войди через Telegram один раз, и данные синхронизируются автоматически.',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Открыть мини-апп',
            web_app: { url: baseUrl },
          },
        ],
        [
          {
            text: 'Открыть в браузере',
            url: baseUrl,
          },
        ],
      ],
    },
  };
}

export async function onRequest(context) {
  try {
    var request = context.request;
    if (request.method !== 'POST') {
      return json({ ok: true });
    }

    var update = await request.json();
    var message = update && update.message;
    var text = (message && message.text) || '';
    var chatId = message && message.chat && message.chat.id;

    if (!chatId) {
      return json({ ok: true });
    }

    if (text.indexOf('/start') === 0 || text.indexOf('/help') === 0) {
      return json(buildReply(chatId, buildBaseUrl(request)));
    }

    return json({
      method: 'sendMessage',
      chat_id: chatId,
      text:
        'Используй кнопку «Открыть мини-апп» в сообщении или кнопку Mini App в меню бота. ' +
        'Там же можно добавить смену, и она появится везде.',
    });
  } catch (err) {
    return json({
      ok: true,
      error: err && err.message ? err.message : 'ignored',
    });
  }
}
