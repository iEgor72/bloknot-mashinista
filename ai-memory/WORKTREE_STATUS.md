# Worktree Status

Generated: 2026-07-10 09:25:15 +1000

## git status -sb
```text
## main...origin/main [ahead 1]
 M ai-memory/CHANGELOG.md
 M ai-memory/INDEX.md
 M ai-memory/PROJECT_STATE.md
 M ai-memory/RECENT_COMMITS.md
 M ai-memory/WORKTREE_STATUS.md
 M ai-memory/sessions/2026-06-21.md
?? .codex/
?? ai-memory/sessions/2026-07-10.md
```

## git branch -vv
```text
codex/next-direction b044dd5 offline mvp
  codex/tabs-ui        117f1fa [origin/codex/tabs-ui] tabs ui
* main                 a45b009 [origin/main: ahead 1] feat: ship JSON track profiles and v379 shell
  poekhali-rework      2d5f0af chore(memory): refresh after main merge
```

## HEAD
```text
a45b009 feat: ship JSON track profiles and v379 shell
 assets/tracker/sections/README.md                  |    27 +
 assets/tracker/sections/dvost-oune-pivan.json      |  4556 ++++++++
 assets/tracker/sections/dvost-pivan-novyi-mir.json |   582 +
 .../sections/dvost-postyshevo-komsomolsk.json      |  5851 ++++++++++
 .../sections/dvost-postyshevo-novyi-urgal-odd.json | 11027 +++++++++++++++++++
 .../sections/dvost-volochaevka-ii-dzemgi.json      |  7009 ++++++++++++
 .../dvost-vysokogornaya-oune-via-muli.json         |   603 +
 .../dvost-vysokogornaya-oune-via-sollu.json        |  1432 +++
 assets/tracker/sections/index.json                 |   168 +
 index.html                                         |    12 +-
 package.json                                       |     2 +
 scripts/app-constants.js                           |     2 +-
 scripts/app-init.js                                |    52 +-
 scripts/local-smoke.mjs                            |   258 +-
 scripts/offline-smoke.mjs                          |     2 +-
 scripts/poekhali-json-smoke.mjs                    |   301 +
 scripts/poekhali-tracker.js                        |  1137 +-
 scripts/prod-cache-smoke.mjs                       |     4 +
 scripts/validate-tracker-sections.mjs              |   309 +
 server.js                                          |     1 +
 styles/50-design-refresh.css                       |     4 +-
 sw-bootstrap-v379.js                               |    26 +
 sw.js                                              |    14 +-
 23 files changed, 33264 insertions(+), 115 deletions(-)
```
