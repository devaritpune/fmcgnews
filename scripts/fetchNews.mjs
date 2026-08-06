import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import Parser from "rss-parser";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { createRequire } from "module";

dotenv.config();
const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// 1. FIREBASE ADMIN INITIALIZATION
// ---------------------------------------------------------------------------
if (!getApps().length) {
  let serviceAccount;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    // Used in GitHub Actions (Passed as JSON string)
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } else {
    // Used for Local Testing (Requires serviceAccountKey.json in project root)
    try {
      serviceAccount = require("../serviceAccountKey.json");
    } catch (e) {
      console.error(
        "❌ Missing Firebase Service Account! Set FIREBASE_SERVICE_ACCOUNT_KEY env variable or add serviceAccountKey.json in root folder."
      );
      process.exit(1);
    }
  }

  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();
const parser = new Parser();

// ---------------------------------------------------------------------------
// 2. GEMINI AI INITIALIZATION
// ---------------------------------------------------------------------------
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ Missing GEMINI_API_KEY environment variable!");
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(apiKey);

// ---------------------------------------------------------------------------
// 3. TARGETED RSS QUERIES (Domestic + International Business/Export Focus)
// ---------------------------------------------------------------------------
const SEARCH_QUERIES = [
  // Domestic FMCG & Spices Focus (15-day window)
  'FMCG "spices" OR "pickles" India price market sales when:15d',
  // Export & International Business (IB) Focus
  'FMCG spice export India APEDA FSSAI regulation tariff international market when:15d',
  // General FMCG Category Trends
  'India FMCG consumer trends distribution retail when:15d',
];

// ---------------------------------------------------------------------------
// 4. MAIN SCRAPING AND INGESTION PIPELINE
// ---------------------------------------------------------------------------
async function runDailyIngestion() {
  console.log("🚀 Starting Daily FMCG & IB News Ingestion Pipeline...");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  let totalSaved = 0;
  let totalSkipped = 0;

  for (const searchQuery of SEARCH_QUERIES) {
    console.log(`\n🔍 Scraping Query: "${searchQuery}"`);
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
      searchQuery
    )}&hl=en-IN&gl=IN&ceid=IN:en`;

    try {
      const feed = await parser.parseURL(rssUrl);
      console.log(`📰 Found ${feed.items.length} raw articles in feed.`);

      for (const item of feed.items) {
        if (!item.link || !item.title) continue;

        // Deduplication Check: Skip if article URL already exists in Firestore
        const existingDoc = await db
          .collection("news_articles")
          .where("source_url", "==", item.link)
          .limit(1)
          .get();

        if (!existingDoc.empty) {
          totalSkipped++;
          continue;
        }

        // Prompt Gemini AI to categorize & format article for Executive Desk
        const prompt = `
You are an executive FMCG analyst evaluating news for executive leaders and International Business (IB) export directors.
Analyze this news headline and snippet:

Headline: "${item.title}"
Snippet: "${item.contentSnippet || ""}"

Respond ONLY with a valid JSON object matching this structure (no markdown formatting, no extra text):
{
  "category": "Spices & Pickles",
  "sub_category": "Must be exactly one of: 'IB - International Business', 'Domestic Market', 'Regulatory & Compliance', 'Raw Materials & Supply'",
  "market_scope": "Export or Domestic",
  "target_regions": ["Array of countries/regions mentioned e.g. GCC, EU, US, Pan-India"],
  "origin_region": "One of: North, South, East, West, Pan-India",
  "summary_en": "Concise 2-sentence executive summary.",
  "key_takeaway": "1 sharp strategic recommendation for business leaders.",
  "regulatory_update": true or false,
  "sentiment": "Bullish, Bearish, or Neutral"
}
`;

        try {
          const result = await model.generateContent(prompt);
          const rawText = result.response.text().trim();
          const cleanJson = rawText.replace(/```json|```/g, "").trim();
          const aiData = JSON.parse(cleanJson);

          const publishedDate = item.pubDate ? new Date(item.pubDate) : new Date();

          // Write Document to Firestore
          await db.collection("news_articles").add({
            title: item.title,
            category: aiData.category || "Spices & Pickles",
            sub_category: aiData.sub_category || "Domestic Market",
            market_scope: aiData.market_scope || "Domestic",
            target_regions: aiData.target_regions || ["Pan-India"],
            region: aiData.origin_region || "Pan-India",
            summary: aiData.summary_en || item.contentSnippet || item.title,
            key_takeaway: aiData.key_takeaway || "",
            regulatory_update: Boolean(aiData.regulatory_update),
            sentiment: aiData.sentiment || "Neutral",
            source_name: "Google News / FMCG Desk",
            source_url: item.link,
            published_at: publishedDate.toISOString(),
            published_timestamp: Math.floor(publishedDate.getTime() / 1000),
            createdAt: new Date().toISOString(),
          });

          totalSaved++;
          console.log(` ✅ Saved [${aiData.sub_category}]: ${item.title.substring(0, 65)}...`);
        } catch (aiErr) {
          console.error(` ⚠️ AI Processing Error for "${item.title}":`, aiErr);
        }
      }
    } catch (rssErr) {
      console.error(`❌ Error parsing RSS feed for query "${searchQuery}":`, rssErr);
    }
  }

  console.log(`\n🎉 Ingestion Complete! ${totalSaved} new articles saved, ${totalSkipped} duplicates skipped.`);
}

runDailyIngestion();