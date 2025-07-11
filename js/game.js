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

// Karte-Flag ganz oben
let mapLoaded = false;

// UI-Elemente
const navUpload   = document.getElementById('nav-upload');
const viewElems   = document.querySelectorAll('.view');
const navLinks    = document.querySelectorAll('.nav-link');
const btnLogout   = document.getElementById('btn-logout');
const btnPick     = document.getElementById('btn-pick');
const inpPick     = document.getElementById('pick-input');
const msgPick     = document.getElementById('pick-msg');
const summaryDiv  = document.getElementById('score-summary');
const tableBody   = document.getElementById('score-table-body');
const btnUpload   = document.getElementById('btn-upload');
const btnImport   = document.getElementById('btn-import');
const uploadMsg   = document.getElementById('upload-msg');

// --- Auth-Guard & Admin-Check ---
onAuthStateChanged(auth, async user => {
  if (!user) return location.href = 'index.html';
  // Admin: Eztof_1
  const u = await getDoc(doc(db,'users',user.uid));
  if (u.exists() && u.data().username === 'Eztof_1') {
    navUpload.classList.remove('d-none');
  }
});

// --- Logout ---
btnLogout.onclick = () =>
  signOut(auth).then(() => location.href = 'index.html');

// --- Navigation zwischen Views ---
navLinks.forEach(a => {
  a.onclick = e => {
    e.preventDefault();
    const view = a.dataset.view;
    viewElems.forEach(v => 
      v.id === 'view-' + view
        ? v.classList.remove('d-none')
        : v.classList.add('d-none')
    );
    if (view === 'punktestand') loadScore();
    if (view === 'karte')      loadMap();
  };
});

// --- Picken ---
btnPick.onclick = async () => {
  const code = inpPick.value.trim().toUpperCase();
  if (!code) return;
  const uid = auth.currentUser.uid;
  const ref = doc(db,'users',uid,'picks',code);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    msgPick.textContent = `"${code}" schon gepickt!`;
    inpPick.classList.add('border-danger');
    await updateDoc(ref,{
      attempts: increment(1),
      lastAttempt: serverTimestamp()
    });
  } else {
    await setDoc(ref,{
      pickedAt: serverTimestamp(),
      attempts: 0
    });
    msgPick.textContent = `"${code}" wurde gepickt!`;
    inpPick.classList.add('border-success');
  }
  setTimeout(()=>{
    msgPick.textContent = '';
    inpPick.value = '';
    inpPick.classList.remove('border-success','border-danger');
  },1500);
};

// --- Punktestand laden & anzeigen ---
async function loadScore() {
  summaryDiv.innerHTML = '';
  tableBody.innerHTML = '<tr><td colspan="5">Lade…</td></tr>';

  // 1) alle Picks holen
  const pickSnap = await getDocs(query(collectionGroup(db,'picks')));
  const userPicks = {};
  pickSnap.docs.forEach(d => {
    const uid = d.ref.parent.parent.id;
    const dt  = d.data().pickedAt?.toDate() || new Date(0);
    const at  = d.data().attempts || 0;
    if (!userPicks[uid]) userPicks[uid] = [];
    userPicks[uid].push({ code: d.id, date: dt, attempts: at });
  });

  // 2) Nutzernamen laden
  const names = {};
  for (const uid of Object.keys(userPicks)) {
    const uDoc = await getDoc(doc(db,'users',uid));
    names[uid] = uDoc.exists() ? uDoc.data().username : uid;
  }

  // 3) Summary-Badges
  const colors = ['primary','success','info','warning','secondary'];
  Object.keys(userPicks).forEach((uid,i) => {
    const badge = document.createElement('span');
    badge.className = `badge bg-${colors[i%colors.length]} me-2`;
    badge.textContent = `${names[uid]}: ${userPicks[uid].length} Picks`;
    summaryDiv.appendChild(badge);
  });

  // 4) Flache Liste & sortieren (neueste zuerst)
  const flat = [];
  Object.entries(userPicks).forEach(([uid,arr]) =>
    arr.forEach(p => flat.push({ uid, ...p }))
  );
  flat.sort((a,b) => b.date - a.date);

  // 5) cityMap aus plates
  const cityMap = {};
  const platesSnap = await getDocs(collection(db,'plates'));
  platesSnap.docs.forEach(p => cityMap[p.id] = p.data().city);

  // 6) Tabelle befüllen
  tableBody.innerHTML = '';
  flat.forEach(item => {
    const idx = Object.keys(userPicks).indexOf(item.uid) % colors.length;
    const row = document.createElement('tr');
    row.className = `table-${colors[idx]}`;
    row.innerHTML = `
      <td>${names[item.uid]}</td>
      <td>${item.code}</td>
      <td>${cityMap[item.code] || ''}</td>
      <td>${item.date.toLocaleDateString()}</td>
      <td>${item.attempts>0?item.attempts:''}</td>
    `;
    tableBody.appendChild(row);
  });
  if (!flat.length) {
    tableBody.innerHTML = '<tr><td colspan="5">Noch keine Picks</td></tr>';
  }
}

// --- Karte laden & einfärben ---
async function loadMap() {
  if (mapLoaded) return;
  mapLoaded = true;
  console.log('Leaflet loaded:', typeof L);

  const map = L.map('map').setView([51.1657,10.4515],6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  const geo = await fetch('data/counties.geojson').then(r=>r.json());
  console.log('Features:', geo.features.length);

  const pickSnap = await getDocs(query(collectionGroup(db,'picks')));
  const usedCities = new Set();
  for (const d of pickSnap.docs) {
    const pd = await getDoc(doc(db,'plates',d.id));
    if (pd.exists()) usedCities.add(pd.data().city);
  }
  console.log('UsedCities:', usedCities);

  L.geoJSON(geo,{
    style: f => ({
      color: '#444',
      weight: 1,
      fillColor: usedCities.has(f.properties.NAME_3)?'#32a852':'#ddd',
      fillOpacity: usedCities.has(f.properties.NAME_3)?0.7:0.3
    })
  }).addTo(map);
}

// --- Einzel-Upload & JSON-Import ---
btnUpload.onclick = async () => {
  const code = document.getElementById('db-code').value.trim().toUpperCase();
  const city = document.getElementById('db-city').value.trim();
  if (!code || !city) {
    uploadMsg.textContent = 'Bitte alle Felder ausfüllen.';
    uploadMsg.className = 'text-danger';
    return;
  }
  try {
    await setDoc(doc(db,'plates',code),{ city });
    uploadMsg.textContent = `"${code}" eingetragen.`;
    uploadMsg.className = 'text-success';
  } catch (e) {
    uploadMsg.textContent = e.message;
    uploadMsg.className = 'text-danger';
  }
};

btnImport.onclick = async () => {
  uploadMsg.textContent = 'Import läuft…';
  uploadMsg.className = '';
  try {
    const resp = await fetch('plates.json');
    if (!resp.ok) throw new Error(resp.status);
    const data = await resp.json();
    let c=0;
    for (const code in data) {
      await setDoc(doc(db,'plates',code),{ city: data[code].city });
      c++;
    }
    uploadMsg.textContent = `${c} Kennzeichen importiert.`;
    uploadMsg.className = 'text-success';
  } catch (e) {
    uploadMsg.textContent = 'Fehler: ' + e.message;
    uploadMsg.className = 'text-danger';
  }
};
