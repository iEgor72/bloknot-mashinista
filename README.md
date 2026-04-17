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
6. Point the bot webhook to `https://shift-tracker-app.pages.dev/api/telegram-webhook`.

### One-time webhook setup

Open this URL in a browser, replacing `<BOT_TOKEN>` with your bot token:

`https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://shift-tracker-app.pages.dev/api/telegram-webhook`

After that, send `/start` to the bot and it will answer with a button that opens the mini-app.

## Files

- [`index.html`](/D:/work/bloknot-mashinista-tg/index.html) - app markup (tabs, overlays, shells) and asset links.
- [`styles/README.md`](/D:/work/bloknot-mashinista-tg/styles/README.md) - CSS structure by component groups.
- [`scripts/README.md`](/D:/work/bloknot-mashinista-tg/scripts/README.md) - JS runtime structure and startup order.
- [`scripts/nav-debug.js`](/D:/work/bloknot-mashinista-tg/scripts/nav-debug.js) - optional bottom-nav diagnostics (`?navDebug=1`).
- [`sw.js`](/D:/work/bloknot-mashinista-tg/sw.js) - service worker cache strategy for shell/documents.
- [`functions/api/auth.js`](/D:/work/bloknot-mashinista-tg/functions/api/auth.js) - Telegram auth endpoint.
- [`functions/api/shifts.js`](/D:/work/bloknot-mashinista-tg/functions/api/shifts.js) - per-user shifts API.
- [`functions/features/auth/telegram-auth.js`](/D:/work/bloknot-mashinista-tg/functions/features/auth/telegram-auth.js) - Telegram verification and session helpers.
- [`functions/features/shifts/store.js`](/D:/work/bloknot-mashinista-tg/functions/features/shifts/store.js) - shifts storage and migration logic.
- [`functions/features/shifts/validation.js`](/D:/work/bloknot-mashinista-tg/functions/features/shifts/validation.js) - shifts payload validation.
- [`wrangler.toml`](/D:/work/bloknot-mashinista-tg/wrangler.toml) - Cloudflare Pages config.

## Local note

The local `server.js` file is only a simple static/dev server. The real synced auth flow works on Cloudflare Pages with D1 and the Telegram bot token secret.

## AI memory (Obsidian + Git)

This repo includes an agent memory workflow in [`ai-memory/`](/D:/work/bloknot-mashinista-tg/ai-memory/) that can be synced into your Obsidian vault.

1. Copy `.agent-memory.local.example.json` to `.agent-memory.local.json`.
2. Set your local `vaultPath` and `projectFolder`.
3. Run:
   - `npm run memory:init`

Useful commands:
- `npm run memory:preflight` — refresh memory and print mandatory reading order for a new session.
- `npm run memory:refresh` — rebuild current project snapshot.
- `npm run memory:log -- --task "..." --methods "..."` — append an explicit agent note.
- `npm run memory:sync` — sync memory files to Obsidian now.

If you work through an AI agent (Codex/Claude/Cursor), you do not need to run these manually:
- the agent should run preflight at session start,
- log key steps during work,
- refresh memory at session end.

Generated intelligence documents:
- `ai-memory/ARCHITECTURE.md`
- `ai-memory/METHODS.md`
- `ai-memory/ENGINEERING_STYLE.md`
- `ai-memory/SESSION_PROTOCOL.md`

Auto-update:
- `memory:init` installs a `post-commit` Git hook.
- After each commit, memory changelog is updated automatically.
