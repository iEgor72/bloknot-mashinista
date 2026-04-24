# Methods

Generated: 2026-04-17 23:20 +10:00

## Mandatory Agent Workflow
1. Run `python tools/agent_memory.py preflight`.
2. Read memory in order: `START_HERE.md`, `PROJECT_STATE.md`, `ARCHITECTURE.md`, `METHODS.md`, `ENGINEERING_STYLE.md`, latest `CHANGELOG.md`, `WORKTREE_STATUS.md`.
3. Only then analyze code, edit files, run tests, answer project questions, or plan deploy.
4. After every meaningful change, run `python tools/agent_memory.py log --task "..." --methods "..." --files "..."`.
5. At session end, run `python tools/agent_memory.py refresh` and `python tools/agent_memory.py sync --direction push`.

## Code Work Method
- Prefer existing plain JS/global script patterns; do not introduce bundlers or module systems casually.
- Preserve `index.html` script load order unless the change explicitly handles dependent globals.
- For frontend changes, preserve Telegram WebApp behavior, mobile viewport handling, PWA/offline behavior, and local pending mutation contracts.
- For backend changes, keep JSON API envelopes and `no-store` cache behavior consistent with active `server.js` handlers.
- Keep edits scoped; avoid unrelated refactors and generated asset churn.

## Search / Analysis Method
- Memory preflight and reading comes before code search.
- Use actual code, git state, memory, and tests as sources of truth.
- If `rg` is unavailable, use PowerShell `Get-ChildItem` / `Select-String`.
- Do not read or print secrets from `.env`, private keys, tokens, or production configs.

## Verification Method
- Run the narrowest relevant checks for the files changed.
- For memory/tooling changes, run syntax checks (`python -m py_compile`, `node -c` where relevant), then `python tools/agent_memory.py preflight`.
- If tests are skipped or unavailable, record that explicitly in the final answer and memory when material.

## VPS / Deploy Access Method
- This OpenClaw session is already on the project server.
- Production repo path: `/opt/bloknot-mashinista`
- Production branch/upstream: `main...origin/main`.
- Production runtime: PM2 process `bloknot-mashinista`; PM2 is supervised by `pm2-root.service`.
- Project-specific systemd service: not found. Do not invent one and do not run a `systemctl restart <project>` command for this app unless a real service is later found.
- Before deploy, verify local branch/upstream, production worktree status, and that the intended commit is in the current branch.
- Deploy/restart from this environment should be done locally, not by SSHing back into the same VPS.
- Do not ask the user for an SSH key for this project from this environment unless local access actually fails.
- Reference PM2 deploy command only; do not run without explicit user request:

```bash
cd /opt/bloknot-mashinista && git pull --ff-only origin main && pm2 reload bloknot-mashinista --update-env && pm2 status bloknot-mashinista && git rev-parse --short HEAD
```

## Existing Project Methods
- Telegram WebApp auth uses `initData` verification.
- Browser auth uses Telegram Login Widget callback through `/api/auth?mode=telegram-login`.
- Active production backend flow runs through VPS `server.js`; legacy Cloudflare handlers were removed on 2026-04-25.
- Shift sync uses authenticated `/api/shifts` calls with bearer token/session cookie.
- Offline handling uses service worker shell caching plus frontend pending mutation queue.
- Instructions search uses Russian stemming and fuzzy matching.
- Docs UI reads static docs manifest/assets and checks offline cache state.
