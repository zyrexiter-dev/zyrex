/* API catur online (room pakai kode, langkah divalidasi di server, chat room, undangan ke Global Chat).
   Dipasang dari server.js: require('./routes/chess.js')({ app, auth, bad, crypto, CHAT, saveChat, bcast, avV, isStaff, rmImg, closed }) */
module.exports = function ({ app, auth, bad, crypto, CHAT, saveChat, bcast, avV, isStaff, rmImg, closed, gmWin }) {
const ChessE = require('../public/js/chess-engine.js');
const CHR = new Map();   // kode -> room (disimpan di memori, hilang kalau server restart)
const CH_AB = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const chCode = () => { for (let i = 0; i < 60; i++) { let c = ''; for (let j = 0; j < 5; j++) c += CH_AB[crypto.randomInt(CH_AB.length)]; if (!CHR.has(c)) return c; } return null; };
const chSide = (room, k) => room.w && room.w.k === k ? 'w' : room.b && room.b.k === k ? 'b' : null;
const chOpp = (room, side) => side === 'w' ? room.b : room.w;
const chPub = (room, k) => {
  const you = chSide(room, k), opp = chOpp(room, you), now = Date.now();
  const away = opp && room.seen[opp.k] ? Math.floor((now - room.seen[opp.k]) / 1000) : 0;
  return {
    code: room.code, v: room.v, you, status: room.status, w: room.w ? room.w.name : null, b: room.b ? room.b.name : null,
    fen: room.pos.fen(), moves: room.sans, last: room.last, check: room.status !== 'wait' && room.pos.inCheck(), result: room.result,
    chat: room.chat.slice(-60), rm: { you: !!room.rm[k], opp: !!(opp && room.rm[opp.k]) }, away, left: !!(opp && room.gone[opp.k])
  };
};
const chFind = (k) => { for (const r of CHR.values()) if (chSide(r, k) && !r.gone[k]) return r; return null; };
const chGet = (q, r) => {
  const code = String((q.body && q.body.code) || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8), room = CHR.get(code);
  if (!room) { bad(r, 404, 'Room tidak ditemukan atau sudah ditutup.'); return null; }
  if (!chSide(room, q.key)) { bad(r, 403, 'Kamu bukan pemain di room ini.'); return null; }
  room.seen[q.key] = Date.now(); room.act = Date.now();
  return room;
};
const chEnd = (room, win, why) => {
  room.status = 'over'; room.result = { win, why }; room.v++;
  // papan peringkat: pemenang online dapat +5 poin (minimal 10 langkah, bukan klaim timeout, dua akun berbeda)
  try {
    const w = win === 1 ? room.w : win === -1 ? room.b : null;
    if (w && gmWin && why !== 'timeout' && room.sans.length >= 10 && room.w && room.b && room.w.k !== room.b.k) gmWin(w.k, 5);
  } catch (e) {}
};
const chJoinHits = new Map(); setInterval(() => chJoinHits.clear(), 60000).unref();
setInterval(() => {
  const now = Date.now();
  for (const [c, rm] of CHR) if (now - rm.act > 3 * 3600e3 || (rm.status === 'wait' && now - rm.created > 30 * 60e3)) CHR.delete(c);
}, 60000).unref();

app.post('/api/chess/mine', auth, (q, r) => { const room = chFind(q.key); if (room) room.seen[q.key] = Date.now(); r.set('Cache-Control', 'no-store').json({ room: room ? chPub(room, q.key) : null }); });
app.post('/api/chess/create', auth, (q, r) => {
  const old = chFind(q.key);
  if (old) {
    if (old.status === 'wait') CHR.delete(old.code);
    else if (old.status === 'play') return bad(r, 400, 'Kamu masih punya game berjalan di room ' + old.code + '. Lanjutkan atau menyerah dulu.');
    else old.gone[q.key] = true;
  }
  let c = String((q.body && q.body.color) || 'r'); if (c !== 'w' && c !== 'b') c = Math.random() < .5 ? 'w' : 'b';
  const code = chCode(); if (!code) return bad(r, 500, 'Gagal membuat room, coba lagi.');
  const me = { k: q.key, name: q.u.name };
  const room = { code, w: c === 'w' ? me : null, b: c === 'b' ? me : null, pos: ChessE.Pos.fromFen(ChessE.START, true), sans: [], last: null, status: 'wait', result: null, chat: [], v: 1, seen: { [q.key]: Date.now() }, rm: {}, gone: {}, created: Date.now(), act: Date.now() };
  CHR.set(code, room);
  r.set('Cache-Control', 'no-store').json(chPub(room, q.key));
});
app.post('/api/chess/join', auth, (q, r) => {
  const n = (chJoinHits.get(q.key) || 0) + 1; chJoinHits.set(q.key, n);
  if (n > 20) return bad(r, 429, 'Terlalu banyak percobaan, tunggu semenit.');
  const code = String((q.body && q.body.code) || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8), room = CHR.get(code);
  if (!room) return bad(r, 404, 'Kode room tidak ditemukan.');
  if (chSide(room, q.key)) { room.gone[q.key] = false; room.seen[q.key] = Date.now(); return r.set('Cache-Control', 'no-store').json(chPub(room, q.key)); }
  if (room.w && room.b) return bad(r, 400, 'Room sudah penuh.');
  const old = chFind(q.key);
  if (old) {
    if (old.status === 'wait') CHR.delete(old.code);
    else if (old.status === 'play') return bad(r, 400, 'Kamu masih punya game berjalan di room ' + old.code + '.');
    else old.gone[q.key] = true;
  }
  const me = { k: q.key, name: q.u.name };
  if (!room.w) room.w = me; else room.b = me;
  room.status = 'play'; room.v++; room.seen[q.key] = Date.now(); room.act = Date.now();
  r.set('Cache-Control', 'no-store').json(chPub(room, q.key));
});
app.post('/api/chess/state', auth, (q, r) => {
  const room = chGet(q, r); if (!room) return;
  const pub = chPub(room, q.key);
  r.set('Cache-Control', 'no-store');
  if (Number(q.body && q.body.v) === room.v) return r.json({ same: 1, v: room.v, away: pub.away, left: pub.left });
  r.json(pub);
});
app.post('/api/chess/move', auth, (q, r) => {
  const room = chGet(q, r); if (!room) return;
  if (room.status !== 'play') return bad(r, 400, room.status === 'wait' ? 'Menunggu lawan bergabung.' : 'Game sudah selesai.');
  const side = chSide(room, q.key);
  if ((room.pos.turn === 1 ? 'w' : 'b') !== side) return bad(r, 400, 'Bukan giliranmu.');
  const f = String((q.body && q.body.from) || ''), t = String((q.body && q.body.to) || '');
  if (!/^[a-h][1-8]$/.test(f) || !/^[a-h][1-8]$/.test(t)) return bad(r, 400, 'Langkah tidak valid.');
  const m = room.pos.parseMove(f, t, q.body && q.body.promo);
  if (m === null) return bad(r, 400, 'Langkah tidak legal.');
  const san = room.pos.san(m);
  room.pos.make(m); room.sans.push(san); room.last = { from: f, to: t };
  const st = room.pos.status();
  if (st.over) chEnd(room, st.win, st.why); else room.v++;
  r.set('Cache-Control', 'no-store').json(chPub(room, q.key));
});
app.post('/api/chess/resign', auth, (q, r) => {
  const room = chGet(q, r); if (!room) return;
  if (room.status === 'play') chEnd(room, chSide(room, q.key) === 'w' ? -1 : 1, 'resign');
  r.set('Cache-Control', 'no-store').json(chPub(room, q.key));
});
app.post('/api/chess/claim', auth, (q, r) => {
  const room = chGet(q, r); if (!room) return;
  const side = chSide(room, q.key), opp = chOpp(room, side);
  if (room.status === 'play' && opp && Date.now() - (room.seen[opp.k] || 0) >= 60000) chEnd(room, side === 'w' ? 1 : -1, 'timeout');
  r.set('Cache-Control', 'no-store').json(chPub(room, q.key));
});
const chLast = new Map(); setInterval(() => chLast.clear(), 60000).unref();
app.post('/api/chess/chat', auth, (q, r) => {
  const room = chGet(q, r); if (!room) return;
  const text = String((q.body && q.body.text) || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
  if (!text) return bad(r, 400, 'Pesan kosong.');
  const now = Date.now(), rec = (chLast.get(q.key) || []).filter(x => now - x < 10000);
  if (rec.length >= 6) return bad(r, 429, 'Pelan-pelan, pesan terlalu cepat.');
  rec.push(now); chLast.set(q.key, rec);
  room.chat.push({ s: chSide(room, q.key), u: q.u.name, t: text, ts: now });
  if (room.chat.length > 100) room.chat.splice(0, room.chat.length - 100);
  room.v++;
  r.set('Cache-Control', 'no-store').json(chPub(room, q.key));
});
app.post('/api/chess/rematch', auth, (q, r) => {
  const room = chGet(q, r); if (!room) return;
  if (room.status === 'over' && room.w && room.b) {
    room.rm[q.key] = true;
    if (room.rm[room.w.k] && room.rm[room.b.k]) {
      const w = room.w; room.w = room.b; room.b = w;
      room.pos = ChessE.Pos.fromFen(ChessE.START, true); room.sans = []; room.last = null; room.status = 'play'; room.result = null; room.rm = {};
    }
    room.v++;
  }
  r.set('Cache-Control', 'no-store').json(chPub(room, q.key));
});
const chInv = new Map(); setInterval(() => chInv.clear(), 60000).unref();
/* Undang ke Global Chat: pesan otomatis berisi kode room + tombol Gabung di Global Chat */
app.post('/api/chess/invite', auth, (q, r) => {
  const room = chGet(q, r); if (!room) return;
  if (room.status !== 'wait') return bad(r, 400, 'Room sudah terisi, undangan tidak diperlukan.');
  if (closed() && !isStaff(q.u)) return bad(r, 403, 'Global Chat sedang ditutup oleh Developer.');
  const now = Date.now();
  if (now - (chInv.get(q.key) || 0) < 20000) return bad(r, 429, 'Tunggu sebentar sebelum mengundang lagi.');
  chInv.set(q.key, now);
  const m = { id: crypto.randomBytes(6).toString('hex'), u: q.u.name, v: avV(q.u), rl: q.u.role || 'user', bd: !!q.u.badge, dv: !!q.u.dev, t: 'Ayo main catur bareng aku! Room: ' + room.code, ts: now, ch: room.code };
  CHAT.push(m);
  if (CHAT.length > 300) CHAT.splice(0, CHAT.length - 300).forEach(rmImg);
  saveChat(); bcast('msg', m);
  r.json({ ok: 1 });
});
app.post('/api/chess/leave', auth, (q, r) => {
  const room = chGet(q, r); if (!room) return;
  const side = chSide(room, q.key);
  if (room.status === 'play') chEnd(room, side === 'w' ? -1 : 1, 'resign');
  room.gone[q.key] = true; room.v++;
  const opp = chOpp(room, side);
  if (room.status === 'wait' || !opp || room.gone[opp.k]) CHR.delete(room.code);
  r.json({ ok: 1 });
});
};
