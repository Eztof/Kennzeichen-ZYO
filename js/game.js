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
  query,
  getDocs,
  collection,
  serverTimestamp,
  increment
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js';

// UI-Elemente
const navUpload = document.getElementById('nav-upload');
const btnImport = document.getElementById('btn-import');
const uploadMsg = document.getElementById('upload-msg');

// Auth & Admin-Check
onAuthStateChanged(auth, async user => {
  if (!user) return location.href = 'index.html';
  const u = await getDoc(doc(db, 'users', user.uid));
  if (u.exists() && u.data().username === 'Eztof_1') {
    navUpload.classList.remove('d-none');
  }
});

// Logout
document.getElementById('btn-logout').onclick = () =>
  signOut(auth).then(() => location.href = 'index.html');

// Navigation
const views = document.querySelectorAll('.view');
document.querySelectorAll('.nav-link').forEach(a => {
  a.onclick = e => {
    e.preventDefault();
    const v = a.dataset.view;
    views.forEach(x =>
      x.id === 'view-'+v ? x.classList.remove('d-none') : x.classList.add('d-none')
    );
    if (v==='punktestand') loadScore();
    if (v==='karte')      loadMap();
  };
});

// Picken (unverändert)
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
    msg.textContent='';
    inp.value='';
    inp.classList.remove('border-success','border-danger');
  },1500);
};

// Punktestand (unverändert)
async function loadScore() {
  // ...
}

// Karte mit Debug und Kreisen-GeoJSON
let mapLoaded = false;
async function loadMap() {
  console.log('loadMap() called');
  if (mapLoaded) {
    console.log('Karte bereits geladen');
    return;
  }
  mapLoaded = true;

  // 1) Karte initialisieren
  const map = L.map('map').setView([51.1657, 10.4515], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OSM'
  }).addTo(map);

  // 2) GeoJSON laden
  try {
    console.log('Fetch counties.geojson …');
    const res = await fetch('data/counties.geojson');
    console.log('Fetch status:', res.status);
    if (!res.ok) throw new Error('HTTP '+res.status);
    const geojson = await res.json();
    console.log('GeoJSON geladen, Features:', geojson.features.length);

    // 3) alle gepickten Städte in ein Set
    const picksSnap = await getDocs(query(collectionGroup(db,'picks')));
    const usedCities = new Set();
    for (const d of picksSnap.docs) {
      const code = d.id;
      const pd   = await getDoc(doc(db,'plates',code));
      if (pd.exists()) usedCities.add(pd.data().city);
    }
    console.log('Used cities:', Array.from(usedCities));

    // 4) Layer hinzufügen
    L.geoJSON(geojson, {
      style: f => {
        const name = f.properties.NAME_3;
        const fill = usedCities.has(name);
        return {
          color: '#444', weight:1,
          fillColor: fill?'#32a852':'#ddd',
          fillOpacity: fill?0.7:0.3
        };
      }
    }).addTo(map);

    // 5) Damit Leaflet nach Anzeige rechnet
    setTimeout(() => map.invalidateSize(), 0);

  } catch (e) {
    console.error('Fehler beim Laden der GeoJSON:', e);
  }
}
