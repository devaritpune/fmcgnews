import dotenv from "dotenv";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "module";

dotenv.config();
const require = createRequire(import.meta.url);

let serviceAccount = null;
let canRun = true;

if (!getApps().length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } catch (e) {
      console.error("FIREBASE_SERVICE_ACCOUNT_KEY invalid JSON:", e);
      canRun = false;
    }
  } else {
    try {
      serviceAccount = require("../serviceAccountKey.json");
    } catch (e) {
      console.error("Missing Firebase service account key. Provide FIREBASE_SERVICE_ACCOUNT_KEY or serviceAccountKey.json in repo root.");
      canRun = false;
    }
  }

  if (serviceAccount) {
    try {
      initializeApp({ credential: cert(serviceAccount) });
    } catch (e) {
      console.error("Failed to initialize Firebase Admin SDK:", e);
      canRun = false;
    }
  }
}

const db = canRun ? getFirestore() : null;

async function dryRun() {
  console.log("Running dry-run: counting documents in 'bulletins'...");
  const snapshot = await db.collection("bulletins").get();
  console.log(`Found ${snapshot.size} documents in 'bulletins'.`);
  if (snapshot.size > 0) {
    console.log("Sample doc ids:");
    snapshot.docs.slice(0, 10).forEach((d) => console.log(` - ${d.id}`));
  }
}

async function deleteAll() {
  console.log("Deleting all documents in 'bulletins' collection in batches of 500...");
  const batchSize = 500;
  let totalRemoved = 0;

  while (true) {
    const snapshot = await db.collection("bulletins").limit(batchSize).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    totalRemoved += snapshot.size;
    console.log(`Deleted batch of ${snapshot.size} documents. Total removed: ${totalRemoved}`);
  }

  console.log(`Done. Total documents deleted: ${totalRemoved}`);
}

(async () => {
  if (!db) {
    console.error("Firestore client not available. Exiting.");
    process.exit(1);
  }

  const confirm = (process.env.CONFIRM_DELETE || "false").toLowerCase();
  if (confirm !== "true") {
    console.log("CONFIRM_DELETE is not set to 'true' — performing dry-run only. To delete, set CONFIRM_DELETE=true in env.");
    await dryRun();
    process.exit(0);
  }

  // Safety: require an explicit environment variable and non-production project check if possible
  const projectId = process.env.FIREBASE_PROJECT_ID || (serviceAccount && serviceAccount.project_id) || "";
  console.log(`Project detected: ${projectId}`);

  // Prevent accidental deletion of unknown/production projects unless FORCE_DELETE env is set
  const allow = process.env.FORCE_DELETE === "true" || projectId.includes("fmcgdesk");
  if (!allow) {
    console.error("Refusing to delete: project appears to be non-target or FORCE_DELETE not set. Set FORCE_DELETE=true to override.");
    process.exit(1);
  }

  try {
    await deleteAll();
    process.exit(0);
  } catch (e) {
    console.error("Error during deletion:", e);
    process.exit(1);
  }
})();
