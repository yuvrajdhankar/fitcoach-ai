// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// Your config
const firebaseConfig = {
  apiKey: "AIzaSyA5hshGyHb8FZsaXEMI711JceM3lx-gkpA",
  authDomain: "fitcoach-ai-3892a.firebaseapp.com",
  projectId: "fitcoach-ai-3892a",
  storageBucket: "fitcoach-ai-3892a.appspot.com",
  messagingSenderId: "354669060783",
  appId: "1:354669060783:web:0a857883632ed02355ea5a"
};

// Initialize
const app = initializeApp(firebaseConfig);

// Services
const auth = getAuth(app);
const db = getFirestore(app);

// Export
export { auth, db };