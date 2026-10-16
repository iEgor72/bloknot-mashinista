const test=require('node:test');
const assert=require('node:assert/strict');
const {validateShiftDates}=require('../../server/shift-validation');
const valid={start_msk:'2026-10-16T20:00',end_msk:'2026-10-17T08:00',created_at:'2026-10-16T16:00:00.123Z'};
test('shift dates validate real calendars, intervals and Moscow wall time',()=>{
 assert.doesNotThrow(()=>validateShiftDates(valid));
 assert.doesNotThrow(()=>validateShiftDates({...valid,start_msk:valid.start_msk+'+03:00',end_msk:valid.end_msk+'+03:00'}));
 assert.doesNotThrow(()=>validateShiftDates({...valid,start_msk:'2028-02-29T08:00',end_msk:'2028-02-29T20:00'}));
 for(const start_msk of ['not-a-date','2026-02-29T08:00','2026-04-31T08:00','2026-13-01T00:00','2026-10-16T24:00','2026-10-16T20:61','2026-10-16T20:00Z'])assert.throws(()=>validateShiftDates({...valid,start_msk}),/Invalid/);
 for(const end_msk of [valid.start_msk,'2026-10-16T19:00'])assert.throws(()=>validateShiftDates({...valid,end_msk}),/Invalid shift interval/);
 assert.throws(()=>validateShiftDates({...valid,created_at:'2026-02-30T00:00Z'}),/Invalid created_at/);
});
