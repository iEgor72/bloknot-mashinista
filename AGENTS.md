# Agent Memory Protocol

Main rule: memory first, work second. Before any project work, analysis, code edits, tests, deploy actions, or project answers, the agent must run project memory preflight and read the memory files. Do not start with code search, do not edit files, and do not make conclusions until this is done.

Mandatory session start:
1. Agent runs `python tools/agent_memory.py preflight` autonomously (user action is not required).
2. Read [`ai-memory/START_HERE.md`](/D:/work/bloknot-mashinista-tg/ai-memory/START_HERE.md).
3. Read [`ai-memory/PROJECT_STATE.md`](/D:/work/bloknot-mashinista-tg/ai-memory/PROJECT_STATE.md).
4. Read [`ai-memory/ARCHITECTURE.md`](/D:/work/bloknot-mashinista-tg/ai-memory/ARCHITECTURE.md).
5. Read [`ai-memory/METHODS.md`](/D:/work/bloknot-mashinista-tg/ai-memory/METHODS.md).
6. Read [`ai-memory/ENGINEERING_STYLE.md`](/D:/work/bloknot-mashinista-tg/ai-memory/ENGINEERING_STYLE.md).
7. Read latest entries in [`ai-memory/CHANGELOG.md`](/D:/work/bloknot-mashinista-tg/ai-memory/CHANGELOG.md).
8. Check [`ai-memory/WORKTREE_STATUS.md`](/D:/work/bloknot-mashinista-tg/ai-memory/WORKTREE_STATUS.md).
9. Only after these steps, proceed to analysis, implementation, tests, deploy planning, or project answers.

During work:
- Record every meaningful step with:
  - `python tools/agent_memory.py log --task "What was done" --methods "How it was done" --files "file1,file2"`
- If scope or risk changes, add a new memory log instead of silently relying on chat history.

After work:
1. Refresh and sync project memory:
   - `python tools/agent_memory.py refresh`
   - `python tools/agent_memory.py sync --direction push`
2. If you create a Git commit, the post-commit hook should log it automatically into `ai-memory/CHANGELOG.md`.

Deploy rules:
- Do not deploy or restart services without a direct user request.
- Before deploy, check local branch/upstream and production branch/upstream. Production can track a different branch than the local worktree.
- Before deploy, verify that the intended commit is present in the production branch.
- Production access is documented in `ai-memory/PROJECT_STATE.md` and `ai-memory/METHODS.md`.
- Never print or read private key contents, tokens, `.env` secrets, or production secrets into chat.

Obsidian sync:
- Local vault sync is configured via `.agent-memory.local.json` (not committed).
- If configured, `python tools/agent_memory.py refresh`, `log`, and `sync` sync `ai-memory/` into the vault.
- `npm run memory:preflight`, `memory:refresh`, `memory:log`, and `memory:sync` are compatibility wrappers around the Python CLI.
