# Engineering Style

Generated: 2026-04-17 23:20 +10:00

## First Rule
- Memory first, work second. Always run `python tools/agent_memory.py preflight` and read required memory files before project analysis, code search, edits, tests, deploy, or answers.

## Code Style
- Existing frontend is plain JavaScript with shared globals and deferred scripts; preserve local style and load order.
- Use defensive `try/catch` around Telegram SDK, viewport, localStorage, service worker, and platform APIs.
- Keep user-facing copy in Russian unless the surrounding UI uses English.
- Prefer small, local helpers near existing code over broad abstractions.
- Preserve localStorage key names, API payload shapes, service worker cache contracts, and offline pending queue behavior.

## Change Discipline
- Do not mix memory/tooling changes with unrelated product refactors.
- Do not delete or overwrite user changes in the worktree.
- Do not edit generated/binary/static assets unless the task requires it.
- After meaningful changes, record a memory log with files and method.
- End each session with memory refresh/sync.

## Production Safety
- Do not deploy or restart without explicit user request.
- Before deploy, verify local and production branch/upstream, and verify the intended commit is in the production branch.
- Never print/read private key contents, `.env` secrets, tokens, or production secrets into chat.
- Current production app uses PM2 process `bloknot-mashinista`; no project-specific systemd unit was found.
