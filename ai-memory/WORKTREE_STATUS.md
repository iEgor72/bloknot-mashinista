# Worktree Status

Generated: 2026-04-22 08:24:26 +0000

## git status -sb
```text
## main...origin/main
 M ai-memory/CHANGELOG.md
 M ai-memory/PROJECT_STATE.md
?? ai-memory/sessions/2026-04-22.md
```

## git branch -vv
```text
* main 3630c67 [origin/main] Revert "feat(docs): add owner-only document admin"
```

## HEAD
```text
3630c67 Revert "feat(docs): add owner-only document admin"
 ai-memory/CHANGELOG.md                       |   40 -
 ai-memory/INDEX.md                           |    2 +-
 ai-memory/PROJECT_STATE.md                   |   15 +-
 ai-memory/RECENT_COMMITS.md                  |    6 +-
 ai-memory/WORKTREE_STATUS.md                 |   32 +-
 docs/2026-04-22-admin-docs-release-review.md |  345 -------
 ecosystem.config.js                          |    1 -
 index.html                                   |  105 +--
 scripts/auth.js                              |   18 +-
 scripts/docs-app.js                          |  700 +-------------
 server.js                                    | 1310 +-------------------------
 styles/10-navigation-and-cards.css           |  188 ----
 styles/30-shifts-and-overlays.css            |  346 -------
 tools/docs_admin_smoke.js                    |  153 ---
 tools/docs_admin_ui_smoke.js                 |   98 --
 15 files changed, 54 insertions(+), 3305 deletions(-)
```
