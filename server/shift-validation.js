'use strict';

// Calendar validation is deliberately independent of the host timezone.
function parseShiftDate(value, field) {
  if (typeof value !== 'string' || value.length > 48) throw new Error(`Invalid ${field}`);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
  if (!match) throw new Error(`Invalid ${field}`);
  const [, yy, mm, dd, hh, mi, ss = '0', ms = '0', zone] = match;
  const [year, month, day, hour, minute, second] = [yy, mm, dd, hh, mi, ss].map(Number);
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) throw new Error(`Invalid ${field}`);
  const check = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) throw new Error(`Invalid ${field}`);
  if (field !== 'created_at' && zone && zone !== '+03:00') throw new Error(`Invalid ${field}: use Moscow wall time`);
  if (zone && zone !== 'Z') {
    const parts = zone.slice(1).split(':').map(Number);
    if (parts[0] > 14 || parts[1] > 59 || (parts[0] === 14 && parts[1])) throw new Error(`Invalid ${field}`);
  }
  const millis = Date.parse(value + (zone ? '' : '+03:00'));
  if (!Number.isFinite(millis)) throw new Error(`Invalid ${field}`);
  return millis;
}

function validateShiftDates(shift) {
  const start = parseShiftDate(shift.start_msk, 'start_msk');
  const end = parseShiftDate(shift.end_msk, 'end_msk');
  parseShiftDate(shift.created_at, 'created_at');
  if (end <= start) throw new Error('Invalid shift interval: end must follow start');
}

module.exports = { parseShiftDate, validateShiftDates };
