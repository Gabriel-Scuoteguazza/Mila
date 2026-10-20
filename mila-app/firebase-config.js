import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDeKN-nOTTRrA4HGHyLVW0qUx3NjYt-Pxw",
  authDomain: "mila-25b4c.firebaseapp.com",
  databaseURL: "https://mila-25b4c-default-rtdb.firebaseio.com",
  projectId: "mila-25b4c",
  storageBucket: "mila-25b4c.firebasestorage.app",
  messagingSenderId: "772128157833",
  appId: "1:772128157833:web:62cc9bb8215b66e67f5658",
  measurementId: "G-7MPGPC695F"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

export { database, auth };