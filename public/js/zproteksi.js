/* Pencegahan iseng dasar: klik kanan, seleksi di luar input, drag gambar, dan beberapa shortcut devtools.
   Ini BUKAN proteksi keamanan -- siapa pun yang niat tetap bisa membuka devtools lewat menu browser atau
   cara lain. Lihat README.txt. */
(function () {
  var allow = function (t) { return t instanceof Element && !!t.closest('input,textarea,select,[contenteditable="true"]'); };
  document.addEventListener('contextmenu', function (e) { if (!allow(e.target)) e.preventDefault(); });
  document.addEventListener('dragstart', function (e) { if (e.target instanceof HTMLImageElement) e.preventDefault(); });
  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    if (k === 'f12') { e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) { e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'u') { e.preventDefault(); return; }
  });
})();
