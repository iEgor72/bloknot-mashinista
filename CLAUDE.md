# Agent Memory Protocol

Mandatory session start:
1. Agent runs `npm run memory:preflight` autonomously (user action is not required).
2. Open [`ai-memory/START_HERE.md`](/D:/work/bloknot-mashinista-tg/ai-memory/START_HERE.md).
3. Open [`ai-memory/PROJECT_STATE.md`](/D:/work/bloknot-mashinista-tg/ai-memory/PROJECT_STATE.md).
4. Open [`ai-memory/ARCHITECTURE.md`](/D:/work/bloknot-mashinista-tg/ai-memory/ARCHITECTURE.md).
5. Open [`ai-memory/METHODS.md`](/D:/work/bloknot-mashinista-tg/ai-memory/METHODS.md).
6. Open [`ai-memory/ENGINEERING_STYLE.md`](/D:/work/bloknot-mashinista-tg/ai-memory/ENGINEERING_STYLE.md).
7. Read recent entries in [`ai-memory/CHANGELOG.md`](/D:/work/bloknot-mashinista-tg/ai-memory/CHANGELOG.md).
8. Check [`ai-memory/WORKTREE_STATUS.md`](/D:/work/bloknot-mashinista-tg/ai-memory/WORKTREE_STATUS.md).

During work, record major actions:
- Agent runs `npm run memory:log -- --task "..." --methods "..." --files "file1,file2"` autonomously.

After work:
- Agent runs `npm run memory:refresh` autonomously.
- Git commit auto-logs via `post-commit` hook.
