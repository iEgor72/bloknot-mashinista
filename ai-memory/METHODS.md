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
- Verified 2026-09-06: production moved to RU server `201.51.30.200`, SSH alias `klyuchik-ru1`, user `root`. Use strict host-key checking with the existing known_hosts entry for this IP.
- `bloknot-vps` / `72.56.109.219` is the old Amsterdam host; it is not the current production origin. Do not use it for deployment.
- Runtime: systemd `bloknot-mashinista.service`, user `bloknot`, Node `/usr/bin/node server.js`, WorkingDirectory `/opt/bloknot-mashinista/current`.
- Releases are archive directories `/opt/bloknot-mashinista/releases/<full-git-commit>` with no `.git`; `current` is an atomically switched symlink. PM2 is not installed here.
- Persistent data: `/var/lib/bloknot-mashinista`; EnvironmentFile `/etc/bloknot-mashinista.env` (never print/read its contents into chat).
- Current release (verified 2026-10-17): `6e14ab51e8010384ad9745ec84c14fb31e5267ac`, shell v420, published on GitHub `origin/main`. Bounded/deduplicated warmup, validated cache-first versioned code and inline boot recovery; previous release `f4f371fa836aea8dee0f7cf97c7a5d9be21c495e` retained for rollback. User confirmed the iPhone works after cache recovery. Static JS/CSS gzip enabled separately in nginx, with verified identical decompressed contents and 76-85% transfer reduction on sampled assets.
- Before deployment: verify GitHub main commit, archive checksums, current release target, backup the persistent SQLite database. Install dependencies in a new release directory, verify, atomically switch `current`, restart only `bloknot-mashinista.service`.
- Health check: `/usr/local/sbin/verify-bloknot-ru`; public regression: `npm run smoke:prod-cache`.
- Production schema retains community migration 5 after its code was reverted. PWA installation handoffs use migration 6; never reuse migration numbers from reverted releases.

## Existing Project Methods
- Telegram WebApp auth uses `initData` verification.
- Browser auth uses Telegram Login Widget callback through `/api/auth?mode=telegram-login`.
- Active production backend flow runs through VPS `server.js`; legacy Cloudflare handlers were removed on 2026-04-25.
- Shift sync uses authenticated `/api/shifts` calls with bearer token/session cookie.
- Offline handling uses service worker shell caching plus frontend pending mutation queue.
- Instructions search uses Russian stemming and fuzzy matching.
- Docs UI reads static docs manifest/assets and checks offline cache state.

## SQLite Storage Method
- Mutable backend state is stored in `data/bloknot.sqlite3`; use `APP_DATA_DIR` for isolated tests.
- Never delete legacy JSON during migration. `legacy_imports` makes import idempotent and records source SHA-256.
- Before restore, stop systemd bloknot-mashinista.service. Run `npm run storage:check -- <backup>` first, then `npm run storage:restore -- <backup> --confirm`.
- Restore preserves the displaced database and WAL/SHM sidecars with a `before-restore` timestamp.


## Audit remediation release candidate v421
- Current user authorization: repair all audit findings; latest correction explicitly forbids design changes.
- Original UI/CSS restored and protected by baseline hash test. Work remains technical only.
- New journal/outbox uses account-scoped IndexedDB, CAS revisions (migration 7), three-way merge and legacy queue backups. Core no longer waits for Poekhali/documents/VU45.
- Authoritative deployment runbook: docs/DEPLOYMENT.md. Production installation result will be logged after verification.
