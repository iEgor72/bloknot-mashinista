# Project State

<!-- AUTO_STATUS:START -->
Generated: 2026-08-28 15:16:46 +1000

## Repository Snapshot
- Local repo path: `C:\Users\shkur\AppData\Local\Temp\bloknot-release-v413-20260828`
- Project memory path: `C:\Users\shkur\AppData\Local\Temp\bloknot-release-v413-20260828\ai-memory`
- Branch: `codex/release-v413`
- HEAD: `abcbedf`
- Last commit: `abcbedf chore(memory): record v413 release preparation`

## Git Remote
```text
origin	https://github.com/iEgor72/bloknot-mashinista.git (fetch)
origin	https://github.com/iEgor72/bloknot-mashinista.git (push)
```

## Branch Tracking
```text
+ codex/home-screen-v403                 e73a7e7 (C:/Users/shkur/AppData/Local/Temp/bloknot-release-v403-20260827) [origin/main: behind 20] feat: add Telegram home screen shortcut
+ codex/hotfix-sollu-v411                cbb3100 (C:/Users/shkur/AppData/Local/Temp/bloknot-hotfix-sollu-v411) [origin/main: behind 1] fix: isolate Poekhali service arms
+ codex/new-shift-time-picker-production 39ae27c (C:/Users/shkur/AppData/Local/Temp/bloknot-picker-prod-20260727) [origin/main: behind 35] refine: remove shift timeline and loop time picker
+ codex/new-shift-time-picker-step1      435e0c7 (D:/work/bloknot-mashinista-tg) feat: add community editors and thematic navigation
  codex/next-direction                   b044dd5 offline mvp
+ codex/partial-route-v398               16e7dd9 (C:/Users/shkur/AppData/Local/Temp/bloknot-release-v398-20260818) [origin/main: behind 25] fix: simplify partial shift routes
+ codex/poekhali-live-pan-v400           47daa41 (C:/Users/shkur/AppData/Local/Temp/bloknot-release-v400-20260822) [origin/main: behind 23] feat: add live profile browsing and auto return
+ codex/poekhali-smooth-v402             030e2a6 (C:/Users/shkur/AppData/Local/Temp/bloknot-release-v402-20260827) [origin/main: behind 21] perf: smooth poekhali profile browsing
+ codex/poekhali-unified-controls-v412   bd9e1a3 (C:/Users/shkur/AppData/Local/Temp/bloknot-poekhali-controls-v412) [origin/main] fix: separate Poekhali preview from GPS train
+ codex/poekhali-warning-v399            e589da9 (C:/Users/shkur/AppData/Local/Temp/bloknot-release-v399-20260822) [origin/main: behind 24] feat: show point warnings and default section speed
+ codex/product-scope-v392               c3b5b86 (C:/Users/shkur/AppData/Local/Temp/bloknot-release-v392-20260811) [origin/main: behind 33] refine product scope and restore Poekhali
+ codex/profile-deductions-v393          db11793 (C:/Users/shkur/AppData/Local/Temp/bloknot-release-v393-20260817-1325) [origin/main: behind 26] feat: add night and holiday shift totals
+ codex/public-copy-v392                 1906433 (C:/Users/shkur/AppData/Local/Temp/bloknot-public-copy-v392-20260811) [origin/main: behind 32] refresh public bot and site messaging
+ codex/release-v404                     5047c20 (C:/Users/shkur/AppData/Local/Temp/bloknot-release-v404-20260827) [origin/main: behind 18] feat: add no-GPS route preparation
+ codex/release-v405                     4d6a767 (C:/Users/shkur/AppData/Local/Temp/bloknot-release-v405-20260827) [origin/main: behind 17] feat: add depot service arm selection
+ codex/release-v406                     5c79107 (C:/Users/shkur/AppData/Local/Temp/bloknot-release-v406-20260828) [origin/main: behind 15] feat: collect depot map materials
+ codex/release-v407                     0385682 (C:/Users/shkur/AppData/Local/Temp/bloknot-release-v407-20260828) [origin/main: behind 13] fix: clarify depot selection placeholder
+ codex/release-v409                     8b69d25 (C:/Users/shkur/AppData/Local/Temp/bloknot-release-v409-20260828) [origin/main: behind 12] feat: build community depot knowledge catalog
+ codex/release-v410                     9520e04 (C:/Users/shkur/AppData/Local/Temp/bloknot-release-v410-audit) [origin/main: behind 2] fix: harden production contribution pipeline
* codex/release-v413                     abcbedf [origin/main: ahead 3] chore(memory): record v413 release preparation
+ codex/station-names-v401               823a20f (C:/Users/shkur/AppData/Local/Temp/bloknot-release-v401-20260822) [origin/main: behind 22] fix: expand legacy station names
  codex/tabs-ui                          117f1fa [origin/codex/tabs-ui] tabs ui
  main                                   b66833b [origin/main: behind 41] fix: lowercase homepage rotation phrases
  poekhali-rework                        2d5f0af chore(memory): refresh after main merge
```

## Worktree
```text
M ai-memory/CHANGELOG.md
 M ai-memory/sessions/2026-08-28.md
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
- Active production backend/runtime: VPS Node server `server.js` with SQLite storage at `data/bloknot.sqlite3` and idempotent legacy JSON import.
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
cd /opt/bloknot-mashinista && git pull --ff-only origin main && npm ci --omit=dev && pm2 reload bloknot-mashinista --update-env && npm run storage:check && pm2 status bloknot-mashinista && git rev-parse --short HEAD
```

- Requested `systemctl restart <FOUND_SERVICE_NAME>` template is blocked until a real project-specific systemd service is found safely.
