# Local smoke test

This repo now has a repeatable local smoke test that does **not** touch production.

## What it does

- starts `server.js` on a non-prod local port (`4173` by default)
- opens the app in real headless Chromium via Playwright
- fails if the app does not boot, if the auth gate stays open on localhost, if the home UI never appears, or if console/page errors occur
- saves artifacts under `artifacts/local-smoke/`

## One-time setup

```bash
cd /tmp/bloknot-batch/integration
npm install
npx playwright install chromium
```

## Run

```bash
cd /tmp/bloknot-batch/integration
npm run smoke:local
```

Optional port override:

```bash
SMOKE_PORT=4174 npm run smoke:local
```

## Artifacts

- `artifacts/local-smoke/report.json` — machine-readable result
- `artifacts/local-smoke/server.log` — local server stdout/stderr
- `artifacts/local-smoke/smoke-home.png` — screenshot of the rendered app

## Notes

- The app intentionally treats `localhost` as local/dev auth mode, so this smoke test validates shell boot/rendering, not production Telegram auth.
- Failures for `telegram.org` script loading are ignored in the network-failure gate because that third-party script is not required for local dev boot on localhost.
