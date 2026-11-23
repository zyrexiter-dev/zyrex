/* Spam OTP tool – All Tools ZyrexDep
   Must register pane id into global TV used by toolsView(), otherwise opening
   the card hides every known pane and leaves a blank tools screen. */
(function () {
  function el(id) { return document.getElementById(id); }

  function ensurePaneInTV() {
    try {
      if (typeof TV !== 'undefined' && Array.isArray(TV) && TV.indexOf('tSpamOtp') < 0) {
        TV.push('tSpamOtp');
      }
    } catch (e) {}
  }

  function setQuota(info) {
    const box = el('spamOtpQuota');
    const qt = el('spamOtpQt');
    const qs = el('spamOtpQs');
    if (!box || !qt || !qs) return;
    box.classList.remove('inf', 'low');
    if (!info) {
      qt.textContent = 'Kuota tidak terbaca';
      qs.textContent = '';
      return;
    }
    if (info.unlimited) {
      box.classList.add('inf');
      qt.textContent = 'Unlimited';
      qs.textContent = 'Tanpa batas';
      return;
    }
    const left = info.left == null ? 0 : info.left;
    const limit = info.limit == null ? 0 : info.limit;
    qt.textContent = 'Sisa ' + left + ' dari ' + limit + 'x';
    qs.textContent = 'Reset 00.00 WIB';
    if (left <= 0) box.classList.add('low');
  }

  async function loadQuota() {
    try {
      const info = await api('spamotp/info', {});
      setQuota(info);
    } catch (e) {
      setQuota(null);
    }
  }

  function renderDetails(list, details) {
    list.innerHTML = '';
    if (!Array.isArray(details) || !details.length) return;
    details.forEach(function (row) {
      const key = String(row[0] || '');
      const val = String(row[1] == null ? '' : row[1]);
      const rowEl = document.createElement('div');
      rowEl.className = 'cp-row';
      const k = document.createElement('b');
      k.textContent = key;
      const v = document.createElement('span');
      v.textContent = val;
      rowEl.appendChild(k);
      rowEl.appendChild(v);
      list.appendChild(rowEl);
    });
  }

  async function run() {
    const err = el('spamOtpErr');
    const btn = el('spamOtpGo');
    const res = el('spamOtpRes');
    const note = el('spamOtpNote');
    const list = el('spamOtpList');
    if (!err || !btn) return;
    err.textContent = '';
    if (res) res.hidden = true;

    const nomorRaw = (el('spamOtpNomor') && el('spamOtpNomor').value || '').trim();
    const nomor = nomorRaw.replace(/\D/g, '');
    if (!/^(0|62)\d{8,14}$/.test(nomor)) {
      err.textContent = 'Nomor tidak valid. Pakai 08… atau 62…';
      return;
    }
    let jumlah = parseInt(el('spamOtpJumlah') && el('spamOtpJumlah').value, 10);
    if (!(jumlah >= 1 && jumlah <= 100)) {
      err.textContent = 'Jumlah harus 1 sampai 100.';
      return;
    }

    btn.disabled = true;
    const oldHtml = btn.innerHTML;
    btn.textContent = 'Mengirim…';
    try {
      const data = await api('spamotp', { nomor: nomor, jumlah: jumlah });
      setQuota(data);
      if (note) note.textContent = (data.note ? data.note + ' · ' : '') + nomor + ' × ' + jumlah;
      if (list) renderDetails(list, data.details || []);
      if (res) {
        res.hidden = false;
        setTimeout(function () {
          res.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);
      }
    } catch (e) {
      err.textContent = (e && e.message) || 'Gagal mengirim spam OTP.';
      if (e && e.status === 429) loadQuota();
    }
    btn.disabled = false;
    btn.innerHTML = oldHtml;
  }

  function bind() {
    ensurePaneInTV();

    const card = document.querySelector('[data-open="tSpamOtp"]');
    if (card) {
      // Capture phase: register pane in TV before app.js toolsView runs.
      card.addEventListener('click', function () {
        ensurePaneInTV();
        setTimeout(function () {
          if (el('spamOtpErr')) el('spamOtpErr').textContent = '';
          if (el('spamOtpRes')) el('spamOtpRes').hidden = true;
          loadQuota();
        }, 0);
      }, true);
    }

    const go = el('spamOtpGo');
    if (go) go.addEventListener('click', run);

    const nomor = el('spamOtpNomor');
    if (nomor) {
      nomor.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          run();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
