# Architecture

Generated: 2026-04-17 23:20 +10:00

## Runtime Topology
- Browser app shell: `index.html` with deferred plain JS files; script order is architectural and must not be changed casually.
- Frontend state and UI modules: `scripts/app.js`, `scripts/auth.js`, `scripts/render.js`, `scripts/shift-form.js`, `scripts/time-utils.js`, `scripts/viewport.js`.
- Instructions/docs UI: `scripts/instructions-app.js`, `scripts/docs-app.js`, static assets under `assets/instructions/` and `assets/docs/`.
- CSS layers: `styles/00-base.css`, `styles/10-navigation-and-cards.css`, `styles/15-bottom-nav.css`, `styles/20-form-and-stats.css`, `styles/30-shifts-and-overlays.css`, `styles/40-premium-refresh.css`.
- Active production runtime is VPS Node server: `server.js`, started by PM2 process `bloknot-mashinista`.
- Cloudflare Pages / D1 code under `functions/api/*`, `functions/features/*`, and `wrangler.toml` remains in the repo as legacy or alternate deployment code, but is not the current production path.
- PWA/offline runtime: `sw.js`, `scripts/sw-register.js`, local cache and pending mutation keys with `shift_tracker_*` prefix.

## API Surface
- Active VPS runtime serves auth, shifts, stats, docs, and Telegram webhook logic from `server.js`.
- Cloudflare-style handlers still exist in `functions/api/*`:
  - `/api/auth` -> `functions/api/auth.js`
  - `/api/shifts` -> `functions/api/shifts.js`
  - `/api/stats` -> `functions/api/stats.js`
  - `/api/docs` -> `functions/api/docs.js`
  - `/api/telegram-webhook` -> `functions/api/telegram-webhook.js`
- Treat `functions/api/*` as implementation history or alternate backend path unless a future migration explicitly reactivates them.

## Persistent Data
- Active VPS runtime persists data locally under `data/`, especially `data/local-shifts/` and `data/user-presence.json`.
- Cloudflare D1 schema and bindings still exist in the repository (`wrangler.toml`, `functions/features/*`) but are not the current source of production state.

## Operational Architecture
- `ecosystem.config.js` defines PM2 app `bloknot-mashinista`, `server.js`, `PORT=3000`, `NODE_ENV=production`.
- VPS nginx proxies `bloknot-mashinista-bot.ru` to `127.0.0.1:3000`.
- No project-specific systemd unit was found; PM2 is supervised by `pm2-root.service`.
- Current deployment model is VPS-first. Cloudflare-specific files should not be mistaken for the active production topology.

## Agent Memory Architecture
- Canonical project memory lives in `ai-memory/`.
- Local sync target is configured by `.agent-memory.local.json`.
- Required agent entrypoint is `python tools/agent_memory.py preflight`.
- `npm run memory:*` commands are compatibility wrappers around the Python memory CLI.
- The old `tools/agent-memory/` Node memory engine was removed to avoid two competing memory implementations.
