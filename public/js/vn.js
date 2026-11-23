/* Global Chat: mode VN (visual novel).
   Tombol di header Global Chat -> buka layar penuh gaya visual novel,
   pesan ditampilkan satu per satu dengan efek ketik, nama + avatar
   pengirim jadi "potret karakter". Ketuk kanan/teks = lanjut
   (atau langsung tuntaskan ketikan), ketuk kiri = mundur. Mengikuti
   tema aktif (termasuk gaya kertas komik 3D saat tema Paper aktif). */
(function () {
  var page = document.getElementById('cgPage');
  if (!page || typeof cgData === 'undefined') return;

  var COL = { vip: '#ffd60a', admin: '#ff453a', owner: '#ff9f0a', ress: '#30d158', partner: '#bf5af2', tk: '#ff2d92' };
  function hue(s) { var t = 0; s = String(s).toLowerCase(); for (var i = 0; i < s.length; i++) t = (t * 31 + s.charCodeAt(i)) % 360; return t; }
  function nameColor(e) { return e.dv ? '#0a84ff' : COL[e.rl] || 'hsl(' + hue(e.u) + ',80%,68%)'; }

  /* ---------- Bangun overlay ---------- */
  var vn = document.createElement('div'); vn.className = 'cg-vn'; vn.id = 'cgVn'; vn.hidden = true;
  vn.innerHTML = '<div class="cg-vn-bg"></div>' +
    '<div class="cg-vn-idx" id="cgVnIdx"></div>' +
    '<button type="button" class="cg-vn-x" id="cgVnX" aria-label="Tutup">&times;</button>' +
    '<div class="cg-vn-stage">' +
      '<div class="cg-vn-port cg-vn-port-l" id="cgVnPL"></div>' +
      '<div class="cg-vn-port cg-vn-port-r" id="cgVnPR"></div>' +
      '<div class="cg-vn-tap l" id="cgVnTapL"></div>' +
      '<div class="cg-vn-tap r" id="cgVnTapR"></div>' +
    '</div>' +
    '<div class="cg-vn-box" id="cgVnBox">' +
      '<div class="cg-vn-name" id="cgVnName"></div>' +
      '<img class="cg-vn-img" id="cgVnImg" hidden alt="">' +
      '<div class="cg-vn-text" id="cgVnText"></div>' +
      '<div class="cg-vn-next" id="cgVnNext">&#9656;</div>' +
    '</div>';
  document.body.appendChild(vn);

  var idxEl = vn.querySelector('#cgVnIdx'), boxEl = vn.querySelector('#cgVnBox'), nameEl = vn.querySelector('#cgVnName'),
    textEl = vn.querySelector('#cgVnText'), imgEl = vn.querySelector('#cgVnImg'), nextEl = vn.querySelector('#cgVnNext'),
    pL = vn.querySelector('#cgVnPL'), pR = vn.querySelector('#cgVnPR');

  /* ---------- Tombol pembuka di header Global Chat ---------- */
  var dock = page.querySelector('.cg-dock');
  if (dock) {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'icon-btn'; btn.id = 'cgVnBtn'; btn.setAttribute('aria-label', 'Mode VN');
    btn.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M4 4h16v12H7l-3 3V4z"/></svg>';
    var lock = dock.querySelector('#cgLock');
    if (lock) dock.insertBefore(btn, lock); else dock.appendChild(btn);
    btn.addEventListener('click', open);
  }

  /* ---------- State ---------- */
  var list = [], idx = 0, typing = null, full = '';

  function portraitAv(e, el) {
    el.textContent = String(e.u || '?')[0].toUpperCase();
    el.style.background = 'linear-gradient(145deg,' + 'hsl(' + hue(e.u) + ',70%,55%),hsl(' + ((hue(e.u) + 40) % 360) + ',70%,40%))';
    var im = new Image(); im.alt = ''; im.onerror = function () { im.remove(); };
    im.src = '/av/' + encodeURIComponent(e.u) + '?v=' + (e.v || '0'); el.appendChild(im);
  }

  function stopType() { if (typing) { clearInterval(typing); typing = null; } }

  function render() {
    var e = list[idx]; if (!e) return;
    idxEl.textContent = (idx + 1) + ' / ' + list.length;
    var mine = String(e.u || '').toLowerCase() === String(window.cgMe || '').toLowerCase();
    nameEl.innerHTML = ''; nameEl.textContent = e.u || '?'; nameEl.style.color = nameColor(e);
    pL.hidden = mine; pR.hidden = !mine;
    pL.innerHTML = ''; pR.innerHTML = '';
    portraitAv(e, mine ? pR : pL);
    pL.classList.toggle('show', !mine); pR.classList.toggle('show', mine);
    if (e.img) { imgEl.src = e.img; imgEl.hidden = false; } else { imgEl.hidden = true; imgEl.removeAttribute('src'); }
    full = e.t || '(tanpa teks)';
    textEl.textContent = '';
    stopType();
    var i = 0;
    typing = setInterval(function () {
      i += 2;
      textEl.textContent = full.slice(0, i);
      if (i >= full.length) { textEl.textContent = full; stopType(); }
    }, 18);
    nextEl.hidden = idx >= list.length - 1 && false; /* selalu tampil sbg hint ketuk */
  }

  function advance(dir) {
    if (dir > 0 && typing) { stopType(); textEl.textContent = full; return; }
    idx += dir;
    if (idx < 0) idx = 0;
    if (idx >= list.length) {
      textEl.textContent = ''; nameEl.textContent = ''; imgEl.hidden = true;
      idx = list.length - 1;
      boxEl.insertAdjacentHTML('beforeend', '<div class="cg-vn-end">— akhir percakapan —</div>');
      setTimeout(close, 900);
      return;
    }
    var old = boxEl.querySelector('.cg-vn-end'); if (old) old.remove();
    render();
  }

  function open() {
    list = Array.from(cgData.values()).sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
    if (!list.length) { var t = document.getElementById('cgToast'); if (t) { t.textContent = 'Belum ada pesan untuk dibaca.'; t.hidden = false; setTimeout(function () { t.hidden = true; }, 1600); } return; }
    idx = 0; vn.hidden = false; render();
  }
  function close() { stopType(); vn.hidden = true; var old = boxEl.querySelector('.cg-vn-end'); if (old) old.remove(); }

  vn.querySelector('#cgVnX').addEventListener('click', close);
  vn.querySelector('#cgVnTapL').addEventListener('click', function () { advance(-1); });
  vn.querySelector('#cgVnTapR').addEventListener('click', function () { advance(1); });
  boxEl.addEventListener('click', function () { advance(1); });

  /* Swipe horizontal di panggung sebagai alternatif ketuk */
  var sx = null;
  vn.addEventListener('pointerdown', function (e) { sx = e.clientX; });
  vn.addEventListener('pointerup', function (e) {
    if (sx == null) return; var dx = e.clientX - sx; sx = null;
    if (Math.abs(dx) < 40) return;
    advance(dx < 0 ? 1 : -1);
  });

  document.addEventListener('keydown', function (e) {
    if (vn.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); advance(1); }
    else if (e.key === 'ArrowLeft') advance(-1);
  });
})();
