# START HERE

Перед началом любой задачи:
1. Запусти `npm run memory:preflight`.
2. Прочитай `PROJECT_STATE.md`.
3. Прочитай `ARCHITECTURE.md` и `METHODS.md`.
4. Прочитай `ENGINEERING_STYLE.md`.
5. Прочитай последние записи в `CHANGELOG.md`.
6. Прочитай `WORKTREE_STATUS.md`.

Во время работы:
- После значимого изменения добавь запись: `npm run memory:log -- --task "что сделал" --methods "как сделал" --files "file1,file2"`.

После завершения:
- Обнови срез проекта: `npm run memory:refresh`.
- Если делаешь коммит, запись в память добавится автоматически через `post-commit` hook.