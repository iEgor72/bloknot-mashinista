# Methods

Generated: 2026-04-17 15:18:26 +10:00

## Authentication Methods
- Telegram WebApp enabled (`initData` verification).
- Session restore from backend enabled.
- Browser mode uses Telegram Login Widget callback (`/api/auth?mode=telegram-login`).

## Data Sync Methods
- Shift list uses authenticated API calls (`/api/shifts`) with bearer token.
- Optimistic UI update on shift delete/save: present.
- Pending/offline mutation handling: present.
- Cached shell bootstrap path: present.

## Search and Docs Methods
- Russian stemming for instruction search: present.
- Fuzzy matching (bounded Levenshtein + chargrams): present.
- Docs offline cache state checks via Cache API: present.

## Offline and Caching Methods
- SW navigation network-first: present.
- SW stale-while-revalidate for assets: present.
- Warm shell pre-cache + runtime warmup through service worker message channel.

## Data Persistence Methods
- Stats session upsert in D1: present.
- Legacy `shift_sets.global` -> user migration: present.
- Session cookies + signed bearer token share one signature scheme.

## Operational Methods
- PM2 process file for VPS runtime (`ecosystem.config.js`).
- Bot webhook bootstrap helper (`scripts/setup-bot-webhook.py`).
- Dataset builder for instructions (`scripts/build-instructions-dataset.py`).
