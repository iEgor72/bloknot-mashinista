# Project State

<!-- AUTO_STATUS:START -->
Generated: 2026-07-11 09:35:08 +1000

## Repository Snapshot
- Local repo path: `D:\work\bloknot-mashinista-tg`
- Project memory path: `D:\work\bloknot-mashinista-tg\ai-memory`
- Branch: `main`
- HEAD: `2a24639`
- Last commit: `2a24639 chore(memory): record SEO landing redesign`

## Git Remote
```text
origin	https://github.com/iEgor72/bloknot-mashinista.git (fetch)
origin	https://github.com/iEgor72/bloknot-mashinista.git (push)
```

## Branch Tracking
```text
codex/next-direction b044dd5 offline mvp
  codex/tabs-ui        117f1fa [origin/codex/tabs-ui] tabs ui
* main                 2a24639 [origin/main] chore(memory): record SEO landing redesign
  poekhali-rework      2d5f0af chore(memory): refresh after main merge
```

## Worktree
```text
M ai-memory/CHANGELOG.md
 M ai-memory/INDEX.md
 M ai-memory/PROJECT_STATE.md
 M ai-memory/RECENT_COMMITS.md
 M ai-memory/WORKTREE_STATUS.md
 M ai-memory/sessions/2026-07-10.md
 M assets/tracker/sections/dvost-oune-pivan.json
 M assets/tracker/sections/dvost-pivan-novyi-mir.json
 M assets/tracker/sections/dvost-postyshevo-komsomolsk.json
 M assets/tracker/sections/dvost-postyshevo-novyi-urgal-odd.json
 M assets/tracker/sections/dvost-volochaevka-ii-dzemgi.json
 M assets/tracker/sections/dvost-vysokogornaya-oune-via-muli.json
 M assets/tracker/sections/dvost-vysokogornaya-oune-via-sollu.json
 M assets/tracker/sections/index.json
 M docs/REGIME_PROFILE_BUILDER.md
 M scripts/poekhali-json-smoke.mjs
 M tests/regime_profile_builder/test_axis_trace.py
 M tests/regime_profile_builder/test_cli.py
 M tests/regime_profile_builder/test_pdf_io.py
 M tests/regime_profile_builder/test_pipeline.py
 M tests/regime_profile_builder/test_safety.py
 M tools/regime_profile_builder/__init__.py
 M tools/regime_profile_builder/adapters/__init__.py
 M tools/regime_profile_builder/adapters/black_grade_strokes.py
 M tools/regime_profile_builder/adapters/blue_bottom_table.py
 M tools/regime_profile_builder/axis.py
 M tools/regime_profile_builder/cli.py
 M tools/regime_profile_builder/config.example.json
 M tools/regime_profile_builder/pdf_io.py
 M tools/regime_profile_builder/pipeline.py
 M tools/regime_profile_builder/review.py
?? .codex/
?? ai-memory/sessions/2026-07-11.md
?? tests/regime_profile_builder/test_black_grade_strokes.py
?? tests/regime_profile_builder/test_blue_bottom_table.py
?? tests/regime_profile_builder/test_diagonal_grade_table.py
?? tools/regime_profile_builder/adapters/diagonal_grade_table.py
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
