import json
import os
import re
import time
import urllib.parse
from datetime import datetime, timezone
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore
from google import genai
import requests

# 1. Load Environment Variables from .env file
load_dotenv()


# 2. Initialize Firebase Firestore Connection
def init_firebase():
  try:
    if not firebase_admin._apps:
      if os.path.exists("serviceAccountKey.json"):
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
        print("✅ Connected to Firebase via serviceAccountKey.json!")
      elif os.getenv("FIREBASE_PRIVATE_KEY") and os.getenv(
          "FIREBASE_CLIENT_EMAIL"
      ):
        private_key = os.getenv("FIREBASE_PRIVATE_KEY").replace("\\n", "\n")
        cred = credentials.Certificate({
            "type": "service_account",
            "project_id": os.getenv("FIREBASE_PROJECT_ID", "fmcgdesk"),
            "private_key": private_key,
            "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
            "token_uri": "https://oauth2.googleapis.com/token",
        })
        firebase_admin.initialize_app(cred)
        print("✅ Connected to Firebase via .env Environment Variables!")
      else:
        print("⚠️ No Firebase credentials found. Running in DRY RUN mode.")
        return None
    return firestore.client()
  except Exception as e:
    print(f"❌ Firebase Init Error: {e}")
    return None


db = init_firebase()

# 3. Initialize Gemini AI Client using google-genai SDK
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL_NAME = "gemini-3.1-flash-lite"

if GEMINI_API_KEY:
  ai_client = genai.Client(api_key=GEMINI_API_KEY)
  print(f"✅ Gemini AI API loaded successfully! Model: {MODEL_NAME}")
else:
  ai_client = None
  print("⚠️ GEMINI_API_KEY not found in .env — using fallback smart summaries.")


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

def detect_region_from_text(text, default_region=None):
  if not text:
    return default_region
  lower = text.lower()
  for state, region in STATE_TO_REGION.items():
    if state in lower:
      return region
  return default_region


def clean_text(raw_text):
  if not raw_text:
    return ""
  text = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", raw_text, flags=re.DOTALL)
  soup = BeautifulSoup(text, "html.parser")
  return soup.get_text().strip()


def get_existing_bulletin_data(db_client):
  if not db_client:
    return 0, set(), set()

  existing_urls = set()
  existing_titles = set()
  highest_seq = 0
  date_prefix = f"ART_{datetime.now().strftime('%Y_%m_%d')}_"

  try:
    docs = db_client.collection("bulletins").stream()
    for doc in docs:
      data = doc.to_dict()
      if "url" in data and data["url"]:
        existing_urls.add(data["url"].strip().lower())
      if "title" in data and data["title"]:
        existing_titles.add(data["title"].strip().lower())

      if doc.id.startswith(date_prefix):
        match = re.search(r"_(\d{3})$", doc.id)
        if match:
          seq_num = int(match.group(1))
          if seq_num > highest_seq:
            highest_seq = seq_num

    if highest_seq > 0:
      print(f"ℹ️ Found existing bulletins for today. Highest sequence: {highest_seq:03d}")
    print(f"ℹ️ Indexed {len(existing_urls)} existing articles in Firestore for deduplication.")
  except Exception as e:
    print(f"⚠️ Could not fetch existing records for deduplication: {e}")

  return highest_seq, existing_urls, existing_titles


def generate_document_id(sequence_num):
  date_str = datetime.now().strftime("%Y_%m_%d")
  return f"ART_{date_str}_{sequence_num:03d}"


def analyze_with_gemini(headline, description):
  if not ai_client:
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
      "summary": "Two-sentence executive summary focused on supply chain, pricing, and market impact.",
      "business_advisory": {{
          "qa_compliance": "1-2 sentence tactical QA/compliance next steps (lab testing, certificates, recalls).",
          "supply_chain": "1-2 sentence procurement/sourcing actions (alternate suppliers, safety stock, logistics).",
          "export_strategy": "1-2 sentence export/IB actions (priority markets, documentation, tariffs)."
      }},
      "actionAdvisory": "One-line executive action for C-suite or procurement head."
    }}

    Allowed category values: "🌶️ Spices & Pickles", "🌾 Grains & Pulses", "🥛 Dairy & Edible Oils", "📦 Packaging & Logistics".
    Allowed riskLevel values: "HIGH", "MEDIUM", "LOW".
    Keep JSON valid, use short clear sentences, and avoid marketing or generic phrases.
    """

  try:
    response = ai_client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
    )
    text = response.text.strip()
    if text.startswith("```"):
      text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
      text = re.sub(r"\n?```$", "", text)
      text = text.strip()
    parsed = json.loads(text)
    # Normalize business_advisory to ensure expected keys
    if "business_advisory" in parsed and isinstance(parsed["business_advisory"], dict):
      # ensure keys exist
      ba = parsed["business_advisory"]
      parsed["business_advisory"] = {
          "qa_compliance": ba.get("qa_compliance", ""),
          "supply_chain": ba.get("supply_chain", ""),
          "export_strategy": ba.get("export_strategy", ""),
      }
    else:
      parsed["business_advisory"] = {
          "qa_compliance": "",
          "supply_chain": "",
          "export_strategy": "",
      }
    return parsed
  except Exception as e:
    print(f"   ⚠️ Gemini AI API Error Details: {e}")
    return {
        "category": "🌶️ Spices & Pickles",
        "riskLevel": "MEDIUM",
        "summary": description[:150] if description else headline,
        "actionAdvisory": "Monitor regional market movements and adjust procurement buffers.",
    }


def fetch_targeted_outlet_news(outlet):
  headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
  articles = []
  query = f'site:{outlet["domain"]} ({SEARCH_QUERY_STRING})'
  encoded_query = urllib.parse.quote(query)

  # Google News RSS search URL
  rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-IN&gl=IN&ceid=IN:en"

  try:
    res = requests.get(rss_url, headers=headers, timeout=10)
    if res.status_code == 200:
      soup = BeautifulSoup(res.content, "xml")
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

      try:
        ai_data = analyze_with_gemini(article["title"], article["raw_desc"])
      except Exception as e:
        print(f"⚠️ Gemini AI API Error Details: {e}")
        ai_data = {
            "category": "🌶️ Spices & Pickles",
            "riskLevel": "MEDIUM",
            "summary": article["raw_desc"][:150] if article["raw_desc"] else article["title"],
            "actionAdvisory": "Monitor regional market movements and adjust procurement buffers.",
        }

      doc_payload = {
          "title": article["title"],
          "source": article["source"],
          "region": article["region"],
          "category": ai_data.get("category", "🌶️ Spices & Pickles"),
          "riskLevel": ai_data.get("riskLevel", "MEDIUM"),
          "summary": ai_data.get("summary", ""),
          "actionAdvisory": ai_data.get("actionAdvisory", ""),
          "url": article["url"],
          "timestamp": firestore.SERVER_TIMESTAMP if db else datetime.now(timezone.utc).isoformat(),
          "createdDate": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
      }

      try:
        ai_data = analyze_with_gemini(article["title"], article["raw_desc"])
      except Exception as e:
        print(f"⚠️ Gemini AI API Error Details: {e}")
        ai_data = {
            "category": "🌶️ Spices & Pickles",
            "riskLevel": "MEDIUM",
            "summary": article["raw_desc"][:150] if article["raw_desc"] else article["title"],
            "business_advisory": {
                "qa_compliance": "",
                "supply_chain": "",
                "export_strategy": "",
            },
            "actionAdvisory": "Monitor regional market movements and adjust procurement buffers.",
        }
      # Improve region: prefer detected state-based region if present in title/description
      detected_region = detect_region_from_text(f"{article['title']} {article.get('raw_desc','')}", article["region"])

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
  print(f"   ✨ Total New Relevant Bulletins Processed: {processed_count}")
  print(f"   ⏩ Duplicate Bulletins Skipped: {skipped_count}")


if __name__ == "__main__":
  run_scraper()