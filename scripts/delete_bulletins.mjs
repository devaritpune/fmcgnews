import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Deletes all documents within a Firestore collection in batches.
 * @param {FirebaseFirestore.Firestore} db The Firestore database instance.
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy("__name__").limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

/**
 * Recursively deletes documents in a batch and schedules the next batch.
 * @param {FirebaseFirestore.Firestore} db The Firestore database instance.
 * @param {FirebaseFirestore.Query} query The query for the batch of documents to delete.
async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();

  if (snapshot.size === 0) {
    // When there are no documents left, we are done.
    resolve();
    return;
  }

  // Delete documents in a batch
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Recurse on the next process tick, to avoid hitting stack limits.
  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

async function main() {
  try {
    // Safety Check 1: Ensure deletion is explicitly confirmed.
    if (process.env.CONFIRM_DELETE !== "true") {
      console.error("❌ ABORTING: Deletion was not confirmed. Set CONFIRM_DELETE=true to proceed.");
      process.exit(1);
    }

    // Safety Check 2: Ensure the service account key is present.
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      console.error("❌ ABORTING: FIREBASE_SERVICE_ACCOUNT_KEY secret not found.");
      process.exit(1);
    }

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

    // Safety Check 3: Match Project ID unless forced.
    if (process.env.FORCE_DELETE !== "true" && serviceAccount.project_id !== process.env.FIREBASE_PROJECT_ID) {
      console.error(`❌ ABORTING: Project ID mismatch! Expected '${process.env.FIREBASE_PROJECT_ID}' but service account is for '${serviceAccount.project_id}'.`);
      process.exit(1);
    }

    console.log(`✅ Initializing connection to Firebase project: ${serviceAccount.project_id}`);
    initializeApp({ credential: cert(serviceAccount) });
    const db = getFirestore();

    console.log("🔥 Starting deletion of all documents in 'bulletins' collection...");
    await deleteCollection(db, "bulletins");
    console.log("✅ Successfully deleted all documents from 'bulletins' collection.");

    process.exit(0);
  } catch (error) {
    console.error("❌ An unexpected error occurred:", error);
    process.exit(1);
  }
}

main();

