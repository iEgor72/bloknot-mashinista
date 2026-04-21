# bloknot-mashinista review action plan

Дата: 2026-04-21
Статус: draft / execution plan
Основание: multi-role review (frontend, backend, design, marketing)

## 1. Цель

Устранить самые опасные и самые заметные проблемы продукта после комплексного ревью:
- закрыть основные риски session/auth и порчи данных,
- починить service worker / SEO / offline path,
- снизить UX- и cognitive-friction в ключевых сценариях,
- синхронизировать маркетинговые обещания с реальным продуктом,
- подготовить более устойчивую архитектуру для следующих итераций.

## 2. Приоритеты

### P0, срочно
1. Убрать session token из URL flow (`?_st=`).
2. Подготовить уход от bearer token в `localStorage` к cookie/session-first flow.
3. Добавить валидацию payload для `/api/shifts`.
4. Сделать atomic writes и базовую защиту от гонок для local JSON storage.
5. Синхронизировать SEO page handling между `server.js` и `sw.js`.
6. Починить precache shell и убрать явные offline gaps.
7. Убрать из продукта и маркетинга обещания про несуществующий timer.
8. Разрешить zoom, убрать `user-scalable=no`.

### P1, высокий
1. Исправить post-click flow для SEO traffic: root/auth gate -> понятный onboarding/deep-link path.
2. Снизить перегрузку главной и quick-add сценария.
3. Упростить docs entry и навигационную логику.
4. Добавить trust layer и честную monetization messaging.
5. Добавить базовое structured logging для auth/webhook/storage.

### P2, следующий этап
1. Разделить `server.js` по зонам ответственности.
2. Снизить хрупкость глобального frontend state.
3. Сократить hot-zone full rerenders.
4. Развести SEO intent по лендингам глубже.
5. Продумать retention loops.

## 3. ТЗ по направлениям

### Epic A. Backend security and data integrity

#### Задача A1. Убрать token leak через URL
- Проблема: session token попадает в query string и может утекать в logs/history/referrer.
- Результат:
  - auth flow больше не передаёт bearer token через `?_st=`,
  - используется безопасный cookie-based или одноразовый code flow,
  - frontend не зависит от query-token bootstrap.
- Подзадачи:
  1. Найти текущий redirect/session bootstrap path в `server.js` и `scripts/auth.js`.
  2. Спроектировать совместимый flow без query token.
  3. Внести backend changes для `Set-Cookie` / session handoff.
  4. Обновить frontend auth bootstrap.
  5. Проверить обычный login, Telegram login, refresh/reopen app.
- Владелец: backend + frontend.

#### Задача A2. Защитить хранение и запись смен
- Проблема: `/api/shifts` принимает слишком доверчивый payload, writes неатомарны, нет concurrency control.
- Результат:
  - payload валидируется по базовой схеме,
  - invalid payload отвергается,
  - запись идёт через temp + rename,
  - есть минимальная revision / optimistic concurrency защита или совместимый путь к ней.
- Подзадачи:
  1. Описать допустимую схему shift record.
  2. Добавить server-side validation и field limits.
  3. Ввести atomic file write helper.
  4. Добавить revision/updatedAt guard, если это можно сделать без ломки клиента.
  5. Проверить multi-record, broken payload, concurrent overwrite edge cases.
- Владелец: backend.

#### Задача A3. Добавить наблюдаемость
- Результат:
  - ошибки auth/webhook/storage не глушатся молча,
  - есть минимальный structured log.
- Подзадачи:
  1. Найти silent catch branches.
  2. Ввести единый logger helper.
  3. Добавить rate-limited error logging.
- Владелец: backend.

### Epic B. Frontend shell / PWA / accessibility hardening

#### Задача B1. Починить SEO route handling в SW
- Проблема: `sw.js` не знает все публичные SEO route и местами подсовывает app shell.
- Результат:
  - список SEO route синхронизирован,
  - лучше, если route source becomes single-source-of-truth.
- Подзадачи:
  1. Сверить route list `server.js` vs `sw.js`.
  2. Обновить bypass/allowlist в `sw.js`.
  3. Проверить public pages в fresh, cached и PWA flows.
- Владелец: frontend.

#### Задача B2. Починить precache и offline shell completeness
- Проблема: часть реально используемых shell resources не в precache.
- Результат:
  - все обязательные shell assets есть в precache,
  - удалены мёртвые зависимости или лишние подключения.
- Подзадачи:
  1. Сверить `index.html` с `INSTALL_SHELL_URLS`/`CRITICAL_INSTALL_URLS`.
  2. Добавить недостающие assets в precache или убрать лишние подключения.
  3. Проверить first-install offline open.
- Владелец: frontend.

#### Задача B3. Accessibility minimum pass
- Результат:
  - включён user zoom,
  - нет явного anti-accessibility viewport lock.
- Подзадачи:
  1. Обновить meta viewport.
  2. Проверить, не ломает ли zoom docs viewer/overlays.
- Владелец: frontend.

### Epic C. Product UX simplification

#### Задача C1. Упростить главную
- Результат:
  - главный сценарий читается за 3 секунды,
  - на первом экране доминирует “сегодня/следующая смена”.
- Подзадачи:
  1. Пересобрать информационную иерархию home.
  2. Увести secondary blocks ниже.
  3. Проверить совместимость с existing state/render.
- Владелец: design + frontend.

#### Задача C2. Сделать quick-add first
- Результат:
  - базовая запись смены делается быстро,
  - детали раскрываются вторично.
- Подзадачи:
  1. Отделить core fields от advanced fields.
  2. Изменить copy и layout формы.
  3. Сохранить существующий data model.
- Владелец: design + frontend.

#### Задача C3. Почистить навигацию и docs entry
- Результат:
  - bottom nav не смешивает screens и actions,
  - docs entry понятен как список задач, не как тех. категории.
- Владелец: design + frontend.

### Epic D. Marketing / onboarding alignment

#### Задача D1. Синхронизировать обещания с реальностью
- Результат:
  - упоминания timer удалены,
  - value proposition сфокусирован.
- Подзадачи:
  1. Обновить Telegram welcome copy.
  2. Обновить root/auth copy.
  3. Обновить SEO pages copy.
- Владелец: marketing + backend/frontend.

#### Задача D2. Починить SEO conversion path
- Результат:
  - лендинг ведёт не в тупой auth wall, а в понятный next step,
  - добавлен direct Telegram deep-link.
- Подзадачи:
  1. Добавить `t.me/bloknot_mashinista_bot` как primary CTA.
  2. Сделать secondary CTA “как это работает” / preview.
  3. Добавить trust block и FAQ disclaimer.
- Владелец: marketing + frontend.

## 4. План исполнения по волнам

### Волна 1, прямо сейчас
- A1. auth/session leak fix design + implementation
- A2. payload validation + atomic writes
- B1. SW SEO route fix
- B2. precache cleanup
- B3. viewport accessibility fix
- D1. remove timer promise + align onboarding copy

### Волна 2
- D2. SEO CTA / auth gate / deep-link flow
- C1. home simplification
- C2. quick-add first
- A3. structured logging

### Волна 3
- C3. navigation/docs entry redesign
- frontend state/rerender cleanup
- backend modularization
- deeper SEO content separation and retention loops

## 5. Назначение ролей

- Backend agent:
  - A1, A2, A3
- Frontend agent:
  - B1, B2, B3, часть C1/C2
- Designer agent:
  - финализировать UX spec для C1/C2/C3 и review изменений
- Marketing agent:
  - D1, D2 copy/CTA/trust spec and content review

## 6. Критерии приёмки волны 1

- session token больше не передаётся через URL,
- shifts API не принимает явно битый payload,
- file writes safe against partial overwrite,
- все SEO pages корректно открываются через SW path,
- shell offline completeness improved,
- zoom работает,
- нигде не обещается timer, которого нет,
- основной onboarding copy согласован между bot/root/landing.
