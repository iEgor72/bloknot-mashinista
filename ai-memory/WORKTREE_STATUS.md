# Worktree Status

Generated: 2026-04-26 13:31:55 +0000

## git status -sb
```text
## main...origin/main
 M ai-memory/CHANGELOG.md
 M ai-memory/INDEX.md
 M ai-memory/PROJECT_STATE.md
 M ai-memory/RECENT_COMMITS.md
 M ai-memory/WORKTREE_STATUS.md
 M ai-memory/sessions/2026-04-26.md
 M scripts/auth.js
 M scripts/poekhali-tracker.js
```

## git branch -vv
```text
+ calendar-fix-main                             4b9e6c6 (/tmp/bloknot-batch/calendar-fix) Fix home calendar to show manual shifts only
+ chore/remove-graphs-and-restore-calendar-flow e90d829 (/tmp/bloknot-remove-graphs) refactor(app): remove remaining schedule tails
+ cleanup-archaeology                           6219db2 (/tmp/bloknot-batch/archaeology) Revert "refactor(schedule): switch app to manual-only shifts"
+ cleanup-backend                               6219db2 (/tmp/bloknot-clean/backend) Revert "refactor(schedule): switch app to manual-only shifts"
+ cleanup-backend-migrate                       6219db2 (/tmp/bloknot-batch/backend-migrate) Revert "refactor(schedule): switch app to manual-only shifts"
+ cleanup-frontend                              6219db2 (/tmp/bloknot-clean/frontend) Revert "refactor(schedule): switch app to manual-only shifts"
+ cleanup-frontend-smoke                        ed81af6 (/tmp/bloknot-batch/frontend-smoke) Hide schedule planner UI from frontend
+ cleanup-integration                           dba6ed0 (/tmp/bloknot-batch/integration) Remove schedule planner and add local smoke test
+ cleanup-review                                6219db2 (/tmp/bloknot-clean/review) Revert "refactor(schedule): switch app to manual-only shifts"
+ cleanup-test-harness                          6219db2 (/tmp/bloknot-batch/test-harness) Revert "refactor(schedule): switch app to manual-only shifts"
+ feat/manual-calendar-from-scratch             8345ab9 (/tmp/bloknot-manual-calendar) feat(home): polish manual calendar flow
* main                                          9f4dbd1 [origin/main] feat: release poekhali mode
```

## HEAD
```text
9f4dbd1 feat: release poekhali mode
 .gitignore                                         |     5 +
 ai-memory/CHANGELOG.md                             |   921 +
 ai-memory/INDEX.md                                 |     2 +-
 ai-memory/PROJECT_STATE.md                         |    51 +-
 ai-memory/RECENT_COMMITS.md                        |     4 +-
 ai-memory/WORKTREE_STATUS.md                       |    99 +-
 ai-memory/sessions/2026-04-25.md                   |    32 +
 ai-memory/sessions/2026-04-26.md                   |    84 +
 assets/tracker/data.xml                            |  1161 +
 assets/tracker/maps-manifest.json                  |   155 +
 assets/tracker/maps/komsomol-sk-tche-9/1.xml       | 24581 +++++++++++
 assets/tracker/maps/komsomol-sk-tche-9/1n.xml      | 24569 +++++++++++
 assets/tracker/maps/komsomol-sk-tche-9/2.xml       | 16517 ++++++++
 assets/tracker/maps/komsomol-sk-tche-9/2n.xml      | 16517 ++++++++
 assets/tracker/maps/komsomol-sk-tche-9/data.xml    | 41808 +++++++++++++++++++
 assets/tracker/maps/komsomol-sk-tche-9/profile.xml |  7113 ++++
 assets/tracker/maps/komsomol-sk-tche-9/speed.xml   |     1 +
 assets/tracker/profile.xml                         |  3598 ++
 assets/tracker/regime-maps.json                    | 40801 ++++++++++++++++++
 assets/tracker/speed-docs.json                     |  3409 ++
 assets/tracker/tch9-reference.json                 |  5026 +++
 docs/2026-04-26-poekhali-parity-tz.md              |   384 +
 index.html                                         |   116 +-
 package.json                                       |     5 +
 scripts/app.js                                     |   217 +-
 scripts/auth.js                                    |    18 +-
 scripts/docs-app.js                                |    20 +
 scripts/download-poekhali-maps.mjs                 |   217 +
 scripts/import-poekhali-android-backup.py          |   212 +
 scripts/import-regime-maps.py                      |  1234 +
 scripts/import-speed-docs.py                       |   373 +
 scripts/import-tch9-reference.py                   |   250 +
 scripts/poekhali-tracker.js                        | 16013 +++++++
 scripts/render.js                                  |    28 +-
 scripts/shift-form.js                              |    27 +
 scripts/time-utils.js                              |   368 +
 server.js                                          |  1077 +-
 styles/10-navigation-and-cards.css                 |  1579 +
 styles/15-bottom-nav.css                           |    30 +-
 styles/30-shifts-and-overlays.css                  |    54 +
 sw.js                                              |    92 +-
 41 files changed, 208682 insertions(+), 86 deletions(-)
```
