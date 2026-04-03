function sanitizeShift(shift) {
  var copy = {};
  var keys = Object.keys(shift || {});
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] === 'pending') continue;
    copy[keys[i]] = shift[keys[i]];
  }
  return copy;
}

export function parseShiftsPayload(body) {
  var shifts = Array.isArray(body && body.shifts) ? body.shifts : null;
  if (!shifts) {
    return {
      ok: false,
      error: 'Expected { shifts: [] }',
    };
  }

  return {
    ok: true,
    shifts: shifts.map(sanitizeShift),
  };
}
