// ============================================================================
// ANALISA PENCAPAIAN PBD - PROFESSIONAL ANALYTICS
// Sistem Rekod PBD - SK Sultan Ismail
// ============================================================================

let chartIndividu = null;
let chartKelas = null;
let chartPerbandingan = null;
let currentAnalisaData = null;



// ============================================================================
// INITIALIZE
// ============================================================================

document.addEventListener('DOMContentLoaded', async function() {
    await indLoadSubjek();
    const s=document.getElementById('ind-subjek');
    if(s&&s.options.length>1){s.value=s.options[1].value;await indLoadTahun();const t=document.getElementById('ind-tahun');if(t&&t.options.length>1){t.value=t.options[1].value;await indLoadKelas();const k=document.getElementById('ind-kelas');if(k&&k.options.length>1){k.value=k.options[1].value;await indLoadMurid();}}}
    console.log('✅ Analisa module loaded - GROUP BY TOPIK');
});

// ============================================================================
// TAB SWITCHING
// ============================================================================

function switchAnalisaTab(tabName, btn) {
    document.querySelectorAll('.analisa-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.analisa-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('section-' + tabName).classList.add('active');
    btn.classList.add('active');

    if (tabName === 'individu') { indLoadSubjek().then(async()=>{const s=document.getElementById('ind-subjek');if(s&&s.options.length>1){s.value=s.options[1].value;await indLoadTahun();const t=document.getElementById('ind-tahun');if(t&&t.options.length>1){t.value=t.options[1].value;await indLoadKelas();const k=document.getElementById('ind-kelas');if(k&&k.options.length>1){k.value=k.options[1].value;await indLoadMurid();}}}}); }
    if (tabName === 'kelas') { klsLoadSubjek().then(async()=>{const s=document.getElementById('kls-subjek');if(s&&s.options.length>1){s.value=s.options[1].value;await klsLoadTahun();const t=document.getElementById('kls-tahun');if(t&&t.options.length>1){t.value=t.options[1].value;await klsLoadKelas();const k=document.getElementById('kls-kelas');if(k&&k.options.length>1){k.value=k.options[1].value;await klsLoadData();}}}}); }
    if (tabName === 'intervensi') { intLoadSubjek().then(async()=>{const s=document.getElementById('int-subjek');if(s&&s.options.length>1){s.value=s.options[1].value;await intLoadTahun();const t=document.getElementById('int-tahun');if(t&&t.options.length>1){t.value=t.options[1].value;await intLoadKelas();const k=document.getElementById('int-kelas');if(k&&k.options.length>1){k.value=k.options[1].value;await intLoadData();}}}}); }
    if (tabName === 'perbandingan') { prbLoadSubjek().then(async()=>{const s=document.getElementById('prb-subjek');if(s&&s.options.length>1){s.value=s.options[1].value;await prbLoadTahun();const t=document.getElementById('prb-tahun');if(t&&t.options.length>1){t.value=t.options[1].value;await prbLoadData();}}  }); }
    if (tabName === 'trend') trnLoadTahunRekod();
    if (tabName === 'keputusan') kptLoadSubjek();
}

// ============================================================================
// SHARED HELPERS
// ============================================================================

async function loadSubjekInto(selectId) {
    try {
        const snap = await firestoreRetry(() => db.collection('subjek').where('aktif','==',true).get());
        const sel = document.getElementById(selectId);
        sel.innerHTML = '<option value="">Pilih Subjek</option>';
        const list = [];
        snap.forEach(doc => list.push({...doc.data()}));
        list.sort((a,b) => (a.urutan||0) - (b.urutan||0));
        list.forEach(s => sel.add(new Option(s.subjek, s.subjek)));
    } catch(e) { console.error(e); }
}

function getTPColorClass(avg) {
    if (avg >= 5) return 'tp-green';
    if (avg >= 4) return 'tp-lightgreen';
    if (avg >= 3.5) return 'tp-yellow';
    if (avg >= 3) return 'tp-orange';
    return 'tp-red';
}

function getTPLabel(avg) {
    if (avg >= 5) return '🟢 Cemerlang';
    if (avg >= 4) return '🟡 Baik';
    if (avg >= 3) return '🟠 Perlu Perhatian';
    return '🔴 Kritikal';
}

// Returns array of doc.data() objects, filtered by penilaian (P1/P2/empty=all)
function filterSnapByPenilaian(snap, penilaian) {
    const docs = [];
    snap.forEach(doc => docs.push(doc.data()));
    if (!penilaian) return docs;
    return docs.filter(data => {
        const month = parseInt((data.tarikh_string || '').substring(5, 7));
        if (penilaian === 'P1') return month >= 1 && month <= 5;
        if (penilaian === 'P2') return month >= 6 && month <= 10;
        return true;
    });
}

function getPenilaianLabel(penilaian) {
    if (penilaian === 'P1') return ' | Penilaian 1 (Jan–Mei)';
    if (penilaian === 'P2') return ' | Penilaian 2 (Jun–Okt)';
    return '';
}

function calcMedian(arr) {
    const sorted = [...arr].sort((a,b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2;
}

function calcStdDev(arr) {
    const avg = arr.reduce((a,b) => a+b, 0) / arr.length;
    const sq = arr.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(sq.reduce((a,b) => a+b, 0) / arr.length);
}

// ============================================================================
// PDF HEADER HELPER
// ============================================================================

function pdfHeader(pdf, title, subtitle) {
    pdf.setFillColor(102, 126, 234);
    pdf.roundedRect(10, 8, 190, 28, 3, 3, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(15);
    pdf.setFont(undefined, 'bold');
    pdf.text('SK SULTAN ISMAIL', 105, 20, {align:'center'});
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'normal');
    pdf.text(title, 105, 28, {align:'center'});
    pdf.setFontSize(9);
    pdf.text(subtitle, 105, 34, {align:'center'});
    pdf.setTextColor(0, 0, 0);
    return 42;
}

function pdfFooter(pdf) {
    const pageCount = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text('SK Sultan Ismail - Sistem Rekod PBD © 2026', 105, 290, {align:'center'});
        pdf.text('Halaman ' + i + ' dari ' + pageCount, 105, 295, {align:'center'});
    }
}

// ============================================================================
// TAB 1: INDIVIDU — GROUP BY TOPIK
// ============================================================================

async function indLoadSubjek() { await loadSubjekInto('ind-subjek'); }

async function indLoadTahun() {
    const subjek = document.getElementById('ind-subjek').value;
    const sel = document.getElementById('ind-tahun');
    sel.innerHTML = '<option value="">Pilih Tahun</option>';
    document.getElementById('ind-kelas').innerHTML = '<option value="">Pilih Kelas</option>';
    document.getElementById('ind-murid').innerHTML = '<option value="">Pilih Murid</option>';
    document.getElementById('ind-content').innerHTML = '<div style="text-align:center;padding:60px;color:#999;"><div style="font-size:60px;">👤</div><p>Pilih murid untuk melihat analisis pencapaian</p></div>';
    if (!subjek) return;
    try {
        const snap = await firestoreRetry(() => db.collection('rekod_pbd').where('subjek','==',subjek).get());
        const set = new Set();
        snap.forEach(doc => set.add(doc.data().tahun));
        Array.from(set).sort().forEach(t => sel.add(new Option(t, t)));
    } catch(e) { console.error(e); }
}

async function indLoadKelas() {
    const subjek = document.getElementById('ind-subjek').value;
    const tahun = document.getElementById('ind-tahun').value;
    const sel = document.getElementById('ind-kelas');
    sel.innerHTML = '<option value="">Pilih Kelas</option>';
    document.getElementById('ind-murid').innerHTML = '<option value="">Pilih Murid</option>';
    document.getElementById('ind-content').innerHTML = '<div style="text-align:center;padding:60px;color:#999;"><div style="font-size:60px;">👤</div><p>Pilih murid untuk melihat analisis pencapaian</p></div>';
    if (!subjek || !tahun) return;
    try {
        const snap = await firestoreRetry(() => db.collection('rekod_pbd').where('subjek','==',subjek).where('tahun','==',tahun).get());
        const set = new Set();
        snap.forEach(doc => { const k = doc.data().kelas; if(k) set.add(k.replace(tahun+' ','')); });
        Array.from(set).sort().forEach(k => sel.add(new Option(k, k)));
    } catch(e) { console.error(e); }
}

async function indLoadMurid() {
    const subjek = document.getElementById('ind-subjek').value;
    const tahun = document.getElementById('ind-tahun').value;
    const kelas = document.getElementById('ind-kelas').value;
    const sel = document.getElementById('ind-murid');
    sel.innerHTML = '<option value="">Pilih Murid</option>';
    document.getElementById('ind-content').innerHTML = '<div style="text-align:center;padding:60px;color:#999;"><div style="font-size:60px;">👤</div><p>Pilih murid untuk melihat analisis pencapaian</p></div>';
    if (!subjek || !tahun || !kelas) return;
    try {
        const fullKelas = tahun + ' ' + kelas;
        const snap = await firestoreRetry(() => db.collection('rekod_pbd').where('subjek','==',subjek).where('kelas','==',fullKelas).get());
        const map = {};
        snap.forEach(doc => { (doc.data().murid||[]).forEach(m => { if(!map[m.noKp]) map[m.noKp] = m.namaMurid; }); });
        Object.keys(map).sort((a,b) => map[a].localeCompare(map[b])).forEach(noKp => sel.add(new Option(map[noKp], noKp)));
    } catch(e) { console.error(e); }
}

async function indLoadData() {
    const subjek = document.getElementById('ind-subjek').value;
    const tahun = document.getElementById('ind-tahun').value;
    const kelas = document.getElementById('ind-kelas').value;
    const noKpSelected = document.getElementById('ind-murid').value;
    const container = document.getElementById('ind-content');
    if (!subjek || !tahun || !kelas || !noKpSelected) return;

    showLoading('Analysing...');
    try {
        const fullKelas = tahun + ' ' + kelas;
        const penilaian = document.getElementById('ind-penilaian').value;
        const snap = await firestoreRetry(() => db.collection('rekod_pbd').where('subjek','==',subjek).where('kelas','==',fullKelas).orderBy('tarikh_string','asc').get());
        const namaSelected = document.getElementById('ind-murid').options[document.getElementById('ind-murid').selectedIndex].text;

        // *** GROUP BY TOPIK ***
        const topikMap = {};
        const filteredDocs = filterSnapByPenilaian(snap, penilaian);
        filteredDocs.forEach(data => {
            const found = (data.murid||[]).find(m => m.noKp === noKpSelected);
            if (found) {
                const topik = data.topik;
                if (!topikMap[topik]) {
                    topikMap[topik] = { 
                        topik, 
                        topik_pembelajaran: data.topik_pembelajaran_main||'', 
                        tps: [], 
                        penguasaans: [], 
                        tarikh: data.tarikh_string 
                    };
                }
                topikMap[topik].tps.push(found.tp);
                topikMap[topik].penguasaans.push(found.penguasaan || 'Menguasai');
            }
        });

        const topikKeys = Object.keys(topikMap);
        if (topikKeys.length === 0) { 
            container.innerHTML = '<div style="text-align:center;padding:60px;color:#999;"><div style="font-size:60px;">📭</div><p>Tiada rekod dijumpai</p></div>'; 
            hideLoading(); 
            return; 
        }

        // *** AGGREGATE RECORDS ***
        const records = topikKeys.map(key => {
            const t = topikMap[key];
            const avgTP = (t.tps.reduce((a,b)=>a+b,0) / t.tps.length).toFixed(2);
            const countMenguasai = t.penguasaans.filter(p => p === 'Menguasai').length;
            const countBelum = t.penguasaans.filter(p => p === 'Belum Menguasai').length;
            const penguasaan = countMenguasai >= countBelum ? 'Menguasai' : 'Belum Menguasai';
            return { 
                topik: t.topik, 
                topik_pembelajaran: t.topik_pembelajaran, 
                tp: parseFloat(avgTP), 
                penguasaan, 
                tarikh: t.tarikh 
            };
        });

        currentAnalisaData = { type:'individu', nama: namaSelected, subjek, fullKelas, records };

        const tpValues = records.map(r => r.tp);
        const purata = (tpValues.reduce((a,b)=>a+b,0) / tpValues.length).toFixed(2);
        const tpMax = Math.max(...tpValues);
        const tpMin = Math.min(...tpValues);
        const tpMaxTopik = records.find(r => r.tp === tpMax);
        const tpMinTopik = records.find(r => r.tp === tpMin);

        let html = '';
        html += '<div style="background:linear-gradient(135deg,#667eea,#764ba2);border-radius:16px;padding:25px;color:white;margin-bottom:25px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:15px;">';
        html += '<div><h2 style="margin:0;">👤 ' + namaSelected + '</h2><p style="margin:5px 0 0;opacity:0.85;">📚 ' + subjek + ' - ' + fullKelas + getPenilaianLabel(penilaian) + '</p></div>';
        html += '<button class="export-btn" style="background:white;color:#667eea;" onclick="indExportPDF()">📄 Export PDF</button></div>';

        html += '<div class="summary-grid">';
        html += '<div class="summary-card blue"><div class="label">Topik Dinilai</div><div class="value">'+records.length+'</div><div class="sub">Jumlah topik</div></div>';
        html += '<div class="summary-card '+(purata>=4?'green':purata>=3?'orange':'red')+'"><div class="label">Purata TP</div><div class="value">'+purata+'</div><div class="sub">'+getTPLabel(purata)+'</div></div>';
        html += '<div class="summary-card green"><div class="label">TP Tertinggi</div><div class="value">'+tpMax.toFixed(2)+'</div><div class="sub">'+(tpMaxTopik?tpMaxTopik.topik:'')+'</div></div>';
        html += '<div class="summary-card red"><div class="label">TP Terendah</div><div class="value">'+tpMin.toFixed(2)+'</div><div class="sub">'+(tpMinTopik?tpMinTopik.topik:'')+'</div></div>';
        html += '</div>';

        html += '<div class="chart-container"><h4>📈 GRAF PERKEMBANGAN</h4><canvas id="chartIndividu" height="100"></canvas></div>';

        html += '<div class="chart-container"><h4>📋 SENARAI REKOD TOPIK</h4><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">';
        html += '<thead><tr style="background:var(--primary);color:white;">';
        html += '<th style="padding:10px;">BIL</th>';
        html += '<th style="padding:10px;text-align:left;">TOPIK</th>';
        html += '<th style="padding:10px;text-align:center;">PURATA TP</th>';
        html += '<th style="padding:10px;">TARIKH</th>';
        html += '<th style="padding:10px;text-align:left;">PENGUASAAN</th>';
        html += '<th style="padding:10px;text-align:center;">STATUS</th>';
        html += '</tr></thead><tbody>';

        records.forEach((rec, i) => {
            const sc = rec.tp>=5?'tp-green':rec.tp>=4?'tp-lightgreen':rec.tp>=3?'tp-yellow':rec.tp>=2?'tp-orange':'tp-red';
            const sl = rec.tp>=5?'🟢':rec.tp>=4?'🟡':rec.tp>=3?'🟠':'🔴';
            html += '<tr style="border-bottom:1px solid #eee;">';
            html += '<td style="padding:10px;text-align:center;">'+(i+1)+'</td>';
            html += '<td style="padding:10px;"><strong>'+rec.topik+'</strong><br><small style="color:#888;">'+rec.topik_pembelajaran+'</small></td>';
            html += '<td style="padding:10px;text-align:center;"><span class="'+sc+'" style="display:inline-block;padding:3px 12px;border-radius:15px;font-weight:700;">'+rec.tp.toFixed(2)+'</span></td>';
            html += '<td style="padding:10px;">'+rec.tarikh+'</td>';
            html += '<td style="padding:10px;"><span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;background:'+(rec.penguasaan==='Menguasai'?'#d1fae5':'#fee2e2')+';color:'+(rec.penguasaan==='Menguasai'?'#065f46':'#991b1b')+';border:1px solid rgba(0,0,0,0.08);">'+rec.penguasaan+'</span></td>';
            html += '<td style="padding:10px;text-align:center;">'+sl+'</td>';
            html += '</tr>';
        });
        html += '</tbody></table></div></div>';

        const weak = records.filter(r=>r.tp<=3);
        const strong = records.filter(r=>r.tp>=5);
        html += '<div class="insight-box"><h4>💡 CADANGAN GURU</h4>';
        if(weak.length>0) html += '<p>• ⚠️ Fokus pada topik: <strong>'+weak.map(t=>t.topik).join(', ')+'</strong></p>';
        if(strong.length>0) html += '<p>• ✅ Pertahankan prestasi: <strong>'+strong.map(t=>t.topik).join(', ')+'</strong></p>';
        html += '</div>';

        container.innerHTML = html;

        if(chartIndividu) chartIndividu.destroy();
        chartIndividu = new Chart(document.getElementById('chartIndividu').getContext('2d'), {
            type:'line',
            data:{
                labels: records.map(r => r.topik),
                datasets:[{ label:'Purata TP', data: records.map(r=>r.tp), borderColor:'#667eea', backgroundColor:'rgba(102,126,234,0.1)', borderWidth:3, pointBackgroundColor: records.map(r=>r.tp>=5?'#10b981':r.tp>=4?'#f59e0b':r.tp>=3?'#f97316':'#ef4444'), pointRadius:6, fill:true, tension:0.3 }]
            },
            options:{ responsive:true, scales:{ y:{min:0,max:6,ticks:{stepSize:1},title:{display:true,text:'Purata TP'}}, x:{title:{display:true,text:'Topik'}} }, plugins:{legend:{position:'top'}} }
        });

        hideLoading();
    } catch(e) { console.error(e); showToast('Error: '+e.message,'error'); hideLoading(); }
}

// ============================================================================
// TAB 2: PRESTASI KELAS — GROUP BY TOPIK
// ============================================================================

async function klsLoadSubjek() { await loadSubjekInto('kls-subjek'); }

async function klsLoadTahun() {
    const subjek = document.getElementById('kls-subjek').value;
    const sel = document.getElementById('kls-tahun');
    sel.innerHTML = '<option value="">Pilih Tahun</option>';
    document.getElementById('kls-kelas').innerHTML = '<option value="">Pilih Kelas</option>';
    document.getElementById('kls-content').innerHTML = '<div style="text-align:center;padding:60px;color:#999;"><div style="font-size:60px;">🏫</div><p>Pilih subjek, tahun dan kelas</p></div>';
    if (!subjek) return;
    try {
        const snap = await firestoreRetry(() => db.collection('rekod_pbd').where('subjek','==',subjek).get());
        const set = new Set();
        snap.forEach(doc => set.add(doc.data().tahun));
        Array.from(set).sort().forEach(t => sel.add(new Option(t, t)));
    } catch(e) { console.error(e); }
}

async function klsLoadKelas() {
    const subjek = document.getElementById('kls-subjek').value;
    const tahun = document.getElementById('kls-tahun').value;
    const sel = document.getElementById('kls-kelas');
    sel.innerHTML = '<option value="">Pilih Kelas</option>';
    document.getElementById('kls-content').innerHTML = '<div style="text-align:center;padding:60px;color:#999;"><div style="font-size:60px;">🏫</div><p>Pilih subjek, tahun dan kelas</p></div>';
    if (!subjek || !tahun) return;
    try {
        const snap = await firestoreRetry(() => db.collection('rekod_pbd').where('subjek','==',subjek).where('tahun','==',tahun).get());
        const set = new Set();
        snap.forEach(doc => { const k=doc.data().kelas; if(k) set.add(k.replace(tahun+' ','')); });
        Array.from(set).sort().forEach(k => sel.add(new Option(k, k)));
    } catch(e) { console.error(e); }
}

async function klsLoadData() {
    const subjek = document.getElementById('kls-subjek').value;
    const tahun = document.getElementById('kls-tahun').value;
    const kelas = document.getElementById('kls-kelas').value;
    const container = document.getElementById('kls-content');
    if (!subjek || !tahun || !kelas) return;
    showLoading('Analysing...');
    try {
        const fullKelas = tahun+' '+kelas;
        const penilaian = document.getElementById('kls-penilaian').value;
        const snap = await firestoreRetry(() => db.collection('rekod_pbd').where('subjek','==',subjek).where('kelas','==',fullKelas).orderBy('tarikh_string','asc').get());

        // *** GROUP BY TOPIK ***
        const topikMap = {};
        const muridSet = new Set();
        const totalTP = {1:0,2:0,3:0,4:0,5:0,6:0};

        const filteredDocs = filterSnapByPenilaian(snap, penilaian);
        filteredDocs.forEach(data => {
            const topik = data.topik;
            if(!topikMap[topik]) topikMap[topik] = { topik, tps:[], tpCount:{1:0,2:0,3:0,4:0,5:0,6:0}, penguasaans:[] };
            (data.murid||[]).forEach(m => { 
                topikMap[topik].tps.push(m.tp); 
                topikMap[topik].tpCount[m.tp]++; 
                topikMap[topik].penguasaans.push(m.penguasaan || 'Menguasai');
                totalTP[m.tp]++; 
                muridSet.add(m.noKp); 
            });
        });
        
        const topikKeys = Object.keys(topikMap);
        if(topikKeys.length===0) { container.innerHTML='<div style="text-align:center;padding:60px;color:#999;"><div style="font-size:60px;">📭</div><p>Tiada rekod dijumpai</p></div>'; hideLoading(); return; }
        
        currentAnalisaData = { type:'kelas', subjek, fullKelas, topikMap, totalTP, muridCount: muridSet.size };
        topikKeys.sort((a,b) => { const avgA = topikMap[a].tps.reduce((s,v)=>s+v,0)/topikMap[a].tps.length; const avgB = topikMap[b].tps.reduce((s,v)=>s+v,0)/topikMap[b].tps.length; return avgB - avgA; });
        
        let html = '';
        html += '<div style="background:linear-gradient(135deg,#f093fb,#f5576c);border-radius:16px;padding:25px;color:white;margin-bottom:25px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:15px;">';
        html += '<div><h2 style="margin:0;">🏫 '+subjek+' - '+fullKelas+'</h2><p style="margin:5px 0 0;opacity:0.85;">👥 '+muridSet.size+' Murid • 📊 '+topikKeys.length+' Topik'+getPenilaianLabel(penilaian)+'</p></div>';
        html += '<button class="export-btn" style="background:white;color:#f5576c;" onclick="klsExportPDF()">📄 Export PDF</button></div>';
        html += '<div class="chart-container"><h4>📊 TABURAN TP KELAS</h4><canvas id="chartKelas" height="100"></canvas></div>';
        html += '<div class="chart-container"><h4>📋 PRESTASI MENGIKUT TOPIK</h4><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">';
        html += '<thead><tr style="background:var(--primary);color:white;"><th style="padding:10px;text-align:left;">TOPIK</th><th style="padding:10px;text-align:center;">PURATA</th><th style="padding:10px;text-align:center;">TP1</th><th style="padding:10px;text-align:center;">TP2</th><th style="padding:10px;text-align:center;">TP3</th><th style="padding:10px;text-align:center;">TP4</th><th style="padding:10px;text-align:center;">TP5</th><th style="padding:10px;text-align:center;">TP6</th><th style="padding:10px;text-align:center;">PENGUASAAN</th><th style="padding:10px;text-align:center;">STATUS</th></tr></thead><tbody>';
        
        topikKeys.forEach(topik => {
            const t = topikMap[topik];
            const avg = (t.tps.reduce((a,b)=>a+b,0)/t.tps.length).toFixed(2);
            const countMenguasai = t.penguasaans.filter(p => p === 'Menguasai').length;
            const countBelum = t.penguasaans.filter(p => p === 'Belum Menguasai').length;
            const penguasaan = countMenguasai >= countBelum ? 'Menguasai' : 'Belum Menguasai';
            
            html += '<tr style="border-bottom:1px solid #eee;"><td style="padding:10px;"><strong>'+t.topik+'</strong></td>';
            html += '<td style="padding:10px;text-align:center;"><span class="'+getTPColorClass(avg)+'" style="display:inline-block;padding:3px 12px;border-radius:15px;font-weight:700;">'+avg+'</span></td>';
            for(let i=1;i<=6;i++) html += '<td style="padding:10px;text-align:center;">'+t.tpCount[i]+'</td>';
            html += '<td style="padding:10px;text-align:center;"><span style="padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;background:'+(penguasaan==='Menguasai'?'#d1fae5':'#fee2e2')+';color:'+(penguasaan==='Menguasai'?'#065f46':'#991b1b')+';">'+penguasaan+'</span></td>';
            html += '<td style="padding:10px;text-align:center;">'+getTPLabel(avg)+'</td></tr>';
        });
        html += '</tbody></table></div></div>';
        
        const hardest = topikKeys[topikKeys.length-1];
        const easiest = topikKeys[0];
        html += '<div class="insight-box"><h4>🎯 ANALISIS</h4>';
        html += '<p>• 📌 Topik PALING SUKAR: <strong>'+topikMap[hardest].topik+'</strong> (purata '+(topikMap[hardest].tps.reduce((a,b)=>a+b,0)/topikMap[hardest].tps.length).toFixed(2)+')</p>';
        html += '<p>• 🌟 Topik PALING MUDAH: <strong>'+topikMap[easiest].topik+'</strong> (purata '+(topikMap[easiest].tps.reduce((a,b)=>a+b,0)/topikMap[easiest].tps.length).toFixed(2)+')</p>';
        html += '</div>';
        container.innerHTML = html;
        
        if(chartKelas) chartKelas.destroy();
        chartKelas = new Chart(document.getElementById('chartKelas').getContext('2d'), {
            type:'bar',
            data:{ labels:['TP 1','TP 2','TP 3','TP 4','TP 5','TP 6'], datasets:[{ label:'Bilangan', data:[totalTP[1],totalTP[2],totalTP[3],totalTP[4],totalTP[5],totalTP[6]], backgroundColor:['#ef4444','#f97316','#f59e0b','#eab308','#22c55e','#10b981'], borderRadius:6 }] },
            options:{ responsive:true, scales:{ y:{beginAtZero:true,title:{display:true,text:'Bilangan'},ticks:{precision:0}}, x:{title:{display:true,text:'Tahap Penguasaan'}} }, plugins:{legend:{position:'top'}} }
        });
        hideLoading();
    } catch(e) { console.error(e); showToast('Error: '+e.message,'error'); hideLoading(); }
}

// REST OF CODE CONTINUES...

// ============================================================================
// TAB 3: INTERVENSI (unchanged - already using sub_topik correctly)
// ============================================================================

async function intLoadSubjek() { await loadSubjekInto('int-subjek'); }

async function intLoadTahun() {
    const subjek = document.getElementById('int-subjek').value;
    const sel = document.getElementById('int-tahun');
    sel.innerHTML = '<option value="">Pilih Tahun</option>';
    document.getElementById('int-kelas').innerHTML = '<option value="">Pilih Kelas</option>';
    document.getElementById('int-content').innerHTML = '<div style="text-align:center;padding:60px;color:#999;"><div style="font-size:60px;">⚠️</div><p>Pilih subjek, tahun dan kelas</p></div>';
    if (!subjek) return;
    try {
        const snap = await firestoreRetry(() => db.collection('rekod_pbd').where('subjek','==',subjek).get());
        const set = new Set();
        snap.forEach(doc => set.add(doc.data().tahun));
        Array.from(set).sort().forEach(t => sel.add(new Option(t, t)));
    } catch(e) { console.error(e); }
}

async function intLoadKelas() {
    const subjek = document.getElementById('int-subjek').value;
    const tahun = document.getElementById('int-tahun').value;
    const sel = document.getElementById('int-kelas');
    sel.innerHTML = '<option value="">Pilih Kelas</option>';
    document.getElementById('int-content').innerHTML = '<div style="text-align:center;padding:60px;color:#999;"><div style="font-size:60px;">⚠️</div><p>Pilih subjek, tahun dan kelas</p></div>';
    if (!subjek || !tahun) return;
    try {
        const snap = await firestoreRetry(() => db.collection('rekod_pbd').where('subjek','==',subjek).where('tahun','==',tahun).get());
        const set = new Set();
        snap.forEach(doc => { const k=doc.data().kelas; if(k) set.add(k.replace(tahun+' ','')); });
        Array.from(set).sort().forEach(k => sel.add(new Option(k, k)));
    } catch(e) { console.error(e); }
}

async function intLoadData() {
    const subjek = document.getElementById('int-subjek').value;
    const tahun = document.getElementById('int-tahun').value;
    const kelas = document.getElementById('int-kelas').value;
    const kriteria = parseInt(document.getElementById('int-kriteria').value);
    const container = document.getElementById('int-content');
    if (!subjek || !tahun || !kelas) return;
    showLoading('Analysing...');
    try {
        const fullKelas = tahun+' '+kelas;
        const penilaian = document.getElementById('int-penilaian').value;
        const snap = await firestoreRetry(() => db.collection('rekod_pbd').where('subjek','==',subjek).where('kelas','==',fullKelas).get());
        const muridMap = {};
        const filteredDocs = filterSnapByPenilaian(snap, penilaian);
        filteredDocs.forEach(data => {
            (data.murid||[]).forEach(m => {
                if(m.tp <= kriteria) {
                    if(!muridMap[m.noKp]) muridMap[m.noKp] = { nama: m.namaMurid, records:[] };
                    muridMap[m.noKp].records.push({ topik:data.topik, sub_topik:data.sub_topik, tp:m.tp, tarikh:data.tarikh_string });
                }
            });
        });
        const muridKeys = Object.keys(muridMap);
        if(muridKeys.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:60px;"><div style="font-size:60px;">🎉</div><p style="font-size:20px;color:#10b981;font-weight:700;">Tiada murid yang perlu intervensi!</p><p style="color:#888;">Semua murid mencapai TP > '+kriteria+'</p></div>';
            hideLoading(); return;
        }
        currentAnalisaData = { type:'intervensi', subjek, fullKelas, kriteria, muridMap };
        const highPriority = muridKeys.filter(k => muridMap[k].records.some(r=>r.tp<=2));
        const medPriority = muridKeys.filter(k => !muridMap[k].records.some(r=>r.tp<=2));
        let totalWeak = 0;
        muridKeys.forEach(k => totalWeak += muridMap[k].records.length);
        const topikCount = {};
        muridKeys.forEach(k => { muridMap[k].records.forEach(r => { const key=r.topik+' - '+r.sub_topik; topikCount[key]=(topikCount[key]||0)+1; }); });
        const hardestTopik = Object.keys(topikCount).sort((a,b)=>topikCount[b]-topikCount[a])[0] || '-';
        let html = '';
        html += '<div style="background:linear-gradient(135deg,#f59e0b,#ef4444);border-radius:16px;padding:25px;color:white;margin-bottom:25px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:15px;">';
        html += '<div><h2 style="margin:0;">⚠️ MURID PERLU INTERVENSI</h2><p style="margin:5px 0 0;opacity:0.85;">'+subjek+' - '+fullKelas+' • Kriteria: TP ≤ '+kriteria+getPenilaianLabel(penilaian)+'</p></div>';
        html += '<button class="export-btn" style="background:white;color:#ef4444;" onclick="intExportPDF()">📄 Export PDF</button></div>';
        html += '<div class="summary-grid">';
        html += '<div class="summary-card red"><div class="label">Murid Berisiko</div><div class="value">'+muridKeys.length+'</div><div class="sub">orang</div></div>';
        html += '<div class="summary-card orange"><div class="label">Rekod Lemah</div><div class="value">'+totalWeak+'</div><div class="sub">rekod</div></div>';
        html += '<div class="summary-card purple"><div class="label">Keutamaan Tinggi</div><div class="value">'+highPriority.length+'</div><div class="sub">murid (TP ≤ 2)</div></div>';
        html += '</div>';
        if(highPriority.length > 0) {
            html += '<div class="chart-container"><h4 style="color:#ef4444;">🔴 KEUTAMAAN TINGGI (TP ≤ 2)</h4>';
            highPriority.forEach((noKp,i) => {
                const m = muridMap[noKp];
                html += '<div class="priority-high"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><strong style="font-size:15px;">'+(i+1)+'. '+m.nama+'</strong><span style="background:#ef4444;color:white;padding:3px 10px;border-radius:12px;font-size:12px;">'+m.records.length+'x lemah</span></div>';
                m.records.forEach(r => { html += '<div style="display:flex;gap:10px;padding:5px 0;border-bottom:1px solid #fecaca;align-items:center;"><span style="flex:1;">📌 '+r.topik+' - '+r.sub_topik+'</span><span style="background:#fee2e2;padding:2px 8px;border-radius:10px;font-weight:700;color:#ef4444;">TP '+r.tp+'</span><span style="color:#888;font-size:12px;">'+r.tarikh+'</span></div>'; });
                html += '</div>';
            });
            html += '</div>';
        }
        if(medPriority.length > 0) {
            html += '<div class="chart-container"><h4 style="color:#f59e0b;">🟡 KEUTAMAAN SEDERHANA (TP = 3)</h4>';
            medPriority.forEach((noKp,i) => {
                const m = muridMap[noKp];
                html += '<div class="priority-med"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><strong style="font-size:15px;">'+(highPriority.length+i+1)+'. '+m.nama+'</strong><span style="background:#f59e0b;color:white;padding:3px 10px;border-radius:12px;font-size:12px;">'+m.records.length+'x lemah</span></div>';
                m.records.forEach(r => { html += '<div style="display:flex;gap:10px;padding:5px 0;border-bottom:1px solid #fde68a;align-items:center;"><span style="flex:1;">📌 '+r.topik+' - '+r.sub_topik+'</span><span style="background:#fef3c7;padding:2px 8px;border-radius:10px;font-weight:700;color:#b45309;">TP '+r.tp+'</span><span style="color:#888;font-size:12px;">'+r.tarikh+'</span></div>'; });
                html += '</div>';
            });
            html += '</div>';
        }
        html += '<div class="insight-box"><h4>💡 TINDAKAN CADANGAN</h4>';
        html += '<p>• 📌 Topik paling sukar: <strong>'+hardestTopik+'</strong> ('+topikCount[hardestTopik]+' murid lemah)</p>';
        if(highPriority.length>0) html += '<p>• 🔴 Kelas pemulihan: <strong>'+highPriority.map(k=>muridMap[k].nama).join(', ')+'</strong></p>';
        html += '<p>• 📖 Strategi: Aktiviti hands-on dan pembelajaran berkumpul</p>';
        html += '<p>• 📅 Penilaian formatif mingguan disarankan</p>';
        html += '</div>';
        container.innerHTML = html;
        hideLoading();
    } catch(e) { console.error(e); showToast('Error: '+e.message,'error'); hideLoading(); }
}

// ============================================================================
// TAB 4: PERBANDINGAN KELAS — GROUP BY TOPIK
// ============================================================================

async function prbLoadSubjek() { await loadSubjekInto('prb-subjek'); }

async function prbLoadTahun() {
    const subjek = document.getElementById('prb-subjek').value;
    const sel = document.getElementById('prb-tahun');
    sel.innerHTML = '<option value="">Pilih Tahun</option>';
    document.getElementById('prb-content').innerHTML = '<div style="text-align:center;padding:60px;color:#999;"><div style="font-size:60px;">📊</div><p>Pilih subjek dan tahun</p></div>';
    if (!subjek) return;
    try {
        const snap = await firestoreRetry(() => db.collection('rekod_pbd').where('subjek','==',subjek).get());
        const set = new Set();
        snap.forEach(doc => set.add(doc.data().tahun));
        Array.from(set).sort().forEach(t => sel.add(new Option(t, t)));
    } catch(e) { console.error(e); }
}

async function prbLoadData() {
    const subjek = document.getElementById('prb-subjek').value;
    const tahun = document.getElementById('prb-tahun').value;
    const container = document.getElementById('prb-content');
    if (!subjek || !tahun) return;
    showLoading('Analysing...');
    try {
        const penilaian = document.getElementById('prb-penilaian').value;
        const snap = await firestoreRetry(() => db.collection('rekod_pbd').where('subjek','==',subjek).where('tahun','==',tahun).get());
        const kelasMap = {};
        const filteredDocs = filterSnapByPenilaian(snap, penilaian);
        filteredDocs.forEach(data => {
            const kelas = data.kelas;
            if(!kelasMap[kelas]) kelasMap[kelas] = { murid:new Set(), tpAll:[], tpCount:{1:0,2:0,3:0,4:0,5:0,6:0}, topikMap:{} };
            (data.murid||[]).forEach(m => {
                kelasMap[kelas].murid.add(m.noKp);
                kelasMap[kelas].tpAll.push(m.tp);
                kelasMap[kelas].tpCount[m.tp]++;
                const tKey = data.topik;
                if(!kelasMap[kelas].topikMap[tKey]) kelasMap[kelas].topikMap[tKey] = [];
                kelasMap[kelas].topikMap[tKey].push(m.tp);
            });
        });
        const kelasKeys = Object.keys(kelasMap);
        if(kelasKeys.length===0) { container.innerHTML='<div style="text-align:center;padding:60px;color:#999;"><div style="font-size:60px;">📭</div><p>Tiada rekod dijumpai</p></div>'; hideLoading(); return; }
        const kelasStats = kelasKeys.map(k => {
            const avg = kelasMap[k].tpAll.reduce((a,b)=>a+b,0)/kelasMap[k].tpAll.length;
            return { kelas:k, avg, median:calcMedian(kelasMap[k].tpAll), muridCount:kelasMap[k].murid.size, tpCount:kelasMap[k].tpCount };
        }).sort((a,b)=>b.avg-a.avg);
        currentAnalisaData = { type:'perbandingan', subjek, tahun, kelasStats, kelasMap };
        const allTopik = new Set();
        kelasKeys.forEach(k => Object.keys(kelasMap[k].topikMap).forEach(t=>allTopik.add(t)));
        const topikList = Array.from(allTopik).sort();
        let html = '';
        html += '<div style="background:linear-gradient(135deg,#4facfe,#00f2fe);border-radius:16px;padding:25px;color:white;margin-bottom:25px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:15px;">';
        html += '<div><h2 style="margin:0;">📊 PERBANDINGAN KELAS</h2><p style="margin:5px 0 0;opacity:0.85;">'+subjek+' - TAHUN '+tahun+' • '+kelasKeys.length+' Kelas'+getPenilaianLabel(penilaian)+'</p></div>';
        html += '<button class="export-btn" style="background:white;color:#0ea5e9;" onclick="prbExportPDF()">📄 Export PDF</button></div>';
        html += '<div class="chart-container"><h4>🏆 RANKING KELAS</h4><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">';
        html += '<thead><tr style="background:var(--primary);color:white;"><th style="padding:10px;">RANK</th><th style="padding:10px;text-align:left;">KELAS</th><th style="padding:10px;text-align:center;">MURID</th><th style="padding:10px;text-align:center;">PURATA</th><th style="padding:10px;text-align:center;">MEDIAN</th><th style="padding:10px;text-align:center;">STATUS</th></tr></thead><tbody>';
        kelasStats.forEach((s,i) => {
            const rankSymbol = i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1);
            html += '<tr style="border-bottom:1px solid #eee;"><td style="padding:10px;text-align:center;font-size:20px;">'+rankSymbol+'</td>';
            html += '<td style="padding:10px;"><strong>'+s.kelas+'</strong></td>';
            html += '<td style="padding:10px;text-align:center;">'+s.muridCount+'</td>';
            html += '<td style="padding:10px;text-align:center;"><span class="'+getTPColorClass(s.avg)+'" style="display:inline-block;padding:3px 12px;border-radius:15px;font-weight:700;">'+s.avg.toFixed(2)+'</span></td>';
            html += '<td style="padding:10px;text-align:center;">'+s.median.toFixed(1)+'</td>';
            html += '<td style="padding:10px;text-align:center;">'+getTPLabel(s.avg)+'</td></tr>';
        });
        html += '</tbody></table></div></div>';
        html += '<div class="chart-container"><h4>📈 PERBANDINGAN PURATA KELAS</h4><canvas id="chartPerbandingan" height="100"></canvas></div>';
        html += '<div class="chart-container"><h4>🎯 HEAT MAP: TOPIK vs KELAS</h4><div style="overflow-x:auto;"><table class="heatmap-table"><thead><tr><th style="min-width:100px;text-align:left;">TOPIK</th>';
        kelasStats.forEach(s => html += '<th>'+s.kelas+'</th>');
        html += '</tr></thead><tbody>';
        topikList.forEach(topik => {
            html += '<tr><td style="text-align:left;font-size:13px;">'+topik+'</td>';
            kelasStats.forEach(s => {
                const arr = kelasMap[s.kelas].topikMap[topik];
                if(arr && arr.length>0) { const avg=(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1); html += '<td class="'+getTPColorClass(avg)+'">'+avg+'</td>'; }
                else html += '<td style="background:#f1f5f9;color:#aaa;">-</td>';
            });
            html += '</tr>';
        });
        html += '</tbody></table></div></div>';
        const gap = (kelasStats[0].avg - kelasStats[kelasStats.length-1].avg).toFixed(2);
        html += '<div class="insight-box"><h4>🎯 ANALISIS PERBANDINGAN</h4>';
        html += '<p>• 🌟 Kelas TERBAIK: <strong>'+kelasStats[0].kelas+'</strong> (purata '+kelasStats[0].avg.toFixed(2)+')</p>';
        html += '<p>• ⚠️ Kelas PERLU SOKONGAN: <strong>'+kelasStats[kelasStats.length-1].kelas+'</strong> (purata '+kelasStats[kelasStats.length-1].avg.toFixed(2)+')</p>';
        html += '<p>• 📊 GAP tertinggi: <strong>'+gap+'</strong> ('+kelasStats[0].kelas+' vs '+kelasStats[kelasStats.length-1].kelas+')</p>';
        html += '<p>• 💡 Cadangan: Program peer mentoring antara kelas</p>';
        html += '</div>';
        container.innerHTML = html;
        if(chartPerbandingan) chartPerbandingan.destroy();
        chartPerbandingan = new Chart(document.getElementById('chartPerbandingan').getContext('2d'), {
            type:'bar',
            data:{ labels:kelasStats.map(s=>s.kelas), datasets:[{ label:'Purata TP', data:kelasStats.map(s=>s.avg), backgroundColor:kelasStats.map(s=>s.avg>=5?'#10b981':s.avg>=4?'#22c55e':s.avg>=3?'#f59e0b':'#ef4444'), borderRadius:6 }] },
            options:{ responsive:true, scales:{ y:{min:0,max:6,title:{display:true,text:'Purata TP'}}, x:{title:{display:true,text:'Kelas'}} }, plugins:{legend:{position:'top'}} }
        });
        hideLoading();
    } catch(e) { console.error(e); showToast('Error: '+e.message,'error'); hideLoading(); }
}

// CONTINUE TO PART 3...

// ============================================================================
// TAB 5: TREND SUBJEK — GROUP BY TOPIK
// ============================================================================

async function trnLoadTahunRekod() {
    const sel = document.getElementById('trn-tahunrekod');
    try {
        const snap = await firestoreRetry(() => db.collection('rekod_pbd').get());
        const set = new Set();
        snap.forEach(doc => { const t=doc.data().tahun_rekod; if(t) set.add(t); });
        sel.innerHTML = '<option value="">Pilih Tahun</option>';
        Array.from(set).sort().reverse().forEach(t => sel.add(new Option(t, t)));
        const cy = new Date().getFullYear().toString();
        if(sel.querySelector('option[value="'+cy+'"]')) { sel.value = cy; }
        else if(sel.options.length > 1) { sel.value = sel.options[1].value; }
        if(sel.value) { await trnLoadSubjek(); const ss=document.getElementById('trn-subjek');if(ss&&ss.options.length>1){ss.value=ss.options[1].value;await trnLoadTahun();const ts=document.getElementById('trn-tahun');if(ts&&ts.options.length>1){ts.value=ts.options[1].value;await trnLoadData();}} }
    } catch(e) { console.error(e); }
}

async function trnLoadSubjek() {
    const tahunRekod = document.getElementById('trn-tahunrekod').value;
    const sel = document.getElementById('trn-subjek');
    sel.innerHTML = '<option value="">Pilih Subjek</option>';
    document.getElementById('trn-tahun').innerHTML = '<option value="">Pilih Tahun</option>';
    document.getElementById('trn-content').innerHTML = '<div style="text-align:center;padding:60px;color:#999;"><div style="font-size:60px;">📈</div><p>Pilih subjek dan tahun darjah</p></div>';
    if (!tahunRekod) return;
    try {
        const snap = await firestoreRetry(() => db.collection('rekod_pbd').where('tahun_rekod','==',tahunRekod).get());
        const set = new Set();
        snap.forEach(doc => set.add(doc.data().subjek));
        Array.from(set).sort().forEach(s => sel.add(new Option(s, s)));
    } catch(e) { console.error(e); }
}

async function trnLoadTahun() {
    const tahunRekod = document.getElementById('trn-tahunrekod').value;
    const subjek = document.getElementById('trn-subjek').value;
    const sel = document.getElementById('trn-tahun');
    sel.innerHTML = '<option value="">Pilih Tahun</option>';
    document.getElementById('trn-content').innerHTML = '<div style="text-align:center;padding:60px;color:#999;"><div style="font-size:60px;">📈</div><p>Pilih tahun darjah</p></div>';
    if (!tahunRekod || !subjek) return;
    try {
        const snap = await firestoreRetry(() => db.collection('rekod_pbd').where('tahun_rekod','==',tahunRekod).where('subjek','==',subjek).get());
        const set = new Set();
        snap.forEach(doc => set.add(doc.data().tahun));
        Array.from(set).sort().forEach(t => sel.add(new Option(t, t)));
    } catch(e) { console.error(e); }
}

async function trnLoadData() {
    const tahunRekod = document.getElementById('trn-tahunrekod').value;
    const subjek = document.getElementById('trn-subjek').value;
    const tahun = document.getElementById('trn-tahun').value;
    const container = document.getElementById('trn-content');
    if (!tahunRekod || !subjek || !tahun) return;
    showLoading('Analysing...');
    try {
        const penilaian = document.getElementById('trn-penilaian').value;
        const snap = await firestoreRetry(() => db.collection('rekod_pbd').where('tahun_rekod','==',tahunRekod).where('subjek','==',subjek).where('tahun','==',tahun).orderBy('tarikh_string','asc').get());

        const kelasSet = new Set(), topikSet = new Set(), kelasTopikMap = {}, topikOrder = {}, totalMurid = new Set();
        let allTP = [];

        const filteredDocs = filterSnapByPenilaian(snap, penilaian);
        filteredDocs.forEach(data => {
            const kelas = data.kelas;
            const topik = data.topik;
            kelasSet.add(kelas); topikSet.add(topik);
            if(!topikOrder[topik] || data.tarikh_string < topikOrder[topik]) topikOrder[topik] = data.tarikh_string;
            if(!kelasTopikMap[kelas]) kelasTopikMap[kelas] = {};
            if(!kelasTopikMap[kelas][topik]) kelasTopikMap[kelas][topik] = [];
            (data.murid||[]).forEach(m => { kelasTopikMap[kelas][topik].push(m.tp); totalMurid.add(m.noKp); allTP.push(m.tp); });
        });
        
        const kelasKeys = Array.from(kelasSet).sort();
        const topikKeys = Array.from(topikSet).sort((a,b)=>(topikOrder[a]||'').localeCompare(topikOrder[b]||''));
        if(kelasKeys.length===0) { container.innerHTML='<div style="text-align:center;padding:60px;color:#999;"><div style="font-size:60px;">📭</div><p>Tiada rekod dijumpai</p></div>'; hideLoading(); return; }
        
        currentAnalisaData = { type:'trend', tahunRekod, subjek, tahun, kelasKeys, topikKeys, kelasTopikMap, totalMurid:totalMurid.size, allTP };
        const overallAvg = (allTP.reduce((a,b)=>a+b,0)/allTP.length).toFixed(2);
        
        let html = '';
        html += '<div style="background:linear-gradient(135deg,#43e97b,#38f9d7);border-radius:16px;padding:25px;color:white;margin-bottom:25px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:15px;">';
        html += '<div><h2 style="margin:0;">📈 TREND PENCAPAIAN SUBJEK</h2><p style="margin:5px 0 0;opacity:0.85;">'+subjek+' - TAHUN '+tahun+' • Rekod '+tahunRekod+getPenilaianLabel(penilaian)+'</p></div>';
        html += '<button class="export-btn" style="background:white;color:#10b981;" onclick="trnExportPDF()">📄 Export PDF</button></div>';
        html += '<div class="summary-grid">';
        html += '<div class="summary-card blue"><div class="label">Jumlah Murid</div><div class="value">'+totalMurid.size+'</div><div class="sub">orang</div></div>';
        html += '<div class="summary-card purple"><div class="label">Jumlah Topik</div><div class="value">'+topikKeys.length+'</div><div class="sub">topik dinilai</div></div>';
        html += '<div class="summary-card '+(overallAvg>=4?'green':overallAvg>=3?'orange':'red')+'"><div class="label">Purata Keseluruhan</div><div class="value">'+overallAvg+'</div><div class="sub">'+getTPLabel(overallAvg)+'</div></div>';
        html += '<div class="summary-card green"><div class="label">Jumlah Kelas</div><div class="value">'+kelasKeys.length+'</div><div class="sub">kelas</div></div>';
        html += '</div>';
        html += '<div class="chart-container"><h4>🎯 HEAT MAP PRESTASI (TOPIK vs KELAS)</h4><div style="overflow-x:auto;"><table class="heatmap-table"><thead><tr><th style="min-width:100px;text-align:left;">TOPIK</th>';
        kelasKeys.forEach(k => html += '<th>'+k+'</th>');
        html += '<th style="background:#667eea;color:white;">PURATA</th></tr></thead><tbody>';
        topikKeys.forEach(topik => {
            html += '<tr><td style="text-align:left;font-size:13px;">'+topik+'</td>';
            let rowTPs = [];
            kelasKeys.forEach(kelas => {
                const arr = (kelasTopikMap[kelas]&&kelasTopikMap[kelas][topik])||[];
                if(arr.length>0) { const avg=(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1); html+='<td class="'+getTPColorClass(avg)+'">'+avg+'</td>'; rowTPs.push(...arr); }
                else html += '<td style="background:#f1f5f9;color:#aaa;">-</td>';
            });
            if(rowTPs.length>0) { const ra=(rowTPs.reduce((a,b)=>a+b,0)/rowTPs.length).toFixed(1); html+='<td class="'+getTPColorClass(ra)+'" style="font-weight:700;border:2px solid #667eea;">'+ra+'</td>'; }
            else html += '<td>-</td>';
            html += '</tr>';
        });
        html += '<tr style="background:#f1f5f9;font-weight:700;"><td style="text-align:left;">PURATA</td>';
        kelasKeys.forEach(kelas => {
            let arr=[]; Object.values(kelasTopikMap[kelas]||{}).forEach(a=>arr.push(...a));
            if(arr.length>0) { const avg=(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1); html+='<td class="'+getTPColorClass(avg)+'">'+avg+'</td>'; }
            else html += '<td>-</td>';
        });
        html += '<td class="'+getTPColorClass(overallAvg)+'" style="font-weight:700;border:2px solid #667eea;">'+overallAvg+'</td></tr>';
        html += '</tbody></table></div></div>';
        
        let topikAvgs = topikKeys.map(topik => {
            let arr=[]; kelasKeys.forEach(k=>{ if(kelasTopikMap[k]&&kelasTopikMap[k][topik]) arr.push(...kelasTopikMap[k][topik]); });
            return { topik, avg: arr.length>0 ? arr.reduce((a,b)=>a+b,0)/arr.length : 0 };
        }).filter(t=>t.avg>0).sort((a,b)=>b.avg-a.avg);
        let kelasAvgs = kelasKeys.map(k => {
            let arr=[]; Object.values(kelasTopikMap[k]||{}).forEach(a=>arr.push(...a));
            return { kelas:k, avg: arr.length>0 ? arr.reduce((a,b)=>a+b,0)/arr.length : 0 };
        }).sort((a,b)=>b.avg-a.avg);
        
        html += '<div class="insight-box"><h4>🔬 ANALISIS MENDALAM</h4>';
        if(topikAvgs.length>0) {
            html += '<p>• 🌟 Topik PALING MUDAH: <strong>'+topikAvgs[0].topik+'</strong> (purata '+topikAvgs[0].avg.toFixed(2)+')</p>';
            html += '<p>• 📌 Topik PALING SUKAR: <strong>'+topikAvgs[topikAvgs.length-1].topik+'</strong> (purata '+topikAvgs[topikAvgs.length-1].avg.toFixed(2)+')</p>';
        }
        html += '<p>• 🏆 Kelas TERBAIK: <strong>'+kelasAvgs[0].kelas+'</strong> (purata '+kelasAvgs[0].avg.toFixed(2)+')</p>';
        html += '<p>• ⚠️ Kelas PERLU SOKONGAN: <strong>'+kelasAvgs[kelasAvgs.length-1].kelas+'</strong> (purata '+kelasAvgs[kelasAvgs.length-1].avg.toFixed(2)+')</p>';
        html += '<p>• 💡 Fokus pengajaran pada topik sukar dan bantu kelas yang lemah</p>';
        html += '</div>';
        container.innerHTML = html;
        hideLoading();
    } catch(e) { console.error(e); showToast('Error: '+e.message,'error'); hideLoading(); }
}

// ============================================================================
// PDF EXPORTS
// ============================================================================

async function indExportPDF() {
    if(!currentAnalisaData || currentAnalisaData.type!=='individu') return;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('portrait','mm','a4');
    let y = pdfHeader(pdf, 'ANALISIS PERKEMBANGAN INDIVIDU MURID', currentAnalisaData.nama+' | '+currentAnalisaData.subjek+' - '+currentAnalisaData.fullKelas);


    pdf.setFontSize(11); pdf.setFont(undefined,'bold'); pdf.setTextColor(102,126,234);
    pdf.text('RINGKASAN PENCAPAIAN', 15, y); y += 7;
    pdf.setTextColor(0,0,0); pdf.setFontSize(9); pdf.setFont(undefined,'normal');

    const tps = currentAnalisaData.records.map(r=>r.tp);
    const avg = (tps.reduce((a,b)=>a+b,0)/tps.length).toFixed(2);
    pdf.text('Jumlah Topik Dinilai: '+currentAnalisaData.records.length, 15, y); y+=5;
    pdf.text('Purata TP: '+avg+' ('+getTPLabel(avg).replace(/[^\w\s]/g,'').trim()+')', 15, y); y+=5;
    pdf.text('TP Tertinggi: '+Math.max(...tps).toFixed(2), 15, y); y+=5;
    pdf.text('TP Terendah: '+Math.min(...tps).toFixed(2), 15, y); y+=10;

    const tableData = currentAnalisaData.records.map((r,i) => {
        return [(i+1), r.topik, r.tp.toFixed(2), r.tarikh, r.penguasaan || '-'];
    });

    pdf.autoTable({
        startY: y,
        head:[['BIL','TOPIK','PURATA TP','TARIKH','PENGUASAAN']],
        body: tableData,
        theme:'grid',
        headStyles:{fillColor:[102,126,234],textColor:[255,255,255],fontSize:9,fontStyle:'bold'},
        bodyStyles:{fontSize:8,font:'helvetica'},
        columnStyles:{
            0:{cellWidth:12,halign:'center'},
            1:{cellWidth:60},
            2:{cellWidth:28,halign:'center'},
            3:{cellWidth:35,halign:'center'},
            4:{cellWidth:45,halign:'left'}
        },
        didDrawCell: function(data) {
            if(data.section==='body' && data.column.index===4) {
                const pg = currentAnalisaData.records[data.row.index].penguasaan;
                if(pg==='Menguasai') { data.cell.styles.fillColor=[209,250,229]; data.cell.styles.textColor=[6,95,70]; }
                else { data.cell.styles.fillColor=[254,226,226]; data.cell.styles.textColor=[153,27,27]; }
            }
        }
    });
    y = pdf.lastAutoTable.finalY + 8;

    pdf.setFontSize(10); pdf.setFont(undefined,'bold'); pdf.setTextColor(102,126,234);
    pdf.text('CADANGAN GURU', 15, y); y+=6;
    pdf.setTextColor(0,0,0); pdf.setFontSize(9); pdf.setFont(undefined,'normal');
    const weak = currentAnalisaData.records.filter(r=>r.tp<=3);
    const strong = currentAnalisaData.records.filter(r=>r.tp>=5);
    if(weak.length>0) { pdf.text('• Fokus pada topik: '+weak.map(t=>t.topik).join(', '), 15, y); y+=5; }
    if(strong.length>0) { pdf.text('• Pertahankan prestasi: '+strong.map(t=>t.topik).join(', '), 15, y); y+=5; }

    pdfFooter(pdf);
    pdf.save('Analisa_Individu_'+currentAnalisaData.nama.replace(/\s+/g,'_')+'.pdf');
    showToast('✅ PDF berjaya dijana','success');
}

async function klsExportPDF() {
    if(!currentAnalisaData || currentAnalisaData.type!=='kelas') return;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('portrait','mm','a4');
    let y = pdfHeader(pdf, 'ANALISIS PRESTASI KELAS', currentAnalisaData.subjek+' - '+currentAnalisaData.fullKelas);
    const topikKeys = Object.keys(currentAnalisaData.topikMap).sort((a,b) => {
        const avgA = currentAnalisaData.topikMap[a].tps.reduce((s,v)=>s+v,0)/currentAnalisaData.topikMap[a].tps.length;
        const avgB = currentAnalisaData.topikMap[b].tps.reduce((s,v)=>s+v,0)/currentAnalisaData.topikMap[b].tps.length;
        return avgB - avgA;
    });
    const tableData = topikKeys.map(topik => {
        const t = currentAnalisaData.topikMap[topik];
        const avg = (t.tps.reduce((a,b)=>a+b,0)/t.tps.length).toFixed(2);
        const countMenguasai = t.penguasaans.filter(p => p === 'Menguasai').length;
        const countBelum = t.penguasaans.filter(p => p === 'Belum Menguasai').length;
        const penguasaan = countMenguasai >= countBelum ? 'Menguasai' : 'Belum Menguasai';
        return [t.topik, avg, t.tpCount[1], t.tpCount[2], t.tpCount[3], t.tpCount[4], t.tpCount[5], t.tpCount[6], penguasaan];
    });
    pdf.autoTable({ startY:y, head:[['TOPIK','PURATA','TP1','TP2','TP3','TP4','TP5','TP6','PENGUASAAN']], body:tableData, theme:'grid',
        headStyles:{fillColor:[240,147,251],textColor:[255,255,255],fontSize:9,fontStyle:'bold'},
        bodyStyles:{fontSize:8,font:'helvetica'},
    });
    pdfFooter(pdf);
    pdf.save('Analisa_Kelas_'+currentAnalisaData.fullKelas.replace(/\s+/g,'_')+'.pdf');
    showToast('✅ PDF berjaya dijana','success');
}

async function intExportPDF() {
    if(!currentAnalisaData || currentAnalisaData.type!=='intervensi') return;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('portrait','mm','a4');
    let y = pdfHeader(pdf, 'SENARAI MURID INTERVENSI', currentAnalisaData.subjek+' - '+currentAnalisaData.fullKelas+' | Kriteria: TP ≤ '+currentAnalisaData.kriteria);
    const tableData = [];
    Object.keys(currentAnalisaData.muridMap).forEach(noKp => {
        const m = currentAnalisaData.muridMap[noKp];
        m.records.forEach(r => { tableData.push([m.nama, r.topik+' - '+r.sub_topik, r.tp, r.tarikh, r.tp<=2?'TINGGI':'SEDERHANA']); });
    });
    pdf.autoTable({ startY:y, head:[['NAMA MURID','TOPIK','TP','TARIKH','KEUTAMAAN']], body:tableData, theme:'grid',
        headStyles:{fillColor:[245,87,108],textColor:[255,255,255],fontSize:9,fontStyle:'bold'},
        bodyStyles:{fontSize:8,font:'helvetica'},
        didDrawCell:function(data){ if(data.section==='body' && data.column.index===4){ if(data.cell.raw==='TINGGI'){data.cell.styles.fillColor=[254,226,226];data.cell.styles.textColor=[153,27,27];}else{data.cell.styles.fillColor=[254,243,199];data.cell.styles.textColor=[180,85,9];} } },
        columnStyles:{0:{cellWidth:55},1:{cellWidth:65},2:{cellWidth:15,halign:'center'},3:{cellWidth:35,halign:'center'},4:{cellWidth:30,halign:'center'}}
    });
    pdfFooter(pdf);
    pdf.save('Intervensi_'+currentAnalisaData.fullKelas.replace(/\s+/g,'_')+'.pdf');
    showToast('✅ PDF berjaya dijana','success');
}

async function prbExportPDF() {
    if(!currentAnalisaData || currentAnalisaData.type!=='perbandingan') return;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('portrait','mm','a4');
    let y = pdfHeader(pdf, 'PERBANDINGAN PRESTASI KELAS', currentAnalisaData.subjek+' - TAHUN '+currentAnalisaData.tahun);
    const tableData = currentAnalisaData.kelasStats.map((s,i) => {
        const rankSymbol = i===0?'1 (Terbaik)':i===1?'2':i===2?'3':(i+1).toString();
        return [rankSymbol, s.kelas, s.muridCount, s.avg.toFixed(2), s.median.toFixed(1)];
    });
    pdf.autoTable({ startY:y, head:[['RANK','KELAS','MURID','PURATA','MEDIAN']], body:tableData, theme:'grid',
        headStyles:{fillColor:[79,172,254],textColor:[255,255,255],fontSize:9,fontStyle:'bold'},
        bodyStyles:{fontSize:9,font:'helvetica'},
    });
    pdfFooter(pdf);
    pdf.save('Perbandingan_Kelas_'+currentAnalisaData.subjek+'.pdf');
    showToast('✅ PDF berjaya dijana','success');
}

async function trnExportPDF() {
    if(!currentAnalisaData || currentAnalisaData.type!=='trend') return;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('landscape','mm','a4');
    let y = pdfHeader(pdf, 'TREND PENCAPAIAN SUBJEK', currentAnalisaData.subjek+' - TAHUN '+currentAnalisaData.tahun+' | Rekod '+currentAnalisaData.tahunRekod);
    const head = ['TOPIK', ...currentAnalisaData.kelasKeys, 'PURATA'];
    const body = currentAnalisaData.topikKeys.map(topik => {
        const row = [topik];
        let rowTPs = [];
        currentAnalisaData.kelasKeys.forEach(kelas => {
            const arr = (currentAnalisaData.kelasTopikMap[kelas]&&currentAnalisaData.kelasTopikMap[kelas][topik])||[];
            if(arr.length>0) { const avg=(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1); row.push(avg); rowTPs.push(...arr); }
            else row.push('-');
        });
        row.push(rowTPs.length>0?(rowTPs.reduce((a,b)=>a+b,0)/rowTPs.length).toFixed(1):'-');
        return row;
    });
    pdf.autoTable({ startY:y, head:[head], body:body, theme:'grid',
        headStyles:{fillColor:[67,233,123],textColor:[255,255,255],fontSize:9,fontStyle:'bold'},
        bodyStyles:{fontSize:8,halign:'center'}, columnStyles:{0:{halign:'left',cellWidth:60}}
    });
    pdfFooter(pdf);
    pdf.save('Trend_'+currentAnalisaData.subjek+'_'+currentAnalisaData.tahunRekod+'.pdf');
    showToast('✅ PDF berjaya dijana','success');
}

// ============================================================================
// UTILITY
// ============================================================================

function showLoading(msg) {
    const loader = document.getElementById('loader');
    if(loader) { loader.style.display='flex'; const lm=loader.querySelector('.loader-message'); if(lm) lm.textContent=msg||'Loading...'; }
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
    setTimeout(() => { toast.classList.remove('show'); setTimeout(()=>toast.remove(), 300); }, 3000);
}
// ============================================================================
// TAB 6: KEPUTUSAN KELAS
// Papar TP setiap murid merentasi semua topik dalam satu tempoh
// Purata = jumlah TP / bilangan topik (murid tidak dinilai = 0)
// ============================================================================

let kptRekodList   = [];  // semua rekod untuk kelas+subjek+tempoh
let kptMuridMap    = {};  // { noKp: { nama, tpPerTopik: [] } }
let kptTopikList   = [];  // senarai topik unik (label untuk header jadual)

async function kptLoadSubjek() {
    await loadSubjekInto('kpt-subjek');
}

async function kptLoadTahun() {
    const subjek = document.getElementById('kpt-subjek').value;
    const sel    = document.getElementById('kpt-tahun');
    sel.innerHTML = '<option value="">Pilih Tahun</option>';
    document.getElementById('kpt-kelas').innerHTML = '<option value="">Pilih Kelas</option>';
    document.getElementById('kpt-content').innerHTML = '<div style="text-align:center;padding:60px;color:#999;"><div style="font-size:60px;">📋</div><p>Pilih tahun darjah</p></div>';
    if (!subjek) return;
    try {
        const snap = await firestoreRetry(() => db.collection('rekod_pbd').where('subjek','==',subjek).get());
        const set  = new Set();
        snap.forEach(d => { if (d.data().tahun) set.add(d.data().tahun); });
        const order = ['SATU','DUA','TIGA','EMPAT','LIMA','ENAM'];
        Array.from(set).sort((a,b) => order.indexOf(a) - order.indexOf(b))
            .forEach(t => sel.add(new Option(t, t)));
    } catch(e) { console.error(e); }
}

async function kptLoadKelas() {
    const subjek = document.getElementById('kpt-subjek').value;
    const tahun  = document.getElementById('kpt-tahun').value;
    const sel    = document.getElementById('kpt-kelas');
    sel.innerHTML = '<option value="">Pilih Kelas</option>';
    if (!subjek || !tahun) return;
    try {
        const snap = await firestoreRetry(() =>
            db.collection('rekod_pbd').where('subjek','==',subjek).where('tahun','==',tahun).get());
        const set = new Set();
        snap.forEach(d => { if (d.data().kelas) set.add(d.data().kelas); });
        Array.from(set).sort().forEach(k => sel.add(new Option(k, k)));
    } catch(e) { console.error(e); }
}

async function kptLoadData() {
    const subjek    = document.getElementById('kpt-subjek').value;
    const tahun     = document.getElementById('kpt-tahun').value;
    const kelas     = document.getElementById('kpt-kelas').value;
    const penilaian = document.getElementById('kpt-penilaian').value;
    const content   = document.getElementById('kpt-content');

    if (!subjek || !tahun || !kelas) {
        content.innerHTML = '<div style="text-align:center;padding:60px;color:#999;"><div style="font-size:60px;">📋</div><p>Sila lengkapkan semua filter</p></div>';
        return;
    }

    content.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">⏳ Memuatkan data...</div>';

    try {
        const snap = await firestoreRetry(() =>
            db.collection('rekod_pbd')
                .where('subjek','==',subjek)
                .where('kelas','==',kelas).get());

        // Filter mengikut tempoh
        kptRekodList = [];
        snap.forEach(d => kptRekodList.push({ id: d.id, ...d.data() }));
        if (penilaian) {
            kptRekodList = kptRekodList.filter(r => {
                const m = parseInt((r.tarikh_string || '').substring(5,7));
                if (penilaian === 'P1') return m >= 1 && m <= 5;
                if (penilaian === 'P2') return m >= 6 && m <= 10;
                return true;
            });
        }

        if (!kptRekodList.length) {
            content.innerHTML = '<div style="text-align:center;padding:60px;color:#999;"><div style="font-size:48px;">📭</div><p>Tiada rekod untuk pilihan ini</p></div>';
            return;
        }

        // Sort rekod mengikut tarikh
        kptRekodList.sort((a,b) => (a.tarikh_string||'').localeCompare(b.tarikh_string||''));

        // Bina senarai topik (header lajur)
        kptTopikList = kptRekodList.map(r => ({
            label: (r.topik || '') + '\n' + (r.sub_topik || ''),
            topik: r.topik || '',
            subtopik: r.sub_topik || '',
            tarikh: r.tarikh_string || ''
        }));

        // Kumpul semua murid unik
        const muridMap = {}; // { noKp: { nama, tpArr: [tp1, tp2, ...] } }
        // Init semua murid dari semua rekod dengan TP=0
        kptRekodList.forEach(r => {
            (r.murid || []).forEach(m => {
                if (!muridMap[m.noKp]) {
                    muridMap[m.noKp] = {
                        nama: m.namaMurid,
                        noKp: m.noKp,
                        tpArr: new Array(kptRekodList.length).fill(0),
                        penguasaan: new Array(kptRekodList.length).fill('-')
                    };
                }
            });
        });

        // Isi TP setiap murid mengikut index rekod
        kptRekodList.forEach((r, rIdx) => {
            (r.murid || []).forEach(m => {
                if (muridMap[m.noKp]) {
                    muridMap[m.noKp].tpArr[rIdx] = m.tp || 0;
                    muridMap[m.noKp].penguasaan[rIdx] = m.penguasaan || '-';
                }
            });
        });

        kptMuridMap = muridMap;

        // Render jadual
        kptRenderJadual(subjek, kelas, penilaian);

    } catch(e) {
        console.error(e);
        content.innerHTML = '<div style="text-align:center;padding:40px;color:red;">Error: ' + e.message + '</div>';
    }
}

function kptRenderJadual(subjek, kelas, penilaian) {
    const muridList = Object.values(kptMuridMap).sort((a,b) => a.nama.localeCompare(b.nama));
    const n = kptTopikList.length;
    const tempohLabel = penilaian === 'P1' ? 'Penilaian 1 (Jan–Mei)'
                      : penilaian === 'P2' ? 'Penilaian 2 (Jun–Okt)' : 'Semua Tempoh';

    // ── Summary cards ─────────────────────────────────────────
    const allAvg = muridList.map(m => {
        const jumlah = m.tpArr.reduce((a,b) => a+b, 0);
        return jumlah / n;
    });
    const kelasAvg = allAvg.length ? (allAvg.reduce((a,b)=>a+b,0)/allAvg.length).toFixed(2) : 0;
    const menguasai = muridList.filter(m => {
        const avg = m.tpArr.reduce((a,b)=>a+b,0)/n;
        return avg >= 4;
    }).length;

    let html = `
    <div style="margin-bottom:18px;">
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
            <div class="summary-card" style="flex:1;min-width:140px;">
                <div class="label">SUBJEK</div>
                <div style="font-size:15px;font-weight:700;color:#1e3a8a;margin-top:4px;">${subjek}</div>
            </div>
            <div class="summary-card" style="flex:1;min-width:140px;">
                <div class="label">KELAS</div>
                <div style="font-size:15px;font-weight:700;color:#1e3a8a;margin-top:4px;">${kelas}</div>
            </div>
            <div class="summary-card" style="flex:1;min-width:140px;">
                <div class="label">TEMPOH</div>
                <div style="font-size:13px;font-weight:700;color:#7c3aed;margin-top:4px;">${tempohLabel}</div>
            </div>
            <div class="summary-card blue" style="flex:1;min-width:140px;">
                <div class="label">JUMLAH MURID</div>
                <div class="value">${muridList.length}</div>
            </div>
            <div class="summary-card green" style="flex:1;min-width:140px;">
                <div class="label">PURATA TP KELAS</div>
                <div class="value">${kelasAvg}</div>
            </div>
            <div class="summary-card" style="flex:1;min-width:140px;">
                <div class="label">BILANGAN TOPIK</div>
                <div class="value" style="color:#f59e0b;">${n}</div>
            </div>
        </div>
    </div>`;

    // ── Jadual utama ───────────────────────────────────────────
    html += '<div style="overflow-x:auto;"><table class="heatmap-table" style="min-width:' + (300 + n*80) + 'px;">';

    // Header baris 1: nama topik
    html += '<thead><tr><th style="min-width:40px;">BIL</th><th style="min-width:180px;text-align:left;">NAMA MURID</th>';
    kptTopikList.forEach((t,i) => {
        html += '<th style="min-width:75px;font-size:10px;writing-mode:inherit;white-space:nowrap;" title="' + t.tarikh + '">'
            + '<div style="font-weight:700;">' + t.topik + '</div>'
            + '<div style="font-size:9px;color:#c7d2fe;font-weight:400;">' + (t.subtopik.length > 20 ? t.subtopik.substring(0,20)+'…' : t.subtopik) + '</div>'
            + '</th>';
    });
    html += '<th style="min-width:80px;background:#1e3a8a;">PURATA TP</th>';
    html += '<th style="min-width:90px;background:#1e3a8a;">STATUS</th></tr></thead>';

    // Badan jadual
    html += '<tbody>';
    muridList.forEach((m, idx) => {
        const jumlah = m.tpArr.reduce((a,b) => a+b, 0);
        const avg    = jumlah / n;
        const avgStr = avg.toFixed(2);
        const colorClass = getTPColorClass(avg);
        const status = avg >= 5 ? '🟢 Cemerlang' : avg >= 4 ? '🟡 Baik' : avg >= 3 ? '🟠 Sederhana' : '🔴 Lemah';

        html += '<tr>';
        html += '<td style="text-align:center;color:#94a3b8;font-weight:700;">' + (idx+1) + '</td>';
        html += '<td style="text-align:left;font-weight:600;">' + m.nama + '</td>';

        m.tpArr.forEach(tp => {
            const cls = tp === 0 ? 'tp-red' : tp <= 2 ? 'tp-red' : tp === 3 ? 'tp-orange'
                      : tp === 4 ? 'tp-yellow' : tp === 5 ? 'tp-lightgreen' : 'tp-green';
            html += '<td class="' + cls + '" style="text-align:center;font-weight:700;">' + (tp === 0 ? '—' : tp) + '</td>';
        });

        html += '<td class="' + colorClass + '" style="text-align:center;font-weight:800;font-size:15px;">' + avgStr + '</td>';
        html += '<td style="text-align:center;font-size:12px;">' + status + '</td>';
        html += '</tr>';
    });

    // Baris purata kelas
    html += '<tr style="background:#1e3a8a;color:white;font-weight:700;">';
    html += '<td colspan="2" style="text-align:center;padding:8px;">PURATA KELAS</td>';
    kptTopikList.forEach((t, i) => {
        const tpValues = muridList.map(m => m.tpArr[i]);
        const avg = tpValues.length ? (tpValues.reduce((a,b)=>a+b,0)/tpValues.length).toFixed(1) : '—';
        html += '<td style="text-align:center;">' + avg + '</td>';
    });
    html += '<td colspan="2" style="text-align:center;">' + kelasAvg + '</td>';
    html += '</tr>';

    html += '</tbody></table></div>';

    // Legend warna
    html += `<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:12px;">
        <strong>Warna TP:</strong>
        <span style="background:#fee2e2;color:#991b1b;padding:2px 10px;border-radius:4px;">TP 1-2 (Lemah)</span>
        <span style="background:#ffedd5;color:#9a3412;padding:2px 10px;border-radius:4px;">TP 3 (Sederhana)</span>
        <span style="background:#fef9c3;color:#854d0e;padding:2px 10px;border-radius:4px;">TP 4 (Baik)</span>
        <span style="background:#a7f3d0;color:#065f46;padding:2px 10px;border-radius:4px;">TP 5 (Baik)</span>
        <span style="background:#d1fae5;color:#065f46;padding:2px 10px;border-radius:4px;">TP 6 (Cemerlang)</span>
        <span style="background:#e2e8f0;color:#475569;padding:2px 10px;border-radius:4px;">— = Tidak dinilai (0)</span>
    </div>`;

    document.getElementById('kpt-content').innerHTML = html;
}

// ── PDF EXPORT ────────────────────────────────────────────────────────────────
async function kptExportPDF() {
    const subjek    = document.getElementById('kpt-subjek').value;
    const kelas     = document.getElementById('kpt-kelas').value;
    const penilaian = document.getElementById('kpt-penilaian').value;

    if (!subjek || !kelas || !kptRekodList.length) {
        showToast('Sila muatkan data dahulu', 'warning'); return;
    }

    showLoading('Menyediakan PDF...');
    try {
        const muridList   = Object.values(kptMuridMap).sort((a,b) => a.nama.localeCompare(b.nama));
        const n           = kptTopikList.length;
        const tempohLabel = penilaian === 'P1' ? 'Penilaian 1 (Jan–Mei)'
                          : penilaian === 'P2' ? 'Penilaian 2 (Jun–Okt)' : 'Semua Tempoh';
        const kelasAvg    = (muridList.reduce((sum,m) => sum + m.tpArr.reduce((a,b)=>a+b,0)/n, 0) / muridList.length).toFixed(2);
        const tarikhCetak = new Date().toLocaleDateString('ms-MY', {day:'2-digit',month:'2-digit',year:'numeric'});
        const isLandscape = n > 5;
        const pageW       = isLandscape ? '277mm' : '190mm';

        // ── Bina HTML lengkap ────────────────────────────────────
        let html = `
        <div style="width:${pageW};font-family:'Segoe UI',Arial,sans-serif;font-size:9px;color:#1e293b;padding:0;margin:0;">

          <!-- HEADER BIRU -->
          <div style="background:#1e3a8a;color:white;padding:12px 16px;border-radius:5px 5px 0 0;">
            <table style="width:100%;border-collapse:collapse;"><tr>
              <td style="vertical-align:middle;">
                <div style="font-size:15px;font-weight:800;letter-spacing:0.5px;">SK SULTAN ISMAIL</div>
                <div style="font-size:9px;opacity:0.8;margin-top:2px;">KEPUTUSAN PENILAIAN BERASASKAN DARJAH (PBD)</div>
              </td>
              <td style="text-align:right;vertical-align:middle;">
                <div style="font-size:11px;font-weight:700;">${subjek} — ${kelas}</div>
                <div style="font-size:9px;opacity:0.8;margin-top:2px;">${tempohLabel}</div>
              </td>
            </tr></table>
          </div>
          <!-- ACCENT BAR -->
          <div style="height:4px;background:linear-gradient(90deg,#f59e0b,#ef4444,#8b5cf6);margin-bottom:10px;border-radius:0 0 3px 3px;"></div>

          <!-- INFO RINGKAS -->
          <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:9px;border:1px solid #cbd5e1;">
            <tr>
              <td style="background:#eff6ff;color:#1e40af;font-weight:700;padding:5px 10px;width:18%;white-space:nowrap;">SUBJEK</td>
              <td style="padding:5px 10px;">${subjek}</td>
              <td style="background:#eff6ff;color:#1e40af;font-weight:700;padding:5px 10px;width:18%;white-space:nowrap;">KELAS</td>
              <td style="padding:5px 10px;">${kelas}</td>
            </tr>
            <tr>
              <td style="background:#eff6ff;color:#1e40af;font-weight:700;padding:5px 10px;">TEMPOH</td>
              <td style="padding:5px 10px;">${tempohLabel}</td>
              <td style="background:#eff6ff;color:#1e40af;font-weight:700;padding:5px 10px;">PURATA KELAS</td>
              <td style="padding:5px 10px;font-weight:800;color:#1e3a8a;font-size:11px;">${kelasAvg}</td>
            </tr>
            <tr>
              <td style="background:#eff6ff;color:#1e40af;font-weight:700;padding:5px 10px;">JUMLAH MURID</td>
              <td style="padding:5px 10px;">${muridList.length} orang</td>
              <td style="background:#eff6ff;color:#1e40af;font-weight:700;padding:5px 10px;">BILANGAN TOPIK</td>
              <td style="padding:5px 10px;">${n} topik</td>
            </tr>
          </table>

          <!-- JADUAL UTAMA -->
          <div style="background:#1e3a8a;color:white;padding:5px 10px;font-size:8.5px;font-weight:700;letter-spacing:0.5px;border-radius:3px;margin-bottom:6px;">
            SENARAI MURID DAN TAHAP PENGUASAAN (TP)
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:8px;">
            <thead>
              <tr style="background:#1e3a8a;color:white;">
                <th style="padding:5px 4px;border:1px solid #1e40af;width:28px;text-align:center;">BIL</th>
                <th style="padding:5px 6px;border:1px solid #1e40af;text-align:left;">NAMA MURID</th>`;

        kptTopikList.forEach(t => {
            const label = (t.subtopik||t.topik);
            const short = label.length > 22 ? label.substring(0,22)+'…' : label;
            html += `<th style="padding:4px 3px;border:1px solid #1e40af;text-align:center;font-size:7px;min-width:38px;">
                        <div style="font-weight:700;">${t.topik}</div>
                        <div style="opacity:0.75;font-weight:400;margin-top:1px;">${short}</div>
                     </th>`;
        });

        html += `<th style="padding:5px 4px;border:1px solid #1e40af;text-align:center;min-width:45px;">PURATA TP</th>
                 <th style="padding:5px 4px;border:1px solid #1e40af;text-align:center;min-width:60px;">STATUS</th>
              </tr>
            </thead>
            <tbody>`;

        muridList.forEach((m, idx) => {
            const jumlah = m.tpArr.reduce((a,b)=>a+b,0);
            const avg    = jumlah / n;
            const avgStr = avg.toFixed(2);
            const rowBg  = idx % 2 === 0 ? '#f8faff' : '#ffffff';
            const status = avg >= 5 ? 'Cemerlang' : avg >= 4 ? 'Baik' : avg >= 3 ? 'Sederhana' : 'Lemah';
            const stColor= avg >= 5 ? '#15803d' : avg >= 4 ? '#854d0e' : avg >= 3 ? '#9a3412' : '#991b1b';
            const stBg   = avg >= 5 ? '#dcfce7' : avg >= 4 ? '#fef9c3' : avg >= 3 ? '#ffedd5' : '#fee2e2';

            html += `<tr style="background:${rowBg};">
                <td style="padding:4px;border:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-weight:700;">${idx+1}</td>
                <td style="padding:4px 6px;border:1px solid #e2e8f0;font-weight:600;">${m.nama}</td>`;

            m.tpArr.forEach(tp => {
                const bg2 = tp===0?'#f1f5f9':tp<=2?'#fee2e2':tp===3?'#ffedd5':tp===4?'#fef9c3':tp===5?'#a7f3d0':'#d1fae5';
                const fc2 = tp===0?'#94a3b8':tp<=2?'#991b1b':tp===3?'#9a3412':tp===4?'#854d0e':'#065f46';
                html += `<td style="padding:4px;border:1px solid #e2e8f0;text-align:center;font-weight:800;font-size:10px;background:${bg2};color:${fc2};">${tp===0?'—':tp}</td>`;
            });

            html += `<td style="padding:4px;border:1px solid #e2e8f0;text-align:center;font-weight:800;font-size:11px;color:#1e3a8a;">${avgStr}</td>
                     <td style="padding:4px;border:1px solid #e2e8f0;text-align:center;background:${stBg};color:${stColor};font-weight:700;font-size:8px;">${status}</td>
                    </tr>`;
        });

        // Baris purata kelas
        html += `<tr style="background:#1e3a8a;color:white;font-weight:700;">
            <td colspan="2" style="padding:5px;border:1px solid #1e40af;text-align:center;font-size:8.5px;">PURATA KELAS</td>`;
        kptTopikList.forEach((t,i) => {
            const vals = muridList.map(m => m.tpArr[i]);
            const avg  = (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1);
            html += `<td style="padding:5px;border:1px solid #1e40af;text-align:center;font-size:9px;">${avg}</td>`;
        });
        html += `<td style="padding:5px;border:1px solid #1e40af;text-align:center;font-size:10px;">${kelasAvg}</td>
                 <td style="padding:5px;border:1px solid #1e40af;"></td>
                </tr>
            </tbody>
          </table>

          <!-- LEGEND -->
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:7.5px;">
            <span style="font-weight:700;color:#475569;">Warna TP:</span>
            <span style="background:#fee2e2;color:#991b1b;padding:2px 7px;border-radius:3px;">TP 1-2 Lemah</span>
            <span style="background:#ffedd5;color:#9a3412;padding:2px 7px;border-radius:3px;">TP 3 Sederhana</span>
            <span style="background:#fef9c3;color:#854d0e;padding:2px 7px;border-radius:3px;">TP 4 Baik</span>
            <span style="background:#a7f3d0;color:#065f46;padding:2px 7px;border-radius:3px;">TP 5 Baik</span>
            <span style="background:#d1fae5;color:#065f46;padding:2px 7px;border-radius:3px;">TP 6 Cemerlang</span>
            <span style="background:#f1f5f9;color:#94a3b8;padding:2px 7px;border-radius:3px;">— Tidak dinilai</span>
          </div>

          <!-- FOOTER -->
          <div style="margin-top:10px;padding-top:6px;border-top:1.5px solid #e2e8f0;display:flex;justify-content:space-between;font-size:7.5px;color:#94a3b8;">
            <span>SK Sultan Ismail — Sistem Rekod PBD</span>
            <span>Dokumen Sulit — Guna Dalaman Sahaja</span>
            <span>Dicetak: ${tarikhCetak}</span>
          </div>

        </div>`;

        // ── Jana PDF ─────────────────────────────────────────────
        const wrapper = document.createElement('div');
        wrapper.style.cssText = [
            'position:absolute',
            'top:0',
            'left:0',
            'z-index:-9999',
            'background:white',
            'padding:14mm',
            'box-sizing:border-box',
            'width:' + (isLandscape ? '277mm' : '210mm')
        ].join(';');
        wrapper.innerHTML = html;
        document.body.appendChild(wrapper);

        await document.fonts.ready;
        await new Promise(r => setTimeout(r, 600));

        const filename = 'Keputusan_' + subjek.replace(/\s+/g,'_') + '_' + kelas.replace(/\s+/g,'_') + '_' + (penilaian||'Semua') + '.pdf';
        await html2pdf().set({
            margin: [10, 10, 10, 10],
            filename,
            image:      { type:'jpeg', quality:0.98 },
            html2canvas:{ scale:2, useCORS:true, logging:false, allowTaint:true, scrollX:0, scrollY:0 },
            jsPDF:      { unit:'mm', format:'a4', orientation: isLandscape ? 'landscape' : 'portrait', compress:true }
        }).from(wrapper).save();

        document.body.removeChild(wrapper);
        showToast('PDF berjaya dijana!', 'success');
        hideLoading();

    } catch(e) {
        console.error(e);
        showToast('Error: ' + e.message, 'error');
        hideLoading();
    }
}
