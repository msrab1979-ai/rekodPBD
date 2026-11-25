// Jana public/js/dashboard-data.js untuk Dashboard Pelaporan PBD.
//
//   node dashboard/jana-data.mjs [tahun_rekod]      (lalai: 2026)
//
// BACA SAHAJA dari Firestore (REST, ~2 minit untuk ~16,000 rekod).
// Output AGREGAT SAHAJA — tiada nama murid, No. KP atau nama guru ditulis.
// Selepas jana: firebase deploy --only hosting
import fs from 'fs';

const TAHUN_REKOD = process.argv[2] || '2026';
const KEY = 'AIzaSyDOGhlWApQwmgAySm85CSlN_NJTx75MSr4';   // kunci web awam, sama seperti firebase-config.js
const BASE = 'https://firestore.googleapis.com/v1/projects/hipersispbd/databases/(default)/documents';
const OUT = new URL('../public/js/dashboard-data.js', import.meta.url);

const plain = v => { if (!v) return v; const k = Object.keys(v)[0], x = v[k];
  if (k === 'mapValue') return Object.fromEntries(Object.entries(x.fields || {}).map(([a, b]) => [a, plain(b)]));
  if (k === 'arrayValue') return (x.values || []).map(plain);
  if (k === 'integerValue' || k === 'doubleValue') return +x;
  return x; };
const fields = d => Object.fromEntries(Object.entries(d.fields || {}).map(([a, b]) => [a, plain(b)]));

async function* senarai(col) {
  let tok = '';
  do { const r = await (await fetch(`${BASE}/${col}?pageSize=300&key=${KEY}${tok ? '&pageToken=' + tok : ''}`)).json();
    if (r.error) throw new Error(JSON.stringify(r.error));
    for (const d of r.documents || []) yield fields(d);
    tok = r.nextPageToken; } while (tok);
}
// rekod_pbd ditapis ikut tahun_rekod — data tahun lain tidak bercampur
async function* rekodTahun(tahun) {
  let start = null;
  for (;;) {
    const q = {structuredQuery: {from: [{collectionId: 'rekod_pbd'}], limit: 300, orderBy: [{field: {fieldPath: '__name__'}}],
      where: {fieldFilter: {field: {fieldPath: 'tahun_rekod'}, op: 'EQUAL', value: {stringValue: tahun}}},
      ...(start ? {startAt: {values: [{referenceValue: start}], before: false}} : {})}};
    const r = await (await fetch(`${BASE}:runQuery?key=${KEY}`, {method: 'POST', body: JSON.stringify(q)})).json();
    const docs = r.filter(x => x.document).map(x => x.document);
    if (r[0]?.error) throw new Error(JSON.stringify(r[0].error));
    for (const d of docs) yield fields(d);
    if (docs.length < 300) return;
    start = docs.at(-1).name;
  }
}

// Kod paparan. "SCEINCE" ialah ejaan sebenar dalam pangkalan data.
const KOD = {
  'BAHASA MELAYU': ['BM', 'Bahasa Melayu', 1], 'BAHASA INGGERIS': ['BI', 'Bahasa Inggeris', 1],
  'MATEMATIK': ['MT', 'Matematik', 1], 'MATHEMATICS': ['MATH', 'Mathematics (DLP)', 1],
  'SAINS': ['SN', 'Sains', 1], 'SCEINCE': ['SCI', 'Science (DLP)', 1], 'SCIENCE': ['SCI', 'Science (DLP)', 1],
  'PENDIDIKAN ISLAM': ['PI', 'Pendidikan Islam', 0], 'MORAL': ['PM', 'Pendidikan Moral', 0], 'JAWI': ['JAWI', 'Jawi', 0],
  'BAHASA ARAB': ['BA', 'Bahasa Arab', 0], 'PENDIDIKAN SENI VISUAL': ['PSV', 'Pendidikan Seni Visual', 0],
  'PENDIDIKAN JASMANI & KESIHATAN': ['PJK', 'PJK', 0], 'MUZIK': ['MUZ', 'Muzik', 0],
  'SEJARAH': ['SEJ', 'Sejarah', 0], 'REKA BENTUK TEKNOLOGI': ['RBT', 'Reka Bentuk Teknologi', 0],
};
const TERAS = {BM: 'BM', BI: 'BI', MT: 'MT', MATH: 'MT', SN: 'SN', SCI: 'SN'};
const g = (o, k, f) => o[k] ?? (o[k] = f());
const tpMurid = (sum, n) => Math.max(1, Math.min(6, Math.round(sum / n)));   // sama seperti kptPurataMurid
const H6 = () => [0, 0, 0, 0, 0, 0];

// ── 1. Rujukan ──
const jantina = {}; let muridN = 0;
for await (const m of senarai('murid')) { muridN++; jantina[m.noKp] = m.jantina; }
const subtopik = {};
for await (const t of senarai('topik_pembelajaran'))
  if (t.aktif !== false && t.is_subtopik) { const k = t.subjek + '|' + t.tahun; subtopik[k] = (subtopik[k] || 0) + 1; }

// ── 2. Imbas rekod tahun ini ──
const S = {}, STU = {}; let n = 0;
for await (const r of rekodTahun(TAHUN_REKOD)) {
  if (++n % 1000 === 0) process.stderr.write(n + ' ');
  const s = g(S, r.subjek, () => ({rekod: 0, kelas: {}, guru: new Set(), flat: 0, tulis: 0, hist: H6(),
    tahun: {}, unit: {}, bulan: {}, murid: {}, subAss: {}}));
  s.rekod++; if (r.ditulis_semula) s.tulis++; if (r.nama_guru) s.guru.add(r.nama_guru);
  const bl = (r.tarikh_string || '').slice(0, 7); s.bulan[bl] = (s.bulan[bl] || 0) + 1;
  g(s.subAss, r.kelas, () => new Set()).add(r.sub_topik || r.topik);
  const kl = g(s.kelas, r.kelas, () => ({tahun: r.tahun, sum: 0, n: 0, rekod: 0})); kl.rekod++;
  const th = g(s.tahun, r.tahun, H6);
  const un = g(s.unit, r.tahun + '|' + (r.topik_pembelajaran_main || r.topik), () => ({sum: 0, n: 0, low: 0}));
  const tps = (r.murid || []).map(m => m.tp).filter(t => t >= 1 && t <= 6);
  if (tps.length > 3 && new Set(tps).size === 1) s.flat++;
  for (const m of r.murid || []) { const t = m.tp; if (!(t >= 1 && t <= 6)) continue;
    s.hist[t - 1]++; th[t - 1]++; kl.sum += t; kl.n++; un.sum += t; un.n++; if (t <= 2) un.low++;
    const mm = g(s.murid, m.noKp, () => ({sum: 0, n: 0, tahun: r.tahun})); mm.sum += t; mm.n++;
    const st = g(STU, m.noKp, () => ({tahun: r.tahun, sum: 0, n: 0, subj: {}})); st.sum += t; st.n++;
    const ss = g(st.subj, r.subjek, () => [0, 0]); ss[0] += t; ss[1]++; }
}
process.stderr.write(`\n${n} rekod (tahun_rekod=${TAHUN_REKOD})\n`);

// ── 3. Ringkaskan (tiada No. KP keluar dari sini) ──
const clean = s => String(s).replace(/\s+/g, ' ').trim();
const subjek = Object.entries(S).map(([nm, s]) => {
  const [kod, nama, teras] = KOD[nm] || [nm.slice(0, 4), nm, 0];
  const muridHist = H6(), tahunMurid = {}, L = [0, 0], P = [0, 0];
  for (const [kp, m] of Object.entries(s.murid)) { const tp = tpMurid(m.sum, m.n);
    muridHist[tp - 1]++; g(tahunMurid, m.tahun, H6)[tp - 1]++;
    const j = jantina[kp]; if (j === 'LELAKI') { L[0]++; if (tp >= 3) L[1]++; } else if (j === 'PEREMPUAN') { P[0]++; if (tp >= 3) P[1]++; } }
  const kelas = Object.entries(s.kelas).map(([k, v]) => { const exp = subtopik[nm + '|' + v.tahun];
    return {k, t: v.tahun, p: +(v.sum / v.n).toFixed(3), r: v.rekod, l: exp ? +Math.min(1, s.subAss[k].size / exp).toFixed(3) : null}; });
  const lip = kelas.filter(x => x.l != null);
  const unit = Object.entries(s.unit).filter(([, v]) => v.n >= 60)
    .map(([k, v]) => { const [t, ...u] = k.split('|'); return {t, u: clean(u.join('|')), p: v.sum / v.n, low: v.low / v.n, n: v.n}; })
    .sort((a, b) => a.p - b.p).slice(0, 6);
  return {nm, kod, nama, teras, rekod: s.rekod, guru: s.guru.size, flat: s.flat, tulis: s.tulis, hist: s.hist, muridHist, tahunMurid,
    jantina: {L, P}, tahun: s.tahun, bulan: s.bulan, kelas, unit, liputan: lip.length ? lip.reduce((a, b) => a + b.l, 0) / lip.length : null};
});

const keseluruhan = H6(), tahunHist = {}, risk = {jum: 0, L: 0, P: 0, tahun: {}, subj: {BM: 0, BI: 0, MT: 0, SN: 0}, satu: 0};
for (const [kp, st] of Object.entries(STU)) {
  const tp = tpMurid(st.sum, st.n); keseluruhan[tp - 1]++; g(tahunHist, st.tahun, H6)[tp - 1]++;
  const lemah = {};
  for (const [sj, [a, b]] of Object.entries(st.subj)) { const k = TERAS[KOD[sj]?.[0]]; if (k && Math.round(a / b) <= 2) lemah[k] = 1; }
  const nL = Object.keys(lemah).length;
  if (nL >= 1) risk.satu++;
  if (nL >= 2) { risk.jum++; const j = jantina[kp]; if (j === 'LELAKI') risk.L++; else if (j === 'PEREMPUAN') risk.P++;
    risk.tahun[st.tahun] = (risk.tahun[st.tahun] || 0) + 1; for (const k in lemah) risk.subj[k]++; }
}

const out = {dijana: new Date().toISOString(), tahunRekod: TAHUN_REKOD, rekodN: n, muridN, keseluruhan, tahunHist, risk, subjek};
fs.writeFileSync(OUT, `// AGREGAT SAHAJA — dijana ${out.dijana} oleh dashboard/jana-data.mjs (tahun_rekod ${TAHUN_REKOD}). Tiada nama/No. KP murid atau nama guru.\nconst DATA = ${JSON.stringify(out)};\n`);
console.error('ditulis:', OUT.pathname);
