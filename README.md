# Shift Tracker App

Telegram Web App для учёта смен с общей синхронизацией данных.

## Как это работает

- Telegram и ярлык на телефоне открывают одну и ту же страницу.
- У каждого пользователя свой `sid`.
- Данные хранятся в Cloudflare D1, поэтому они одинаковые на всех устройствах.

## Самый простой бесплатный хостинг

Нужен Cloudflare Pages + D1.

Это обычно не требует платной подписки, и у Cloudflare есть бесплатные планы для Pages и D1.

Официальные страницы:
- [Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)

## Что сделать

1. Зайди в Cloudflare и создай Pages-проект из этого GitHub-репозитория.
2. Подключи репозиторий `iEgor72/shift-tracker-app`.
3. Создай D1 database в Cloudflare.
4. В настройках Pages добавь binding `DB` на эту D1 database.
5. После деплоя открой выданный URL.
6. Этот URL поставь в Telegram-боте как Web App URL.
7. В Telegram открой приложение и нажми `Добавить на экран`.

## Файлы

- [`index.html`](./index.html) - интерфейс приложения.
- [`functions/api/shifts.js`](./functions/api/shifts.js) - API для чтения и сохранения смен.
- [`wrangler.toml`](./wrangler.toml) - базовая конфигурация Cloudflare Pages.

## Локальный запуск

Если хочешь проверить страницу локально:

```bash
npm start
```

Тогда будет доступен локальный сервер на `http://localhost:3000`.
