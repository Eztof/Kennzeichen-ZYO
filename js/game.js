// js/game.js
import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js';
import {
  doc,
  collection,
  setDoc,
  updateDoc,
  getDoc,
  collectionGroup,
  query,
  getDocs,
  serverTimestamp,
  increment
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js';

// UI-Elemente
const navUpload   = document.getElementById('nav-upload');
const btnImport   = document.getElementById('btn-import');
const uploadMsg   = document.getElementById('upload-msg');

// --- Auth & Admin-Check ---
onAuthStateChanged(auth, async user => {
  if (!user) {
    location.href = 'index.html';
    return;
  }
  // Profil laden
  const uDoc  = await getDoc(doc(db, 'users', user.uid));
  const name  = uDoc.exists() ? uDoc.data().username : null;
  // Upload-Tab nur für Eztof_1
  if (name === 'Eztof_1') {
    navUpload.classList.remove('d-none');
  }
});

// --- Logout ---
document.getElementById('btn-logout').onclick = () =>
  signOut(auth).then(() => location.href = 'index.html');

// --- Navigation ---
const views = document.querySelectorAll('.view');
document.querySelectorAll('.nav-link').forEach(a => {
  a.onclick = e => {
    e.preventDefault();
    const v = a.dataset.view;
    views.forEach(x =>
      x.id === 'view-' + v
        ? x.classList.remove('d-none')
        : x.classList.add('d-none')
    );
    if (v === 'punktestand') loadScore();
    if (v === 'karte')      loadMap();
  };
});

// --- Picken mit Versuchszähler ---
document.getElementById('btn-pick').onclick = async () => {
  const inp  = document.getElementById('pick-input');
  const msg  = document.getElementById('pick-msg');
  const code = inp.value.trim().toUpperCase();
  if (!code) return;

  const uid  = auth.currentUser.uid;
  const ref  = doc(db, 'users', uid, 'picks', code);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    // Wenn schon gepickt → Versuchszähler hochsetzen
    await updateDoc(ref, {
      attempts: increment(1),
      lastAttempt: serverTimestamp()
    });
    msg.textContent = `"${code}" schon gepickt! Versuch gezählt.`;
    inp.classList.add('border-danger');
  } else {
    // erster wirklicher Pick
    await setDoc(ref, {
      pickedAt: serverTimestamp(),
      attempts: 0
    });
    msg.textContent = `"${code}" wurde gepickt!`;
    inp.classList.add('border-success');
  }

  setTimeout(() => {
    msg.textContent = '';
    inp.value = '';
    inp.classList.remove('border-success','border-danger');
  }, 1500);
};

// --- Punktestand mit Detail-Tabelle ---
async function loadScore() {
  const summaryDiv  = document.getElementById('score-summary');
  const tableBody   = document.getElementById('score-table-body');
  // Reset
  summaryDiv.innerHTML = '';
  tableBody.innerHTML = '<tr><td colspan="4">Lade…</td></tr>';

  // 1) alle Pick-Docs holen
  const allPicksSnap = await getDocs(query(collectionGroup(db, 'picks')));

  // 2) pro Nutzer Zusammenfassung initialisieren
  const users = {}; // uid → { picks: [], count, attemptsSum }
  allPicksSnap.docs.forEach(d => {
    const uid = d.ref.parent.parent.id;
    if (!users[uid]) users[uid] = { picks: [], count: 0, attempts: 0 };
    users[uid].count++;
  });

  // 3) für jeden Nutzer alle Pick-Details laden
  for (const uid of Object.keys(users)) {
    const pickDocs = await getDocs(collection(db, 'users', uid, 'picks'));
    pickDocs.docs.forEach(p => {
      const data = p.data();
      users[uid].picks.push({
        code: p.id,
        date: data.pickedAt ? data.pickedAt.toDate() : null,
        attempts: data.attempts || 0
      });
      users[uid].attempts += data.attempts || 0;
    });
  }

  // 4) Nutzernamen holen
  const names = {};
  for (const uid of Object.keys(users)) {
    const uDoc = await getDoc(doc(db, 'users', uid));
    names[uid] = uDoc.exists() ? uDoc.data().username : uid;
  }

  // 5) Farben definieren
  const badgeClasses = ['primary','success','info','warning','secondary'];
  const rowClasses   = ['table-primary','table-success','table-info','table-warning','table-secondary'];

  // 6) Summary-Badges rendern
  let idx = 0;
  for (const uid of Object.keys(users)) {
    const usr = users[uid];
    const span = document.createElement('span');
    span.className = `badge bg-${badgeClasses[idx % badgeClasses.length]} me-2`;
    span.textContent = `${names[uid]}: ${usr.count} Picks, ${usr.attempts} Versuche`;
    summaryDiv.appendChild(span);
    idx++;
  }

  // 7) Tabelle rendern
  tableBody.innerHTML = '';
  idx = 0;
  for (const uid of Object.keys(users)) {
    const usr = users[uid];
    // sortiere chronologisch
    usr.picks.sort((a,b) => a.date - b.date);
    const rowClass = rowClasses[idx % rowClasses.length];
    usr.picks.forEach(p => {
      const tr = document.createElement('tr');
      tr.className = rowClass;
      // Spalten: Benutzer, Kennzeichen, Datum, Versuche
      tr.innerHTML = `
        <td>${names[uid]}</td>
        <td>${p.code}</td>
        <td>${p.date ? p.date.toLocaleString() : ''}</td>
        <td>${p.attempts}</td>
      `;
      tableBody.appendChild(tr);
    });
    idx++;
  }
}

// --- Karte (unverändert) ---
let mapLoaded = false;
async function loadMap() { /* dein bestehender Leaflet/GeoJSON-Code */ }

// Hilfsfunktionen ...
function loadScript(src) {
  return new Promise(r => {
    const s = document.createElement('script');
    s.src = src; s.onload = r;
    document.head.append(s);
  });
}
function loadCSS(href) {
  return new Promise(r => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href; l.onload = r;
    document.head.append(l);
  });
}

// --- Upload & JSON-Import (unverändert) ---
document.getElementById('btn-upload').onclick = async () => { /* ... */ };
btnImport.onclick = async () => { /* ... */ };
