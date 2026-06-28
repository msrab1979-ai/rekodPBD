// ============================================================================
// REKOD.JS — Satu halaman: Form + Jadual Murid + Senarai Rekod
// ============================================================================

// ── STATE ─────────────────────────────────────────────────────────────────────
let tahunSemasa = '';
let allMurid = [];
let allMuridFiltered = [];
let allSubjekData = [];
let allSenaraiRekod = [];
let semakStatusMap = { P1: null, P2: null };
let currentRekodId = null;   // null = rekod baru, string = update rekod sedia ada
let hapusTargetId = null;
let currentPDFData = null;

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('inputTarikh').value = today;
    document.getElementById('inputTarikh').max = today;

    try {
        const cfg = await firestoreRetry(() => db.collection('config').doc('system_settings').get());
        tahunSemasa = cfg.exists ? (cfg.data().tahunSemasa || new Date().getFullYear().toString())
                                 : new Date().getFullYear().toString();
    } catch (e) {
        tahunSemasa = new Date().getFullYear().toString();
    }

    // Listener analisis live
    document.getElementById('muridBody').addEventListener('change', updateAnalisis);
});

// ── HELPERS ───────────────────────────────────────────────────────────────────
function resetDropdownFrom(ids) {
    ids.forEach(id => {
        const el = document.getElementById(id);
        el.innerHTML = '<option value="">Pilih...</option>';
        el.disabled = true;
    });
}

function hideMuridSection(resetMurid = true) {
    document.getElementById('muridSection').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('analisisSection').style.display = 'none';
    currentRekodId = null;
    if (resetMurid) { allMurid = []; allMuridFiltered = []; }
}

// ── CASCADE: TAHUN → KELAS → SUBJEK → TOPIK → SUBTOPIK ───────────────────────
async function onTahunChange() {
    const tahun = document.getElementById('inputTahun').value;
    resetDropdownFrom(['inputKelas','inputSubjek','inputTopik','inputSubtopik']);
    hideMuridSection();
    if (!tahun) return;

    showLoading('Memuatkan kelas...');
    try {
        const snap = await firestoreRetry(() =>
            db.collection('murid').where('tahun', '==', tahun).where('status', '==', 'AKTIF').get());
        const set = new Set();
        snap.forEach(d => set.add(d.data().kelas));
        const sel = document.getElementById('inputKelas');
        sel.innerHTML = '<option value="">Pilih Kelas</option>';
        Array.from(set).sort().forEach(k => sel.add(new Option(k, k)));
        sel.disabled = false;
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
    hideLoading();
}

async function onKelasChange() {
    const tahun = document.getElementById('inputTahun').value;
    const kelas = document.getElementById('inputKelas').value;
    resetDropdownFrom(['inputSubjek','inputTopik','inputSubtopik']);
    hideMuridSection();
    if (!tahun || !kelas) return;

    // Load murid & subjek serentak
    showLoading('Memuatkan data...');
    try {
        const [muridSnap, subjekSnap] = await Promise.all([
            firestoreRetry(() =>
                db.collection('murid')
                    .where('tahun', '==', tahun)
                    .where('status', '==', 'AKTIF').get()),
            firestoreRetry(() => db.collection('subjek').where('aktif', '==', true).get())
        ]);

        allMurid = [];
        muridSnap.forEach(d => {
            const data = d.data();
            if (data.kelas !== kelas) return;
            data.agama = data.agama || 'ISLAM';
            allMurid.push({ noKp: d.id, ...data });
        });
        allMurid.sort((a, b) => a.namaMurid.localeCompare(b.namaMurid));

        allSubjekData = [];
        subjekSnap.forEach(d => allSubjekData.push({ id: d.id, ...d.data() }));
        allSubjekData.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

        const sel = document.getElementById('inputSubjek');
        sel.innerHTML = '<option value="">Pilih Subjek</option>';
        allSubjekData.forEach(s => {
            sel.add(new Option(s.subjek, s.id_subjek + '|' + s.subjek + '|' + (s.murid_terlibat || 'SEMUA')));
        });
        sel.disabled = false;

        // Load senarai rekod untuk kelas ini (background)
        loadSenaraiRekod(tahun + ' ' + kelas, '', tahunSemasa);
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
    hideLoading();
}

async function onSubjekChange() {
    const tahun = document.getElementById('inputTahun').value;
    const subjekVal = document.getElementById('inputSubjek').value;
    resetDropdownFrom(['inputTopik','inputSubtopik']);
    hideMuridSection(false); // kekal allMurid
    if (!tahun || !subjekVal) return;

    // Filter murid mengikut subjek
    const terlibat = subjekVal.split('|')[2];
    if (terlibat === 'ISLAM') allMuridFiltered = allMurid.filter(m => (m.agama || 'ISLAM') === 'ISLAM');
    else if (terlibat === 'BUKAN_ISLAM') allMuridFiltered = allMurid.filter(m => m.agama === 'BUKAN_ISLAM');
    else allMuridFiltered = [...allMurid];

    // Load topik
    const subjekName = subjekVal.split('|')[1];
    showLoading('Memuatkan topik...');
    try {
        const snap = await firestoreRetry(() =>
            db.collection('topik_pembelajaran')
                .where('subjek', '==', subjekName)
                .where('tahun', '==', tahun)
                .where('is_subtopik', '==', false).get());
        const sel = document.getElementById('inputTopik');
        sel.innerHTML = '<option value="">Pilih Topik</option>';
        if (snap.empty) { showToast('Tiada topik untuk ' + subjekName + ' Tahun ' + tahun, 'warning'); hideLoading(); return; }
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
        list.forEach(t => {
            const txt = t.topik + (t.topik_pembelajaran ? ' - ' + t.topik_pembelajaran : '');
            sel.add(new Option(txt, t.id + '|' + t.topik + '|' + (t.topik_pembelajaran || '')));
        });
        sel.disabled = false;

        // Kemaskini senarai rekod mengikut subjek
        const kelas = document.getElementById('inputKelas').value;
        loadSenaraiRekod(tahun + ' ' + kelas, subjekName, tahunSemasa);
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
    hideLoading();
}

async function onTopikChange() {
    const topikVal = document.getElementById('inputTopik').value;
    resetDropdownFrom(['inputSubtopik']);
    hideMuridSection(false); // kekal allMurid
    if (!topikVal) return;

    const subjekVal = document.getElementById('inputSubjek').value;
    const tahun = document.getElementById('inputTahun').value;
    const subjekName = subjekVal ? subjekVal.split('|')[1] : '';

    showLoading('Memuatkan sub-topik...');
    try {
        const snap = await firestoreRetry(() =>
            db.collection('topik_pembelajaran')
                .where('parent_topik_id', '==', topikVal.split('|')[0])
                .where('is_subtopik', '==', true).get());
        const sel = document.getElementById('inputSubtopik');
        sel.innerHTML = '<option value="">Pilih Sub-Topik</option>';
        if (snap.empty) { showToast('Tiada sub-topik', 'warning'); hideLoading(); return; }
        let list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list = list.filter(s => {
            if (subjekName && s.subjek !== subjekName) return false;
            if (tahun && s.tahun !== tahun) return false;
            return true;
        });
        list.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
        list.forEach(st => sel.add(new Option(st.topik_pembelajaran, st.topik_pembelajaran)));
        sel.disabled = false;
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
    hideLoading();
}

async function onSubtopikChange() {
    const subtopik = document.getElementById('inputSubtopik').value;
    if (!subtopik) { hideMuridSection(); return; }
    await loadMuridOrRekod();
}

// ── CORE: LOAD MURID ATAU REKOD SEDIA ADA ────────────────────────────────────
async function loadMuridOrRekod() {
    const tahun   = document.getElementById('inputTahun').value;
    const kelas   = document.getElementById('inputKelas').value;
    const subjekVal = document.getElementById('inputSubjek').value;
    const topikVal  = document.getElementById('inputTopik').value;
    const subtopik  = document.getElementById('inputSubtopik').value;

    if (!tahun || !kelas || !subjekVal || !topikVal || !subtopik) return;

    const subjekName = subjekVal.split('|')[1];
    const topikCode  = topikVal.split('|')[1];
    const fullKelas  = tahun + ' ' + kelas;
    const compositeKey = fullKelas + '_' + subjekName + '_' + topikCode + '_' + subtopik;

    showLoading('Semak rekod...');
    try {
        // Cari rekod sedia ada untuk kombinasi ini
        const snap = await firestoreRetry(() =>
            db.collection('rekod_pbd')
                .where('kelas_subjek_topik_subtopik', '==', compositeKey)
                .where('tahun_rekod', '==', tahunSemasa)
                .limit(1).get());

        if (!snap.empty) {
            // ── REKOD SEDIA ADA: load untuk edit ──
            const doc = snap.docs[0];
            const data = { id: doc.id, ...doc.data() };
            currentRekodId = doc.id;

            // Isi guru, tarikh & aktiviti dari rekod
            document.getElementById('inputNamaGuru').value = data.nama_guru || '';
            document.getElementById('inputTarikh').value = data.tarikh_string || '';
            document.getElementById('inputAktiviti').value = data.aktiviti_kelas || '';

            // Render murid dari rekod
            renderMuridFromRekod(data.murid || []);

            // Badge: edit
            const badge = document.getElementById('modeBadge');
            badge.className = 'mode-badge edit';
            badge.textContent = '✅ Kemaskini Rekod';

            document.getElementById('btnSimpan').textContent = '💾 Kemaskini Rekod';
            document.getElementById('btnPDF').style.display = 'inline-flex';
            currentPDFData = data;

            showToast('Rekod sedia ada dimuatkan — boleh terus edit', 'success');
        } else {
            // ── TIADA REKOD: load murid baru dengan default TP=3 ──
            currentRekodId = null;
            renderMuridBaru(allMuridFiltered);

            // Badge: baru
            const badge = document.getElementById('modeBadge');
            badge.className = 'mode-badge baru';
            badge.textContent = '✏️ Rekod Baru';

            document.getElementById('btnSimpan').textContent = '💾 Simpan Rekod';
            document.getElementById('btnPDF').style.display = 'none';
            currentPDFData = null;
        }

        document.getElementById('muridSection').style.display = 'block';
        document.getElementById('emptyState').style.display = 'none';
        updateAnalisis();

    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
    hideLoading();
}

// ── RENDER MURID ──────────────────────────────────────────────────────────────
function renderMuridBaru(list) {
    const tbody = document.getElementById('muridBody');
    tbody.innerHTML = '';
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#999;">Tiada murid untuk subjek ini</td></tr>';
        document.getElementById('totalMurid').textContent = '0';
        return;
    }
    let bil = 1;
    list.forEach(m => {
        const row = tbody.insertRow();
        row.innerHTML =
            '<td>' + bil + '</td>' +
            '<td style="font-size:12px;">' + m.noKp + '</td>' +
            '<td>' + m.namaMurid + '</td>' +
            '<td><select class="form-control tp-sel tp-dropdown" data-nokp="' + m.noKp + '">' +
                '<option value="1">1</option><option value="2">2</option>' +
                '<option value="3" selected>3</option><option value="4">4</option>' +
                '<option value="5">5</option><option value="6">6</option>' +
            '</select></td>' +
            '<td><select class="form-control pen-sel penguasaan-dropdown" data-nokp="' + m.noKp + '">' +
                '<option value="Menguasai" selected>✅ Menguasai</option>' +
                '<option value="Belum Menguasai">❌ Belum Menguasai</option>' +
            '</select></td>' +
            '<td><input type="text" class="form-control catatan-input" data-nokp="' + m.noKp + '" placeholder="Catatan"></td>';
        bil++;
    });
    document.getElementById('totalMurid').textContent = list.length;
}

function renderMuridFromRekod(muridArr) {
    const tbody = document.getElementById('muridBody');
    tbody.innerHTML = '';
    if (!muridArr.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#999;">Tiada data murid</td></tr>';
        document.getElementById('totalMurid').textContent = '0';
        return;
    }
    muridArr.forEach((m, i) => {
        const row = tbody.insertRow();
        row.innerHTML =
            '<td>' + m.bil + '</td>' +
            '<td style="font-size:12px;">' + (m.noKp || '') + '</td>' +
            '<td>' + m.namaMurid + '</td>' +
            '<td><select class="form-control tp-sel tp-dropdown" data-index="' + i + '">' +
                [1,2,3,4,5,6].map(v => '<option value="' + v + '"' + (m.tp == v ? ' selected' : '') + '>' + v + '</option>').join('') +
            '</select></td>' +
            '<td><select class="form-control pen-sel penguasaan-dropdown" data-index="' + i + '">' +
                '<option value="Menguasai"' + (m.penguasaan === 'Menguasai' ? ' selected' : '') + '>✅ Menguasai</option>' +
                '<option value="Belum Menguasai"' + (m.penguasaan !== 'Menguasai' ? ' selected' : '') + '>❌ Belum Menguasai</option>' +
            '</select></td>' +
            '<td><input type="text" class="form-control catatan-input" data-index="' + i + '" value="' + (m.catatan || '') + '" placeholder="Catatan"></td>';
    });
    document.getElementById('totalMurid').textContent = muridArr.length;
}

// ── ANALISIS LIVE ─────────────────────────────────────────────────────────────
function updateAnalisis() {
    const tpDDs  = document.querySelectorAll('#muridBody .tp-dropdown');
    const penDDs = document.querySelectorAll('#muridBody .penguasaan-dropdown');
    if (!tpDDs.length) return;

    const total = tpDDs.length;
    const tpCount = {1:0,2:0,3:0,4:0,5:0,6:0};
    let menguasai = 0, belum = 0;
    tpDDs.forEach(d => tpCount[parseInt(d.value)]++);
    penDDs.forEach(d => d.value === 'Menguasai' ? menguasai++ : belum++);

    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(95px,1fr));gap:8px;">';
    for (let i = 1; i <= 6; i++) {
        const cnt = tpCount[i];
        const pct = total > 0 ? ((cnt/total)*100).toFixed(1) : 0;
        html += '<div style="background:white;padding:10px;border-radius:8px;border:2px solid var(--border);text-align:center;">' +
            '<div style="font-weight:600;font-size:12px;">TP ' + i + '</div>' +
            '<div style="font-size:20px;font-weight:700;color:var(--primary);">' + cnt + '</div>' +
            '<div style="font-size:11px;color:#888;">' + pct + '%</div>' +
            '<div style="background:#e2e8f0;height:5px;border-radius:3px;margin-top:6px;overflow:hidden;">' +
            '<div style="background:var(--primary);height:100%;width:' + pct + '%;"></div></div></div>';
    }
    html += '</div>';
    document.getElementById('analisisTP').innerHTML = html;

    const pM = total > 0 ? ((menguasai/total)*100).toFixed(1) : 0;
    const pB = total > 0 ? ((belum/total)*100).toFixed(1) : 0;
    document.getElementById('analisisPenguasaan').innerHTML =
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
        '<div style="background:#f0fdf4;padding:14px;border-radius:10px;border:2px solid #86efac;text-align:center;">' +
            '<div style="font-weight:700;color:#16a34a;">✅ Menguasai</div>' +
            '<div style="font-size:26px;font-weight:700;color:#16a34a;">' + menguasai + '</div>' +
            '<div style="font-size:12px;color:#4ade80;">' + pM + '% dari ' + total + ' murid</div></div>' +
        '<div style="background:#fef2f2;padding:14px;border-radius:10px;border:2px solid #fca5a5;text-align:center;">' +
            '<div style="font-weight:700;color:#dc2626;">❌ Belum Menguasai</div>' +
            '<div style="font-size:26px;font-weight:700;color:#dc2626;">' + belum + '</div>' +
            '<div style="font-size:12px;color:#f87171;">' + pB + '% dari ' + total + ' murid</div></div>' +
        '</div>';

    document.getElementById('analisisSection').style.display = 'block';
}

// ── BULK ACTIONS ──────────────────────────────────────────────────────────────
function setAllTP(val) {
    document.querySelectorAll('#muridBody .tp-dropdown').forEach(d => d.value = val);
    updateAnalisis();
    showToast('Semua TP = ' + val, 'success');
}

function setAllPenguasaan(val) {
    document.querySelectorAll('#muridBody .penguasaan-dropdown').forEach(d => d.value = val);
    updateAnalisis();
    showToast('Semua Penguasaan: ' + val, 'success');
}

// ── SIMPAN / KEMASKINI ────────────────────────────────────────────────────────
async function simpanRekod() {
    if (!validate()) return;
    if (currentRekodId) {
        await kemaskiniRekod();
    } else {
        await simpanRekodBaru();
    }
}

function validate() {
    const fields = ['inputTahun','inputKelas','inputSubjek','inputTopik','inputSubtopik','inputNamaGuru','inputTarikh'];
    for (const f of fields) {
        if (!document.getElementById(f).value.trim()) {
            showToast('⚠️ Sila lengkapkan semua maklumat sesi', 'warning');
            return false;
        }
    }
    if (!document.querySelectorAll('#muridBody .tp-dropdown').length) {
        showToast('⚠️ Tiada murid dijumpai', 'warning');
        return false;
    }
    return true;
}

function collectMuridData(isNew) {
    const tpDDs     = document.querySelectorAll('#muridBody .tp-dropdown');
    const penDDs    = document.querySelectorAll('#muridBody .penguasaan-dropdown');
    const catInputs = document.querySelectorAll('#muridBody .catatan-input');
    const muridArr  = [];
    let bil = 1;

    if (isNew) {
        tpDDs.forEach((dd, i) => {
            const noKp = dd.getAttribute('data-nokp');
            const m = allMuridFiltered.find(x => x.noKp === noKp);
            if (m) {
                muridArr.push({
                    bil: bil++, noKp,
                    namaMurid: m.namaMurid,
                    tp: parseInt(dd.value),
                    penguasaan: penDDs[i].value,
                    catatan: catInputs[i].value.trim()
                });
            }
        });
    } else {
        const existing = currentPDFData ? (currentPDFData.murid || []) : [];
        tpDDs.forEach((dd, i) => {
            const idx = parseInt(dd.getAttribute('data-index'));
            const m = existing[idx] || {};
            muridArr.push({
                bil: m.bil || (i + 1),
                noKp: m.noKp || '',
                namaMurid: m.namaMurid || '',
                tp: parseInt(dd.value),
                penguasaan: penDDs[i].value,
                catatan: catInputs[i].value.trim()
            });
        });
    }
    return muridArr;
}

async function simpanRekodBaru() {
    const tahun     = document.getElementById('inputTahun').value;
    const kelas     = document.getElementById('inputKelas').value;
    const subjekVal = document.getElementById('inputSubjek').value;
    const topikVal  = document.getElementById('inputTopik').value;
    const subtopik  = document.getElementById('inputSubtopik').value;
    const namaGuru  = document.getElementById('inputNamaGuru').value.trim().toUpperCase();
    const tarikh    = document.getElementById('inputTarikh').value;

    const idSubjek   = subjekVal.split('|')[0];
    const subjekName = subjekVal.split('|')[1];
    const topikCode  = topikVal.split('|')[1];
    const topikDesc  = topikVal.split('|')[2];
    const fullKelas  = tahun + ' ' + kelas;
    const compositeKey = fullKelas + '_' + subjekName + '_' + topikCode + '_' + subtopik;
    const aktivitiKelas = (document.getElementById('inputAktiviti').value || '').trim();

    showLoading('Menyimpan rekod...');
    try {
        const cfg = await firestoreRetry(() => db.collection('config').doc('system_settings').get());
        let lastId = (cfg.data().lastRekodId || 0) + 1;
        const rekodId = 'R' + lastId.toString().padStart(5, '0');

        const muridArr = collectMuridData(true);
        const totalM = muridArr.filter(m => m.penguasaan === 'Menguasai').length;

        await db.collection('rekod_pbd').add({
            id_rekod: rekodId,
            tahun, kelas: fullKelas,
            subjek: subjekName, id_subjek: idSubjek,
            topik: topikCode, topik_pembelajaran_main: topikDesc,
            sub_topik: subtopik,
            nama_guru: namaGuru,
            tarikh: firebase.firestore.Timestamp.fromDate(new Date(tarikh + 'T00:00:00')),
            tarikh_string: tarikh,
            aktiviti_kelas: aktivitiKelas,
            murid: muridArr,
            jumlah_murid: muridArr.length,
            jumlah_menguasai: totalM,
            jumlah_belum_menguasai: muridArr.length - totalM,
            kelas_subjek: fullKelas + '_' + subjekName,
            kelas_subjek_topik: fullKelas + '_' + subjekName + '_' + topikCode,
            kelas_subjek_topik_subtopik: compositeKey,
            tahun_rekod: tahunSemasa,
            createdAt: getTimestamp(),
            updatedAt: getTimestamp()
        });
        await db.collection('config').doc('system_settings').update({ lastRekodId: lastId });

        showToast('✅ Rekod berjaya disimpan! (' + rekodId + ')', 'success');

        // Refresh senarai dan tukar badge ke edit
        await loadSenaraiRekod(fullKelas, subjekName, tahunSemasa);

        // Reload rekod yang baru disimpan supaya badge tukar ke "Kemaskini"
        await loadMuridOrRekod();

    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
    hideLoading();
}

async function kemaskiniRekod() {
    if (!currentRekodId || !currentPDFData) return;
    showLoading('Menyimpan perubahan...');
    try {
        const muridArr = collectMuridData(false);
        const totalM = muridArr.filter(m => m.penguasaan === 'Menguasai').length;

        const namaGuru      = document.getElementById('inputNamaGuru').value.trim().toUpperCase();
        const tarikh        = document.getElementById('inputTarikh').value;
        const aktivitiKelas = (document.getElementById('inputAktiviti').value || '').trim();

        await db.collection('rekod_pbd').doc(currentRekodId).update({
            murid: muridArr,
            jumlah_menguasai: totalM,
            jumlah_belum_menguasai: muridArr.length - totalM,
            nama_guru: namaGuru,
            tarikh_string: tarikh,
            tarikh: firebase.firestore.Timestamp.fromDate(new Date(tarikh + 'T00:00:00')),
            aktiviti_kelas: aktivitiKelas,
            updatedAt: getTimestamp()
        });

        currentPDFData.murid = muridArr;
        currentPDFData.jumlah_menguasai = totalM;
        currentPDFData.nama_guru = namaGuru;
        currentPDFData.tarikh_string = tarikh;
        currentPDFData.aktiviti_kelas = aktivitiKelas;

        showToast('✅ Rekod berjaya dikemaskini', 'success');

        const fullKelas  = document.getElementById('inputTahun').value + ' ' + document.getElementById('inputKelas').value;
        const subjekName = document.getElementById('inputSubjek').value.split('|')[1];
        await loadSenaraiRekod(fullKelas, subjekName, tahunSemasa);

    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
    hideLoading();
}

// ── RESET FORM ────────────────────────────────────────────────────────────────
function resetForm() {
    document.getElementById('inputTahun').value = '';
    document.getElementById('inputNamaGuru').value = '';
    document.getElementById('inputTarikh').value = new Date().toISOString().split('T')[0];
    document.getElementById('inputAktiviti').value = '';
    resetDropdownFrom(['inputKelas','inputSubjek','inputTopik','inputSubtopik']);
    hideMuridSection();
    document.getElementById('senaraiSection').style.display = 'none';
    allMurid = [];
    allMuridFiltered = [];
    currentRekodId = null;
    currentPDFData = null;
}

// ── SENARAI REKOD ─────────────────────────────────────────────────────────────
async function loadSenaraiRekod(fullKelas, subjek, tahunRekod) {
    const section = document.getElementById('senaraiSection');
    const tbody = document.getElementById('senaraiBody');

    try {
        let query = db.collection('rekod_pbd')
            .where('kelas', '==', fullKelas)
            .where('tahun_rekod', '==', tahunRekod);
        if (subjek) query = query.where('subjek', '==', subjek);

        const snap = await firestoreRetry(() => query.get());
        allSenaraiRekod = [];
        snap.forEach(d => allSenaraiRekod.push({ id: d.id, ...d.data() }));
        allSenaraiRekod.sort((a, b) => (b.tarikh_string || '').localeCompare(a.tarikh_string || ''));

        if (!allSenaraiRekod.length) {
            section.style.display = 'none';
            return;
        }

        await loadSemakStatus(fullKelas, subjek, tahunRekod);
        renderSenarai();
        section.style.display = 'block';
    } catch (e) {
        console.warn('Gagal load senarai:', e.message);
    }
}

async function loadSemakStatus(kelas, subjek, tahunRekod) {
    semakStatusMap = { P1: null, P2: null };
    if (!subjek) return;
    try {
        const snap = await firestoreRetry(() =>
            db.collection('semakan_penilaian')
                .where('kelas', '==', kelas)
                .where('subjek', '==', subjek)
                .where('tahun_rekod', '==', tahunRekod).get());
        snap.forEach(d => {
            const data = d.data();
            if (data.penilaian === 'P1') semakStatusMap.P1 = data;
            if (data.penilaian === 'P2') semakStatusMap.P2 = data;
        });
    } catch (e) { console.warn(e.message); }
    updateStatusBar();
}

function getPenilaian(tarikh) {
    if (!tarikh) return null;
    const m = parseInt(tarikh.substring(5, 7), 10);
    if (m >= 1 && m <= 5) return 'P1';
    if (m >= 6 && m <= 10) return 'P2';
    return null;
}

function updateStatusBar() {
    const bar = document.getElementById('statusSemakBar');
    if (!bar) return;
    bar.style.display = 'block';
    function buildBar(doc, label) {
        if (doc && doc.status_semak === 'DISEMAK') {
            return '<div style="background:#f0fdf4;border:2px solid #86efac;border-radius:10px;padding:12px 16px;">' +
                '<div style="font-weight:700;color:#16a34a;font-size:13px;">✅ ' + label + ' — SUDAH DISEMAK</div>' +
                '<div style="font-size:12px;color:#555;margin-top:3px;">Oleh: ' + (doc.disemak_oleh || '-') + '</div>' +
                '<div style="font-size:12px;color:#888;">' + (doc.tarikh_semak || '') + '</div></div>';
        }
        return '<div style="background:#fff7ed;border:2px solid #fed7aa;border-radius:10px;padding:12px 16px;">' +
            '<div style="font-weight:700;color:#ea580c;font-size:13px;">🔴 ' + label + ' — BELUM DISEMAK</div>' +
            '<div style="font-size:12px;color:#888;margin-top:3px;">Rekod belum disahkan pentadbir</div></div>';
    }
    document.getElementById('statusP1Bar').innerHTML = buildBar(semakStatusMap.P1, 'Penilaian 1 (Jan–Mei)');
    document.getElementById('statusP2Bar').innerHTML = buildBar(semakStatusMap.P2, 'Penilaian 2 (Jun–Okt)');
}

function renderSenarai() {
    const tbody = document.getElementById('senaraiBody');
    tbody.innerHTML = '';
    if (!allSenaraiRekod.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#999;">Tiada rekod</td></tr>';
        return;
    }
    let bil = 1;
    allSenaraiRekod.forEach(rekod => {
        const p = getPenilaian(rekod.tarikh_string);
        const semakDoc = p ? semakStatusMap[p] : null;
        const dikunci = semakDoc && semakDoc.status_semak === 'DISEMAK';
        const pBadge = p === 'P1' ? '<span class="badge-p1">P1</span>'
                     : p === 'P2' ? '<span class="badge-p2">P2</span>' : '';
        const statusBadge = dikunci
            ? '<span style="background:#dcfce7;color:#16a34a;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">✅ DISEMAK</span>'
            : '<span style="background:#fff7ed;color:#ea580c;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">🔴 BELUM</span>';

        let editBtn, hapusBtn;
        if (dikunci) {
            editBtn = '<button class="btn btn-sm" style="background:#e5e7eb;color:#6b7280;cursor:not-allowed;" onclick=\'showDikunci("' + (semakDoc.disemak_oleh || '-') + '","' + (semakDoc.tarikh_semak || '') + '")\'>🔒 Dikunci</button>';
            hapusBtn = '<button class="btn btn-sm" style="background:#e5e7eb;color:#6b7280;cursor:not-allowed;">🚫</button>';
        } else {
            editBtn = '<button class="btn btn-sm btn-primary" onclick=\'loadRekodKeForm("' + rekod.id + '")\'>✏️ Edit</button>';
            hapusBtn = '<button class="btn btn-sm btn-danger" onclick=\'hapusRekod("' + rekod.id + '")\'>🗑️</button>';
        }

        const row = tbody.insertRow();
        row.innerHTML =
            '<td>' + bil + '</td>' +
            '<td><strong>' + rekod.topik + '</strong><div class="rekod-meta">' + (rekod.topik_pembelajaran_main || '') + '</div></td>' +
            '<td>' + rekod.sub_topik + '</td>' +
            '<td>' + rekod.tarikh_string + ' ' + pBadge + '</td>' +
            '<td>' + rekod.nama_guru + '</td>' +
            '<td><span class="badge badge-success">' + rekod.jumlah_murid + ' org</span></td>' +
            '<td>' + statusBadge + '</td>' +
            '<td><div class="table-actions">' +
                editBtn +
                '<button class="btn btn-sm btn-success" onclick=\'janaPDFById("' + rekod.id + '")\'>📄 PDF</button>' +
                hapusBtn +
            '</div></td>';
        bil++;
    });
}

// Klik Edit dalam senarai → load rekod ke form atas
async function loadRekodKeForm(rekodId) {
    showLoading('Memuatkan rekod...');
    try {
        const doc = await firestoreRetry(() => db.collection('rekod_pbd').doc(rekodId).get());
        if (!doc.exists) { showToast('Rekod tidak dijumpai', 'error'); hideLoading(); return; }
        const data = { id: doc.id, ...doc.data() };

        console.log('📋 Edit rekod data:', data);

        const tahun     = data.tahun || '';
        const fullKelas = data.kelas || '';
        // kelas field dalam Firestore = "LIMA HIGEN", tahun = "LIMA"
        // kelasOnly = "HIGEN"
        const kelasOnly = fullKelas.startsWith(tahun + ' ')
            ? fullKelas.slice((tahun + ' ').length).trim()
            : fullKelas.trim();

        // ── STEP 1: Set Tahun ─────────────────────────────────────
        document.getElementById('inputTahun').value = tahun;

        // ── STEP 2: Load & set Kelas ──────────────────────────────
        const muridKelasSnap = await firestoreRetry(() =>
            db.collection('murid').where('tahun', '==', tahun).where('status', '==', 'AKTIF').get());
        const kelasSet = new Set();
        muridKelasSnap.forEach(d => kelasSet.add(d.data().kelas));
        const selKelas = document.getElementById('inputKelas');
        selKelas.innerHTML = '<option value="">Pilih Kelas</option>';
        Array.from(kelasSet).sort().forEach(k => selKelas.add(new Option(k, k)));
        selKelas.value = kelasOnly;
        selKelas.disabled = false;
        console.log('Kelas set:', kelasOnly, '| dropdown value:', selKelas.value);

        // ── STEP 3: Load murid untuk kelas ───────────────────────
        const tahunKelasKey = tahun + '_' + kelasOnly;
        console.log('Query tahun_kelas:', tahunKelasKey);
        const muridSnap = await firestoreRetry(() =>
            db.collection('murid')
                .where('tahun_kelas', '==', tahunKelasKey)
                .where('status', '==', 'AKTIF').get());
        allMurid = [];
        muridSnap.forEach(d => {
            const m = d.data();
            m.agama = m.agama || 'ISLAM';
            allMurid.push({ noKp: d.id, ...m });
        });
        allMurid.sort((a, b) => a.namaMurid.localeCompare(b.namaMurid));
        console.log('Murid loaded:', allMurid.length);

        // ── STEP 4: Load & set Subjek ─────────────────────────────
        const subjekSnap = await firestoreRetry(() =>
            db.collection('subjek').where('aktif', '==', true).get());
        allSubjekData = [];
        subjekSnap.forEach(d => allSubjekData.push({ id: d.id, ...d.data() }));
        allSubjekData.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

        const selSubjek = document.getElementById('inputSubjek');
        selSubjek.innerHTML = '<option value="">Pilih Subjek</option>';
        let subjekVal = '';
        let terlibat  = 'SEMUA';
        allSubjekData.forEach(s => {
            const val = s.id_subjek + '|' + s.subjek + '|' + (s.murid_terlibat || 'SEMUA');
            selSubjek.add(new Option(s.subjek, val));
            if (s.subjek === data.subjek) { subjekVal = val; terlibat = s.murid_terlibat || 'SEMUA'; }
        });
        selSubjek.value = subjekVal;
        selSubjek.disabled = false;
        console.log('Subjek set:', data.subjek, '| val:', subjekVal);

        // Filter murid ikut subjek
        if (terlibat === 'ISLAM') allMuridFiltered = allMurid.filter(m => m.agama === 'ISLAM');
        else if (terlibat === 'BUKAN_ISLAM') allMuridFiltered = allMurid.filter(m => m.agama === 'BUKAN_ISLAM');
        else allMuridFiltered = [...allMurid];

        // ── STEP 5: Load & set Topik ──────────────────────────────
        const topikSnap = await firestoreRetry(() =>
            db.collection('topik_pembelajaran')
                .where('subjek', '==', data.subjek)
                .where('tahun', '==', tahun)
                .where('is_subtopik', '==', false).get());
        const topikList = [];
        topikSnap.forEach(d => topikList.push({ id: d.id, ...d.data() }));
        topikList.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

        const selTopik = document.getElementById('inputTopik');
        selTopik.innerHTML = '<option value="">Pilih Topik</option>';
        let topikVal = '';
        let topikId  = '';
        topikList.forEach(t => {
            const txt = t.topik + (t.topik_pembelajaran ? ' - ' + t.topik_pembelajaran : '');
            const val = t.id + '|' + t.topik + '|' + (t.topik_pembelajaran || '');
            selTopik.add(new Option(txt, val));
            if (t.topik === data.topik) { topikVal = val; topikId = t.id; }
        });
        selTopik.value = topikVal;
        selTopik.disabled = false;
        console.log('Topik set:', data.topik, '| id:', topikId);

        // ── STEP 6: Load & set Sub-Topik ──────────────────────────
        const selSubtopik = document.getElementById('inputSubtopik');
        selSubtopik.innerHTML = '<option value="">Pilih Sub-Topik</option>';
        if (topikId) {
            const stSnap = await firestoreRetry(() =>
                db.collection('topik_pembelajaran')
                    .where('parent_topik_id', '==', topikId)
                    .where('is_subtopik', '==', true).get());
            let stList = [];
            stSnap.forEach(d => stList.push({ id: d.id, ...d.data() }));
            stList = stList.filter(s => s.subjek === data.subjek && s.tahun === tahun);
            stList.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
            stList.forEach(st => selSubtopik.add(new Option(st.topik_pembelajaran, st.topik_pembelajaran)));
        }
        selSubtopik.value = data.sub_topik || '';
        selSubtopik.disabled = false;
        console.log('SubTopik set:', data.sub_topik, '| dropdown:', selSubtopik.value);

        // ── STEP 7: Guru & Tarikh ─────────────────────────────────
        document.getElementById('inputNamaGuru').value = data.nama_guru || '';
        document.getElementById('inputTarikh').value   = data.tarikh_string || '';

        // ── STEP 8: Render murid terus dari rekod ─────────────────
        currentRekodId = doc.id;
        currentPDFData = data;
        renderMuridFromRekod(data.murid || []);

        const badge = document.getElementById('modeBadge');
        badge.className   = 'mode-badge edit';
        badge.textContent = '✅ Kemaskini Rekod';
        document.getElementById('btnSimpan').textContent = '💾 Kemaskini Rekod';
        document.getElementById('btnPDF').style.display  = 'inline-flex';

        document.getElementById('muridSection').style.display = 'block';
        document.getElementById('emptyState').style.display   = 'none';
        updateAnalisis();

        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast('Rekod dimuatkan — sedia untuk edit', 'info');

    } catch (e) {
        showToast('Error: ' + e.message, 'error');
        console.error('loadRekodKeForm error:', e);
    }
    hideLoading();
}

// ── PADAM ─────────────────────────────────────────────────────────────────────
function hapusRekod(rekodId) {
    hapusTargetId = rekodId;
    const rekod = allSenaraiRekod.find(r => r.id === rekodId);
    if (rekod) {
        document.getElementById('hapusMsg').innerHTML =
            'Adakah anda pasti mahu memadamkan rekod ini?<br><br>' +
            '<strong>Topik:</strong> ' + rekod.topik + '<br>' +
            '<strong>Kelas:</strong> ' + rekod.kelas + '<br>' +
            '<strong>Tarikh:</strong> ' + rekod.tarikh_string;
    }
    openModal('modalHapus');
}

async function confirmHapus() {
    if (!hapusTargetId) return;
    showLoading('Memadam...');
    closeModal('modalHapus');
    try {
        await db.collection('rekod_pbd').doc(hapusTargetId).delete();
        showToast('✅ Rekod berjaya dipadamkan', 'success');

        // Jika rekod yang dipadam adalah yang sedang diedit, reset
        if (currentRekodId === hapusTargetId) {
            currentRekodId = null;
            currentPDFData = null;
            hideMuridSection();
        }
        hapusTargetId = null;

        const fullKelas  = document.getElementById('inputTahun').value + ' ' + document.getElementById('inputKelas').value;
        const subjekName = (document.getElementById('inputSubjek').value || '').split('|')[1] || '';
        await loadSenaraiRekod(fullKelas, subjekName, tahunSemasa);
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
    hideLoading();
}

function showDikunci(oleh, tarikh) {
    document.getElementById('dikunciInfo').innerHTML =
        '<div>👤 <strong>Disemak oleh:</strong> ' + (oleh || '-') + '</div>' +
        '<div>📅 <strong>Tarikh semak:</strong> ' + (tarikh || '-') + '</div>' +
        '<div style="margin-top:8px;color:#16a34a;">✅ Rekod ini telah disahkan pentadbir.</div>';
    openModal('modalRekodDikunci');
}

// ── PDF ───────────────────────────────────────────────────────────────────────
async function janaPDFById(rekodId) {
    showLoading('Memuatkan rekod...');
    try {
        const doc = await firestoreRetry(() => db.collection('rekod_pbd').doc(rekodId).get());
        if (!doc.exists) { showToast('Rekod tidak dijumpai', 'error'); hideLoading(); return; }
        currentPDFData = { id: doc.id, ...doc.data() };
        await janaPDF();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
        hideLoading();
    }
}

async function janaPDF() {
    if (!currentPDFData) { showToast('Tiada rekod untuk dijana', 'warning'); return; }
    showLoading('Menyediakan PDF...');
    try {
        await document.fonts.ready;
        const r = currentPDFData;

        document.getElementById('pdfNamaSekolah').textContent = 'SK SULTAN ISMAIL';
        document.getElementById('pdfTahunLabel').textContent = 'Tahun Akademik ' + (r.tahun_rekod || tahunSemasa);
        document.getElementById('pdfFooterDate').textContent = 'Dicetak: ' + new Date().toLocaleDateString('ms-MY', { day:'2-digit', month:'2-digit', year:'numeric' });
        document.getElementById('pdfGuru').textContent = r.nama_guru;
        document.getElementById('pdfTarikh').textContent = r.tarikh_string;
        document.getElementById('pdfSubjek').textContent = r.subjek;
        document.getElementById('pdfKelas').textContent = r.kelas;
        document.getElementById('pdfTopik').textContent = (r.topik || '') + (r.topik_pembelajaran_main ? ' — ' + r.topik_pembelajaran_main : '');
        document.getElementById('pdfSubtopik').textContent = r.sub_topik || '-';

        const tbody = document.getElementById('pdfMuridTbody');
        tbody.innerHTML = '';
        const tpCount = {1:0,2:0,3:0,4:0,5:0,6:0};
        let menguasai = 0, belum = 0;
        const total = r.murid ? r.murid.length : 0;

        (r.murid || []).forEach(m => {
            const pen = m.penguasaan || 'Menguasai';
            const tp = parseInt(m.tp) || 1;
            tpCount[tp]++;
            pen === 'Menguasai' ? menguasai++ : belum++;
            const row = tbody.insertRow();
            row.innerHTML =
                '<td class="pdh-bil-col">' + m.bil + '</td>' +
                '<td style="padding:5px 6px;">' + m.namaMurid + '</td>' +
                '<td style="text-align:center;padding:5px 6px;"><span class="pdh-tp-ball tp-c' + tp + '">' + tp + '</span></td>' +
                '<td style="text-align:center;padding:5px 6px;"><span class="' + (pen === 'Menguasai' ? 'pdh-bdg-m' : 'pdh-bdg-b') + '">' + pen + '</span></td>' +
                '<td style="padding:5px 6px;font-size:9.5px;color:#475569;">' + (m.catatan || '—') + '</td>';
        });

        const tpColors = {1:'#dc2626',2:'#ea580c',3:'#d97706',4:'#65a30d',5:'#16a34a',6:'#0d9488'};
        let barHtml = '<table class="pdh-bar-tbl">';
        for (let i = 1; i <= 6; i++) {
            const cnt = tpCount[i];
            const pct = total > 0 ? ((cnt/total)*100).toFixed(1) : '0.0';
            const w = total > 0 ? Math.round((cnt/total)*100) : 0;
            barHtml += '<tr><td class="pdh-bar-lbl">TP ' + i + '</td>' +
                '<td><div class="pdh-bar-wrap"><div class="pdh-bar-fill" style="width:' + w + '%;background:' + tpColors[i] + ';"></div></div></td>' +
                '<td class="pdh-bar-stat">' + cnt + ' murid (' + pct + '%)</td></tr>';
        }
        barHtml += '</table>';
        document.getElementById('pdfTPAnalysis').innerHTML = barHtml;

        const pM = total > 0 ? ((menguasai/total)*100).toFixed(1) : '0.0';
        const pB = total > 0 ? ((belum/total)*100).toFixed(1) : '0.0';
        document.getElementById('pdfMenguasaiCount').textContent = menguasai;
        document.getElementById('pdfMenguasaiInfo').textContent = pM + '% daripada ' + total + ' murid';
        document.getElementById('pdfBelumCount').textContent = belum;
        document.getElementById('pdfBelumInfo').textContent = pB + '% daripada ' + total + ' murid';

        const tmpl = document.getElementById('pdfTemplate');
        tmpl.classList.add('active');
        await new Promise(res => setTimeout(res, 300));

        const filename = 'RekodPBD_' + r.subjek.replace(/\s+/g,'_') + '_' + r.kelas.replace(/\s+/g,'_') + '_' + r.tarikh_string + '.pdf';
        await html2pdf().set({
            margin: 0, filename,
            image: { type:'jpeg', quality:0.98 },
            html2canvas: { scale:2.5, useCORS:true, letterRendering:true, logging:false, allowTaint:true },
            jsPDF: { unit:'mm', format:'a4', orientation:'portrait', compress:true }
        }).from(tmpl).save();

        tmpl.classList.remove('active');
        showToast('PDF berjaya dijana!', 'success');
        hideLoading();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
        hideLoading();
    }
}

// ── MODAL HELPERS ─────────────────────────────────────────────────────────────
function openModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('active'); el.style.display = 'flex'; }
}
function closeModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('active'); el.style.display = 'none'; }
}
document.addEventListener('click', e => {
    if (e.target.classList.contains('modal')) closeModal(e.target.id);
});
