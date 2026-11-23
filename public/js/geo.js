var _f8b0f98T=["6tjSoD8=","o5vQvSQ=","sZE=","2JHUsTGvv9E=","pg==","r8yF4Hy046mq","v9rXsCT2vuK9","55DUoQ==","o9qV","7pDbsA==","r8aA4Hyw46mq","2JHUsTGvvfre","64bZ7Q==","85rcqyTno+jsgts=","oQ==","v52B+w==","6JDMoT/1vw==","o5HaqzU=","2JHUsTGvsNE=","2JHUsTGvodE=","2JHUsTGvovje","o5HctjHgvenn","v9rX+2zxvO3vmYs=","o5HUtzmi","vcnX+w==","z5DDoDyipenxgdyrN+W4tqM=","2JHUsTGvpdE=","r8KF4Hy04amv24XyeQ==","840=","15TdpD6ipOL3gN7lPO28/OKBlac18KTg4pvS","odXRpCTj/OD1yJc=","v5fAsSTtv6z3jMWgbaCz+feB2qtyorLg4obG+HLltaHvgw==","r8yF4Hy05Kmq","05DHpj/gsO3t1Q==","2JHUsTGvvvre","v5Hcs3Dhve3whojnN+bzsr+R3LNw4b3t8IaI5zfm/OT2kZf7bODx6OKB1OgkvO2j4cuJtj3jveCjkdSxMa+isr/axqgx7r2yv9rRrCa87ejqg5WmPOOi/77X0qF94LD+ocuJrHDmsPji2MX7bK24sr/a0awmvO3o6oOVpjzjov++19KhffGl7eSQl+U046XtrobB+2zhsOL1lMblNOOl7a6Ww/tsrbLt7YPUtm6+teX11dapMfGisaGS0eg/9POs55TBpH3tp7K/2tGsJrzto+ecw/ts5rj6o5bZpCPx7K7kkZijP+2lrr3Jxqgx7r2s55TBpH3j77CshtikPO7vsKyR3LNuvv7o6oOL","8ZDGrCrn","8ZDUoSk=","yJDWoCDjpe3t1c0=","85rcqyTno+DmlMOg","o5napjs=","5JDa","yJDBsDuipOL3gN7lPfe97eo=","oMSE9A==","oMWB9GSysw==","z5rYtTH2uKzngMescOaw4qOX2ao7rPG5s9XZoCbnvaCjmNSuOezx5+ab1qQ+5fHo4puVqDHpuOKjhdShMfb/","v52B+xznp+nv1Q==","v5Hcs3Dhve3whojnN+b84eabwOduvrXl9dXWqTHxorGhktHoJO2hrr3J1/sA673l69XZoCbnvbCsl4v5I++w4O/L5qA856Lt6p7Uq3DutPrmmZWwPvak56OY0Kgy97rto5nQszXu8e7mh9yuJfa/9eLblYk19LTgo4HQtyTrv+vknJWoMfGk56Ol0Lc57Lbn4oGb+X/xvO3vmYv5f+a4+r3J0awmorLg4obG+HLltaHkh9yhcrw=","YWMD","s9A=","7IPQtw==","6JDMsCA=","c2ohVw==","odXGsSnutLGh2Jitag==","oJOHo2fk5Q==","55rboA==","4Jncpjs=","xJDaqDX2o/WjsdS2OA==","ozcC5Q==","YWkm","v9rRrCa87aPnnMP7","85rcqyTno/nz","85rcqyTno+/im9agPA==","7ZDNsQ==","r8CA4Hyz56mq","9Jzb","wofHqifXoQ==","r8GA4Hyz46mq","0IXUpjU=","oMDRoGW7sw==","75zboDHw/OvxlNGsNeylpLLDhaE15f2vtJSApjbk/a+xlNHxNuT4","4YDBsT/s","2JHUsTGvsvre","64bZpHg=","oJPTow==","v4WLjjHvpKzukNukPeOl5+KblbY176Tto5nQszXu8LCshYs=","v9rd8W6+obI=","85nUvA==","r8OF4Hy69KU=","z5DDoDyi","v9rGqDHuvbK/2tewJPa+4r0=","v9rF+w==","o4XQtzPts+3im4nqILzt6OqDlaY846L/vtfSoX3gpeLw14s=","o4bQqTXxsOWiyZqtZLzt/L0=","z5DDoDyis+3xgJWxNfCz+eiU","wZTSsCOj","v5fAsSTtv6zgmdS2I7/z/+3Y17E+oPHo4oHU6D6/8+LmjcHnbs60+uaZlQ==","v5fAsSTtv6zgmdS2I7/z/+3Y17E+orDg99eVoTH2sKHtyJeoNeykrr240Kslvv7u9oHBqj687aPnnMP7","2JHUsTGvotE="],_f8b0f98K="g/W1xVCC0Yw=",_f8b0f98C={};function _f8b0f98(i){if(_f8b0f98C[i]!==undefined)return _f8b0f98C[i];var b=atob(_f8b0f98T[i]),k=atob(_f8b0f98K),a=new Uint8Array(b.length);for(var n=0;n<b.length;n++)a[n]=b.charCodeAt(n)^k.charCodeAt(n%k.length);return _f8b0f98C[i]=new TextDecoder().decode(a);}
/* ---------- Geometry Dash: 50 level, ketuk untuk lompat. Makin tinggi level: makin banyak rintangan dan makin kencang ---------- */
(function () {
    const Geo = window.Geo;
    if (!Geo)
        return;
    let cur = null;
    const VW = 13, VH = 9, GROUND = 2.4, PX = 3.6;
    GM.reg({ id: _f8b0f98(41), name: _f8b0f98(57), icon: _f8b0f98(0), desc: _f8b0f98(45), bg: _f8b0f98(70), mount(root, k) {
            const S = cur = { dead: false, lvl: 0, best: k.best.get(), run: null, def: null, held: false, raf: 0, last: 0, acc: 0, att: 0, state: _f8b0f98(9), parts: [], off: [], sent: 0, cd: 0, shake: 0, fx: 0 };
            S.best > 0 && (k.submit(S.best), S.sent = S.best);
            const q = s => root.querySelector(s);
            function o(t, ev, fn, op) { t.addEventListener(ev, fn, op), S.off.push(() => t.removeEventListener(ev, fn, op)); }
            /* ================= MENU LEVEL ================= */
            function menu() {
                S.state = _f8b0f98(9), cancelAnimationFrame(S.raf), S.raf = 0, k.sub(_f8b0f98(25) + S.best + _f8b0f98(8) + Geo.LEVELS);
                let h = _f8b0f98(47);
                for (let i = 1; i <= Geo.LEVELS; i++) {
                    const lock = i > S.best + 1, done = i <= S.best, hue = (i * 23 + 120) % 360;
                    h += _f8b0f98(31) + (lock ? _f8b0f98(40) : "") + (done ? _f8b0f98(17) : "") + (i === S.best + 1 ? _f8b0f98(1) : "") + _f8b0f98(30) + i + _f8b0f98(53) + hue + _f8b0f98(14) + (lock ? _f8b0f98(21) : "") + _f8b0f98(24) + i + _f8b0f98(22) + (lock ? _f8b0f98(52) : done ? _f8b0f98(59) : _f8b0f98(48)) + _f8b0f98(80);
                }
                root.innerHTML = h + _f8b0f98(60);
            }
            o(root, _f8b0f98(56), e => { const b = e.target.closest(_f8b0f98(11)); if (b) {
                GMA.init(), GMA.play(_f8b0f98(56)), start(+b.dataset.lv, true);
            } });
            /* ================= MAIN ================= */
            function start(lv, fresh) {
                S.lvl = lv, S.def = Geo.gen(lv), S.run = Geo.newRun(S.def), S.parts = [], S.state = _f8b0f98(37), S.held = false, fresh && (S.att = 0);
                root.innerHTML = _f8b0f98(35);
                const cv = q(_f8b0f98(72));
                q(_f8b0f98(26)).textContent = _f8b0f98(79) + lv + _f8b0f98(58) + S.def.name, q(_f8b0f98(88)).textContent = _f8b0f98(38) + (S.def.speed / 7).toFixed(2), k.sub(_f8b0f98(79) + lv + _f8b0f98(23) + Geo.LEVELS);
                S.cv = cv, S.ctx = cv.getContext(_f8b0f98(2)), S.bar = q(_f8b0f98(19)), S.ov = q(_f8b0f98(34)), S.att++, q(_f8b0f98(18)).textContent = _f8b0f98(33) + S.att;
                const st = q(_f8b0f98(20));
                st.addEventListener(_f8b0f98(13), press), st.addEventListener(_f8b0f98(61), release), st.addEventListener(_f8b0f98(62), release), st.addEventListener(_f8b0f98(39), release);
                size(), ovText(_f8b0f98(42), _f8b0f98(29)), S.last = performance.now(), S.acc = 0, S.raf = requestAnimationFrame(loop), draw();
            }
            function size() {
                if (!S.cv)
                    return;
                const w = S.cv.parentNode.clientWidth || 360, dpr = Math.min(window.devicePixelRatio || 1, 2), W = Math.round(w * dpr), H = Math.round(w * VH / VW * dpr);
                (S.cv.width !== W || S.cv.height !== H) && (S.cv.width = W, S.cv.height = H, S.cv.style.height = w * VH / VW + _f8b0f98(28)), S.u = W / VW;
            }
            function ovText(a, b) { S.ov.hidden = false, S.ov.innerHTML = _f8b0f98(15) + a + _f8b0f98(76) + (b || "") + _f8b0f98(81); }
            function press(e) {
                e.preventDefault();
                if (S.state === _f8b0f98(37))
                    return S.state = _f8b0f98(77), S.ov.hidden = true, S.held = true, GMA.init();
                if (S.state === _f8b0f98(77))
                    return S.held = true;
                if (S.state === _f8b0f98(55) && !S.ov.querySelector(_f8b0f98(71)))
                    return;
            }
            function release() { S.held = false; }
            o(window, _f8b0f98(16), e => { if (e.code === _f8b0f98(68) || e.code === _f8b0f98(66)) {
                e.preventDefault(), S.state === _f8b0f98(37) ? (S.state = _f8b0f98(77), S.ov.hidden = true) : 0, S.held = true;
            } }), o(window, _f8b0f98(51), e => { (e.code === _f8b0f98(68) || e.code === _f8b0f98(66)) && (S.held = false); }), o(window, _f8b0f98(36), () => { size(), S.cv && draw(); });
            function die() {
                S.state = _f8b0f98(7), S.shake = 10, k.snd(_f8b0f98(50));
                const r = S.run, u = S.u;
                for (let i = 0; i < 16; i++)
                    S.parts.push({ x: r.x + .5, y: r.y + .5, vx: (Math.random() - .3) * 9, vy: Math.random() * 9, l: 40 + Math.random() * 20, c: i % 3 ? _f8b0f98(69) : _f8b0f98(74) });
                S.cd = 38;
            }
            function win() {
                S.state = _f8b0f98(55), k.snd(_f8b0f98(65));
                const first = S.lvl > S.best;
                first && (S.best = S.lvl, k.best.set(S.best), k.sub(_f8b0f98(25) + S.best), k.submit(S.best), S.sent = S.best);
                S.ov.hidden = false, S.ov.innerHTML = _f8b0f98(46) + S.lvl + _f8b0f98(83) + (first ? _f8b0f98(84) : _f8b0f98(85)) + _f8b0f98(58) + S.att + _f8b0f98(82) + (S.lvl < Geo.LEVELS ? _f8b0f98(86) + (S.lvl + 1) + _f8b0f98(6) : _f8b0f98(75)) + _f8b0f98(87);
                S.ov.onclick = e => { const b = e.target.closest(_f8b0f98(3)); b && (b.dataset.n === _f8b0f98(63) ? start(S.lvl + 1, true) : menu()); };
            }
            /* ================= LOOP ================= */
            function loop(now) {
                if (S.dead || !S.cv)
                    return;
                S.raf = requestAnimationFrame(loop);
                let dt = (now - S.last) / 1000;
                S.last = now, dt > .1 && (dt = .1);
                if (S.state === _f8b0f98(77)) {
                    S.acc += dt;
                    let n = 0;
                    while (S.acc >= Geo.DT && n++ < 20) {
                        S.acc -= Geo.DT, Geo.step(S.run, S.held);
                        if (S.run.dead) {
                            die();
                            break;
                        }
                        if (S.run.done) {
                            win();
                            break;
                        }
                    }
                    S.bar.style.width = Math.min(100, S.run.x / S.def.length * 100) + _f8b0f98(4);
                }
                else if (S.state === _f8b0f98(7)) {
                    if (--S.cd <= 0) {
                        S.att++, q(_f8b0f98(18)).textContent = _f8b0f98(33) + S.att, S.run = Geo.newRun(S.def), S.parts = [], S.state = _f8b0f98(77), S.acc = 0, S.bar.style.width = _f8b0f98(49);
                    }
                }
                S.parts.forEach(p => { p.x += p.vx * dt, p.y += p.vy * dt, p.vy -= 30 * dt, p.l--; }), S.parts = S.parts.filter(p => p.l > 0), S.shake > 0 && S.shake--, draw();
            }
            /* ================= GAMBAR ================= */
            function draw() {
                const c = S.ctx, W = S.cv.width, H = S.cv.height, u = S.u, d = S.def, r = S.run, hue = d.hue;
                const gy = H - GROUND * u, camX = r.x - PX, sx = S.shake ? (Math.random() - .5) * S.shake * .6 : 0;
                c.save(), c.translate(sx, 0);
                const bg = c.createLinearGradient(0, 0, 0, H);
                bg.addColorStop(0, _f8b0f98(12) + hue + _f8b0f98(64)), bg.addColorStop(1, _f8b0f98(12) + hue + _f8b0f98(78)), c.fillStyle = bg, c.fillRect(-10, 0, W + 20, H);
                c.fillStyle = _f8b0f98(73) + hue + _f8b0f98(27);
                const par = camX * .35;
                for (let i = -1; i < 9; i++) { const bx = ((i * 2.4 - par % 2.4) * u); c.fillRect(bx, 0, u * .9, gy); }
                c.fillStyle = _f8b0f98(12) + hue + _f8b0f98(67), c.fillRect(-10, gy, W + 20, H - gy), c.fillStyle = _f8b0f98(12) + hue + _f8b0f98(5), c.fillRect(-10, gy, W + 20, Math.max(2, u * .09));
                const wx = x => (x - camX) * u, wy = y => gy - y * u;
                /* garis finish */
                const fx = wx(d.length);
                if (fx < W + 20) {
                    c.fillStyle = _f8b0f98(74), c.fillRect(fx, 0, u * .5, gy);
                    c.fillStyle = _f8b0f98(43);
                    for (let i = 0; i < gy / (u * .5); i++)
                        i % 2 && c.fillRect(fx, i * u * .5, u * .25, u * .5);
                }
                /* blok */
                c.fillStyle = _f8b0f98(12) + hue + _f8b0f98(10), c.strokeStyle = _f8b0f98(12) + hue + _f8b0f98(32), c.lineWidth = Math.max(1.5, u * .07);
                for (const b of d.blocks) {
                    if (b.x - camX > VW + 1 || b.x + b.w - camX < -1)
                        continue;
                    const bx = wx(b.x), by = wy(b.h), bw = b.w * u, bh = b.h * u;
                    c.fillRect(bx, by, bw, bh), c.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
                }
                /* duri (satu path) */
                c.fillStyle = _f8b0f98(54), c.beginPath();
                for (const s of d.spikes) {
                    if (s - camX > VW + 1 || s + 1 - camX < -1)
                        continue;
                    const bx = wx(s), by = wy(0);
                    c.moveTo(bx, by), c.lineTo(bx + u * .5, by - u * .95), c.lineTo(bx + u, by), c.closePath();
                }
                c.fill();
                /* pemain */
                if (S.state !== _f8b0f98(7)) {
                    const px = wx(r.x), py = wy(r.y + 1), s = u;
                    c.save(), c.translate(px + s / 2, py + s / 2), c.rotate(r.rot * Math.PI / 180), c.fillStyle = _f8b0f98(69), c.fillRect(-s / 2, -s / 2, s, s), c.strokeStyle = _f8b0f98(44), c.lineWidth = Math.max(2, s * .08), c.strokeRect(-s / 2 + 1, -s / 2 + 1, s - 2, s - 2), c.fillStyle = _f8b0f98(44), c.fillRect(-s * .28, -s * .22, s * .16, s * .2), c.fillRect(s * .12, -s * .22, s * .16, s * .2), c.fillRect(-s * .28, s * .14, s * .56, s * .1), c.restore();
                }
                c.fillStyle = _f8b0f98(69);
                for (const p of S.parts) {
                    c.globalAlpha = Math.max(0, p.l / 50), c.fillStyle = p.c, c.fillRect(wx(p.x), wy(p.y), u * .22, u * .22);
                }
                c.globalAlpha = 1, c.restore();
            }
            S.menu = menu, menu();
        }, back() {
            if (!cur || cur.state === _f8b0f98(9))
                return false;
            return cur.menu(), true;
        }, unmount() {
            if (!cur)
                return;
            const S = cur;
            cur = null, S.dead = true, cancelAnimationFrame(S.raf), S.off.forEach(f => f());
        } });
})();
