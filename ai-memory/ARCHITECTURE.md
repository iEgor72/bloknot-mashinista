# Architecture

Generated: 2026-04-17 19:10:38 +10:00

## Snapshot
- Tracked files: 96
- Text-like files: 74
- Text-like lines: 57225
- Service Worker cache version: `v24`
- Wrangler D1 binding: configured

## Runtime Topology
- Browser app shell: `index.html` + deferred plain JS modules (no bundler).
- Production backend: Cloudflare Pages Functions in `functions/api/*`.
- Local fallback backend: `server.js` (Node HTTP server with local JSON storage).
- PWA/offline runtime: `sw.js` + `scripts/sw-register.js`.

## Frontend Load Order (from index.html)
- `scripts/safe-area.js` (183 lines)
- `scripts/app-constants.js` (117 lines)
- `scripts/viewport.js` (523 lines)
- `scripts/time-utils.js` (888 lines)
- `scripts/instructions-app.js` (2086 lines)
- `scripts/docs-app.js` (1245 lines)
- `scripts/app.js` (1646 lines)
- `scripts/auth.js` (801 lines)
- `scripts/render.js` (1659 lines)
- `scripts/shift-form.js` (952 lines)
- `scripts/app-init.js` (10 lines)
- `scripts/sw-register.js` (91 lines)
- `scripts/utils/haptics.js` (153 lines)
- `scripts/press-feedback.js` (281 lines)
- `scripts/nav-debug.js` (155 lines)

## CSS Layering (from index.html)
- `styles/00-base.css` (723 lines)
- `styles/10-navigation-and-cards.css` (1855 lines)
- `styles/15-bottom-nav.css` (180 lines)
- `styles/16-press-feedback.css` (9 lines)
- `styles/20-form-and-stats.css` (817 lines)
- `styles/30-shifts-and-overlays.css` (1688 lines)
- `styles/40-premium-refresh.css` (96 lines)

## API Surface
- `/api/auth` [GET, POST, DELETE] | frontend ref: yes | `functions/api/auth.js`
- `/api/docs` [OPTIONS, GET, POST, DELETE] | frontend ref: yes | `functions/api/docs.js`
- `/api/shifts` [OPTIONS, GET, PUT] | frontend ref: yes | `functions/api/shifts.js`
- `/api/stats` [OPTIONS, GET, POST] | frontend ref: yes | `functions/api/stats.js`
- `/api/telegram-webhook` [n/a] | frontend ref: no | `functions/api/telegram-webhook.js`

## Persistent Data Model
- `docs_files` in `functions/features/docs/store.js`
- `shift_sets` in `functions/features/shifts/store.js`
- `stats_sessions` in `functions/features/stats/store.js`
- `stats_users` in `functions/features/stats/store.js`
- `user_shifts` in `functions/features/shifts/store.js`

## Offline Strategy
- Navigation: network-first with cached fallback (`networkFirstDocument`).
- Static assets: stale-while-revalidate (`staleWhileRevalidate`).
- Shell warmup: install + extended warmup via `WARMUP_CACHE` message.
- Frontend keeps per-user local cache and pending queue keys prefixed with `shift_tracker_`.

## Key Architectural Notes
- Client modules share global state across files; script order is part of architecture.
- `functions/api/docs.js` exists server-side, while current docs UI (`scripts/docs-app.js`) reads static `/assets/docs/manifest.json` directly.
- Auth flow combines Telegram Login Widget, Telegram WebApp `initData`, bearer token, and secure cookie session.
