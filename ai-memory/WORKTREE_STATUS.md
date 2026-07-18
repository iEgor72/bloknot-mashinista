# Worktree Status

Generated: 2026-07-18 16:10:29 +1000

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
* main                 8afcaef [origin/main] feat: harden runtime and migrate storage to SQLite
  poekhali-rework      2d5f0af chore(memory): refresh after main merge
```

## HEAD
```text
8afcaef feat: harden runtime and migrate storage to SQLite
 .gitignore                         |    1 +
 README.md                          |   12 +-
 ai-memory/ARCHITECTURE.md          |    7 +-
 ai-memory/CHANGELOG.md             |  201 ++
 ai-memory/INDEX.md                 |    2 +-
 ai-memory/METHODS.md               |    8 +-
 ai-memory/PROJECT_STATE.md         |   95 +-
 ai-memory/RECENT_COMMITS.md        |    4 +-
 ai-memory/WORKTREE_STATUS.md       |  131 +-
 ai-memory/sessions/2026-07-11.md   |    8 +
 ai-memory/sessions/2026-07-17.md   |   13 +
 ai-memory/sessions/2026-07-18.md   |    6 +
 assets/tracker/sections/index.json |    1 +
 index.html                         |   93 +-
 package-lock.json                  |  455 +++
 package.json                       |    9 +-
 scripts/README.md                  |   37 +-
 scripts/app-constants.js           |    3 +-
 scripts/app-init.js                |  101 +-
 scripts/app.js                     |  105 +-
 scripts/auth.js                    |   18 -
 scripts/docs-app.js                |   18 -
 scripts/local-smoke.mjs            |   30 +-
 scripts/offline-smoke.mjs          |    5 +-
 scripts/poekhali-backup.js         |  343 +++
 scripts/poekhali-json-smoke.mjs    |  549 +++-
 scripts/poekhali-map-parser.js     |  815 ++++++
 scripts/poekhali-tracker.js        | 5460 ++++++------------------------------
 scripts/poekhali-utils.js          |  343 +++
 scripts/poekhali-warnings.js       |  391 +++
 scripts/render.js                  |  104 +-
 scripts/shift-form.js              |   48 -
 scripts/storage-maintenance.js     |   70 +
 scripts/sw-update-smoke.mjs        |   19 +-
 scripts/time-utils.js              |   41 +-
 scripts/viewport.js                |    2 -
 server.js                          | 1142 +-------
 server/sqlite-storage.js           |  394 +++
 styles/00-base.css                 |   48 -
 styles/10-navigation-and-cards.css | 4945 +-------------------------------
 styles/10-shell-navigation.css     |  673 +++++
 styles/11-poekhali-entry.css       |  726 +++++
 styles/12-cards.css                |  597 ++++
 styles/13-dashboard-cards.css      |  618 ++++
 styles/14-stats-and-salary.css     |  449 +++
 styles/15-settings-and-docs.css    |  564 ++++
 styles/16-overlays-and-actions.css |  688 +++++
 styles/50-design-refresh.css       | 4244 +---------------------------
 styles/50-theme-shell.css          |  836 ++++++
 styles/51-shifts.css               |  417 +++
 styles/52-poekhali.css             |  598 ++++
 styles/53-salary.css               |  268 ++
 styles/54-docs.css                 |  375 +++
 styles/55-forms.css                |  583 ++++
 styles/56-overlays.css             |  982 +++++++
 sw-bootstrap-v381.js               |   42 +
 sw-bootstrap-v382.js               |   42 +
 sw-bootstrap-v383.js               |   42 +
 sw.js                              |   76 +-
 tests/server/api.test.js           |  194 ++
 tests/server/storage.test.js       |  101 +
 61 files changed, 13874 insertions(+), 15318 deletions(-)
```
