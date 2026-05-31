// Throwaway smoke test for Phase 1 partner pairing endpoints.
// Mints two session tokens (same scheme as server.js) and exercises the flow.
import crypto from 'node:crypto';

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:3000';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'smoke-test-bot-token';

const sha256Buf = (input) => crypto.createHash('sha256').update(input, 'utf8').digest();
const hmacHex = (keyBuf, msg) => crypto.createHmac('sha256', keyBuf).update(msg, 'utf8').digest('hex');
const b64url = (str) => Buffer.from(str, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function tokenFor(user) {
  const payload = JSON.stringify({ user, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 });
  return b64url(payload) + '.' + hmacHex(sha256Buf(BOT_TOKEN), payload);
}

const A = tokenFor({ id: 'smokeA', first_name: 'Андрей', display_name: 'Андрей (машинист)' });
const B = tokenFor({ id: 'smokeB', first_name: 'Борис', display_name: 'Борис (помощник)' });

async function call(token, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function assert(cond, label, ctx) {
  if (!cond) {
    console.error('FAIL:', label, JSON.stringify(ctx));
    process.exitCode = 1;
  } else {
    console.log('ok  :', label);
  }
}

const r = (x) => JSON.stringify(x.json);

// 1. A creates an invite code.
const invite = await call(A, 'POST', '/api/partners/invite');
assert(invite.status === 200 && invite.json.code, 'A creates invite', invite);
const code = invite.json.code;

// 2. B redeems it → pairing created, active for B.
const redeem = await call(B, 'POST', '/api/partners/redeem', { code });
assert(redeem.status === 200 && redeem.json.pairing, 'B redeems code', redeem);
assert(redeem.json.pairing.partnerLabel === 'Андрей (машинист)', 'B sees A label', redeem);
assert(redeem.json.pairing.isActive === true, 'pairing active for B', redeem);
const pairingId = redeem.json.pairing.pairingId;

// 3. Same code cannot be reused.
const reuse = await call(B, 'POST', '/api/partners/redeem', { code });
assert(reuse.status === 404, 'code is single-use', reuse);

// 4. Both sides list the partner.
const listA = await call(A, 'GET', '/api/partners');
assert(listA.json.partners.length === 1 && listA.json.partners[0].partnerLabel === 'Борис (помощник)', 'A address book shows B', listA);
const listB = await call(B, 'GET', '/api/partners');
assert(listB.json.partners.length === 1, 'B address book shows A', listB);

// 5. A switches active pointer off then back on.
const offA = await call(A, 'POST', '/api/partners/active', { pairingId: null });
assert(offA.json.activePairingId === '', 'A clears active', offA);
const onA = await call(A, 'POST', '/api/partners/active', { pairingId });
assert(onA.json.activePairingId === pairingId, 'A sets active', onA);

// 5b. A shares a shift's facts → lands in B's inbox (facts only, no money fields).
const sampleShift = {
  id: 'src-shift-1',
  start_msk: '2026-05-12T08:00',
  end_msk: '2026-05-12T20:00',
  train_number: '2742',
  route_from: 'Хабаровск',
  route_to: 'Волочаевка',
  notes: 'Тестовая смена',
  salary_total: 9999,       // must NOT cross over
  poekhali_run_id: 'abc',   // must NOT cross over
};
const share1 = await call(A, 'POST', '/api/shifts/share', { shift: sampleShift, sourceId: sampleShift.id });
assert(share1.status === 200 && share1.json.delivered, 'A shares shift to B', share1);

const inboxB1 = await call(B, 'GET', '/api/shifts/inbox');
assert(inboxB1.json.items.length === 1, 'B inbox has 1 proposal', inboxB1);
const facts = inboxB1.json.items[0].facts || {};
assert(facts.train_number === '2742' && facts.route_to === 'Волочаевка', 'facts carried over', inboxB1);
assert(facts.salary_total === undefined && facts.poekhali_run_id === undefined, 'money/poekhali stripped', inboxB1);
assert(inboxB1.json.items[0].sharedByName === 'Андрей (машинист)', 'inbox shows sender name', inboxB1);
assert(inboxB1.json.items[0].autoAccept === false, 'first share is NOT autoAccept (no trust yet)', inboxB1);

// 5c. Re-sharing the same source shift updates in place (no duplicate).
const share2 = await call(A, 'POST', '/api/shifts/share', { shift: { ...sampleShift, notes: 'Изменено' }, sourceId: sampleShift.id });
assert(share2.status === 200, 'A re-shares edited shift', share2);
const inboxB2 = await call(B, 'GET', '/api/shifts/inbox');
assert(inboxB2.json.items.length === 1, 'no duplicate after re-share', inboxB2);
assert((inboxB2.json.items[0].facts || {}).notes === 'Изменено', 'edited facts updated', inboxB2);

// 5d. B resolves (accept) → inbox empties AND B now trusts A.
const resolveB = await call(B, 'POST', '/api/shifts/inbox/resolve', { id: inboxB2.json.items[0].id, action: 'accept' });
assert(resolveB.status === 200 && resolveB.json.remaining === 0, 'B resolves proposal', resolveB);

// 5d2. Trust earned → A's next share is flagged autoAccept for B.
const share3 = await call(A, 'POST', '/api/shifts/share', { shift: { ...sampleShift, train_number: '9001' }, sourceId: 'src-2' });
assert(share3.status === 200, 'A shares again after trust', share3);
const inboxB3 = await call(B, 'GET', '/api/shifts/inbox');
const autoItem = inboxB3.json.items.find((i) => i.sourceId === 'src-2');
assert(autoItem && autoItem.autoAccept === true, 'second share is autoAccept (trust earned)', inboxB3);

// 5d3. Trust is directional: A has accepted nothing from B, so B→A is still manual.
const partnersAtrust = await call(A, 'GET', '/api/partners');
assert(partnersAtrust.json.partners[0].iTrustPartner === false, 'A does not trust B yet (directional)', partnersAtrust);
assert(partnersAtrust.json.partners[0].partnerTrustsMe === true, 'A sees that B trusts A', partnersAtrust);
await call(B, 'POST', '/api/shifts/inbox/resolve', { id: autoItem.id, action: 'accept' }); // clean up

// 5e. Sharing with no active partner → 409. (clear B active, B tries to share)
await call(B, 'POST', '/api/partners/active', { pairingId: null });
const shareNoActive = await call(B, 'POST', '/api/shifts/share', { shift: sampleShift, sourceId: 'x' });
assert(shareNoActive.status === 409, 'share without active partner rejected', shareNoActive);
await call(B, 'POST', '/api/partners/active', { pairingId }); // restore

// 5f. Explicit pairingId on share (offline-queue path) routes to that pairing.
const shareExplicit = await call(A, 'POST', '/api/shifts/share', { shift: { ...sampleShift, train_number: '7777' }, sourceId: 'src-explicit', pairingId: pairingId });
assert(shareExplicit.status === 200 && shareExplicit.json.delivered, 'share with explicit pairingId delivers', shareExplicit);
const inboxExplicit = await call(B, 'GET', '/api/shifts/inbox');
const explicitItem = inboxExplicit.json.items.find((i) => i.sourceId === 'src-explicit');
assert(!!explicitItem && (explicitItem.facts || {}).train_number === '7777', 'explicit-pairing share landed for B', inboxExplicit);

// 5g. Share with a bogus pairingId the caller is not a member of → rejected.
const shareBogus = await call(A, 'POST', '/api/shifts/share', { shift: sampleShift, sourceId: 'x', pairingId: 'ffffffffffffffffffffffff' });
assert(shareBogus.status === 409, 'share to non-member pairing rejected', shareBogus);
await call(B, 'POST', '/api/shifts/inbox/resolve', { id: explicitItem.id, action: 'dismiss' });

// 6. Cannot self-pair.
const selfInvite = await call(A, 'POST', '/api/partners/invite');
const selfRedeem = await call(A, 'POST', '/api/partners/redeem', { code: selfInvite.json.code });
assert(selfRedeem.status === 400, 'self-pair rejected', selfRedeem);

// 7. Unpair archives for both.
const del = await call(A, 'DELETE', '/api/partners/' + pairingId);
assert(del.status === 200, 'A unpairs', del);
const listAfter = await call(B, 'GET', '/api/partners');
assert(listAfter.json.partners.length === 0, 'B book empty after unpair', listAfter);
const activeAfter = await call(B, 'GET', '/api/partners');
assert(activeAfter.json.activePairingId === '', 'B active cleared after unpair', activeAfter);

// 8. Redeem rate limit: a fresh user hammering bogus codes eventually gets 429.
const C = tokenFor({ id: 'smokeC', first_name: 'Виктор', display_name: 'Виктор' });
let got429 = false;
let sawNon429 = false;
for (let i = 0; i < 14; i++) {
  const r = await call(C, 'POST', '/api/partners/redeem', { code: '000000' });
  if (r.status === 429) got429 = true;
  else sawNon429 = true;
}
assert(sawNon429 && got429, 'redeem rate limit kicks in after burst', { sawNon429, got429 });

console.log(process.exitCode ? '\nSMOKE FAILED' : '\nSMOKE PASSED');
