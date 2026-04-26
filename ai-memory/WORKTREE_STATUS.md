# Worktree Status

Generated: 2026-04-27 08:31:48 +1000

## git status -sb
```text
## main...origin/main
 M ai-memory/CHANGELOG.md
 M ai-memory/INDEX.md
 M ai-memory/PROJECT_STATE.md
 M ai-memory/RECENT_COMMITS.md
 M ai-memory/WORKTREE_STATUS.md
 M ai-memory/sessions/2026-04-27.md
 M scripts/time-utils.js
 M sw.js
```

## git branch -vv
```text
codex/next-direction b044dd5 offline mvp
  codex/tabs-ui        117f1fa [origin/codex/tabs-ui] tabs ui
* main                 b67d010 [origin/main] fix(poekhali): stabilize live trip mode
```

## HEAD
```text
b67d010 fix(poekhali): stabilize live trip mode
 ai-memory/CHANGELOG.md             |  128 ++++
 ai-memory/INDEX.md                 |    2 +-
 ai-memory/PROJECT_STATE.md         |   39 +-
 ai-memory/RECENT_COMMITS.md        |   76 +-
 ai-memory/WORKTREE_STATUS.md       |   50 +-
 ai-memory/sessions/2026-04-27.md   |   17 +
 index.html                         |    5 +-
 scripts/app.js                     |   23 +-
 scripts/poekhali-tracker.js        | 1342 ++++++++++++++++++++++++++++++------
 scripts/shift-form.js              |   30 +-
 scripts/time-utils.js              |   70 +-
 server.js                          |   15 +-
 styles/00-base.css                 |   86 ++-
 styles/10-navigation-and-cards.css |  116 +++-
 sw.js                              |    2 +-
 15 files changed, 1574 insertions(+), 427 deletions(-)
```
