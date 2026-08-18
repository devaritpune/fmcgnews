import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import Parser from "rss-parser";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { createRequire } from "module";
import fetch from "node-fetch";

dotenv.config();
const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// 1. FIREBASE ADMIN INITIALIZATION
// ---------------------------------------------------------------------------
let canRunFirestore = true;
let serviceAccount = null;
if (!getApps().length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } catch (e) {
      console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT_KEY exists but is invalid JSON:", e.message);
      canRunFirestore = false;
    }
  } else {
    try {
      serviceAccount = require("../serviceAccountKey.json");
    } catch (e) {
      console.warn("⚠️ Missing Firebase credentials. Firestore writes will be skipped.");
      canRunFirestore = false;
    }
  }

  if (serviceAccount) {
    try {
      initializeApp({ credential: cert(serviceAccount) });
    } catch (e) {
      console.warn("⚠️ Failed to initialize Firebase Admin SDK:", e.message);
      canRunFirestore = false;
    }
  }
}

const db = canRunFirestore ? getFirestore() : null;
const parser = new Parser({ requestOptions: { headers: { "User-Agent": "Mozilla/5.0" } } });

// ---------------------------------------------------------------------------
// 2. GEMINI AI INITIALIZATION
// ---------------------------------------------------------------------------
let genai = null;
let aiModel = null;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (GEMINI_API_KEY) {
  try {
    genai = new GoogleGenerativeAI(GEMINI_API_KEY);
    aiModel = genai.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    console.log("✅ Gemini AI initialized");
  } catch (e) {
    console.warn("⚠️ Gemini initialization failed:", e.message);
  }
}

// ---------------------------------------------------------------------------
// 3. FMCG CATEGORIES & NEWS SOURCES
// ---------------------------------------------------------------------------
const FMCG_CATEGORIES = {
  "Spices & Pickles": {
    emoji: "🌶️",
    keywords: ["spices", "pickle", "masala", "turmeric", "cumin", "chilli"],
    regions: ["North India", "South India", "East India", "West India"],
  },
  "Dairy & Beverages": {
    emoji: "🥛",
    keywords: ["dairy", "milk", "beverage", "juice", "soft drink"],
    regions: ["North India", "South India", "West India"],
  },
  "Oils & Ghee": {
    emoji: "🍳",
    keywords: ["edible oil", "ghee", "cooking oil", "sunflower oil", "mustard oil"],
    regions: ["North India", "West India"],
  },
  "Personal Care": {
    emoji: "🧴",
    keywords: ["personal care", "soap", "shampoo", "toothpaste", "cosmetics"],
    regions: ["National"],
  },
  "Snacks & Confectionery": {
    emoji: "🍿",
    keywords: ["snacks", "biscuits", "chocolate", "candy", "wafers"],
    regions: ["National"],
  },
};

const NEWS_OUTLETS = [
  "https://economictimes.indiatimes.com/rss.cms",
  "https://www.business-standard.com/rss/",
  "https://feeds.bloomberg.com/news/news.rss",
];

// ---------------------------------------------------------------------------
// 4. UTILITY FUNCTIONS
// ---------------------------------------------------------------------------
async function analyzeWithGemini(headline, description, categoryName, categoryEmoji) {
  const fallbackData = {
    category: categoryEmoji,
    categoryName: categoryName,
    riskLevel: "MEDIUM",
    summary: (description || headline).substring(0, 200),
    business_advisory: {
      qa_compliance: "Monitor quality compliance requirements.",
      supply_chain: "Evaluate supply chain implications.",
      export_strategy: "Review export opportunities.",
    },
    actionAdvisory: `Monitor ${categoryName} market developments.`,
  };

  if (!aiModel) return fallbackData;

  try {
    const prompt = `Analyze this FMCG news for ${categoryName}:
    Headline: ${headline}
    Description: ${description}
    
    Return ONLY valid JSON with these fields:
    - category: "${categoryEmoji}"
    - categoryName: "${categoryName}"
    - riskLevel: "HIGH", "MEDIUM", or "LOW"
    - summary: Two-sentence summary
    - business_advisory: {qa_compliance, supply_chain, export_strategy}
    - actionAdvisory: One C-level action`;

    const response = await aiModel.generateContent(prompt);
    const text = response.response.text();
    
    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return fallbackData;
  } catch (error) {
    console.warn("⚠️ Gemini analysis failed:", error.message);
    return fallbackData;
  }
}

async function fetchOutletNews(feedUrl, categoryName, categoryEmoji) {
  const articles = [];
  try {
    console.log(`  📰 Fetching from ${feedUrl}...`);
    const feed = await parser.parseURL(feedUrl);
    
    for (const item of (feed.items || []).slice(0, 10)) {
      const title = item.title || "";
      const description = item.content || item.contentSnippet || item.description || "";
      const link = item.link || "";
      const pubDate = item.pubDate || new Date().toISOString();

      if (!title || !link) continue;

      // Check if article is relevant to category keywords
      const content = (title + " " + description).toLowerCase();
      const keywords = FMCG_CATEGORIES[categoryName]?.keywords || [];
      const isRelevant = keywords.some((kw) => content.includes(kw));

      if (isRelevant) {
        articles.push({
          title,
          description: description.substring(0, 500),
          url: link,
          source: feedUrl,
          publishedDate: pubDate,
          category: categoryName,
          categoryEmoji,
        });
      }
    }
    console.log(`     → Found ${articles.length} relevant articles`);
  } catch (error) {
    console.error(`  ❌ Error fetching ${feedUrl}:`, error.message);
  }
  return articles;
}

async function saveToFirestore(article, sequence) {
  if (!db) {
    console.log("    ⏭️  Dry run (no Firestore)");
    return;
  }

  try {
    const docId = `ART_${new Date().toISOString().split("T")[0].replace(/-/g, "_")}_${String(sequence).padStart(3, "0")}`;
    const aiData = await analyzeWithGemini(
      article.title,
      article.description,
      article.category,
      article.categoryEmoji
    );

    const docPayload = {
      title: article.title,
      summary: aiData.summary,
      category: aiData.category,
      categoryName: aiData.categoryName,
      riskLevel: aiData.riskLevel,
      source: new URL(article.source).hostname,
      url: article.url,
      region: "National",
      timestamp: new Date(),
      createdDate: new Date().toISOString(),
      business_advisory: aiData.business_advisory,
      actionAdvisory: aiData.actionAdvisory,
    };

    await db.collection("bulletins").doc(docId).set(docPayload);
    console.log(`    ✅ Saved: ${docId}`);
    return docId;
  } catch (error) {
    console.error("    ❌ Firestore error:", error.message);
  }
}

// ---------------------------------------------------------------------------
// 5. MAIN EXECUTION
// ---------------------------------------------------------------------------
async function main() {
  console.log("\n🚀 Starting Node.js FMCG News Scraper (Backup)...\n");

  let totalProcessed = 0;
  let totalSkipped = 0;

  for (const [categoryName, categoryInfo] of Object.entries(FMCG_CATEGORIES)) {
    console.log(`📂 Category: ${categoryInfo.emoji} ${categoryName}`);

    let categoryCount = 0;
    for (const outlet of NEWS_OUTLETS) {
      const articles = await fetchOutletNews(outlet, categoryName, categoryInfo.emoji);
      
      for (const article of articles) {
        totalProcessed++;
        categoryCount++;
        await saveToFirestore(article, totalProcessed);
        
        // Rate limiting
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    console.log(`  ✅ ${categoryName}: ${categoryCount} articles\n`);
  }

  console.log("=".repeat(80));
  console.log(`✨ Scraping Complete: ${totalProcessed} articles processed`);
  console.log("=".repeat(80) + "\n");
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});


// ---------------------------------------------------------------------------
// 2. GEMINI AI INITIALIZATION
// ---------------------------------------------------------------------------
const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;
if (!apiKey) {
  console.warn("⚠️ GEMINI_API_KEY not set — running ingestion without AI summarization. Will use feed snippets as fallback.");
} else {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
  } catch (e) {
    console.warn("⚠️ Failed to initialize Gemini AI client:", e);
    genAI = null;
  }
}

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

// STRICT KEYWORD SET for Category: Spices & Pickles
const TARGET_KEYWORDS = [
  "spice",
  "spices",
  "pickle",
  "pickles",
  "turmeric",
  "cumin",
  "masala",
  "mdh",
  "everest",
  "powdered spice",
  "ground spice",
  "spice company",
  "spice mill",
  "masaledar",
  "achaar",
  "pickle plant",
  "spice exports",
];

function matchesTargetKeywords(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return TARGET_KEYWORDS.some((kw) => lower.includes(kw));
}

// ---------------------------------------------------------------------------
// 4. MAIN SCRAPING AND INGESTION PIPELINE
// ---------------------------------------------------------------------------
async function runDailyIngestion() {
  console.log("🚀 Starting Daily FMCG & IB News Ingestion Pipeline...");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  let totalSaved = 0;
  let totalSkipped = 0;
  let totalFiltered = 0;
  let totalErrors = 0;

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

        // Strict topical filter: only process articles that mention our target keywords
        const checkText = `${item.title || ""} ${item.contentSnippet || ""} ${item.content || ""}`;
        if (!matchesTargetKeywords(checkText)) {
          totalFiltered++;
          // skip non-target articles
          continue;
        }

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
          let aiData = null;
          if (genAI) {
            try {
              const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
              const result = await model.generateContent(prompt);
              const rawText = result.response.text().trim();
              const cleanJson = rawText.replace(/```json|```/g, "").trim();
              aiData = JSON.parse(cleanJson);
            } catch (aiErr) {
              console.warn(` ⚠️ AI Processing Error for "${item.title}":`, aiErr);
              aiData = null;
            }
          }

          const publishedDate = item.pubDate ? new Date(item.pubDate) : new Date();

          // Fallback values when AI is not available
          const category = (aiData && aiData.category) || "Spices & Pickles";
          const sub_category = (aiData && aiData.sub_category) || "Domestic Market";
          const market_scope = (aiData && aiData.market_scope) || "Domestic";
          const target_regions = (aiData && aiData.target_regions) || ["Pan-India"];
          const region = (aiData && aiData.origin_region) || "Pan-India";
          const summary = (aiData && aiData.summary_en) || item.contentSnippet || item.title;
          const key_takeaway = (aiData && aiData.key_takeaway) || "";
          const regulatory_update = Boolean(aiData && aiData.regulatory_update);
          const sentiment = (aiData && aiData.sentiment) || "Neutral";

          // Write Document to Firestore
          await db.collection("news_articles").add({
            title: item.title,
            category,
            sub_category,
            market_scope,
            target_regions,
            region,
            summary,
            key_takeaway,
            regulatory_update,
            sentiment,
            source_name: "Google News / FMCG Desk",
            source_url: item.link,
            published_at: publishedDate.toISOString(),
            published_timestamp: Math.floor(publishedDate.getTime() / 1000),
            createdAt: new Date().toISOString(),
          });

          totalSaved++;
          console.log(` ✅ Saved [${sub_category}]: ${item.title.substring(0, 65)}...`);
        } catch (err) {
          console.error(` ❌ Failed to save article "${item.title}":`, err);
        }
      }
    } catch (rssErr) {
      console.error(`❌ Error parsing RSS feed for query "${searchQuery}":`, rssErr);
      totalErrors++;
    }
  }

  console.log(`\n🎉 Ingestion Complete! ${totalSaved} new articles saved, ${totalSkipped} duplicates skipped, ${totalFiltered} non-target articles filtered out. Errors: ${totalErrors}`);

  return { totalSaved, totalSkipped, totalFiltered, totalErrors };
}

// Run and ensure graceful exit. Catch unexpected errors so GitHub Action doesn't fail intermittently.
(async () => {
  try {
    if (!db) {
      console.warn("⚠️ Firestore client not available — skipping ingestion run.");
      // Exit successfully to avoid failing workflows when credentials are not provided.
      process.exit(0);
    }

    const result = await runDailyIngestion();

    // Update ingestion status in Firestore for monitoring
    try {
      if (db) {
        const runDoc = db.collection("ingestion_status").doc("last_run");
        await runDoc.set({
          timestamp: new Date().toISOString(),
          saved: result?.totalSaved || 0,
          skipped: result?.totalSkipped || 0,
          errors: result?.totalErrors || 0,
          status: "success",
          run_id: process.env.GITHUB_RUN_ID || null,
          commit: process.env.GITHUB_SHA || null,
        });
        console.log("✅ Updated ingestion_status/last_run in Firestore.");
      }
    } catch (e) {
      console.warn("⚠️ Failed to write ingestion status to Firestore:", e);
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Unhandled error during ingestion run:", err);
    try {
      if (db) {
        const runDoc = db.collection("ingestion_status").doc("last_run");
        await runDoc.set({
          timestamp: new Date().toISOString(),
          saved: 0,
          skipped: 0,
          errors: 1,
          status: "failure",
          errorMessage: String(err).slice(0, 1000),
          run_id: process.env.GITHUB_RUN_ID || null,
          commit: process.env.GITHUB_SHA || null,
        });
        console.log("✅ Wrote failure status to ingestion_status/last_run in Firestore.");
      }
    } catch (e) {
      console.warn("⚠️ Failed to write failure status to Firestore:", e);
    }
    // Exit 0 to avoid marking the entire workflow as failed for transient/script-level errors.
    process.exit(0);
  }
})();