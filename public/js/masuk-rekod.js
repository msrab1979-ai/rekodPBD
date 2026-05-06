// ============================================================================
// MASUK REKOD TRANSIT PBD - WITH PENGUASAAN COLUMN
// Sistem Rekod PBD - SK Sultan Ismail
// ============================================================================

let allMurid = [];
let allMuridFiltered = [];
let allSubjek = [];
let selectedSubjekData = null;
let tahunSemasa = '';

// ============================================================================
// INITIALIZE
// ============================================================================

document.addEventListener('DOMContentLoaded', async function() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('inputTarikh').value = today;
    document.getElementById('inputTarikh').max = today;
    
    try {
        const configDoc = await db.collection('config').doc('system_settings').get();
        if (configDoc.exists) {
            tahunSemasa = configDoc.data().tahunSemasa || new Date().getFullYear().toString();
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }
    
    console.log('✅ Masuk Rekod module loaded');
});

// ============================================================================
// CASCADE DROPDOWNS
// ============================================================================

async function loadKelasList() {
    const tahun = document.getElementById('inputTahun').value;
    const selectKelas = document.getElementById('inputKelas');
    
    selectKelas.innerHTML = '<option value="">Pilih Kelas</option>';
    document.getElementById('inputSubjek').innerHTML = '<option value="">Pilih Subjek</option>';
    document.getElementById('inputTopik').innerHTML = '<option value="">Pilih Topik</option>';
    document.getElementById('inputSubtopik').innerHTML = '<option value="">Pilih Sub-Topik</option>';
    
    if (!tahun) return;
    
    try {
        const snapshot = await db.collection('murid')
            .where('tahun', '==', tahun)
            .where('status', '==', 'AKTIF')
            .get();
        
        const kelasSet = new Set();
        snapshot.forEach(function(doc) { kelasSet.add(doc.data().kelas); });
        
        Array.from(kelasSet).sort().forEach(function(kelas) {
            selectKelas.add(new Option(kelas, kelas));
        });
    } catch (error) {
        console.error('Error loading kelas:', error);
    }
}

async function loadSubjekList() {
    const tahun = document.getElementById('inputTahun').value;
    const kelas = document.getElementById('inputKelas').value;
    
    if (!tahun || !kelas) return;
    
    await loadMuridList();
    
    const selectSubjek = document.getElementById('inputSubjek');
    selectSubjek.innerHTML = '<option value="">Pilih Subjek</option>';
    
    try {
        const snapshot = await db.collection('subjek').where('aktif', '==', true).get();
        
        allSubjek = [];
        snapshot.forEach(function(doc) { allSubjek.push({ id: doc.id, ...doc.data() }); });
        allSubjek.sort(function(a, b) { return (a.urutan || 0) - (b.urutan || 0); });
        
        allSubjek.forEach(function(subjek) {
            selectSubjek.add(new Option(subjek.subjek, subjek.id_subjek + '|' + subjek.subjek + '|' + (subjek.murid_terlibat || 'SEMUA')));
        });
        
        console.log('✅ Loaded', allSubjek.length, 'subjek');
    } catch (error) {
        console.error('Error loading subjek:', error);
    }
}

async function loadMuridList() {
    const tahun = document.getElementById('inputTahun').value;
    const kelas = document.getElementById('inputKelas').value;
    
    if (!tahun || !kelas) {
        document.getElementById('muridSection').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        return;
    }
    
    showLoading('Loading murid...');
    
    try {
        const snapshot = await db.collection('murid')
            .where('tahun_kelas', '==', tahun + '_' + kelas)
            .where('status', '==', 'AKTIF')
            .get();
        
        allMurid = [];
        snapshot.forEach(function(doc) {
            const data = doc.data();
            data.agama = data.agama || 'ISLAM';
            allMurid.push({ noKp: doc.id, ...data });
        });
        allMurid.sort(function(a, b) { return a.namaMurid.localeCompare(b.namaMurid); });
        
        allMuridFiltered = [...allMurid];
        displayMuridTable(allMuridFiltered);
        
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('muridSection').style.display = 'block';
        hideLoading();
    } catch (error) {
        console.error('Error loading murid:', error);
        showToast('Error loading murid: ' + error.message, 'error');
        hideLoading();
    }
}

// ============================================================================
// FILTER MURID BY SUBJEK (ISLAM / BUKAN ISLAM / SEMUA)
// ============================================================================

function filterMuridBySubjek() {
    const subjekValue = document.getElementById('inputSubjek').value;
    
    if (!subjekValue) {
        allMuridFiltered = [...allMurid];
        displayMuridTable(allMuridFiltered);
        return;
    }
    
    const muridTerlibat = subjekValue.split('|')[2];
    
    if (muridTerlibat === 'ISLAM') {
        allMuridFiltered = allMurid.filter(function(m) { return m.agama === 'ISLAM'; });
    } else if (muridTerlibat === 'BUKAN_ISLAM') {
        allMuridFiltered = allMurid.filter(function(m) { return m.agama === 'BUKAN_ISLAM'; });
    } else {
        allMuridFiltered = [...allMurid];
    }
    
    console.log('✅ Filter murid_terlibat:', muridTerlibat, '— result:', allMuridFiltered.length, 'murid');
    displayMuridTable(allMuridFiltered);
}

// ============================================================================
// DISPLAY MURID TABLE — TP + PENGUASAAN + CATATAN
// ============================================================================

function displayMuridTable(muridList) {
    const tbody = document.getElementById('muridTableBody');
    tbody.innerHTML = '';
    
    if (muridList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#999;">Tiada murid yang mengambil subjek ini</td></tr>';
        document.getElementById('totalMuridCount').textContent = '0';
        return;
    }
    
    let counter = 1;
    muridList.forEach(function(murid) {
        const row = tbody.insertRow();
        row.innerHTML =
            '<td data-label="BIL">' + counter + '</td>' +
            '<td data-label="NO KP">' + murid.noKp + '</td>' +
            '<td data-label="NAMA MURID">' + murid.namaMurid + '</td>' +
            '<td data-label="TP">' +
                '<select class="form-control tp-dropdown" data-nokp="' + murid.noKp + '" style="padding:6px;">' +
                '<option value="1">1</option><option value="2">2</option>' +
                '<option value="3" selected>3</option><option value="4">4</option>' +
                '<option value="5">5</option><option value="6">6</option>' +
                '</select></td>' +
            '<td data-label="PENGUASAAN">' +
                '<select class="form-control penguasaan-dropdown" data-nokp="' + murid.noKp + '" style="padding:6px;">' +
                '<option value="Menguasai" selected>✅ Menguasai</option>' +
                '<option value="Belum Menguasai">❌ Belum Menguasai</option>' +
                '</select></td>' +
            '<td data-label="CATATAN">' +
                '<input type="text" class="form-control catatan-input" data-nokp="' + murid.noKp + '" placeholder="Catatan (optional)" style="padding:6px;">' +
            '</td>';
        counter++;
    });
    
    document.getElementById('totalMuridCount').textContent = muridList.length;
}

// ============================================================================
// LOAD TOPIK & SUBTOPIK - FIXED: Filter by subjek name
// ============================================================================

async function loadTopikList() {
    const tahun = document.getElementById('inputTahun').value;
    const subjekValue = document.getElementById('inputSubjek').value;
    const selectTopik = document.getElementById('inputTopik');
    
    selectTopik.innerHTML = '<option value="">Pilih Topik</option>';
    document.getElementById('inputSubtopik').innerHTML = '<option value="">Pilih Sub-Topik</option>';
    
    if (!tahun || !subjekValue) return;
    
    filterMuridBySubjek();
    
    const subjekName = subjekValue.split('|')[1];
    
    try {
        const snapshot = await db.collection('topik_pembelajaran')
            .where('subjek', '==', subjekName)
            .where('tahun', '==', tahun)
            .where('is_subtopik', '==', false)
            .get();
        
        if (snapshot.empty) { 
            showToast('Tiada topik dijumpai untuk ' + subjekName + ' Tahun ' + tahun, 'warning'); 
            return; 
        }
        
        const topikList = [];
        snapshot.forEach(function(doc) { topikList.push({ id: doc.id, ...doc.data() }); });
        topikList.sort(function(a, b) { return (a.urutan || 0) - (b.urutan || 0); });
        
        topikList.forEach(function(topik) {
            const txt = topik.topik + (topik.topik_pembelajaran ? ' - ' + topik.topik_pembelajaran : '');
            selectTopik.add(new Option(txt, topik.id + '|' + topik.topik + '|' + (topik.topik_pembelajaran || '')));
        });
        console.log('✅ Loaded', topikList.length, 'topik for', subjekName, tahun);
    } catch (error) {
        console.error('Error loading topik:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

async function loadSubtopikList() {
    const topikValue = document.getElementById('inputTopik').value;
    const selectSubtopik = document.getElementById('inputSubtopik');
    
    selectSubtopik.innerHTML = '<option value="">Pilih Sub-Topik</option>';
    if (!topikValue) return;
    
    try {
        const snapshot = await db.collection('topik_pembelajaran')
            .where('parent_topik_id', '==', topikValue.split('|')[0])
            .where('is_subtopik', '==', true)
            .get();
        
        if (snapshot.empty) { 
            showToast('Tiada sub-topik dijumpai', 'warning'); 
            return; 
        }
        
        let subtopikList = [];
        snapshot.forEach(function(doc) { subtopikList.push({ id: doc.id, ...doc.data() }); });
        
        const curSubjek = document.getElementById('inputSubjek').value;
        const curTahun  = document.getElementById('inputTahun').value;
        const curSubjekName = curSubjek ? curSubjek.split('|')[1] : '';
        
        subtopikList = subtopikList.filter(function(s) {
            if (curSubjekName && s.subjek !== curSubjekName) return false;
            if (curTahun && s.tahun !== curTahun) return false;
            return true;
        });
        
        subtopikList.sort(function(a, b) { return (a.urutan || 0) - (b.urutan || 0); });
        
        subtopikList.forEach(function(st) {
            selectSubtopik.add(new Option(st.topik_pembelajaran, st.topik_pembelajaran));
        });
        console.log('✅ Loaded', subtopikList.length, 'sub-topik');
    } catch (error) {
        console.error('Error loading subtopik:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

// ============================================================================
// BULK SET TP & PENGUASAAN
// ============================================================================

function setAllTP(value) {
    document.querySelectorAll('.tp-dropdown').forEach(function(d) { d.value = value; });
    showToast('✅ Semua TP ditetapkan kepada ' + value, 'success');
}

function setAllPenguasaan(value) {
    document.querySelectorAll('.penguasaan-dropdown').forEach(function(d) { d.value = value; });
    showToast('✅ Semua Penguasaan: ' + value, 'success');
}

// ============================================================================
// SAVE REKOD
// ============================================================================

async function saveRekod() {
    if (!validateForm()) return;
    
    const tahun       = document.getElementById('inputTahun').value;
    const kelas       = document.getElementById('inputKelas').value;
    const subjekValue = document.getElementById('inputSubjek').value;
    const topikValue  = document.getElementById('inputTopik').value;
    const subtopik    = document.getElementById('inputSubtopik').value;
    const tarikh      = document.getElementById('inputTarikh').value;
    
    const subjekName   = subjekValue.split('|')[1];
    const topikCode    = topikValue.split('|')[1];
    const compositeKey = tahun + ' ' + kelas + '_' + subjekName + '_' + topikCode + '_' + subtopik;
    
    showLoading('Checking duplicate...');
    
    try {
        const duplicateCheck = await db.collection('rekod_pbd')
            .where('kelas_subjek_topik_subtopik', '==', compositeKey)
            .where('tarikh_string', '==', tarikh)
            .limit(1)
            .get();
        
        hideLoading();
        
        if (!duplicateCheck.empty) {
            document.getElementById('dupKelas').textContent    = tahun + ' ' + kelas;
            document.getElementById('dupSubjek').textContent   = subjekName;
            document.getElementById('dupTopik').textContent    = topikCode;
            document.getElementById('dupSubtopik').textContent = subtopik;
            document.getElementById('dupTarikh').textContent   = tarikh;
            openModal('modalDuplicateWarning');
            return;
        }
        
        await performSave();
    } catch (error) {
        console.error('Error checking duplicate:', error);
        showToast('Error: ' + error.message, 'error');
        hideLoading();
    }
}

async function forceSaveRekod() {
    closeModal('modalDuplicateWarning');
    await performSave();
}

async function performSave() {
    showLoading('Saving rekod...');
    
    try {
        const tahun       = document.getElementById('inputTahun').value;
        const kelas       = document.getElementById('inputKelas').value;
        const subjekValue = document.getElementById('inputSubjek').value;
        const topikValue  = document.getElementById('inputTopik').value;
        const subtopik    = document.getElementById('inputSubtopik').value;
        const namaGuru    = document.getElementById('inputNamaGuru').value.trim().toUpperCase();
        const tarikh      = document.getElementById('inputTarikh').value;
        
        const id_subjek  = subjekValue.split('|')[0];
        const subjekName = subjekValue.split('|')[1];
        const topikCode  = topikValue.split('|')[1];
        const topikDesc  = topikValue.split('|')[2];
        
        const configDoc = await db.collection('config').doc('system_settings').get();
        let lastRekodId = configDoc.data().lastRekodId || 0;
        lastRekodId++;
        const rekodId = 'R' + lastRekodId.toString().padStart(5, '0');
        
        const muridArray = [];
        const tpDropdowns         = document.querySelectorAll('.tp-dropdown');
        const penguasaanDropdowns = document.querySelectorAll('.penguasaan-dropdown');
        const catatanInputs       = document.querySelectorAll('.catatan-input');
        
        let bil = 1;
        tpDropdowns.forEach(function(dropdown, index) {
            const noKp      = dropdown.getAttribute('data-nokp');
            const muridData = allMuridFiltered.find(function(m) { return m.noKp === noKp; });
            if (muridData) {
                muridArray.push({
                    bil: bil,
                    noKp: noKp,
                    namaMurid: muridData.namaMurid,
                    tp: parseInt(dropdown.value),
                    penguasaan: penguasaanDropdowns[index].value,
                    catatan: catatanInputs[index].value.trim()
                });
                bil++;
            }
        });
        
        const fullKelas    = tahun + ' ' + kelas;
        const compositeKey = fullKelas + '_' + subjekName + '_' + topikCode + '_' + subtopik;
        
        const totalMenguasai      = muridArray.filter(function(m) { return m.penguasaan === 'Menguasai'; }).length;
        const totalBelumMenguasai = muridArray.filter(function(m) { return m.penguasaan === 'Belum Menguasai'; }).length;
        
        const rekodData = {
            id_rekod: rekodId,
            tahun: tahun,
            kelas: fullKelas,
            subjek: subjekName,
            id_subjek: id_subjek,
            topik: topikCode,
            topik_pembelajaran_main: topikDesc,
            sub_topik: subtopik,
            nama_guru: namaGuru,
            tarikh: firebase.firestore.Timestamp.fromDate(new Date(tarikh + 'T00:00:00')),
            tarikh_string: tarikh,
            murid: muridArray,
            jumlah_murid: muridArray.length,
            jumlah_menguasai: totalMenguasai,
            jumlah_belum_menguasai: totalBelumMenguasai,
            kelas_subjek: fullKelas + '_' + subjekName,
            kelas_subjek_topik: fullKelas + '_' + subjekName + '_' + topikCode,
            kelas_subjek_topik_subtopik: compositeKey,
            tahun_rekod: tahunSemasa || new Date().getFullYear().toString(),
            createdAt: getTimestamp(),
            updatedAt: getTimestamp()
        };
        
        await db.collection('rekod_pbd').add(rekodData);
        await db.collection('config').doc('system_settings').update({ lastRekodId: lastRekodId });
        
        hideLoading();
        showToast('✅ Rekod berjaya disimpan! (ID: ' + rekodId + ')', 'success');
        
        if (confirm('Rekod berjaya disimpan!\n\nMasuk rekod baru?')) {
            resetForm();
        } else {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Error saving rekod:', error);
        showToast('Error: ' + error.message, 'error');
        hideLoading();
    }
}

// ============================================================================
// VALIDATION & RESET
// ============================================================================

function validateForm() {
    const tahun    = document.getElementById('inputTahun').value;
    const kelas    = document.getElementById('inputKelas').value;
    const subjek   = document.getElementById('inputSubjek').value;
    const topik    = document.getElementById('inputTopik').value;
    const subtopik = document.getElementById('inputSubtopik').value;
    const namaGuru = document.getElementById('inputNamaGuru').value.trim();
    const tarikh   = document.getElementById('inputTarikh').value;
    
    if (!tahun || !kelas || !subjek || !topik || !subtopik || !namaGuru || !tarikh) {
        showToast('⚠️ Sila lengkapkan semua maklumat', 'warning');
        return false;
    }
    if (document.getElementById('muridTableBody').querySelectorAll('.tp-dropdown').length === 0) {
        showToast('⚠️ Tiada murid dijumpai', 'warning');
        return false;
    }
    return true;
}

function resetForm() {
    document.getElementById('inputTahun').value     = '';
    document.getElementById('inputKelas').innerHTML    = '<option value="">Pilih Kelas</option>';
    document.getElementById('inputSubjek').innerHTML   = '<option value="">Pilih Subjek</option>';
    document.getElementById('inputTopik').innerHTML    = '<option value="">Pilih Topik</option>';
    document.getElementById('inputSubtopik').innerHTML = '<option value="">Pilih Sub-Topik</option>';
    document.getElementById('inputNamaGuru').value  = '';
    document.getElementById('inputTarikh').value    = new Date().toISOString().split('T')[0];
    
    document.getElementById('muridSection').style.display = 'none';
    document.getElementById('emptyState').style.display   = 'block';
    allMurid = [];
    allMuridFiltered = [];
}

// ============================================================================
// MODAL
// ============================================================================

function openModal(modalId)  { document.getElementById(modalId).classList.add('active'); }
function closeModal(modalId) { document.getElementById(modalId).classList.remove('active'); }

document.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) event.target.classList.remove('active');
});