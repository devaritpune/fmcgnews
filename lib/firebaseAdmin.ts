import { getApps, initializeApp, cert } from "firebase-admin/app";

if (!getApps().length) {
  let serviceAccount: any = undefined;

  try {
    // Dynamic require wrapped in try-catch so it won't break on CI/CD
    serviceAccount = require("../serviceAccountKey.json");
  } catch (e) {
    serviceAccount = undefined;
  }

  if (serviceAccount) {
    initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    initializeApp();
  }
}