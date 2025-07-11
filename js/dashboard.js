// js/dashboard.js
import { auth } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js';

// Auth-Guard: nicht eingeloggt → zurück zum Login
onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'index.html';
  }
});

// Logout-Button
document.getElementById('btn-logout').onclick = () => {
  signOut(auth).then(() => window.location.href = 'index.html');
};
