/* Tema "Kertas Pin": kartu yang ditancap pin goyang sebentar saat dipencet (hanya saat tema paper aktif). */
(function () {
  var SEL = '.tile,.tool-card,.gm-card,.title-box,.sheet,.rd-card';
  document.addEventListener('pointerdown', function (e) {
    if (document.documentElement.getAttribute('data-theme') !== 'paper') return;
    var t = e.target; if (!(t instanceof Element) || t.closest('input,textarea,select')) return;
    var el = t.closest(SEL); if (!el) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.classList.remove('pwob'); void el.offsetWidth; el.classList.add('pwob');
    var done = function (ev) { if (ev.target !== el || ev.animationName !== 'paperWob') return; el.classList.remove('pwob'); el.removeEventListener('animationend', done); };
    el.addEventListener('animationend', done);
  }, true);
})();
