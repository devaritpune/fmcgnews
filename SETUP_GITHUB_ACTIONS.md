# 🚀 GitHub Actions Setup Guide for FMCG News Scraper

This guide helps you set up automated daily news scraping that runs at **5:00 AM IST (23:30 UTC)** every morning.

## Prerequisites

- ✅ Firebase project with Firestore database
- ✅ Google Gemini API key (for AI analysis)
- ✅ GitHub repository access
- ✅ GitHub Secrets configured

---

## Step 1: Get Firebase Service Account Key

### For Firebase Admin (Local Development)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`fmcgdesk`)
3. Go to **Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Save the JSON file (keep it secure!)

### For GitHub Actions

You need to **convert the JSON to a single-line string**:

```bash
# On Windows PowerShell:
$content = Get-Content "path/to/serviceAccountKey.json" -Raw
$escaped = $content -replace '\n', '' -replace '\r', ''
$base64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($escaped))
Write-Host $base64
```

Or paste the raw JSON (it will be stored securely as a secret).

---

## Step 2: Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **Create API Key**
3. Copy the key (starts with `AIza...`)

---

## Step 3: Configure GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `FIREBASE_SERVICE_ACCOUNT_FMCGDESK` | Paste your Firebase service account JSON (one-line or raw) |
| `GEMINI_API_KEY` | Paste your Gemini API key (`AIza...`) |

### Example Firebase Secret Format

```json
{"type":"service_account","project_id":"fmcgdesk","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-...@fmcgdesk.iam.gserviceaccount.com",...}
```

---

## Step 4: Verify Firestore Rules

Your Firestore **Security Rules** must allow writes from the service account:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow service account writes
    match /bulletins/{document=**} {
      allow write: if request.auth.uid != null || request.auth.token.firebase.sign_in_provider == "custom";
      allow read: if true; // Public read access for your frontend
    }
    
    // Allow authenticated reads
    match /{document=**} {
      allow read: if request.auth != null || true; // Adjust based on your needs
    }
  }
}
```

---

## Step 5: Manual Test Run

1. Go to **Actions** tab in your GitHub repository
2. Select **"🚀 Daily FMCG Multi-Category News Scraper"**
3. Click **"Run workflow"** → **Run workflow**
4. Wait for it to complete (usually 2-5 minutes)

### Expected Behavior

✅ **Success** = Green checkmark + articles in Firestore  
❌ **Failure** = Red X + check logs in artifacts

### View Logs

1. Click the workflow run
2. Expand **"Execute Daily Scraper (Multi-Category)"**
3. Scroll to see detailed output

---

## Step 6: Verify Data in Firestore

After the first successful run:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Open **Firestore Database**
3. Check the **`bulletins`** collection
4. You should see new documents like: `ART_2026_08_18_001`

Each document should contain:
```javascript
{
  title: "...",
  summary: "...",
  category: "🌶️",
  categoryName: "Spices & Pickles",
  region: "North India",
  riskLevel: "MEDIUM",
  source: "Economic Times",
  url: "https://...",
  timestamp: Timestamp,
  createdDate: "2026-08-18 05:00:00",
  business_advisory: {
    qa_compliance: "...",
    supply_chain: "...",
    export_strategy: "..."
  }
}
```

---

## Step 7: Configure Your Frontend

Update your **Page.tsx** to display the scraped data:

```typescript
// The page already fetches from Firestore!
// Just ensure it's querying the correct collection:
const bulletinsCol = collection(db, "bulletins");
```

---

## Troubleshooting

### ❌ "FIREBASE_SERVICE_ACCOUNT_KEY not found"

**Fix:** Secret not configured. Follow Step 3 again and verify the secret name exactly matches `FIREBASE_SERVICE_ACCOUNT_FMCGDESK`.

### ❌ "Permission denied" or "PERMISSION_DENIED"

**Fix:** Update Firestore Security Rules (Step 4). The service account needs write access.

### ❌ "No articles found for [Category]"

**Fix:** Scraper ran but found no matching articles. Possible causes:
- Google News RSS returned empty results (network/rate-limit issue)
- Keywords too specific (no matching articles)
- Check logs for details

**Solutions:**
1. Wait 24 hours for scraper to try again
2. Manually test: `python scraper.py` locally
3. Adjust keywords in `scraper.py` to be broader

### ⚠️ "Gemini API Key not found"

**Fix:** This is a warning. Scraper will use fallback summaries. To enable AI analysis:
1. Get Gemini API key from Step 2
2. Add as GitHub secret `GEMINI_API_KEY`

### 🔄 Workflow never runs at 5 AM

**Fix:** GitHub Actions scheduler can be delayed up to 15 minutes. Also check:
1. Go to **Actions** tab
2. Verify workflow is **enabled** (green button at top)
3. Check if repo has recent commits (schedules don't activate on empty repos)

---

## Advanced Configuration

### Change Scrape Time

Edit `.github/workflows/daily-news.yml`:

```yaml
schedule:
  # Change cron time (format: minute hour day month day-of-week)
  # 30 23 = 23:30 UTC = 5:00 AM IST (add 5:30)
  - cron: '30 23 * * *'  # Current: 5 AM IST
  # - cron: '0 4 * * *'  # Would be: 9:30 AM IST
```

### Add Slack Notifications

Append to workflow after the `Notify on Failure` step:

```yaml
- name: 📲 Send Slack Notification
  if: always()
  uses: slackapi/slack-github-action@v1.24.0
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {
        "text": "FMCG Scraper: ${{ job.status }}",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Daily News Scraper*\nStatus: ${{ job.status }}\nTime: $(date)"
            }
          }
        ]
      }
```

### Disable Workflow Temporarily

```yaml
on:
  workflow_dispatch: # Only manual trigger
  # Commented out schedule to disable auto-run
  # schedule:
  #   - cron: '30 23 * * *'
```

---

## Monitoring Dashboard

To monitor scraper health:

1. Go to **Actions** → **"🚀 Daily FMCG..."**
2. View run history (green = success, red = failed)
3. Click any run to see detailed logs
4. Check artifacts for log files

---

## FAQ

**Q: How many articles per day?**  
A: ~8 categories × 14 outlets × 5 articles = 200-400 per day (depends on news availability)

**Q: Can I change the categories?**  
A: Yes! Edit `scraper.py` → `FMCG_SEARCH_CATEGORIES` dictionary to add/remove categories.

**Q: Cost implications?**  
A: Free tier should cover daily scraping. Gemini API: ~200 requests/day costs ~$0.01.

**Q: How do I test locally?**  
A: 
```bash
# Create .env file with:
FIREBASE_SERVICE_ACCOUNT_KEY='{"your":"json"}'
GEMINI_API_KEY='AIza...'
FIREBASE_PROJECT_ID='fmcgdesk'

# Then run:
python scraper.py
```

---

## Next Steps

1. ✅ Configure GitHub secrets (Step 3)
2. ✅ Test manually (Step 5)
3. ✅ Verify Firestore data (Step 6)
4. ✅ Check Page.tsx displays data correctly
5. ✅ Monitor first automated run at 5 AM IST

---

**Need Help?**
- Check workflow logs: Actions → workflow → run → step details
- Debug locally: `python scraper.py`
- Check Firebase console for errors
- Verify network/IP isn't rate-limited by news outlets

