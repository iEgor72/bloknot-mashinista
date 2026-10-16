import { copyShifts, sameJournal, mergeJournals, changedIds, resolveJournalConflicts } from './merge.mjs';

/** A per-account, single-flight journal. IndexedDB transactions arbitrate tabs. */
export class JournalEngine {
  /** @param {{userId: string, store: import('./store.mjs').JournalStore, request: (method: string, body?: object) => Promise<{ok: boolean, status?: number, body: import('./types.js').JournalResponse}>, online?: () => boolean, onChange?: (state: import('./types.js').JournalState) => void}} options */
  constructor({ userId, store, request, online = () => navigator.onLine, onChange = () => {} }) {
    this.userId = String(userId);
    this.store = store;
    this.request = request;
    this.online = online;
    this.onChange = onChange;
    /** @type {import('./types.js').JournalState | null} */
    this.state = null;
    this.running = null;
    this.saves = Promise.resolve();
    this.retry = null;
    this.queuedSnapshot = null;
  }

  emit(state) {
    this.state = state;
    // A view failure must not turn an already committed transaction into a
    // reported save failure. Surface it separately for browser diagnostics.
    try { this.onChange(state); }
    catch (error) {
      if (typeof globalThis.reportError === 'function') globalThis.reportError(error);
      else console.error('Journal view update failed:', error.name);
    }
    return state;
  }

  async initialize() { return this.emit(await this.store.initialize(this.userId)); }
  async refresh() {
    const state = await this.store.get(this.userId);
    if (state && (!this.state || state.generation >= this.state.generation)) this.emit(state);
    return this.state;
  }

  save(shifts) {
    const snapshot = copyShifts(shifts);
    // Capture the version the caller actually edited, not a later queued save.
    const editedBase = copyShifts(this.queuedSnapshot || this.state?.shifts || []);
    this.queuedSnapshot = snapshot;
    const task = this.saves.then(async () => {
      const next = await this.store.mutate(this.userId, current => {
        if (!current) throw new Error('Journal not initialized');
        const merged = mergeJournals(editedBase, snapshot, current.shifts);
        if (merged.conflicts.length) throw new Error('Запись изменена в другом окне. Обновите журнал и повторите правку.');
        const conflicts = current.conflicts.map(conflict => conflict.id === '__legacy_journal__' ? conflict :
          { ...conflict, local: merged.shifts.find(row => String(row.id) === conflict.id) || null });
        return { ...current, shifts: merged.shifts, conflicts, generation: current.generation + 1,
          pending: true, status: current.conflicts.length ? 'conflict' : 'pending', error: '' };
      });
      this.emit(next);
      return next;
    });
    this.saves = task.then(() => {}, () => {}).finally(() => {
      if (this.queuedSnapshot === snapshot) this.queuedSnapshot = null;
    });
    return task;
  }

  async applyRemote(journal) {
    if (!journal || String(journal.sid) !== this.userId || !Number.isSafeInteger(journal.revision) || journal.revision < 0 || !Array.isArray(journal.shifts)) {
      throw new Error('Сервер вернул некорректный журнал');
    }
    return this.emit(await this.store.mutate(this.userId, current => {
      if (current.revision !== null && journal.revision < current.revision) return current;
      // A conflict requires a deliberate choice. Repeated foreground refreshes
      // must not silently drop it by rebasing on the same server snapshot.
      if (current.conflicts.length && current.revision === journal.revision) return current;
      const merged = mergeJournals(current.baseShifts, current.shifts, journal.shifts, current.needsReview);
      for (const conflict of current.conflicts) {
        if (conflict.id === '__legacy_journal__') continue;
        const remote = journal.shifts.find(row => String(row.id) === conflict.id) || null;
        // Keep an unresolved choice explicit even when a newer remote version
        // changes an unrelated row. Rebase the remote candidate only.
        if (!merged.conflicts.some(item => item.id === conflict.id)) {
          merged.conflicts.push({ ...conflict, remote });
          merged.shifts = merged.shifts.filter(row => String(row.id) !== conflict.id);
          const local = current.shifts.find(row => String(row.id) === conflict.id);
          if (local) merged.shifts.push(local);
        }
      }
      if (current.legacyJournal) {
        merged.conflicts.push({ id: '__legacy_journal__', base: null, local: null, remote: null });
      }
      const pending = !sameJournal(merged.shifts, journal.shifts) || merged.conflicts.length > 0;
      return { ...current, shifts: merged.shifts, baseShifts: copyShifts(journal.shifts),
        revision: journal.revision, generation: current.generation + 1,
        pending, needsReview: false, conflicts: merged.conflicts,
        status: merged.conflicts.length ? 'conflict' : (pending ? 'pending' : 'synced'),
        error: '', lastSyncAt: new Date().toISOString() };
    }));
  }

  async acknowledge(sent, journal) {
    if (String(journal.sid) !== this.userId || !Number.isSafeInteger(journal.revision) || !Array.isArray(journal.shifts)) throw new Error('Некорректное подтверждение сохранения');
    return this.emit(await this.store.mutate(this.userId, current => {
      if (current.revision !== null && journal.revision < current.revision) return current;
      // Changes saved while PUT was in flight remain in the outbox. Only the
      // captured snapshot is acknowledged, never a newer generation.
      const merged = mergeJournals(sent.shifts, current.shifts, journal.shifts);
      const pending = !sameJournal(merged.shifts, journal.shifts) || merged.conflicts.length > 0;
      return { ...current, shifts: merged.shifts, baseShifts: copyShifts(journal.shifts),
        revision: journal.revision, generation: current.generation + 1,
        pending, conflicts: merged.conflicts, needsReview: false,
        status: merged.conflicts.length ? 'conflict' : (pending ? 'pending' : 'synced'),
        error: '', lastSyncAt: new Date().toISOString() };
    }));
  }

  async setError(error) {
    const message = error?.message || 'Не удалось синхронизировать';
    try {
      this.emit(await this.store.mutate(this.userId, current => ({ ...current,
        generation: current.generation + 1, status: 'error', error: message })));
    } catch (_) {
      // Do not pretend a failed durable write succeeded. The last committed
      // record is still in IndexedDB and the UI receives the storage error.
      if (this.state) this.emit({ ...this.state, status: 'storage-error', error: 'Не удалось записать данные на устройстве' });
    }
  }

  sync() {
    if (this.running) return this.running;
    this.running = this.runSync().finally(() => { this.running = null; });
    return this.running;
  }

  async runSync() {
    await this.saves;
    if (!this.online()) { await this.refresh(); return this.state; }
    if (this.retry) { clearTimeout(this.retry); this.retry = null; }
    try {
      await this.refresh();
      if (!this.state) await this.initialize();
      this.emit({ ...this.state, status: 'syncing', error: '' });
      const response = await this.request('GET');
      if (!response.ok) throw new Error(response.status === 401 ? 'Нужен повторный вход в Блокнот' : 'Не удалось загрузить журнал');
      await this.applyRemote(response.body);
      // Re-check persistent state on every iteration: another tab may have
      // advanced it while the request was in flight.
      for (let attempt = 0; attempt < 12; attempt++) {
        await this.saves;
        await this.refresh();
        const sent = this.state;
        if (sent.conflicts.length || !sent.pending || !this.online()) return sent;
        this.emit({ ...sent, status: 'syncing' });
        const result = await this.request('PUT', { shifts: copyShifts(sent.shifts), baseRevision: sent.revision });
        if (result.ok) await this.acknowledge(sent, result.body);
        else if (result.status === 409) await this.applyRemote(result.body);
        else throw new Error(result.status === 401 ? 'Нужен повторный вход в Блокнот' : (result.status === 400 ? 'Проверьте даты и данные смены' : 'Не удалось отправить изменения'));
      }
      throw new Error('Журнал часто меняется. Повторим синхронизацию позже.');
    } catch (error) {
      await this.setError(error);
      this.retry = setTimeout(() => { this.retry = null; if (this.online()) this.sync(); }, 30000);
      return this.state;
    }
  }

  async resolveConflicts(choice) {
    const next = await this.store.mutate(this.userId, current => {
      let shifts = resolveJournalConflicts(current.shifts, current.conflicts.filter(item => item.id !== '__legacy_journal__'), choice);
      if (current.legacyJournal && choice === 'local') {
        // Explicitly reviewed v1 data is applied on top of the latest journal;
        // the v2 copy remains in the durable legacy backup for recovery.
        shifts = mergeJournals([], current.legacyJournal, shifts).shifts;
      }
      return { ...current, shifts, legacyJournal: null, conflicts: [], needsReview: false,
        generation: current.generation + 1, pending: !sameJournal(shifts, current.baseShifts),
        status: sameJournal(shifts, current.baseShifts) ? 'synced' : 'pending', error: '' };
    });
    this.emit(next);
    return this.sync();
  }

  pendingIds() { return changedIds(this.state?.baseShifts || [], this.state?.shifts || []); }
  close() { if (this.retry) clearTimeout(this.retry); }
}
