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
