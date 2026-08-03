import * as admin from "firebase-admin";

if (!admin.apps.length) {
  // Use environment variables if available, otherwise fallback to local file if present
  let serviceAccount;
  try {
    serviceAccount = require("../serviceAccountKey.json");
  } catch (e) {
    // Falls back gracefully on GitHub Actions build server
    serviceAccount = undefined;
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    admin.initializeApp();
  }
}

export { admin };