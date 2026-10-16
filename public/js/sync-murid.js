// ============================================================================
// SYNC MURID ↔ REKOD PBD
// ----------------------------------------------------------------------------
// Setiap dokumen rekod_pbd menyimpan SALINAN senarai murid dalam array `murid`.
// Memadam atau menambah murid dalam koleksi `murid` TIDAK mengubah salinan itu,
// jadi Analisa terus memaparkan murid yang sudah dipadam, dan murid baharu
// langsung tidak muncul.
//
// Modul ini menyelaraskan kedua-duanya:
//   padam  → murid dibuang daripada semua rekod kelasnya
//   tambah → murid dimasukkan ke semua rekod kelasnya dengan TP kosong (0),
//            untuk diisi guru melalui Isi Pantas PBD
//
// TP 0 bermaksud "belum dinilai", bukan markah sifar — purata dalam Keputusan
// Kelas hanya mengira topik yang murid benar-benar dinilai.
// ============================================================================

/* Kemas kini kiraan ringkasan pada satu rekod selepas senarai murid berubah. */
function smKiraSemula(muridArr) {
    const menguasai = muridArr.filter(m => m.penguasaan === 'Menguasai').length;
    return {
        murid: muridArr,
        jumlah_murid: muridArr.length,
        jumlah_menguasai: menguasai,
        jumlah_belum_menguasai: muridArr.length - menguasai
    };
}

/* Semua rekod PBD bagi satu kelas. `kelas` di sini ialah bentuk penuh
   ("LIMA HIGEN"), kerana itulah yang disimpan dalam rekod_pbd. */
async function smRekodKelas(fullKelas) {
    const snap = await firestoreRetry(() =>
        db.collection('rekod_pbd').where('kelas', '==', fullKelas).get());
    const out = [];
    snap.forEach(d => out.push({ id: d.id, ...d.data() }));
    return out;
}

/* Tulis perubahan secara berkelompok. Had satu batch Firestore ialah 500
   operasi; 100 memberikan ruang selamat dan kemajuan yang boleh dipapar. */
async function smTulisBatch(senarai, bina, mesej) {
    let siap = 0;
    for (let i = 0; i < senarai.length; i += 100) {
        const kepingan = senarai.slice(i, i + 100);
        const batch = db.batch();
        kepingan.forEach(r => {
            batch.update(db.collection('rekod_pbd').doc(r.id), bina(r));
        });
        await batch.commit();
        siap += kepingan.length;
        if (mesej) showLoading(mesej + ' ' + siap + '/' + senarai.length);
    }
}

// ── Padam: buang murid daripada semua rekod ─────────────────────────────────

async function smBuangMuridDariRekod(noKp, tahun, kelas) {
    const fullKelas = tahun + ' ' + kelas;
    const rekod = await smRekodKelas(fullKelas);

    const kena = rekod.filter(r =>
        (r.murid || []).some(m => m.noKp === noKp));
    if (!kena.length) return 0;

    await smTulisBatch(kena, r => {
        const baru = (r.murid || []).filter(m => m.noKp !== noKp)
            .map((m, i) => ({ ...m, bil: i + 1 }));
        return { ...smKiraSemula(baru), updatedAt: getTimestamp() };
    }, 'Mengemas kini rekod...');

    return kena.length;
}

// ── Tambah: masukkan murid ke semua rekod dengan TP kosong ──────────────────

async function smTambahMuridKeRekod(noKp, namaMurid, tahun, kelas) {
    const fullKelas = tahun + ' ' + kelas;
    const rekod = await smRekodKelas(fullKelas);

    const kena = rekod.filter(r =>
        !(r.murid || []).some(m => m.noKp === noKp));
    if (!kena.length) return 0;

    await smTulisBatch(kena, r => {
        /* TP 0 = belum dinilai. Murid disisip mengikut susunan nama supaya
           senarai kekal teratur seperti rekod yang diisi guru. */
        const baru = (r.murid || []).concat([{
            bil: 0, noKp: noKp, namaMurid: namaMurid,
            tp: 0, penguasaan: 'Belum Menguasai', catatan: ''
        }]);
        baru.sort((a, b) => (a.namaMurid || '').localeCompare(b.namaMurid || ''));
        baru.forEach((m, i) => { m.bil = i + 1; });
        return { ...smKiraSemula(baru), updatedAt: getTimestamp() };
    }, 'Mengemas kini rekod...');

    return kena.length;
}

// ── Pembersihan: buang semua murid yang tidak lagi wujud ────────────────────

/* Bersihkan SATU kelas pada satu masa.

   Koleksi rekod_pbd mengandungi ribuan dokumen, setiap satu membawa array 33
   murid. Membaca keseluruhan koleksi menggantung pelayar sebelum sempat
   selesai. Jika Tahun+Kelas dipilih, hanya kelas itu diimbas; jika tidak,
   SEMUA kelas diimbas satu demi satu (tapis ikut kelas, tidak sekali gus). */
async function smBersihHantu() {
    const tahun = (document.getElementById('filterTahun') || {}).value || '';
    const kelas = (document.getElementById('filterKelas') || {}).value || '';
    const semuaKelas = !tahun || !kelas;

    try {
        showLoading('Membaca senarai murid...');
        const snapMurid = await firestoreRetry(() => db.collection('murid').get());

        const wujud = new Set();
        const kelasSemua = new Set();
        snapMurid.forEach(d => {
            const m = d.data();
            if (m.noKp) wujud.add(m.noKp);
            if (m.tahun && m.kelas) kelasSemua.add(m.tahun + ' ' + m.kelas);
        });

        const senaraiKelas = semuaKelas ? [...kelasSemua].sort() : [tahun + ' ' + kelas];

        /* FASA 1 — imbas sahaja, kumpul ringkasan.
           Hanya id rekod disimpan, bukan dokumen penuh: 1,500 dokumen dengan
           array 33 murid setiap satu membekukan pelayar. Antara kelas, lepaskan
           kawalan supaya UI kekal hidup dan Chrome tidak menganggap tab beku. */
        const hantu = {};        // {noKp|kelas: {nama, kelas, bil}}
        const idKena = [];       // id rekod sahaja
        let jumlahImbas = 0;

        for (let i = 0; i < senaraiKelas.length; i++) {
            const fk = senaraiKelas[i];
            showLoading('Menyemak ' + (i + 1) + '/' + senaraiKelas.length + ' — ' + fk);
            await new Promise(r => setTimeout(r, 0));   // lepaskan kawalan

            const snapRekod = await firestoreRetry(() =>
                db.collection('rekod_pbd').where('kelas', '==', fk).get());
            jumlahImbas += snapRekod.size;

            snapRekod.forEach(d => {
                const r = d.data();
                const buruk = (r.murid || []).filter(m => m.noKp && !wujud.has(m.noKp));
                if (!buruk.length) return;
                idKena.push(d.id);
                buruk.forEach(m => {
                    const kunci = m.noKp + '|' + fk;
                    if (!hantu[kunci]) hantu[kunci] = { nama: m.namaMurid, kelas: fk, bil: 0 };
                    hantu[kunci].bil++;
                });
            });
        }

        hideLoading();
        const skop = semuaKelas ? 'SEMUA KELAS (' + senaraiKelas.length + ')' : senaraiKelas[0];

        if (!idKena.length) {
            showToast('✅ ' + skop + ' — tiada murid hantu, rekod sudah bersih', 'success');
            return;
        }

        const senarai = Object.values(hantu).sort((a, b) => b.bil - a.bil)
            .map(h => '• ' + h.nama + '\n   ' + h.kelas + ' — ' + h.bil + ' rekod')
            .join('\n');

        if (!confirm(
            'BERSIH MURID HANTU — ' + skop + '\n\n' +
            'Murid berikut sudah dipadam daripada senarai murid,\n' +
            'tetapi masih ada dalam rekod PBD:\n\n' + senarai +
            '\n\nRekod diimbas: ' + jumlahImbas +
            '\nRekod akan dikemas kini: ' + idKena.length +
            '\n\nRekod TIDAK dipadam — hanya murid ini dibuang\n' +
            'daripada senarai dalam setiap rekod.\n\nTeruskan?')) return;

        /* FASA 2 — baca semula dan tulis sekeping demi sekeping.
           Membaca semula 100 dokumen pada satu masa mengelakkan menyimpan
           kesemuanya dalam memori sekali gus. */
        let siap = 0;
        for (let i = 0; i < idKena.length; i += 100) {
            const kepingan = idKena.slice(i, i + 100);
            showLoading('Membersih... ' + siap + '/' + idKena.length);
            await new Promise(r => setTimeout(r, 0));

            const docs = await Promise.all(kepingan.map(id =>
                firestoreRetry(() => db.collection('rekod_pbd').doc(id).get())));

            const batch = db.batch();
            let dalam = 0;
            docs.forEach(d => {
                if (!d.exists) return;
                const r = d.data();
                const baru = (r.murid || []).filter(m => m.noKp && wujud.has(m.noKp))
                    .map((m, j) => ({ ...m, bil: j + 1 }));
                batch.update(d.ref, { ...smKiraSemula(baru), updatedAt: getTimestamp() });
                dalam++;
            });
            if (dalam) await batch.commit();
            siap += kepingan.length;
        }

        hideLoading();
        showToast('✅ ' + idKena.length + ' rekod dibersihkan', 'success');
        if (typeof loadMuridList === 'function') loadMuridList();

    } catch (e) {
        hideLoading();
        console.error(e);
        showToast('Ralat: ' + e.message, 'error');
    }
}
