ALL TOOLS ZYREXDEP — VERSI FILE TERPISAH & DIPROTEKSI
=====================================================

Struktur:
- index.html        : kerangka halaman
- public/css/style.css : semua gaya (sudah di-minify)
- public/js/api.js      : helper dasar ($, store, api())
- public/js/app.js      : aplikasi utama (akun, beranda, tab, dsb)
- public/js/games.js    : halaman Game, Snake, Catur
- public/js/cave.js     : latar tema Goa Kristal
- public/js/theme.js    : menu tema
- public/js/chess-engine.js : aturan catur + AI
- public/js/zproteksi.js    : blokir klik kanan / shortcut devtools dasar
- routes/chess.js  : API catur online (room kode, chat, undangan)
- server.js, package.json, musify-audio.js : seperti sebelumnya
- robots.txt        : minta crawler yang patuh tidak mengindeks situs

Cara pakai: ekstrak ZIP, jangan ubah susunan folder, jalankan seperti biasa
(node server.js). Taruh robots.txt di root domain kalau dipakai di panel.

APA YANG DILAKUKAN DI SINI:
1. Semua file JS di public/js/ di-minify (esbuild: hapus komentar/spasi,
   pendekkan nama variabel LOKAL). Nama fungsi/variabel yang dipakai
   LINTAS FILE (api, store, $, GM, GMA, Chess, show, dst) sengaja TIDAK
   diubah, supaya file-file yang saling memanggil tetap berfungsi.
2. Semua teks string (pesan, label, kelas CSS yang dipakai lewat JS, dst)
   diacak urutannya dan dienkode (base64 + XOR per file), lalu dipanggil
   lewat fungsi dekoder saat halaman jalan. Jadi kalau file ini dibuka di
   editor teks biasa, isinya bukan lagi kalimat yang terbaca, melainkan
   kode acak dan panggilan fungsi dekoder.
3. CSS juga di-minify (whitespace & komentar dibuang).
4. zproteksi.js + CSS kecil mencegah klik kanan, drag gambar, seleksi teks
   di luar kolom input, dan beberapa shortcut pembuka devtools (F12,
   Ctrl/Cmd+Shift+I/J/C, Ctrl/Cmd+U).
5. robots.txt meminta crawler yang patuh (Google, Bing, dst) tidak
   mengindeks/mengambil isi situs.

BATASAN YANG PERLU DISADARI (PENTING, JANGAN DIABAIKAN):
- Obfuscation ini BUATAN SENDIRI (karena tidak ada akses internet/npm di
  sini untuk memakai javascript-obfuscator asli). Efeknya serupa: kode
  jadi sulit dibaca manusia, tapi SECARA TEKNIS SIAPA PUN YANG NIAT tetap
  bisa menjalankan kode ini di console browser untuk membongkar isi
  string (tinggal panggil fungsi dekodernya sendiri). Ini memperlambat,
  bukan menghentikan.
- Blokir klik kanan / F12 / Ctrl+U GAMPANG DILEWATI: browser tetap bisa
  dibuka devtools-nya lewat menu (⋮ > Lebih banyak alat > Developer
  tools), lewat ekstensi, atau dengan mematikan JavaScript sebentar.
  Ini hanya mencegah "iseng ringan", bukan orang yang serius.
- robots.txt hanya diikuti oleh crawler yang PATUH. Scraper atau bot yang
  tidak niat baik mengabaikannya sepenuhnya.
- Tampilan HTML/CSS/gambar TETAP bisa dilihat lewat "View Page Source"
  pada halaman yang sudah dirender, atau lewat tab Network — ini berlaku
  untuk SEMUA website, tidak bisa dihindari karena browser memang harus
  menerima kode itu supaya halamannya bisa tampil.
- Perlindungan yang SUNGGUH berarti tetap ada di server.js dan
  routes/chess.js: validasi langkah catur, cek token, rate limit — itu
  TIDAK pernah dikirim ke browser sama sekali, jadi itulah yang benar-
  benar aman, bukan file di public/js/.

Jangan taruh API key atau data rahasia di public/js/ — anggap semua isi
folder public/ pasti bisa dibaca orang lain, obfuscation atau tidak.


CATATAN PERUBAHAN TERBARU (panel88)
-----------------------------------
1. Halaman Game: ada dock bawah "Game | Peringkat". Tab Peringkat menampilkan papan juara tiap game
   (Snake = skor tertinggi, Catur = total poin menang). Juara 1 diberi mahkota emas.
   - Server: data/users.json (field gm di tiap akun, ikut pindah saat ganti username).
   - API baru di server.js: /api/gm/top, /api/gm/score (Snake), /api/gm/win (Catur lawan AI).
   - routes/chess.js: pemenang Catur online otomatis +5 poin (min. 10 langkah, bukan klaim timeout).
   - Poin Catur lawan AI: Mudah +1, Sedang +3, Sulit +6 (dilaporkan klien, jeda minimal 40 detik).
2. Tema "Goa Kristal" diganti jadi "Hijau Mint" (id tetap: cave). Gelap bawaan + mode terang
   (pilihan di menu Tema, tersimpan di perangkat). Latar: public/bg.jpg + lapisan gelap.
   GANTI public/bg.jpg dengan gambar kamu sendiri (nama file harus sama).
   Font dimuat dari Google Fonts (Space Grotesk, Space Mono, Montserrat miring tebal).
3. app.js, games.js, theme.js dienkode ulang dengan dekoder UTF-8, jadi teks seperti "°C" dan "…"
   tampil benar (sebelumnya jadi "Â°" dan "â¦"). File ini tidak lagi di-minify penuh, hanya teksnya diacak.

4. (panel89) Game baru "Block Blast": papan 8x8, 3 balok ditarik ke papan, hancurkan baris/kolom.
   Ada skor, terbaik (masuk Peringkat), tombol foto: satu foto dipakai di SEMUA balok (tombol X untuk
   kembali ke balok warna). Setiap hancur ada suara renyah; kalau papan kosong semua: bonus +300 dan
   suara "Gaaacoooor!". Suara itu memakai suara baca (TTS) bawaan HP. Mau suara asli? Taruh file
   public/gacor.mp3, otomatis dipakai.

5. (panel90) File JS/CSS di index.html diberi ?v=90 supaya cache browser/Cloudflare tidak menyajikan versi lama.
   Kalau ada update lagi, naikkan angka v di index.html. Setelah upload, restart server dan purge cache Cloudflare.

6. (panel91) Block Blast: foto sekarang SATU gambar utuh yang terpotong di seluruh papan (bukan foto per kotak),
   makin banyak balok terpasang makin kelihatan fotonya. Lebih ringan: gambar balok di-cache, papan hanya digambar
   ulang saat perlu, resolusi canvas dibatasi, suara lebih hemat. Foto lama perlu dipilih ulang.

7. (panel92) Game baru "UNO" (kartu 108 asli: angka, Lewati, Balik, +2, Pilih Warna, +4; aturan UNO!/Tangkap).
   Mode: Lawan AI (1-3 lawan), Lawan Teman (2-4 pemain gantian di satu HP, ada layar serah-terima),
   Online (buat room / gabung kode, 2-4 pemain, host menekan Mulai). Tombol "Undang Global" mengirim pesan
   ke Global Chat berisi tombol "Gabung main UNO" yang langsung masuk ke room.
   File baru: public/js/uno-engine.js (aturan, dipakai klien + server), public/js/uno.js (tampilan),
   routes/uno.js (room online, kartu tiap pemain disimpan di server). UNO masuk papan Peringkat
   (poin: menang vs AI +2/+4/+6 sesuai jumlah lawan, menang online +5).

8. (panel93) Tombol & kartu UI UNO kini mengikuti tema aktif: Hijau Mint (mint + garis 1px + bayangan lembut,
   termasuk mode terang), Neo (garis tebal + bayangan kotak), Neumorphism (timbul/tenggelam), iOS (biru).

9. (panel94) RCH: batas emoji naik dari 10 jadi 30 per kirim (ubah lewat env RCH_MAX_EMOJI, maks 100). Kalau API izzxd menolak daftar panjang, turunkan angkanya.

10. (panel95) Maintenance tools: Developer / Admin / Owner melihat tombol "Atur maintenance tools" di tab Tools.
    Tiap tool bisa ditutup sementara (dengan pesan opsional). Pengguna biasa melihat label Maintenance dan tool tidak bisa
    dibuka; server juga menolak permintaan ke tool itu (503). Pengelola tetap bisa membuka untuk mengetes.
    Disimpan di data/fx.json (field maint). Daftar API tiap tool ada di TOOL_API (server.js).
11. Game baru "Geometry Dash": 50 level (dibuat otomatis dari nomor level), ketuk/tahan untuk lompat. Makin tinggi level:
    makin kencang (x1.0 sampai x2.15) dan makin banyak duri/blok. Level tertinggi yang diselesaikan masuk Peringkat ("level").
    File baru: public/js/geo-core.js (generator + fisika), public/js/geo.js (tampilan), public/js/maint.js.

12. (panel96) Role baru RESS dan PARTNER.
    - Ress: perk setara VIP + bisa memberi role VIP. Partner: perk setara Owner + bisa memberi role VIP dan Owner.
    - Keduanya punya tombol "Panel Reseller" di tab Tools (isi username, pilih role, lama hari, maks 365 hari).
      Ress/Partner/Admin/Developer tidak bisa diubah lewat panel ini; role yang lebih tinggi tidak bisa diturunkan.
      Semua pemberian dicatat di data/grants.json (Developer melihat riwayat semua di panel yang sama).
    - Developer memberi role Ress/Partner lewat Panel Admin, atau menjualnya di Toko Zyrex: kartu role Ress dan Partner
      muncul di tab Role, harga dan hari bisa diubah Developer (bawaan Rp 50.000 dan Rp 100.000, 30 hari).

CATATAN PANEL RESELLER (panel97):
- Ress bisa memberi VIP (hari atau permanen) dan mencabut VIP.
- Partner bisa memberi VIP & Owner (hari atau permanen) dan mencabut VIP & Owner.
- Setiap pemberian/pencabutan masuk notifikasi Developer ("username A menambahkan B ke VIP"),
  tampil sebagai toast otomatis + kartu Notifikasi di Panel Reseller (data/notif.json).

CATATAN REQUEST & LAPORAN (panel98):
- Tombol lampu di samping tombol musik membuka halaman "Request & Laporan": Req Game, Req Fitur, Req Tools, Report Bug.
- Masuk ke Developer/Admin (data/requests.json): toast otomatis + titik merah di tombol, dan bisa diubah statusnya (Diproses/Selesai/Ditolak).
- Pengguna melihat status kirimannya. Batas: jeda 20 detik, maksimal 10 kiriman per hari.

CATATAN ROLE TK (panel102):
- Role "TK" diberikan Developer lewat Panel Admin (dropdown role, tombol Add).
- Fitur tanpa batas seperti Developer (kuota harian semua tool, jumlah AM Bulk) dan perk Owner.
- Bisa menambahkan dan mencabut VIP, Owner, Ress (hari atau permanen) lewat Panel Reseller. Tidak bisa atur harga, tidak punya Panel Admin. Partner/TK/Admin tidak bisa diberikan atau dicabut oleh TK.
- Setiap penambahan dan pencabutan oleh TK masuk notifikasi Developer.

CATATAN PANEL99+ (panel100):
- Panel Admin: pilihan role sekarang berupa dropdown (tekan panah, pilih role, tekan Add), bukan deretan tombol geser. Role TK ikut ada di dropdown.
- Toko Zyrex: kartu role TK muncul sebagai produk ke-5 (harga dan hari diatur Developer).


CATATAN PERUBAHAN (panel104)
----------------------------
1. Global Chat: tag @username.
   - Ketik "@" di kolom pesan -> muncul saran username (yang online di atas, bisa difilter dengan mengetik huruf).
     Ketuk salah satu untuk memasukkan. Di komputer: panah atas/bawah + Enter/Tab, Esc untuk menutup.
   - Server mencatat tag yang valid (hanya username terdaftar, tidak diblokir) di field `mn` pesan.
     API baru: POST /api/chat/users {q} -> daftar saran (maks 8).
   - Di pesan, @username ditandai biru; kalau yang di-tag adalah kamu, bubble diberi garis kuning, dan lencana
     tombol Global Chat jadi oranye + getar singkat sampai chat dibuka.
   - File baru: public/js/mention.js (dimuat setelah app.js).
2. Intro: animasi goa hanya tampil saat pertama kali (penanda localStorage "ayd_cave_seen"). Sesudah itu langsung
   ke sidik jari. Mau lihat animasi goa lagi: hapus data situs / localStorage key tersebut.


CATATAN PERUBAHAN (panel106)
----------------------------
1. Tema baru "Kertas Pin" (id: paper) di menu Tema: kertas krem bergaris ala buku tulis, kartu putih kertas,
   tiap kartu (judul, tile, tool, game, sheet) ditancap pin warna-warni (merah, biru, kuning, hijau) yang digambar
   dengan CSS/SVG, bukan emoji. Kartu goyang sebentar (berayun dari titik pin) saat dipencet.
   - public/js/paper.js : efek goyang. Font judul: Caveat (Google Fonts).
2. Perbaikan: di mode lewati animasi (panel105), layar sidik jari kini hilang normal setelah berhasil masuk.


CATATAN PERUBAHAN (panel107)
----------------------------
1. Tema "Kertas Pin": ada mode Putih dan Gelap (pilihan di menu Tema, tersimpan di perangkat, bawaan Putih).
   Mode gelap = kertas coklat gelap bergaris. Kunci simpan: localStorage "ayd_paper_mode".
2. Tema "Kertas Pin": font diganti San Francisco (bold). Di iPhone/iPad/Mac otomatis memakai SF asli;
   di Android/Windows memakai Inter sebagai pengganti terdekat (SF tidak boleh dipasang sebagai file web).
   Ketebalan bisa diubah lewat --pw (teks biasa, bawaan 600) dan --pwh (judul, bawaan 800) di style.css.
3. Global Chat (SEMUA tema): emoji di pesan, kutipan balasan, dan reaksi tampil bergaya iPhone (gambar emoji Apple
   dari CDN jsDelivr, paket emoji-datasource-apple@15.0.1). Kalau gambar gagal dimuat, kembali ke emoji perangkat.
   File baru: public/js/emoji.js. Butuh internet ke cdn.jsdelivr.net.
4. Cache: style.css dan theme.js dinaikkan ke ?v=107. Setelah upload, restart server dan purge cache Cloudflare.
