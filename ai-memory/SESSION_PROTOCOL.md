# Session Protocol

Generated: 2026-04-17 15:37:14 +10:00

## Mandatory Preflight (start of every agent session)
1. Run `npm run memory:preflight`.
2. Read in order:
   - `ai-memory/START_HERE.md`
   - `ai-memory/PROJECT_STATE.md`
   - `ai-memory/ARCHITECTURE.md`
   - `ai-memory/METHODS.md`
   - `ai-memory/ENGINEERING_STYLE.md`
   - latest entries in `ai-memory/CHANGELOG.md`
   - `ai-memory/WORKTREE_STATUS.md`

## During Work
- For each meaningful change, add note:
  - `npm run memory:log -- --task "что сделано" --methods "как сделано" --files "a,b,c"`
- If scope changes, add another note instead of editing past notes.

## Session End
1. Run `npm run memory:refresh`.
2. If using git commit, `post-commit` hook will auto-append commit record.
3. Optional explicit final note:
   - `npm run memory:log -- --task "итог сессии" --methods "summary"`

## Obsidian Sync
- Ensure `.agent-memory.local.json` exists with correct vault path.
- `memory:preflight`, `memory:refresh`, and `memory:log` sync memory to Obsidian when enabled.

## Background Watcher
- Start once: `npm run memory:watch:daemon`.
- Check status: `npm run memory:watch:status`.
- Stop watcher: `npm run memory:watch:stop`.
- While running, watcher auto-refreshes memory and appends changelog notes after local file changes.
