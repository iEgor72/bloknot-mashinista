# Master Bot Hub (MVP)

Отдельный сервис для Telegram-диалога с ИИ и постановки задач кодеру без `/task` команд.

## Что уже делает MVP

- Ведёт обычный диалог в Telegram (чатовый режим).
- При явной формулировке задачи сам создаёт задачу в очереди.
- Поддерживает голосовые сообщения через OpenAI transcription (если задан API ключ).
- Хранит диалог и задачи локально в `data/state.json`.
- Готовит handoff-файл для кодера в `data/handoffs/<task-id>.md`.
- Имеет внутренний API для интеграции кодера/исполнителя.

## Ограничения MVP

- Кодер пока не вызывается напрямую из этого сервиса автоматически.
- Для code-task сервис ставит статус `waiting_coder` и ждёт внешнего исполнителя.
- Авто-ops (`worker`) выполняет только безопасные операционные сценарии.

## Конфигурация

1. Скопируй `.env.example` -> `.env`.
2. Заполни минимум:
- `TELEGRAM_BOT_TOKEN`
- `OPENAI_API_KEY`
- `MASTER_INTERNAL_API_KEY`
3. Проверь `config/projects.json`.

## Запуск

```bash
npm start
```

Отдельный worker:

```bash
npm run worker
```

## Webhook

- Путь: `/telegram/webhook` или `/telegram/webhook/<TELEGRAM_WEBHOOK_SECRET>`
- Health: `/health`

## Internal API (для кодера/интегратора)

Требует header:

- `x-internal-key: <MASTER_INTERNAL_API_KEY>`

Endpoints:

- `GET /internal/projects`
- `GET /internal/tasks?status=queued&limit=20`
- `POST /internal/tasks/claim` body: `{ "by": "codex" }`
- `POST /internal/tasks/:id/complete` body: `{ "status": "completed|failed", "result": "...", "noteBy": "codex" }`
