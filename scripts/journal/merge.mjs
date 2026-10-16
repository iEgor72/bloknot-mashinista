/** @typedef {import('./types.js').Shift} Shift */

/** Ignore UI flags and object key order when comparing a persisted shift. */
/** @param {Shift | null} shift @returns {Shift | null} */
export function cleanShift(shift) {
  if (!shift) return null;
  const result = /** @type {Shift} */ ({});
  for (const key of Object.keys(shift).sort()) {
    if (key !== 'pending' && shift[key] !== undefined) result[key] = shift[key];
  }
  return result;
}

export function sameShift(a, b) {
  return JSON.stringify(cleanShift(a)) === JSON.stringify(cleanShift(b));
}

export function copyShifts(shifts) {
  return (shifts || []).map(cleanShift);
}

export function sameJournal(a, b) {
  const left = new Map((a || []).map(shift => [String(shift.id), shift]));
  const right = new Map((b || []).map(shift => [String(shift.id), shift]));
  return left.size === right.size && [...left].every(([id, value]) => sameShift(value, right.get(id)));
}

export function changedIds(base, local) {
  const before = new Map((base || []).map(shift => [String(shift.id), shift]));
  const after = new Map((local || []).map(shift => [String(shift.id), shift]));
  return [...new Set([...before.keys(), ...after.keys()])].filter(id => !sameShift(before.get(id), after.get(id)));
}

/**
 * A missing row is a deletion, not a row to resurrect by unioning both lists.
 * Conflicts retain the local value for display but must be resolved before PUT.
 */
export function mergeJournals(base, local, remote, reviewLegacy = false) {
  const index = rows => new Map((rows || []).map(row => [String(row.id), row]));
  const before = index(base), mine = index(local), theirs = index(remote);
  const ids = [...new Set([...theirs.keys(), ...mine.keys(), ...before.keys()])];
  const shifts = [], conflicts = [];
  for (const id of ids) {
    const b = before.get(id), l = mine.get(id), r = theirs.get(id);
    let chosen;
    if (sameShift(l, r)) chosen = r;
    else if (!reviewLegacy && sameShift(l, b)) chosen = r;
    else if (!reviewLegacy && sameShift(r, b)) chosen = l;
    else {
      conflicts.push({ id, base: cleanShift(b), local: cleanShift(l), remote: cleanShift(r) });
      chosen = l;
    }
    if (chosen) shifts.push(cleanShift(chosen));
  }
  return { shifts, conflicts };
}

export function resolveJournalConflicts(shifts, conflicts, choice) {
  if (choice !== 'local' && choice !== 'remote') throw new Error('Invalid conflict choice');
  const rows = new Map(copyShifts(shifts).map(row => [String(row.id), row]));
  for (const conflict of conflicts) {
    const value = conflict[choice];
    if (value) rows.set(conflict.id, cleanShift(value));
    else rows.delete(conflict.id);
  }
  return [...rows.values()];
}
