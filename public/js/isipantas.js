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
// TULIS SEMULA (rewrite):
// Topik yang SUDAH ada rekod juga boleh dikemas kini TP-nya — tetapi hanya
// jika guru menandanya sendiri dalam pratonton. Default: TIDAK ditanda.
// Kemas kini hanya menyentuh tp + penguasaan + jumlah; tarikh, nama guru,
// aktiviti kelas dan catatan murid dikekalkan.
//
// PRINSIP KESELAMATAN:
//   - Topik sedia ada TIDAK disentuh melainkan guru menandanya
//   - Pratonton memaparkan setiap topik — yang baharu dan yang akan ditimpa
//   - Dialog pengesahan menyatakan bilangan rekod yang akan ditulis semula
//   - Setiap rekod baharu ditanda `dijana_auto` supaya boleh dibuang semula
//   - Tarikh diagih merentasi tempoh, melangkau hujung minggu dan cuti
// ============================================================================

let ipTopikKosong  = [];   // [{topik, main, sub, pilih}]
let ipTopikAda     = [];   // [{docId, topik, main, sub, tarikh, dijanaAuto, pilih}]
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
        const rekodAda = {};   // {kunci: {docId, tarikh, dijanaAuto}} untuk tulis semula
        const tpLepas  = {};   // {noKp: [tp,...]} untuk cadangan
        snapRekod.forEach(d => {
            const r = d.data();
            const bln = parseInt((r.tarikh_string || '').substring(5,7), 10);
            const dalamTempoh = !penilaian
                || (penilaian === 'P1' && bln >= 1 && bln <= 5)
                || (penilaian === 'P2' && bln >= 6 && bln <= 10);
            if (dalamTempoh) {
                const kunci = (r.topik || '') + '|' + (r.sub_topik || '');
                sudahAda.add(kunci);
                /* Satu topik boleh ada beberapa rekod dalam tempoh yang sama
                   (cth dinilai dua kali). Ambil yang TERKINI sahaja untuk
                   ditulis semula — menimpa kesemuanya memadam sejarah. */
                const lama = rekodAda[kunci];
                if (!lama || (r.tarikh_string || '') > lama.tarikh) {
                    rekodAda[kunci] = {
                        docId: d.id,
                        tarikh: r.tarikh_string || '',
                        dijanaAuto: r.dijana_auto === true
                    };
                }
            }
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

        /* Topik yang SUDAH ada rekod — calon tulis semula.
           pilih:false — guru mesti menandanya sendiri. */
        ipTopikAda = topik
            .filter(t => sudahAda.has((t.topik || '') + '|' + (t.topik_pembelajaran || '')))
            .map(t => {
                const r = rekodAda[(t.topik || '') + '|' + (t.topik_pembelajaran || '')] || {};
                return {
                    docId: r.docId || '',
                    topik: t.topik || '',
                    main: t.topik_pembelajaran_main || t.topik_pembelajaran || '',
                    sub: t.topik_pembelajaran || '',
                    tarikh: r.tarikh || '',
                    dijanaAuto: r.dijanaAuto === true,
                    pilih: false
                };
            })
            .filter(t => t.docId);

        if (!ipTopikKosong.length && !ipTopikAda.length) {
            hideLoading();
            showToast('Tiada topik untuk ' + label, 'warning');
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
                      jumlahTopik: topik.length };
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
            <strong>${ipTopikAda.length}</strong> sudah ada rekod (boleh tulis semula) &middot;
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
            TP ini digunakan pada topik yang anda pilih di skrin seterusnya
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
            Buang tanda pada topik yang anda <strong>tidak mahu</strong> disentuh.
            Tarikh diagih automatik dalam tempoh, melangkau hujung minggu dan cuti.
          </div>
        </div>
        <div style="overflow:auto;flex:1;padding:12px 22px;">`;

    if (ipTopikKosong.length) {
        h += `
          <div style="font-size:13px;font-weight:700;color:#0f766e;margin:4px 0 6px;">
            ➕ TOPIK BAHARU — rekod akan dicipta (${ipTopikKosong.length})
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px;">
            <thead><tr style="background:#f1f5f9;">
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
        h += `</tbody></table>`;
    }

    if (ipTopikAda.length) {
        h += `
          <div style="font-size:13px;font-weight:700;color:#b91c1c;margin:4px 0 6px;">
            ♻️ TULIS SEMULA — rekod sedia ada (${ipTopikAda.length})
          </div>
          <div style="background:#fee2e2;border-left:4px solid #dc2626;padding:9px 12px;
               border-radius:6px;font-size:12px;color:#7f1d1d;margin-bottom:8px;">
            Hanya <strong>TP</strong> ditukar. Tarikh, nama guru, aktiviti kelas dan
            catatan murid dikekalkan. <strong>Tiada undo</strong> — TP lama hilang.
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f1f5f9;">
              <th style="padding:8px 4px;text-align:center;width:40px;">
                <input type="checkbox" onchange="ipTandaSemuaAda(this.checked)"></th>
              <th style="padding:8px 4px;text-align:left;width:70px;">KOD</th>
              <th style="padding:8px 4px;text-align:left;">TOPIK / SUBTOPIK</th>
              <th style="padding:8px 4px;text-align:center;width:92px;">TARIKH</th>
              <th style="padding:8px 4px;text-align:center;width:66px;">SUMBER</th>
            </tr></thead><tbody>`;

        ipTopikAda.forEach((t, i) => {
            h += `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:6px 4px;text-align:center;">
                  <input type="checkbox" class="ip-pilih-ada" data-i="${i}" ${t.pilih?'checked':''}
                         onchange="ipTopikAda[${i}].pilih=this.checked;ipKiraPilih()"></td>
                <td style="padding:6px 4px;color:#64748b;font-weight:600;">${t.topik}</td>
                <td style="padding:6px 4px;">${t.sub || t.main}</td>
                <td style="padding:6px 4px;text-align:center;color:#64748b;">${t.tarikh || '—'}</td>
                <td style="padding:6px 4px;text-align:center;font-size:11px;">
                  ${t.dijanaAuto
                    ? '<span style="color:#0f766e;">auto</span>'
                    : '<span style="color:#b91c1c;font-weight:700;">manual</span>'}</td>
              </tr>`;
        });
        h += `</tbody></table>`;
    }

    h += `</div>
        <div style="padding:16px 22px;border-top:2px solid #e2e8f0;display:flex;gap:10px;
             justify-content:flex-end;align-items:center;">
          <span id="ip-kira" style="margin-right:auto;font-size:13px;color:#475569;"></span>
          <button class="form-control" style="width:auto;padding:8px 18px;cursor:pointer;"
                  onclick="ipPaparTP()">← Kembali</button>
          <button class="export-btn" style="padding:8px 20px;background:#0f766e;"
                  onclick="ipSimpan()">✓ Simpan</button>
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

function ipTandaSemuaAda(nilai) {
    ipTopikAda.forEach((t, i) => {
        t.pilih = nilai;
        const c = document.querySelector('.ip-pilih-ada[data-i="' + i + '"]');
        if (c) c.checked = nilai;
    });
    ipKiraPilih();
}

function ipKiraPilih() {
    const baru  = ipTopikKosong.filter(t => t.pilih).length;
    const tulis = ipTopikAda.filter(t => t.pilih).length;
    const el = document.getElementById('ip-kira');
    if (!el) return;

    if (!baru && !tulis) {
        el.innerHTML = '<span style="color:#b45309;">Tiada topik dipilih</span>';
        return;
    }
    const bhg = [];
    if (baru)  bhg.push(`<strong>${baru}</strong> baharu`);
    if (tulis) bhg.push(`<strong style="color:#b91c1c;">${tulis}</strong> tulis semula`);
    el.innerHTML = bhg.join(' + ') +
        ` &middot; ${(baru + tulis) * ipMuridSenarai.length} isian`;
}

// ── Simpan ───────────────────────────────────────────────────────────────────

/* Pagar klik berganda. Menjana 70 rekod mengambil beberapa saat; sebelum ini
   butang "Simpan" kekal hidup sepanjang tempoh itu, jadi guru yang menekan
   dua kali menghasilkan DUA set rekod penuh dengan kumpulanId berbeza.
   Berlaku sebenar: PSV TIGA HIGEN (beza 9 saat) dan PJK SATU PIXEL (7 saat),
   masing-masing menggandakan purata TP murid. Jangan buang pagar ini. */
let ipSedangSimpan = false;

async function ipSimpan() {
    if (ipSedangSimpan) {
        showToast('Sedang menyimpan — sila tunggu', 'warning');
        return;
    }

    const pilih = ipTopikKosong.filter(t => t.pilih);
    const tulis = ipTopikAda.filter(t => t.pilih);
    if (!pilih.length && !tulis.length) {
        showToast('Pilih sekurang-kurangnya satu topik', 'warning'); return;
    }

    const k = ipKonteks;
    const manual = tulis.filter(t => !t.dijanaAuto).length;

    /* Dialog pengesahan ialah satu-satunya pagar sebelum menimpa TP rasmi.
       Jangan longgarkan — tulis semula TIADA undo. */
    let msg = 'SIMPAN REKOD PBD\n\n' +
        k.subjek + ' — ' + k.fullKelas + '\n' + k.label + '\n\n';
    if (pilih.length) msg += '➕ CIPTA BAHARU: ' + pilih.length + ' topik\n';
    if (tulis.length) {
        msg += '♻️ TULIS SEMULA: ' + tulis.length + ' topik\n' +
               '   TP lama akan HILANG — tiada undo.\n';
        if (manual) msg += '   ⚠️ ' + manual + ' daripadanya dimasuk MANUAL, bukan dijana.\n';
    }
    msg += '\n' + ipMuridSenarai.length + ' murid setiap topik\n\nTeruskan?';
    if (!confirm(msg)) return;

    // Pengesahan kedua bagi rekod manual — risiko tertinggi
    if (manual && !confirm(
        'PENGESAHAN KEDUA\n\n' + manual + ' rekod yang anda tanda dimasukkan ' +
        'secara MANUAL oleh guru di skrin Rekod, bukan dijana automatik.\n\n' +
        'TP asal akan ditimpa dan tidak boleh dikembalikan.\n\nSahkan?')) return;

    ipSedangSimpan = true;
    const btnSimpan = document.querySelector('#ip-overlay button[onclick*="ipSimpan"]');
    if (btnSimpan) {
        btnSimpan.disabled = true;
        btnSimpan.style.opacity = '.5';
        btnSimpan.style.cursor = 'not-allowed';
        btnSimpan.textContent = 'Menyimpan…';
    }

    showLoading('Menyimpan...');
    try {
        /* Pagar kedua: semak semula terhadap Firestore sebelum menulis.
           `ipTopikKosong` ialah snapshot ketika "Jana" ditekan — jika rekod
           sudah dicipta sejak itu (klik berganda, tab lain, guru lain), menulis
           lagi menghasilkan duplikat. Semakan ini menangkapnya walaupun pagar
           klik berganda gagal. */
        let pilihSah = pilih;
        if (pilih.length) {
            const semakSnap = await firestoreRetry(() => db.collection('rekod_pbd')
                .where('subjek','==',k.subjek).where('kelas','==',k.fullKelas).get());

            const adaSekarang = new Set();
            semakSnap.forEach(d => {
                const r = d.data();
                const bln = parseInt((r.tarikh_string || '').substring(5,7), 10);
                const dalamTempoh = !k.penilaian
                    || (k.penilaian === 'P1' && bln >= 1 && bln <= 5)
                    || (k.penilaian === 'P2' && bln >= 6 && bln <= 10);
                if (dalamTempoh) adaSekarang.add((r.topik || '') + '|' + (r.sub_topik || ''));
            });

            pilihSah = pilih.filter(t => !adaSekarang.has(t.topik + '|' + t.sub));
            const dilangkau = pilih.length - pilihSah.length;

            if (dilangkau) {
                console.warn('Isi Pantas: ' + dilangkau + ' topik sudah ada rekod — dilangkau');
                if (!pilihSah.length && !tulis.length) {
                    /* Semua topik sudah ada rekod dan guru tidak menanda apa-apa
                       untuk ditulis semula. Modal DIKEKALKAN terbuka — menutupnya
                       menyembunyikan bahagian ♻️ TULIS SEMULA, iaitu tepat apa
                       yang guru perlukan jika niatnya menukar TP. */
                    hideLoading();
                    ipSedangSimpan = false;
                    const btn = document.querySelector('#ip-overlay button[onclick*="ipSimpan"]');
                    if (btn) {
                        btn.disabled = false;
                        btn.style.opacity = '';
                        btn.style.cursor = 'pointer';
                        btn.textContent = '✓ Simpan';
                    }
                    showToast('Semua topik sudah ada rekod. Untuk menukar TP, ' +
                              'tanda di bahagian ♻️ TULIS SEMULA.', 'warning');
                    return;
                }
                showToast(dilangkau + ' topik sudah ada rekod — dilangkau', 'warning');
            }
        }

        // Config + agihan tarikh hanya diperlukan untuk rekod BAHARU
        let lastId = 0;
        let tarikhSenarai = [];
        if (pilihSah.length) {
            const cfg = await firestoreRetry(() =>
                db.collection('config').doc('system_settings').get());
            lastId = (cfg.data().lastRekodId || 0);
            tarikhSenarai = ipAgihTarikh(k.penilaian, pilihSah.length);
        }
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

        // Peta No. KP → TP untuk tulis semula (padanan ikut KP, bukan susunan)
        const tpIkutKp = {};
        ipMuridSenarai.forEach(m => { if (m.noKp) tpIkutKp[m.noKp] = m.tp; });

        // Tulis berkelompok — 500 ialah had satu batch Firestore
        let siap = 0;
        for (let i = 0; i < pilihSah.length; i += 100) {
            const kepingan = pilihSah.slice(i, i + 100);
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
            showLoading('Menjana... ' + siap + '/' + pilihSah.length);
        }

        if (pilihSah.length) {
            await db.collection('config').doc('system_settings')
                .update({ lastRekodId: lastId });
        }

        // ── Tulis semula: TP sahaja, medan lain dikekalkan ───────────────────
        let ditulis = 0;
        for (let i = 0; i < tulis.length; i += 100) {
            const kepingan = tulis.slice(i, i + 100);

            /* Baca setiap rekod dahulu — array `murid` mungkin mengandungi
               catatan guru dan susunan yang berbeza daripada senarai semasa.
               Padan ikut No. KP, kekalkan catatan, tukar TP sahaja. */
            const docs = await Promise.all(kepingan.map(t =>
                firestoreRetry(() => db.collection('rekod_pbd').doc(t.docId).get())));

            const batch = db.batch();
            let dalamBatch = 0;

            docs.forEach((d, j) => {
                if (!d.exists) return;
                const r = d.data();
                const muridLama = r.murid || [];

                const muridBaru = muridLama.map(m => {
                    const tpBaru = tpIkutKp[m.noKp];
                    if (tpBaru === undefined) return m;   // murid tiada dalam senarai — jangan sentuh
                    return Object.assign({}, m, {
                        tp: tpBaru,
                        penguasaan: tpBaru >= 3 ? 'Menguasai' : 'Belum Menguasai'
                    });
                });

                const nM = muridBaru.filter(m => m.penguasaan === 'Menguasai').length;
                batch.update(d.ref, {
                    murid: muridBaru,
                    jumlah_murid: muridBaru.length,
                    jumlah_menguasai: nM,
                    jumlah_belum_menguasai: muridBaru.length - nM,
                    ditulis_semula: true,
                    ditulis_semula_pada: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                dalamBatch += 1;
            });

            if (dalamBatch) await batch.commit();
            ditulis += dalamBatch;
            showLoading('Menulis semula... ' + ditulis + '/' + tulis.length);
        }

        hideLoading();
        ipTutup();
        const lapor = [];
        if (pilihSah.length) lapor.push(pilihSah.length + ' dijana');
        if (ditulis)      lapor.push(ditulis + ' ditulis semula');
        showToast('✅ ' + lapor.join(' · ') + '. Semak di tab Keputusan Kelas.', 'success');

    } catch(e) {
        hideLoading();
        console.error(e);
        showToast('Ralat: ' + e.message, 'error');
    } finally {
        // Sentiasa buka kunci — jika tidak, ralat mengunci butang selamanya
        ipSedangSimpan = false;
    }
}

// ── Buang semula rekod yang dijana ───────────────────────────────────────────

let ipKumpulan = [];   // [{id, n, subjek, kelas, tahun, masa, tarikhAwal, tarikhAkhir}]

/* Rekod dikumpulkan ikut `dijana_kumpulan` (IP<timestamp>) — satu kumpulan
   ialah satu kali tekan "Jana". Guru memilih kumpulan tertentu, bukan menaip
   nama subjek: menaip membenarkan salah eja, dan medan kosong dahulu
   bermakna "padam janaan SEMUA subjek semua kelas" — terlalu mudah tersilap. */
async function ipBuangJanaan() {
    showLoading('Mencari rekod dijana...');
    try {
        const snap = await firestoreRetry(() =>
            db.collection('rekod_pbd').where('dijana_auto','==',true).get());

        if (snap.empty) {
            hideLoading();
            showToast('Tiada rekod dijana dijumpai', 'warning');
            return;
        }

        const kump = {};
        snap.forEach(d => {
            const r = d.data();
            const g = r.dijana_kumpulan || '(lama)';
            if (!kump[g]) {
                kump[g] = { id: g, n: 0, ids: [],
                            subjek: r.subjek || '—', kelas: r.kelas || '—',
                            tahun: r.tahun || '', tarikhAwal: '', tarikhAkhir: '' };
            }
            const k = kump[g];
            k.n += 1;
            k.ids.push(d.id);
            const ts = r.tarikh_string || '';
            if (ts) {
                if (!k.tarikhAwal  || ts < k.tarikhAwal)  k.tarikhAwal  = ts;
                if (!k.tarikhAkhir || ts > k.tarikhAkhir) k.tarikhAkhir = ts;
            }
        });

        // Masa janaan dibaca terus dari ID (IP<millis>) — tiada bacaan tambahan
        ipKumpulan = Object.values(kump).map(k => {
            const ms = parseInt(String(k.id).replace('IP',''), 10);
            k.masa = isNaN(ms) ? '—' : new Date(ms).toLocaleString('ms-MY',
                { day:'2-digit', month:'short', year:'numeric',
                  hour:'2-digit', minute:'2-digit' });
            k.ms = isNaN(ms) ? 0 : ms;
            k.pilih = false;
            return k;
        }).sort((a,b) => b.ms - a.ms);   // terbaharu di atas

        hideLoading();
        ipPaparKumpulan();

    } catch(e) {
        hideLoading();
        console.error(e);
        showToast('Ralat: ' + e.message, 'error');
    }
}

function ipPaparKumpulan() {
    ipTutup();

    /* Kumpulan yang berkongsi subjek+kelas+tahun ialah tanda janaan berganda
       (tersilap tekan dua kali) — ditandakan supaya guru nampak. */
    const kira = {};
    ipKumpulan.forEach(k => {
        const kunci = k.subjek + '|' + k.kelas;
        kira[kunci] = (kira[kunci] || 0) + 1;
    });

    let h = `
    <div id="ip-overlay" style="position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:9999;
         display:flex;align-items:center;justify-content:center;padding:20px;"
         onclick="if(event.target===this)ipTutup()">
      <div style="background:#fff;border-radius:14px;max-width:760px;width:100%;max-height:88vh;
           display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.3);">
        <div style="padding:18px 22px;border-bottom:2px solid #e2e8f0;">
          <h3 style="margin:0;font-size:18px;color:#0f172a;">🗑️ Buang Janaan</h3>
          <div style="margin-top:6px;font-size:13px;color:#475569;">
            Setiap baris ialah satu kali tekan &ldquo;Jana&rdquo;.
            Tanda yang mana anda mahu buang.
          </div>
          <div style="margin-top:10px;background:#fee2e2;border-left:4px solid #dc2626;
               padding:9px 12px;border-radius:6px;font-size:12px;color:#7f1d1d;">
            Padam adalah <strong>kekal</strong> — tiada undo.
            Rekod yang guru isi sendiri tidak pernah disenaraikan di sini.
          </div>
        </div>
        <div style="overflow:auto;flex:1;padding:12px 22px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="position:sticky;top:0;background:#f1f5f9;">
              <th style="padding:8px 4px;text-align:center;width:40px;"></th>
              <th style="padding:8px 4px;text-align:left;">SUBJEK / KELAS</th>
              <th style="padding:8px 4px;text-align:left;width:150px;">MASA JANA</th>
              <th style="padding:8px 4px;text-align:center;width:66px;">REKOD</th>
            </tr></thead><tbody>`;

    ipKumpulan.forEach((k, i) => {
        const berganda = kira[k.subjek + '|' + k.kelas] > 1;
        h += `<tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:7px 4px;text-align:center;">
              <input type="checkbox" class="ip-kump" data-i="${i}"
                     onchange="ipKumpulan[${i}].pilih=this.checked;ipKiraKumpulan()"></td>
            <td style="padding:7px 4px;">
              <div style="font-weight:600;color:#0f172a;">${k.subjek}</div>
              <div style="font-size:12px;color:#64748b;">${k.kelas}
                ${berganda ? '<span style="color:#b45309;font-weight:700;"> &middot; ⚠️ berganda</span>' : ''}
              </div>
            </td>
            <td style="padding:7px 4px;color:#475569;font-size:12px;">${k.masa}</td>
            <td style="padding:7px 4px;text-align:center;font-weight:700;color:#0f172a;">${k.n}</td>
          </tr>`;
    });

    h += `</tbody></table></div>
        <div style="padding:16px 22px;border-top:2px solid #e2e8f0;display:flex;gap:10px;
             justify-content:flex-end;align-items:center;">
          <span id="ip-kira-kump" style="margin-right:auto;font-size:13px;color:#475569;"></span>
          <button class="form-control" style="width:auto;padding:8px 18px;cursor:pointer;"
                  onclick="ipTutup()">Batal</button>
          <button class="export-btn" style="padding:8px 20px;background:#b91c1c;"
                  onclick="ipBuangPilihan()">🗑️ Buang</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', h);
    ipKiraKumpulan();
}

function ipKiraKumpulan() {
    const dipilih = ipKumpulan.filter(k => k.pilih);
    const rekod = dipilih.reduce((a,k) => a + k.n, 0);
    const el = document.getElementById('ip-kira-kump');
    if (!el) return;
    el.innerHTML = dipilih.length
        ? `<strong>${dipilih.length}</strong> janaan &middot; ` +
          `<strong style="color:#b91c1c;">${rekod}</strong> rekod akan dibuang`
        : '<span style="color:#94a3b8;">Tiada janaan ditanda</span>';
}

async function ipBuangPilihan() {
    const dipilih = ipKumpulan.filter(k => k.pilih);
    if (!dipilih.length) { showToast('Tanda sekurang-kurangnya satu janaan', 'warning'); return; }

    const jumlah = dipilih.reduce((a,k) => a + k.n, 0);
    if (!confirm(
        'BUANG REKOD DIJANA\n\n' +
        dipilih.map(k => '• ' + k.subjek + ' — ' + k.kelas +
                         ' (' + k.masa + '): ' + k.n + ' rekod').join('\n') +
        '\n\nJumlah: ' + jumlah + ' rekod\n\n' +
        'Padam adalah KEKAL — tiada undo.\n' +
        'Rekod yang guru isi sendiri TIDAK disentuh.\n\nBuang?')) return;

    showLoading('Membuang ' + jumlah + ' rekod...');
    try {
        const semua = [];
        dipilih.forEach(k => k.ids.forEach(id => semua.push(id)));

        let siap = 0;
        for (let i = 0; i < semua.length; i += 100) {
            const batch = db.batch();
            semua.slice(i, i + 100).forEach(id =>
                batch.delete(db.collection('rekod_pbd').doc(id)));
            await batch.commit();
            siap = Math.min(i + 100, semua.length);
            showLoading('Membuang... ' + siap + '/' + semua.length);
        }

        hideLoading();
        ipTutup();
        showToast('✅ ' + semua.length + ' rekod dibuang', 'success');

    } catch(e) {
        hideLoading();
        console.error(e);
        showToast('Ralat: ' + e.message, 'error');
    }
}
