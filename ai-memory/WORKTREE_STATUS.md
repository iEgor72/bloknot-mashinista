# Worktree Status

Generated: 2026-06-06 11:38:12 +1000

## git status -sb
```text
## main...origin/main [ahead 1]
 M ai-memory/CHANGELOG.md
 M ai-memory/PROJECT_STATE.md
 M ai-memory/sessions/2026-06-06.md
```

## git branch -vv
```text
codex/next-direction b044dd5 offline mvp
  codex/tabs-ui        117f1fa [origin/codex/tabs-ui] tabs ui
* main                 e8b0a2e [origin/main: ahead 1] fix(poehali): keep speed editor clear of bottom nav
  poekhali-rework      2d5f0af chore(memory): refresh after main merge
```

## HEAD
```text
e8b0a2e fix(poehali): keep speed editor clear of bottom nav
 ai-memory/CHANGELOG.md             |  8 ++++++++
 ai-memory/sessions/2026-06-06.md   |  1 +
 scripts/app-constants.js           |  2 +-
 styles/00-base.css                 |  1 -
 styles/10-navigation-and-cards.css | 14 +++++++-------
 styles/50-design-refresh.css       |  7 +------
 sw.js                              |  2 +-
 7 files changed, 19 insertions(+), 16 deletions(-)
```
