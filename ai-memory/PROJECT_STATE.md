# Project State

<!-- AUTO_STATUS:START -->
Generated: 2026-04-18 17:38:17 +1000

## Repository Snapshot
- Local repo path: `D:\work\bloknot-mashinista-tg`
- Project memory path: `D:\work\bloknot-mashinista-tg\ai-memory`
- Branch: `main`
- HEAD: `b6d82ac`
- Last commit: `b6d82ac feat(docs): add docx zoom gestures`

## Git Remote
```text
origin	https://github.com/iEgor72/bloknot-mashinista.git (fetch)
origin	https://github.com/iEgor72/bloknot-mashinista.git (push)
```

## Branch Tracking
```text
codex/next-direction b044dd5 offline mvp
  codex/tabs-ui        117f1fa [origin/codex/tabs-ui] tabs ui
* main                 b6d82ac [origin/main] feat(docs): add docx zoom gestures
```

## Worktree
```text
M ai-memory/CHANGELOG.md
 M ai-memory/INDEX.md
 M ai-memory/PROJECT_STATE.md
 M ai-memory/RECENT_COMMITS.md
 M ai-memory/WORKTREE_STATUS.md
 M ai-memory/sessions/2026-04-18.md
```
<!-- AUTO_STATUS:END -->

## Project Identity
- Name: `bloknot-mashinista`
- Local repo path: `D:\work\bloknot-mashinista-tg`
- Git remote: `https://github.com/iEgor72/bloknot-mashinista.git`
- Main local branch at setup time: `main` tracking `origin/main`
- Project memory path: `D:\work\bloknot-mashinista-tg\ai-memory`
- Obsidian/Codex vault path on this machine: `D:\work\Codex\Projects\bloknot-mashinista-tg`

## Required Agent Workflow
- Mandatory first command before any project work: `python tools/agent_memory.py preflight`
- Then read: `START_HERE.md`, `PROJECT_STATE.md`, `ARCHITECTURE.md`, `METHODS.md`, `ENGINEERING_STYLE.md`, latest `CHANGELOG.md`, `WORKTREE_STATUS.md`
- Do not start with code search, edits, tests, deploy, or project conclusions before memory is read.
- Log meaningful changes with `python tools/agent_memory.py log --task "..." --methods "..." --files "..."`
- End work with `python tools/agent_memory.py refresh` and `python tools/agent_memory.py sync --direction push`

## Application State
- Telegram shift tracker / PWA for locomotive crews.
- Frontend: `index.html`, plain deferred JS scripts in `scripts/`, layered CSS in `styles/`.
- Backend in production codebase: Cloudflare Pages Functions under `functions/api/*` with D1 binding in `wrangler.toml`.
- Local/VPS runtime: `server.js` static/dev server with local JSON storage.
- PWA/offline runtime: `sw.js` and `scripts/sw-register.js`.
- PM2 ecosystem file: `ecosystem.config.js`.

## VPS / Production Deploy Access
- SSH host: `root@72.56.109.219`
- SSH key path: `%USERPROFILE%/.ssh/timeweb_deploy_ed25519`
- Private key contents: never print, read into chat, or commit.
- Codex has SSH access from this machine through the listed key.
- Production repo path found by read-only SSH: `/opt/bloknot-mashinista`
- Production remote: `https://github.com/iEgor72/bloknot-mashinista.git`
- Production branch/upstream found by read-only SSH: `main...origin/main`
- Production HEAD at setup check: `72d555a` (`chore: remove master-bot-hub traces after cancellation`)
- Production worktree note: `?? package-lock.json` exists on the VPS; review before deploy that touches lockfiles.
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

```powershell
ssh -i $env:USERPROFILE\.ssh\timeweb_deploy_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o BatchMode=yes root@72.56.109.219 "cd /opt/bloknot-mashinista && git pull --ff-only origin main && pm2 reload bloknot-mashinista --update-env && pm2 status bloknot-mashinista && git rev-parse --short HEAD"
```

- Requested `systemctl restart <FOUND_SERVICE_NAME>` template is blocked until a real project-specific systemd service is found safely.
