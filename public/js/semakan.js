// ============================================================================
// SEMAKAN PENTADBIR — Sistem Rekod PBD
// SK Sultan Ismail | hipersispbd
// ============================================================================

let currentSemakData = null;
let currentTab = 'belum';
let allBelumList = [];
let allSudahList = [];
let currentMuridList = [];
let resetTarget = null;
let namaSekolah = 'SK Sultan Ismail';

// ============================================================================
// INIT
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    checkLogin();
    console.log('✅ Semakan Pentadbir loaded');
});

function checkLogin() {
    if (localStorage.getItem('semakLoggedIn') === 'true') {
        showPanel();
    }
}

// ============================================================================
// LOGIN / LOGOUT
// ============================================================================
async function loginSemak() {
    var pw = document.getElementById('semakPassword').value;
    if (!pw) { showToast('Sila masukkan kata laluan', 'warning'); return; }
    showLoading('Menyemak kata laluan...');
    try {
        var doc = await firestoreRetry(function() {
            return db.collection('config').doc('system_settings').get();
        });
        var correctPw = 'semak123';
        if (doc.exists) {
            correctPw = doc.data().semakPassword || 'semak123';
            if (doc.data().namaSekolah) namaSekolah = doc.data().namaSekolah;
        }
        if (pw === correctPw) {
            localStorage.setItem('semakLoggedIn', 'true');
            hideLoading();
            showPanel();
        } else {
            showToast('❌ Kata laluan salah!', 'error');
            document.getElementById('semakPassword').value = '';
            hideLoading();
        }
    } catch(e) {
        showToast('Error: ' + e.message, 'error');
        hideLoading();
    }
}

function showPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainPanel').style.display = 'block';
    initDashboard();
}

function logoutSemak() {
    localStorage.removeItem('semakLoggedIn');
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('mainPanel').style.display = 'none';
    document.getElementById('semakPassword').value = '';
}

function togglePwVisible() {
    var input = document.getElementById('semakPassword');
    var btn   = document.getElementById('btnTogglePw');
    if (input.type === 'password') {
        input.type = 'text';
        input.style.letterSpacing = 'normal';
        btn.textContent = '🙈';
        btn.title = 'Sembunyi kata laluan';
    } else {
        input.type = 'password';
        input.style.letterSpacing = '10px';
        btn.textContent = '👁️';
        btn.title = 'Tunjuk kata laluan';
    }
}

// ============================================================================
// INIT DASHBOARD
// ============================================================================
async function initDashboard() {
    showLoading('Memuatkan dashboard...');
    try {
        // Load config
        var configDoc = await firestoreRetry(function() {
            return db.collection('config').doc('system_settings').get();
        });
        if (configDoc.exists && configDoc.data().namaSekolah) {
            namaSekolah = configDoc.data().namaSekolah;
        }

        // Load available tahun rekod from rekod_pbd
        var snap = await firestoreRetry(function() {
            return db.collection('rekod_pbd').get();
        });
        var tahunSet = new Set();
        snap.forEach(function(doc) {
            var t = doc.data().tahun_rekod;
            if (t) tahunSet.add(t);
        });

        var sel = document.getElementById('filterTahunRekod');
        sel.innerHTML = '';
        var currentYear = new Date().getFullYear().toString();
        var tahunList = Array.from(tahunSet).sort().reverse();
        if (tahunList.length === 0) tahunList.push(currentYear);

        tahunList.forEach(function(t) {
            var opt = new Option(t, t);
            if (t === currentYear) opt.selected = true;
            sel.add(opt);
        });

        // Auto-set penilaian based on current month
        var month = new Date().getMonth() + 1;
        document.getElementById('filterPenilaian').value = month <= 5 ? 'P1' : 'P2';

        hideLoading();
        await loadDashboard();
    } catch(e) {
        console.error(e);
        showToast('Error: ' + e.message, 'error');
        hideLoading();
    }
}

// ============================================================================
// LOAD DASHBOARD
// ============================================================================
async function loadDashboard() {
    var tahunRekod  = document.getElementById('filterTahunRekod').value;
    var penilaian   = document.getElementById('filterPenilaian').value;
    if (!tahunRekod) return;

    document.getElementById('loadingText').style.display = 'inline';

    try {
        var startDate = penilaian === 'P1' ? tahunRekod + '-01-01' : tahunRekod + '-06-01';
        var endDate   = penilaian === 'P1' ? tahunRekod + '-05-31' : tahunRekod + '-10-31';

        // Step 1: All rekod_pbd for this tahun_rekod
        var rekodSnap = await firestoreRetry(function() {
            return db.collection('rekod_pbd')
                .where('tahun_rekod', '==', tahunRekod)
                .get();
        });

        // Step 2: Group by kelas||subjek within date range
        var comboMap = {};
        rekodSnap.forEach(function(doc) {
            var d = doc.data();
            if (!d.tarikh_string) return;
            if (d.tarikh_string < startDate || d.tarikh_string > endDate) return;
            var key = d.kelas + '||' + d.subjek;
            if (!comboMap[key]) {
                comboMap[key] = {
                    kelas: d.kelas,
                    subjek: d.subjek,
                    tahun: d.tahun,
                    jumlahRekod: 0,
                    muridSet: new Set()
                };
            }
            comboMap[key].jumlahRekod++;
            (d.murid || []).forEach(function(m) { comboMap[key].muridSet.add(m.noKp); });
        });

        // Step 3: All semakan for this tahun_rekod + penilaian
        var semakSnap = await firestoreRetry(function() {
            return db.collection('semakan_penilaian')
                .where('tahun_rekod', '==', tahunRekod)
                .where('penilaian', '==', penilaian)
                .get();
        });

        var semakMap = {};
        semakSnap.forEach(function(doc) {
            var d = doc.data();
            semakMap[d.kelas + '||' + d.subjek] = { id: doc.id, ...d };
        });

        // Step 4: Build belum/sudah lists
        allBelumList = [];
        allSudahList = [];

        Object.keys(comboMap).forEach(function(key) {
            var combo = comboMap[key];
            var semak = semakMap[key];
            var item = {
                kelas:         combo.kelas,
                subjek:        combo.subjek,
                tahun:         combo.tahun,
                penilaian:     penilaian,
                tahunRekod:    tahunRekod,
                jumlahRekod:   combo.jumlahRekod,
                jumlahMurid:   combo.muridSet.size,
                semakId:       semak ? semak.id : null,
                status:        semak ? semak.status_semak : 'BELUM_DISEMAK',
                disemak_oleh:  semak ? semak.disemak_oleh : null,
                tarikh_semak:  semak ? semak.tarikh_semak : null,
                catatan_semak: semak ? semak.catatan_semak : null
            };

            if (!semak || semak.status_semak !== 'DISEMAK') {
                allBelumList.push(item);
            } else {
                allSudahList.push(item);
            }
        });

        // Sort A-Z by kelas then subjek
        var sortFn = function(a, b) {
            return a.kelas.localeCompare(b.kelas) || a.subjek.localeCompare(b.subjek);
        };
        allBelumList.sort(sortFn);
        allSudahList.sort(sortFn);

        populateCardFilters();
        applyCardFilter();
        document.getElementById('loadingText').style.display = 'none';

    } catch(e) {
        console.error(e);
        showToast('Error: ' + e.message, 'error');
        document.getElementById('loadingText').style.display = 'none';
    }
}

// ============================================================================
// CARD FILTERS — SUBJEK & DARJAH
// ============================================================================
function populateCardFilters() {
    var allItems = allBelumList.concat(allSudahList);

    // Collect unique subjek and darjah
    var subjekSet  = new Set();
    var darjahSet  = new Set();
    var darjahOrder = ['SATU','DUA','TIGA','EMPAT','LIMA','ENAM'];

    allItems.forEach(function(item) {
        if (item.subjek) subjekSet.add(item.subjek);
        if (item.tahun)  darjahSet.add(item.tahun);
    });

    var selSubjek = document.getElementById('filterKadSubjek');
    var selDarjah = document.getElementById('filterKadDarjah');
    if (!selSubjek || !selDarjah) return;

    // Reset
    selSubjek.innerHTML = '<option value="">Semua Subjek</option>';
    selDarjah.innerHTML = '<option value="">Semua Darjah</option>';

    Array.from(subjekSet).sort().forEach(function(s) {
        selSubjek.add(new Option(s, s));
    });

    darjahOrder.filter(function(d) { return darjahSet.has(d); }).forEach(function(d) {
        selDarjah.add(new Option(d, d));
    });

    // Show filter bar only if there's data
    var bar = document.getElementById('cardFilterBar');
    if (bar) bar.style.display = allItems.length > 0 ? 'block' : 'none';
}

function applyCardFilter() {
    var subjekFilter = (document.getElementById('filterKadSubjek') || {}).value || '';
    var darjahFilter = (document.getElementById('filterKadDarjah') || {}).value || '';

    var filteredBelum = allBelumList.filter(function(item) {
        if (subjekFilter && item.subjek !== subjekFilter) return false;
        if (darjahFilter && item.tahun  !== darjahFilter) return false;
        return true;
    });
    var filteredSudah = allSudahList.filter(function(item) {
        if (subjekFilter && item.subjek !== subjekFilter) return false;
        if (darjahFilter && item.tahun  !== darjahFilter) return false;
        return true;
    });

    document.getElementById('countBelum').textContent = filteredBelum.length;
    document.getElementById('countSudah').textContent = filteredSudah.length;

    renderBelumList(filteredBelum);
    renderSudahList(filteredSudah);
}

// ============================================================================
// TABS
// ============================================================================
function showTab(tab) {
    currentTab = tab;
    document.getElementById('tabBelum').style.display = tab === 'belum' ? 'block' : 'none';
    document.getElementById('tabSudah').style.display = tab === 'sudah' ? 'block' : 'none';
    document.getElementById('cardBelum').className = 'summary-semak belum' + (tab === 'belum' ? ' active' : '');
    document.getElementById('cardSudah').className = 'summary-semak sudah' + (tab === 'sudah' ? ' active' : '');
    // no re-render needed — applyCardFilter already rendered both lists
}

// ============================================================================
// RENDER BELUM DISEMAK
// ============================================================================
function renderBelumList(list) {
    var container = document.getElementById('listBelum');
    if (list === undefined) list = allBelumList;
    if (list.length === 0) {
        container.innerHTML =
            '<div class="empty-state">' +
            '<div class="icon">🎉</div>' +
            '<p style="font-size:18px;color:#16a34a;font-weight:700;">Semua rekod telah disemak!</p>' +
            '<p>Tiada rekod yang perlu disemak untuk tempoh ini.</p>' +
            '</div>';
        return;
    }

    var html = '';
    list.forEach(function(item, idx) {
        var realIdx = allBelumList.indexOf(item);
        var pText = item.penilaian === 'P1' ? 'Penilaian 1 (Jan - Mei)' : 'Penilaian 2 (Jun - Okt)';
        html +=
            '<div class="semak-card belum">' +
            '<div class="semak-card-info">' +
            '<h3>📚 ' + item.subjek + '</h3>' +
            '<p>🏫 <strong>' + item.kelas + '</strong></p>' +
            '<p>📅 ' + pText + ' ' + item.tahunRekod + '</p>' +
            '<p>📝 ' + item.jumlahRekod + ' sesi penilaian &nbsp;•&nbsp; 👥 ' + item.jumlahMurid + ' murid</p>' +
            '</div>' +
            '<div class="semak-card-actions">' +
            '<button class="btn-card btn-card-green" onclick="openSemakModal(' + realIdx + ',\'belum\')">' +
            '✅ SEMAK SEKARANG' +
            '</button>' +
            '</div>' +
            '</div>';
    });
    container.innerHTML = html;
}

// ============================================================================
// RENDER SUDAH DISEMAK
// ============================================================================
function renderSudahList(list) {
    var container = document.getElementById('listSudah');
    if (list === undefined) list = allSudahList;
    if (list.length === 0) {
        container.innerHTML =
            '<div class="empty-state"><div class="icon">📋</div><p>Tiada rekod yang telah disemak lagi.</p></div>';
        return;
    }

    var html = '';
    list.forEach(function(item) {
        var realIdx = allSudahList.indexOf(item);
        var pText = item.penilaian === 'P1' ? 'Penilaian 1 (Jan - Mei)' : 'Penilaian 2 (Jun - Okt)';
        var tarikhSemak = item.tarikh_semak ? formatDate(item.tarikh_semak) : '-';
        html +=
            '<div class="semak-card sudah">' +
            '<div class="semak-card-info">' +
            '<h3>📚 ' + item.subjek + '</h3>' +
            '<p>🏫 <strong>' + item.kelas + '</strong></p>' +
            '<p>📅 ' + pText + ' ' + item.tahunRekod + '</p>' +
            '<p>📝 ' + item.jumlahRekod + ' sesi &nbsp;•&nbsp; 👥 ' + item.jumlahMurid + ' murid</p>' +
            '<div class="disemak-badge">✅ Disemak oleh: <strong>' + (item.disemak_oleh || '-') + '</strong>' +
            ' &nbsp;|&nbsp; 📆 ' + tarikhSemak +
            (item.catatan_semak ? '<br>💬 ' + item.catatan_semak : '') +
            '</div>' +
            '</div>' +
            '<div class="semak-card-actions">' +
            '<button class="btn-card btn-card-blue" onclick="openSemakModal(' + realIdx + ',\'sudah\')">' +
            '👁️ Lihat Semula' +
            '</button>' +
            '<button class="btn-card btn-card-orange" onclick="openResetModal(' + realIdx + ')">' +
            '🔓 Buka Semula' +
            '</button>' +
            '</div>' +
            '</div>';
    });
    container.innerHTML = html;
}

// ============================================================================
// MODAL SEMAK — OPEN
// ============================================================================
async function openSemakModal(idx, listType) {
    var item = listType === 'belum' ? allBelumList[idx] : allSudahList[idx];
    currentSemakData = Object.assign({}, item, { listType: listType, idx: idx });

    // Title
    document.getElementById('modalSemakTitle').textContent = '📋 ' + item.subjek + ' — ' + item.kelas;

    // Info header
    var pText = item.penilaian === 'P1' ? 'Penilaian 1 (Januari - Mei)' : 'Penilaian 2 (Jun - Oktober)';
    document.getElementById('semakInfoHeader').innerHTML =
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:14px;">' +
        '<div>📚 <strong>Subjek:</strong> ' + item.subjek + '</div>' +
        '<div>🏫 <strong>Kelas:</strong> ' + item.kelas + '</div>' +
        '<div>📅 <strong>Tempoh:</strong> ' + pText + '</div>' +
        '<div>📝 <strong>Sesi:</strong> ' + item.jumlahRekod + ' rekod &nbsp;•&nbsp; ' + item.jumlahMurid + ' murid</div>' +
        '</div>';

    // Reset murid area
    document.getElementById('muridSemakList').innerHTML =
        '<div style="text-align:center;padding:25px;color:#999;">⏳ Mengira purata pencapaian murid...</div>';
    document.getElementById('kelasAvgBox').style.display = 'none';
    document.getElementById('topikBreakdownBox').style.display = 'none';
    document.getElementById('topikBreakdownBox').innerHTML = '';

    // Show/hide sections
    var isBelum = (listType === 'belum');
    document.getElementById('semakForm').style.display    = isBelum ? 'block' : 'none';
    document.getElementById('disemakInfo').style.display  = isBelum ? 'none' : 'block';

    if (!isBelum) {
        document.getElementById('infoDisemakOleh').textContent = item.disemak_oleh || '-';
        document.getElementById('infoTarikhSemak').textContent = item.tarikh_semak ? formatDate(item.tarikh_semak) : '-';
        document.getElementById('infoCatatanSemak').textContent = item.catatan_semak || '(tiada catatan)';
    } else {
        document.getElementById('inputDisemakOleh').value = '';
        document.getElementById('inputCatatanSemak').value = '';
    }

    // Footer buttons
    var footer = document.getElementById('modalSemakFooter');
    if (isBelum) {
        footer.innerHTML =
            '<button class="btn btn-success" onclick="simpanSemakan()" style="font-size:15px;padding:12px 28px;">' +
            '✅ YA, SUDAH DISEMAK' +
            '</button>' +
            '<button class="btn btn-danger" onclick="closeSemakModal()">❌ Tutup</button>';
    } else {
        footer.innerHTML =
            '<button class="btn btn-info" onclick="exportPDFSemakan()">📄 Cetak PDF</button>' +
            '<button class="btn btn-danger" onclick="closeSemakModal()">❌ Tutup</button>';
    }

    // Open modal
    document.getElementById('modalSemak').classList.add('open');

    // Load murid data async
    await loadMuridData(item);
}

// ============================================================================
// LOAD MURID DATA & CALCULATE AVG TP
// ============================================================================
async function loadMuridData(item) {
    try {
        var startDate = item.penilaian === 'P1' ? item.tahunRekod + '-01-01' : item.tahunRekod + '-06-01';
        var endDate   = item.penilaian === 'P1' ? item.tahunRekod + '-05-31' : item.tahunRekod + '-10-31';

        // Fetch all rekod for kelas+subjek+tahunRekod
        var snap = await firestoreRetry(function() {
            return db.collection('rekod_pbd')
                .where('kelas',       '==', item.kelas)
                .where('subjek',      '==', item.subjek)
                .where('tahun_rekod', '==', item.tahunRekod)
                .get();
        });

        // Build murid map + topik map (filter by date range)
        var muridMap = {};
        var topikMap = {}; // key = topik_pembelajaran_main
        snap.forEach(function(doc) {
            var d = doc.data();
            if (!d.tarikh_string || d.tarikh_string < startDate || d.tarikh_string > endDate) return;

            // — Topik grouping —
            var topikKey = d.topik_pembelajaran_main || d.topik || '(Tiada Topik)';
            if (!topikMap[topikKey]) {
                topikMap[topikKey] = { topik: topikKey, kod: d.topik || '', tps: [], bilSesi: 0 };
            }
            topikMap[topikKey].bilSesi++;
            (d.murid || []).forEach(function(m) {
                if (m.tp) topikMap[topikKey].tps.push(m.tp);
            });

            // — Murid grouping —
            (d.murid || []).forEach(function(m) {
                if (!muridMap[m.noKp]) {
                    muridMap[m.noKp] = { noKp: m.noKp, namaMurid: m.namaMurid, tps: [], penguasaans: [] };
                }
                muridMap[m.noKp].tps.push(m.tp);
                muridMap[m.noKp].penguasaans.push(m.penguasaan || 'Menguasai');
            });
        });

        // Build topik list with avgTP, sorted by avgTP ascending (lemah dahulu)
        var topikList = Object.values(topikMap).map(function(t) {
            var avg = t.tps.length > 0
                ? parseFloat((t.tps.reduce(function(a,b){return a+b;},0) / t.tps.length).toFixed(2))
                : 0;
            return { topik: t.topik, kod: t.kod, avgTP: avg, bilSesi: t.bilSesi, bilEntri: t.tps.length };
        });
        topikList.sort(function(a,b){ return a.avgTP - b.avgTP; });
        renderTopikBreakdown(topikList);

        // Calculate avg TP per murid
        currentMuridList = Object.values(muridMap).map(function(m) {
            var total = m.tps.reduce(function(a, b) { return a + b; }, 0);
            var avgTP = parseFloat((total / m.tps.length).toFixed(2));
            var menguasaiCount = m.penguasaans.filter(function(p) { return p === 'Menguasai'; }).length;
            return {
                noKp:       m.noKp,
                namaMurid:  m.namaMurid,
                bilRekod:   m.tps.length,
                avgTP:      avgTP,
                penguasaan: menguasaiCount >= Math.ceil(m.penguasaans.length / 2) ? 'Menguasai' : 'Belum Menguasai'
            };
        });

        sortAndDisplayMurid();

        // Kelas average
        if (currentMuridList.length > 0) {
            var totalAvg = currentMuridList.reduce(function(a, b) { return a + b.avgTP; }, 0);
            var kelasAvg = (totalAvg / currentMuridList.length).toFixed(2);
            document.getElementById('kelasAvgValue').textContent = kelasAvg;
            document.getElementById('kelasAvgLabel').textContent = getTPLabel(parseFloat(kelasAvg));
            document.getElementById('kelasAvgBox').style.display = 'block';
        }

    } catch(e) {
        console.error(e);
        document.getElementById('muridSemakList').innerHTML =
            '<div style="color:var(--danger);padding:15px;">Ralat: ' + e.message + '</div>';
    }
}

// ============================================================================
// SORT & DISPLAY MURID
// ============================================================================
function sortAndDisplayMurid() {
    if (!currentMuridList || currentMuridList.length === 0) return;

    var sortBy = document.getElementById('sortMurid').value;
    var sorted = currentMuridList.slice();

    if      (sortBy === 'nama')      sorted.sort(function(a,b){ return a.namaMurid.localeCompare(b.namaMurid); });
    else if (sortBy === 'nama_desc') sorted.sort(function(a,b){ return b.namaMurid.localeCompare(a.namaMurid); });
    else if (sortBy === 'tp_desc')   sorted.sort(function(a,b){ return b.avgTP - a.avgTP; });
    else if (sortBy === 'tp_asc')    sorted.sort(function(a,b){ return a.avgTP - b.avgTP; });
    else if (sortBy === 'rekod_desc')sorted.sort(function(a,b){ return b.bilRekod - a.bilRekod; });

    var html = sorted.map(function(m, i) {
        var tpRound = Math.min(6, Math.max(1, Math.round(m.avgTP)));
        var tpClass = 'tp-badge tp-' + tpRound;
        var pgClass = m.penguasaan === 'Menguasai' ? 'pg-badge pg-m' : 'pg-badge pg-b';
        var pgIcon  = m.penguasaan === 'Menguasai' ? '✅' : '❌';
        var stars   = getStars(m.avgTP);
        return '<div class="murid-row">' +
            '<div class="murid-bil">' + (i + 1) + '</div>' +
            '<div class="murid-nama">' + m.namaMurid + '</div>' +
            '<div class="murid-rekod">' + m.bilRekod + 'x</div>' +
            '<div class="tp-stars">' + stars + '</div>' +
            '<div class="' + tpClass + '">' + m.avgTP.toFixed(1) + '</div>' +
            '<div class="' + pgClass + '">' + pgIcon + '</div>' +
            '</div>';
    }).join('');

    document.getElementById('muridSemakList').innerHTML = html;
}

function getStars(avg) {
    var filled = Math.round(avg);
    var s = '';
    for (var i = 1; i <= 6; i++) s += i <= filled ? '★' : '☆';
    return s;
}

function getTPLabel(avg) {
    if (avg >= 5) return '🟢 Cemerlang';
    if (avg >= 4) return '🟡 Baik';
    if (avg >= 3) return '🟠 Perlu Perhatian';
    return '🔴 Kritikal';
}

function getTopikBadge(avg) {
    if (avg >= 5) return { bg:'#dcfce7', color:'#15803d', icon:'🟢', label:'Cemerlang' };
    if (avg >= 4) return { bg:'#fef9c3', color:'#854d0e', icon:'🟡', label:'Baik' };
    if (avg >= 3) return { bg:'#ffedd5', color:'#9a3412', icon:'🟠', label:'Sederhana' };
    return          { bg:'#fee2e2', color:'#991b1b', icon:'🔴', label:'Kritikal' };
}

function renderTopikBreakdown(topikList) {
    var box = document.getElementById('topikBreakdownBox');
    if (!box) return;
    if (!topikList || topikList.length === 0) { box.style.display = 'none'; return; }

    var rows = topikList.map(function(t, i) {
        var badge = getTopikBadge(t.avgTP);
        var bar   = Math.round((t.avgTP / 6) * 100);
        return '<tr style="border-bottom:1px solid #f0f0f0;">' +
            '<td style="padding:9px 8px;text-align:center;font-weight:700;color:#667eea;font-size:13px;white-space:nowrap;">' +
                (t.kod || (i+1)) +
            '</td>' +
            '<td style="padding:9px 8px;font-size:13px;">' +
                '<div style="font-weight:600;">' + t.topik + '</div>' +
                '<div style="margin-top:5px;background:#e5e7eb;border-radius:4px;height:6px;overflow:hidden;">' +
                    '<div style="background:' + badge.color + ';width:' + bar + '%;height:100%;border-radius:4px;transition:width 0.4s;"></div>' +
                '</div>' +
            '</td>' +
            '<td style="padding:9px 8px;text-align:center;font-size:12px;color:#666;">' +
                t.bilSesi + ' sesi' +
            '</td>' +
            '<td style="padding:9px 8px;text-align:center;">' +
                '<span style="background:' + badge.bg + ';color:' + badge.color + ';padding:4px 10px;border-radius:20px;font-size:13px;font-weight:700;">' +
                    'TP ' + t.avgTP.toFixed(1) +
                '</span>' +
            '</td>' +
            '<td style="padding:9px 8px;text-align:center;font-size:13px;">' +
                badge.icon + ' ' + badge.label +
            '</td>' +
        '</tr>';
    }).join('');

    box.innerHTML =
        '<div style="border:2px solid #e0e7ff;border-radius:12px;overflow:hidden;">' +
            '<div style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:11px 16px;font-weight:700;font-size:14px;">' +
                '📊 ANALISIS MENGIKUT TOPIK' +
                '<span style="float:right;font-size:12px;opacity:0.8;font-weight:400;">' + topikList.length + ' topik &nbsp;•&nbsp; susun: lemah → kuat</span>' +
            '</div>' +
            '<table style="width:100%;border-collapse:collapse;background:white;">' +
                '<thead>' +
                    '<tr style="background:#f8f9ff;font-size:11px;color:#888;font-weight:700;letter-spacing:0.5px;">' +
                        '<th style="padding:8px;text-align:center;width:50px;">KOD</th>' +
                        '<th style="padding:8px;text-align:left;">TOPIK PEMBELAJARAN</th>' +
                        '<th style="padding:8px;text-align:center;width:70px;">SESI</th>' +
                        '<th style="padding:8px;text-align:center;width:80px;">AVG TP</th>' +
                        '<th style="padding:8px;text-align:center;width:110px;">STATUS</th>' +
                    '</tr>' +
                '</thead>' +
                '<tbody>' + rows + '</tbody>' +
            '</table>' +
        '</div>';
    box.style.display = 'block';
}

// ============================================================================
// CLOSE SEMAK MODAL
// ============================================================================
function closeSemakModal() {
    document.getElementById('modalSemak').classList.remove('open');
    currentSemakData = null;
    currentMuridList = [];
}

// ============================================================================
// SIMPAN SEMAKAN
// ============================================================================
async function simpanSemakan() {
    if (!currentSemakData) return;

    var disemakOleh = document.getElementById('inputDisemakOleh').value.trim().toUpperCase();
    var catatan     = document.getElementById('inputCatatanSemak').value.trim();

    if (!disemakOleh) {
        showToast('⚠️ Sila masukkan nama pentadbir', 'warning');
        document.getElementById('inputDisemakOleh').focus();
        return;
    }

    showLoading('Menyimpan semakan...');

    try {
        var item = currentSemakData;

        // Build murid rumusan — sorted by nama
        var muridRumusan = currentMuridList.slice()
            .sort(function(a,b){ return a.namaMurid.localeCompare(b.namaMurid); })
            .map(function(m, i) {
                return {
                    bil:        i + 1,
                    noKp:       m.noKp,
                    namaMurid:  m.namaMurid,
                    bilRekod:   m.bilRekod,
                    avgTP:      m.avgTP,
                    penguasaan: m.penguasaan
                };
            });

        var totalAvg = currentMuridList.reduce(function(a, b) { return a + b.avgTP; }, 0);
        var kelasAvg = currentMuridList.length > 0
            ? parseFloat((totalAvg / currentMuridList.length).toFixed(2))
            : 0;

        var semakData = {
            tahun_rekod:    item.tahunRekod,
            kelas:          item.kelas,
            tahun:          item.tahun,
            subjek:         item.subjek,
            penilaian:      item.penilaian,
            status_semak:   'DISEMAK',
            disemak_oleh:   disemakOleh,
            tarikh_semak:   getTimestamp(),
            catatan_semak:  catatan,
            jumlah_murid:   currentMuridList.length,
            avg_tp_kelas:   kelasAvg,
            murid_rumusan:  muridRumusan,
            tarikh_jana:    getTimestamp(),
            updatedAt:      getTimestamp()
        };

        if (item.semakId) {
            await db.collection('semakan_penilaian').doc(item.semakId).update(semakData);
        } else {
            semakData.createdAt = getTimestamp();
            await db.collection('semakan_penilaian').add(semakData);
        }

        hideLoading();
        closeSemakModal();
        showToast('✅ Rekod berjaya disemak! Terima kasih.', 'success');
        await loadDashboard();

    } catch(e) {
        console.error(e);
        showToast('Error: ' + e.message, 'error');
        hideLoading();
    }
}

// ============================================================================
// RESET SEMAKAN
// ============================================================================
function openResetModal(idx) {
    var item = allSudahList[idx];
    resetTarget = Object.assign({}, item, { idx: idx });

    document.getElementById('resetInfoBox').innerHTML =
        '📚 <strong>Subjek:</strong> ' + item.subjek + '<br>' +
        '🏫 <strong>Kelas:</strong> ' + item.kelas + '<br>' +
        '✅ <strong>Disemak oleh:</strong> ' + (item.disemak_oleh || '-');

    openModal('modalConfirmReset');
}

async function confirmReset() {
    if (!resetTarget) return;
    showLoading('Membuka semula semakan...');
    closeModal('modalConfirmReset');

    try {
        if (resetTarget.semakId) {
            await db.collection('semakan_penilaian').doc(resetTarget.semakId).update({
                status_semak:  'BELUM_DISEMAK',
                disemak_oleh:  null,
                tarikh_semak:  null,
                catatan_semak: '',
                updatedAt:     getTimestamp()
            });
        }
        resetTarget = null;
        hideLoading();
        showToast('🔓 Semakan telah dibuka semula. Guru boleh edit rekod.', 'success');
        await loadDashboard();
    } catch(e) {
        console.error(e);
        showToast('Error: ' + e.message, 'error');
        hideLoading();
    }
}

// ============================================================================
// PDF EXPORT — html2pdf (sokong tulisan Arab)
// ============================================================================
async function exportPDFSemakan() {
    if (!currentSemakData || !currentMuridList || currentMuridList.length === 0) {
        showToast('Tiada data untuk dijana PDF', 'warning');
        return;
    }
    showLoading('Menjana PDF...');

    try {
        var item = currentSemakData;
        var pText = item.penilaian === 'P1' ? 'Penilaian 1 — Januari hingga Mei' : 'Penilaian 2 — Jun hingga Oktober';

        // Fill template
        document.getElementById('pdfNamaSekolah').textContent = namaSekolah;
        document.getElementById('pdfSubtitle').textContent =
            item.subjek + ' | ' + item.kelas + ' | ' + pText + ' ' + item.tahunRekod;

        document.getElementById('pdfInfoGrid').innerHTML =
            '<div style="padding:6px;background:#f8f9fa;border-radius:4px;">' +
            '<strong style="color:#667eea;">Subjek:</strong> ' + item.subjek + '</div>' +
            '<div style="padding:6px;background:#f8f9fa;border-radius:4px;">' +
            '<strong style="color:#667eea;">Kelas:</strong> ' + item.kelas + '</div>' +
            '<div style="padding:6px;background:#f8f9fa;border-radius:4px;">' +
            '<strong style="color:#667eea;">Tempoh:</strong> ' + pText + '</div>' +
            '<div style="padding:6px;background:#f8f9fa;border-radius:4px;">' +
            '<strong style="color:#667eea;">Jumlah Murid:</strong> ' + currentMuridList.length + ' orang</div>';

        // Sort by name for PDF
        var sorted = currentMuridList.slice().sort(function(a,b){ return a.namaMurid.localeCompare(b.namaMurid); });
        var totalAvg = sorted.reduce(function(a, b) { return a + b.avgTP; }, 0);
        var kelasAvg = sorted.length > 0 ? (totalAvg / sorted.length).toFixed(2) : '-';

        document.getElementById('pdfMuridTbody').innerHTML = sorted.map(function(m, i) {
            var tpColor =
                m.avgTP >= 5 ? '#dcfce7' :
                m.avgTP >= 4 ? '#fef9c3' :
                m.avgTP >= 3 ? '#ffedd5' : '#fee2e2';
            var tpText =
                m.avgTP >= 5 ? '#15803d' :
                m.avgTP >= 4 ? '#854d0e' :
                m.avgTP >= 3 ? '#9a3412' : '#991b1b';
            var pgText = m.penguasaan === 'Menguasai' ? '✅ Menguasai' : '❌ Belum Menguasai';
            return '<tr style="border-bottom:1px solid #eee;">' +
                '<td style="padding:7px;border:1px solid #ddd;text-align:center;">' + (i + 1) + '</td>' +
                '<td style="padding:7px;border:1px solid #ddd;">' + m.namaMurid + '</td>' +
                '<td style="padding:7px;border:1px solid #ddd;text-align:center;">' + m.bilRekod + '</td>' +
                '<td style="padding:7px;border:1px solid #ddd;text-align:center;font-weight:700;' +
                'background:' + tpColor + ';color:' + tpText + ';">' +
                m.avgTP.toFixed(2) + '</td>' +
                '<td style="padding:7px;border:1px solid #ddd;text-align:center;">' + pgText + '</td>' +
                '</tr>';
        }).join('');

        var tarikhSemak = item.tarikh_semak ? formatDate(item.tarikh_semak) : '-';
        document.getElementById('pdfFooterBox').innerHTML =
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;font-size:11px;margin-bottom:15px;">' +
            '<div style="background:#f0fdf4;padding:12px;border-radius:6px;border:1px solid #86efac;">' +
            '<strong style="color:#15803d;">✅ STATUS SEMAKAN</strong><br>' +
            'Disemak oleh: ' + (item.disemak_oleh || '-') + '<br>' +
            'Tarikh: ' + tarikhSemak + '<br>' +
            'Catatan: ' + (item.catatan_semak || '-') +
            '</div>' +
            '<div style="background:#f1f5f9;padding:12px;border-radius:6px;text-align:center;">' +
            '<strong style="color:#667eea;">📊 PURATA KELAS</strong><br>' +
            '<span style="font-size:26px;font-weight:800;color:#667eea;">' + kelasAvg + '</span><br>' +
            getTPLabel(parseFloat(kelasAvg)) +
            '</div>' +
            '</div>' +
            '<div style="text-align:center;color:#999;font-size:9px;border-top:1px solid #eee;padding-top:10px;">' +
            namaSekolah + ' — Sistem Rekod PBD © 2026 | ' +
            'Dicetak: ' + new Date().toLocaleDateString('ms-MY') +
            '</div>';

        var template = document.getElementById('pdfSemakTemplate');
        template.classList.add('active');

        var filename = 'Semakan_' + item.penilaian + '_' +
            item.kelas.replace(/\s+/g, '_') + '_' +
            item.subjek.replace(/\s+/g, '_') + '_' +
            item.tahunRekod + '.pdf';

        await html2pdf().set({
            margin:     [10, 10, 10, 10],
            filename:   filename,
            image:      { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true },
            jsPDF:      { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(template).save();

        template.classList.remove('active');
        hideLoading();
        showToast('✅ PDF berjaya dijana!', 'success');

    } catch(e) {
        console.error(e);
        showToast('Error: ' + e.message, 'error');
        hideLoading();
    }
}

// ============================================================================
// MODAL HELPERS
// ============================================================================
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) e.target.classList.remove('open');
});

// ============================================================================
// UTILITY (local fallback — jika firebase-config.js tidak load dulu)
// ============================================================================
function showLoading(msg) {
    var el = document.getElementById('loader');
    if (el) { el.style.display = 'flex'; var m = el.querySelector('.loader-message'); if (m) m.textContent = msg || 'Loading...'; }
}
function hideLoading() {
    var el = document.getElementById('loader');
    if (el) el.style.display = 'none';
}
function showToast(msg, type) {
    var c = document.getElementById('toast-container');
    if (!c) { alert(msg); return; }
    var t = document.createElement('div');
    t.className = 'toast toast-' + (type || 'info');
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(function() { t.classList.add('show'); }, 10);
    setTimeout(function() { t.classList.remove('show'); setTimeout(function() { t.remove(); }, 300); }, 3500);
}
