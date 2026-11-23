/* Inti Geometry Dash: pembuat level (50 level, makin tinggi makin banyak rintangan + makin kencang) dan fisika.
   Satuan dunia: 1 = lebar kubus. Level dibuat deterministik dari nomor level (tanpa file level). */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Geo = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const LEVELS = 50, G = 52.3, V0 = 15.2, AIR = 2 * V0 / G, DT = 1 / 180;
  const NAMES = ['Pemanasan', 'Langkah Awal', 'Duri Kecil', 'Lompat Pagar', 'Irama Dasar', 'Jalan Berduri', 'Blok Pertama', 'Tangga Mini', 'Zig-zag', 'Cepat Dikit', 'Ritme Neon', 'Hujan Duri', 'Tembok Besi', 'Loncat Beruntun', 'Pacu Malam', 'Jalur Tajam', 'Gelombang', 'Menara Duri', 'Kilat', 'Badai Pasir',
    'Lorong Api', 'Rantai Duri', 'Loncatan Gila', 'Blok & Duri', 'Turbo', 'Mesin Neraka', 'Hujan Meteor', 'Pecah Konsentrasi', 'Jalan Tikus', 'Raja Duri', 'Sprint', 'Labirin Neon', 'Angin Puyuh', 'Tiada Henti', 'Detak Jantung', 'Gerbang Maut', 'Kilau Es', 'Gunung Duri', 'Petir', 'Neraka Kecil',
    'Super Cepat', 'Rimba Duri', 'Garis Finish?', 'Tanpa Ampun', 'Mimpi Buruk', 'Hantu Kecepatan', 'Ujian Akhir', 'Gerbang Dewa', 'Puncak Dunia', 'LEGENDA'];
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const spikeBox = (sx) => [sx + 0.28, sx + 0.72];
  function gen(level) {
    level = Math.max(1, Math.min(LEVELS, level | 0));
    const r = rng(level * 7919 + 13), dens = (level - 1) / (LEVELS - 1);
    const speed = 7 + (level - 1) * 0.165, D = speed * AIR, length = 70 + level * 5;
    const spikes = [], blocks = [], hazards = [];   // hazards: [kiri, kanan] dipakai bot uji
    let x = 16, last = 0;
    const slackMax = (1 - dens * 0.75) * D * 0.55;
    const place = (first, total, tail, fn) => {   // first = lebar bahaya pertama, total = lebar pola, tail = lebar bahaya terakhir
      const gap = last === 0 ? 0 : Math.max(D * 0.8, D - (last + first) / 2 + 0.75) + r() * slackMax;
      x += gap; fn(x); x += total; last = tail;
    };
    const kinds = ['s1', 's1', 's2'];
    if (level >= 4) kinds.push('s3');
    if (level >= 2) kinds.push('b1', 'b2');
    if (level >= 7) ;
    if (level >= 11) ;
    if (level >= 16) kinds.push('s2', 'b3');
    if (level >= 24) kinds.push('s3');
    if (level >= 34) kinds.push('s3', 's2');
    while (x < length) {
      const k = kinds[Math.floor(r() * kinds.length)];
      if (k === 's1') place(1, 1, 1, (x0) => { spikes.push(x0); hazards.push([x0 + .28, x0 + .72, 's']); });
      else if (k === 's2') place(2, 2, 2, (x0) => { spikes.push(x0, x0 + 1); hazards.push([x0 + .28, x0 + 1.72, 's']); });
      else if (k === 's3') place(3, 3, 3, (x0) => { spikes.push(x0, x0 + 1, x0 + 2); hazards.push([x0 + .28, x0 + 2.72, 's']); });
      else if (k === 'b1' || k === 'b2' || k === 'b3') { const w = k === 'b1' ? 1 : k === 'b2' ? 2 : 3 + Math.floor(r() * 2); place(w + 0.5, w, w + 0.5, (x0) => { blocks.push({ x: x0, w, h: 1 }); hazards.push([x0, x0 + w, 'b']); }); }
      else if (k === 'bs') { const w = 1 + Math.floor(r() * 2); place(w + 0.5, w + 1.12, 1, (x0) => { blocks.push({ x: x0, w, h: 1 }); spikes.push(x0 + w + 0.4); hazards.push([x0, x0 + w, 'b'], [x0 + w + .68, x0 + w + 1.12, 's']); }); }
      else if (k === 'st') place(2.5, 4, 2.5, (x0) => { blocks.push({ x: x0, w: 2, h: 1 }, { x: x0 + 2, w: 2, h: 2 }); hazards.push([x0, x0 + 2, 'b'], [x0 + 2, x0 + 4, 'b']); });
    }
    return { level, speed, D, length: x + 8, spikes, blocks, hazards, hue: (level * 23 + 120) % 360, name: NAMES[level - 1] };
  }
  function newRun(lv) { return { lv, t: 0, x: 0, y: 0, vy: 0, ground: true, dead: false, done: false, rot: 0, air: 0 }; }
  /* satu langkah fisika (DT detik). held = tombol lompat sedang ditekan */
  function step(run, held) {
    if (run.dead || run.done) return;
    const lv = run.lv, py = run.y;
    run.t += DT; run.x += lv.speed * DT;
    if (held && run.ground) { run.vy = V0; run.ground = false; }
    run.vy -= G * DT; run.y += run.vy * DT;
    const a = run.x + 0.12, b = run.x + 0.88;
    let sup = 0;
    for (const bl of lv.blocks) {
      if (b <= bl.x || a >= bl.x + bl.w) continue;
      if (run.vy <= 0 && py >= bl.h - 0.25 && run.y <= bl.h) { if (bl.h > sup) sup = bl.h; }
    }
    if (run.y <= sup && run.vy <= 0) { run.y = sup; run.vy = 0; run.ground = true; run.rot = Math.round(run.rot / 90) * 90; }
    else { run.ground = false; run.rot += 360 * DT / AIR * 0.5; }
    for (const bl of lv.blocks) {
      if (b <= bl.x + 0.02 || a >= bl.x + bl.w - 0.02) continue;
      if (run.y < bl.h - 0.12 && run.y + 0.88 > 0) { run.dead = true; return; }
    }
    for (const sx of lv.spikes) {
      if (sx > run.x + 2 || sx + 1 < run.x - 1) continue;
      const bb = spikeBox(sx);
      if (b > bb[0] && a < bb[1] && run.y < 0.6) { run.dead = true; return; }
    }
    if (run.x >= lv.length) run.done = true;
  }
  return { LEVELS, DT, AIR, G, V0, NAMES, gen, newRun, step, spikeBox };
});
