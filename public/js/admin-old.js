// ============================================================================
// ADMIN PANEL - FULL CONTROL
// Sistem Rekod PBD - SK Sultan Ismail
// ============================================================================

let currentAdminTab = 'murid';
let csvData = [];
let resetType = '';

// ============================================================================
// LOGIN/LOGOUT
// ============================================================================

async function loginAdmin() {
    const password = document.getElementById('adminPassword').value;
    
    if (!password) {
        showToast('Sila masukkan password', 'warning');
        return;
    }
    
    showLoading('Checking password...');
    
    try {
        const configDoc = await db.collection('config').doc('system_settings').get();
        const correctPassword = configDoc.exists ? configDoc.data().adminPassword : 'adminpbd2024';
        
        if (password === correctPassword) {
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
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('adminPassword').value = '';
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
// CSV IMPORT (ADMIN ONLY)
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
    
    csvData = [];
    const previewBody = document.getElementById('csvPreviewBody');
    previewBody.innerHTML = '';
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',');
        
        if (parts.length < 5) continue;
        
        const murid = {
            noKp: parts[0].trim(),
            namaMurid: parts[1].trim().toUpperCase(),
            tahun: parts[2].trim().toUpperCase(),
            kelas: parts[3].trim().toUpperCase(),
            jantina: parts[4].trim().toUpperCase()
        };
        
        csvData.push(murid);
        
        if (i <= 5) {
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
    if (csvData.length === 0) {
        showToast('Tiada data untuk import', 'warning');
        return;
    }
    
    showLoading('Importing ' + csvData.length + ' murid...');
    closeModal('modalImportCSV');
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    try {
        for (let i = 0; i < csvData.length; i++) {
            const murid = csvData[i];
            
            try {
                const existingDoc = await db.collection('murid').doc(murid.noKp).get();
                
                if (existingDoc.exists) {
                    skipCount++;
                    console.log('Skipped (duplicate):', murid.noKp);
                    continue;
                }
                
                await db.collection('murid').doc(murid.noKp).set({
                    noKp: murid.noKp,
                    namaMurid: murid.namaMurid,
                    tahun: murid.tahun,
                    kelas: murid.kelas,
                    jantina: murid.jantina,
                    status: 'AKTIF',
                    tahun_kelas: murid.tahun + '_' + murid.kelas,
                    searchName: murid.namaMurid.toLowerCase(),
                    subjekDiambil: [],
                    tarikhDaftar: getTimestamp(),
                    updatedAt: getTimestamp()
                });
                
                successCount++;
            } catch (err) {
                errorCount++;
                console.error('Error importing:', murid.noKp, err);
            }
        }
        
        hideLoading();
        
        let message = '✅ Import selesai!\n\n';
        message += 'Berjaya: ' + successCount + '\n';
        if (skipCount > 0) message += 'Dilangkau (duplicate): ' + skipCount + '\n';
        if (errorCount > 0) message += 'Error: ' + errorCount;
        
        alert(message);
        showToast('Import selesai: ' + successCount + ' murid ditambah', 'success');
        loadMuridStats();
        
    } catch (error) {
        console.error('Error importing CSV:', error);
        showToast('Error: ' + error.message, 'error');
        hideLoading();
    }
}

function downloadTemplate() {
    const csv = 'NO_KP,NAMA_MURID,TAHUN,KELAS,JANTINA\n' +
                '130000110987,AHMAD BIN ALI,ENAM,INTEL,LELAKI\n' +
                '1,SITI BINTI OMAR,ENAM,INTEL,PEREMPUAN\n' +
                '12345,MUHAMMAD HAFIZ,LIMA,AMANAH,LELAKI';
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_murid.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    
    showToast('✅ Template CSV dimuat turun', 'success');
}

// ============================================================================
// TAB 2: RESET DATABASE
// ============================================================================

function confirmReset(type) {
    resetType = type;
    
    const messages = {
        'murid': {
            title: 'RESET SENARAI MURID',
            message: 'Anda akan memadam SEMUA data murid (' + 'collection: murid' + ').\n\nTindakan ini TIDAK BOLEH dibatalkan!'
        },
        'rekod': {
            title: 'RESET REKOD PBD',
            message: 'Anda akan memadam SEMUA rekod penilaian (' + 'collection: rekod_pbd' + ').\n\nTindakan ini TIDAK BOLEH dibatalkan!'
        },
        'subjek': {
            title: 'RESET SUBJEK/TOPIK',
            message: 'Anda akan memadam SEMUA subjek, topik, dan sub-topik (' + 'collections: subjek, topik_pembelajaran' + ').\n\nTindakan ini TIDAK BOLEH dibatalkan!'
        },
        'semua': {
            title: 'RESET SEMUA DATA',
            message: 'BAHAYA! Anda akan memadam SEMUA DATA dalam sistem:\n\n• Semua murid\n• Semua rekod PBD\n• Semua subjek/topik\n\nSistem akan kembali ke keadaan awal!\n\nTindakan ini TIDAK BOLEH dibatalkan!'
        }
    };
    
    const msg = messages[type];
    document.getElementById('resetWarningTitle').textContent = msg.title;
    document.getElementById('resetWarningMessage').textContent = msg.message;
    document.getElementById('resetConfirmPassword').value = '';
    
    openModal('modalConfirmReset');
}

async function executeReset() {
    const password = document.getElementById('resetConfirmPassword').value;
    
    if (password !== 'adminpbd2024') {
        showToast('Password salah! Reset dibatalkan.', 'error');
        return;
    }
    
    closeModal('modalConfirmReset');
    showLoading('Resetting database...');
    
    try {
        if (resetType === 'murid') {
            await resetCollection('murid');
            showToast('✅ Senarai murid berjaya direset', 'success');
        } else if (resetType === 'rekod') {
            await resetCollection('rekod_pbd');
            showToast('✅ Rekod PBD berjaya direset', 'success');
        } else if (resetType === 'subjek') {
            await resetCollection('subjek');
            await resetCollection('topik_pembelajaran');
            showToast('✅ Subjek/Topik berjaya direset', 'success');
        } else if (resetType === 'semua') {
            await resetCollection('murid');
            await resetCollection('rekod_pbd');
            await resetCollection('subjek');
            await resetCollection('topik_pembelajaran');
            showToast('✅ SEMUA data berjaya direset', 'success');
        }
        
        loadMuridStats();
        hideLoading();
    } catch (error) {
        console.error('Error resetting:', error);
        showToast('Error: ' + error.message, 'error');
        hideLoading();
    }
}

async function resetCollection(collectionName) {
    const snapshot = await db.collection(collectionName).get();
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log('✅ Collection "' + collectionName + '" deleted (' + snapshot.size + ' documents)');
}

// ============================================================================
// TAB 4: SYSTEM SETTINGS
// ============================================================================

async function loadSystemSettings() {
    showLoading('Loading settings...');
    
    try {
        const configDoc = await db.collection('config').doc('system_settings').get();
        
        if (configDoc.exists) {
            const config = configDoc.data();
            
            document.getElementById('namaSekolah').value = config.namaSekolah || '';
            document.getElementById('tahunSemasa').value = config.tahunSemasa || '';
            document.getElementById('headerTitle').value = config.headerTitle || '';
            
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
        console.error('Error loading settings:', error);
        hideLoading();
    }
}

async function saveSystemSettings() {
    showLoading('Saving settings...');
    
    try {
        await db.collection('config').doc('system_settings').update({
            namaSekolah: document.getElementById('namaSekolah').value,
            tahunSemasa: document.getElementById('tahunSemasa').value,
            headerTitle: document.getElementById('headerTitle').value,
            features: {
                allowMasukRekod: document.getElementById('allowMasukRekod').checked,
                allowEditRekod: document.getElementById('allowEditRekod').checked,
                allowDeleteRekod: document.getElementById('allowDeleteRekod').checked,
                allowPengurusanMurid: document.getElementById('allowPengurusanMurid').checked,
                allowExportPDF: document.getElementById('allowExportPDF').checked
            },
            updatedAt: getTimestamp()
        });
        
        showToast('✅ Tetapan berjaya disimpan', 'success');
        hideLoading();
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Error: ' + error.message, 'error');
        hideLoading();
    }
}

// ============================================================================
// LOAD ADMIN DATA
// ============================================================================

function loadAdminData() {
    loadMuridStats();
}

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================

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

// ============================================================================
// INITIALIZE
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Admin Panel module loaded');
});
