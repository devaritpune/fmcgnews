# ⚡ Quick Reference - FMCG News Scraper

## 🚀 One-Time Setup

```bash
# 1. Configure GitHub Secrets (5 min)
# GitHub → Settings → Secrets → Add:
# - FIREBASE_SERVICE_ACCOUNT_FMCGDESK
# - GEMINI_API_KEY

# 2. Test locally (2 min)
pip install -r requirements.txt
python scraper.py

# 3. Trigger first GitHub run (1 min)
# GitHub → Actions → Daily Scraper → Run workflow
```

---

## 📅 Automated Schedule

```
⏰ 5:00 AM IST every day (23:30 UTC)
📍 Location: .github/workflows/daily-news.yml
✅ Status: Check Actions tab for results
📊 Output: Firestore bulletins collection
```

---

## 🔍 Common Operations

### Check Latest Articles
```bash
# Firestore console
Firebase → Firestore → bulletins → Sort by timestamp

# Or via code
python -c "
from firebase_admin import firestore
db = firestore.client()
docs = db.collection('bulletins').order_by('timestamp', direction=firestore.Query.DESCENDING).limit(5).stream()
for doc in docs:
    print(doc.to_dict()['title'])
"
```

### Count Articles Today
```bash
python -c "
from datetime import datetime
from firebase_admin import firestore
db = firestore.client()
today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
docs = db.collection('bulletins').where('timestamp', '>=', today).stream()
print(f'Articles today: {sum(1 for _ in docs)}')
"
```

### Delete All Articles (Reset)
```bash
python -c "
from firebase_admin import firestore
db = firestore.client()
batch = db.batch()
for doc in db.collection('bulletins').stream():
    batch.delete(doc.reference)
batch.commit()
print('✅ All articles deleted')
"
```

### Check Workflow Status
```bash
# GitHub UI
Actions → Daily Scraper → Latest run
- Green ✅ = Success
- Red ❌ = Failed (check logs)

# Or check logs file
Actions → Run → Artifacts → Download scraper logs
```

### Test Scraper Locally
```bash
# Create .env with secrets
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
GEMINI_API_KEY='AIza...'

# Run with verbose output
python scraper.py 2>&1 | tee output.log

# Check specific category
grep "Dairy & Beverages" output.log
```

---

## 🛠️ Modifications

### Add New Category
```python
# In scraper.py, add to FMCG_SEARCH_CATEGORIES:
"New Category": {
    "keywords": '"keyword1" OR "keyword2"',
    "category": "🎯 New Category"
},

# In app/page.tsx, add to FMCG_CATEGORIES:
{ name: "New Category", emoji: "🎯" },
```

### Change Scrape Time
```yaml
# In .github/workflows/daily-news.yml:
schedule:
  - cron: '0 4 * * *'  # Change to 4:00 UTC = 9:30 AM IST
```

### Reduce Scraper Runtime
```python
# In scraper.py:
PER_OUTLET_ITEM_LIMIT = 3  # Reduce from 5
FMCG_SEARCH_CATEGORIES = {
    "Spices & Pickles": {...},
    # Remove other categories temporarily
}
```

### Add News Outlet
```python
# In scraper.py, add to TARGET_OUTLETS:
{"name": "New Outlet", "region": "North India", "domain": "newoutlet.com"},
```

---

## 🐛 Quick Fixes

### Issue: No articles appearing
```bash
# 1. Check scraper ran
Actions → Daily Scraper → Latest run → ✅ or ❌

# 2. Check Firestore
Firebase → bulletins → Any documents?

# 3. Run manually
python scraper.py

# 4. Check logs
grep -i "error\|failed" output.log
```

### Issue: Frontend shows "No articles"
```bash
# 1. Check Firestore has data
firebase console → bulletins → Size > 0?

# 2. Check query filter
Browser console (F12) → Network → firestore calls
Check categoryName field matches exactly

# 3. Check timestamp
Articles must be < 7 days old
```

### Issue: "Permission denied"
```bash
# 1. Update Firestore rules
Firebase → Firestore → Rules → Allow writes

# 2. Check service account
Firebase → IAM → Service Account → "Cloud Datastore Editor" role
```

---

## 📊 Monitoring Dashboard

### Weekly Check
- [ ] GitHub Actions: Any failed runs?
- [ ] Firestore: Article count increasing?
- [ ] Frontend: All categories showing data?
- [ ] Costs: Within budget?

### Daily Check
- [ ] Run completed at 5 AM IST?
- [ ] Any new articles in Firestore?
- [ ] UI responsive?

---

## 🔑 Environment Variables

### Local (.env file)
```
FIREBASE_PROJECT_ID=fmcgdesk
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GEMINI_API_KEY=AIza...
```

### GitHub Secrets
```
FIREBASE_SERVICE_ACCOUNT_FMCGDESK → Full JSON
GEMINI_API_KEY → AIza...
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `scraper.py` | Main scraper (Python) |
| `app/page.tsx` | Frontend UI |
| `.github/workflows/daily-news.yml` | Scheduler |
| `lib/firebase.ts` | Firebase client config |
| `requirements.txt` | Python dependencies |
| `SETUP_GITHUB_ACTIONS.md` | Setup guide |
| `TROUBLESHOOTING.md` | Debugging guide |

---

## 🎯 Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Daily articles | 200-400 | ✅ |
| Scrape time | <10 min | ✅ |
| Frontend load | <500ms | ✅ |
| Firestore cost | <$0.50/mo | ✅ |
| Uptime | 99%+ | ✅ |

---

## 🚨 Critical Alerts

If you see these, take immediate action:

1. ❌ **Workflow failed 3+ times**
   → Check TROUBLESHOOTING.md

2. 🔴 **Firestore showing "Usage quota exceeded"**
   → Upgrade Firebase plan

3. 🚫 **Frontend can't connect to Firebase**
   → Check `.env` and Firebase rules

4. 💰 **Daily costs exceed $1**
   → Reduce article limits or categories

---

## 📞 Support Channels

**For Setup Issues:**
→ [SETUP_GITHUB_ACTIONS.md](SETUP_GITHUB_ACTIONS.md)

**For Runtime Errors:**
→ [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

**For Architecture Questions:**
→ README_IMPROVEMENTS.md

**For Code Issues:**
→ Check GitHub Actions logs

---

## 🎓 Tips & Tricks

### Boost Article Volume
```python
# Add more outlets to TARGET_OUTLETS
# Broaden keywords in categories
# Increase PER_OUTLET_ITEM_LIMIT to 10
```

### Reduce Costs
```python
# Disable Gemini (use fallback)
ai_model = None

# Reduce categories
FMCG_SEARCH_CATEGORIES = {"Spices & Pickles": {...}}

# Reduce outlets
TARGET_OUTLETS = TARGET_OUTLETS[:5]
```

### Faster Development
```bash
# Run scraper for 1 category only
# Edit scraper.py, comment out categories
# Test fast iteration
```

---

## 📊 Data Schema

Each article in Firestore has:

```javascript
{
  id: "ART_2026_08_18_001",           // Document ID
  title: "...",                        // Article headline
  summary: "...",                      // AI-generated summary
  category: "🌶️",                     // Emoji
  categoryName: "Spices & Pickles",   // Full name
  region: "North India",               // Detected region
  riskLevel: "HIGH|MEDIUM|LOW",        // Risk assessment
  source: "Economic Times",            // Outlet name
  url: "https://...",                  // Source article
  timestamp: Timestamp,                // When scraped
  createdDate: "2026-08-18...",       // Human-readable date
  business_advisory: {
    qa_compliance: "...",
    supply_chain: "...",
    export_strategy: "..."
  },
  actionAdvisory: "..."                // Executive recommendation
}
```

---

**Version:** 2.0 (Multi-Category)  
**Last Updated:** August 18, 2026  
**Status:** ✅ Production Ready

