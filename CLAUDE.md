# CLAUDE.md

Panduan untuk Claude Code apabila bekerja dengan repositori ini.

## Gambaran Projek

**Sistem Rekod PBD** — aplikasi web Pentaksiran Bilik Darjah untuk SK Sultan Ismail.
Vanilla HTML/CSS/JS, Firebase Firestore (compat SDK v9), Firebase Hosting.
Semua teks UI dalam Bahasa Malaysia.

**Firebase:** `hipersispbd` · **Hos:** https://hipersispbd.web.app

```bash
firebase deploy --only hosting
```

## Struktur

| Fail | Fungsi |
|---|---|
| `public/index.html` | Papan pemuka — 5 kad menu + 2 butang terapung |
| `public/rekod.html` + `js/rekod.js` | Masuk/edit rekod penilaian |
| `public/analisa.html` + `js/analisa.js` | 6 tab analisis + Isi Pantas PBD |
| `public/semakan.html` + `js/semakan.js` | Semakan pentadbir |
| `public/pengurusan-murid.html` + `js/murid.js` | Urus murid |
| `public/js/isipantas.js` | Jana rekod pukal + tulis semula TP sedia ada |
| `public/js/sync-murid.js` | Selaras murid ↔ rekod PBD |
| `public/helper-pbd.html` | Panduan pasang bookmarklet (DIJANA) |
| `helper-pbd/tampal-pbd.js` | Sumber bookmarklet SPPB |
| `helper-pbd/bina-panduan.js` | Pembina: `node helper-pbd/bina-panduan.js` |

## Koleksi Firestore

`murid` · `subjek` · `topik_pembelajaran` · `rekod_pbd` · `config` · `semakan_penilaian`

**`rekod_pbd` menyimpan SALINAN senarai murid** dalam array `murid`. Memadam atau
menambah murid dalam koleksi `murid` TIDAK mengemas kini salinan itu — gunakan
`sync-murid.js`, yang dipanggil secara automatik oleh fungsi padam/tambah.

### Bersih Murid Hantu — dua fasa, mesti melepaskan kawalan

Butang 🧹 di `pengurusan-murid.html`. Tahun+Kelas dipilih → satu kelas;
dibiarkan kosong → SEMUA kelas (38 kelas, ~9,200 rekod, ~80 saat imbasan).

Mod semua-kelas wujud kerana hantu tersebar: membersih satu demi satu bermakna
guru mesti meneka kelas mana terjejas. Kes sebenar 2026-10-16: **15 murid
hantu dalam 1,459 rekod merentasi 13 kelas** — warisan padaman sebelum
`sync-murid.js` wujud. Dibersihkan, disahkan sifar.

**Dua perkara yang MESTI dikekalkan:**
1. `await new Promise(r => setTimeout(r, 0))` antara setiap kelas dan setiap
   kepingan tulis. Tanpanya gelung tidak pernah melepaskan kawalan dan Chrome
   membekukan tab (disahkan: renderer tergantung, CDP timeout 45s).
2. Fasa 1 mengumpul **id rekod sahaja**, bukan dokumen penuh; fasa 2 membaca
   semula 100 pada satu masa. Menyimpan 1,459 dokumen (array 33 murid setiap
   satu) dalam memori sekali gus ialah punca yang sama.

## Pantang Firestore

- Jangan compound query tanpa index
- `.select()` TIDAK disokong oleh compat SDK v9
- Guna `Promise.all` untuk query serentak
- Jangan baca keseluruhan koleksi `rekod_pbd` (5,000+ dokumen dengan array 33 murid
  setiap satu — pelayar tergantung). Sentiasa tapis ikut kelas.

---

# PBD HELPER — bookmarklet ke SPPB

Memindahkan Tahap Penguasaan, Usaha Murid dan Ulasan Guru dari Sistem PBD ke
borang KPM di `moeissppb.moe.gov.my/keputusan/pbd/pbd`.

**Status: berfungsi 32/32 pada ketiga-tiga medan.**

Dua bahagian, berasingan kerana halaman di `hipersispbd.web.app` tidak boleh
menskrip halaman di `moe.gov.my`:

| Bahagian | Lokasi |
|---|---|
| Salin | `analisa.js` → `kptBukaPratontonSPPB`, `kptSalinSPPB` |
| Tampal | `helper-pbd/tampal-pbd.js` → bookmarklet |

Selepas mengedit sumber: `node helper-pbd/bina-panduan.js` (membina bookmarklet
DAN menjana semula halaman panduan).

## AMARAN — TIADA UNDO

SPPB menyimpan setiap nilai ke pangkalan data sebaik ia diisi, TANPA menunggu
butang Simpan. Disahkan: 32 TP kekal selepas muat semula dalam tab baharu,
sedangkan Simpan tidak pernah ditekan.

Dialog pengesahan SEBELUM mengisi ialah satu-satunya pagar keselamatan.
Jangan buang atau lemahkannya.

## Pagar keselamatan (jangan longgarkan)

- Padanan ikut **No. KP** — bukan nama, bukan susunan baris
- Satu No. KP tidak padan → BERHENTI, tiada apa diisi
- Subjek atau kelas tidak sepadan → BERHENTI (murid yang sama muncul dalam
  setiap subjek, jadi padanan No. KP sahaja membenarkan TP SAINS ditulis ke
  skrin PJK)
- Modal Ulasan disahkan terhadap No. KP sebelum ditulis
- Tidak pernah menyentuh Simpan/Hantar borang utama, Intervensi, atau Status

## Pelajaran Wave UI (SPPB guna Vue 3 + Wave UI)

Setiap satu di bawah menyebabkan kegagalan senyap dan mengambil masa untuk
dikesan. Jangan ulang.

**1. `offsetParent` tidak boleh dipercayai untuk overlay**
Modal ialah `position: fixed`, jadi `offsetParent` SENTIASA `null`. Menguji
`offsetParent !== null` menolak modal yang terbuka sepenuhnya.

**2. `opacity` tidak boleh dipercayai apabila tab di latar belakang**
Animasi masuk Vue (`fade-enter-from`) bergantung kepada `requestAnimationFrame`,
yang DIJEDA bila tab tidak aktif — modal kekal `opacity: 0` selama-lamanya
walaupun berfungsi penuh. Uji `display` + `visibility` sahaja.

**3. Ikon Ulasan ialah suis TOGOL**
Satu klik buka, klik lagi tutup. Menghantar klik kepada ikon + induk + `<td>` +
PointerEvent = bilangan genap = modal tertutup semula. **Satu klik sahaja.**
Pastikan modal sebelumnya tertutup sebelum membuka yang baharu, jika tidak
klik seterusnya menutupnya dan menghasilkan corak gagal berselang.

**4. Radio tersembunyi — klik `<label>`, bukan input**
Menetapkan `.checked = true` tidak dikesan Vue. ID radio (`w-radio--413`)
dijana semula setiap muat semula — padan ikut TEKS label, bukan ID.

**5. Item dropdown perlukan urutan event penuh**
`li.click()` tidak mendaftar. Klik `.w-list__item-label` (anak dalam) dengan
`mousedown` → `mouseup` → `click`.

**6. Menu dropdown melayang di luar baris**
Dipindahkan ke `div.w-app`; hanya SATU wujud pada satu masa. Sahkan pemilikan
melalui kelas `w-select--open` pada komponen, jika tidak nilai mendarat pada
murid yang salah. Tutup dengan mengklik semula dropdown itu — `body.click()`
membuang menu tetapi mengekalkan `--open`, merosakkan setiap dropdown selepasnya.

**7. Penanda "ulasan tersimpan" ialah `backgroundColor`, bukan `color`**
Ikon bertukar `rgb(60,179,113)` pada latar; warna teks kekal hitam.

**8. Ikon folder dirender LEWAT**
Hanya muncul selepas kategori dipilih. Tunggu kemunculannya.

**9. Rujukan DOM menjadi basi**
Menyimpan modal Ulasan menyebabkan Vue merender semula baris itu. Cari semula
baris ikut No. KP sebelum setiap tindakan (`cariBaris`).

## Flow Ulasan Guru (8 langkah)

```
ikon ✏️ → modal
radio kategori (CEMERLANG / SEDERHANA / LEMAH)
ikon folder-open → kotak "Sila Pilih"
butang "Pilih" → satu daripada 10 ayat (dipilih rawak)
Simpan (dalam modal)
sahkan latar ikon bertukar hijau
```

## Pemetaan TP (keputusan pengguna)

| TP | Ulasan Guru | Usaha Murid |
|---|---|---|
| 3–6 | CEMERLANG | SANGAT TINGGI |
| 1–2 | SEDERHANA | TINGGI |

Boleh diubah guru dalam pratonton. Nilai yang diubah guru tidak ditimpa apabila
TP ditukar.

## Membina bookmarklet — jangan gabungkan baris

Komen dalam-baris (`return true;  // nota`) akan menelan kod pada baris
berikutnya, dan regex yang mengandungi `//` tersalah anggap sebagai komen.
Buang komen blok sahaja, kekalkan `\n`. `bina-panduan.js` menjalankan
`new Function(src)` sebagai semakan sebelum membungkus.

---

# ISI PANTAS PBD

`public/js/isipantas.js` — **ikon ⚡ sahaja** di bawah kiri `analisa.html`.

Butang sengaja TANPA teks dan TANPA tooltip (opacity .28, terang bila hover).
Alat ini menulis dan boleh menimpa TP secara pukal, jadi ia tidak diiklankan
kepada guru biasa. Jangan tambah label kembali. Ini pagar "elak tersalah
tekan", BUKAN keselamatan — Firestore rules terbuka, sesiapa yang tahu boleh
panggil `ipBuka()` dari Console. "Buang janaan" kekal berlabel.

Menjana rekod bagi topik yang BELUM ada rekod, dan boleh juga **menulis semula
TP** rekod yang sudah ada. Guru menetapkan satu TP setiap murid; sistem
mencipta rekod untuk setiap topik kosong dalam tempoh dipilih.

Satu subjek satu darjah boleh ada 40+ subtopik: 40 topik × 33 murid = 1,320
kemasukan manual, menjadi 33 klik.

- Pratonton memaparkan setiap topik; guru boleh buang mana-mana
- Setiap rekod ditanda `dijana_auto` + `dijana_kumpulan` → ikon 🗑️ "Buang janaan"

## Duplikat — dua pagar dalam `ipSimpan`

Berlaku sebenar DUA kali: PSV TIGA HIGEN (beza 9 saat) dan PJK SATU PIXEL
(7 saat) — guru menekan "Simpan" dua kali semasa janaan berjalan, menghasilkan
dua set rekod penuh dengan `dijana_kumpulan` berbeza. Purata TP murid dikira
dua kali, dan angka itu masuk ke SPPB.

**Pagar 1 — kunci klik berganda.** `ipSedangSimpan` menolak panggilan kedua;
butang dimatikan (`disabled`, opacity .5, teks "Menyimpan…"). Dibuka semula
dalam `finally`, jika tidak satu ralat mengunci butang selamanya.

**Pagar 2 — semak semula sebelum menulis.** `ipTopikKosong` ialah snapshot
ketika "Jana" ditekan. Sebelum menulis, `ipSimpan` membaca semula Firestore
dan menapis topik yang sudah ada rekod dalam tempoh itu (`pilihSah`). Ini
menangkap duplikat walaupun pagar 1 gagal — termasuk dari tab lain atau guru
lain. Semua penulisan mesti guna `pilihSah`, BUKAN `pilih`.

Diuji pada data sebenar: 3 topik P2 yang sudah ada rekod → sifar dicipta.

## Buang janaan — senarai kumpulan

Ikon 🗑️ sebelah ⚡ (juga tanpa teks). Rekod dikumpulkan ikut `dijana_kumpulan`
(`IP<millis>`) — satu kumpulan = satu kali tekan "Jana". Masa dibaca terus dari
ID, tiada bacaan tambahan. Guru menanda kumpulan; terbaharu di atas.

Kumpulan yang berkongsi subjek+kelas ditanda **⚠️ berganda** — itu tanda
tersilap tekan Jana dua kali.

Dahulu ia `prompt()` meminta nama subjek, dan medan kosong bermakna "padam
janaan SEMUA subjek semua kelas". Jangan kembali ke corak itu: salah eja
senyap, dan satu Enter memusnahkan janaan yang sah.
- Tarikh diagih merentasi tempoh, melangkau hujung minggu (Terengganu: Jumaat–
  Sabtu) dan cuti; tidak pernah melepasi hari ini
- Cadangan TP diambil daripada purata rekod sedia ada murid

## Tulis semula TP (rewrite)

Pratonton ada DUA bahagian: **➕ TOPIK BAHARU** (ditanda default) dan
**♻️ TULIS SEMULA** (TIDAK ditanda — guru mesti menandanya sendiri).

Setiap baris "tulis semula" menunjukkan tarikh rekod dan label sumber:
`auto` (`dijana_auto === true`) atau **`manual`** (guru isi di `rekod.html`).
Menanda rekod manual mencetuskan **dialog pengesahan kedua**.

Tulis semula menukar `tp` + `penguasaan` + ketiga-tiga `jumlah_*` SAHAJA.
Dikekalkan: tarikh, nama guru, aktiviti kelas, **catatan setiap murid**.
Ditanda `ditulis_semula: true` + `ditulis_semula_pada` sebagai jejak audit.

### Pagar keselamatan (jangan longgarkan)

- **TIADA UNDO** — TP lama hilang terus. Default tidak ditanda ialah pagar utama.
- Padanan ikut **No. KP**, bukan susunan baris — array `murid` rekod lama boleh
  tersusun lain. Murid dalam rekod lama tetapi TIADA dalam senarai aktif (cth
  murid pindah) **tidak disentuh**; TP asal mereka kekal.
- Satu topik boleh ada beberapa rekod dalam tempoh sama (dinilai dua kali).
  Hanya rekod bertarikh **TERKINI** ditulis semula — menimpa kesemuanya
  memadam sejarah penilaian.
- Rekod dibaca dahulu (`Promise.all`) sebelum `batch.update`, bukan ditimpa
  dengan `set` — itulah yang mengekalkan catatan guru.
- Tulis semula TIDAK menetapkan `dijana_auto`, jadi butang "Buang janaan"
  (tapis `dijana_auto == true`) tidak akan membuang rekod manual yang ditulis
  semula.

---

# Purata TP — tafsiran yang betul

`kptPurataMurid` dalam `analisa.js`: **hanya topik yang murid BENAR-BENAR
dinilai dikira.** `tpArr[i] === 0` bermaksud tiada rekod, bukan TP 0.

Mengira 0 dalam pembahagi menurunkan purata sehingga satu tahap penuh
(cth 4,5,4 daripada 5 topik: 13/5 = 2.60 → TP3, sepatutnya 13/3 = 4.33 → TP4).
Angka ini ditampal ke rekod rasmi KPM — mesti tepat.

Pembundaran: `Math.round` standard (4.50 → TP5), dihadkan 1–6.

---

# Cache Firebase Hosting

`firebase.json` menetapkan `no-cache` untuk `**/*.html` dan `**/*.@(js|css)`.
Lalai Firebase ialah `max-age=3600` — setiap deploy mengambil masa sejam untuk
sampai kepada guru, dan pembaikan kelihatan tidak berkesan sedangkan ia sudah
live. Sahkan dengan `curl -sI` sebelum menganggap kod yang salah.
