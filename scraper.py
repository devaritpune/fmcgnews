import json
import os
import re
import urllib.parse
import time
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
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
MAX_ARTICLE_AGE_DAYS = int(os.getenv("MAX_ARTICLE_AGE_DAYS", "30"))
MIN_CATEGORY_RELEVANCE_SCORE = int(os.getenv("MIN_CATEGORY_RELEVANCE_SCORE", "75"))
MIN_BUSINESS_VALUE_SCORE = int(os.getenv("MIN_BUSINESS_VALUE_SCORE", "70"))
GEMINI_MIN_REQUEST_INTERVAL_SECONDS = float(os.getenv("GEMINI_MIN_REQUEST_INTERVAL_SECONDS", "4.2"))
GEMINI_MAX_RETRIES = int(os.getenv("GEMINI_MAX_RETRIES", "2"))
GEMINI_RETRY_FALLBACK_SECONDS = float(os.getenv("GEMINI_RETRY_FALLBACK_SECONDS", "60"))

# Sequential scraper process: remember the last Gemini request time so we stay below
# free-tier requests-per-minute limits instead of bursting through candidates.
_last_gemini_request_monotonic = 0.0


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

# Region Intelligence V2: infer article geography from article text, not publisher location.
# Keep region values aligned with the frontend filters.
STATE_TO_REGION = {
  "uttar pradesh": "North India",
  "punjab": "North India",
  "haryana": "North India",
  "delhi": "North India",
  "rajasthan": "North India",
  "uttarakhand": "North India",
  "himachal pradesh": "North India",
  "jammu and kashmir": "North India",
  "jammu & kashmir": "North India",
  "ladakh": "North India",
  "maharashtra": "West India",
  "goa": "West India",
  "gujarat": "West India",
  "karnataka": "South India",
  "kerala": "South India",
  "tamil nadu": "South India",
  "andhra pradesh": "South India",
  "telangana": "South India",
  "puducherry": "South India",
  "odisha": "East India",
  "orissa": "East India",
  "west bengal": "East India",
  "assam": "East India",
  "bihar": "East India",
  "jharkhand": "East India",
  "sikkim": "East India",
  "arunachal pradesh": "East India",
  "meghalaya": "East India",
  "manipur": "East India",
  "mizoram": "East India",
  "nagaland": "East India",
  "tripura": "East India",
}

CITY_TO_REGION = {
  # North
  "new delhi": "North India", "delhi": "North India", "gurugram": "North India",
  "gurgaon": "North India", "noida": "North India", "lucknow": "North India",
  "kanpur": "North India", "jaipur": "North India", "chandigarh": "North India",
  "ludhiana": "North India", "amritsar": "North India", "dehradun": "North India",
  "shimla": "North India", "srinagar": "North India", "jammu": "North India",
  # West
  "mumbai": "West India", "pune": "West India", "nagpur": "West India",
  "nashik": "West India", "nasik": "West India", "aurangabad": "West India",
  "ahmedabad": "West India", "surat": "West India", "vadodara": "West India",
  "rajkot": "West India", "panaji": "West India",
  # South
  "bengaluru": "South India", "bangalore": "South India", "chennai": "South India",
  "hyderabad": "South India", "kochi": "South India", "cochin": "South India",
  "thiruvananthapuram": "South India", "coimbatore": "South India",
  "mysuru": "South India", "mysore": "South India", "vijayawada": "South India",
  "visakhapatnam": "South India", "vizag": "South India", "mangaluru": "South India",
  # East / North-East
  "kolkata": "East India", "calcutta": "East India", "bhubaneswar": "East India",
  "cuttack": "East India", "patna": "East India", "ranchi": "East India",
  "guwahati": "East India", "gangtok": "East India", "shillong": "East India",
  "imphal": "East India", "agartala": "East India",
}

NATIONAL_GEO_SIGNALS = (
  "pan-india", "pan india", "nationwide", "across india", "across the country",
  "central government", "union government", "government of india", "sebi", "fssai",
  "reserve bank of india", " rbi ", "india-wide", "national market",
)


def _contains_geo_term(text: str, term: str) -> bool:
  """Match a geography term as words so short names such as Goa do not match unrelated words."""
  return re.search(rf"(?<!\w){re.escape(term)}(?!\w)", text, flags=re.IGNORECASE) is not None


def detect_geography_from_text(text: str) -> Dict[str, Any]:
  """Return evidence-based geographic metadata for an article.

  Publisher location is intentionally ignored. If no explicit regional evidence exists,
  the article is treated as National rather than inheriting the outlet's home region.
  """
  cleaned = re.sub(r"\s+", " ", text or "").strip()
  lower = f" {cleaned.lower()} "

  matched_states: List[str] = []
  matched_cities: List[str] = []
  matched_regions: List[str] = []

  for state, region in STATE_TO_REGION.items():
    if _contains_geo_term(cleaned, state):
      matched_states.append(state.title())
      matched_regions.append(region)

  for city, region in CITY_TO_REGION.items():
    if _contains_geo_term(cleaned, city):
      matched_cities.append(city.title())
      matched_regions.append(region)

  unique_regions = list(dict.fromkeys(matched_regions))

  if len(unique_regions) == 1:
    evidence_parts = matched_states + matched_cities
    return {
        "geographicScope": "Regional",
        "region": unique_regions[0],
        "states": list(dict.fromkeys(matched_states)),
        "cities": list(dict.fromkeys(matched_cities)),
        "regionConfidence": "HIGH",
        "regionEvidence": ", ".join(evidence_parts[:6]),
    }

  if len(unique_regions) > 1:
    evidence_parts = matched_states + matched_cities
    return {
        "geographicScope": "Multi-Region",
        "region": "National",
        "states": list(dict.fromkeys(matched_states)),
        "cities": list(dict.fromkeys(matched_cities)),
        "regionConfidence": "MEDIUM",
        "regionEvidence": ", ".join(evidence_parts[:6]),
    }

  national_evidence = next((signal.strip() for signal in NATIONAL_GEO_SIGNALS if signal in lower), "")
  return {
      "geographicScope": "National",
      "region": "National",
      "states": [],
      "cities": [],
      "regionConfidence": "MEDIUM" if national_evidence else "LOW",
      "regionEvidence": national_evidence or "No explicit regional geography found in headline/RSS description.",
  }


def detect_region_from_text(text: str, default_region: Optional[str] = None) -> Optional[str]:
  """Backward-compatible wrapper. Outlet-region fallback is deliberately ignored."""
  return detect_geography_from_text(text)["region"]

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


def evaluate_article_freshness(pub_date: str) -> Dict[str, Any]:
  """Fail closed on stale/unknown RSS dates so old stories cannot enter the daily bulletin."""
  raw = (pub_date or "").strip()
  result = {
      "is_fresh": False,
      "age_days": None,
      "max_age_days": MAX_ARTICLE_AGE_DAYS,
      "published_at_iso": "",
      "reason": "",
  }

  if not raw:
    result["reason"] = "Missing RSS publication date."
    return result

  try:
    published_dt = parsedate_to_datetime(raw)
    if published_dt.tzinfo is None:
      published_dt = published_dt.replace(tzinfo=timezone.utc)
    published_dt = published_dt.astimezone(timezone.utc)
  except (TypeError, ValueError, OverflowError) as e:
    result["reason"] = f"Unparseable RSS publication date: {e}"
    return result

  now_utc = datetime.now(timezone.utc)
  age_seconds = (now_utc - published_dt).total_seconds()
  age_days = max(0, int(age_seconds // 86400))

  result["published_at_iso"] = published_dt.isoformat()
  result["age_days"] = age_days

  # Allow up to 24 hours of clock/feed skew into the future.
  if age_seconds < -86400:
    result["reason"] = "RSS publication date is more than 24 hours in the future."
    return result

  if age_days > MAX_ARTICLE_AGE_DAYS:
    result["reason"] = (
        f"Article is {age_days} days old; daily bulletin maximum is "
        f"{MAX_ARTICLE_AGE_DAYS} days."
    )
    return result

  result["is_fresh"] = True
  result["reason"] = f"Article age {age_days} day(s), within {MAX_ARTICLE_AGE_DAYS}-day freshness window."
  return result



def _extract_gemini_retry_delay_seconds(error_text: str) -> float:
  """Extract Gemini retry delay from a 429 error message, with a conservative fallback."""
  patterns = (
      r"retryDelay['\"]?\s*[:=]\s*['\"]?(\d+(?:\.\d+)?)s",
      r"Please retry in\s+(\d+(?:\.\d+)?)s",
      r"retry in\s+(\d+(?:\.\d+)?)s",
  )
  for pattern in patterns:
    match = re.search(pattern, error_text, flags=re.IGNORECASE)
    if match:
      try:
        return max(1.0, float(match.group(1)))
      except (TypeError, ValueError):
        pass
  return max(1.0, GEMINI_RETRY_FALLBACK_SECONDS)


def _wait_for_gemini_rate_slot() -> None:
  """Space sequential Gemini requests so the scraper does not burst above RPM quota."""
  global _last_gemini_request_monotonic

  if GEMINI_MIN_REQUEST_INTERVAL_SECONDS <= 0:
    return

  now = time.monotonic()
  elapsed = now - _last_gemini_request_monotonic if _last_gemini_request_monotonic else None
  if elapsed is not None and elapsed < GEMINI_MIN_REQUEST_INTERVAL_SECONDS:
    sleep_seconds = GEMINI_MIN_REQUEST_INTERVAL_SECONDS - elapsed
    print(f"      ⏳ Gemini pacing: waiting {sleep_seconds:.1f}s before next request")
    time.sleep(sleep_seconds)


def _generate_gemini_content_with_retry(prompt: str):
  """Call Gemini with proactive pacing and bounded 429 retry/backoff."""
  global _last_gemini_request_monotonic

  max_attempts = max(1, GEMINI_MAX_RETRIES + 1)

  for attempt in range(1, max_attempts + 1):
    _wait_for_gemini_rate_slot()
    _last_gemini_request_monotonic = time.monotonic()

    try:
      return gemini_client.models.generate_content(
          model=GEMINI_MODEL_NAME,
          contents=prompt,
          config=types.GenerateContentConfig(
              response_mime_type="application/json"
          ),
      )
    except Exception as e:
      error_text = str(e)
      is_rate_limited = "429" in error_text or "RESOURCE_EXHAUSTED" in error_text.upper()

      if not is_rate_limited or attempt >= max_attempts:
        raise

      retry_seconds = _extract_gemini_retry_delay_seconds(error_text)
      # Add a small safety margin so we do not retry exactly on the quota boundary.
      retry_seconds += 1.0
      print(
          f"      ⏳ Gemini rate limit hit (attempt {attempt}/{max_attempts}). "
          f"Retrying in {retry_seconds:.1f}s..."
      )
      time.sleep(retry_seconds)
      # The explicit backoff already exceeds normal request pacing, so retry immediately afterward.
      _last_gemini_request_monotonic = time.monotonic() - max(0.0, GEMINI_MIN_REQUEST_INTERVAL_SECONDS)

  raise RuntimeError("Gemini retry loop exhausted unexpectedly.")

def analyze_with_gemini(headline: str, description: str, category_name: str, category_emoji: str) -> Dict[str, Any]:
  """Generate strict category relevance plus evidence-grounded FMCG decision intelligence."""
  fallback_data = {
      "category": category_emoji,
      "categoryName": category_name,
      "riskLevel": "LOW",
      "summary": description[:200] if description else headline,
      "relevance": {
          "is_fmcg_relevant": False,
          "category_match": False,
          "relevance_score": 0,
          "suggested_category": "Other",
          "reason": "Gemini relevance validation was unavailable; article was not auto-approved.",
          "business_relevance": {
              "is_business_intelligence": False,
              "strategic_value_score": 0,
              "content_type": "Unknown",
              "reason": "Gemini business-value validation was unavailable; article was not auto-approved.",
          },
      },
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

  allowed_categories = " | ".join(FMCG_SEARCH_CATEGORIES.keys())

  prompt = f"""
You are a strict FMCG/CPG news relevance gate and senior Decision Intelligence Analyst.

TARGET CATEGORY: {category_name}
HEADLINE: {headline}
DESCRIPTION: {description}

IMPORTANT: The RSS search that produced this candidate is noisy. The target category may be WRONG.
Your first responsibility is to independently decide whether this article should be admitted into the
FMCG News Desk under TARGET CATEGORY. Do not assume relevance merely because the search query found it.

RELEVANCE GATE RULES:
1. category_match may be true ONLY when the article's primary subject, product, commodity, regulation,
   company action, supply issue, demand signal, pricing event, market development, or competitive impact
   is directly and materially relevant to TARGET CATEGORY.
2. A shared company name, generic FMCG reference, generic word such as food/market/retail, or a regulator
   such as FSSAI is NOT enough by itself to make an article relevant to TARGET CATEGORY.
3. Do NOT stretch a story from another category into TARGET CATEGORY by saying it "may set a precedent",
   "could have broader implications", or "shares a regulatory environment".
4. Alcoholic beverages, unrelated corporate notices, technology-company notices, politics without direct
   category impact, entertainment, general economy, unrelated agriculture, and unrelated international
   affairs must be rejected for TARGET CATEGORY.
5. Cross-category articles may be accepted only when TARGET CATEGORY is explicitly and materially involved.
6. Macro/commodity/regulatory stories may be accepted when the evidence explicitly shows a material impact
   on TARGET CATEGORY in India.
7. If evidence is weak or ambiguous, reject. Quality is more important than article volume.

SCORING:
90-100 = direct, unmistakable target-category article.
75-89  = strong material target-category relevance.
60-74  = plausible but indirect/ambiguous; reject.
0-59   = weak, incidental, or wrong-category; reject.
Python will require a category score of at least {MIN_CATEGORY_RELEVANCE_SCORE} to save the bulletin.

BUSINESS INTELLIGENCE VALUE GATE:
1. A category-relevant article is still NOT publishable unless it contains a concrete business/market event,
   decision-relevant signal, regulation, pricing/cost movement, corporate action, capacity/supply development,
   trade/export development, earnings/funding/M&A, distribution/channel change, product launch, or measurable
   consumer-demand/market-share signal.
2. Reject recipes, cooking/how-to pieces, nutrition/lifestyle explainers, generic product comparisons, health tips,
   travel/food culture pieces, educational/current-affairs compilations, entertainment, and timeless evergreen guides.
3. A consumer article may pass only when it reports a measurable demand, pricing, channel, market-share, or purchase
   behaviour change that a business leader could act on.
4. strategic_value_score: 90-100 = material executive signal; 70-89 = useful business intelligence;
   50-69 = marginal/weak; 0-49 = non-business or evergreen content.
Python will require is_business_intelligence=true and a strategic value score of at least {MIN_BUSINESS_VALUE_SCORE}.

SUGGESTED CATEGORY must be one of:
{allowed_categories} | Other
Use Other when none of the supported categories is a good fit.

Only if category_match is true AND business_relevance.is_business_intelligence is true should you generate full Decision Intelligence.
If either gate is false, do NOT invent category-specific implications. Keep advisory/action fields empty,
keep functions/actions/watch indicators empty, and summarize only the factual source story.

Analyze only the evidence available in the headline and description. Do not invent facts.

Produce ONLY one valid JSON object with this exact structure:
{{
  "category": "{category_emoji}",
  "categoryName": "{category_name}",
  "riskLevel": "HIGH | MEDIUM | LOW",
  "summary": "Two concise evidence-grounded sentences.",
  "relevance": {{
    "is_fmcg_relevant": true,
    "category_match": true,
    "relevance_score": 0,
    "suggested_category": "One supported category or Other",
    "reason": "Concise evidence-based acceptance/rejection reason",
    "business_relevance": {{
      "is_business_intelligence": true,
      "strategic_value_score": 0,
      "content_type": "Regulation | Pricing | Commodity | Corporate Action | Capacity | Supply Chain | Trade | Earnings | Fundraising | M&A | Product Launch | Distribution | Consumer Demand | Consumer Explainer | Recipe/How-To | Lifestyle/Health | Education | Other",
      "reason": "Concise evidence-based business-value acceptance/rejection reason"
    }}
  }},
  "decision_intelligence": {{
    "event_type": "IPO | Regulation | Commodity Price | Product Launch | M&A | Capacity Expansion | Supply Disruption | Earnings | Trade Policy | Other",
    "what_changed": "1-2 factual sentences.",
    "why_it_matters": "Direct target-category relevance only; empty if rejected.",
    "strategic_significance": "Evidence-grounded strategic implication; empty if rejected.",
    "functions_affected": ["Only use: Strategy, Sales, Marketing, Procurement, Supply Chain, Manufacturing, QA, Regulatory, Finance, International Business, R&D"],
    "recommended_actions": [
      {{
        "function": "Relevant business function",
        "action": "Specific evidence-grounded action",
        "horizon": "Immediate | 30 Days | 90 Days | Strategic"
      }}
    ],
    "watch_indicators": ["Specific next signal"],
    "risk_type": "Competitive | Regulatory | Supply | Cost | Demand | Financial | Reputation | Operational | Other",
    "risk_rationale": "Why the risk level is justified; empty if rejected.",
    "opportunity": "Specific opportunity or empty string.",
    "confidence": "HIGH | MEDIUM | LOW"
  }},
  "business_advisory": {{
    "qa_compliance": "Only if materially relevant; otherwise empty string.",
    "supply_chain": "Only if materially relevant; otherwise empty string.",
    "export_strategy": "Only if materially relevant; otherwise empty string."
  }},
  "actionAdvisory": "One concise C-level action, or empty string if rejected."
}}

QUALITY RULES:
- Be strict. False positives damage the product more than missing a marginal article.
- Never rationalize a wrong-category story into the target category.
- Prefer rejection when the headline/description do not contain enough evidence.
- Keep recommendations conditional when the source does not establish company-specific exposure.
- Output valid JSON only.
"""

  try:
    response = _generate_gemini_content_with_retry(prompt)

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

    parsed["category"] = category_emoji
    parsed["categoryName"] = category_name

    relevance = parsed.get("relevance") or {}
    if not isinstance(relevance, dict):
      relevance = {}

    def _strict_bool(value: Any) -> bool:
      if isinstance(value, bool):
        return value
      return str(value).strip().lower() in {"true", "yes", "1"}

    try:
      relevance_score = int(float(relevance.get("relevance_score", 0)))
    except (TypeError, ValueError):
      relevance_score = 0
    relevance_score = max(0, min(100, relevance_score))

    supported_categories = set(FMCG_SEARCH_CATEGORIES.keys()) | {"Other"}
    suggested_category = str(relevance.get("suggested_category", "Other") or "Other").strip()
    if suggested_category not in supported_categories:
      suggested_category = "Other"

    is_fmcg_relevant = _strict_bool(relevance.get("is_fmcg_relevant", False))
    model_category_match = _strict_bool(relevance.get("category_match", False))
    category_match = (
        is_fmcg_relevant
        and model_category_match
        and relevance_score >= MIN_CATEGORY_RELEVANCE_SCORE
    )

    business_relevance = relevance.get("business_relevance") or {}
    if not isinstance(business_relevance, dict):
      business_relevance = {}

    try:
      strategic_value_score = int(float(business_relevance.get("strategic_value_score", 0)))
    except (TypeError, ValueError):
      strategic_value_score = 0
    strategic_value_score = max(0, min(100, strategic_value_score))

    model_business_match = _strict_bool(business_relevance.get("is_business_intelligence", False))
    is_business_intelligence = (
        model_business_match
        and strategic_value_score >= MIN_BUSINESS_VALUE_SCORE
    )

    parsed["relevance"] = {
        "is_fmcg_relevant": is_fmcg_relevant,
        "category_match": category_match,
        "relevance_score": relevance_score,
        "suggested_category": suggested_category,
        "reason": str(relevance.get("reason", "") or "").strip(),
        "business_relevance": {
            "is_business_intelligence": is_business_intelligence,
            "strategic_value_score": strategic_value_score,
            "content_type": str(business_relevance.get("content_type", "Unknown") or "Unknown").strip(),
            "reason": str(business_relevance.get("reason", "") or "").strip(),
        },
    }

    risk = str(parsed.get("riskLevel", "LOW")).upper().strip()
    parsed["riskLevel"] = risk if risk in {"HIGH", "MEDIUM", "LOW"} else "LOW"
    parsed["summary"] = str(parsed.get("summary") or fallback_data["summary"]).strip()

    di = parsed.get("decision_intelligence") or {}
    if not isinstance(di, dict):
      di = {}

    valid_functions = {
        "Strategy", "Sales", "Marketing", "Procurement", "Supply Chain",
        "Manufacturing", "QA", "Regulatory", "Finance",
        "International Business", "R&D"
    }
    function_aliases = {
        "quality assurance": "QA",
        "quality": "QA",
        "qa & compliance": "QA",
        "qa/compliance": "QA",
        "compliance": "Regulatory",
        "legal & regulatory": "Regulatory",
        "regulatory affairs": "Regulatory",
        "research & development": "R&D",
        "research and development": "R&D",
        "international": "International Business",
        "exports": "International Business",
        "export": "International Business",
        "supply-chain": "Supply Chain",
        "operations": "Manufacturing",
    }
    valid_horizons = {"Immediate", "30 Days", "90 Days", "Strategic"}

    def _normalize_function(value: Any) -> str:
      raw = str(value or "").strip()
      if raw in valid_functions:
        return raw
      return function_aliases.get(raw.lower(), "")

    functions_affected = di.get("functions_affected") or []
    if not isinstance(functions_affected, list):
      functions_affected = []
    functions_affected = [
        normalized for item in functions_affected
        if (normalized := _normalize_function(item))
    ]
    functions_affected = list(dict.fromkeys(functions_affected))[:6]

    recommended_actions = di.get("recommended_actions") or []
    normalized_actions = []
    if isinstance(recommended_actions, list):
      for item in recommended_actions[:3]:
        if not isinstance(item, dict):
          continue
        function = _normalize_function(item.get("function", ""))
        action = str(item.get("action", "")).strip()
        horizon = str(item.get("horizon", "")).strip()
        if not function or not action:
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

    if not category_match or not is_business_intelligence:
      # Hard safety gate: wrong-category or low-business-value candidates cannot retain invented advice.
      functions_affected = []
      normalized_actions = []
      watch_indicators = []
      parsed["riskLevel"] = "LOW"
      parsed["actionAdvisory"] = ""
      parsed["decision_intelligence"] = {
          "event_type": str(di.get("event_type", "Other") or "Other").strip(),
          "what_changed": str(di.get("what_changed", "") or "").strip(),
          "why_it_matters": "",
          "strategic_significance": "",
          "functions_affected": [],
          "recommended_actions": [],
          "watch_indicators": [],
          "risk_type": "Other",
          "risk_rationale": "",
          "opportunity": "",
          "confidence": confidence,
      }
      parsed["business_advisory"] = {
          "qa_compliance": "",
          "supply_chain": "",
          "export_strategy": "",
      }
      business_info = parsed["relevance"]["business_relevance"]
      print(
          f"      🚫 Intelligence gate rejected | category_score={relevance_score} | "
          f"business_score={strategic_value_score} | type={business_info['content_type']} | "
          f"suggested={suggested_category}"
      )
      return parsed

    parsed["actionAdvisory"] = str(parsed.get("actionAdvisory") or "").strip()
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

    print(f"      ✅ Intelligence gate passed | category_score={relevance_score} | business_score={strategic_value_score}")
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
  rejected_count = 0
  freshness_rejected_count = 0
  business_rejected_count = 0
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
        print(f"🧪 TEST MODE ACTIVE: stopping after {test_limit} SAVED bulletin(s).")
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

        # Skip records that have already been accepted/saved recently.
        if not clean_title or not clean_url or (clean_url in existing_urls) or (clean_title in existing_titles):
          skipped_count += 1
          continue

        freshness = evaluate_article_freshness(article.get("published_date", ""))
        if not freshness.get("is_fresh", False):
          freshness_rejected_count += 1
          print(
              f"   🕒 Freshness rejected: {article['title'][:65]}... | "
              f"age={freshness.get('age_days')} | {freshness.get('reason')}"
          )
          continue

        print(f"   🔎 Candidate: {article['title'][:70]}...")

        # Gemini performs category relevance + business-intelligence value gates in one call.
        ai_data = analyze_with_gemini(article["title"], article["raw_desc"], category_name, category_emoji)
        relevance = ai_data.get("relevance") or {}
        category_match = bool(relevance.get("category_match", False))
        relevance_score = int(relevance.get("relevance_score", 0) or 0)
        business_relevance = relevance.get("business_relevance") or {}
        business_match = bool(business_relevance.get("is_business_intelligence", False))
        strategic_value_score = int(business_relevance.get("strategic_value_score", 0) or 0)

        if (
            not category_match
            or relevance_score < MIN_CATEGORY_RELEVANCE_SCORE
            or not business_match
            or strategic_value_score < MIN_BUSINESS_VALUE_SCORE
        ):
          rejected_count += 1
          if category_match and relevance_score >= MIN_CATEGORY_RELEVANCE_SCORE:
            business_rejected_count += 1
          print(
              f"      ⏭️ Rejected before Firestore | target={category_name} | "
              f"category_score={relevance_score} | business_score={strategic_value_score} | "
              f"type={business_relevance.get('content_type', 'Unknown')} | "
              f"suggested={relevance.get('suggested_category', 'Other')}"
          )
          # Do not add rejected candidates to global dedup sets: the same article may legitimately
          # match a different supported category later in this run.
          continue

        current_sequence += 1
        processed_count += 1
        articles_by_category[category_name] += 1
        doc_id = generate_document_id(current_sequence)
        print(f"   📄 [{doc_id}] ACCEPTED: {article['title'][:55]}...")

        # Region Intelligence V2: classify from article evidence, never from publisher location.
        geography = detect_geography_from_text(f"{article['title']} {article.get('raw_desc','')}")
        detected_region = geography["region"]

        # Build the final payload
        doc_payload = {
            "title": article["title"],
            "source": article["source"],
            "region": detected_region,
            "geographicScope": geography.get("geographicScope", "National"),
            "states": geography.get("states", []),
            "cities": geography.get("cities", []),
            "regionConfidence": geography.get("regionConfidence", "LOW"),
            "regionEvidence": geography.get("regionEvidence", ""),
            "category": ai_data.get("category", category_emoji),
            "categoryName": ai_data.get("categoryName", category_name),
            "relevance": relevance,
            "freshness": freshness,
            "riskLevel": ai_data.get("riskLevel", "LOW"),
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
            print(f"      ❌ Error: {str(e)[:80]}")
            # A failed write must not count as successfully processed or consume dedup state.
            processed_count -= 1
            articles_by_category[category_name] -= 1
            current_sequence -= 1
            continue
        else:
          print(f"      ⏭️ Dry run (no Firestore)")

        # Add only accepted/saved articles to global dedup tracking.
        existing_urls.add(clean_url)
        existing_titles.add(clean_title)

        # Rate limiting to avoid IP blocks (100ms per accepted article)
        time.sleep(0.1)

        if test_limit is not None and processed_count >= test_limit:
          print(f"   🧪 Test limit reached ({processed_count}/{test_limit}) SAVED bulletins. Stopping controlled run.")
          break

      if test_limit is not None and processed_count >= test_limit:
        break

    print(f"   ✅ {category_name}: {articles_by_category[category_name]} accepted articles\n")

    if test_limit is not None and processed_count >= test_limit:
      break

  print("=" * 80)
  print("✨ DAILY INGESTION SUMMARY")
  print("=" * 80)
  print(f"📈 Total New Bulletins Saved: {processed_count}")
  print(f"🕒 Freshness Rejected: {freshness_rejected_count}")
  print(f"🚫 Intelligence Gate Rejected: {rejected_count}")
  print(f"📉 Business-Value Rejected (after category pass): {business_rejected_count}")
  print(f"⏩ Duplicates Skipped: {skipped_count}")
  print("\n📋 By Category:")
  for cat, count in articles_by_category.items():
    emoji = FMCG_SEARCH_CATEGORIES[cat]["category"]
    print(f"   {emoji} {cat}: {count} accepted articles")
  print("=" * 80 + "\n")

# Standard Python entry point
if __name__ == "__main__":
  main()
