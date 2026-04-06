# Scripts Structure

Runtime scripts are loaded in this order from [`index.html`](/D:/work/bloknot-mashinista-tg/index.html):

1. [`safe-area.js`](/D:/work/bloknot-mashinista-tg/scripts/safe-area.js)
2. [`nav-debug.js`](/D:/work/bloknot-mashinista-tg/scripts/nav-debug.js)
3. [`instructions/normalizeText.js`](/D:/work/bloknot-mashinista-tg/scripts/instructions/normalizeText.js)
4. [`instructions/tokenize.js`](/D:/work/bloknot-mashinista-tg/scripts/instructions/tokenize.js)
5. [`instructions/buildChargrams.js`](/D:/work/bloknot-mashinista-tg/scripts/instructions/buildChargrams.js)
6. [`instructions/fuzzy.js`](/D:/work/bloknot-mashinista-tg/scripts/instructions/fuzzy.js)
7. [`instructions/parseHierarchy.js`](/D:/work/bloknot-mashinista-tg/scripts/instructions/parseHierarchy.js)
8. [`instructions/parseInstruction.js`](/D:/work/bloknot-mashinista-tg/scripts/instructions/parseInstruction.js)
9. [`instructions/buildSearchEntities.js`](/D:/work/bloknot-mashinista-tg/scripts/instructions/buildSearchEntities.js)
10. [`instructions/rankResults.js`](/D:/work/bloknot-mashinista-tg/scripts/instructions/rankResults.js)
11. [`instructions/searchInstructions.js`](/D:/work/bloknot-mashinista-tg/scripts/instructions/searchInstructions.js)
12. [`instructions/instructionsDb.js`](/D:/work/bloknot-mashinista-tg/scripts/instructions/instructionsDb.js)
13. [`app.js`](/D:/work/bloknot-mashinista-tg/scripts/app.js)
14. [`app-init.js`](/D:/work/bloknot-mashinista-tg/scripts/app-init.js)
15. [`sw-register.js`](/D:/work/bloknot-mashinista-tg/scripts/sw-register.js)

## Notes

- `safe-area.js`: iOS safe-area measurement and initial bottom-nav locking.
- `nav-debug.js`: optional diagnostics overlay for bottom-nav metrics. Enable with `?navDebug=1`, disable with `?navDebug=0`.
- `scripts/instructions/*`: архитектурное ядро инструкций (parser layer, local IndexedDB storage, hybrid search pipeline, ranking).
- `app.js`: core application logic (auth, shifts, calculations, rendering, interactions).
- `app-init.js`: explicit startup entrypoint (`bootstrapCachedShellFromStorage` and background bootstrap).
- `sw-register.js`: service worker registration and update activation flow.
