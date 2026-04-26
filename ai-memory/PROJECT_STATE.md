# Project State

<!-- AUTO_STATUS:START -->
Generated: 2026-04-26 21:48:43 +1000

## Repository Snapshot
- Local repo path: `D:\work\bloknot-mashinista-tg`
- Project memory path: `D:\work\bloknot-mashinista-tg\ai-memory`
- Branch: `main`
- HEAD: `c631e1b`
- Last commit: `c631e1b chore(memory): refresh after legacy cleanup`

## Git Remote
```text
origin	https://github.com/iEgor72/bloknot-mashinista.git (fetch)
origin	https://github.com/iEgor72/bloknot-mashinista.git (push)
```

## Branch Tracking
```text
codex/next-direction b044dd5 offline mvp
  codex/tabs-ui        117f1fa [origin/codex/tabs-ui] tabs ui
* main                 c631e1b [origin/main] chore(memory): refresh after legacy cleanup
```

## Worktree
```text
M  .gitignore
MM ai-memory/CHANGELOG.md
M  ai-memory/INDEX.md
M  ai-memory/PROJECT_STATE.md
M  ai-memory/RECENT_COMMITS.md
M  ai-memory/WORKTREE_STATUS.md
M  ai-memory/sessions/2026-04-25.md
AM ai-memory/sessions/2026-04-26.md
A  assets/tracker/data.xml
A  assets/tracker/maps-manifest.json
A  assets/tracker/maps/komsomol-sk-tche-9/1.xml
A  assets/tracker/maps/komsomol-sk-tche-9/1n.xml
A  assets/tracker/maps/komsomol-sk-tche-9/2.xml
A  assets/tracker/maps/komsomol-sk-tche-9/2n.xml
A  assets/tracker/maps/komsomol-sk-tche-9/data.xml
A  assets/tracker/maps/komsomol-sk-tche-9/profile.xml
A  assets/tracker/maps/komsomol-sk-tche-9/speed.xml
A  assets/tracker/profile.xml
A  assets/tracker/regime-maps.json
A  assets/tracker/speed-docs.json
A  assets/tracker/tch9-reference.json
A  docs/2026-04-26-poekhali-parity-tz.md
M  index.html
M  package.json
M  scripts/app.js
M  scripts/auth.js
M  scripts/docs-app.js
A  scripts/download-poekhali-maps.mjs
A  scripts/import-poekhali-android-backup.py
A  scripts/import-regime-maps.py
A  scripts/import-speed-docs.py
A  scripts/import-tch9-reference.py
A  scripts/poekhali-tracker.js
M  scripts/render.js
M  scripts/shift-form.js
M  scripts/time-utils.js
M  server.js
M  styles/10-navigation-and-cards.css
M  styles/15-bottom-nav.css
M  styles/30-shifts-and-overlays.css
M  sw.js
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
