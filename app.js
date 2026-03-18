// ====== FIREBASE INTEGRATION (TOPP) ======
import { auth, db } from './firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, setDoc, getDoc, collection, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Configure Google Auth Provider with new OAuth Client ID
const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  'client_id': '851025174814-utovpv2c926sj52bcmk8oice5eh33pfm.apps.googleusercontent.com'
});

const firestore = db;

let isAuthenticated = false;
let currentUser = null;

async function fbLogin() {
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

async function fbLogout() {
  await signOut(auth);
}

function fbAuthStateChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ====== TILGANGSKONTROLL ======
async function checkUserAccess(userEmail) {
  try {
    const accessDoc = doc(firestore, 'weaponlog', 'access');
    const docSnap = await getDoc(accessDoc);
    
    if (docSnap.exists()) {
      const accessData = docSnap.data();
      const allowedUsers = accessData.allowedUsers || [];
      
      // Hvis listen er tom, legg til første bruker
      if (allowedUsers.length === 0) {
        allowedUsers.push(userEmail);
        await setDoc(accessDoc, {
          allowedUsers,
          createdAt: serverTimestamp(),
          firstUserAdded: serverTimestamp()
        });
        console.log('[Access] Første bruker lagt til:', userEmail);
        return true;
      }
      
      // Sjekk om bruker er i listen
      return allowedUsers.includes(userEmail);
    } else {
      // First time - create access list with the current user as admin
      await setDoc(accessDoc, {
        allowedUsers: [userEmail],
        createdAt: serverTimestamp()
      });
      console.log('[Access] Access-liste opprettet med:', userEmail);
      return true;
    }
  } catch (error) {
    console.error('[Access] Feil ved tilgangskontroll:', error);
    return false;
  }
}

async function addUserAccess(userEmail, adminPassword) {
  if (getAdminPassword() !== adminPassword) {
    throw new Error('Feil admin-passord');
  }
  
  try {
    const accessDoc = doc(firestore, 'weaponlog', 'access');
    const docSnap = await getDoc(accessDoc);
    
    if (docSnap.exists()) {
      const accessData = docSnap.data();
      const allowedUsers = accessData.allowedUsers || [];
      
      if (!allowedUsers.includes(userEmail)) {
        allowedUsers.push(userEmail);
        await setDoc(accessDoc, {
          allowedUsers,
          lastUpdated: serverTimestamp(),
          lastUpdatedBy: currentUser?.email
        });
      }
    }
  } catch (error) {
    console.error('[Access] Feil ved å legge til bruker:', error);
    throw error;
  }
}

async function removeUserAccess(userEmail, adminPassword) {
  if (getAdminPassword() !== adminPassword) {
    throw new Error('Feil admin-passord');
  }
  
  try {
    const accessDoc = doc(firestore, 'weaponlog', 'access');
    const docSnap = await getDoc(accessDoc);
    
    if (docSnap.exists()) {
      const accessData = docSnap.data();
      const allowedUsers = (accessData.allowedUsers || []).filter(email => email !== userEmail);
      
      await setDoc(accessDoc, {
        allowedUsers,
        lastUpdated: serverTimestamp(),
        lastUpdatedBy: currentUser?.email
      });
    }
  } catch (error) {
    console.error('[Access] Feil ved å fjerne bruker:', error);
    throw error;
  }
}

// ====== FIRESTORE SYNC FUNCTIONS ======
async function saveToFirestore() {
  if (!isAuthenticated || !currentUser) return;
  
  try {
    console.log('[Firestore] Lagrer felles WeaponLog data...');
    const sharedDoc = doc(firestore, 'weaponlog', 'shared');
    
    // Hent weaponLog fra localStorage
    const weaponLog = JSON.parse(localStorage.getItem('weaponLog') || '[]');
    
    await setDoc(sharedDoc, {
      medlemmer: state.medlemmer,
      vapen: state.vapen,
      utlaan: state.utlaan,
      skyteledere: state.skyteledere,
      settings: state.settings,
      weaponLog: weaponLog,
      lastUpdated: serverTimestamp(),
      lastUpdatedBy: currentUser.email
    });
    
    console.log('[Firestore] ✅ Felles data lagret i skyen (inkl. våpenlogg)');
  } catch (error) {
    console.error('[Firestore] ❌ Feil ved lagring:', error);
  }
}

async function loadFromFirestore() {
  if (!isAuthenticated || !currentUser) return;
  
  try {
    console.log('[Firestore] Laster felles WeaponLog data...');
    const sharedDoc = doc(firestore, 'weaponlog', 'shared');
    const docSnap = await getDoc(sharedDoc);
    
    if (docSnap.exists()) {
      const cloudData = docSnap.data();
      console.log('[Firestore] ✅ Felles data funnet i skyen');
      
      // Load shared data for all users
      state.medlemmer = cloudData.medlemmer || [];
      state.vapen = cloudData.vapen || [];
      state.utlaan = cloudData.utlaan || [];
      state.skyteledere = cloudData.skyteledere || [];
      state.settings = cloudData.settings || { aktivSkytelederId: null };
      
      // Load weaponLog from Firestore
      if (cloudData.weaponLog && Array.isArray(cloudData.weaponLog)) {
        localStorage.setItem('weaponLog', JSON.stringify(cloudData.weaponLog));
        console.log('[Firestore] ✅ Våpenlogg lastet fra skyen');
      }
      
      // Save to localStorage as backup (without triggering Firebase sync)
      localStorage_db.save(DB_KEYS.medlemmer, state.medlemmer);
      localStorage_db.save(DB_KEYS.vapen, state.vapen);
      localStorage_db.save(DB_KEYS.utlaan, state.utlaan);
      localStorage_db.save(DB_KEYS.skyteledere, state.skyteledere);
      localStorage_db.save(DB_KEYS.settings, state.settings);
      
      console.log('[Firestore] 🤝 Data synkronisert fra sky');
      return true;
    } else {
      console.log('[Firestore] Ingen felles data - oppretter ny database');
      // Create initial shared data
      await saveToFirestore();
      return false;
    }
  } catch (error) {
    console.error('[Firestore] ❌ Feil ved innlasting:', error);
    return false;
  }
}

function setupAuthUI() {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const loginScreen = document.getElementById('loginScreen');
  const appContainer = document.getElementById('appContainer');

  if (loginBtn) {
    loginBtn.onclick = async () => {
      loginBtn.disabled = true;
      loginBtn.textContent = 'Laster...';
      try {
        await fbLogin();
      } catch (e) {
        alert('Login feilet: ' + e.message);
        loginBtn.disabled = false;
        loginBtn.textContent = 'Logg inn med Google';
      }
    };
  }

  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      try {
        await fbLogout();
      } catch (e) {
        console.error('Logout feilet:', e);
      }
    };
  }

  fbAuthStateChange(async (user) => {
    if (user) {
      console.log('🔐 Sjekker tilgang for:', user.email);
      
      // Sjekk om bruker har tilgang
      const hasAccess = await checkUserAccess(user.email);
      
      if (hasAccess) {
        isAuthenticated = true;
        currentUser = user;
        console.log('✅ Tilgang godkjent:', user.email);
        if (loginScreen) loginScreen.style.display = 'none';
        if (appContainer) appContainer.style.display = 'block';
        
        // Load data from Firebase and initialize app
        loadFromFirestore().then((hasCloudData) => {
          if (state.skyteledere.length === 0) {
            addShootingInstructor('Skyteleder');
          } else {
            render();
          }
          
          if (hasCloudData) {
            console.log('🌤️ Data synkronisert fra skyen!');
          } else {
            console.log('💾 Bruker lokal data');
          }
        });
      } else {
        // Ingen tilgang - logg ut
        console.log('❌ Ingen tilgang for:', user.email);
        await fbLogout();
        alert(`Ingen tilgang for ${user.email}.\n\nKontakt administrator for å få tilgang til WeaponLog systemet.`);
      }
    } else {
      isAuthenticated = false;
      currentUser = null;
      console.log('❌ Ikke innlogget');
      if (loginScreen) loginScreen.style.display = 'flex';
      if (appContainer) appContainer.style.display = 'none';
      
      // Reset login-knappen
      const loginBtn = document.getElementById('loginBtn');
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Logg inn med Google';
      }
    }
  });
}

// ====== Admin: Last ned full feil/fiks-historikk (CSV) ======
function downloadDefectRepairLog() {
  // Header for hendelseslogg
  const header = [
    'Våpen-ID','Serienummer','Fabrikat','Model','Dato feil','Feil-kommentar','Dato fikset','Fikset-kommentar','Medlem','Skyteleder'
  ];
  // Find all loans with error or fix comment
  const rows = state.utlaan
    .filter(u => (u.feilKommentar && u.feilKommentar.trim() !== '') || (u.fiksetKommentar && u.fiksetKommentar.trim() !== ''))
    .map(u => {
      const v = state.vapen.find(x => x.id === u.vapenId) || {};
      const m = state.medlemmer.find(x => x.id === u.medlemId) || {};
      const s = state.skyteledere.find(x => x.id === u.skytelederId) || {};
      return [
        u.vapenId || '',
        v.serienummer || '',
        v.fabrikat || '',
        v.model || '',
        u.feilTid ? fmtDateTime(u.feilTid) : '',
        u.feilKommentar || '',
        u.fiksetTid ? fmtDateTime(u.fiksetTid) : '',
        u.fiksetKommentar || '',
        m.navn || '',
        s.navn || ''
      ];
    });
  const csv = [header, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(';')).join('\n');
  const date = new Date().toISOString().slice(0,10);
  download(`weaponlog-feilfikslogg-${date}.csv`, csv, 'text/csv;charset=utf-8');
}
// Add button to download error/fix log (for example in admin panel)
if (document.getElementById('downloadDefectLogBtn')) {
  document.getElementById('downloadDefectLogBtn').onclick = downloadDefectRepairLog;
}
// Admin password handling (only one source)
const PASSORD_KEY = 'wlog_admin_passord';
function getAdminPassword() {
  return localStorage.getItem(PASSORD_KEY) || 'TimePK';
}
function setAdminPassword(nytt) {
  localStorage.setItem(PASSORD_KEY, nytt);
}

// Bytt alle passord via admin-knapp i admin-panelet
const adminChangePassBtn = document.getElementById('adminChangePasswordBtn');
if (adminChangePassBtn) {
  adminChangePassBtn.addEventListener('click', () => {
    const gjeldende = prompt('Skriv inn gjeldende admin-passord:');
    if (gjeldende !== getAdminPassword()) {
      alert('Feil passord.');
      return;
    }
    let nytt = prompt('Vennligst tast nytt passord:');
    if (!nytt || !nytt.trim()) {
      alert('Passordet kan ikke være tomt.');
      return;
    }
    setAdminPassword(nytt.trim());
    alert('Alle admin-passord er nå byttet!');
  });
}

// ====== ADMIN BRUKERSTYRING ======
const adminUsersBtn = document.getElementById('adminUsersBtn');
const adminUsersPanel = document.getElementById('adminUsersPanel');
const addUserBtn = document.getElementById('addUserBtn');
const newUserEmail = document.getElementById('newUserEmail');
const usersList = document.getElementById('usersList');

if (adminUsersBtn && adminUsersPanel) {
  adminUsersBtn.addEventListener('click', async () => {
    // If panel is already open, just close it
    if (adminUsersPanel.style.display === 'block') {
      adminUsersPanel.style.display = 'none';
      return;
    }
    
    const password = prompt('Skriv inn admin-passord:\n\n(Trykk Cancel for å avbryte)');
    if (password === null) {
      // Bruker trykket Cancel
      return;
    }
    if (password !== getAdminPassword()) {
      alert('Feil passord.');
      return;
    }
    
    // Open panel and load user list
    adminUsersPanel.style.display = 'block';
    await loadUsersList();
  });
}

if (addUserBtn && newUserEmail) {
  addUserBtn.addEventListener('click', async () => {
    const email = newUserEmail.value.trim();
    if (!email) {
      alert('Vennligst skriv inn e-postadresse.');
      return;
    }
    
    const password = prompt(`Legg til bruker: ${email}\n\nSkriv inn admin-passord:\n\n(Trykk Cancel for å avbryte)`);
    if (password === null) {
      // Bruker trykket Cancel
      return;
    }
    
    try {
      await addUserAccess(email, password);
      alert(`Bruker ${email} lagt til!`);
      newUserEmail.value = '';
      await loadUsersList();
    } catch (error) {
      alert('Feil: ' + error.message);
    }
  });
}

// Admin JSON Import
const adminImportJsonBtn = document.getElementById('adminImportJsonBtn');
const adminImportJsonPanel = document.getElementById('adminImportJsonPanel');
const jsonImportText = document.getElementById('jsonImportText');
const jsonImportConfirmBtn = document.getElementById('jsonImportConfirmBtn');
const jsonImportCancelBtn = document.getElementById('jsonImportCancelBtn');
const jsonImportStatus = document.getElementById('jsonImportStatus');

if (adminImportJsonBtn && adminImportJsonPanel) {
  adminImportJsonBtn.addEventListener('click', () => {
    // If panel is already open, just close it
    if (adminImportJsonPanel.style.display === 'block') {
      adminImportJsonPanel.style.display = 'none';
      return;
    }
    
    const password = prompt('Skriv inn admin-passord for å importere JSON:\n\n(Trykk Cancel for å avbryte)');
    if (password === null) {
      return;
    }
    if (password !== getAdminPassword()) {
      alert('Feil passord.');
      return;
    }
    
    // Open panel
    adminImportJsonPanel.style.display = 'block';
    jsonImportText.value = '';
    jsonImportStatus.innerHTML = '';
  });
}

if (jsonImportCancelBtn) {
  jsonImportCancelBtn.addEventListener('click', () => {
    adminImportJsonPanel.style.display = 'none';
    jsonImportText.value = '';
    jsonImportStatus.innerHTML = '';
  });
}

if (jsonImportConfirmBtn) {
  jsonImportConfirmBtn.addEventListener('click', async () => {
    const jsonStr = jsonImportText.value.trim();
    
    if (!jsonStr) {
      jsonImportStatus.innerHTML = '<div style="color:#d32f2f;">❌ Vennligst lime inn JSON.</div>';
      return;
    }
    
    try {
      const data = JSON.parse(jsonStr);
      
      // Validering
      if (!data.medlemmer || !Array.isArray(data.medlemmer)) {
        throw new Error('medlemmer må være en array');
      }
      if (!data.vapen || !Array.isArray(data.vapen)) {
        throw new Error('vapen må være en array');
      }
      if (!data.skyteledere || !Array.isArray(data.skyteledere)) {
        throw new Error('skyteledere må være en array');
      }
      if (!data.utlaan || !Array.isArray(data.utlaan)) {
        throw new Error('utlaan må være en array');
      }
      
      jsonImportStatus.innerHTML = '<div style="color:#0066cc;">⏳ Importerer...</div>';
      
      // Importer data
      state.medlemmer = data.medlemmer;
      state.vapen = data.vapen;
      state.skyteledere = data.skyteledere;
      state.utlaan = data.utlaan;
      state.settings = data.settings || { aktivSkytelederId: null };
      
      if (data.weaponLog && Array.isArray(data.weaponLog)) {
        localStorage.setItem('weaponLog', JSON.stringify(data.weaponLog));
      }
      
      // Lagre til Firebase
      await saveToFirestore();
      
      render();
      
      jsonImportStatus.innerHTML = `<div style="color:#388e3c;"><strong>✅ Import vellykket!</strong><br/>
        Medlemmer: ${data.medlemmer.length}<br/>
        Våpen: ${data.vapen.length}<br/>
        Skyteledere: ${data.skyteledere.length}<br/>
        Utlån: ${data.utlaan.length}
      </div>`;
      
      setTimeout(() => {
        adminImportJsonPanel.style.display = 'none';
        jsonImportText.value = '';
        jsonImportStatus.innerHTML = '';
      }, 3000);
      
    } catch (error) {
      console.error('JSON import error:', error);
      jsonImportStatus.innerHTML = `<div style="color:#d32f2f;"><strong>❌ Feil ved import:</strong><br/>${error.message}</div>`;
    }
  });
}

async function loadUsersList() {
  if (!usersList) return;
  
  try {
    const accessDoc = doc(firestore, 'timepk', 'access');
    const docSnap = await getDoc(accessDoc);
    
    if (docSnap.exists()) {
      const accessData = docSnap.data();
      const allowedUsers = accessData.allowedUsers || [];
      
      usersList.innerHTML = allowedUsers.map(email => `
        <li style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;">
          <span>${email}</span>
          <button onclick="removeUser('${email}')" class="danger" style="padding:2px 8px;font-size:12px;">Fjern</button>
        </li>
      `).join('');
    }
  } catch (error) {
    console.error('Feil ved lasting av brukerliste:', error);
  }
}

async function removeUser(email) {
  const password = prompt(`Fjern tilgang for ${email}?\n\nSkriv inn admin-passord:\n\n(Trykk Cancel for å avbryte)`);
  if (password === null) {
    // Bruker trykket Cancel
    return;
  }
  
  try {
    await removeUserAccess(email, password);
    alert(`Tilgang fjernet for ${email}`);
    await loadUsersList();
  } catch (error) {
    alert('Feil: ' + error.message);
  }
}

// Make removeUser globally available
window.removeUser = removeUser;

// Egendefinert Ja/Nei-dialog
function customConfirm(msg, useHTML = false) {
  return new Promise(resolve => {
    const dialog = document.getElementById('customConfirm');
    const msgDiv = document.getElementById('customConfirmMsg');
    const yesBtn = document.getElementById('customConfirmYes');
    const noBtn = document.getElementById('customConfirmNo');
    if (useHTML) {
      msgDiv.innerHTML = msg;
    } else {
      msgDiv.textContent = msg;
    }
    dialog.style.display = 'flex';
    function cleanup(result) {
      dialog.style.display = 'none';
      yesBtn.onclick = null;
      noBtn.onclick = null;
      resolve(result);
    }
    yesBtn.onclick = () => cleanup(true);
    noBtn.onclick = () => cleanup(false);
  });
}
// ====== Konstanter og "database" (localStorage) ======
const PUSS_THRESHOLD = 30; // alarmgrense: mer enn 30 treninger siden puss

const DB_KEYS = {
  medlemmer: 'wlog_medlemmer',
  vapen: 'wlog_vapen',
  utlaan: 'wlog_utlaan',
  skyteledere: 'wlog_skyteledere',
  settings: 'wlog_settings'
};

const localStorage_db = {
  load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : structuredClone(fallback);
    } catch {
      return structuredClone(fallback);
    }
  },
  save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

let state = {
  medlemmer: localStorage_db.load(DB_KEYS.medlemmer, []),
  vapen: localStorage_db.load(DB_KEYS.vapen, []), // {id, navn, serienummer, totalBruk, brukSidenPuss, aktiv}
  utlaan: localStorage_db.load(DB_KEYS.utlaan, []), // {id, medlemId, vapenId, start, slutt, skytelederId}
  skyteledere: localStorage_db.load(DB_KEYS.skyteledere, []),
  settings: localStorage_db.load(DB_KEYS.settings, { aktivSkytelederId: null }),
  ui: {
    valgtMedlemId: null,
    aktivTab: 'utlaan'
  }
};

// ====== Utils ======
function id() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function nowISO() { return new Date().toISOString(); }
function fmtDateTime(iso) {
  try { return new Date(iso).toLocaleString('no-NO', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return iso; }
}
function persist() {
  // Save to localStorage first (fast, local backup)
  localStorage_db.save(DB_KEYS.medlemmer, state.medlemmer);
  localStorage_db.save(DB_KEYS.vapen, state.vapen);
  localStorage_db.save(DB_KEYS.utlaan, state.utlaan);
  localStorage_db.save(DB_KEYS.skyteledere, state.skyteledere);
  localStorage_db.save(DB_KEYS.settings, state.settings);
  
  // Sync to Firebase (async, cloud backup)
  if (isAuthenticated && currentUser) {
    saveToFirestore().catch(error => {
      console.error('[Persist] Firebase sync feilet:', error);
    });
  }
}
function download(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

// ====== Dom refs ======
const el = {
  // header/stat
  statBadge: document.getElementById('statBadge'),
  antallAktive: document.getElementById('antallAktive'),
  pussAlarmBadge: document.getElementById('pussAlarmBadge'),
  pussCount: document.getElementById('pussCount'),
  // tabs
  tabUtlån: document.getElementById('tabLoans'),
  tabHistorikk: document.getElementById('tabHistory'),
  viewUtlån: document.getElementById('viewLoans'),
  viewHistorikk: document.getElementById('viewHistory'),
  tabLoans: document.getElementById('tabLoans'),
  tabHistory: document.getElementById('tabHistory'),
  viewLoans: document.getElementById('viewLoans'),
  viewHistory: document.getElementById('viewHistory'),
  // skyteleder
  skytelederSelect: document.getElementById('shootingInstructorSelect'),
  nySkytelederBtn: document.getElementById('newShootingInstructorBtn'),
  adminSkytelederBtn: document.getElementById('adminShootingInstructorBtn'),
  adminSkytelederPanel: document.getElementById('adminShootingInstructorPanel'),
  slettSkytelederBtn: document.getElementById('deleteShootingInstructorBtn'),
  shootingInstructorSelect: document.getElementById('shootingInstructorSelect'),
  newShootingInstructorBtn: document.getElementById('newShootingInstructorBtn'),
  adminShootingInstructorBtn: document.getElementById('adminShootingInstructorBtn'),
  adminShootingInstructorPanel: document.getElementById('adminShootingInstructorPanel'),
  deleteShootingInstructorBtn: document.getElementById('deleteShootingInstructorBtn'),
  // medlemmer
  medlemsListe: document.getElementById('membersList'),
  medlemSok: document.getElementById('memberSearch'),
  nyttMedlemBtn: document.getElementById('newMemberBtn'),
  adminMedlemBtn: document.getElementById('adminMemberBtn'),
  adminMedlemPanel: document.getElementById('adminMemberPanel'),
  slettMedlemBtn: document.getElementById('deleteMemberBtn'),
  membersList: document.getElementById('membersList'),
  memberSearch: document.getElementById('memberSearch'),
  newMemberBtn: document.getElementById('newMemberBtn'),
  // weapons
  vapenListe: document.getElementById('weaponsList'),
  vapenSok: document.getElementById('weaponSearch'),
  nyttVapenBtn: document.getElementById('newWeaponBtn'),
  weaponCounter: document.getElementById('weaponCounter'),
  tellerWeaponCounter: document.getElementById('tellerWeaponCounter'),
  weaponsList: document.getElementById('weaponsList'),
  weaponSearch: document.getElementById('weaponSearch'),
  newWeaponBtn: document.getElementById('newWeaponBtn'),
  // active loans
  aktiveUtlaan: document.getElementById('activeLoans'),
  activeLoans: document.getElementById('activeLoans'),
  // admin
  lastNedLoggBtn: document.getElementById('downloadLogBtn'),
  downloadLogBtn: document.getElementById('downloadLogBtn'),
  downloadDefectLogBtn: document.getElementById('downloadDefectLogBtn'),
  // historikk
  historikkSok: document.getElementById('historySok'),
  inkluderAktive: document.getElementById('includeActive'),
  filterVapen: document.getElementById('filterWeapon'),
  filterSkyteleder: document.getElementById('filterShootingInstructor'),
  filterMedlem: document.getElementById('filterMember'),
  historikkListe: document.getElementById('historyList'),
  historikkStat: document.getElementById('historyStat'),
  historySok: document.getElementById('historySok'),
  includeActive: document.getElementById('includeActive'),
  filterWeapon: document.getElementById('filterWeapon'),
  filterShootingInstructor: document.getElementById('filterShootingInstructor'),
  filterMember: document.getElementById('filterMember'),
  historyList: document.getElementById('historyList'),
  historyStat: document.getElementById('historyStat')
};

// ====== Business-logikk ======
// Admin-knapp for medlem
el.adminMedlemBtn?.addEventListener('click', () => {
  const pass = prompt('Skriv inn admin-passord:');
  if (pass === getAdminPassword()) {
    el.adminMedlemPanel.style.display = '';
    el.adminMedlemPanel.dataset.admin = '1';
  } else {
    alert('Feil passord.');
  }
});

// Slett medlem-knapp
el.slettMedlemBtn?.addEventListener('click', async () => {
  if (el.adminMedlemPanel.dataset.admin !== '1') {
    alert('Du må aktivere admin først.');
    return;
  }
  const mid = state.ui.valgtMedlemId;
  if (!mid) { alert('Velg et medlem først.'); return; }
  const m = state.medlemmer.find(x => x.id === mid);
  if (!m) { alert('Medlem ikke funnet.'); return; }
  const harAktiv = state.utlaan.some(u => u.medlemId === mid && u.slutt === null);
  if (harAktiv) { alert('Kan ikke fjerne medlem med aktivt utlån. Lever inn først.'); return; }
  const bekreft = await customConfirm(`Slette medlem "${m.navn}" permanent?`);
  if (!bekreft) return;
  state.medlemmer = state.medlemmer.filter(x => x.id !== mid);
  if (state.ui.valgtMedlemId === mid) state.ui.valgtMedlemId = null;
  persist();
  render();
  el.adminMedlemPanel.style.display = 'none';
  el.adminMedlemPanel.dataset.admin = '';
});

// Hide admin panel when switching member
el.medlemsListe?.addEventListener('click', () => {
  el.adminMedlemPanel.style.display = 'none';
  el.adminMedlemPanel.dataset.admin = '';
});
// Skyteleder
function addShootingInstructor(navn) {
  const s = { id: id(), navn: navn.trim() };
  state.skyteledere.push(s);
  if (!state.settings.aktivSkytelederId) state.settings.aktivSkytelederId = s.id;
  persist(); render();
}
function activeShootingInstructor() {
  return state.skyteledere.find(s => s.id === state.settings.aktivSkytelederId) || null;
}
function setActiveShootingInstructor(idVal) {
  state.settings.aktivSkytelederId = idVal || null;
  persist(); render();
}
function removeShootingInstructor(sid) {
  if (state.skyteledere.length <= 1) {
    alert("Du må ha minst én skyteleder.");
    return;
  }
  const s = state.skyteledere.find(x => x.id === sid);
  if (!s) return;
  const bekreft = confirm(`Slette skyteleder "${s.navn}" permanent?`);
  if (!bekreft) return;
  const pass = prompt("Skriv inn passord for å slette skyteleder:");
  if (pass !== getAdminPassword()) {
    alert("Feil passord. Skyteleder ble ikke slettet.");
    return;
  }
  state.skyteledere = state.skyteledere.filter(x => x.id !== sid);
  if (state.settings.aktivSkytelederId === sid) {
    state.settings.aktivSkytelederId = state.skyteledere[0]?.id || null;
  }
  persist(); render();
}
// Medlemmer
function addMember(navn, fodselsdato, telefon, kommentar) {
  state.medlemmer.push({ id: id(), navn: navn.trim(), fodselsdato: (fodselsdato||'').trim(), telefon: (telefon||'').trim(), kommentar: (kommentar||'').trim() });
  persist(); render();
}
function removeMember(mid) {
  const harAktiv = state.utlaan.some(u => u.medlemId === mid && u.slutt === null);
  if (harAktiv) { alert('Kan ikke fjerne medlem med aktivt utlån. Lever inn først.'); return; }
  state.medlemmer = state.medlemmer.filter(m => m.id !== mid);
  if (state.ui.valgtMedlemId === mid) state.ui.valgtMedlemId = null;
  persist(); render();
}

// Weapons
function findWeaponBySerialNumber(serienummer) {
  const sn = (serienummer || '').trim().toLowerCase();
  return state.vapen.find(v => v.serienummer.toLowerCase() === sn);
}
function addWeaponFull(data) {
  // data: {type, mekanisme, kaliber, fabrikat, model, serienummer, kommentar}
  if (!data.type || !data.type.trim()) { alert('Våpen art er påkrevd.'); return; }
  if (!data.mekanisme || !data.mekanisme.trim()) { alert('Mekanisme er påkrevd.'); return; }
  if (!data.kaliber || !data.kaliber.trim()) { alert('Kaliber er påkrevd.'); return; }
  if (!data.fabrikat || !data.fabrikat.trim()) { alert('Fabrikat er påkrevd.'); return; }
  if (!data.model || !data.model.trim()) { alert('Model er påkrevd.'); return; }
  if (!data.serienummer || !data.serienummer.trim()) { alert('Serienummer er påkrevd.'); return; }
  if (findWeaponBySerialNumber(data.serienummer)) { alert('Et våpen med dette serienummeret finnes allerede.'); return; }
  state.vapen.push({
    id: id(),
    navn: data.type.trim(),
    type: data.type.trim(),
    mekanisme: data.mekanisme.trim(),
    kaliber: data.kaliber.trim(),
    fabrikat: data.fabrikat.trim(),
    model: data.model.trim(),
    serienummer: data.serienummer.trim(),
    kommentar: data.kommentar ? data.kommentar.trim() : '',
    totalBruk: 0,
    brukSidenPuss: 0,
    aktiv: true
  });
  persist(); render();
}
function removeWeapon(vid) {
  const utl = state.utlaan.some(u => u.vapenId === vid && u.slutt === null);
  if (utl) { alert('Kan ikke fjerne våpen som er utlånt. Lever inn først.'); return; }
  const v = state.vapen.find(x => x.id === vid);
  const bekreft = confirm(`Slette våpenet "${v?.navn || ''}" (${v?.serienummer || ''}) permanent?\nOBS: Total-bruken slettes fra registeret. Historikk beholdes.`);
  if (!bekreft) return;
  const pass = prompt("Skriv inn passord for å slette våpen:");
  if (pass !== getAdminPassword()) {
    alert("Feil passord. Våpenet ble ikke slettet.");
    return;
  }
  state.vapen = state.vapen.filter(v => v.id !== vid);
  persist(); render();
}
function resetCleaning(vid) {
  const v = state.vapen.find(v => v.id === vid);
  if (!v) return;
  if (!confirm(`Nullstille "siden puss" for ${v.navn} (${v.serienummer})?`)) return;
  v.brukSidenPuss = 0;
  persist(); render();
}

function updateWeaponCounter() {
  if (!el.weaponCounter && !el.tellerWeaponCounter) return;
  const totalWeapons = state.vapen.length;
  const activeWeapons = state.vapen.filter(v => v.aktiv).length;
  
  console.log(`[Teller] Oppdaterer: ${totalWeapons} våpen totalt (${activeWeapons} aktive)`);
  
  // Update main weapon counter
  if (el.weaponCounter) {
    if (totalWeapons === activeWeapons) {
      el.weaponCounter.textContent = `${totalWeapons} våpen`;
    } else {
      el.weaponCounter.textContent = `${activeWeapons}/${totalWeapons} våpen (aktive/totalt)`;
    }
    
    // Update tooltip to show breakdown
    if (totalWeapons !== activeWeapons) {
      el.weaponCounter.title = `${activeWeapons} aktive av ${totalWeapons} totalt`;
    } else {
      el.weaponCounter.title = `${totalWeapons} våpen totalt`;
    }
  }
  
  // Update teller counter
  if (el.tellerWeaponCounter) {
    if (totalWeapons === activeWeapons) {
      el.tellerWeaponCounter.textContent = `${totalWeapons} våpen`;
    } else {
      el.tellerWeaponCounter.textContent = `${activeWeapons}/${totalWeapons} våpen (aktive/totalt)`;
    }
    
    // Update tooltip
    if (totalWeapons !== activeWeapons) {
      el.tellerWeaponCounter.title = `${activeWeapons} aktive av ${totalWeapons} totalt`;
    } else {
      el.tellerWeaponCounter.title = `${totalWeapons} våpen totalt`;
    }
  }
}

// Loans
function activeLoanForWeapon(vid) {
  return state.utlaan.find(u => u.vapenId === vid && u.slutt === null) || null;
}
function loanWeapon(vapenId, medlemId) {
  // Check if member can only borrow .22
  const medlem = state.medlemmer.find(m => m.id === medlemId);
  const vapen = state.vapen.find(v => v.id === vapenId);
  if (medlem && medlem.kun22 && vapen && vapen.kaliber) {
    const kaliber = vapen.kaliber.trim();
    // Tillat .22 og .177 (luftpistol) for medlemmer med "kun .22"
    if (kaliber !== '.22' && kaliber !== '.177') {
      alert('Dette medlemmet kan kun låne våpen med kaliber .22 eller .177');
      return;
    }
  }
  // Require counting before loan
  const log = JSON.parse(localStorage.getItem('weaponLog') || '[]');
  const sisteTelling = log.length > 0 ? log[log.length-1] : null;
  if (!sisteTelling || sisteTelling.phase !== 'før') {
    alert('Du må utføre telling av våpen (FØR) før utlån kan gjøres!');
    return;
  }
  const s = activeShootingInstructor();
  if (!s) { alert('Velg skyteleder før utlån.'); return; }
  if (!medlemId) { alert('Velg medlem før utlån.'); return; }
  if (activeLoanForWeapon(vapenId)) { alert('Våpenet er allerede utlånt.'); return; }
  state.utlaan.push({ id: id(), medlemId, vapenId, start: nowISO(), slutt: null, skytelederId: s.id });
  state.ui.valgtMedlemId = null;//Lagt til slik at medlemmet ikke er valgt etter utlån
  persist(); render();
}
function returnWeapon(utlaanId) { //New function for return comment and whether the weapon can be loaned out
  const u = state.utlaan.find(x => x.id === utlaanId);
  if (!u || u.slutt) return;
  
  // Ask for comment
  let kommentar = prompt("Kommentar om feil på våpenet? (La stå tomt hvis alt er ok)");
  if (kommentar === null) {
    // Bruker trykket Avbryt - avbryt hele innleveringen
    console.log('[Innlevering] Avbrutt av bruker');
    return;
  }
  
  // If there is a comment, we must ask if the weapon can be borrowed
  if (kommentar && kommentar.trim() !== "") {
    // Ask first before making any changes
    customConfirm("Kan våpenet fortsatt lånes ut?").then(result => {
      // Now we can close the loan
      u.slutt = nowISO();
      const v = state.vapen.find(v => v.id === u.vapenId);
      if (v) {
        v.totalBruk += 1;
        v.brukSidenPuss += 1;
        
        const status = result ? "ok" : "feil";
        const feilTid = status === "feil" ? nowISO() : null;
        v.feilKommentar = kommentar || "";
        v.feilStatus = status;
        v.feilTid = feilTid;
        v.aktiv = result; // Sett aktiv til false hvis våpenet ikke kan lånes ut
        u.feilKommentar = kommentar || "";
        u.feilStatus = status;
        u.feilTid = feilTid;
      }
      persist(); render();
    });
    return;
  }
  
  // If no comment (all OK), close the loan directly
  u.slutt = nowISO();
  const v = state.vapen.find(v => v.id === u.vapenId);
  if (v) {
    v.totalBruk += 1;
    v.brukSidenPuss += 1;
    v.feilKommentar = "";
    v.feilStatus = "ok";
    v.feilTid = null;
    u.feilKommentar = "";
    u.feilStatus = "ok";
    u.feilTid = null;
  }
  persist(); render();
}

// ====== Render ======
function renderStats() {
  const aktive = state.utlaan.filter(u => u.slutt === null).length;
  el.antallAktive.textContent = aktive;
  if (aktive === 0) {
    el.statBadge.textContent = 'Ingen utleide våpen';
    el.statBadge.classList.add('ok'); el.statBadge.classList.remove('warn');
  } else {
    el.statBadge.textContent = 'Utleide våpen';
    el.statBadge.classList.add('warn'); el.statBadge.classList.remove('ok');
  }

  const antPussAlarm = state.vapen.filter(v => v.brukSidenPuss > PUSS_THRESHOLD).length;
  el.pussCount.textContent = antPussAlarm;
  el.pussAlarmBadge.style.display = antPussAlarm > 0 ? '' : 'none';
}

function renderShootingInstructors() {
  const sel = el.skytelederSelect;
  sel.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = 'Velg skyteleder...';
  sel.appendChild(opt0);

  [...state.skyteledere]
    .sort((a,b)=>a.navn.localeCompare(b.navn,'no'))
    .forEach(s => {
      const o = document.createElement('option');
      o.value = s.id; o.textContent = s.navn;
      if (state.settings.aktivSkytelederId === s.id) o.selected = true;
      sel.appendChild(o);
    });
}

function renderMembers() {
  // Fjern eventuell eksisterende boks
  let boxDiv = document.getElementById('medlem22Div');
  if (boxDiv) boxDiv.remove();
  // Vis avkrysningsboks for valgt medlem
  const valgt = state.medlemmer.find(m => m.id === state.ui.valgtMedlemId);
  if (valgt) {
    boxDiv = document.createElement('div');
    boxDiv.id = 'medlem22Div';
    boxDiv.style.marginTop = '0.7rem';
    const label = document.createElement('label');
    label.style.fontSize = '0.95em';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = !!valgt.kun22;
    check.style.marginRight = '0.5em';
    check.onchange = (e) => {
      valgt.kun22 = !!e.target.checked;
      persist();
    };
    label.appendChild(check);
    label.appendChild(document.createTextNode('Kan kun låne .22'));
    boxDiv.appendChild(label);
    el.medlemsListe.parentNode.appendChild(boxDiv);
  }
  const q = (el.medlemSok.value || '').trim().toLowerCase();
  const list = el.medlemsListe;
  list.innerHTML = '';
  // Nedtrekksmeny for medlem
  if (!el.medlemSelect) {
    el.medlemSelect = document.createElement('select');
    el.medlemSelect.id = 'medlemSelect';
    el.medlemSelect.style.width = '100%';
    el.medlemsListe.parentNode.insertBefore(el.medlemSelect, el.medlemsListe);
  }
  el.medlemSelect.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = 'Velg medlem...';
  el.medlemSelect.appendChild(opt0);
  const filtrerte = [...state.medlemmer]
    .filter(m => !q || m.navn.toLowerCase().includes(q) || (m.telefon||'').toLowerCase().includes(q))
    .sort((a,b)=>a.navn.localeCompare(b.navn,'no'));
  filtrerte.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.navn} (${m.fodselsdato || '-'})`;
    if (state.ui.valgtMedlemId === m.id) opt.selected = true;
    el.medlemSelect.appendChild(opt);
  });
  el.medlemSelect.onchange = (e) => {
    state.ui.valgtMedlemId = e.target.value || null;
    render();
  };

  // Show search results as list below search field
  el.medlemsListe.innerHTML = '';
  if (q && filtrerte.length > 0) {
    filtrerte.forEach(m => {
      const div = document.createElement('div');
      div.className = 'item';
      div.style.cursor = 'pointer';
      div.textContent = `${m.navn} (${m.fodselsdato || '-'})`;
      div.onclick = () => {
        state.ui.valgtMedlemId = m.id;
        el.medlemSelect.value = m.id;
        render();
      };
      el.medlemsListe.appendChild(div);
    });
  }
}

function renderWeapons() {
  const q = (el.vapenSok.value || '').trim().toLowerCase();
  const list = el.vapenListe;
  list.innerHTML = '';
  // Dropdown menu for weapon selection (only for loans, not for admin)
  if (!el.vapenSelect) {
    el.vapenSelect = document.createElement('select');
    el.vapenSelect.id = 'vapenSelect';
    el.vapenSelect.style.width = '100%';
    el.vapenListe.parentNode.insertBefore(el.vapenSelect, el.vapenListe);
  }
  el.vapenSelect.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = 'Velg våpen...';
  el.vapenSelect.appendChild(opt0);
  [...state.vapen]
    .filter(v => v.aktiv && (!q || v.navn?.toLowerCase().includes(q) || v.serienummer?.toLowerCase().includes(q)))
    .sort((a,b)=>a.navn.localeCompare(b.navn,'no'))
    .forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
  let sn = v.serienummer || '';
  let snLast4 = sn.slice(-4);
  opt.textContent = `${v.fabrikat || ''} ${v.model || ''} ${v.kaliber || ''} S/N ${sn}${snLast4 ? ' (' + snLast4 + ')' : ''}`;
      el.vapenSelect.appendChild(opt);
    });
  el.vapenSelect.onchange = (e) => {
    // Can be extended to show details about selected weapon
  };
  const medlem = state.medlemmer.find(m => m.id === state.ui.valgtMedlemId) || null;
  const sld = activeShootingInstructor();

  // Tabelloppsett
  const table = document.createElement('table');
  table.className = 'weapon-table'; // CSS for padding mellom kolonner
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>
    <th>Fabrikat</th>
    <th>Model</th>
    <th>Kaliber</th>
    <th>Serienummer</th>
    <th>Aktiv</th>
    <th>Handling</th>
  </tr>`;
  table.appendChild(thead);
  const tbody = document.createElement('tbody');

  // Filter and sort weapons
  const filtered = [...state.vapen]
    .filter(v => !q || (v.navn?.toLowerCase().includes(q) || v.serienummer?.toLowerCase().includes(q) || v.fabrikat?.toLowerCase().includes(q)))
    .sort((a,b)=>a.navn.localeCompare(b.navn,'no'));

  if (filtered.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 9;
    td.style.textAlign = 'center';
    td.style.color = '#888';
    td.textContent = 'Denne listen er tom: utfør telling av våpen';
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    filtered.forEach(v => {
      const utl = activeLoanForWeapon(v.id);
      const needsPuss = v.brukSidenPuss > PUSS_THRESHOLD;
      const tr = document.createElement('tr');
  // Removed background color for inactive weapons - uses only text color in Active column
  if (needsPuss) tr.classList.add('puss-alarm-row');

      // Fabrikat, model, kaliber, serienummer
      const tdFab = document.createElement('td'); tdFab.textContent = v.fabrikat || '-';
      const tdMod = document.createElement('td'); tdMod.textContent = v.model || '-';
      const tdKal = document.createElement('td'); tdKal.textContent = v.kaliber || '-';
      // Serienummer med utheving av 4 siste siffer
      const tdSer = document.createElement('td');
      if (v.serienummer) {
        const sn = v.serienummer;
        const snStart = sn.slice(0, -4);
        const snEnd = sn.slice(-4);
        tdSer.innerHTML = `${snStart}<b>${snEnd}</b>`;
      } else {
        tdSer.textContent = '-';
      }

  // Kommentar-kolonne fjernet

      // Aktiv
      const tdAktiv = document.createElement('td');
      tdAktiv.textContent = v.aktiv ? 'Ja' : 'Nei';
      tdAktiv.style.color = v.aktiv ? 'green' : 'red';

      // Handlinger
      const tdHand = document.createElement('td');
      tdHand.style.whiteSpace = 'nowrap';
  // Loan button
  const btn = document.createElement('button');
  btn.textContent = medlem ? `Lån til ${medlem.navn}` : 'Velg medlem';
  btn.className = 'primary';
  btn.disabled = !medlem || !!utl || !sld || v.feilStatus === "feil" || !v.aktiv;
  if (v.feilStatus === "feil") btn.title = 'Våpenet har feil og kan ikke lånes ut';
  if (!sld) btn.title = 'Velg skyteleder';
  if (!v.aktiv) btn.title = 'Våpenet er tatt ut av drift';
  btn.onclick = () => loanWeapon(v.id, medlem.id);
  tdHand.appendChild(btn);
      // Reset puss
      const puss = document.createElement('button');
      puss.textContent = 'Reset puss';
      puss.className = 'warning';
      puss.onclick = () => resetCleaning(v.id);
      tdHand.appendChild(puss);
      // Slett
      const fjern = document.createElement('button');
      fjern.textContent = 'Slett';
      fjern.className = 'danger';
      fjern.onclick = () => removeWeapon(v.id);
      tdHand.appendChild(fjern);
      // Feil/fikset
      if (v.feilStatus === "feil") {
        const feilDiv = document.createElement('div');
        feilDiv.style.color = 'red';
        feilDiv.textContent = `FEIL: ${v.feilKommentar || 'Ukjent feil'} (Kan ikke lånes ut)`;
        tdHand.appendChild(feilDiv);
        const fixBtn = document.createElement('button');
        fixBtn.textContent = "Fikset – klar til utlån";
        fixBtn.className = 'success';
        fixBtn.onclick = () => {
          // Ask for comment about what was fixed
          const fiksetKommentar = prompt("Hva er fikset?")?.trim() || "";
          if (fiksetKommentar === null || fiksetKommentar === undefined) {
            // Bruker klikket Avbryt
            return;
          }
          
          v.feilStatus = "ok";
          v.feilKommentar = fiksetKommentar;
          v.feilTid = null;
          v.aktiv = true; // Set weapon back to active when fixed
          
          // Ask to reset cleaning alarm
          customConfirm("Vil du også resette pusse-alarmen?").then(result => {
            if (result) {
              v.brukSidenPuss = 0;
              console.log(`[Puss] Nullstilt for ${v.navn}`);
            }
            
            // Update last loan with error status for this weapon
            const sisteFeilUtlaan = [...state.utlaan].reverse().find(u => u.vapenId === v.id && u.feilStatus === "feil");
            if (sisteFeilUtlaan) {
              sisteFeilUtlaan.fiksetKommentar = fiksetKommentar;
              sisteFeilUtlaan.fiksetTid = nowISO();
            }
            persist();
            render();
          });
        };
        tdHand.appendChild(fixBtn);
      }

  tr.appendChild(tdFab);
  tr.appendChild(tdMod);
  tr.appendChild(tdKal);
  tr.appendChild(tdSer);
  tr.appendChild(tdAktiv);
  tr.appendChild(tdHand);
      tbody.appendChild(tr);
    });
  }
  table.appendChild(tbody);
  list.appendChild(table);

  // CSS for weapon-table flyttet til style.css for ryddighet
}

function renderActiveLoans() {
  const list = el.aktiveUtlaan;
  list.innerHTML = '';
  const aktive = state.utlaan.filter(u => u.slutt === null);

  if (aktive.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'hint';
    empty.textContent = 'Ingen aktive utlån';
    list.appendChild(empty);
    return;
  }

  aktive
    .sort((a,b)=> new Date(a.start) - new Date(b.start))
    .forEach(u => {
      const v = state.vapen.find(x=>x.id===u.vapenId);
      const m = state.medlemmer.find(x=>x.id===u.medlemId);
      const s = state.skyteledere.find(x=>x.id===u.skytelederId);
      const needsPuss = (v?.brukSidenPuss || 0) > PUSS_THRESHOLD;

      const div = document.createElement('div'); 
      div.className='item' + (needsPuss ? ' alarm' : '');

      const meta = document.createElement('div'); meta.className='meta';
  const title = document.createElement('div'); title.className='title';
  // Show only manufacturer (or 'Weapon' if missing)
  title.textContent = `${v?.fabrikat || 'Våpen'} (${v?.serienummer || '?'}) → ${m?.navn || 'Medlem'}`;
      const sub = document.createElement('div'); sub.className='muted';
      sub.textContent = `Utlånt: ${fmtDateTime(u.start)} · Skyteleder: ${s?.navn || '-'}`;
      meta.appendChild(title); meta.appendChild(sub);

      const btns = document.createElement('div'); btns.className='row'; btns.style.justifyContent='flex-end';
      const lever = document.createElement('button'); lever.textContent='Lever inn'; lever.className='success';
      lever.onclick = () => returnWeapon(u.id);

      if (needsPuss) {
        const alarm = document.createElement('span');
        alarm.className = 'badge danger-text';
        alarm.textContent = 'Puss anbefalt';
        btns.appendChild(alarm);
      }

      btns.appendChild(lever);
      div.appendChild(meta); div.appendChild(btns);
      list.appendChild(div);
    });
}

function renderHistoryFilters() {
  // Weapon filter
  el.filterVapen.innerHTML = '';
  const optV0 = new Option('Alle våpen', '');
  el.filterVapen.add(optV0);
  [...state.vapen]
    .sort((a,b)=>a.navn.localeCompare(b.navn,'no'))
    .forEach(v => el.filterVapen.add(new Option(`${v.navn} (${v.serienummer})`, v.id)));

  // Skyteleder-filter
  el.filterSkyteleder.innerHTML = '';
  el.filterSkyteleder.add(new Option('Alle skyteledere', ''));
  [...state.skyteledere]
    .sort((a,b)=>a.navn.localeCompare(b.navn,'no'))
    .forEach(s => el.filterSkyteleder.add(new Option(s.navn, s.id)));

  // Medlems-filter
  el.filterMedlem.innerHTML = '';
  el.filterMedlem.add(new Option('Alle medlemmer', ''));
  [...state.medlemmer]
    .sort((a,b)=>a.navn.localeCompare(b.navn,'no'))
    .forEach(m => el.filterMedlem.add(new Option(m.navn, m.id)));
}

function renderHistory() {
  const q = (el.historikkSok.value || '').trim().toLowerCase();
  const inklAktive = el.inkluderAktive.checked;
  const vFilter = el.filterVapen.value || '';
  const sFilter = el.filterSkyteleder.value || '';
  const mFilter = el.filterMedlem.value || '';

  const list = el.historikkListe;
  list.innerHTML = '';

  let items = [...state.utlaan];

  if (!inklAktive) items = items.filter(u => u.slutt !== null);
  if (vFilter) items = items.filter(u => u.vapenId === vFilter);
  if (sFilter) items = items.filter(u => u.skytelederId === sFilter);
  if (mFilter) items = items.filter(u => u.medlemId === mFilter);

  if (q) {
    items = items.filter(u => {
      const v = state.vapen.find(x=>x.id===u.vapenId);
      const m = state.medlemmer.find(x=>x.id===u.medlemId);
      const s = state.skyteledere.find(x=>x.id===u.skytelederId);
      const hay = [
        v?.navn || '', v?.serienummer || '',
        m?.navn || '', m?.telefon || '',
        s?.navn || '',
        fmtDateTime(u.start), u.slutt ? fmtDateTime(u.slutt) : 'aktiv'
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  items.sort((a,b) => new Date(b.start) - new Date(a.start));

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'hint';
    empty.textContent = 'Ingen treff i historikk.';
    list.appendChild(empty);
  } else {
    items.forEach(u => {
      const v = state.vapen.find(x=>x.id===u.vapenId);
      const m = state.medlemmer.find(x=>x.id===u.medlemId);
      const s = state.skyteledere.find(x=>x.id===u.skytelederId);

      const div = document.createElement('div'); div.className='item';
      const meta = document.createElement('div'); meta.className='meta';

      // Weapon info with all fields
      const t = document.createElement('div'); t.className='title';
      t.innerHTML =
        `<b>${v?.type || v?.navn || ''}</b> &ndash; ${v?.mekanisme || ''} &ndash; ${v?.kaliber || ''} &ndash; ${v?.fabrikat || ''} &ndash; ${v?.model || ''} <br>
        <span style='color:#888'>Serienr: ${v?.serienummer || ''}</span> <br>
        <span style='color:#888'>Kommentar: ${v?.kommentar || ''}</span> <br>
        <span style='color:#888'>→ ${m?.navn || 'Medlem'}${m ? ` (${m.fodselsdato || '-'}, ${m.telefon || '-'})` : ''}</span>`;

      const period = u.slutt ? `${fmtDateTime(u.start)} – ${fmtDateTime(u.slutt)}` : `${fmtDateTime(u.start)} (aktiv)`;
      const sub = document.createElement('div'); sub.className='muted';
      sub.textContent = `${period} · Skyteleder: ${s?.navn || '-'}`;
      
      // Legg til feilkommentar hvis den finnes
      let errorText = '';
      if (u.feilKommentar && u.feilKommentar.trim() !== '') {
        errorText = `<div style='color:#d32f2f;margin-top:0.5em;'><strong>⚠️ FEIL:</strong> ${u.feilKommentar}</div>`;
      }
      if (u.fiksetKommentar && u.fiksetKommentar.trim() !== '') {
        errorText += `<div style='color:#388e3c;margin-top:0.3em;'><strong>✅ FIKSET:</strong> ${u.fiksetKommentar}</div>`;
      }

      meta.appendChild(t); meta.appendChild(sub);
      if (errorText) {
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = errorText;
        meta.appendChild(errorDiv);
      }

      const right = document.createElement('div'); right.className='row'; right.style.justifyContent='flex-end';
      if (!u.slutt) {
        const lever = document.createElement('button'); lever.textContent='Lever inn'; lever.className='success';
        lever.onclick = () => returnWeapon(u.id);
        right.appendChild(lever);
      }

      div.appendChild(meta); div.appendChild(right);
      list.appendChild(div);
    });
  }

  const ant = items.length;
  const full = state.utlaan.length;
  el.historikkStat.textContent = `Viser ${ant} av ${full} utlån${el.inkluderAktive.checked ? ' (inkl. aktive)' : ''}.`;
}

function nameForMember(id) {
  const m = state.medlemmer.find(x=>x.id===id);
  return m ? m.navn : 'Ukjent';
}

function render() {
  renderStats();
  renderShootingInstructors();
  renderMembers();
  renderWeapons();
  updateWeaponCounter();
  renderActiveLoans();
  renderHistoryFilters();
  renderHistory();
}

// ====== Admin: Download weapon log (CSV) ======
function downloadWeaponLog() {
  // Utvidet CSV-header med alle relevante felter
  const header = [
    'Våpen art','Mekanisme','Kaliber','Fabrikat','Model','Serienummer','Kommentar',
    'Totalt antall treninger','Siden puss','Aktiv',
    'Feilstatus','Antall feil' // Count of errors registered for the weapon
  ];
  // Function to count number of errors for each weapon
  // Counts number of loans where an error was registered on return
  function countFeilForVapen(vapenId) {
    return state.utlaan.filter(u =>
      u.vapenId === vapenId &&
      u.slutt &&
      u.feilStatus === 'feil' &&
      u.feilKommentar && u.feilKommentar.trim() !== ''
    ).length;
  }
  // Get latest error registration for the weapon (or empty string)
  function sisteFeilForVapen(vapenId) {
    const feilUtlaan = state.utlaan.filter(u =>
      u.vapenId === vapenId &&
      u.slutt &&
      u.feilStatus === 'feil' &&
      u.feilKommentar && u.feilKommentar.trim() !== ''
    );
    if (feilUtlaan.length === 0) return { kommentar: '', tid: '' };
    const siste = feilUtlaan[feilUtlaan.length - 1];
    return { kommentar: siste.feilKommentar, tid: siste.feilTid ? fmtDateTime(siste.feilTid) : '' };
  }
  const rows = state.vapen
    .sort((a, b) => a.navn.localeCompare(b.navn, 'no'))
    .map(v => [
      v.type || v.navn || '',
      v.mekanisme || '',
      v.kaliber || '',
      v.fabrikat || '',
      v.model || '',
      v.serienummer || '',
      v.kommentar || '',
      String(v.totalBruk),
      String(v.brukSidenPuss),
      v.aktiv ? 'Ja' : 'Nei',
      v.feilStatus === 'feil' ? 'Kan ikke lånes ut' : 'OK',
      countFeilForVapen(v.id) // Antall feil
    ]);
  // Semikolon-separert CSV for norsk Excel
  const csv = [header, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(';')).join('\n');
  const date = new Date().toISOString().slice(0,10);
  download(`weaponlog-vapenlogg-${date}.csv`, csv, 'text/csv;charset=utf-8');
}

// ====== UI Handlers ======
// Tabs
el.tabLoans.addEventListener('click', () => {
  state.ui.aktivTab = 'utlaan';
  el.tabLoans.classList.add('active'); el.tabHistory.classList.remove('active');
  el.viewLoans.style.display = ''; el.viewHistory.style.display = 'none';
});
el.tabHistory.addEventListener('click', () => {
  state.ui.aktivTab = 'historikk';
  el.tabHistory.classList.add('active'); el.tabLoans.classList.remove('active');
  el.viewHistory.style.display = ''; el.viewLoans.style.display = 'none';
  renderHistoryFilters(); renderHistory();
});

// Skyteleder
el.newShootingInstructorBtn.addEventListener('click', () => {
  const navn = prompt('Navn på skyteleder:');
  if (!navn || !navn.trim()) return;
  addShootingInstructor(navn);
});
// Admin-knapp for skyteleder
el.adminShootingInstructorBtn.addEventListener('click', () => {
  const pass = prompt('Skriv inn admin-passord:');
  if (pass === getAdminPassword()) {
    el.adminShootingInstructorPanel.style.display = '';
    el.adminShootingInstructorPanel.dataset.admin = '1';
  } else {
    alert('Feil passord.');
  }
});

// Slett skyteleder-knapp
el.deleteShootingInstructorBtn.addEventListener('click', async () => {
  if (el.adminShootingInstructorPanel.dataset.admin !== '1') {
    alert('Du må aktivere admin først.');
    return;
  }
  const select = el.shootingInstructorSelect;
  const id = select.value;
  if (!id) { alert('Velg en skyteleder først.'); return; }
  const s = state.skyteledere.find(x => x.id === id);
  if (!s) { alert('Skyteleder ikke funnet.'); return; }
  const bekreft = await customConfirm(`Slette skyteleder "${s.navn}" permanent?`);
  if (!bekreft) return;
  state.skyteledere = state.skyteledere.filter(x => x.id !== id);
  if (state.settings.aktivSkytelederId === id) state.settings.aktivSkytelederId = null;
  persist();
  renderShootingInstructors();
  el.adminShootingInstructorPanel.style.display = 'none';
  el.adminShootingInstructorPanel.dataset.admin = '';
});

// Hide admin panel when switching shooting instructor
el.shootingInstructorSelect.addEventListener('change', () => {
  el.adminShootingInstructorPanel.style.display = 'none';
  el.adminShootingInstructorPanel.dataset.admin = '';
});

// Skyteleder select change handler
el.shootingInstructorSelect.addEventListener('change', e => setActiveShootingInstructor(e.target.value || null));

// Medlemmer
el.nyttMedlemBtn.addEventListener('click', () => {
  let navn = '';
  let navnForsøk = 0;
  while (!navn || !navn.trim()) {
    const error = navnForsøk > 0 ? '\n❌ Navn kan ikke være tomt!' : '';
    navn = prompt(`Medlemsnavn:${error}`);
    if (navn === null) return; // Bruker klikket Avbryt
    navnForsøk++;
  }
  
  let fd = '';
  let fdGyldig = false;
  let fdFeilmelding = '';
  
  while (!fdGyldig) {
    fd = prompt(`Fødselsdato (dd.mm.åååå):${fdFeilmelding}`);
    if (fd === null) {
      confirm('Trykk "Nytt medlem" for å starte på nytt.');
      return;
    }
    
    fd = fd.trim();
    fdFeilmelding = '';
    
    if (!fd) {
      fdFeilmelding = '\n❌ Fødselsdato er påkrevd!';
      continue;
    }
    
    // Validate date format
    const datoRegex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    if (!datoRegex.test(fd)) { 
      fdFeilmelding = '\n❌ Format må være dd.mm.åååå (f.eks. 15.03.1990)';
      continue;
    }
    
    // Check that day, month and year are reasonable
    const [, dag, måned, år] = fd.match(datoRegex);
    const dagNum = parseInt(dag);
    const månedNum = parseInt(måned);
    const årNum = parseInt(år);
    
    if (dagNum < 1 || dagNum > 31) {
      fdFeilmelding = '\n❌ Dag må være mellom 01 og 31!';
      continue;
    }
    
    if (månedNum < 1 || månedNum > 12) {
      fdFeilmelding = '\n❌ Måned må være mellom 01 og 12!';
      continue;
    }
    
    if (årNum < 1900 || årNum > new Date().getFullYear()) {
      fdFeilmelding = `\n❌ År må være mellom 1900 og ${new Date().getFullYear()}!`;
      continue;
    }
    
    fdGyldig = true;
  }
  
  let tlf = '';
  let tlfForsøk = 0;
  while (!tlf || !tlf.trim()) {
    let error = '';
    if (tlfForsøk > 0 && (!tlf || !tlf.trim())) {
      error = '\n❌ Telefon kan ikke være tomt!';
    } else if (tlfForsøk > 0 && tlf.trim().length !== 8) {
      error = '\n❌ Telefon må være nøyaktig 8 tall!';
    } else if (tlfForsøk > 0 && isNaN(tlf.trim())) {
      error = '\n❌ Telefon må inneholde kun tall!';
    }
    tlf = prompt(`Telefon (8 tall):${error}`);
    if (tlf === null) {
      confirm('Trykk "Nytt medlem" for å starte på nytt.');
      return;
    }
    
    // Sjekk om det er 8 tall
    if (tlf.trim().length === 8 && !isNaN(tlf.trim())) {
      break;
    }
    
    tlfForsøk++;
  }
  
  addMember(navn, fd, tlf.trim(), '');
  alert('✅ Medlem registrert!');
});
el.memberSearch.addEventListener('input', renderMembers);

// Weapons
el.nyttVapenBtn.addEventListener('click', () => {
  // Skjema for alle felter
  const type = prompt('Våpen art (f.eks. Pistol, Revolver):');
  if (!type || !type.trim()) return;
  const mekanisme = prompt('Mekanisme (f.eks. Halvautomat, Repetér):');
  if (!mekanisme || !mekanisme.trim()) return;
  const kaliber = prompt('Kaliber (f.eks. 9mm, .22):');
  if (!kaliber || !kaliber.trim()) return;
  const fabrikat = prompt('Fabrikat (f.eks. Benelli, STI):');
  if (!fabrikat || !fabrikat.trim()) return;
  const model = prompt('Model (f.eks. PM 95E, Target master):');
  if (!model || !model.trim()) return;
  const serienummer = prompt('Serienummer (påkrevd):');
  if (!serienummer || !serienummer.trim()) { alert('Serienummer er påkrevd.'); return; }
  const kommentar = prompt('Kommentar (valgfritt):') || '';
  addWeaponFull({type, mekanisme, kaliber, fabrikat, model, serienummer, kommentar});
});
el.weaponSearch.addEventListener('input', renderWeapons);

// Admin logg
el.lastNedLoggBtn.addEventListener('click', downloadWeaponLog);

// Historikk filter handlers
el.historySok.addEventListener('input', renderHistory);
el.includeActive.addEventListener('change', renderHistory);
el.filterWeapon.addEventListener('change', renderHistory);
el.filterShootingInstructor.addEventListener('change', renderHistory);
el.filterMember.addEventListener('change', renderHistory);

// ====== First init ======
document.addEventListener('DOMContentLoaded', setupAuthUI);

(function bootstrap() {
  if (state.skyteledere.length === 0) {
    addShootingInstructor('Skyteleder');
  } else {
    render();
  }
  
  // Ensure the counter is updated from the start
  updateWeaponCounter();

  // Warning when closing with active loans
  window.addEventListener('beforeunload', (e) => {
    const aktive = state.utlaan.some(u => u.slutt === null);
    if (aktive) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
})();
// Lytter etter melding fra service worker om ny versjon
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener("message", event => {
    if (event.data && event.data.type === "NEW_VERSION") {
      const banner = document.createElement("div");
      banner.style.position = "fixed";
      banner.style.bottom = "20px";
      banner.style.left = "50%";
      banner.style.transform = "translateX(-50%)";
      banner.style.background = "#1E88E5"; // WeaponLog-blå
      banner.style.color = "#fff";
      banner.style.padding = "0.8rem 1.2rem";
      banner.style.borderRadius = "8px";
      banner.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
      banner.style.display = "flex";
      banner.style.alignItems = "center";
      banner.style.gap = "1rem";
      banner.style.fontFamily = "'Segoe UI', sans-serif";
      banner.style.zIndex = "9999";
      banner.innerHTML = `
        <span style="font-size:0.95rem;">Ny versjon av WeaponLog er klar</span>
        <button id="reloadBtn" style="
          background:#fff;
          color:#1E88E5;
          border:none;
          padding:0.4rem 0.8rem;
          border-radius:6px;
          font-weight:600;
          cursor:pointer;
          transition:background 0.2s;
        ">Oppdater</button>
      `;
      document.body.appendChild(banner);

      const btn = document.getElementById("reloadBtn");
      btn.addEventListener("mouseover", () => btn.style.background = "#f0f0f0");
      btn.addEventListener("mouseout", () => btn.style.background = "#fff");
      btn.addEventListener("click", () => {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
        }
        window.location.reload();
      });
    }
  });
}
// --- Teller og filter ---
// 1. Vis kun avvik som standard
let currentFilter = "deviations";

// 2. Fase-styring
let phaseLocked = false; // Låser fasevalg når det skal være låst

function renderWeaponLog() {
  const logList = document.getElementById("weaponLog");
  logList.innerHTML = "";

  // Hent logg fra localStorage
  const log = JSON.parse(localStorage.getItem('weaponLog') || '[]');

  // Beregn avvik for alle "etter"-poster (men ikke overskrev manuelt satte avvik)
  log.forEach((entry, index) => {
    if (entry.phase === "etter") {
      const lastBefore = [...log.slice(0, index)].reverse().find(e => e.phase === "før");
      // Ikke overskrev manuelt satte avvik (som stempelavvik)
      if (entry.deviation === undefined) {
        entry.deviation = lastBefore && entry.count !== lastBefore.count;
      }
    }
  });

  // Oppdater teller i knappen
  const deviationCount = log.filter(entry => entry.deviation && !entry.deviationApproved).length;
  document.getElementById("deviationCount").textContent = deviationCount;

  // Filter if necessary
  let filteredLog = log;
  if (currentFilter === "deviations") {
    filteredLog = log.filter(entry => entry.deviation && !entry.deviationApproved);
  }

  // Draw the list (newest first)
  filteredLog.slice().reverse().forEach((entry, idx) => {
    const li = document.createElement('li');
    li.style.padding = '0.5rem';
    li.style.borderBottom = '1px solid #ddd';

    // Godkjent avvik vises hvitt i "Vis alle"
    if (entry.deviation && entry.deviationApproved) {
      li.style.color = '#fff';
      li.style.background = '#4caf50';
      li.innerHTML = `✔️ <strong>${entry.phase.toUpperCase()}</strong> – ${entry.count} våpen
        <br><small>${new Date(entry.timestamp).toLocaleString('no-NO')}</small>
        ${entry.note ? `<br><em>${entry.note}</em>` : ''}
        <br><strong>AVVIK GODKJENT AV VÅPENANSVARLIG</strong>
        ${entry.deviationApprovalComment ? `<br><em>Kommentar: ${entry.deviationApprovalComment}</em>` : ''}`;
    }
    // Ikke-godkjent avvik
    else if (entry.deviation) {
      li.style.color = 'red';
      li.innerHTML = `⚠️ <strong>${entry.phase.toUpperCase()}</strong> – ${entry.count} våpen
        <br><small>${new Date(entry.timestamp).toLocaleString('no-NO')}</small>
        ${entry.note ? `<br><em>${entry.note}</em>` : ''}
        <br><strong>AVVIK REGISTRERT</strong>
        <br><button class="approveBtn" data-timestamp="${entry.timestamp}" style="margin-top:0.5rem;">Godkjenn avvik</button>`;
    }
    // Vanlig logg
    else {
      li.innerHTML = `<strong>${entry.phase.toUpperCase()}</strong> – ${entry.count} våpen
        <br><small>${new Date(entry.timestamp).toLocaleString('no-NO')}</small>
        ${entry.note ? `<br><em>${entry.note}</em>` : ''}`;
    }

    logList.appendChild(li);
  });

  // Legg til godkjenn-knapp event
  document.querySelectorAll('.approveBtn').forEach(btn => {
    btn.onclick = function() {
      const timestamp = this.dataset.timestamp;
      const log = JSON.parse(localStorage.getItem('weaponLog') || '[]');
      const entryIndex = log.findIndex(entry => entry.timestamp === timestamp);
      const entry = log[entryIndex];
      if (!entry) return;
      const pass = prompt("Skriv inn passord for å godkjenne avvik:");
      if (pass === getAdminPassword()) {
        let kommentar = prompt("Kommentar til godkjenning av avvik (valgfritt):");
        entry.deviationApproved = true;
        entry.deviationApprovalComment = kommentar || "";
        localStorage.setItem('weaponLog', JSON.stringify(log));
        
        // Lagre godkjenning til Firestore
        saveToFirestore();
        
        renderWeaponLog();
        alert("Avvik godkjent av våpenansvarlig.");
      } else {
        alert("Feil passord.");
      }
    };
  });
}

// --- Form to save counting ---
// 2. Phase always starts with "before"
const phaseSelect = document.getElementById('phase');
phaseSelect.value = "før";
phaseSelect.disabled = true; // Låst til "før" ved oppstart

function resetPhase() {
  phaseSelect.value = "før";
  phaseSelect.disabled = true;
  phaseLocked = false;
}

document.getElementById('weaponForm').addEventListener('submit', function(e) {
  e.preventDefault();

  const count = parseInt(document.getElementById('count').value, 10);
  const phase = phaseSelect.value;
  const note = document.getElementById('note').value.trim();
  const timestamp = new Date().toISOString();

  // Don't allow counting after training if there are active loans
  if (phase === "etter") {
    const aktiveUtlån = state.utlaan.filter(u => u.slutt === null).length;
    if (aktiveUtlån > 0) {
      alert("Du kan ikke telle 'etter trening' før alle våpen er levert inn!");
      return;
    }
  }

  const logEntry = { count, phase, note, timestamp };
  const existingLog = JSON.parse(localStorage.getItem('weaponLog') || '[]');

  // Avviksvarsel i sanntid
  if (phase === "etter") {
    const lastBefore = [...existingLog].reverse().find(e => e.phase === "før");
    if (lastBefore && count !== lastBefore.count) {
      logEntry.deviation = true;
      if (!note) {
        alert("Du må legge inn en kommentar for å lagre telling med avvik!");
        return;
      }
      alert(`⚠️ AVVIK OPPDAGET!\nFør trening: ${lastBefore.count} våpen\nEtter trening: ${count} våpen`);
    }
  }

  existingLog.push(logEntry);
  localStorage.setItem('weaponLog', JSON.stringify(existingLog));
  
  // Lagre telling til Firestore med en gang
  saveToFirestore();

  this.reset();

  // After saving: if "before", switch to "after" and lock field, otherwise reset
  if (phase === "før") {
    phaseSelect.value = "etter";
    phaseSelect.disabled = true;
    phaseLocked = true;
  } else {
    resetPhase();
  }

  renderWeaponLog();
  
  // Ask for stamp instead of simple alert
  customConfirm(`Telling lagret: ${count} våpen (${phase})<br><br>Er <span style="font-weight:bold;color:#fbbf24;text-shadow:0 0 8px rgba(251,191,36,0.5);">STEMPEL & NØKLER</span> i våpenskapet?`, true).then(result => {
    if (!result) {
      // Nei - registrer avvik for manglende stempel
      const stempelAvvik = {
        count: count,
        phase: phase,
        note: "Stempel mangler - Kontakt Våpenansvarlig",
        timestamp: new Date().toISOString(),
        deviation: true,
        deviationApproved: false
      };
      
      const log = JSON.parse(localStorage.getItem('weaponLog') || '[]');
      log.push(stempelAvvik);
      localStorage.setItem('weaponLog', JSON.stringify(log));
      
      // Lagre avvik til Firestore
      saveToFirestore();
      
      renderWeaponLog();
      
      alert("AVVIK REGISTRERT: Stempel mangler - Kontakt Våpenansvarlig");
    }
  });
});

// 2. Lock phase selection, user cannot change it
phaseSelect.addEventListener('mousedown', function(e) {
  if (phaseSelect.disabled) e.preventDefault();
});
phaseSelect.addEventListener('keydown', function(e) {
  if (phaseSelect.disabled) e.preventDefault();
});

// --- Filterknapper ---
// 1. "Vis kun avvik" aktiv som standard
document.getElementById("showAll").addEventListener("click", () => {
  currentFilter = "all";
  document.getElementById("showAll").classList.add("active");
  document.getElementById("showDeviations").classList.remove("active");
  renderWeaponLog();
});

document.getElementById("showDeviations").addEventListener("click", () => {
  currentFilter = "deviations";
  document.getElementById("showDeviations").classList.add("active");
  document.getElementById("showAll").classList.remove("active");
  renderWeaponLog();
});

// --- Tegn loggen ved oppstart ---
// 1. Sett "Vis kun avvik" aktiv
document.getElementById("showDeviations").classList.add("active");
document.getElementById("showAll").classList.remove("active");

// Sjekk siste telling og sett riktig fase
function initializePhaseFromLog() {
  const log = JSON.parse(localStorage.getItem('weaponLog') || '[]');
  const sisteTelling = log.length > 0 ? log[log.length-1] : null;
  
  if (!sisteTelling) {
    // No counting yet - start with "before"
    resetPhase();
  } else if (sisteTelling.phase === "før") {
    // Last counting was "before" - now it should be "after" (can borrow)
    phaseSelect.value = "etter";
    phaseSelect.disabled = true;
    phaseLocked = true;
  } else {
    // Last counting was "after" - back to "before" for new period
    resetPhase();
  }
}

initializePhaseFromLog();
renderWeaponLog();
//updated 12.03.2026