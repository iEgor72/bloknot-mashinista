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

## Files

- [`index.html`](/D:/work/bloknot-mashinista-tg/index.html) - app UI and auth gate.
- [`functions/api/auth.js`](/D:/work/bloknot-mashinista-tg/functions/api/auth.js) - Telegram auth endpoint.
- [`functions/api/shifts.js`](/D:/work/bloknot-mashinista-tg/functions/api/shifts.js) - per-user shifts API.
- [`functions/_shared/telegram-auth.js`](/D:/work/bloknot-mashinista-tg/functions/_shared/telegram-auth.js) - shared Telegram verification helpers.
- [`wrangler.toml`](/D:/work/bloknot-mashinista-tg/wrangler.toml) - Cloudflare Pages config.

## Local note

The local `server.js` file is only a simple static/dev server. The real synced auth flow works on Cloudflare Pages with D1 and the Telegram bot token secret.
