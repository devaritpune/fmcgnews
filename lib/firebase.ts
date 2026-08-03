import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Public Firebase Config for Client-side operations
const firebaseConfig = {
  projectId: "fmcgdesk", // Your Firebase Project ID
  // Add additional config options here if using Web Auth or Storage later
};

// Prevent re-initializing app during Next.js hot-reloading
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);