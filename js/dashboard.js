// js/dashboard.js
import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js';
import {
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js';

const greeting   = document.getElementById('user-greeting');
const btnLogout  = document.getElementById('btn-logout');
const versionEl  = document.getElementById('app-version');

onAuthStateChanged(auth, async user => {
  if (!user) {
    // nicht eingeloggt → zurück zur Login-Seite
    location.href = 'index.html';
    return;
  }

  // Nutzer-Profil holen
  const uDoc = await getDoc(doc(db, 'users', user.uid));
  const name = uDoc.exists() ? uDoc.data().username : '–';
  greeting.textContent = `Hallo, ${name}!`;

  // Version aus Firestore lesen
  const vDoc = await getDoc(doc(db, 'infos', 'webapp'));
  if (vDoc.exists()) {
    versionEl.textContent = vDoc.data().version;
  } else {
    versionEl.textContent = 'unbekannt';
  }
});

btnLogout.onclick = () =>
  signOut(auth).then(() => location.href = 'index.html');
