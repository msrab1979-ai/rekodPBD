// ============================================================================
// ISI PANTAS PBD — menjana rekod bagi topik yang masih kosong
// ----------------------------------------------------------------------------
// Guru menetapkan satu TP bagi setiap murid; sistem mencipta rekod untuk
// setiap topik/subtopik yang BELUM ada rekod dalam tempoh penilaian dipilih.
//
// Satu subjek satu darjah boleh mempunyai 40+ subtopik. Mengisi 33 topik yang
// tertinggal secara manual bermakna 33 × 34 murid = 1,122 kemasukan; di sini
// ia menjadi satu TP setiap murid.
//
// PRINSIP KESELAMATAN:
//   - Topik yang SUDAH ada rekod tidak pernah disentuh
//   - Pratonton memaparkan setiap topik yang akan dicipta; guru boleh buang
//   - Setiap rekod ditanda `dijana_auto` supaya boleh dibuang semula sekali gus
//   - Tarikh diagih merentasi tempoh, melangkau hujung minggu dan cuti
// ============================================================================

let ipTopikKosong  = [];   // [{topik, main, sub, pilih}]
let ipMuridSenarai = [];   // [{noKp, nama, tp, cadangan}]
let ipKonteks      = null; // {subjek, tahun, kelas, penilaian, label}

// Cuti umum + cuti sekolah Malaysia 2026 (Terengganu: hujung minggu Jumaat–Sabtu)
const IP_CUTI = [
    '2026-01-01','2026-01-14','2026-01-29','2026-02-01','2026-02-17',
    '2026-03-20','2026-03-21','2026-03-22','2026-03-23',
    '2026-05-01','2026-05-11','2026-05-27','2026-05-28',
    '2026-06-02','2026-06-07','2026-08-31','2026-09-16','2026-10-20'
];

// Terengganu: hari rehat Jumaat (5) & Sabtu (6)
function ipHariCuti(d) {
    const hari = d.getDay();
    if (hari === 5 || hari === 6) return true;
    const s = d.getFullYear() + '-' +
              String(d.getMonth() + 1).padStart(2, '0') + '-' +
              String(d.getDate()).padStart(2, '0');
    return IP_CUTI.indexOf(s) !== -1;
}

function ipTarikhStr(d) {
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
}

/* Agih n tarikh merentasi tempoh penilaian, hari persekolahan sahaja.
   Rekod yang semuanya bertarikh sama kelihatan dijana; diagih sepanjang
   tempoh mencerminkan cara penilaian sebenar berlaku. */
function ipAgihTarikh(penilaian, n) {
    const thn = new Date().getFullYear();
    let mula, akhir;
    if (penilaian === 'P1')      { mula = new Date(thn,0,5);  akhir = new Date(thn,4,31); }
    else if (penilaian === 'P2') { mula = new Date(thn,5,1);  akhir = new Date(thn,9,31); }
    else                         { mula = new Date(thn,0,5);  akhir = new Date(thn,9,31); }

    // Jangan melepasi hari ini — rekod bertarikh masa depan tidak masuk akal
    const kini = new Date(); kini.setHours(0,0,0,0);
    if (akhir > kini) akhir = kini;

    const hariSekolah = [];
    for (let d = new Date(mula); d <= akhir; d.setDate(d.getDate() + 1)) {
        if (!ipHariCuti(d)) hariSekolah.push(new Date(d));
    }
    if (!hariSekolah.length) return [];

    const keluar = [];
    for (let i = 0; i < n; i++) {
        const idx = Math.floor((i + 0.5) * hariSekolah.length / n);
        keluar.push(ipTarikhStr(hariSekolah[Math.min(idx, hariSekolah.length - 1)]));
    }
    return keluar;
}

// ── Borang ───────────────────────────────────────────────────────────────────

function ipBuka() {
    const h = `
    <div id="ip-overlay" style="position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:9999;
         display:flex;align-items:center;justify-content:center;padding:20px;"
         onclick="if(event.target===this)ipTutup()">
      <div style="background:#fff;border-radius:14px;max-width:560px;width:100%;
           box-shadow:0 20px 50px rgba(0,0,0,.3);">
        <div style="padding:20px 24px;border-bottom:2px solid #e2e8f0;">
          <h3 style="margin:0;font-size:18px;color:#0f172a;">⚡ Isi Pantas PBD</h3>
          <div style="margin-top:8px;font-size:13px;color:#475569;line-height:1.6;">
            Menjana rekod bagi topik yang <strong>belum diisi</strong>.
            Anda tetapkan satu TP bagi setiap murid; sistem mencipta rekod untuk
            setiap topik yang masih kosong dalam tempoh dipilih.
          </div>
          <div style="margin-top:10px;background:#eff6ff;border-left:4px solid #2563eb;
               padding:9px 12px;border-radius:6px;font-size:12px;color:#1e40af;">
            Topik yang sudah ada rekod <strong>tidak akan disentuh</strong>.
            Sila ubah TP bagi topik yang prestasi murid berbeza selepas dijana.
          </div>
        </div>
        <div style="padding:20px 24px;">
          <div class="form-group" style="margin-bottom:14px;">
            <label>Jenis Penilaian:</label>
            <select id="ip-penilaian" class="form-control">
              <option value="P1">Penilaian 1 (Jan–Mei)</option>
              <option value="P2">Penilaian 2 (Jun–Okt)</option>
              <option value="">Semua Tempoh (sepanjang tahun)</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label>Subjek:</label>
            <select id="ip-subjek" class="form-control" onchange="ipLoadTahun()">
              <option value="">Pilih Subjek</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label>Darjah:</label>
            <select id="ip-tahun" class="form-control" onchange="ipLoadKelas()">
              <option value="">Pilih Darjah</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:4px;">
            <label>Kelas:</label>
            <select id="ip-kelas" class="form-control">
              <option value="">Pilih Kelas</option>
            </select>
          </div>
        </div>
        <div style="padding:16px 24px;border-top:2px solid #e2e8f0;display:flex;gap:10px;
             justify-content:flex-end;">
          <button class="form-control" style="width:auto;padding:8px 18px;cursor:pointer;"
                  onclick="ipTutup()">Batal</button>
          <button class="export-btn" style="padding:8px 22px;" onclick="ipJana()">Seterusnya →</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', h);
    loadSubjekInto('ip-subjek');
}

function ipTutup() {
    const el = document.getElementById('ip-overlay');
    if (el) el.remove();
}

async function ipLoadTahun() {
    const subjek = document.getElementById('ip-subjek').value;
    const sel = document.getElementById('ip-tahun');
    sel.innerHTML = '<option value="">Pilih Darjah</option>';
    document.getElementById('ip-kelas').innerHTML = '<option value="">Pilih Kelas</option>';
    if (!subjek) return;
    try {
        const snap = await firestoreRetry(() =>
            db.collection('topik_pembelajaran').where('subjek','==',subjek).get());
        const set = new Set();
        snap.forEach(d => { if (d.data().tahun) set.add(d.data().tahun); });
        const urut = ['SATU','DUA','TIGA','EMPAT','LIMA','ENAM'];
        Array.from(set).sort((a,b) => urut.indexOf(a) - urut.indexOf(b))
            .forEach(t => sel.add(new Option(t, t)));
    } catch(e) { console.error(e); showToast('Gagal memuat darjah', 'error'); }
}

async function ipLoadKelas() {
    const tahun = document.getElementById('ip-tahun').value;
    const sel = document.getElementById('ip-kelas');
    sel.innerHTML = '<option value="">Pilih Kelas</option>';
    if (!tahun) return;
    try {
        const snap = await firestoreRetry(() =>
            db.collection('murid').where('tahun','==',tahun).where('status','==','AKTIF').get());
        const set = new Set();
        snap.forEach(d => { if (d.data().kelas) set.add(d.data().kelas); });
        Array.from(set).sort().forEach(k => sel.add(new Option(k, k)));
    } catch(e) { console.error(e); showToast('Gagal memuat kelas', 'error'); }
}

// ── Jana: cari topik kosong + murid ──────────────────────────────────────────

async function ipJana() {
    const penilaian = document.getElementById('ip-penilaian').value;
    const subjek    = document.getElementById('ip-subjek').value;
    const tahun     = document.getElementById('ip-tahun').value;
    const kelas     = document.getElementById('ip-kelas').value;

    if (!subjek || !tahun || !kelas) {
        showToast('Sila lengkapkan semua pilihan', 'warning'); return;
    }

    const fullKelas = tahun + ' ' + kelas;
    const label = penilaian === 'P1' ? 'Penilaian 1 (Jan–Mei)'
                : penilaian === 'P2' ? 'Penilaian 2 (Jun–Okt)' : 'Semua Tempoh';

    showLoading('Menyemak topik dan murid...');
    try {
        // Tiga query serentak — elak menunggu berturutan
        const [snapTopik, snapRekod, snapMurid] = await Promise.all([
            firestoreRetry(() => db.collection('topik_pembelajaran')
                .where('subjek','==',subjek).where('tahun','==',tahun).get()),
            firestoreRetry(() => db.collection('rekod_pbd')
                .where('subjek','==',subjek).where('kelas','==',fullKelas).get()),
            firestoreRetry(() => db.collection('murid')
                .where('tahun','==',tahun).where('kelas','==',kelas).where('status','==','AKTIF').get())
        ]);

        // Subtopik sahaja — itulah unit rekod PBD
        const topik = [];
        snapTopik.forEach(d => {
            const t = d.data();
            if (t.is_subtopik && t.aktif !== false) topik.push(t);
        });

        if (!topik.length) {
            hideLoading();
            showToast('Tiada subtopik didaftarkan untuk ' + subjek + ' ' + tahun, 'warning');
            return;
        }

        // Rekod sedia ada dalam tempoh — kunci padanan ikut topik + subtopik
        const sudahAda = new Set();
        const tpLepas  = {};   // {noKp: [tp,...]} untuk cadangan
        snapRekod.forEach(d => {
            const r = d.data();
            const bln = parseInt((r.tarikh_string || '').substring(5,7), 10);
            const dalamTempoh = !penilaian
                || (penilaian === 'P1' && bln >= 1 && bln <= 5)
                || (penilaian === 'P2' && bln >= 6 && bln <= 10);
            if (dalamTempoh) sudahAda.add((r.topik || '') + '|' + (r.sub_topik || ''));
            // Cadangan TP diambil dari SEMUA rekod, bukan tempoh ini sahaja
            (r.murid || []).forEach(m => {
                if (!m.noKp || !m.tp) return;
                (tpLepas[m.noKp] = tpLepas[m.noKp] || []).push(m.tp);
            });
        });

        ipTopikKosong = topik
            .filter(t => !sudahAda.has((t.topik || '') + '|' + (t.topik_pembelajaran || '')))
            .map(t => ({
                topik: t.topik || '',
                main: t.topik_pembelajaran_main || t.topik_pembelajaran || '',
                sub: t.topik_pembelajaran || '',
                idSubjek: t.id_subjek || '',
                pilih: true
            }));

        if (!ipTopikKosong.length) {
            hideLoading();
            showToast('✅ Semua topik sudah ada rekod untuk ' + label, 'success');
            return;
        }

        ipMuridSenarai = [];
        snapMurid.forEach(d => {
            const m = d.data();
            const lepas = tpLepas[m.noKp] || [];
            const purata = lepas.length
                ? lepas.reduce((a,b) => a+b, 0) / lepas.length : null;
            const cadang = purata === null ? 4 : Math.min(6, Math.max(1, Math.round(purata)));
            ipMuridSenarai.push({
                noKp: m.noKp, nama: m.namaMurid,
                tp: cadang,
                cadangan: purata === null ? null : Number(purata.toFixed(2))
            });
        });
        ipMuridSenarai.sort((a,b) => (a.nama||'').localeCompare(b.nama||''));

        if (!ipMuridSenarai.length) {
            hideLoading();
            showToast('Tiada murid aktif dalam ' + fullKelas, 'warning');
            return;
        }

        ipKonteks = { subjek, tahun, kelas, fullKelas, penilaian, label,
                      jumlahTopik: topik.length, sudahAda: topik.length - ipTopikKosong.length };
        hideLoading();
        ipPaparTP();

    } catch(e) {
        hideLoading();
        console.error(e);
        showToast('Ralat: ' + e.message, 'error');
    }
}

// ── Skrin 2: guru tetapkan TP setiap murid ───────────────────────────────────

function ipPaparTP() {
    ipTutup();
    const k = ipKonteks;
    const adaCadangan = ipMuridSenarai.some(m => m.cadangan !== null);

    let h = `
    <div id="ip-overlay" style="position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:9999;
         display:flex;align-items:center;justify-content:center;padding:20px;"
         onclick="if(event.target===this)ipTutup()">
      <div style="background:#fff;border-radius:14px;max-width:720px;width:100%;max-height:88vh;
           display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.3);">
        <div style="padding:18px 22px;border-bottom:2px solid #e2e8f0;">
          <h3 style="margin:0;font-size:18px;color:#0f172a;">⚡ Tetapkan TP Murid</h3>
          <div style="margin-top:6px;font-size:13px;color:#475569;">
            <strong>${k.subjek}</strong> &middot; ${k.fullKelas} &middot; ${k.label}
          </div>
          <div style="margin-top:8px;font-size:12px;color:#64748b;">
            <strong>${ipTopikKosong.length}</strong> topik masih kosong &middot;
            <strong>${k.sudahAda}</strong> sudah ada rekod (tidak disentuh) &middot;
            <strong>${ipMuridSenarai.length}</strong> murid
          </div>
          ${adaCadangan ? `<div style="margin-top:8px;font-size:12px;color:#15803d;">
            TP dicadang daripada purata rekod sedia ada murid. Sila semak.</div>` : ''}
          <div style="margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <span style="font-size:13px;color:#475569;">Set semua kepada:</span>
            <select id="ip-set-semua" class="form-control" style="width:auto;padding:4px 8px;">
              ${[1,2,3,4,5,6].map(v => `<option value="${v}"${v===5?' selected':''}>TP${v}</option>`).join('')}
            </select>
            <button class="form-control" style="width:auto;padding:5px 14px;cursor:pointer;"
                    onclick="ipSetSemua()">Guna</button>
          </div>
        </div>
        <div style="overflow:auto;flex:1;padding:0 22px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="position:sticky;top:0;background:#f1f5f9;">
              <th style="padding:8px 4px;text-align:center;width:36px;">#</th>
              <th style="padding:8px 4px;text-align:left;">NAMA MURID</th>
              <th style="padding:8px 4px;text-align:center;width:90px;">REKOD LEPAS</th>
              <th style="padding:8px 4px;text-align:center;width:96px;">TP</th>
            </tr></thead><tbody>`;

    ipMuridSenarai.forEach((m, i) => {
        h += `<tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:6px 4px;text-align:center;color:#94a3b8;">${i+1}</td>
            <td style="padding:6px 4px;font-weight:600;">${m.nama}</td>
            <td style="padding:6px 4px;text-align:center;color:#64748b;">
              ${m.cadangan === null ? '—' : m.cadangan.toFixed(2)}</td>
            <td style="padding:6px 4px;text-align:center;">
              <select class="form-control ip-tp" data-i="${i}"
                      style="padding:3px 6px;font-size:13px;font-weight:700;"
                      onchange="ipMuridSenarai[${i}].tp=parseInt(this.value)">
                ${[1,2,3,4,5,6].map(v => `<option value="${v}"${v===m.tp?' selected':''}>TP${v}</option>`).join('')}
              </select></td>
          </tr>`;
    });

    h += `</tbody></table></div>
        <div style="padding:16px 22px;border-top:2px solid #e2e8f0;display:flex;gap:10px;
             justify-content:flex-end;align-items:center;">
          <span style="margin-right:auto;font-size:13px;color:#475569;">
            Akan cipta <strong>${ipTopikKosong.length}</strong> rekod
            × ${ipMuridSenarai.length} murid
          </span>
          <button class="form-control" style="width:auto;padding:8px 18px;cursor:pointer;"
                  onclick="ipTutup()">Batal</button>
          <button class="export-btn" style="padding:8px 20px;" onclick="ipPratonton()">Semak Topik →</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', h);
}

function ipSetSemua() {
    const v = parseInt(document.getElementById('ip-set-semua').value, 10);
    ipMuridSenarai.forEach((m, i) => {
        m.tp = v;
        const s = document.querySelector('.ip-tp[data-i="' + i + '"]');
        if (s) s.value = v;
    });
}

// ── Skrin 3: pratonton topik sebelum menulis ─────────────────────────────────

function ipPratonton() {
    ipTutup();
    const k = ipKonteks;

    let h = `
    <div id="ip-overlay" style="position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:9999;
         display:flex;align-items:center;justify-content:center;padding:20px;"
         onclick="if(event.target===this)ipTutup()">
      <div style="background:#fff;border-radius:14px;max-width:720px;width:100%;max-height:88vh;
           display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.3);">
        <div style="padding:18px 22px;border-bottom:2px solid #e2e8f0;">
          <h3 style="margin:0;font-size:18px;color:#0f172a;">⚡ Semak Sebelum Simpan</h3>
          <div style="margin-top:6px;font-size:13px;color:#475569;">
            <strong>${k.subjek}</strong> &middot; ${k.fullKelas} &middot; ${k.label}
          </div>
          <div style="margin-top:10px;background:#fef3c7;border-left:4px solid #f59e0b;
               padding:9px 12px;border-radius:6px;font-size:12px;color:#854d0e;">
            Buang tanda pada topik yang anda <strong>tidak mahu</strong> dijana.
            Tarikh diagih automatik dalam tempoh, melangkau hujung minggu dan cuti.
          </div>
        </div>
        <div style="overflow:auto;flex:1;padding:12px 22px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="position:sticky;top:0;background:#f1f5f9;">
              <th style="padding:8px 4px;text-align:center;width:40px;">
                <input type="checkbox" checked onchange="ipTandaSemua(this.checked)"></th>
              <th style="padding:8px 4px;text-align:left;width:70px;">KOD</th>
              <th style="padding:8px 4px;text-align:left;">TOPIK / SUBTOPIK</th>
            </tr></thead><tbody>`;

    ipTopikKosong.forEach((t, i) => {
        h += `<tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:6px 4px;text-align:center;">
              <input type="checkbox" class="ip-pilih" data-i="${i}" ${t.pilih?'checked':''}
                     onchange="ipTopikKosong[${i}].pilih=this.checked;ipKiraPilih()"></td>
            <td style="padding:6px 4px;color:#64748b;font-weight:600;">${t.topik}</td>
            <td style="padding:6px 4px;">${t.sub || t.main}</td>
          </tr>`;
    });

    h += `</tbody></table></div>
        <div style="padding:16px 22px;border-top:2px solid #e2e8f0;display:flex;gap:10px;
             justify-content:flex-end;align-items:center;">
          <span id="ip-kira" style="margin-right:auto;font-size:13px;color:#475569;"></span>
          <button class="form-control" style="width:auto;padding:8px 18px;cursor:pointer;"
                  onclick="ipPaparTP()">← Kembali</button>
          <button class="export-btn" style="padding:8px 20px;background:#0f766e;"
                  onclick="ipSimpan()">✓ Jana Rekod</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', h);
    ipKiraPilih();
}

function ipTandaSemua(nilai) {
    ipTopikKosong.forEach((t, i) => {
        t.pilih = nilai;
        const c = document.querySelector('.ip-pilih[data-i="' + i + '"]');
        if (c) c.checked = nilai;
    });
    ipKiraPilih();
}

function ipKiraPilih() {
    const n = ipTopikKosong.filter(t => t.pilih).length;
    const el = document.getElementById('ip-kira');
    if (el) {
        el.innerHTML = n
            ? `<strong>${n}</strong> topik × ${ipMuridSenarai.length} murid = ` +
              `<strong>${n * ipMuridSenarai.length}</strong> isian`
            : '<span style="color:#b45309;">Tiada topik dipilih</span>';
    }
}

// ── Simpan ───────────────────────────────────────────────────────────────────

async function ipSimpan() {
    const pilih = ipTopikKosong.filter(t => t.pilih);
    if (!pilih.length) { showToast('Pilih sekurang-kurangnya satu topik', 'warning'); return; }

    const k = ipKonteks;
    if (!confirm(
        'JANA REKOD PBD\n\n' +
        k.subjek + ' — ' + k.fullKelas + '\n' + k.label + '\n\n' +
        pilih.length + ' topik × ' + ipMuridSenarai.length + ' murid\n\n' +
        'Topik yang sudah ada rekod tidak disentuh.\n' +
        'Rekod yang dijana boleh dibuang semula.\n\nTeruskan?')) return;

    showLoading('Menjana ' + pilih.length + ' rekod...');
    try {
        const cfg = await firestoreRetry(() =>
            db.collection('config').doc('system_settings').get());
        let lastId = (cfg.data().lastRekodId || 0);

        const tarikhSenarai = ipAgihTarikh(k.penilaian, pilih.length);
        const namaGuru = (document.getElementById('inputNamaGuru') || {}).value || '';
        const kumpulanId = 'IP' + Date.now();   // penanda kumpulan untuk buang semula

        const muridArr = ipMuridSenarai.map((m, i) => ({
            bil: i + 1,
            noKp: m.noKp,
            namaMurid: m.nama,
            tp: m.tp,
            penguasaan: m.tp >= 3 ? 'Menguasai' : 'Belum Menguasai',
            catatan: ''
        }));
        const totalM = muridArr.filter(m => m.penguasaan === 'Menguasai').length;

        // Tulis berkelompok — 500 ialah had satu batch Firestore
        let siap = 0;
        for (let i = 0; i < pilih.length; i += 100) {
            const kepingan = pilih.slice(i, i + 100);
            const batch = db.batch();

            kepingan.forEach((t, j) => {
                lastId += 1;
                const idRekod = 'R' + String(lastId).padStart(5, '0');
                const tarikh  = tarikhSenarai[i + j] || tarikhSenarai[tarikhSenarai.length - 1];
                const ref = db.collection('rekod_pbd').doc();

                batch.set(ref, {
                    id_rekod: idRekod,
                    tahun: k.tahun,
                    kelas: k.fullKelas,
                    subjek: k.subjek,
                    id_subjek: t.idSubjek || '',
                    topik: t.topik,
                    topik_pembelajaran_main: t.main,
                    sub_topik: t.sub,
                    nama_guru: namaGuru,
                    tarikh: firebase.firestore.Timestamp.fromDate(new Date(tarikh + 'T00:00:00')),
                    tarikh_string: tarikh,
                    aktiviti_kelas: '',
                    murid: muridArr,
                    jumlah_murid: muridArr.length,
                    jumlah_menguasai: totalM,
                    jumlah_belum_menguasai: muridArr.length - totalM,
                    kelas_subjek: k.fullKelas + '_' + k.subjek,
                    kelas_subjek_topik: k.fullKelas + '_' + k.subjek + '_' + t.topik,
                    kelas_subjek_topik_subtopik: k.fullKelas + '_' + k.subjek + '_' + t.topik + '_' + t.sub,
                    tahun_rekod: String(new Date().getFullYear()),
                    dijana_auto: true,          // penanda — membolehkan buang semula
                    dijana_kumpulan: kumpulanId,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            await batch.commit();
            siap += kepingan.length;
            showLoading('Menjana... ' + siap + '/' + pilih.length);
        }

        await db.collection('config').doc('system_settings')
            .update({ lastRekodId: lastId });

        hideLoading();
        ipTutup();
        showToast('✅ ' + pilih.length + ' rekod dijana. Semak di tab Keputusan Kelas.', 'success');

    } catch(e) {
        hideLoading();
        console.error(e);
        showToast('Ralat: ' + e.message, 'error');
    }
}

// ── Buang semula rekod yang dijana ───────────────────────────────────────────

async function ipBuangJanaan() {
    const subjek = prompt('Buang rekod yang DIJANA AUTO sahaja.\n\nSubjek (kosongkan = semua):', '');
    if (subjek === null) return;

    showLoading('Mencari rekod dijana...');
    try {
        let q = db.collection('rekod_pbd').where('dijana_auto','==',true);
        if (subjek) q = q.where('subjek','==',subjek);
        const snap = await firestoreRetry(() => q.get());

        if (snap.empty) { hideLoading(); showToast('Tiada rekod dijana dijumpai', 'warning'); return; }

        const senarai = [];
        snap.forEach(d => senarai.push({ id: d.id, ...d.data() }));
        hideLoading();

        const ringkas = {};
        senarai.forEach(r => {
            const key = r.subjek + ' — ' + r.kelas;
            ringkas[key] = (ringkas[key] || 0) + 1;
        });

        if (!confirm(
            'BUANG REKOD DIJANA AUTO\n\n' +
            Object.entries(ringkas).map(([k,v]) => k + ': ' + v).join('\n') +
            '\n\nJumlah: ' + senarai.length + ' rekod\n\n' +
            'Rekod yang guru isi sendiri TIDAK disentuh.\n\nBuang?')) return;

        showLoading('Membuang ' + senarai.length + ' rekod...');
        for (let i = 0; i < senarai.length; i += 100) {
            const batch = db.batch();
            senarai.slice(i, i + 100).forEach(r =>
                batch.delete(db.collection('rekod_pbd').doc(r.id)));
            await batch.commit();
            showLoading('Membuang... ' + Math.min(i + 100, senarai.length) + '/' + senarai.length);
        }

        hideLoading();
        showToast('✅ ' + senarai.length + ' rekod dijana telah dibuang', 'success');

    } catch(e) {
        hideLoading();
        console.error(e);
        showToast('Ralat: ' + e.message, 'error');
    }
}
