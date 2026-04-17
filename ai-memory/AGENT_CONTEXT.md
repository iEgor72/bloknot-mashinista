# Agent Context

Ручной слой памяти. Храни здесь стабильные договорённости:
- архитектурные ограничения;
- принятые конвенции;
- технический долг;
- риски и причины решений.

## VPS Runtime (72.56.109.219)

- Сервер: `root@72.56.109.219` (Ubuntu 24.04, hostname `ams-1-vm-9glf`).
- На сервере 2 проекта:
- `bloknot-mashinista` (нужный проект): `/opt/bloknot-mashinista`
- `studio-bot` (отдельный проект): `/opt/studio-bot`

### Нужный проект: /opt/bloknot-mashinista

- Git remote: `https://github.com/iEgor72/bloknot-mashinista.git`
- Рабочая ветка: `main`
- Runtime: `node server.js` под `pm2` процессом `bloknot-mashinista`
- PM2 cwd/script: `/opt/bloknot-mashinista` / `/opt/bloknot-mashinista/server.js`
- Порт приложения: `127.0.0.1:3000`
- Reverse proxy: `nginx` site `/etc/nginx/sites-available/bloknot` -> `proxy_pass http://127.0.0.1:3000`
- Домен: `https://bloknot-mashinista-bot.ru` (TLS через certbot)

### Второй проект: /opt/studio-bot

- Запущен как systemd unit: `studio-bot.service`
- WorkingDirectory: `/opt/studio-bot`
- Команда: `/opt/studio-bot/venv/bin/python -m bot`
- Этот сервис не относится к деплою bloknot-mashinista.

## Deployment Policy (обязательный порядок)

1. Локально: изменения -> commit -> `git push origin main`.
2. На VPS:
- `cd /opt/bloknot-mashinista`
- `git pull --ff-only origin main`
- если обновлялись зависимости: `npm install`
- `pm2 reload bloknot-mashinista --update-env`
3. Проверка:
- `pm2 ls`
- `curl -Ik https://bloknot-mashinista-bot.ru`

### Ownership

- Push в Git выполняет агент (Codex) самостоятельно.
- После push агент выполняет деплой на VPS (pull/reload/smoke-check) и отчитывается результатом.
- Пользователь не запускает деплой-команды вручную, если явно не попросил иной режим.

## Ограничения

- Не деплоить через ручное редактирование файлов на VPS (кроме аварийных hotfix).
- Не трогать `/opt/studio-bot` и `studio-bot.service` вообще без явной прямой команды пользователя в этом чате.
- При любой задаче сохранять существующие функции приложения (включая оффлайн-режим) без регрессий.
