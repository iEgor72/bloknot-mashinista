# Engineering Style

Generated: 2026-04-17 15:18:26 +10:00

## Codebase Style Metrics
- JS files: 43
- Declaration mix: var=2182 (25.5%), let=1623 (19.0%), const=4737 (55.5%)
- IIFE-like files: 17
- ESM-like files: 11
- addEventListener calls: 208
- fetch() calls: 50
- catch(...) blocks: 277

## Writing Style Traits
- Defensive coding with frequent `try/catch` around platform-specific APIs (Telegram SDK, localStorage, viewport APIs).
- Imperative, event-driven DOM code with direct `document.getElementById` / query selectors.
- Shared global runtime state across deferred scripts; module boundaries are file-based, not bundler-based.
- Extensive constants and small helper functions before side-effect handlers.
- User-facing copy is primarily Russian; technical identifiers are English.

## Naming and Data Conventions
- Persistent frontend keys use `shift_tracker_*` prefix for localStorage namespacing.
- Backend DB tables follow snake_case names (`user_shifts`, `stats_sessions`, `docs_files`).
- API payloads are JSON, usually with explicit `ok/error` envelope and `no-store` cache headers.

## Storage Key Constants (sample)
- `CACHED_USER_STORAGE_KEY` = `shift_tracker_cached_user_v1` (`scripts/auth.js`)
- `INSTALL_PROMPT_STATE_STORAGE_KEY` = `shift_tracker_install_prompt_state_v1` (`scripts/app.js`)
- `LEGACY_SETTINGS_STORAGE_KEY` = `shift_tracker_settings_v1` (`scripts/app.js`)
- `SALARY_PARAMS_STORAGE_KEY` = `shift_tracker_salary_params_v1` (`scripts/app.js`)
- `SESSION_STORAGE_KEY` = `shift_tracker_session_token` (`scripts/auth.js`)
- `SHIFTS_CACHE_STORAGE_KEY` = `shift_tracker_shifts_cache_v1` (`scripts/app.js`)
- `SHIFTS_META_STORAGE_KEY` = `shift_tracker_shifts_meta_v1` (`scripts/app.js`)
- `SHIFTS_PENDING_STORAGE_KEY` = `shift_tracker_shifts_pending_v1` (`scripts/app.js`)
- `STORAGE_KEY` = `shifts` (`scripts/app-constants.js`)
- `USER_STATS_CACHE_STORAGE_KEY` = `shift_tracker_user_stats_cache_v1` (`scripts/app.js`)
- `USER_STATS_SESSION_ID_STORAGE_KEY` = `shift_tracker_device_id_v1` (`scripts/app.js`)

## Practical Constraints for Agents
- Do not break script load order from `index.html`; many globals depend on declaration timing.
- Preserve compatibility with Telegram WebApp runtime and mobile webview behavior.
- Keep offline behavior stable: cache keys, service worker versioning, and pending queue contracts.
