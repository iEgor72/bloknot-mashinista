# Worktree Status

Generated: 2026-04-26 13:43:31 +0000

## git status -sb
```text
## main...origin/main
 M ai-memory/CHANGELOG.md
 M ai-memory/PROJECT_STATE.md
 M ai-memory/sessions/2026-04-26.md
 M scripts/poekhali-tracker.js
 M styles/00-base.css
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
* main                                          93f0c4a [origin/main] fix(poekhali): prevent map sheet reopen and selection
```

## HEAD
```text
93f0c4a fix(poekhali): prevent map sheet reopen and selection
 ai-memory/CHANGELOG.md             |  8 +++++
 ai-memory/INDEX.md                 |  2 +-
 ai-memory/PROJECT_STATE.md         | 14 +++------
 ai-memory/RECENT_COMMITS.md        |  4 +--
 ai-memory/WORKTREE_STATUS.md       | 62 ++++++++------------------------------
 ai-memory/sessions/2026-04-26.md   |  1 +
 scripts/poekhali-tracker.js        | 11 +++++++
 styles/10-navigation-and-cards.css | 11 +++++++
 8 files changed, 52 insertions(+), 61 deletions(-)
```
