# Project State

<!-- AUTO_STATUS:START -->
Generated: 2026-04-22 10:37:06 +0000

## Repository Snapshot
- Local repo path: `/opt/bloknot-mashinista`
- Project memory path: `/opt/bloknot-mashinista/ai-memory`
- Branch: `main`
- HEAD: `0392f28`
- Last commit: `0392f28 fix(sync): persist salary params across clients`

## Git Remote
```text
origin	https://github.com/iEgor72/bloknot-mashinista.git (fetch)
origin	https://github.com/iEgor72/bloknot-mashinista.git (push)
```

## Branch Tracking
```text
* main 0392f28 [origin/main] fix(sync): persist salary params across clients
```

## Worktree
```text
clean
```
<!-- AUTO_STATUS:END -->

## Project Identity
- Name: `bloknot-mashinista`
- Active repo path in this environment: `/opt/bloknot-mashinista`
- Git remote: `https://github.com/iEgor72/bloknot-mashinista.git`
- Branch: `main` tracking `origin/main`
- Project memory path in this environment: `/opt/bloknot-mashinista/ai-memory`
- Historical note: older memory entries may reference prior Windows worktree paths from another environment.

## Required Agent Workflow
- Mandatory first command before any project work: `python tools/agent_memory.py preflight`
- Then read: `START_HERE.md`, `PROJECT_STATE.md`, `ARCHITECTURE.md`, `METHODS.md`, `ENGINEERING_STYLE.md`, latest `CHANGELOG.md`, `WORKTREE_STATUS.md`
- Do not start with code search, edits, tests, deploy, or project conclusions before memory is read.
- Log meaningful changes with `python tools/agent_memory.py log --task "..." --methods "..." --files "..."`
- End work with `python tools/agent_memory.py refresh` and `python tools/agent_memory.py sync --direction push`

## Application State
- Telegram shift tracker / PWA for locomotive crews.
- Frontend: `index.html`, plain deferred JS scripts in `scripts/`, layered CSS in `styles/`.
- Active production backend/runtime: VPS Node server `server.js` with local JSON storage under `data/`.
- Cloudflare Pages Functions and D1 bindings remain in the repo (`functions/api/*`, `functions/features/*`, `wrangler.toml`) but are not the current production deployment path.
- PWA/offline runtime: `sw.js` and `scripts/sw-register.js`.
- PM2 ecosystem file: `ecosystem.config.js`.

## VPS / Production Deploy Access
- This OpenClaw session is running on the project server itself.
- Production repo path: `/opt/bloknot-mashinista`
- Production remote: `https://github.com/iEgor72/bloknot-mashinista.git`
- Production branch/upstream: `main...origin/main`
- Deploy/restart from this environment should be done locally in `/opt/bloknot-mashinista`, not by SSHing back into the same server.
- Do not ask the user for an SSH key when working on this project from this environment unless local access actually fails.
- Project-specific systemd service: not found by `systemctl list-units --type=service --all` or `systemctl list-unit-files` grep for `bloknot|mashinista|shift|tracker`.
- PM2 supervisor unit: `pm2-root.service`
- Runtime process: PM2 process `bloknot-mashinista`
- PM2 cwd/script: `/opt/bloknot-mashinista` / `/opt/bloknot-mashinista/server.js`
- Runtime env/port from PM2/ecosystem: `NODE_ENV=production`, `PORT=3000`
- Reverse proxy: nginx site `bloknot`, domain `bloknot-mashinista-bot.ru`, proxy to `http://127.0.0.1:3000`

## Deploy Rules
- Do not deploy or restart services unless the user explicitly asks.
- Before deploy, verify local branch/upstream and production branch/upstream; production can track a different branch than local.
- Before deploy, verify the intended commit is present in the production branch.
- Do not invent a systemd service name. Current runtime uses PM2 process `bloknot-mashinista`, not a project-specific systemd unit.
- Reference deploy command for the actual PM2 runtime only; do not run without explicit request:

```bash
cd /opt/bloknot-mashinista && git pull --ff-only origin main && pm2 reload bloknot-mashinista --update-env && pm2 status bloknot-mashinista && git rev-parse --short HEAD
```

- Requested `systemctl restart <FOUND_SERVICE_NAME>` template is blocked until a real project-specific systemd service is found safely.
