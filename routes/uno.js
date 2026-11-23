/* Room UNO online (server menyimpan kartu semua pemain; klien hanya dapat kartunya sendiri). Dipasang dari server.js */
const Uno = require('../public/js/uno-engine.js');
module.exports = function ({ app, auth, bad, crypto, CHAT, saveChat, bcast, avV, isStaff, rmImg, closed, gmWin }) {
const UR = new Map(), uJoinHits = new Map();
setInterval(() => uJoinHits.clear(), 60000).unref();
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const uCode = () => { for (let t = 0; t < 40; t++) { let c = ''; for (let i = 0; i < 5; i++) c += ALPHA[crypto.randomInt(ALPHA.length)]; if (!UR.has(c)) return c; } return null; };
const uIdx = (room, k) => room.players.findIndex((p) => p.k === k);
const uFind = (k) => { for (const rm of UR.values()) if (uIdx(rm, k) >= 0) return rm; return null; };
const uGet = (q, r) => {
  const code = String((q.body && q.body.code) || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8), room = UR.get(code);
  if (!room || uIdx(room, q.key) < 0) { bad(r, 404, 'Room UNO tidak ditemukan atau kamu sudah keluar.'); return null; }
  room.seen[q.key] = Date.now(); room.act = Date.now();
  return room;
};
function uPub(room, k) {
  const me = uIdx(room, k), g = room.g, now = Date.now();
  const o = { code: room.code, v: room.v, status: room.status, you: me, host: me === 0, max: 4,
    players: room.players.map((p, i) => ({ name: p.name, n: g ? (g.hands[i] || []).length : 0, away: Math.max(0, Math.round((now - (room.seen[p.k] || 0)) / 1000)), av: p.av || 0 })) };
  if (g) {
    o.hand = g.hands[me] || []; o.top = g.top; o.color = g.color; o.dir = g.dir; o.turn = g.turn; o.drawN = g.draw.length; o.moves = g.moves;
    o.pend = g.pend && g.pend.p === me ? g.pend.i : -1; o.unoP = g.uno ? g.uno.p : -1; o.called = !!g.called[me]; o.last = g.last; o.winner = g.winner;
    if (g.status === 'over') o.pts = Uno.points(g);
  }
  return o;
}
const uEnd = (room) => { // pemenang online +5 poin papan peringkat (minimal 8 langkah, 2 akun berbeda)
  const g = room.g;
  if (g.status !== 'over' || room.awarded) return;
  room.status = 'over'; room.awarded = true;
  try { const w = room.players[g.winner]; if (w && gmWin && room.players.length >= 2 && g.moves >= 8) gmWin(w.k, 5, 'uno'); } catch (e) {}
};
const uDone = (room, q, r) => { room.v++; if (room.g) uEnd(room); r.set('Cache-Control', 'no-store').json(uPub(room, q.key)); };
setInterval(() => { const now = Date.now(); for (const [c, rm] of UR) if (now - rm.act > 3 * 3600e3 || (rm.status === 'wait' && now - rm.created > 30 * 60e3)) UR.delete(c); }, 60000).unref();

app.post('/api/uno/mine', auth, (q, r) => { const room = uFind(q.key); if (room) room.seen[q.key] = Date.now(); r.set('Cache-Control', 'no-store').json({ room: room ? uPub(room, q.key) : null }); });
app.post('/api/uno/create', auth, (q, r) => {
  const old = uFind(q.key);
  if (old) {
    if (old.status === 'play') return bad(r, 400, 'Kamu masih di game UNO room ' + old.code + '. Lanjutkan atau keluar dulu.');
    leave(old, q.key);
  }
  const code = uCode(); if (!code) return bad(r, 500, 'Gagal membuat room, coba lagi.');
  const room = { code, players: [{ k: q.key, name: q.u.name, av: avV(q.u) }], g: null, status: 'wait', v: 1, seen: { [q.key]: Date.now() }, created: Date.now(), act: Date.now(), awarded: false };
  UR.set(code, room);
  r.set('Cache-Control', 'no-store').json(uPub(room, q.key));
});
app.post('/api/uno/join', auth, (q, r) => {
  const n = (uJoinHits.get(q.key) || 0) + 1; uJoinHits.set(q.key, n);
  if (n > 20) return bad(r, 429, 'Terlalu banyak percobaan, tunggu semenit.');
  const code = String((q.body && q.body.code) || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8), room = UR.get(code);
  if (!room) return bad(r, 404, 'Kode room tidak ditemukan.');
  if (uIdx(room, q.key) >= 0) { room.seen[q.key] = Date.now(); return r.set('Cache-Control', 'no-store').json(uPub(room, q.key)); }
  if (room.status === 'play') return bad(r, 400, 'Game di room ini sudah berjalan.');
  if (room.players.length >= 4) return bad(r, 400, 'Room sudah penuh (maks. 4 pemain).');
  const old = uFind(q.key);
  if (old) { if (old.status === 'play') return bad(r, 400, 'Kamu masih di game UNO room ' + old.code + '.'); leave(old, q.key); }
  room.players.push({ k: q.key, name: q.u.name, av: avV(q.u) }); room.seen[q.key] = Date.now(); room.act = Date.now(); room.v++;
  r.set('Cache-Control', 'no-store').json(uPub(room, q.key));
});
app.post('/api/uno/state', auth, (q, r) => {
  const room = uGet(q, r); if (!room) return;
  r.set('Cache-Control', 'no-store');
  const pub = uPub(room, q.key);
  if (Number(q.body && q.body.v) === room.v) return r.json({ same: 1, v: room.v, away: pub.players.map((p) => p.away) });
  r.json(pub);
});
app.post('/api/uno/start', auth, (q, r) => {
  const room = uGet(q, r); if (!room) return;
  if (uIdx(room, q.key) !== 0) return bad(r, 403, 'Hanya host yang bisa memulai.');
  if (room.status === 'play') return bad(r, 400, 'Game sudah berjalan.');
  if (room.players.length < 2) return bad(r, 400, 'Minimal 2 pemain.');
  room.g = Uno.create(room.players.length); room.status = 'play'; room.awarded = false;
  uDone(room, q, r);
});
const act = (fn) => (q, r) => {
  const room = uGet(q, r); if (!room) return;
  if (room.status !== 'play' || !room.g) return bad(r, 400, 'Game belum berjalan.');
  const me = uIdx(room, q.key), res = fn(room.g, me, q.body || {});
  if (!res.ok) return bad(r, 400, res.err);
  uDone(room, q, r);
};
app.post('/api/uno/play', auth, act((g, me, b) => Uno.play(g, me, Math.floor(Number(b.i)), String(b.color || ''))));
app.post('/api/uno/draw', auth, act((g, me) => Uno.draw(g, me)));
app.post('/api/uno/pass', auth, act((g, me) => Uno.pass(g, me)));
app.post('/api/uno/call', auth, act((g, me) => Uno.callUno(g, me)));
app.post('/api/uno/catch', auth, act((g, me) => Uno.catchUno(g, me)));
app.post('/api/uno/kick', auth, (q, r) => { // keluarkan pemain yang giliran tapi sudah menghilang >= 60 detik
  const room = uGet(q, r); if (!room) return;
  if (room.status !== 'play' || !room.g || room.g.status !== 'play') return bad(r, 400, 'Game tidak berjalan.');
  const t = room.g.turn, tp = room.players[t], me = uIdx(room, q.key);
  if (t === me) return bad(r, 400, 'Itu giliranmu.');
  if (Date.now() - (room.seen[tp.k] || 0) < 60000) return bad(r, 400, 'Pemain itu masih terhubung.');
  Uno.removePlayer(room.g, t); room.players.splice(t, 1);
  uDone(room, q, r);
});
function leave(room, k) {
  const i = uIdx(room, k); if (i < 0) return;
  if (room.status === 'play' && room.g && room.g.status === 'play') { Uno.removePlayer(room.g, i); room.players.splice(i, 1); if (room.g.status === 'over') uEnd(room); }
  else { room.players.splice(i, 1); if (room.g && room.g.status === 'over' && room.g.winner > i) room.g.winner--; }
  room.v++;
  if (!room.players.length || (room.status === 'wait' && !room.players.length)) UR.delete(room.code);
}
app.post('/api/uno/leave', auth, (q, r) => { const room = uGet(q, r); if (!room) return r.json({ ok: 1 }); leave(room, q.key); r.json({ ok: 1 }); });
const uInv = new Map(); setInterval(() => uInv.clear(), 60000).unref();
app.post('/api/uno/invite', auth, (q, r) => {
  const room = uGet(q, r); if (!room) return;
  if (room.status === 'play') return bad(r, 400, 'Game sudah berjalan, undangan tidak diperlukan.');
  if (room.players.length >= 4) return bad(r, 400, 'Room sudah penuh.');
  if (closed() && !isStaff(q.u)) return bad(r, 403, 'Global Chat sedang ditutup oleh Developer.');
  const now = Date.now();
  if (now - (uInv.get(q.key) || 0) < 20000) return bad(r, 429, 'Tunggu sebentar sebelum mengundang lagi.');
  uInv.set(q.key, now);
  const m = { id: crypto.randomBytes(6).toString('hex'), u: q.u.name, v: avV(q.u), rl: q.u.role || 'user', bd: !!q.u.badge, dv: !!q.u.dev, t: 'Ayo main UNO bareng aku! Room: ' + room.code, ts: now, un: room.code };
  CHAT.push(m);
  if (CHAT.length > 300) CHAT.splice(0, CHAT.length - 300).forEach(rmImg);
  saveChat(); bcast('msg', m);
  r.json({ ok: 1 });
});
};
