import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDqR0DP4G4f6Trl4mpG7rA8I_ZlUMnJAQ4",
  authDomain: "pawtelligent-app.firebaseapp.com",
  projectId: "pawtelligent-app",
  storageBucket: "pawtelligent-app.firebasestorage.app",
  messagingSenderId: "700856815402",
  appId: "1:700856815402:web:f8e61e4d61f8794a0e1853",
  measurementId: "G-S4K6L5KZ3P"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app)

// Initialize Storage
export const storage = getStorage(app);

export{auth,db}