// ============================================================================
// PENGURUSAN MURID - WITH AGAMA FIELD (No subjek management)
// Sistem Rekod PBD - SK Sultan Ismail
// ============================================================================

let allMurid = [];
let deleteItem = null;

// ============================================================================
// INITIALIZE
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    loadMuridList();
    console.log('✅ Pengurusan Murid module loaded');
});

// ============================================================================
// LOAD KELAS LIST (DYNAMIC DROPDOWN)
// ============================================================================

async function loadKelasList() {
    const tahun = document.getElementById('filterTahun').value;
    const selectKelas = document.getElementById('filterKelas');
    
    selectKelas.innerHTML = '<option value="">Semua Kelas</option>';
    
    if (!tahun) {
        loadMuridList();
        return;
    }
    
    try {
        const snapshot = await db.collection('murid')
            .where('tahun', '==', tahun)
            .where('status', '==', 'AKTIF')
            .get();
        
        const kelasSet = new Set();
        snapshot.forEach(doc => {
            kelasSet.add(doc.data().kelas);
        });
        
        const kelasList = Array.from(kelasSet).sort();
        kelasList.forEach(kelas => {
            const option = new Option(kelas, kelas);
            selectKelas.add(option);
        });
        
        loadMuridList();
        
    } catch (error) {
        console.error('Error loading kelas list:', error);
    }
}

// ============================================================================
// LOAD MURID LIST
// ============================================================================

async function loadMuridList() {
    showLoading('Loading murid...');
    
    try {
        const tahun = document.getElementById('filterTahun').value;
        const kelas = document.getElementById('filterKelas').value;
        
        let query = db.collection('murid');
        
        if (tahun && kelas) {
            const tahunKelas = tahun + '_' + kelas;
            query = query.where('tahun_kelas', '==', tahunKelas);
        } else if (tahun) {
            query = query.where('tahun', '==', tahun);
        }
        
        query = query.where('status', '==', 'AKTIF');
        
        const snapshot = await query.get();
        
        allMurid = [];
        const tbody = document.getElementById('muridTableBody');
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #999;"><div style="font-size: 48px; margin-bottom: 20px;">👥</div><p>Tiada murid dijumpai</p><p style="font-size: 14px;">Klik "Tambah Murid" untuk mula</p></td></tr>';
            document.getElementById('muridCount').style.display = 'none';
            hideLoading();
            return;
        }
        
        snapshot.forEach(doc => {
            allMurid.push({ noKp: doc.id, ...doc.data() });
        });
        
        allMurid.sort((a, b) => a.namaMurid.localeCompare(b.namaMurid));
        
        displayMuridTable(allMurid);
        
        document.getElementById('muridCount').style.display = 'block';
        document.getElementById('totalMurid').textContent = allMurid.length;
        
        hideLoading();
    } catch (error) {
        console.error('Error loading murid:', error);
        showToast('Error loading murid: ' + error.message, 'error');
        hideLoading();
    }
}

function displayMuridTable(muridList) {
    const tbody = document.getElementById('muridTableBody');
    tbody.innerHTML = '';
    
    let counter = 1;
    muridList.forEach(murid => {
        // DEFAULT to ISLAM if field missing (rekod lama)
        const agama = murid.agama || 'ISLAM';

        const agamaBadge = agama === 'ISLAM' ? 
            '<span class="badge" style="background: #3b82f6; color: white;">☪️ ISLAM</span>' : 
            '<span class="badge" style="background: #8b5cf6; color: white;">✝️ BUKAN ISLAM</span>';
        
        const row = tbody.insertRow();
        row.innerHTML = '<td data-label="BIL">' + counter + '</td>' +
            '<td data-label="NO KP">' + murid.noKp + '</td>' +
            '<td data-label="NAMA MURID">' + murid.namaMurid + '</td>' +
            '<td data-label="TAHUN">' + murid.tahun + '</td>' +
            '<td data-label="KELAS">' + murid.kelas + '</td>' +
            '<td data-label="JANTINA">' + murid.jantina + '</td>' +
            '<td data-label="AGAMA">' + agamaBadge + '</td>' +
            '<td data-label="TINDAKAN"><div class="table-actions">' +
            '<button class="btn btn-sm btn-primary" onclick=\'editMurid("' + murid.noKp + '")\'>✏️ Edit</button>' +
            '<button class="btn btn-sm btn-danger" onclick=\'deleteMurid("' + murid.noKp + '", "' + murid.namaMurid + '")\'>🗑️ Padam</button>' +
            '</div></td>';
        counter++;
    });
}

// ============================================================================
// SEARCH MURID
// ============================================================================

function searchMurid() {
    const searchTerm = document.getElementById('searchNama').value.trim().toLowerCase();
    
    if (!searchTerm) {
        displayMuridTable(allMurid);
        return;
    }
    
    const filtered = allMurid.filter(murid => 
        murid.namaMurid.toLowerCase().includes(searchTerm) ||
        murid.noKp.includes(searchTerm)
    );
    
    displayMuridTable(filtered);
    
    if (filtered.length === 0) {
        const tbody = document.getElementById('muridTableBody');
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #999;">Tiada murid dijumpai untuk carian "' + searchTerm + '"</td></tr>';
    }
}

// ============================================================================
// ADD/EDIT MURID
// ============================================================================

function openAddMuridModal() {
    document.getElementById('modalMuridTitle').textContent = '➕ Tambah Murid Baru';
    document.getElementById('editMuridNoKp').value = '';
    document.getElementById('inputNoKp').value = '';
    document.getElementById('inputNoKp').disabled = false;
    document.getElementById('inputNamaMurid').value = '';
    document.getElementById('inputTahun').value = '';
    document.getElementById('inputKelas').value = '';
    document.getElementById('inputJantina').value = '';
    document.getElementById('inputAgama').value = 'ISLAM'; // Default: ISLAM
    openModal('modalMurid');
    document.getElementById('inputNoKp').focus();
}

async function editMurid(noKp) {
    showLoading('Loading...');
    
    try {
        const doc = await db.collection('murid').doc(noKp).get();
        
        if (!doc.exists) {
            showToast('Murid tidak dijumpai', 'error');
            hideLoading();
            return;
        }
        
        const data = doc.data();
        
        document.getElementById('modalMuridTitle').textContent = '✏️ Edit Murid';
        document.getElementById('editMuridNoKp').value = noKp;
        document.getElementById('inputNoKp').value = noKp;
        document.getElementById('inputNoKp').disabled = true;
        document.getElementById('inputNamaMurid').value = data.namaMurid;
        document.getElementById('inputTahun').value = data.tahun;
        document.getElementById('inputKelas').value = data.kelas;
        document.getElementById('inputJantina').value = data.jantina;
        document.getElementById('inputAgama').value = data.agama || 'ISLAM'; // Default ISLAM if missing
        
        openModal('modalMurid');
        hideLoading();
        document.getElementById('inputNamaMurid').focus();
    } catch (error) {
        console.error('Error loading murid:', error);
        showToast('Error: ' + error.message, 'error');
        hideLoading();
    }
}

async function saveMurid() {
    const noKp = document.getElementById('inputNoKp').value.trim();
    const namaMurid = document.getElementById('inputNamaMurid').value.trim().toUpperCase();
    const tahun = document.getElementById('inputTahun').value;
    const kelas = document.getElementById('inputKelas').value.trim().toUpperCase();
    const jantina = document.getElementById('inputJantina').value;
    const agama = document.getElementById('inputAgama').value;
    const editNoKp = document.getElementById('editMuridNoKp').value;
    
    if (!noKp) {
        showToast('Sila masukkan No KP', 'warning');
        document.getElementById('inputNoKp').focus();
        return;
    }
    
    if (!namaMurid) {
        showToast('Sila masukkan nama murid', 'warning');
        document.getElementById('inputNamaMurid').focus();
        return;
    }
    
    if (!tahun) {
        showToast('Sila pilih tahun', 'warning');
        document.getElementById('inputTahun').focus();
        return;
    }
    
    if (!kelas) {
        showToast('Sila masukkan kelas', 'warning');
        document.getElementById('inputKelas').focus();
        return;
    }
    
    if (!jantina) {
        showToast('Sila pilih jantina', 'warning');
        document.getElementById('inputJantina').focus();
        return;
    }
    
    if (!agama) {
        showToast('Sila pilih agama', 'warning');
        document.getElementById('inputAgama').focus();
        return;
    }
    
    showLoading('Saving...');
    
    try {
        const muridData = {
            noKp: noKp,
            namaMurid: namaMurid,
            tahun: tahun,
            kelas: kelas,
            jantina: jantina,
            agama: agama,
            status: 'AKTIF',
            tahun_kelas: tahun + '_' + kelas,
            searchName: namaMurid.toLowerCase(),
            updatedAt: getTimestamp()
        };
        
        if (editNoKp) {
            await db.collection('murid').doc(editNoKp).update(muridData);
            showToast('✅ Murid berjaya dikemaskini', 'success');
        } else {
            const existingDoc = await db.collection('murid').doc(noKp).get();
            if (existingDoc.exists) {
                showToast('No KP "' + noKp + '" sudah wujud!', 'error');
                hideLoading();
                return;
            }
            
            muridData.tarikhDaftar = getTimestamp();
            await db.collection('murid').doc(noKp).set(muridData);
            showToast('✅ Murid berjaya ditambah', 'success');
        }
        
        closeModal('modalMurid');
        loadKelasList();
        hideLoading();
    } catch (error) {
        console.error('Error saving murid:', error);
        showToast('Error: ' + error.message, 'error');
        hideLoading();
    }
}

function deleteMurid(noKp, nama) {
    deleteItem = { noKp: noKp, nama: nama };
    document.getElementById('deleteConfirmMessage').textContent = 
        'Adakah anda pasti mahu memadam murid "' + nama + '" (No KP: ' + noKp + ')?';
    openModal('modalConfirmDelete');
}

async function confirmDelete() {
    if (!deleteItem) return;
    
    showLoading('Deleting...');
    closeModal('modalConfirmDelete');
    
    try {
        await db.collection('murid').doc(deleteItem.noKp).delete();
        showToast('✅ Murid berjaya dipadam', 'success');
        deleteItem = null;
        loadMuridList();
        hideLoading();
    } catch (error) {
        console.error('Error deleting murid:', error);
        showToast('Error: ' + error.message, 'error');
        hideLoading();
    }
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