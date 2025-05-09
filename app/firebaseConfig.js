import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyDqR0DP4G4f6Trl4mpG7rA8I_ZlUMnJAQ4",
  authDomain: "pawtelligent-app.firebaseapp.com",
  projectId: "pawtelligent-app",
  storageBucket: "pawtelligent-app.firebasestorage.app",
  messagingSenderId: "700856815402",
  appId: "1:700856815402:web:f8e61e4d61f8794a0e1853",
  measurementId: "G-S4K6L5KZ3P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence for React Native
const auth = Platform.OS === 'web' 
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };

// Simple component for Expo Router
export default function FirebaseConfig() {
  return null;
}