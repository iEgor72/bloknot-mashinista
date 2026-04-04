# Scripts Structure

Runtime scripts are loaded in this order from [`index.html`](/D:/work/bloknot-mashinista-tg/index.html):

1. [`safe-area.js`](/D:/work/bloknot-mashinista-tg/scripts/safe-area.js)
2. [`nav-debug.js`](/D:/work/bloknot-mashinista-tg/scripts/nav-debug.js)
3. [`app.js`](/D:/work/bloknot-mashinista-tg/scripts/app.js)
4. [`app-init.js`](/D:/work/bloknot-mashinista-tg/scripts/app-init.js)
5. [`sw-register.js`](/D:/work/bloknot-mashinista-tg/scripts/sw-register.js)

## Notes

- `safe-area.js`: iOS safe-area measurement and initial bottom-nav locking.
- `nav-debug.js`: optional diagnostics overlay for bottom-nav metrics. Enable with `?navDebug=1`, disable with `?navDebug=0`.
- `app.js`: core application logic (auth, shifts, calculations, rendering, interactions).
- `app-init.js`: explicit startup entrypoint (`bootstrapCachedShellFromStorage` and background bootstrap).
- `sw-register.js`: service worker registration and update activation flow.
