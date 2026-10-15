/* Menjana public/helper-pbd.html dengan kod bookmarklet terbenam.
   Jalankan selepas mengedit tampal-pbd.js:
       node helper-pbd/bina-panduan.js
   Ia membina semula bookmarklet.txt DAN menyuntiknya ke dalam halaman panduan,
   supaya kod dalam panduan tidak pernah lari daripada sumbernya. */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const akar = path.join(dir, '..');

// ── Bina bookmarklet daripada sumber ──────────────────────────────────────────
// Buang komen blok sahaja, kemudian kecilkan indentasi — baris baru DIKEKALKAN.
// Jangan buang komen "//" dan jangan gabungkan baris: komen dalam-baris
// (cth "return true;  // nota") akan menelan kod pada baris berikutnya,
// dan regex yang mengandungi "//" boleh tersalah anggap sebagai komen.
let src = fs.readFileSync(path.join(dir, 'tampal-pbd.js'), 'utf8');
src = src.replace(/\/\*[\s\S]*?\*\//g, '');
src = src.split('\n').map(l => l.trim()).filter(l => l).join('\n');

// Sahkan sebelum dibungkus — bookmarklet rosak gagal secara senyap di pelayar
new Function(src);

const bookmarklet = 'javascript:' + encodeURIComponent(src);
fs.writeFileSync(path.join(dir, 'bookmarklet.txt'), bookmarklet);

// Lolos untuk atribut HTML (href butang seret)
const utkAtribut = bookmarklet.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const html = `<!DOCTYPE html>
<html lang="ms">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PBD HELPER - SK Sultan Ismail</title>
    <link rel="stylesheet" href="css/main.css">
    <link rel="stylesheet" href="css/mobile.css">
    <style>
        .hp-wrap { max-width: 860px; margin: 0 auto; padding: 20px; }
        .hp-kad { background:#fff; border-radius:14px; padding:22px 26px; margin-bottom:18px;
                  box-shadow:0 2px 12px rgba(15,23,42,.08); }
        .hp-kad h2 { margin:0 0 4px; font-size:19px; color:#0f172a; }
        .hp-kad h3 { margin:18px 0 8px; font-size:15px; color:#1e3a8a; }
        .hp-langkah { display:flex; gap:12px; margin-bottom:14px; align-items:flex-start; }
        .hp-no { flex:0 0 28px; height:28px; border-radius:50%; background:#0f766e; color:#fff;
                 display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; }
        .hp-isi { flex:1; padding-top:3px; line-height:1.6; }
        .hp-amaran { background:#fef2f2; border-left:5px solid #dc2626; padding:12px 16px;
                     border-radius:8px; color:#991b1b; margin:14px 0; line-height:1.6; }
        .hp-nota { background:#eff6ff; border-left:5px solid #2563eb; padding:12px 16px;
                   border-radius:8px; color:#1e40af; margin:14px 0; line-height:1.6; }
        .hp-drag { display:inline-block; background:#0f766e; color:#fff !important; padding:11px 24px;
                   border-radius:9px; text-decoration:none; font-weight:700; font-size:15px;
                   cursor:grab; box-shadow:0 3px 10px rgba(15,118,110,.35); }
        .hp-jadual { width:100%; border-collapse:collapse; margin:10px 0; font-size:14px; }
        .hp-jadual th { background:#f1f5f9; padding:9px; text-align:left; border:1px solid #e2e8f0; }
        .hp-jadual td { padding:9px; border:1px solid #e2e8f0; vertical-align:top; }
        kbd { background:#f1f5f9; border:1px solid #cbd5e1; border-bottom-width:2px;
              border-radius:5px; padding:2px 7px; font-size:12px; font-family:inherit; }
    </style>
</head>
<body>
<div class="hp-wrap">

    <div class="hp-kad" style="background:linear-gradient(135deg,#0f766e,#115e59);color:#fff;">
        <h2 style="color:#fff;">📋 PBD HELPER</h2>
        <p style="margin:6px 0 0;opacity:.9;line-height:1.6;">
            Memindahkan Tahap Penguasaan, Usaha Murid dan Ulasan Guru dari
            Sistem Rekod PBD terus ke borang SPPB, tanpa menaip semula satu per satu.
        </p>
        <a href="index.html" style="color:#fff;opacity:.85;font-size:13px;">← Kembali ke Utama</a>
    </div>

    <div class="hp-amaran">
        <strong>BACA DAHULU — tiada undo.</strong><br>
        SPPB menyimpan setiap nilai sebaik sahaja ia diisi, tanpa menunggu butang Simpan.
        Pastikan senarai dalam Sistem PBD sudah betul sebelum menampal.
        Nilai sedia ada di SPPB akan ditimpa.
    </div>

    <div class="hp-kad">
        <h2>Tiga medan wajib</h2>
        <p style="color:#475569;line-height:1.6;">
            Helper boleh mengisi ketiga-tiga medan wajib SPPB. Anda pilih yang mana
            satu dalam pratonton sebelum menyalin.
        </p>
        <table class="hp-jadual">
            <tr><th style="width:30%;">Medan</th><th>Nilai</th></tr>
            <tr><td><strong>Tahap Penguasaan</strong></td><td>TP1 hingga TP6</td></tr>
            <tr><td><strong>Usaha Murid</strong></td>
                <td>SANGAT TINGGI · TINGGI · SEDERHANA · RENDAH</td></tr>
            <tr><td><strong>Ulasan Guru</strong></td>
                <td>CEMERLANG · SEDERHANA · LEMAH</td></tr>
        </table>
        <h3>Cadangan automatik</h3>
        <table class="hp-jadual">
            <tr><th style="width:24%;">TP</th><th>Ulasan Guru</th><th>Usaha Murid</th></tr>
            <tr><td><strong>TP3 – TP6</strong></td><td>CEMERLANG</td><td>SANGAT TINGGI</td></tr>
            <tr><td><strong>TP1 – TP2</strong></td><td>SEDERHANA</td><td>TINGGI</td></tr>
        </table>
        <div class="hp-nota">
            <strong>Usaha murid bukan sama dengan pencapaian.</strong><br>
            Cadangan di atas diterbitkan daripada TP semata-mata. Murid yang berusaha
            kuat tetapi pencapaiannya rendah akan dicadangkan "TINGGI" sahaja — sila
            ubah sendiri dalam pratonton bagi murid seperti itu. Setiap nilai boleh
            diubah satu per satu sebelum disalin.
        </div>
    </div>

    <div class="hp-kad">
        <h2>Pasang sekali sahaja</h2>
        <p style="color:#475569;line-height:1.6;">
            Pastikan bar bookmark kelihatan
            (<kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd>),
            kemudian seret butang hijau ini ke atas bar tersebut — sama seperti
            helper ESIS.
        </p>
        <p style="margin:18px 0;"><a class="hp-drag" href="${utkAtribut}" onclick="return false;">📋 PBD HELPER</a></p>
        <p style="color:#64748b;font-size:13px;line-height:1.6;">
            Jika anda pernah memasang versi lama, <strong>padam dahulu</strong> —
            kod telah berubah dan versi lama tidak mengisi Usaha Murid atau Ulasan Guru.
        </p>
    </div>

    <div class="hp-kad">
        <h2>Cara guna</h2>
        <div class="hp-langkah"><div class="hp-no">1</div><div class="hp-isi">
            Dalam Sistem PBD, buka <strong>Analisa Pencapaian PBD</strong> →
            tab <strong>📋 Keputusan Kelas</strong>.
        </div></div>
        <div class="hp-langkah"><div class="hp-no">2</div><div class="hp-isi">
            Pilih <strong>Subjek</strong>, <strong>Tahun</strong>, <strong>Kelas</strong>
            dan <strong>Tempoh Penilaian</strong> yang sama seperti di SPPB.
        </div></div>
        <div class="hp-langkah"><div class="hp-no">3</div><div class="hp-isi">
            Klik <strong>📋 Salin untuk SPPB</strong>. Semak senarai yang dipaparkan —
            purata dibulatkan ke TP terhampir (4.50 → TP5). Baris bertanda ⚠️ ialah
            sempadan; sila semak dengan teliti. Anda boleh ubah TP, Usaha Murid dan
            Ulasan Guru bagi mana-mana murid di situ.<br><br>
            Gunakan tiga kotak pilihan di bahagian atas untuk memilih bahagian mana
            hendak diisi. Jika anda sudah mengisi Ulasan Guru sendiri, matikan kotak itu.
        </div></div>
        <div class="hp-langkah"><div class="hp-no">4</div><div class="hp-isi">
            Klik <strong>Salin ke Papan Klip</strong>.
        </div></div>
        <div class="hp-langkah"><div class="hp-no">5</div><div class="hp-isi">
            Buka SPPB → <strong>Keputusan → Pentaksiran Bilik Darjah → PBD/UASA</strong>,
            klik ikon pensel bagi kelas dan subjek <strong>yang sama</strong>.
            Tunggu sehingga senarai murid terpapar penuh.
        </div></div>
        <div class="hp-langkah"><div class="hp-no">6</div><div class="hp-isi">
            Klik bookmark <strong>PBD HELPER</strong>. Baca kotak pengesahan — ia memaparkan
            subjek dan kelas di kedua-dua belah, serta bahagian yang akan diisi.
            Jika betul, klik OK.
        </div></div>
        <div class="hp-langkah"><div class="hp-no">7</div><div class="hp-isi">
            <strong>Tunggu sehingga selesai.</strong> Jika Usaha Murid atau Ulasan Guru
            turut diisi, helper memproses murid satu demi satu dan mengambil kira-kira
            satu minit bagi 33 murid. Jangan tutup tab atau klik apa-apa semasa ia berjalan —
            kotak biru memaparkan kemajuannya.
        </div></div>
        <div class="hp-langkah"><div class="hp-no">8</div><div class="hp-isi">
            Baca laporan akhir — ia menyenaraikan berapa berjaya bagi setiap bahagian,
            dan murid mana yang gagal. Semak di skrin, isi yang tertinggal,
            kemudian tekan <strong>Hantar</strong> sendiri apabila berpuas hati.
        </div></div>
    </div>

    <div class="hp-kad">
        <h2>Apa helper ini buat — dan tidak buat</h2>
        <table class="hp-jadual">
            <tr><th style="width:50%;">✅ Buat</th><th>❌ Tidak buat</th></tr>
            <tr>
                <td>Isi Tahap Penguasaan, Usaha Murid, Ulasan Guru<br>
                    <span style="color:#64748b;font-size:13px;">(ikut pilihan anda)</span></td>
                <td>Tidak menekan Simpan atau Hantar borang</td>
            </tr>
            <tr>
                <td>Padan murid ikut No. Kad Pengenalan</td>
                <td>Tidak menyentuh lajur Intervensi</td>
            </tr>
            <tr>
                <td>Semak subjek dan kelas sebelum mengisi</td>
                <td>Tidak menukar Status</td>
            </tr>
            <tr>
                <td>Berhenti terus jika ada No. KP tidak padan</td>
                <td>Tidak mengisi murid yang tiada rekod PBD</td>
            </tr>
            <tr>
                <td>Sahkan No. KP dalam modal Ulasan sebelum menulis</td>
                <td>Tidak meneka nilai yang tiada dalam data</td>
            </tr>
        </table>
        <div class="hp-nota">
            <strong>Butang "Simpan" dalam modal Ulasan Guru.</strong><br>
            Helper menekan butang Simpan yang berada <em>di dalam</em> kotak Ulasan Guru —
            butang itu menyimpan ulasan seorang murid sahaja. Ia tidak sama dengan butang
            Simpan atau Hantar di bawah borang utama; kedua-dua itu tetap tangan anda.
        </div>
        <div class="hp-nota">
            <strong>Mengapa padanan ikut No. KP?</strong><br>
            Susunan murid di SPPB dan di Sistem PBD tidak semestinya sama. Padanan ikut
            nombor baris akan menyebabkan setiap TP tersasar satu baris apabila ada murid
            masuk atau keluar. Dengan No. KP, susunan tidak penting — dan jika ada
            seorang pun murid tidak padan, helper berhenti terus tanpa mengisi apa-apa.
        </div>
    </div>

    <div class="hp-kad">
        <h2>Jika ada masalah</h2>
        <table class="hp-jadual">
            <tr><th style="width:38%;">Mesej</th><th>Maksud &amp; tindakan</th></tr>
            <tr><td><strong>Data tidak dikenali</strong></td>
                <td>Papan klip tiada data PBD. Klik "Salin untuk SPPB" dahulu.</td></tr>
            <tr><td><strong>Jadual tidak dijumpai</strong></td>
                <td>Senarai murid belum terpapar. Klik ikon pensel dan tunggu sebentar.</td></tr>
            <tr><td><strong>Subjek tidak sepadan</strong></td>
                <td>Skrin SPPB bukan subjek yang disalin. Buka subjek betul, atau salin semula.</td></tr>
            <tr><td><strong>Kelas tidak sepadan</strong></td>
                <td>Skrin SPPB bukan kelas yang disalin. Buka kelas betul, atau salin semula.</td></tr>
            <tr><td><strong>No. KP tidak padan</strong></td>
                <td>Ada murid di SPPB yang tiada dalam rekod PBD. Semak kemasukan murid baru.</td></tr>
            <tr><td><strong>Bilangan murid berbeza</strong></td>
                <td>Senarai kedua-dua sistem tidak sama. Semak kelas dan tempoh penilaian.</td></tr>
            <tr><td><strong>Tiada bahagian dipilih</strong></td>
                <td>Ketiga-tiga kotak dimatikan dalam pratonton. Hidupkan sekurang-kurangnya satu.</td></tr>
            <tr><td><strong>Siap — dengan amaran</strong></td>
                <td>Sebahagian nilai tidak berjaya diisi. Laporan menyenaraikan murid mana;
                    isi yang tertinggal sendiri.</td></tr>
            <tr><td><strong>No. KP dalam modal tidak padan</strong></td>
                <td>Modal Ulasan membuka murid lain daripada yang dijangka. Helper menutupnya
                    tanpa menulis. Jika kerap berlaku, matikan kotak Ulasan Guru dan isi sendiri.</td></tr>
        </table>
    </div>

</div>
</body>
</html>
`;

fs.writeFileSync(path.join(akar, 'public', 'helper-pbd.html'), html);
console.log('bookmarklet: ' + (bookmarklet.length / 1024).toFixed(1) + ' KB');
console.log('ditulis: public/helper-pbd.html');
