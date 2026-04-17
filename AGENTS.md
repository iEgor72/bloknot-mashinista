# Agent Memory Protocol

Mandatory session start:
1. Agent runs `npm run memory:preflight` autonomously (user action is not required).
2. Read [`ai-memory/START_HERE.md`](/D:/work/bloknot-mashinista-tg/ai-memory/START_HERE.md).
3. Read [`ai-memory/PROJECT_STATE.md`](/D:/work/bloknot-mashinista-tg/ai-memory/PROJECT_STATE.md).
4. Read [`ai-memory/ARCHITECTURE.md`](/D:/work/bloknot-mashinista-tg/ai-memory/ARCHITECTURE.md).
5. Read [`ai-memory/METHODS.md`](/D:/work/bloknot-mashinista-tg/ai-memory/METHODS.md).
6. Read [`ai-memory/ENGINEERING_STYLE.md`](/D:/work/bloknot-mashinista-tg/ai-memory/ENGINEERING_STYLE.md).
7. Read latest entries in [`ai-memory/CHANGELOG.md`](/D:/work/bloknot-mashinista-tg/ai-memory/CHANGELOG.md).
8. Check [`ai-memory/WORKTREE_STATUS.md`](/D:/work/bloknot-mashinista-tg/ai-memory/WORKTREE_STATUS.md).

During work:
- Record important steps with:
  - Agent runs `npm run memory:log -- --task "What was done" --methods "How it was done" --files "file1,file2"` autonomously.

After work:
1. Refresh project memory:
   - Agent runs `npm run memory:refresh` autonomously.
2. If you create a Git commit, post-commit hook logs it automatically into `ai-memory/CHANGELOG.md`.

Obsidian sync:
- Local vault sync is configured via `.agent-memory.local.json` (not committed).
- If configured, every `memory:init`, `memory:refresh`, and `memory:log` run syncs `ai-memory/` into your vault.
