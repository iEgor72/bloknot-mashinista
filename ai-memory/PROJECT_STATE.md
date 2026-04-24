# Project State

<!-- AUTO_STATUS:START -->
Generated: 2026-04-25 08:03:42 +1000

## Repository Snapshot
- Local repo path: `D:\work\bloknot-mashinista-tg`
- Project memory path: `D:\work\bloknot-mashinista-tg\ai-memory`
- Branch: `main`
- HEAD: `379ec2e`
- Last commit: `379ec2e fix(home): merge latest shift into calendar card`

## Git Remote
```text
origin	https://github.com/iEgor72/bloknot-mashinista.git (fetch)
origin	https://github.com/iEgor72/bloknot-mashinista.git (push)
```

## Branch Tracking
```text
codex/next-direction b044dd5 offline mvp
  codex/tabs-ui        117f1fa [origin/codex/tabs-ui] tabs ui
* main                 379ec2e [origin/main] fix(home): merge latest shift into calendar card
```

## Worktree
```text
M README.md
 M ai-memory/ARCHITECTURE.md
 M ai-memory/CHANGELOG.md
 M ai-memory/INDEX.md
 M ai-memory/METHODS.md
 M ai-memory/PROJECT_STATE.md
 M ai-memory/RECENT_COMMITS.md
 M ai-memory/WORKTREE_STATUS.md
 D assets/instructions/catalog.v1.json
 D assets/instructions/catalog.v2.json
 D assets/instructions/sources.v2.json
 D functions/api/auth.js
 D functions/api/docs.js
 D functions/api/shifts.js
 D functions/api/stats.js
 D functions/api/telegram-webhook.js
 D functions/features/auth/telegram-auth.js
 D functions/features/docs/store.js
 D functions/features/shifts/store.js
 D functions/features/shifts/validation.js
 D functions/features/stats/store.js
 M index.html
 M scripts/README.md
 M scripts/app.js
 M scripts/auth.js
 D scripts/build-instructions-dataset.py
 D scripts/instructions-app.js
 M scripts/local-smoke.mjs
 M scripts/render.js
 M scripts/shift-form.js
 D scripts/stopwatch-app.js
 D scripts/stopwatch-engine.js
 M server.js
 M styles/30-shifts-and-overlays.css
 D styles/35-timer.css
 M styles/README.md
 M sw.js
 D wrangler.toml
?? ai-memory/sessions/2026-04-25.md
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
- Legacy Cloudflare Pages Functions and D1 bindings were removed from the repo on 2026-04-25. Active production backend/runtime is `server.js`.
- PWA/offline runtime: `sw.js` and `scripts/sw-register.js`.
- PM2 ecosystem file: `ecosystem.config.js`.

## Durable UI Direction
- Docs landing should keep separate top-level entries for `Инструкции`, `Скорости`, `Режимки`, `Памятки`, and `Папки` rather than grouping speeds/regimki/reminders behind one shared entry.
- Next docs-screen polish direction: align card visual weight, make `Папки` visually wider/double-width, and further clean up supporting subtitle copy if it feels noisy.

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
