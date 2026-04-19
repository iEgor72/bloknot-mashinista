# Agent Context

Ручной слой памяти. Храни здесь стабильные договорённости:
- архитектурные ограничения;
- принятые конвенции;
- технический долг;
- риски и причины решений.

## Mandatory Memory Rule

- Перед любой работой по проекту агент обязан запустить `python tools/agent_memory.py preflight`.
- Затем агент читает memory-файлы в порядке из `ai-memory/SESSION_PROTOCOL.md`.
- Только после этого можно искать по коду, анализировать, править файлы, запускать тесты, планировать деплой или отвечать по проекту.
- После значимого изменения: `python tools/agent_memory.py log --task "..." --methods "..." --files "..."`.
- В конце: `python tools/agent_memory.py refresh` и `python tools/agent_memory.py sync --direction push`.

## VPS Runtime (72.56.109.219)

- This OpenClaw session is already running on the VPS.
- Do not ask the user for an SSH key or SSH back into the same machine for normal project work from this environment.
- Private key contents: never print/read into chat.
- On the server, read-only audit found:
  - `/opt/bloknot-mashinista/.git`
  - `/opt/studio-bot/.git`

### Нужный проект: /opt/bloknot-mashinista

- Git remote: `https://github.com/iEgor72/bloknot-mashinista.git`
- Production branch/upstream: `main...origin/main`
- Production HEAD at setup check: `72d555a` (`chore: remove master-bot-hub traces after cancellation`)
- Production worktree note: untracked `package-lock.json` exists on VPS.
- Runtime: `node server.js` under PM2 process `bloknot-mashinista`
- PM2 cwd/script: `/opt/bloknot-mashinista` / `/opt/bloknot-mashinista/server.js`
- PM2 env/status at setup check: `NODE_ENV=production`, status `online`
- PM2 supervisor systemd unit: `pm2-root.service`
- Project-specific systemd unit: not detected by read-only `systemctl` search.
- Port: `127.0.0.1:3000`
- Reverse proxy: nginx site `bloknot` -> `proxy_pass http://127.0.0.1:3000`
- Domain: `https://bloknot-mashinista-bot.ru`

### Второй проект: /opt/studio-bot

- Separate project. Do not touch `/opt/studio-bot` or `studio-bot.service` without explicit direct user instruction in this chat.

## Deployment Policy

1. Do not deploy or restart services unless the user explicitly asks.
2. Before deploy:
   - check local `git status -sb`, `git branch -vv`, and intended commit;
   - check production `cd /opt/bloknot-mashinista && git status -sb && git branch -vv`;
   - verify production branch/upstream because it can differ from local;
   - verify the intended commit is present in the production branch.
3. Standard production runtime is PM2, not a project-specific systemd service.
4. Do not invent a `systemctl restart <service>` service name. The systemctl template is blocked until a real project-specific service is found safely.
5. Reference deploy command for the actual PM2 runtime only; do not run without explicit user request:

```bash
cd /opt/bloknot-mashinista && git pull --ff-only origin main && pm2 reload bloknot-mashinista --update-env && pm2 status bloknot-mashinista && git rev-parse --short HEAD
```

## Constraints

- Do not deploy by manually editing files on the VPS except an explicitly requested emergency hotfix.
- Do not touch `/opt/studio-bot` or `studio-bot.service` without explicit direct instruction.
- Preserve existing app behavior, including Telegram auth, mobile viewport behavior, and offline/PWA behavior.
