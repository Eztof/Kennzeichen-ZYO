// js/game.js
import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";
import {
  doc, setDoc, getDoc,
  collection, collectionGroup,
  query, where, getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

// --- Auth-Guard & Logout ---
onAuthStateChanged(auth, user => {
  if (!user) location.href = 'index.html';
});
document.getElementById('btn-logout').onclick = () => {
  signOut(auth).then(() => location.href = 'index.html');
};

// --- Navigation ---
const views = document.querySelectorAll('.view');
document.querySelectorAll('.nav-link').forEach(a => {
  a.onclick = e => {
    e.preventDefault();
    const v = a.dataset.view;
    views.forEach(x => x.id === 'view-'+v ? x.classList.remove('d-none') : x.classList.add('d-none'));
    // load on-demand
    if (v === 'punktestand') loadScore();
    if (v === 'karte')      loadMap();
  };
});

// --- Picken ---
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

// --- Punktestand berechnen ---
async function loadScore() {
  const list = document.getElementById('score-list');
  list.innerHTML = 'Lade…';
  // alle Pick-Dokumente
  const q = query(collectionGroup(db, 'picks'));
  const snaps = await getDocs(q);
  const counts = {}; let names = {};
  for (let docSnap of snaps) {
    const uid = docSnap.ref.parent.parent.id;
    counts[uid] = (counts[uid]||0) + 1;
  }
  // Nutzernamen holen
  for (let uid of Object.keys(counts)) {
    const uDoc = await getDoc(doc(db, 'users', uid));
    names[uid] = uDoc.exists() ? uDoc.data().username : uid;
  }
  // sortiert ausgeben
  const arr = Object.entries(counts)
    .sort((a,b)=>b[1]-a[1]);
  list.innerHTML = '';
  arr.forEach(([uid, cnt]) => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between';
    li.textContent = names[uid];
    const span = document.createElement('span');
    span.textContent = cnt;
    li.append(span);
    list.append(li);
  });
  if (arr.length===0) list.innerHTML = '<li class="list-group-item">Noch keine Picks</li>';
}

// --- Karte (Leaflet + GeoJSON) ---
let mapLoaded = false;
async function loadMap() {
  if (mapLoaded) return;
  mapLoaded = true;
  // Leaflet CSS + JS nachladen
  await Promise.all([
    loadScript('https://unpkg.com/leaflet@1.9.3/dist/leaflet.js'),
    loadCSS('https://unpkg.com/leaflet@1.9.3/dist/leaflet.css')
  ]);
  const map = L.map('map').setView([51.33, 10.45], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ attribution: '&copy; OSM' }).addTo(map);

  // GeoJSON der Bundesländer manuell hochladen in /data/germany-states.geojson
  const geo = await fetch('/data/germany-states.geojson').then(r=>r.json());

  // Welche Bundesländer wurden gepickt?
  const picks = await getDocs(query(collectionGroup(db, 'picks')));
  const usedCodes = new Set(picks.docs.map(d=>d.id));
  const statesUsed = new Set();
  for (let code of usedCodes) {
    const p = await getDoc(doc(db, 'plates', code));
    if (p.exists()) statesUsed.add(p.data().state);
  }

  L.geoJSON(geo, {
    style: feature => ({
      color: '#444', weight:1,
      fillColor: statesUsed.has(feature.properties.NAME_1) ? '#58a' : '#ccc',
      fillOpacity: 0.7
    })
  }).addTo(map);
}

// Hilfsfunktionen für dynamisches Nachladen
function loadScript(src) {
  return new Promise(r=>{
    const s=document.createElement('script');
    s.src=src; s.onload=r;
    document.head.append(s);
  });
}
function loadCSS(href) {
  return new Promise(r=>{
    const l=document.createElement('link');
    l.rel='stylesheet'; l.href=href; l.onload=r;
    document.head.append(l);
  });
}

// --- Upload DB ---
document.getElementById('btn-upload').onclick = async () => {
  const code  = document.getElementById('db-code').value.trim().toUpperCase();
  const city  = document.getElementById('db-city').value.trim();
  const state = document.getElementById('db-state').value;
  const msg   = document.getElementById('upload-msg');
  if (!code||!city) {
    msg.textContent = 'Bitte alle Felder ausfüllen.';
    msg.className = 'text-danger';
    return;
  }
  try {
    await setDoc(doc(db, 'plates', code), { city, state });
    msg.textContent = `"${code}" wurde eingetragen.`;
    msg.className = 'text-success';
    document.getElementById('db-code').value =
      document.getElementById('db-city').value = '';
  } catch (e) {
    msg.textContent = e.message;
    msg.className = 'text-danger';
  }
};
