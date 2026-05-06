// ============================================================================
// ADMIN PANEL - WITH SUBJEK MANAGEMENT + REMEMBER ME + PASSWORD TOGGLE
// Sistem Rekod PBD - SK Sultan Ismail
// ============================================================================

let currentAdminTab = 'murid';
let csvData = [];
let resetType = '';
let deleteSubjekItem = null;
let allRekodData = [];

// ============================================================================
// INITIALIZE - CHECK REMEMBER ME
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    checkRememberedLogin();
    console.log('✅ Admin Panel module loaded');
});

function checkRememberedLogin() {
    const remembered = localStorage.getItem('adminRemembered');
    if (remembered === 'true') {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        loadAdminData();
    }
}

// ============================================================================
// PASSWORD VISIBILITY TOGGLE
// ============================================================================

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('adminPassword');
    const toggleIcon = document.getElementById('passwordToggleIcon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.textContent = '🙈';
    } else {
        passwordInput.type = 'password';
        toggleIcon.textContent = '👁️';
    }
}

// ============================================================================
// LOGIN/LOGOUT
// ============================================================================

async function loginAdmin() {
    const password = document.getElementById('adminPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    if (!password) {
        showToast('Sila masukkan password', 'warning');
        return;
    }
    
    showLoading('Checking password...');
    
    try {
        const configDoc = await db.collection('config').doc('system_settings').get();
        const correctPassword = configDoc.exists ? configDoc.data().adminPassword : 'adminpbd2024';
        
        if (password === correctPassword) {
            if (rememberMe) {
                localStorage.setItem('adminRemembered', 'true');
            } else {
                localStorage.removeItem('adminRemembered');
            }
            
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'block';
            loadAdminData();
            hideLoading();
        } else {
            showToast('Password salah!', 'error');
            hideLoading();
        }
    } catch (error) {
        console.error('Error checking password:', error);
        showToast('Error: ' + error.message, 'error');
        hideLoading();
    }
}

function logoutAdmin() {
    localStorage.removeItem('adminRemembered');
    
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('adminPassword').value = '';
    document.getElementById('rememberMe').checked = false;
}

// ============================================================================
// TAB SWITCHING
// ============================================================================

function switchAdminTab(tabName) {
    currentAdminTab = tabName;
    
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.getElementById('tab-' + tabName).style.display = 'block';
    event.target.classList.add('active');
    
    if (tabName === 'murid') {
        loadMuridStats();
    } else if (tabName === 'reset') {
        loadTahunRekodDropdown();
    } else if (tabName === 'subjek') {
        loadSubjekList();
    } else if (tabName === 'sistem') {
        loadSystemSettings();
    }
}

// ============================================================================
// TAB 1: MURID STATISTICS
// ============================================================================

async function loadMuridStats() {
    showLoading('Loading statistics...');
    
    try {
        const muridSnapshot = await db.collection('murid').get();
        const rekodSnapshot = await db.collection('rekod_pbd').get();
        const subjekSnapshot = await db.collection('subjek').get();
        
        const tbody = document.getElementById('muridStatsBody');
        tbody.innerHTML = '';
        
        const stats = [
            { label: 'Jumlah Murid', value: muridSnapshot.size, icon: '👥' },
            { label: 'Jumlah Rekod PBD', value: rekodSnapshot.size, icon: '📝' },
            { label: 'Jumlah Subjek', value: subjekSnapshot.size, icon: '📚' }
        ];
        
        stats.forEach(stat => {
            const row = tbody.insertRow();
            row.innerHTML = '<td><strong>' + stat.icon + ' ' + stat.label + '</strong></td>' +
                           '<td><span class="badge badge-success">' + stat.value + '</span></td>';
        });
        
        hideLoading();
    } catch (error) {
        console.error('Error loading stats:', error);
        hideLoading();
    }
}

// ============================================================================
// CSV IMPORT
// ============================================================================

function openImportCSVModal() {
    document.getElementById('csvFileInput').value = '';
    document.getElementById('csvPreview').style.display = 'none';
    document.getElementById('btnImportCSV').disabled = true;
    csvData = [];
    openModal('modalImportCSV');
}

function previewCSV() {
    const fileInput = document.getElementById('csvFileInput');
    const file = fileInput.files[0];
    
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        parseCSV(text);
    };
    reader.readAsText(file);
}

function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
        showToast('Fail CSV kosong atau tidak sah', 'error');
        return;
    }
    
    const headerLine = lines[0].toUpperCase();
    const header = headerLine.split(',').map(h => h.trim());
    
    console.log('CSV Header detected:', header);
    
    let colNoKp = -1;
    let colNama = -1;
    let colTahun = -1;
    let colKelas = -1;
    let colJantina = -1;
    
    header.forEach((col, index) => {
        if (col.includes('NO') && (col.includes('KP') || col.includes('IC'))) colNoKp = index;
        else if (col.includes('NAMA')) colNama = index;
        else if (col.includes('TAHUN') || col.includes('DARJAH')) colTahun = index;
        else if (col.includes('KELAS') || col.includes('CLASS')) colKelas = index;
        else if (col.includes('JANTINA') || col.includes('GENDER')) colJantina = index;
    });
    
    if (colNoKp === -1 || colNama === -1 || colTahun === -1 || colKelas === -1 || colJantina === -1) {
        showToast('❌ Header CSV tidak lengkap!', 'error');
        return;
    }
    
    csvData = [];
    const previewBody = document.getElementById('csvPreviewBody');
    previewBody.innerHTML = '';
    
    let validCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',');
        
        if (parts.length < 5) continue;
        
        const noKp = parts[colNoKp].trim();
        const namaMurid = parts[colNama].trim().toUpperCase();
        let tahun = parts[colTahun].trim().toUpperCase();
        const kelas = parts[colKelas].trim().toUpperCase();
        let jantina = parts[colJantina].trim().toUpperCase();
        
        if (tahun === '1') tahun = 'SATU';
        else if (tahun === '2') tahun = 'DUA';
        else if (tahun === '3') tahun = 'TIGA';
        else if (tahun === '4') tahun = 'EMPAT';
        else if (tahun === '5') tahun = 'LIMA';
        else if (tahun === '6') tahun = 'ENAM';
        
        if (jantina === 'L') jantina = 'LELAKI';
        else if (jantina === 'P') jantina = 'PEREMPUAN';
        
        const murid = {
            noKp: noKp,
            namaMurid: namaMurid,
            tahun: tahun,
            kelas: kelas,
            jantina: jantina
        };
        
        csvData.push(murid);
        validCount++;
        
        if (validCount <= 5) {
            const row = previewBody.insertRow();
            row.innerHTML = '<td style="padding: 8px;">' + murid.noKp + '</td>' +
                '<td style="padding: 8px;">' + murid.namaMurid + '</td>' +
                '<td style="padding: 8px;">' + murid.tahun + '</td>' +
                '<td style="padding: 8px;">' + murid.kelas + '</td>' +
                '<td style="padding: 8px;">' + murid.jantina + '</td>';
        }
    }
    
    document.getElementById('csvRecordCount').textContent = csvData.length;
    document.getElementById('csvPreview').style.display = 'block';
    document.getElementById('btnImportCSV').disabled = false;
}

async function importCSV() {
    if (csvData.length === 0) return;
    
    showLoading('Importing...');
    closeModal('modalImportCSV');
    
    let successCount = 0;
    let skipCount = 0;
    
    try {
        const allNoKp = csvData.map(m => m.noKp);
        const duplicates = new Set();
        
        const chunkSize = 10;
        const totalChecks = Math.ceil(allNoKp.length / chunkSize);
        
        for (let i = 0; i < totalChecks; i++) {
            const chunk = allNoKp.slice(i * chunkSize, (i + 1) * chunkSize);
            
            if (chunk.length === 0) continue;
            
            const snapshot = await db.collection('murid')
                .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
                .get();
            
            snapshot.forEach(doc => duplicates.add(doc.id));
        }
        
        const batchSize = 500;
        let batch = db.batch();
        let batchCount = 0;
        
        for (let i = 0; i < csvData.length; i++) {
            const murid = csvData[i];
            
            if (duplicates.has(murid.noKp)) {
                skipCount++;
                continue;
            }
            
            const muridRef = db.collection('murid').doc(murid.noKp);
            batch.set(muridRef, {
                noKp: murid.noKp,
                namaMurid: murid.namaMurid,
                tahun: murid.tahun,
                kelas: murid.kelas,
                jantina: murid.jantina,
                agama: 'ISLAM',
                status: 'AKTIF',
                tahun_kelas: murid.tahun + '_' + murid.kelas,
                searchName: murid.namaMurid.toLowerCase(),
                tarikhDaftar: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            successCount++;
            batchCount++;
            
            if (batchCount === batchSize || i === csvData.length - 1) {
                if (batchCount > 0) {
                    await batch.commit();
                    batch = db.batch();
                    batchCount = 0;
                }
            }
        }
        
        hideLoading();
        alert('✅ Import selesai!\n\nBerjaya: ' + successCount + '\nDilangkau: ' + skipCount);
        loadMuridStats();
        
    } catch (error) {
        console.error('Error:', error);
        showToast('Error: ' + error.message, 'error');
        hideLoading();
    }
}

function downloadTemplate() {
    const csv = 'NO_KP,NAMA_MURID,TAHUN,KELAS,JANTINA\n' +
                '130000110987,AHMAD BIN ALI,ENAM,INTEL,LELAKI\n' +
                '1,SITI BINTI OMAR,ENAM,INTEL,PEREMPUAN';
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_murid.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    
    showToast('✅ Template dimuat turun', 'success');
}

// ============================================================================
// TAB 2: RESET DATABASE
// ============================================================================

// --- LOAD DROPDOWN TAHUN dari rekod_pbd.tahun_rekod ---
async function loadTahunRekodDropdown() {
    try {
        const snap = await db.collection('rekod_pbd').get();
        allRekodData = [];
        const years = new Set();
        const tahuns = new Set();

        snap.forEach(doc => {
            const d = doc.data();
            allRekodData.push(d);
            if (d.tahun_rekod) years.add(d.tahun_rekod);
            if (d.tahun) tahuns.add(d.tahun);
        });

        // Dropdown Year
        const selYear = document.getElementById('resetTahunRekod');
        if (selYear) {
            selYear.innerHTML = '<option value="semua">🌍 Semua Year</option>';
            Array.from(years).sort().forEach(y => selYear.add(new Option(y, y)));
        }

        // Dropdown Tahun — sort ikut urutan SATU..ENAM
        const tahunOrder = { 'SATU':1, 'DUA':2, 'TIGA':3, 'EMPAT':4, 'LIMA':5, 'ENAM':6 };
        const selTahun = document.getElementById('resetTahun');
        if (selTahun) {
            selTahun.innerHTML = '<option value="semua">🌍 Semua Tahun</option>';
            Array.from(tahuns)
                .sort((a, b) => (tahunOrder[a] || 99) - (tahunOrder[b] || 99))
                .forEach(t => selTahun.add(new Option(t, t)));
        }

        // Initial load kelas dropdown
        updateKelasDd();
    } catch (e) {
        console.error('Error loading tahun dropdown:', e);
    }
}

// --- Update Kelas dropdown ikut Year + Tahun yang dipilih ---
function updateKelasDd() {
    const selYear = document.getElementById('resetTahunRekod');
    const selTahun = document.getElementById('resetTahun');
    const selKelas = document.getElementById('resetKelas');
    if (!selKelas) return;

    const year = selYear ? selYear.value : 'semua';
    const tahun = selTahun ? selTahun.value : 'semua';

    const kelasSet = new Set();
    allRekodData.forEach(d => {
        if (year !== 'semua' && d.tahun_rekod !== year) return;
        if (tahun !== 'semua' && d.tahun !== tahun) return;
        if (d.kelas) kelasSet.add(d.kelas);
    });

    selKelas.innerHTML = '<option value="semua">🌍 Semua Kelas</option>';
    Array.from(kelasSet).sort().forEach(k => selKelas.add(new Option(k, k)));
}

// --- CONFIRM RESET: tunjukkan tahun dalam mesej ---
function confirmReset(type) {
    resetType = type;
    
    const messages = {
        'murid': { title: 'RESET MURID', message: 'Padam SEMUA murid?' },
        'rekod': { title: 'RESET REKOD', message: '' },
        'subjek': { title: 'RESET SUBJEK', message: 'Padam SEMUA subjek/topik?' },
        'semua': { title: 'RESET SEMUA', message: 'BAHAYA! Padam SEMUA DATA?' }
    };
    
    const msg = messages[type];

    // Rekod: tunjukkan year + tahun yang dipilih dalam mesej
    if (type === 'rekod') {
        const selYear = document.getElementById('resetTahunRekod');
        const selTahun = document.getElementById('resetTahun');
        const year = selYear ? selYear.value : 'semua';
        const tahun = selTahun ? selTahun.value : 'semua';

        if (year === 'semua' && tahun === 'semua') {
            msg.message = 'Padam SEMUA rekod PBD (semua year, semua tahun)?';
        } else if (year !== 'semua' && tahun === 'semua') {
            msg.message = 'Padam rekod PBD year ' + year + ' (semua tahun)?';
        } else if (year === 'semua' && tahun !== 'semua') {
            msg.message = 'Padam rekod PBD tahun ' + tahun + ' (semua year)?';
        } else {
            msg.message = 'Padam rekod PBD year ' + year + ', tahun ' + tahun + '?';
        }
    }
    
    document.getElementById('resetWarningTitle').textContent = msg.title;
    document.getElementById('resetWarningMessage').textContent = msg.message;
    document.getElementById('resetConfirmPassword').value = '';
    
    openModal('modalConfirmReset');
}

// --- EXECUTE RESET: filter rekod by tahun_rekod ---
async function executeReset() {
    const password = document.getElementById('resetConfirmPassword').value;
    
    if (password !== 'adminpbd2024') {
        showToast('Password salah!', 'error');
        return;
    }
    
    closeModal('modalConfirmReset');
    showLoading('Resetting...');
    
    try {
        if (resetType === 'murid') {
            await resetCollection('murid');
        } else if (resetType === 'rekod') {
            const selYear = document.getElementById('resetTahunRekod');
            const selTahun = document.getElementById('resetTahun');
            const year = selYear ? selYear.value : 'semua';
            const tahun = selTahun ? selTahun.value : 'semua';
            await resetRekodByFilter(year, tahun);
        } else if (resetType === 'subjek') {
            await resetCollection('subjek');
            await resetCollection('topik_pembelajaran');
        } else if (resetType === 'semua') {
            await resetCollection('murid');
            await resetCollection('rekod_pbd');
            await resetCollection('subjek');
            await resetCollection('topik_pembelajaran');
        }
        
        showToast('✅ Reset berjaya', 'success');
        loadMuridStats();
        hideLoading();
    } catch (error) {
        console.error('Error:', error);
        showToast('Error: ' + error.message, 'error');
        hideLoading();
    }
}

// --- Padam semua doc dalam collection ---
async function resetCollection(collectionName) {
    const batchSize = 500;
    
    while (true) {
        const snapshot = await db.collection(collectionName).limit(batchSize).get();
        if (snapshot.empty) break;
        
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
}

// --- Padam rekod_pbd WHERE year + tahun (dynamic filter) ---
async function resetRekodByFilter(year, tahun) {
    const batchSize = 500;

    while (true) {
        let query = db.collection('rekod_pbd');
        if (year !== 'semua') query = query.where('tahun_rekod', '==', year);
        if (tahun !== 'semua') query = query.where('tahun', '==', tahun);
        query = query.limit(batchSize);

        const snapshot = await query.get();
        if (snapshot.empty) break;

        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
}

// ============================================================================
// TAB 4: SUBJEK MANAGEMENT
// ============================================================================

async function loadSubjekList() {
    console.log('🔍 loadSubjekList START');
    
    try {
        showLoading('Loading...');
        console.log('🔍 db defined?', typeof db, 'showLoading?', typeof showLoading);
        console.log('🔍 calling db.collection(subjek).get()...');
        const snapshot = await db.collection('subjek').get();
        console.log('🔍 snapshot received, size:', snapshot.size);
        const tbody = document.getElementById('subjekTableBody');
        console.log('🔍 tbody found:', !!tbody);
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">Tiada subjek</td></tr>';
            hideLoading();
            return;
        }
        
        const subjekList = [];
        snapshot.forEach(doc => {
            subjekList.push({ id: doc.id, ...doc.data() });
        });
        
        subjekList.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
        
        let counter = 1;
        subjekList.forEach(subjek => {
            const statusBadge = subjek.aktif ? 
                '<span class="badge badge-success">AKTIF</span>' : 
                '<span class="badge" style="background: #999;">TIDAK AKTIF</span>';
            
            let muridBadge = '';
            if (subjek.murid_terlibat === 'SEMUA') {
                muridBadge = '<span class="badge" style="background: #10b981; color: white;">🌍 SEMUA</span>';
            } else if (subjek.murid_terlibat === 'ISLAM') {
                muridBadge = '<span class="badge" style="background: #3b82f6; color: white;">☪️ ISLAM</span>';
            } else if (subjek.murid_terlibat === 'BUKAN_ISLAM') {
                muridBadge = '<span class="badge" style="background: #8b5cf6; color: white;">✝️ BUKAN ISLAM</span>';
            }
            
            const row = tbody.insertRow();
            row.innerHTML = '<td>' + counter + '</td>' +
                '<td><strong>' + subjek.subjek + '</strong></td>' +
                '<td>' + (subjek.urutan || '-') + '</td>' +
                '<td>' + statusBadge + '</td>' +
                '<td>' + muridBadge + '</td>' +
                '<td><div class="table-actions">' +
                '<button class="btn btn-sm btn-primary" onclick=\'editSubjek("' + subjek.id + '")\'>✏️</button>' +
                '<button class="btn btn-sm btn-danger" onclick=\'deleteSubjek("' + subjek.id + '", "' + subjek.subjek + '")\'>🗑️</button>' +
                '</div></td>';
            
            counter++;
        });
        
        hideLoading();
        console.log('🔍 loadSubjekList DONE');
    } catch (error) {
        console.error('🔴 loadSubjekList ERROR:', error);
        hideLoading();
    }
}

function openAddSubjekModal() {
    document.getElementById('modalSubjekTitle').textContent = '➕ Tambah Subjek';
    document.getElementById('editSubjekId').value = '';
    document.getElementById('inputSubjekNama').value = '';
    document.getElementById('inputSubjekUrutan').value = '';
    document.getElementById('inputMuridTerlibat').value = '';
    document.getElementById('inputSubjekAktif').checked = true;
    openModal('modalSubjek');
}

async function editSubjek(subjekId) {
    showLoading('Loading...');
    
    try {
        const doc = await db.collection('subjek').doc(subjekId).get();
        
        if (!doc.exists) {
            showToast('Subjek tidak dijumpai', 'error');
            hideLoading();
            return;
        }
        
        const data = doc.data();
        
        document.getElementById('modalSubjekTitle').textContent = '✏️ Edit Subjek';
        document.getElementById('editSubjekId').value = subjekId;
        document.getElementById('inputSubjekNama').value = data.subjek;
        document.getElementById('inputSubjekUrutan').value = data.urutan || '';
        document.getElementById('inputMuridTerlibat').value = data.murid_terlibat || '';
        document.getElementById('inputSubjekAktif').checked = data.aktif;
        
        openModal('modalSubjek');
        hideLoading();
    } catch (error) {
        console.error('Error:', error);
        hideLoading();
    }
}

async function saveSubjek() {
    const subjekId = document.getElementById('editSubjekId').value;
    const subjekNama = document.getElementById('inputSubjekNama').value.trim().toUpperCase();
    const urutan = parseInt(document.getElementById('inputSubjekUrutan').value);
    const muridTerlibat = document.getElementById('inputMuridTerlibat').value;
    const aktif = document.getElementById('inputSubjekAktif').checked;
    
    if (!subjekNama || !urutan || !muridTerlibat) {
        showToast('Sila lengkapkan borang', 'warning');
        return;
    }
    
    showLoading('Saving...');
    
    try {
        const subjekData = {
            subjek: subjekNama,
            urutan: urutan,
            murid_terlibat: muridTerlibat,
            aktif: aktif,
            updatedAt: getTimestamp()
        };
        
        if (subjekId) {
            await db.collection('subjek').doc(subjekId).update(subjekData);
            showToast('✅ Subjek dikemaskini', 'success');
        } else {
            const allSubjek = await db.collection('subjek').get();
            let maxId = 0;
            allSubjek.forEach(doc => {
                const id = parseInt(doc.data().id_subjek);
                if (!isNaN(id) && id > maxId) maxId = id;
            });
            
            subjekData.id_subjek = (maxId + 1).toString();
            subjekData.createdAt = getTimestamp();
            
            await db.collection('subjek').add(subjekData);
            showToast('✅ Subjek ditambah', 'success');
        }
        
        closeModal('modalSubjek');
        loadSubjekList();
        hideLoading();
    } catch (error) {
        console.error('Error:', error);
        showToast('Error: ' + error.message, 'error');
        hideLoading();
    }
}

async function deleteSubjek(subjekId, subjekNama) {
    showLoading('Checking...');
    
    try {
        const doc = await db.collection('subjek').doc(subjekId).get();
        const id_subjek = doc.data().id_subjek;
        
        const topikCheck = await db.collection('topik_pembelajaran')
            .where('id_subjek', '==', id_subjek)
            .limit(1)
            .get();
        
        hideLoading();
        
        if (!topikCheck.empty) {
            alert('❌ Tidak boleh padam!\n\nSubjek "' + subjekNama + '" mempunyai topik.');
            return;
        }
        
        if (confirm('Padam subjek "' + subjekNama + '"?')) {
            showLoading('Deleting...');
            await db.collection('subjek').doc(subjekId).delete();
            showToast('✅ Subjek dipadam', 'success');
            loadSubjekList();
            hideLoading();
        }
    } catch (error) {
        console.error('Error:', error);
        hideLoading();
    }
}

// ============================================================================
// TAB 5: SYSTEM SETTINGS
// ============================================================================

let currentLogoBase64 = null;

function previewLogo(event) {
    var file = event.target.files[0];
    if (!file) return;
    if (file.size > 200000) { showToast('⚠️ Logo terlalu besar. Max 200KB', 'error'); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
        currentLogoBase64 = e.target.result;
        document.getElementById('logoPreview').innerHTML = '<img src="' + e.target.result + '" style="width:100%;height:100%;object-fit:cover;">';
        document.getElementById('btnRemoveLogo').style.display = 'inline-block';
    };
    reader.readAsDataURL(file);
}

function removeLogo() {
    currentLogoBase64 = 'REMOVE';
    document.getElementById('logoPreview').innerHTML = '<span style="color:#aaa;font-size:12px;">Tiada Logo</span>';
    document.getElementById('btnRemoveLogo').style.display = 'none';
    document.getElementById('logoUpload').value = '';
}

async function loadSystemSettings() {
    showLoading('Loading...');
    
    try {
        const configDoc = await db.collection('config').doc('system_settings').get();
        
        if (configDoc.exists) {
            const config = configDoc.data();
            
            document.getElementById('namaSekolah').value = config.namaSekolah || '';
            document.getElementById('tahunSemasa').value = config.tahunSemasa || '';
            document.getElementById('headerTitle').value = config.headerTitle || '';
            if (config.logoBase64) {
                currentLogoBase64 = config.logoBase64;
                document.getElementById('logoPreview').innerHTML = '<img src="' + config.logoBase64 + '" style="width:100%;height:100%;object-fit:cover;">';
                document.getElementById('btnRemoveLogo').style.display = 'inline-block';
            }
            
            if (config.features) {
                document.getElementById('allowMasukRekod').checked = config.features.allowMasukRekod || false;
                document.getElementById('allowEditRekod').checked = config.features.allowEditRekod || false;
                document.getElementById('allowDeleteRekod').checked = config.features.allowDeleteRekod || false;
                document.getElementById('allowPengurusanMurid').checked = config.features.allowPengurusanMurid || false;
                document.getElementById('allowExportPDF').checked = config.features.allowExportPDF || false;
            }
        }
        
        hideLoading();
    } catch (error) {
        console.error('Error:', error);
        hideLoading();
    }
}

async function saveSystemSettings() {
    showLoading('Saving...');
    
    try {
        await db.collection('config').doc('system_settings').update({
            namaSekolah: document.getElementById('namaSekolah').value,
            tahunSemasa: document.getElementById('tahunSemasa').value,
            headerTitle: document.getElementById('headerTitle').value,
            logoBase64: currentLogoBase64 === 'REMOVE' ? null : currentLogoBase64,
            features: {
                allowMasukRekod: document.getElementById('allowMasukRekod').checked,
                allowEditRekod: document.getElementById('allowEditRekod').checked,
                allowDeleteRekod: document.getElementById('allowDeleteRekod').checked,
                allowPengurusanMurid: document.getElementById('allowPengurusanMurid').checked,
                allowExportPDF: document.getElementById('allowExportPDF').checked
            },
            updatedAt: getTimestamp()
        });
        
        if (currentLogoBase64 === 'REMOVE') currentLogoBase64 = null;
        showToast('✅ Tetapan disimpan', 'success');
        hideLoading();
    } catch (error) {
        console.error('Error:', error);
        hideLoading();
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function loadAdminData() {
    loadMuridStats();
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

document.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
});