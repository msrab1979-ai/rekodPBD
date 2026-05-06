// ============================================================================
// REKOD PBD - html2pdf.js VERSION
// ============================================================================

let currentRekodData = null;
let deleteItem = null;
let allRekodList = [];
let tahunSemasa = '';
var semakStatusMap = {}; // { 'P1': semakDoc|null, 'P2': semakDoc|null }

document.addEventListener('DOMContentLoaded', async function() {
    await loadSystemConfig();
    await loadTahunRekodDropdown();
    console.log('✅ Rekod PBD loaded - html2pdf version');
});

async function loadSystemConfig() {
    try {
        const configDoc = await firestoreRetry(() => db.collection('config').doc('system_settings').get());
        if (configDoc.exists) {
            tahunSemasa = configDoc.data().tahunSemasa || new Date().getFullYear().toString();
        } else {
            tahunSemasa = new Date().getFullYear().toString();
        }
    } catch (error) {
        console.error('Error loading config:', error);
        tahunSemasa = new Date().getFullYear().toString();
    }
}

async function loadTahunRekodDropdown() {
    const select = document.getElementById('filterTahunRekod');
    try {
        const snapshot = await db.collection('rekod_pbd').get();
        const tahunSet = new Set();
        snapshot.forEach(function(doc) {
            var t = doc.data().tahun_rekod;
            if (t) tahunSet.add(t);
        });
        var tahunList = Array.from(tahunSet).sort().reverse();
        if (tahunList.length === 0) tahunList.push(tahunSemasa);
        select.innerHTML = '';
        tahunList.forEach(function(tahun) {
            var option = new Option(tahun, tahun);
            if (tahun === tahunSemasa) option.selected = true;
            select.add(option);
        });
        await loadSubjekList();
    } catch (error) {
        console.error('Error loading tahun rekod:', error);
        select.innerHTML = '<option value="' + tahunSemasa + '">' + tahunSemasa + '</option>';
        await loadSubjekList();
    }
}

async function loadSubjekList() {
    var tahunRekod = document.getElementById('filterTahunRekod').value;
    var selectSubjek = document.getElementById('filterSubjek');
    document.getElementById('filterSubjek').innerHTML = '<option value="">Pilih Subjek</option>';
    document.getElementById('filterTahun').innerHTML = '<option value="">Pilih Tahun</option>';
    document.getElementById('filterKelas').innerHTML = '<option value="">Pilih Kelas</option>';
    if (!tahunRekod) return;
    try {
        var snapshot = await db.collection('rekod_pbd').where('tahun_rekod', '==', tahunRekod).get();
        var subjekSet = new Set();
        snapshot.forEach(function(doc) { subjekSet.add(doc.data().subjek); });
        Array.from(subjekSet).sort().forEach(function(s) { selectSubjek.add(new Option(s, s)); });
    } catch (error) {
        console.error('Error loading subjek:', error);
    }
}

async function loadTahunDarjahList() {
    var tahunRekod = document.getElementById('filterTahunRekod').value;
    var subjek = document.getElementById('filterSubjek').value;
    var selectTahun = document.getElementById('filterTahun');
    selectTahun.innerHTML = '<option value="">Pilih Tahun</option>';
    document.getElementById('filterKelas').innerHTML = '<option value="">Pilih Kelas</option>';
    if (!tahunRekod || !subjek) return;
    try {
        var snapshot = await db.collection('rekod_pbd').where('tahun_rekod', '==', tahunRekod).where('subjek', '==', subjek).get();
        var tahunSet = new Set();
        snapshot.forEach(function(doc) { tahunSet.add(doc.data().tahun); });
        Array.from(tahunSet).sort().forEach(function(t) { selectTahun.add(new Option(t, t)); });
    } catch (error) {
        console.error('Error loading tahun darjah:', error);
    }
}

async function loadKelasList() {
    var tahunRekod = document.getElementById('filterTahunRekod').value;
    var subjek = document.getElementById('filterSubjek').value;
    var tahun = document.getElementById('filterTahun').value;
    var selectKelas = document.getElementById('filterKelas');
    selectKelas.innerHTML = '<option value="">Pilih Kelas</option>';
    if (!tahunRekod || !subjek || !tahun) return;
    try {
        var snapshot = await db.collection('rekod_pbd').where('tahun_rekod', '==', tahunRekod).where('subjek', '==', subjek).where('tahun', '==', tahun).get();
        var kelasSet = new Set();
        snapshot.forEach(function(doc) {
            var kelas = doc.data().kelas;
            if (kelas) kelasSet.add(kelas.replace(tahun + ' ', ''));
        });
        Array.from(kelasSet).sort().forEach(function(k) { selectKelas.add(new Option(k, k)); });
    } catch (error) {
        console.error('Error loading kelas:', error);
    }
}

async function loadRekodList() {
    var tahunRekod = document.getElementById('filterTahunRekod').value;
    var subjek = document.getElementById('filterSubjek').value;
    var tahun = document.getElementById('filterTahun').value;
    var kelas = document.getElementById('filterKelas').value;
    var tbody = document.getElementById('rekodTableBody');
    if (!tahunRekod || !subjek || !tahun || !kelas) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#999;">Sila pilih semua filter</td></tr>';
        document.getElementById('statusSemakBar').style.display = 'none';
        return;
    }
    showLoading('Loading rekod...');
    try {
        var fullKelas = tahun + ' ' + kelas;
        var snapshot = await db.collection('rekod_pbd').where('tahun_rekod', '==', tahunRekod).where('subjek', '==', subjek).where('kelas', '==', fullKelas).get();
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#999;"><div style="font-size:48px;margin-bottom:20px;">📊</div><p>Tiada rekod dijumpai</p></td></tr>';
            document.getElementById('statusSemakBar').style.display = 'none';
            hideLoading();
            return;
        }
        allRekodList = [];
        snapshot.forEach(function(doc) { allRekodList.push({ id: doc.id, ...doc.data() }); });
        allRekodList.sort(function(a, b) { return (b.tarikh_string || '').localeCompare(a.tarikh_string || ''); });
        await loadSemakStatus(fullKelas, subjek, tahunRekod);
        applyFilterAndRender();
        hideLoading();
    } catch (error) {
        console.error('Error loading rekod:', error);
        showToast('Error: ' + error.message, 'error');
        hideLoading();
    }
}

// Returns 'P1' (Jan-May), 'P2' (Jun-Oct), or null
function getPenilaian(tarikh_string) {
    if (!tarikh_string) return null;
    var month = parseInt(tarikh_string.substring(5, 7), 10);
    if (month >= 1 && month <= 5) return 'P1';
    if (month >= 6 && month <= 10) return 'P2';
    return null;
}

async function loadSemakStatus(kelas, subjek, tahunRekod) {
    semakStatusMap = { P1: null, P2: null };
    try {
        var snap = await db.collection('semakan_penilaian')
            .where('kelas', '==', kelas)
            .where('subjek', '==', subjek)
            .where('tahun_rekod', '==', tahunRekod)
            .get();
        snap.forEach(function(doc) {
            var d = doc.data();
            if (d.penilaian === 'P1') semakStatusMap.P1 = d;
            if (d.penilaian === 'P2') semakStatusMap.P2 = d;
        });
    } catch (e) {
        console.warn('Gagal load semak status:', e.message);
    }
    updateStatusBar();
}

function updateStatusBar() {
    var bar = document.getElementById('statusSemakBar');
    var p1El = document.getElementById('statusP1Bar');
    var p2El = document.getElementById('statusP2Bar');
    if (!bar) return;
    bar.style.display = 'block';

    function buildBar(semakDoc, label) {
        if (semakDoc && semakDoc.status_semak === 'DISEMAK') {
            return '<div style="background:#f0fdf4;border:2px solid #86efac;border-radius:10px;padding:12px 16px;">' +
                '<div style="font-weight:700;color:#16a34a;font-size:13px;">✅ ' + label + ' — SUDAH DISEMAK</div>' +
                '<div style="font-size:12px;color:#555;margin-top:4px;">Oleh: ' + (semakDoc.disemak_oleh || '-') + '</div>' +
                '<div style="font-size:12px;color:#888;">' + (semakDoc.tarikh_semak || '') + '</div>' +
                '</div>';
        }
        return '<div style="background:#fff7ed;border:2px solid #fed7aa;border-radius:10px;padding:12px 16px;">' +
            '<div style="font-weight:700;color:#ea580c;font-size:13px;">🔴 ' + label + ' — BELUM DISEMAK</div>' +
            '<div style="font-size:12px;color:#888;margin-top:4px;">Rekod belum disahkan pentadbir</div>' +
            '</div>';
    }

    p1El.innerHTML = buildBar(semakStatusMap.P1, 'Penilaian 1 (Jan–Mei)');
    p2El.innerHTML = buildBar(semakStatusMap.P2, 'Penilaian 2 (Jun–Okt)');
}

function applyFilterAndRender() {
    var penilaianFilter = document.getElementById('filterPenilaian') ? document.getElementById('filterPenilaian').value : '';
    var statusFilter = document.getElementById('filterStatusSemak') ? document.getElementById('filterStatusSemak').value : '';
    var tbody = document.getElementById('rekodTableBody');
    tbody.innerHTML = '';

    var filtered = allRekodList.filter(function(rekod) {
        var p = getPenilaian(rekod.tarikh_string);
        if (penilaianFilter && p !== penilaianFilter) return false;
        if (statusFilter) {
            var semakDoc = semakStatusMap[p];
            var isSudah = semakDoc && semakDoc.status_semak === 'DISEMAK';
            if (statusFilter === 'DISEMAK' && !isSudah) return false;
            if (statusFilter === 'BELUM' && isSudah) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#999;"><div style="font-size:48px;margin-bottom:20px;">📊</div><p>Tiada rekod untuk paparan ini</p></td></tr>';
        return;
    }

    var counter = 1;
    filtered.forEach(function(rekod) {
        var p = getPenilaian(rekod.tarikh_string);
        var semakDoc = p ? semakStatusMap[p] : null;
        var isSudah = semakDoc && semakDoc.status_semak === 'DISEMAK';
        var statusBadge = isSudah
            ? '<span style="background:#dcfce7;color:#16a34a;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;">✅ DISEMAK</span>'
            : '<span style="background:#fff7ed;color:#ea580c;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;">🔴 BELUM</span>';

        var editBtn, deleteBtn;
        if (isSudah) {
            editBtn = '<button class="btn btn-sm" style="background:#e5e7eb;color:#6b7280;cursor:not-allowed;" onclick=\'showRekodDikunci("' + (semakDoc.disemak_oleh || '-') + '","' + (semakDoc.tarikh_semak || '') + '")\'>🔒 Dikunci</button>';
            deleteBtn = '<button class="btn btn-sm" style="background:#e5e7eb;color:#6b7280;cursor:not-allowed;" title="Rekod telah disemak">🚫</button>';
        } else {
            editBtn = '<button class="btn btn-sm btn-primary" onclick=\'editRekod("' + rekod.id + '")\'>✏️ Edit</button>';
            deleteBtn = '<button class="btn btn-sm btn-danger" onclick=\'deleteRekod("' + rekod.id + '")\'>🗑️</button>';
        }

        var row = tbody.insertRow();
        row.innerHTML =
            '<td>' + counter + '</td>' +
            '<td><strong>' + rekod.topik + '</strong><br><small>' + (rekod.topik_pembelajaran_main || '') + '</small></td>' +
            '<td>' + rekod.sub_topik + '</td>' +
            '<td>' + rekod.tarikh_string + '</td>' +
            '<td>' + rekod.nama_guru + '</td>' +
            '<td><span class="badge badge-success">' + rekod.jumlah_murid + ' orang</span></td>' +
            '<td>' + statusBadge + '</td>' +
            '<td><div class="table-actions">' +
                editBtn +
                '<button class="btn btn-sm btn-success" onclick=\'quickPDF("' + rekod.id + '")\'>📄 PDF</button>' +
                deleteBtn +
            '</div></td>';
        counter++;
    });
}

function showRekodDikunci(disemakOleh, tarikhSemak) {
    var el = document.getElementById('dikunciInfo');
    if (el) {
        el.innerHTML =
            '<div>👤 <strong>Disemak oleh:</strong> ' + (disemakOleh || '-') + '</div>' +
            '<div>📅 <strong>Tarikh semak:</strong> ' + (tarikhSemak || '-') + '</div>' +
            '<div style="margin-top:8px;color:#16a34a;">✅ Rekod ini telah disahkan oleh pentadbir.</div>';
    }
    openModal('modalRekodDikunci');
}

async function editRekod(rekodId) {
    showLoading('Loading...');
    try {
        var doc = await firestoreRetry(() => db.collection('rekod_pbd').doc(rekodId).get());
        if (!doc.exists) {
            showToast('Rekod tidak dijumpai', 'error');
            hideLoading();
            return;
        }
        currentRekodData = { id: doc.id, ...doc.data() };
        document.getElementById('editRekodId').value = currentRekodData.id;
        document.getElementById('modalRekodTitle').textContent = '✏️ EDIT REKOD - ' + currentRekodData.id_rekod;
        document.getElementById('detailGuru').textContent = currentRekodData.nama_guru;
        document.getElementById('detailTarikh').textContent = currentRekodData.tarikh_string;
        document.getElementById('detailSubjek').textContent = currentRekodData.subjek;
        document.getElementById('detailKelas').textContent = currentRekodData.kelas;
        document.getElementById('detailTopik').textContent = currentRekodData.topik + (currentRekodData.topik_pembelajaran_main ? ' - ' + currentRekodData.topik_pembelajaran_main : '');
        document.getElementById('detailSubtopik').textContent = currentRekodData.sub_topik;
        var muridBody = document.getElementById('rekodMuridBody');
        muridBody.innerHTML = '';
        if (currentRekodData.murid && currentRekodData.murid.length > 0) {
            currentRekodData.murid.forEach(function(murid, index) {
                var penguasaanVal = murid.penguasaan || 'Menguasai';
                var row = muridBody.insertRow();
                row.innerHTML =
                    '<td style="padding:8px;text-align:center;">' + murid.bil + '</td>' +
                    '<td style="padding:8px;">' + murid.namaMurid + '</td>' +
                    '<td style="padding:8px;text-align:center;">' +
                        '<select class="form-control tp-dropdown" data-index="' + index + '" style="width:70px;padding:5px;" onchange="updateTPAnalysis()">' +
                        '<option value="1"' + (murid.tp == 1 ? ' selected' : '') + '>1</option>' +
                        '<option value="2"' + (murid.tp == 2 ? ' selected' : '') + '>2</option>' +
                        '<option value="3"' + (murid.tp == 3 ? ' selected' : '') + '>3</option>' +
                        '<option value="4"' + (murid.tp == 4 ? ' selected' : '') + '>4</option>' +
                        '<option value="5"' + (murid.tp == 5 ? ' selected' : '') + '>5</option>' +
                        '<option value="6"' + (murid.tp == 6 ? ' selected' : '') + '>6</option>' +
                        '</select></td>' +
                    '<td style="padding:8px;text-align:center;">' +
                        '<select class="form-control penguasaan-dropdown" data-index="' + index + '" style="padding:5px;" onchange="updatePenguasaanAnalysis()">' +
                        '<option value="Menguasai"' + (penguasaanVal === 'Menguasai' ? ' selected' : '') + '>✅ Menguasai</option>' +
                        '<option value="Belum Menguasai"' + (penguasaanVal === 'Belum Menguasai' ? ' selected' : '') + '>❌ Belum Menguasai</option>' +
                        '</select></td>' +
                    '<td style="padding:8px;">' +
                        '<input type="text" class="form-control catatan-input" data-index="' + index + '" value="' + (murid.catatan || '') + '" style="padding:5px;">' +
                    '</td>';
            });
        }
        updateTPAnalysis();
        updatePenguasaanAnalysis();
        openModal('modalEditRekod');
        hideLoading();
    } catch (error) {
        console.error('Error loading rekod:', error);
        showToast('Error: ' + error.message, 'error');
        hideLoading();
    }
}

function updateTPAnalysis() {
    if (!currentRekodData || !currentRekodData.murid) return;
    var tpDropdowns = document.querySelectorAll('.tp-dropdown');
    var tpCount = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
    tpDropdowns.forEach(function(d) {
        var tp = parseInt(d.value);
        if (tpCount.hasOwnProperty(tp)) tpCount[tp]++;
    });
    var total = tpDropdowns.length;
    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:10px;">';
    for (var i = 1; i <= 6; i++) {
        var count = tpCount[i];
        var pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
        html +=
            '<div style="background:white;padding:12px;border-radius:8px;border:2px solid var(--border);text-align:center;">' +
            '<div style="font-weight:600;font-size:13px;">TP ' + i + '</div>' +
            '<div style="font-size:22px;font-weight:700;color:var(--primary);">' + count + '</div>' +
            '<div style="color:var(--text-light);font-size:12px;">' + pct + '%</div>' +
            '<div style="background:var(--border);height:6px;border-radius:3px;margin-top:8px;overflow:hidden;">' +
            '<div style="background:var(--primary);height:100%;width:' + pct + '%;transition:width 0.3s;"></div></div>' +
            '</div>';
    }
    html += '</div>';
    document.getElementById('analisisTP').innerHTML = html;
}

function updatePenguasaanAnalysis() {
    var dropdowns = document.querySelectorAll('.penguasaan-dropdown');
    var menguasai = 0;
    var belum = 0;
    dropdowns.forEach(function(d) {
        if (d.value === 'Menguasai') menguasai++;
        else belum++;
    });
    var total = dropdowns.length;
    var pctM = total > 0 ? ((menguasai / total) * 100).toFixed(1) : 0;
    var pctB = total > 0 ? ((belum / total) * 100).toFixed(1) : 0;
    var html =
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
        '<div style="background:#f0fdf4;padding:14px;border-radius:10px;border:2px solid #86efac;text-align:center;">' +
            '<div style="font-weight:700;color:#16a34a;font-size:14px;">✅ Menguasai</div>' +
            '<div style="font-size:28px;font-weight:700;color:#16a34a;">' + menguasai + '</div>' +
            '<div style="color:#4ade80;font-size:13px;">' + pctM + '% dari ' + total + ' murid</div>' +
            '<div style="background:#bbf7d0;height:8px;border-radius:4px;margin-top:8px;overflow:hidden;">' +
            '<div style="background:#16a34a;height:100%;width:' + pctM + '%;transition:width 0.3s;"></div></div>' +
        '</div>' +
        '<div style="background:#fef2f2;padding:14px;border-radius:10px;border:2px solid #fca5a5;text-align:center;">' +
            '<div style="font-weight:700;color:#dc2626;font-size:14px;">❌ Belum Menguasai</div>' +
            '<div style="font-size:28px;font-weight:700;color:#dc2626;">' + belum + '</div>' +
            '<div style="color:#f87171;font-size:13px;">' + pctB + '% dari ' + total + ' murid</div>' +
            '<div style="background:#fecaca;height:8px;border-radius:4px;margin-top:8px;overflow:hidden;">' +
            '<div style="background:#dc2626;height:100%;width:' + pctB + '%;transition:width 0.3s;"></div></div>' +
        '</div>' +
        '</div>';
    var el = document.getElementById('analisisPenguasaan');
    if (el) el.innerHTML = html;
}

async function saveEditedRekod() {
    var rekodId = document.getElementById('editRekodId').value;
    if (!rekodId || !currentRekodData) {
        showToast('Error: Rekod tidak dijumpai', 'error');
        return;
    }
    showLoading('Saving changes...');
    try {
        var tpDropdowns = document.querySelectorAll('.tp-dropdown');
        var penguasaanDropdowns = document.querySelectorAll('.penguasaan-dropdown');
        var catatanInputs = document.querySelectorAll('.catatan-input');
        var updatedMurid = currentRekodData.murid.map(function(murid, index) {
            return {
                bil: murid.bil,
                noKp: murid.noKp,
                namaMurid: murid.namaMurid,
                tp: parseInt(tpDropdowns[index].value),
                penguasaan: penguasaanDropdowns[index].value,
                catatan: catatanInputs[index].value.trim()
            };
        });
        var totalMenguasai = updatedMurid.filter(function(m) { return m.penguasaan === 'Menguasai'; }).length;
        var totalBelumMenguasai = updatedMurid.filter(function(m) { return m.penguasaan === 'Belum Menguasai'; }).length;
        await db.collection('rekod_pbd').doc(rekodId).update({
            murid: updatedMurid,
            jumlah_menguasai: totalMenguasai,
            jumlah_belum_menguasai: totalBelumMenguasai,
            updatedAt: getTimestamp()
        });
        currentRekodData.murid = updatedMurid;
        showToast('✅ Perubahan berjaya disimpan', 'success');
        await loadRekodList();
        hideLoading();
    } catch (error) {
        console.error('Error saving:', error);
        showToast('Error: ' + error.message, 'error');
        hideLoading();
    }
}

// ============================================================================
// PDF GENERATION - html2pdf.js
// ============================================================================

async function quickPDF(rekodId) {
    showLoading('Generating PDF...');
    try {
        var doc = await firestoreRetry(() => db.collection('rekod_pbd').doc(rekodId).get());
        if (!doc.exists) {
            showToast('Rekod tidak dijumpai', 'error');
            hideLoading();
            return;
        }
        currentRekodData = { id: doc.id, ...doc.data() };
        await generatePDF();
        hideLoading();
    } catch (error) {
        console.error('Error:', error);
        showToast('Error: ' + error.message, 'error');
        hideLoading();
    }
}

async function generatePDF() {
    if (!currentRekodData) return;
    showLoading('Menyediakan PDF...');
    try {
        // ── Wait for fonts (critical for Arabic) ──────────────────────
        await document.fonts.ready;

        // ── Header info ───────────────────────────────────────────────
        document.getElementById('pdf-namaSekolah').textContent = tahunSemasa
            ? (document.querySelector('.title-text p') ? document.querySelector('.title-text p').textContent.replace(' - Pengurusan Penilaian Berasaskan Darjah','').trim() : 'SK Sultan Ismail')
            : 'SK Sultan Ismail';
        document.getElementById('pdf-tahunLabel').textContent = 'Tahun Akademik ' + (currentRekodData.tahun_rekod || tahunSemasa || new Date().getFullYear());
        document.getElementById('pdf-footer-date').textContent = 'Dicetak: ' + new Date().toLocaleDateString('ms-MY', { day:'2-digit', month:'2-digit', year:'numeric' });

        // ── Maklumat rekod ────────────────────────────────────────────
        document.getElementById('pdf-guru').textContent    = currentRekodData.nama_guru;
        document.getElementById('pdf-tarikh').textContent  = currentRekodData.tarikh_string;
        document.getElementById('pdf-subjek').textContent  = currentRekodData.subjek;
        document.getElementById('pdf-kelas').textContent   = currentRekodData.kelas;

        // Topik — keep full text, Arabic rendered by browser
        var topikText = (currentRekodData.topik || '') + (currentRekodData.topik_pembelajaran_main ? ' — ' + currentRekodData.topik_pembelajaran_main : '');
        document.getElementById('pdf-topik').textContent    = topikText;
        document.getElementById('pdf-subtopik').textContent = currentRekodData.sub_topik || '-';

        // ── Murid table ───────────────────────────────────────────────
        var tbody = document.getElementById('pdf-murid-tbody');
        tbody.innerHTML = '';
        var tpCount = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
        var menguasaiCount = 0, belumCount = 0;
        var total = currentRekodData.murid ? currentRekodData.murid.length : 0;

        if (total > 0) {
            currentRekodData.murid.forEach(function(murid) {
                var pen = murid.penguasaan || 'Menguasai';
                var tp  = parseInt(murid.tp) || 1;
                tpCount[tp]++;
                if (pen === 'Menguasai') menguasaiCount++; else belumCount++;
                var row = tbody.insertRow();
                row.innerHTML =
                    '<td class="pdh-bil-col">' + murid.bil + '</td>' +
                    '<td style="padding:5px 6px;">' + murid.namaMurid + '</td>' +
                    '<td style="text-align:center;padding:5px 6px;"><span class="pdh-tp-ball tp-c' + tp + '">' + tp + '</span></td>' +
                    '<td style="text-align:center;padding:5px 6px;"><span class="' + (pen === 'Menguasai' ? 'pdh-bdg-m' : 'pdh-bdg-b') + '">' + pen + '</span></td>' +
                    '<td style="padding:5px 6px;font-size:9.5px;color:#475569;">' + (murid.catatan || '—') + '</td>';
            });
        }

        // ── TP Bar Chart ──────────────────────────────────────────────
        var tpColors = { 1:'#dc2626', 2:'#ea580c', 3:'#d97706', 4:'#65a30d', 5:'#16a34a', 6:'#0d9488' };
        var maxCount = Math.max.apply(null, Object.values(tpCount)) || 1;
        var barHtml = '<table class="pdh-bar-tbl">';
        for (var i = 1; i <= 6; i++) {
            var cnt = tpCount[i];
            var pct = total > 0 ? ((cnt / total) * 100).toFixed(1) : '0.0';
            var barW = total > 0 ? Math.round((cnt / total) * 100) : 0;
            barHtml +=
                '<tr>' +
                '<td class="pdh-bar-lbl">TP ' + i + '</td>' +
                '<td><div class="pdh-bar-wrap"><div class="pdh-bar-fill" style="width:' + barW + '%;background:' + tpColors[i] + ';"></div></div></td>' +
                '<td class="pdh-bar-stat">' + cnt + ' murid &nbsp;(' + pct + '%)</td>' +
                '</tr>';
        }
        barHtml += '</table>';
        document.getElementById('pdf-tp-analysis').innerHTML = barHtml;

        // ── Penguasaan summary ────────────────────────────────────────
        var pctM = total > 0 ? ((menguasaiCount / total) * 100).toFixed(1) : '0.0';
        var pctB = total > 0 ? ((belumCount  / total) * 100).toFixed(1) : '0.0';
        document.getElementById('pdf-menguasai-count').textContent = menguasaiCount;
        document.getElementById('pdf-menguasai-info').textContent  = pctM + '% daripada ' + total + ' murid';
        document.getElementById('pdf-belum-count').textContent     = belumCount;
        document.getElementById('pdf-belum-info').textContent      = pctB + '% daripada ' + total + ' murid';

        // ── Render PDF ────────────────────────────────────────────────
        var template = document.getElementById('pdf-template-rekod');
        template.classList.add('active');

        // Small delay to ensure fonts/layout fully painted
        await new Promise(function(r){ setTimeout(r, 300); });

        var filename = 'RekodPBD_' + currentRekodData.subjek.replace(/\s+/g,'_') +
                       '_' + currentRekodData.kelas.replace(/\s+/g,'_') +
                       '_' + currentRekodData.tarikh_string + '.pdf';

        var opt = {
            margin:    0,
            filename:  filename,
            image:     { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale:          2.5,
                useCORS:        true,
                letterRendering: true,
                logging:        false,
                allowTaint:     true
            },
            jsPDF: {
                unit:        'mm',
                format:      'a4',
                orientation: 'portrait',
                compress:    true
            }
        };

        await html2pdf().set(opt).from(template).save();
        template.classList.remove('active');
        showToast('PDF berjaya dijana!', 'success');
        hideLoading();
    } catch (error) {
        console.error('Error generating PDF:', error);
        showToast('Error: ' + error.message, 'error');
        hideLoading();
    }
}

function deleteRekod(rekodId) {
    deleteItem = rekodId;
    var rekod = allRekodList.find(r => r.id === rekodId);
    if (rekod) {
        document.getElementById('deleteConfirmMessage').innerHTML = 
            'Adakah anda pasti mahu memadamkan rekod ini?<br><br>' +
            '<strong>Topik:</strong> ' + rekod.topik + '<br>' +
            '<strong>Kelas:</strong> ' + rekod.kelas + '<br>' +
            '<strong>Tarikh:</strong> ' + rekod.tarikh_string;
    }
    openModal('modalConfirmDelete');
}

async function confirmDelete() {
    if (!deleteItem) return;
    showLoading('Deleting...');
    closeModal('modalConfirmDelete');
    try {
        await db.collection('rekod_pbd').doc(deleteItem).delete();
        showToast('✅ Rekod berjaya dipadamkan', 'success');
        deleteItem = null;
        await loadRekodList();
        hideLoading();
    } catch (error) {
        console.error('Error deleting:', error);
        showToast('Error: ' + error.message, 'error');
        hideLoading();
    }
}

function showLoading(msg) {
    const loader = document.getElementById('loader');
    if(loader) { 
        loader.style.display='flex'; 
        const lm=loader.querySelector('.loader-message'); 
        if(lm) lm.textContent=msg||'Loading...'; 
    }
}

function hideLoading() {
    const loader = document.getElementById('loader');
    if(loader) loader.style.display='none';
}

function showToast(msg, type) {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast toast-'+type;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { 
        toast.classList.remove('show'); 
        setTimeout(()=>toast.remove(), 300); 
    }, 3000);
}

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function getTimestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
}