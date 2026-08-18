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
import requests

# 1. Load Environment Variables from .env file
load_dotenv()

# --- Constants ---
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "fmcgdesk")
BULLETINS_COLLECTION = "bulletins"
GEMINI_MODEL_NAME = "gemini-1.5-flash-latest" # Updated model


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

# 3. Initialize Gemini AI Client using google-genai SDK
try:
  GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
  if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    ai_model = genai.GenerativeModel(GEMINI_MODEL_NAME)
    print(f"✅ Gemini AI API configured successfully! Model: {GEMINI_MODEL_NAME}")
  else:
    ai_model = None
    print("⚠️ GEMINI_API_KEY not found. AI analysis will use fallback summaries.")
except Exception as e:
  ai_model = None
  print(f"❌ Gemini AI Initialization Error: {e}")


# 4. MASTER KEYWORD GROUPS (Broader search terms to guarantee RSS matches)
# The query is structured to find articles that contain AT LEAST ONE keyword from the category group
# AND AT LEAST ONE keyword from the industry group. This ensures high relevance.
SPICE_PICKLE_KEYWORDS = '"spices" OR "pickle" OR "masala" OR "turmeric" OR "cumin" OR "chilli" OR "MDH" OR "Everest"'
INDUSTRY_KEYWORDS = '"FMCG" OR "CPG" OR "Retail" OR "food processing"'
SEARCH_QUERY_STRING = f"({SPICE_PICKLE_KEYWORDS}) AND ({INDUSTRY_KEYWORDS})"

# How many articles to take per outlet (8 outlets * 10 = 80 articles)
PER_OUTLET_ITEM_LIMIT = 10


# 5. SOURCE MATRIX: Target Outlets across North, South, West, East
TARGET_OUTLETS = [
  {"name": "Economic Times", "region": "North India", "domain": "economictimes.indiatimes.com"},
  {"name": "Financial Express", "region": "North India", "domain": "financialexpress.com"},
  {"name": "Business Standard", "region": "North India", "domain": "business-standard.com"},
  {"name": "LiveMint", "region": "North India", "domain": "livemint.com"},
  {"name": "The Hindu BusinessLine", "region": "South India", "domain": "thehindubusinessline.com"},
  {"name": "Deccan Herald", "region": "South India", "domain": "deccanherald.com"},
  {"name": "Telegraph India", "region": "East India", "domain": "telegraphindia.com"},
  {"name": "Agro Spectrum", "region": "East India", "domain": "agrospectrumindia.com"},
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
  text = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", raw_text, flags=re.DOTALL)
  soup = BeautifulSoup(text, "html.parser")
  return soup.get_text().strip()


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


def get_ai_fallback_data(headline: str, description: str) -> Dict[str, Any]:
    return {
        "category": "🌶️ Spices & Pickles",
        "riskLevel": "MEDIUM",
        "summary": f"Key update regarding {headline[:60]}...",
        "business_advisory": {
            "qa_compliance": "Review QA sampling protocols and align with recent regulatory notices.",
            "supply_chain": "Assess supplier capacity and diversify procurement across regions.",
            "export_strategy": "Monitor export policy changes and adjust shipment prioritization.",
        },
        "actionAdvisory": "Review regional supplier contracts and adjust safety stock buffers.",
    }
  prompt = f"""
    You are an FMCG Industry Supply Chain and Commercial Analyst focused on Spices & Pickles.
    Headline: {headline}
    Description: {description}

    Produce ONLY a single JSON object (no surrounding text) with the following structure and concise, practical recommendations tailored to procurement, QA, and export teams:
    {{
      "category": "🌶️ Spices & Pickles",
      "riskLevel": "MEDIUM|HIGH|LOW",
      "summary": "A two-sentence executive summary. The first sentence must state the core news. The second must state its direct impact on the Indian FMCG market.",
      "business_advisory": {{
          "qa_compliance": "A specific 1-2 sentence QA action. If a regulation (e.g., EtO limits) or contaminant is mentioned, reference it directly. Avoid generic advice.",
          "supply_chain": "A specific 1-2 sentence procurement action. If a region or commodity is mentioned, focus the advice on it. Avoid generic advice.",
          "export_strategy": "A specific 1-2 sentence export action. If a country or trade bloc (e.g., EU, US) is mentioned, tailor the advice for it. Avoid generic advice."
      }},
      "actionAdvisory": "A single, critical, and actionable recommendation for a C-level executive, derived *only* from the information in this article."
    }}

    CRITICAL INSTRUCTIONS: Your advice MUST be unique and directly based on the provided Headline and Description. DO NOT use generic or placeholder text. Be specific and tactical. Ensure the output is a single, valid JSON object and nothing else.
    """

  try:
    response = ai_model.generate_content(prompt)
    text = response.text.strip()
    
    # Robustly find and parse the JSON block
    json_match = re.search(r"```(json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if json_match:
        json_str = json_match.group(2)
    else: # If no markdown block, assume the whole text is the JSON
        json_str = text

    try:
        parsed = json.loads(json_str)
        # Normalize business_advisory to ensure expected keys
        ba = parsed.get("business_advisory", {})
        parsed["business_advisory"] = {
            "qa_compliance": ba.get("qa_compliance", ""),
            "supply_chain": ba.get("supply_chain", ""),
            "export_strategy": ba.get("export_strategy", ""),
        }
        return parsed
    except json.JSONDecodeError as json_e:
        print(f"   ⚠️ Gemini JSON Parsing Error: {json_e}. Raw text: '{text[:100]}...'")
        return get_ai_fallback_data(headline, description)
  except Exception as e:
    print(f"   ⚠️ Gemini API Call Error: {e}")
    return get_ai_fallback_data(headline, description)

def fetch_targeted_outlet_news(outlet: Dict[str, str]) -> List[Dict[str, str]]:
  headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
  articles = []
  query = f'site:{outlet["domain"]} ({SEARCH_QUERY_STRING})'
  encoded_query = urllib.parse.quote(query)

  # Google News RSS search URL
  rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-IN&gl=IN&ceid=IN:en"

  try:
    res = requests.get(rss_url, headers=headers, timeout=10)
    if res.status_code == 200:
      soup = BeautifulSoup(res.content, "xml") # lxml is faster if installed
      items = soup.find_all("item")
      
      print(f"   -> RSS fetched for {outlet['name']}: {len(items)} items found.")

      for item in items[:PER_OUTLET_ITEM_LIMIT]:
        title_elem = item.find("title")
        link_elem = item.find("link")
        desc_elem = item.find("description")

        title = clean_text(title_elem.text) if title_elem and title_elem.text else ""
        link = link_elem.text.strip() if link_elem and link_elem.text else ""
        desc = clean_text(desc_elem.text) if desc_elem and desc_elem.text else ""

        if title:
          articles.append({
              "title": title,
              "url": link,
              "raw_desc": desc,
              "source": outlet["name"],
              "region": outlet["region"],
          })
    else:
      print(f"   ⚠️ HTTP Status {res.status_code} received for {outlet['name']}")
  except Exception as e:
    print(f"   ⚠️ Error fetching query for {outlet['name']}: {e}")

  return articles


def run_scraper():
  print("\n🚀 Starting Comprehensive FMCG Market Scraper (Today's Date Stamp)...\n")

  current_sequence, existing_urls, existing_titles = get_existing_bulletin_data(db)
  processed_count = 0
  skipped_count = 0

  print(f"📌 Matrix Scope: Searching {len(TARGET_OUTLETS)} Target Publications...\n")

  for outlet in TARGET_OUTLETS:
    print(f"🔍 Searching {outlet['name']} ({outlet['region']} Region)...")
    articles = fetch_targeted_outlet_news(outlet)
    
    for article in articles:
      clean_url = article["url"].strip().lower()
      clean_title = article["title"].strip().lower()

      if (clean_url and clean_url in existing_urls) or (clean_title and clean_title in existing_titles):
        skipped_count += 1
        print(f"   ⏩ Duplicate Skipped: {article['title'][:50]}...")
        continue

      current_sequence += 1
      processed_count += 1

      doc_id = generate_document_id(current_sequence)
      print(f"   📄 Processing [{doc_id}]: {article['title'][:60]}...")

      ai_data = analyze_with_gemini(article["title"], article["raw_desc"])

      # Improve region: prefer detected state-based region if present in title/description
      detected_region = detect_region_from_text(f"{article['title']} {article.get('raw_desc','')}", article["region"])

      # Build the final payload once
      doc_payload = {
          "title": article["title"],
          "source": article["source"],
          "region": detected_region,
          "category": ai_data.get("category", "🌶️ Spices & Pickles"),
          "riskLevel": ai_data.get("riskLevel", "MEDIUM"),
          "summary": ai_data.get("summary", ""),
          "business_advisory": ai_data.get("business_advisory", {"qa_compliance":"","supply_chain":"","export_strategy":""}),
          "actionAdvisory": ai_data.get("actionAdvisory", ""),
          "url": article["url"],
          "timestamp": firestore.SERVER_TIMESTAMP if db else datetime.now(timezone.utc).isoformat(),
          "createdDate": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
      }

      # Save the processed bulletin to Firestore
      if db:
        try:
          db.collection(BULLETINS_COLLECTION).document(doc_id).set(doc_payload)
          print(f"   ✅ Saved to Firestore: {doc_id}")
        except Exception as e:
          print(f"   ❌ Firestore Write Error for {doc_id}: {e}")

  print(f"\n✨ Total New Relevant Bulletins Processed: {processed_count}")
  print(f"⏩ Duplicate Bulletins Skipped: {skipped_count}")


if __name__ == "__main__":
  run_scraper()