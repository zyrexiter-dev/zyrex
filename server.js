// All Tools ZyrexDep - akun + profil + pembuat project APK (Node.js, untuk panel Pterodactyl)
const express = require('express'), fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const { Readable } = require('stream');
const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data'); fs.mkdirSync(DATA, { recursive: true });
const FU = path.join(DATA, 'users.json'), FS = path.join(DATA, 'sessions.json');
const load = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const users = load(FU, {}), sess = load(FS, {});   // users: key(lowercase) -> {name,salt,hash,avatar,created,role,badge,dev,banned}
const save = () => { fs.writeFileSync(FU, JSON.stringify(users)); fs.writeFileSync(FS, JSON.stringify(sess)); };
const FR = path.join(DATA, 'reserved.json');
const reserved = load(FR, {});   // username (lowercase) yang pernah dipakai lalu dihapus/diganti -> tidak boleh dipakai lagi
const saveReserved = () => { try { fs.writeFileSync(FR, JSON.stringify(reserved)); } catch (e) {} };
/* Kode rahasia pendaftaran akun ZyrexDepp: dari env OWNER_CODE, atau dibuat otomatis di data/owner-code.txt */
const FCODE = path.join(DATA, 'owner-code.txt');
let OWNER_CODE = process.env.OWNER_CODE || '';
if (!OWNER_CODE) { try { OWNER_CODE = fs.readFileSync(FCODE, 'utf8').trim(); } catch (e) {} }
if (!OWNER_CODE) { OWNER_CODE = crypto.randomBytes(5).toString('hex'); try { fs.writeFileSync(FCODE, OWNER_CODE); } catch (e) {} }
const hash = (p, s) => crypto.scryptSync(p, s, 32).toString('hex');
const mk = (p) => { const salt = crypto.randomBytes(8).toString('hex'); return { salt, hash: hash(p, salt) }; };
const same = (u, p) => crypto.timingSafeEqual(Buffer.from(hash(String(p || ''), u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
const UN = /^[\w.\-]{3,24}$/;
const av = (a) => (typeof a === 'string' && a.length < 250000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a) ? a : null);

/* Role yang bisa dibagikan: VIP & Owner. "zyrexdepp" otomatis Developer + Admin + centang biru, tidak bisa diubah. */
const ROLES = ['user', 'vip', 'admin', 'owner', 'ress', 'partner', 'tk'];
/* Ress (reseller) = perk VIP, bisa membagikan VIP. Partner = perk Owner, bisa membagikan VIP & Owner. */
/* TK = perk Owner + semua fitur tanpa batas seperti Developer, bisa menambah & mencabut VIP, Owner, Ress (tanpa panel admin, tanpa atur harga). */
const effRole = (r) => r === 'ress' ? 'vip' : (r === 'partner' || r === 'tk') ? 'owner' : r;
const OWNER_KEY = 'zyrexdepp';
const normUser = (u) => { if (!ROLES.includes(u.role)) u.role = 'user'; u.badge = !!u.badge; u.dev = !!u.dev; u.banned = !!u.banned; return u; };
const ASSIGNABLE = ['user', 'vip', 'owner', 'ress', 'partner', 'tk'];   // Admin & Developer eksklusif milik ZyrexDepp
const enforceOwner = (k, u) => {
  if (k === OWNER_KEY) { u.role = 'admin'; u.dev = true; u.badge = true; u.banned = false; }
  else { u.dev = false; if (u.role === 'admin') u.role = 'user'; }
  return u;
};
for (const k in users) enforceOwner(k, normUser(users[k]));
const pub = (u) => ({ user: u.name, avatar: u.avatar || null, role: u.role || 'user', roleExp: u.roleExp || 0, badge: !!u.badge, dev: !!u.dev, maint: canMaint(u), grant: grantRoles(u) });
/* ---------- Toko Zyrex: harga & masa aktif (hari) role VIP/Owner, diatur Developer. days 0 = permanen ---------- */
const FSH = path.join(DATA, 'shop.json');
const SHOP_CAT_DEF = [['role', 'Role'], ['ourin', 'Script Ourin'], ['cantarella', 'Script Cantarella'], ['rename', 'Rename Script'], ['sewabot', 'Jasa Sewa Bot'], ['smm', 'Suntik Media Social'], ['panel', 'Panel Pterodactyl']];
const shop = (() => {
  const s = load(FSH, {}), d = { vip: { price: 10000, days: 30 }, owner: { price: 30000, days: 30 }, ress: { price: 50000, days: 30 }, partner: { price: 100000, days: 30 }, tk: { price: 200000, days: 0 } };
  // kategori di bar Toko: bisa ditambah / diganti nama / dihapus Developer. "role" selalu ada dan di urutan pertama.
  let cats = (Array.isArray(s.cats) ? s.cats : SHOP_CAT_DEF.map(([id, name]) => ({ id, name })))
    .filter(c => c && typeof c.id === 'string' && /^[a-z0-9]{2,12}$/.test(c.id) && typeof c.name === 'string' && c.name.trim())
    .map(c => ({ id: c.id, name: c.name.trim().slice(0, 30) })).slice(0, 20);
  const seen = new Set(); cats = cats.filter(c => !seen.has(c.id) && seen.add(c.id));
  const rl = cats.find(c => c.id === 'role') || { id: 'role', name: 'Role' };
  cats = [rl, ...cats.filter(c => c.id !== 'role')];
  const ids = new Set(cats.map(c => c.id));
  const prods = (Array.isArray(s.products) ? s.products : []).filter(x => x && typeof x.id === 'string' && x.cat !== 'role' && ids.has(x.cat) && typeof x.name === 'string')
    .map(x => ({ id: x.id, cat: x.cat, name: x.name.slice(0, 60), price: Math.max(0, Math.floor(Number(x.price) || 0)), desc: String(x.desc || '').slice(0, 200) })).slice(0, 200);
  return { vip: Object.assign({}, d.vip, s.vip), owner: Object.assign({}, d.owner, s.owner), ress: Object.assign({}, d.ress, s.ress), partner: Object.assign({}, d.partner, s.partner), tk: Object.assign({}, d.tk, s.tk), contact: typeof s.contact === 'string' ? s.contact.slice(0, 300) : '', cats, products: prods };
})();
const saveShop = () => {   // tulis lewat file sementara lalu dicek balik; false kalau gagal
  try {
    const tmp = FSH + '.tmp', txt = JSON.stringify(shop);
    fs.writeFileSync(tmp, txt); fs.renameSync(tmp, FSH);
    return fs.readFileSync(FSH, 'utf8') === txt;
  } catch (e) { console.log('Gagal simpan data/shop.json: ' + e.message); return false; }
};
const expireRole = (u) => {
  if (u && u.roleExp && Date.now() > u.roleExp && (u.role === 'vip' || u.role === 'owner' || u.role === 'ress' || u.role === 'partner' || u.role === 'tk')) { u.role = 'user'; u.roleExp = 0; return true; }
  return false;
};
{ let ch = false; for (const k in users) if (expireRole(users[k])) ch = true; if (ch) save(); }
setInterval(() => { let ch = false; for (const k in users) if (expireRole(users[k])) ch = true; if (ch) save(); }, 3600e3).unref();
const isStaff = (u) => !!(u && u.dev);   // hanya Developer (ZyrexDepp) yang punya kuasa admin
const issue = (k) => { const t = crypto.randomBytes(24).toString('hex'); sess[t] = k; return t; };
const bad = (r, c, e) => r.status(c).json({ error: e });

const hits = new Map(); setInterval(() => hits.clear(), 60000).unref();
const lim = (q, r, n) => { const c = (hits.get(q.ip) || 0) + 1; hits.set(q.ip, c); c > 30 ? bad(r, 429, 'Terlalu banyak percobaan, tunggu semenit') : n(); };
const auth = (q, r, n) => {
  const t = q.get('x-token'), k = sess[t];
  if (!k || !users[k]) return bad(r, 401, 'Sesi habis, silakan masuk lagi');
  if (users[k].banned) { delete sess[t]; save(); return bad(r, 403, 'Akun ini diblokir admin.'); }
  if (expireRole(users[k])) save();
  q.tok = t; q.key = k; q.u = users[k]; n();
};
const admin = (q, r, n) => { if (!isStaff(q.u)) return bad(r, 403, 'Khusus Developer.'); n(); };

const app = express();
app.use(express.json({ limit: '6mb' }));
app.get('/', (q, r) => r.sendFile(path.join(__dirname, 'index.html')));
/* File terpisah: public/css dan public/js (hanya folder public yang bisa diakses dari browser) */
app.use(express.static(path.join(__dirname, 'public'), { index: false, dotfiles: 'ignore', etag: true, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
/* TOOLS DINONAKTIFKAN: semua endpoint tool ditolak, API luar sudah dihapus */
const TOOLS_OFF = new Set(["apk", "iqc", "iqcpinkv2", "iqcpink", "fakeff", "ttdl", "ccdl", "igdl", "pindl", "stalkff", "stalkig", "stalkrbx", "stalktt", "bypasssfl", "slopscan", "ssweb", "aio", "amdl", "presetfinder", "hd", "removebg", "topixel", "callandro", "callios", "derydnta", "fakech", "fakedana", "fakedev", "fakeffduo", "fakegc", "fakeml", "ttdm", "ttqc", "windows", "brat", "meledak", "memepolisi", "nokia", "quotes", "templateqris", "afinitasml", "cekphising", "rch", "capcut", "vote", "spamotp", "follch", "amprem", "ambulk", "live", "scanslop"]);
app.use('/api', (q, r, nx) => {
  const p = q.originalUrl.split('?')[0].replace(/^\/api\//, '').split('/')[0];
  if (TOOLS_OFF.has(p)) return r.status(503).json({ error: 'Tool ini sudah dinonaktifkan.' });
  nx();
});
/* Maintenance per tool: kalau sebuah tool ditandai maintenance, server menolak permintaannya (kecuali Developer/Admin/Owner yang mau mengetes) */
app.use('/api', (q, r, nx) => {
  const p = q.originalUrl.split('?')[0];
  for (const id in MAINT) {
    const apis = TOOL_API[id];
    if (apis && apis.some((a) => p === a || p.startsWith(a + '/')))
      return auth(q, r, () => canMaint(q.u) ? nx() : bad(r, 503, 'Tool ini sedang maintenance' + (MAINT[id].msg ? ': ' + MAINT[id].msg : '. Coba lagi nanti.')));
  }
  nx();
});

/* Foto developer: diambil sekali dari link aslinya lalu disimpan di server (menghindari blokir hotlink) */
const DEV_PHOTO_URL = 'https://u.pone.rs/mclgpyjy.jpg', DEV_PHOTO = path.join(__dirname, 'dev-photo.jpg');
function grabPhoto(url, cb, hop) {
  if ((hop || 0) > 4) return cb(new Error('terlalu banyak redirect'));
  require('https').get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36', Accept: 'image/*' } }, res => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return grabPhoto(new URL(res.headers.location, url).href, cb, (hop || 0) + 1); }
    if (res.statusCode !== 200) { res.resume(); return cb(new Error('status ' + res.statusCode)); }
    const parts = []; res.on('data', d => parts.push(d)); res.on('end', () => cb(null, Buffer.concat(parts)));
  }).on('error', cb);
}
app.get('/dev.jpg', (q, r) => {
  const send = () => r.set('Cache-Control', 'public, max-age=86400').type('jpg').sendFile(DEV_PHOTO);
  if (fs.existsSync(DEV_PHOTO)) return send();
  grabPhoto(DEV_PHOTO_URL, (e, buf) => {
    if (e || !buf || buf.length < 500) return r.status(404).end();
    try { fs.writeFileSync(DEV_PHOTO, buf); } catch (x) { return r.type('jpg').send(buf); }
    send();
  });
});

app.post('/api/register', lim, (q, r) => {
  const { user, pass, avatar } = q.body || {}, k = String(user || '').toLowerCase();
  if (!UN.test(user || '')) return bad(r, 400, 'Username 3-24 karakter: huruf, angka, titik, strip, garis bawah.');
  if (String(pass || '').length < 4) return bad(r, 400, 'Password minimal 4 karakter.');
  if (users[k] || reserved[k]) return bad(r, 409, 'Username sudah dipakai.');
  if (k === OWNER_KEY && String((q.body || {}).code || '') !== OWNER_CODE) return bad(r, 403, 'Username ini dilindungi. Butuh kode rahasia Developer.');
  users[k] = enforceOwner(k, normUser({ name: user, ...mk(pass), avatar: av(avatar), created: Date.now() }));
  const t = issue(k); save(); r.json({ token: t, user: pub(users[k]) });
});
app.post('/api/login', lim, (q, r) => {
  const { user, pass } = q.body || {}, k = String(user || '').toLowerCase(), u = users[k];
  if (!u || !same(u, pass)) return bad(r, 401, 'Username atau password salah.');
  if (u.banned) return bad(r, 403, 'Akun ini diblokir admin.');
  enforceOwner(k, normUser(u)); expireRole(u);
  const t = issue(k); save(); r.json({ token: t, user: pub(u) });
});
app.post('/api/me', auth, (q, r) => r.json({ user: pub(q.u) }));
/* Catatan per akun (ikut tersimpan di data akun, tidak hilang saat ganti username) */
app.post('/api/notes', auth, (q, r) => r.json({ notes: Array.isArray(q.u.notes) ? q.u.notes : [] }));
app.post('/api/notes/save', auth, (q, r) => {
  const a = q.body && q.body.notes;
  if (!Array.isArray(a) || a.length > 300) return bad(r, 400, 'Maksimal 300 catatan.');
  const out = []; let total = 0;
  for (const n of a) {
    if (!n || typeof n.t !== 'string' || typeof n.id !== 'string') continue;
    const t = n.t.slice(0, 20000); total += t.length;
    out.push({ id: n.id.slice(0, 40), t, u: Number(n.u) || Date.now() });
  }
  if (total > 1500000) return bad(r, 413, 'Total catatan terlalu besar.');
  q.u.notes = out; save(); r.json({ ok: 1, n: out.length });
});
app.post('/api/logout', auth, (q, r) => { delete sess[q.tok]; save(); r.json({ ok: 1 }); });

app.post('/api/profile', auth, (q, r) => {
  const b = q.body || {}, u = q.u;
  if (typeof b.user === 'string' && b.user !== u.name) {
    if (!UN.test(b.user)) return bad(r, 400, 'Username 3-24 karakter: huruf, angka, titik, strip, garis bawah.');
    const nk = b.user.toLowerCase();
    if (nk !== q.key) {
      if (users[nk] || reserved[nk] || nk === OWNER_KEY) return bad(r, 409, 'Username sudah dipakai.');
      reserved[q.key] = 1; saveReserved();
      users[nk] = u; delete users[q.key];
      for (const t in sess) if (sess[t] === q.key) sess[t] = nk;
    }
    u.name = b.user;
  }
  if ('avatar' in b) u.avatar = av(b.avatar);
  save(); r.json({ user: pub(u) });
});
app.post('/api/password', auth, (q, r) => {
  const { old, pass } = q.body || {};
  if (!same(q.u, old)) return bad(r, 403, 'Password lama salah.');
  if (String(pass || '').length < 4) return bad(r, 400, 'Password baru minimal 4 karakter.');
  Object.assign(q.u, mk(pass));
  for (const t in sess) if (sess[t] === q.key && t !== q.tok) delete sess[t]; // perangkat lain otomatis keluar
  save(); r.json({ ok: 1 });
});
app.post('/api/delete', auth, (q, r) => {
  if (!same(q.u, (q.body || {}).pass)) return bad(r, 403, 'Password salah.');
  if (q.key === OWNER_KEY) return bad(r, 403, 'Akun Developer tidak bisa dihapus.');
  reserved[q.key] = 1; saveReserved();
  delete users[q.key]; for (const t in sess) if (sess[t] === q.key) delete sess[t];
  save(); r.json({ ok: 1 });
});

// ---------- ZIP minimal tanpa library ----------
const CT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (b) => { let c = ~0; for (const x of b) c = CT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
function zip(files) {
  const out = [], cen = []; let off = 0;
  for (const [n, d] of Object.entries(files)) {
    const nb = Buffer.from(n), z = zlib.deflateRawSync(d), c = crc(d);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt16LE(0x21, 12); h.writeUInt32LE(c, 14); h.writeUInt32LE(z.length, 18); h.writeUInt32LE(d.length, 22); h.writeUInt16LE(nb.length, 26);
    const e = Buffer.alloc(46); e.writeUInt32LE(0x02014b50, 0); e.writeUInt16LE(20, 4); e.writeUInt16LE(20, 6); e.writeUInt16LE(0x0800, 8); e.writeUInt16LE(8, 10);
    e.writeUInt16LE(0x21, 14); e.writeUInt32LE(c, 16); e.writeUInt32LE(z.length, 20); e.writeUInt32LE(d.length, 24); e.writeUInt16LE(nb.length, 28); e.writeUInt32LE(off, 42);
    out.push(h, nb, z); cen.push(e, nb); off += 30 + nb.length + z.length;
  }
  const cd = Buffer.concat(cen), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(cen.length / 2, 8); end.writeUInt16LE(cen.length / 2, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...out, cd, end]);
}

// ---------- Pembuat project APK (Android Studio + GitHub Actions) ----------
const X = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, "\\'");
const J = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
function build(b) {
  const name = String(b.name || '').trim(), pkg = String(b.pkg || '').trim(), url = String(b.url || '').trim();
  if (!name || name.length > 30) throw 'Nama aplikasi wajib diisi (maksimal 30 karakter).';
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(pkg) || pkg.length > 60) throw 'Package name tidak valid. Contoh: com.zyrexdep.app';
  if (!/^https?:\/\/[^\s"<>]+$/i.test(url)) throw 'Link website harus diawali http:// atau https://';
  const vname = /^[\w.\-]{1,20}$/.test(b.vname || '') ? b.vname : '1.0.0';
  const vcode = Math.min(2e9, Math.max(1, parseInt(b.vcode, 10) || 1));
  const minsdk = [21, 24, 26, 29].includes(+b.minsdk) ? +b.minsdk : 24;
  const color = /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#007aff';
  const orient = { portrait: 'portrait', landscape: 'landscape' }[b.orient] || 'unspecified';
  const p = b.perms || {}, full = !!b.full, zoom = !!b.zoom;
  const perms = ['INTERNET', 'ACCESS_NETWORK_STATE', 'VIBRATE'];
  if (p.cam) perms.push('CAMERA'); if (p.mic) perms.push('RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS');
  if (p.loc) perms.push('ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'); if (p.notif) perms.push('POST_NOTIFICATIONS');
  const rt = []; if (p.cam) rt.push('Manifest.permission.CAMERA'); if (p.mic) rt.push('Manifest.permission.RECORD_AUDIO');
  if (p.loc) rt.push('Manifest.permission.ACCESS_FINE_LOCATION'); if (p.notif) rt.push('"android.permission.POST_NOTIFICATIONS"');
  let icon = null; const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(b.icon || '');
  if (m && m[1].length < 400000) icon = Buffer.from(m[1], 'base64');
  const dir = pkg.replace(/\./g, '/'), root = name.replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '') || 'app';
  const F = {};
  F['settings.gradle'] = `pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement { repositories { google(); mavenCentral() } }
rootProject.name = "${J(root)}"
include ':app'
`;
  F['build.gradle'] = `plugins { id 'com.android.application' version '8.3.2' apply false }\n`;
  F['gradle.properties'] = `org.gradle.jvmargs=-Xmx2048m\nandroid.useAndroidX=false\n`;
  F['app/build.gradle'] = `plugins { id 'com.android.application' }
android {
    namespace '${pkg}'
    compileSdk 34
    defaultConfig {
        applicationId '${pkg}'
        minSdk ${minsdk}
        targetSdk 34
        versionCode ${vcode}
        versionName '${vname}'
    }
    buildTypes { release { minifyEnabled false } }
    compileOptions { sourceCompatibility JavaVersion.VERSION_1_8; targetCompatibility JavaVersion.VERSION_1_8 }
}
`;
  F['app/src/main/AndroidManifest.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
${perms.map((x) => `    <uses-permission android:name="android.permission.${x}"/>`).join('\n')}
    <application android:label="@string/app_name"${icon ? ' android:icon="@mipmap/ic_launcher"' : ''}
        android:usesCleartextTraffic="true" android:hardwareAccelerated="true"
        android:theme="@android:style/Theme.DeviceDefault.Light.NoActionBar">
        <activity android:name=".MainActivity" android:exported="true" android:screenOrientation="${orient}"
            android:configChanges="orientation|screenSize|keyboardHidden|smallestScreenSize|screenLayout">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
    </application>
</manifest>
`;
  F['app/src/main/res/values/strings.xml'] = `<?xml version="1.0" encoding="utf-8"?>\n<resources><string name="app_name">${X(name)}</string></resources>\n`;
  if (icon) F['app/src/main/res/mipmap-xxhdpi/ic_launcher.png'] = icon;
  F[`app/src/main/java/${dir}/MainActivity.java`] = `package ${pkg};

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.view.WindowManager;
import android.webkit.*;
import android.widget.FrameLayout;
import android.widget.ProgressBar;

public class MainActivity extends Activity {
    WebView w; ValueCallback<Uri[]> fc; ProgressBar pb;

    @Override protected void onCreate(Bundle s) {
        super.onCreate(s);
        ${full ? 'getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);' : ''}
        getWindow().setStatusBarColor(Color.parseColor("${color}"));
        w = new WebView(this);
        FrameLayout f = new FrameLayout(this); f.addView(w);
        pb = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        f.addView(pb, new FrameLayout.LayoutParams(-1, 8)); setContentView(f);
        WebSettings t = w.getSettings();
        t.setJavaScriptEnabled(true); t.setDomStorageEnabled(true); t.setAllowFileAccess(true);
        t.setMediaPlaybackRequiresUserGesture(false); t.setGeolocationEnabled(true);
        t.setSupportZoom(${zoom}); t.setBuiltInZoomControls(${zoom}); t.setDisplayZoomControls(false);
        w.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                if (r.getUrl().toString().startsWith("http")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, r.getUrl())); } catch (Exception e) {}
                return true;
            }
        });
        w.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView v, int p) { pb.setProgress(p); pb.setVisibility(p < 100 ? View.VISIBLE : View.GONE); }
            @Override public void onPermissionRequest(final PermissionRequest r) { runOnUiThread(new Runnable() { public void run() { r.grant(r.getResources()); } }); }
            @Override public void onGeolocationPermissionsShowPrompt(String o, GeolocationPermissions.Callback c) { c.invoke(o, true, false); }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fc != null) fc.onReceiveValue(null); fc = cb;
                try { startActivityForResult(p.createIntent(), 1); } catch (Exception e) { fc = null; return false; }
                return true;
            }
        });
        w.setDownloadListener(new DownloadListener() {
            public void onDownloadStart(String u, String ua, String cd, String mt, long l) {
                DownloadManager.Request d = new DownloadManager.Request(Uri.parse(u));
                d.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                d.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, URLUtil.guessFileName(u, cd, mt));
                ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(d);
            }
        });
        ${rt.length ? `requestPermissions(new String[]{${rt.join(', ')}}, 2);` : ''}
        w.loadUrl("${J(url)}");
    }
    @Override protected void onActivityResult(int rq, int rs, Intent i) {
        if (rq == 1 && fc != null) { fc.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(rs, i)); fc = null; }
    }
    @Override public void onBackPressed() { if (w.canGoBack()) w.goBack(); else super.onBackPressed(); }
}
`;
  F['.github/workflows/build.yml'] = `name: Build APK
on:
  push:
    branches: [main, master]
  workflow_dispatch:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '17' }
      - uses: gradle/actions/setup-gradle@v3
        with: { gradle-version: '8.7' }
      - run: gradle assembleDebug --no-daemon
      - uses: actions/upload-artifact@v4
        with: { name: apk, path: app/build/outputs/apk/debug/*.apk }
`;
  F['README.txt'] = `${name} (${pkg}) v${vname}

CARA JADI APK
A. Lewat GitHub (tanpa install apa-apa)
   1. Buat repo baru di GitHub, upload SEMUA isi folder ini (termasuk folder .github).
   2. Buka tab Actions > Build APK > tunggu hijau.
   3. Buka run terakhir > Artifacts > unduh "apk" > ekstrak > pasang file .apk di HP.
B. Lewat Android Studio
   1. File > Open, pilih folder ini, tunggu sync Gradle selesai.
   2. Build > Build Bundle(s) / APK(s) > Build APK(s).
   3. File ada di app/build/outputs/apk/debug/.

Catatan: ini APK debug (bisa dipasang langsung). Untuk Play Store, buat keystore lalu build release yang ditandatangani.
Link website: ${url}
`;
  return { zip: zip(Object.fromEntries(Object.entries(F).map(([k, v]) => [`${root}/${k}`, Buffer.isBuffer(v) ? v : Buffer.from(v)]))), root };
}
app.post('/api/apk', lim, auth, (q, r) => {
  try { const { zip: z, root } = build(q.body || {}); r.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${root}-apk-project.zip"` }); r.send(z); }
  catch (e) { bad(r, 400, typeof e === 'string' ? e : 'Gagal membuat project.'); }
});


/* IQC: membuat gambar lewat apiii-xrina.my.id/canvas/iqc (text, time, image). Foto dari galeri disimpan sementara
   di memori dan disajikan di /t/<id>.jpg agar layanan bisa mengambilnya, lalu dihapus. Isi PUBLIC_URL di env bila alamat publik berbeda. */
const TMPIMG = new Map();
app.get(/^\/t\/([a-f0-9]{24})\.(?:jpg|png|webp)$/, (q, r) => {
  const t = TMPIMG.get(q.params[0]);
  if (!t) return r.status(404).end();
  r.set({ 'Content-Type': t.mime, 'Cache-Control': 'no-store' }).send(t.buf);
});
const iqcH = (ep, net) => async (q, r) => {
  const b = q.body || {};
  const text = String(b.text || '').trim().slice(0, 300);
  if (!text) return bad(r, 400, 'Teks kosong.');
  let time = String(b.time || '').trim().replace(':', '.');
  if (!/^\d{1,2}\.\d{2}$/.test(time)) { const d = new Date(); time = String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0'); }
  const params = { text, time };
  if (net) { const n = String(b.network || 'wifi').toLowerCase(); params.network = ['wifi', '5g', '4g', '3g', '2g'].includes(n) ? n : 'wifi'; }
  let tid = null;
  if (b.image) {
    const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image));
    if (!m || m[2].length > 2000000) return bad(r, 400, 'Foto tidak valid atau terlalu besar.');
    if (TMPIMG.size > 40) return bad(r, 429, 'Server lagi sibuk, coba lagi sebentar.');
    tid = crypto.randomBytes(12).toString('hex');
    TMPIMG.set(tid, { mime: m[1], buf: Buffer.from(m[2], 'base64') });
    setTimeout(() => TMPIMG.delete(tid), 600000).unref();
    const proto = String(q.get('x-forwarded-proto') || q.protocol).split(',')[0].trim();
    const host = String(q.get('x-forwarded-host') || q.get('host')).split(',')[0].trim();
    const base = (process.env.PUBLIC_URL || (proto + '://' + host)).replace(/\/$/, '');
    params.image = base + '/t/' + tid + '.' + (m[1] === 'image/png' ? 'png' : m[1] === 'image/webp' ? 'webp' : 'jpg');
  }
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 45000);
  try {
    const res = await fetch('' + ep + '?' + new URLSearchParams(params).toString(), { signal: ac.signal });
    const ct = String(res.headers.get('content-type') || '');
    if (!res.ok || !ct.startsWith('image/')) return bad(r, 502, 'Layanan IQC gagal membuat gambar' + (tid ? ' (cek apakah link foto bisa dibuka dari luar)' : '') + '.');
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 8e6) return bad(r, 502, 'Hasil gambar tidak valid.');
    r.set({ 'Content-Type': ct.split(';')[0], 'Cache-Control': 'no-store' }).send(buf);
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'IQC terlalu lama, coba lagi.' : 'Gagal menghubungi layanan IQC.'); }
  finally { clearTimeout(to); if (tid) setTimeout(() => TMPIMG.delete(tid), 30000).unref(); }
};
app.post('/api/iqc', lim, auth, iqcH('iqc', false));
app.post('/api/iqcpinkv2', lim, auth, iqcH('iqcpinkv2', true));

/* IQC Pink: apiii-xrina.my.id/canvas/iqcpink (text, time). Jam ditulis manual, format 00.19 */
app.post('/api/iqcpink', lim, auth, async (q, r) => {
  const b = q.body || {};
  const text = String(b.text || '').trim().slice(0, 300);
  if (!text) return bad(r, 400, 'Teks kosong.');
  let time = String(b.time || '').trim().replace(':', '.');
  if (!/^\d{1,2}\.\d{2}$/.test(time)) { const d = new Date(); time = String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0'); }
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 45000);
  try {
    const res = await fetch('' + new URLSearchParams({ text, time }).toString(), { signal: ac.signal });
    const ct = String(res.headers.get('content-type') || '');
    if (!res.ok || !ct.startsWith('image/')) return bad(r, 502, 'Layanan IQC Pink gagal membuat gambar.');
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 8e6) return bad(r, 502, 'Hasil gambar tidak valid.');
    r.set({ 'Content-Type': ct.split(';')[0], 'Cache-Control': 'no-store' }).send(buf);
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'IQC Pink terlalu lama, coba lagi.' : 'Gagal menghubungi layanan IQC Pink.'); }
  finally { clearTimeout(to); }
});

/* Fake FF: apiii-xrina.my.id/canvas/fakeff?name= (cowok) atau apiii-xrina.my.id/canvas/ffgirl?username= (cewek). */
app.post('/api/fakeff', lim, auth, async (q, r) => {
  const b = q.body || {};
  const gender = b.gender === 'cewek' ? 'cewek' : 'cowok';
  const name = String(b.name || '').trim().slice(0, 40);
  if (!name) return bad(r, 400, 'Nama kosong.');
  const ep = gender === 'cewek'
    ? '' + new URLSearchParams({ username: name }).toString()
    : '' + new URLSearchParams({ name }).toString();
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 45000);
  try {
    const res = await fetch(ep, { signal: ac.signal });
    const ct = String(res.headers.get('content-type') || '');
    if (!res.ok || !ct.startsWith('image/')) return bad(r, 502, 'Layanan Fake FF gagal membuat gambar.');
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 8e6) return bad(r, 502, 'Hasil gambar tidak valid.');
    r.set({ 'Content-Type': ct.split(';')[0], 'Cache-Control': 'no-store' }).send(buf);
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Fake FF terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Fake FF.'); }
  finally { clearTimeout(to); }
});

/* TikTok Download: apiii-xrina.my.id/download/tiktok?url=<link>. Balasan JSON: data.{title,author,duration,cover,music_title,downloads.{no_watermark,watermark,audio}.url}.
   Link file dari TikTok disimpan sementara di server dengan token acak, lalu dialirkan lewat /tt/<token> (browser tidak kena blokir hotlink, tombol unduh bisa jalan). */
const TT = new Map();
const ttSafe = u => { try { const p = new URL(u); return p.protocol === 'https:' && p.hostname.includes('.') && !/^[\d.]+$/.test(p.hostname) && !p.hostname.includes(':') && !/\.(local|internal|localhost)$/i.test(p.hostname); } catch (e) { return false; } };
const ttTok = (u, mime, name, ref) => {
  if (typeof u !== 'string' || !ttSafe(u)) return null;
  while (TT.size >= 300) TT.delete(TT.keys().next().value);
  const id = crypto.randomBytes(12).toString('hex'); TT.set(id, { url: u, mime, name, ref });
  setTimeout(() => TT.delete(id), 900000).unref();
  return '/tt/' + id;
};
app.post('/api/ttdl', lim, auth, async (q, r) => {
  let raw = String((q.body && q.body.url) || '').trim().slice(0, 500);
  if (!raw) return bad(r, 400, 'Tempel link TikTok dulu.');
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  let p; try { p = new URL(raw); } catch (e) { return bad(r, 400, 'Link tidak valid.'); }
  if (!/^https?:$/.test(p.protocol) || !/(^|\.)tiktok\.com$/i.test(p.hostname)) return bad(r, 400, 'Link harus dari tiktok.com.');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
  try {
    let res;
    try { res = await fetch('' + new URLSearchParams({ url: p.href }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; return bad(r, 502, 'Server tidak bisa menjangkau layanan TikTok Download (apiii-xrina.my.id).'); }
    const j = await res.json().catch(() => null), d = j && j.data;
    if (!res.ok || !d || typeof d !== 'object' || !d.downloads) return bad(r, 502, (j && (j.message || (typeof j.error === 'string' && j.error))) || 'Layanan tidak menemukan video, cek linknya lalu coba lagi.');
    const dl = d.downloads, items = [], str = (v, n) => String(v == null ? '' : v).slice(0, n);
    [['no_watermark', 'nowm', 'Video tanpa watermark', 'video/mp4', 'mp4'], ['watermark', 'wm', 'Video dengan watermark', 'video/mp4', 'mp4'], ['audio', 'audio', 'Audio MP3', 'audio/mpeg', 'mp3']].forEach(([key, k, label, mime, ext]) => {
      const href = dl[key] && ttTok(dl[key].url, mime, 'tiktok-' + k + '-' + Date.now() + '.' + ext);
      if (href) items.push({ k, label, href });
    });
    if (!items.length) return bad(r, 502, 'Layanan tidak memberi link unduhan.');
    r.set('Cache-Control', 'no-store').json({ title: str(d.title, 300), author: str(d.author, 60), duration: Number(d.duration) || 0, music: str(d.music_title, 120), cover: ttTok(d.cover, 'image/jpeg', null), items });
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'TikTok Download terlalu lama, coba lagi.' : 'Gagal menghubungi layanan TikTok Download.'); }
  finally { clearTimeout(to); }
});
app.get(/^\/tt\/([a-f0-9]{24})$/, async (q, r) => {
  const t = TT.get(q.params[0]);
  if (!t) return r.status(404).type('text/plain').send('Link sudah kadaluarsa, ambil ulang dari aplikasi.');
  const ac = new AbortController(); r.on('close', () => ac.abort());
  try {
    /* Range diteruskan ke sumber asli supaya tag <video> di frontend bisa play & seek (preview langsung, bukan cuma unduh). */
    const range = q.get('range');
    const fh = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36', Referer: t.ref || 'https://www.tiktok.com/' };
    if (range) fh.Range = range;
    const res = await fetch(t.url, { signal: ac.signal, headers: fh });
    if (!res.ok || !res.body) return r.status(502).type('text/plain').send('Gagal mengunduh file (link mungkin kadaluarsa).');
    const hd = { 'Content-Type': String(res.headers.get('content-type') || t.mime).split(';')[0] || t.mime, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
    const cl = res.headers.get('content-length'); if (cl) hd['Content-Length'] = cl;
    const cr = res.headers.get('content-range'); if (cr) hd['Content-Range'] = cr;
    if (t.name) hd['Content-Disposition'] = 'attachment; filename="' + t.name.replace(/[^\w.\-]/g, '_') + '"';
    r.status(res.status === 206 ? 206 : 200).set(hd);
    Readable.fromWeb(res.body).on('error', () => r.destroy()).pipe(r);
  } catch (e) { if (!r.headersSent) r.status(502).type('text/plain').send('Gagal mengunduh.'); else r.destroy(); }
});

/* CapCut Download: apiii-xrina.my.id/download/capcut?url=<link>. Balasan JSON: data.{title,author,thumbnail,video_url,medias[{quality,extension,url}]}.
   Link file disimpan sementara dengan token acak lalu dialirkan lewat /tt/<token> (sama seperti TikTok Download). Entri dengan URL yang sama digabung supaya tidak dobel. */
app.post('/api/ccdl', lim, auth, async (q, r) => {
  let raw = String((q.body && q.body.url) || '').trim().slice(0, 500);
  if (!raw) return bad(r, 400, 'Tempel link CapCut dulu.');
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  let p; try { p = new URL(raw); } catch (e) { return bad(r, 400, 'Link tidak valid.'); }
  if (!/^https?:$/.test(p.protocol) || !/(^|\.)capcut\.com$/i.test(p.hostname)) return bad(r, 400, 'Link harus dari capcut.com.');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
  try {
    let res;
    try { res = await fetch('' + new URLSearchParams({ url: p.href }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; return bad(r, 502, 'Server tidak bisa menjangkau layanan CapCut Download (apiii-xrina.my.id).'); }
    const j = await res.json().catch(() => null), d = j && j.data;
    if (!res.ok || !d || typeof d !== 'object') return bad(r, 502, (j && (j.message || (typeof j.error === 'string' && j.error))) || 'Layanan tidak menemukan template, cek linknya lalu coba lagi.');
    const str = (v, n) => String(v == null ? '' : v).slice(0, n), ref = 'https://www.capcut.com/', seen = new Set(), items = [];
    const list = (Array.isArray(d.medias) ? d.medias : []).concat(d.video_url ? [{ quality: 'MP4', extension: 'mp4', url: d.video_url }] : []);
    list.forEach(m => {
      if (!m || typeof m.url !== 'string' || seen.has(m.url)) return;
      const ext = /^[a-z0-9]{2,4}$/i.test(String(m.extension || '')) ? String(m.extension).toLowerCase() : 'mp4';
      const mime = ext === 'mp3' ? 'audio/mpeg' : 'video/mp4';
      const href = ttTok(m.url, mime, 'capcut-' + Date.now() + '-' + items.length + '.' + ext, ref);
      if (!href) return;
      seen.add(m.url);
      items.push({ k: ext === 'mp3' ? 'audio' : 'video', label: ext === 'mp3' ? 'Audio MP3' : 'Video ' + (str(m.quality, 12) || 'MP4'), ext, href });
    });
    if (!items.length) return bad(r, 502, 'Layanan tidak memberi link unduhan.');
    r.set('Cache-Control', 'no-store').json({ title: str(d.title, 300), author: str(d.author, 60), cover: ttTok(d.thumbnail, 'image/jpeg', null, ref), items });
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'CapCut Download terlalu lama, coba lagi.' : 'Gagal menghubungi layanan CapCut Download.'); }
  finally { clearTimeout(to); }
});

/* IG Download: apiii-xrina.my.id/download/instagram?url=<link>. Balasan JSON: data.{type,videos[{url}],images[],media[{type,url}]}.
   Semua link (video/foto, termasuk carousel) dikumpulkan dari media/videos/images, URL kembar digabung, lalu dialirkan lewat /tt/<token>. */
app.post('/api/igdl', lim, auth, async (q, r) => {
  let raw = String((q.body && q.body.url) || '').trim().slice(0, 500);
  if (!raw) return bad(r, 400, 'Tempel link Instagram dulu.');
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  let p; try { p = new URL(raw); } catch (e) { return bad(r, 400, 'Link tidak valid.'); }
  if (!/^https?:$/.test(p.protocol) || !/(^|\.)instagram\.com$/i.test(p.hostname)) return bad(r, 400, 'Link harus dari instagram.com.');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
  try {
    let res;
    try { res = await fetch('' + new URLSearchParams({ url: p.href }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; return bad(r, 502, 'Server tidak bisa menjangkau layanan IG Download (apiii-xrina.my.id).'); }
    const j = await res.json().catch(() => null), d = j && j.data;
    if (!res.ok || !d || typeof d !== 'object') return bad(r, 502, (j && (j.message || (typeof j.error === 'string' && j.error))) || 'Layanan tidak menemukan media, cek linknya (akun harus publik) lalu coba lagi.');
    const ref = 'https://www.instagram.com/', seen = new Set(), items = [], str = (v, n) => String(v == null ? '' : v).slice(0, n);
    const urlOf = m => typeof m === 'string' ? m : (m && typeof m.url === 'string' ? m.url : '');
    const src = [];
    (Array.isArray(d.media) ? d.media : []).forEach(m => src.push([urlOf(m), m && m.type]));
    (Array.isArray(d.videos) ? d.videos : []).forEach(m => src.push([urlOf(m), 'video']));
    (Array.isArray(d.images) ? d.images : []).forEach(m => src.push([urlOf(m), 'image']));
    let nv = 0, ni = 0;
    src.forEach(([u, t]) => {
      if (!u || seen.has(u)) return;
      const isVid = String(t || '').toLowerCase() === 'video' || (!t && /\.mp4(\?|$)/i.test(u));
      const href = ttTok(u, isVid ? 'video/mp4' : 'image/jpeg', 'instagram-' + Date.now() + '-' + items.length + (isVid ? '.mp4' : '.jpg'), ref);
      if (!href) return;
      seen.add(u);
      items.push(isVid ? { k: 'video', label: 'Video ' + (++nv), ext: 'mp4', href } : { k: 'image', label: 'Foto ' + (++ni), ext: 'jpg', href });
    });
    if (!items.length) return bad(r, 502, 'Layanan tidak memberi link unduhan.');
    r.set('Cache-Control', 'no-store').json({ type: str(d.type, 20), items });
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'IG Download terlalu lama, coba lagi.' : 'Gagal menghubungi layanan IG Download.'); }
  finally { clearTimeout(to); }
});

/* Pin Download: apiii-xrina.my.id/download/pindl?url=<link>. Balasan JSON: data.{type,image,video,info.{headline,author.name}}.
   Video & gambar disimpan sementara dengan token acak lalu dialirkan lewat /tt/<token>. */
const pinHost = h => /(^|\.)pin\.it$/i.test(h) || /(^|\.)pinterest\.[a-z]{2,3}(\.[a-z]{2})?$/i.test(h);
app.post('/api/pindl', lim, auth, async (q, r) => {
  let raw = String((q.body && q.body.url) || '').trim().slice(0, 500);
  if (!raw) return bad(r, 400, 'Tempel link Pinterest dulu.');
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  let p; try { p = new URL(raw); } catch (e) { return bad(r, 400, 'Link tidak valid.'); }
  if (!/^https?:$/.test(p.protocol) || !pinHost(p.hostname)) return bad(r, 400, 'Link harus dari pinterest.com atau pin.it.');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
  try {
    let res;
    try { res = await fetch('' + new URLSearchParams({ url: p.href }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; return bad(r, 502, 'Server tidak bisa menjangkau layanan Pin Download (apiii-xrina.my.id).'); }
    const j = await res.json().catch(() => null), d = j && j.data;
    if (!res.ok || !d || typeof d !== 'object') return bad(r, 502, (j && (j.message || (typeof j.error === 'string' && j.error))) || 'Layanan tidak menemukan pin, cek linknya lalu coba lagi.');
    const ref = 'https://www.pinterest.com/', str = (v, n) => String(v == null ? '' : v).slice(0, n), items = [], t = Date.now();
    const info = d.info && typeof d.info === 'object' ? d.info : {};
    const vHref = typeof d.video === 'string' && d.video ? ttTok(d.video, 'video/mp4', 'pinterest-' + t + '.mp4', ref) : null;
    const iHref = typeof d.image === 'string' && d.image ? ttTok(d.image, 'image/jpeg', 'pinterest-' + t + '.jpg', ref) : null;
    if (vHref) items.push({ k: 'video', label: 'Unduh video', ext: 'mp4', href: vHref });
    if (iHref) items.push({ k: 'image', label: vHref ? 'Unduh gambar sampul' : 'Unduh gambar', ext: 'jpg', href: iHref });
    if (!items.length) return bad(r, 502, 'Layanan tidak memberi link unduhan.');
    r.set('Cache-Control', 'no-store').json({ type: str(d.type, 20), title: str(info.headline, 300), author: str(info.author && info.author.name, 60), cover: iHref, items });
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Pin Download terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Pin Download.'); }
  finally { clearTimeout(to); }
});

/* Stalk FF: apiii-xrina.my.id/stalker/stalk-ff?uid=<UID>. Balasan JSON: data.{nickname,region,level,rank,rankingPoints,csRank,liked,primeLevel,guild,social,credit,ban,pet,character,avatarUrl,createdAt,lastLoginAt,raw.player.{exp,badgeCnt,hasElitePass,equippedTitle,equippedBanner,equippedOutfitItems,equippedWeaponOutfitItems}}.
   Hanya profil publik dalam game. Ikon disimpan sementara dengan token acak lalu dialirkan lewat /tt/<token>. */
app.post('/api/stalkff', lim, auth, async (q, r) => {
  const uid = String((q.body && q.body.uid) || '').trim();
  if (!/^\d{5,14}$/.test(uid)) return bad(r, 400, 'UID harus angka 5 sampai 14 digit.');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 45000);
  try {
    let res;
    try { res = await fetch('' + new URLSearchParams({ uid }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; return bad(r, 502, 'Server tidak bisa menjangkau layanan Stalk FF (apiii-xrina.my.id).'); }
    const j = await res.json().catch(() => null), d = j && j.data;
    if (!res.ok || !d || typeof d !== 'object' || !d.nickname) return bad(r, 502, (j && (j.message || (typeof j.error === 'string' && j.error))) || 'UID tidak ditemukan, cek lagi lalu coba lagi.');
    const str = (v, n) => String(v == null ? '' : v).slice(0, n), num = v => (typeof v === 'number' && isFinite(v) ? v : null);
    const ref = 'https://freefire.my.id/', ic = u => (typeof u === 'string' && u ? ttTok(u, 'image/png', null, ref) : null);
    const pl = (d.raw && d.raw.player) || {}, g = d.guild || {}, pet = d.pet || {}, ch = d.character || {}, ban = d.ban || {};
    const gear = [];
    []
      .concat(Array.isArray(pl.equippedOutfitItems) ? pl.equippedOutfitItems : [], Array.isArray(pl.equippedWeaponOutfitItems) ? pl.equippedWeaponOutfitItems : [], Array.isArray(pl.equippedLookChangerItems) ? pl.equippedLookChangerItems : [], Array.isArray(pl.equippedArrivalAnimationItems) ? pl.equippedArrivalAnimationItems : [])
      .slice(0, 16).forEach(it => { if (it && it.name) gear.push({ name: str(it.name, 60), icon: ic(it.icon) }); });
    r.set('Cache-Control', 'no-store').json({
      uid: str(d.uid || uid, 20), nickname: str(d.nickname, 60), region: str(d.region, 10),
      level: num(d.level), exp: num(pl.exp), rank: num(d.rank), rankingPoints: num(d.rankingPoints), csRank: num(d.csRank), liked: num(d.liked),
      primeLevel: num(d.primeLevel), badges: num(pl.badgeCnt), elitePass: pl.hasElitePass === true ? true : pl.hasElitePass === false ? false : null,
      creditScore: num(d.credit && d.credit.creditScore), signature: str(d.social && d.social.signature, 200),
      banned: ban.isBanned === true, banStatus: str(ban.status, 30),
      guild: g.guildName ? { name: str(g.guildName, 60), level: num(g.guildLevel), members: num(g.memberNum), capacity: num(g.capacity) } : null,
      pet: pet.name ? { name: str(pet.name, 40), species: str(pet.speciesName, 40), level: num(pet.level), skill: str(pet.skillName, 40), icon: ic(pet.skinIconUrl) } : null,
      character: ch.name ? { name: str(ch.name, 40), icon: ic(ch.icon) } : null,
      title: pl.equippedTitle && pl.equippedTitle.name ? str(pl.equippedTitle.name, 60) : '',
      banner: pl.equippedBanner && pl.equippedBanner.name ? str(pl.equippedBanner.name, 60) : '',
      avatar: ic(d.avatarUrl), createdAt: str(d.createdAt, 40), lastLoginAt: str(d.lastLoginAt, 40), gear
    });
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Stalk FF terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Stalk FF.'); }
  finally { clearTimeout(to); }
});

/* Stalk IG: apiii-xrina.my.id/stalker/stalk-ig?username=<user>. Balasan JSON: data.{username,full_name,is_private,is_verified,biography,external_url,profile_pic_url,followers,following,posts_count,media.{stories,reels,posts}[{image_url,thumbnail_url,is_video,caption,like_count,...}],meta.*_total}.
   Hanya profil publik. Foto disimpan sementara dengan token acak lalu dialirkan lewat /tt/<token>. */
app.post('/api/stalkig', lim, auth, async (q, r) => {
  const user = String((q.body && q.body.username) || '').trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(user)) return bad(r, 400, 'Username tidak valid (huruf, angka, titik, garis bawah).');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
  try {
    let res;
    try { res = await fetch('' + new URLSearchParams({ username: user }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; return bad(r, 502, 'Server tidak bisa menjangkau layanan Stalk IG (apiii-xrina.my.id).'); }
    const j = await res.json().catch(() => null), d = j && j.data;
    if (!res.ok || !d || typeof d !== 'object' || !d.username) return bad(r, 502, (j && (j.message || (typeof j.error === 'string' && j.error))) || 'Akun tidak ditemukan, cek username lalu coba lagi.');
    const str = (v, n) => String(v == null ? '' : v).slice(0, n), num = v => (typeof v === 'number' && isFinite(v) ? v : null);
    const ref = 'https://www.instagram.com/', ic = u => (typeof u === 'string' && u ? ttTok(u, 'image/jpeg', null, ref) : null);
    const md = d.media && typeof d.media === 'object' ? d.media : {}, meta = d.meta && typeof d.meta === 'object' ? d.meta : {};
    const sec = (key, label, totalKey) => {
      const arr = Array.isArray(md[key]) ? md[key] : [], items = [];
      arr.slice(0, 12).forEach(m => {
        if (!m || typeof m !== 'object') return;
        const thumb = ic(m.thumbnail_url || m.image_url || m.display_url || m.cover_url);
        if (!thumb) return;
        items.push({ thumb, video: m.is_video === true || (typeof m.video_url === 'string' && !!m.video_url), caption: str(m.caption, 120), likes: num(m.like_count) });
      });
      return { key, label, total: num(meta[totalKey]) != null ? num(meta[totalKey]) : arr.length, items };
    };
    r.set('Cache-Control', 'no-store').json({
      username: str(d.username, 40), fullName: str(d.full_name, 80), bio: str(d.biography, 300), url: str(d.external_url, 200),
      isPrivate: d.is_private === true, isVerified: d.is_verified === true,
      followers: num(d.followers), following: num(d.following), posts: num(d.posts_count),
      avatar: ic(d.profile_pic_url),
      sections: [sec('stories', 'Story', 'stories_total'), sec('reels', 'Reels', 'reels_total'), sec('posts', 'Postingan', 'posts_total')]
    });
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Stalk IG terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Stalk IG.'); }
  finally { clearTimeout(to); }
});

/* Stalk Roblox: apiii-xrina.my.id/stalker/stalk-roblox?username=<user>. Balasan JSON: data.{id,name,displayName,description,created,isBanned,hasVerifiedBadge,avatar,friends,followers,followings,badges[],games[],inventory[]}.
   Hanya profil publik. Avatar & ikon disimpan sementara dengan token acak lalu dialirkan lewat /tt/<token>. Bentuk isi badges/games/inventory dibaca longgar (name/title + ikon bila ada). */
app.post('/api/stalkrbx', lim, auth, async (q, r) => {
  const user = String((q.body && q.body.username) || '').trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9_]{3,20}$/.test(user)) return bad(r, 400, 'Username Roblox tidak valid (3 sampai 20 huruf, angka, atau garis bawah).');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
  try {
    let res;
    try { res = await fetch('' + new URLSearchParams({ username: user }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; return bad(r, 502, 'Server tidak bisa menjangkau layanan Stalk Roblox (apiii-xrina.my.id).'); }
    const j = await res.json().catch(() => null), d = j && j.data;
    if (!res.ok || !d || typeof d !== 'object' || !d.name) return bad(r, 502, (j && (j.message || (typeof j.error === 'string' && j.error))) || 'Akun tidak ditemukan, cek username lalu coba lagi.');
    const str = (v, n) => String(v == null ? '' : v).slice(0, n), num = v => (typeof v === 'number' && isFinite(v) ? v : null);
    const ref = 'https://www.roblox.com/', ic = u => (typeof u === 'string' && u ? ttTok(u, 'image/png', null, ref) : null);
    const list = arr => {
      const a = Array.isArray(arr) ? arr : [], items = [];
      a.slice(0, 12).forEach(m => {
        if (typeof m === 'string') { if (m) items.push({ name: str(m, 80), icon: null }); return; }
        if (!m || typeof m !== 'object') return;
        const name = str(m.name || m.title || m.displayName || '', 80);
        if (!name) return;
        items.push({ name, icon: ic(m.icon || m.iconUrl || m.thumbnail || m.thumbnailUrl || m.image || m.imageUrl) });
      });
      return { total: a.length, items };
    };
    r.set('Cache-Control', 'no-store').json({
      id: d.id != null ? str(d.id, 20) : '', name: str(d.name, 30), displayName: str(d.displayName, 40), description: str(d.description, 500),
      created: str(d.created, 40), banned: d.isBanned === true, verified: d.hasVerifiedBadge === true,
      friends: num(d.friends), followers: num(d.followers), followings: num(d.followings),
      avatar: ic(d.avatar), badges: list(d.badges), games: list(d.games), inventory: list(d.inventory)
    });
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Stalk Roblox terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Stalk Roblox.'); }
  finally { clearTimeout(to); }
});

/* Stalk TikTok: apiii-xrina.my.id/stalker/stalk-tiktok?username=<user>. Balasan JSON: data.{id,photo,username,name,posts,followers,following,likes,verified,private,bio}.
   Hanya profil publik. Foto disimpan sementara dengan token acak lalu dialirkan lewat /tt/<token>. */
app.post('/api/stalktt', lim, auth, async (q, r) => {
  const user = String((q.body && q.body.username) || '').trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9._]{2,24}$/.test(user)) return bad(r, 400, 'Username TikTok tidak valid (2 sampai 24 huruf, angka, titik, garis bawah).');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
  try {
    let res;
    try { res = await fetch('' + new URLSearchParams({ username: user }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; return bad(r, 502, 'Server tidak bisa menjangkau layanan Stalk TikTok (apiii-xrina.my.id).'); }
    const j = await res.json().catch(() => null), d = j && j.data;
    if (!res.ok || !d || typeof d !== 'object' || !d.username) return bad(r, 502, (j && (j.message || (typeof j.error === 'string' && j.error))) || 'Akun tidak ditemukan, cek username lalu coba lagi.');
    const str = (v, n) => String(v == null ? '' : v).slice(0, n), num = v => (typeof v === 'number' && isFinite(v) ? v : null);
    const photo = typeof d.photo === 'string' && d.photo ? ttTok(d.photo, 'image/jpeg', null, 'https://www.tiktok.com/') : null;
    r.set('Cache-Control', 'no-store').json({
      id: str(d.id, 30), username: str(d.username, 40), name: str(d.name, 80), bio: str(d.bio, 300),
      posts: num(d.posts), followers: num(d.followers), following: num(d.following), likes: num(d.likes),
      verified: d.verified === true, isPrivate: d.private === true, photo
    });
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Stalk TikTok terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Stalk TikTok.'); }
  finally { clearTimeout(to); }
});

/* Bypass SFL: apiii-xrina.my.id/tools/bypass-sfl?url=<link sfl.gl>. Balasan JSON: data.{short_url,destination_url,time}. Hanya link tujuan http(s) yang diteruskan. */
app.post('/api/bypasssfl', lim, auth, async (q, r) => {
  let raw = String((q.body && q.body.url) || '').trim().slice(0, 500);
  if (!raw) return bad(r, 400, 'Tempel link SFL dulu.');
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  let p; try { p = new URL(raw); } catch (e) { return bad(r, 400, 'Link tidak valid.'); }
  if (!/^https?:$/.test(p.protocol) || !/(^|\.)sfl\.gl$/i.test(p.hostname)) return bad(r, 400, 'Link harus dari sfl.gl.');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
  try {
    let res;
    try { res = await fetch('' + new URLSearchParams({ url: p.href }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; return bad(r, 502, 'Server tidak bisa menjangkau layanan Bypass SFL (apiii-xrina.my.id).'); }
    const j = await res.json().catch(() => null), d = j && j.data;
    if (!res.ok || !d || typeof d !== 'object') return bad(r, 502, (j && (j.message || (typeof j.error === 'string' && j.error))) || 'Layanan gagal membuka link, cek linknya lalu coba lagi.');
    let dest = ''; try { const u = new URL(String(d.destination_url || '')); if (/^https?:$/.test(u.protocol)) dest = u.href.slice(0, 2000); } catch (e) {}
    if (!dest) return bad(r, 502, 'Layanan tidak memberi link tujuan.');
    r.set('Cache-Control', 'no-store').json({ short: p.href.slice(0, 500), dest, time: String(d.time == null ? '' : d.time).slice(0, 20) });
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Bypass SFL terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Bypass SFL.'); }
  finally { clearTimeout(to); }
});

/* Cek AI Slop Gambar: apiii-xrina.my.id/tools/scan-ai-slopweb?url=<link foto>. Foto dari galeri disimpan sementara di /t/<id>.jpg (seperti tool foto lain).
   Bentuk JSON balasan belum pasti, jadi dibaca longgar: skor angka (0-1 atau 0-100), kesimpulan teks, dan semua nilai sederhana lain jadi baris rincian. */
const slHuman = k => String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-.]+/g, ' ').trim().replace(/^./, c => c.toUpperCase()).slice(0, 40);
app.post('/api/slopscan', lim, auth, async (q, r) => {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String((q.body && q.body.image) || ''));
  if (!m || m[2].length > 3000000) return bad(r, 400, 'Foto tidak valid atau terlalu besar.');
  if (TMPIMG.size > 40) return bad(r, 429, 'Server lagi sibuk, coba lagi sebentar.');
  const tid = crypto.randomBytes(12).toString('hex');
  TMPIMG.set(tid, { mime: m[1], buf: Buffer.from(m[2], 'base64') });
  setTimeout(() => TMPIMG.delete(tid), 600000).unref();
  const proto = String(q.get('x-forwarded-proto') || q.protocol).split(',')[0].trim();
  const host = String(q.get('x-forwarded-host') || q.get('host')).split(',')[0].trim();
  const base = (process.env.PUBLIC_URL || (proto + '://' + host)).replace(/\/$/, '');
  const src = base + '/t/' + tid + '.' + (m[1] === 'image/png' ? 'png' : m[1] === 'image/webp' ? 'webp' : 'jpg');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 120000);
  const fail = msg => bad(r, 502, msg || 'Layanan gagal memindai foto (cek apakah link foto bisa dibuka dari luar).');
  try {
    let res;
    try { res = await fetch('' + new URLSearchParams({ url: src }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; return bad(r, 502, 'Server tidak bisa menjangkau layanan Cek AI Slop (apiii-xrina.my.id).'); }
    const j = await res.json().catch(() => null);
    if (!res.ok || !j || typeof j !== 'object') return fail(j && (j.message || (typeof j.error === 'string' && j.error)));
    if (j.status === false) return fail(j.message || (typeof j.error === 'string' && j.error));
    const root = j.data !== undefined && j.data !== null ? j.data : j;
    const leaves = [];
    const walk = (v, key, depth) => {
      if (leaves.length >= 60 || depth > 3) return;
      if (v == null) return;
      if (Array.isArray(v)) {
        if (v.every(x => x == null || typeof x !== 'object')) { const t = v.filter(x => x != null).slice(0, 10).map(x => String(x).slice(0, 80)).join(', '); if (t) leaves.push([key, t]); }
        else v.slice(0, 5).forEach((x, i) => walk(x, key + ' ' + (i + 1), depth + 1));
        return;
      }
      if (typeof v === 'object') { Object.keys(v).slice(0, 40).forEach(k => walk(v[k], key ? key + ' ' + k : k, depth + 1)); return; }
      leaves.push([key, v]);
    };
    walk(root, '', 0);
    const clean = leaves.filter(([k, v]) => !/(^|\s)(creator|status|url|image|link)$/i.test(k) && !(typeof v === 'string' && (v.includes(tid) || /^https?:\/\//i.test(v))));
    let score = null, scoreLabel = '', verdict = '';
    for (const [k, v] of clean) {
      if (typeof v === 'number' && isFinite(v) && /((slop|ai|fake|generated|synthetic|human|real).*(score|prob|percent|confidence|chance|likelihood)|(^|\s)(score|probability|confidence|percentage|percent)$)/i.test(k)) {
        score = Math.max(0, Math.min(100, Math.round((v <= 1 ? v * 100 : v) * 10) / 10)); scoreLabel = slHuman(k); break;
      }
    }
    for (const [k, v] of clean) { if (typeof v === 'string' && v.trim() && /(verdict|label|result|conclusion|prediction|classification|summary|message|description)/i.test(k)) { verdict = v.trim().slice(0, 300); break; } }
    if (!verdict) for (const [k, v] of clean) { if (typeof v === 'boolean' && /(is\s?ai|ai\s?generated|slop)/i.test(k)) { verdict = v ? 'Terdeteksi sebagai AI / slop' : 'Tidak terdeteksi sebagai AI / slop'; break; } }
    const rows = clean.slice(0, 30).map(([k, v]) => ({ k: slHuman(k.trim()) || 'Info', v: typeof v === 'boolean' ? (v ? 'Ya' : 'Tidak') : String(v).slice(0, 300) }));
    if (score == null && !verdict && !rows.length) return fail('Layanan tidak memberi hasil yang bisa dibaca.');
    r.set('Cache-Control', 'no-store').json({ score, scoreLabel, verdict, rows });
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Cek AI Slop terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Cek AI Slop.'); }
  finally { clearTimeout(to); setTimeout(() => TMPIMG.delete(tid), 30000).unref(); }
});

/* SS Web: apiii-xrina.my.id/tools/ssweb?url=<link apa saja>. Balasan JSON: data.{desktop,tablet,mobile}.{url,type,width,height,size_pretty} atau .error.{code,message}.
   Link hasil disimpan sementara dengan token acak lalu dialirkan lewat /tt/<token> (satu token untuk preview, satu untuk unduh). */
app.post('/api/ssweb', lim, auth, async (q, r) => {
  let raw = String((q.body && q.body.url) || '').trim().slice(0, 1000);
  if (!raw) return bad(r, 400, 'Tempel link web dulu.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = 'https://' + raw;
  let p; try { p = new URL(raw); } catch (e) { return bad(r, 400, 'Link tidak valid.'); }
  if (!/^https?:$/.test(p.protocol)) return bad(r, 400, 'Link harus diawali http:// atau https://.');
  const hn = p.hostname.toLowerCase();
  if (!hn.includes('.') || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0)/.test(hn) || /^172\.(1[6-9]|2\d|3[01])\./.test(hn) || /\.(local|internal|localhost)$/.test(hn)) return bad(r, 400, 'Link harus alamat web publik (bukan localhost atau jaringan lokal).');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 120000);
  try {
    let res;
    try { res = await fetch('' + new URLSearchParams({ url: p.href }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; return bad(r, 502, 'Server tidak bisa menjangkau layanan SS Web (apiii-xrina.my.id).'); }
    const j = await res.json().catch(() => null), d = j && j.data;
    if (!res.ok || !d || typeof d !== 'object') return bad(r, 502, (j && (j.message || (typeof j.error === 'string' && j.error))) || 'Layanan gagal mengambil screenshot, coba lagi.');
    const str = (v, n) => String(v == null ? '' : v).slice(0, n), num = v => (typeof v === 'number' && isFinite(v) ? v : null), t = Date.now();
    const items = [];
    [['desktop', 'Desktop'], ['tablet', 'Tablet'], ['mobile', 'Mobile']].forEach(([key, label]) => {
      const x = d[key];
      if (!x || typeof x !== 'object') return;
      const type = /^(png|jpe?g|webp)$/i.test(String(x.type || '')) ? String(x.type).toLowerCase().replace('jpeg', 'jpg') : 'png';
      const mime = type === 'jpg' ? 'image/jpeg' : 'image/' + type;
      const img = typeof x.url === 'string' && x.url ? ttTok(x.url, mime, null, p.origin + '/') : null;
      const dl = typeof x.url === 'string' && x.url ? ttTok(x.url, mime, 'ssweb-' + key + '-' + t + '.' + type, p.origin + '/') : null;
      if (img && dl) items.push({ key, label, ok: true, img, dl, ext: type, width: num(x.width), height: num(x.height), size: str(x.size_pretty, 20) });
      else {
        const e = x.error && typeof x.error === 'object' ? x.error : {};
        const msg = e.code === 'ERATE' ? 'Batas harian layanan screenshot sudah tercapai, coba lagi besok.' : (str(e.message, 160) || 'Screenshot tidak tersedia.');
        items.push({ key, label, ok: false, error: msg });
      }
    });
    if (!items.length) return bad(r, 502, 'Layanan tidak memberi screenshot.');
    if (!items.some(i => i.ok)) return bad(r, 502, items[0].error || 'Layanan gagal mengambil screenshot, coba lagi.');
    r.set('Cache-Control', 'no-store').json({ target: p.href.slice(0, 500), items });
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'SS Web terlalu lama, coba lagi.' : 'Gagal menghubungi layanan SS Web.'); }
  finally { clearTimeout(to); }
});

/* AIO Downloader: apiii-xrina.my.id/download/aio?url=<link>. Bentuk JSON-nya bisa beragam, jadi dibaca longgar:
   semua link http(s) di dalam respon dikumpulkan sebagai media (video/audio/foto/file); cover & avatar tidak dihitung. */
const aioH = (ep, nm, hostOk, hostMsg) => async (q, r) => {
  let raw = String((q.body && q.body.url) || '').trim().slice(0, 500);
  if (!raw) return bad(r, 400, 'Tempel link dulu.');
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  let p; try { p = new URL(raw); } catch (e) { return bad(r, 400, 'Link tidak valid.'); }
  if (!/^https?:$/.test(p.protocol) || !p.hostname.includes('.')) return bad(r, 400, 'Link tidak valid.');
  if (hostOk && !hostOk(p.hostname)) return bad(r, 400, hostMsg);
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
  try {
    let res;
    try { res = await fetch(ep + '?' + new URLSearchParams({ url: p.href }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; return bad(r, 502, 'Server tidak bisa menjangkau layanan ' + nm + ' (apiii-xrina.my.id).'); }
    const j = await res.json().catch(() => null);
    if (!res.ok || !j || typeof j !== 'object') return bad(r, 502, (j && (j.message || (typeof j.error === 'string' && j.error))) || 'Layanan tidak bisa memproses link ini, cek linknya lalu coba lagi.');
    const d = j.data != null ? j.data : j.result != null ? j.result : j;
    const str = (x, n) => String(x == null ? '' : x).slice(0, n);
    const isUrl = x => typeof x === 'string' && x.length <= 2000 && /^https?:\/\/[^\s]+$/i.test(x);
    const SKIP = /^(cover|thumb|thumbnail|thumbnails|avatar|icon|poster|preview|profile|pp|origin_cover|dynamic_cover|favicon|source|original_url|webpage_url|permalink|share_url|page_url)/i;
    const GENERIC = /^(url|link|download|downloadurl|download_url|src|href|file|media|play)$/i;
    const meta = { title: '', author: '', cover: '' }, items = [], seen = new Set([raw, p.href]);
    const extOf = u => { const m = /\.([a-z0-9]{2,5})$/i.exec(u.split(/[?#]/)[0]); return m ? m[1].toLowerCase() : ''; };
    const kindOf = (u, hint) => {
      const e = extOf(u), h = String(hint || '').toLowerCase();
      if (/^(mp3|m4a|aac|opus|ogg|wav|flac)$/.test(e)) return 'audio';
      if (/^(mp4|webm|mov|mkv|m4v|3gp)$/.test(e)) return 'video';
      if (/^(jpe?g|png|webp|gif|avif|heic)$/.test(e)) return 'image';
      if (/audio|mp3|music|sound/.test(h)) return 'audio';
      if (/video|mp4|play|nowm|watermark|\bhd\b|\bsd\b/.test(h)) return 'video';
      if (/image|photo|pic|jpg|jpeg|png/.test(h)) return 'image';
      return 'file';
    };
    const walk = (o, key, depth, ctx) => {
      if (depth > 7 || o == null || items.length >= 40) return;
      if (typeof o === 'string') {
        if (!isUrl(o)) return;
        if (SKIP.test(key)) { if (!meta.cover && /^(cover|thumb|thumbnail|poster|preview)/i.test(key)) meta.cover = o; return; }
        if (seen.has(o)) return; seen.add(o);
        items.push({ url: o, key, ctx });
        return;
      }
      if (Array.isArray(o)) { o.slice(0, 60).forEach(x => walk(x, key, depth + 1, ctx)); return; }
      if (typeof o !== 'object') return;
      const bits = [];
      ['quality', 'resolution', 'label', 'format', 'size'].forEach(k => { if (typeof o[k] === 'string' || typeof o[k] === 'number') bits.push(String(o[k]).slice(0, 30)); });
      const kt = (!key || /^\d+$/.test(key) || GENERIC.test(key) || /^(data|result|results|downloads|download|medias|media|links|items|files|video|videos|audio|image|images)$/i.test(key)) ? '' : key.replace(/[_-]+/g, ' ').slice(0, 30);
      const c2 = bits.length ? bits.join(' ') : (kt || ctx);
      if (!meta.title) for (const k of ['title', 'caption', 'desc', 'description', 'text']) if (typeof o[k] === 'string' && o[k].trim() && !isUrl(o[k])) { meta.title = str(o[k].trim(), 300); break; }
      if (!meta.author) for (const k of ['author', 'user', 'owner', 'uploader', 'username', 'nickname']) {
        const a = o[k]; if (typeof a === 'string' && a.trim() && !isUrl(a)) { meta.author = str(a.trim(), 60); break; }
        if (a && typeof a === 'object' && !Array.isArray(a)) { const n = a.nickname || a.name || a.username || a.unique_id; if (typeof n === 'string' && n.trim()) { meta.author = str(n.trim(), 60); break; } }
      }
      for (const [k, x] of Object.entries(o)) walk(x, k, depth + 1, c2);
    };
    walk(d, '', 0, '');
    if (!items.length) return bad(r, 502, (j.message && typeof j.message === 'string' && j.message) || 'Layanan tidak menemukan media di link ini, cek linknya lalu coba lagi.');
    const KL = { video: 'Video', audio: 'Audio', image: 'Foto', file: 'File' }, DE = { video: 'mp4', audio: 'mp3', image: 'jpg', file: 'bin' }, DM = { video: 'video/mp4', audio: 'audio/mpeg', image: 'image/jpeg', file: 'application/octet-stream' };
    const order = { video: 0, audio: 1, image: 2, file: 3 };
    const out = items.map(it => {
      const k = kindOf(it.url, it.key), ext = extOf(it.url) || DE[k];
      const keyTxt = GENERIC.test(it.key) ? '' : it.key.replace(/[_-]+/g, ' ').slice(0, 30);
      let extra = (it.ctx || keyTxt || '').trim();
      if (extra.toLowerCase() === KL[k].toLowerCase() || extra.toLowerCase() === k) extra = '';
      return { k, ext: ext.slice(0, 5), direct: it.url, label: KL[k] + (extra ? ' · ' + extra : ''), _u: it.url };
    }).sort((a, b) => order[a.k] - order[b.k]).slice(0, 30);
    out.forEach((it, i) => { it.href = ttTok(it._u, DM[it.k], 'aio-' + (i + 1) + '-' + it.k + '.' + it.ext); delete it._u; });
    const cover = ttTok(meta.cover, 'image/jpeg', null) || (isUrl(meta.cover) ? meta.cover : null);
    r.set('Cache-Control', 'no-store').json({ title: meta.title, author: meta.author, cover, source: p.hostname.replace(/^www\./, ''), items: out });
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? nm + ' terlalu lama, coba lagi.' : 'Gagal menghubungi layanan ' + nm + '.'); }
  finally { clearTimeout(to); }
};
app.post('/api/aio', lim, auth, aioH('', 'AIO'));
/* AM Download (Alight Motion): apiii-xrina.my.id/download/am-dl?url=<link share alightcreative.com/am/share/...> */
app.post('/api/amdl', lim, auth, aioH('', 'AM Download', h => /(^|\.)alightcreative\.com$/i.test(h), 'Link harus dari alightcreative.com (link share Alight Motion).'));
/* Preset Finder: apiii-xrina.my.id/search/amfinder?url=<link video>. Memindai kolom komentar video untuk
   menemukan link preset (CapCut/Lightroom/dll) yang dibagikan orang. Foto profil & video cover/preview
   disajikan lewat /tt/<token> yang sama dengan TikTok Download (hotlink-safe). */
app.post('/api/presetfinder', lim, auth, async (q, r) => {
  let raw = String((q.body && q.body.url) || '').trim().slice(0, 500);
  if (!raw) return bad(r, 400, 'Tempel link video dulu.');
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  let p; try { p = new URL(raw); } catch (e) { return bad(r, 400, 'Link tidak valid.'); }
  if (!/^https?:$/.test(p.protocol) || !p.hostname.includes('.')) return bad(r, 400, 'Link tidak valid.');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
  try {
    let res;
    try { res = await fetch('' + new URLSearchParams({ url: p.href }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; return bad(r, 502, 'Server tidak bisa menjangkau layanan Preset Finder (apiii-xrina.my.id).'); }
    const j = await res.json().catch(() => null), d = j && j.data;
    if (!res.ok || !j || j.status === false || !d || typeof d !== 'object') return bad(r, 502, (j && (j.message || (typeof j.error === 'string' && j.error))) || 'Layanan tidak menemukan video, cek linknya lalu coba lagi.');
    const str = (v, n) => String(v == null ? '' : v).slice(0, n);
    const v = (d.video && typeof d.video === 'object') ? d.video : {}, st = (v.stats && typeof v.stats === 'object') ? v.stats : {};
    const num = (x) => Number.isFinite(x) ? x : (typeof x === 'string' && x.trim() && Number.isFinite(+x) ? +x : null);
    const links = Array.isArray(d.presetLinks) ? d.presetLinks.slice(0, 40).map(x => {
      if (typeof x === 'string') return /^https?:\/\//i.test(x) ? { title: '', url: str(x, 400) } : null;
      if (x && typeof x === 'object') { const u = x.url || x.link || x.href; return typeof u === 'string' && /^https?:\/\//i.test(u) ? { title: str(x.title || x.label || x.name, 100), url: str(u, 400) } : null; }
      return null;
    }).filter(Boolean) : [];
    r.set('Cache-Control', 'no-store').json({
      platform: str(d.platform, 40), author: str(d.author, 60), avatar: ttTok(d.avatar, 'image/jpeg', null),
      video: {
        id: str(v.id, 60), url: str(v.url, 500), title: str(v.title, 300), description: str(v.description, 500),
        cover: ttTok(v.cover, 'image/jpeg', null), play: ttTok(v.playUrl, 'video/mp4', 'preset-video-' + Date.now() + '.mp4'),
        views: num(st.views), likes: num(st.likes), comments: num(st.comments)
      },
      scanned: { comments: Number(d.scanned && d.scanned.comments) || 0, replies: Number(d.scanned && d.scanned.replies) || 0 },
      presets: links
    });
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Preset Finder terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Preset Finder.'); }
  finally { clearTimeout(to); }
});

/* HD in foto: api-cloud.my.id/tools/imglarger?url=<link foto>. Foto dari galeri disajikan sementara lewat /t/<id>.jpg.
   Hasil bisa berupa gambar langsung atau JSON berisi link gambar; keduanya ditangani. */
const findUrl = (o, d) => {
  if (d > 5 || o == null) return null;
  if (typeof o === 'string') return /^https?:\/\/\S+$/i.test(o) ? o : null;
  if (typeof o !== 'object') return null;
  for (const k of ['url', 'result', 'image', 'output', 'hd', 'link', 'data']) if (k in o) { const f = findUrl(o[k], (d || 0) + 1); if (f) return f; }
  for (const v of Object.values(o)) { const f = findUrl(v, (d || 0) + 1); if (f) return f; }
  return null;
};
const hdH = (ep, nm, pn, ex) => async (q, r) => {
  let extra = {};
  if (ex) { const e = ex(q.body || {}); if (typeof e === 'string') return bad(r, 400, e); extra = e; }
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String((q.body && q.body.image) || ''));
  if (!m || m[2].length > 3000000) return bad(r, 400, 'Foto tidak valid atau terlalu besar.');
  if (TMPIMG.size > 40) return bad(r, 429, 'Server lagi sibuk, coba lagi sebentar.');
  const tid = crypto.randomBytes(12).toString('hex');
  TMPIMG.set(tid, { mime: m[1], buf: Buffer.from(m[2], 'base64') });
  setTimeout(() => TMPIMG.delete(tid), 600000).unref();
  const proto = String(q.get('x-forwarded-proto') || q.protocol).split(',')[0].trim();
  const host = String(q.get('x-forwarded-host') || q.get('host')).split(',')[0].trim();
  const base = (process.env.PUBLIC_URL || (proto + '://' + host)).replace(/\/$/, '');
  const src = base + '/t/' + tid + '.' + (m[1] === 'image/png' ? 'png' : m[1] === 'image/webp' ? 'webp' : 'jpg');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 120000);
  const fail = () => bad(r, 502, 'Layanan ' + nm + ' gagal memproses foto (cek apakah link foto bisa dibuka dari luar).');
  try {
    const res = await fetch(ep + '?' + new URLSearchParams({ [pn || 'url']: src, ...extra }).toString(), { signal: ac.signal });
    let ct = String(res.headers.get('content-type') || ''), buf;
    if (!res.ok) return fail();
    if (ct.startsWith('image/')) buf = Buffer.from(await res.arrayBuffer());
    else {
      const j = await res.json().catch(() => null), u = findUrl(j, 0);
      if (!u) return fail();
      const r2 = await fetch(u, { signal: ac.signal });
      ct = String(r2.headers.get('content-type') || '');
      if (!r2.ok || !ct.startsWith('image/')) return fail();
      buf = Buffer.from(await r2.arrayBuffer());
    }
    if (!buf || !buf.length || buf.length > 25e6) return bad(r, 502, 'Hasil gambar tidak valid.');
    r.set({ 'Content-Type': ct.split(';')[0], 'Cache-Control': 'no-store' }).send(buf);
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? nm + ' terlalu lama, coba lagi.' : 'Gagal menghubungi layanan ' + nm + '.'); }
  finally { clearTimeout(to); setTimeout(() => TMPIMG.delete(tid), 30000).unref(); }
};
app.post('/api/hd', lim, auth, hdH('', 'HD'));
app.post('/api/removebg', lim, auth, hdH('', 'Remove BG'));
/* To Pixel: apiii-xrina.my.id/canvas/topixel?url=<link foto>&level=1-40 */
app.post('/api/topixel', lim, auth, hdH('', 'To Pixel', 'url', b => {
  const level = String(b.level == null ? '' : b.level).trim();
  if (!/^\d{1,2}$/.test(level) || +level < 1 || +level > 40) return 'Level pixel harus angka 1 sampai 40.';
  return { level };
}));
/* Call Andro: apiii-xrina.my.id/canvas/call-andro?pp=<link foto>&nama=&durasi= (durasi contoh 12.27.01) */
app.post('/api/callandro', lim, auth, hdH('', 'Call Andro', 'pp', b => {
  const nama = String(b.nama || '').trim().slice(0, 60);
  if (!nama) return 'Nama kosong.';
  const durasi = String(b.durasi || '').trim().replace(/:/g, '.');
  if (!/^\d{1,2}(\.\d{2}){1,2}$/.test(durasi)) return 'Durasi tidak valid, contoh 12.27.01';
  return { nama, durasi };
}));
/* Call iOS: apiii-xrina.my.id/canvas/call-ios?pp=<link foto>&nama=&durasi= (durasi contoh 01:01:53) */
app.post('/api/callios', lim, auth, hdH('', 'Call iOS', 'pp', b => {
  const nama = String(b.nama || '').trim().slice(0, 60);
  if (!nama) return 'Nama kosong.';
  const durasi = String(b.durasi || '').trim();
  if (!/^\d{2}(:\d{2}){1,2}$/.test(durasi)) return 'Durasi tidak valid, contoh 01:01:53';
  return { nama, durasi };
}));
/* Derydnta: apiii-xrina.my.id/canvas/derydnta?text=&template=<angka> */
app.post('/api/derydnta', lim, auth, async (q, r) => {
  const b = q.body || {};
  const text = String(b.text || '').trim().slice(0, 300);
  if (!text) return bad(r, 400, 'Teks kosong.');
  const template = parseInt(b.template, 10);
  if (!(template >= 1 && template <= 99)) return bad(r, 400, 'Template tidak valid.');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 45000);
  try {
    const res = await fetch('' + new URLSearchParams({ text, template: String(template) }).toString(), { signal: ac.signal });
    const ct = String(res.headers.get('content-type') || '');
    if (!res.ok || !ct.startsWith('image/')) return bad(r, 502, 'Layanan Derydnta gagal membuat gambar (coba template lain).');
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 8e6) return bad(r, 502, 'Hasil gambar tidak valid.');
    r.set({ 'Content-Type': ct.split(';')[0], 'Cache-Control': 'no-store' }).send(buf);
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Derydnta terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Derydnta.'); }
  finally { clearTimeout(to); }
});
/* Fake Ch: apiii-xrina.my.id/canvas/fakech?pp=<link foto>&nama=&pengikut=&jam= (pengikut contoh 10.929, jam contoh 00.21) */
app.post('/api/fakech', lim, auth, hdH('', 'Fake Ch', 'pp', b => {
  const nama = String(b.nama || '').trim().slice(0, 60);
  if (!nama) return 'Nama kosong.';
  const pengikut = String(b.pengikut || '').trim();
  if (!/^[\d.,]{1,12}$/.test(pengikut) || !/\d/.test(pengikut)) return 'Jumlah pengikut tidak valid, contoh 10.929';
  let jam = String(b.jam || '').trim().replace(':', '.');
  if (!/^\d{1,2}\.\d{2}$/.test(jam)) { const d = new Date(); jam = String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0'); }
  return { nama, pengikut, jam };
}));
/* Fake Dana: apiii-xrina.my.id/canvas/fakedana?nominal= (contoh 10.382.938) */
app.post('/api/fakedana', lim, auth, async (q, r) => {
  const nominal = String((q.body && q.body.nominal) || '').trim();
  if (!/^[\d.,]{1,20}$/.test(nominal) || !/\d/.test(nominal)) return bad(r, 400, 'Nominal tidak valid, contoh 10.382.938');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 45000);
  try {
    const res = await fetch('' + new URLSearchParams({ nominal }).toString(), { signal: ac.signal });
    const ct = String(res.headers.get('content-type') || '');
    if (!res.ok || !ct.startsWith('image/')) return bad(r, 502, 'Layanan Fake Dana gagal membuat gambar.');
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 8e6) return bad(r, 502, 'Hasil gambar tidak valid.');
    r.set({ 'Content-Type': ct.split(';')[0], 'Cache-Control': 'no-store' }).send(buf);
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Fake Dana terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Fake Dana.'); }
  finally { clearTimeout(to); }
});
/* Fake Dev: apiii-xrina.my.id/canvas/fakedev?name=&avatar=<link foto> */
app.post('/api/fakedev', lim, auth, hdH('', 'Fake Dev', 'avatar', b => {
  const name = String(b.name || '').trim().slice(0, 60);
  if (!name) return 'Nama kosong.';
  return { name };
}));
/* Fake FF Duo: apiii-xrina.my.id/canvas/fakeffduo?name1=&name2= */
app.post('/api/fakeffduo', lim, auth, async (q, r) => {
  const b = q.body || {};
  const name1 = String(b.name1 || '').trim().slice(0, 40), name2 = String(b.name2 || '').trim().slice(0, 40);
  if (!name1 || !name2) return bad(r, 400, 'Nama pemain 1 dan 2 harus diisi.');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 45000);
  try {
    const res = await fetch('' + new URLSearchParams({ name1, name2 }).toString(), { signal: ac.signal });
    const ct = String(res.headers.get('content-type') || '');
    if (!res.ok || !ct.startsWith('image/')) return bad(r, 502, 'Layanan Fake FF Duo gagal membuat gambar.');
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 8e6) return bad(r, 502, 'Hasil gambar tidak valid.');
    r.set({ 'Content-Type': ct.split(';')[0], 'Cache-Control': 'no-store' }).send(buf);
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Fake FF Duo terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Fake FF Duo.'); }
  finally { clearTimeout(to); }
});
/* Fake GC: apiii-xrina.my.id/canvas/fakegc?pp=<link foto>&nama=&anggota= (anggota contoh 1.938) */
app.post('/api/fakegc', lim, auth, hdH('', 'Fake GC', 'pp', b => {
  const nama = String(b.nama || '').trim().slice(0, 60);
  if (!nama) return 'Nama grup kosong.';
  const anggota = String(b.anggota || '').trim();
  if (!/^[\d.,]{1,12}$/.test(anggota) || !/\d/.test(anggota)) return 'Jumlah anggota tidak valid, contoh 1.938';
  return { nama, anggota };
}));
/* Fake ML: apiii-xrina.my.id/canvas/fakeml?avatar=<link foto>&username=&rank=imo&border=12 */
app.post('/api/fakeml', lim, auth, hdH('', 'Fake ML', 'avatar', b => {
  const username = String(b.username || '').trim().slice(0, 40);
  if (!username) return 'Username kosong.';
  const rank = String(b.rank || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,20}$/.test(rank)) return 'Rank tidak valid, contoh imo.';
  const border = String(b.border || '').trim();
  if (!/^\d{1,2}$/.test(border) || +border < 1 || +border > 30) return 'Border harus angka 1 sampai 30.';
  return { username, rank, border };
}));
/* Quote TT DM: apiii-xrina.my.id/canvas/ttdm?url=<link foto>&username=&text= */
app.post('/api/ttdm', lim, auth, hdH('', 'Quote TT DM', 'url', b => {
  const username = String(b.username || '').trim().slice(0, 40);
  if (!username) return 'Username kosong.';
  const text = String(b.text || '').trim().slice(0, 200);
  if (!text) return 'Teks kosong.';
  return { username, text };
}));
/* TT QC: apiii-xrina.my.id/canvas/ttqc?name=&text=&avatar=<link foto> */
app.post('/api/ttqc', lim, auth, hdH('', 'TT QC', 'avatar', b => {
  const name = String(b.name || '').trim().slice(0, 40);
  if (!name) return 'Nama kosong.';
  const text = String(b.text || '').trim().slice(0, 200);
  if (!text) return 'Teks kosong.';
  return { name, text };
}));
/* Windows: apiii-xrina.my.id/canvas/windows?text= */
app.post('/api/windows', lim, auth, async (q, r) => {
  const text = String((q.body && q.body.text) || '').trim().slice(0, 200);
  if (!text) return bad(r, 400, 'Teks kosong.');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 45000);
  try {
    const res = await fetch('' + new URLSearchParams({ text }).toString(), { signal: ac.signal });
    const ct = String(res.headers.get('content-type') || '');
    if (!res.ok || !ct.startsWith('image/')) return bad(r, 502, 'Layanan Windows gagal membuat gambar.');
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 8e6) return bad(r, 502, 'Hasil gambar tidak valid.');
    r.set({ 'Content-Type': ct.split(';')[0], 'Cache-Control': 'no-store' }).send(buf);
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Windows terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Windows.'); }
  finally { clearTimeout(to); }
});
/* Brat: apiii-xrina.my.id/maker/brat?text= (balasan langsung berupa gambar) */
app.post('/api/brat', lim, auth, async (q, r) => {
  const text = String((q.body && q.body.text) || '').trim().slice(0, 200);
  if (!text) return bad(r, 400, 'Teks kosong.');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 45000);
  try {
    const res = await fetch('' + new URLSearchParams({ text }).toString(), { signal: ac.signal });
    const ct = String(res.headers.get('content-type') || '');
    if (!res.ok || !ct.startsWith('image/')) return bad(r, 502, 'Layanan Brat gagal membuat gambar.');
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 8e6) return bad(r, 502, 'Hasil gambar tidak valid.');
    r.set({ 'Content-Type': ct.split(';')[0], 'Cache-Control': 'no-store' }).send(buf);
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Brat terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Brat.'); }
  finally { clearTimeout(to); }
});
/* Meledak: apiii-xrina.my.id/canvas/meledak?image=<link foto> */
app.post('/api/meledak', lim, auth, hdH('', 'Meledak', 'image'));
/* Meme Polisi: apiii-xrina.my.id/canvas/meme-polisi?username=&text= */
app.post('/api/memepolisi', lim, auth, async (q, r) => {
  const b = q.body || {};
  const username = String(b.username || '').trim().slice(0, 40), text = String(b.text || '').trim().slice(0, 300);
  if (!username) return bad(r, 400, 'Username kosong.');
  if (!text) return bad(r, 400, 'Teks kosong.');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 45000);
  try {
    const res = await fetch('' + new URLSearchParams({ username, text }).toString(), { signal: ac.signal });
    const ct = String(res.headers.get('content-type') || '');
    if (!res.ok || !ct.startsWith('image/')) return bad(r, 502, 'Layanan Meme Polisi gagal membuat gambar.');
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 8e6) return bad(r, 502, 'Hasil gambar tidak valid.');
    r.set({ 'Content-Type': ct.split(';')[0], 'Cache-Control': 'no-store' }).send(buf);
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Meme Polisi terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Meme Polisi.'); }
  finally { clearTimeout(to); }
});
/* Nokia: apiii-xrina.my.id/canvas/nokia?message=&sender=&date=08/21/26&time=00.00 (tanggal BB/HH/TT, jam 00.00) */
app.post('/api/nokia', lim, auth, async (q, r) => {
  const b = q.body || {};
  const message = String(b.message || '').trim().slice(0, 300), sender = String(b.sender || '').trim().slice(0, 40);
  if (!message) return bad(r, 400, 'Pesan kosong.');
  if (!sender) return bad(r, 400, 'Nama pengirim kosong.');
  const d = new Date(), p = n => String(n).padStart(2, '0');
  let date = String(b.date || '').trim();
  if (!date) date = p(d.getMonth() + 1) + '/' + p(d.getDate()) + '/' + p(d.getFullYear() % 100);
  if (!/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(date)) return bad(r, 400, 'Tanggal tidak valid, contoh 08/21/26.');
  let time = String(b.time || '').trim().replace(':', '.');
  if (!/^\d{1,2}\.\d{2}$/.test(time)) time = p(d.getHours()) + '.' + p(d.getMinutes());
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 45000);
  try {
    const res = await fetch('' + new URLSearchParams({ message, sender, date, time }).toString(), { signal: ac.signal });
    const ct = String(res.headers.get('content-type') || '');
    if (!res.ok || !ct.startsWith('image/')) return bad(r, 502, 'Layanan Nokia gagal membuat gambar.');
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 8e6) return bad(r, 502, 'Hasil gambar tidak valid.');
    r.set({ 'Content-Type': ct.split(';')[0], 'Cache-Control': 'no-store' }).send(buf);
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Nokia terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Nokia.'); }
  finally { clearTimeout(to); }
});
/* Quotes: apiii-xrina.my.id/canvas/quotes?text=&name= (kata yang disorot ditulis dalam [ ], contoh: iya [zyrex] gacor) */
app.post('/api/quotes', lim, auth, async (q, r) => {
  const b = q.body || {};
  const text = String(b.text || '').trim().slice(0, 300), name = String(b.name || '').trim().slice(0, 40);
  if (!text) return bad(r, 400, 'Teks kosong.');
  if (!name) return bad(r, 400, 'Nama kosong.');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 45000);
  try {
    const res = await fetch('' + new URLSearchParams({ text, name }).toString(), { signal: ac.signal });
    const ct = String(res.headers.get('content-type') || '');
    if (!res.ok || !ct.startsWith('image/')) return bad(r, 502, 'Layanan Quotes gagal membuat gambar.');
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 8e6) return bad(r, 502, 'Hasil gambar tidak valid.');
    r.set({ 'Content-Type': ct.split(';')[0], 'Cache-Control': 'no-store' }).send(buf);
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Quotes terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Quotes.'); }
  finally { clearTimeout(to); }
});
/* Template QRIS: apiii-xrina.my.id/canvas/template-qris?url=<link foto QRIS>&template=<1-3> */
app.post('/api/templateqris', lim, auth, hdH('', 'Template QRIS', 'url', b => {
  const template = parseInt(b.template, 10);
  if (!(template >= 1 && template <= 3)) return 'Template harus 1 sampai 3.';
  return { template: String(template) };
}));
/* Afinitas ML: apiii-xrina.my.id/canvas/afinitasml?image=<link foto> */
app.post('/api/afinitasml', lim, auth, hdH('', 'Afinitas ML', 'image'));

/* Cek Phising: apiii-xrina.my.id/tools/cekphising?url=<link>. Balasan JSON: data.{aman,kesimpulan,deskripsi,phishing,malware,situs_berbahaya,software_jahat,terakhir_dicek} */
app.post('/api/cekphising', lim, auth, async (q, r) => {
  let raw = String((q.body && q.body.url) || '').trim().slice(0, 500);
  if (!raw) return bad(r, 400, 'Masukkan link website dulu.');
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  let p; try { p = new URL(raw); } catch (e) { return bad(r, 400, 'Link website tidak valid.'); }
  if (!/^https?:$/.test(p.protocol) || !p.hostname.includes('.')) return bad(r, 400, 'Link website tidak valid.');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 45000);
  try {
    let res;
    try { res = await fetch('' + new URLSearchParams({ url: p.href }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; return bad(r, 502, 'Server tidak bisa menjangkau layanan Cek Phising (apiii-xrina.my.id).'); }
    const j = await res.json().catch(() => null), d = j && j.data;
    if (!res.ok || !d || typeof d !== 'object' || typeof d.aman !== 'boolean') return bad(r, 502, (j && (j.message || (typeof j.error === 'string' && j.error))) || 'Layanan Cek Phising tidak memberi hasil yang valid, coba lagi nanti.');
    const str = (v, n) => String(v == null ? '' : v).slice(0, n);
    r.set('Cache-Control', 'no-store').json({
      url: str(d.url || p.href, 500), aman: d.aman, kesimpulan: str(d.kesimpulan, 80), deskripsi: str(d.deskripsi, 300),
      phishing: !!d.phishing, malware: !!d.malware, situs_berbahaya: !!d.situs_berbahaya, software_jahat: !!d.software_jahat, terakhir_dicek: str(d.terakhir_dicek, 40)
    });
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Cek Phising terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Cek Phising.'); }
  finally { clearTimeout(to); }
});

/* Kuota tools berbayar-role: per hari (zona WIB), terpisah untuk tiap tool. Pengguna 3x, VIP 20x, Owner & Developer tanpa batas.
   Kuota hanya terpakai kalau berhasil; kalau gagal dikembalikan. Disimpan di users[k].quota = { rch:{d,n}, amp:{d,n} }. */
const Q_LIMIT = { user: 3, vip: 20 };
const qDay = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const Q_CAP = { cap: { user: 1, vip: 10, owner: 25 }, vote: { user: 3, vip: 15, owner: 67, adminUnl: true }, ambulk: { user: 3, vip: 20, owner: 100, adminUnl: true }, spamotp: { user: 0, vip: 5, owner: 10, partner: 25, adminUnl: true } };   // tool dengan batas sendiri. Developer selalu tanpa batas; Admin tanpa batas hanya bila adminUnl. spamotp: VIP 5, Owner 10, Partner 25, TK/Dev/Admin unlimited
/* Bonus kuota harian dari kode redeem: u.bonus[tool] = [{n, exp}], exp 0 = permanen */
const bonusOf = (u, k) => { const a = u && u.bonus && u.bonus[k]; if (!Array.isArray(a)) return 0; const now = Date.now(); return a.reduce((t, x) => t + (x && (!x.exp || x.exp > now) ? (x.n | 0) : 0), 0); };
const qInfo = (u, k) => {
  const isDev = !!u.dev || u.role === 'tk', isAdm = u.role === 'admin', er = effRole(u.role), isOwn = er === 'owner', cap = Q_CAP[k];
  const unlimited = cap ? (isDev || (!!cap.adminUnl && isAdm)) : (isDev || isOwn || isAdm);
  let limit0;
  if (unlimited) limit0 = null;
  else if (cap) {
    if (u.role === 'partner' && cap.partner != null) limit0 = cap.partner;
    else if (isOwn || isAdm) limit0 = cap.owner;
    else limit0 = (cap[er] != null ? cap[er] : cap.user);
  } else limit0 = (Q_LIMIT[er] || Q_LIMIT.user);
  const limit = limit0 == null ? null : limit0 + bonusOf(u, k);
  const c = (u.quota && u.quota[k]) || (k === 'rch' ? u.rch : null), used = c && c.d === qDay() ? (c.n || 0) : 0;   // u.rch = penyimpanan versi lama
  return { unlimited, limit, used, left: unlimited ? null : Math.max(0, limit - used) };
};
/* Potong dulu supaya tidak bisa ditembus paralel. Balikannya: null kalau kuota habis, atau { inf, refund }. */
const qTake = (u, k) => {
  const inf = qInfo(u, k), day = qDay();
  if (!inf.unlimited && inf.left <= 0) return null;
  if (!inf.unlimited) { u.quota = u.quota || {}; u.quota[k] = { d: day, n: inf.used + 1 }; save(); }
  const refund = () => { const c = u.quota && u.quota[k]; if (!inf.unlimited && c && c.d === day && c.n > 0) { c.n--; save(); } };
  return { inf, refund };
};
const qFull = (inf) => 'Kuota hari ini habis (' + inf.limit + 'x per hari). Reset tiap tengah malam WIB.';
const rchInfo = (u) => qInfo(u, 'rch'), ampInfo = (u) => qInfo(u, 'amp');
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
/* Balasan API pihak ketiga dibaca longgar: gagal kalau HTTP error, status/success/ok === false, atau ada field error berupa teks. */
const apiFailed = (res, j) => !res.ok || !!(j && (j.status === false || j.success === false || j.ok === false || (j.error && typeof j.error === 'string')));
const apiNote = (j) => j ? clip(typeof j.message === 'string' ? j.message : (typeof j.result === 'string' ? j.result : (j.data && typeof j.data.message === 'string' ? j.data.message : '')), 300) : '';

const rchSeg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;
const RCH_MAX = Math.min(100, Math.max(1, parseInt(process.env.RCH_MAX_EMOJI, 10) || 30));   // batas emoji per kirim (ubah lewat env RCH_MAX_EMOJI)
const rchEmojis = (raw) => {
  const txt = String(raw || '').slice(0, 800), out = [];
  const parts = rchSeg ? Array.from(rchSeg.segment(txt), x => x.segment) : (txt.match(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu) || []);
  for (const g of parts) if (/\p{Extended_Pictographic}/u.test(g) && !out.includes(g)) out.push(g);
  return out.slice(0, RCH_MAX);
};
/* Kunci api.izzxd.my.id (dipakai RCH & CapCut Pro), hanya di server; bisa diganti lewat env IZZXD_API_KEY / CAPCUT_API_KEY. */
const IZZ_KEY = process.env.IZZXD_API_KEY || process.env.CAPCUT_API_KEY || '';
app.post('/api/rch/info', auth, (q, r) => r.set('Cache-Control', 'no-store').json(rchInfo(q.u)));
/* RCH (reaksi saluran WhatsApp): api-cloud.my.id/tools/rchv2?link=<link postingan>&emoji=<emoji dipisah koma> */
app.post('/api/rch', lim, auth, async (q, r) => {
  const link = String((q.body && q.body.link) || '').trim().slice(0, 300);
  const m = link.match(/^https?:\/\/(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]+)\/(\d+)\/?(?:\?.*)?$/i);
  if (!m) return bad(r, 400, 'Link tidak valid. Pakai link postingan saluran, contoh: https://whatsapp.com/channel/xxxx/123');
  const emojis = rchEmojis(q.body && q.body.emoji);
  if (!emojis.length) return bad(r, 400, 'Isi minimal 1 emoji (pisahkan dengan koma, maksimal ' + RCH_MAX + ').');
  const t = qTake(q.u, 'rch'); if (!t) return bad(r, 429, 'Kuota RCH ' + qFull(qInfo(q.u, 'rch')).replace(/^Kuota /, ''));
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
  try {
    let res;
    try { res = await fetch('' + new URLSearchParams({ url: 'https://whatsapp.com/channel/' + m[1] + '/' + m[2], reaction: emojis.join(', '), apikey: IZZ_KEY }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; t.refund(); return bad(r, 502, 'Server tidak bisa menjangkau layanan RCH (api.izzxd.my.id).'); }
    const txt = await res.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
    if (apiFailed(res, j)) { t.refund(); return bad(r, 502, clip((j && (j.message || j.error || j.msg)) || 'Layanan RCH gagal memproses, coba lagi nanti.', 200).split(IZZ_KEY).join('***')); }
    r.set('Cache-Control', 'no-store').json({ ok: 1, emojis, note: apiNote(j).split(IZZ_KEY).join('***'), ...rchInfo(q.u) });
  } catch (e) { t.refund(); bad(r, 504, e.name === 'AbortError' ? 'RCH terlalu lama, coba lagi.' : 'Gagal menghubungi layanan RCH.'); }
  finally { clearTimeout(to); }
});


/* CapCut Pro: api.izzxd.my.id/api/tools/capcut-pro?referral=<kode>&apikey=<key>. Kuota per hari: Pengguna 1x, VIP 10x, Owner 25x (kunci 'cap').
   Referral & apikey hanya ada di server (bisa diganti lewat env CAPCUT_REFERRAL / CAPCUT_API_KEY), tidak pernah dikirim ke browser. */
const CAP_REF = process.env.CAPCUT_REFERRAL || '', CAP_KEY = IZZ_KEY;
app.post('/api/capcut/info', auth, (q, r) => r.set('Cache-Control', 'no-store').json(qInfo(q.u, 'cap')));
app.post('/api/capcut', lim, auth, async (q, r) => {
  const t = qTake(q.u, 'cap'); if (!t) return bad(r, 429, 'Kuota CapCut Pro ' + qFull(qInfo(q.u, 'cap')).replace(/^Kuota /, ''));
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 90000);
  try {
    let res;
    try { res = await fetch('' + new URLSearchParams({ referral: CAP_REF, apikey: CAP_KEY }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; t.refund(); return bad(r, 502, 'Server tidak bisa menjangkau layanan CapCut Pro (api.izzxd.my.id).'); }
    const txt = await res.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
    if (apiFailed(res, j)) { t.refund(); return bad(r, 502, clip((j && (j.message || j.error || j.msg)) || 'Layanan CapCut Pro gagal memproses, coba lagi nanti.', 200).split(CAP_KEY).join('***')); }
    const src = j && (j.result != null ? j.result : j.data != null ? j.data : j);
    const details = [];
    const walk = (o, pre, d) => {
      if (o == null || d > 3 || details.length >= 14) return;
      if (typeof o === 'object') { for (const k of Object.keys(o)) { if (/api.?key|secret|referral/i.test(k)) continue; walk(o[k], pre ? pre + ' ' + k : k, d + 1); } return; }
      if (!['string', 'number', 'boolean'].includes(typeof o)) return;
      const v = clip(o, 400).split(CAP_KEY).join('***'); if (!v || /^(true|false)$/i.test(v) && /^(status|success|ok)$/i.test(pre)) return;
      if (/^(status|success|ok|code|creator|author)$/i.test(pre)) return;
      details.push([clip(pre || 'Hasil', 40), v]);
    };
    walk(src, '', 0);
    if (!details.length && !apiNote(j)) { t.refund(); return bad(r, 502, 'Layanan CapCut Pro tidak memberi hasil, coba lagi nanti.'); }
    r.set('Cache-Control', 'no-store').json({ ok: 1, note: apiNote(j).split(CAP_KEY).join('***'), details, ...qInfo(q.u, 'cap') });
  } catch (e) { t.refund(); bad(r, 504, e.name === 'AbortError' ? 'CapCut Pro terlalu lama, coba lagi.' : 'Gagal menghubungi layanan CapCut Pro.'); }
  finally { clearTimeout(to); }
});


/* Vote Polling saluran WhatsApp: api.izzxd.my.id/api/whatsapp/votech?url=<link postingan>&option=<nomor pilihan>&apikey=<key>. Kuota 'vote': free 3x, VIP 15x, Owner 67x, Admin & Developer tanpa batas. */
app.post('/api/vote/info', auth, (q, r) => r.set('Cache-Control', 'no-store').json(qInfo(q.u, 'vote')));
app.post('/api/vote', lim, auth, async (q, r) => {
  const link = String((q.body && q.body.link) || '').trim().slice(0, 300);
  const m = link.match(/^https?:\/\/(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]+)\/(\d+)\/?(?:\?.*)?$/i);
  if (!m) return bad(r, 400, 'Link tidak valid. Pakai link postingan polling saluran, contoh: https://whatsapp.com/channel/xxxx/123');
  const opt = parseInt(q.body && q.body.option, 10);
  if (!(opt >= 1 && opt <= 20)) return bad(r, 400, 'Nomor pilihan harus angka 1 sampai 20.');
  const t = qTake(q.u, 'vote'); if (!t) return bad(r, 429, 'Kuota Vote Polling ' + qFull(qInfo(q.u, 'vote')).replace(/^Kuota /, ''));
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
  try {
    let res;
    try { res = await fetch('' + new URLSearchParams({ url: 'https://whatsapp.com/channel/' + m[1] + '/' + m[2], option: String(opt), apikey: IZZ_KEY }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; t.refund(); return bad(r, 502, 'Server tidak bisa menjangkau layanan Vote Polling (api.izzxd.my.id).'); }
    const txt = await res.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
    if (apiFailed(res, j)) { t.refund(); return bad(r, 502, clip((j && (j.message || j.error || j.msg)) || 'Layanan Vote Polling gagal memproses, coba lagi nanti.', 200).split(IZZ_KEY).join('***')); }
    const details = [], src = j && (j.result != null ? j.result : j.data != null ? j.data : null);
    const walk = (o, pre, d) => {
      if (o == null || d > 3 || details.length >= 10) return;
      if (typeof o === 'object') { for (const k of Object.keys(o)) { if (/api.?key|secret/i.test(k)) continue; walk(o[k], pre ? pre + ' ' + k : k, d + 1); } return; }
      if (!['string', 'number'].includes(typeof o) || /^(status|code|creator|author)$/i.test(pre)) return;
      const v = clip(o, 300).split(IZZ_KEY).join('***'); if (v) details.push([clip(pre || 'Hasil', 40), v]);
    };
    walk(src, '', 0);
    r.set('Cache-Control', 'no-store').json({ ok: 1, option: opt, note: apiNote(j).split(IZZ_KEY).join('***'), details, ...qInfo(q.u, 'vote') });
  } catch (e) { t.refund(); bad(r, 504, e.name === 'AbortError' ? 'Vote Polling terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Vote Polling.'); }
  finally { clearTimeout(to); }
});

/* Add Pengikut Saluran: api.izzxd.my.id/api/whatsapp/follch?url=<link saluran>&apikey=<key>. KHUSUS Owner, Admin & Developer (VIP/Pengguna biasa ditolak di server), tanpa kuota. */

/* Spam OTP: api.izzxd.my.id/api/tools/sp4motp?nomor=<hp>&jumlah=<n>&apikey=<key>.
   Kuota 'spamotp' per hari: user 0, VIP 5, Owner 10, Partner 25, TK / Developer / Admin unlimited.
   nomor = 08… atau 62…, jumlah 1–100. Kuota hanya terpakai kalau request sukses. */
app.post('/api/spamotp/info', auth, (q, r) => r.set('Cache-Control', 'no-store').json(qInfo(q.u, 'spamotp')));
app.post('/api/spamotp', lim, auth, async (q, r) => {
  const nomor = String((q.body && q.body.nomor) || '').replace(/\D/g, '').slice(0, 16);
  if (!/^(0|62)\d{8,14}$/.test(nomor)) return bad(r, 400, 'Nomor tidak valid. Pakai format 08xxxxxxxxxx atau 62xxxxxxxxxx.');
  let jumlah = parseInt(q.body && q.body.jumlah, 10);
  if (!(jumlah >= 1 && jumlah <= 100)) jumlah = 10;
  const t = qTake(q.u, 'spamotp');
  if (!t) return bad(r, 429, 'Kuota Spam OTP ' + qFull(qInfo(q.u, 'spamotp')).replace(/^Kuota /, ''));
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 90000);
  try {
    let res;
    try {
      res = await fetch('' + new URLSearchParams({
        nomor, jumlah: String(jumlah), apikey: IZZ_KEY
      }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      t.refund();
      return bad(r, 502, 'Server tidak bisa menjangkau layanan Spam OTP (api.izzxd.my.id).');
    }
    const txt = await res.text();
    let j = null;
    try { j = JSON.parse(txt); } catch (e) {}
    if (apiFailed(res, j)) {
      t.refund();
      return bad(r, 502, clip((j && (j.message || j.error || j.msg)) || 'Layanan Spam OTP gagal memproses, coba lagi nanti.', 200).split(IZZ_KEY).join('***'));
    }
    const details = [], src = j && (j.result != null ? j.result : j.data != null ? j.data : j);
    const walk = (o, pre, d) => {
      if (o == null || d > 3 || details.length >= 12) return;
      if (typeof o === 'object') {
        for (const k of Object.keys(o)) {
          if (/api.?key|secret|apikey/i.test(k)) continue;
          walk(o[k], pre ? pre + ' ' + k : k, d + 1);
        }
        return;
      }
      if (!['string', 'number', 'boolean'].includes(typeof o) || /^(status|code|creator|author)$/i.test(pre)) return;
      const v = clip(o, 300).split(IZZ_KEY).join('***');
      if (v !== '') details.push([clip(pre || 'Hasil', 40), v]);
    };
    walk(src, '', 0);
    r.set('Cache-Control', 'no-store').json({
      ok: 1,
      nomor,
      jumlah,
      note: apiNote(j).split(IZZ_KEY).join('***'),
      details,
      ...qInfo(q.u, 'spamotp')
    });
  } catch (e) {
    t.refund();
    bad(r, 504, e.name === 'AbortError' ? 'Spam OTP terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Spam OTP.');
  } finally { clearTimeout(to); }
});

const canFol = (u) => !!(u && (u.dev || u.role === 'admin' || effRole(u.role) === 'owner'));
const folDeny = (r) => bad(r, 403, 'Tool ini khusus Owner, Developer & Admin. VIP dan Pengguna tidak bisa memakainya.');
app.post('/api/follch/info', auth, (q, r) => r.set('Cache-Control', 'no-store').json({ allowed: canFol(q.u) }));
app.post('/api/follch', lim, auth, async (q, r) => {
  if (!canFol(q.u)) return folDeny(r);
  const link = String((q.body && q.body.link) || '').trim().slice(0, 300);
  const m = link.match(/^https?:\/\/(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]+)\/?(?:\?.*)?$/i);
  if (!m) return bad(r, 400, 'Link tidak valid. Pakai link saluran, contoh: https://whatsapp.com/channel/xxxx');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
  try {
    let res;
    try { res = await fetch('' + new URLSearchParams({ url: 'https://whatsapp.com/channel/' + m[1], apikey: IZZ_KEY }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; return bad(r, 502, 'Server tidak bisa menjangkau layanan Add Pengikut (api.izzxd.my.id).'); }
    const txt = await res.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
    if (apiFailed(res, j)) return bad(r, 502, clip((j && (j.message || j.error || j.msg)) || 'Layanan Add Pengikut gagal memproses, coba lagi nanti.', 200).split(IZZ_KEY).join('***'));
    const details = [], src = j && (j.result != null ? j.result : j.data != null ? j.data : null);
    const walk = (o, pre, d) => {
      if (o == null || d > 3 || details.length >= 10) return;
      if (typeof o === 'object') { for (const k of Object.keys(o)) { if (/api.?key|secret/i.test(k)) continue; walk(o[k], pre ? pre + ' ' + k : k, d + 1); } return; }
      if (!['string', 'number'].includes(typeof o) || /^(status|code|creator|author)$/i.test(pre)) return;
      const v = clip(o, 300).split(IZZ_KEY).join('***'); if (v) details.push([clip(pre || 'Hasil', 40), v]);
    };
    walk(src, '', 0);
    r.set('Cache-Control', 'no-store').json({ ok: 1, note: apiNote(j).split(IZZ_KEY).join('***'), details });
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Add Pengikut terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Add Pengikut.'); }
  finally { clearTimeout(to); }
});

/* ---------- Kode Redeem: dibuat Developer di Panel Admin, ditukar user lewat menu "Redeem Code" ----------
   Jenis: 'role' (VIP/Owner, N hari, 0 = permanen) atau 'quota' (tambahan kuota harian satu tool, N hari, 0 = permanen).
   Batas: jumlah pemakai (maxUses, 0 = tanpa batas) dan waktu kedaluwarsa kode (expiresAt, 0 = tanpa batas). Satu akun hanya bisa memakai satu kode sekali. */
const FRD = path.join(DATA, 'redeem.json');
const codes = load(FRD, {});
const saveCodes = () => { try { fs.writeFileSync(FRD, JSON.stringify(codes)); } catch (e) {} };
const RD_TOOLS = { rch: 'RCH', amp: 'AM Prem', cap: 'CapCut Pro', vote: 'Vote Polling', ambulk: 'AM Bulk' };
const RD_ROLE = { vip: 'VIP', owner: 'Owner' };
const rdNorm = (v) => String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
const rdGen = () => { const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', b = crypto.randomBytes(10); let t = ''; for (const x of b) t += a[x % a.length]; return 'YD-' + t.slice(0, 5) + '-' + t.slice(5); };
const rdState = (c) => c.active === false ? 'off' : (c.expiresAt && Date.now() > c.expiresAt) ? 'expired' : (c.maxUses > 0 && c.uses >= c.maxUses) ? 'full' : 'live';
const rdOut = (c) => ({ code: c.code, type: c.type, role: c.role || '', tool: c.tool || '', amount: c.amount || 0, days: c.days || 0, maxUses: c.maxUses || 0, uses: c.uses || 0,
  expiresAt: c.expiresAt || 0, created: c.created || 0, state: rdState(c), usedBy: (c.usedBy || []).map(k => (users[k] && users[k].name) || k) });
const rdInt = (v, lo, hi, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
app.post('/api/admin/redeem/list', auth, admin, (q, r) => r.set('Cache-Control', 'no-store').json({ codes: Object.values(codes).sort((a, b) => (b.created || 0) - (a.created || 0)).map(rdOut), tools: RD_TOOLS }));
app.post('/api/admin/redeem/create', auth, admin, (q, r) => {
  const b = q.body || {}, type = b.type === 'quota' ? 'quota' : 'role';
  if (Object.keys(codes).length >= 3000) return bad(r, 400, 'Terlalu banyak kode, hapus yang lama dulu.');
  const c = { type, created: Date.now(), uses: 0, usedBy: [], active: true };
  if (type === 'role') {
    if (!RD_ROLE[b.role]) return bad(r, 400, 'Role harus VIP atau Owner.');
    c.role = b.role; c.days = rdInt(b.days, 0, 3650, -1);
    if (c.days < 0) return bad(r, 400, 'Durasi role 0 (permanen) sampai 3650 hari.');
  } else {
    if (!RD_TOOLS[b.tool]) return bad(r, 400, 'Pilih tool yang valid.');
    c.tool = b.tool; c.amount = rdInt(b.amount, 1, 1000, 0); c.days = rdInt(b.days, 0, 3650, -1);
    if (!c.amount) return bad(r, 400, 'Tambahan kuota 1 sampai 1000 per hari.');
    if (c.days < 0) return bad(r, 400, 'Durasi bonus 0 (permanen) sampai 3650 hari.');
  }
  c.maxUses = rdInt(b.maxUses, 0, 100000, -1);
  if (c.maxUses < 0) return bad(r, 400, 'Jumlah pemakai 0 (tanpa batas) sampai 100000.');
  const ex = Number(b.expiresAt) || 0;
  if (ex && (ex <= Date.now() || ex > Date.now() + 3650 * 864e5)) return bad(r, 400, 'Waktu kedaluwarsa kode harus di masa depan.');
  c.expiresAt = ex;
  let code = rdNorm(b.code);
  if (code) { if (code.length < 4) return bad(r, 400, 'Kode minimal 4 karakter (huruf/angka/-/_).'); if (codes[code]) return bad(r, 409, 'Kode itu sudah ada.'); }
  else { do { code = rdGen(); } while (codes[code]); }
  c.code = code; codes[code] = c; saveCodes();
  r.json({ ok: 1, code: rdOut(c) });
});
app.post('/api/admin/redeem/toggle', auth, admin, (q, r) => {
  const c = codes[rdNorm(q.body && q.body.code)]; if (!c) return bad(r, 404, 'Kode tidak ada.');
  c.active = c.active === false; saveCodes(); r.json({ ok: 1, code: rdOut(c) });
});
app.post('/api/admin/redeem/delete', auth, admin, (q, r) => {
  const k = rdNorm(q.body && q.body.code); if (!codes[k]) return bad(r, 404, 'Kode tidak ada.');
  delete codes[k]; saveCodes(); r.json({ ok: 1 });
});
const rdFail = new Map(); setInterval(() => { const t = Date.now() - 600e3; for (const [k, v] of rdFail) { const f = v.filter(x => x > t); f.length ? rdFail.set(k, f) : rdFail.delete(k); } }, 300e3).unref();
app.post('/api/redeem', lim, auth, (q, r) => {
  const now = Date.now(), f = (rdFail.get(q.key) || []).filter(t => t > now - 600e3);
  if (f.length >= 10) return bad(r, 429, 'Terlalu banyak kode salah, coba lagi 10 menit lagi.');
  const miss = (m) => { f.push(now); rdFail.set(q.key, f); return bad(r, 400, m); };
  const code = rdNorm(q.body && q.body.code); if (!code) return bad(r, 400, 'Masukkan kodenya dulu.');
  const c = codes[code]; if (!c) return miss('Kode tidak ditemukan.');
  if ((c.usedBy || []).includes(q.key)) return bad(r, 409, 'Kamu sudah pernah memakai kode ini.');
  const st = rdState(c);
  if (st === 'off') return miss('Kode ini sudah dinonaktifkan.');
  if (st === 'expired') return miss('Kode ini sudah kedaluwarsa.');
  if (st === 'full') return miss('Kode ini sudah habis dipakai.');
  const u = q.u; let msg;
  if (c.type === 'role') {
    if (u.dev || u.role === 'admin') return bad(r, 400, 'Akun staf tidak perlu role dari kode.');
    if (u.role === 'ress' || u.role === 'partner' || u.role === 'tk') return bad(r, 400, 'Role Ress / Partner / TK kamu sudah mencakup role dari kode ini.');
    const rank = { user: 0, vip: 1, owner: 2 }, add = c.days > 0 ? c.days * 864e5 : 0;
    if ((rank[u.role] || 0) > rank[c.role]) return bad(r, 400, 'Role kamu sudah lebih tinggi dari role di kode ini.');
    if (u.role === c.role) {
      if (!u.roleExp) return bad(r, 400, 'Role ' + RD_ROLE[c.role] + ' kamu sudah permanen.');
      u.roleExp = add ? u.roleExp + add : 0;
    } else { u.role = c.role; u.roleExp = add ? now + add : 0; }
    msg = 'Role ' + RD_ROLE[c.role] + ' aktif ' + (c.days > 0 ? c.days + ' hari' : 'permanen') + '.';
  } else {
    if (qInfo(u, c.tool).unlimited) return bad(r, 400, 'Kuota ' + RD_TOOLS[c.tool] + ' di akunmu sudah tanpa batas.');
    u.bonus = u.bonus || {};
    u.bonus[c.tool] = (Array.isArray(u.bonus[c.tool]) ? u.bonus[c.tool] : []).filter(x => x && (!x.exp || x.exp > now));
    u.bonus[c.tool].push({ n: c.amount, exp: c.days > 0 ? now + c.days * 864e5 : 0 });
    msg = 'Kuota harian ' + RD_TOOLS[c.tool] + ' bertambah ' + c.amount + 'x (' + (c.days > 0 ? c.days + ' hari' : 'permanen') + ').';
  }
  c.uses = (c.uses || 0) + 1; (c.usedBy = c.usedBy || []).push(q.key);
  save(); saveCodes();
  r.set('Cache-Control', 'no-store').json({ ok: 1, msg, user: pub(u) });
});

/* AM Prem: langkah 2 (verifikasi) lewat api.izzxd.my.id/api/am/verif-custom?email=<email akun>&link=<link masuk dari email Alight Motion>&orderId=<AMP_ORDER>&apikey=<IZZ_KEY>; langkah 1 (kirim link ke Gmail) masih api-cloud.my.id.
   Link masuk berisi kode sekali pakai akun pengguna: hanya diteruskan ke layanan, tidak disimpan dan tidak dicatat di log. */
app.post('/api/amprem/info', auth, (q, r) => r.set('Cache-Control', 'no-store').json(ampInfo(q.u)));
/* Langkah 1: minta layanan mengirim link masuk Alight Motion ke Gmail. Nama aksi di API diatur lewat env AMP_SEND_ACTION (bawaan "send").
   Tidak memotong kuota, tapi dibatasi supaya tidak bisa dipakai membanjiri kotak masuk orang lain: jeda 60 dtk per email, maksimal 5 kali per jam per akun. */
const AMP_ORDER = String(process.env.AMP_ORDER_ID || 'zyrexdep').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'zyrexdep';
const AMP_SEND_ACTION = String(process.env.AMP_SEND_ACTION || 'send').replace(/[^a-z_]/gi, '').slice(0, 20) || 'send';
const ampSent = new Map(); setInterval(() => { const t = Date.now() - 3600e3; for (const [k, v] of ampSent) { const f = v.filter(x => x.t > t); f.length ? ampSent.set(k, f) : ampSent.delete(k); } }, 600e3).unref();
app.post('/api/amprem/send', lim, auth, async (q, r) => {
  const email = String((q.body && q.body.email) || '').trim().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return bad(r, 400, 'Email tidak valid.');
  const inf = ampInfo(q.u);
  if (!inf.unlimited && inf.left <= 0) return bad(r, 429, 'Kuota AM Prem ' + qFull(inf).replace(/^Kuota /, ''));
  const now = Date.now(), hist = (ampSent.get(q.key) || []).filter(x => x.t > now - 3600e3), em = email.toLowerCase();
  const last = hist.filter(x => x.e === em).pop();
  if (last && now - last.t < 60000) return bad(r, 429, 'Tunggu ' + Math.ceil((60000 - (now - last.t)) / 1000) + ' detik sebelum kirim ulang ke email ini.');
  if (hist.length >= 5) return bad(r, 429, 'Terlalu sering kirim link (maksimal 5 kali per jam). Coba lagi nanti.');
  hist.push({ t: now, e: em }); ampSent.set(q.key, hist);
  const undo = () => { const h = ampSent.get(q.key) || [], i = h.findIndex(x => x.t === now && x.e === em); if (i >= 0) h.splice(i, 1); };
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
  try {
    let res;
    try { res = await fetch('' + AMP_SEND_ACTION + '&email=' + encodeURIComponent(email), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; undo(); return bad(r, 502, 'Server tidak bisa menjangkau layanan AM Prem (api-cloud.my.id).'); }
    const txt = await res.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
    if (apiFailed(res, j)) { undo(); return bad(r, 502, clip((j && (j.message || j.error || j.msg)) || 'Layanan gagal mengirim link, coba lagi nanti.', 200)); }
    r.set('Cache-Control', 'no-store').json({ ok: 1, email, note: apiNote(j), cooldown: 60 });
  } catch (e) { undo(); bad(r, 504, e.name === 'AbortError' ? 'Pengiriman link terlalu lama, coba lagi.' : 'Gagal menghubungi layanan AM Prem.'); }
  finally { clearTimeout(to); }
});
/* Langkah 2: verifikasi link masuk yang sudah diterima di Gmail. */
app.post('/api/amprem', lim, auth, async (q, r) => {
  const email = String((q.body && q.body.email) || '').trim().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return bad(r, 400, 'Email tidak valid.');
  const raw = String((q.body && q.body.link) || '').trim().slice(0, 2000);
  let p; try { p = new URL(raw); } catch (e) { return bad(r, 400, 'Link masuk tidak valid. Salin utuh dari email Alight Motion.'); }
  if (p.protocol !== 'https:' || !/(^|\.)(firebaseapp\.com|alightcreative\.com)$/i.test(p.hostname) || !/oobcode/i.test(raw)) return bad(r, 400, 'Itu bukan link masuk Alight Motion. Salin utuh link dari email Alight Motion.');
  const t = qTake(q.u, 'amp'); if (!t) return bad(r, 429, 'Kuota AM Prem ' + qFull(qInfo(q.u, 'amp')).replace(/^Kuota /, ''));
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 90000);
  try {
    let res;
    try { res = await fetch('' + new URLSearchParams({ email, link: raw, orderId: AMP_ORDER, apikey: IZZ_KEY }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; t.refund(); return bad(r, 502, 'Server tidak bisa menjangkau layanan AM Prem (api.izzxd.my.id).'); }
    const txt = await res.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
    if (apiFailed(res, j)) { t.refund(); return bad(r, 502, clip((j && (j.message || j.error || j.msg)) || 'Layanan AM Prem gagal memproses, coba lagi nanti.', 200).split(IZZ_KEY).join('***')); }
    const src = j && ((j.data && typeof j.data === 'object' && !Array.isArray(j.data)) ? j.data : (j.result && typeof j.result === 'object' && !Array.isArray(j.result)) ? j.result : null);
    const details = src ? Object.keys(src).filter(k => ['string', 'number', 'boolean'].includes(typeof src[k]) && !/token|secret|pass|cookie|session|refresh|jwt|auth|cred|key/i.test(k) && !/^eyJ[\w-]{10,}\./.test(String(src[k]))).slice(0, 8).map(k => [clip(k, 30), clip(src[k], 120)]) : [];
    r.set('Cache-Control', 'no-store').json({ ok: 1, note: apiNote(j).split(IZZ_KEY).join('***'), details, ...ampInfo(q.u) });
  } catch (e) { t.refund(); bad(r, 504, e.name === 'AbortError' ? 'AM Prem terlalu lama, coba lagi.' : 'Gagal menghubungi layanan AM Prem.'); }
  finally { clearTimeout(to); }
});

/* AM Bulk: api.izzxd.my.id/api/am/bulk-custom?amount=<jumlah>&orderId=<AMP_ORDER>&apikey=<IZZ_KEY>. Kuota harian per tool 'ambulk' (Pengguna 3x, VIP 20x, Owner 100x, Admin & Developer tanpa batas); 1 kali jalan = 1 kuota, kuota dikembalikan kalau gagal.
   Jumlah per jalan: Pengguna maks 10, VIP 25, Owner 50, Admin & Developer 50 (AMB_MAX, bawaan 50). Hasil tidak disimpan di server. */
const AMB_MAX = Math.max(1, Math.min(50, parseInt(process.env.AMB_MAX, 10) || 50));
/* Batas jumlah per jalan menurut role: Pengguna 10, VIP 25, Owner 50, Admin & Developer = AMB_MAX (maks 50) */
const AMB_BY_ROLE = { user: 10, vip: 25, owner: 50 };
const ambMax = (u) => Math.min(AMB_MAX, (u.dev || u.role === 'admin' || u.role === 'tk') ? AMB_MAX : (AMB_BY_ROLE[effRole(u.role)] || AMB_BY_ROLE.user));
app.post('/api/ambulk/info', auth, (q, r) => r.set('Cache-Control', 'no-store').json({ ...qInfo(q.u, 'ambulk'), max: ambMax(q.u) }));
app.post('/api/ambulk', lim, auth, async (q, r) => {
  const amount = parseInt(q.body && q.body.amount, 10);
  const mx = ambMax(q.u);
  if (!Number.isFinite(amount) || amount < 1 || amount > mx) return bad(r, 400, 'Jumlah harus 1 sampai ' + mx + (mx < AMB_MAX ? ' untuk role kamu.' : '.'));
  const t = qTake(q.u, 'ambulk'); if (!t) return bad(r, 429, 'Kuota AM Bulk ' + qFull(qInfo(q.u, 'ambulk')).replace(/^Kuota /, ''));
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 180000);
  try {
    let res;
    try { res = await fetch('' + new URLSearchParams({ amount: String(amount), orderId: AMP_ORDER, apikey: IZZ_KEY }).toString(), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; t.refund(); return bad(r, 502, 'Server tidak bisa menjangkau layanan AM Bulk (api.izzxd.my.id).'); }
    const txt = await res.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
    if (apiFailed(res, j)) { t.refund(); return bad(r, 502, clip((j && (j.message || j.error || j.msg)) || 'Layanan AM Bulk gagal memproses, coba lagi nanti.', 200).split(IZZ_KEY).join('***')); }
    const src = j ? (j.result != null ? j.result : j.data != null ? j.data : null) : null;
    const findArr = (o, d) => { if (Array.isArray(o)) return o; if (o && typeof o === 'object' && d < 3) for (const k of Object.keys(o)) { const a = findArr(o[k], d + 1); if (a) return a; } return null; };
    const clean = (v) => clip(v, 400).split(IZZ_KEY).join('***');
    const rows = (o) => {
      if (o == null) return [];
      if (typeof o !== 'object') { const v = clean(o); return v ? [['', v]] : []; }
      const out = [], walk = (x, pre, d) => {
        if (x == null || d > 3 || out.length >= 20) return;
        if (typeof x === 'object') { for (const k of Object.keys(x)) { if (/api.?key/i.test(k)) continue; walk(x[k], pre ? pre + ' ' + k : k, d + 1); } return; }
        const v = clean(x); if (v) out.push([clip(pre, 40), v]);
      };
      walk(o, '', 0); return out;
    };
    let items = [];
    const arr = findArr(src, 0);
    if (arr) items = arr.slice(0, 200).map(rows).filter(x => x.length);
    else if (typeof src === 'string') items = src.split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0, 200).map(x => [['', clean(x)]]);
    else if (src && typeof src === 'object') { const x = rows(src); if (x.length) items = [x]; }
    r.set('Cache-Control', 'no-store').json({ ok: 1, amount, note: apiNote(j).split(IZZ_KEY).join('***'), items, ...qInfo(q.u, 'ambulk'), max: mx });
  } catch (e) { t.refund(); bad(r, 504, e.name === 'AbortError' ? 'AM Bulk terlalu lama, coba lagi.' : 'Gagal menghubungi layanan AM Bulk.'); }
  finally { clearTimeout(to); }
});

/* ---------- Info Terkini (beranda): berita, gempa, erupsi gunung, tsunami ----------
   Gempa & potensi tsunami: BMKG open data (data.bmkg.go.id/DataMKG/TEWS/autogempa|gempaterkini|gempadirasakan .json).
   Berita & kabar erupsi: RSS portal berita (Antara, CNN Indonesia, BBC Indonesia, detik); kabar erupsi = berita yang memuat kata kunci erupsi/gunung api.
   Hasil di-cache di server (satu permintaan ke sumber untuk semua pengguna) dan klien memuat ulang tiap ~45 detik. */
const LIVE = new Map();
function liveGet(key, ttl, fn) {
  let c = LIVE.get(key); const now = Date.now();
  if (c && c.v !== undefined && now - c.t < ttl) return Promise.resolve(c.v);
  if (c && c.p) return c.p;
  if (!c) { c = { t: 0, v: undefined, p: null }; LIVE.set(key, c); }
  c.p = fn().then(v => { c.v = v; c.t = Date.now(); return v; }, () => { c.t = Date.now() - ttl + 15000; return c.v === undefined ? null : c.v; }).then(v => { c.p = null; return v; });
  return c.p;
}
async function liveFetch(url, ms) {
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), ms || 8000);
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AllToolsZyrexDep/1.0)', Accept: '*/*' } });
    if (!res.ok) throw new Error('http ' + res.status);
    return await res.text();
  } finally { clearTimeout(to); }
}
const bmkgList = (j) => { const g = j && j.Infogempa && j.Infogempa.gempa; return Array.isArray(g) ? g : g ? [g] : []; };
const bmkgItem = (g) => {
  const mag = parseFloat(g.Magnitude), ts = Date.parse(g.DateTime) || 0, sm = String(g.Shakemap || '').replace(/[^\w.\-]/g, '');
  return { ts, mag: Number.isFinite(mag) ? mag : null, depth: clip(g.Kedalaman, 24), place: clip(g.Wilayah, 170), when: clip(((g.Tanggal || '') + ' ' + (g.Jam || '')).trim(), 40),
    potensi: clip(g.Potensi || '', 90), felt: clip(g.Dirasakan || '', 170), lat: clip(g.Lintang, 20), lon: clip(g.Bujur, 20), map: sm ? 'https://static.bmkg.go.id/' + sm : '' };
};
const tsunamiOn = (it) => /tsunami/i.test(it.potensi) && !/tidak/i.test(it.potensi);
async function liveQuake() {
  const names = ['autogempa', 'gempaterkini', 'gempadirasakan'];
  const [a, b, c] = await Promise.all(names.map(n => liveFetch('https://data.bmkg.go.id/DataMKG/TEWS/' + n + '.json').then(t => JSON.parse(t)).catch(() => null)));
  if (!a && !b && !c) throw new Error('bmkg');
  const byTs = (x, y) => y.ts - x.ts;
  const latest = bmkgList(a).map(bmkgItem)[0] || null, strong = bmkgList(b).map(bmkgItem).sort(byTs), felt = bmkgList(c).map(bmkgItem).sort(byTs);
  const seen = new Set(), warn = [];
  for (const it of [latest, ...strong, ...felt]) { if (!it || !tsunamiOn(it) || Date.now() - it.ts > 12 * 36e5) continue; const k = it.ts + it.place; if (!seen.has(k)) { seen.add(k); warn.push(it); } }
  return { latest, strong: strong.slice(0, 6), felt: felt.slice(0, 8), tsunami: { warn: warn.slice(0, 5), latest: latest ? latest.potensi : '' } };
}
const xmlText = (t) => String(t || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => { try { return String.fromCodePoint(+n); } catch (e) { return ' '; } }).replace(/\s+/g, ' ').trim();
/* gambar berita: <enclosure>, <media:content>, <media:thumbnail>, atau <img> pertama di isi/deskripsi */
const xmlAttr = (tag, name) => { const r = new RegExp('\\b' + name + '\\s*=\\s*["\']([^"\']+)["\']', 'i').exec(tag); return r ? r[1] : ''; };
function rssImage(it) {
  const raw = it.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
  const tags = [...(raw.match(/<enclosure\b[^>]*>/gi) || []), ...(raw.match(/<media:(?:content|thumbnail)\b[^>]*>/gi) || [])];
  const urls = [];
  for (const t of tags) { const u = xmlAttr(t, 'url'), ty = xmlAttr(t, 'type'), md = xmlAttr(t, 'medium'); if (u && (!ty || /^image/i.test(ty) || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u)) && !/^video/i.test(ty) && md !== 'video') urls.push(u); }
  const im = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(raw); if (im) urls.push(im[1]);
  for (let u of urls) { u = u.trim().replace(/^http:\/\//i, 'https://'); if (/^https:\/\/[^\s"'<>]+$/i.test(u) && u.length <= 500) return u; }
  return '';
}
function rssItems(xml, src) {
  const out = [], re = /<item[\s>][\s\S]*?<\/item>/gi; let m;
  while ((m = re.exec(xml)) && out.length < 40) {
    const it = m[0], pick = (tag) => { const r = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i').exec(it); return r ? xmlText(r[1]) : ''; };
    const title = clip(pick('title'), 200), link = pick('link') || pick('guid'), ts = Date.parse(pick('pubDate') || pick('dc:date')) || 0;
    if (title && /^https?:\/\//i.test(link)) out.push({ title, link: clip(link, 500), ts, src, img: rssImage(it) });
  }
  return out;
}
const LIVE_FEEDS = [['Antara', 'https://www.antaranews.com/rss/terkini.xml'], ['CNN Indonesia', 'https://www.cnnindonesia.com/nasional/rss'], ['BBC Indonesia', 'https://feeds.bbci.co.uk/indonesia/rss.xml'], ['detik', 'https://rss.detik.com/index.php/detikcom']];
const VOLC_RE = /\b(erupsi|meletus|letusan|abu vulkanik|gunung api|gunung berapi)\b|gunung\s+(semeru|merapi|ibu|lewotobi|laki-?laki|sinabung|marapi|raung|ruang|dukono|karangetang|bromo|agung|anak krakatau|kerinci|lokon|soputan|rinjani|slamet|ijen|tangkuban)/i;
const VOLC_SEEN = new Map();
async function liveNews() {
  const got = await Promise.all(LIVE_FEEDS.map(([n, u]) => liveFetch(u).then(x => rssItems(x, n)).catch(() => null)));
  if (got.every(g => !g)) throw new Error('rss');
  const seen = new Set(), all = [];
  for (const it of got.flat().filter(Boolean).sort((x, y) => y.ts - x.ts)) { const k = it.title.toLowerCase().slice(0, 70); if (!seen.has(k)) { seen.add(k); all.push(it); } }
  for (const it of all) if (VOLC_RE.test(it.title)) VOLC_SEEN.set(it.link, it);
  const cut = Date.now() - 3 * 864e5;
  for (const [k, v] of VOLC_SEEN) if (v.ts && v.ts < cut) VOLC_SEEN.delete(k);
  while (VOLC_SEEN.size > 40) VOLC_SEEN.delete(VOLC_SEEN.keys().next().value);
  const volcano = [...VOLC_SEEN.values()].sort((x, y) => y.ts - x.ts).slice(0, 8);
  return { news: all.slice(0, 14), volcano };
}
app.post('/api/live', lim, auth, async (q, r) => {
  const [quake, news] = await Promise.all([liveGet('quake', 45000, liveQuake), liveGet('news', 90000, liveNews)]);
  const tsunami = quake ? quake.tsunami : null;
  r.set('Cache-Control', 'no-store').json({ ok: 1, t: Date.now(), okQuake: !!quake, okNews: !!news, news: news ? news.news : [], volcano: news ? news.volcano : [],
    quake: quake ? { latest: quake.latest, strong: quake.strong, felt: quake.felt } : null, tsunami });
});

/* Cek AI Slop: api-cloud.my.id/tools/scanslop?url=<link apa saja>. Tidak pakai kuota, terbuka untuk semua akun yang sudah login. */
app.post('/api/scanslop', lim, auth, async (q, r) => {
  let raw = String((q.body && q.body.url) || '').trim().slice(0, 500);
  if (raw && !/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  let p; try { p = new URL(raw); } catch (e) { return bad(r, 400, 'Link tidak valid.'); }
  if (!/^https?:$/i.test(p.protocol) || !p.hostname.includes('.')) return bad(r, 400, 'Link tidak valid. Contoh: https://contoh.com');
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
  try {
    let res;
    try { res = await fetch('' + encodeURIComponent(p.href), { signal: ac.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; return bad(r, 502, 'Server tidak bisa menjangkau layanan Cek AI Slop (api-cloud.my.id).'); }
    const txt = await res.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
    if (apiFailed(res, j)) return bad(r, 502, clip((j && (j.message || j.error || j.msg)) || 'Layanan gagal memindai, coba lagi nanti.', 200));
    const src = j && ((j.data && typeof j.data === 'object' && !Array.isArray(j.data)) ? j.data : (j.result && typeof j.result === 'object' && !Array.isArray(j.result)) ? j.result : (typeof j === 'object' ? j : null));
    const pick = (keys) => { for (const k of keys) if (src && src[k] != null && ['string', 'number', 'boolean'].includes(typeof src[k])) return src[k]; return null; };
    const score = pick(['score', 'slop_score', 'slopScore', 'ai_score', 'percentage', 'percent', 'value']);
    const verdict = pick(['verdict', 'label', 'result', 'status_text', 'category']);
    const details = src ? Object.keys(src).filter(k => ['string', 'number', 'boolean'].includes(typeof src[k]) && !['score', 'slop_score', 'slopScore', 'ai_score', 'percentage', 'percent', 'value', 'verdict', 'label', 'status_text', 'category', 'status', 'success', 'ok', 'message', 'msg', 'error', 'url'].includes(k) && !/token|secret|pass|cookie|session|refresh|jwt|auth|cred|key/i.test(k) && !/^eyJ[\w-]{10,}\./.test(String(src[k]))).slice(0, 10).map(k => [clip(k, 30), clip(src[k], 160)]) : [];
    r.set('Cache-Control', 'no-store').json({ ok: 1, url: p.href, note: apiNote(j), score, verdict, details });
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Pemindaian terlalu lama, coba lagi.' : 'Gagal menghubungi layanan Cek AI Slop.'); }
  finally { clearTimeout(to); }
});

/* Global Chat: real-time lewat SSE (tanpa library tambahan). /api/chat/stream?t=<token> menerima pesan,
   /api/chat/send mengirim (teks dan/atau foto JPEG), /api/chat/delete menghapus pesan sendiri.
   Avatar di /av/<username>, foto chat di /ci/<id>. Riwayat 300 pesan terakhir di data/chat.json, foto di data/chatimg/. */
const FC = path.join(DATA, 'chat.json'), CI = path.join(DATA, 'chatimg'), FP = path.join(DATA, 'pin.json');
fs.mkdirSync(CI, { recursive: true });
let CHAT = load(FC, []); if (!Array.isArray(CHAT)) CHAT = [];
let PINNED = load(FP, null);
const FX = path.join(DATA, 'chatstate.json');
let CLOSED = !!(load(FX, {}).closed);
let MAINT = (() => { const m = load(FX, {}).maint; return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; })();
const saveState = () => { try { fs.writeFileSync(FX, JSON.stringify({ closed: CLOSED, maint: MAINT })); } catch (e) {} };
/* ---------- Maintenance tool (Developer / Admin / Owner bisa mengatur) ---------- */
const canMaint = (u) => !!(u && (u.dev || u.role === 'admin' || u.role === 'owner'));
const TOOL_API = { tAmp: ['/api/amprem'], tAb: ['/api/ambulk'], tRch: ['/api/rch'], tCap: ['/api/capcut'], tVote: ['/api/vote'], tFol: ['/api/follch'], tSlop: ['/api/scanslop'], tSl: ['/api/slopscan'],
  tIqc: ['/api/iqc'], tIqcP: ['/api/iqcpink'], tIqcP2: ['/api/iqcpinkv2'], tAm: ['/api/afinitasml'], tCa: ['/api/callandro'], tCi: ['/api/callios'], tDy: ['/api/derydnta'], tFc: ['/api/fakech'], tFd: ['/api/fakedana'], tFv: ['/api/fakedev'], tFq: ['/api/fakeffduo'], tGc: ['/api/fakegc'], tMl: ['/api/fakeml'], tMd: ['/api/meledak'], tMp: ['/api/memepolisi'], tNk: ['/api/nokia'], tQt: ['/api/quotes'], tQr: ['/api/templateqris'], tHd: ['/api/hd'], tRb: ['/api/removebg'], tPx: ['/api/topixel'], tTd: ['/api/ttdm'], tTq: ['/api/ttqc'], tWn: ['/api/windows'], tAio: ['/api/aio'], tAd: ['/api/amdl'], tCp: ['/api/cekphising'], tTt: ['/api/ttdl'], tCc: ['/api/ccdl'], tIg: ['/api/igdl'], tPn: ['/api/pindl'], tBr: ['/api/brat'], tSf: ['/api/stalkff'], tSi: ['/api/stalkig'], tSr: ['/api/stalkrbx'], tSt: ['/api/stalktt'], tBs: ['/api/bypasssfl'], tSw: ['/api/ssweb'], tPf: ['/api/presetfinder'], tFf: ['/api/fakeff'], tCalc: [], tNotes: [] };
app.post('/api/maint/list', auth, (q, r) => r.set('Cache-Control', 'no-store').json({ maint: MAINT, can: canMaint(q.u) }));
app.post('/api/maint/set', auth, (q, r) => {
  if (!canMaint(q.u)) return bad(r, 403, 'Khusus Developer / Admin.');
  const b = q.body || {}, id = String(b.tool || '');
  if (!Object.prototype.hasOwnProperty.call(TOOL_API, id)) return bad(r, 400, 'Tool tidak dikenal.');
  if (b.on) MAINT[id] = { msg: String(b.msg || '').slice(0, 120), ts: Date.now(), by: q.u.name }; else delete MAINT[id];
  saveState();
  r.json({ ok: 1, maint: MAINT });
});
let chatTimer = null;
const saveChat = () => { clearTimeout(chatTimer); chatTimer = setTimeout(() => { try { fs.writeFileSync(FC, JSON.stringify(CHAT)); } catch (e) {} }, 1500); };
const savePin = () => { try { fs.writeFileSync(FP, JSON.stringify(PINNED)); } catch (e) {} };
const rmImg = (m) => { if (m && /^[a-f0-9]{16}$/.test(m.img || '')) fs.unlink(path.join(CI, m.img), () => {}); };
const CL = new Map();   // res -> key pengguna
const onlineN = () => new Set(CL.values()).size;
const sse = (res, ev, d) => res.write('event: ' + ev + '\ndata: ' + JSON.stringify(d) + '\n\n');
const bcast = (ev, d) => { for (const res of CL.keys()) { try { sse(res, ev, d); } catch (e) {} } };
const avV = (u) => u.avatar ? crypto.createHash('sha1').update(u.avatar).digest('hex').slice(0, 6) : '';
app.get('/av/:n', (q, r) => {
  const u = users[String(q.params.n || '').toLowerCase()];
  const m = u && u.avatar && /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(u.avatar);
  if (!m) return r.status(404).end();
  r.set({ 'Content-Type': m[1], 'Cache-Control': 'public, max-age=31536000, immutable' }).send(Buffer.from(m[2], 'base64'));
});
app.get('/ci/:id', (q, r) => {
  const id = String(q.params.id || '');
  if (!/^[a-f0-9]{16}$/.test(id)) return r.status(404).end();
  fs.readFile(path.join(CI, id), (e, b) => {
    if (e) return r.status(404).end();
    r.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' }).send(b);
  });
});
app.get('/api/chat/stream', (q, r) => {
  const k = sess[String(q.query.t || '')];
  if (!k || !users[k]) return bad(r, 401, 'Sesi habis, silakan masuk lagi');
  if (users[k].banned) return bad(r, 403, 'Akun ini diblokir admin.');
  r.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  r.flushHeaders();
  CL.set(r, k);
  sse(r, 'init', { msgs: CHAT.slice(-80), online: onlineN(), me: users[k].name, pin: PINNED, closed: CLOSED });
  bcast('online', { n: onlineN() });
  const hb = setInterval(() => { try { r.write(': ping\n\n'); } catch (e) {} }, 20000);
  r.on('close', () => { clearInterval(hb); CL.delete(r); bcast('online', { n: onlineN() }); });
});
const lastSend = new Map(); setInterval(() => lastSend.clear(), 60000).unref();
app.post('/api/chat/send', auth, (q, r) => {
  if (CLOSED && !isStaff(q.u)) return bad(r, 403, 'Global Chat sedang ditutup oleh Developer.');
  const text = String((q.body && q.body.text) || '').replace(/\r/g, '').trim().slice(0, 500);
  const raw = q.body && q.body.image;
  let buf = null;
  if (raw) {
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(raw));
    if (!m || m[1].length > 2200000) return bad(r, 400, 'Foto tidak valid atau terlalu besar.');
    buf = Buffer.from(m[1], 'base64');
    if (buf.length < 100 || buf[0] !== 0xFF || buf[1] !== 0xD8) return bad(r, 400, 'Foto tidak valid.');
  }
  if (!text && !buf) return bad(r, 400, 'Pesan kosong.');
  const now = Date.now(), recent = (lastSend.get(q.key) || []).filter(t => now - t < 10000);
  if (recent.length >= 5) return bad(r, 429, 'Pelan-pelan, pesan terlalu cepat.');
  recent.push(now); lastSend.set(q.key, recent);
  const m = { id: crypto.randomBytes(6).toString('hex'), u: q.u.name, v: avV(q.u), rl: q.u.role || 'user', bd: !!q.u.badge, dv: !!q.u.dev, t: text, ts: now };
  /* Tag @username: hanya username yang benar-benar terdaftar (dan tidak diblokir) yang dicatat di m.mn */
  const mn = [];
  (text.match(/@[\w.\-]{3,24}/g) || []).forEach(tk => {
    const uk = tk.slice(1).replace(/[.\-]+$/, '').toLowerCase(), tu = users[uk];
    if (tu && !tu.banned && mn.length < 10 && !mn.includes(tu.name)) mn.push(tu.name);
  });
  if (mn.length) m.mn = mn;
  const orig = q.body && q.body.reply ? CHAT.find(x => x.id === String(q.body.reply)) : null;
  if (orig) m.re = { id: orig.id, u: orig.u, t: String(orig.t || '').slice(0, 100), i: !!orig.img };
  if (buf) {
    m.img = crypto.randomBytes(8).toString('hex');
    try { fs.writeFileSync(path.join(CI, m.img), buf); } catch (e) { return bad(r, 500, 'Gagal menyimpan foto.'); }
  }
  CHAT.push(m);
  if (CHAT.length > 300) CHAT.splice(0, CHAT.length - 300).forEach(rmImg);
  saveChat(); bcast('msg', m); r.json({ ok: 1 });
});
/* Saran username untuk tag @ di Global Chat: yang online dulu, lalu yang namanya diawali / mengandung kata kunci. */
app.post('/api/chat/users', auth, (q, r) => {
  const kw = String((q.body && q.body.q) || '').toLowerCase().replace(/[^\w.\-]/g, '').slice(0, 24);
  const on = new Set(CL.values());
  const rows = [];
  for (const k of Object.keys(users)) {
    const u = users[k];
    if (!u || u.banned || !u.name) continue;
    const nm = String(u.name).toLowerCase();
    const sc = !kw ? 2 : nm.startsWith(kw) ? 3 : nm.includes(kw) ? 1 : 0;
    if (!sc) continue;
    rows.push({ sc: sc + (on.has(k) ? 0.5 : 0), u: u.name, rl: u.role || 'user', dv: !!u.dev, bd: !!u.badge, v: avV(u), on: on.has(k) });
  }
  rows.sort((a, b) => b.sc - a.sc || a.u.localeCompare(b.u));
  r.set('Cache-Control', 'no-store').json({ users: rows.slice(0, 8).map(({ sc, ...x }) => x) });
});
const RX = ['👍','❤️','😂','😮','😢','🙏'];
app.post('/api/chat/react', auth, (q, r) => {
  const id = String((q.body && q.body.id) || ''), em = String((q.body && q.body.emoji) || ''), m = CHAT.find(x => x.id === id);
  if (!m) return bad(r, 404, 'Pesan tidak ditemukan.');
  if (!RX.includes(em)) return bad(r, 400, 'Reaksi tidak dikenal.');
  m.r = m.r || {};
  const had = (m.r[em] || []).includes(q.key);
  for (const e of Object.keys(m.r)) { m.r[e] = m.r[e].filter(k => k !== q.key); if (!m.r[e].length) delete m.r[e]; }
  if (!had) (m.r[em] = m.r[em] || []).push(q.key);
  if (!Object.keys(m.r).length) delete m.r;
  saveChat(); bcast('react', { id: m.id, r: m.r || {} }); r.json({ ok: 1 });
});
app.post('/api/chat/delete', auth, (q, r) => {
  const id = String((q.body && q.body.id) || ''), i = CHAT.findIndex(m => m.id === id);
  if (i < 0) return bad(r, 404, 'Pesan tidak ditemukan.');
  const mine = String(CHAT[i].u).toLowerCase() === q.key;
  if (!mine && !isStaff(q.u)) return bad(r, 403, 'Hanya bisa menghapus pesanmu sendiri.');
  if (PINNED && PINNED.id === id) { PINNED = null; savePin(); bcast('pin', { m: null }); }
  rmImg(CHAT[i]); CHAT.splice(i, 1); saveChat(); bcast('del', { id }); r.json({ ok: 1 });
});
app.post('/api/chat/pin', auth, admin, (q, r) => {
  const id = String((q.body && q.body.id) || ''), m = CHAT.find(x => x.id === id);
  if (!m) return bad(r, 404, 'Pesan tidak ditemukan.');
  PINNED = { id: m.id, u: m.u, t: m.t || '', i: !!m.img }; savePin();
  bcast('pin', { m: PINNED }); r.json({ ok: 1 });
});
app.post('/api/chat/toggle', auth, admin, (q, r) => {
  CLOSED = !!(q.body && q.body.closed); saveState(); bcast('closed', { closed: CLOSED }); r.json({ ok: 1, closed: CLOSED });
});
app.post('/api/chat/unpin', auth, admin, (q, r) => {
  PINNED = null; savePin(); bcast('pin', { m: null }); r.json({ ok: 1 });
});

/* ---------- Ress & Partner: membagikan & mencabut role ---------- */
const GRANT_BY = { ress: ['vip'], partner: ['vip', 'owner'], tk: ['vip', 'owner', 'ress'] };   // Ress: VIP. Partner: VIP & Owner. TK: VIP, Owner & Ress (semuanya bisa permanen, bisa dicabut)
const GRANT_MAXDAYS = 365, GRANT_RANK = { user: 0, vip: 1, ress: 1, owner: 2 };
const grantRoles = (u) => (u && !u.dev && GRANT_BY[u.role]) || [];
const FGR = path.join(DATA, 'grants.json');
const GRLOG = (() => { const a = load(FGR, []); return Array.isArray(a) ? a.slice(-1000) : []; })();
const saveGr = () => { try { fs.writeFileSync(FGR, JSON.stringify(GRLOG)); } catch (e) {} };
/* Notifikasi ke Developer/Admin: setiap Ress/Partner memberi atau mencabut role */
const FNT = path.join(DATA, 'notif.json');
const NOTIF = (() => { const a = load(FNT, []); return Array.isArray(a) ? a.slice(-300) : []; })();
let NTID = NOTIF.reduce((m, x) => Math.max(m, x.id || 0), 0);
const saveNt = () => { try { fs.writeFileSync(FNT, JSON.stringify(NOTIF)); } catch (e) {} };
const pushNotif = (e) => { NOTIF.push(Object.assign({ id: ++NTID, read: false }, e)); if (NOTIF.length > 300) NOTIF.splice(0, NOTIF.length - 300); saveNt(); };
const logGrant = (e) => { GRLOG.push(e); if (GRLOG.length > 1000) GRLOG.splice(0, GRLOG.length - 1000); saveGr(); pushNotif(e); };
app.post('/api/reseller/info', auth, (q, r) => {
  const roles = grantRoles(q.u);
  if (!roles.length && !q.u.dev) return bad(r, 403, 'Khusus Ress / Partner.');
  const hist = (q.u.dev ? GRLOG.slice(-50) : GRLOG.filter((x) => x.by === q.key).slice(-30)).reverse();
  r.set('Cache-Control', 'no-store').json({ roles, role: q.u.role, dev: !!q.u.dev, maxDays: GRANT_MAXDAYS, days: Object.fromEntries(['vip', 'owner', 'ress'].map((x) => [x, shop[x].days || 30])), history: hist });
});
app.post('/api/reseller/grant', lim, auth, (q, r) => {
  const roles = grantRoles(q.u);
  if (!roles.length) return bad(r, 403, 'Khusus Ress / Partner.');
  const b = q.body || {}, k = String(b.user || '').trim().toLowerCase(), role = String(b.role || ''), t = users[k];
  if (!roles.includes(role)) return bad(r, 400, 'Role itu tidak bisa kamu berikan.');
  if (!t) return bad(r, 404, 'Username tidak ditemukan.');
  if (k === q.key) return bad(r, 400, 'Tidak bisa untuk akun sendiri.');
  if (k === OWNER_KEY || t.dev || t.role === 'admin' || (GRANT_BY[t.role] && t.role !== role)) return bad(r, 403, 'Role akun ini tidak bisa diubah.');
  if (t.banned) return bad(r, 400, 'Akun ini diblokir.');
  if ((GRANT_RANK[t.role] || 0) > GRANT_RANK[role]) return bad(r, 400, 'Pengguna ini sudah punya role yang lebih tinggi.');
  const perm = b.perm === true || b.perm === 'true' || b.perm === 1;
  let days = 0;
  if (!perm) {
    days = Math.floor(Number(b.days));
    if (!Number.isFinite(days) || days < 1) days = shop[role].days || 30;
    if (days > GRANT_MAXDAYS) return bad(r, 400, 'Maksimal ' + GRANT_MAXDAYS + ' hari.');
  }
  const now = Date.now();
  if (t.role === role && !t.roleExp) return bad(r, 400, 'Role ' + ROLE_LABEL[role] + ' pengguna ini sudah permanen.');
  if (perm) { t.role = role; t.roleExp = 0; }
  else if (t.role === role) t.roleExp += days * 864e5;
  else { t.role = role; t.roleExp = now + days * 864e5; }
  save();
  logGrant({ act: 'grant', by: q.key, byName: q.u.name, byRole: q.u.role, to: k, toName: t.name, role, days, perm, ts: now });
  r.json({ ok: 1, user: t.name, role, roleExp: t.roleExp, msg: 'Role ' + ROLE_LABEL[role] + (perm ? ' permanen' : ' ' + days + ' hari') + ' diberikan ke ' + t.name + '.' });
});
app.post('/api/reseller/revoke', lim, auth, (q, r) => {
  const roles = grantRoles(q.u);
  if (!roles.length) return bad(r, 403, 'Khusus Ress / Partner.');
  const k = String((q.body && q.body.user) || '').trim().toLowerCase(), t = users[k];
  if (!t) return bad(r, 404, 'Username tidak ditemukan.');
  if (k === q.key) return bad(r, 400, 'Tidak bisa untuk akun sendiri.');
  if (k === OWNER_KEY || t.dev || t.role === 'admin' || (GRANT_BY[t.role] && !roles.includes(t.role))) return bad(r, 403, 'Role akun ini tidak bisa diubah.');
  if (!roles.includes(t.role)) return bad(r, 400, t.role === 'user' ? 'Pengguna ini tidak punya role yang bisa dicabut.' : 'Role ' + ROLE_LABEL[t.role] + ' tidak bisa kamu cabut.');
  const old = t.role, wasPerm = !t.roleExp;
  t.role = 'user'; t.roleExp = 0;
  save();
  logGrant({ act: 'revoke', by: q.key, byName: q.u.name, byRole: q.u.role, to: k, toName: t.name, role: old, days: 0, perm: wasPerm, ts: Date.now() });
  r.json({ ok: 1, user: t.name, role: 'user', msg: 'Role ' + ROLE_LABEL[old] + ' milik ' + t.name + ' dicabut.' });
});
/* notifikasi untuk Developer/Admin */
app.post('/api/notif/list', auth, admin, (q, r) => r.set('Cache-Control', 'no-store').json({ unread: NOTIF.filter((x) => !x.read).length, items: NOTIF.slice(-30).reverse() }));
app.post('/api/notif/read', auth, admin, (q, r) => {
  let ch = false; NOTIF.forEach((x) => { if (!x.read) { x.read = true; ch = true; } });
  if (ch) saveNt(); r.json({ ok: 1 });
});
/* ---------- Request game/fitur/tools & laporan bug: pengguna kirim, Developer/Admin terima ---------- */
const FRQ = path.join(DATA, 'requests.json');
const REQS = (() => { const a = load(FRQ, []); return Array.isArray(a) ? a.slice(-500) : []; })();
let RQID = REQS.reduce((m, x) => Math.max(m, x.id || 0), 0);
const saveRq = () => { try { fs.writeFileSync(FRQ, JSON.stringify(REQS)); } catch (e) {} };
const RQ_TYPES = ['game', 'fitur', 'tools', 'bug'], RQ_ST = ['baru', 'proses', 'selesai', 'tolak'];
const rqOut = (x) => ({ id: x.id, ts: x.ts, by: x.by, byName: x.byName, type: x.type, text: x.text, status: x.status });
const rqLast = new Map(); setInterval(() => rqLast.clear(), 3600e3).unref();
app.post('/api/req/send', lim, auth, (q, r) => {
  const b = q.body || {}, type = String(b.type || ''), text = String(b.text || '').replace(/\r/g, '').trim().slice(0, 500), now = Date.now();
  if (!RQ_TYPES.includes(type)) return bad(r, 400, 'Pilih jenisnya dulu.');
  if (text.length < 5) return bad(r, 400, 'Tulis minimal 5 karakter.');
  if (now - (rqLast.get(q.key) || 0) < 20000) return bad(r, 429, 'Tunggu sebentar sebelum mengirim lagi.');
  if (REQS.filter((x) => x.by === q.key && now - x.ts < 864e5).length >= 10) return bad(r, 429, 'Batas 10 kiriman per hari sudah tercapai.');
  rqLast.set(q.key, now);
  REQS.push({ id: ++RQID, ts: now, by: q.key, byName: q.u.name, type, text, status: 'baru', read: false });
  if (REQS.length > 500) REQS.splice(0, REQS.length - 500);
  saveRq(); r.json({ ok: 1, msg: 'Terkirim ke Developer. Terima kasih!' });
});
app.post('/api/req/mine', auth, (q, r) => r.set('Cache-Control', 'no-store').json({ items: REQS.filter((x) => x.by === q.key).slice(-20).reverse().map(rqOut) }));
app.post('/api/req/list', auth, admin, (q, r) => r.set('Cache-Control', 'no-store').json({ unread: REQS.filter((x) => !x.read).length, items: REQS.slice(-100).reverse().map(rqOut) }));
app.post('/api/req/set', auth, admin, (q, r) => {
  const b = q.body || {}, x = REQS.find((y) => y.id === Number(b.id));
  if (!x) return bad(r, 404, 'Kiriman tidak ditemukan.');
  if (!RQ_ST.includes(b.status)) return bad(r, 400, 'Status tidak valid.');
  x.status = b.status; x.read = true; saveRq(); r.json({ ok: 1 });
});
app.post('/api/req/read', auth, admin, (q, r) => {
  let ch = false; REQS.forEach((x) => { if (!x.read) { x.read = true; ch = true; } });
  if (ch) saveRq(); r.json({ ok: 1 });
});
/* ---------- Panel Admin: lihat & kelola user, role, badge centang biru, blokir ---------- */
const ROLE_LABEL = { user: 'Pengguna', vip: 'VIP', admin: 'Admin', owner: 'Owner', ress: 'Ress', partner: 'Partner', tk: 'TK' };
app.post('/api/admin/users', auth, admin, (q, r) => {
  const online = new Set(CL.values());
  const list = Object.keys(users).map(k => {
    const u = users[k];
    return { key: k, user: u.name, avatar: u.avatar || null, role: u.role || 'user', roleExp: u.roleExp || 0, badge: !!u.badge, dev: !!u.dev, banned: !!u.banned, created: u.created || 0, online: online.has(k) };
  }).sort((a, b) => b.created - a.created);
  r.json({ total: list.length, online: online.size, me: q.key, myRole: q.u.role, users: list });
});
app.post('/api/admin/role', auth, admin, (q, r) => {
  const k = String((q.body && q.body.user) || '').toLowerCase(), role = String((q.body && q.body.role) || ''), u = users[k];
  if (!u) return bad(r, 404, 'User tidak ditemukan.');
  if (!ASSIGNABLE.includes(role)) return bad(r, 400, 'Role Admin & Developer khusus ZyrexDepp.');
  if (k === OWNER_KEY) return bad(r, 403, 'Role ZyrexDepp tidak bisa diubah.');
  const dd = q.body && q.body.days != null ? Math.floor(Number(q.body.days)) : null;
  const days = role === 'user' ? 0 : (dd != null && dd >= 0 && dd <= 3650 ? dd : (shop[role] ? shop[role].days : 0));
  u.role = role; u.roleExp = days > 0 ? Date.now() + days * 864e5 : 0;   // days 0 = permanen
  save(); r.json({ ok: 1, user: pub(u) });
});
/* ---------- Toko Zyrex ---------- */
const shopOut = () => ({ items: ['vip', 'owner', 'ress', 'partner', 'tk'].map(id => ({ id, name: ROLE_LABEL[id], price: shop[id].price, days: shop[id].days })), contact: shop.contact, cats: shop.cats, products: shop.products });
app.post('/api/shop', auth, (q, r) => r.set('Cache-Control', 'no-store').json({ ...shopOut(), me: { role: q.u.role || 'user', roleExp: q.u.roleExp || 0 } }));
app.post('/api/admin/shop', auth, admin, (q, r) => {
  const b = q.body || {};
  if (b.id != null) {
    const id = String(b.id);
    if (!['vip', 'owner', 'ress', 'partner', 'tk'].includes(id)) return bad(r, 400, 'Produk tidak ada.');
    const price = Math.floor(Number(b.price)), days = Math.floor(Number(b.days));
    if (!Number.isFinite(price) || price < 0 || price > 100000000) return bad(r, 400, 'Harga tidak valid (0 - 100.000.000).');
    if (!Number.isFinite(days) || days < 0 || days > 3650) return bad(r, 400, 'Hari tidak valid (0 - 3650, 0 = permanen).');
    var undo = { id, price: shop[id].price, days: shop[id].days };
    shop[id].price = price; shop[id].days = days;
  }
  if (b.contact != null) {
    const c = String(b.contact).trim().slice(0, 300);
    if (c && !/^https?:\/\//i.test(c)) return bad(r, 400, 'Link kontak harus diawali http:// atau https://');
    shop.contact = c;
  }
  if (!saveShop()) {
    if (typeof undo !== 'undefined') { shop[undo.id].price = undo.price; shop[undo.id].days = undo.days; }
    return bad(r, 500, 'Gagal menyimpan ke server (data/shop.json tidak bisa ditulis). Cek izin folder data di panel.');
  }
  r.json({ ok: 1, ...shopOut() });
});
/* Produk biasa (Script Ourin, Script Cantarella, Rename Script, Jasa Sewa Bot, Suntik Media Social, Panel Pterodactyl): tambah / ubah / hapus oleh Developer */
app.post('/api/admin/shop/item', auth, admin, (q, r) => {
  const b = q.body || {}, op = String(b.op || ''), before = JSON.stringify(shop.products);
  const fields = () => {
    const name = String(b.name == null ? '' : b.name).trim().slice(0, 60), price = Math.floor(Number(b.price)), desc = String(b.desc == null ? '' : b.desc).trim().slice(0, 200);
    if (!name) return 'Nama produk wajib diisi.';
    if (!Number.isFinite(price) || price < 0 || price > 100000000) return 'Harga tidak valid (0 - 100.000.000).';
    return { name, price, desc };
  };
  if (op === 'add') {
    if (b.cat === 'role' || !shop.cats.some(c => c.id === b.cat)) return bad(r, 400, 'Kategori tidak ada.');
    if (shop.products.length >= 200) return bad(r, 400, 'Maksimal 200 produk.');
    const f = fields(); if (typeof f === 'string') return bad(r, 400, f);
    shop.products.push({ id: crypto.randomBytes(5).toString('hex'), cat: b.cat, ...f });
  } else if (op === 'edit') {
    const p = shop.products.find(x => x.id === String(b.id)); if (!p) return bad(r, 404, 'Produk tidak ditemukan.');
    const f = fields(); if (typeof f === 'string') return bad(r, 400, f);
    Object.assign(p, f);
  } else if (op === 'del') {
    const i = shop.products.findIndex(x => x.id === String(b.id)); if (i < 0) return bad(r, 404, 'Produk tidak ditemukan.');
    shop.products.splice(i, 1);
  } else return bad(r, 400, 'Aksi tidak dikenal.');
  if (!saveShop()) { shop.products = JSON.parse(before); return bad(r, 500, 'Gagal menyimpan ke server (data/shop.json tidak bisa ditulis). Cek izin folder data di panel.'); }
  r.json({ ok: 1, ...shopOut() });
});
/* Kategori di bar Toko: tambah / ganti nama / hapus (hapus ikut menghapus produknya). Kategori Role tidak bisa dihapus. */
app.post('/api/admin/shop/cat', auth, admin, (q, r) => {
  const b = q.body || {}, op = String(b.op || ''), before = JSON.stringify({ c: shop.cats, p: shop.products });
  const name = String(b.name == null ? '' : b.name).trim().slice(0, 30);
  if (op === 'add') {
    if (!name) return bad(r, 400, 'Nama kategori wajib diisi.');
    if (shop.cats.length >= 20) return bad(r, 400, 'Maksimal 20 kategori.');
    if (shop.cats.some(c => c.name.toLowerCase() === name.toLowerCase())) return bad(r, 400, 'Nama kategori sudah ada.');
    shop.cats.push({ id: 'c' + crypto.randomBytes(4).toString('hex'), name });
  } else if (op === 'rename') {
    const c = shop.cats.find(x => x.id === String(b.id)); if (!c) return bad(r, 404, 'Kategori tidak ditemukan.');
    if (!name) return bad(r, 400, 'Nama kategori wajib diisi.');
    if (shop.cats.some(x => x.id !== c.id && x.name.toLowerCase() === name.toLowerCase())) return bad(r, 400, 'Nama kategori sudah ada.');
    c.name = name;
  } else if (op === 'del') {
    const id = String(b.id);
    if (id === 'role') return bad(r, 400, 'Kategori Role tidak bisa dihapus.');
    const i = shop.cats.findIndex(x => x.id === id); if (i < 0) return bad(r, 404, 'Kategori tidak ditemukan.');
    shop.cats.splice(i, 1); shop.products = shop.products.filter(x => x.cat !== id);
  } else return bad(r, 400, 'Aksi tidak dikenal.');
  if (!saveShop()) { const o = JSON.parse(before); shop.cats = o.c; shop.products = o.p; return bad(r, 500, 'Gagal menyimpan ke server (data/shop.json tidak bisa ditulis). Cek izin folder data di panel.'); }
  r.json({ ok: 1, ...shopOut(), newId: op === 'add' ? shop.cats[shop.cats.length - 1].id : undefined });
});
app.post('/api/admin/badge', auth, admin, (q, r) => {
  const k = String((q.body && q.body.user) || '').toLowerCase(), u = users[k];
  if (!u) return bad(r, 404, 'User tidak ditemukan.');
  if (k === OWNER_KEY) return bad(r, 403, 'Badge ZyrexDepp tidak bisa diubah.');
  u.badge = !!(q.body && q.body.badge); save(); r.json({ ok: 1, user: pub(u) });
});
app.post('/api/admin/ban', auth, admin, (q, r) => {
  const k = String((q.body && q.body.user) || '').toLowerCase(), u = users[k], banned = !!(q.body && q.body.banned);
  if (!u) return bad(r, 404, 'User tidak ditemukan.');
  if (k === OWNER_KEY) return bad(r, 403, 'ZyrexDepp tidak bisa diblokir.');
  if (k === q.key) return bad(r, 403, 'Tidak bisa memblokir akun sendiri.');
  u.banned = banned; save();
  if (banned) {
    for (const t in sess) if (sess[t] === k) delete sess[t]; save();
    for (const [res, kk] of Array.from(CL)) if (kk === k) { try { sse(res, 'kicked', {}); res.end(); } catch (e) {} CL.delete(res); }
    bcast('online', { n: onlineN() });
  }
  r.json({ ok: 1, user: pub(u) });
});

/* ZyrexDep eai: memakai API Gemini dari apiii-xrina.my.id (GET ?text=&system=&model=&session=).
   Bisa diganti lewat env AI_URL / AI_MODEL. Konteks obrolan disimpan oleh API lewat parameter session. */
/* Dua mesin AI yang bisa dipilih pengguna: "gmni" (Gemini, ingat percakapan lewat session) dan "ngt" (NoteGPT, satu kali tanya-jawab, tanpa system prompt/session - API-nya cuma terima ?text=). */
const AI_ENGINES = {
  gmni: { url: process.env.AI_URL || '', model: process.env.AI_MODEL || 'gemini-3.1-pro', session: true, system: true },
  ngt: { url: process.env.AI_NGT_URL || '', session: false, system: false },
};
const AI = AI_ENGINES.gmni;
const AI_SYS = 'Kamu adalah ZyrexDep eai, asisten AI di aplikasi All Tools ZyrexDep buatan Zyrex. Turuti permintaan pengguna dengan ramah, jelas, dan ringkas. Pakai bahasa Indonesia santai kecuali pengguna memakai bahasa lain. Tulis kode di dalam blok kode.';
app.post('/api/ai', lim, auth, async (q, r) => {
  const text = String((q.body && q.body.text) || '').trim().slice(0, 1500);
  const sid = String((q.body && q.body.sid) || '');
  const eng = AI_ENGINES[String((q.body && q.body.engine) || 'gmni')] ? String(q.body.engine) : 'gmni';
  const E = AI_ENGINES[eng];
  if (!text) return bad(r, 400, 'Pesan kosong.');
  if (!/^[a-z0-9]{6,32}$/i.test(sid)) return bad(r, 400, 'Sesi tidak valid.');
  const params = { text };
  if (E.system) params.system = AI_SYS;
  if (E.model) params.model = E.model;
  if (E.session) params.session = 'yd' + crypto.createHash('sha1').update(q.key + ':' + sid).digest('hex').slice(0, 20);
  const url = E.url + '?' + new URLSearchParams(params).toString();
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 90000);
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { Accept: 'application/json' } });
    const j = await res.json().catch(() => null);
    let t = j && j.data && (j.data.response || j.data.result || j.data.answer);
    if (!res.ok || !j || j.status === false || typeof t !== 'string') return bad(r, 502, 'ZyrexDep eai belum bisa menjawab, coba lagi sebentar lagi.');
    t = t.replace(/^\s*:\s*connected\s*/i, '').trim();
    if (!t) return bad(r, 502, 'Jawaban kosong, coba tanya lagi.');
    r.json({ reply: t.slice(0, 12000), engine: eng });
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'AI terlalu lama menjawab, coba lagi.' : 'Gagal menghubungi layanan AI.'); }
  finally { clearTimeout(to); }
});

/* ---------- JB Public: semua pengguna (free, VIP, Owner, Developer) boleh jualan ---------- */
const FJB = path.join(DATA, 'jb.json');
let jb = (() => {
  const s = load(FJB, {});
  return (Array.isArray(s.items) ? s.items : []).filter(x => x && typeof x.id === 'string' && typeof x.owner === 'string' && typeof x.name === 'string')
    .map(x => ({ id: x.id, owner: x.owner, name: x.name.slice(0, 60), price: Math.max(0, Math.floor(Number(x.price) || 0)), phone: String(x.phone || '').replace(/\D/g, '').slice(0, 15), desc: String(x.desc || '').slice(0, 200), created: Number(x.created) || 0 })).slice(0, 500);
})();
const saveJb = () => {
  try { const tmp = FJB + '.tmp', txt = JSON.stringify({ items: jb }); fs.writeFileSync(tmp, txt); fs.renameSync(tmp, FJB); return fs.readFileSync(FJB, 'utf8') === txt; }
  catch (e) { console.log('Gagal simpan data/jb.json: ' + e.message); return false; }
};
const JB_MAX_MINE = 20, JB_MAX_ALL = 500;
const jbPhone = (v) => {   // 0812.. / +62812.. / 812.. -> 62812..
  let d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1); else if (d.startsWith('8')) d = '62' + d;
  return /^62[1-9]\d{7,12}$/.test(d) ? d : '';
};
const jbOut = (q) => {
  const sellers = {}, items = [];
  for (const x of jb) {
    const u = users[x.owner]; if (!u || u.banned) continue;
    if (!sellers[x.owner]) sellers[x.owner] = { user: u.name, avatar: u.avatar || null, role: u.role || 'user', badge: !!u.badge, dev: !!u.dev };
    items.push({ id: x.id, owner: x.owner, name: x.name, price: x.price, phone: x.phone, desc: x.desc, created: x.created, mine: x.owner === q.key });
  }
  items.sort((a, b) => b.created - a.created);
  return { items, sellers, me: q.key, canModerate: isStaff(q.u), maxMine: JB_MAX_MINE };
};
app.post('/api/jb', auth, (q, r) => r.set('Cache-Control', 'no-store').json(jbOut(q)));
app.post('/api/jb/item', auth, lim, (q, r) => {
  const b = q.body || {}, op = String(b.op || ''), before = JSON.stringify(jb);
  const fields = () => {
    const name = String(b.name == null ? '' : b.name).trim().slice(0, 60), price = Math.floor(Number(b.price)), desc = String(b.desc == null ? '' : b.desc).trim().slice(0, 200), phone = jbPhone(b.phone);
    if (!name) return 'Nama barang wajib diisi.';
    if (!Number.isFinite(price) || price < 0 || price > 100000000) return 'Harga tidak valid (0 - 100.000.000).';
    if (!phone) return 'Nomor WhatsApp penjual tidak valid. Contoh: 081234567890';
    return { name, price, desc, phone };
  };
  if (op === 'add') {
    if (jb.length >= JB_MAX_ALL) return bad(r, 400, 'JB Public penuh.');
    if (jb.filter(x => x.owner === q.key).length >= JB_MAX_MINE) return bad(r, 400, 'Maksimal ' + JB_MAX_MINE + ' barang per akun.');
    const f = fields(); if (typeof f === 'string') return bad(r, 400, f);
    jb.push({ id: crypto.randomBytes(6).toString('hex'), owner: q.key, created: Date.now(), ...f });
  } else if (op === 'edit') {
    const p = jb.find(x => x.id === String(b.id)); if (!p) return bad(r, 404, 'Barang tidak ditemukan.');
    if (p.owner !== q.key) return bad(r, 403, 'Bukan barang jualanmu.');
    const f = fields(); if (typeof f === 'string') return bad(r, 400, f);
    Object.assign(p, f);
  } else if (op === 'del') {
    const i = jb.findIndex(x => x.id === String(b.id)); if (i < 0) return bad(r, 404, 'Barang tidak ditemukan.');
    if (jb[i].owner !== q.key && !isStaff(q.u)) return bad(r, 403, 'Bukan barang jualanmu.');
    jb.splice(i, 1);
  } else return bad(r, 400, 'Aksi tidak dikenal.');
  if (!saveJb()) { jb = JSON.parse(before); return bad(r, 500, 'Gagal menyimpan ke server (data/jb.json tidak bisa ditulis). Cek izin folder data di panel.'); }
  r.json({ ok: 1, ...jbOut(q) });
});

/* ===== Musik (Spotify-an) =====
   Cari lagu: paket yt-search kalau terpasang, kalau tidak langsung baca halaman hasil YouTube.
   Audio: API azbry ytmp3 (https://api.azbry.com/api/download/ytmp3?url=), cadangan AIO apiii-xrina.my.id.
   File audio dialirkan lewat /mu/<token>; Range dilayani penuh supaya tombol -10 / +10 detik dan geser durasi aman. */
const MU = new Map(), MUR = new Map(), MUS = new Map();
const muSafe = u => { try { const p = new URL(u); return (p.protocol === 'https:' || p.protocol === 'http:') && p.hostname.includes('.') && !/^[\d.]+$/.test(p.hostname) && !p.hostname.includes(':') && !/\.(local|internal|localhost)$/i.test(p.hostname); } catch (e) { return false; } };
let musifyAudio = null; try { musifyAudio = require('./musify-audio.js'); } catch (e) { console.log('[musik] musify-audio.js gagal dimuat: ' + e.message); }
let ytSearch = null; try { ytSearch = require('yt-search'); } catch (e) { ytSearch = null; }
const MU_UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const muTok = (u, ext, yt) => {
  if (typeof u !== 'string' || !muSafe(u)) return null;
  while (MU.size >= 40) MU.delete(MU.keys().next().value);
  const id = crypto.randomBytes(12).toString('hex'); MU.set(id, { url: u, yt: yt || '', ext: String(ext || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) });
  setTimeout(() => MU.delete(id), 3600e3).unref();
  return id;
};
const muClean = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const muSec = s => String(s || '').trim().split(/[:.]/).reverse().reduce((a, x, i) => a + (parseInt(x, 10) || 0) * Math.pow(60, i), 0);
const muItem = (id, title, artist, sec) => ({ id, title: muClean(title, 140), artist: muClean(artist, 80), dur: sec | 0, thumb: 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg' });
const muWalk = (data) => {
  const out = [], seen = new Set();
  const walk = (o, d) => {
    if (!o || typeof o !== 'object' || d > 16 || out.length >= 25) return;
    if (Array.isArray(o)) { o.forEach(x => walk(x, d + 1)); return; }
    const v = o.videoRenderer;
    if (v && /^[\w-]{11}$/.test(v.videoId || '') && !seen.has(v.videoId)) {
      const sec = muSec(v.lengthText && v.lengthText.simpleText);
      if (sec > 0 && sec <= 1200) {
        seen.add(v.videoId);
        const t = v.title && v.title.runs && v.title.runs[0] && v.title.runs[0].text;
        const a = (v.ownerText && v.ownerText.runs && v.ownerText.runs[0] && v.ownerText.runs[0].text) || '';
        out.push(muItem(v.videoId, t, a, sec));
      }
    }
    for (const k in o) walk(o[k], d + 1);
  };
  walk(data, 0);
  return out;
};
/* Pencarian utama: apiii-xrina.my.id/search/spotify?query=<kata>. Bentuk JSON dibaca fleksibel: cari array lagu terpanjang. */
const muStr = v => typeof v === 'string' ? v : (v && typeof v === 'object' ? (v.name || v.title || '') : '');
function muSpoParse(j) {
  let best = [];
  const walk = (o, d) => {
    if (!o || typeof o !== 'object' || d > 6) return;
    if (Array.isArray(o)) {
      const objs = o.filter(x => x && typeof x === 'object' && !Array.isArray(x) && (x.title || x.name || x.trackName || x.track));
      if (objs.length > best.length) best = objs;
      o.slice(0, 50).forEach(x => walk(x, d + 1)); return;
    }
    for (const k in o) walk(o[k], d + 1);
  };
  walk(j, 0);
  const out = [], seen = new Set();
  for (const o of best) {
    const title = muClean(muStr(o.title) || muStr(o.name) || muStr(o.trackName) || muStr(o.track), 140);
    if (!title) continue;
    let artist = o.artist != null ? o.artist : o.artists != null ? o.artists : o.author != null ? o.author : o.singer != null ? o.singer : '';
    artist = Array.isArray(artist) ? artist.map(muStr).filter(Boolean).join(', ') : muStr(artist);
    const link = [o.url, o.link, o.spotify_url, o.spotifyUrl, o.external_urls && o.external_urls.spotify, o.uri].find(x => typeof x === 'string' && x) || '';
    const sm = /track[\/:]([A-Za-z0-9]{22})/.exec(link) || (typeof o.id === 'string' && /^[A-Za-z0-9]{22}$/.test(o.id) ? [0, o.id] : null);
    const id = sm ? sm[1] : 'q' + crypto.createHash('sha1').update(title + '|' + artist).digest('hex').slice(0, 16);
    if (seen.has(id)) continue; seen.add(id);
    let th = [o.thumbnail, o.thumb, o.cover, o.image, o.img, o.picture, o.album && (o.album.images && o.album.images[0] && o.album.images[0].url || o.album.image || o.album.cover), o.images && o.images[0] && (o.images[0].url || o.images[0])].find(x => typeof x === 'string' && /^https?:\/\//.test(x)) || '';
    let dur = o.duration_ms != null ? Number(o.duration_ms) / 1000 : o.duration != null ? o.duration : o.durationMs != null ? Number(o.durationMs) / 1000 : o.length != null ? o.length : 0;
    if (typeof dur === 'string') dur = /[:.]/.test(dur) ? muSec(dur) : Number(dur) || 0;
    dur = Number(dur) || 0; if (dur > 20000) dur = dur / 1000;
    out.push({ id, title, artist: muClean(artist, 80), dur: Math.round(dur), thumb: th });
    if (out.length >= 25) break;
  }
  return out;
}
async function muSpoSearch(qs, signal) {
  try {
    const res = await fetch('' + new URLSearchParams({ query: qs }).toString(), { signal, headers: { Accept: 'application/json', 'User-Agent': MU_UA } });
    const j = await res.json().catch(() => null);
    const out = j ? muSpoParse(j.result != null ? j.result : j.data != null ? j.data : j) : [];
    if (out.length) return out;
    console.log('[musik] search spotify kosong, status ' + res.status + ': ' + JSON.stringify(j || {}).slice(0, 200));
  } catch (e) { console.log('[musik] search spotify gagal: ' + e.message); }
  return [];
}
async function muSearchList(qs, signal) {
  /* 1) paket yt-search */
  if (ytSearch) {
    try {
      const rs = await ytSearch({ query: qs, hl: 'id', gl: 'ID' });
      const out = ((rs && rs.videos) || []).filter(v => v && /^[\w-]{11}$/.test(v.videoId) && v.seconds > 0 && v.seconds <= 1200)
        .slice(0, 25).map(v => muItem(v.videoId, v.title, v.author && v.author.name, v.seconds));
      if (out.length) return out;
    } catch (e) { console.log('[musik] yt-search gagal: ' + e.message); }
  } else console.log('[musik] paket yt-search belum terpasang (jalankan npm install)');
  /* 2) API internal YouTube (InnerTube) */
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST', signal,
      headers: { 'User-Agent': MU_UA, 'Content-Type': 'application/json', 'Accept-Language': 'id-ID,id;q=0.9', Cookie: 'CONSENT=YES+1; SOCS=CAI' },
      body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: '2.20250101.00.00', hl: 'id', gl: 'ID' } }, query: qs, params: 'EgIQAQ%3D%3D' })
    });
    const j = await res.json().catch(() => null);
    const out = j ? muWalk(j) : [];
    if (out.length) return out;
    console.log('[musik] InnerTube kosong, status ' + res.status);
  } catch (e) { console.log('[musik] InnerTube gagal: ' + e.message); }
  /* 3) baca halaman hasil YouTube */
  try {
    const res = await fetch('https://www.youtube.com/results?' + new URLSearchParams({ search_query: qs, hl: 'id', gl: 'ID', sp: 'EgIQAQ%3D%3D' }).toString().replace(/%253D/g, '%3D'), {
      signal, headers: { 'User-Agent': MU_UA, 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8', Cookie: 'CONSENT=YES+1; SOCS=CAI' }
    });
    const html = await res.text();
    const m = /var ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/.exec(html);
    if (m) { const out = muWalk(JSON.parse(m[1])); if (out.length) return out; }
    console.log('[musik] halaman hasil YouTube tidak berisi video (status ' + res.status + ')');
  } catch (e) { console.log('[musik] scrape YouTube gagal: ' + e.message); }
  return [];
}
/* Hasil teratas dari API Rohan: apa yang dicari, itu yang didapat (1 lagu) */
async function muRohanItem(qs, signal) {
  try {
    const res = await fetch('https://rizkyrohan.ai.id/api/ytplay?' + new URLSearchParams({ key: MU_KEY, query: qs }).toString(), { signal, headers: { Accept: 'application/json', 'User-Agent': MU_UA } });
    const j = await res.json().catch(() => null);
    if (!j) { console.log('[musik] ytplay tidak membalas JSON, status ' + res.status); return null; }
    const d = j.result != null ? j.result : j.data != null ? j.data : j;
    const txt = JSON.stringify(d || {});
    const idm = /(?:v=|youtu\.be\/|"(?:id|videoId|video_id)":")([\w-]{11})(?=["&\\])/.exec(txt);
    if (!idm) { console.log('[musik] ytplay tidak memberi ID video: ' + txt.slice(0, 200)); return null; }
    const o = (d && !Array.isArray(d) && (d.metadata || d.video || d.info)) || (Array.isArray(d) ? d[0] : d) || {};
    let dur = o.seconds != null ? o.seconds : o.duration != null ? o.duration : 0;
    if (typeof dur === 'string') dur = /[:.]/.test(dur) ? muSec(dur) : Number(dur) || 0;
    const ch = o.author || o.channel || o.artist || '';
    return muItem(idm[1], o.title || qs, typeof ch === 'string' ? ch : (ch && ch.name) || '', Number(dur) || 0);
  } catch (e) { console.log('[musik] ytplay gagal: ' + e.message); return null; }
}
async function muSearch(qs, signal) {
  const [top, list] = await Promise.all([muRohanItem(qs, signal), muSearchList(qs, signal).catch(() => [])]);
  const out = [];
  if (top) out.push(top);
  for (const x of list) if (!top || x.id !== top.id) out.push(x);
  if (out.length) return out.slice(0, 25);
  return await muSpoSearch(qs, signal);   // cadangan terakhir
}
app.post('/api/music/search', lim, auth, async (q, r) => {
  const qs = muClean(q.body && q.body.q, 80);
  if (!qs) return bad(r, 400, 'Ketik judul lagu atau nama artis dulu.');
  const ck = qs.toLowerCase(), c = MUS.get(ck);
  if (c && c.exp > Date.now()) return r.set('Cache-Control', 'no-store').json({ items: c.items });
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 25000);
  try {
    const items = await muSearch(qs, ac.signal);
    if (!items.length) return bad(r, 404, 'Lagu tidak ketemu, coba kata kunci lain.');
    while (MUS.size >= 80) MUS.delete(MUS.keys().next().value);
    MUS.set(ck, { items, exp: Date.now() + 600e3 });
    r.set('Cache-Control', 'no-store').json({ items });
  } catch (e) { bad(r, 504, e.name === 'AbortError' ? 'Pencarian terlalu lama, coba lagi.' : 'Server tidak bisa mencari lagu sekarang.'); }
  finally { clearTimeout(to); }
});
/* Ambil link audio dari balasan JSON apa pun bentuknya: utamakan ekstensi audio, lalu key download/mp3/audio/url. */
function muPick(j) {
  const SKIPK = /^(thumb|thumbnail|thumbnails|cover|image|images|poster|icon|avatar|channel|author|source|webpage|permalink)/i;
  const SKIPV = /(^https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\/|ytimg\.com|ggpht\.com)/i;
  const cands = [];
  const walk = (o, key, d) => {
    if (d > 7 || o == null || cands.length > 60) return;
    if (typeof o === 'string') {
      if (o.length > 2000 || !/^https?:\/\/[^\s]+$/i.test(o) || SKIPK.test(key) || SKIPV.test(o)) return;
      const ext = (/\.([a-z0-9]{2,5})$/i.exec(o.split(/[?#]/)[0]) || [])[1] || '';
      let sc = 0;
      if (/^(mp3|m4a|aac|opus|ogg|wav|webm)$/i.test(ext)) sc += 3;
      if (/^(mp4|mkv|mov)$/i.test(ext)) sc -= 1;
      if (/download|mp3|audio|dl/i.test(key)) sc += 2;
      else if (/^(url|link|src|file)$/i.test(key)) sc += 1;
      cands.push({ u: o, sc });
      return;
    }
    if (Array.isArray(o)) { o.slice(0, 40).forEach(x => walk(x, key, d + 1)); return; }
    if (typeof o === 'object') for (const k in o) walk(o[k], k, d + 1);
  };
  walk(j, '', 0);
  cands.sort((a, b) => b.sc - a.sc);
  return cands.length ? cands[0].u : null;
}
/* API musik utama: GET https://rizkyrohan.ai.id/api/ytplay?key=<key>&query=<judul>. Bentuk JSON dibaca fleksibel (muPick cari link audio-nya).
   Key bisa diganti lewat env MUSIC_API_KEY. */
const MU_KEY = process.env.MUSIC_API_KEY || 'rohan0a49a4d1e0fa7bfa';
async function muNexa(qs) {
  if (!qs) return null;
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 45000);
  try {
    const res = await fetch('https://rizkyrohan.ai.id/api/ytplay?' + new URLSearchParams({ key: MU_KEY, query: qs }).toString(), { signal: ac.signal, headers: { Accept: 'application/json', 'User-Agent': MU_UA } });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j) return null;
    const d = j.result != null ? j.result : j.data != null ? j.data : j;
    const u = muPick(d);
    if (!u || !muSafe(u)) return null;
    const ext = (/\.([a-z0-9]{2,5})$/i.exec(u.split(/[?#]/)[0]) || [])[1] || (d && (d.extension || d.ext || d.format)) || '';
    return { url: u, ext };
  } catch (e) { return null; }
  finally { clearTimeout(to); }
}
async function muResolve(id, qs) {
  /* Sumber utama: ekstraksi langsung YouTube (musify-audio.js); ditandai yt supaya /mu memakai Range per potongan */
  if (musifyAudio && /^[\w-]{11}$/.test(id)) {
    try { const ex = await musifyAudio.extract(id); if (ex && ex.url) return { url: ex.url, ext: /webm/.test(ex.mime) ? 'webm' : 'm4a', yt: id }; }
    catch (e) { console.log('[musik] ekstrak YouTube gagal: ' + (e.code || '') + ' ' + e.message); }
  }
  const nx = await muNexa(qs);
  if (nx) return nx;
  const yt = id.length === 11 ? 'https://www.youtube.com/watch?v=' + id : id.length === 22 ? 'https://open.spotify.com/track/' + id : '';
  if (!yt) return null;
  const tries = [
    'https://api.azbry.com/api/download/ytmp3?' + new URLSearchParams({ url: yt }).toString(),
    '' + new URLSearchParams({ url: yt }).toString()
  ];
  for (const ep of tries) {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 45000);
    try {
      const res = await fetch(ep, { signal: ac.signal, headers: { Accept: 'application/json', 'User-Agent': MU_UA } });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j) continue;
      const u = muPick(j.result != null ? j.result : j.data != null ? j.data : j);
      if (u && muSafe(u)) return { url: u, ext: '' };
    } catch (e) { /* coba layanan berikutnya */ }
    finally { clearTimeout(to); }
  }
  return null;
}
app.post('/api/music/play', lim, auth, async (q, r) => {
  const id = String((q.body && q.body.id) || '').trim();
  if (!/^[\w-]{8,40}$/.test(id)) return bad(r, 400, 'ID lagu tidak valid.');
  const hit = MUR.get(id);
  if (!(q.body && q.body.fresh) && hit && hit.exp > Date.now() && MU.has(hit.tok)) return r.set('Cache-Control', 'no-store').json({ src: '/mu/' + hit.tok });
  try {
    const qs = muClean(((q.body && q.body.title) || '') + ' ' + ((q.body && q.body.artist) || ''), 120) || ('https://www.youtube.com/watch?v=' + id);
    const u = await muResolve(id, qs), tok = u && muTok(u.url, u.ext, u.yt);
    if (!tok) return bad(r, 502, 'Layanan musik tidak memberi audio untuk lagu ini, coba lagu lain.');
    while (MUR.size >= 200) MUR.delete(MUR.keys().next().value);
    MUR.set(id, { tok, exp: Date.now() + 3000e3 });
    r.set('Cache-Control', 'no-store').json({ src: '/mu/' + tok });
  } catch (e) { bad(r, 504, 'Gagal menghubungi layanan musik.'); }
});

/* ===== Lagu untukmu (lagi naik daun) + lirik =====
   Daftar mengacu pada Spotify Charts Indonesia terbaru yang ditemukan (Juni 2026); ganti isi MU_TREND kapan saja.
   Tiap judul dicari ke YouTube lalu hasilnya di-cache 6 jam. Lirik dari lrclib.net (berjalan / polos). */
const MU_TREND = ['Sesi Potret eñau Ari Lesmana', 'Jangan Paksa Rindu Beda Ifan Seventeen', 'Iqro Raim Laode', 'Bersenja Gurau Raim Laode', 'Bahagia Lagi Piche Kota', 'bergema sampai selamanya Nadhif Basalamah', 'Ini Abadi Perunggu', 'Monolog Pamungkas', 'Ada Titik-Titik di Ujung Doa Sal Priadi', 'Kota Ini Tak Sama Tanpamu'];
let MUT = { at: 0, items: [] };
app.post('/api/music/trending', lim, auth, async (q, r) => {
  if (MUT.items.length && Date.now() - MUT.at < 6 * 3600e3) return r.set('Cache-Control', 'no-store').json({ items: MUT.items });
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 30000);
  try {
    const got = await Promise.all(MU_TREND.map(t => muSearchList(t, ac.signal).then(l => l[0] || null).catch(() => null)));
    const seen = new Set(), items = got.filter(x => x && !seen.has(x.id) && seen.add(x.id));
    if (!items.length) return bad(r, 502, 'Daftar lagu belum bisa dimuat.');
    MUT = { at: Date.now(), items }; r.set('Cache-Control', 'no-store').json({ items });
  } catch (e) { bad(r, 504, 'Daftar lagu terlalu lama dimuat.'); }
  finally { clearTimeout(to); }
});
const MUL = new Map();
function muLrc(t) { return String(t || '').split('\n').map(l => { const m = /^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/.exec(l.trim()); return m ? { t: +m[1] * 60 + parseFloat(m[2]), s: m[3] } : null; }).filter(x => x && x.s); }
const muLyClean = t => String(t || '').replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, ' ').replace(/\b(official|music|lyric|lyrics|lirik|video|audio|clip|mv|hd|hq|4k|visualizer|remastered|full|version|ost)\b/gi, ' ').replace(/\b(ft|feat|featuring)\.?\s.*$/i, ' ').replace(/\s+-\s+topic$/i, '').replace(/[“”"]/g, ' ').replace(/\s+/g, ' ').trim();
/* Pencocokan lirik: judul/artis dinormalkan (tanpa aksen & tanda baca) lalu dibandingkan per kata, supaya lirik lagu lain dengan judul mirip tidak ikut terpilih. */
const lyNorm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' dan ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const lyTok = t => lyNorm(t).split(' ').filter(Boolean);
const LY_NOISE = new Set(['official', 'music', 'video', 'audio', 'lyric', 'lyrics', 'lirik', 'clip', 'mv', 'hd', 'hq', 'remastered', 'topic', 'vevo', 'the', 'a', 'feat', 'ft', 'dan', 'and']);
function lyTitleSim(ytTitle, lrcTitle, artistToks) {
  const strip = arr => { const o = arr.filter(w => !LY_NOISE.has(w)); const o2 = o.filter(w => !artistToks.has(w)); return o2.length ? o2 : o; };
  const x = strip(lyTok(ytTitle)), y = strip(lyTok(lrcTitle));
  if (!x.length || !y.length) return 0;
  const sy = new Set(y), inter = x.filter(w => sy.has(w)).length;
  return (2 * inter) / (x.length + y.length);
}
function lyArtistSim(ytAll, lrcArtist) {
  const a = lyTok(lrcArtist).filter(w => !LY_NOISE.has(w)); if (!a.length) return 0;
  const hay = new Set(ytAll); return a.filter(w => hay.has(w)).length / a.length;
}
function muLyCands(title, artist) {
  const raw = String(title || '').replace(/[|｜]/g, ' - '), t = muLyClean(raw), a = muLyClean(artist).replace(/\s*(official|vevo|music)\s*$/i, '').trim(), out = [];
  const add = (x, y) => { x = String(x || '').trim(); y = String(y || '').trim(); if (x && !out.some(o => o[0].toLowerCase() === x.toLowerCase() && o[1].toLowerCase() === y.toLowerCase())) out.push([x, y]); };
  const parts = t.split(/\s+[-–—]\s+/).map(x => x.trim()).filter(Boolean);
  if (parts.length >= 2) { add(parts.slice(1).join(' '), parts[0]); add(parts[0], parts.slice(1).join(' ')); }
  add(t, a); add(t, '');
  return out.slice(0, 4);
}
async function muLyFetch(url, signal) {
  try { const res = await fetch(url, { signal, headers: { Accept: 'application/json', 'User-Agent': 'AllToolsZyrexDep/1.0' } }); return res.ok ? await res.json().catch(() => null) : null; } catch (e) { return null; }
}
async function muLyFind(title, artist, dur, signal) {
  const cands = muLyCands(title, artist), ytTitle = muLyClean(String(title || '').replace(/[|｜]/g, ' - ')), ytArtist = muLyClean(artist);
  const ytAll = lyTok(ytTitle + ' ' + ytArtist);
  const pool = new Map(), put = d => { if (d && typeof d === 'object' && !d.instrumental && (d.syncedLyrics || d.plainLyrics)) pool.set(d.id || (d.trackName + '|' + d.artistName + '|' + d.duration), d); };
  const urls = [];
  for (const [t, a] of cands) {
    if (a) urls.push(['get', 'https://lrclib.net/api/get?' + new URLSearchParams({ track_name: t, artist_name: a, ...(dur ? { duration: dur } : {}) })]);
    urls.push(['search', 'https://lrclib.net/api/search?' + new URLSearchParams(a ? { track_name: t, artist_name: a } : { track_name: t })]);
  }
  urls.push(['search', 'https://lrclib.net/api/search?' + new URLSearchParams({ q: (ytArtist + ' ' + ytTitle).trim() })]);
  const got = await Promise.all(urls.slice(0, 9).map(([k, u]) => muLyFetch(u, signal)));
  got.forEach(g => { if (Array.isArray(g)) g.forEach(put); else put(g); });
  let best = null, bestScore = -1e9;
  for (const d of pool.values()) {
    const aTok = new Set(lyTok(d.artistName).concat(lyTok(ytArtist)));
    const ts = Math.max(...cands.map(([t]) => lyTitleSim(t, d.trackName, aTok)), lyTitleSim(ytTitle, d.trackName, aTok));
    if (ts < 0.6) continue;
    const as = lyArtistSim(ytAll, d.artistName), diff = dur && d.duration ? Math.abs(dur - d.duration) : 0, synced = !!d.syncedLyrics;
    if (as === 0 && !(ts >= 0.99 && dur && d.duration && diff <= 3)) continue;   // artis tidak cocok: hanya diterima kalau judul persis & durasi hampir sama
    const score = ts * 4 + as * 2.5 + (synced ? 1.5 : 0) + (!dur || !d.duration ? 0.5 : diff <= 3 ? 2.5 : diff <= 8 ? 1 : -Math.min(diff, 60) / 8);
    if (score > bestScore) { bestScore = score; best = d; }
  }
  if (best) return best;
  const ac = cands.map(c => c[1]).filter(Boolean);
  for (const [t, a] of cands) { if (!a) continue; const j = await muLyFetch('https://api.lyrics.ovh/v1/' + encodeURIComponent(a) + '/' + encodeURIComponent(t), signal); if (j && j.lyrics && String(j.lyrics).trim()) return { plainLyrics: String(j.lyrics), trackName: t, artistName: a }; }
  return null;
}
app.post('/api/music/lyrics', lim, auth, async (q, r) => {
  const b = q.body || {}, title = muClean(b.title, 160), artist = muClean(b.artist, 80), dur = Math.round(+b.dur || 0);
  if (!title) return bad(r, 400, 'Judul lagu kosong.');
  const key = (title + '|' + artist + '|' + dur).toLowerCase(), hit = MUL.get(key);
  if (hit) return r.set('Cache-Control', 'no-store').json(hit);
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 25000);
  try {
    const d = await muLyFind(title, artist, dur, ac.signal);
    const out = d ? { lines: muLrc(d.syncedLyrics), plain: String(d.plainLyrics || '').replace(/\r/g, '').slice(0, 20000), name: muClean(d.trackName, 120), artist: muClean(d.artistName, 80), diff: dur && d.duration ? Math.round(dur - d.duration) : 0 } : null;
    if (!out || (!out.lines.length && !out.plain)) return bad(r, 404, 'Lirik lagu ini belum ada di database. Coba lagu versi aslinya.');
    while (MUL.size >= 150) MUL.delete(MUL.keys().next().value);
    MUL.set(key, out); r.set('Cache-Control', 'no-store').json(out);
  } catch (e) { bad(r, 504, 'Lirik tidak bisa dimuat sekarang.'); }
  finally { clearTimeout(to); }
});

const MUG = new Map();
app.post('/api/music/suggest', lim, auth, async (q, r) => {
  const qs = muClean(q.body && q.body.q, 60); if (!qs) return r.json({ items: [] });
  const k = qs.toLowerCase(), c = MUG.get(k); if (c) return r.set('Cache-Control', 'no-store').json({ items: c });
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 6000);
  try {
    const res = await fetch('https://suggestqueries.google.com/complete/search?' + new URLSearchParams({ client: 'firefox', ds: 'yt', hl: 'id', q: qs }), { signal: ac.signal, headers: { 'User-Agent': MU_UA } });
    const j = await res.json().catch(() => null), items = (Array.isArray(j) && Array.isArray(j[1]) ? j[1] : []).map(x => muClean(x, 80)).filter(Boolean).slice(0, 8);
    while (MUG.size >= 300) MUG.delete(MUG.keys().next().value);
    MUG.set(k, items); r.set('Cache-Control', 'no-store').json({ items });
  } catch (e) { r.json({ items: [] }); }
  finally { clearTimeout(to); }
});
function muServeBuf(t, range, r) {
  const n = t.buf.length; let s = 0, e = n - 1, code = 200;
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (m) {
    if (m[1] === '' && m[2] !== '') s = Math.max(0, n - parseInt(m[2], 10));
    else { s = m[1] ? parseInt(m[1], 10) : 0; if (m[2] !== '') e = Math.min(n - 1, parseInt(m[2], 10)); }
    if (s > e || s >= n) return r.status(416).set('Content-Range', 'bytes */' + n).end();
    code = 206;
  }
  const hd = { 'Content-Type': t.type, 'Accept-Ranges': 'bytes', 'Content-Length': e - s + 1, 'Cache-Control': 'no-store' };
  if (code === 206) hd['Content-Range'] = 'bytes ' + s + '-' + e + '/' + n;
  r.status(code).set(hd).end(t.buf.subarray(s, e + 1));
}
app.get(/^\/mu\/([a-f0-9]{24})$/, async (q, r) => {
  const t = MU.get(q.params[0]);
  if (!t) return r.status(404).type('text/plain').send('Link lagu kedaluwarsa, putar ulang dari aplikasi.');
  const range = q.get('range');
  if (t.yt && musifyAudio) {
    const ac2 = new AbortController(); r.on('close', () => ac2.abort());
    try {
      let o;
      try { o = await musifyAudio.openStream(t.url, { range, signal: ac2.signal }); }
      catch (e) {
        if (!e || e.code !== 'SOURCE_FORBIDDEN') throw e;
        const ex = await musifyAudio.extract(t.yt, { force: true, signal: ac2.signal });   // URL kedaluwarsa: ekstrak ulang sekali
        t.url = ex.url; o = await musifyAudio.openStream(t.url, { range, signal: ac2.signal });
      }
      const hd = Object.assign({}, o.headers, { 'Cache-Control': 'no-store' });
      if (o.status === 416) return r.status(416).set(hd).end();
      if (!range) { delete hd['content-range']; if (o.total) hd['content-length'] = o.total; }
      r.status(range ? o.status : 200).set(hd);
      o.stream.on('error', () => r.destroy()).pipe(r);
    } catch (e) { if (!r.headersSent) r.status(502).type('text/plain').send('Gagal memutar audio.'); else r.destroy(); }
    return;
  }
  if (t.buf) return muServeBuf(t, range, r);
  const ac = new AbortController(); r.on('close', () => ac.abort());
  try {
    const fh = { 'User-Agent': MU_UA, Accept: '*/*' }; if (range) fh.Range = range;
    const res = await fetch(t.url, { signal: ac.signal, headers: fh });
    if (!res.ok || !res.body) return r.status(502).type('text/plain').send('Gagal mengambil audio.');
    const ct = String(res.headers.get('content-type') || '').split(';')[0].toLowerCase();
    const ext = ((/\.([a-z0-9]{2,5})$/i.exec(t.url.split(/[?#]/)[0]) || [])[1] || '').toLowerCase();
    const he = ext || t.ext || '';
    const type = /^audio\//.test(ct) ? ct : /^video\/mp4$/.test(ct) ? 'audio/mp4' : ({ m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', opus: 'audio/ogg', webm: 'audio/webm', wav: 'audio/wav' }[he] || 'audio/mpeg');
    if (range && res.status !== 206) {
      /* sumber tidak mendukung Range: simpan utuh di server lalu layani potongan sendiri supaya seek tetap jalan */
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length || buf.length > 80e6) return r.status(502).type('text/plain').send('File audio tidak valid.');
      t.buf = buf; t.type = type;
      return muServeBuf(t, range, r);
    }
    const hd = { 'Content-Type': type, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
    const cl = res.headers.get('content-length'); if (cl) hd['Content-Length'] = cl;
    const cr = res.headers.get('content-range'); if (cr) hd['Content-Range'] = cr;
    r.status(res.status === 206 ? 206 : 200).set(hd);
    Readable.fromWeb(res.body).on('error', () => r.destroy()).pipe(r);
  } catch (e) { if (!r.headersSent) r.status(502).type('text/plain').send('Gagal memutar audio.'); else r.destroy(); }
});

/* Catur online dipisah ke routes/chess.js */
/* ---------- Papan peringkat game: skor disimpan di data akun (u.gm), ikut pindah saat ganti username ---------- */
const GM_GAMES = [
  { id: 'snake', name: 'Snake', unit: 'skor' },
  { id: 'blast', name: 'Block Blast', unit: 'skor' },
  { id: 'chess', name: 'Catur', unit: 'poin' },
  { id: 'uno', name: 'UNO', unit: 'poin' },
  { id: 'geo', name: 'Geometry Dash', unit: 'level' }
];
const gmOf = (u) => (u.gm && typeof u.gm === 'object') ? u.gm : (u.gm = {});
const gmCell = (u, id) => { const c = gmOf(u)[id]; return c && typeof c === 'object' ? c : null; };
const gmAdd = (u, id, pts) => {   // Catur: tiap menang menambah poin + jumlah menang
  const gm = gmOf(u), c = gmCell(u, id) || { s: 0, w: 0, t: 0 };
  c.s += pts; c.w = (c.w || 0) + 1; c.t = Date.now(); gm[id] = c; save();
};
const gmBoard = (g, meKey) => {
  const rows = [];
  for (const k in users) { const u = users[k], c = gmCell(u, g.id); if (!u.banned && c && c.s > 0) rows.push({ k, u, s: c.s, w: c.w || 0, t: c.t || 0 }); }
  rows.sort((a, b) => b.s - a.s || a.t - b.t);   // skor sama: yang lebih dulu mencapai menang
  const out = rows.slice(0, 20).map((x, i) => ({ rank: i + 1, user: x.u.name, v: avV(x.u), s: x.s, w: x.w, bd: !!x.u.badge, dv: !!x.u.dev, me: x.k === meKey }));
  const mi = rows.findIndex(x => x.k === meKey);
  return { rows: out, total: rows.length, me: mi < 0 ? null : { rank: mi + 1, s: rows[mi].s, w: rows[mi].w } };
};
app.post('/api/gm/top', auth, (q, r) => r.set('Cache-Control', 'no-store').json({ games: GM_GAMES.map(g => ({ id: g.id, name: g.name, unit: g.unit, ...gmBoard(g, q.key) })) }));
app.post('/api/gm/score', lim, auth, (q, r) => {   // Snake & Block Blast: simpan skor tertinggi (apel = 10 poin, papan 20x20)
  const b = q.body || {};
  const gid = b.game;
  if (gid !== 'snake' && gid !== 'blast' && gid !== 'geo') return bad(r, 400, 'Game tidak dikenal.');
  const s = Math.floor(Number(b.score));
  if (!Number.isFinite(s) || s < 0 || s > (gid === 'snake' ? 4000 : gid === 'geo' ? 50 : 300000) || (gid === 'snake' && s % 10)) return bad(r, 400, 'Skor tidak valid.');
  const c = gmCell(q.u, gid), cur = c ? c.s : 0;
  if (s > cur) { gmOf(q.u)[gid] = { s, t: Date.now() }; save(); }
  r.json({ ok: 1, best: Math.max(s, cur) });
});
app.post('/api/gm/win', lim, auth, (q, r) => {   // Catur lawan AI: Mudah +1, Sedang +3, Sulit +6 (jeda minimal 40 detik antar laporan)
  const b = q.body || {}, uno = b.game === 'uno', lv = Math.floor(Number(uno ? b.bots : b.level)), pts = uno ? ({ 1: 2, 2: 4, 3: 6 }[lv]) : ({ 1: 1, 2: 3, 3: 6 }[lv]);
  if (!pts) return bad(r, 400, 'Level tidak valid.');
  const gm = gmOf(q.u), now = Date.now();
  if (now - (gm.aiAt || 0) < 40000) return r.json({ ok: 0 });
  gm.aiAt = now; gmAdd(q.u, uno ? 'uno' : 'chess', pts);
  r.json({ ok: 1, pts });
});
const gmWin = (k, pts, id) => { if (users[k]) gmAdd(users[k], id || 'chess', pts); };
require('./routes/chess.js')({ app, auth, bad, crypto, CHAT, saveChat, bcast, avV, isStaff, rmImg, closed: () => CLOSED, gmWin });
require('./routes/uno.js')({ app, auth, bad, crypto, CHAT, saveChat, bcast, avV, isStaff, rmImg, closed: () => CLOSED, gmWin });

app.use((e, q, r, n) => bad(r, 400, 'Permintaan tidak valid.'));
app.listen(PORT, '0.0.0.0', () => { console.log('All Tools ZyrexDep jalan di port ' + PORT); if (!users[OWNER_KEY]) console.log('Kode daftar akun ZyrexDepp: ' + OWNER_CODE + ' (juga ada di data/owner-code.txt)'); });
