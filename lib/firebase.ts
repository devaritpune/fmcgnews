import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDgIZDH7Vf2P8FziyDzL8136MV0fGZqK-o",
  authDomain: "fmcgdesk.firebaseapp.com",
  projectId: "fmcgdesk",
  storageBucket: "fmcgdesk.firebasestorage.app",
  messagingSenderId: "654355276633",
  appId: "1:654355276633:web:7bdcf60ff65bf83ac12248",
  measurementId: "G-78JSBYHY61"
};

// Initialize Firebase safely to prevent duplicate apps during hot-reloads
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

// Initialize Analytics safely (only runs if supported in the browser environment)
export let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}