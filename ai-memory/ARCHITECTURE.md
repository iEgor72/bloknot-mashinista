# Architecture

Generated: 2026-04-17 23:20 +10:00

## Runtime Topology
- Browser app shell: `index.html` with deferred plain JS files; script order is architectural and must not be changed casually.
- Frontend state and UI modules: `scripts/app.js`, `scripts/auth.js`, `scripts/render.js`, `scripts/shift-form.js`, `scripts/time-utils.js`, `scripts/viewport.js`.
- Instructions/docs UI: `scripts/instructions-app.js`, `scripts/docs-app.js`, static assets under `assets/instructions/` and `assets/docs/`.
- CSS layers: `styles/00-base.css`, `styles/10-navigation-and-cards.css`, `styles/15-bottom-nav.css`, `styles/20-form-and-stats.css`, `styles/30-shifts-and-overlays.css`, `styles/40-premium-refresh.css`.
- Production backend code for Cloudflare Pages: `functions/api/*` plus feature stores in `functions/features/*`.
- Local/VPS Node runtime: `server.js`, started in production by PM2 process `bloknot-mashinista`.
- PWA/offline runtime: `sw.js`, `scripts/sw-register.js`, local cache and pending mutation keys with `shift_tracker_*` prefix.

## API Surface
- `/api/auth` -> `functions/api/auth.js`
- `/api/shifts` -> `functions/api/shifts.js`
- `/api/stats` -> `functions/api/stats.js`
- `/api/docs` -> `functions/api/docs.js`
- `/api/telegram-webhook` -> `functions/api/telegram-webhook.js`

## Persistent Data
- Cloudflare D1 binding configured in `wrangler.toml` as `DB`.
- Main D1 tables declared in stores: `user_shifts`, `shift_sets`, `stats_sessions`, `stats_users`, `docs_files`.
- Local fallback server stores JSON under `data/`.

## Operational Architecture
- `ecosystem.config.js` defines PM2 app `bloknot-mashinista`, `server.js`, `PORT=3000`, `NODE_ENV=production`.
- VPS nginx proxies `bloknot-mashinista-bot.ru` to `127.0.0.1:3000`.
- No project-specific systemd unit was found; PM2 is supervised by `pm2-root.service`.

## Agent Memory Architecture
- Canonical project memory lives in `ai-memory/`.
- Local sync target is configured by `.agent-memory.local.json`.
- Required agent entrypoint is `python tools/agent_memory.py preflight`.
- `npm run memory:*` commands are compatibility wrappers around the Python memory CLI.
- The old `tools/agent-memory/` Node memory engine was removed to avoid two competing memory implementations.
