# Scripts Structure

Runtime scripts are loaded in this order from [`index.html`](/D:/work/bloknot-mashinista-tg/index.html):

1. [`safe-area.js`](/D:/work/bloknot-mashinista-tg/scripts/safe-area.js)
2. [`app-constants.js`](/D:/work/bloknot-mashinista-tg/scripts/app-constants.js)
3. [`auth.js`](/D:/work/bloknot-mashinista-tg/scripts/auth.js)
4. [`viewport.js`](/D:/work/bloknot-mashinista-tg/scripts/viewport.js)
5. [`time-utils.js`](/D:/work/bloknot-mashinista-tg/scripts/time-utils.js)
6. [`docs-app.js`](/D:/work/bloknot-mashinista-tg/scripts/docs-app.js)
7. [`app.js`](/D:/work/bloknot-mashinista-tg/scripts/app.js)
8. [`render.js`](/D:/work/bloknot-mashinista-tg/scripts/render.js)
9. [`shift-form.js`](/D:/work/bloknot-mashinista-tg/scripts/shift-form.js)
10. [`app-init.js`](/D:/work/bloknot-mashinista-tg/scripts/app-init.js)
11. [`sw-register.js`](/D:/work/bloknot-mashinista-tg/scripts/sw-register.js)
12. [`utils/haptics.js`](/D:/work/bloknot-mashinista-tg/scripts/utils/haptics.js)
13. [`press-feedback.js`](/D:/work/bloknot-mashinista-tg/scripts/press-feedback.js)
14. [`nav-debug.js`](/D:/work/bloknot-mashinista-tg/scripts/nav-debug.js)

## Responsibilities

| File | Responsibility |
|------|----------------|
| `safe-area.js` | Safe-area settling before the full app bootstrap. |
| `app-constants.js` | Production calendar, work norms, date helpers, storage constants. |
| `auth.js` | API URLs, Telegram auth, session tokens, bootstrap. |
| `viewport.js` | Viewport height, keyboard detection, Telegram layout events. |
| `time-utils.js` | MSK/local time parsing, shift duration, date formatting. |
| `docs-app.js` | Static documents list and PDF/DOCX/image viewer. |
| `app.js` | Core state, storage helpers, salary calc, docs shell, install guide. |
| `render.js` | Main `render()`, shift lists/detail, home calendar. |
| `shift-form.js` | Add/edit shift form, delete flow, overlays, settings actions. |
| `app-init.js` | Entry point that calls `bootstrapAppStartup()`. |
| `sw-register.js` | Service worker registration and update flow. |
| `utils/haptics.js` | Haptic wrappers and fallbacks. |
| `press-feedback.js` | Touch/press interaction feedback. |
| `nav-debug.js` | Optional bottom-nav diagnostics via `?navDebug=1`. |

## Load Order Notes

Scripts use shared globals and `defer`, so order matters. Constants/API/bootstrap helpers load before render/form modules, and `app-init.js` runs only after the modules it calls are present.
