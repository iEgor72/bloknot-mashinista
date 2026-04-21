# Agent Changelog

Append-only журнал действий ИИ-агентов по проекту.
Каждая запись должна отвечать на вопросы: что, как, когда и в каких файлах.

## 2026-04-17 14:12:42 +10:00

- Source: `init`
- Task: [memory-init] Bootstrap memory from existing project state
- Branch: `main`
- Commit: `b8217f44d0ba00f3ade3500624e792adcefe93c6` (refactor: split app.js into focused modules and remove dead code)
- Author: `iEgor72`
- Methods: `git log snapshot`, `repository structure scan`, `agent memory templates`
- Files: `ai-memory/PROJECT_STATE.md`, `ai-memory/RECENT_COMMITS.md`, `ai-memory/WORKTREE_STATUS.md`

## 2026-04-17 14:13:01 +10:00

- Source: `setup-check`
- Task: Проверка ручной записи памяти
- Branch: `main`
- Commit: `b8217f44d0ba00f3ade3500624e792adcefe93c6` (refactor: split app.js into focused modules and remove dead code)
- Author: `iEgor72`
- Methods: `manual log command`, `validation run`
- Files: `tools/agent-memory/log.js`, `ai-memory/CHANGELOG.md`

## 2026-04-17 14:33:21 +10:00

- Source: `memory-upgrade`
- Task: Полный скан проекта и расширение памяти агентов
- Branch: `main`
- Commit: `b8217f44d0ba00f3ade3500624e792adcefe93c6` (refactor: split app.js into focused modules and remove dead code)
- Author: `iEgor72`
- Methods: `repo-wide static scan`, `architecture extraction from index/functions`, `coding-style metrics`, `session preflight automation`
- Files: `tools/agent-memory/lib.js`, `tools/agent-memory/preflight.js`, `package.json`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `README.md`, `ai-memory/ARCHITECTURE.md`, `ai-memory/METHODS.md`, `ai-memory/ENGINEERING_STYLE.md`, `ai-memory/SESSION_PROTOCOL.md`, `ai-memory/START_HERE.md`, `ai-memory/INDEX.md`

## 2026-04-17 14:36:14 +10:00

- Source: `memory-autonomous-mode`
- Task: Перевод memory workflow в полностью автономный режим для агента
- Branch: `main`
- Commit: `b8217f44d0ba00f3ade3500624e792adcefe93c6` (refactor: split app.js into focused modules and remove dead code)
- Author: `iEgor72`
- Methods: `agent-instructions hardening`, `zero-manual-command protocol`
- Files: `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `README.md`, `ai-memory/START_HERE.md`, `ai-memory/SESSION_PROTOCOL.md`

## 2026-04-17 14:39:59 +10:00

- Source: `memory-watcher`
- Task: Добавлен фоновый watcher памяти и запущен daemon
- Branch: `main`
- Commit: `b8217f44d0ba00f3ade3500624e792adcefe93c6` (refactor: split app.js into focused modules and remove dead code)
- Author: `iEgor72`
- Methods: `fs.watch recursive daemon`, `debounced auto-refresh`, `autonomous changelog updates`
- Files: `tools/agent-memory/watch.js`, `package.json`, `.gitignore`, `README.md`, `tools/agent-memory/lib.js`, `ai-memory/SESSION_PROTOCOL.md`

## 2026-04-17 14:40:01 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `.git`

## 2026-04-17 14:40:17 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `.git`

## 2026-04-17 14:41:30 +10:00

- Source: `memory-watcher-fix`
- Task: Исправлен watcher: исключены служебные события .git
- Branch: `main`
- Commit: `b8217f44d0ba00f3ade3500624e792adcefe93c6` (refactor: split app.js into focused modules and remove dead code)
- Author: `iEgor72`
- Methods: `watch ignore filters hardening`, `daemon restart validation`
- Files: `tools/agent-memory/watch.js`, `ai-memory/CHANGELOG.md`

## 2026-04-17 14:43:35 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `package.json`, `tools/agent-memory`, `tools/agent-memory/autostart.ps1`

## 2026-04-17 14:43:57 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `README.md`, `tools/agent-memory/autostart.ps1`

## 2026-04-17 14:46:09 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `tools/agent-memory/autostart.ps1`

## 2026-04-17 14:46:29 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `tools/agent-memory/autostart.ps1`

## 2026-04-17 14:47:57 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `tools/agent-memory`, `tools/agent-memory/autostart.ps1`

## 2026-04-17 14:48:28 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `tools/agent-memory`, `tools/agent-memory/autostart.ps1`

## 2026-04-17 14:49:12 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `tools/agent-memory/autostart.ps1`

## 2026-04-17 14:49:38 +10:00

- Source: `codex-session`
- Task: Настроен автозапуск memory watcher с fallback через Startup
- Branch: `main`
- Commit: `b8217f44d0ba00f3ade3500624e792adcefe93c6` (refactor: split app.js into focused modules and remove dead code)
- Author: `iEgor72`
- Methods: `autostart.ps1`, `task scheduler fallback`, `startup launcher`
- Files: `tools/agent-memory/autostart.ps1`
- Notes: Task Scheduler denied access, поэтому автоматически используется Startup launcher без админ-прав.

## 2026-04-17 14:50:27 +10:00

- Source: `codex-session`
- Task: Доработан autostart: корректная обработка schtasks + fallback + документация
- Branch: `main`
- Commit: `b8217f44d0ba00f3ade3500624e792adcefe93c6` (refactor: split app.js into focused modules and remove dead code)
- Author: `iEgor72`
- Methods: `PowerShell native command handling`, `startup shortcut fallback`, `README update`
- Files: `tools/agent-memory/autostart.ps1`, `README.md`

## 2026-04-17 14:50:28 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `README.md`

## 2026-04-17 14:53:11 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `tools/agent-memory/autostart.ps1`

## 2026-04-17 14:53:24 +10:00

- Source: `codex-session`
- Task: Убраны всплывающие окна cmd при автозапуске watcher
- Branch: `main`
- Commit: `b8217f44d0ba00f3ade3500624e792adcefe93c6` (refactor: split app.js into focused modules and remove dead code)
- Author: `iEgor72`
- Methods: `замена Startup launcher: cmd -> vbs hidden run`
- Files: `tools/agent-memory/autostart.ps1`
- Notes: Причина: fallback через .cmd показывал консоль на старте Windows; теперь запуск скрытый через WScript.Shell.Run(...,0,false).

## 2026-04-17 15:00:40 +10:00

- Source: `codex-session`
- Task: Проведён аудит VPS и зафиксирован продакшн-деплой процесс
- Branch: `main`
- Commit: `b8217f44d0ba00f3ade3500624e792adcefe93c6` (refactor: split app.js into focused modules and remove dead code)
- Author: `iEgor72`
- Methods: `SSH audit`, `pm2/systemd/nginx inspection`, `deployment policy`
- Files: `ai-memory/AGENT_CONTEXT.md`
- Notes: Нужный проект: /opt/bloknot-mashinista (pm2+nginx, порт 3000, домен bloknot-mashinista-bot.ru). Второй проект: /opt/studio-bot (systemd studio-bot.service).

## 2026-04-17 15:02:43 +10:00

- Source: `codex-session`
- Task: Зафиксирована ответственность агента за push и деплой
- Branch: `main`
- Commit: `b8217f44d0ba00f3ade3500624e792adcefe93c6` (refactor: split app.js into focused modules and remove dead code)
- Author: `iEgor72`
- Methods: `AGENT_CONTEXT policy update`, `git push dry-run verification`
- Files: `ai-memory/AGENT_CONTEXT.md`
- Notes: Push выполняет Codex, после push выполняется деплой на VPS и smoke-check.

## 2026-04-17 15:05:35 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `assets`, `assets/docs`, `assets/docs/folders`, `assets/docs/memos`, `assets/docs/speeds`, `assets/fonts`, `assets/fonts/plus-jakarta-sans`, `assets/instructions`, `assets/pdfjs`, `functions`, `functions/api`, `functions/features`, `functions/features/auth`, `functions/features/docs`, `functions/features/shifts`, `functions/features/stats`, `scripts`, `scripts/utils`, `styles`

## 2026-04-17 15:06:05 +10:00

- Source: `codex-session`
- Task: Усилено ограничение: второй проект не трогать
- Branch: `main`
- Commit: `b8217f44d0ba00f3ade3500624e792adcefe93c6` (refactor: split app.js into focused modules and remove dead code)
- Author: `iEgor72`
- Methods: `AGENT_CONTEXT hard rule update`
- Files: `ai-memory/AGENT_CONTEXT.md`
- Notes: Запрещены любые действия с /opt/studio-bot без явной прямой команды пользователя.

## 2026-04-17 15:06:14 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `scripts/README.md`

## 2026-04-17 15:08:32 +10:00

- Source: `codex-session`
- Task: Исправлены всплывающие окна cmd от memory watcher
- Branch: `main`
- Commit: `b8217f44d0ba00f3ade3500624e792adcefe93c6` (refactor: split app.js into focused modules and remove dead code)
- Author: `iEgor72`
- Methods: `execSync windowsHide=true`, `watcher restart`
- Files: `tools/agent-memory/lib.js`
- Notes: Причина: git/command вызовы из фонового watcher на Windows выполнялись без windowsHide и могли показывать консоль.

## 2026-04-17 15:11:33 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `server.js`, `tools`

## 2026-04-17 15:12:19 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `server.js`

## 2026-04-17 15:12:46 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `server.js`

## 2026-04-17 15:13:07 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `server.js`

## 2026-04-17 15:13:20 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `README.md`

## 2026-04-17 15:13:35 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `package.json`

## 2026-04-17 15:13:50 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `tools`, `tools/orchestrator`, `tools/orchestrator/client.js`

## 2026-04-17 15:14:01 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `tools/orchestrator`, `tools/orchestrator/list-jobs.js`

## 2026-04-17 15:14:12 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `tools/orchestrator`, `tools/orchestrator/create-job.js`

## 2026-04-17 15:14:24 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `tools/orchestrator`, `tools/orchestrator/update-job.js`

## 2026-04-17 15:15:51 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `.tmp-offline-miss-check.js`, `apple-touch-icon.png`, `assets/docs/folders/Папка №2.pdf`, `assets/docs/folders/Папка №3.pdf`, `assets/docs/folders/Папка №4.pdf`, `assets/docs/folders/Папка №5.pdf`, `assets/docs/folders/Папка №6.pdf`, `assets/docs/folders/Папка №7.pdf`, `assets/docs/memos/БАМ кмс-пост-1.pdf`, `assets/docs/memos/ВСКГ- КСМ новый 2 пассажир.pdf`, `assets/docs/memos/КСМ-ВЛЧ 2.pdf`, `assets/docs/speeds/Скоростя БАМ Парк Д Приказ № 161.pdf`, `assets/docs/speeds/Скоростя ВЛЧ Приказ № 161.pdf`, `assets/docs/speeds/Скоростя ВСГ Парк Д Приказ № 161.pdf`, `assets/fonts/plus-jakarta-sans/plus-jakarta-sans-cyrillic-ext.woff2`, `assets/fonts/plus-jakarta-sans/plus-jakarta-sans-latin-ext.woff2`, `assets/fonts/plus-jakarta-sans/plus-jakarta-sans-latin.woff2`, `assets/fonts/plus-jakarta-sans/plus-jakarta-sans-vietnamese.woff2`, `bot_avatar.png`, `bot_avatar.svg`, `icon-192.png`, `icon-512.png`, `tools/agent-memory/init.js`, `tools/agent-memory/install-hooks.js`, `tools/agent-memory/log.js`, `tools/agent-memory/post-commit.js`, `tools/agent-memory/refresh.js`, `tools/agent-memory/sync-obsidian.js`

## 2026-04-17 15:16:19 +10:00

- Source: `post-commit`
- Task: feat: add agent memory workflow and telegram orchestrator queue
- Branch: `main`
- Commit: `bfede13f7c6a45af24647d8f633ceffb16b48a29` (feat: add agent memory workflow and telegram orchestrator queue)
- Author: `iEgor72`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `.agent-memory.local.example.json`, `.cursorrules`, `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `ai-memory/AGENT_CONTEXT.md`, `ai-memory/ARCHITECTURE.md`, `ai-memory/CHANGELOG.md`, `ai-memory/ENGINEERING_STYLE.md`, `ai-memory/INDEX.md`, `ai-memory/METHODS.md`, `ai-memory/PROJECT_STATE.md`, `ai-memory/RECENT_COMMITS.md`, `ai-memory/SESSION_PROTOCOL.md`, `ai-memory/START_HERE.md`, `ai-memory/WORKTREE_STATUS.md`, `ai-memory/sessions/2026-04-17.md`, `package.json`, `server.js`, `tools/agent-memory/autostart.ps1`, `tools/agent-memory/init.js`, `tools/agent-memory/install-hooks.js`, `tools/agent-memory/lib.js`, `tools/agent-memory/log.js`, `tools/agent-memory/post-commit.js`, `tools/agent-memory/preflight.js`, `tools/agent-memory/refresh.js`, `tools/agent-memory/sync-obsidian.js`, `tools/agent-memory/watch.js`, `tools/orchestrator/client.js`, `tools/orchestrator/create-job.js`, `tools/orchestrator/list-jobs.js`, `tools/orchestrator/update-job.js`

## 2026-04-17 15:18:25 +10:00

- Source: `codex-session`
- Task: Реализован MVP Telegram оркестратор и выкатка на VPS
- Branch: `main`
- Commit: `bfede13f7c6a45af24647d8f633ceffb16b48a29` (feat: add agent memory workflow and telegram orchestrator queue)
- Author: `iEgor72`
- Methods: `server.js queue API`, `Telegram admin commands`, `CLI tools`, `git push`, `VPS pull/reload/smoke`
- Files: `server.js`, `README.md`, `package.json`, `tools/orchestrator`
- Notes: Добавлены /task /jobs /job /cancel, API /api/orchestrator/jobs, секретный header x-orchestrator-key, деплой на /opt/bloknot-mashinista выполнен.

## 2026-04-17 15:18:45 +10:00

- Source: `post-commit`
- Task: chore: refresh ai-memory after orchestrator rollout
- Branch: `main`
- Commit: `35fe7f83a3f9d67571acc16702d5da667fe3b781` (chore: refresh ai-memory after orchestrator rollout)
- Author: `iEgor72`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `ai-memory/ARCHITECTURE.md`, `ai-memory/CHANGELOG.md`, `ai-memory/ENGINEERING_STYLE.md`, `ai-memory/INDEX.md`, `ai-memory/METHODS.md`, `ai-memory/PROJECT_STATE.md`, `ai-memory/RECENT_COMMITS.md`, `ai-memory/SESSION_PROTOCOL.md`, `ai-memory/WORKTREE_STATUS.md`, `ai-memory/sessions/2026-04-17.md`

## 2026-04-17 15:19:40 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `server.js`

## 2026-04-17 15:19:42 +10:00

- Source: `post-commit`
- Task: feat: add /myid telegram command for orchestrator access
- Branch: `main`
- Commit: `bde938ec1d7bdcbe7cc97712b326d426b2a09968` (feat: add /myid telegram command for orchestrator access)
- Author: `iEgor72`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `server.js`

## 2026-04-17 15:19:49 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `.agent-memory.local.example.json`, `index.html`, `scripts/app.js`, `styles/00-base.css`, `styles/10-navigation-and-cards.css`, `styles/15-bottom-nav.css`, `styles/16-press-feedback.css`, `styles/20-form-and-stats.css`, `styles/30-shifts-and-overlays.css`, `styles/40-premium-refresh.css`

## 2026-04-17 15:20:49 +10:00

- Source: `codex-session`
- Task: Включен heartbeat-воркер TG Orchestrator
- Branch: `main`
- Commit: `bde938ec1d7bdcbe7cc97712b326d426b2a09968` (feat: add /myid telegram command for orchestrator access)
- Author: `iEgor72`
- Methods: `automation heartbeat every 5 minutes`, `queue polling + deploy loop`
- Files: `ai-memory/AGENT_CONTEXT.md`
- Notes: Automation id: tg-orchestrator-worker. Обрабатывает queued задачи, выполняет commit/push/deploy и отправляет notify в Telegram.

## 2026-04-17 15:20:59 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `.agent-memory.local.json`

## 2026-04-17 15:24:32 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `scripts/docs-app.js`, `scripts/instructions-app.js`

## 2026-04-17 15:24:41 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `assets/docs/manifest.json`, `assets/instructions/catalog.v1.json`, `assets/instructions/catalog.v2.json`, `assets/instructions/sources.v2.json`, `assets/pdfjs/pdf.min.js`, `assets/pdfjs/pdf.worker.min.js`, `ecosystem.config.js`, `functions/api/auth.js`, `functions/api/docs.js`, `functions/api/shifts.js`, `functions/api/stats.js`, `functions/api/telegram-webhook.js`, `functions/features/auth/telegram-auth.js`, `functions/features/docs/store.js`, `functions/features/shifts/store.js`, `functions/features/shifts/validation.js`, `functions/features/stats/store.js`, `scripts/app-constants.js`, `scripts/app-init.js`, `scripts/auth.js`, `scripts/nav-debug.js`, `scripts/press-feedback.js`, `scripts/render.js`, `scripts/safe-area.js`, `scripts/shift-form.js`, `scripts/sw-register.js`, `scripts/time-utils.js`, `scripts/utils/haptics.js`, `scripts/viewport.js`, `styles/README.md`, `sw.js`, `wrangler.toml`

## 2026-04-17 15:28:16 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `assets/docs/manifest.json`, `index.html`, `scripts/docs-app.js`

## 2026-04-17 15:28:25 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `manifest.webmanifest`, `scripts/build-instructions-dataset.py`, `scripts/setup-bot-webhook.py`

## 2026-04-17 15:28:53 +10:00

- Source: `post-commit`
- Task: feat(docs): add instructions tab in documentation
- Branch: `main`
- Commit: `752515ebf9295d2252c23f924539cfc81fbea9d4` (feat(docs): add instructions tab in documentation)
- Author: `iEgor72`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `assets/docs/manifest.json`, `index.html`, `scripts/docs-app.js`

## 2026-04-17 15:30:23 +10:00

- Source: `manual`
- Task: Добавлена вкладка Инструкции в Документацию
- Branch: `main`
- Commit: `752515ebf9295d2252c23f924539cfc81fbea9d4` (feat(docs): add instructions tab in documentation)
- Author: `iEgor72`
- Methods: `docs sub-tab wiring`, `manifest-driven list`, `git push + vps pull + pm2 reload`
- Files: `index.html`, `scripts/docs-app.js`, `assets/docs/manifest.json`
- Notes: Добавлена кнопка и панель в docs UI, подключен список docsListInstructions, в manifest добавлена секция instructions; изменения задеплоены на VPS /opt/bloknot-mashinista.

## 2026-04-17 15:30:42 +10:00

- Source: `post-commit`
- Task: chore(memory): refresh ai-memory after docs update
- Branch: `main`
- Commit: `3411a8570e3c81aff3c0150dae167cf27b83ac77` (chore(memory): refresh ai-memory after docs update)
- Author: `iEgor72`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `ai-memory/ARCHITECTURE.md`, `ai-memory/CHANGELOG.md`, `ai-memory/ENGINEERING_STYLE.md`, `ai-memory/INDEX.md`, `ai-memory/METHODS.md`, `ai-memory/PROJECT_STATE.md`, `ai-memory/RECENT_COMMITS.md`, `ai-memory/SESSION_PROTOCOL.md`, `ai-memory/WORKTREE_STATUS.md`, `ai-memory/sessions/2026-04-17.md`

## 2026-04-17 15:35:58 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `server.js`

## 2026-04-17 15:36:07 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `AGENTS.md`, `CLAUDE.md`, `tools/agent-memory/preflight.js`

## 2026-04-17 15:36:25 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `server.js`

## 2026-04-17 15:36:36 +10:00

- Source: `post-commit`
- Task: feat(orchestrator): user-friendly telegram status messages
- Branch: `main`
- Commit: `e717be133742bbe91e36a1e83aaf2d52739d1f11` (feat(orchestrator): user-friendly telegram status messages)
- Author: `iEgor72`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `server.js`

## 2026-04-17 15:37:12 +10:00

- Source: `manual`
- Task: Сделаны user-friendly статусы оркестратора в Telegram
- Branch: `main`
- Commit: `e717be133742bbe91e36a1e83aaf2d52739d1f11` (feat(orchestrator): user-friendly telegram status messages)
- Author: `iEgor72`
- Methods: `status presentation mapper`, `message templating`
- Files: `server.js`
- Notes: Убран технический вывод queued/done/in_progress из сообщений бота; добавлены человеко-понятные статусы с эмодзи в /task, /jobs, /job, /cancel и notify-сообщениях.

## 2026-04-17 15:37:25 +10:00

- Source: `post-commit`
- Task: chore(memory): refresh ai-memory after orchestrator messaging update
- Branch: `main`
- Commit: `9fd749b4ab0046d33524f7847a8493cf49004689` (chore(memory): refresh ai-memory after orchestrator messaging update)
- Author: `iEgor72`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `ai-memory/ARCHITECTURE.md`, `ai-memory/CHANGELOG.md`, `ai-memory/ENGINEERING_STYLE.md`, `ai-memory/INDEX.md`, `ai-memory/METHODS.md`, `ai-memory/PROJECT_STATE.md`, `ai-memory/RECENT_COMMITS.md`, `ai-memory/SESSION_PROTOCOL.md`, `ai-memory/WORKTREE_STATUS.md`, `ai-memory/sessions/2026-04-17.md`

## 2026-04-17 15:38:08 +10:00

- Source: `post-commit`
- Task: chore(orchestrator): localize cancel note text
- Branch: `main`
- Commit: `d5c10d85def933bc77a7f3ba663d2d0540c221ea` (chore(orchestrator): localize cancel note text)
- Author: `iEgor72`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `server.js`

## 2026-04-17 15:38:10 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `server.js`

## 2026-04-17 15:39:22 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `.gitignore`

## 2026-04-17 16:10:56 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `assets`, `assets/docs`, `assets/docs/folders`, `assets/docs/memos`, `assets/docs/speeds`, `assets/fonts`, `assets/fonts/plus-jakarta-sans`, `assets/instructions`, `assets/pdfjs`, `functions`, `functions/api`, `functions/features`, `functions/features/auth`, `functions/features/docs`, `functions/features/shifts`, `functions/features/stats`, `scripts`, `scripts/utils`, `styles`, `tools/agent-memory`

## 2026-04-17 16:28:35 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `tools`, `tools/orchestrator`

## 2026-04-17 18:46:05 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `.gitignore`, `assets`, `assets/docs`, `assets/docs/folders`, `assets/docs/memos`, `assets/docs/speeds`, `assets/fonts`, `assets/fonts/plus-jakarta-sans`, `assets/instructions`, `assets/pdfjs`, `functions`, `functions/api`, `functions/features`, `functions/features/auth`, `functions/features/docs`, `functions/features/shifts`, `functions/features/stats`, `scripts`, `scripts/utils`, `styles`, `tools`, `tools/agent-memory`, `tools/orchestrator`

## 2026-04-17 19:05:42 +10:00

- Source: `file-watcher`
- Task: Auto-refresh memory after local file changes
- Branch: `main`
- Methods: `fs.watch recursive`, `debounced memory refresh`
- Files: `.cursorrules`, `.tmp-offline-miss-check.js`, `_redirects`, `apple-touch-icon.png`, `assets/docs/folders/Папка №2.pdf`, `assets/docs/folders/Папка №3.pdf`, `assets/docs/folders/Папка №4.pdf`, `assets/docs/folders/Папка №5.pdf`, `assets/docs/folders/Папка №6.pdf`, `assets/docs/folders/Папка №7.pdf`, `assets/docs/memos/БАМ кмс-пост-1.pdf`, `assets/docs/memos/ВСКГ- КСМ новый 2 пассажир.pdf`, `assets/docs/memos/КСМ-ВЛЧ 2.pdf`, `assets/docs/speeds/Скоростя БАМ Парк Д Приказ № 161.pdf`, `assets/docs/speeds/Скоростя ВЛЧ Приказ № 161.pdf`, `assets/docs/speeds/Скоростя ВСГ Парк Д Приказ № 161.pdf`, `assets/fonts/plus-jakarta-sans/plus-jakarta-sans-cyrillic-ext.woff2`, `assets/fonts/plus-jakarta-sans/plus-jakarta-sans-latin-ext.woff2`, `assets/fonts/plus-jakarta-sans/plus-jakarta-sans-latin.woff2`, `assets/fonts/plus-jakarta-sans/plus-jakarta-sans-vietnamese.woff2`, `bot_avatar.png`, `bot_avatar.svg`, `icon-192.png`, `icon-512.png`, `tmp_order250.html`, `tmp_sudact_250.html`, `tmp_sudact_i.html`, `tmp_sudact_rules_root.html`, `tools/agent-memory/autostart.ps1`

## 2026-04-17 19:10:38 +10:00

- Source: `post-commit`
- Task: chore: remove background memory watcher and orchestrator MVP
- Branch: `main`
- Commit: `e2e784100b82c71336fe508481efcf68ac08f204` (chore: remove background memory watcher and orchestrator MVP)
- Author: `iEgor72`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `README.md`, `ai-memory/SESSION_PROTOCOL.md`, `package.json`, `server.js`, `tools/agent-memory/autostart.ps1`, `tools/agent-memory/lib.js`, `tools/agent-memory/watch.js`, `tools/orchestrator/client.js`, `tools/orchestrator/create-job.js`, `tools/orchestrator/list-jobs.js`, `tools/orchestrator/update-job.js`

## 2026-04-17 19:11:32 +10:00

- Source: `post-commit`
- Task: chore(memory): refresh ai-memory after orchestrator removal
- Branch: `main`
- Commit: `650f1e04282ca61ba158015b6651e05f8c24a3fe` (chore(memory): refresh ai-memory after orchestrator removal)
- Author: `iEgor72`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `ai-memory/ARCHITECTURE.md`, `ai-memory/CHANGELOG.md`, `ai-memory/ENGINEERING_STYLE.md`, `ai-memory/INDEX.md`, `ai-memory/METHODS.md`, `ai-memory/PROJECT_STATE.md`, `ai-memory/RECENT_COMMITS.md`, `ai-memory/SESSION_PROTOCOL.md`, `ai-memory/WORKTREE_STATUS.md`, `ai-memory/sessions/2026-04-17.md`

## 2026-04-17 19:21:42 +10:00

- Source: `post-commit`
- Task: feat(master-bot): scaffold chat-first hub with coder task queue
- Branch: `main`
- Commit: `40c0218dc86c03877162a4da98bc456c819481a7` (feat(master-bot): scaffold chat-first hub with coder task queue)
- Author: `iEgor72`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `README.md`, `services/master-bot-hub/.env.example`, `services/master-bot-hub/.gitignore`, `services/master-bot-hub/README.md`, `services/master-bot-hub/config/projects.json`, `services/master-bot-hub/ecosystem.config.cjs`, `services/master-bot-hub/package.json`, `services/master-bot-hub/src/config.js`, `services/master-bot-hub/src/master.js`, `services/master-bot-hub/src/openai.js`, `services/master-bot-hub/src/projects.js`, `services/master-bot-hub/src/server.js`, `services/master-bot-hub/src/storage.js`, `services/master-bot-hub/src/telegram.js`, `services/master-bot-hub/src/worker.js`

## 2026-04-17 19:22:33 +10:00

- Source: `post-commit`
- Task: chore(master-bot): set VPS project path in registry
- Branch: `main`
- Commit: `6841902e6fcdfbe5a3b70cdf063e494158f91eb8` (chore(master-bot): set VPS project path in registry)
- Author: `iEgor72`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `services/master-bot-hub/config/projects.json`

## 2026-04-17 19:51:48 +10:00

- Source: `post-commit`
- Task: chore: remove master-bot-hub traces after cancellation
- Branch: `main`
- Commit: `72d555a083e5dfbcec759d455a5f3f32194e75c0` (chore: remove master-bot-hub traces after cancellation)
- Author: `iEgor72`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `README.md`, `services/master-bot-hub/.env.example`, `services/master-bot-hub/.gitignore`, `services/master-bot-hub/README.md`, `services/master-bot-hub/config/projects.json`, `services/master-bot-hub/ecosystem.config.cjs`, `services/master-bot-hub/package.json`, `services/master-bot-hub/src/config.js`, `services/master-bot-hub/src/master.js`, `services/master-bot-hub/src/openai.js`, `services/master-bot-hub/src/projects.js`, `services/master-bot-hub/src/server.js`, `services/master-bot-hub/src/storage.js`, `services/master-bot-hub/src/telegram.js`, `services/master-bot-hub/src/worker.js`

## 2026-04-17 23:08:34 +1000

- Source: `manual`
- Task: Настроен Python-first project memory workflow и VPS deploy rules
- Branch: `main`
- Methods: `AGENTS.md update`, `tools/agent_memory.py`, `memory docs`, `read-only VPS audit`
- Files: `AGENTS.md`, `package.json`, `README.md`, `tools/agent_memory.py`, `tools/agent-memory/lib.js`, `tools/agent-memory/preflight.js`, `ai-memory/START_HERE.md`, `ai-memory/PROJECT_STATE.md`, `ai-memory/ARCHITECTURE.md`, `ai-memory/METHODS.md`, `ai-memory/ENGINEERING_STYLE.md`, `ai-memory/AGENT_CONTEXT.md`, `ai-memory/SESSION_PROTOCOL.md`
- Notes: Why: Привести workflow к правилу сначала память, потом работа и зафиксировать production доступ | Risks: Production использует PM2, project-specific systemd service не найден; на VPS есть untracked package-lock.json | Check: python tools/agent_memory.py preflight, refresh, sync

## 2026-04-17 23:12:42 +1000

- Source: `manual`
- Task: Удалён лишний Node memory engine после перехода на Python CLI
- Branch: `main`
- Methods: `перенос init/install-hooks/post-commit в tools/agent_memory.py`, `удаление tools/agent-memory`
- Files: `tools/agent_memory.py`, `package.json`, `README.md`, `ai-memory/ARCHITECTURE.md`, `tools/agent-memory`
- Notes: Why: Оставить один источник правил project memory и не держать два конкурирующих механизма | Risks: post-commit hook теперь зависит от python в git hook environment | Check: python tools/agent_memory.py preflight, install-hooks, refresh, npm run memory:preflight

## 2026-04-18 07:41:55 +1000

- Source: `manual`
- Task: Переименована вкладка документации memos в Памятки
- Branch: `main`
- Methods: `точечная правка текста кнопки data-docs-tab=memos без изменения manifest и логики загрузки`
- Files: `index.html`

## 2026-04-18 07:45:43 +1000

- Source: `manual`
- Task: Добавлен PDF с проверками тормозного оборудования в Памятки
- Branch: `main`
- Methods: `Copy-Item в assets/docs/memos и manifest entry в assets/docs/manifest.json`
- Files: `assets/docs/memos/Проверки торм оборудования.pdf`, `assets/docs/manifest.json`

## 2026-04-18 07:48:05 +1000

- Source: `manual`
- Task: Добавлен DOCX 2580p во вкладку Инструкции
- Branch: `main`
- Methods: `создан assets/docs/instructions`, `файл скопирован из загрузок`, `добавлена manifest entry в instructions`
- Files: `assets/docs/instructions/2580p.docx`, `assets/docs/manifest.json`

## 2026-04-18 07:53:43 +1000

- Source: `manual`
- Task: Добавлен встроенный DOCX preview для документов
- Branch: `main`
- Methods: `локальный JSZip asset`, `OOXML document.xml renderer в docs-app.js`, `стили DOCX`, `DOCX MIME в server.js`, `SW cache v25`, `Playwright smoke`
- Files: `scripts/docs-app.js`, `styles/30-shifts-and-overlays.css`, `styles/00-base.css`, `server.js`, `sw.js`, `assets/docs/vendor/jszip.min.js`

## 2026-04-18 07:54:24 +1000

- Source: `post-commit`
- Task: feat(docs): add memos and docx preview
- Branch: `main`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `ai-memory/CHANGELOG.md`, `ai-memory/INDEX.md`, `ai-memory/PROJECT_STATE.md`, `ai-memory/RECENT_COMMITS.md`, `ai-memory/WORKTREE_STATUS.md`, `ai-memory/sessions/2026-04-18.md`, `assets/docs/instructions/2580p.docx`, `assets/docs/manifest.json`, `assets/docs/memos/Проверки торм оборудования.pdf`, `assets/docs/vendor/jszip.min.js`, `index.html`, `scripts/docs-app.js`, `server.js`, `styles/00-base.css`, `styles/30-shifts-and-overlays.css`, `sw.js`
- Notes: Commit: `88df275d660896ce8e69efefa04ce3e80fdf2f6b` (`88df275`) | Author: `iEgor72`

## 2026-04-18 07:56:12 +1000

- Source: `manual`
- Task: Выкатка документации и DOCX preview в продакшн
- Branch: `main`
- Methods: `git push origin main`, `VPS git pull --ff-only`, `pm2 reload bloknot-mashinista`, `production HTTP and Playwright smoke`
- Files: `assets/docs/manifest.json`, `scripts/docs-app.js`, `server.js`, `sw.js`, `styles/30-shifts-and-overlays.css`

## 2026-04-18 08:58:51 +1000

- Source: `manual`
- Task: Разделены вкладки Режимки и Памятки
- Branch: `main`
- Methods: `memos оставлен для режимок`, `reminders добавлен для памяток`, `PDF проверок перенесен в assets/docs/reminders`, `добавлены отдельная кнопка и панель`, `SW cache v26`
- Files: `index.html`, `scripts/docs-app.js`, `assets/docs/manifest.json`, `assets/docs/reminders/Проверки торм оборудования.pdf`, `sw.js`, `styles/10-navigation-and-cards.css`, `styles/00-base.css`

## 2026-04-18 08:59:08 +1000

- Source: `post-commit`
- Task: fix(docs): split memos and reminders tabs
- Branch: `main`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `ai-memory/CHANGELOG.md`, `ai-memory/INDEX.md`, `ai-memory/PROJECT_STATE.md`, `ai-memory/RECENT_COMMITS.md`, `ai-memory/WORKTREE_STATUS.md`, `ai-memory/sessions/2026-04-18.md`, `assets/docs/manifest.json`, `assets/docs/reminders/Проверки торм оборудования.pdf`, `index.html`, `scripts/docs-app.js`, `styles/00-base.css`, `styles/10-navigation-and-cards.css`, `sw.js`
- Notes: Commit: `cd882e5a8fc985fc1bdbc20ef12cd94385b25cbf` (`cd882e5`) | Author: `iEgor72`

## 2026-04-18 09:00:17 +1000

- Source: `manual`
- Task: Выкатка исправления: отдельные Режимки и Памятки
- Branch: `main`
- Methods: `git push origin main`, `VPS git pull --ff-only`, `pm2 reload bloknot-mashinista`, `production manifest and Playwright smoke`
- Files: `index.html`, `scripts/docs-app.js`, `assets/docs/manifest.json`, `assets/docs/reminders/Проверки торм оборудования.pdf`, `sw.js`

## 2026-04-18 17:16:07 +1000

- Source: `manual`
- Task: Добавлен DOCX zoom как в PDF просмотрщике
- Branch: `main`
- Methods: `DOCX viewer state`, `double tap 1x/2x`, `pinch-to-zoom`, `fixed base page dimensions during transform`, `Playwright mobile smoke`
- Files: `scripts/docs-app.js`, `styles/30-shifts-and-overlays.css`, `sw.js`

## 2026-04-18 17:19:13 +1000

- Source: `manual`
- Task: Проверен scroll DOCX zoom по осям X и Y
- Branch: `main`
- Methods: `Playwright mobile + CDP touch events`, `проверены overflow`, `scrollLeft/scrollTop`, `vertical and horizontal touch pan at 2x`
- Files: `scripts/docs-app.js`, `styles/30-shifts-and-overlays.css`

## 2026-04-18 17:20:52 +1000

- Source: `post-commit`
- Task: feat(docs): add docx zoom gestures
- Branch: `main`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `scripts/docs-app.js`, `styles/30-shifts-and-overlays.css`, `sw.js`
- Notes: Commit: `b6d82acebdd8f8aee27bacd627c42e79a89159b0` (`b6d82ac`) | Author: `iEgor72`

## 2026-04-18 17:23:58 +1000

- Source: `manual`
- Task: Выкатка DOCX zoom gestures в продакшн
- Branch: `main`
- Methods: `git push origin main`, `VPS git pull --ff-only`, `pm2 reload bloknot-mashinista`, `production asset checks`, `Playwright production DOCX zoom and X/Y pan smoke`
- Files: `scripts/docs-app.js`, `styles/30-shifts-and-overlays.css`, `sw.js`

## 2026-04-18 17:34:30 +1000

- Source: `manual`
- Task: Разобраны остатки после деплоя
- Branch: `main`
- Methods: `local git diff review`, `VPS package-lock inspection`, `determined memory-only local changes and empty untracked production package-lock`
- Files: `ai-memory/CHANGELOG.md`, `ai-memory/PROJECT_STATE.md`, `package-lock.json`

## 2026-04-18 17:38:07 +1000

- Source: `manual`
- Task: Удалён пустой package-lock.json на VPS
- Branch: `main`
- Methods: `exact-path rm under /opt/bloknot-mashinista after prior inspection`, `verified production git status clean`
- Files: `package-lock.json`

## 2026-04-19 13:59:58 +0000

- Source: `manual`
- Task: Добавил промо-картинку в приветственное сообщение Telegram-бота
- Branch: `main`
- Methods: `сохранил изображение в assets`, `перевел /start welcome на sendPhoto с публичным URL и fallback на sendMessage`
- Files: `server.js`, `assets/welcome-promo.jpg`

## 2026-04-19 14:02:53 +0000

- Source: `manual`
- Task: Вернул полный текст в welcome caption Telegram-бота и подчистил формулировки
- Branch: `main`
- Methods: `обновил caption в server.js для sendPhoto`, `сохранив image-first welcome и inline-кнопки`
- Files: `server.js`

## 2026-04-19 14:08:05 +0000

- Source: `manual`
- Task: Исправил Telegram webhook route и синхронизировал резервный webhook-обработчик с новым welcome
- Branch: `main`
- Methods: `проверил и заново установил webhook на bloknot-mashinista-bot.ru/api/telegram-webhook`, `обновил functions/api/telegram-webhook.js под sendPhoto и полный caption`
- Files: `functions/api/telegram-webhook.js`, `scripts/setup-bot-webhook.py`

## 2026-04-19 14:09:34 +0000

- Source: `manual`
- Task: Обновил welcome caption на более продающий текст под промо-изображение
- Branch: `main`
- Methods: `заменил старый информативный caption на более короткий marketing-style текст в server.js и functions/api/telegram-webhook.js`
- Files: `server.js`, `functions/api/telegram-webhook.js`

## 2026-04-19 14:12:10 +0000

- Source: `manual`
- Task: Поставил финальный полный welcome caption для Telegram-бота
- Branch: `main`
- Methods: `обновил caption в server.js и functions/api/telegram-webhook.js`, `вернул lock-строку про Telegram-аккаунт и финальный CTA`
- Files: `server.js`, `functions/api/telegram-webhook.js`

## 2026-04-19 15:33:46 +0000

- Source: `manual`
- Task: security hardening: lock shifts/stats API to authenticated users and redact git remote creds in memory
- Branch: `main`
- Methods: `removed sid query fallback in active VPS server`, `required bearer-backed telegram user for shifts/stats`, `restricted CORS to known app/dev origins`, `sanitized agent memory remote output`, `reset origin URL to tokenless https remote`
- Files: `server.js`, `tools/agent_memory.py`, `ai-memory/PROJECT_STATE.md`, `ai-memory/WORKTREE_STATUS.md`, `ai-memory/CHANGELOG.md`

## 2026-04-19 15:34:47 +0000

- Source: `manual`
- Task: security hardening: add optional Telegram webhook secret support
- Branch: `main`
- Methods: `active server now verifies X-Telegram-Bot-Api-Secret-Token when TELEGRAM_WEBHOOK_SECRET is configured`, `webhook setup script now forwards secret_token during Telegram setWebhook`
- Files: `server.js`, `scripts/setup-bot-webhook.py`, `ai-memory/CHANGELOG.md`

## 2026-04-19 15:39:21 +0000

- Source: `manual`
- Task: security hardening: restrict public static file exposure and reduce error/cors disclosure
- Branch: `main`
- Methods: `limited VPS static serving to public app assets only`, `added nosniff/referrer-policy headers`, `guarded malformed URL decode`, `removed stack traces from legacy API 500 responses`, `removed wildcard cors from docs download proxy`
- Files: `server.js`, `functions/api/auth.js`, `functions/api/shifts.js`, `functions/api/stats.js`, `functions/api/docs.js`, `ai-memory/CHANGELOG.md`

## 2026-04-19 15:43:36 +0000

- Source: `manual`
- Task: security hardening: escape shift ids in HTML attributes and selectors
- Branch: `main`
- Methods: `escaped shift ids before inserting into data-* attributes in render/time utils and added selector escaping for runtime querySelector lookups to prevent attribute/selector injection from crafted ids`
- Files: `scripts/render.js`, `scripts/time-utils.js`, `ai-memory/CHANGELOG.md`

## 2026-04-19 21:10:18 +0000

- Source: `manual`
- Task: reverted the full PRO gate UI experiment chain after discovering the perceived glow difference was just the timer start button visible behind the gate
- Branch: `main`
- Methods: `reverted commits 9171fb7`, `a63c814`, `663d48f`, `5d4dbe4`, `d52306f`, `pushed rollback`, `reloaded PM2`, `restored original behavior`
- Files: `index.html`, `scripts/app.js`, `scripts/shift-form.js`, `styles/10-navigation-and-cards.css`, `styles/35-timer.css`, `ai-memory/CHANGELOG.md`

## 2026-04-20 00:06:59 +0000

- Source: `manual`
- Task: show train weight in shift cards technical line
- Branch: `main`
- Methods: `added train_weight rendering to getShiftTechnicalItems so weight is displayed alongside train number/length/axles in card technical metadata`
- Files: `scripts/time-utils.js`, `ai-memory/CHANGELOG.md`

## 2026-04-20 07:08:54 +0000

- Source: `manual`
- Task: increased top padding in shift notes textarea
- Branch: `main`
- Methods: `adjusted optional-textarea top/bottom padding so the note label/content no longer sits too close to the upper edge`
- Files: `styles/20-form-and-stats.css`, `ai-memory/CHANGELOG.md`

## 2026-04-20 07:12:35 +0000

- Source: `manual`
- Task: increased spacing between notes label and note text
- Branch: `main`
- Methods: `raised notes textarea top padding again and added a larger gap inside the notes field container so content sits lower and breathes more under the label`
- Files: `styles/20-form-and-stats.css`, `ai-memory/CHANGELOG.md`

## 2026-04-20 07:15:10 +0000

- Source: `manual`
- Task: moved notes section content lower inside the optional card
- Branch: `main`
- Methods: `added top padding on optionalNotesCard body and slightly normalized textarea/field spacing so the notes field block no longer hugs the top divider`
- Files: `styles/20-form-and-stats.css`, `ai-memory/CHANGELOG.md`

## 2026-04-20 07:19:16 +0000

- Source: `manual`
- Task: polished notes textarea to look like a proper in-app note field
- Branch: `main`
- Methods: `switched notes textarea from bottom-border input styling to a bordered card-like field with rounded corners`, `balanced padding`, `and a softer focus state aligned with existing app tokens`
- Files: `styles/20-form-and-stats.css`, `ai-memory/CHANGELOG.md`

## 2026-04-20 21:22:51 +0000

- Source: `manual`
- Task: removed timer from live navigation, restored shifts button, disabled PRO mode behind flags
- Branch: `main`
- Methods: `reordered bottom navigation to home/shifts/add/salary/docs`, `routed shifts nav back to the existing bottom-sheet overlay`, `disabled stopwatch routing with a feature flag fallback`, `and turned off PRO gating via explicit flags without deleting the old restoration path`
- Files: `index.html`, `scripts/app.js`, `scripts/auth.js`, `scripts/shift-form.js`, `ai-memory/CHANGELOG.md`

## 2026-04-20 21:27:24 +0000

- Source: `manual`
- Task: removed timer feature from app shell and runtime references
- Branch: `main`
- Methods: `deleted timer tab markup`, `removed timer script includes and JS hooks`, `stripped timer-specific CSS`, `and replaced old stopwatch files with harmless stubs so stale caches do not crash`
- Files: `index.html`, `scripts/app.js`, `scripts/auth.js`, `scripts/shift-form.js`, `scripts/stopwatch-engine.js`, `scripts/stopwatch-app.js`, `styles/35-timer.css`, `ai-memory/CHANGELOG.md`

## 2026-04-20 21:31:24 +0000

- Source: `manual`
- Task: restored shifts as a full tab page instead of overlay
- Branch: `main`
- Methods: `moved the shifts journal markup from the overlay layer back into a normal tab panel`, `removed shifts overlay triggers/close button wiring`, `and updated navigation/edit return flow so the shifts screen behaves like a regular page again`
- Files: `index.html`, `scripts/shift-form.js`, `ai-memory/CHANGELOG.md`

## 2026-04-20 22:04:11 +0000

- Source: `manual`
- Task: fixed overflow risk in compact monthly summary cards
- Branch: `main`
- Methods: `reduced quick summary number width pressure by using responsive font sizing`, `tighter letter-spacing`, `and a narrow-screen override for the three-card month summary row so long values like holiday/night hours fit on small phones`
- Files: `styles/10-navigation-and-cards.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 02:23:33 +0000

- Source: `manual`
- Task: added Folder №8 as image-backed doc entry
- Branch: `main`
- Methods: `copied the supplied JPEG into assets/docs/folders`, `added a new folders manifest entry with image/jpeg metadata`, `and reused the existing docs viewer image path so the file opens through the same in-app viewer flow as other documents`
- Files: `assets/docs/folders/Папка №8.jpg`, `assets/docs/manifest.json`, `ai-memory/CHANGELOG.md`

## 2026-04-21 02:28:31 +0000

- Source: `manual`
- Task: added in-viewer zoom gestures for image documents
- Branch: `main`
- Methods: `implemented a dedicated image viewer state in docs-app with pinch-to-zoom`, `double-tap zoom`, `pan-friendly scaled layout`, `cleanup hooks`, `and image-specific scroll wrappers so JPEG folder docs behave like PDF viewing inside the same viewer`
- Files: `scripts/docs-app.js`, `styles/30-shifts-and-overlays.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 02:33:08 +0000

- Source: `manual`
- Task: reduced intermittent first-open failures for docs assets
- Branch: `main`
- Methods: `found that the service worker used a 1.2s timeout for all static assets`, `which could fail first-time doc loads before any cache existed`, `introduced a longer 8s timeout specifically for /assets/docs/* requests and bumped the SW cache version so clients pick up the fix`
- Files: `sw.js`, `ai-memory/CHANGELOG.md`

## 2026-04-21 02:39:08 +0000

- Source: `manual`
- Task: added docs viewer auto-retry and clearer loading state
- Branch: `main`
- Methods: `implemented one automatic retry for PDF`, `DOCX`, `and image opens on retryable network-like failures`, `and replaced the plain loading spinner with a clearer loading block and animated progress bar so users see that the app is actively trying again`
- Files: `scripts/docs-app.js`, `styles/30-shifts-and-overlays.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 03:46:31 +0000

- Source: `manual`
- Task: disabled iPhone text selection on bottom navigation
- Branch: `main`
- Methods: `added user-select:none and -webkit-touch-callout:none to the bottom nav container`, `nav buttons`, `labels`, `icons`, `and fab controls so long-press on iOS no longer highlights nav text`
- Files: `styles/15-bottom-nav.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 08:52:16 +0000

- Source: `manual`
- Task: added public SEO landing pages without moving the PWA root
- Branch: `main`
- Methods: `kept the existing root-based app install flow intact`, `added three public slug routes served by server.js`, `created standalone HTML landing pages with titles/meta/og/schema`, `and exposed robots.txt plus sitemap.xml for indexing`
- Files: `server.js`, `docs/seo/seo.css`, `docs/seo/uchet-marshrutov.html`, `docs/seo/zarplata-mashinista.html`, `docs/seo/zhurnal-smen-mashinista.html`, `ai-memory/CHANGELOG.md`

## 2026-04-21 08:58:06 +0000

- Source: `manual`
- Task: excluded public SEO pages from PWA app-shell fallback
- Branch: `main`
- Methods: `found that the service worker treated all navigation requests as app-shell routes and served cached index.html immediately`, `added explicit bypass rules for the SEO slugs`, `robots.txt`, `and sitemap.xml`, `limited fallback caching to real shell paths only`, `and bumped the SW cache version`
- Files: `sw.js`, `ai-memory/CHANGELOG.md`

## 2026-04-21 09:05:19 +0000

- Source: `manual`
- Task: redesigned SEO landing pages with richer visuals and less dry copy
- Branch: `main`
- Methods: `rewrote the three public landing pages with more natural product copy`, `added hero media using the existing welcome-promo asset`, `introduced icon cards`, `stat blocks`, `and stronger section layouts via a refreshed shared SEO stylesheet`
- Files: `docs/seo/seo.css`, `docs/seo/uchet-marshrutov.html`, `docs/seo/zarplata-mashinista.html`, `docs/seo/zhurnal-smen-mashinista.html`, `ai-memory/CHANGELOG.md`

## 2026-04-21 09:08:25 +0000

- Source: `manual`
- Task: replaced outdated landing promo art that still implied the removed timer
- Branch: `main`
- Methods: `copied the new supplied screenshot into assets/seo and switched all SEO landing hero/og image references away from welcome-promo.jpg so public pages no longer show visuals tied to the removed timer era`
- Files: `assets/seo/landing-salary-screen.jpg`, `docs/seo/uchet-marshrutov.html`, `docs/seo/zarplata-mashinista.html`, `docs/seo/zhurnal-smen-mashinista.html`, `ai-memory/CHANGELOG.md`

## 2026-04-21 09:10:07 +0000

- Source: `manual`
- Task: assigned different hero images to SEO pages
- Branch: `main`
- Methods: `copied the second supplied promo image into assets/seo as a general overview shot`, `kept the salary-focused screen on the salary landing`, `and switched the routes for route-tracking and shift-journal pages to use the broader overview image for better semantic match`
- Files: `assets/seo/landing-overview.jpg`, `docs/seo/uchet-marshrutov.html`, `docs/seo/zhurnal-smen-mashinista.html`, `ai-memory/CHANGELOG.md`

## 2026-04-21 09:11:41 +0000

- Source: `manual`
- Task: stopped SEO hero screenshots from being cropped
- Branch: `main`
- Methods: `replaced the hero image cover behavior with a contained centered media frame`, `added a stable minimum hero height`, `and kept screenshots fully visible inside the card instead of trimming their edges`
- Files: `docs/seo/seo.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 09:18:29 +0000

- Source: `manual`
- Task: added Google Search Console verification file to site root
- Branch: `main`
- Methods: `created the required google-site-verification HTML file at the repo root and added its filename to the server root static allowlist so the VPS runtime serves it directly for domain ownership verification`
- Files: `googled7576eb3c69566bc.html`, `server.js`, `ai-memory/CHANGELOG.md`

## 2026-04-21 09:26:29 +0000

- Source: `manual`
- Task: added Yandex Webmaster verification file to site root
- Branch: `main`
- Methods: `created the required Yandex HTML verification file at the repo root and extended the server root static allowlist so the VPS runtime serves it directly for ownership confirmation`
- Files: `yandex_de378ce11c15bc59.html`, `server.js`, `ai-memory/CHANGELOG.md`

## 2026-04-21 09:44:30 +0000

- Source: `manual`
- Task: expanded SEO cluster with salary calculator page and sharper page intent separation
- Branch: `main`
- Methods: `added a new public landing page for kalkulyator-zarplaty-mashinista`, `registered it in server routing and sitemap generation`, `and tightened the existing route`, `salary`, `and shift-journal pages so each one targets a more distinct search intent with better internal linking`
- Files: `server.js`, `docs/seo/kalkulyator-zarplaty-mashinista.html`, `docs/seo/uchet-marshrutov.html`, `docs/seo/zarplata-mashinista.html`, `docs/seo/zhurnal-smen-mashinista.html`, `ai-memory/CHANGELOG.md`

## 2026-04-21 09:47:24 +0000

- Source: `manual`
- Task: added shift schedule landing page to the SEO cluster
- Branch: `main`
- Methods: `created a new public page for grafik-smen-mashinista focused on schedule/calendar intent`, `wired it into server.js route serving and sitemap generation`, `and linked it into the growing SEO page cluster`
- Files: `server.js`, `docs/seo/grafik-smen-mashinista.html`, `ai-memory/CHANGELOG.md`

## 2026-04-21 09:50:15 +0000

- Source: `manual`
- Task: added broad app-intent landing page to the SEO cluster
- Branch: `main`
- Methods: `created a new public page for prilozhenie-dlya-mashinista aimed at broad commercial/app queries`, `wired it into server routing and sitemap generation`, `and linked it into the existing SEO landing cluster`
- Files: `server.js`, `docs/seo/prilozhenie-dlya-mashinista.html`, `ai-memory/CHANGELOG.md`

## 2026-04-21 09:52:36 +0000

- Source: `manual`
- Task: fixed cramped spacing in SEO stat cards on narrow layouts
- Branch: `main`
- Methods: `reworked the quick-stats grid to use adaptive auto-fit/minmax columns`, `increased stat card padding slightly`, `and hardened heading/text wrapping so cards no longer collapse into overly narrow text columns on intermediate screen widths`
- Files: `docs/seo/seo.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 10:29:00 +0000

- Source: `manual`
- Task: added local-first work schedule calendar MVP
- Branch: `main`
- Methods: `added a home calendar that merges manual trips`, `fact shifts`, `and optional shift-cycle periods`, `stored periods and per-day overrides in user-scoped localStorage so the feature works offline without touching the current shifts sync contract`, `added planner and day-detail bottom sheets for creating periods`, `tapping D/N/V patterns`, `and jumping straight into adding or editing a shift from the calendar`, `bumped the service worker cache version so the new app shell reaches installed PWA users`
- Files: `index.html`, `scripts/app.js`, `scripts/auth.js`, `scripts/render.js`, `scripts/shift-form.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `ai-memory/CHANGELOG.md`

## 2026-04-21 10:37:31 +0000

- Source: `manual`
- Task: refined schedule calendar readability and guarded schedule period input
- Branch: `main`
- Methods: `simplified calendar visual language so day states are easier to scan`, `switched night highlighting to the app's existing accent color`, `rewrote the schedule planner copy into a clearer step-by-step flow`, `formatted period ranges more humanly`, `and blocked overlapping schedule periods to avoid confusing calendar bugs`
- Files: `index.html`, `scripts/app.js`, `scripts/render.js`, `scripts/shift-form.js`, `styles/10-navigation-and-cards.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 10:45:02 +0000

- Source: `manual`
- Task: simplified schedule planner to graph-only and compacted calendar UI
- Branch: `main`
- Methods: `removed the manual trip mode from schedule settings so calendar planning only configures cyclic work graphs while trips still use the existing add flow`, `made the calendar cells smaller and closer to a normal month grid`, `separated fact and night colors so fact markers no longer collide visually with planned night shifts`, `moved the end-date helper note below the date row to stop the schedule form fields from jumping vertically`
- Files: `index.html`, `scripts/app.js`, `scripts/render.js`, `scripts/shift-form.js`, `styles/10-navigation-and-cards.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 10:49:07 +0000

- Source: `manual`
- Task: clarified upcoming schedule copy for trips and shifts
- Branch: `main`
- Methods: `removed the confusing 'without fixed time' wording from upcoming work cards`, `changed trip entries to show short factual trip details like route or recorded time span`, `and changed shift entries to show a direct arrival/end summary so the card answers what happens on that day more plainly`
- Files: `scripts/render.js`, `ai-memory/CHANGELOG.md`

## 2026-04-21 10:59:21 +0000

- Source: `manual`
- Task: unified schedule day preview and fixed bottom-sheet action buttons
- Branch: `main`
- Methods: `restyled sheet action rows into a balanced primary-secondary button pair so the close button no longer looks cramped beside save`, `and rewrote upcoming day preview cards to use one shared preview format that surfaces route or time data first across trips`, `depot shifts`, `and planned graph days instead of relying on inconsistent type labels`
- Files: `scripts/render.js`, `styles/10-navigation-and-cards.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 11:06:52 +0000

- Source: `manual`
- Task: reused app button pattern and made day card show useful summary
- Branch: `main`
- Methods: `replaced custom schedule sheet action buttons with the same form-actions plus btn-primary/btn-secondary pattern already used in shift editing`, `and changed the day card to show arrival-end time`, `duration`, `and income as the main metrics while keeping a short note about whether it is fact or graph`
- Files: `index.html`, `scripts/render.js`, `styles/10-navigation-and-cards.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 11:09:44 +0000

- Source: `manual`
- Task: removed route priority from upcoming work cards
- Branch: `main`
- Methods: `changed upcoming schedule previews so factual entries no longer prioritize route direction`, `and instead show time range first plus useful compact details like duration and income`, `planned graph days now also show time range with duration before the graph label`
- Files: `scripts/render.js`, `ai-memory/CHANGELOG.md`

## 2026-04-21 11:11:42 +0000

- Source: `manual`
- Task: reused install-guide close button and aligned upcoming cards closer to shift style
- Branch: `main`
- Methods: `replaced schedule close buttons with the exact install-guide close button class combination already used in the add-screen instruction sheet`, `and restyled upcoming schedule cards with the app's darker card surface`, `softer border`, `and compact date chip so they feel closer to existing shift cards`
- Files: `index.html`, `styles/10-navigation-and-cards.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 11:15:33 +0000

- Source: `manual`
- Task: rebuilt upcoming day cards from shift card building blocks
- Branch: `main`
- Methods: `replaced the text-only upcoming day preview with a card body assembled from the same shift helpers already used in real shift cards`, `reusing the existing time row`, `duration row`, `income row`, `and type styling so upcoming entries now follow the same visual order and information hierarchy as the main shift UI`
- Files: `scripts/render.js`, `styles/10-navigation-and-cards.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 11:20:57 +0000

- Source: `manual`
- Task: removed duplicate recent shifts block from home
- Branch: `main`
- Methods: `deleted the recent shifts section from the home screen so the schedule card and upcoming shift card become the single primary work surface there`, `and removed the extra home list render call to avoid duplicating the same shift card layout below`
- Files: `index.html`, `scripts/render.js`, `ai-memory/CHANGELOG.md`

## 2026-04-21 11:24:21 +0000

- Source: `manual`
- Task: extended upcoming shift card with technical and fuel details
- Branch: `main`
- Methods: `completed the home upcoming shift card by reusing the same technical summary and fuel consumption blocks already rendered in regular shift cards`, `so the top card now includes train`, `locomotive`, `wagon/axle`, `fuel`, `and consumption details instead of only time`, `duration`, `and income`
- Files: `scripts/render.js`, `ai-memory/CHANGELOG.md`

## 2026-04-21 11:28:31 +0000

- Source: `manual`
- Task: switched top factual card to exact shift card reuse
- Branch: `main`
- Methods: `changed the home upcoming factual entry to render the same compact shift card html used in the journal instead of a custom lookalike`, `removed the separate outer date chip for reused factual cards`, `and extended shift-card source lookup plus actions host detection so detail opening and actions keep working from the top card as well`
- Files: `scripts/render.js`, `styles/10-navigation-and-cards.css`, `ai-memory/CHANGELOG.md`
