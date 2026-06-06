# Worktree Status

Generated: 2026-06-06 11:26:09 +1000

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
* main                 9c130a0 [origin/main: ahead 1] fix(poehali): lift speed controls above bottom nav
  poekhali-rework      2d5f0af chore(memory): refresh after main merge
```

## HEAD
```text
9c130a0 fix(poehali): lift speed controls above bottom nav
 ai-memory/CHANGELOG.md             | 8 ++++++++
 ai-memory/sessions/2026-06-06.md   | 1 +
 scripts/app-constants.js           | 2 +-
 styles/00-base.css                 | 1 +
 styles/10-navigation-and-cards.css | 8 ++++----
 sw.js                              | 2 +-
 6 files changed, 16 insertions(+), 6 deletions(-)
```
