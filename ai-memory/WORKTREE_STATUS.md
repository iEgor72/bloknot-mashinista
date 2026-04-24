# Worktree Status

Generated: 2026-04-25 08:06:26 +1000

## git status -sb
```text
## main...origin/main [ahead 1]
 M ai-memory/CHANGELOG.md
 M ai-memory/PROJECT_STATE.md
 M ai-memory/sessions/2026-04-25.md
```

## git branch -vv
```text
codex/next-direction b044dd5 offline mvp
  codex/tabs-ui        117f1fa [origin/codex/tabs-ui] tabs ui
* main                 bca0195 [origin/main: ahead 1] refactor: remove legacy runtime dead code
```

## HEAD
```text
bca0195 refactor: remove legacy runtime dead code
 README.md                                |   102 +-
 ai-memory/ARCHITECTURE.md                |    16 +-
 ai-memory/CHANGELOG.md                   |    24 +
 ai-memory/INDEX.md                       |     2 +-
 ai-memory/METHODS.md                     |     4 +-
 ai-memory/PROJECT_STATE.md               |    56 +-
 ai-memory/RECENT_COMMITS.md              |    82 +-
 ai-memory/WORKTREE_STATUS.md             |    52 +-
 ai-memory/sessions/2026-04-25.md         |     4 +
 assets/instructions/catalog.v1.json      |   249 -
 assets/instructions/catalog.v2.json      | 33623 -----------------------------
 assets/instructions/sources.v2.json      |    41 -
 functions/api/auth.js                    |   137 -
 functions/api/docs.js                    |   218 -
 functions/api/shifts.js                  |    81 -
 functions/api/stats.js                   |    76 -
 functions/api/telegram-webhook.js        |    85 -
 functions/features/auth/telegram-auth.js |   305 -
 functions/features/docs/store.js         |    54 -
 functions/features/shifts/store.js       |    93 -
 functions/features/shifts/validation.js  |    24 -
 functions/features/stats/store.js        |   123 -
 index.html                               |     6 -
 scripts/README.md                        |    60 +-
 scripts/app.js                           |    18 -
 scripts/auth.js                          |     5 +-
 scripts/build-instructions-dataset.py    |   925 -
 scripts/instructions-app.js              |  2085 --
 scripts/local-smoke.mjs                  |     3 +-
 scripts/render.js                        |     2 +-
 scripts/shift-form.js                    |    37 +-
 scripts/stopwatch-app.js                 |     2 -
 scripts/stopwatch-engine.js              |     2 -
 server.js                                |     5 +
 styles/30-shifts-and-overlays.css        |    67 +
 styles/35-timer.css                      |    66 -
 styles/README.md                         |     6 +-
 sw.js                                    |     6 +-
 wrangler.toml                            |     9 -
 39 files changed, 317 insertions(+), 38438 deletions(-)
```
