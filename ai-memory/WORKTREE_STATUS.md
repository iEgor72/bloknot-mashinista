# Worktree Status

Generated: 2026-07-10 17:59:15 +1000

## git status -sb
```text
## main...origin/main [ahead 1]
 M ai-memory/CHANGELOG.md
 M ai-memory/INDEX.md
 M ai-memory/PROJECT_STATE.md
 M ai-memory/RECENT_COMMITS.md
 M ai-memory/WORKTREE_STATUS.md
 M ai-memory/sessions/2026-07-10.md
?? .codex/
```

## git branch -vv
```text
codex/next-direction b044dd5 offline mvp
  codex/tabs-ui        117f1fa [origin/codex/tabs-ui] tabs ui
* main                 7f402ec [origin/main: ahead 1] feat(seo): redesign public landing pages
  poekhali-rework      2d5f0af chore(memory): refresh after main merge
```

## HEAD
```text
7f402ec feat(seo): redesign public landing pages
 ai-memory/CHANGELOG.md                        |  40 ++
 ai-memory/INDEX.md                            |   2 +-
 ai-memory/PROJECT_STATE.md                    |  16 +-
 ai-memory/RECENT_COMMITS.md                   |   4 +-
 ai-memory/WORKTREE_STATUS.md                  |  45 +-
 ai-memory/sessions/2026-07-10.md              |   5 +
 assets/seo/screen-add-iphone.jpg              | Bin 0 -> 44534 bytes
 assets/seo/screen-docs-iphone.jpg             | Bin 0 -> 51718 bytes
 assets/seo/screen-home-iphone.jpg             | Bin 0 -> 51810 bytes
 assets/seo/screen-poekhali-iphone.jpg         | Bin 0 -> 45296 bytes
 assets/seo/screen-profile-iphone.jpg          | Bin 0 -> 38101 bytes
 assets/seo/screen-shifts-iphone.jpg           | Bin 0 -> 58853 bytes
 assets/seo/site-icons.svg                     |  23 +
 docs/seo/brigada-mashinista.html              |  33 +-
 docs/seo/dokumenty-mashinista.html            |  33 +-
 docs/seo/grafik-smen-mashinista.html          |  33 +-
 docs/seo/kalkulyator-zarplaty-mashinista.html |  33 +-
 docs/seo/poekhali-rezhim.html                 |  33 +-
 docs/seo/prilozhenie-dlya-mashinista.html     |  67 +-
 docs/seo/seo.css                              | 910 +++++++++++---------------
 docs/seo/uchet-marshrutov.html                |  33 +-
 docs/seo/zarplata-mashinista.html             |  33 +-
 docs/seo/zhurnal-smen-mashinista.html         |  33 +-
 23 files changed, 717 insertions(+), 659 deletions(-)
```
