import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. Verify required environment variables
const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'GEMINI_API_KEY',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required secret: ${envVar}`);
    process.exit(1);
  }
}

// 2. Initialize Firebase Admin cleanly in ESM
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function runDailyIngestion() {
  console.log("🚀 Starting daily FMCG news ingestion...");

  const category = "Spices & Pickles";
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Act as an FMCG Market Intelligence Analyst.
  Generate 2 daily executive market bulletin updates for the Indian FMCG category "${category}" as of today.
  
  Return STRICTLY a raw JSON array of objects with no markdown formatting or code blocks.
  Required keys per object:
  - title (string): Professional news headline
  - category (string): "${category}"
  - region (string): One of ["West", "North", "South", "East", "National"]
  - summary (string): 2-3 concise sentences on market or consumer trends
  - full_content (string): Detailed 1-paragraph overview
  - key_takeaway (string): Strategic insight for brand executives
  - published_at (string): YYYY-MM-DD
  `;

  try {
    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();
    
    // Clean markdown code blocks if returned
    responseText = responseText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

    const articles = JSON.parse(responseText);

    for (const article of articles) {
      const docRef = await db.collection('news_articles').add({
        ...article,
        createdAt: FieldValue.serverTimestamp(),
      });
      console.log(`✅ Ingested Bulletin: "${article.title}" (ID: ${docRef.id})`);
    }
    console.log("🎉 All daily bulletins successfully ingested!");
  } catch (error) {
    console.error("❌ Failed to ingest daily news:", error);
    process.exit(1);
  }
}

runDailyIngestion();