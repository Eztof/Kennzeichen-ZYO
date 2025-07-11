// js/dashboard.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js';

const btnLogout = document.getElementById('btn-logout');
const versionEl = document.getElementById('app-version');

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.href = 'index.html';
    return;
  }
  // Version holen
  const vDoc = await getDoc(doc(db, 'infos', 'webapp'));
  versionEl.textContent = vDoc.exists() ? vDoc.data().version : 'unbekannt';
});

btnLogout.onclick = () =>
  signOut(auth).then(() => location.href = 'index.html');
