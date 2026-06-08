# Worktree Status

Generated: 2026-06-08 09:52:24 +0000

## git status -sb
```text
## main...origin/main
 M ai-memory/CHANGELOG.md
 M ai-memory/PROJECT_STATE.md
 M ai-memory/sessions/2026-06-08.md
 M scripts/app-constants.js
 M scripts/app.js
 M sw.js
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
* main                                          432a68b [origin/main] docs: add folders 11-13
```

## HEAD
```text
432a68b docs: add folders 11-13
 ai-memory/CHANGELOG.md            |   9 +++++++++
 ai-memory/INDEX.md                |   2 +-
 ai-memory/PROJECT_STATE.md        |  32 +++++++++++++++++++++++---------
 ai-memory/RECENT_COMMITS.md       |  14 +++++++-------
 ai-memory/WORKTREE_STATUS.md      |  36 +++++++++++++++++++++++++-----------
 ai-memory/sessions/2026-06-08.md  |   1 +
 assets/docs/folders/Папка №11.pdf | Bin 0 -> 216604 bytes
 assets/docs/folders/Папка №12.pdf | Bin 0 -> 207771 bytes
 assets/docs/folders/Папка №13.pdf | Bin 0 -> 202237 bytes
 assets/docs/manifest.json         |  21 +++++++++++++++++++++
 scripts/app-constants.js          |   2 +-
 sw.js                             |   2 +-
 12 files changed, 89 insertions(+), 30 deletions(-)
```
