# Worktree Status

Generated: 2026-08-11 08:01:56 +1000

## git status -sb
```text
## codex/new-shift-time-picker-step1
 M ai-memory/CHANGELOG.md
 M ai-memory/PROJECT_STATE.md
 M ai-memory/sessions/2026-08-11.md
```

## git branch -vv
```text
+ codex/new-shift-time-picker-production 39ae27c (C:/Users/shkur/AppData/Local/Temp/bloknot-picker-prod-20260727) [origin/main: behind 1] refine: remove shift timeline and loop time picker
* codex/new-shift-time-picker-step1      01c6339 refine product scope and restore Poekhali
  codex/next-direction                   b044dd5 offline mvp
  codex/tabs-ui                          117f1fa [origin/codex/tabs-ui] tabs ui
  main                                   b66833b [origin/main: behind 7] fix: lowercase homepage rotation phrases
  poekhali-rework                        2d5f0af chore(memory): refresh after main merge
```

## HEAD
```text
01c6339 refine product scope and restore Poekhali
 ai-memory/CHANGELOG.md                            | 588 ++++++++++++++++++++++
 ai-memory/INDEX.md                                |   2 +-
 ai-memory/PROJECT_STATE.md                        |  67 ++-
 ai-memory/RECENT_COMMITS.md                       |  24 +-
 ai-memory/WORKTREE_STATUS.md                      |  76 ++-
 ai-memory/sessions/2026-07-18.md                  |   3 +
 ai-memory/sessions/2026-07-21.md                  |   2 +
 ai-memory/sessions/2026-07-23.md                  |  14 +
 ai-memory/sessions/2026-07-26.md                  |   2 +
 ai-memory/sessions/2026-07-27.md                  |  44 ++
 ai-memory/sessions/2026-07-29.md                  |   8 +
 ai-memory/sessions/2026-08-07.md                  |   2 +
 ai-memory/sessions/2026-08-11.md                  |   4 +
 assets/fonts/golos-text/GolosText-Black.woff2     | Bin 0 -> 34728 bytes
 assets/fonts/golos-text/GolosText-Bold.woff2      | Bin 0 -> 34552 bytes
 assets/fonts/golos-text/GolosText-ExtraBold.woff2 | Bin 0 -> 36044 bytes
 assets/fonts/golos-text/GolosText-Medium.woff2    | Bin 0 -> 34408 bytes
 assets/fonts/golos-text/GolosText-Regular.woff2   | Bin 0 -> 33572 bytes
 assets/fonts/golos-text/GolosText-SemiBold.woff2  | Bin 0 -> 34628 bytes
 assets/fonts/golos-text/OFL.txt                   |  93 ++++
 assets/seo/screen-add-iphone.jpg                  | Bin 44534 -> 43737 bytes
 assets/seo/screen-docs-iphone.jpg                 | Bin 51718 -> 33181 bytes
 assets/seo/screen-home-iphone.jpg                 | Bin 51810 -> 41700 bytes
 assets/seo/screen-shifts-iphone.jpg               | Bin 58853 -> 28715 bytes
 design-qa.md                                      |  58 +++
 docs/seo/brigada-mashinista.html                  | 102 ----
 docs/seo/dokumenty-mashinista.html                |   9 +-
 docs/seo/grafik-smen-mashinista.html              |   9 +-
 docs/seo/kalkulyator-zarplaty-mashinista.html     | 102 ----
 docs/seo/poekhali-rezhim.html                     | 102 ----
 docs/seo/prilozhenie-dlya-mashinista.html         |  19 +-
 docs/seo/uchet-marshrutov.html                    |  13 +-
 docs/seo/zarplata-mashinista.html                 | 102 ----
 docs/seo/zhurnal-smen-mashinista.html             |  11 +-
 index.html                                        | 279 ++--------
 manifest.webmanifest                              |   2 +-
 package.json                                      |   2 +-
 scripts/analytics.js                              | 409 ---------------
 scripts/app-constants.js                          |   3 +-
 scripts/app-init.js                               | 123 +----
 scripts/app.js                                    | 244 +--------
 scripts/auth.js                                   |  19 +-
 scripts/docs-app.js                               |   8 +-
 scripts/local-smoke.mjs                           |  53 +-
 scripts/offline-smoke.mjs                         |  26 +-
 scripts/poekhali-backup.js                        |   2 +-
 scripts/poekhali-map-parser.js                    |   2 +-
 scripts/poekhali-tracker.js                       |  20 +-
 scripts/poekhali-utils.js                         |   2 +-
 scripts/poekhali-warnings.js                      |   2 +-
 scripts/render.js                                 |  96 +---
 scripts/setup-bot-webhook.py                      |  28 +-
 scripts/shift-form.js                             | 142 +-----
 scripts/sw-update-smoke.mjs                       |  15 +-
 scripts/time-utils.js                             |  18 +-
 server.js                                         | 226 ++-------
 styles/00-base.css                                |  75 ++-
 styles/10-shell-navigation.css                    |   6 +-
 styles/11-poekhali-entry.css                      |  28 +-
 styles/12-cards.css                               |  28 +-
 styles/13-dashboard-cards.css                     |   8 +-
 styles/14-stats-and-salary.css                    |  16 +-
 styles/15-bottom-nav.css                          |   4 +-
 styles/15-settings-and-docs.css                   |   8 +-
 styles/16-overlays-and-actions.css                |  10 +-
 styles/20-form-and-stats.css                      |  22 +-
 styles/30-shifts-and-overlays.css                 |  18 +-
 styles/50-theme-shell.css                         |  60 +--
 styles/51-shifts.css                              |  32 +-
 styles/52-poekhali.css                            |  54 +-
 styles/53-salary.css                              |  40 +-
 styles/54-docs.css                                |  30 +-
 styles/55-forms.css                               | 178 ++++++-
 styles/55-partners.css                            |   6 +-
 styles/56-overlays.css                            | 355 ++++++++++---
 styles/56-profile.css                             | 114 +----
 sw-bootstrap-v391.js                              |  46 ++
 sw-bootstrap-v392.js                              |  46 ++
 sw.js                                             |  65 +--
 tests/server/api.test.js                          |  15 +-
 80 files changed, 1959 insertions(+), 2482 deletions(-)
```
