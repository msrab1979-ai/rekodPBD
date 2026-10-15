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
   selesai, jadi pembersihan mesti dihadkan kepada satu kelas — itu juga
   memadai, kerana murid hanya wujud dalam rekod kelasnya sendiri. */
async function smBersihHantu() {
    const tahun = (document.getElementById('filterTahun') || {}).value || '';
    const kelas = (document.getElementById('filterKelas') || {}).value || '';

    if (!tahun || !kelas) {
        showToast('Sila pilih Tahun dan Kelas dahulu, kemudian klik semula', 'warning');
        return;
    }
    const fullKelas = tahun + ' ' + kelas;

    showLoading('Menyemak rekod ' + fullKelas + '...');
    try {
        const [snapMurid, snapRekod] = await Promise.all([
            firestoreRetry(() => db.collection('murid')
                .where('tahun', '==', tahun).where('kelas', '==', kelas).get()),
            firestoreRetry(() => db.collection('rekod_pbd')
                .where('kelas', '==', fullKelas).get())
        ]);

        const wujud = new Set();
        snapMurid.forEach(d => { if (d.data().noKp) wujud.add(d.data().noKp); });

        const rekod = [];
        snapRekod.forEach(d => rekod.push({ id: d.id, ...d.data() }));

        // Kumpul murid hantu dan rekod yang terjejas
        const hantu = {};        // {noKp: {nama, kelas, bil}}
        const kena = [];
        rekod.forEach(r => {
            const buruk = (r.murid || []).filter(m => m.noKp && !wujud.has(m.noKp));
            if (!buruk.length) return;
            kena.push(r);
            buruk.forEach(m => {
                if (!hantu[m.noKp]) hantu[m.noKp] = { nama: m.namaMurid, kelas: r.kelas, bil: 0 };
                hantu[m.noKp].bil++;
            });
        });

        hideLoading();

        if (!kena.length) {
            showToast('✅ ' + fullKelas + ' — tiada murid hantu, rekod sudah bersih', 'success');
            return;
        }

        const senarai = Object.entries(hantu)
            .map(([kp, h]) => '• ' + h.nama + '\n   ' + h.kelas + ' — ' + h.bil + ' rekod')
            .join('\n');

        if (!confirm(
            'BERSIH MURID HANTU — ' + fullKelas + '\n\n' +
            'Murid berikut sudah dipadam daripada senarai murid,\n' +
            'tetapi masih ada dalam rekod PBD:\n\n' + senarai +
            '\n\nJumlah rekod akan dikemas kini: ' + kena.length +
            '\n\nRekod TIDAK dipadam — hanya murid ini dibuang\n' +
            'daripada senarai dalam setiap rekod.\n\nTeruskan?')) return;

        showLoading('Membersih rekod...');
        await smTulisBatch(kena, r => {
            const baru = (r.murid || []).filter(m => m.noKp && wujud.has(m.noKp))
                .map((m, i) => ({ ...m, bil: i + 1 }));
            return { ...smKiraSemula(baru), updatedAt: getTimestamp() };
        }, 'Membersih rekod...');

        hideLoading();
        showToast('✅ ' + kena.length + ' rekod dibersihkan', 'success');
        if (typeof loadMuridList === 'function') loadMuridList();

    } catch (e) {
        hideLoading();
        console.error(e);
        showToast('Ralat: ' + e.message, 'error');
    }
}
