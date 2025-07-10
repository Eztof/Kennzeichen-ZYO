// js/game.js
import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js';
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  collectionGroup,
  collection,
  query,
  getDocs,
  serverTimestamp,
  increment
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js';

// UI-Elemente
const navUpload = document.getElementById('nav-upload');
const btnImport = document.getElementById('btn-import');
const uploadMsg = document.getElementById('upload-msg');

// --- Auth & Admin-Check ---
onAuthStateChanged(auth, async user => {
  if (!user) return location.href = 'index.html';
  const u = await getDoc(doc(db, 'users', user.uid));
  if (u.exists() && u.data().username === 'Eztof_1') {
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

// --- Picken ---
document.getElementById('btn-pick').onclick = async () => {
  const inp  = document.getElementById('pick-input');
  const msg  = document.getElementById('pick-msg');
  const code = inp.value.trim().toUpperCase();
  if (!code) return;

  const uid  = auth.currentUser.uid;
  const ref  = doc(db, 'users', uid, 'picks', code);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    msg.textContent = `"${code}" schon gepickt!`;
    inp.classList.add('border-danger');
    await updateDoc(ref, {
      attempts: increment(1),
      lastAttempt: serverTimestamp()
    });
  } else {
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

// --- Punktestand ---
async function loadScore() {
  const summaryDiv = document.getElementById('score-summary');
  const tableBody  = document.getElementById('score-table-body');
  summaryDiv.innerHTML = '';
  tableBody.innerHTML  = '<tr><td colspan="5">Lade…</td></tr>';

  // Picks sammeln
  const pickSnap  = await getDocs(query(collectionGroup(db, 'picks')));
  const userPicks = {};
  pickSnap.docs.forEach(d => {
    const uid  = d.ref.parent.parent.id;
    const data = d.data();
    const date = data.pickedAt ? data.pickedAt.toDate() : new Date(0);
    const at   = data.attempts || 0;
    if (!userPicks[uid]) userPicks[uid] = [];
    userPicks[uid].push({ code: d.id, date, attempts: at });
  });

  // Namen holen
  const names = {};
  for (const uid of Object.keys(userPicks)) {
    const u = await getDoc(doc(db, 'users', uid));
    names[uid] = u.exists() ? u.data().username : uid;
  }

  // Summary-Badges
  const badgeClasses = ['primary','success','info','warning','secondary'];
  Object.keys(userPicks).forEach((uid,i) => {
    const span = document.createElement('span');
    span.className = `badge bg-${badgeClasses[i % badgeClasses.length]} me-2`;
    span.textContent = `${names[uid]}: ${userPicks[uid].length} Picks`;
    summaryDiv.appendChild(span);
  });

  // Flatten & sort by date desc
  const flat = [];
  Object.entries(userPicks).forEach(([uid,arr]) =>
    arr.forEach(p => flat.push({ uid, ...p }))
  );
  flat.sort((a,b) => b.date - a.date);

  // cityMap holen
  const cityMap = {};
  const platesSnap = await getDocs(collection(db, 'plates'));
  platesSnap.docs.forEach(p => {
    cityMap[p.id] = p.data().city;
  });

  // Tabelle füllen
  const rowClasses = ['table-primary','table-success','table-info','table-warning','table-secondary'];
  tableBody.innerHTML = '';
  flat.forEach(item => {
    const idx = Object.keys(userPicks).indexOf(item.uid) % rowClasses.length;
    const tr = document.createElement('tr');
    tr.className = rowClasses[idx];
    tr.innerHTML = `
      <td>${names[item.uid]}</td>
      <td>${item.code}</td>
      <td>${cityMap[item.code]||''}</td>
      <td>${item.date.toLocaleDateString()}</td>
      <td>${item.attempts>0?item.attempts:''}</td>
    `;
    tableBody.appendChild(tr);
  });
  if (!flat.length) {
    tableBody.innerHTML = '<tr><td colspan="5">Noch keine Picks</td></tr>';
  }
}

// --- Leaflet-Karte mit Kreisen-GeoJSON ---
let mapLoaded = false;
async function loadMap() {
  if (mapLoaded) return;
  mapLoaded = true;
  console.log('Leaflet L:', typeof L);

  const map = L.map('map').setView([51.1657, 10.4515], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  const geo = await fetch('data/counties.geojson').then(r=>r.json());
  console.log('Features:', geo.features.length);

  const pickSnap = await getDocs(query(collectionGroup(db, 'picks')));
  const usedCities = new Set();
  for (const d of pickSnap.docs) {
    const pd = await getDoc(doc(db, 'plates', d.id));
    if (pd.exists()) usedCities.add(pd.data().city);
  }
  console.log('usedCities:', usedCities);

  L.geoJSON(geo, {
    style: f => ({
      color: '#444',
      weight: 1,
      fillColor: usedCities.has(f.properties.NAME_3) ? '#32a852' : '#ddd',
      fillOpacity: usedCities.has(f.properties.NAME_3) ? 0.7 : 0.3
    })
  }).addTo(map);
}

// --- Upload & Import bleiben wie gehabt ---
document.getElementById('btn-upload').onclick = async () => { /* ... */ };
btnImport.onclick = async () => { /* ... */ };
