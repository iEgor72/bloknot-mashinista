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

## 2026-04-21 11:30:41 +0000

- Source: `manual`
- Task: reordered home screen blocks
- Branch: `main`
- Methods: `moved the home sections into the requested order so worked summary stays first`, `the work calendar becomes the second primary block`, `and the monthly quick stats card comes after the calendar`
- Files: `index.html`, `ai-memory/CHANGELOG.md`

## 2026-04-21 11:41:06 +0000

- Source: `manual`
- Task: improved schedule day messaging and added schedule period editing
- Branch: `main`
- Methods: `made the calendar day header explain plan versus fact more plainly`, `added period selection state plus form reuse so an existing graph period can be loaded back into the same planner form for editing`, `reused the existing planner UI instead of creating a second edit flow`, `and added compact edit/delete actions on period cards`
- Files: `index.html`, `scripts/app.js`, `scripts/render.js`, `scripts/shift-form.js`, `styles/10-navigation-and-cards.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 11:48:18 +0000

- Source: `manual`
- Task: separated plan and fact in schedule day overlay
- Branch: `main`
- Methods: `split the calendar day sheet into separate fact and plan cards so mixed graph-plus-manual days are readable at a glance`, `changed the day status copy to explain that fact wins over plan when both exist`, `and kept the add-record flow in the same place while adapting its wording for planned day-off cases`
- Files: `index.html`, `scripts/render.js`, `styles/10-navigation-and-cards.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 11:54:25 +0000

- Source: `manual`
- Task: clarified mixed schedule day actions
- Branch: `main`
- Methods: `made the calendar day sheet actions match the actual workflow by switching add-record wording between shift and trip based on planned day type`, `and changed the open action so multiple factual records lead into the shifts journal instead of silently opening only the first record`
- Files: `scripts/app.js`, `scripts/render.js`, `scripts/shift-form.js`, `ai-memory/CHANGELOG.md`

## 2026-04-21 11:56:40 +0000

- Source: `manual`
- Task: fixed calendar day to shifts journal month sync
- Branch: `main`
- Methods: `updated the calendar-day-to-journal transition so opening the shifts tab from a selected day first switches the journal month to that day`, `then scrolls to the matching shift card`, `which avoids landing in the wrong month when mixed schedule days point outside the currently visible journal month`
- Files: `scripts/app.js`, `ai-memory/CHANGELOG.md`

## 2026-04-21 11:58:51 +0000

- Source: `manual`
- Task: highlighted journal target after calendar day open
- Branch: `main`
- Methods: `added a temporary journal-focus highlight for shift cards reached from the calendar day sheet so the user can immediately see which record the app navigated to after month sync and scroll`
- Files: `scripts/app.js`, `scripts/render.js`, `styles/30-shifts-and-overlays.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 12:01:00 +0000

- Source: `manual`
- Task: limited journal target highlight to the actual transition
- Branch: `main`
- Methods: `cleared the temporary journal-focus highlight when leaving the shifts tab so the visual cue only exists during the calendar-to-journal handoff instead of persisting across later navigation`
- Files: `scripts/auth.js`, `ai-memory/CHANGELOG.md`

## 2026-04-21 12:10:17 +0000

- Source: `manual`
- Task: rebuilt calendar day sheet toward app-native UI
- Branch: `main`
- Methods: `replaced the synthetic fact metrics block with a read-only real shift card reuse inside the calendar day sheet`, `removed the confusing add-trip wording in favor of a generic add-record action only when no fact exists`, `unified the existing fact action to always open the shifts journal instead of sometimes jumping into edit mode`, `and restyled the day editor controls into a more app-native plan-on-day card with full labels and calmer visual hierarchy`
- Files: `index.html`, `scripts/render.js`, `scripts/shift-form.js`, `styles/10-navigation-and-cards.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 12:15:43 +0000

- Source: `manual`
- Task: fixed broken day sheet button and segmented layout
- Branch: `main`
- Methods: `corrected the calendar day sheet layout by making the single visible action button span the full row and overriding the inherited segmented container behavior so the day-type buttons render as a clean grid without clipping or broken spacing on mobile`
- Files: `styles/10-navigation-and-cards.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 12:18:10 +0000

- Source: `manual`
- Task: reworded schedule day controls into user language
- Branch: `main`
- Methods: `replaced the technical plan-on-day wording with a clearer calendar-marking concept`, `changed the day override label to explain it as a manual calendar mark rather than an internal plan object`, `updated the auto option to read as following the graph`, `and softened the day sheet status copy to describe what the user sees instead of internal scheduling semantics`
- Files: `index.html`, `scripts/render.js`, `scripts/shift-form.js`, `ai-memory/CHANGELOG.md`

## 2026-04-21 12:19:40 +0000

- Source: `manual`
- Task: stopped mutating reused shift card in day sheet
- Branch: `main`
- Methods: `removed the regex-based surgery on the reused fact card`, `now render the normal shift card as-is inside the calendar day sheet`, `hide only the action area with CSS`, `and suppress the extra fact heading above the card when a real fact card is present so the screen truly reuses the existing shift layout instead of a broken partial clone`
- Files: `scripts/render.js`, `styles/10-navigation-and-cards.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 12:21:20 +0000

- Source: `manual`
- Task: removed inherited segmented wrapper from day mark control
- Branch: `main`
- Methods: `stopped reusing the global segmented container class for the calendar day mark selector so the four day-type buttons use only their dedicated grid styles and no longer inherit clipping or pill-wrapper behavior from the older segmented control`
- Files: `index.html`, `styles/10-navigation-and-cards.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 12:25:29 +0000

- Source: `manual`
- Task: normalized day sheet typography and density
- Branch: `main`
- Methods: `reduced the calendar day sheet typography`, `spacing`, `and card chrome to match the app's existing settings and shift surfaces more closely`, `made the fact block visually defer to the reused shift card instead of wrapping it in another oversized panel`, `and toned down secondary text plus plan metrics so the lower part of the sheet no longer dominates the screen`
- Files: `styles/10-navigation-and-cards.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 12:31:30 +0000

- Source: `manual`
- Task: removed manual day mark override from day sheet
- Branch: `main`
- Methods: `deleted the confusing manual calendar-mark override block from the day sheet entirely`, `along with its save path and selector wiring`, `leaving the screen focused only on fact`, `graph information`, `and navigation actions instead of exposing a weak technical override that users did not understand`
- Files: `index.html`, `scripts/render.js`, `scripts/shift-form.js`, `styles/10-navigation-and-cards.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 12:35:44 +0000

- Source: `manual`
- Task: changed default shift time to 01:00-13:00
- Branch: `main`
- Methods: `updated the app's default start and end times from 08:00-20:00 to 01:00-13:00 across shift creation flows`, `preset end-date calculation`, `schedule planner defaults`, `and calendar-to-add-shift handoff so the привычный рабочий шаблон is used consistently instead of only in one entry point`
- Files: `index.html`, `scripts/app.js`, `scripts/shift-form.js`, `scripts/time-utils.js`, `ai-memory/CHANGELOG.md`

## 2026-04-21 12:38:02 +0000

- Source: `manual`
- Task: moved calendar legend up and colorized pattern buttons
- Branch: `main`
- Methods: `moved the work-calendar legend above the weekday row so the meaning of day`, `night`, `rest`, `and fact is visible before the grid`, `reduced the gap between the calendar and upcoming card block`, `and styled the graph pattern buttons D/N/V with the same day`, `and rest colors already used in the calendar instead of neutral pills`
- Files: `index.html`, `styles/10-navigation-and-cards.css`, `ai-memory/CHANGELOG.md`

## 2026-04-21 12:42:36 +0000

- Source: `manual`
- Task: restored ordinary add flow to actual current time
- Branch: `main`
- Methods: `reverted the unintended change to the regular add-shift form so ordinary manual shift entry again defaults to the current actual time`, `while keeping the 01:00-13:00 preset only for calendar-origin shift creation and graph-related defaults as explicitly requested by Egor`
- Files: `scripts/time-utils.js`, `ai-memory/CHANGELOG.md`

## 2026-04-21 12:44:31 +0000

- Source: `manual`
- Task: completed major schedule and calendar day UX pass
- Branch: `main`
- Methods: `iteratively rebuilt the home work-calendar and calendar-day experience in bloknot-mashinista: added local-first schedule periods and home calendar visibility`, `simplified the planner to graph-only`, `replaced duplicated home blocks with reused real shift-card surfaces`, `added in-place period editing`, `clarified plan versus fact behavior`, `cleaned mixed manual-trip plus graph flows`, `fixed calendar-to-journal navigation and target highlight behavior`, `removed the confusing manual day override block from the day sheet`, `switched calendar-origin add-record defaults to 01:00-13:00 while restoring ordinary add-shift to current-time defaults`, `and spent multiple passes aligning the calendar day sheet toward app-native reuse`, `typography`, `spacing`, `and controls based on Egor's live feedback`
- Files: `index.html`, `scripts/app.js`, `scripts/render.js`, `scripts/shift-form.js`, `scripts/time-utils.js`, `styles/10-navigation-and-cards.css`, `styles/30-shifts-and-overlays.css`, `sw.js`, `ai-memory/CHANGELOG.md`

## 2026-04-21 12:53:44 +0000

- Source: `manual`
- Task: Собрал единое ТЗ после multi-role review и зафиксировал волну работ
- Branch: `main`
- Methods: `синтез 4 сабагент-ревью`, `приоритизация рисков`, `декомпозиция на epics/tasks/subtasks`
- Files: `docs/2026-04-21-review-action-plan.md`

## 2026-04-21 12:55:59 +0000

- Source: `manual`
- Task: Подготовил UX-спецификацию волны 2 для home, quick-add и nav/docs entry
- Branch: `main`
- Methods: `прочитал project memory и review action plan`, `синтезировал UX hierarchy/states/acceptance criteria в отдельный markdown-документ без правок продуктового кода`
- Files: `docs/2026-04-21-wave-2-ux-spec.md`

## 2026-04-21 12:56:18 +0000

- Source: `manual`
- Task: Подготовил marketing/onboarding spec для wave 1-2
- Branch: `main`
- Methods: `прочитал memory workflow и review action plan`, `сверил текущий Telegram welcome/auth/SEO copy`, `оформил markdown-спецификацию без code changes`
- Files: `docs/2026-04-21-marketing-onboarding-wave1-2-spec.md`

## 2026-04-21 12:56:59 +0000

- Source: `manual`
- Task: Wave 1 frontend shell/PWA hardening: synced SW SEO routes, aligned precache with live shell resources, removed viewport zoom lock
- Branch: `main`
- Methods: `updated sw.js SEO bypass list to match current public pages from server routing`, `added linked shell CSS/scripts plus manifest/icons to install and critical precache sets`, `removed maximum-scale/user-scalable=no from index viewport`, `verified with node --check and route/resource self-check scripts`
- Files: `sw.js`, `index.html`

## 2026-04-21 13:02:01 +0000

- Source: `manual`
- Task: Wave 1 backend hardening: validate /api/shifts payloads, make local JSON writes atomic, add structured error logging in auth/webhook/storage paths
- Branch: `main`
- Methods: `server.js schema-lite validation for shift payloads with field limits`, `temp-file plus rename atomic write helpers reused for shifts and user-presence storage`, `rate-limited structured JSON logging for auth/webhook/storage failure paths`, `focused syntax and authenticated HTTP checks`
- Files: `server.js`

## 2026-04-21 13:06:14 +0000

- Source: `manual`
- Task: Wave 2 auth/onboarding alignment: убрал timer promise из Telegram welcome, перевел root/auth gate на bot-first copy и убрал URL session leak через _st в пользу cookie bootstrap
- Branch: `main`
- Methods: `точечные правки server.js/scripts/auth.js`, `Set-Cookie bm_session для Telegram Login Widget и WebApp auth`, `сохранен bearer localStorage как совместимый fallback`, `bump SW cache version и узкие syntax/self-check`
- Files: `server.js`, `scripts/auth.js`, `sw.js`

## 2026-04-21 13:08:08 +0000

- Source: `manual`
- Task: Реализовал wave 2 UX simplification для home/add/docs entry
- Branch: `main`
- Methods: `hero-first home block с CTA и быстрыми действиями`, `progressive disclosure для add shift без смены data model`, `task-based docs entry cards`, `точечные JS/CSS правки и syntax checks`
- Files: `index.html`, `scripts/render.js`, `scripts/shift-form.js`, `styles/10-navigation-and-cards.css`, `styles/20-form-and-stats.css`

## 2026-04-21 13:15:24 +0000

- Source: `manual`
- Task: Смягчил сырой UX-проход: убрал навязчивый hero и лишний docs entry с главной волны
- Branch: `main`
- Methods: `точечный откат перегруженного home/docs UI`, `сохранение quick-add улучшений без ломки остального flow`
- Files: `index.html`, `scripts/render.js`, `scripts/shift-form.js`, `styles/10-navigation-and-cards.css`

## 2026-04-21 13:19:14 +0000

- Source: `manual`
- Task: Смягчил onboarding/auth copy без изменения UI-структуры
- Branch: `main`
- Methods: `точечные copy-правки в Telegram welcome и auth gate`, `сохранил bot-first вход и существующие CTA/виджеты`, `затем выполнил syntax/self-check`
- Files: `server.js`, `scripts/auth.js`

## 2026-04-21 13:20:07 +0000

- Source: `manual`
- Task: Полировка quick-add first во вкладке add
- Branch: `main`
- Methods: `уплотнил первый экран формы`, `добавил спокойный intro-блок и disclosure для необязательных деталей`, `сохранил existing data model и edit flow`, `ограничил правки index.html/scripts/shift-form.js/styles/20-form-and-stats.css`, `проверил node --check scripts/shift-form.js`
- Files: `index.html`, `scripts/shift-form.js`, `styles/20-form-and-stats.css`

## 2026-04-21 13:29:43 +0000

- Source: `manual`
- Task: Упростил home calendar block и day overlay без изменения flow
- Branch: `main`
- Methods: `сузил helper copy`, `сделал легенду компактнее`, `сократил upcoming до 3 элементов`, `заменил planned upcoming cards на спокойный текстовый формат`, `упростил day overlay status/empty copy и уменьшил визуальный вес связанных блоков`, `проверил node --check scripts/render.js и diff по затронутым home calendar секциям`
- Files: `index.html`, `scripts/render.js`, `styles/10-navigation-and-cards.css`

## 2026-04-21 13:30:27 +0000

- Source: `manual`
- Task: Точечно почистил docs entry без нового nav-слоя
- Branch: `main`
- Methods: `Упростил docs entry: убрал двухрядную сетку секций`, `оставил один существующий уровень выбора разделов в виде горизонтального chip-row`, `добавил короткий helper subtitle и не трогал docs data flow/render logic.`
- Files: `index.html`, `styles/10-navigation-and-cards.css`

## 2026-04-21 13:31:21 +0000

- Source: `manual`
- Task: Точечно дочистил docs entry без нового nav-слоя
- Branch: `main`
- Methods: `Упростил docs entry до одного читаемого ряда разделов`, `сократил helper-copy и добавил нейтральную сетку для docs shell/panels без новых вкладок или дублей навигации.`
- Files: `index.html`, `styles/10-navigation-and-cards.css`

## 2026-04-21 13:34:45 +0000

- Source: `manual`
- Task: Переделал первый экран docs в task-based hub без дубля навигации
- Branch: `main`
- Methods: `Заменил верх docs на 3 entry-card`, `спрятал техподтабы до выбора раздела`, `добавил back-to-hub flow и контекстный secondary row только для группы памяток`
- Files: `index.html`, `scripts/app.js`, `scripts/shift-form.js`, `styles/10-navigation-and-cards.css`

## 2026-04-21 13:44:25 +0000

- Source: `manual`
- Task: Обновил названия и subtitle карточек docs entry
- Branch: `main`
- Methods: `точечные copy-правки в index.html и scripts/app.js без изменения docs data flow или других разделов`, `проверка node --check scripts/app.js и локальный diff по затронутым файлам`
- Files: `index.html`, `scripts/app.js`

## 2026-04-21 13:46:01 +0000

- Source: `manual`
- Task: Исправил расчёты месяца и зарплаты по графику при отсутствии фактических смен
- Branch: `main`
- Methods: `Добавил derive виртуальных смен из D/N графика с приоритетом факта над планом по дню`, `подключил их в month dashboard и salary summary`, `зафиксировал правило overnight end<=start`
- Files: `scripts/app.js`, `scripts/render.js`

## 2026-04-21 13:46:18 +0000

- Source: `manual`
- Task: Вернул запрет zoom в основном приложении по явному требованию пользователя
- Branch: `main`
- Methods: `точечный rollback viewport meta`, `zoom оставлен концептуально только для viewer-сценариев`
- Files: `index.html`

## 2026-04-21 13:54:53 +0000

- Source: `manual`
- Task: Подготовил дизайн-спецификацию принципов минимализма для home calendar и docs entry
- Branch: `main`
- Methods: `прочитал обязательную память`, `сверил текущие UI-файлы home calendar/docs и существующие docs`, `оформил краткий markdown-spec без продуктовых code changes`
- Files: `docs/2026-04-21-product-minimalism-principles.md`

## 2026-04-21 13:57:32 +0000

- Source: `manual`
- Task: Упростил home calendar, upcoming и day overlay
- Branch: `main`
- Methods: `сузил copy`, `сократил upcoming до 2 элементов`, `заменил planned upcoming на более плоский текстовый формат`, `уменьшил визуальный вес легенды и day overlay без изменения flow`
- Files: `index.html`, `scripts/render.js`, `styles/10-navigation-and-cards.css`

## 2026-04-21 13:57:43 +0000

- Source: `openclaw-subagent`
- Task: Polished docs entry and docs subnav visuals
- Branch: `main`
- Methods: `Adjusted docs-specific HTML/CSS only: added lightweight inline iconography`, `clearer kicker/title/subtitle hierarchy`, `richer entry-tile structure`, `and pill-style subnav markers/back button without changing navigation logic.`
- Files: `index.html`, `styles/10-navigation-and-cards.css`
- Notes: Why: Make docs first screen feel more product-like and easier to scan while keeping the existing two-step docs flow and avoiding new navigation layers. | Risks: Visual-only change on a dirty worktree; verify spacing and wrapping on narrow mobile widths. | Check: Open docs first screen, confirm entry tiles scan cleanly, subnav pills remain single-layer and horizontal, and back button/title stack feel balanced. | No JS logic changes. Did not touch home/add/auth/server/calendar behavior.

## 2026-04-21 14:05:07 +0000

- Source: `manual`
- Task: Подготовил мини-спеку visual language для calendar states и docs entry
- Branch: `main`
- Methods: `прочитал обязательную memory workflow документацию`, `сверил текущие home calendar/docs UI в index/render/styles`, `оформил краткий markdown-spec с critique без product code changes`
- Files: `docs/2026-04-21-calendar-docs-visual-language-mini-spec.md`

## 2026-04-21 14:07:05 +0000

- Source: `manual`
- Task: Calendar visual polish
- Branch: `main`
- Methods: `Used existing calendar states and production holiday map`, `added subtle holiday accent`, `compact badge chips`, `and lighter spacing adjustments.`
- Files: `index.html`, `scripts/render.js`, `styles/10-navigation-and-cards.css`
- Notes: Why: Make D/N/V/fact/holiday readable at a glance while staying minimal and avoiding heavier cards or extra copy. | Risks: Production repo has existing unrelated changes; edits were kept narrow to calendar markup, rendering classes, and CSS only. | Check: node --check scripts/render.js; reviewed edited snippets in index.html, scripts/render.js, styles/10-navigation-and-cards.css | Did not touch auth, backend, add-flow, or docs content beyond reading the minimalism principles.

## 2026-04-21 14:09:08 +0000

- Source: `manual`
- Task: Уточнил семантику календаря: факт поверх графика, праздники и 5/2
- Branch: `main`
- Methods: `Добавил holiday/short-day/cycle метаданные в schedule state`, `сделал явные маркеры Ф и П в календарной ячейке`, `подсветил 5/2 через pattern detection и подписи`, `уточнил статус/plan copy в day overlay`, `проверил node --check scripts/app.js и scripts/render.js`
- Files: `scripts/app.js`, `scripts/render.js`, `styles/10-navigation-and-cards.css`

## 2026-04-21 14:10:08 +0000

- Source: `manual`
- Task: docs-ux-rewrite
- Branch: `main`
- Files: `index.html`, `scripts/app.js`, `styles/10-navigation-and-cards.css`
- Notes: Why: Сделать docs экран понятным и похожим на рабочую библиотеку, убрать невнятный верхний текст, выровнять пропорции карточек и иконок, не трогая другие разделы. | Check: node --check scripts/app.js && node --check scripts/docs-app.js | Первый экран docs переделан в библиотечную витрину из 3 карточек. Верхний explanatory text сокращён до ясных заголовков, добавлены поясняющие подписи внутри карточек, увеличены SVG-иконки и отступы. Subnav теперь показывается только после входа в выбранный раздел, без нового навигационного слоя.

## 2026-04-21 14:16:01 +0000

- Source: `manual`
- Task: Calendar readability and overnight fact anchoring
- Branch: `main`
- Files: `index.html`, `scripts/app.js`, `scripts/render.js`, `styles/10-navigation-and-cards.css`
- Notes: Why: Home calendar must be readable at a glance and overnight factual shifts should not visually duplicate onto the next day in the month grid. | Check: node --check scripts/app.js && node --check scripts/render.js | Added calendar-only fact anchoring by shift start date for resolveScheduleDay, tightened schedule card copy, and made the day-state badge more dominant while keeping holiday/fact as separate markers.

## 2026-04-21 14:19:37 +0000

- Source: `manual`
- Task: Replace user-facing 'fact' with actual worked day-state in calendar
- Branch: `main`
- Files: `scripts/app.js`, `scripts/render.js`, `index.html`, `styles/10-navigation-and-cards.css`
- Notes: Why: 'Fact' is a technical implementation detail, not a user-meaningful calendar state. The month grid should show the final day meaning: worked day, worked night, rest, holiday. | Check: node --check scripts/app.js && node --check scripts/render.js | Added workedCode inference for recorded shifts, made calendar cells use effectiveCode(actual overrides plan), removed user-facing 'Факт' legend/copy, and kept plan vs record separation only in the day overlay. Calendar factual shifts are anchored to start date to avoid overnight double-highlighting.

## 2026-04-21 14:25:31 +0000

- Source: `manual`
- Task: Упростил microcopy первого экрана docs и docs subnav
- Branch: `main`
- Methods: `точечно переписал тексты в index.html и metadata subtitle в scripts/app.js без изменения docs flow`, `проверил node --check scripts/app.js и локальный git diff по затронутым copy-блокам`
- Files: `index.html`, `scripts/app.js`

## 2026-04-21 14:26:56 +0000

- Source: `manual`
- Task: calendar ux finisher
- Branch: `main`
- Methods: `single-state month grid`, `tiny record dot`, `subtle holiday marker`, `overlay copy cleanup`
- Files: `index.html`, `scripts/render.js`, `styles/10-navigation-and-cards.css`
- Notes: Why: make weekend/holiday/day/night readable in one second without visual noise; avoid using 'факт' as day state | Check: node --check scripts/app.js && node --check scripts/render.js | Scoped to home calendar and day overlay only. Effective code now drives cell state, holiday stays secondary, record presence is a small white dot, overlay titles are 'Работали' and 'По графику'.

## 2026-04-21 23:25:13 +0000

- Source: `manual`
- Task: Schedule planner UX: collapse non-current schedule periods
- Branch: `main`
- Methods: `Grouped periods by current/future/archive in renderSchedulePlannerOverlay`, `added disclosure toggles in schedulePeriodsList click handler`, `added compact disclosure styles`, `kept copy short and human.`
- Files: `index.html`, `scripts/render.js`, `scripts/shift-form.js`, `styles/10-navigation-and-cards.css`
- Notes: Why: Planner looked like an endless list; default focus should be the active schedule only. | Check: node --check scripts/render.js && node --check scripts/shift-form.js; reviewed diff for touched files only | Current schedule stays visible. Future and archived schedules are hidden behind explicit expandable sections with counters.

## 2026-04-21 23:29:58 +0000

- Source: `manual`
- Task: Переработал архитектуру графиков: active/archive view и явный overlap flow
- Branch: `main`
- Methods: `Добавил view-model периодов`, `хранение pending conflict`, `replaceSchedulePeriods`, `обновил planner render и form handlers`, `вынес активный период отдельно и спрятал future/archive за disclosure.`
- Files: `scripts/app.js`, `scripts/render.js`, `scripts/shift-form.js`, `index.html`, `styles/10-navigation-and-cards.css`
- Notes: Why: Чтобы графики не накапливались бесконтрольно: новый период не может молча пересечь старый, а в UI по умолчанию виден только актуальный график. | Risks: Старые уже сохранённые пересечения автоматически не мигрируются; view-model показывает один active и относит остальные в history. Нужна ручная UX-проверка overlay и replace flow. | Check: Проверить planner overlay: сохранение без overlap, конфликт replace/edit, раскрытие истории, редактирование и удаление active/future/archive периодов. | JS синтаксис проверен через node --check для scripts/app.js, scripts/render.js, scripts/shift-form.js.

## 2026-04-21 23:43:35 +0000

- Source: `manual`
- Task: Tightened schedule replace flow and active/history model
- Branch: `main`
- Methods: `Normalized active period selection with explicit schedule period priority instead of implicit array order`, `added replace flow that truncates overlapping periods around the replacement window`, `surfaced conflict actions in planner UI`, `and verified JS syntax plus replacement edge cases with a small Node simulation.`
- Files: `scripts/app.js`, `scripts/render.js`, `scripts/shift-form.js`, `index.html`, `styles/10-navigation-and-cards.css`
- Notes: Why: Egor wants schedule periods to stop piling up as clutter, with the active graph primary, overlaps forbidden, and replacement from date X clear and safe. | Risks: Full browser smoke still needed for planner UI, conflict prompts, and calendar readability; worktree still contains other accepted non-schedule changes in adjacent files. | Check: In browser: add overlapping period -> replace from date; verify old period ends on X-1, future tail is preserved when replacement is finite, current/future/archive sections render correctly, and overnight fact still shows only on start date in month grid. | Replace helper now preserves a right-side tail by creating a new period after the replacement window when needed.

## 2026-04-21 23:50:21 +0000

- Source: `manual`
- Task: Simplified calendar cells to D/N/V only
- Branch: `main`
- Methods: `Removed holiday and record markers plus decorative stripes from the month grid`, `reduced the legend to day`, `night`, `and rest only`, `and marked calendar non-working days in red using the production calendar instead of worker shift state.`
- Files: `index.html`, `scripts/render.js`, `styles/10-navigation-and-cards.css`
- Notes: Why: Egor wants the month to read instantly without dots, stripes, or extra indicators. Only D/N/V should remain as worker-state badges, while calendar weekends and holidays should be visible by red date numbers. | Risks: Visual browser check still ideal for exact shade and contrast on small screens. | Check: Open home calendar and verify there are no dots, stripes, or extra marks, only D/N/V badges remain, and calendar weekends and holidays are red even when worker schedule differs.

## 2026-04-22 00:03:07 +0000

- Source: `manual`
- Task: Scoped schedule planner to the viewed month
- Branch: `main`
- Methods: `Changed the planner overlay to resolve schedule periods by the currently opened calendar month range instead of today's active period`, `removed the history/future archive from the main planner view`, `defaulted new period start date to the opened month`, `and made edit/delete buttons visually stronger.`
- Files: `index.html`, `scripts/app.js`, `scripts/render.js`, `scripts/shift-form.js`, `styles/10-navigation-and-cards.css`
- Notes: Why: Egor wants the graph screen to answer only one question: what graph exists for the currently opened month. July should not show old January periods, and empty months should stay empty. | Risks: If a single month contains two different non-overlapping periods, both are shown because both belong to that month. | Check: Open planner from several months: month without period should be empty, month with period should show only periods intersecting that month, and edit/delete buttons should feel readable and active.

## 2026-04-22 00:09:09 +0000

- Source: `manual`
- Task: Unified graph with shifts journal
- Branch: `main`
- Methods: `Switched the shifts journal to render the month calculation set instead of only manually saved shifts`, `so graph-derived shifts appear with hours and income. Added lookup support for derived shifts`, `labeled them as schedule-based`, `hid edit/delete action dots for those generated entries`, `and made a tap open the schedule day sheet instead of the manual shift editor.`
- Files: `scripts/render.js`, `scripts/shift-form.js`, `scripts/time-utils.js`
- Notes: Why: Egor wants graph and shifts to feel like one whole app. If the graph drives hours and money, the same generated shifts must also appear in the shifts tab and disappear when the graph is removed. | Risks: Derived shifts are still generated client-side from the graph rather than persisted as server-backed manual entries; this keeps deletion/update behavior safe but means their interaction model differs slightly from real saved shifts. | Check: Open a month with graph-only work and verify the shifts tab shows the generated shifts with duration and income; tapping a generated shift should open the schedule day overlay, and removing the graph should remove those generated shifts from the journal.

## 2026-04-22 00:19:35 +0000

- Source: `manual`
- Task: Materialize graph into real shifts
- Branch: `main`
- Methods: `Reworked schedule integration so visible-month graph days are materialized into normal shift records in allShifts instead of only being rendered as derived display items. Added month-range materialization/sync helpers`, `purge-on-period-change handling`, `same-card same-editor behavior for graph-created shifts`, `and delete behavior that suppresses the underlying graph day via a day override so the removed generated shift does not instantly respawn.`
- Files: `scripts/app.js`, `scripts/render.js`, `scripts/shift-form.js`, `scripts/time-utils.js`
- Notes: Why: Egor wants graph and manual shifts to be one unified model. Graph-created work should look, open, edit, and delete like normal shifts, while still disappearing when the graph changes or is removed. | Risks: Open-ended periods are materialized month by month as the user views months, not pre-generated for the entire infinite future. Deleting a graph-created shift currently writes a V override for that day so it stays deleted instead of reappearing from the graph. | Check: Add or edit a graph in a month, verify the shifts list shows ordinary editable shift cards, open one into the standard editor, then delete a generated shift and confirm it stays gone for that day. Remove the graph period and confirm its generated shifts disappear from the month.

## 2026-04-22 00:35:13 +0000

- Source: `manual`
- Task: Unify calendar day sheet with materialized graph shifts
- Branch: `main`
- Methods: `Updated the calendar day overlay so it first materializes the selected day before rendering`, `then treats a graph-created shift as a normal journal shift in the sheet. Status copy for materialized days now says the shift is already in the journal instead of showing a split between graph and record.`
- Files: `scripts/render.js`
- Notes: Why: Egor wants no lingering feeling that graph and manual shifts are separate entities. Opening a day should show one coherent shift state, not plan plus record split, when the graph has already produced a real shift. | Risks: The overlay now triggers a one-day materialization sync before render; this is lightweight but still writes through the existing saveShifts path when it creates a missing shift. | Check: Open a calendar day with graph work and verify the sheet no longer falls back to 'Добавить запись' for that day, instead showing the normal shift card and 'Редактировать смену'.

## 2026-04-22 00:41:47 +0000

- Source: `manual`
- Task: Normalize calendar day CTA wording
- Branch: `main`
- Methods: `Unified the calendar day overlay CTA label so both manual shifts and graph-created materialized shifts use the same wording`, `'Открыть в сменах'`, `while keeping the existing openShiftsForDate navigation behavior.`
- Files: `scripts/render.js`
- Notes: Why: Egor pointed out that even with unified behavior, different CTA wording still exposes graph and manual shifts as different systems. | Risks: Low risk, copy-only behavior alignment in the day overlay. | Check: Open a manual shift day and a graph-created shift day from the calendar and confirm both show the same CTA label: 'Открыть в сменах'.

## 2026-04-22 00:46:00 +0000

- Source: `manual`
- Task: Fix calendar day open/close lag
- Branch: `main`
- Methods: `Removed schedule-shift materialization and save calls from hot render paths. Calendar day materialization now runs only on explicit day open`, `and visible-month materialization runs on explicit month navigation instead of every render. This avoids render/save/render churn that was causing heavy lag and delayed overlay open-close behavior.`
- Files: `scripts/app.js`, `scripts/render.js`, `scripts/shift-form.js`
- Notes: Why: Egor reported the calendar day sheet freezing, delayed opening, and delayed closing after the recent graph-materialization changes. The root cause was save work happening inside render paths. | Risks: Month changes and day opens still trigger background save when a new materialized shift is created, but normal rerenders should now stay lightweight. | Check: Tap days in the calendar repeatedly, verify the day sheet opens immediately and closes immediately, then switch months and confirm there is no heavy UI stall.

## 2026-04-22 00:51:13 +0000

- Source: `manual`
- Task: Harden schedule period action UX
- Branch: `main`
- Methods: `Updated month-scoped schedule period actions so edit is labeled 'Редактировать' and styled as a warm amber action`, `while delete is styled as a red danger button. Reused the existing confirmation sheet for schedule-period deletion with a graph-specific title/card/confirm button`, `so deleting a graph now always requires explicit confirmation before the period and its generated month shifts are removed.`
- Files: `index.html`, `scripts/app.js`, `scripts/render.js`, `scripts/shift-form.js`, `styles/10-navigation-and-cards.css`
- Notes: Why: Egor reported unsafe deletion and misleading neutral button styling in the schedule planner after accidentally removing an entire graph period with one tap. | Risks: The shared confirm sheet now supports both shift deletion and graph deletion via separate pending ids; behavior should be safe, but this flow should be clicked once manually. | Check: Open the schedule planner, verify 'Редактировать' is amber, 'Удалить' is red, tap delete and confirm a dedicated delete sheet appears before any graph period is removed.

## 2026-04-22 00:54:21 +0000

- Source: `manual`
- Task: Unify schedule planner actions with bottom-sheet UI pattern
- Branch: `main`
- Methods: `Removed inline edit/delete buttons from schedule period cards and switched the graph planner to the app's bottom action pattern: tap a period card to select it`, `then use bottom-sheet actions to edit or delete. Added a shared amber .btn-edit-action style for bottom edit actions and a selected-state highlight for schedule period cards.`
- Files: `index.html`, `scripts/render.js`, `scripts/shift-form.js`, `styles/00-base.css`, `styles/10-navigation-and-cards.css`
- Notes: Why: Egor wants edit/delete controls in a consistent bottom action area instead of a mixed UI with inline card buttons in one place and bottom-sheet actions elsewhere. | Risks: Manual click verification is still useful for the selection state in the schedule planner and for the interaction between selected period cards and the bottom action row. | Check: Open the graph planner, tap a month period card, verify it highlights and reveals bottom actions 'Редактировать график' and 'Удалить график', then use those actions normally.

## 2026-04-22 01:03:15 +0000

- Source: `manual`
- Task: Fix critical cross-device schedule sync bug
- Branch: `main`
- Methods: `Moved schedule/graph storage off device-local localStorage into a new authenticated server API /api/schedule with per-user JSON persistence. Client now reads remote schedule on auth`, `writes remote on schedule changes`, `keeps local cache for offline use`, `and auto-migrates existing local schedule data up to the server when remote storage is still empty.`
- Files: `server.js`, `scripts/app.js`, `scripts/auth.js`
- Notes: Why: A user-created graph could exist on the phone but be completely absent on desktop because schedule data was never included in server sync, unlike shifts. This was a critical cross-device data consistency bug. | Risks: Existing unsynced phone-only graphs need the phone app to open once on the new build so the local schedule can auto-upload to the server. Manual device verification is still needed for phone->desktop and desktop->phone schedule sync. | Check: Create a graph on one device, reload on another device with the same account, confirm the planner and month calendar show the same periods. For legacy local-only data, open the phone app once after deploy and then reload desktop.

## 2026-04-22 01:16:51 +0000

- Source: `manual`
- Task: Clarify schedule period selection before edit/delete
- Branch: `main`
- Methods: `Added a helper hint card inside the schedule planner sheet using the same disclosure-style language pattern as the add-shift details area. When no period is selected it says to choose a graph above`, `after selection it flips to confirm that actions are now available below.`
- Files: `index.html`, `scripts/render.js`, `styles/10-navigation-and-cards.css`
- Notes: Why: Egor reported that it was not obvious you must tap a graph card before the bottom edit/delete actions appear. | Risks: Manual UI check is still useful to confirm the hint feels natural and not too noisy on small screens. | Check: Open the graph planner with an existing month graph, confirm the helper says to choose a graph, tap a period card, and confirm the helper flips to indicate actions are available below.

## 2026-04-22 01:19:44 +0000

- Source: `manual`
- Task: Fix confirm sheet appearing behind schedule planner
- Branch: `main`
- Methods: `Adjusted shared overlay opening behavior so any overlay being opened is appended to the end of its parent before activation. This makes the newly opened sheet render above already open overlays instead of relying on static DOM order.`
- Files: `scripts/shift-form.js`
- Notes: Why: Deleting a graph opened the confirm sheet behind the schedule planner, so the user only saw it after closing the planner. That made a destructive action feel broken and unsafe. | Risks: Worth manual checking for nested overlay flows like schedule delete confirm, shift delete confirm, and any other stacked sheet interactions. | Check: Open the schedule planner, tap delete graph, and confirm the delete sheet appears immediately on top of the planner instead of behind it.

## 2026-04-22 01:29:14 +0000

- Source: `manual`
- Task: Stop deleted schedules from resurrecting across devices
- Branch: `main`
- Methods: `Removed the client fallback that automatically re-uploaded non-empty local schedule data whenever the server schedule was empty. Schedule reload now treats the authenticated server response as authoritative and writes that state back into local cache.`
- Files: `scripts/app.js`
- Notes: Why: A deleted graph could reappear because another device with stale local schedule data would see an empty remote schedule and silently upload its old local copy back to the server. | Risks: Legacy one-device-only schedule recovery is no longer automatic from stale local caches; that tradeoff is intentional because silent resurrection of deleted graphs is worse. | Check: Delete a graph on device A, reload device B, confirm the graph stays deleted, then reopen device A and confirm it does not come back.

## 2026-04-22 01:33:03 +0000

- Source: `manual`
- Task: Rebuild schedule sync to match shifts sync pattern
- Branch: `main`
- Methods: `Refactored schedule/graph sync around the same architectural pattern used by shifts: per-user local cache`, `per-user pending snapshot for offline or unconfirmed mutations`, `background flush to`, `flush-on-online/visibility retry`, `and server-authoritative reload after auth. Local legacy schedule storage remains only as a compatibility mirror behind the cache writer`, `not as a source allowed to resurrect remote state.`
- Files: `scripts/app.js`, `scripts/shift-form.js`
- Notes: Why: Egor explicitly asked to stop patching graph sync ad hoc and make it follow the proven shifts sync model. This also fixes cross-device delete/add/edit consistency by preventing stale local schedule state from overriding server truth. | Risks: Manual cross-device verification is still needed for add/edit/delete of graphs, especially after offline edits or quick consecutive changes. | Check: Create or edit a graph on device A, confirm it appears on device B after reload; delete it on one device and confirm it stays deleted on the other; briefly test an offline change and then reconnect to ensure pending schedule sync flushes.

## 2026-04-22 01:42:00 +0000

- Source: `manual`
- Task: Harden graph delete flow against false-success UI
- Branch: `main`
- Methods: `Changed schedule deletion to wait for server-backed schedule save before treating the action as successful. The delete confirm flow now only purges materialized schedule shifts and closes the confirm sheet after schedule save succeeds`, `on error it reloads schedule state from the server and shows a failure toast instead of pretending the graph was deleted.`
- Files: `scripts/app.js`, `scripts/shift-form.js`
- Notes: Why: Egor reported that graph deletion still appeared to succeed locally while the graph remained on other devices. The UI was acknowledging deletion before remote persistence was confirmed. | Risks: Still worth manual cross-device verification after deploy, especially delete on phone followed by desktop reload and vice versa. | Check: Delete a graph while online, verify the success toast appears only once the graph is really gone, and confirm on another device that it stays deleted.

## 2026-04-22 01:55:08 +0000

- Source: `manual`
- Task: Restore offline-first graph deletion behavior
- Branch: `main`
- Methods: `Adjusted schedule delete confirm flow so offline deletion behaves like shifts again: the graph is removed locally immediately`, `stays removed in local pending/cache state`, `and the UI now says sync will happen when the network returns instead of blocking the delete behind online confirmation.`
- Files: `scripts/shift-form.js`
- Notes: Why: Egor explicitly asked not to break existing offline behavior. A previous hardening pass made graph delete feel online-only even though schedule sync is supposed to be offline-first with pending flush. | Risks: Still worth testing offline delete -> app reopen -> reconnect -> other device reload. | Check: Turn network off, delete a graph, confirm it disappears immediately and the UI says sync will happen later, then reconnect and confirm another device reflects the deletion.

## 2026-04-22 02:09:34 +0000

- Source: `manual`
- Task: Подчинил удаление графика local-first оффлайн-синхронизации
- Branch: `main`
- Methods: `Удаление периода графика теперь сразу пишет локальный pending schedule snapshot и сразу же локально удаляет все materialized shifts этого periodId через existing saveShifts offline queue`, `confirm flow больше не откатывает UI из-за сетевой недоступности и не делает отдельный post-delete purge шаг`
- Files: `scripts/app.js`, `scripts/shift-form.js`

## 2026-04-22 02:12:12 +0000

- Source: `manual`
- Task: Сделал local-first оффлайн удаление графика с purge materialized shifts по periodId
- Branch: `main`
- Methods: `reuse existing schedule pending snapshot + manual shift offline saveShifts pipeline`, `removed month-only post-delete rematerialization and network rollback from schedule delete flow`
- Files: `scripts/app.js`, `scripts/shift-form.js`

## 2026-04-22 02:18:17 +0000

- Source: `manual`
- Task: Привёл UI управления графиком к app-wide edit/delete pattern
- Branch: `main`
- Methods: `убрал скрытую логику выбора+нижней панели`, `вынес Редактировать/Удалить прямо в карточки периодов графика`, `сохранил общий confirm sheet для удаления и существующий planner flow`, `выполнил node --check scripts/render.js scripts/shift-form.js и sanity-read index.html/styles/10-navigation-and-cards.css`
- Files: `index.html`, `scripts/render.js`, `scripts/shift-form.js`, `styles/10-navigation-and-cards.css`

## 2026-04-22 02:19:05 +0000

- Source: `manual`
- Task: Привёл UI удаления графика к общему паттерну карточек приложения
- Branch: `main`
- Methods: `moved schedule period edit/delete actions into each period card`, `removed hidden selection-only action row`, `kept destructive confirm bottom-sheet flow`
- Files: `index.html`, `scripts/render.js`, `scripts/shift-form.js`, `styles/10-navigation-and-cards.css`

## 2026-04-22 02:22:05 +0000

- Source: `manual`
- Task: Сделал календарь/график визуально частью общего UI приложения
- Branch: `main`
- Methods: `wrapped month view and planner into settings-card sections`, `aligned copy and card styling with app surfaces`, `added explicit edit-state badge/highlight for schedule form`
- Files: `index.html`, `scripts/render.js`, `scripts/shift-form.js`, `styles/10-navigation-and-cards.css`

## 2026-04-22 02:31:33 +0000

- Source: `manual`
- Task: Сделал экран дня календаря визуально родным для приложения
- Branch: `main`
- Methods: `moved day overlay onto settings-card sections`, `unified CTA copy with shift flows`, `aligned day summary`, `fact and plan blocks with native sheet/card language`
- Files: `index.html`, `scripts/render.js`, `styles/10-navigation-and-cards.css`

## 2026-04-22 02:42:25 +0000

- Source: `manual`
- Task: Сделал тексты календаря понятнее и дружелюбнее для пользователя
- Branch: `main`
- Methods: `rewrote planner`, `day-sheet`, `conflict`, `delete-confirm`, `and toast copy to explain where to tap`, `what action does`, `and what happens next`
- Files: `index.html`, `scripts/render.js`, `scripts/shift-form.js`

## 2026-04-22 03:17:55 +0000

- Source: `manual`
- Task: Дополнительно отполировал микротексты календаря под более понятный и человеческий тон
- Branch: `main`
- Methods: `simplified calendar helper text`, `conflict explanations`, `day statuses`, `CTA labels`, `and delete/offline messages to be more action-oriented and easier to scan`
- Files: `index.html`, `scripts/render.js`, `scripts/shift-form.js`

## 2026-04-22 03:20:26 +0000

- Source: `manual`
- Task: Упростил экран дня графика, убрав лишний summary-блок
- Branch: `main`
- Methods: `moved selected date into sheet header and removed redundant status summary card so day sheet opens directly into fact/plan content and actions`
- Files: `index.html`, `scripts/render.js`, `styles/10-navigation-and-cards.css`

## 2026-04-22 03:22:47 +0000

- Source: `manual`
- Task: Сделал тексты day-sheet понятнее и убрал неестественное 'Работали'
- Branch: `main`
- Methods: `renamed fact section to 'Смена за день'`, `simplified empty-state copy`, `and normalized add-shift CTA to a cleaner direct label`
- Files: `index.html`, `scripts/render.js`

## 2026-04-22 03:24:49 +0000

- Source: `manual`
- Task: Убрал дублирующийся empty-state текст в day-sheet календаря
- Branch: `main`
- Methods: `cleared fact subtitle when no shift card exists so the empty state shows only one message instead of duplicated copy`
- Files: `scripts/render.js`

## 2026-04-22 03:38:21 +0000

- Source: `manual`
- Task: Убрал визуальную матрёшку карточки в day-sheet календаря
- Branch: `main`
- Methods: `when a real shift card is present`, `the outer fact container now drops its own card chrome so only the embedded shift card remains visible`
- Files: `scripts/render.js`, `styles/10-navigation-and-cards.css`

## 2026-04-22 03:47:16 +0000

- Source: `manual`
- Task: Упростил пустое состояние day-sheet без внутренней плашки
- Branch: `main`
- Methods: `removed inner empty-state box and now show the empty-state message as subtle gray helper text under the section title`
- Files: `scripts/render.js`, `styles/10-navigation-and-cards.css`

## 2026-04-22 03:49:42 +0000

- Source: `manual`
- Task: Сжал тексты экрана графика до коротких пошаговых инструкций
- Branch: `main`
- Methods: `replaced paragraph-style helper copy with concise step-based guidance`, `shortened section titles`, `field labels`, `and empty-state copy for faster scanning`
- Files: `index.html`, `scripts/render.js`, `scripts/shift-form.js`

## 2026-04-22 03:53:28 +0000

- Source: `manual`
- Task: Спрятал пустой календарь и собрал инструкцию по графику в одном понятном блоке
- Branch: `main`
- Methods: `hide schedule overview when no periods exist`, `replaced scattered helper copy with a compact 3-step instruction block inside the New period section`
- Files: `index.html`, `scripts/render.js`, `scripts/shift-form.js`, `styles/10-navigation-and-cards.css`

## 2026-04-22 04:00:06 +0000

- Source: `manual`
- Task: Убрал нативную внутреннюю оболочку у кнопок цикла графика
- Branch: `main`
- Methods: `reset native button appearance`, `background-image`, `outline`, `and box-shadow for schedule pattern buttons so the token buttons render as a single clean surface`
- Files: `styles/10-navigation-and-cards.css`

## 2026-04-22 04:06:27 +0000

- Source: `manual`
- Task: Убрал бесполезную подпись под заголовком календаря
- Branch: `main`
- Methods: `removed decorative schedule card subtitle and the render-time subtitle update because the calendar card already communicates itself without redundant narration`
- Files: `index.html`, `scripts/render.js`

## 2026-04-22 04:08:27 +0000

- Source: `manual`
- Task: Подтянул легенду и календарную сетку ближе к заголовку карточки
- Branch: `main`
- Methods: `reduced schedule card vertical gap and tightened header spacing after removing the subtitle so legend and grid sit closer to the title row`
- Files: `styles/10-navigation-and-cards.css`

## 2026-04-22 04:11:33 +0000

- Source: `manual`
- Task: Убрал лишний воздух под заголовком календаря
- Branch: `main`
- Methods: `took the Graph button out of normal header flow with absolute positioning so the tall button no longer stretches the title row and pushes the legend down`
- Files: `styles/10-navigation-and-cards.css`

## 2026-04-22 04:15:53 +0000

- Source: `manual`
- Task: Сделал карточки разделов документов понятнее и короче
- Branch: `main`
- Methods: `replaced awkward instructional labels with human section copy and allowed two-line tile descriptions instead of forced single-line truncation`
- Files: `index.html`, `scripts/app.js`, `styles/10-navigation-and-cards.css`

## 2026-04-22 04:18:55 +0000

- Source: `manual`
- Task: Убрал серый верхний текст у карточек документов и уточнил подписи
- Branch: `main`
- Methods: `hid docs card eyebrow labels entirely so cards start with the main title`, `updated Instructions and Folders descriptions to the user-approved wording`
- Files: `index.html`, `styles/10-navigation-and-cards.css`

## 2026-04-22 04:43:17 +0000

- Source: `manual`
- Task: S2-Retry: safer graph-created shift edit/delete semantics
- Branch: `main`
- Methods: `added anchor-date helpers for materialized graph shifts`, `suppress original graph day when a generated shift is edited onto another date`, `reuse anchor date when deleting generated shifts`, `and clarified delete confirmation copy for graph-created shifts`
- Files: `scripts/app.js`, `scripts/render.js`, `scripts/shift-form.js`

## 2026-04-22 04:44:48 +0000

- Source: `manual`
- Task: S3: смягчил docs/auth first-open и слегка подсушил визуальный шум
- Branch: `main`
- Methods: `manifest cache fallback для docs`, `спокойные offline/slow-network auth messages`, `removal of misleading PRO copy`, `light CSS density/shadow reduction без смены flow`
- Files: `scripts/docs-app.js`, `scripts/auth.js`, `index.html`, `styles/00-base.css`, `styles/10-navigation-and-cards.css`, `styles/30-shifts-and-overlays.css`

## 2026-04-22 05:01:47 +0000

- Source: `manual`
- Task: polish S1 schedule copy clarity
- Branch: `main`
- Methods: `targeted UX-copy updates in render.js after subagent integration`
- Files: `scripts/render.js`

## 2026-04-22 05:13:29 +0000

- Source: `manual`
- Task: fix init order for CURRENT_USER browser smoke
- Branch: `main`
- Methods: `index bootstrap global before deferred app scripts`
- Files: `index.html`

## 2026-04-22 05:14:10 +0000

- Source: `manual`
- Task: fix script load order for auth globals
- Branch: `main`
- Methods: `move auth.js before viewport/app in index.html`
- Files: `index.html`

## 2026-04-22 05:23:02 +0000

- Source: `manual`
- Task: polish P2 defensive hardening
- Branch: `main`
- Methods: `targeted guards and low-risk runtime stabilization`
- Files: `scripts/shift-form.js`

## 2026-04-22 05:23:28 +0000

- Source: `manual`
- Task: polish P1 quiet UX refinements
- Branch: `main`
- Methods: `targeted copy and visual consistency polish`
- Files: `index.html`, `scripts/render.js`, `scripts/docs-app.js`, `styles/30-shifts-and-overlays.css`

## 2026-04-22 05:23:38 +0000

- Source: `manual`
- Task: polish P3 perceived quality refinements
- Branch: `main`
- Methods: `targeted state and interaction polish`
- Files: `scripts/press-feedback.js`, `styles/00-base.css`, `styles/10-navigation-and-cards.css`, `styles/20-form-and-stats.css`, `styles/30-shifts-and-overlays.css`

## 2026-04-22 05:29:06 +0000

- Source: `manual`
- Task: W2-P2 defensive runtime polish for allowed frontend scripts
- Branch: `main`
- Methods: `removed harmless pending-clear console noise`, `added non-element event target guards in shift list handlers`, `and replaced planner reset try/catch with function-existence guard without changing behavior`
- Files: `scripts/app.js`, `scripts/render.js`, `scripts/shift-form.js`

## 2026-04-22 05:30:10 +0000

- Source: `manual`
- Task: Quiet UX polish pass for schedule/docs/auth states
- Branch: `main`
- Methods: `точечные copy-правки пустых/загрузочных/auth состояний`, `мягкая CSS-полировка docs/upcoming states`, `без изменения логики и структуры`
- Files: `scripts/render.js`, `scripts/docs-app.js`, `scripts/auth.js`, `styles/10-navigation-and-cards.css`, `styles/30-shifts-and-overlays.css`

## 2026-04-22 05:33:28 +0000

- Source: `manual`
- Task: W2-P3 subtle perceived-quality polish for auth/docs/form states
- Branch: `main`
- Methods: `Added calmer auth busy/disabled polish`, `improved docs list focus/readability/keyboard access`, `and softened optional-form and primary-button state transitions without changing app structure or data flow`
- Files: `scripts/docs-app.js`, `scripts/auth.js`, `styles/00-base.css`, `styles/20-form-and-stats.css`, `styles/30-shifts-and-overlays.css`

## 2026-04-22 05:40:31 +0000

- Source: `manual`
- Task: Ultra-safe UX/text polish for small auth/docs/calendar states
- Branch: `main`
- Methods: `точечные copy-правки пустых/ошибочных/загрузочных состояний`, `плюс лёгкая readability-полировка CSS без изменения структуры и логики`
- Files: `scripts/render.js`, `scripts/docs-app.js`, `scripts/auth.js`, `styles/00-base.css`, `styles/10-navigation-and-cards.css`, `styles/30-shifts-and-overlays.css`

## 2026-04-22 05:41:38 +0000

- Source: `manual`
- Task: W3-C ultra-safe perceived-quality polish for button and docs states
- Branch: `main`
- Methods: `focused CSS state tuning for focus/disabled/loading plus docs aria-busy/accessibility polish without changing flows`
- Files: `styles/00-base.css`, `styles/20-form-and-stats.css`, `styles/30-shifts-and-overlays.css`, `scripts/docs-app.js`

## 2026-04-22 05:42:00 +0000

- Source: `manual`
- Task: Ultra-safe defensive polish for shift form DOM guards
- Branch: `main`
- Methods: `added null-safe form element helpers`, `guarded key addEventListener bindings`, `preserved existing edit/add semantics`, `validated with node --check scripts/shift-form.js`
- Files: `scripts/shift-form.js`

## 2026-04-22 05:51:32 +0000

- Source: `manual`
- Task: improve docs list naming structure
- Branch: `main`
- Methods: `two-line title/subtitle rendering with category-aware doc labels`
- Files: `scripts/docs-app.js`, `styles/30-shifts-and-overlays.css`

## 2026-04-22 08:23:22 +0000

- Source: `manual`
- Task: Откатил документы до состояния до админки
- Branch: `main`
- Methods: `git stash backup`, `git revert 4 admin-related commits back to a0a8b4d-equivalent state`
- Files: `index.html`, `scripts/docs-app.js`, `styles/30-shifts-and-overlays.css`, `server.js`, `scripts/auth.js`, `styles/10-navigation-and-cards.css`

## 2026-04-22 10:25:31 +0000

- Source: `manual`
- Task: Переименовал режимки в docs UI и убрал серый subtitle
- Branch: `main`
- Methods: `точечная правка docs renderer explicit meta для memo PDF + sync titles/subtitles в docs catalog`
- Files: `scripts/docs-app.js`, `data/docs/catalog.json`

## 2026-04-22 10:28:12 +0000

- Source: `manual`
- Task: Убрал subtitle у карточек папок в docs UI
- Branch: `main`
- Methods: `точечная правка folder display meta в docs renderer`
- Files: `scripts/docs-app.js`

## 2026-04-22 10:36:54 +0000

- Source: `manual`
- Task: Синхронизировал тарифную ставку и зарплатные коэффициенты между PWA и Telegram через сервер
- Branch: `main`
- Methods: `добавил auth API /api/salary-params на VPS backend и клиентскую загрузку/сохранение salary params поверх localStorage`
- Files: `server.js`, `scripts/auth.js`, `scripts/app.js`

## 2026-04-22 11:03:42 +0000

- Source: `manual`
- Task: Развел скорости, режимки и памятки в отдельные карточки docs UI
- Branch: `main`
- Methods: `заменил общий memory entry на отдельные docs entry tiles с иконками и привязал их к собственным docs tabs/entry meta`
- Files: `index.html`, `scripts/app.js`, `scripts/shift-form.js`, `styles/10-navigation-and-cards.css`

## 2026-04-22 11:06:33 +0000

- Source: `manual`
- Task: Зафиксировал durable UI-инструкцию по docs landing
- Branch: `main`
- Methods: `добавил в PROJECT_STATE проектовое правило про отдельные карточки Инструкции/Скорости/Режимки/Памятки/Папки и следующий polish direction`
- Files: `ai-memory/PROJECT_STATE.md`

## 2026-04-22 11:12:38 +0000

- Source: `manual`
- Task: Добавил присланные документы в раздел Инструкции
- Branch: `main`
- Methods: `скопировал 6 файлов в assets/docs/instructions и обновил assets/docs/manifest.json + data/docs/catalog.json`
- Files: `assets/docs/instructions/ПТЭ приказ 250.pdf`, `assets/docs/instructions/ИОТ ТЧЭ-9-002-2023.pdf`, `assets/docs/instructions/Перечень мест где запрещено брать с места.docx`, `assets/docs/instructions/Распоряжение ЦТ-5р Методика КСОТ-П.pdf`, `assets/docs/instructions/ИОТ ТЧЭ-9-003-2023.pdf`, `assets/docs/instructions/1357р безопасное нахождение на ж.д. путях.docx`, `assets/docs/manifest.json`, `data/docs/catalog.json`

## 2026-04-22 11:15:03 +0000

- Source: `manual`
- Task: Добавил присланные файлы в раздел Памятки
- Branch: `main`
- Methods: `скопировал 6 файлов в assets/docs/reminders и обновил assets/docs/manifest.json + data/docs/catalog.json`
- Files: `assets/docs/reminders/Памятка машинисту КПД-3П.docx`, `assets/docs/reminders/Памятка по порядку проведения КП тормозов.pdf`, `assets/docs/reminders/Памятка по КПД-3А.docx`, `assets/docs/reminders/Памятка по эксплуатации аппаратуры КЛУБ.doc`, `assets/docs/reminders/Команды КЛУБ-У.doc`, `assets/docs/reminders/Памятка ТСКБМ.docx`, `assets/docs/manifest.json`, `data/docs/catalog.json`

## 2026-04-22 11:17:26 +0000

- Source: `manual`
- Task: Разрешил коммит docs catalog через gitignore
- Branch: `main`
- Methods: `добавил исключения !data/docs/ и !data/docs/catalog.json в .gitignore`, `чтобы каталог документов коммитился без git add -f`
- Files: `.gitignore`

## 2026-04-22 11:19:49 +0000

- Source: `manual`
- Task: Выровнял loading note в просмотрщике документов
- Branch: `main`
- Methods: `добавил justify-items:center для docs-viewer-loading-block и центрирование для docs-viewer-loading-note`
- Files: `styles/30-shifts-and-overlays.css`

## 2026-04-22 11:24:38 +0000

- Source: `manual`
- Task: Отполировал header просмотрщика документов
- Branch: `main`
- Methods: `усилил стеклянный фон шапки`, `расширил центр`, `сделал статусный блок капсулой и подтянул отступы/типографику back/title/status`
- Files: `styles/30-shifts-and-overlays.css`

## 2026-04-22 11:26:39 +0000

- Source: `manual`
- Task: Убрал block-in-block у статуса viewer
- Branch: `main`
- Methods: `убрал shift-pill из docs viewer status markup и перенес капсулу на сам docs-viewer-status-pill без внешнего контейнера-фона`
- Files: `scripts/docs-app.js`, `styles/30-shifts-and-overlays.css`

## 2026-04-22 11:35:38 +0000

- Source: `manual`
- Task: Обновил подписи карточек Скорости и Режимки
- Branch: `main`
- Methods: `заменил подписи на 'Скорости по участкам' и 'Режимные карты по участкам' в landing docs и entry meta`
- Files: `index.html`, `scripts/app.js`

## 2026-04-22 11:37:07 +0000

- Source: `manual`
- Task: Обновил подпись карточки Памятки
- Branch: `main`
- Methods: `заменил подпись на 'Небольшие рабочие шпаргалки' в landing docs и entry meta`
- Files: `index.html`, `scripts/app.js`

## 2026-04-22 23:20:52 +0000

- Source: `manual`
- Task: Исправил время материализованных ночных смен из графика
- Branch: `main`
- Methods: `ночные смены теперь получают обратное окно времени от дневного через resolveScheduleShiftWindow`, `при открытии приложения текущий месяц перематериализуется`, `чтобы старые 01:00-13:00 ночные смены обновились`
- Files: `scripts/app.js`, `scripts/auth.js`

## 2026-04-22 23:59:19 +0000

- Source: `manual`
- Task: Исправил двойной переворот времени ночной смены из графика
- Branch: `main`
- Methods: `buildMaterializedScheduleShift больше не инвертирует окно повторно`, `теперь использует уже рассчитанные startTime/endTime из snapshot/state`
- Files: `scripts/app.js`

## 2026-04-23 00:11:41 +0000

- Source: `manual`
- Task: Унифицировал определение Д/Н по локальному времени
- Branch: `main`
- Methods: `добавил inferShiftWorkCodeByLocalTime: код смены теперь определяется по преобладанию ночных часов в локальной таймзоне`, `подключил эту логику к отображению факта`, `ручному сохранению смен и материализации смен из графика`
- Files: `scripts/time-utils.js`, `scripts/app.js`, `scripts/shift-form.js`

## 2026-04-23 00:17:44 +0000

- Source: `manual`
- Task: Сделал карточки смен читабельнее
- Branch: `main`
- Methods: `усилил контраст direction/datetime/tech/fuel строк и разложил поездные данные в grid вместо длинной серой ленты`, `в compact режиме техданные идут одной колонкой`
- Files: `styles/30-shifts-and-overlays.css`

## 2026-04-23 00:20:10 +0000

- Source: `manual`
- Task: Оформил техданные смен бейджами
- Branch: `main`
- Methods: `поездные данные теперь рендерятся как цветные чипы по категориям (локомотив/поезд/вес/вагоны/оси) вместо текстовой простыни`, `подправлены отступы и compact режим`
- Files: `scripts/time-utils.js`, `styles/30-shifts-and-overlays.css`

## 2026-04-23 00:22:04 +0000

- Source: `manual`
- Task: Перевел всю карточку смены на единый чиповый стиль
- Branch: `main`
- Methods: `type/direction/datetime/duration/income label/income value теперь оформлены как согласованные pill-чипы`, `выровнены отступы и wrap для всей карточки`
- Files: `styles/30-shifts-and-overlays.css`

## 2026-04-23 00:44:09 +0000

- Source: `manual`
- Task: Откатил редизайн карточек смен к исходному виду
- Branch: `main`
- Methods: `git revert пяти последних UI-коммитов по карточкам`, `вернул состояние файлов к commit 749a47b`, `проверил syntax check`
- Files: `scripts/render.js`, `scripts/time-utils.js`, `styles/30-shifts-and-overlays.css`, `sw.js`

## 2026-04-23 00:46:25 +0000

- Source: `manual`
- Task: Откатил более ранние правки карточек смен
- Branch: `main`
- Methods: `git revert коммитов 749a47b`, `6ac85a1 и 5351381 с ручным разрешением конфликтов только в ai-memory файлах и последующей syntax-проверкой`
- Files: `scripts/time-utils.js`, `styles/30-shifts-and-overlays.css`

## 2026-04-23 00:48:51 +0000

- Source: `manual`
- Task: Убрал капсулу у отработанных часов в карточке
- Branch: `main`
- Methods: `оставил длительность в той же строке`, `но снял фон/бордер/паддинги`, `сделал её спокойным текстовым индикатором`, `bumped SW cache version`
- Files: `styles/30-shifts-and-overlays.css`, `sw.js`

## 2026-04-23 00:50:06 +0000

- Source: `manual`
- Task: Прижал длительность вправо в одной строке с явкой
- Branch: `main`
- Methods: `для shift-main-row запретил перенос`, `а shift-duration сделал right-aligned с margin-left:auto`, `bumped SW cache version`
- Files: `styles/30-shifts-and-overlays.css`, `sw.js`

## 2026-04-23 00:51:49 +0000

- Source: `manual`
- Task: Разложил поездные данные на две строки
- Branch: `main`
- Methods: `первую строку технических данных сделал из локомотива и номера поезда`, `вторую — из веса`, `длины и осей`, `добавил row-based CSS и bumped SW cache version`
- Files: `scripts/time-utils.js`, `styles/30-shifts-and-overlays.css`, `sw.js`

## 2026-04-23 00:53:52 +0000

- Source: `manual`
- Task: Переставил направление ниже блока времени в карточках
- Branch: `main`
- Methods: `в списке`, `confirm-card и hero-card перенёс directionHtml под shift-main-row`, `затем bumped SW cache version`
- Files: `scripts/render.js`, `scripts/time-utils.js`, `sw.js`

## 2026-04-23 00:56:36 +0000

- Source: `manual`
- Task: Начал разбор бага с зависающим override после удаления графика
- Branch: `main`
- Methods: `воспроизведение по описанию пользователя и code search по schedule deletion/materialization/override paths`
- Files: `scripts`, `server.js`

## 2026-04-23 00:57:29 +0000

- Source: `manual`
- Task: Пофиксил зависающий override после удаления графика
- Branch: `main`
- Methods: `в deleteSchedulePeriod добавил очистку scheduleStore.overrides по диапазону удаляемого периода перед saveScheduleStore`, `сохранил purge materialized shifts`
- Files: `scripts/app.js`

## 2026-04-23 01:02:06 +0000

- Source: `manual`
- Task: Переподчинил schedule overrides конкретному графику
- Branch: `main`
- Methods: `добавил periodId в client/server schedule overrides`, `стал применять override только при совпадении active period id`, `обновил вызовы setScheduleDayOverride из delete/edit flow и bumped SW cache version`
- Files: `scripts/app.js`, `scripts/shift-form.js`, `server.js`, `sw.js`

## 2026-04-23 01:05:26 +0000

- Source: `manual`
- Task: Добавил fallback periodId для ручного delete/edit графиковых смен
- Branch: `main`
- Methods: `если у смены нет schedule_period_id`, `getScheduleGeneratedShiftDeleteMeta и setScheduleDayOverride берут active period по дате`, `editing flow получил такой же fallback`
- Files: `scripts/app.js`, `scripts/shift-form.js`, `sw.js`

## 2026-04-23 01:09:57 +0000

- Source: `manual`
- Task: Добавил локальный resync дня после schedule override
- Branch: `main`
- Methods: `после delete/edit suppression графиковой смены сразу вызываю syncMaterializedScheduleShiftsForRange(date`, `date)`, `чтобы ночь не материализовалась обратно до сохранения shifts`, `bumped SW cache`
- Files: `scripts/shift-form.js`, `sw.js`

## 2026-04-23 01:16:56 +0000

- Source: `manual`
- Task: Подчинил ручные правки графику при удалении периода
- Branch: `main`
- Methods: `ручные правки графиковых смен теперь сохраняют schedule_origin_period_id/date_key`, `purgeMaterializedScheduleShiftsForPeriodIds удаляет materialized`, `derived manual и legacy edited schedule_* записи по удаляемому periodId`, `очистку overrides перевёл на periodId вместо диапазона`, `bumped SW cache`
- Files: `scripts/app.js`, `scripts/shift-form.js`, `sw.js`

## 2026-04-23 01:20:29 +0000

- Source: `manual`
- Task: Привязал add-from-schedule-day к source period
- Branch: `main`
- Methods: `openAddShiftForDate теперь принимает scheduleOrigin и кладёт его во временное состояние формы`, `save нового manual shift наследует schedule_origin_period_id/date_key`, `state очищается при exit/success`, `bumped SW cache`
- Files: `scripts/app.js`, `scripts/shift-form.js`, `sw.js`

## 2026-04-23 01:23:20 +0000

- Source: `manual`
- Task: Починил delete flow для schedule-origin manual shifts
- Branch: `main`
- Methods: `getScheduleGeneratedShiftDeleteMeta теперь распознаёт не только materialized schedule shifts`, `но и ручные смены с schedule_origin_date_key/period_id`, `delete снова ставит V для связанного дня графика`, `bumped SW cache`
- Files: `scripts/app.js`, `sw.js`

## 2026-04-23 09:37:32 +0000

- Source: `manual`
- Task: Remove user-facing graph/schedule flow in isolated branch
- Branch: `chore/remove-graphs-and-restore-calendar-flow`
- Methods: `separate worktree/branch`, `removed home calendar surface and schedule API path`, `filtered schedule-derived shifts from display/calculations`, `stripped schedule metadata on client/server`, `verified with node --check and local smoke`
- Files: `index.html`, `scripts/app.js`, `scripts/auth.js`, `scripts/render.js`, `scripts/shift-form.js`, `server.js`

## 2026-04-23 16:04:01 +0000

- Source: `manual-calendar-polish`
- Task: Починка runtime-регрессий и доводка ручного календаря до prod-candidate UX в отдельной ветке
- Branch: `feat/manual-calendar-from-scratch`
- Methods: `UI polish`, `runtime helper restoration`, `local smoke`, `custom Playwright browser scenario`
- Files: `index.html`, `scripts/app.js`, `scripts/render.js`, `scripts/shift-form.js`, `styles/10-navigation-and-cards.css`

## 2026-04-25 07:51:32 +1000

- Source: `manual`
- Task: Проверено состояние Git/VPS после большого обновления и исправлены найденные runtime/tooling баги
- Branch: `main`
- Methods: `git fetch/pull --ff-only до origin/main 379ec2e`, `read-only VPS git/PM2/HTTP checks`, `PM2 error log выявил getUserSalaryParamsFile ReferenceError`, `добавлен helper в server.js`, `local-smoke path исправлен через fileURLToPath`, `выполнены node --check`, `py_compile`, `npm run smoke:local`, `локальный GET/PUT /api/salary-params`, `npm audit --omit=dev`
- Files: `server.js`, `scripts/local-smoke.mjs`, `ai-memory`

## 2026-04-25 07:56:58 +1000

- Source: `manual`
- Task: Проведён аудит проекта на неиспользуемый и legacy-код
- Branch: `main`
- Methods: `проверены entrypoints index/sw/package`, `git grep по старым instructions/schedule/timer/cloudflare хвостам`, `сопоставлены DOM ids с JS handlers`, `проверены размеры runtime-файлов и актуальность README относительно VPS runtime`
- Files: `index.html`, `scripts/instructions-app.js`, `scripts/shift-form.js`, `scripts/app.js`, `scripts/auth.js`, `sw.js`, `styles/35-timer.css`, `README.md`, `functions`, `wrangler.toml`

## 2026-04-25 08:03:36 +1000

- Source: `manual`
- Task: Удалён legacy-мусор после аудита
- Branch: `main`
- Methods: `убраны старый instructions runtime и assets dataset`, `удалён inactive Cloudflare/D1 backend и wrangler`, `удалены stopwatch stubs и отдельный timer CSS`, `перенесены активные sheet styles в 30-shifts-and-overlays`, `удалены no-op schedule hooks и unused DOCS_API_URL`, `README/scripts/styles/memory обновлены под VPS server.js runtime`, `проверки node --check`, `npm run smoke:local`, `npm audit --omit=dev`
- Files: `index.html`, `sw.js`, `scripts`, `styles`, `README.md`, `server.js`, `assets/instructions`, `functions`, `wrangler.toml`, `ai-memory`

## 2026-04-25 08:06:26 +1000

- Source: `post-commit`
- Task: refactor: remove legacy runtime dead code
- Branch: `main`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `README.md`, `ai-memory/ARCHITECTURE.md`, `ai-memory/CHANGELOG.md`, `ai-memory/INDEX.md`, `ai-memory/METHODS.md`, `ai-memory/PROJECT_STATE.md`, `ai-memory/RECENT_COMMITS.md`, `ai-memory/WORKTREE_STATUS.md`, `ai-memory/sessions/2026-04-25.md`, `assets/instructions/catalog.v1.json`, `assets/instructions/catalog.v2.json`, `assets/instructions/sources.v2.json`, `functions/api/auth.js`, `functions/api/docs.js`, `functions/api/shifts.js`, `functions/api/stats.js`, `functions/api/telegram-webhook.js`, `functions/features/auth/telegram-auth.js`, `functions/features/docs/store.js`, `functions/features/shifts/store.js`, `functions/features/shifts/validation.js`, `functions/features/stats/store.js`, `index.html`, `scripts/README.md`, `scripts/app.js`, `scripts/auth.js`, `scripts/build-instructions-dataset.py`, `scripts/instructions-app.js`, `scripts/local-smoke.mjs`, `scripts/render.js`, `scripts/shift-form.js`, `scripts/stopwatch-app.js`, `scripts/stopwatch-engine.js`, `server.js`, `styles/30-shifts-and-overlays.css`, `styles/35-timer.css`, `styles/README.md`, `sw.js`, `wrangler.toml`
- Notes: Commit: `bca019509c390509e670faab522a5476ac9aa33f` (`bca0195`) | Author: `iEgor72`

## 2026-04-25 08:06:40 +1000

- Source: `post-commit`
- Task: chore(memory): refresh after legacy cleanup
- Branch: `main`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `ai-memory/CHANGELOG.md`, `ai-memory/INDEX.md`, `ai-memory/PROJECT_STATE.md`, `ai-memory/RECENT_COMMITS.md`, `ai-memory/WORKTREE_STATUS.md`, `ai-memory/sessions/2026-04-25.md`
- Notes: Commit: `c631e1b1c26f88374689e9e2a1da59e0faaa677b` (`c631e1b`) | Author: `iEgor72`

## 2026-04-25 08:08:53 +1000

- Source: `manual`
- Task: Выкатка legacy cleanup на VPS
- Branch: `main`
- Methods: `git push origin main до c631e1b`, `на VPS сохранён dirty ai-memory stash deploy-memory-before-c631e1b`, `git pull --ff-only`, `pm2 reload bloknot-mashinista --update-env`, `проверены HEAD/ORIGIN c631e1b`, `PM2 online`, `HTTPS 200`, `sw.js 200`, `docs manifest`, `HTML без удалённых asset refs`, `headless Playwright prod smoke`
- Files: `server.js`, `index.html`, `sw.js`, `scripts`, `styles`, `README.md`, `ai-memory`

## 2026-04-25 09:01:17 +1000

- Source: `manual`
- Task: Интегрировал расчет зарплаты и режим Поехали из APK
- Branch: `main`
- Methods: `Разобрал APK TrainNote`, `перенес зарплатную формулу в PWA: норма месяца`, `переработка`, `4% доплата`, `зональная/БАМ`, `командировочные`, `добавил быстрый режим Поехали со стартом и сдачей в форму смены`
- Files: `server.js`, `scripts/app.js`, `scripts/render.js`, `scripts/shift-form.js`, `index.html`, `styles/10-navigation-and-cards.css`, `styles/40-premium-refresh.css`, `sw.js`

## 2026-04-25 09:12:01 +1000

- Source: `manual`
- Task: Переделал Поехали и отключил локальную авторизацию
- Branch: `main`
- Methods: `Удалил быстрые Старт/Сдать`, `добавил отдельную вкладку Поехали с GPS-watch при запуске режима`, `добавил dev-local auth bypass только для localhost/non-production`, `проверил node --check и smoke`
- Files: `server.js`, `scripts/auth.js`, `scripts/app.js`, `scripts/shift-form.js`, `index.html`, `styles/10-navigation-and-cards.css`, `styles/40-premium-refresh.css`, `sw.js`

## 2026-04-25 09:32:09 +1000

- Source: `manual`
- Task: Started full Poekhali tracker port from APK
- Branch: `main`
- Methods: `Extracted APK tracker assets data.xml/profile.xml into assets/tracker and mapped WorkLocationManager/EMap behavior for browser implementation`
- Files: `assets/tracker/data.xml`, `assets/tracker/profile.xml`

## 2026-04-25 09:37:28 +1000

- Source: `manual`
- Task: Implemented APK-backed Poekhali web tracker
- Branch: `main`
- Methods: `Replaced placeholder rail UI with fullscreen canvas tracker`, `added APK map/profile asset loading`, `GPS watch`, `nearest-track projection`, `line coordinate`, `direction/path/timer controls`, `and hidden bottom nav mode`
- Files: `index.html`, `scripts/poekhali-tracker.js`, `scripts/app.js`, `scripts/auth.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `assets/tracker/data.xml`, `assets/tracker/profile.xml`

## 2026-04-25 09:44:49 +1000

- Source: `manual`
- Task: Fixed Poekhali GPS/map initialization order
- Branch: `main`
- Methods: `Re-applied the last GPS fix after APK map assets finish loading and reused one projection helper for direction changes`
- Files: `scripts/poekhali-tracker.js`

## 2026-04-25 09:45:19 +1000

- Source: `manual`
- Task: Investigate APK map downloads
- Branch: `main`
- Methods: `Started search for network URLs`, `downloader classes`, `and map storage format in the APK/decompiled sources`
- Files: `D:/Загрузки/cs12d7a.4pda.ws`

## 2026-04-25 10:00:00 +1000

- Source: `manual`
- Task: Added APK map source downloader
- Branch: `main`
- Methods: `Decoded APK Firebase Storage source`, `listed ek_files`, `added downloader/manifest integration`, `and recorded current cloud download failures`
- Files: `scripts/download-poekhali-maps.mjs`, `assets/tracker/maps-manifest.json`, `scripts/poekhali-tracker.js`, `index.html`, `styles/10-navigation-and-cards.css`, `sw.js`, `package.json`

## 2026-04-25 10:02:29 +1000

- Source: `manual`
- Task: Verified Poekhali map manifest and tracker rendering
- Branch: `main`
- Methods: `Ran smoke test`, `checked local static assets`, `verified in-app fresh origin`, `and tested GPS projection with mocked APK route coordinate`
- Files: `scripts/poekhali-tracker.js`, `assets/tracker/maps-manifest.json`, `scripts/download-poekhali-maps.mjs`

## 2026-04-25 11:50:39 +1000

- Source: `manual`
- Task: Adapted Poekhali mode UI to app design
- Branch: `main`
- Methods: `Restyled Poekhali fullscreen controls and canvas HUD/route/profile/metrics with app theme tokens`, `bumped service worker cache version`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`

## 2026-04-25 11:52:52 +1000

- Source: `manual`
- Task: Fixed Poekhali metric tile fit
- Branch: `main`
- Methods: `Shortened GPS bottom metric value to accuracy-only text and kept satellite count as compact secondary label`
- Files: `scripts/poekhali-tracker.js`

## 2026-04-25 11:54:36 +1000

- Source: `manual`
- Task: Polished Poekhali profile rendering
- Branch: `main`
- Methods: `Clipped the profile graph inside its card and simplified empty accuracy text`
- Files: `scripts/poekhali-tracker.js`

## 2026-04-25 11:55:32 +1000

- Source: `manual`
- Task: Bumped cache for final Poekhali UI
- Branch: `main`
- Methods: `Updated service worker cache version after final tracker UI adjustments so refreshed clients pull the latest assets`
- Files: `sw.js`, `scripts/poekhali-tracker.js`

## 2026-04-25 12:00:09 +1000

- Source: `manual`
- Task: Inspected uploaded TCH9 SQLite database
- Branch: `main`
- Methods: `Opened tch9_v43_d25.04.26.db read-only with sqlite3 module`, `checked schema/table counts/sample reference rows`, `verified absence of GPS coordinate/map tile/profile columns`
- Files: `D:/Загрузки/tch9_v43_d25.04.26.db`

## 2026-04-25 14:07:59 +1000

- Source: `manual`
- Task: Identified original APK EMap download entry point
- Branch: `main`
- Methods: `Parsed APK dex strings and local manifest`, `confirmed EkFileExplorer/askToDownloadEMap flow and remote ek_files/Комсомольск ТЧЭ-9.zip map source versus database download`
- Files: `D:/Загрузки/cs12d7a.4pda.ws`, `assets/tracker/maps-manifest.json`

## 2026-04-25 14:18:25 +1000

- Source: `manual`
- Task: Imported TCH9 reference DB
- Branch: `main`
- Methods: `Added SQLite-to-JSON import script`, `generated tch9-reference.json`, `connected it to Poekhali tracker`, `and added the asset to service worker cache`
- Files: `scripts/import-tch9-reference.py`, `assets/tracker/tch9-reference.json`, `scripts/poekhali-tracker.js`, `sw.js`, `package.json`

## 2026-04-25 14:19:48 +1000

- Source: `manual`
- Task: Verified TCH9 reference import in Poekhali
- Branch: `main`
- Methods: `Ran syntax checks`, `local smoke`, `fetched JSON over localhost`, `opened v58 in app browser`, `and ran mocked GPS Playwright check with reference asset loaded`
- Files: `assets/tracker/tch9-reference.json`, `scripts/poekhali-tracker.js`, `sw.js`

## 2026-04-25 14:21:19 +1000

- Source: `manual`
- Task: Ignored generated import artifacts
- Branch: `main`
- Methods: `Added gitignore entries for Python bytecode cache and browser/test screenshots produced while verifying the TCH9 import.`
- Files: `.gitignore`

## 2026-04-25 14:37:10 +1000

- Source: `manual`
- Task: Identified Android EMap storage paths
- Branch: `main`
- Methods: `Inspected APK manifest and dex bytecode`, `confirmed package ru.badlog.trainnote`, `DownloadManager destination in external app-specific Downloads`, `and importEk unzip target in private getDir('emap') storage.`
- Files: `D:/Загрузки/cs12d7a.4pda.ws`

## 2026-04-25 15:04:29 +1000

- Source: `manual`
- Task: Recovered TCH9 EMap from connected phone
- Branch: `main`
- Methods: `Used adb against Redmi Note 9 Pro`, `confirmed external app-specific Download folders were empty`, `exported ru.badlog.trainnote with adb backup after phone confirmation`, `unpacked only app_emap XML files`, `installed them as the komsomol-sk-tche-9 map`, `updated manifest/default map/cache`, `and verified v59 locally.`
- Files: `assets/tracker/maps/komsomol-sk-tche-9`, `data.xml`, `profile.xml`, `speed.xml`, `assets/tracker/maps-manifest.json`, `scripts/poekhali-tracker.js`, `sw.js`

## 2026-04-25 15:16:22 +1000

- Source: `manual`
- Task: Fixed Poekhali sector and coordinate display
- Branch: `main`
- Methods: `Preserved sector ids while parsing EMap data.xml`, `grouped route segments by sector instead of global ordinate`, `used XML sector in GPS projection`, `switched default coordinate display to km/pk`, `bumped SW cache to v60`, `and verified mocked GPS renders sector 1 with 7271 km 1 pk.`
- Files: `scripts/poekhali-tracker.js`, `sw.js`

## 2026-04-25 15:32:05 +1000

- Source: `manual`
- Task: Reworked Poekhali mode to render EMap profile objects
- Branch: `main`
- Methods: `Loaded object XML files 1/1n/2/2n and speed.xml`, `parsed profile by sector with elevations`, `rendered profile/track/stations/signals/km-pk/speed bands on the Poekhali canvas`, `bumped SW cache to v61`, `verified syntax`, `smoke`, `and mocked GPS Playwright checks for sector 1 and sector 9.`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `assets/tracker/maps/komsomol-sk-tche-9`

## 2026-04-25 16:06:27 +1000

- Source: `manual`
- Task: Перенес режим Поехали ближе к APK: фиксированная голова состава, движущиеся пикеты, профиль, станции, сигналы и скорости из XML
- Branch: `main`
- Methods: `Разобрал APK-алгоритм PicketManager/TrainObject`, `заменил стрелочный renderer canvas на APK-подобный`, `исправил парсинг XML координат в метрах`, `проверил Playwright на участках 9 и 1`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `assets/tracker/maps/komsomol-sk-tche-9/*`

## 2026-04-25 16:20:11 +1000

- Source: `manual`
- Task: Перенес сущности Поехали на профиль пути
- Branch: `main`
- Methods: `Убрал отдельную горизонтальную ось из основного рендера`, `привязал поезд`, `станции`, `светофоры`, `скоростные ограничения`, `ПК и уклоны к линии профиля`, `добавил пунктирные проекции вниз`, `проверил sector 9/sector 1 и все 20 участков карты через Playwright`
- Files: `scripts/poekhali-tracker.js`, `sw.js`

## 2026-04-25 16:30:57 +1000

- Source: `manual`
- Task: Развел слои Поехали и вернул нижнее меню
- Branch: `main`
- Methods: `Вернул bottom-nav в режиме Поехали`, `поднял таймер над меню`, `опустил профиль`, `добавил отдельную рельсу-шкалу для км/ПК`, `подписал текущий километр пикетами`, `развел скорости/станции/светофоры/уклоны по профилю`, `проверил 20 участков карты через Playwright`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`

## 2026-04-25 17:12:56 +1000

- Source: `manual`
- Task: Polished Poekhali mode UI and verified imported TCH9 map sectors
- Branch: `main`
- Methods: `Updated canvas renderer composition: scene background`, `profile grid`, `cleaner KM/PK rail`, `profile-bound speed and grade labels`, `train marker on profile`, `app-style bottom status panel`, `adjusted narrow overlay button CSS`, `bumped service worker cache to v70`, `verified with Playwright screenshots`, `syntax checks`, `smoke test`, `and 20-sector map pixel pass.`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`

## 2026-04-25 17:27:51 +1000

- Source: `manual`
- Task: Productized Poekhali mode interface polish
- Branch: `main`
- Methods: `Added live operational summary for location`, `speed limit`, `grade and next signal`, `replaced raw no-GPS state with a readiness/status card and map/object counts`, `compacted bottom metrics on narrow screens`, `hid the map switch on very narrow widths to prevent GPS overlap`, `bumped SW cache to v72`, `verified syntax`, `local smoke`, `browser screenshots`, `and all 20 TCH9 sectors.`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`

## 2026-04-25 17:54:32 +1000

- Source: `manual`
- Task: Continued Poekhali production polish
- Branch: `main`
- Methods: `Added compact top controls that keep the EK map selector clickable on narrow screens`, `made GPS labels responsive`, `separated grade labels from speed bands`, `refined the train marker with a directional nose`, `verified the map picker in the in-app browser`, `ran syntax checks`, `smoke test`, `screenshots`, `and a 20-sector TCH9 Playwright pass`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`

## 2026-04-25 18:12:25 +1000

- Source: `manual`
- Task: Made Poekhali map mode usable without GPS
- Branch: `main`
- Methods: `Rendered a real downloaded EMap profile preview when GPS is unavailable`, `added drag browsing across the current sector`, `persisted/reused last valid projection`, `hardened numeric sector checks to avoid null coordinates`, `changed service worker code assets to network-first so local reloads pick up current JS/CSS`, `verified in the in-app browser`, `syntax checks`, `smoke test`, `and all 20 TCH9 sectors`
- Files: `scripts/poekhali-tracker.js`, `sw.js`

## 2026-04-25 18:23:41 +1000

- Source: `manual`
- Task: Cleaned up Poekhali preview composition
- Branch: `main`
- Methods: `Separated no-GPS map preview from live driving mode`, `removed the fake train from preview`, `replaced it with a slim browse cursor`, `changed preview HUD and bottom metrics to show section/km/pk instead of speed`, `tightened station/signal/speed/grade label density`, `bumped SW cache`, `verified syntax`, `local smoke`, `in-app browser v85`, `preview contact sheet`, `and all 20 TCH9 GPS sectors`
- Files: `scripts/poekhali-tracker.js`, `sw.js`

## 2026-04-25 18:40:56 +1000

- Source: `manual`
- Task: Polished Poekhali production UI v90
- Branch: `main`
- Methods: `Replaced preview map statistics with operational point status`, `added shared label collision avoidance across stations/signals/speed/grade layers`, `normalized and lane-assigned speed restrictions`, `raised the profile baseline`, `cleaned KM/PK rail labels`, `compacted Poekhali bottom nav on narrow screens`, `bumped SW cache`, `verified in the in-app browser`, `syntax checks`, `smoke test`, `live sector screenshot`, `and 20-sector GPS pixel pass.`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`

## 2026-04-26 08:05:45 +1000

- Source: `manual`
- Task: Completed Poekhali all-sector production readiness pass
- Branch: `main`
- Methods: `Added an EK sector picker for all 20 route sectors with KM/PK ranges`, `profile availability`, `and object counts`, `persisted preview sector selection`, `allowed preview dragging across sector boundaries`, `marked route-only sectors honestly when profile.xml has no profile data`, `fixed long coordinate/time overlap in the top HUD`, `bumped service worker cache to v92`, `verified browser UI`, `syntax`, `smoke`, `diff check`, `and 20 preview plus 20 live GPS sector Playwright passes.`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`

## 2026-04-26 08:23:53 +1000

- Source: `manual`
- Task: Связал Поехали с карточкой смены
- Branch: `main`
- Methods: `Данные состава берутся из активной или последней карточки смены`, `длина поезда в профиле считается из условной длины смены`, `предупреждения привязаны к смене и рисуются как ПР на скоростном профиле`, `добавлена панель карточки/предупреждений и обновлен SW cache`
- Files: `scripts/poekhali-tracker.js`, `index.html`, `styles/10-navigation-and-cards.css`, `sw.js`

## 2026-04-26 08:28:28 +1000

- Source: `manual`
- Task: Зафиксировал ТЗ parity для переноса APK
- Branch: `main`
- Methods: `Создал документ сравнения оригинального APK и текущего приложения`, `разложил функционал Поехали`, `карт`, `предупреждений`, `зарплаты`, `топлива и справочников по статусам и приоритетам`
- Files: `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 08:46:15 +1000

- Source: `manual`
- Task: Добавил дообучение карты Поехали и модель источников
- Branch: `main`
- Methods: `Зафиксировал в ТЗ слоистую модель данных: ЭК`, `актуальные документы скоростей`, `открытые источники`, `GPS устройства и пользовательские правки`, `добавил сбор GPS-точек по карте/участку/смене`, `построение GPS-профиля для участков без profile.xml`, `отображение статуса доученного профиля в Поехали и секции Дообучение карты в панели ПР`, `исправил service worker`, `чтобы HTML оболочка обновлялась network-first`, `а не залипала на старом кэше.`
- Files: `docs/2026-04-26-poekhali-parity-tz.md`, `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`

## 2026-04-26 09:04:04 +1000

- Source: `manual`
- Task: Подключил актуальные скорости из документов в Поехали
- Branch: `main`
- Methods: `Добавил импорт PDF скоростей в JSON слой`, `загрузку speed-docs в Поехали`, `секцию ДОК в панели ПР`, `приоритет ДОК выше ЭК в активном ограничении`, `кэширование speed-docs в SW и проверку v96 в in-app browser`
- Files: `scripts/import-speed-docs.py`, `assets/tracker/speed-docs.json`, `scripts/poekhali-tracker.js`, `sw.js`, `package.json`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 09:08:59 +1000

- Source: `manual`
- Task: Добавил диагностику конфликтов ЭК/ДОК в Поехали
- Branch: `main`
- Methods: `Сравнил документные ограничения с ограничениями ЭК на пересекающихся интервалах`, `вывел счетчик конфликтов в секцию скоростей из документов`, `подсветил конфликтные ДОК-правила на профиле и обновил SW cache до v97`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 09:14:05 +1000

- Source: `manual`
- Task: Добавил подробный список конфликтов ЭК/ДОК
- Branch: `main`
- Methods: `Сделал список ближайших конфликтов документных скоростей с ЭК в панели ПР`, `показал участок`, `км/пк`, `ДОК/ЭК скорости`, `источник и страницу документа`, `добавил переход по строке к месту на профиле`, `обновил SW cache до v98 и проверил браузерный сценарий`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 09:22:02 +1000

- Source: `manual`
- Task: Добавил карточку разбора конфликта ЭК/ДОК
- Branch: `main`
- Methods: `Вывел выбранный конфликт из списка документов скоростей прямо на экран режима Поехали: диапазон`, `скорость ДОК`, `скорость ЭК`, `разница`, `источник`, `дата и страница`, `добавил закрытие карточки и обновил отметку ТЗ.`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 09:32:15 +1000

- Source: `manual`
- Task: Доработал предупреждения Поехали до рабочего управления
- Branch: `main`
- Methods: `Добавил срок действия ПР`, `редактирование`, `включение/отключение`, `статус активное/впереди/пройдено/отключено/истекло`, `исключил отключенные и просроченные ПР из активного ограничения скорости`, `проверил v101 в браузере.`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 09:39:40 +1000

- Source: `manual`
- Task: Добавил предупреждение о приближении к ПР в Поехали
- Branch: `main`
- Methods: `Рассчитываю ближайшее активное или предстоящее ПР по направлению движения`, `вывожу его в верхнем HUD вместо менее важного сигнала`, `рисую отдельный маркер ПР на профиле`, `оставляю активное ПР приоритетным ограничением скорости`, `проверил v103 в браузере.`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 09:46:32 +1000

- Source: `manual`
- Task: Связал маршрут смены с режимом Поехали
- Branch: `main`
- Methods: `Добавил сопоставление route_from/route_to со станциями EMap`, `расчет направления ЧЕТ/НЕЧЕТ и стартовой координаты`, `секцию Маршрут смены в панели ПР и кнопку Применить маршрут`, `добавил fallback автопревью по маршруту`, `если нет GPS/последней позиции.`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 09:57:41 +1000

- Source: `manual`
- Task: Добавил диагностику готовности карты Поехали
- Branch: `main`
- Methods: `Считаю покрытие установленной EMap по участкам: линия маршрута`, `профиль ЭК/GPS/общий/нет`, `скорости`, `станции/светофоры`, `вывел секцию Готовность карты в панели ПР с переходом к первому проблемному участку`, `обновил ТЗ и cache до v105`, `проверил node --check`, `smoke:local и браузерный сценарий.`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 10:17:17 +1000

- Source: `manual`
- Task: Подключил режимные карты к Поехали
- Branch: `main`
- Methods: `Добавил импорт assets/docs/memos/*.pdf в assets/tracker/regime-maps.json`, `индексирую страницы РК по километрам`, `станциям`, `скоростям и признакам профиля`, `подключил слой РК в poekhali-tracker`, `вывел секцию Режимные карты`, `добавил РК в готовность карты и пометку профиля из РК на рабочем экране`, `обновил cache до v106 и ТЗ`, `проверил py_compile`, `node --check`, `smoke:local и браузер v106.`
- Files: `scripts/import-regime-maps.py`, `assets/tracker/regime-maps.json`, `scripts/poekhali-tracker.js`, `package.json`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 10:33:09 +1000

- Source: `manual`
- Task: Подключил профильные сегменты режимных карт к Поехали
- Branch: `main`
- Methods: `Расширил импорт РК извлечением пар уклон-длина в profileSegments`, `пересобрал regime-maps.json на 551 сегмент`, `построил индекс РК по участкам в poekhali-tracker`, `добавил источник профиля РК после ЭК/GPS и до общего fallback`, `вывел сегменты в панели ПР`, `обновил ТЗ и SW cache до v107`, `проверил py_compile`, `node --check`, `smoke:local и браузер v107.`
- Files: `scripts/import-regime-maps.py`, `assets/tracker/regime-maps.json`, `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 10:54:21 +1000

- Source: `manual`
- Task: Добавил скорости и станции РК в Поехали
- Branch: `main`
- Methods: `Расширил импорт режимных карт: читаю геометрию PDF через pdfplumber`, `строю километровую ось страницы`, `привязываю подписи скоростей к интервалам`, `добавляю координатно подтвержденные станции`, `в poekhali-tracker построил индексы speedRules/objects РК`, `подключил РК-скорости с приоритетом ниже ДОК и выше ЭК`, `добавил РК-станции в объектный слой без дублей`, `вывел счетчики РК в панели`, `исправил SW network-first для tracker JSON и проверил v109 в браузере.`
- Files: `scripts/import-regime-maps.py`, `assets/tracker/regime-maps.json`, `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 11:16:11 +1000

- Source: `manual`
- Task: Восстановил знаки уклонов РК для Поехали
- Branch: `main`
- Methods: `Добавил чтение векторной геометрии PDF режимных карт`, `выделение синей линии профиля`, `восстановление знака уклона по направлению линии`, `счетчики signedProfileSegments в JSON и UI панели РК`, `пересобрал regime-maps.json`, `обновил SW cache до v110 и проверил браузер`
- Files: `scripts/import-regime-maps.py`, `assets/tracker/regime-maps.json`, `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 11:31:54 +1000

- Source: `manual`
- Task: Добавил светофоры режимных карт в Поехали
- Branch: `main`
- Methods: `Извлек текстовые метки светофоров Н/Ч из PDF режимных карт`, `привязал их к км/пк по оси страницы`, `добавил счетчики сигналов РК и проверил экран v111 в in-app browser`
- Files: `scripts/import-regime-maps.py`, `assets/tracker/regime-maps.json`, `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 11:49:51 +1000

- Source: `manual`
- Task: Добавил контрольные и режимные метки РК в Поехали
- Branch: `main`
- Methods: `Извлек из PDF режимных карт текстовые метки НТ/ННТТ`, `тяговые позиции`, `ЭДТ`, `СОЕД и мощностные отметки с X-привязкой к км/пк`, `пересобрал regime-maps.json`, `добавил индекс и отрисовку меток на профиль`, `счетчики в панели РК и HUD ближайшей НТ`, `проверил v112 в in-app browser`
- Files: `scripts/import-regime-maps.py`, `assets/tracker/regime-maps.json`, `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 11:56:55 +1000

- Source: `manual`
- Task: Добавил проверяемый список РК-меток в Поехали
- Branch: `main`
- Methods: `Добавил в панель ПР ближайшие контрольные метки режимных карт по активному участку`, `показываю тип НТ/тяга/мощность/СОЕД/ЭДТ`, `координату`, `источник и страницу`, `строка переводит профиль к выбранной отметке`, `проверил v113 в in-app browser`, `node --check и smoke:local`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 12:05:16 +1000

- Source: `manual`
- Task: Доработал автологику GPS в Поехали
- Branch: `main`
- Methods: `Добавил состояние автоопределения участка/координаты`, `диагностический блок Автоопределение в панели ПР`, `статус GPS с активным участком`, `показ ближайшего участка при точке вне карты и автонаправление ЧЕТ/НЕЧЕТ по фактическому движению с ручной блокировкой`, `обновил ТЗ и cache до v114`, `проверил node --check`, `smoke:local и браузер v114`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 12:11:52 +1000

- Source: `manual`
- Task: Добавил автоподбор карты Поехали по GPS
- Branch: `main`
- Methods: `Трекер теперь пробует data.xml всех скачанных карт`, `строит быструю GPS-проекцию`, `показывает Подбор ЭК в панели ПР и переключается на явно более близкую карту`, `ТЗ обновлено`, `cache bumped to v115.`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 12:20:46 +1000

- Source: `manual`
- Task: Связал маршрут смены с автоподбором ЭК в Поехали
- Branch: `main`
- Methods: `Добавил индекс станций по объектным XML всех скачанных карт`, `route-probe cache`, `автопереключение карты по route_from/route_to до GPS`, `статусы/кнопку в панели ПР и пометку маршрута в выборе ЭК`, `обновил ТЗ и SW cache до v116`, `проверил node --check`, `smoke:local и браузер v116.`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 12:26:37 +1000

- Source: `manual`
- Task: Добавил пакетную проверку скачанных ЭК в Поехали
- Branch: `main`
- Methods: `Ввел cache готовности карт`, `парсинг data/profile/speed/object XML по каждой скачанной ЭК`, `секцию Скачанные ЭК в панели ПР с итогами и переходом на карту`, `статусы в выборе ЭК`, `обновил ТЗ и SW cache до v117`, `проверил node --check`, `smoke:local и браузер v117.`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 12:37:04 +1000

- Source: `manual`
- Task: Добавил каталог remote-карт ЭК в Поехали
- Branch: `main`
- Methods: `В панели ПР добавлен Каталог ЭК с установленными картами`, `remote manifest`, `датой manifest`, `причинами недоступности zip и переходом в выбор ЭК`, `выбор ЭК показывает недоступные remote-карты без ложных кнопок скачивания`, `источник Firebase 412 отображается явно`, `SW cache поднят до v118`, `проверены node --check`, `smoke:local и in-app browser.`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 12:48:01 +1000

- Source: `manual`
- Task: Проверил подключенный телефон на дополнительные ЭК и добавил импорт Android backup
- Branch: `main`
- Methods: `Через MTP и adb проверен Redmi Note 9 Pro: внешние папки ru.badlog.trainnote пустые`, `run-as закрыт`, `adb backup дал приватный app_emap`, `извлеченные data/profile/speed/object XML побайтно совпали с уже импортированной Комсомольск ТЧЭ-9`, `других app_emap/zip/XML в backup не найдено. Добавлен scripts/import-poekhali-android-backup.py и npm script maps:import:android-backup`, `.gitignore защищает tmp-trainnote-*`, `ТЗ обновлено`, `проверены py_compile`, `dry-run импортера`, `package JSON и smoke:local.`
- Files: `.gitignore`, `package.json`, `scripts/import-poekhali-android-backup.py`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 12:57:37 +1000

- Source: `manual`
- Task: Расширил GPS-дообучение карты Поехали
- Branch: `main`
- Methods: `GPS-слой теперь сохраняет map/sector/km/pk`, `координаты`, `высоту`, `скорость`, `точность`, `расстояние до ЭК и статус ontrack/near/offtrack`, `GPS-профиль строится только из точек на карте/рядом`, `панель ПР показывает счетчики GPS-черновика и последнюю точку`, `SW cache поднят до v119`, `проверены node --check`, `smoke:local и браузер v119`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 13:00:06 +1000

- Source: `manual`
- Task: Добавил GPS-расхождения в готовность карты Поехали
- Branch: `main`
- Methods: `Готовность участка теперь помечает GPS профиль как требующий подтверждения и выводит GPS/ЭК расхождения по near/offtrack точкам`, `панель ПР получила счетчик GPS/ЭК`, `SW cache поднят до v120`, `проверены node --check`, `smoke:local и браузер v120 без console errors`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 13:18:31 +1000

- Source: `manual`
- Task: Добавил серверную синхронизацию GPS-слоя Поехали
- Branch: `main`
- Methods: `Ввел /api/poekhali-learning в server.js с JSON-хранилищем по пользователю и валидацией GPS learning store`, `фронт Поехали теперь хранит sync state`, `сливает локальный и серверный GPS-слой`, `отправляет изменения с debounce`, `переживает offline и старый backend как локальный режим`, `панель ПР показывает статус Сервер`, `SW cache поднят до v122`, `проверены node --check`, `smoke:local`, `временный сервер 3100 и браузер v122b без console errors`
- Files: `server.js`, `scripts/auth.js`, `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 13:27:23 +1000

- Source: `manual`
- Task: Добавил серверную синхронизацию предупреждений Поехали
- Branch: `main`
- Methods: `Ввел /api/poekhali-warnings в server.js с JSON-хранилищем по пользователю и валидацией ПР`, `фронт Поехали теперь хранит warning sync state`, `сливает локальные и серверные ПР по updatedAt/deletedAt`, `отправляет изменения с debounce`, `удаляет ПР мягкой меткой deletedAt`, `переживает offline и старый backend как локальный режим`, `панель ПР показывает статус Сервер для предупреждений`, `SW cache поднят до v123`, `проверены node --check`, `smoke:local`, `временный сервер 3101/3102 и браузер v123 без console errors`
- Files: `server.js`, `scripts/auth.js`, `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 13:40:56 +1000

- Source: `manual`
- Task: Добавил журнал поездок режима Поехали
- Branch: `main`
- Methods: `Добавил /api/poekhali-runs с JSON-хранилищем и валидацией`, `связал таймер Поехали со стартом/паузой/завершением записи`, `GPS обновляет точку`, `дистанцию`, `длительность`, `максимум скорости и счетчик ПР`, `панель ПР получила Журнал Поехали со статусом серверной синхронизации`, `обновил ТЗ и SW cache.`
- Files: `server.js`, `scripts/auth.js`, `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 13:54:08 +1000

- Source: `manual`
- Task: Связал журнал Поехали со сменами
- Branch: `main`
- Methods: `Итог поездки теперь пишется в poekhali_* поля связанной смены`, `редактирование смены сохраняет эти поля`, `карточка и подробности смены показывают техскорость`, `дистанцию и тайминги Поехали`, `серверный журнал поездок принимает moving/idle/average/technical metrics`, `SW v125`
- Files: `scripts/poekhali-tracker.js`, `scripts/shift-form.js`, `scripts/time-utils.js`, `server.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 14:04:25 +1000

- Source: `manual`
- Task: Исправил сохранение пути Поехали в связанную смену
- Branch: `main`
- Methods: `Заменил несуществующий pathVariant на wayNumber через getCurrentTrackLabel`, `добавил запись карты`, `направления и пути в poekhali_* поля смены`, `вывел эти поля в подробностях смены`, `поднял SW cache до v127`, `проверил node --check`, `smoke:local и браузер v127 без console errors`
- Files: `scripts/poekhali-tracker.js`, `scripts/time-utils.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 14:06:26 +1000

- Source: `manual`
- Task: Добавил фактический расход топлива по дистанции Поехали
- Branch: `main`
- Methods: `В подробностях смены считаю л/100 км и кг/100 км из приема/сдачи топлива и poekhali_distance_m`, `обозначил в ТЗ как фактический расчет без нормативов APK`, `поднял SW cache до v128`, `проверил node --check`, `smoke:local и браузер v128 без console errors`
- Files: `scripts/time-utils.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 14:08:27 +1000

- Source: `manual`
- Task: Восстановил направление и путь активной записи Поехали
- Branch: `main`
- Methods: `Активная/поставленная на паузу запись теперь восстанавливает ЧЕТ/НЕЧЕТ и П1/П2 после перезагрузки`, `сохраненный просмотр также хранит направление и путь`, `ручные переключатели направления/пути сразу обновляют активную запись и связанную смену`, `SW cache v129`, `проверил node --check`, `smoke:local и браузер v129 без console errors`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 14:17:15 +1000

- Source: `manual`
- Task: Добавил сырой GPS-трек для дообучения Поехали без ЭК-привязки
- Branch: `main`
- Methods: `Frontend learning store получил rawTracks по поездке/смене`, `точки вне карты и GPS до загрузки ЭК пишутся отдельно от профиля`, `панель ПР показывает сырые треки`, `server.js валидирует и синхронизирует rawTracks`, `SW cache v130`, `проверены node --check`, `git diff --check`, `smoke:local`
- Files: `scripts/poekhali-tracker.js`, `server.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 14:18:38 +1000

- Source: `manual`
- Task: Проверил Поехали v130 в браузере
- Branch: `main`
- Methods: `Открыл http://127.0.0.1:3000/?v=130 через in-app browser`, `перешел в Поехали`, `открыл панель ПР`, `проверил отсутствие console errors и наличие счетчиков сырого GPS в Дообучении карты`
- Files: `scripts/poekhali-tracker.js`, `server.js`, `sw.js`

## 2026-04-26 14:31:47 +1000

- Source: `manual`
- Task: Добавил черновые GPS-участки Поехали из rawTracks
- Branch: `main`
- Methods: `Сырые GPS-треки теперь собираются в рабочие GPS-черновики с синтетическим км/пк`, `профилем по высоте/линейным fallback`, `маршрутными сегментами и проекцией GPS на черновик`, `добавил вывод черновиков в ПР и обновил ТЗ. Проверено: node --check scripts/poekhali-tracker.js server.js sw.js`, `git diff --check`, `npm run smoke:local`, `браузер http://127.0.0.1:3000/?v=131 без новых JS errors.`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 14:52:15 +1000

- Source: `manual`
- Task: Добавил принятие GPS-черновиков в пользовательские участки Поехали
- Branch: `main`
- Methods: `GPS raw draft promotes to userSections`, `user sections integrated into route/profile/projection/readiness`, `Poekhali panel shows GPS sections and editor for stations/signals/speeds`, `server validates userSections`, `SW cache bumped to v132`, `verified with node checks`, `diff check`, `smoke test and browser console check.`
- Files: `scripts/poekhali-tracker.js`, `server.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 15:04:33 +1000

- Source: `manual`
- Task: Доработал управление пользовательскими GPS-участками Поехали
- Branch: `main`
- Methods: `Добавил стабильные id для объектов и скоростей GPS-участка`, `привязку начала участка к реальному км/ПК со сдвигом профиля`, `объектов и скоростей`, `редактирование и удаление сущностей`, `защиту от дублей при добавлении рядом с существующей сущностью`, `UI списка сущностей в ПР`, `серверную валидацию id`, `SW v133`, `проверены node --check`, `git diff --check`, `smoke:local и браузер v133 без новых console errors.`
- Files: `scripts/poekhali-tracker.js`, `server.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 15:11:04 +1000

- Source: `manual`
- Task: Добавил контроль качества и журнал правок GPS-участков Поехали
- Branch: `main`
- Methods: `UserSections получили history и явный статус проверки`, `добавлены качество участка`, `кнопка подтверждения/снятия проверки`, `заполнение начальной/конечной станции из карточки смены без выдуманных данных`, `история последних правок в ПР`, `server.js валидирует history`, `SW cache поднят до v134`, `проверены node --check`, `git diff --check`, `smoke:local и браузер v134 без новых console errors.`
- Files: `scripts/poekhali-tracker.js`, `server.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 15:24:28 +1000

- Source: `manual`
- Task: Связал GPS-участки Поехали с опорным ЭК и импортом источников
- Branch: `main`
- Methods: `Добавил referenceSector для userSections и серверной синхронизации`, `GPS-черновики автоматически получают опорный участок/км при наличии ближайшей ЭК-проекции`, `в ПР добавлен выбор опорного ЭК и пакетный импорт объектов/скоростей из ЭК`, `РК и ДОК с сохранением источника сущности`, `обновил ТЗ и SW v135`, `проверил node --check`, `diff check`, `smoke:local и браузер v135 без console errors`
- Files: `scripts/poekhali-tracker.js`, `server.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 15:32:57 +1000

- Source: `manual`
- Task: Связал автосборку GPS-участка Поехали со сменой
- Branch: `main`
- Methods: `Добавил кнопку Собрать участок для GPS user section`, `пакетный импорт опорных ЭК/РК/ДОК сущностей`, `запись паспорта пользовательского участка в связанную смену и вывод этих полей в карточке/подробностях смены`, `проверил node --check`, `git diff --check`, `smoke:local и браузер v136 без console errors`
- Files: `scripts/poekhali-tracker.js`, `scripts/time-utils.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 15:43:22 +1000

- Source: `manual`
- Task: Связал предупреждения Поехали со сменой
- Branch: `main`
- Methods: `Паспорт ПР теперь пишется в связанную смену при saveWarnings`, `карточка Поехали и подробности смены показывают активные/общие ПР и краткий список`, `обновил ТЗ и SW cache v137`, `проверил node --check`, `git diff --check`, `smoke:local и браузер v137 без console errors`
- Files: `scripts/poekhali-tracker.js`, `scripts/time-utils.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 15:53:48 +1000

- Source: `manual`
- Task: Убрал демо-длину состава Поехали
- Branch: `main`
- Methods: `Длина состава теперь берется из карточки смены по условной длине`, `оценивается по осям или честно падает до локомотива с предупреждением`, `источник длины сохраняется в журнал Поехали и связанную смену`, `проверено в браузере v138 без 1045 и без console errors.`
- Files: `scripts/poekhali-tracker.js`, `scripts/time-utils.js`, `server.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 16:02:59 +1000

- Source: `manual`
- Task: Добавил ручную привязку смены к Поехали
- Branch: `main`
- Methods: `Режим Поехали получил localStorage выбранной смены`, `источник 'выбрана вручную'`, `селектор смены в панели ПР и перепривязку активной записи к выбранной карточке`, `при выборе обновляются данные поезда`, `локомотива`, `длины`, `маршрут и последующая запись в смену. Проверено node --check`, `git diff --check`, `smoke:local и браузер v139 без console errors.`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 16:13:59 +1000

- Source: `manual`
- Task: Добавил переход из карточки смены в Поехали
- Branch: `main`
- Methods: `В подробностях смены добавлена кнопка Открыть в Поехали`, `обработчик выбирает смену`, `открывает режим`, `подбирает карту по маршруту и оставляет состав/локомотив/длину из карточки`, `обновлено ТЗ и SW cache v140`, `проверено node --check`, `git diff --check`, `npm run smoke:local и браузер v140 без console errors`
- Files: `scripts/poekhali-tracker.js`, `scripts/time-utils.js`, `scripts/shift-form.js`, `styles/30-shifts-and-overlays.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 16:17:10 +1000

- Source: `manual`
- Task: Добавил запуск Поехали из меню смены
- Branch: `main`
- Methods: `В меню действий карточки смены добавлен пункт Поехали`, `обработчик закрывает меню`, `выбирает смену и открывает режим через openPoekhaliForShift`, `стиль пункта сделан акцентным`, `обновлено ТЗ и SW cache v141`, `проверено node --check`, `git diff --check`, `npm run smoke:local и браузер v141 без console errors`
- Files: `scripts/render.js`, `styles/30-shifts-and-overlays.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 16:26:20 +1000

- Source: `manual`
- Task: Доработал штатный вход в Поехали через нижнюю вкладку
- Branch: `main`
- Methods: `Добавил entry-контекст Поехали с приоритетом активной/недавно созданной смены для обычного запуска`, `pinned shift для прямого перехода из карточки`, `единую подготовку маршрута/ЭК/предупреждений перед рабочей отрисовкой`, `обновил ТЗ и SW v142`, `проверил node --check`, `git diff --check`, `npm run smoke:local и браузер v142 без console errors`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 16:32:23 +1000

- Source: `manual`
- Task: Добавил автоподбор пути Поехали по маршруту смены
- Branch: `main`
- Methods: `Сохранил fileKey объектных XML при сборе станций маршрута`, `добавил оценку пар станций с учетом направления и П1/П2 из файлов 1/1n/2/2n`, `применяю найденный путь вместе с ЧЕТ/НЕЧЕТ и стартовой точкой`, `вывел путь в панели маршрута`, `обновил ТЗ и SW v143`, `проверил node --check`, `git diff --check`, `npm run smoke:local и браузер v143 без console errors`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 16:42:36 +1000

- Source: `manual`
- Task: Связал запуск таймера Поехали с подготовленным контекстом смены
- Branch: `main`
- Methods: `Таймер теперь сначала запускает preparePoekhaliModeEntry`, `дожидается карты/маршрута/предупреждений`, `применяет направление и путь перед startOrResumeRun`, `показывает короткое состояние подготовки и отменяет подготовку при выходе из режима`, `обновил ТЗ и SW cache v144`, `проверил node --check`, `git diff --check`, `npm run smoke:local и браузер v144 без console errors.`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 16:47:49 +1000

- Source: `manual`
- Task: Заблокировал пустой старт таймера Поехали
- Branch: `main`
- Methods: `Добавил проверку готовности старта: без выбранной/активной смены таймер не создает run`, `без GPS старт допускается только при надежной привязке маршрута смены к ЭК`, `статус блокировки показывается в GPS-кнопке`, `центральном состоянии и панели ПР`, `обновил ТЗ и SW cache v145`, `проверил node --check`, `git diff --check`, `npm run smoke:local и браузер v145 без console errors.`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 16:57:24 +1000

- Source: `manual`
- Task: Связал активное ограничение Поехали с поездкой и сменой
- Branch: `main`
- Methods: `Добавил единый activeRestriction по приоритету ПР-ДОК-РК-ЭК`, `сохраняю его в run и poekhali_* полях смены`, `вывел ОГР в нижнюю панель и подробности смены`, `обновил ТЗ и SW cache v146`, `проверил node --check`, `git diff --check`, `smoke:local и браузер v146 без console errors`
- Files: `scripts/poekhali-tracker.js`, `scripts/time-utils.js`, `server.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 17:00:33 +1000

- Source: `manual`
- Task: Добавил контроль превышения ограничения в Поехали
- Branch: `main`
- Methods: `Скорость в нижней панели подсвечивается при превышении активного ограничения`, `run сохраняет max/время/дистанцию превышения`, `эти поля пишутся в связанную смену и отображаются в журнале/подробностях`, `обновил ТЗ и SW cache v147`, `проверил node --check`, `git diff --check`, `smoke:local и браузер v147 без console errors`
- Files: `scripts/poekhali-tracker.js`, `scripts/time-utils.js`, `server.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 17:12:44 +1000

- Source: `manual`
- Task: Добавил прогноз и профильную метку следующего ограничения Поехали
- Branch: `main`
- Methods: `Следующее ограничение впереди ищется из ПР/ДОК/РК/ЭК по направлению движения на 5 км`, `пишется в run и poekhali_* поля смены`, `отображается в HUD/журнале/смене`, `для ДОК/РК/ЭК добавлена метка Далее на профиле с расстоянием и координатой`, `без дубля ПР`, `server лимит полей смены поднят до 128`, `SW cache v149`, `ТЗ обновлено`, `проверены node --check`, `git diff --check`, `npm run smoke:local и браузер v149 без console errors`
- Files: `scripts/poekhali-tracker.js`, `scripts/time-utils.js`, `server.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 17:19:53 +1000

- Source: `manual`
- Task: Добавил навигацию по ближайшим объектам Поехали
- Branch: `main`
- Methods: `Ближайший светофор и станция впереди выбираются по направлению движения из объектов текущего пути/участка`, `сохраняются в run и poekhali_* полях смены с координатой и расстоянием`, `выводятся в журнале Поехали и подробностях/технической строке смены`, `серверная валидация run расширена`, `лимит полей смены поднят до 160`, `SW cache v150`, `ТЗ обновлено`, `проверены node --check`, `git diff --check`, `npm run smoke:local и браузер v150 без console errors`
- Files: `scripts/poekhali-tracker.js`, `scripts/time-utils.js`, `server.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 17:26:51 +1000

- Source: `manual`
- Task: Добавил прогресс маршрута смены в Поехали
- Branch: `main`
- Methods: `По сопоставленным станциям откуда/куда из карточки смены считаю длину маршрута`, `пройдено`, `остаток и процент по текущей GPS/preview координате`, `сохраняю routeProgress в run и poekhali_* полях смены`, `вывожу в панели маршрута`, `журнале Поехали`, `технической строке и подробностях смены`, `серверная валидация run расширена`, `лимит полей смены поднят до 192`, `SW cache v151`, `ТЗ обновлено`, `проверены node --check`, `git diff --check`, `npm run smoke:local`, `браузер v151 и панель ПР без console errors`
- Files: `scripts/poekhali-tracker.js`, `scripts/time-utils.js`, `server.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 17:34:52 +1000

- Source: `manual`
- Task: Добавил маршрутный прогресс на рабочий экран Поехали
- Branch: `main`
- Methods: `Расширил routeProgress координатами старта/финиша и внешним расстоянием`, `добавил прогресс-рейку в live summary canvas`, `добавил метку ближайшего старта/финиша маршрута на профиле с label reservation`, `обновил ТЗ и SW cache v152`, `проверил node --check`, `git diff --check`, `smoke:local и браузер v152 без console errors`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 17:40:26 +1000

- Source: `manual`
- Task: Переделал поезд Поехали в профильный состав
- Branch: `main`
- Methods: `Состав теперь строится по линии профиля от хвоста до головы с длиной из карточки смены`, `делениями и колесами`, `preview без GPS показывает полупрозрачный состав-ориентир`, `SW cache v154`, `проверены node --check`, `git diff --check`, `smoke:local и браузер v154 без console errors`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 17:49:59 +1000

- Source: `manual`
- Task: Добавил ETA навигации Поехали
- Branch: `main`
- Methods: `ETA до следующего ограничения`, `светофора`, `станции и маршрута считается по фактической скорости и скрывается без скорости`, `поля проходят через run`, `связанную смену`, `серверную очистку`, `карточку смены и рабочие метки профиля`, `обновлен SW cache v155`, `проверены node --check`, `git diff --check`, `npm run smoke:local и браузер v155 без console errors`
- Files: `scripts/poekhali-tracker.js`, `scripts/time-utils.js`, `server.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 17:59:27 +1000

- Source: `manual`
- Task: Добавил цель впереди в Поехали
- Branch: `main`
- Methods: `Режим выбирает ближайшее важное событие по ходу: конец действующего ограничения`, `следующее ПР/ограничение`, `светофор`, `станцию или старт/финиш маршрута`, `цель пишется в run и связанную смену`, `отображается в HUD`, `журнале Поехали и подробностях смены`, `серверная очистка расширена`, `лимит полей смены поднят`, `SW cache v156`, `проверены node --check`, `git diff --check`, `npm run smoke:local и браузер v156 без console errors`
- Files: `scripts/poekhali-tracker.js`, `scripts/time-utils.js`, `server.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 18:09:42 +1000

- Source: `manual`
- Task: Добавил runtime-предупреждения Поехали
- Branch: `main`
- Methods: `В рабочем GPS-обновлении строю предупреждение о превышении ограничения и приближении к ближайшей цели за 1000/300 м`, `добавил дедупликацию и тактильный отклик через BM_HAPTICS`, `верхняя live-панель меняет тон и текст без нового слоя поверх профиля`, `обновил ТЗ и SW cache v157`, `проверил node --check`, `git diff --check`, `smoke:local и браузер v157 без console errors.`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 18:15:57 +1000

- Source: `manual`
- Task: Сохранил оповещения Поехали в поездку и смену
- Branch: `main`
- Methods: `Добавил alertCount и последнее оповещение в run`, `пробросил поля в poekhali_* карточки смены и серверную очистку /api/poekhali-runs`, `вывел счетчик/последнее оповещение в панель ПР`, `журнал и подробности смены`, `обновил ТЗ и SW cache v158`, `проверил node --check`, `git diff --check`, `smoke:local и браузер v158 без console errors.`
- Files: `scripts/poekhali-tracker.js`, `scripts/time-utils.js`, `server.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 18:29:53 +1000

- Source: `manual`
- Task: Привел экран режима Поехали к более читаемому UX
- Branch: `main`
- Methods: `Добавил подписи к кнопкам управления`, `развел их позиции на мобильных ширинах`, `сделал следующую цель главным текстом live HUD`, `переименовал быстрые метрики в ЛИМИТ/УКЛОН/ДАЛЕЕ`, `устранил undefined sector в расчете live navigation target`, `поднял SW cache v159`, `проверил node --check`, `git diff --check`, `Playwright screenshots mobile/desktop без console errors и npm run smoke:local`
- Files: `index.html`, `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`

## 2026-04-26 18:46:11 +1000

- Source: `manual`
- Task: Добавил глобальный prod-контроль Поехали и пакетный ввод ПР
- Branch: `main`
- Methods: `В панели ПР добавлена секция Контроль prod с автоматическими блокерами по смене`, `маршруту`, `GPS`, `картам`, `ДОК`, `РК`, `предупреждениям`, `поездкам`, `GPS-дообучению`, `каталогу и canvas`, `ручные приемочные пункты 320/360/390`, `реальная GPS-поездка`, `сверка APK и наложения сохраняются в localStorage`, `предупреждения получили пакетный ввод строками км/пк-км/пк скорость текст`, `обновлен SW v160 и ТЗ`, `проверено node --check`, `git diff --check`, `npm run smoke:local`, `браузер v160 без console errors`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 18:56:47 +1000

- Source: `manual`
- Task: Добавил сверку источников ДОК-скоростей в Поехали
- Branch: `main`
- Methods: `Карточка конфликта ЭК/ДОК теперь показывает исходную строку документа`, `страницу/источник`, `кнопку открытия PDF и локальные статусы Сверено OK/Ошибка парсера`, `статус сверки включен в Контроль prod`, `service worker поднят до v162`, `проверено node --check`, `git diff --check`, `npm run smoke:local и браузер ?v=162 без console errors.`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 19:06:05 +1000

- Source: `manual`
- Task: Разделил prod-аудит Поехали и добавил файловый импорт ПР
- Branch: `main`
- Methods: `Контроль prod теперь считает production-готовность режима отдельно от эксплуатационной готовности текущей поездки`, `пакет скачанных ЭК оценивается по рабочему слою ЭК+GPS+РК+ДОК`, `в ПР добавлен импорт локального .txt/.csv/.json файла через пакетный parser предупреждений`, `ТЗ обновлено`, `SW cache v164`, `проверено node --check`, `git diff --check`, `npm run smoke:local и браузер ?v=164 без console errors.`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 19:16:42 +1000

- Source: `manual`
- Task: Начал визуальную доводку нижнего меню и режима Поехали
- Branch: `main`
- Methods: `Переставил Поехали после центрального добавления`, `перевел нижнюю навигацию на сетку`, `добавил визуальный статус Поехали`, `сократил приоритеты подписей станций/сигналов/РК/скоростей/уклонов`
- Files: `index.html`, `styles/15-bottom-nav.css`, `scripts/poekhali-tracker.js`, `sw.js`

## 2026-04-26 19:27:58 +1000

- Source: `manual`
- Task: Довел нижнее меню и читаемость Поехали
- Branch: `main`
- Methods: `Перевел меню Поехали на 7-колоночную сетку с центральным FAB`, `закрепил порядок Главная/Смены/Добавить/Поехали/Зарплата/Документы`, `добавил акцент режима Поехали`, `разгрузил подписи профиля: ограничил плотность подписей скоростей`, `РК`, `сигналов`, `станций и уклонов по радиусу важности и приоритету`
- Files: `index.html`, `styles/10-navigation-and-cards.css`, `styles/15-bottom-nav.css`, `scripts/poekhali-tracker.js`, `sw.js`

## 2026-04-26 19:43:27 +1000

- Source: `manual`
- Task: Убрал Поехали из нижнего меню и добавил диагностику режима
- Branch: `main`
- Methods: `Удалил кнопку Поехали из нижней навигации`, `оставил вход через карточку/меню смены`, `добавил блок ПР Диагностика для статуса карт`, `GPS`, `ДК/РК`, `синхронизаций`, `SW/Cache API`, `обновил ТЗ под временный вход из смены.`
- Files: `index.html`, `styles/10-navigation-and-cards.css`, `styles/15-bottom-nav.css`, `scripts/poekhali-tracker.js`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 20:00:48 +1000

- Source: `manual`
- Task: Снял внешний источник карт с blocker scope и добавил резерв/связку Поехали с зарплатой
- Branch: `main`
- Methods: `Отключил remote ek_files как production-блокер`, `заменил Каталог ЭК на Источники карты`, `добавил JSON экспорт/импорт предупреждений`, `поездок`, `GPS-дообучения`, `GPS-участков`, `приемки и диагностики`, `добавил во вкладку Зарплата месячную сводку Поехали по пробегу`, `техскорости`, `ПР`, `превышениям и фактическому расходу на 100 км`, `обновил ТЗ и SW cache v171`, `проверил node --check`, `smoke:local`, `Playwright 320/360/390 и скачивание диагностического пакета.`
- Files: `scripts/poekhali-tracker.js`, `scripts/app.js`, `index.html`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 20:10:39 +1000

- Source: `manual`
- Task: Упростил пользовательский интерфейс ПР и проверил работу Поехали с GPS
- Branch: `main`
- Methods: `Разделил панель ПР на Поездка/ПР/Карта/Сервис`, `убрал техаудит и диагностику из основного вида`, `оставив их в Сервисе`, `добавил пользовательскую карточку готовности поездки`, `компактные итоги и карту/дообучение с понятными действиями`, `поправил копирайтинг дообучения и сохранения`, `поднял SW cache v172`, `проверил node --check`, `diff --check`, `smoke:local`, `Playwright 320/360/390 и эмуляцию GPS с попаданием на участок.`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 20:23:09 +1000

- Source: `manual`
- Task: Спрятал сервисные блоки Поехали из обычного UI
- Branch: `main`
- Methods: `Оставил в рабочей панели только Поездка/ПР/Карта`, `перенес Сервис и bulk-инструменты ПР за скрытый debug-флаг`, `упростил карточку карты до пользовательских статусов и обновил кеш/ТЗ`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 20:50:23 +1000

- Source: `manual`
- Task: Упростил рабочий UI Поехали и убрал расход на 100 км
- Branch: `main`
- Methods: `Перевел HUD времени на МСК`, `переименовал нижние действия в Запись/Панель`, `добавил легенду цветов профиля`, `разгрузил speed-band labels`, `сделал поезд заметнее`, `убрал пользовательскую метрику расхода на 100 км из зарплаты`, `добавил sharedLearning слой для общего GPS-дообучения`
- Files: `index.html`, `scripts/poekhali-tracker.js`, `scripts/app.js`, `server.js`, `styles/10-navigation-and-cards.css`, `sw.js`, `docs/2026-04-26-poekhali-parity-tz.md`

## 2026-04-26 20:54:50 +1000

- Source: `manual`
- Task: Разобраны замечания по экрану зарплаты, документам, сериям локомотива и Поехали
- Branch: `main`
- Methods: `Нашел ручной override месячной нормы`, `текущий DOC_DISPLAY_META_BY_PATH`, `список option локомотивов и текущую толстую отрисовку состава по trainMeters`
- Files: `index.html`, `scripts/app.js`, `scripts/docs-app.js`, `scripts/poekhali-tracker.js`, `scripts/render.js`

## 2026-04-26 21:06:16 +1000

- Source: `manual`
- Task: Исправлены замечания по настройкам зарплаты, документам, сериям локомотивов и визуалу Поехали
- Branch: `main`
- Methods: `Удалил ручную месячную норму и принудительный override`, `расширил красивую мету документов`, `оставил только конкретные новые серии локомотивов`, `сделал компактный состав на синем профиле и отодвинул полосы скоростей ниже`
- Files: `index.html`, `scripts/app.js`, `scripts/docs-app.js`, `scripts/poekhali-tracker.js`, `sw.js`

## 2026-04-26 21:27:48 +1000

- Source: `manual`
- Task: Перенес визуал Поехали ближе к APK-шкале
- Branch: `main`
- Methods: `Скорости вынесены верхними строками от большей к меньшей`, `поезд заменен на блок длины состава по профилю`, `убраны крупные подсказки и заголовок профиля с полотна`, `cache/version v179`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `assets/tracker/icons/apk-loco-te10m.png`, `assets/tracker/icons/apk-loco-tem2.png`, `assets/tracker/icons/apk-wagon.png`

## 2026-04-26 21:32:43 +1000

- Source: `manual`
- Task: Уточнил компоновку Поехали по замечаниям v182
- Branch: `main`
- Methods: `Сжал нижний зазор между профилем и рельсой`, `закрепил скорости сверху по убыванию`, `оставил поезд прямоугольным блоком длины состава`, `убрал неиспользуемые ссылки на APK-иконки из кода и SW`
- Files: `scripts/poekhali-tracker.js`, `sw.js`

## 2026-04-26 21:35:32 +1000

- Source: `manual`
- Task: Развел цвета скоростей Поехали по диапазонам
- Branch: `main`
- Methods: `80+ зеленый`, `70-79 синий`, `60-69 желтый`, `40-59 оранжевый`, `ниже красный`, `подписи скоростей подкрашены тем же смысловым цветом`, `cache/version v183`
- Files: `scripts/poekhali-tracker.js`, `sw.js`

## 2026-04-26 21:37:17 +1000

- Source: `manual`
- Task: Убрал красное выделение участка с профиля Поехали
- Branch: `main`
- Methods: `Отключил старую цветную станционную полосу на профиле`, `оставил подпись станции и верхние скорости`, `cache/version v184`
- Files: `scripts/poekhali-tracker.js`, `sw.js`

## 2026-04-26 21:44:08 +1000

- Source: `manual`
- Task: Final Poekhali release cleanup
- Branch: `main`
- Methods: `Removed user-facing fuel per 100km detail and bumped Poekhali/cache version to v185 before release verification`
- Files: `scripts/time-utils.js`, `scripts/poekhali-tracker.js`, `sw.js`

## 2026-04-26 21:44:54 +1000

- Source: `manual`
- Task: Remove unused Poekhali fuel rate helper
- Branch: `main`
- Methods: `Deleted hidden per-100km formatter after removing the user-facing shift detail row`
- Files: `scripts/time-utils.js`

## 2026-04-26 21:47:04 +1000

- Source: `manual`
- Task: Poekhali release verification
- Branch: `main`
- Methods: `Ran node syntax checks`, `Python py_compile`, `npm smoke:local`, `git diff --check`, `and in-app browser checks for v185 Poekhali`, `existing shift entry`, `new shift form`, `and locomotive series dropdown`
- Files: `scripts/poekhali-tracker.js`, `scripts/time-utils.js`, `sw.js`, `index.html`, `scripts/shift-form.js`

## 2026-04-26 21:48:30 +1000

- Source: `manual`
- Task: Clean staged tracker XML whitespace
- Branch: `main`
- Methods: `Fixed two whitespace-only issues in imported profile XML before release commit`
- Files: `assets/tracker/maps/komsomol-sk-tche-9/profile.xml`

## 2026-04-26 12:03:55 +0000

- Source: `manual`
- Task: Прод-выкат commit 9f4dbd1 и перезапуск PM2
- Branch: `main`
- Methods: `git fetch --all --prune`, `подтвердил origin/main=9f4dbd1`, `git stash push -u для локальной памяти`, `git pull --ff-only origin main`, `pm2 reload bloknot-mashinista --update-env`, `curl localhost:3000 и внешний домен`
- Files: `ai-memory/CHANGELOG.md`, `ai-memory/sessions/2026-04-26.md`

## 2026-04-26 13:31:41 +0000

- Source: `manual`
- Task: Hotfix по черному экрану в режиме Поехали
- Branch: `main`
- Methods: `Проверил PM2 логи и poekhali runtime`, `увидел`, `что shell грузится`, `но canvas мог не стартовать надежно при входе в tab. Добавил немедленный drawCanvas() при старте`, `автостарт если Poekhali уже активен при init`, `и повторный sync через requestAnimationFrame после переключения вкладки.`
- Files: `scripts/poekhali-tracker.js`, `scripts/auth.js`, `ai-memory/CHANGELOG.md`, `ai-memory/sessions/2026-04-26.md`

## 2026-04-26 13:37:38 +0000

- Source: `manual`
- Task: Fix map picker stuck-open and accidental selection in Poekhali
- Branch: `main`
- Methods: `Found async reopen race in openMapPicker/closeMapPicker`, `added request token cancellation so pending asset load cannot reopen after close. Added user-select/touch-action guards for map sheet`, `panel`, `buttons`, `and rows to stop iOS text selection/callout.`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `ai-memory/CHANGELOG.md`, `ai-memory/sessions/2026-04-26.md`

## 2026-04-26 13:43:30 +0000

- Source: `manual`
- Task: Tighten map sheet close and disable selection app-wide except docs viewer
- Branch: `main`
- Methods: `Added anti-reopen cooldown + pointerdown/click preventDefault/stopPropagation for Poekhali map sheet close/backdrop to stop tap-through reopening on mobile. Set global body user-select none and restored text selection only for docs viewer overlay/body/title/status.`
- Files: `scripts/poekhali-tracker.js`, `styles/00-base.css`, `ai-memory/CHANGELOG.md`, `ai-memory/sessions/2026-04-26.md`

## 2026-04-26 13:46:22 +0000

- Source: `manual`
- Task: Architectural refactor of Poekhali map sheet
- Branch: `main`
- Methods: `Replaced request-token/cooldown style behavior with explicit mapPickerOpen state. Map sheet now mounts under document.body as fixed overlay`, `opens immediately`, `rerenders after async manifest/assets load only if still open`, `and closes synchronously without reopening race.`
- Files: `scripts/poekhali-tracker.js`, `styles/10-navigation-and-cards.css`, `ai-memory/CHANGELOG.md`, `ai-memory/sessions/2026-04-26.md`

## 2026-04-26 14:21:03 +0000

- Source: `manual`
- Task: Fix Poekhali top overlap under Telegram/iOS header
- Branch: `main`
- Methods: `Found top controls still used env(safe-area-inset-*) instead of computed --safe-* variables from safe-area.js. Switched Poekhali button positions to --safe-top/left/right/bottom and moved canvas HUD/status layout to JS helpers based on --safe-top so Telegram header inset affects both DOM controls and canvas content consistently.`
- Files: `styles/10-navigation-and-cards.css`, `scripts/poekhali-tracker.js`, `ai-memory/CHANGELOG.md`, `ai-memory/sessions/2026-04-26.md`

## 2026-04-26 14:33:55 +0000

- Source: `manual`
- Task: Fix stale standalone PWA shell after deploys
- Branch: `main`
- Methods: `Found SW update flow deferred reload on controllerchange for all surfaces`, `which is fine for Telegram but leaves iOS standalone PWA on restored old shell snapshots. Added standalone detection`, `one-shot reload on controllerchange in standalone`, `and update checks on pageshow/focus/visibility/online.`
- Files: `scripts/sw-register.js`, `ai-memory/CHANGELOG.md`, `ai-memory/sessions/2026-04-26.md`

## 2026-04-26 14:55:30 +0000

- Source: `manual`
- Task: Increase Poekhali top spacing after controls in standalone
- Branch: `main`
- Methods: `Observed PWA still overlapping after safe-area fix because canvas HUD started too close below the top control row. Increased getPoekhaliTopHudY baseline/gap so HUD starts below the control cluster with stable breathing room in both Telegram and standalone.`
- Files: `scripts/poekhali-tracker.js`, `ai-memory/CHANGELOG.md`, `ai-memory/sessions/2026-04-26.md`

## 2026-04-26 15:00:08 +0000

- Source: `manual`
- Task: Poekhali HUD now anchored to real top control row
- Branch: `main`
- Methods: `Replaced guessed top HUD offset with runtime measurement of the actual top control buttons' bottom edge plus gap`, `so canvas header starts below the rendered controls in Telegram and standalone alike.`
- Files: `scripts/poekhali-tracker.js`, `ai-memory/CHANGELOG.md`, `ai-memory/sessions/2026-04-26.md`

## 2026-04-26 15:02:24 +0000

- Source: `manual`
- Task: Link Poekhali route layout to actual HUD bottom
- Branch: `main`
- Methods: `Found route/profile layout still used hardcoded coordBottom=130 while top HUD had separate dynamic positioning`, `causing internal overlap in standalone PWA. Added shared HUD-bottom geometry and made tracker layout start below the rendered top HUD plus gap.`
- Files: `scripts/poekhali-tracker.js`, `ai-memory/CHANGELOG.md`, `ai-memory/sessions/2026-04-26.md`

## 2026-04-26 15:13:05 +0000

- Source: `manual`
- Task: Unify Poekhali top stack geometry
- Branch: `main`
- Methods: `Found second top live-summary card still hardcoded at y=140 while controls and top HUD were dynamic. Added shared helpers for live-summary top and top-stack bottom`, `anchored route layout below full top stack`, `and removed the remaining hardcoded y.`
- Files: `scripts/poekhali-tracker.js`, `ai-memory/CHANGELOG.md`, `ai-memory/sessions/2026-04-26.md`

## 2026-04-26 15:26:14 +0000

- Source: `manual`
- Task: Fix Poekhali relayout when offline banner toggles
- Branch: `main`
- Methods: `Observed Poekhali could break when connection dropped because offline banner appeared inside app-content without forcing Poekhali layout recompute`, `and in standalone the banner itself could sit under the status bar. Added Poekhali-mode safe-area margin for offline banner and forced double-RAF syncPoekhaliTrackerMode(true) when offline banner visibility changes.`
- Files: `styles/00-base.css`, `scripts/app.js`, `ai-memory/CHANGELOG.md`, `ai-memory/sessions/2026-04-26.md`

## 2026-04-26 15:30:52 +0000

- Source: `manual`
- Task: Fix doubled Poekhali top offset when banner is above screen
- Branch: `main`
- Methods: `Found Poekhali top-stack measurement used getBoundingClientRect() in viewport coordinates. When offline banner pushed the whole Poekhali shell down`, `banner height got counted a second time`, `creating a huge vertical gap. Switched top-control bottom measurement to local coordinates relative to the Poekhali canvas/shell.`
- Files: `scripts/poekhali-tracker.js`, `ai-memory/CHANGELOG.md`, `ai-memory/sessions/2026-04-26.md`

## 2026-04-26 15:45:49 +0000

- Source: `manual`
- Task: Convert offline network banner into floating dismissible notice
- Branch: `main`
- Methods: `Replaced in-flow offline banner behavior with a fixed top popup that no longer shifts app or Poekhali layout. Added close button`, `auto-hide timers`, `simple state-key dismissal handling`, `and network/sync payload mapping inside updateOfflineUiState.`
- Files: `index.html`, `styles/00-base.css`, `scripts/app.js`, `ai-memory/CHANGELOG.md`, `ai-memory/sessions/2026-04-26.md`

## 2026-04-26 16:02:30 +0000

- Source: `manual`
- Task: Fix Poekhali train heading and tighten top profile spacing
- Branch: `main`
- Methods: `Found train direction visualization bug because drawTrainHead() existed but drawApkTrain() rendered only a circular marker`, `so heading never flipped with direction. Switched train render to real head/cab drawing and compacted vertical layout by reducing gaps between top stack`, `speed bands`, `and profile section.`
- Files: `scripts/poekhali-tracker.js`, `ai-memory/CHANGELOG.md`, `ai-memory/sessions/2026-04-26.md`

## 2026-04-27 06:24:58 +1000

- Source: `manual`
- Task: Подтянул последний билд из origin/main
- Branch: `main`
- Methods: `git fetch origin`, `stash локальных ai-memory изменений`, `git pull --ff-only origin main до beb016e`, `deploy/restart не выполнялся`
- Files: `ai-memory/CHANGELOG.md`, `ai-memory/WORKTREE_STATUS.md`

## 2026-04-27 06:36:25 +1000

- Source: `manual`
- Task: Исправил направление Поехали для нечетного маршрута на Постышево
- Branch: `main`
- Methods: `Проверил доступность run-логов: локально только пустой dev-local`, `внешний /api/poekhali-runs без сессии вернул 401`, `по XML ЭК выявил что файлы без n содержат Н/нечетное направление`, `а *n содержат Ч/четное`, `перевел выбор object file`, `GPS-инференс направления`, `вперед/назад для скоростей/объектов/ПР/маршрута и хвост состава на общий знак координаты`, `bump SW cache v186`, `проверил node --check`, `smoke:local`, `diff --check`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `assets/tracker/maps/komsomol-sk-tche-9/1.xml`, `assets/tracker/maps/komsomol-sk-tche-9/1n.xml`, `assets/tracker/maps/komsomol-sk-tche-9/2.xml`, `assets/tracker/maps/komsomol-sk-tche-9/2n.xml`

## 2026-04-27 06:47:12 +1000

- Source: `manual`
- Task: Poekhali визуал направления и экономия батареи
- Branch: `main`
- Methods: `Подтверждена причина движения справа налево из-за инверсии чет/нечет`, `доработана ориентация головы и направляющей поезда по фактическому вектору`, `активный canvas переведен с requestAnimationFrame на throttled redraw`, `GPS high accuracy включается только во время записи`, `idle работает в low-power`, `сохранение live run throttled.`
- Files: `scripts/poekhali-tracker.js`, `sw.js`

## 2026-04-27 07:07:32 +1000

- Source: `manual`
- Task: Poekhali train bar length tied to wagon count
- Branch: `main`
- Methods: `Changed composition length so train_length is wagon count times 14m`, `removed visual min/cap from APK train bar`, `bar now renders exact coordinate span on km/pk scale`, `bumped diagnostics and service worker cache to v189.`
- Files: `scripts/poekhali-tracker.js`, `sw.js`

## 2026-04-27 07:13:29 +1000

- Source: `manual`
- Task: Poekhali synchronized train bars and sync popup polish
- Branch: `main`
- Methods: `Moved bottom train bar onto the km/pk scale`, `added matching profile train bar from the same head/tail coordinates and exact wagon-based length`, `compacted sync error popup and moved it away from Poekhali top controls`, `bumped diagnostics/cache to v190`, `verified syntax`, `diff check`, `smoke`, `and local mobile render.`
- Files: `scripts/poekhali-tracker.js`, `scripts/app.js`, `styles/00-base.css`, `sw.js`

## 2026-04-27 07:15:40 +1000

- Source: `manual`
- Task: Removed duplicate TUT label from Poekhali live chip
- Branch: `main`
- Methods: `Replaced zero-distance live navigation text from TUT/TUT to СЕЙЧАС/0 м and changed run summaries from тут to сейчас or 0 м`, `bumped Poekhali diagnostics and SW cache to v191`, `verified node syntax`, `diff check`, `and smoke.`
- Files: `scripts/poekhali-tracker.js`, `sw.js`

## 2026-04-27 07:23:27 +1000

- Source: `manual`
- Task: Poekhali automatic run trace sync
- Branch: `main`
- Methods: `Added throttled points trace to recorded runs`, `included trace in /api/poekhali-runs payload and server sanitizer`, `surfaced trace count in trip history and diagnostics`, `kept live persistence throttled for battery/network`, `verified node checks`, `smoke`, `and diff check.`
- Files: `scripts/poekhali-tracker.js`, `server.js`, `sw.js`

## 2026-04-27 07:28:25 +1000

- Source: `manual`
- Task: Simplified last shift card Poekhali summary
- Branch: `main`
- Methods: `Removed restrictions`, `next object`, `target`, `route`, `overspeed`, `and alert items from compact shift technical summary`, `kept locomotive and technical speed first`, `restored train fields after them with fallback Poekhali train metadata`, `bumped service worker cache`, `verified node checks`, `smoke`, `and diff check.`
- Files: `scripts/time-utils.js`, `scripts/poekhali-tracker.js`, `sw.js`

## 2026-04-27 07:34:35 +1000

- Source: `manual`
- Task: Aggressive low-power mode for app and Poekhali
- Branch: `main`
- Methods: `Stopped continuous Poekhali GPS watch outside active recording/start preparation`, `added one-shot passive GPS fix for manual GPS tap`, `disabled idle canvas loop and reduced active redraw cadence`, `limited learning capture to active run/start`, `deferred Poekhali sync while hidden and only schedules pending sync`, `changed user stats polling from 45s interval to 10min timeout`, `replaced 30s pending shift sync interval with visibility-aware 5min retry`, `bumped diagnostics/SW cache`, `verified node checks`, `smoke`, `and diff check.`
- Files: `scripts/poekhali-tracker.js`, `scripts/app.js`, `scripts/shift-form.js`, `sw.js`

## 2026-04-27 07:42:49 +1000

- Source: `manual`
- Task: Сделал автозапись Поехали вместо непонятного тумблера записи
- Branch: `main`
- Methods: `Запись автоматически стартует при входе в Поехали с выбранной сменой`, `паузится при выходе`, `кнопка стала статусом/ручным запуском`, `ручное завершение подавляет повторный автозапуск для этой смены`
- Files: `scripts/poekhali-tracker.js`, `index.html`, `styles/10-navigation-and-cards.css`, `sw.js`

## 2026-04-27 07:43:56 +1000

- Source: `manual`
- Task: Уточнил автозапись после завершения поездки
- Branch: `main`
- Methods: `Автозапуск не создает новую запись для смены`, `если по ней уже есть завершенная поездка`, `новая запись возможна вручную через статус/панель`
- Files: `scripts/poekhali-tracker.js`

## 2026-04-27 07:50:50 +1000

- Source: `manual`
- Task: Сделал автоопределение направления Поехали и проверку направления XML карт
- Branch: `main`
- Methods: `Убрал ручной переключатель ЧЕТ/НЕЧЕТ из верхней кнопки`, `добавил автонаправление по маршруту`, `номеру поезда и подтвержденному GPS-вектору`, `а объектные XML теперь классифицируются по сигналам Н/Ч внутри файла`, `проверил карту komsomol-sk-tche-9: 1.xml НЕЧЕТ`, `1n.xml ЧЕТ`, `2.xml ЧЕТ`, `2n.xml НЕЧЕТ`
- Files: `scripts/poekhali-tracker.js`, `index.html`, `styles/10-navigation-and-cards.css`, `sw.js`

## 2026-04-27 07:59:18 +1000

- Source: `manual`
- Task: Дополнительно оптимизировал расход батареи Поехали
- Branch: `main`
- Methods: `Заменил постоянный geolocation watchPosition на адаптивные getCurrentPosition-снимки`, `снизил частоту локальных live-сохранений и пакетировал run/learning sync во время движения`, `при паузе/завершении синхронизация остается быстрой`
- Files: `scripts/poekhali-tracker.js`, `sw.js`

## 2026-04-27 08:03:00 +1000

- Source: `manual`
- Task: Сравнил батарейную схему Поехали с распакованным APK
- Branch: `main`
- Methods: `Через androguard проверил MyGpsService`, `MainTrackerActivity`, `TrackerFragment`, `MainScreen и MainThread: APK использует foreground GPS service с LocationManager.requestLocationUpdates('gps'`, `700ms`, `5m) и SurfaceView loop около 30 FPS`, `полезна архитектура разделения GPS и отрисовки`, `но не батарейные параметры`
- Files: `tmp/apk-real/classes3.dex`, `tmp/apk-methods/ru_badlog_trainnote_tracker_GUIManager.smali.txt`

## 2026-04-27 08:12:40 +1000

- Source: `manual`
- Task: Починил пропадающие допустимые скорости в Поехали
- Branch: `main`
- Methods: `Нашел что документные правила speed-docs.json с пустым targetSectors отбрасывались`, `включая район 351-356 км`, `теперь такие правила сохраняются и после загрузки карты автоматически индексируются по координатным диапазонам секторов`, `а служебные скорости вроде 255 фильтруются как невалидные`
- Files: `scripts/poekhali-tracker.js`, `sw.js`, `assets/tracker/speed-docs.json`

## 2026-04-27 08:16:58 +1000

- Source: `manual`
- Task: Убрал дубли близких ограничений скорости в Поехали
- Branch: `main`
- Methods: `Добавил безопасную канонизацию ограничений скорости перед сравнением`, `отображением и конфликтами: значения приводятся только вниз к шагу 5 км/ч`, `поэтому 63→60`, `73→70`, `68→65`, `78→75`, `версия кеша поднята до v199`
- Files: `scripts/poekhali-tracker.js`, `sw.js`

## 2026-04-27 08:21:20 +1000

- Source: `post-commit`
- Task: fix(poekhali): stabilize live trip mode
- Branch: `main`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `ai-memory/CHANGELOG.md`, `ai-memory/INDEX.md`, `ai-memory/PROJECT_STATE.md`, `ai-memory/RECENT_COMMITS.md`, `ai-memory/WORKTREE_STATUS.md`, `ai-memory/sessions/2026-04-27.md`, `index.html`, `scripts/app.js`, `scripts/poekhali-tracker.js`, `scripts/shift-form.js`, `scripts/time-utils.js`, `server.js`, `styles/00-base.css`, `styles/10-navigation-and-cards.css`, `sw.js`
- Notes: Commit: `b67d010c6d5beb87a29f9663320490d909f6084d` (`b67d010`) | Author: `iEgor72`

## 2026-04-27 08:23:36 +1000

- Source: `manual`
- Task: Выкатка Poekhali v199 на VPS
- Branch: `main`
- Methods: `git push origin main до b67d010`, `на VPS stash production ai-memory deploy-memory-before-b67d010`, `git pull --ff-only origin main`, `pm2 reload bloknot-mashinista --update-env`, `проверены DEPLOY_HEAD=b67d010`, `PM2 online`, `локальный HTTP 200`, `внешний HTTPS 200`, `sw.js CACHE_VERSION v199`
- Files: `scripts/poekhali-tracker.js`, `server.js`, `scripts/app.js`, `scripts/shift-form.js`, `scripts/time-utils.js`, `index.html`, `styles/00-base.css`, `styles/10-navigation-and-cards.css`, `sw.js`, `ai-memory`

## 2026-04-27 08:31:44 +1000

- Source: `manual`
- Task: Починил некорректную информацию в карточке последней смены
- Branch: `main`
- Methods: `Нашел что карточка принимала служебный poekhali_train_length_label=локомотив за данные состава`, `добавил фильтрацию placeholder-значений и строгую очистку числовых полей поезда`, `в деталях Поехали состав показывается только при реальных данных`, `cache поднят до v200`, `проверены node --check`, `smoke и diff check`
- Files: `scripts/time-utils.js`, `sw.js`

## 2026-04-27 08:33:07 +1000

- Source: `post-commit`
- Task: fix(shifts): hide placeholder train composition
- Branch: `main`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `ai-memory/CHANGELOG.md`, `ai-memory/INDEX.md`, `ai-memory/PROJECT_STATE.md`, `ai-memory/RECENT_COMMITS.md`, `ai-memory/WORKTREE_STATUS.md`, `ai-memory/sessions/2026-04-27.md`, `scripts/time-utils.js`, `sw.js`
- Notes: Commit: `b72b03952700550ca176b775ec24a176f093d2aa` (`b72b039`) | Author: `iEgor72`

## 2026-04-27 08:33:59 +1000

- Source: `manual`
- Task: Выкатка фикса карточки последней смены v200
- Branch: `main`
- Methods: `git commit b72b039`, `git push origin main`, `на VPS подтверждены main/origin-main`, `git pull --ff-only origin main`, `pm2 reload bloknot-mashinista --update-env`, `проверены DEPLOY_HEAD=b72b039`, `PM2 online`, `локальный HTTP 200`, `внешний HTTPS 200`, `sw.js CACHE_VERSION v200`
- Files: `scripts/time-utils.js`, `sw.js`, `ai-memory`

## 2026-04-27 08:37:59 +1000

- Source: `manual`
- Task: Заменил PWA-иконки на новый logo.png
- Branch: `main`
- Methods: `Из D:/Загрузки/logo.png пересобраны icon-192.png`, `icon-512.png и apple-touch-icon.png через high-quality resize`, `cache version в sw.js поднят до v201`, `проверены размеры PNG`, `node --check sw.js`, `manifest JSON`, `smoke и diff check`
- Files: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `sw.js`

## 2026-04-27 08:42:02 +1000

- Source: `manual`
- Task: Заменил PWA-иконки на logo new.png
- Branch: `main`
- Methods: `Из D:/Загрузки/logo new.png пересобраны icon-192.png`, `icon-512.png и apple-touch-icon.png через high-quality resize`, `cache version в sw.js поднят до v202`, `проверены размеры PNG`, `node --check sw.js`, `manifest JSON`, `smoke и diff check`
- Files: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `sw.js`

## 2026-04-27 08:45:23 +1000

- Source: `post-commit`
- Task: chore(pwa): update app icon
- Branch: `main`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `ai-memory/CHANGELOG.md`, `ai-memory/INDEX.md`, `ai-memory/PROJECT_STATE.md`, `ai-memory/RECENT_COMMITS.md`, `ai-memory/WORKTREE_STATUS.md`, `ai-memory/sessions/2026-04-27.md`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `sw.js`
- Notes: Commit: `c66152dfd7110172234ab408d26674a1cc1e7d03` (`c66152d`) | Author: `iEgor72`

## 2026-04-27 08:46:37 +1000

- Source: `manual`
- Task: Коммит, push и deploy новой PWA-иконки v202
- Branch: `main`
- Methods: `Создан commit c66152d chore(pwa): update app icon`, `pushed origin/main`, `на VPS /opt/bloknot-mashinista выполнен fast-forward pull до c66152d`, `PM2 reload bloknot-mashinista --update-env`, `проверены PM2 online`, `локальный HTTP 200`, `внешний HTTPS 200 и внешний sw.js CACHE_VERSION v202`
- Files: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `sw.js`, `ai-memory`

## 2026-04-27 08:54:50 +1000

- Source: `manual`
- Task: Увеличил PWA-иконку на всю площадь
- Branch: `main`
- Methods: `Из D:/Загрузки/logo new.png сделан tight-crop вокруг синего скругленного квадрата`, `создан прозрачный 1024 PNG D:/Загрузки/logo new full.png`, `пересобраны icon-192.png`, `icon-512.png и apple-touch-icon.png без внутренних отступов`, `cache version в sw.js поднят до v203`, `проверены PNG размеры`, `node --check sw.js`, `manifest JSON`, `smoke и diff check`
- Files: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `sw.js`

## 2026-04-27 09:07:19 +1000

- Source: `manual`
- Task: Разложил данные поезда в карточке по строкам и подготовил PWA v204
- Branch: `main`
- Methods: `В buildShiftTechnicalHtml заменил общий список на смысловые строки: локомотив+номер поезда`, `вес+оси+длина`, `затем техскорость`, `полноразмерная PWA-иконка сохранена`, `sw.js поднят до v204`, `проверены node --check time-utils/sw`, `manifest`, `smoke`, `diff check и тестовый HTML`
- Files: `scripts/time-utils.js`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `sw.js`

## 2026-04-27 09:08:32 +1000

- Source: `post-commit`
- Task: fix(shifts): arrange train details in card
- Branch: `main`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `ai-memory/CHANGELOG.md`, `ai-memory/INDEX.md`, `ai-memory/PROJECT_STATE.md`, `ai-memory/RECENT_COMMITS.md`, `ai-memory/WORKTREE_STATUS.md`, `ai-memory/sessions/2026-04-27.md`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `scripts/time-utils.js`, `sw.js`
- Notes: Commit: `316d4b9e46e1d2a3d31eb78896a48796b213381b` (`316d4b9`) | Author: `iEgor72`

## 2026-04-27 09:09:57 +1000

- Source: `manual`
- Task: Коммит, push и deploy PWA v204 с упорядоченной карточкой смены
- Branch: `main`
- Methods: `Создан commit 316d4b9 fix(shifts): arrange train details in card`, `pushed origin/main`, `на VPS /opt/bloknot-mashinista выполнен fast-forward pull до 316d4b9`, `PM2 reload bloknot-mashinista --update-env`, `проверены PM2 online`, `локальный HTTP 200`, `внешний HTTPS 200 и внешний sw.js CACHE_VERSION v204`
- Files: `scripts/time-utils.js`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `sw.js`, `ai-memory`

## 2026-04-27 09:18:48 +1000

- Source: `manual`
- Task: Сделал открытие подробностей смены по клику
- Branch: `main`
- Methods: `Клик и Enter/Space по shift-card теперь открывают shift detail overlay вместо редактирования`, `действия оставлены в меню троеточия`, `подробности Поехали разбиты на UI-секции с метриками`, `навигацией и оповещениями`, `sw.js поднят до v205`, `проверены node --check`, `manifest`, `smoke`, `diff check и тестовый HTML`
- Files: `scripts/render.js`, `scripts/time-utils.js`, `styles/30-shifts-and-overlays.css`, `sw.js`

## 2026-04-27 09:19:58 +1000

- Source: `post-commit`
- Task: feat(shifts): open details from cards
- Branch: `main`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `ai-memory/CHANGELOG.md`, `ai-memory/INDEX.md`, `ai-memory/PROJECT_STATE.md`, `ai-memory/RECENT_COMMITS.md`, `ai-memory/WORKTREE_STATUS.md`, `ai-memory/sessions/2026-04-27.md`, `scripts/render.js`, `scripts/time-utils.js`, `styles/30-shifts-and-overlays.css`, `sw.js`
- Notes: Commit: `791297c9457e446bab24ea686a7a1bcfb99c7b4e` (`791297c`) | Author: `iEgor72`

## 2026-04-27 09:22:36 +1000

- Source: `manual`
- Task: Коммит, push и deploy подробностей смены по клику
- Branch: `main`
- Methods: `Создан commit 791297c feat(shifts): open details from cards`, `pushed origin/main`, `на VPS /opt/bloknot-mashinista выполнен fast-forward pull до 791297c`, `PM2 reload bloknot-mashinista --update-env`, `проверены PM2 online`, `локальный HTTP 200`, `внешний HTTPS 200 и внешний sw.js CACHE_VERSION v205`
- Files: `scripts/render.js`, `scripts/time-utils.js`, `styles/30-shifts-and-overlays.css`, `sw.js`, `ai-memory`

## 2026-04-27 09:33:17 +1000

- Source: `manual`
- Task: Сделал подробную карточку смены читаемее
- Branch: `main`
- Methods: `Длинные строки подробностей автоматически переводятся в стековый вид label сверху/value снизу`, `составные значения через точку-разделитель разбиваются на отдельные строки`, `координаты Поехали форматируются через запятую внутри участка`, `чтобы не дробились как разные поля`, `CSS подробной карточки обновлен под читаемые блоки`, `sw.js поднят до v206`, `проверены node --check`, `smoke`, `manifest.webmanifest`, `diff check и тестовый HTML`
- Files: `scripts/time-utils.js`, `styles/30-shifts-and-overlays.css`, `sw.js`

## 2026-04-27 09:33:37 +1000

- Source: `post-commit`
- Task: fix(shifts): improve detail readability
- Branch: `main`
- Methods: `git post-commit hook`, `automatic memory update`
- Files: `ai-memory/CHANGELOG.md`, `ai-memory/INDEX.md`, `ai-memory/PROJECT_STATE.md`, `ai-memory/RECENT_COMMITS.md`, `ai-memory/WORKTREE_STATUS.md`, `ai-memory/sessions/2026-04-27.md`, `scripts/time-utils.js`, `styles/30-shifts-and-overlays.css`, `sw.js`
- Notes: Commit: `b121f90ad2b686625330df0680bc030db617e07f` (`b121f90`) | Author: `iEgor72`

## 2026-04-27 09:35:04 +1000

- Source: `manual`
- Task: Коммит, push и deploy читаемой подробной карточки
- Branch: `main`
- Methods: `Создан commit b121f90 fix(shifts): improve detail readability`, `pushed origin/main`, `на VPS /opt/bloknot-mashinista выполнен fast-forward pull до b121f90`, `PM2 reload bloknot-mashinista --update-env`, `проверены PM2 online`, `локальный HTTP 200`, `внешний HTTPS 200 и внешний sw.js CACHE_VERSION v206`
- Files: `scripts/time-utils.js`, `styles/30-shifts-and-overlays.css`, `sw.js`, `ai-memory`

## 2026-04-27 09:51:36 +1000

- Source: `manual`
- Task: Проверил жалобу на логин Telegram в PWA
- Branch: `main`
- Methods: `Сверил последние коммиты: auth.js не менялся`, `последние правки касались карточек`, `иконок и bump sw.js`, `проверил sw.js: service worker не перехватывает telegram.org и пропускает /api`, `проверил прод: scripts/auth.js 200 no-store`, `/api/auth отвечает 401 без сессии`, `sw.js v206`, `в PM2 tail нет auth/telegram ошибок`
- Files: `scripts/auth.js`, `sw.js`, `server.js`, `index.html`, `ai-memory`

## 2026-04-27 09:58:16 +1000

- Source: `manual`
- Task: Убрал Telegram Login Widget из окна входа
- Branch: `main`
- Methods: `В index.html удален auth-widget-shell/telegramLoginWidget`, `в auth.js окно входа для prod и standalone приведено к одинаковой простой логике через кнопку Открыть Telegram`, `renderTelegramLoginWidget сделан no-op и больше не подгружает telegram-widget.js/SMS-код`, `CSS auth-card упрощен и приведен к более компактному виду`, `sw.js поднят до v207`, `проверены node --check auth/sw`, `smoke`, `manifest.webmanifest`, `diff check`
- Files: `index.html`, `scripts/auth.js`, `styles/00-base.css`, `sw.js`

## 2026-04-27 00:17:04 +0000

- Source: `manual`
- Task: Вернул рабочий Telegram login для browser/PWA auth
- Branch: `main`
- Methods: `Добавил authWidgetShell в auth gate`, `включил Telegram Login Widget через /api/auth?mode=telegram-login`, `добавил автоподхват restoreSession при возврате из Telegram и bump SW cache до v208`, `затем проверил node --check и local smoke`
- Files: `index.html`, `scripts/auth.js`, `sw.js`

## 2026-04-27 00:25:12 +0000

- Source: `manual`
- Task: Добавил bot-confirmed login fallback для standalone PWA
- Branch: `main`
- Methods: `Убрал зависимость от oauth.telegram.org для кнопки Открыть Telegram: сервер создает login request`, `бот подтверждает /start login_<id>`, `PWA опрашивает /api/auth/pwa-login-request и получает session cookie/token`, `дополнительно проверил локальным скриптом полный цикл create->pending->webhook approve->session и bump SW cache до v209`
- Files: `server.js`, `scripts/auth.js`, `sw.js`

## 2026-04-27 00:31:54 +0000

- Source: `manual`
- Task: Убрал дублирующий OAuth widget и оставил один auth-flow
- Branch: `main`
- Methods: `Удалил из auth gate legacy oauth.telegram.org widget и его JS-обвязку`, `обновил тексты под единый вход через Telegram-бота для браузера/PWA`, `сохранил WebApp initData вход внутри Telegram и bump SW cache до v210`, `проверил node --check и smoke:local`
- Files: `index.html`, `scripts/auth.js`, `sw.js`
