import test from 'node:test';
import assert from 'node:assert/strict';
import { JournalEngine } from '../../scripts/journal/engine.mjs';
import { emptyJournal, readLegacyJournal } from '../../scripts/journal/store.mjs';
import { mergeJournals, resolveJournalConflicts } from '../../scripts/journal/merge.mjs';
const row = (id, notes = '') => ({ id, start_msk: '2026-10-16T08:00', end_msk: '2026-10-16T20:00', created_at:'2026-10-16T07:00:00Z', notes });
class MemoryStore {
  records = new Map();
  async initialize(id) { if (!this.records.has(id)) this.records.set(id, emptyJournal(id)); return structuredClone(this.records.get(id)); }
  async get(id) { return structuredClone(this.records.get(id)); }
  async mutate(id, fn) { const value = fn(await this.get(id)); this.records.set(id, structuredClone(value)); return structuredClone(value); }
}
function make(options = {}) { return new JournalEngine({ userId:'A', store:new MemoryStore(), online:()=>true, request:async()=>({ok:true,body:{sid:'A',revision:0,shifts:[]}}), ...options }); }
test('three-way merge preserves independent edits and deletions', () => {
  const b=[row('1'),row('2')], local=[row('2','mine')], remote=[row('1'),row('2'),row('3')];
  const merged=mergeJournals(b,local,remote);
  assert.deepEqual(merged.conflicts,[]);assert.deepEqual(merged.shifts.map(x=>x.id).sort(),['2','3']);assert.equal(merged.shifts.find(x=>x.id==='2').notes,'mine');
});
test('delete versus edit requires review and both choices work',()=>{
  const merged=mergeJournals([row('1')],[],[row('1','remote')]);
  assert.equal(merged.conflicts.length,1);assert.deepEqual(resolveJournalConflicts(merged.shifts,merged.conflicts,'local'),[]);
  assert.equal(resolveJournalConflicts(merged.shifts,merged.conflicts,'remote')[0].notes,'remote');
});
test('two saves of the same row before the first transaction completes keep the latest edit',async()=>{
 const e=make({online:()=>false});await e.initialize();await Promise.all([e.save([row('1','first')]),e.save([row('1','second')])]);
 assert.equal(e.state.shifts[0].notes,'second');assert.equal(e.state.pending,true);
});
test('PUT acknowledgement cannot erase a newer local save and a single sync drains it',async()=>{
 let server={sid:'A',revision:0,shifts:[]}, putStarted, release;
 const started=new Promise(r=>putStarted=r), gate=new Promise(r=>release=r);let puts=0,active=0,max=0;
 const e=make({request:async(method,body)=>{active++;max=Math.max(max,active);try{
   if(method==='GET') return {ok:true,body:structuredClone(server)};
   puts++;if(puts===1){putStarted();await gate;}
   assert.equal(body.baseRevision,server.revision);server={sid:'A',revision:server.revision+1,shifts:body.shifts};return{ok:true,body:structuredClone(server)};
 }finally{active--;}}});
 await e.initialize();await e.save([row('1')]);const syncing=e.sync();await started;
 await e.save([row('1'),row('2')]);assert.equal(e.sync(),syncing);release();await syncing;
 assert.equal(max,1);assert.equal(puts,2);assert.deepEqual(e.state.shifts.map(x=>x.id),['1','2']);assert.equal(e.state.pending,false);e.close();
});
test('empty pending journal sends deletion instead of restoring the final shift',async()=>{
 let server={sid:'A',revision:3,shifts:[row('1')]};let sent;
 const e=make({request:async(method,body)=>method==='GET'?{ok:true,body:server}:(sent=body,{ok:true,body:{...server,revision:4,shifts:body.shifts}})});
 await e.initialize();await e.applyRemote(server);await e.save([]);await e.sync();assert.deepEqual(sent.shifts,[]);assert.deepEqual(e.state.shifts,[]);assert.equal(e.state.pending,false);e.close();
});
test('stale server snapshot is rejected, unrelated newer revision retains unresolved conflict',async()=>{
 const e=make();await e.initialize();await e.applyRemote({sid:'A',revision:2,shifts:[row('1')]});await e.save([row('1','mine')]);
 await e.applyRemote({sid:'A',revision:3,shifts:[row('1','theirs')]});assert.equal(e.state.conflicts.length,1);
 await e.applyRemote({sid:'A',revision:4,shifts:[row('1','theirs'),row('2')]});assert.equal(e.state.conflicts.length,1);assert.equal(e.state.shifts.find(x=>x.id==='1').notes,'mine');
 await e.applyRemote({sid:'A',revision:1,shifts:[]});assert.equal(e.state.revision,4);
 await assert.rejects(e.applyRemote({sid:'B',revision:5,shifts:[]}),/некорректный/);e.close();
});
test('durable storage failure rejects save without success or queue deletion',async()=>{
 const e=make();await e.initialize();e.store.mutate=async()=>{throw new DOMException('Full','QuotaExceededError');};
 await assert.rejects(e.save([row('lost')]),/Full/);assert.deepEqual(e.state.shifts,[]);
});
test('editing a conflicted local row updates the version used by explicit resolution',async()=>{
 const e=make({online:()=>false});await e.initialize();await e.applyRemote({sid:'A',revision:1,shifts:[row('1')]});
 await e.save([row('1','mine')]);await e.applyRemote({sid:'A',revision:2,shifts:[row('1','theirs')]});
 await e.save([row('1','my-latest')]);await e.resolveConflicts('local');assert.equal(e.state.shifts[0].notes,'my-latest');assert.equal(e.state.conflicts.length,0);e.close();
});
test('legacy queue migration is account-scoped, retains raw backup and empty deletion',()=>{
 const values=new Map([['shift_tracker_shifts_pending_v1_A',JSON.stringify({userId:'A',shifts:[]})],['shift_tracker_shifts_pending_v1_B',JSON.stringify({userId:'B',shifts:[row('private')]})]]);
 const legacy=readLegacyJournal('A',{getItem:key=>values.get(key)});assert.equal(legacy.hasPending,true);assert.deepEqual(legacy.state.shifts,[]);assert.equal(legacy.state.needsReview,true);
 assert.ok(legacy.state.legacyBackup.shift_tracker_shifts_pending_v1_A);assert.equal(values.size,2);
 assert.deepEqual(readLegacyJournal('C',{getItem:key=>values.get(key)}).state.shifts,[]);
});
