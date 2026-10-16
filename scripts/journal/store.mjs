import { copyShifts, sameJournal } from './merge.mjs';

const DB_NAME = 'shift-tracker-journals-v2';
const STORE = 'journals';

/** @typedef {import('./types.js').JournalState} JournalState */
/** @returns {JournalState} */
export function emptyJournal(userId) {
  return { schema: 2, userId: String(userId), generation: 0, revision: null,
    shifts: [], baseShifts: [], pending: false, needsReview: false,
    conflicts: [], status: 'local', error: '', lastSyncAt: '' };
}

export function readLegacyJournal(userId, storage) {
  const prefix = 'shift_tracker_shifts_';
  /** @type {Record<string, string | null>} */
  const backup = {};
  const read = key => {
    try { backup[key] = storage.getItem(key); return backup[key] ? JSON.parse(backup[key]) : null; }
    catch (_) { return null; }
  };
  const cacheKey = prefix + 'cache_v1_' + userId;
  const pendingKey = prefix + 'pending_v1_' + userId;
  const cached = read(cacheKey), pending = read(pendingKey);
  const valid = value => value && String(value.userId) === String(userId) && Array.isArray(value.shifts);
  const state = emptyJournal(userId);
  if (valid(cached)) state.shifts = copyShifts(cached.shifts);
  state.baseShifts = copyShifts(state.shifts);
  if (valid(pending)) {
    state.shifts = copyShifts(pending.shifts);
    state.pending = true;
    // A v1 full snapshot has no deletion base. Never guess which remote rows
    // were deleted: require review if its first server snapshot differs.
    state.needsReview = true;
    state.status = 'pending';
  }
  state.legacyBackup = backup;
  return { state, pendingKey, pendingRaw: backup[pendingKey], hasPending: valid(pending) };
}

export class JournalStore {
  constructor(factory = globalThis.indexedDB, storage) {
    this.factory = factory;
    try { this.storage = storage || globalThis.localStorage; } catch (_) { this.storage = null; }
    /** @type {Promise<IDBDatabase> | null} */
    this.database = null;
  }

  open() {
    if (this.database) return this.database;
    this.database = new Promise((resolve, reject) => {
      if (!this.factory) { reject(new Error('Локальное хранилище недоступно')); return; }
      const request = this.factory.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'userId' });
      request.onerror = () => reject(request.error || new Error('Не удалось открыть локальное хранилище'));
      request.onblocked = () => reject(new Error('Закройте другие окна Блокнота и повторите'));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); this.database = null; };
        resolve(db);
      };
    }).catch(error => { this.database = null; throw error; });
    return this.database;
  }

  /** @returns {Promise<JournalState | null>} */
  async get(userId) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(String(userId));
      let value;
      request.onsuccess = () => { value = request.result || null; };
      tx.oncomplete = () => resolve(value);
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('Ошибка чтения записей'));
    });
  }

  /** The synchronous transform and write share one readwrite transaction. */
  /** @param {(state: JournalState | null) => JournalState} transform @returns {Promise<JournalState>} */
  async mutate(userId, transform) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const table = tx.objectStore(STORE);
      const request = table.get(String(userId));
      let result, transformError;
      request.onsuccess = () => {
        try {
          result = transform(request.result || null);
          if (!result || String(result.userId) !== String(userId)) throw new Error('Journal account mismatch');
          table.put(result);
        } catch (error) { transformError = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () => reject(transformError || tx.error || new Error('Не удалось сохранить на устройстве'));
    });
  }

  async initialize(userId) {
    const legacy = readLegacyJournal(userId, this.storage);
    const existing = await this.get(userId);
    const changedLegacy = legacy.hasPending && (!existing ||
      existing.legacyBackup?.[legacy.pendingKey] !== legacy.pendingRaw);
    const state = await this.mutate(userId, current => {
      if (!current) return legacy.state;
      if (!changedLegacy) return current;
      // An old tab wrote v1 pending after the migration. Preserve both sides for
      // explicit review; never let an old whole-journal snapshot replace v2.
      if (sameJournal(current.shifts, legacy.state.shifts)) return { ...current, legacyBackup: { ...current.legacyBackup, ...legacy.state.legacyBackup } };
      return { ...current, generation: current.generation + 1, pending: true,
        needsReview: true, status: 'conflict', error: '',
        legacyBackup: { ...current.legacyBackup, ...legacy.state.legacyBackup },
        conflicts: [{ id: '__legacy_journal__', base: null, local: null, remote: null }],
        legacyJournal: legacy.state.shifts };
    });
    // Only remove the exact pending value durably copied into this account.
    // The original bytes remain in the atomic v2 record as a recovery backup.
    if (legacy.hasPending) {
      try { if (this.storage.getItem(legacy.pendingKey) === legacy.pendingRaw) this.storage.removeItem(legacy.pendingKey); } catch (_) {}
    }
    return state;
  }
}
