/* Mesin aturan UNO (dipakai browser untuk mode AI/teman, dan server.js untuk room online).
   Kartu = string 2 huruf: warna (r merah, y kuning, g hijau, b biru, w liar) + jenis
   (0-9 angka, s lewati, v balik arah, d tambah 2, w pilih warna, f pilih warna + tambah 4). Contoh: "r5", "gs", "wf". */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Uno = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const COLS = ['r', 'y', 'g', 'b'];
  const isNum = (c) => c[1] >= '0' && c[1] <= '9';
  const val = (c) => isNum(c) ? +c[1] : (c[0] === 'w' ? 50 : 20);
  function deck() {
    const d = [];
    for (const c of COLS) { d.push(c + '0'); for (let n = 1; n <= 9; n++) d.push(c + n, c + n); for (const t of ['s', 'v', 'd']) d.push(c + t, c + t); }
    for (let i = 0; i < 4; i++) d.push('ww', 'wf');
    return d;
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  const adv = (s, from, steps) => (((from + s.dir * steps) % s.n) + s.n) % s.n;
  /* boleh dimainkan? (kartu liar +4 hanya kalau tidak punya kartu warna yang sedang aktif) */
  function canPlay(color, top, hand, c) {
    if (c === 'ww') return true;
    if (c === 'wf') return !hand.some((x) => x[0] === color);
    return c[0] === color || c[1] === top[1];
  }
  const err = (m) => ({ ok: false, err: m });
  function take(s) {
    if (!s.draw.length && s.disc.length > 1) { const keep = s.disc.pop(); s.draw = shuffle(s.disc); s.disc = [keep]; }
    return s.draw.length ? s.draw.pop() : null;
  }
  function give(s, p, n) { for (let i = 0; i < n; i++) { const c = take(s); if (c) s.hands[p].push(c); } s.called[p] = false; }
  function create(n) {
    const dr = shuffle(deck()), hands = [];
    for (let i = 0; i < n; i++) hands.push([]);
    for (let k = 0; k < 7; k++) for (let i = 0; i < n; i++) hands[i].push(dr.pop());
    let top = dr.pop();
    while (top === 'wf') { dr.push(top); shuffle(dr); top = dr.pop(); }
    const s = { n, hands, draw: dr, disc: [top], top, color: top[0] === 'w' ? COLS[Math.floor(Math.random() * 4)] : top[0], dir: 1, turn: 0, pend: null, status: 'play', winner: -1, last: { a: 'start' }, uno: null, called: new Array(n).fill(false), moves: 0 };
    const t = top[1];
    if (t === 's') s.turn = adv(s, 0, 1);
    else if (t === 'v') { s.dir = -1; s.turn = n - 1; }
    else if (t === 'd') { give(s, 0, 2); s.turn = adv(s, 0, 1); }
    return s;
  }
  function playable(s, p, i) {
    const c = s.hands[p][i];
    if (!c) return false;
    if (s.pend && (s.pend.p !== p || s.pend.i !== i)) return false;
    return canPlay(s.color, s.top, s.hands[p], c);
  }
  function play(s, p, i, col) {
    if (s.status !== 'play') return err('Game sudah selesai.');
    if (s.turn !== p) return err('Bukan giliranmu.');
    const c = s.hands[p][i];
    if (!c) return err('Kartu tidak ada.');
    if (!playable(s, p, i)) return err(c === 'wf' ? 'Kartu +4 hanya boleh kalau tidak punya warna yang sedang jalan.' : 'Kartu itu tidak bisa dimainkan.');
    if (c[0] === 'w' && COLS.indexOf(col) < 0) return err('Pilih warna dulu.');
    if (s.uno && s.uno.p !== p) s.uno = null;
    s.hands[p].splice(i, 1); s.disc.push(c); s.top = c; s.color = c[0] === 'w' ? col : c[0]; s.pend = null; s.moves++;
    const h = s.hands[p], t = c[1];
    if (h.length === 0) { s.status = 'over'; s.winner = p; s.uno = null; s.last = { p, a: 'play', c, col: s.color }; return { ok: true, win: true }; }
    if (h.length === 1) { if (!s.called[p]) s.uno = { p }; else s.uno = null; } else s.called[p] = false;
    let step = 1, pen = 0;
    if (t === 's') step = 2;
    else if (t === 'v') { if (s.n === 2) step = 2; else s.dir = -s.dir; }
    else if (t === 'd') { pen = 2; step = 2; }
    else if (t === 'f') { pen = 4; step = 2; }
    const victim = adv(s, p, 1);
    if (pen) give(s, victim, pen);
    s.turn = adv(s, p, step);
    s.last = { p, a: 'play', c, col: s.color, pen, victim: pen ? victim : -1, skip: step === 2 && !pen && t === 's' ? victim : -1 };
    return { ok: true };
  }
  function draw(s, p) {
    if (s.status !== 'play') return err('Game sudah selesai.');
    if (s.turn !== p) return err('Bukan giliranmu.');
    if (s.pend) return err('Kartu sudah diambil. Mainkan atau lewati.');
    if (s.uno && s.uno.p !== p) s.uno = null;
    const c = take(s);
    s.moves++;
    if (!c) { s.last = { p, a: 'pass' }; s.turn = adv(s, p, 1); return { ok: true }; }
    s.hands[p].push(c); s.called[p] = false;
    if (canPlay(s.color, s.top, s.hands[p], c)) { s.pend = { p, i: s.hands[p].length - 1 }; s.last = { p, a: 'draw', can: true }; }
    else { s.last = { p, a: 'draw' }; s.turn = adv(s, p, 1); }
    return { ok: true, can: !!s.pend };
  }
  function pass(s, p) {
    if (s.status !== 'play' || s.turn !== p || !s.pend || s.pend.p !== p) return err('Tidak bisa melewati giliran.');
    s.pend = null; s.last = { p, a: 'pass' }; s.turn = adv(s, p, 1);
    return { ok: true };
  }
  function callUno(s, p) {
    if (s.status !== 'play') return err('Game sudah selesai.');
    if (s.uno && s.uno.p === p) { s.uno = null; s.called[p] = true; return { ok: true }; }
    if (s.turn === p && s.hands[p].length === 2 && !s.called[p]) { s.called[p] = true; return { ok: true }; }
    return err('Belum waktunya UNO.');
  }
  function catchUno(s, by) {
    if (s.status !== 'play' || !s.uno || s.uno.p === by) return err('Tidak ada yang bisa ditangkap.');
    const v = s.uno.p; give(s, v, 2); s.uno = null; s.last = { p: by, a: 'catch', victim: v };
    return { ok: true, victim: v };
  }
  /* pemain keluar / dikeluarkan: kartunya masuk ke bawah tumpukan */
  function removePlayer(s, p) {
    const h = s.hands.splice(p, 1)[0]; s.called.splice(p, 1); s.draw.unshift.apply(s.draw, h); s.n--;
    if (s.uno) { if (s.uno.p === p) s.uno = null; else if (s.uno.p > p) s.uno.p--; }
    if (s.pend) { if (s.pend.p === p) s.pend = null; else if (s.pend.p > p) s.pend.p--; }
    if (s.status === 'play') {
      if (s.turn === p) s.turn = s.dir === 1 ? p % Math.max(1, s.n) : ((p - 1) + s.n) % Math.max(1, s.n);
      else if (s.turn > p) s.turn--;
      if (s.n < 2) { s.status = 'over'; s.winner = 0; s.uno = null; s.last = { a: 'alone' }; }
    } else if (s.winner > p) s.winner--;
  }
  const points = (s) => { let t = 0; s.hands.forEach((h, i) => { if (i !== s.winner) h.forEach((c) => { t += val(c); }); }); return t; };
  /* AI sederhana tapi tidak asal */
  function bestColor(hand) {
    const cnt = { r: 0, y: 0, g: 0, b: 0 };
    hand.forEach((c) => { if (c[0] !== 'w') cnt[c[0]]++; });
    let best = COLS[Math.floor(Math.random() * 4)], m = 0;
    COLS.forEach((c) => { if (cnt[c] > m) { m = cnt[c]; best = c; } });
    return best;
  }
  function ai(s, p) {
    const h = s.hands[p];
    if (s.pend && s.pend.p === p) { const c = h[s.pend.i]; return { a: 'play', i: s.pend.i, col: bestColor(h.filter((_, k) => k !== s.pend.i)), c }; }
    const nextN = s.hands[adv(s, p, 1)].length;
    let bi = -1, bs = -1e9;
    h.forEach((c, i) => {
      if (!canPlay(s.color, s.top, h, c)) return;
      const t = c[1];
      let x = c[0] === 'w' ? (t === 'f' ? -30 : -20) : isNum(c) ? +t : 12;
      if (nextN <= 2 && ('sdf'.indexOf(t) >= 0 || (t === 'v' && s.n === 2))) x += 40;
      if (h.length <= 3 && c[0] === 'w') x += 25;
      x += Math.random() * 3;
      if (x > bs) { bs = x; bi = i; }
    });
    if (bi < 0) return { a: 'draw' };
    const c = h[bi];
    return { a: 'play', i: bi, col: c[0] === 'w' ? bestColor(h.filter((_, k) => k !== bi)) : null, c };
  }
  return { COLS, create, canPlay, playable, play, draw, pass, callUno, catchUno, removePlayer, points, ai, val, isNum };
});
