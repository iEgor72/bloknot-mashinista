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

function buildReply(chatId, baseUrl, firstName) {
  var greeting = firstName ? ('👋 Привет, ' + firstName + '!') : '👋 Привет!';
  return {
    method: 'sendPhoto',
    chat_id: chatId,
    photo: baseUrl + '/assets/welcome-promo.jpg',
    caption:
      greeting + '\n\n' +
      'Блокнот машиниста помогает держать всё важное в одном месте.\n\n' +
      'Что можно делать в приложении:\n' +
      '📅 считать часы по сменам, дням и месяцам\n' +
      '💸 быстро рассчитывать зарплату по часам, тарифам и доплатам\n' +
      '⏱ запускать таймер для смен, поездок и задач\n' +
      '📚 быстро открывать документы и инструкции без лишнего поиска\n\n' +
      '🔒 Данные привязаны к твоему Telegram-аккаунту и доступны с любого устройства.\n\n' +
      'Нажимай кнопку ниже и открывай приложение.',
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
    var firstName = (message && message.from && message.from.first_name) || '';

    if (!chatId) {
      return json({ ok: true });
    }

    if (text.indexOf('/start') === 0 || text.indexOf('/help') === 0) {
      return json(buildReply(chatId, buildBaseUrl(request), firstName));
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
