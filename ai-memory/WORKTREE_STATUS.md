# Worktree Status

Generated: 2026-07-18 15:59:08 +1000

## git status -sb
```text
## main...origin/main
 M README.md
 M ai-memory/ARCHITECTURE.md
 M ai-memory/CHANGELOG.md
 M ai-memory/INDEX.md
 M ai-memory/METHODS.md
 M ai-memory/PROJECT_STATE.md
 M ai-memory/RECENT_COMMITS.md
 M ai-memory/WORKTREE_STATUS.md
 M ai-memory/sessions/2026-07-11.md
 M assets/tracker/sections/index.json
 M index.html
 M package-lock.json
 M package.json
 M scripts/README.md
 M scripts/app-constants.js
 M scripts/app-init.js
 M scripts/app.js
 M scripts/auth.js
 M scripts/docs-app.js
 M scripts/local-smoke.mjs
 M scripts/offline-smoke.mjs
 M scripts/poekhali-json-smoke.mjs
 M scripts/poekhali-tracker.js
 M scripts/render.js
 M scripts/shift-form.js
 M scripts/sw-update-smoke.mjs
 M scripts/time-utils.js
 M scripts/viewport.js
 M server.js
 M styles/00-base.css
 M styles/10-navigation-and-cards.css
 M styles/50-design-refresh.css
 M sw.js
?? .codex/
?? ai-memory/sessions/2026-07-17.md
?? ai-memory/sessions/2026-07-18.md
?? scripts/poekhali-backup.js
?? scripts/poekhali-map-parser.js
?? scripts/poekhali-utils.js
?? scripts/poekhali-warnings.js
?? scripts/storage-maintenance.js
?? server/
?? styles/10-shell-navigation.css
?? styles/11-poekhali-entry.css
?? styles/12-cards.css
?? styles/13-dashboard-cards.css
?? styles/14-stats-and-salary.css
?? styles/15-settings-and-docs.css
?? styles/16-overlays-and-actions.css
?? styles/50-theme-shell.css
?? styles/51-shifts.css
?? styles/52-poekhali.css
?? styles/53-salary.css
?? styles/54-docs.css
?? styles/55-forms.css
?? styles/56-overlays.css
?? sw-bootstrap-v381.js
?? sw-bootstrap-v382.js
?? sw-bootstrap-v383.js
?? tests/server/
```

## git branch -vv
```text
codex/next-direction b044dd5 offline mvp
  codex/tabs-ui        117f1fa [origin/codex/tabs-ui] tabs ui
* main                 28f6838 [origin/main] feat: rebuild regime profiles from PDF maps
  poekhali-rework      2d5f0af chore(memory): refresh after main merge
```

## HEAD
```text
28f6838 feat: rebuild regime profiles from PDF maps
 ai-memory/CHANGELOG.md                             |  289 +++
 ai-memory/INDEX.md                                 |    2 +-
 ai-memory/PROJECT_STATE.md                         |   38 +-
 ai-memory/RECENT_COMMITS.md                        |    4 +-
 ai-memory/WORKTREE_STATUS.md                       |   69 +-
 ai-memory/sessions/2026-07-10.md                   |   20 +
 ai-memory/sessions/2026-07-11.md                   |   17 +
 assets/tracker/sections/dvost-oune-pivan.json      |  915 ++++-----
 assets/tracker/sections/dvost-pivan-novyi-mir.json |  149 +-
 .../sections/dvost-postyshevo-komsomolsk.json      |  729 +++----
 .../sections/dvost-postyshevo-novyi-urgal-odd.json | 2011 +++++++++-----------
 .../sections/dvost-volochaevka-ii-dzemgi.json      | 1847 +++++++++---------
 .../dvost-vysokogornaya-oune-via-muli.json         |  135 +-
 .../dvost-vysokogornaya-oune-via-sollu.json        |  723 ++-----
 assets/tracker/sections/index.json                 |   12 +-
 docs/REGIME_PROFILE_BUILDER.md                     |   61 +-
 scripts/poekhali-json-smoke.mjs                    |  404 +++-
 tests/regime_profile_builder/test_axis_trace.py    |  137 +-
 .../test_black_grade_strokes.py                    |  150 ++
 .../test_blue_bottom_table.py                      |  212 +++
 tests/regime_profile_builder/test_cli.py           |  588 +++++-
 .../test_diagonal_grade_table.py                   |  326 ++++
 tests/regime_profile_builder/test_pdf_io.py        |   11 +-
 tests/regime_profile_builder/test_pipeline.py      |  539 ++++++
 tests/regime_profile_builder/test_safety.py        |  180 +-
 tools/regime_profile_builder/__init__.py           |    6 +-
 tools/regime_profile_builder/adapters/__init__.py  |    4 +-
 .../adapters/black_grade_strokes.py                |  129 +-
 .../adapters/blue_bottom_table.py                  |  334 +++-
 .../adapters/diagonal_grade_table.py               | 1081 +++++++++++
 tools/regime_profile_builder/axis.py               |  203 +-
 tools/regime_profile_builder/cli.py                |  602 +++++-
 tools/regime_profile_builder/config.example.json   |    5 +
 tools/regime_profile_builder/pdf_io.py             |   11 +-
 tools/regime_profile_builder/pipeline.py           | 1246 +++++++++++-
 tools/regime_profile_builder/review.py             |   84 +-
 36 files changed, 9449 insertions(+), 3824 deletions(-)
```
