// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-app.js";
import { getAuth }         from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";
import { getFirestore }    from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDh-dzAPRQfywuodoNDVhkMZ1lMqNthklQ",
  authDomain: "kennzeichen-zyo.firebaseapp.com",
  projectId: "kennzeichen-zyo",
  storageBucket: "kennzeichen-zyo.firebasestorage.app",
  messagingSenderId: "1085712398684",
  appId: "1:1085712398684:web:199995c531dcac69eb2999",
  measurementId: "G-PZP456X5BZ"
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
