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
    shifts: shifts,
  };
}
