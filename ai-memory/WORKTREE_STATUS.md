# Worktree Status

Generated: 2026-07-18 17:47:05 +1000

## git status -sb
```text
## main...origin/main [ahead 1]
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
* main                 9c93d25 [origin/main: ahead 1] fix: remove technical data controls from profile
  poekhali-rework      2d5f0af chore(memory): refresh after main merge
```

## HEAD
```text
9c93d25 fix: remove technical data controls from profile
 ai-memory/CHANGELOG.md           | 16 ++++++++++
 ai-memory/INDEX.md               |  2 +-
 ai-memory/PROJECT_STATE.md       | 35 +++++++++++++++-----
 ai-memory/RECENT_COMMITS.md      |  4 +--
 ai-memory/WORKTREE_STATUS.md     | 66 +++++++++++++++++++-------------------
 ai-memory/sessions/2026-07-18.md |  2 ++
 index.html                       | 69 ++++++++++------------------------------
 manifest.webmanifest             |  2 +-
 scripts/app-constants.js         |  2 +-
 scripts/app-init.js              | 31 +-----------------
 scripts/app.js                   | 13 +-------
 scripts/auth.js                  |  2 +-
 scripts/local-smoke.mjs          | 23 ++++++++++++++
 scripts/offline-smoke.mjs        |  2 +-
 scripts/poekhali-backup.js       |  2 +-
 scripts/poekhali-json-smoke.mjs  | 13 ++++++++
 scripts/poekhali-map-parser.js   |  2 +-
 scripts/poekhali-tracker.js      | 39 +++--------------------
 scripts/poekhali-utils.js        |  2 +-
 scripts/poekhali-warnings.js     |  2 +-
 scripts/render.js                |  2 +-
 scripts/setup-bot-webhook.py     |  2 +-
 scripts/shift-form.js            |  2 +-
 scripts/sw-update-smoke.mjs      | 18 +++++------
 scripts/time-utils.js            |  2 +-
 server.js                        |  3 +-
 sw-bootstrap-v388.js             | 46 +++++++++++++++++++++++++++
 sw.js                            |  6 ++--
 tests/server/api.test.js         |  4 +--
 29 files changed, 214 insertions(+), 200 deletions(-)
```
