# START HERE

Главное правило: сначала память, потом работа.

Перед любой работой, анализом, правками, тестами, деплоем или ответом по проекту:
1. Запусти `python tools/agent_memory.py preflight`.
2. Прочитай `PROJECT_STATE.md`.
3. Прочитай `ARCHITECTURE.md` и `METHODS.md`.
4. Прочитай `ENGINEERING_STYLE.md`.
5. Прочитай последние записи в `CHANGELOG.md`.
6. Прочитай `WORKTREE_STATUS.md`.
7. Только после этого приступай к задаче.

Во время работы:
- После значимого изменения добавь запись: `python tools/agent_memory.py log --task "что сделал" --methods "как сделал" --files "file1,file2"`.
- Если меняется scope, риск или production-контекст, добавь отдельный memory log.

После завершения:
- Обнови срез проекта: `python tools/agent_memory.py refresh`.
- Синхронизируй память: `python tools/agent_memory.py sync --direction push`.
- Если делаешь коммит, запись в память добавится автоматически через `post-commit` hook.
