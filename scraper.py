import json
import os
import re
import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import Set, Tuple, Dict, Any, List, Optional
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore
from google import genai
from google.genai import types
import requests

# 1. Load Environment Variables from .env file
load_dotenv()

# --- Constants ---
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "fmcgdesk")
BULLETINS_COLLECTION = "bulletins"
GEMINI_MODEL_NAME = "gemini-3.1-flash-lite"


# 2. Initialize Firebase Firestore Connection
def init_firebase() -> Optional[firestore.Client]:
  try:
    if not firebase_admin._apps:
      service_account_key_str = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY")
      if service_account_key_str:
        service_account_info = json.loads(service_account_key_str)
        cred = credentials.Certificate(service_account_info)
        firebase_admin.initialize_app(cred, {"projectId": FIREBASE_PROJECT_ID})
        print(f"✅ Connected to Firebase project: {FIREBASE_PROJECT_ID}")
      else:
        print("⚠️ FIREBASE_SERVICE_ACCOUNT_KEY not found. Running in DRY RUN mode (no database writes).")
        return None
    return firestore.client()
  except Exception as e:
    print(f"❌ Firebase Initialization Error: {e}")
    return None


db = init_firebase()

# 3. Initialize Gemini AI Client using the official Google GenAI SDK
try:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

    if GEMINI_API_KEY:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)

        print(
            f"✅ Gemini AI API configured successfully! "
            f"Model: {GEMINI_MODEL_NAME}"
        )
    else:
        gemini_client = None
        print(
            "⚠️ GEMINI_API_KEY not found. "
            "AI analysis will use fallback summaries."
        )

except Exception as e:
    gemini_client = None
    print(f"❌ Gemini AI Initialization Error: {e}")

# 4. MASTER KEYWORD GROUPS: Multi-Category FMCG Coverage
# Each category targets specific product lines within FMCG/CPG sector
FMCG_SEARCH_CATEGORIES = {
    "Spices & Pickles": {
        "keywords": '"spices" OR "pickle" OR "masala" OR "turmeric" OR "cumin" OR "chilli" OR "MDH" OR "Everest" OR "Aashirvaad" OR "Shan"',
        "category": "🌶️ Spices & Pickles"
    },
    "Dairy & Beverages": {
        "keywords": '"dairy" OR "milk" OR "beverage" OR "juice" OR "soft drink" OR "Amul" OR "ITC" OR "Nestlé" OR "Britannia" OR "Coca-Cola" OR "Pepsi"',
        "category": "🥛 Dairy & Beverages"
    },
    "Oils & Ghee": {
        "keywords": '"edible oil" OR "ghee" OR "cooking oil" OR "sunflower oil" OR "mustard oil" OR "Saffola" OR "Dalda" OR "Mother Dairy" OR "Patanjali"',
        "category": "🍳 Oils & Ghee"
    },
    "Snacks & Confectionery": {
        "keywords": '"snacks" OR "biscuits" OR "wafers" OR "chocolate" OR "candy" OR "Britannia" OR "Parle" OR "ITC" OR "Cadbury" OR "Mondelez"',
        "category": "🍿 Snacks & Confectionery"
    },
    "Personal Care": {
        "keywords": '"personal care" OR "soap" OR "shampoo" OR "toothpaste" OR "cosmetics" OR "Hindustan Unilever" OR "Marico" OR "Godrej" OR "Lotus"',
        "category": "🧴 Personal Care"
    },
    "Grains & Staples": {
        "keywords": '"grains" OR "rice" OR "wheat" OR "flour" OR "pulses" OR "Aashirvaad" OR "Nature" OR "Fortune" OR "Rajdhani"',
        "category": "🌾 Grains & Staples"
    },
    "Frozen Food": {
        "keywords": '"frozen food" OR "ready to eat" OR "instant noodles" OR "frozen vegetables" OR "Nestlé" OR "Maggi" OR "ITC" OR "Haldiram"',
        "category": "❄️ Frozen Food"
    },
    "Home Care": {
        "keywords": '"home care" OR "detergent" OR "cleaning" OR "laundry" OR "Hindustan Unilever" OR "ITC" OR "Godrej" OR "Procter"',
        "category": "🧹 Home Care"
    },
}

# Industry filter to ensure FMCG relevance
INDUSTRY_KEYWORDS = '"FMCG" OR "CPG" OR "retail" OR "food" OR "consumer goods" OR "market" OR "industry"'

# How many articles to take per outlet per category search (5 outlets * 8 categories * 5 = 200+ articles daily)
PER_OUTLET_ITEM_LIMIT = 5
MAX_ARTICLES_PER_CATEGORY = 15


# 5. SOURCE MATRIX: Expanded Target Outlets across All Regions
TARGET_OUTLETS = [
  # North India (Business & Finance)
  {"name": "Economic Times", "region": "North India", "domain": "economictimes.indiatimes.com"},
  {"name": "Financial Express", "region": "North India", "domain": "financialexpress.com"},
  {"name": "Business Standard", "region": "North India", "domain": "business-standard.com"},
  {"name": "LiveMint", "region": "North India", "domain": "livemint.com"},
  {"name": "Indian Express", "region": "North India", "domain": "indianexpress.com"},
  # South India
  {"name": "The Hindu BusinessLine", "region": "South India", "domain": "thehindubusinessline.com"},
  {"name": "The Hindu", "region": "South India", "domain": "thehindu.com"},
  {"name": "Deccan Herald", "region": "South India", "domain": "deccanherald.com"},
  {"name": "Times of India", "region": "South India", "domain": "timesofindia.com"},
  # East India
  {"name": "Telegraph India", "region": "East India", "domain": "telegraphindia.com"},
  # Agri & Food Focus
  {"name": "Agro Spectrum", "region": "National", "domain": "agrospectrumindia.com"},
  {"name": "Commodity Market", "region": "National", "domain": "commodity.com"},
  # Specialized Business
  {"name": "CNBC-TV18", "region": "National", "domain": "cnbctv18.com"},
  {"name": "Moneycontrol", "region": "National", "domain": "moneycontrol.com"},
]

# Map Indian states to broad regions to improve geographic tagging
STATE_TO_REGION = {
  "uttar pradesh": "North India",
  "punjab": "North India",
  "haryana": "North India",
  "delhi": "North India",
  "rajasthan": "North India",
  "maharashtra": "West India",
  "goa": "West India",
  "gujarat": "West India",
  "karnataka": "South India",
  "kerala": "South India",
  "tamil nadu": "South India",
  "andhra pradesh": "South India",
  "telangana": "South India",
  "odisha": "East India",
  "west bengal": "East India",
  "assam": "East India",
  "bihar": "East India",
  "jharkhand": "East India",
}

def detect_region_from_text(text: str, default_region: Optional[str] = None) -> Optional[str]:
  if not text:
    return default_region
  lower = text.lower()
  for state, region in STATE_TO_REGION.items():
    if state in lower:
      return region
  return default_region


def clean_text(raw_text: str) -> str:
  if not raw_text:
    return ""
  # RSS title values are often plain text, not standalone XML documents.
  # Parse any embedded HTML as HTML so plain text remains intact, then
  # collapse whitespace for consistent display and duplicate checks.
  text = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", raw_text, flags=re.DOTALL)
  soup = BeautifulSoup(text, "html.parser")
  return re.sub(r"\s+", " ", soup.get_text(" ", strip=True)).strip()


def is_valid_article_url(url: str) -> bool:
  """Return whether an RSS article URL is an absolute HTTP(S) URL."""
  if not url:
    return False
  parsed = urllib.parse.urlparse(url)
  return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def get_existing_bulletin_data(db_client: Optional[firestore.Client]) -> Tuple[int, Set[str], Set[str]]:
  if not db_client:
    return 0, set(), set()

  existing_urls = set()
  existing_titles = set()
  highest_seq = 0
  
  # Fetch records from the last 48 hours for efficient deduplication
  cutoff_date = datetime.now(timezone.utc) - timedelta(days=2)
  date_prefix = f"ART_{datetime.now().strftime('%Y_%m_%d')}_"

  try:
    docs = db_client.collection(BULLETINS_COLLECTION).where("timestamp", ">=", cutoff_date).stream()
    for doc in docs:
      data = doc.to_dict()
      existing_urls.add(data.get("url", "").strip().lower())
      existing_titles.add(data.get("title", "").strip().lower())

      if doc.id.startswith(date_prefix):
        match = re.search(r"_(\d{3})$", doc.id)
        if match:
          seq_num = int(match.group(1))
          if seq_num > highest_seq:
            highest_seq = seq_num

    if highest_seq > 0:
      print(f"ℹ️ Found existing bulletins for today. Next sequence starts after: {highest_seq:03d}")
    print(f"ℹ️ Indexed {len(existing_urls)} recent articles for deduplication.")
  except Exception as e:
    print(f"⚠️ Could not fetch existing records for deduplication: {e}")

  return highest_seq, existing_urls, existing_titles


def generate_document_id(sequence_num: int) -> str:
  date_str = datetime.now().strftime("%Y_%m_%d")
  return f"ART_{date_str}_{sequence_num:03d}"


def analyze_with_gemini(headline: str, description: str, category_name: str, category_emoji: str) -> Dict[str, Any]:
  """Generate evidence-grounded FMCG decision intelligence while preserving legacy fields."""
  fallback_data = {
      "category": category_emoji,
      "categoryName": category_name,
      "riskLevel": "MEDIUM",
      "summary": description[:200] if description else headline,
      "decision_intelligence": {
          "event_type": "Other",
          "what_changed": description[:300] if description else headline,
          "why_it_matters": "",
          "strategic_significance": "",
          "functions_affected": [],
          "recommended_actions": [],
          "watch_indicators": [],
          "risk_type": "Other",
          "risk_rationale": "Insufficient AI analysis available.",
          "opportunity": "",
          "confidence": "LOW",
      },
      "business_advisory": {
          "qa_compliance": "",
          "supply_chain": "",
          "export_strategy": "",
      },
      "actionAdvisory": "",
  }

  if not gemini_client:
    return fallback_data

  prompt = f"""
You are a senior FMCG Decision Intelligence Analyst supporting C-level leaders
across Strategy, Sales, Marketing, Procurement, Supply Chain, Manufacturing,
QA, Regulatory, Finance, International Business and R&D.

Focus Category: {category_name}
Headline: {headline}
Description: {description}

Your task is NOT to produce generic FMCG recommendations.

Analyze only the evidence available in the headline and description.
Do not invent facts, countries, regulations, commodities, companies,
consumer trends or operational issues that are not supported by the source.
If the source is too thin to support a strong conclusion, lower confidence
and keep recommendations conservative instead of guessing.

First identify the type of business event.
Then determine why it matters to the selected FMCG category.
Then identify only the business functions genuinely affected by this event.
Do NOT force QA, Supply Chain or Export recommendations if they are not relevant.

Produce ONLY one valid JSON object with this exact structure:

{{
  "category": "{category_emoji}",
  "categoryName": "{category_name}",
  "riskLevel": "HIGH, MEDIUM, or LOW",
  "summary": "Two concise sentences. Sentence 1: factual development. Sentence 2: direct business implication.",
  "decision_intelligence": {{
    "event_type": "IPO | Regulation | Commodity Price | Product Launch | M&A | Capacity Expansion | Supply Disruption | Earnings | Trade Policy | Other",
    "what_changed": "1-2 sentences describing the actual development.",
    "why_it_matters": "1-2 sentences explaining the business relevance to this FMCG category.",
    "strategic_significance": "1-2 sentences describing implications for competition, cost, demand, regulation, channel, investment, capability or market structure.",
    "functions_affected": [
      "Only include relevant functions from: Strategy, Sales, Marketing, Procurement, Supply Chain, Manufacturing, QA, Regulatory, Finance, International Business, R&D"
    ],
    "recommended_actions": [
      {{
        "function": "Relevant business function",
        "action": "Specific action supported by this article",
        "horizon": "Immediate | 30 Days | 90 Days | Strategic"
      }}
    ],
    "watch_indicators": [
      "Specific next signal management should monitor"
    ],
    "risk_type": "Competitive | Regulatory | Supply | Cost | Demand | Financial | Reputation | Operational | Other",
    "risk_rationale": "Explain why the risk level was assigned.",
    "opportunity": "Specific opportunity supported by the article, or empty string if none.",
    "confidence": "HIGH | MEDIUM | LOW"
  }},
  "business_advisory": {{
    "qa_compliance": "Only populate if QA or regulatory compliance is materially relevant; otherwise empty string.",
    "supply_chain": "Only populate if procurement, logistics, supply or inventory is materially relevant; otherwise empty string.",
    "export_strategy": "Only populate if exports, trade policy, foreign markets or international business is materially relevant; otherwise empty string."
  }},
  "actionAdvisory": "One concise C-level action based only on this article."
}}

RISK GUIDANCE:
HIGH = likely material near-term impact on revenue, margin, supply continuity,
regulatory exposure, market access or competitive position.
MEDIUM = meaningful development requiring monitoring or selective action,
but not an immediate material threat.
LOW = informational or early-stage development with limited current business impact.

CONFIDENCE GUIDANCE:
HIGH = the source clearly supports the implication.
MEDIUM = the implication is reasonable but partly inferential.
LOW = the source is too thin for strong conclusions.

QUALITY RULES:
- Be article-specific and evidence-grounded.
- Avoid boilerplate and generic FMCG advice.
- Do not repeat the same recommendation across functions.
- Do not manufacture unsupported tactical advice.
- Prefer 1-3 strong recommended actions over many weak ones.
- Use empty strings for irrelevant legacy advisory fields.
- Keep functions_affected, recommended_actions and watch_indicators concise.
- Output valid JSON only.
"""

  try:
    response = gemini_client.models.generate_content(
        model=GEMINI_MODEL_NAME,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        ),
    )

    text = (response.text or "").strip()
    if not text:
      print("   ⚠️ Gemini returned an empty response.")
      return fallback_data

    try:
      parsed = json.loads(text)
    except json.JSONDecodeError:
      json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
      if not json_match:
        raise
      parsed = json.loads(json_match.group(1))

    if not isinstance(parsed, dict):
      print("   ⚠️ Gemini returned JSON that was not an object.")
      return fallback_data

    parsed["category"] = parsed.get("category", category_emoji)
    parsed["categoryName"] = category_name

    risk = str(parsed.get("riskLevel", "MEDIUM")).upper().strip()
    parsed["riskLevel"] = risk if risk in {"HIGH", "MEDIUM", "LOW"} else "MEDIUM"
    parsed["summary"] = parsed.get("summary") or fallback_data["summary"]
    parsed["actionAdvisory"] = str(parsed.get("actionAdvisory") or "").strip()

    di = parsed.get("decision_intelligence") or {}
    if not isinstance(di, dict):
      di = {}

    valid_functions = {
        "Strategy", "Sales", "Marketing", "Procurement", "Supply Chain",
        "Manufacturing", "QA", "Regulatory", "Finance",
        "International Business", "R&D"
    }
    valid_horizons = {"Immediate", "30 Days", "90 Days", "Strategic"}

    functions_affected = di.get("functions_affected") or []
    if not isinstance(functions_affected, list):
      functions_affected = []
    functions_affected = [
        str(item).strip() for item in functions_affected
        if str(item).strip() in valid_functions
    ][:6]

    recommended_actions = di.get("recommended_actions") or []
    normalized_actions = []
    if isinstance(recommended_actions, list):
      for item in recommended_actions[:3]:
        if not isinstance(item, dict):
          continue
        function = str(item.get("function", "")).strip()
        action = str(item.get("action", "")).strip()
        horizon = str(item.get("horizon", "")).strip()
        if function not in valid_functions or not action:
          continue
        if horizon not in valid_horizons:
          horizon = "Strategic"
        normalized_actions.append({
            "function": function,
            "action": action,
            "horizon": horizon,
        })

    watch_indicators = di.get("watch_indicators") or []
    if not isinstance(watch_indicators, list):
      watch_indicators = []
    watch_indicators = [str(item).strip() for item in watch_indicators if str(item).strip()][:5]

    confidence = str(di.get("confidence", "LOW")).upper().strip()
    if confidence not in {"HIGH", "MEDIUM", "LOW"}:
      confidence = "LOW"

    parsed["decision_intelligence"] = {
        "event_type": str(di.get("event_type", "Other") or "Other").strip(),
        "what_changed": str(di.get("what_changed", "") or "").strip(),
        "why_it_matters": str(di.get("why_it_matters", "") or "").strip(),
        "strategic_significance": str(di.get("strategic_significance", "") or "").strip(),
        "functions_affected": functions_affected,
        "recommended_actions": normalized_actions,
        "watch_indicators": watch_indicators,
        "risk_type": str(di.get("risk_type", "Other") or "Other").strip(),
        "risk_rationale": str(di.get("risk_rationale", "") or "").strip(),
        "opportunity": str(di.get("opportunity", "") or "").strip(),
        "confidence": confidence,
    }

    ba = parsed.get("business_advisory") or {}
    if not isinstance(ba, dict):
      ba = {}
    parsed["business_advisory"] = {
        "qa_compliance": str(ba.get("qa_compliance", "") or "").strip(),
        "supply_chain": str(ba.get("supply_chain", "") or "").strip(),
        "export_strategy": str(ba.get("export_strategy", "") or "").strip(),
    }

    print("      🤖 Gemini decision intelligence successful")
    return parsed

  except json.JSONDecodeError as e:
    print(f"   ⚠️ Gemini JSON Parse Error: {e}")
    return fallback_data
  except Exception as e:
    print(f"   ⚠️ Gemini API Error: {e}")
    return fallback_data

def fetch_targeted_outlet_news(outlet: Dict[str, str], category_name: str, category_keywords: str) -> List[Dict[str, str]]:
  """Fetch news for a specific FMCG category from a given outlet."""
  headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
  articles = []
  query = f'site:{outlet["domain"]} ({category_keywords}) AND ({INDUSTRY_KEYWORDS})'
  encoded_query = urllib.parse.quote(query)

  # Google News RSS search URL with Indian locale
  rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-IN&gl=IN&ceid=IN:en"

  try:
    res = requests.get(rss_url, headers=headers, timeout=10)
    if res.status_code == 200:
      soup = BeautifulSoup(res.content, "lxml-xml") # Explicitly use the lxml parser for XML
      items = soup.find_all("item")
      
      if len(items) > 0:
        print(f"   📰 {category_name} | {outlet['name']}: {len(items)} items found")

      for item in items[:PER_OUTLET_ITEM_LIMIT]:
        title_elem = item.find("title")
        link_elem = item.find("link")
        desc_elem = item.find("description")
        pub_date_elem = item.find("pubDate")

        title = clean_text(title_elem.text) if title_elem and title_elem.text else ""
        link = link_elem.text.strip() if link_elem and link_elem.text else ""
        desc = clean_text(desc_elem.text) if desc_elem and desc_elem.text else ""
        pub_date = pub_date_elem.text if pub_date_elem and pub_date_elem.text else ""

        rejection_reasons = []
        if not title_elem or not title_elem.text:
          rejection_reasons.append("missing title")
        elif not title:
          rejection_reasons.append("invalid title after text cleaning")

        if not link_elem or not link_elem.text:
          rejection_reasons.append("missing link")
        elif not is_valid_article_url(link):
          rejection_reasons.append("invalid link URL")

        if rejection_reasons:
          print(
              f"   ⚠️ Rejected RSS item | {category_name} | {outlet['name']}: "
              f"{'; '.join(rejection_reasons)}"
          )
          continue

        articles.append({
            "title": title,
            "url": link,
            "raw_desc": desc,
            "source": outlet["name"],
            "region": outlet["region"],
            "category_name": category_name,
            "published_date": pub_date,
        })
    else:
      if res.status_code != 429:  # Don't spam 429 (rate limit) warnings
        print(f"   ⚠️ HTTP {res.status_code} from {outlet['name']}")
  except requests.exceptions.Timeout:
    print(f"   ⏱️ Timeout fetching {outlet['name']} ({category_name})")
  except Exception as e:
    print(f"   ⚠️ {outlet['name']}: {str(e)[:60]}")

  return articles


def main():
  print("\n🚀 Starting FMCG Market Intelligence Scraper (Multi-Category)...\n")

  current_sequence, existing_urls, existing_titles = get_existing_bulletin_data(db)
  processed_count = 0
  skipped_count = 0
  articles_by_category = {}

  # Optional safety limit for controlled manual GitHub Actions tests.
  # Scheduled runs leave SCRAPER_TEST_LIMIT empty and retain full production behavior.
  test_limit_raw = os.getenv("SCRAPER_TEST_LIMIT", "").strip()
  test_limit = None
  if test_limit_raw:
    try:
      parsed_limit = int(test_limit_raw)
      if parsed_limit > 0:
        test_limit = parsed_limit
        print(f"🧪 TEST MODE ACTIVE: stopping after {test_limit} new bulletin(s).")
      else:
        print(f"⚠️ Ignoring non-positive SCRAPER_TEST_LIMIT={test_limit_raw!r}; running full ingestion.")
    except ValueError:
      print(f"⚠️ Ignoring invalid SCRAPER_TEST_LIMIT={test_limit_raw!r}; running full ingestion.")

  print(f"📊 Coverage: {len(FMCG_SEARCH_CATEGORIES)} categories × {len(TARGET_OUTLETS)} outlets = {len(FMCG_SEARCH_CATEGORIES) * len(TARGET_OUTLETS)} searches\n")

  # Iterate through each FMCG category
  for category_name, category_info in FMCG_SEARCH_CATEGORIES.items():
    print(f"📂 Processing Category: {category_info['category']} {category_name}")
    articles_by_category[category_name] = 0
    category_keywords = category_info["keywords"]
    category_emoji = category_info["category"]

    # Fetch from all outlets for this category
    for outlet in TARGET_OUTLETS:
      articles = fetch_targeted_outlet_news(outlet, category_name, category_keywords)
      
      for article in articles:
        clean_url = article["url"].strip().lower()
        clean_title = article["title"].strip().lower()

        # Skip duplicates
        if not clean_title or not clean_url or (clean_url in existing_urls) or (clean_title in existing_titles):
          skipped_count += 1
          continue

        current_sequence += 1
        processed_count += 1
        articles_by_category[category_name] += 1

        doc_id = generate_document_id(current_sequence)
        print(f"   📄 [{doc_id}] {article['title'][:55]}...")

        # Analyze with Gemini for this specific category
        ai_data = analyze_with_gemini(article["title"], article["raw_desc"], category_name, category_emoji)

        # Improve region: prefer detected state-based region if present in title/description
        detected_region = detect_region_from_text(f"{article['title']} {article.get('raw_desc','')}", article["region"])

        # Build the final payload
        doc_payload = {
            "title": article["title"],
            "source": article["source"],
            "region": detected_region,
            "category": ai_data.get("category", category_emoji),
            "categoryName": ai_data.get("categoryName", category_name),
            "riskLevel": ai_data.get("riskLevel", "MEDIUM"),
            "summary": ai_data.get("summary", ""),
            "decision_intelligence": ai_data.get("decision_intelligence", {}),
            "business_advisory": ai_data.get("business_advisory", {"qa_compliance": "", "supply_chain": "", "export_strategy": ""}),
            "actionAdvisory": ai_data.get("actionAdvisory", ""),
            "url": article["url"],
            "published_date": article.get("published_date", ""),
            "timestamp": firestore.SERVER_TIMESTAMP if db else datetime.now(timezone.utc).isoformat(),
            "createdDate": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

        # Save to Firestore
        if db:
          try:
            db.collection(BULLETINS_COLLECTION).document(doc_id).set(doc_payload)
            print(f"      ✅ Saved: {doc_id}")
          except Exception as e:
            print(f"      ❌ Error: {str(e)[:50]}")
        else:
          print(f"      ⏭️ Dry run (no Firestore)")

        # Add to dedup tracking
        existing_urls.add(clean_url)
        existing_titles.add(clean_title)

        # Rate limiting to avoid IP blocks (100ms per article)
        import time
        time.sleep(0.1)

        if test_limit is not None and processed_count >= test_limit:
          print(f"   🧪 Test limit reached ({processed_count}/{test_limit}). Stopping controlled run.")
          break

      if test_limit is not None and processed_count >= test_limit:
        break

    print(f"   ✅ {category_name}: {articles_by_category[category_name]} new articles\n")

    if test_limit is not None and processed_count >= test_limit:
      break

  print("=" * 80)
  print(f"✨ DAILY INGESTION SUMMARY")
  print("=" * 80)
  print(f"📈 Total New Bulletins: {processed_count}")
  print(f"⏩ Duplicates Skipped: {skipped_count}")
  print(f"\n📋 By Category:")
  for cat, count in articles_by_category.items():
    emoji = FMCG_SEARCH_CATEGORIES[cat]["category"]
    print(f"   {emoji} {cat}: {count} articles")
  print("=" * 80 + "\n")

# Standard Python entry point
if __name__ == "__main__":
  main()
