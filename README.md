# Блокнот машиниста

Telegram Mini App / PWA для учета смен локомотивных бригад.

## Что делает приложение

- Авторизует пользователя через Telegram WebApp `initData` или Telegram Login Widget.
- Хранит смены, параметры расчета зарплаты и присутствие пользователей на VPS в локальных JSON-файлах под `data/`.
- Показывает журнал смен, календарь, расчет часов/доплат и раздел документов.
- Работает как PWA с оффлайн-кэшем оболочки и очередью pending-изменений смен.

## Runtime

Текущий production path - VPS Node runtime:

- [`server.js`](/D:/work/bloknot-mashinista-tg/server.js) - активный HTTP/API/static server.
- [`ecosystem.config.js`](/D:/work/bloknot-mashinista-tg/ecosystem.config.js) - PM2 app `bloknot-mashinista`, `PORT=3000`.
- nginx на VPS проксирует `bloknot-mashinista-bot.ru` в `127.0.0.1:3000`.

Cloudflare Pages/D1 runtime больше не является активным production path и удален из репозитория, чтобы не было второго расходящегося backend.

## Основные файлы

- [`index.html`](/D:/work/bloknot-mashinista-tg/index.html) - app markup, tabs, overlays and asset links.
- [`server.js`](/D:/work/bloknot-mashinista-tg/server.js) - active API and static server.
- [`sw.js`](/D:/work/bloknot-mashinista-tg/sw.js) - service worker cache strategy for app shell and documents.
- [`scripts/README.md`](/D:/work/bloknot-mashinista-tg/scripts/README.md) - JS runtime structure and load order.
- [`styles/README.md`](/D:/work/bloknot-mashinista-tg/styles/README.md) - CSS structure by component groups.
- [`assets/docs/manifest.json`](/D:/work/bloknot-mashinista-tg/assets/docs/manifest.json) - static documents catalog consumed by `scripts/docs-app.js`.

## Local checks

```bash
npm run smoke:local
node --check server.js
```

## AI memory

This repo uses the project memory workflow in [`ai-memory/`](/D:/work/bloknot-mashinista-tg/ai-memory/).

Required agent entrypoint:

```bash
python tools/agent_memory.py preflight
```

Useful commands:

- `python tools/agent_memory.py refresh`
- `python tools/agent_memory.py log --task "..."`
- `python tools/agent_memory.py sync --direction push`
