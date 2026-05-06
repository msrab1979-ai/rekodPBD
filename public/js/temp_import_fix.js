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
        // STEP 1: Check duplicates in bulk
        const noKpList = csvData.map(m => m.noKp);
        const existingDocs = await db.collection('murid')
            .where(firebase.firestore.FieldPath.documentId(), 'in', noKpList.slice(0, 10))
            .get();
        
        const existingNoKp = new Set();
        existingDocs.forEach(doc => existingNoKp.add(doc.id));
        
        // STEP 2: Batch write (500 per batch)
        const batchSize = 500;
        const totalBatches = Math.ceil(csvData.length / batchSize);
        
        for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
            const batch = db.batch();
            const start = batchNum * batchSize;
            const end = Math.min(start + batchSize, csvData.length);
            
            showLoading('Batch ' + (batchNum + 1) + '/' + totalBatches + ' (' + start + '-' + end + ')');
            
            for (let i = start; i < end; i++) {
                const murid = csvData[i];
                
                // Skip if duplicate
                if (existingNoKp.has(murid.noKp)) {
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
                    status: 'AKTIF',
                    tahun_kelas: murid.tahun + '_' + murid.kelas,
                    searchName: murid.namaMurid.toLowerCase(),
                    subjekDiambil: [],
                    tarikhDaftar: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                successCount++;
            }
            
            // Commit batch
            await batch.commit();
            console.log('✅ Batch ' + (batchNum + 1) + ' committed');
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
