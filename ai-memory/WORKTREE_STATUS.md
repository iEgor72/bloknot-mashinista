# Worktree Status

Generated: 2026-07-18 16:30:37 +1000

## git status -sb
```text
## main...origin/main
 M ai-memory/CHANGELOG.md
 M ai-memory/INDEX.md
 M ai-memory/PROJECT_STATE.md
 M ai-memory/RECENT_COMMITS.md
 M ai-memory/WORKTREE_STATUS.md
 M ai-memory/sessions/2026-07-18.md
```

## git branch -vv
```text
codex/next-direction b044dd5 offline mvp
  codex/tabs-ui        117f1fa [origin/codex/tabs-ui] tabs ui
* main                 110c581 [origin/main] fix: correct shift fuel units and Poekhali scope
  poekhali-rework      2d5f0af chore(memory): refresh after main merge
```

## HEAD
```text
110c581 fix: correct shift fuel units and Poekhali scope
 ai-memory/CHANGELOG.md           |  8 +++++
 ai-memory/sessions/2026-07-18.md |  1 +
 index.html                       | 28 ++++++++--------
 scripts/app-constants.js         |  2 +-
 scripts/local-smoke.mjs          | 70 ++++++++++++++++++++++++++++++++++++++++
 scripts/poekhali-json-smoke.mjs  |  2 +-
 scripts/poekhali-tracker.js      | 37 +++++++++++++--------
 scripts/render.js                | 56 ++++++++++++++++++++++----------
 scripts/sw-update-smoke.mjs      | 18 +++++------
 scripts/time-utils.js            | 26 +++++++++++++++
 server.js                        |  1 +
 sw-bootstrap-v384.js             | 42 ++++++++++++++++++++++++
 sw.js                            |  6 ++--
 13 files changed, 239 insertions(+), 58 deletions(-)
```
