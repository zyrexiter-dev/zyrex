/* Emoji gaya iPhone di Global Chat (semua tema).
   Emoji di dalam pesan, kutipan balasan, dan reaksi diganti gambar emoji Apple dari CDN jsDelivr
   (paket emoji-datasource-apple). Teks aslinya disimpan di atribut alt, jadi saat disalin tetap emoji.
   Kalau gambar gagal dimuat, otomatis kembali ke emoji bawaan perangkat. */
(function () {
  var CDN = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/';
  var RE = /(?:\p{RI}\p{RI}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])?)*)/gu;
  var ROOTS = ['cgMsgs', 'cgCtx'];
  var SKIP = 'img.ae,textarea,input,script,style';
  var busy = false;

  function hex(s, keepFE) {
    var out = [];
    for (var i = 0; i < s.length;) {
      var c = s.codePointAt(i); i += c > 0xFFFF ? 2 : 1;
      if (c === 0xFE0F && !keepFE) continue;
      out.push(c.toString(16).padStart(4, '0'));
    }
    return out.join('-');
  }
  function make(ch) {
    var im = new Image(); im.className = 'ae'; im.alt = ch; im.draggable = false; im.decoding = 'async';
    var tries = [hex(ch, true), hex(ch, false), hex(ch + '\uFE0F', true)], n = 0, seen = {};
    tries = tries.filter(function (t) { return !seen[t] && (seen[t] = 1); });
    im.onerror = function () {
      n++;
      if (n < tries.length) im.src = CDN + tries[n] + '.png';
      else im.replaceWith(document.createTextNode(ch));
    };
    im.src = CDN + tries[0] + '.png';
    return im;
  }
  /* karakter tunggal yang secara bawaan berupa teks (©, ®, ™, ↔ dst) dibiarkan kecuali ada FE0F */
  function isEmoji(m) {
    if (m.length === 1 && m.charCodeAt(0) < 0x2600 && !/[\u231A\u231B\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE]/.test(m)) return false;
    return true;
  }
  function convert(node) {
    var txt = node.nodeValue; RE.lastIndex = 0;
    if (!RE.test(txt)) return;
    RE.lastIndex = 0;
    var frag = document.createDocumentFragment(), last = 0, m, any = false;
    while ((m = RE.exec(txt))) {
      if (!isEmoji(m[0])) continue;
      any = true;
      if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
      frag.appendChild(make(m[0]));
      last = m.index + m[0].length;
    }
    if (!any) return;
    if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
  function scan(root) {
    if (busy || !root) return;
    busy = true;
    try {
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (t) {
          var p = t.parentElement;
          return p && !p.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }), list = [], t;
      while ((t = w.nextNode())) list.push(t);
      list.forEach(convert);
    } catch (e) { }
    busy = false;
  }
  ROOTS.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    scan(el);
    new MutationObserver(function () { scan(el); }).observe(el, { childList: true, subtree: true, characterData: true });
  });
})();
