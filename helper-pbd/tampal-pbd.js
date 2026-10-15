/* ============================================================
   Bookmarklet "PBD HELPER" — dijalankan di moeissppb.moe.gov.my
   Pasangan kepada butang "Salin untuk SPPB" dalam Sistem Rekod PBD
   (Analisa Pencapaian PBD > tab Keputusan Kelas).

   KUNCI PADANAN: No. Kad Pengenalan (bukan nama, bukan susunan).

   Mengisi tiga medan wajib SPPB:
     Tahap Penguasaan  — radio TP1..TP6 dalam baris
     Usaha Murid       — dropdown: SANGAT TINGGI / TINGGI / SEDERHANA / RENDAH
     Ulasan Guru       — modal dengan radio: CEMERLANG / SEDERHANA / LEMAH
   Guru memilih bahagian mana nak diisi (medan `isi` dalam data).

   PRINSIP (jangan ubah):
   - JANGAN sentuh Simpan/Hantar borang utama, Intervensi, atau dropdown Status
     (butang "Simpan" DALAM modal Ulasan adalah pengecualian — ia menyimpan
      ulasan murid itu sahaja, bukan menghantar borang)
   - Murid tiada TP = DILANGKAU
   - Mana-mana noKP tak padan = BERHENTI, tiada apa diisi
   - Subjek atau kelas tak sepadan = BERHENTI, tiada apa diisi
   - Modal Ulasan disahkan terhadap No. KP murid sebelum diklik; jika tidak
     padan, modal ditutup tanpa perubahan

   AMARAN — TIADA UNDO:
   SPPB menyimpan setiap TP ke pangkalan data sebaik radio diklik, TANPA
   menunggu butang Simpan. Disahkan melalui ujian: 32 TP kekal selepas muat
   semula dalam tab baharu, sedangkan Simpan tidak pernah ditekan.
   Oleh itu dialog pengesahan SEBELUM mengisi ialah satu-satunya pagar
   keselamatan — bukan sekadar peringatan. Jangan buang atau lemahkannya.

   Atas sebab yang sama, semakan subjek + kelas adalah WAJIB: murid yang sama
   muncul dalam setiap subjek, jadi padanan noKP sahaja membenarkan TP SAINS
   ditampal ke skrin PJK dan tersimpan serta-merta tanpa amaran.

   NOTA TEKNIKAL — SPPB guna Vue.js:
   Radio asli disembunyikan; yang dipapar ialah div.w-radio__input.
   Menetapkan .checked = true TIDAK berkesan — Vue tidak akan perasan dan
   borang akan dihantar kosong. Mesti klik <label for="..."> supaya Vue
   menerima event sebenar. ID radio (w-radio--413) dijana semula setiap
   muat semula, jadi padanan mesti ikut TEKS label TP1-TP6, bukan ID.
   ============================================================ */
(function () {
  'use strict';

  function bersihKP(v) {
    return String(v || '').replace(/\D/g, '');
  }

  function papar(tajuk, isi, warna) {
    var lama = document.getElementById('pesanPBD');
    if (lama) lama.remove();
    var k = document.createElement('div');
    k.id = 'pesanPBD';
    k.style.cssText =
      'position:fixed;top:18px;right:18px;z-index:2147483647;background:#fff;' +
      'border-left:6px solid ' + warna + ';box-shadow:0 6px 24px rgba(0,0,0,.28);' +
      'border-radius:9px;padding:17px 21px;max-width:430px;max-height:82vh;overflow:auto;' +
      'font:14px/1.55 system-ui,-apple-system,sans-serif;color:#15181e';
    var h = document.createElement('div');
    h.style.cssText = 'font-weight:700;font-size:15.5px;margin-bottom:9px';
    h.textContent = tajuk;
    var b = document.createElement('div');
    b.style.cssText = 'white-space:pre-wrap';
    b.textContent = isi;
    var t = document.createElement('button');
    t.textContent = 'Tutup';
    t.style.cssText = 'margin-top:13px;background:#374151;color:#fff;border:0;' +
      'border-radius:6px;padding:7px 15px;cursor:pointer;font-size:13px';
    t.onclick = function () { k.remove(); };
    k.appendChild(h); k.appendChild(b); k.appendChild(t);
    document.body.appendChild(k);
  }

  /* Baca jadual SPPB:
     Bil | Nama | ID Pengenalan | Jantina | Tahap Penguasaan | Ulasan | Intervensi | Usaha | Status
     Lajur TP mengandungi 6 radio tersembunyi + label TP1..TP6. */
  function bacaSPPB() {
    var out = [];
    document.querySelectorAll('tr').forEach(function (baris) {
      var sel = baris.querySelectorAll('td');
      if (sel.length < 5) return;
      var bil = (sel[0].textContent || '').trim();
      if (!/^\d+$/.test(bil)) return;

      // Cari sel yang mengandungi radio TP
      var selTP = null;
      for (var i = 0; i < sel.length; i++) {
        if (sel[i].querySelector('input[type="radio"]')) { selTP = sel[i]; break; }
      }
      if (!selTP) return;

      // Petakan TP1..TP6 -> label yang perlu diklik (ikut teks, bukan ID)
      var petaTP = {};
      selTP.querySelectorAll('input[type="radio"]').forEach(function (r) {
        var lab = r.id ? selTP.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(r.id) : r.id) + '"]') : null;
        if (!lab) return;
        var m = (lab.textContent || '').trim().match(/TP\s*([1-6])/i);
        if (m) petaTP[parseInt(m[1], 10)] = { label: lab, radio: r };
      });
      if (!Object.keys(petaTP).length) return;

      /* Lajur selepas TP: Ulasan Guru (ikon), Intervensi (ikon),
         Usaha Murid (dropdown), Status (dropdown).
         Ulasan = ikon PERTAMA selepas lajur TP.
         Usaha  = dropdown PERTAMA; Status = dropdown kedua (jangan sentuh). */
      var idxTP = -1;
      for (var t = 0; t < sel.length; t++) { if (sel[t] === selTP) { idxTP = t; break; } }

      var ikonUlasan = null, selUsaha = null;
      for (var c = idxTP + 1; c < sel.length; c++) {
        if (!ikonUlasan && sel[c].querySelector('.w-icon')) ikonUlasan = sel[c].querySelector('.w-icon');
        if (!selUsaha && sel[c].querySelector('.w-select__selection')) {
          selUsaha = sel[c].querySelector('.w-select__selection');
          break;   // berhenti di dropdown pertama — yang kedua ialah Status
        }
      }

      out.push({
        bil: parseInt(bil, 10),
        nama: (sel[1].textContent || '').trim(),
        kp: bersihKP(sel[2].textContent),
        petaTP: petaTP,
        ikonUlasan: ikonUlasan,
        selUsaha: selUsaha
      });
    });
    return out;
  }

  /* Baca konteks di kepala halaman SPPB: Mata Pelajaran, Kelas, Tahun/Tingkatan.
     Digunakan untuk menghalang tampalan ke subjek atau kelas yang salah — padanan
     ikut noKP sahaja tidak cukup, kerana murid yang sama muncul dalam setiap subjek. */
  function bacaKonteksSPPB() {
    var teks = document.body.innerText || '';
    function ambil(label) {
      var m = teks.match(new RegExp(label + '\\s*:?\\s*\\n+\\s*([^\\n]+)', 'i'));
      return m ? m[1].trim() : '';
    }
    return {
      subjek: ambil('Mata Pelajaran'),
      kelas: ambil('Kelas'),
      tahun: ambil('Tahun / Tingkatan')
    };
  }

  /* Normalisasi nama subjek untuk perbandingan.
     Sistem PBD dan SPPB mengeja subjek berbeza, cth:
       "PEND. JASMANI DAN KESIHATAN" lwn "PENDIDIKAN JASMANI DAN PENDIDIKAN KESIHATAN"
     Singkatan dipanjangkan, tanda baca dan kata hubung dibuang sebelum dibandingkan. */
  function normalSubjek(s) {
    return String(s || '')
      .toUpperCase()
      .replace(/\./g, ' ')
      .replace(/\bPEND\b/g, 'PENDIDIKAN')
      .replace(/\bBM\b/g, 'BAHASA MELAYU')
      .replace(/\bBI\b/g, 'BAHASA INGGERIS')
      .replace(/\bMT\b/g, 'MATEMATIK')
      .replace(/\bSN\b/g, 'SAINS')
      .replace(/\bPJPK\b/g, 'PENDIDIKAN JASMANI PENDIDIKAN KESIHATAN')
      .replace(/\bPSV\b/g, 'PENDIDIKAN SENI VISUAL')
      .replace(/\bPI\b/g, 'PENDIDIKAN ISLAM')
      .replace(/\bRBT\b/g, 'REKA BENTUK TEKNOLOGI')
      .replace(/\bTMK\b/g, 'TEKNOLOGI MAKLUMAT KOMUNIKASI')
      .replace(/\bDAN\b|\bSERTA\b/g, ' ')
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim();
  }

  /* Adakah dua nama subjek merujuk perkara sama?
     Perbandingan ikut SET PERKATAAN, bukan subrentetan: "PENDIDIKAN JASMANI
     KESIHATAN" bukan subrentetan "PENDIDIKAN JASMANI PENDIDIKAN KESIHATAN"
     kerana "PENDIDIKAN" berulang, walaupun kedua-duanya subjek yang sama.
     Padanan apabila set perkataan satu pihak merangkumi set satu lagi. */
  function subjekSepadan(a, b) {
    var x = normalSubjek(a), y = normalSubjek(b);
    if (!x || !y) return true;              // tiada maklumat — jangan halang
    if (x === y) return true;

    function setKata(s) {
      var u = {};
      s.split(' ').forEach(function (w) { if (w) u[w] = 1; });
      return Object.keys(u);
    }
    var sx = setKata(x), sy = setKata(y);
    function rangkum(a1, b1) {
      return a1.every(function (w) { return b1.indexOf(w) !== -1; });
    }
    return rangkum(sx, sy) || rangkum(sy, sx);
  }

  /* ── Usaha Murid: dropdown Vue ──────────────────────────────────────────
     Menu dipindahkan ke div.w-app (di luar baris), dan hanya SATU menu boleh
     terbuka pada satu masa. Jadi aliran mesti: buka → pilih → sahkan tertutup,
     sebelum baris seterusnya. Jangan buka beberapa serentak. */
  /* Menu yang BENAR-BENAR terbuka.
     Selepas memilih, Vue mengekalkan div.w-menu dalam DOM dengan opacity:0
     dan offsetParent masih bukan null — jadi offsetParent sahaja tidak cukup
     untuk mengesan menu tertutup. Opacity yang membezakannya. */
  /* Adakah ada dropdown terbuka?

     Sumber kebenaran ialah kelas `w-select--open` pada komponen, BUKAN
     opacity menu. Vue menganimasikan menu masuk dan keluar, jadi opacity
     melalui nilai pertengahan dalam kedua-dua arah; mengujinya menghasilkan
     jawapan yang salah pada saat peralihan — menu sah ditolak kerana belum
     sempat muncul penuh. */
  function menuTerbuka() {
    if (!document.querySelectorAll('.w-select--open').length) return null;
    var m = document.querySelectorAll('div.w-menu');
    for (var i = 0; i < m.length; i++) {
      if (m[i].querySelectorAll('li.w-list__item').length) return m[i];
    }
    return null;
  }

  /* Cari semula baris murid dari DOM SEMASA, ikut No. KP.

     WAJIB sebelum setiap tindakan — jangan guna rujukan elemen yang disimpan
     semasa bacaan awal. Menyimpan modal Ulasan menyebabkan Vue merender semula
     baris berkenaan; rujukan lama kemudian menunjuk kepada elemen yang sudah
     dibuang dari dokumen. Mengkliknya tidak melakukan apa-apa DAN tidak
     menimbulkan ralat — medan nampak kosong tanpa sebarang amaran.
     Inilah sebab lajur Usaha Murid kekal kosong apabila Ulasan diisi dahulu. */
  function cariBaris(kp) {
    var jumpa = null;
    document.querySelectorAll('tr').forEach(function (baris) {
      if (jumpa) return;
      var sel = baris.querySelectorAll('td');
      if (sel.length < 5) return;
      if (!/^\d+$/.test((sel[0].textContent || '').trim())) return;
      if (bersihKP(sel[2].textContent) !== kp) return;

      var selTP = null, idxTP = -1;
      for (var i = 0; i < sel.length; i++) {
        if (sel[i].querySelector('input[type="radio"]')) { selTP = sel[i]; idxTP = i; break; }
      }
      if (!selTP) return;

      var ikonUlasan = null, selUsaha = null;
      for (var c = idxTP + 1; c < sel.length; c++) {
        if (!ikonUlasan && sel[c].querySelector('.w-icon')) ikonUlasan = sel[c].querySelector('.w-icon');
        if (!selUsaha && sel[c].querySelector('.w-select__selection')) {
          selUsaha = sel[c].querySelector('.w-select__selection');
          break;
        }
      }
      jumpa = { ikonUlasan: ikonUlasan, selUsaha: selUsaha };
    });
    return jumpa;
  }

  /* Tunggu sehingga syarat() benar, memeriksa setiap 80ms sehingga had masa.
     Vue merender menu secara tak segerak dan kelajuannya berbeza ikut mesin
     dan beban halaman — menunggu tempoh tetap menyebabkan kegagalan rawak
     pada komputer yang perlahan. Menunggu KEADAAN, bukan MASA. */
  function tunggu(syarat, had, siap) {
    var mula = Date.now();
    (function semak() {
      var hasil = syarat();
      if (hasil) return siap(hasil);
      if (Date.now() - mula >= had) return siap(null);
      setTimeout(semak, 30);
    })();
  }

  /* Tutup sebarang menu yang masih terbuka, kemudian tunggu ia hilang.

     WAJIB sebelum membuka dropdown baru. SPPB membuang div.w-menu dari DOM
     apabila ditutup dan hanya SATU menu wujud pada satu masa — jadi jika menu
     murid lain masih terbuka, menuTerbuka() akan memulangkan menu ITU, dan
     klik mendarat pada murid yang salah. Disahkan melalui ujian: membuka
     dropdown murid #1 sedang menu murid #3 terbuka menyebabkan murid #3
     yang menerima nilai. */
  /* Tutup setiap dropdown yang Vue anggap terbuka, dengan MENGKLIK SEMULA
     dropdown itu sendiri.

     JANGAN guna document.body.click(): menu hilang dari skrin tetapi Vue
     mengekalkan kelas `w-select--open` pada komponen. Keadaan menjadi tidak
     selaras — klik seterusnya ditafsir Vue sebagai "tutup", jadi dropdown
     murid berikutnya LANGSUNG tidak boleh dibuka, dan setiap murid selepas
     itu gagal berturut-turut. Itulah sebab lajur Usaha Murid kekal kosong.

     Mengklik semula dropdown yang sama ialah tindakan yang Vue sendiri
     jangkakan, jadi kelas `--open` ditanggalkan dengan betul. */
  function tutupMenu(siap) {
    var buka = document.querySelectorAll('.w-select--open');
    if (!buka.length && !menuTerbuka()) return siap();

    var senarai = [], i = 0;
    for (var b = 0; b < buka.length; b++) {
      var inp = buka[b].querySelector('.w-select__selection');
      if (inp) senarai.push(inp);
    }

    (function seterusnya() {
      if (i >= senarai.length) {
        // Sahkan keadaan benar-benar bersih sebelum meneruskan
        return tunggu(function () {
          return (!document.querySelectorAll('.w-select--open').length && !menuTerbuka()) ? true : null;
        }, 1800, function () { siap(); });
      }
      try { senarai[i++].click(); } catch (e) {}
      setTimeout(seterusnya, 120);
    })();
  }

  /* Komponen w-select yang memiliki input ini (pembungkus terdekat). */
  function komponenSelect(selSel) {
    var p = selSel;
    for (var i = 0; i < 6 && p; i++) {
      if (p.classList && p.classList.contains('w-select')) return p;
      p = p.parentElement;
    }
    return null;
  }

  function pilihUsaha(selSel, nilai, siap) {
    var komp = komponenSelect(selSel);
    if (!komp) return siap(false, 'komponen dropdown tidak dikenali');

    // Mulakan dengan keadaan bersih — tiada dropdown lain terbuka
    tutupMenu(function () {
      if (document.querySelectorAll('.w-select--open').length) {
        return siap(false, 'dropdown lain tersangkut terbuka');
      }

      try { selSel.click(); } catch (e) { return siap(false, 'gagal buka'); }

      /* Tunggu menu muncul DAN sahkan ia milik dropdown INI.
         Menu dipindahkan ke div.w-app di luar baris, jadi ia tidak boleh
         dikaitkan melalui DOM. Yang boleh dipercayai: Vue menandakan hanya
         komponen yang benar-benar terbuka dengan kelas `w-select--open`.
         Tanpa semakan ini, menu milik murid lain akan diterima dan nilai
         mendarat pada murid yang salah — disahkan berlaku dalam ujian. */
      tunggu(function () {
        // Pemilikan disahkan oleh kelas --open pada komponen ini.
        if (!komp.classList.contains('w-select--open')) return null;
        /* Jangan tapis menu ikut opacity di sini: Vue menganimasikan menu
           masuk, jadi pada saat --open muncul, opacity masih 0 dan sedang
           naik. Menapis ikut opacity menyebabkan menu yang SAH ditolak,
           kemudian ditutup — itulah "kelipan" yang dilihat di skrin.
           Cukup: komponen ini --open, dan ada menu berisi pilihan. */
        var semua = document.querySelectorAll('div.w-menu');
        for (var i = 0; i < semua.length; i++) {
          if (semua[i].querySelectorAll('li.w-list__item').length) return semua[i];
        }
        return null;
      }, 2500, function (menu) {
        if (!menu) {
          return tutupMenu(function () {
            siap(false, komp.classList.contains('w-select--open')
              ? 'menu tidak dirender' : 'dropdown tidak terbuka');
          });
        }

        var pilihan = menu.querySelectorAll('li.w-list__item');
        var jumpa = null;
        for (var j = 0; j < pilihan.length; j++) {
          if ((pilihan[j].textContent || '').trim().toUpperCase() === nilai) { jumpa = pilihan[j]; break; }
        }
        if (!jumpa) {
          var ada = [];
          for (var k = 0; k < pilihan.length; k++) ada.push((pilihan[k].textContent || '').trim());
          return tutupMenu(function () {
            siap(false, '"' + nilai + '" tiada (ada: ' + ada.join('/') + ')');
          });
        }

        /* Mesti klik .w-list__item-label (anak dalam) dengan urutan event penuh.
           li.click() sahaja TIDAK mendaftar — disahkan melalui ujian langsung. */
        var sasar = jumpa.querySelector('.w-list__item-label') || jumpa;
        try {
          ['mousedown', 'mouseup', 'click'].forEach(function (t) {
            sasar.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
          });
        } catch (e) {
          return tutupMenu(function () { siap(false, 'gagal klik'); });
        }

        // Tunggu nilai masuk ke DROPDOWN INI — bukan mana-mana dropdown
        tunggu(function () {
          return String(selSel.value || '').trim().toUpperCase() === nilai ? true : null;
        }, 2000, function (masuk) {
          tutupMenu(function () {
            if (masuk) return siap(true, '');
            siap(false, 'nilai tidak masuk (kekal "' + (selSel.value || 'kosong') + '")');
          });
        });
      });
    });
  }

  /* ── Ulasan Guru: modal dengan radio + butang Simpan sendiri ───────────
     Modal memaparkan Nama dan ID Pengenalan — disahkan terhadap murid yang
     dijangka SEBELUM mengklik apa-apa. Jika tidak padan, modal ditutup tanpa
     sebarang perubahan: lebih baik terlepas seorang daripada menulis ulasan
     kepada murid yang salah. */
  /* Klik ikon Ulasan.

     Wave UI memasang pengendali klik pada pembungkus, bukan pada <i> itu
     sendiri. Mengklik <i> sahaja mencetuskan
     "Cannot read properties of null (reading '$el')" dalam wave-ui — event
     diterima tetapi komponen tidak dibuka. Oleh itu cuba ikon, kemudian
     setiap induk sehingga <td>, sehingga modal benar-benar muncul. */
  /* Buka modal Ulasan Guru.

     Wave UI menolak klik tiruan pada ikon ini: event sampai tetapi komponen
     tidak dibuka, dan wave-ui membuang
     "Cannot read properties of null (reading '$el')". Punca paling mungkin
     ialah semakan event.isTrusted, yang tidak boleh dipalsukan dari skrip.

     Tiga pendekatan dicuba berturut-turut, daripada paling biasa kepada
     paling dalam. Yang pertama berjaya menghentikan baki. */
  /* SATU klik sahaja — jangan sekali-kali lebih.

     Ikon ini ialah suis togol: klik membuka modal, klik lagi menutupnya.
     Versi terdahulu menghantar klik kepada ikon, setiap induknya, <td>, DAN
     satu siri PointerEvent — bilangan genap, jadi modal dibuka lalu ditutup
     semula sebelum sempat diperiksa. Itulah sebab "modal tidak dibuka" pada
     kesemua 32 murid, sedangkan klik tunggal berfungsi dengan sempurna.

     Disahkan melalui ujian langsung: ikon.click() tunggal → modal terbuka
     (display:flex, opacity:1); klik berganda → tiada dialog dalam DOM. */
  function klikIkon(ikon) {
    try { ikon.click(); } catch (e) {}
  }

  /* Adakah ada modal Ulasan terbuka sekarang? */
  function modalTerbuka() {
    var s = document.querySelectorAll('[role=dialog],.w-dialog,.w-overlay');
    for (var i = 0; i < s.length; i++) {
      var g = getComputedStyle(s[i]);
      if (g.display !== 'none' && g.visibility !== 'hidden' &&
          s[i].querySelectorAll('input[type=radio]').length) return s[i];
    }
    return null;
  }

  /* Pastikan tiada modal terbuka sebelum membuka yang baharu.

     Ikon Ulasan ialah suis togol. Jika modal murid sebelumnya masih
     terbuka, klik seterusnya MENUTUPNYA dan bukan membuka modal murid
     baharu — murid itu gagal, murid selepasnya berjaya, menghasilkan
     corak gagal berselang (7, 9, 11, 13…). Disahkan dalam ujian 19/32.

     Menutup melalui butang Tutup, bukan klik ikon: mengklik ikon akan
     menogol semula dan masalahnya berulang. */
  function pastikanTiadaModal(siap) {
    var dlg = modalTerbuka();
    if (!dlg) return siap();

    var btn = dlg.querySelectorAll('button');
    for (var i = 0; i < btn.length; i++) {
      if ((btn[i].textContent || '').trim() === 'Tutup') {
        try { btn[i].click(); } catch (e) {}
        break;
      }
    }
    tunggu(function () { return modalTerbuka() ? null : true; }, 2000,
      function () { siap(); });
  }

  function isiUlasan(ikon, kpJangka, nilai, siap) {
    // Modal sebelumnya mesti tertutup dahulu — ikon ialah suis togol
    pastikanTiadaModal(function () { bukaDanIsi(); });
    return;

    function bukaDanIsi() {
    try { klikIkon(ikon); } catch (e) { return siap(false, 'gagal buka'); }

    /* Tunggu modal muncul DAN radionya siap dirender (sehingga 3s).

       JANGAN tapis ikut offsetParent: modal Wave UI ialah overlay
       `position: fixed`, dan offsetParent SENTIASA null untuk elemen fixed.
       Semakan itu menolak modal yang sah dan melaporkan "modal tidak
       dibuka" sedangkan ia terbuka sepenuhnya (display:flex, opacity:1).
       Itulah punca sebenar kegagalan Ulasan Guru — bukan isTrusted, bukan
       SPPB menolak klik. Gunakan display + opacity sahaja. */
    /* JANGAN uji opacity di sini. Animasi masuk Vue (`fade-enter-`)
       bergantung kepada requestAnimationFrame, yang DIJEDA apabila tab
       berada di latar belakang — modal kekal pada opacity:0 selama-lamanya
       walaupun ia terbuka sepenuhnya dan boleh diguna. Menguji opacity
       menolak modal yang sah. Wujud + ada radio sudah memadai. */
    tunggu(function () {
      var semua = document.querySelectorAll('[role=dialog],.w-dialog,.w-overlay');
      for (var i = 0; i < semua.length; i++) {
        var g = getComputedStyle(semua[i]);
        if (g.display !== 'none' && g.visibility !== 'hidden' &&
            semua[i].querySelectorAll('input[type=radio]').length) return semua[i];
      }
      return null;
    }, 3000, function (dlg) {
      if (!dlg) return siap(false, 'modal tidak dibuka');

      function tutup(sebab) {
        var btn = dlg.querySelectorAll('button');
        for (var i = 0; i < btn.length; i++) {
          if ((btn[i].textContent || '').trim() === 'Tutup') { try { btn[i].click(); } catch (e) {} break; }
        }
        // Tunggu modal benar-benar tertutup, jangan teka tempohnya
        tunggu(function () {
          /* Sama seperti pengesanan buka: offsetParent tidak boleh
             dipercayai untuk overlay position:fixed. */
          var g = getComputedStyle(dlg);
          return (g.display === 'none' || g.visibility === 'hidden' ||
                  !document.contains(dlg)) ? true : null;
        }, 2000, function () { siap(false, sebab); });
      }

      // Sahkan modal ini milik murid yang betul
      var kpModal = (dlg.textContent || '').replace(/\D/g, '');
      if (kpJangka && kpModal.indexOf(kpJangka) === -1) return tutup('No. KP dalam modal tidak padan');

      var radio = dlg.querySelectorAll('input[type=radio]');
      var sasar = null;
      for (var r = 0; r < radio.length; r++) {
        var lab = radio[r].id
          ? dlg.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(radio[r].id) : radio[r].id) + '"]')
          : null;
        if (lab && (lab.textContent || '').trim().toUpperCase() === nilai) { sasar = lab; break; }
      }
      if (!sasar) return tutup('pilihan "' + nilai + '" tidak dijumpai');

      // Label radio bertindak balas kepada .click(), tetapi urutan event penuh
      // lebih selamat merentas komponen Vue yang berbeza.
      try {
        ['mousedown', 'mouseup', 'click'].forEach(function (t) {
          sasar.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
        });
      } catch (e) { return tutup('gagal klik'); }

      // Tunggu radio benar-benar tertanda — jangan simpan ulasan kosong/salah
      tunggu(function () {
        for (var r2 = 0; r2 < radio.length; r2++) {
          if (radio[r2].checked || radio[r2].getAttribute('aria-checked') === 'true') {
            var l2 = radio[r2].id
              ? dlg.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(radio[r2].id) : radio[r2].id) + '"]')
              : null;
            if (l2 && (l2.textContent || '').trim().toUpperCase() === nilai) return true;
          }
        }
        return null;
      }, 2000, function (tertanda) {
        if (!tertanda) return tutup('pilihan tidak tertanda');

        /* Medan "Ulasan*" muncul selepas kategori dipilih dan WAJIB diisi —
           tanpanya butang Simpan ditolak. Ia mungkin dropdown berisi ayat
           siap sedia, atau kotak teks bebas; kedua-duanya dikendalikan.
           Ayat dipilih secara rawak supaya 34 murid tidak menerima ulasan
           yang serupa perkataan demi perkataan. */
        isiMedanUlasan(dlg, function () {
          // Butang Simpan DALAM MODAL sahaja — bukan Simpan borang utama
          var btn = dlg.querySelectorAll('button'), simpan = null;
          for (var i = 0; i < btn.length; i++) {
            if ((btn[i].textContent || '').trim() === 'Simpan') { simpan = btn[i]; break; }
          }
          if (!simpan) return tutup('butang Simpan modal tidak dijumpai');
          try { simpan.click(); } catch (e) { return tutup('gagal simpan'); }
          selepasSimpan();
        });
        return;

        function selepasSimpan() {
          /* Sahkan ulasan BENAR-BENAR tersimpan, bukan sekadar modal
             tertutup. Jika medan Ulasan* kosong, SPPB menolak Simpan —
             tanpa semakan ini helper melaporkan 32/32 sedangkan lajur
             Ulasan Guru kekal kosong di skrin. Ikon bertukar hijau apabila
             ulasan tersimpan; itu penanda yang boleh dipercayai. */

        // Tunggu modal benar-benar tertutup sebelum murid seterusnya —
        // modal yang masih terbuka akan merosakkan baris berikutnya
        tunggu(function () {
          /* Sama seperti pengesanan buka: offsetParent tidak boleh
             dipercayai untuk overlay position:fixed. */
          var g = getComputedStyle(dlg);
          return (g.display === 'none' || g.visibility === 'hidden' ||
                  !document.contains(dlg)) ? true : null;
        }, 2500, function (tutup) {
          if (!tutup) return siap(false, 'modal tidak tertutup selepas Simpan');
          /* Modal tertutup sahaja tidak memadai — sahkan ikon baris ini
             bertukar hijau, iaitu penanda SPPB bahawa ulasan tersimpan. */
          setTimeout(function () {
            var b = cariBaris(kpJangka);
            if (!b || !b.ikonUlasan) return siap(true, '');   // tak dapat semak — terima
            /* Penanda "ulasan tersimpan" ialah LATAR ikon bertukar hijau
               (rgb(60,179,113)), bukan warna teksnya — teks kekal hitam
               dalam kedua-dua keadaan. Menyemak `color` sentiasa melaporkan
               gagal walaupun ulasan benar-benar tersimpan. */
            var w = getComputedStyle(b.ikonUlasan).backgroundColor || '';
            var m = w.match(/\d+/g);
            var hijau = m && m.length >= 3 &&
                        parseInt(m[1], 10) > parseInt(m[0], 10) + 20 &&
                        parseInt(m[1], 10) > parseInt(m[2], 10) + 20;
            siap(!!hijau, hijau ? '' : 'ulasan tidak tersimpan (ikon tidak bertukar hijau)');
          }, 500);
        });
        }
      });
    });
    }
  }

  /* Isi medan "Ulasan*" dalam modal. Bentuknya belum disahkan pada SPPB
     langsung, jadi kedua-dua kemungkinan dikendalikan dan kegagalan dibiarkan
     senyap — butang Simpan tetap dicuba selepas ini, dan jika medan benar-benar
     wajib tetapi kosong, kegagalan Simpan akan dilaporkan seperti biasa. */
  /* Pilih ayat ulasan melalui kotak "Sila Pilih".

     Flow sebenar SPPB (disahkan dengan memeriksa borang secara langsung):
       ikon folder-open  -> kotak "Sila Pilih" bertindan di atas modal
       butang "Pilih"    -> satu per baris dalam jadual ayat (10 ayat)
       kotak tertutup sendiri selepas memilih

     Ayat dipilih secara rawak supaya 32 murid tidak menerima ulasan yang
     serupa perkataan demi perkataan. */
  function isiMedanUlasan(dlg, siap) {
    /* Ikon folder hanya dirender SELEPAS kategori dipilih, jadi ia belum
       wujud semasa modal mula-mula dibaca. Tunggu ia muncul. */
    tunggu(function () {
      var f = dlg.querySelector('.fa-folder-open');
      if (f) return f;
      // Vue mungkin mencipta semula modal; cari semula dalam DOM
      var s = document.querySelectorAll('[role=dialog],.w-dialog,.w-overlay');
      for (var i = 0; i < s.length; i++) {
        var g = getComputedStyle(s[i]);
        if (g.display === 'none' || g.visibility === 'hidden') continue;
        var f2 = s[i].querySelector('.fa-folder-open');
        if (f2) return f2;
      }
      return null;
    }, 2500, function (folder) {
      if (!folder) return siap();               // tiada medan ini — teruskan
      bukaKotak(folder);
    });
    return;

    function bukaKotak(folder) {
    try { folder.click(); } catch (e) { return siap(); }

    // Kotak "Sila Pilih" ialah overlay BAHARU di atas modal Ulasan
    tunggu(function () {
      var s = document.querySelectorAll('[role=dialog],.w-dialog,.w-overlay');
      for (var i = s.length - 1; i >= 0; i--) {
        var g = getComputedStyle(s[i]);
        if (g.display === 'none' || g.visibility === 'hidden') continue;
        if (s[i] === dlg) continue;             // lewati modal Ulasan sendiri
        var btn = s[i].querySelectorAll('button');
        for (var b = 0; b < btn.length; b++) {
          if ((btn[b].textContent || '').trim() === 'Pilih') return s[i];
        }
      }
      return null;
    }, 2500, function (kotak) {
      if (!kotak) return siap();                // tidak terbuka — biar Simpan melaporkannya

      var pilih = [];
      kotak.querySelectorAll('button').forEach(function (b) {
        if ((b.textContent || '').trim() === 'Pilih') pilih.push(b);
      });
      if (!pilih.length) return tutupKotak(kotak, siap);

      try { pilih[Math.floor(Math.random() * pilih.length)].click(); }
      catch (e) { return tutupKotak(kotak, siap); }

      // Tunggu kotak tertutup sendiri; jika tidak, tutup secara manual
      tunggu(function () {
        var g = getComputedStyle(kotak);
        return (g.display === 'none' || g.visibility === 'hidden' ||
                !document.contains(kotak)) ? true : null;
      }, 2000, function (tutup) {
        if (tutup) return setTimeout(siap, 200);
        tutupKotak(kotak, siap);
      });
    });
    }
  }

  function tutupKotak(kotak, siap) {
    var btn = kotak.querySelectorAll('button');
    for (var i = 0; i < btn.length; i++) {
      if ((btn[i].textContent || '').trim() === 'Tutup') {
        try { btn[i].click(); } catch (e) {}
        break;
      }
    }
    setTimeout(siap, 400);
  }

  function prosesSiri(senarai, kendali, siap, tajukKemajuan) {
    var i = 0, ok = 0, gagal = [];
    function seterusnya() {
      if (i >= senarai.length) return siap(ok, gagal);
      var item = senarai[i++];

      // Papar kemajuan supaya guru nampak di mana ia berada jika tersekat
      if (tajukKemajuan) {
        papar(tajukKemajuan,
          i + ' / ' + senarai.length + '\n' + item.label +
          '\n\nBerjaya: ' + ok + (gagal.length ? '\nGagal: ' + gagal.length : '') +
          '\n\nJangan klik apa-apa.', '#2563eb');
      }

      kendali(item, function (berjaya, sebab) {
        if (berjaya) ok++; else gagal.push(item.label + (sebab ? ' — ' + sebab : ''));
        setTimeout(seterusnya, 40);
      });
    }
    seterusnya();
  }

  function mula(teks) {
    var data;
    try { data = JSON.parse(teks); } catch (e) {
      papar('Data tidak dikenali',
        'Papan klip tidak mengandungi data PBD.\n\n' +
        'Pergi ke Sistem PBD > Analisa > Keputusan Kelas,\n' +
        'klik "Salin untuk SPPB" dahulu.', '#b4232a');
      return;
    }
    if (!data || data.jenisData !== 'PBD-SPPB-v1' || !Array.isArray(data.murid)) {
      papar('Data tidak dikenali', 'Format tidak sepadan. Sila salin semula dari Sistem PBD.', '#b4232a');
      return;
    }

    var sppb = bacaSPPB();
    if (!sppb.length) {
      papar('Jadual tidak dijumpai',
        'Tiada senarai murid dengan pilihan TP di skrin.\n\n' +
        'Pastikan anda sudah klik ikon pensel dan senarai murid terpapar penuh.', '#b4232a');
      return;
    }

    var k = data.konteks || {};
    var konteks = (k.subjek || '') + ' — ' + (k.kelas || '') + '\n' + (k.tempoh || '');

    /* Semak subjek SEBELUM apa-apa diisi.
       SPPB menyimpan setiap TP sebaik ia diklik — tiada undo. Murid yang sama
       muncul dalam setiap subjek, jadi padanan noKP sahaja akan membenarkan
       markah SAINS ditampal ke skrin PJK tanpa sebarang amaran. */
    var kSppb = bacaKonteksSPPB();
    if (!subjekSepadan(k.subjek, kSppb.subjek)) {
      papar('BERHENTI — subjek tidak sepadan',
        'Tiada apa diisi.\n\n' +
        'Data PBD : ' + (k.subjek || '(tiada)') + '\n' +
        'Skrin SPPB: ' + (kSppb.subjek || '(tiada)') + '\n\n' +
        'SPPB menyimpan setiap TP serta-merta — tiada undo.\n' +
        'Buka skrin subjek yang betul, atau salin semula dari Sistem PBD.', '#b4232a');
      return;
    }

    /* Semak kelas juga — kelas PBD "TAHUN LIMA INTEL" vs SPPB "INTEL" + "TAHUN LIMA" */
    var kelasPbd = normalSubjek(k.kelas);
    var kelasSppb = normalSubjek((kSppb.tahun || '') + ' ' + (kSppb.kelas || ''));
    if (kelasPbd && kelasSppb && kelasPbd !== kelasSppb &&
        kelasPbd.indexOf(kelasSppb) === -1 && kelasSppb.indexOf(kelasPbd) === -1) {
      papar('BERHENTI — kelas tidak sepadan',
        'Tiada apa diisi.\n\n' +
        'Data PBD : ' + (k.kelas || '(tiada)') + '\n' +
        'Skrin SPPB: ' + ((kSppb.tahun || '') + ' ' + (kSppb.kelas || '')).trim() + '\n\n' +
        'Buka skrin kelas yang betul, atau salin semula dari Sistem PBD.', '#b4232a');
      return;
    }

    // SPPB tiada noKP? Jangan teka — berhenti.
    var tiadaKP = sppb.filter(function (b) { return !b.kp; }).length;
    if (tiadaKP === sppb.length) {
      papar('Tiada No. KP di SPPB',
        'Tiada apa diisi.\n\nHelper tidak menemui lajur ID Pengenalan.\n' +
        'Pastikan jadual murid terpapar penuh.', '#b4232a');
      return;
    }

    // Peta ikut noKP
    var peta = {};
    data.murid.forEach(function (m) {
      var kp = bersihKP(m.nokp);
      if (kp) peta[kp] = m;
    });

    var takJumpa = [], pasang = [];
    sppb.forEach(function (b) {
      var m = peta[b.kp];
      if (!m) { takJumpa.push(b.bil + '. ' + b.nama); } else { pasang.push({ s: b, e: m }); }
    });

    if (takJumpa.length) {
      papar('BERHENTI — No. KP tidak padan',
        'Tiada apa diisi.\n\n' + takJumpa.length + ' murid di SPPB tidak dijumpai dalam data PBD:\n\n' +
        takJumpa.slice(0, 12).join('\n') +
        (takJumpa.length > 12 ? '\n…dan ' + (takJumpa.length - 12) + ' lagi' : '') +
        '\n\nSemak: kelas dan subjek sama? Ada murid baru masuk?\n\nData PBD: ' + konteks, '#b4232a');
      return;
    }

    if (sppb.length !== data.murid.length) {
      papar('BERHENTI — bilangan murid berbeza',
        'Tiada apa diisi.\n\nSPPB: ' + sppb.length + ' murid\nPBD: ' + data.murid.length + ' murid\n\n' +
        'Semak kelas dan tempoh penilaian yang dipilih.', '#b4232a');
      return;
    }

    var akanIsi = [], tiadaTP = [];
    pasang.forEach(function (p) {
      var tp = parseInt(p.e.tp, 10);
      if (!tp || tp < 1 || tp > 6 || !p.s.petaTP[tp]) { tiadaTP.push(p.s.bil + '. ' + p.s.nama); }
      else { akanIsi.push(p); }
    });

    if (!akanIsi.length) {
      papar('Tiada TP untuk diisi', 'Semua murid tiada nilai TP dalam data PBD.', '#b45309');
      return;
    }

    // Bahagian yang dipilih guru dalam pratonton PBD (lalai: semua)
    var isi = data.isi || {};
    var buatTP     = isi.tp     !== false;
    var buatUsaha  = isi.usaha  !== false;
    var buatUlasan = isi.ulasan !== false;
    if (!buatTP && !buatUsaha && !buatUlasan) {
      papar('Tiada bahagian dipilih', 'Pilih sekurang-kurangnya satu bahagian di Sistem PBD.', '#b45309');
      return;
    }

    var senaraiBhg = [];
    if (buatTP) senaraiBhg.push('Tahap Penguasaan');
    if (buatUsaha) senaraiBhg.push('Usaha Murid');
    if (buatUlasan) senaraiBhg.push('Ulasan Guru');

    var anggarSaat = Math.ceil(akanIsi.length *
      ((buatUsaha ? 2.0 : 0) + (buatUlasan ? 2.5 : 0))) + 3;

    var soal = 'TAMPAL KE SPPB\n\n' +
      'Dari PBD : ' + konteks + '\n' +
      'Ke skrin : ' + (kSppb.subjek || '?') + ' — ' +
                      ((kSppb.tahun || '') + ' ' + (kSppb.kelas || '')).trim() + '\n\n' +
      'Akan diisi: ' + akanIsi.length + ' murid\n' +
      'Bahagian  : ' + senaraiBhg.join(', ') + '\n' +
      (tiadaTP.length ? 'Tiada TP (dilangkau): ' + tiadaTP.length + ' murid\n' : '') +
      '\nSemua No. KP padan. Subjek dan kelas sepadan.\n\n' +
      '*** AMARAN: TIADA UNDO ***\n' +
      'SPPB menyimpan setiap nilai sebaik ia diisi, tanpa\n' +
      'menunggu butang Simpan. Nilai sedia ada akan ditimpa.\n\n' +
      (buatUlasan || buatUsaha
        ? 'Anggaran masa: ~' + anggarSaat + ' saat.\n' +
          'JANGAN tutup tab atau klik apa-apa semasa ia berjalan.\n\n'
        : '') +
      'Pastikan senarai di Sistem PBD sudah betul.\nTeruskan?';

    if (!window.confirm(soal)) return;

    var lapTP = null, lapUsaha = null, lapUlasan = null;

    // ── Peringkat 1: Tahap Penguasaan (serentak — radio dalam baris) ──────
    function peringkatTP(siap) {
      if (!buatTP) return siap();
      var n = 0, gagal = [];
      akanIsi.forEach(function (p) {
        var tp = parseInt(p.e.tp, 10);
        var r = p.s.petaTP[tp] && p.s.petaTP[tp].radio;
        /* Sudah betul? Jangan klik. Setiap klik menyebabkan Vue merender
           semula baris, yang membatalkan rujukan ikon Ulasan pada baris itu —
           melangkau yang siap mengurangkan render semula dan mempercepat. */
        if (r && (r.checked || r.getAttribute('aria-checked') === 'true')) { n++; return; }
        try { p.s.petaTP[tp].label.click(); n++; }
        catch (e) { gagal.push(p.s.bil + '. ' + p.s.nama); }
      });
      setTimeout(function () {
        var tertanda = 0;
        akanIsi.forEach(function (p) {
          var tp = parseInt(p.e.tp, 10);
          var r = p.s.petaTP[tp] && p.s.petaTP[tp].radio;
          if (r && (r.checked || r.getAttribute('aria-checked') === 'true')) tertanda++;
        });
        lapTP = { diisi: n, tertanda: tertanda, jumlah: akanIsi.length, gagal: gagal };
        siap();
      }, 400);
    }

    // ── Peringkat 2: Usaha Murid (satu demi satu — menu melayang) ─────────
    function peringkatUsaha(siap) {
      if (!buatUsaha) return siap();
      var tugas = [], terlangkau = [], sudahOk = 0;
      akanIsi.forEach(function (p) {
        var nilai = String(p.e.usaha || '').toUpperCase();
        if (!nilai) { terlangkau.push(p.s.bil + '. ' + p.s.nama + ' — tiada nilai dalam data PBD'); return; }
        /* Sudah betul di skrin? Langkau — setiap dropdown mengambil ~1 saat,
           jadi melangkau yang siap menjadikan larian ulang hampir serta-merta. */
        if (p.s.selUsaha && String(p.s.selUsaha.value || '').trim().toUpperCase() === nilai) {
          sudahOk++; return;
        }
        tugas.push({ label: p.s.bil + '. ' + p.s.nama, kp: p.s.kp, nilai: nilai });
      });
      if (!tugas.length) {
        lapUsaha = { ok: sudahOk, jumlah: akanIsi.length, gagal: terlangkau };
        return siap();
      }

      prosesSiri(tugas, function (t, selesai) {
        // Cari semula pada saat guna — baris mungkin dirender semula oleh Vue
        var b = cariBaris(t.kp);
        if (!b || !b.selUsaha) return selesai(false, 'dropdown tidak dijumpai di skrin');
        pilihUsaha(b.selUsaha, t.nilai, function (ok, sebab) {
          if (ok) return selesai(true, '');
          /* Cuba sekali lagi selepas memulihkan keadaan.
             Satu dropdown tersangkut akan menggagalkan SEMUA murid selepasnya,
             jadi percubaan kedua berbaloi berbanding kehilangan seluruh baki. */
          tutupMenu(function () {
            var b2 = cariBaris(t.kp);
            if (!b2 || !b2.selUsaha) return selesai(false, sebab);
            pilihUsaha(b2.selUsaha, t.nilai, function (ok2, sebab2) {
              selesai(ok2, ok2 ? '' : sebab2);
            });
          });
        });
      }, function (ok, gagal) {
        lapUsaha = { ok: ok + sudahOk, jumlah: akanIsi.length, gagal: terlangkau.concat(gagal) };
        siap();
      }, 'Mengisi Usaha Murid…');
    }

    // ── Peringkat 3: Ulasan Guru (modal — paling perlahan) ────────────────
    function peringkatUlasan(siap) {
      if (!buatUlasan) return siap();
      var tugas = [], terlangkau = [];
      akanIsi.forEach(function (p) {
        var nilai = String(p.e.ulasan || '').toUpperCase();
        if (!nilai) { terlangkau.push(p.s.bil + '. ' + p.s.nama + ' — tiada nilai dalam data PBD'); return; }
        tugas.push({ label: p.s.bil + '. ' + p.s.nama, kp: p.s.kp, nilai: nilai });
      });
      if (!tugas.length) {
        lapUlasan = { ok: 0, jumlah: akanIsi.length, gagal: terlangkau };
        return siap();
      }

      prosesSiri(tugas, function (t, selesai) {
        var b = cariBaris(t.kp);
        if (!b || !b.ikonUlasan) return selesai(false, 'ikon tidak dijumpai di skrin');
        isiUlasan(b.ikonUlasan, t.kp, t.nilai, function (ok, sebab) {
          if (ok) return selesai(true, '');
          /* Cuba sekali lagi selepas memastikan keadaan bersih — satu modal
             yang tersekat menggagalkan murid ini sahaja, bukan bakinya. */
          pastikanTiadaModal(function () {
            var b2 = cariBaris(t.kp);
            if (!b2 || !b2.ikonUlasan) return selesai(false, sebab);
            isiUlasan(b2.ikonUlasan, t.kp, t.nilai, function (ok2, sebab2) {
              selesai(ok2, ok2 ? '' : sebab2);
            });
          });
        });
      }, function (ok, gagal) {
        lapUlasan = { ok: ok, jumlah: akanIsi.length, gagal: terlangkau.concat(gagal) };
        siap();
      }, 'Mengisi Ulasan Guru…');
    }

    function laporAkhir() {
      var lap = '', adaMasalah = false;

      if (lapTP) {
        lap += 'TAHAP PENGUASAAN: ' + lapTP.tertanda + '/' + lapTP.jumlah + ' disahkan\n';
        if (lapTP.tertanda < lapTP.jumlah) adaMasalah = true;
        if (lapTP.gagal.length) { adaMasalah = true; lap += '  gagal: ' + lapTP.gagal.join(', ') + '\n'; }
      }
      if (lapUsaha) {
        lap += 'USAHA MURID: ' + lapUsaha.ok + '/' + lapUsaha.jumlah + '\n';
        if (lapUsaha.gagal.length) {
          adaMasalah = true;
          lap += '  gagal:\n   ' + lapUsaha.gagal.slice(0, 8).join('\n   ') +
                 (lapUsaha.gagal.length > 8 ? '\n   …dan ' + (lapUsaha.gagal.length - 8) + ' lagi' : '') + '\n';
        }
      }
      if (lapUlasan) {
        lap += 'ULASAN GURU: ' + lapUlasan.ok + '/' + lapUlasan.jumlah + '\n';
        if (lapUlasan.gagal.length) {
          adaMasalah = true;
          lap += '  gagal:\n   ' + lapUlasan.gagal.slice(0, 8).join('\n   ') +
                 (lapUlasan.gagal.length > 8 ? '\n   …dan ' + (lapUlasan.gagal.length - 8) + ' lagi' : '') + '\n';
        }
      }

      lap += '\n';
      if (tiadaTP.length) {
        lap += 'Tiada TP dalam PBD — sila guru isi sendiri:\n' + tiadaTP.join('\n') + '\n\n';
      }
      if (adaMasalah) {
        lap += 'AMARAN: sebahagian nilai tidak berjaya diisi.\n' +
               'Sila semak dan isi sendiri yang tertinggal.\n\n';
      }

      var belum = [];
      if (!buatTP) belum.push('Tahap Penguasaan');
      if (!buatUsaha) belum.push('Usaha Murid');
      if (!buatUlasan) belum.push('Ulasan Guru');
      if (belum.length) lap += 'Tidak diisi (pilihan anda): ' + belum.join(', ') + '\n\n';

      lap += 'Nilai sudah tersimpan dalam SPPB (auto-simpan).\n' +
             'Untuk membetulkan, klik sendiri di skrin.\n\n' +
             'Semak semuanya sebelum tekan Hantar.\n' +
             'Helper tidak menekan Simpan mahupun Hantar.';

      papar(adaMasalah ? 'Siap — dengan amaran' : 'Siap', lap, adaMasalah ? '#b45309' : '#1a7f45');
    }

    // Jalankan berperingkat: paling mudah dahulu, supaya kegagalan di
    // peringkat lewat tidak menjejaskan yang sudah berjaya.
    peringkatTP(function () {
      peringkatUlasan(function () {
        peringkatUsaha(laporAkhir);
      });
    });
  }

  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText().then(mula).catch(function () {
      var t = window.prompt('Tampal data PBD di sini (Cmd+V atau Ctrl+V):', '');
      if (t) mula(t);
    });
  } else {
    var t = window.prompt('Tampal data PBD di sini (Cmd+V atau Ctrl+V):', '');
    if (t) mula(t);
  }
})();
