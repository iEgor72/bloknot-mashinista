# Marketing / onboarding spec, wave 1-2

Дата: 2026-04-21
Статус: copy spec
Scope: только marketing/onboarding copy и content plan, без product-code правок

## 1. Цель

Синхронизировать первое впечатление о продукте между:
- Telegram bot welcome,
- root/auth gate,
- SEO-лендингами,
- trust/disclaimer слоем.

Главный принцип: больше не обещаем timer, не ведём SEO-трафик в немой auth wall, не звучим как "официальный расчётчик", а продаём понятную ценность: **смены, часы, журнал, календарь, документы и контроль своей рабочей картины в одном месте**.

---

## 2. Messaging foundation

### Core value proposition

**Блокнот Машиниста помогает машинисту быстро фиксировать смены, видеть часы и период, держать под рукой рабочую историю, документы и заметки без таблиц, хаоса и потери контекста.**

### Что продвигаем в wave 1-2

1. Учёт смен и часов.
2. Контроль своей картины по периоду.
3. Журнал смен, поездок и заметок.
4. Календарь/график как ориентир по работе.
5. Быстрый доступ к документам и инструкциям.
6. Вход через Telegram как простой и понятный способ открыть свои данные.

### Что не обещаем

- timer / таймер,
- официальный расчёт зарплаты,
- точность как у бухгалтерии/расчётного отдела,
- полную замену служебных систем.

---

## 3. Wave 1. Новый Telegram welcome / value proposition без таймера

### Задача

Заменить welcome на более честный и сильный оффер без упоминания timer.

### Новый copy, рекомендованный основной вариант

**Заголовок:**

> 👋 Привет, {firstName}!

**Текст:**

> Блокнот Машиниста помогает держать рабочую картину под рукой.
>
> В приложении можно:
> 📅 вести журнал смен и поездок
> 🕒 видеть часы, период и свою историю по месяцам
> 💸 контролировать расчёт по своим данным
> 📚 быстро открывать документы и инструкции
> 📝 сохранять заметки по сменам, чтобы не терять важные детали
>
> 🔒 Данные привязаны к твоему Telegram-аккаунту.
>
> Нажимай кнопку ниже и открывай приложение.

### Кнопки

Primary:
- `✈️ Открыть в Telegram`

Secondary:
- `🌐 Открыть в браузере`

### Notes

- Welcome должен быть короче текущего, но не слишком рекламным.
- Фраза про Telegram-аккаунт остаётся, потому что это снимает вопрос "где мои данные".
- Акцент на "рабочая картина" и "под рукой", а не на абстрактную автоматизацию.

---

## 4. Wave 1-2. Root / auth gate copy

### Проблема

Текущий gate слишком быстро упирается во "войти через Telegram" и не объясняет, **зачем** пользователю входить и что он получит после входа.

### Цель

Сделать gate не стеной, а понятным входом: что это, зачем Telegram, что будет дальше.

### Рекомендуемая структура

#### Badge

> Telegram login

#### Title

> Открой свои смены и рабочую историю

#### Body

> Блокнот Машиниста помогает вести смены, видеть часы по периоду, хранить заметки и быстро открывать рабочие документы.
>
> Вход через Telegram нужен, чтобы открыть твои данные и синхронизировать их между устройствами.

#### Primary CTA

> Войти через Telegram

#### Secondary helper text

> Если открыл сайт из поиска, удобнее начать через бота, а потом при желании открыть приложение в браузере.

#### Optional secondary CTA, wave 2

> Открыть бота

### Alternate copy for pending state

**Title:**
> Подтверждаем вход

**Body:**
> Проверяем твою сессию и открываем доступ к сменам, часам и журналу.

### Alternate copy for error state

**Title:**
> Не удалось выполнить вход

**Body:**
> Попробуй ещё раз или открой приложение через Telegram. Так обычно вход проходит быстрее и понятнее.

### Microcopy for SEO-origin users, wave 2

Небольшой блок под CTA:

> Впервые здесь? Сначала открой бота, затем приложение автоматически привяжется к твоему Telegram-аккаунту.

---

## 5. Wave 2. SEO CTA strategy с deep-link

### Главный вывод

Для SEO-трафика primary CTA должен вести **не на `/`**, а в **Telegram deep-link / bot entry**, потому что root без контекста воспринимается как глухая auth wall.

### CTA hierarchy

#### Primary CTA on SEO pages

> Открыть в Telegram

Ссылка:
- `https://t.me/bloknot_mashinista_bot`

Если будет доступен более точный deep-link, предпочтительно:
- `https://t.me/bloknot_mashinista_bot?start=seo_salary`
- `https://t.me/bloknot_mashinista_bot?start=seo_routes`
- `https://t.me/bloknot_mashinista_bot?start=seo_journal`
- и т.д. по intent page

#### Secondary CTA

Варианты:
- `Как это работает`
- `Открыть веб-версию`
- `Посмотреть возможности`

### Recommended per-page behavior

- Hero primary CTA: Telegram bot deep-link.
- Hero secondary CTA: либо релевантная соседняя SEO-страница, либо `/` как web-version fallback.
- В нижнем CTA-блоке повторить deep-link как основной путь старта.

### Why this matters

1. Telegram объясняет auth flow естественнее.
2. Пользователь сразу попадает в нативную для продукта среду.
3. Снижается ощущение, что сайт "не работает без логина".
4. Появляется канал для приветственного onboarding-сценария.

### CTA copy examples for SEO hero

**Primary:**
- `Открыть в Telegram`

**Secondary:**
- `Открыть веб-версию`
- `Посмотреть журнал смен`
- `Как это работает`

### Wave 2 addition

На SEO-страницах под CTA добавить пояснение:

> Быстрый старт через Telegram. После входа можно пользоваться и в браузере.

---

## 6. Trust / disclaimer blocks

### Цель

Снизить недоверие и одновременно убрать риск завышенных обещаний.

### Trust block, короткий

> **Для кого это:** личный рабочий инструмент машиниста для учёта смен, часов, заметок и своей рабочей истории.

### Disclaimer block, основной

> **Важно:** Блокнот Машиниста не является официальной системой работодателя и не заменяет расчётные документы. Приложение помогает вести личный учёт и сверять свои данные.

### Privacy / account block

> **Вход через Telegram:** используется для того, чтобы открыть твои данные и синхронизировать их между устройствами.

### Docs trust block

> **Документы под рукой:** приложение помогает быстро открыть нужные памятки и инструкции, но приоритет всегда у актуальных официальных документов и распоряжений.

### Где ставить

1. На root/auth gate, короткая версия про Telegram-вход и свои данные.
2. На SEO-лендингах, в FAQ или перед финальным CTA.
3. В Telegram welcome trust/disclaimer не перегружать, оставить только короткую фразу про привязку к Telegram.

---

## 7. Список файлов и страниц, которые потом нужно менять

### Telegram / bot onboarding

1. `server.js`
   - welcome caption
   - кнопки welcome
   - при наличии SEO deep-link routing, стартовые ветки `/start`

2. `functions/api/telegram-webhook.js`
   - резервный / альтернативный webhook copy должен совпадать с `server.js`

### Root / auth gate

3. `scripts/auth.js`
   - guest/pending/error copy
   - helper text
   - возможно secondary CTA copy для bot-first flow

4. `index.html`
   - если понадобится новый helper/disclaimer block в auth shell
   - install / browser-open explanatory text, если будет синхронизация с новым onboarding

### SEO pages

5. `docs/seo/zarplata-mashinista.html`
6. `docs/seo/kalkulyator-zarplaty-mashinista.html`
7. `docs/seo/uchet-marshrutov.html`
8. `docs/seo/zhurnal-smen-mashinista.html`
9. `docs/seo/grafik-smen-mashinista.html`
10. `docs/seo/prilozhenie-dlya-mashinista.html`

Что менять на этих страницах:
- primary CTA на Telegram deep-link,
- secondary CTA и helper copy,
- trust/disclaimer block,
- убрать остаточные расплывчатые обещания там, где они звучат как "официальный расчёт".

### Shared SEO styling, если понадобится новый trust block

11. `docs/seo/seo.css`
   - стили trust/disclaimer/CTA helper block

---

## 8. Recommended rollout order

### Wave 1

1. Обновить Telegram welcome.
2. Обновить root/auth gate copy.
3. Удалить все остаточные timer promises.
4. Добавить trust/disclaimer baseline.

### Wave 2

1. Перевести SEO primary CTA на Telegram deep-link.
2. Добавить helper text про bot-first start.
3. Добавить trust/disclaimer блоки на SEO-страницы.
4. При возможности разметить разные `?start=` deep-link по intent pages.

---

## 9. Acceptance criteria

- В welcome больше нет timer/таймера.
- Root/auth gate объясняет не только вход, но и ценность.
- SEO-трафик получает bot-first CTA вместо тупого перехода в `/`.
- На лендингах и gate есть честный disclaimer.
- Messaging в bot, auth gate и SEO больше не противоречит реальному продукту.

---

## 10. Короткая рекомендация

Если выбирать один главный marketing shift, то он такой:

**Не продавать "функции вообще", а продавать спокойный личный контроль своей рабочей картины, а Telegram использовать как самый понятный и естественный вход в продукт.**
