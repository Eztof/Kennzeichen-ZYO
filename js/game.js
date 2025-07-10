// js/game.js
import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  collectionGroup,
  query,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

// Elemente
const navUpload    = document.getElementById('nav-upload');
const viewUpload   = document.getElementById('view-upload');
const uploadMsg    = document.getElementById('upload-msg');

// --- Auth-Guard, Admin-Check & Logout ---
onAuthStateChanged(auth, async user => {
  if (!user) {
    location.href = 'index.html';
    return;
  }

  // Profil laden
  const uDoc = await getDoc(doc(db, 'users', user.uid));
  const name = uDoc.exists() ? uDoc.data().username : null;

  // Upload-DB nur für Eztof_1 freischalten
  if (name === 'Eztof_1') {
    navUpload.classList.remove('d-none');
  }

});
document.getElementById('btn-logout').onclick = () =>
  signOut(auth).then(() => location.href = 'index.html');

// --- Navigation zwischen Views ---
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

// --- Picken-Funktion bleibt unverändert ---
document.getElementById('btn-pick').onclick = async () => {
  const inp = document.getElementById('pick-input');
  const msg = document.getElementById('pick-msg');
  const code = inp.value.trim().toUpperCase();
  if (!code) return;

  const uid  = auth.currentUser.uid;
  const ref  = doc(db, 'users', uid, 'picks', code);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    msg.textContent = `"${code}" schon gepickt!`;
    inp.classList.add('border-danger');
  } else {
    await setDoc(ref, { pickedAt: serverTimestamp() });
    msg.textContent = `"${code}" wurde gepickt!`;
    inp.classList.add('border-success');
  }

  setTimeout(() => {
    msg.textContent = '';
    inp.value = '';
    inp.classList.remove('border-success','border-danger');
  }, 1500);
};

// --- Punktestand berechnen und anzeigen bleibt unverändert ---
async function loadScore() {
  const list = document.getElementById('score-list');
  list.innerHTML = 'Lade…';

  const q             = query(collectionGroup(db, 'picks'));
  const snap          = await getDocs(q);
  const counts        = {};
  snap.docs.forEach(d => {
    const uid = d.ref.parent.parent.id;
    counts[uid] = (counts[uid] || 0) + 1;
  });

  const names = {};
  for (const uid of Object.keys(counts)) {
    const uDoc = await getDoc(doc(db, 'users', uid));
    names[uid] = uDoc.exists() ? uDoc.data().username : uid;
  }

  const entries = Object.entries(counts)
    .sort((a,b)=>b[1]-a[1]);
  list.innerHTML = '';
  if (!entries.length) {
    list.innerHTML = '<li class="list-group-item">Noch keine Picks</li>';
  } else {
    for (const [uid, cnt] of entries) {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between';
      li.textContent = names[uid];
      const span = document.createElement('span');
      span.textContent = cnt;
      li.appendChild(span);
      list.appendChild(li);
    }
  }
}

// --- Karte bleibt unverändert ---
let mapLoaded = false;
async function loadMap() { /* ... dein bestehender Code ... */ }

// --- Upload DB: Einzel-Upload bleibt unverändert ---
document.getElementById('btn-upload').onclick = async () => {
  const code = document.getElementById('db-code').value.trim().toUpperCase();
  const city = document.getElementById('db-city').value.trim();
  if (!code || !city) {
    uploadMsg.textContent = 'Bitte alle Felder ausfüllen.';
    uploadMsg.className = 'text-danger';
    return;
  }
  try {
    await setDoc(doc(db,'plates', code), { city });
    uploadMsg.textContent = `"${code}" eingetragen.`;
    uploadMsg.className = 'text-success';
  } catch(e) {
    uploadMsg.textContent = e.message;
    uploadMsg.className = 'text-danger';
  }
};

// --- JSON-Import: plates.json in Firestore exportieren ---
document.getElementById('btn-import').onclick = async () => {
  uploadMsg.textContent = 'Import läuft…';
  uploadMsg.className = '';
  try {
    const resp = await fetch('plates.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    let count = 0;
    for (const code in data) {
      const city = data[code].city;
      await setDoc(doc(db, 'plates', code), { city });
      count++;
    }
    uploadMsg.textContent = `${count} Kennzeichen importiert.`;
    uploadMsg.className = 'text-success';
  } catch (e) {
    uploadMsg.textContent = 'Fehler: ' + e.message;
    uploadMsg.className = 'text-danger';
  }
};
