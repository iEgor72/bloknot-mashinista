# Worktree Status

Generated: 2026-06-01 21:46:44 +1000

## git status -sb
```text
## poekhali-rework
 M ai-memory/CHANGELOG.md
 M ai-memory/INDEX.md
 M ai-memory/PROJECT_STATE.md
 M ai-memory/RECENT_COMMITS.md
 M ai-memory/WORKTREE_STATUS.md
 M ai-memory/sessions/2026-06-01.md
 M scripts/poekhali-tracker.js
 M styles/50-design-refresh.css
```

## git branch -vv
```text
codex/next-direction b044dd5 offline mvp
  codex/tabs-ui        117f1fa [origin/codex/tabs-ui] tabs ui
  main                 ad53dff [origin/main] chore(memory): record poekhali deploy
* poekhali-rework      7a83190 Nav redesign: add Профиль, drop Зарплата tab, per-shift partner picker, Поехали from shift card
```

## HEAD
```text
7a83190 Nav redesign: add Профиль, drop Зарплата tab, per-shift partner picker, Поехали from shift card
 ai-memory/CHANGELOG.md           |  17 +++
 ai-memory/INDEX.md               |   2 +-
 ai-memory/PROJECT_STATE.md       |  24 +++-
 ai-memory/RECENT_COMMITS.md      |   4 +-
 ai-memory/WORKTREE_STATUS.md     |  38 +++--
 ai-memory/sessions/2026-06-01.md |   2 +
 index.html                       | 292 +++++++++++++++++++++------------------
 scripts/app-init.js              |  58 ++++----
 scripts/app.js                   | 243 ++++----------------------------
 scripts/auth.js                  |   2 +
 scripts/partners.js              |  36 +++--
 scripts/render.js                |   1 -
 scripts/shift-form.js            |  69 +++++----
 styles/15-bottom-nav.css         |   4 +-
 styles/55-partners.css           |  38 +++--
 styles/56-profile.css            | 141 +++++++++++++++++++
 16 files changed, 519 insertions(+), 452 deletions(-)
```
