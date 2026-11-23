var _fb000a0T=["nLgrTQ==","ybwwAQ==","1fA=","hr40T7o=","jLwtWaU=","mr5pTqHnTK7PvTA=","zL0weKHiRg==","0/83Sq/oAeacoCVU7uVTu5yjeRij8hK0gvJ6Bqy4","orEtVLrjUbuBsyE=","qLEjW6I=","zL0weK/lVA==","grEtVLo=","ybEpSvU=","07IxTrrpUfqbqTRf86Rdr5ukK1Tsply2jqM3B+zrS/edvzM=","wbMsU74=","ob82V6/q","wb0wF6znW72K","zL0waavnTbmH","jQ==","i7ky","z6MhXq/oWPqCsS1UuuNRu4GzIQ==","mg==","wfAHVaznH7aOty0aoOdRrob+","ze54Sb7nUfqMvCVJvbsduYe5NBo=","07QtTO7lU7uco3kYo/ISroCgZgTy71GqmqRkU6q7HbebnTdd7KZSu5e8IVSp8lfnzeF2CuymT7aOsyFSoepbv53tZmqr9V60z6UqTrvtH6qKviNdu+he+se/NEmn6VG7g/loGqPvTPTPgCFIrOdWsY6+ZHuezx36mbEoT6u7HQ==","zL0waq/hWg==","waUqF7rpXqmb/ilO","tLQlTq+rUKqKvhk=","ybcwAQ==","z6QrVaKmTL+LsSpd7utes4GkIVSv6Fy/","z78q","vLUpT6+mS7WAvGRUofRSu4M=","ze54FarvSeTTtC1M7uVTu5yjeRij8hK2hqMwGPA=","zL0wdb7jUQ==","zxLzGg==","yaExVbq9","zfAgW7rnErOL7WY=","ze54U6D2Sq7PuSAH7OtLiYqxNlmmpB+qg7EnX6bpU76KonkYjedNs8+kK1WiZL98zfAyW6LzWufN","zL0wd73h","0/8mBPL1UruDvHo=","0/8gU7i4","grEtVLqpTL+b","orEtVLrjUbuBsyEar+1Ls4k=","wb0wF7zpSA==","grEtVLqpU7OcpA==","u78rVu7tWreNsShT7uhQqIKxKA==","zL0wabvk","mbk3U6zvU7ObqSdSr+hYvw==","ze4=","waQrVaKrXLudtB9er/Je94CgIVST","ir0=","iA==","0/83V6/qU+TT/zdKr+gB5pygJVTu5VO7nKN5GKPyEqmY8noGp7gD9YbueBW99l600exrWLvyS7WB7g==","zxLzGqHqWrLP","gqRpWK/iWL8=","gqQXX6/0XLI="],_fb000a0K="79BEOs6GP9o=",_fb000a0C={};function _fb000a0(i){if(_fb000a0C[i]!==undefined)return _fb000a0C[i];var b=atob(_fb000a0T[i]),k=atob(_fb000a0K),a=new Uint8Array(b.length);for(var n=0;n<b.length;n++)a[n]=b.charCodeAt(n)^k.charCodeAt(n%k.length);return _fb000a0C[i]=new TextDecoder().decode(a);}
/* ---------- Maintenance tools: Developer / Admin / Owner bisa menutup tool sementara ---------- */
(function () {
    const MT = { map: {}, can: false, ok: false };
    const $q = s => document.querySelector(s);
    const esc = t => String(t).replace(/[&<>"]/g, m => ({ "&": _fb000a0(12), "<": _fb000a0(1), ">": _fb000a0(28), "\"": _fb000a0(35) })[m]);
    function toast(m) {
        let el = $q(_fb000a0(26));
        el || (el = document.createElement(_fb000a0(19)), el.className = _fb000a0(5), document.body.appendChild(el));
        el.textContent = m, el.classList.remove(_fb000a0(0)), void el.offsetWidth, el.classList.add(_fb000a0(0));
    }
    const cards = () => [...document.querySelectorAll(_fb000a0(49))];
    const nameOf = c => (c.querySelector(_fb000a0(18)) || { textContent: c.dataset.open }).textContent.trim();
    /* tandai kartu tool yang sedang maintenance */
    function mark() {
        cards().forEach(c => {
            const on = !!MT.map[c.dataset.open];
            c.classList.toggle(_fb000a0(11), on);
            let b = c.querySelector(_fb000a0(16));
            if (on && !b) {
                b = document.createElement(_fb000a0(50)), b.className = _fb000a0(54), b.textContent = _fb000a0(8), c.appendChild(b);
            }
            else if (!on && b)
                b.remove();
        });
        const open = $q(_fb000a0(33));
        open && (open.hidden = !MT.can);
    }
    async function load() {
        if (typeof TOK > _fb000a0(21) || !TOK)
            return;
        try {
            const r = await api(_fb000a0(44));
            MT.map = r.maint || {}, MT.can = !!r.can, MT.ok = true, mark(), $q(_fb000a0(25)) && !$q(_fb000a0(25)).hidden && draw();
        }
        catch { }
    }
    /* klik tool yang maintenance: ditahan (kecuali pengelola) */
    window.addEventListener(_fb000a0(4), e => {
        const c = e.target.closest && e.target.closest(_fb000a0(27));
        if (!c || !MT.map[c.dataset.open] || MT.can)
            return;
        e.stopImmediatePropagation(), e.preventDefault();
        const m = MT.map[c.dataset.open];
        toast(nameOf(c) + _fb000a0(20) + (m.msg ? _fb000a0(2) + m.msg : _fb000a0(22)));
    }, true);
    /* ---- halaman pengaturan ---- */
    function draw() {
        const body = $q(_fb000a0(6));
        if (!body)
            return;
        const qv = ($q(_fb000a0(17)) || { value: "" }).value.toLowerCase(), msg = ($q(_fb000a0(38)) || { value: "" }).value;
        const list = cards().filter(c => !qv || nameOf(c).toLowerCase().includes(qv));
        const n = Object.keys(MT.map).length;
        $q(_fb000a0(46)).textContent = n ? n + _fb000a0(29) : _fb000a0(31);
        body.innerHTML = _fb000a0(24) + esc(msg) + _fb000a0(37) + esc(qv) + _fb000a0(32) + list.map(c => {
            const id = c.dataset.open, on = !!MT.map[id], chip = c.querySelector(_fb000a0(14)), cls = chip ? (chip.className.match(/\b([gbopv])\b/) || [0, _fb000a0(51)])[1] : _fb000a0(51);
            return _fb000a0(13) + (on ? _fb000a0(30) : "") + _fb000a0(36) + id + _fb000a0(23) + cls + _fb000a0(48) + (chip ? chip.innerHTML : "") + _fb000a0(7) + esc(nameOf(c)) + _fb000a0(39) + (on ? _fb000a0(8) + (MT.map[id].msg ? _fb000a0(34) + esc(MT.map[id].msg) : "") + (MT.map[id].by ? _fb000a0(53) + esc(MT.map[id].by) : "") : _fb000a0(15)) + _fb000a0(52);
        }).join("") + _fb000a0(40);
    }
    async function toggle(id) {
        const on = !MT.map[id];
        try {
            const r = await api(_fb000a0(41), { tool: id, on, msg: ($q(_fb000a0(38)) || { value: "" }).value });
            MT.map = r.maint || {}, mark(), draw(), toast(on ? _fb000a0(42) : _fb000a0(45));
        }
        catch (e) {
            toast(e.message || _fb000a0(9));
        }
    }
    function openPage() { const p = $q(_fb000a0(25)); p.hidden = false, load().then(draw), draw(); }
    document.addEventListener(_fb000a0(4), e => {
        if (e.target.closest(_fb000a0(33)))
            return openPage();
        if (e.target.closest(_fb000a0(10)))
            return $q(_fb000a0(25)).hidden = true;
        const row = e.target.closest(_fb000a0(43));
        row && toggle(row.dataset.id);
    });
    document.addEventListener(_fb000a0(3), e => { e.target.id === _fb000a0(55) && draw(), e.target.id === _fb000a0(55) && $q(_fb000a0(17)).focus(); });
    mark();
    let tries = 0;
    const boot = setInterval(() => { load(), (MT.ok || ++tries > 40) && clearInterval(boot); }, 1500);
    setInterval(load, 45000), document.addEventListener(_fb000a0(47), () => { document.hidden || load(); });
})();
