# 🔧 FMCG Scraper Troubleshooting Guide

## Quick Diagnostics

Run this to check your setup:

```bash
# 1. Check Python version
python --version  # Should be 3.11+

# 2. Check dependencies
pip list | grep -E "firebase|google|requests|beautifulsoup"

# 3. Check .env file exists
ls -la .env

# 4. Test Firestore connection
python -c "
import os
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore
load_dotenv()
service_account_key_str = os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY')
if service_account_key_str:
    print('✅ Firebase key found')
    try:
        service_account_info = __import__('json').loads(service_account_key_str)
        print('✅ JSON is valid')
    except:
        print('❌ JSON is invalid')
else:
    print('❌ Firebase key not found')
"
```

---

## Common Issues & Solutions

### Issue 1: "No articles found for [Category]"

**Symptoms:**
- Scraper runs successfully
- Firestore has no new documents
- Logs show "0 items found" from news outlets

**Causes:**
1. Google News RSS is blocking your IP (rate limit)
2. Keywords are too specific
3. News outlets don't have matching articles

**Solutions:**

```python
# A) Add retry logic to scraper.py
import time
time.sleep(2)  # Add delay between requests

# B) Broaden keywords in FMCG_SEARCH_CATEGORIES
FMCG_SEARCH_CATEGORIES = {
    "Spices & Pickles": {
        "keywords": '"spice*" OR "pickle*" OR "masala"',  # More flexible
        ...
    }
}

# C) Test locally with retry
for i in range(3):
    try:
        articles = fetch_targeted_outlet_news(outlet, category, keywords)
        if articles:
            break
    except:
        time.sleep(5 * (i + 1))  # Exponential backoff
```

**Check logs:**
```bash
# View GitHub Actions logs
# Actions → Daily Scraper → Run → Execute Scraper

# Or test locally:
python scraper.py 2>&1 | grep -i "items found\|error\|timeout"
```

---

### Issue 2: "Permission denied" / "PERMISSION_DENIED"

**Symptoms:**
- Scraper fails with Firestore write error
- Error: `"PERMISSION_DENIED"`

**Causes:**
- Firestore Security Rules don't allow service account writes
- Service account email not authorized

**Solutions:**

1. **Update Firestore Security Rules:**

Go to Firebase Console → Firestore → Rules:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /bulletins/{document=**} {
      allow create, write: if true; // Temporary: allow all writes
      allow read: if true;
    }
  }
}
```

2. **Verify Service Account:**

```bash
# Extract email from service account JSON
python -c "
import json, os
from dotenv import load_dotenv
load_dotenv()
key = json.loads(os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY'))
print('Service Account Email:', key.get('client_email'))
"
```

3. **Grant Firestore Write Permission:**

- Firebase Console → IAM & Admin → Service Accounts
- Find your service account
- Grant "Cloud Datastore Editor" role

---

### Issue 3: Gemini API Errors

**Symptoms:**
- Error: `"Gemini API Call Error"`
- Warnings about generic fallback summaries

**Causes:**
1. API key is invalid or expired
2. Rate limit exceeded
3. API not enabled in Google Cloud

**Solutions:**

```bash
# 1. Verify API key
python -c "
import os
from dotenv import load_dotenv
load_dotenv()
key = os.getenv('GEMINI_API_KEY')
if key:
    print(f'✅ API Key found: {key[:10]}...')
else:
    print('❌ GEMINI_API_KEY not set')
"

# 2. Test Gemini connection
python -c "
import google.generativeai as genai
genai.configure(api_key='YOUR_KEY')
model = genai.GenerativeModel('gemini-1.5-flash-latest')
response = model.generate_content('Hello')
print('✅ Gemini API working')
"

# 3. Check rate limits
# Gemini free tier: 60 requests/minute
# If scraping >300 articles daily, consider paid tier
```

---

### Issue 4: GitHub Actions Secrets Not Found

**Symptoms:**
- Workflow fails immediately
- Error: `"FIREBASE_SERVICE_ACCOUNT_KEY not found"`

**Causes:**
- Secret name doesn't match exactly
- Secret value is empty or corrupted
- Secret hasn't been replicated to Actions yet

**Solutions:**

```bash
# 1. Verify secret is set
# GitHub → Settings → Secrets → Check FIREBASE_SERVICE_ACCOUNT_FMCGDESK exists

# 2. Check exact spelling in workflow:
# .github/workflows/daily-news.yml line ~52:
env:
  FIREBASE_SERVICE_ACCOUNT_KEY: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_FMCGDESK }}
  GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}

# 3. Re-create secret if corrupted:
# Settings → Secrets → Delete FIREBASE_SERVICE_ACCOUNT_FMCGDESK
# Add → New secret → Name: FIREBASE_SERVICE_ACCOUNT_FMCGDESK
# Paste raw JSON (GitHub will encode it)
```

---

### Issue 5: Workflow Never Runs at Scheduled Time

**Symptoms:**
- Scheduled time passes but workflow doesn't trigger
- Manual trigger works fine

**Causes:**
1. Workflow is disabled
2. No recent commits to repo (GitHub doesn't schedule disabled repos)
3. Cron syntax is invalid

**Solutions:**

```bash
# 1. Enable workflow
# Actions tab → Workflow → "Enable workflow" button

# 2. Make a dummy commit
git commit --allow-empty -m "Trigger GitHub Actions scheduler"
git push

# 3. Verify cron syntax
# 30 23 * * * means: 23:30 UTC = 5:00 AM IST (IST is UTC+5:30)
# Cron reference: https://crontab.guru/

# 4. Test manually first
# Actions → Workflow → Run workflow → Run workflow button
```

---

### Issue 6: "Timeout" / "Scraper Timed Out"

**Symptoms:**
- Workflow fails after 10+ minutes
- Error: "timeout"

**Causes:**
1. Too many articles being processed
2. Gemini API is slow
3. Firestore write operations are slow

**Solutions:**

```python
# A) Reduce articles per outlet in scraper.py
PER_OUTLET_ITEM_LIMIT = 5  # Reduce from 10 to 5

# B) Add timeouts to requests
requests.get(url, timeout=5)  # Max 5 seconds per request

# C) Skip Gemini analysis for speed
if not ai_model:
    print("⚠️ Skipping AI analysis")
    ai_data = fallback_data

# D) Increase workflow timeout
# In .github/workflows/daily-news.yml:
jobs:
  scrape-news:
    timeout-minutes: 60  # Increase from 30 to 60
```

---

### Issue 7: Frontend Shows "No Articles Found"

**Symptoms:**
- Page.tsx displays: "No articles found in 'bulletins' collection"
- Firestore has data but frontend doesn't show it

**Causes:**
1. categoryName field mismatch
2. timestamp filter is too strict
3. Firebase client config is wrong
4. CORS/security rules blocking reads

**Solutions:**

```typescript
// In app/page.tsx, verify query:
const q = query(
  bulletinsCol,
  where("categoryName", "==", selectedCategory),  // Check this field name
  where("timestamp", ">=", sevenDaysAgo),         // 7 days is generous
  orderBy("timestamp", "desc"),
  limit(100)
);

// If still no results, try:
const snapshot = await getDocs(collection(db, "bulletins"));
console.log("Total docs:", snapshot.size);  // Check if collection has ANY data
```

---

### Issue 8: Wrong Region Detected

**Symptoms:**
- Articles show "Pan-India" instead of specific region
- Region filtering doesn't work

**Causes:**
- State names in article don't match STATE_TO_REGION mapping
- Region detection is failing silently

**Solutions:**

```python
# Add more states to STATE_TO_REGION in scraper.py
STATE_TO_REGION = {
    "uttar pradesh": "North India",
    "maharashtra": "West India",
    # Add more mappings...
}

# Debug detection
article_text = "Turmeric price surge in Telangana"
detected = detect_region_from_text(article_text, "National")
print(f"Detected region: {detected}")
```

---

## Performance Optimization

### Reduce Scraper Runtime

```python
# 1. Reduce outlets
TARGET_OUTLETS = TARGET_OUTLETS[:5]  # Only first 5

# 2. Reduce articles per outlet
PER_OUTLET_ITEM_LIMIT = 3  # Reduce from 5 to 3

# 3. Disable AI analysis (use fallback)
ai_model = None  # Force fallback summaries

# 4. Reduce category searches
FMCG_SEARCH_CATEGORIES = {
    "Spices & Pickles": {...},
    "Dairy & Beverages": {...},
    # Only 2 categories for testing
}
```

### Speed Up Firestore Writes

```python
# Batch writes instead of individual documents
batch = db.batch()
for article in articles[:50]:
    batch.set(doc_ref, article_data)
    if len(batch_ops) % 100 == 0:
        batch.commit()
        batch = db.batch()
batch.commit()
```

---

## Monitoring & Alerting

### Set Up Email Notifications

1. GitHub Actions → Workflow → Disable email by default
2. Add Slack integration:

```yaml
- name: Send Slack Alert
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {"text": "❌ FMCG Scraper Failed: ${{ job.status }}"}
```

### Monitor Firestore

```bash
# Count articles per day
python -c "
from datetime import datetime, timedelta
from firebase_admin import firestore
db = firestore.client()
today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
docs = db.collection('bulletins').where('timestamp', '>=', today).stream()
count = sum(1 for _ in docs)
print(f'Articles today: {count}')
"
```

---

## Debugging Commands

```bash
# 1. Run scraper with verbose output
python scraper.py 2>&1 | tee output.log

# 2. Check specific outlet
python -c "
from scraper import fetch_targeted_outlet_news, TARGET_OUTLETS, FMCG_SEARCH_CATEGORIES
outlet = TARGET_OUTLETS[0]
cat_info = list(FMCG_SEARCH_CATEGORIES.values())[0]
articles = fetch_targeted_outlet_news(outlet, list(FMCG_SEARCH_CATEGORIES.keys())[0], cat_info['keywords'])
print(f'Got {len(articles)} articles from {outlet[\"name\"]}')
for a in articles[:3]:
    print(f'  - {a[\"title\"][:50]}...')
"

# 3. Test Firestore write
python -c "
from lib.firebase import db
if db:
    test_doc = {'test': True, 'timestamp': __import__('datetime').datetime.now(__import__('datetime').timezone.utc)}
    db.collection('bulletins').document('TEST_DOC').set(test_doc)
    print('✅ Firestore write successful')
else:
    print('❌ Firestore not initialized')
"

# 4. Check latest articles
python -c "
from lib.firebase import db
from datetime import datetime, timedelta
from firebase_admin import firestore
docs = db.collection('bulletins').order_by('timestamp', direction=firestore.Query.DESCENDING).limit(5).stream()
for doc in docs:
    data = doc.to_dict()
    print(f'{doc.id}: {data.get(\"title\", \"?\")[:50]}...')
"
```

---

## Still Stuck?

1. **Check GitHub Actions logs:**
   - Actions → Workflow → Latest run → Step details
   
2. **View artifacts:**
   - Actions → Workflow → Run → Artifacts → Download logs

3. **Test locally:**
   ```bash
   cp .env.example .env
   # Edit .env with your secrets
   python scraper.py
   ```

4. **Enable debug logging:**
   ```python
   import logging
   logging.basicConfig(level=logging.DEBUG)
   ```

---

**Last Resort:** Manually test each component:
1. Firebase connection ✅
2. News scraping ✅
3. Gemini analysis ✅
4. Firestore writes ✅
5. Frontend display ✅

