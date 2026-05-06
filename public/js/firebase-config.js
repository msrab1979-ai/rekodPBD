// ============================================================================
// FIREBASE CONFIG v2.1 — Sistem Rekod PBD
// SK Sultan Ismail | hipersispbd
// FIX: projectId filled | removed db.settings() | clean persistence
// ============================================================================

const firebaseConfig = {
    apiKey: "AIzaSyDOGhlWApQwmgAySm85CSlN_NJTx75MSr4",
    authDomain: "hipersispbd.firebaseapp.com",
    projectId: "hipersispbd",
    storageBucket: "hipersispbd.firebasestorage.app",
    messagingSenderId: "774275417457",
    appId: "1:774275417457:web:5ba0db20bd2c8298a662d0"
};

// Init once only — prevents "app already exists" on page reload
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

db.enablePersistence().catch(function(){});

// ============================================================================
// RETRY WRAPPER — auto-retry gagal queries (3x)
// Pakai: const snap = await firestoreRetry(() => db.collection('x').get());
// ============================================================================
async function firestoreRetry(queryFn, maxRetries = 3) {
    let lastError;
    for (let i = 1; i <= maxRetries; i++) {
        try {
            return await queryFn();
        } catch (err) {
            lastError = err;
            if (i < maxRetries) {
                console.warn('🔁 Retry ' + i + '/' + maxRetries + ' — ' + err.message);
                await new Promise(r => setTimeout(r, i * 1200));
            }
        }
    }
    console.error('❌ Firestore failed after ' + maxRetries + ' retries');
    throw lastError;
}

// ============================================================================
// OFFLINE BANNER — tunjuk kepada user waktu internet putus
// ============================================================================
(function initOfflineBanner() {
    let banner = null;

    function getBanner() {
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'offlineBanner';
            banner.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;z-index:99999;padding:11px 16px;text-align:center;font-size:14px;font-weight:600;background:linear-gradient(135deg,#fef3c7,#fde68a);color:#92400e;border-bottom:2px solid #f59e0b;box-shadow:0 2px 6px rgba(0,0,0,0.12);';
            banner.innerHTML = '⚠️ Anda sedang <strong>OFFLINE</strong> — Perubahan akan sync semula apabila online. Anda boleh terus bekerja.';
            if (document.body) document.body.prepend(banner);
        }
        return banner;
    }

    function update() {
        const b = getBanner();
        if (b) b.style.display = navigator.onLine ? 'none' : 'block';
    }

    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    document.addEventListener('DOMContentLoaded', update);
    update();
})();

// ============================================================================
// HELPERS — shared across all pages
// ============================================================================
function getTimestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
}

function formatDateForStorage(date) {
    const d = new Date(date);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function showLoading(msg) {
    const el = document.getElementById('loader');
    if (el) {
        el.style.display = 'flex';
        const m = el.querySelector('.loader-message');
        if (m && msg) m.textContent = msg;
    }
}

function hideLoading() {
    const el = document.getElementById('loader');
    if (el) el.style.display = 'none';
}

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'info');
    toast.textContent = message;
    const container = document.getElementById('toast-container');
    if (container) {
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    } else {
        alert(message);
    }
}

const TAHUN_LIST = ['SATU','DUA','TIGA','EMPAT','LIMA','ENAM'];
const ADMIN_PASSWORD = 'adminpbd2024';

console.log('%c🔥 Sistem Rekod PBD — hipersispbd', 'background:#667eea;color:#fff;padding:5px 12px;border-radius:4px;font-weight:bold;');
