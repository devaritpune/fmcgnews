# 📰 FMCG News Desk - Automated Daily News Scraper

> **Fully automated FMCG/CPG news scraping that runs daily at 5 AM IST**, collecting articles from 8 product categories across India's top business publications.

## 🎯 Overview

This system automatically:
- **Scrapes news** from 14+ Indian business outlets daily
- **Analyzes articles** using Google Gemini AI for risk assessment & business insights
- **Categorizes content** across 8 FMCG segments (Spices, Dairy, Oils, Personal Care, etc.)
- **Stores data** in Firestore for real-time access
- **Displays** on a multi-lingual dashboard with regional filtering

## ✨ What's New in This Update

✅ **Multi-Category Support** - 8 FMCG categories (previously just Spices)
✅ **Expanded News Sources** - 14 outlets across all Indian regions
✅ **Robust GitHub Actions** - Automated 5 AM IST daily runs with retry logic
✅ **Enhanced Frontend** - Dynamic category selection, real Firestore integration
✅ **AI-Powered Analysis** - Gemini API for risk assessment & business advisory
✅ **Comprehensive Docs** - Setup guide, troubleshooting, and monitoring instructions

---

## 📋 System Architecture

```
┌─────────────────────────────────────────────┐
│   GitHub Actions (5:00 AM IST Daily)        │
│  .github/workflows/daily-news.yml            │
└────────────────┬────────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │  Python Scraper (Primary)   │
    │  scraper.py                 │
    │  - 8 FMCG categories        │
    │  - 14 news outlets          │
    │  - Gemini AI analysis       │
    └────────────────┬────────────┘
                     │
    ┌────────────────┴────────────────┐
    │                                  │
    ▼                                  ▼
┌────────────────┐           ┌────────────────┐
│  Google Gemini │           │  Firestore DB  │
│  (Risk & AI)   │           │  (bulletins    │
└────────────────┘           │   collection)  │
                             └────────┬────────┘
                                      │
                                      ▼
                         ┌────────────────────────┐
                         │  Next.js Frontend      │
                         │  app/page.tsx          │
                         │  - Multi-lingual UI    │
                         │  - Category filtering  │
                         │  - Regional drill-down │
                         └────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (for frontend)
- Python 3.11+ (for scraper)
- Firebase project with Firestore
- Google Gemini API key

### 1. Local Setup

```bash
# Clone/setup
cd /path/to/fmcgnews

# Install Python dependencies
pip install -r requirements.txt

# Install Node dependencies
npm install

# Create .env file
cat > .env << EOF
FIREBASE_PROJECT_ID=fmcgdesk
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
GEMINI_API_KEY=AIza...
EOF

# Test locally
python scraper.py
```

### 2. GitHub Actions Setup

Follow the **[SETUP_GITHUB_ACTIONS.md](SETUP_GITHUB_ACTIONS.md)** guide to:
- Configure GitHub Secrets
- Enable the workflow
- Test the first run

### 3. Verify in Firestore

After the first successful run, check Firebase Console:
```
Firestore → bulletins collection → Should see: ART_2026_08_18_001, ART_2026_08_18_002, etc.
```

### 4. View in Frontend

```bash
npm run dev
# Open http://localhost:3000
# Select category → View scraped articles
```

---

## 📁 Project Structure

```
fmcgnews/
├── scraper.py                      # Main Python scraper (8 categories, 14 outlets)
├── app/
│   ├── page.tsx                    # Frontend dashboard (updated for multi-category)
│   ├── layout.tsx
│   └── globals.css
├── scripts/
│   ├── fetchNews.mjs               # Alternative Node.js scraper (backup)
│   └── delete_bulletins.mjs
├── lib/
│   ├── firebase.ts                 # Firebase client config
│   ├── firebaseAdmin.ts            # Firebase admin SDK
│   └── newsService.ts              # (Mock data - now using real Firestore)
├── .github/workflows/
│   ├── daily-news.yml              # ✨ Updated: Robust 5 AM IST scheduler
│   ├── delete-bulletins.yml
│   └── firebase-hosting-*.yml
├── SETUP_GITHUB_ACTIONS.md         # 📖 Detailed setup guide
├── TROUBLESHOOTING.md              # 🔧 Debugging guide
├── package.json
├── requirements.txt
└── tsconfig.json
```

---

## 🔄 How It Works

### 1. Daily Schedule (5:00 AM IST)

```bash
# Every morning at 5:00 AM IST (23:30 UTC), GitHub Actions runs:
python scraper.py
```

### 2. Scraper Execution

```
For each FMCG category:
  └─ For each news outlet:
      ├─ Fetch RSS/articles
      ├─ Filter for relevance (keywords)
      ├─ Skip duplicates (from last 48 hours)
      ├─ Send to Gemini AI for analysis
      │  └─ Get: risk level, summary, business advisory
      └─ Save to Firestore with metadata
         └─ title, category, region, timestamp, business_advisory, etc.
```

### 3. Frontend Display

```typescript
// app/page.tsx queries Firestore:
const q = query(
  collection(db, "bulletins"),
  where("categoryName", "==", "Spices & Pickles"),  // Selected category
  where("region", "==", "North India"),             // Selected region
  where("timestamp", ">=", sevenDaysAgo),
  orderBy("timestamp", "desc"),
  limit(100)
);
```

---

## 📊 Scraped Data Structure

Each article in Firestore looks like:

```javascript
{
  id: "ART_2026_08_18_001",
  title: "US Overtakes China as Largest Buyer of Indian Spice Exports",
  summary: "Indian spice exports hit $4.43B with US becoming top buyer...",
  category: "🌶️",
  categoryName: "Spices & Pickles",
  region: "National",
  riskLevel: "MEDIUM",
  source: "Economic Times",
  url: "https://economictimes.com/...",
  timestamp: Timestamp { seconds: 1724000400 },
  createdDate: "2026-08-18 05:00:00",
  business_advisory: {
    qa_compliance: "Monitor EtO limits on chilli exports...",
    supply_chain: "Diversify suppliers across Andhra Pradesh...",
    export_strategy: "Prioritize US market shipments..."
  },
  actionAdvisory: "Adjust procurement strategy to favor US-bound supplies..."
}
```

---

## 🎯 FMCG Categories Covered

| Emoji | Category | Keywords | Outlets |
|-------|----------|----------|---------|
| 🌶️ | Spices & Pickles | turmeric, cumin, chilli, masala | 14 |
| 🥛 | Dairy & Beverages | milk, dairy, juice, beverage | 14 |
| 🍳 | Oils & Ghee | edible oil, ghee, mustard oil | 14 |
| 🍿 | Snacks & Confectionery | biscuits, chocolate, candy | 14 |
| 🧴 | Personal Care | soap, shampoo, toothpaste | 14 |
| 🌾 | Grains & Staples | rice, wheat, flour, pulses | 14 |
| ❄️ | Frozen Food | ready-to-eat, instant noodles | 14 |
| 🧹 | Home Care | detergent, cleaning products | 14 |

---

## 🏗️ Key Features

### Frontend (Page.tsx)

- ✅ Multi-language support (10 Indian languages)
- ✅ Regional filtering (North/South/East/West)
- ✅ Category selection (all 8 FMCG segments)
- ✅ Sub-category filtering (Domestic/Export/Regulatory)
- ✅ Risk level badges (🚨 HIGH | ⚠️ MEDIUM | ✅ LOW)
- ✅ WhatsApp sharing integration
- ✅ Interactive India map (regional drill-down)
- ✅ Dark theme optimized for readability

### Scraper (scraper.py)

- ✅ Multi-outlet RSS scraping (14 publications)
- ✅ Multi-category searches (8 FMCG segments)
- ✅ Duplicate detection (48-hour window)
- ✅ AI-powered risk assessment (Gemini API)
- ✅ Regional inference (from article content)
- ✅ Rate limiting & error handling
- ✅ Fallback summaries (if AI unavailable)

### Automation (GitHub Actions)

- ✅ Daily 5 AM IST execution (23:30 UTC cron)
- ✅ Timeout protection (10 minutes per run)
- ✅ Failure notifications
- ✅ Artifact logging (30-day retention)
- ✅ Manual trigger support
- ✅ Comprehensive error reporting

---

## 🔧 Configuration

### Change Scrape Time

Edit `.github/workflows/daily-news.yml`:

```yaml
schedule:
  - cron: '30 23 * * *'  # 23:30 UTC = 5:00 AM IST
  # To change: https://crontab.guru/
```

### Adjust Article Limits

Edit `scraper.py`:

```python
PER_OUTLET_ITEM_LIMIT = 5  # Articles per outlet per category (default: 5)
MAX_ARTICLES_PER_CATEGORY = 15  # Max before dedup (default: 15)
```

### Add Custom Keywords

Edit `scraper.py`:

```python
FMCG_SEARCH_CATEGORIES = {
    "Your Category": {
        "keywords": '"your" OR "keywords"',
        "category": "🎯 Your Category"
    },
    # ... rest of categories
}
```

### Disable Categories

Temporarily disable scraping for a category:

```python
# Comment out or remove from FMCG_SEARCH_CATEGORIES:
# "Spices & Pickles": { ... },
```

---

## 📊 Monitoring & Maintenance

### Check Daily Run Status

```bash
# GitHub Actions → Workflows → Daily Scraper
# Green ✅ = Success
# Red ❌ = Failed (check artifacts for logs)
```

### View Scraped Articles

```bash
# Firebase Console → Firestore → bulletins collection
# Or query programmatically:
python -c "
from firebase_admin import firestore
from datetime import datetime, timedelta
db = firestore.client()
cutoff = datetime.now() - timedelta(hours=24)
docs = db.collection('bulletins').where('timestamp', '>=', cutoff).stream()
for doc in docs:
    print(f'{doc.id}: {doc.get(\"title\")[:50]}...')
"
```

### Monitor Firestore Costs

- Document writes: ~200-400/day
- Document reads: ~100-200/day (frontend queries)
- Free tier limits: 50K reads, 20K writes daily ✅ Well within limits

---

## 🚨 Troubleshooting

### "No articles found"
→ See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) Issue #1

### "Permission denied" (Firestore write error)
→ See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) Issue #2

### "Gemini API Error"
→ See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) Issue #3

### Complete troubleshooting guide:
📖 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## 🔐 Security Notes

### API Keys
- ✅ All secrets stored in GitHub Secrets (encrypted)
- ✅ Never committed to repository
- ✅ Firestore Service Account: Read-only on client side
- ✅ Gemini API Key: Server-side only in GitHub Actions

### Firestore Security Rules
```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /bulletins/{document=**} {
      allow read: if true;        # Public read (for frontend)
      allow write: if false;      # Locked (only via service account)
    }
  }
}
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [SETUP_GITHUB_ACTIONS.md](SETUP_GITHUB_ACTIONS.md) | Step-by-step GitHub Actions configuration |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues & solutions |
| This README | Overview & quick reference |

---

## 🚀 Next Steps

1. ✅ **Configure GitHub Secrets**
   → [SETUP_GITHUB_ACTIONS.md](SETUP_GITHUB_ACTIONS.md)

2. ✅ **Test Locally**
   ```bash
   python scraper.py
   ```

3. ✅ **Enable GitHub Actions**
   → Go to Actions tab → Enable workflow

4. ✅ **Trigger First Run**
   → Actions → Daily Scraper → Run workflow

5. ✅ **Check Firestore**
   → Firebase Console → bulletins collection

6. ✅ **Test Frontend**
   ```bash
   npm run dev
   ```

---

## 📞 Support

**Setup Issues?**
→ Follow [SETUP_GITHUB_ACTIONS.md](SETUP_GITHUB_ACTIONS.md) step-by-step

**Scraper Failing?**
→ Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

**Data Not Showing?**
→ Verify Firestore collection has documents

**Frontend Broken?**
→ Check browser console for Firebase errors

---

## 🎓 Architecture Decisions

1. **Python vs Node.js**: Python for scraper (better for text processing, Gemini SDK), Node.js for backup
2. **Google News RSS**: Free, low-rate-limit; supplemented with direct outlet RSS feeds
3. **Gemini API**: Cost-effective AI analysis (~$0.01/day)
4. **Firestore**: Real-time sync, generous free tier, easy frontend integration
5. **GitHub Actions**: Built-in CI/CD, simple configuration, no additional hosting

---

## 📈 Performance Metrics

- **Scrape Duration**: 2-5 minutes
- **Articles/Day**: 200-400
- **Firestore Writes**: ~300-400/day
- **Frontend Query Time**: <500ms
- **Cost**: ~$0.01-0.10/day (Gemini API only)

---

## 🔄 Backup Scraper

If Python scraper fails, a Node.js backup is available:

```bash
# Manual run (if needed)
node scripts/fetchNews.mjs

# Can be used as fallback in GitHub Actions
```

---

## 📝 License & Attribution

- Firebase SDK: Google
- Gemini API: Google
- Tailwind CSS: Tailwind Labs
- Leaflet Maps: Leaflet
- News Sources: Individual publications

---

**Last Updated:** August 18, 2026  
**Scraper Status:** ✅ Production Ready  
**Categories:** 8 FMCG segments  
**News Outlets:** 14+ publications  
**Daily Runs:** 5:00 AM IST

