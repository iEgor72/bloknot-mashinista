# Session Protocol

Generated: 2026-04-17 22:58:34 +10:00

## Mandatory Preflight (start of every agent session)
Memory first, work second. Do not analyze code, edit files, run tests, deploy, or answer project questions before this preflight is complete.

1. Run `python tools/agent_memory.py preflight`.
2. Read in order:
   - `ai-memory/START_HERE.md`
   - `ai-memory/PROJECT_STATE.md`
   - `ai-memory/ARCHITECTURE.md`
   - `ai-memory/METHODS.md`
   - `ai-memory/ENGINEERING_STYLE.md`
   - latest entries in `ai-memory/CHANGELOG.md`
   - `ai-memory/WORKTREE_STATUS.md`
3. Only after that, proceed to project work.

## During Work
- For each meaningful change, add note:
  - `python tools/agent_memory.py log --task "что сделано" --methods "как сделано" --files "a,b,c"`
- If scope changes, add another note instead of editing past notes.

## Session End
1. Run `python tools/agent_memory.py refresh`.
2. Run `python tools/agent_memory.py sync --direction push`.
3. If using git commit, `post-commit` hook will auto-append commit record.
4. Optional explicit final note:
   - `python tools/agent_memory.py log --task "итог сессии" --methods "summary"`

## Obsidian Sync
- Ensure `.agent-memory.local.json` exists with correct vault path.
- `python tools/agent_memory.py refresh`, `log`, and `sync` sync memory to Obsidian when enabled.

## Deploy Safety
- Do not deploy or restart services without a direct user request.
- Before deploy, check local branch/upstream and production branch/upstream; they can differ.
- Before deploy, verify that the intended commit is present in the production branch.
- Never print or read private key contents, tokens, `.env` secrets, or production secrets into chat.
