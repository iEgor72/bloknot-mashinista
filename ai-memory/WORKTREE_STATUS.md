# Worktree Status

Generated: 2026-04-23 06:00:12 +0000

## git status -sb
```text
## main...origin/main
 M ai-memory/CHANGELOG.md
 M ai-memory/INDEX.md
 M ai-memory/PROJECT_STATE.md
 M ai-memory/RECENT_COMMITS.md
 M ai-memory/WORKTREE_STATUS.md
 M ai-memory/sessions/2026-04-23.md
 M scripts/app.js
 M scripts/auth.js
 M scripts/render.js
 M scripts/shift-form.js
 M server.js
 M styles/10-navigation-and-cards.css
 M sw.js
?? tools/__pycache__/
?? tools/migrate_legacy_local_shifts.py
```

## git branch -vv
```text
* main bbe2f55 [origin/main] refactor(schedule): switch app to manual-only shifts
```

## HEAD
```text
bbe2f55 refactor(schedule): switch app to manual-only shifts
 ai-memory/CHANGELOG.md           |  40 ++++++
 ai-memory/INDEX.md               |   2 +-
 ai-memory/PROJECT_STATE.md       |  22 +++-
 ai-memory/RECENT_COMMITS.md      |  24 ++--
 ai-memory/WORKTREE_STATUS.md     |  26 +++-
 ai-memory/sessions/2026-04-23.md |   5 +
 index.html                       | 128 +-----------------
 scripts/app.js                   | 276 ++++++++++++++++++++++++++++++++-------
 scripts/auth.js                  |   4 -
 scripts/render.js                | 139 ++++++++++++--------
 scripts/shift-form.js            |  61 +--------
 11 files changed, 417 insertions(+), 310 deletions(-)
```
