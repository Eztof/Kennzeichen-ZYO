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

// --- Auth-Guard & Logout ---
onAuthStateChanged(auth, user => {
  if (!user) location.href = 'index.html';
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

// --- Picken-Funktion ---
document.getElementById('btn-pick').onclick = async () => {
  const inp = document.getElementById('pick-input');
  const msg = document.getElementById('pick-msg');
  const code = inp.value.trim().toUpperCase();
  if (!code) return;

  const uid = auth.currentUser.uid;
  const ref = doc(db, 'users', uid, 'picks', code);
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

// --- Punktestand berechnen und anzeigen ---
async function loadScore() {
  const list = document.getElementById('score-list');
  list.innerHTML = 'Lade…';

  const q             = query(collectionGroup(db, 'picks'));
  const querySnapshot = await getDocs(q);
  const counts        = {};

  querySnapshot.docs.forEach(docSnap => {
    const uid = docSnap.ref.parent.parent.id;
    counts[uid] = (counts[uid] || 0) + 1;
  });

  const names = {};
  for (const uid of Object.keys(counts)) {
    const uDoc = await getDoc(doc(db, 'users', uid));
    names[uid] = uDoc.exists() ? uDoc.data().username : uid;
  }

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  list.innerHTML = '';
  if (entries.length === 0) {
    list.innerHTML = '<li class="list-group-item">Noch keine Picks</li>';
  } else {
    for (const [uid, cnt] of entries) {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between';
      li.textContent = names[uid];
      const badge = document.createElement('span');
      badge.textContent = cnt;
      li.appendChild(badge);
      list.appendChild(li);
    }
  }
}

// --- Karte (Leaflet & GeoJSON) ---
let mapLoaded = false;
async function loadMap() {
  if (mapLoaded) return;
  mapLoaded = true;
  await Promise.all([
    loadScript('https://unpkg.com/leaflet@1.9.3/dist/leaflet.js'),
    loadCSS('https://unpkg.com/leaflet@1.9.3/dist/leaflet.css')
  ]);
  const map = L.map('map').setView([51.33,10.45],6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ attribution:'© OpenStreetMap' }).addTo(map);

  const geo = await fetch('/data/germany-states.geojson').then(r=>r.json());
  const picksSnap = await getDocs(query(collectionGroup(db,'picks')));
  const usedCodes  = new Set(picksSnap.docs.map(d=>d.id));
  const statesUsed = new Set();
  for (const code of usedCodes) {
    const p = await getDoc(doc(db,'plates',code));
    if (p.exists()) statesUsed.add(p.data().state);
  }
  L.geoJSON(geo, {
    style: f => ({
      color: '#444', weight:1,
      fillColor: statesUsed.has(f.properties.NAME_1) ? '#58a' : '#ccc',
      fillOpacity: 0.7
    })
  }).addTo(map);
}
function loadScript(src){ return new Promise(r=>{const s=document.createElement('script');s.src=src;s.onload=r;document.head.append(s);}); }
function loadCSS(href){ return new Promise(r=>{const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.onload=r;document.head.append(l);}); }

// --- Upload DB (ohne Bundesland) ---
document.getElementById('btn-upload').onclick = async () => {
  const code = document.getElementById('db-code').value.trim().toUpperCase();
  const city = document.getElementById('db-city').value.trim();
  const msg  = document.getElementById('upload-msg');

  if (!code || !city) {
    msg.textContent = 'Bitte alle Felder ausfüllen.';
    msg.className = 'text-danger';
    return;
  }

  try {
    await setDoc(doc(db, 'plates', code), { city });
    msg.textContent = `"${code}" wurde eingetragen.`;
    msg.className = 'text-success';
    document.getElementById('db-code').value = '';
    document.getElementById('db-city').value = '';
  } catch (e) {
    msg.textContent = e.message;
    msg.className = 'text-danger';
  }
};
