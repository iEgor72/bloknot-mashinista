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

## Load order rationale

Scripts load in dependency order via `defer`:
- **Constants & utils first** — no dependencies, define globals used by everything
- **app.js before auth/render/form** — defines state variables that auth/render/form reference at call time
- **auth.js before app-init** — bootstrapAppStartup() must be defined before app-init.js calls it
- **render.js & shift-form.js last** — reference all previously defined globals; shift-form registers event listeners
