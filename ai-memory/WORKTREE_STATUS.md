# Worktree Status

Generated: 2026-07-10 14:31:37 +1000

## git status -sb
```text
## main...origin/main
 M ai-memory/CHANGELOG.md
 M ai-memory/INDEX.md
 M ai-memory/PROJECT_STATE.md
 M ai-memory/RECENT_COMMITS.md
 M ai-memory/WORKTREE_STATUS.md
 M ai-memory/sessions/2026-07-10.md
 M docs/seo/brigada-mashinista.html
 M docs/seo/dokumenty-mashinista.html
 M docs/seo/grafik-smen-mashinista.html
 M docs/seo/kalkulyator-zarplaty-mashinista.html
 M docs/seo/prilozhenie-dlya-mashinista.html
 M docs/seo/seo.css
 M docs/seo/uchet-marshrutov.html
 M docs/seo/zarplata-mashinista.html
 M docs/seo/zhurnal-smen-mashinista.html
?? .codex/
?? assets/seo/screen-add-v380.webp
?? assets/seo/screen-docs-v380.webp
?? assets/seo/screen-home-v380.webp
?? assets/seo/screen-profile-v380.webp
?? assets/seo/screen-shifts-v380.webp
```

## git branch -vv
```text
codex/next-direction b044dd5 offline mvp
  codex/tabs-ui        117f1fa [origin/codex/tabs-ui] tabs ui
* main                 68752d5 [origin/main] feat: add regime PDF profile builder
  poekhali-rework      2d5f0af chore(memory): refresh after main merge
```

## HEAD
```text
68752d5 feat: add regime PDF profile builder
 .../sections/dvost-postyshevo-komsomolsk.json      | 776 ++++++++++-----------
 assets/tracker/sections/index.json                 |   2 +-
 docs/REGIME_PROFILE_BUILDER.md                     |  83 +++
 package.json                                       |   4 +-
 scripts/poekhali-json-smoke.mjs                    |  51 +-
 scripts/regime-profile-builder.py                  |  18 +
 tests/regime_profile_builder/test_axis_trace.py    |  80 +++
 tests/regime_profile_builder/test_cli.py           |  73 ++
 tests/regime_profile_builder/test_pdf_io.py        |  66 ++
 tests/regime_profile_builder/test_pipeline.py      | 144 ++++
 tests/regime_profile_builder/test_safety.py        |  26 +
 tools/regime_profile_builder/__init__.py           |   7 +
 tools/regime_profile_builder/adapters/__init__.py  |   5 +
 .../adapters/black_grade_strokes.py                | 708 +++++++++++++++++++
 .../adapters/blue_bottom_table.py                  | 352 ++++++++++
 tools/regime_profile_builder/axis.py               | 154 ++++
 tools/regime_profile_builder/cli.py                | 281 ++++++++
 tools/regime_profile_builder/common.py             |  52 ++
 tools/regime_profile_builder/config.example.json   |  16 +
 tools/regime_profile_builder/pdf_io.py             | 144 ++++
 tools/regime_profile_builder/pipeline.py           | 741 ++++++++++++++++++++
 tools/regime_profile_builder/review.py             | 297 ++++++++
 tools/regime_profile_builder/trace.py              | 111 +++
 23 files changed, 3781 insertions(+), 410 deletions(-)
```
