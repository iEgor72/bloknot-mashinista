# Worktree Status

Generated: 2026-04-27 09:22:42 +1000

## git status -sb
```text
## main...origin/main
 M ai-memory/CHANGELOG.md
 M ai-memory/INDEX.md
 M ai-memory/PROJECT_STATE.md
 M ai-memory/RECENT_COMMITS.md
 M ai-memory/WORKTREE_STATUS.md
 M ai-memory/sessions/2026-04-27.md
```

## git branch -vv
```text
codex/next-direction b044dd5 offline mvp
  codex/tabs-ui        117f1fa [origin/codex/tabs-ui] tabs ui
* main                 791297c [origin/main] feat(shifts): open details from cards
```

## HEAD
```text
791297c feat(shifts): open details from cards
 ai-memory/CHANGELOG.md            |  25 +++++++
 ai-memory/INDEX.md                |   2 +-
 ai-memory/PROJECT_STATE.md        |  13 ++--
 ai-memory/RECENT_COMMITS.md       |   4 +-
 ai-memory/WORKTREE_STATUS.md      |  26 +++----
 ai-memory/sessions/2026-04-27.md  |   3 +
 scripts/render.js                 |   6 +-
 scripts/time-utils.js             | 143 +++++++++++++++++++++++++-------------
 styles/30-shifts-and-overlays.css |  56 ++++++++++++++-
 sw.js                             |   2 +-
 10 files changed, 201 insertions(+), 79 deletions(-)
```
