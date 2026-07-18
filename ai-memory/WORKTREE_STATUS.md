# Worktree Status

Generated: 2026-07-18 17:29:20 +1000

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
* main                 d50db9d [origin/main] fix: self-heal mixed PWA runtimes
  poekhali-rework      2d5f0af chore(memory): refresh after main merge
```

## HEAD
```text
d50db9d fix: self-heal mixed PWA runtimes
 ai-memory/CHANGELOG.md           |  16 ++++
 ai-memory/sessions/2026-07-18.md |   2 +
 index.html                       |  38 +++++---
 manifest.webmanifest             |   2 +-
 scripts/app-constants.js         | 198 ++++++++++++++++++++++++++++++++++++++-
 scripts/app-init.js              |  32 +++++--
 scripts/app.js                   |   2 +
 scripts/auth.js                  |   2 +
 scripts/offline-smoke.mjs        |  66 +++++++++++++
 scripts/poekhali-backup.js       |   2 +
 scripts/poekhali-json-smoke.mjs  |  35 +++++++
 scripts/poekhali-map-parser.js   |   2 +
 scripts/poekhali-tracker.js      |   2 +
 scripts/poekhali-utils.js        |   2 +
 scripts/poekhali-warnings.js     |   2 +
 scripts/render.js                |   2 +
 scripts/setup-bot-webhook.py     |   2 +-
 scripts/shift-form.js            |   2 +
 scripts/sw-register.js           |   8 +-
 scripts/sw-update-smoke.mjs      |  18 ++--
 scripts/time-utils.js            |   2 +
 server.js                        |   3 +-
 sw-bootstrap-v386.js             |   6 +-
 sw-bootstrap-v387.js             |  46 +++++++++
 sw.js                            |   6 +-
 tests/server/api.test.js         |   4 +-
 26 files changed, 458 insertions(+), 44 deletions(-)
```
