// js/auth.js
import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

const loginForm    = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegLink  = document.getElementById('show-register');
const showLogLink  = document.getElementById('show-login');
const errDiv       = document.getElementById('auth-error');

// 1) Formular-Umschaltung Login ↔ Registrierung
showRegLink.onclick = e => {
  e.preventDefault();
  loginForm.classList.add('d-none');
  registerForm.classList.remove('d-none');
  errDiv.textContent = '';
};
showLogLink.onclick = e => {
  e.preventDefault();
  registerForm.classList.add('d-none');
  loginForm.classList.remove('d-none');
  errDiv.textContent = '';
};

// 2) Local Persistence, damit das Gerät eingeloggt bleibt
setPersistence(auth, browserLocalPersistence);

// 3) Registrierung
registerForm.addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const email    = `${username}@kennzeichen-zyo.local`; // Dummy-Email

  try {
    // a) User anlegen und einloggen
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // b) Firestore-Profil mit echtem Nutzernamen
    await setDoc(
      doc(db, 'users', cred.user.uid),
      {
        username: username,
        created: serverTimestamp()
      }
    );

    // c) erst danach zur Spielseite
    window.location.href = 'game.html';

  } catch (err) {
    errDiv.textContent = err.message;
  }
});

// 4) Login
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const email    = `${username}@kennzeichen-zyo.local`;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = 'game.html';
  } catch (err) {
    errDiv.textContent = err.message;
  }
});
