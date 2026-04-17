# Project State

Generated: 2026-04-17 15:37:13 +10:00

## Repository
- Name: `bloknot-mashinista`
- Root: `D:\work\bloknot-mashinista-tg`
- Branch: `main`
- Tracked files: 102
- HEAD: `e717be1` (feat(orchestrator): user-friendly telegram status messages)

## Top-Level File Map
- `assets`: 22
- `(root)`: 18
- `scripts`: 18
- `tools`: 14
- `ai-memory`: 12
- `functions`: 10
- `styles`: 8

## API Surface
- `/api/auth` (functions/api/auth.js)
- `/api/docs` (functions/api/docs.js)
- `/api/shifts` (functions/api/shifts.js)
- `/api/stats` (functions/api/stats.js)
- `/api/telegram-webhook` (functions/api/telegram-webhook.js)

## Frontend Runtime Scripts
- `scripts/app-constants.js`
- `scripts/app-init.js`
- `scripts/app.js`
- `scripts/auth.js`
- `scripts/docs-app.js`
- `scripts/instructions-app.js`
- `scripts/nav-debug.js`
- `scripts/press-feedback.js`
- `scripts/render.js`
- `scripts/safe-area.js`
- `scripts/shift-form.js`
- `scripts/sw-register.js`
- `scripts/time-utils.js`
- `scripts/utils/haptics.js`
- `scripts/viewport.js`

## README Snapshot
```text
# Shift Tracker App

Telegram shift tracker with one shared account per Telegram user.

## What this app does

- Inside Telegram it signs in automatically with `Telegram.WebApp.initData`.
- In Safari, Chrome, desktop, or from a home-screen shortcut it uses the Telegram login flow.
- The same Telegram account always opens the same shift list on every device.
- Different Telegram users get their own separate data.

## How the auth flow works

- Telegram WebApp requests are verified on the server with your bot token.
- Browser logins are verified through Telegram Login Widget.
- After login, the server stores a signed session cookie for that browser.
- Shifts are saved in Cloudflare D1 by Telegram user id.

## Required Cloudflare setup

1. Deploy the repo to Cloudflare Pages.
2. Create a Cloudflare D1 database.
3. Bind the database to the Pages project as `DB`.
4. Add a Pages secret named `TELEGRAM_BOT_TOKEN` with your bot token.
5. In BotFather, make sure the bot domain for Telegram Login is set to your Pages domain.
```

## scripts/README.md Snapshot
```text
# Scripts Structure

Runtime scripts are loaded in this order from [`index.html`](/D:/work/bloknot-mashinista-tg/index.html):

1. [`safe-area.js`](/D:/work/bloknot-mashinista-tg/scripts/safe-area.js)
2. [`app-constants.js`](/D:/work/bloknot-mashinista-tg/scripts/app-constants.js)
3. [`viewport.js`](/D:/work/bloknot-mashinista-tg/scripts/viewport.js)
4. [`time-utils.js`](/D:/work/bloknot-mashinista-tg/scripts/time-utils.js)
5. [`instructions-app.js`](/D:/work/bloknot-mashinista-tg/scripts/instructions-app.js)
6. [`docs-app.js`](/D:/work/bloknot-mashinista-tg/scripts/docs-app.js)
7. [`app.js`](/D:/work/bloknot-mashinista-tg/scripts/app.js)
8. [`auth.js`](/D:/work/bloknot-mashinista-tg/scripts/auth.js)
9. [`render.js`](/D:/work/bloknot-mashinista-tg/scripts/render.js)
10. [`shift-form.js`](/D:/work/bloknot-mashinista-tg/scripts/shift-form.js)
11. [`app-init.js`](/D:/work/bloknot-mashinista-tg/scripts/app-init.js)
12. [`sw-register.js`](/D:/work/bloknot-mashinista-tg/scripts/sw-register.js)
13. [`utils/haptics.js`](/D:/work/bloknot-mashinista-tg/scripts/utils/haptics.js)
14. [`press-feedback.js`](/D:/work/bloknot-mashinista-tg/scripts/press-feedback.js)
15. [`nav-debug.js`](/D:/work/bloknot-mashinista-tg/scripts/nav-debug.js)

## Module responsibilities

| File | Lines | Responsibility |
|------|-------|----------------|
| `app-constants.js` | ~116 | Production calendar, work norms, date helpers, MSK_OFFSET |
| `viewport.js` | ~522 | Viewport height, keyboard detection, haptic feedback, Telegram layout events |
| `time-utils.js` | ~887 | parseMsk, shift duration, date formatting |
| `instructions-app.js` | ~2085 | Instructions tab UI — list, search, detail view |
| `docs-app.js` | ~1239 | Documentation tab — file list, PDF viewer, video |
| `app.js` | ~1645 | Core state, storage helpers, salary calc, user stats, install guide |
| `auth.js` | ~800 | Auth flow, session tokens, Telegram WebApp auth, bootstrap |
| `render.js` | ~1658 | Main render(), shift list/detail, shared animations |
| `shift-form.js` | ~951 | Add/edit shift form, delete handler, overlays, add-to-screen |
| `app-init.js` | ~2 | Entry point — calls bootstrapAppStartup() |
| `sw-register.js` | ~90 | Service worker registration and update flow |
```
