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

const greeting = document.getElementById('user-greeting');
const btnLogout = document.getElementById('btn-logout');

onAuthStateChanged(auth, async user => {
  if (!user) return location.href = 'index.html';
  const uDoc = await getDoc(doc(db, 'users', user.uid));
  const name = uDoc.exists() ? uDoc.data().username : '';
  greeting.textContent = `Hallo, ${name}!`;
});

btnLogout.onclick = () =>
  signOut(auth).then(() => location.href = 'index.html');
