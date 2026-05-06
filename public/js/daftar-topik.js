// ============================================================================
// DAFTAR TOPIK & SUB-TOPIK
// Sistem Rekod PBD - SK Sultan Ismail
// ============================================================================

let allSubjek = [];
let deleteItem = null;

// ============================================================================
// INITIALIZE
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    loadSubjekDropdowns();
    console.log('✅ Daftar Topik module loaded - FIXED FILTER');
});

// ============================================================================
// LOAD SUBJEK — filter dropdowns only
// ============================================================================
async function loadSubjekDropdowns() {
    try {
        const snapshot = await db.collection('subjek').where('aktif', '==', true).get();
        allSubjek = [];
        snapshot.forEach(function(doc) { allSubjek.push({ id: doc.id, ...doc.data() }); });
        allSubjek.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

        var dropdowns = ['filterSubjek', 'filterSubjekSubtopik'];
        dropdowns.forEach(function(id) {
            var sel = document.getElementById(id);
            if (!sel) return;
            sel.innerHTML = '<option value="">Pilih Subjek</option>';
            allSubjek.forEach(function(s) {
                sel.add(new Option(s.subjek, s.id_subjek + '|' + s.subjek));
            });
        });
        console.log('✅ Loaded', allSubjek.length, 'subjek');
    } catch (e) { console.error(e); showToast('Error: ' + e.message, 'error'); }
}

// ============================================================================
// TAB SWITCHING
// ============================================================================
function switchTab(tabName, btn) {
    document.querySelectorAll('.tab-content').forEach(function(t) { t.style.display = 'none'; });
    document.querySelectorAll('.nav-tab').forEach(function(t) { t.classList.remove('active'); });
    document.getElementById('tab-' + tabName).style.display = 'block';
    btn.classList.add('active');
}

// ============================================================================
// TAB 1: TOPIK — FIXED FILTER
// ============================================================================
async function loadTopikList() {
    var subjekValue = document.getElementById('filterSubjek').value;
    var tahun = document.getElementById('filterTahun').value;
    var tbody = document.getElementById('topikTableBody');

    if (!subjekValue || !tahun) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#999;">Sila pilih subjek dan tahun</td></tr>';
        return;
    }
    showLoading('Loading topik...');
    try {
        var parts = subjekValue.split('|');
        var id_subjek = parts[0];
        var subjekNama = parts[1];
        
        // *** FIXED: Filter by BOTH id_subjek AND subjek name ***
        var snapshot = await db.collection('topik_pembelajaran')
            .where('id_subjek', '==', id_subjek)
            .where('subjek', '==', subjekNama)
            .where('tahun', '==', tahun)
            .where('is_subtopik', '==', false)
            .get();

        tbody.innerHTML = '';
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:#999;"><div style="font-size:48px;">📖</div><p>Tiada topik dijumpai</p><p style="font-size:14px;">Klik ➕ Tambah Topik untuk mula</p></td></tr>';
            hideLoading(); return;
        }
        var list = [];
        snapshot.forEach(function(doc) { list.push({ id: doc.id, ...doc.data() }); });
        list.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

        var c = 1;
        list.forEach(function(t) {
            var row = tbody.insertRow();
            row.innerHTML =
                '<td>' + c + '</td>' +
                '<td><strong>' + (t.topik_pembelajaran || t.topik) + '</strong></td>' +
                '<td>' + t.subjek + '</td>' +
                '<td>' + t.tahun + '</td>' +
                '<td><div class="table-actions">' +
                '<button class="btn btn-sm btn-primary" onclick=\'editTopik("' + t.id + '")\'>✏️ Edit</button> ' +
                '<button class="btn btn-sm btn-danger" onclick=\'deleteTopik("' + t.id + '","' + (t.topik_pembelajaran || t.topik) + '")\'>🗑️</button>' +
                '</div></td>';
            c++;
        });
        hideLoading();
    } catch (e) { console.error(e); showToast('Error: ' + e.message, 'error'); hideLoading(); }
}

// --- Open Add Topik — auto-fill dari filter
function openAddTopikModal() {
    var fSubjek = document.getElementById('filterSubjek').value;
    var fTahun = document.getElementById('filterTahun').value;
    if (!fSubjek || !fTahun) { showToast('⚠️ Pilih Subjek dan Tahun dahulu', 'warning'); return; }

    document.getElementById('modalTopikTitle').textContent = '➕ Tambah Topik Baru';
    document.getElementById('editTopikId').value = '';
    document.getElementById('hiddenTopikIdSubjek').value = fSubjek.split('|')[0];
    document.getElementById('hiddenTopikSubjekNama').value = fSubjek.split('|')[1];
    document.getElementById('hiddenTopikTahun').value = fTahun;
    document.getElementById('inputTopikNama').value = '';
    document.getElementById('inputTopikAktif').checked = true;
    document.getElementById('displayTopikSubjek').textContent = fSubjek.split('|')[1];
    document.getElementById('displayTopikTahun').textContent = fTahun;
    openModal('modalTopik');
}

// --- Edit Topik
async function editTopik(topikId) {
    showLoading('Loading...');
    try {
        var doc = await db.collection('topik_pembelajaran').doc(topikId).get();
        if (!doc.exists) { showToast('Tidak dijumpai', 'error'); hideLoading(); return; }
        var d = doc.data();

        document.getElementById('modalTopikTitle').textContent = '✏️ Edit Topik';
        document.getElementById('editTopikId').value = topikId;
        document.getElementById('hiddenTopikIdSubjek').value = d.id_subjek;
        document.getElementById('hiddenTopikSubjekNama').value = d.subjek;
        document.getElementById('hiddenTopikTahun').value = d.tahun;
        document.getElementById('inputTopikNama').value = d.topik_pembelajaran || d.topik || '';
        document.getElementById('inputTopikAktif').checked = d.aktif;
        document.getElementById('displayTopikSubjek').textContent = d.subjek;
        document.getElementById('displayTopikTahun').textContent = d.tahun;
        openModal('modalTopik');
        hideLoading();
    } catch (e) { console.error(e); showToast('Error: ' + e.message, 'error'); hideLoading(); }
}

// --- Save Topik — auto-gen Kod + Urutan
async function saveTopik() {
    var topikId = document.getElementById('editTopikId').value;
    var id_subjek = document.getElementById('hiddenTopikIdSubjek').value;
    var subjekNama = document.getElementById('hiddenTopikSubjekNama').value;
    var tahun = document.getElementById('hiddenTopikTahun').value;
    var topikNama = document.getElementById('inputTopikNama').value.trim().toUpperCase();
    var aktif = document.getElementById('inputTopikAktif').checked;

    if (!topikNama) { showToast('⚠️ Masukkan Nama Topik', 'warning'); return; }
    showLoading('Saving...');

    try {
        // *** FIXED: Load existing with subjek filter ***
        var existSnap = await db.collection('topik_pembelajaran')
            .where('id_subjek', '==', id_subjek)
            .where('subjek', '==', subjekNama)
            .where('tahun', '==', tahun)
            .where('is_subtopik', '==', false)
            .get();

        // Duplicate check
        var isDup = false;
        existSnap.forEach(function(doc) {
            if (doc.id !== topikId) {
                var dd = doc.data();
                if (dd.topik_pembelajaran === topikNama || dd.topik === topikNama) isDup = true;
            }
        });
        if (isDup) { showToast('⚠️ Topik "' + topikNama + '" sudah wujud!', 'error'); hideLoading(); return; }

        // Auto-gen Kod = 4 char pertama, unique
        var topikKod = topikNama.substring(0, 4);
        if (topikId) {
            // Edit — keep original kod
            var origDoc = await db.collection('topik_pembelajaran').doc(topikId).get();
            if (origDoc.exists) topikKod = origDoc.data().topik;
        } else {
            var kods = new Set();
            existSnap.forEach(function(doc) { kods.add(doc.data().topik); });
            var base = topikNama.substring(0, 4);
            topikKod = base;
            var n = 2;
            while (kods.has(topikKod)) { topikKod = base.substring(0, 3) + n; n++; }
        }

        // Auto-gen Urutan
        var urutan = existSnap.size + 1;
        if (topikId) {
            var origDoc2 = await db.collection('topik_pembelajaran').doc(topikId).get();
            if (origDoc2.exists && origDoc2.data().urutan) urutan = origDoc2.data().urutan;
        }

        var topikData = {
            id_subjek: id_subjek,
            subjek: subjekNama,
            tahun: tahun,
            topik: topikKod,
            topik_pembelajaran: topikNama,
            is_subtopik: false,
            parent_topik_id: null,
            urutan: urutan,
            aktif: aktif,
            updatedAt: getTimestamp()
        };

        if (topikId) {
            await db.collection('topik_pembelajaran').doc(topikId).update(topikData);
            showToast('✅ Topik dikemaskini', 'success');
        } else {
            topikData.createdAt = getTimestamp();
            await db.collection('topik_pembelajaran').add(topikData);
            showToast('✅ Topik ditambah', 'success');
        }
        closeModal('modalTopik');
        loadTopikList();
        hideLoading();
    } catch (e) { console.error(e); showToast('Error: ' + e.message, 'error'); hideLoading(); }
}

// --- Delete Topik
async function deleteTopik(topikId, topikNama) {
    showLoading('Checking...');
    try {
        var check = await db.collection('topik_pembelajaran').where('parent_topik_id', '==', topikId).limit(1).get();
        hideLoading();
        if (!check.empty) { alert('❌ Tidak boleh padam!\nTopik ini mempunyai sub-topik.\nSila padam sub-topik dahulu.'); return; }
        deleteItem = { id: topikId, nama: topikNama, type: 'topik' };
        document.getElementById('deleteConfirmMessage').textContent = 'Padam topik "' + topikNama + '"?';
        openModal('modalConfirmDelete');
    } catch (e) { console.error(e); hideLoading(); }
}

// ============================================================================
// TAB 2: SUB-TOPIK — FIXED FILTER
// ============================================================================
async function loadTahunForSubtopik() {
    var subjekValue = document.getElementById('filterSubjekSubtopik').value;
    document.getElementById('filterTahunSubtopik').innerHTML = '<option value="">Pilih Tahun</option>';
    document.getElementById('filterTopikSubtopik').innerHTML = '<option value="">Pilih Topik</option>';
    if (!subjekValue) return;

    try {
        var parts = subjekValue.split('|');
        var id_subjek = parts[0];
        var subjekNama = parts[1];
        
        // *** FIXED: Filter by BOTH id_subjek AND subjek ***
        var snap = await db.collection('topik_pembelajaran')
            .where('id_subjek', '==', id_subjek)
            .where('subjek', '==', subjekNama)
            .where('is_subtopik', '==', false)
            .get();
        var tahunSet = new Set();
        snap.forEach(function(doc) { tahunSet.add(doc.data().tahun); });
        var sel = document.getElementById('filterTahunSubtopik');
        Array.from(tahunSet).sort().forEach(function(t) { sel.add(new Option(t, t)); });
    } catch (e) { console.error(e); }
}

async function loadTopikForSubtopik() {
    var subjekValue = document.getElementById('filterSubjekSubtopik').value;
    var tahun = document.getElementById('filterTahunSubtopik').value;
    document.getElementById('filterTopikSubtopik').innerHTML = '<option value="">Pilih Topik</option>';
    if (!subjekValue || !tahun) return;

    try {
        var parts = subjekValue.split('|');
        var id_subjek = parts[0];
        var subjekNama = parts[1];
        
        // *** FIXED: Filter by BOTH id_subjek AND subjek ***
        var snap = await db.collection('topik_pembelajaran')
            .where('id_subjek', '==', id_subjek)
            .where('subjek', '==', subjekNama)
            .where('tahun', '==', tahun)
            .where('is_subtopik', '==', false)
            .get();
        var list = [];
        snap.forEach(function(doc) { list.push({ id: doc.id, ...doc.data() }); });
        list.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
        var sel = document.getElementById('filterTopikSubtopik');
        list.forEach(function(t) {
            sel.add(new Option((t.topik_pembelajaran || t.topik), t.id + '|' + t.topik));
        });
    } catch (e) { console.error(e); }
}

async function loadSubtopikList() {
    var topikValue = document.getElementById('filterTopikSubtopik').value;
    var tbody = document.getElementById('subtopikTableBody');
    if (!topikValue) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#999;">Sila pilih topik utama</td></tr>'; return; }

    showLoading('Loading sub-topik...');
    try {
        var parentId = topikValue.split('|')[0];
        var snap = await db.collection('topik_pembelajaran')
            .where('parent_topik_id', '==', parentId)
            .where('is_subtopik', '==', true)
            .get();

        tbody.innerHTML = '';
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#999;"><div style="font-size:48px;">📝</div><p>Tiada sub-topik</p><p style="font-size:14px;">Klik ➕ Tambah Sub-Topik</p></td></tr>';
            hideLoading(); return;
        }
        var list = [];
        snap.forEach(function(doc) { list.push({ id: doc.id, ...doc.data() }); });
        list.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

        var c = 1;
        list.forEach(function(s) {
            var row = tbody.insertRow();
            row.innerHTML =
                '<td>' + c + '</td>' +
                '<td><strong>' + (s.topik_pembelajaran || s.topik) + '</strong></td>' +
                '<td>' + (s.topik || '-') + '</td>' +
                '<td>' + s.subjek + '</td>' +
                '<td>' + s.tahun + '</td>' +
                '<td><div class="table-actions">' +
                '<button class="btn btn-sm btn-primary" onclick=\'editSubtopik("' + s.id + '")\'>✏️ Edit</button> ' +
                '<button class="btn btn-sm btn-danger" onclick=\'deleteSubtopik("' + s.id + '","' + (s.topik_pembelajaran || s.topik) + '")\'>🗑️</button>' +
                '</div></td>';
            c++;
        });
        hideLoading();
    } catch (e) { console.error(e); showToast('Error: ' + e.message, 'error'); hideLoading(); }
}

// --- Open Add Sub-Topik — auto-fill dari filter
function openAddSubtopikModal() {
    var fSubjek = document.getElementById('filterSubjekSubtopik').value;
    var fTahun = document.getElementById('filterTahunSubtopik').value;
    var fTopik = document.getElementById('filterTopikSubtopik').value;
    if (!fSubjek || !fTahun || !fTopik) { showToast('⚠️ Pilih Subjek, Tahun dan Topik dahulu', 'warning'); return; }

    var topikParts = fTopik.split('|');
    document.getElementById('modalSubtopikTitle').textContent = '➕ Tambah Sub-Topik Baru';
    document.getElementById('editSubtopikId').value = '';
    document.getElementById('hiddenSubtopikParentId').value = topikParts[0];
    document.getElementById('hiddenSubtopikIdSubjek').value = fSubjek.split('|')[0];
    document.getElementById('hiddenSubtopikSubjekNama').value = fSubjek.split('|')[1];
    document.getElementById('hiddenSubtopikTahun').value = fTahun;
    document.getElementById('hiddenSubtopikTopikKod').value = topikParts[1];
    document.getElementById('inputSubtopikNama').value = '';
    document.getElementById('inputSubtopikAktif').checked = true;
    document.getElementById('displaySubtopikSubjek').textContent = fSubjek.split('|')[1];
    document.getElementById('displaySubtopikTahun').textContent = fTahun;
    document.getElementById('displaySubtopikTopik').textContent = topikParts[1];
    openModal('modalSubtopik');
}

// --- Edit Sub-Topik
async function editSubtopik(subtopikId) {
    showLoading('Loading...');
    try {
        var doc = await db.collection('topik_pembelajaran').doc(subtopikId).get();
        if (!doc.exists) { showToast('Tidak dijumpai', 'error'); hideLoading(); return; }
        var d = doc.data();

        document.getElementById('modalSubtopikTitle').textContent = '✏️ Edit Sub-Topik';
        document.getElementById('editSubtopikId').value = subtopikId;
        document.getElementById('hiddenSubtopikParentId').value = d.parent_topik_id;
        document.getElementById('hiddenSubtopikIdSubjek').value = d.id_subjek;
        document.getElementById('hiddenSubtopikSubjekNama').value = d.subjek;
        document.getElementById('hiddenSubtopikTahun').value = d.tahun;
        document.getElementById('hiddenSubtopikTopikKod').value = d.topik;
        document.getElementById('inputSubtopikNama').value = d.topik_pembelajaran || '';
        document.getElementById('inputSubtopikAktif').checked = d.aktif;
        document.getElementById('displaySubtopikSubjek').textContent = d.subjek;
        document.getElementById('displaySubtopikTahun').textContent = d.tahun;
        document.getElementById('displaySubtopikTopik').textContent = d.topik;
        openModal('modalSubtopik');
        hideLoading();
    } catch (e) { console.error(e); showToast('Error: ' + e.message, 'error'); hideLoading(); }
}

// --- Save Sub-Topik — auto-gen Urutan
async function saveSubtopik() {
    var subtopikId = document.getElementById('editSubtopikId').value;
    var parentId = document.getElementById('hiddenSubtopikParentId').value;
    var id_subjek = document.getElementById('hiddenSubtopikIdSubjek').value;
    var subjekNama = document.getElementById('hiddenSubtopikSubjekNama').value;
    var tahun = document.getElementById('hiddenSubtopikTahun').value;
    var topikKod = document.getElementById('hiddenSubtopikTopikKod').value;
    var subtopikNama = document.getElementById('inputSubtopikNama').value.trim().toUpperCase();
    var aktif = document.getElementById('inputSubtopikAktif').checked;

    if (!subtopikNama) { showToast('⚠️ Masukkan Nama Sub-Topik', 'warning'); return; }
    showLoading('Saving...');

    try {
        // Load existing subtopiks under same parent
        var existSnap = await db.collection('topik_pembelajaran')
            .where('parent_topik_id', '==', parentId)
            .where('is_subtopik', '==', true)
            .get();

        // Duplicate check
        var isDup = false;
        existSnap.forEach(function(doc) {
            if (doc.id !== subtopikId && doc.data().topik_pembelajaran === subtopikNama) isDup = true;
        });
        if (isDup) { showToast('⚠️ Sub-topik "' + subtopikNama + '" sudah wujud!', 'error'); hideLoading(); return; }

        // Auto-gen Urutan
        var urutan = existSnap.size + 1;
        if (subtopikId) {
            var origDoc = await db.collection('topik_pembelajaran').doc(subtopikId).get();
            if (origDoc.exists && origDoc.data().urutan) urutan = origDoc.data().urutan;
        }

        var subtopikData = {
            id_subjek: id_subjek,
            subjek: subjekNama,
            tahun: tahun,
            topik: topikKod,
            topik_pembelajaran: subtopikNama,
            is_subtopik: true,
            parent_topik_id: parentId,
            urutan: urutan,
            aktif: aktif,
            updatedAt: getTimestamp()
        };

        if (subtopikId) {
            await db.collection('topik_pembelajaran').doc(subtopikId).update(subtopikData);
            showToast('✅ Sub-topik dikemaskini', 'success');
        } else {
            subtopikData.createdAt = getTimestamp();
            await db.collection('topik_pembelajaran').add(subtopikData);
            showToast('✅ Sub-topik ditambah', 'success');
        }
        closeModal('modalSubtopik');
        loadSubtopikList();
        hideLoading();
    } catch (e) { console.error(e); showToast('Error: ' + e.message, 'error'); hideLoading(); }
}

// --- Delete Sub-Topik
function deleteSubtopik(subtopikId, subtopikNama) {
    deleteItem = { id: subtopikId, nama: subtopikNama, type: 'subtopik' };
    document.getElementById('deleteConfirmMessage').textContent = 'Padam sub-topik "' + subtopikNama + '"?';
    openModal('modalConfirmDelete');
}

// ============================================================================
// DELETE CONFIRMATION
// ============================================================================
async function confirmDelete() {
    if (!deleteItem) return;
    showLoading('Deleting...');
    closeModal('modalConfirmDelete');
    try {
        await db.collection('topik_pembelajaran').doc(deleteItem.id).delete();
        showToast('✅ Berjaya dipadam', 'success');
        if (deleteItem.type === 'topik') loadTopikList();
        else loadSubtopikList();
        deleteItem = null;
        hideLoading();
    } catch (e) { console.error(e); showToast('Error: ' + e.message, 'error'); hideLoading(); }
}

// ============================================================================
// MODAL HELPERS
// ============================================================================
function openModal(modalId) { document.getElementById(modalId).classList.add('active'); }
function closeModal(modalId) { document.getElementById(modalId).classList.remove('active'); }
document.addEventListener('click', function(e) { if (e.target.classList.contains('modal')) e.target.classList.remove('active'); });