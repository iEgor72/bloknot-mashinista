# Worktree Status

Generated: 2026-06-08 14:54:02 +1000

## git status -sb
```text
## main...origin/main [ahead 1]
 M ai-memory/CHANGELOG.md
 M ai-memory/PROJECT_STATE.md
 M ai-memory/sessions/2026-06-08.md
```

## git branch -vv
```text
codex/next-direction b044dd5 offline mvp
  codex/tabs-ui        117f1fa [origin/codex/tabs-ui] tabs ui
* main                 478e759 [origin/main: ahead 1] feat: refresh public site and app updates
  poekhali-rework      2d5f0af chore(memory): refresh after main merge
```

## HEAD
```text
478e759 feat: refresh public site and app updates
 ai-memory/CHANGELOG.md                        | 113 +++++
 ai-memory/INDEX.md                            |   2 +-
 ai-memory/PROJECT_STATE.md                    |  39 +-
 ai-memory/RECENT_COMMITS.md                   |   4 +-
 ai-memory/WORKTREE_STATUS.md                  |  64 ++-
 ai-memory/sessions/2026-06-07.md              |   1 +
 ai-memory/sessions/2026-06-08.md              |  14 +
 assets/seo/landing-overview.jpg               | Bin 70499 -> 92680 bytes
 assets/seo/landing-salary-screen.jpg          | Bin 60226 -> 84903 bytes
 assets/seo/screen-brigade.png                 | Bin 0 -> 306746 bytes
 assets/seo/screen-docs.png                    | Bin 0 -> 282001 bytes
 assets/seo/screen-home.png                    | Bin 0 -> 303640 bytes
 assets/seo/screen-poekhali.png                | Bin 0 -> 428417 bytes
 assets/seo/screen-profile.png                 | Bin 0 -> 331143 bytes
 docs/seo/brigada-mashinista.html              |  82 +++
 docs/seo/dokumenty-mashinista.html            |  82 +++
 docs/seo/grafik-smen-mashinista.html          |  80 +--
 docs/seo/kalkulyator-zarplaty-mashinista.html |  84 ++--
 docs/seo/poekhali-rezhim.html                 |  82 +++
 docs/seo/prilozhenie-dlya-mashinista.html     | 108 ++--
 docs/seo/seo.css                              | 695 ++++++++++++++++++++------
 docs/seo/uchet-marshrutov.html                |  82 ++-
 docs/seo/zarplata-mashinista.html             |  80 +--
 docs/seo/zhurnal-smen-mashinista.html         |  80 +--
 index.html                                    |  51 +-
 scripts/app-constants.js                      |   2 +-
 scripts/app-init.js                           | 190 +++++--
 scripts/app.js                                |   2 +-
 scripts/auth.js                               |   4 +-
 scripts/partners.js                           |  45 ++
 server.js                                     |  78 ++-
 styles/50-design-refresh.css                  |  11 +-
 sw.js                                         |   2 +-
 33 files changed, 1499 insertions(+), 578 deletions(-)
```
