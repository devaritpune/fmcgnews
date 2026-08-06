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


# 4. MASTER KEYWORD GROUPS (Companies + Products + Commodities + Supply Chain)
COMPANY_KEYWORDS = [
    "Desai Brothers",
    "Mother's Recipe",
    "Suhana Masala",
    "Everest Foods",
    "Everest Spices",
    "MDH",
    "Nestle India",
    "ITC Foods",
    "Aashirvaad",
    "Sunrise Spices",
    "Tata Sampann",
    "Dabur",
    "Badshah Masala",
    "MTR Foods",
    "Eastern Condiments",
    "Recipewell",
    "Aachi Masala",
    "Sakthi Masala",
    "Priya Foods",
    "Goldiee Masale",
    "Ashok Masale",
    "Cookme",
    "JK Spices",
]

PRODUCT_KEYWORDS = [
    "spices",
    "pickles",
    "jeera",
    "cumin",
    "turmeric",
    "haldi",
    "coriander",
    "dhania",
    "red chilli",
    "cardamom",
    "black pepper",
    "hing",
    "asafoetida",
    "garam masala",
    "blended spices",
    "mango pickle",
    "ginger garlic paste",
    "chutney",
    "ready to cook",
    "curry paste",
]

SUPPLY_CHAIN_KEYWORDS = [
    "procurement",
    "price hike",
    "mandi price",
    "APMC arrivals",
    "export ban",
    "FSSAI",
    "Ethylene Oxide",
    "crop yield",
    "unseasonal rain",
    "input cost",
    "packaging cost",
]

# Combined search query string for Google News RSS (Fixed string quote formatting)
companies_part = " OR ".join(f'"{c}"' for c in COMPANY_KEYWORDS[:8])
products_part = " OR ".join(PRODUCT_KEYWORDS[:10])
supply_part = " OR ".join(SUPPLY_CHAIN_KEYWORDS[:6])
SEARCH_QUERY_STRING = f"({companies_part} OR {products_part}) AND ({supply_part})"


# 5. SOURCE MATRIX: 40 Target Outlets across North, South, West, East
TARGET_OUTLETS = [
    # North Region (Newspapers + Magazines)
    {
        "name": "Economic Times",
        "region": "North",
        "domain": "economictimes.indiatimes.com",
    },
    {
        "name": "Financial Express North",
        "region": "North",
        "domain": "financialexpress.com",
    },
    {
        "name": "Business Standard North",
        "region": "North",
        "domain": "business-standard.com",
    },
    {"name": "LiveMint", "region": "North", "domain": "livemint.com"},
    {
        "name": "Tribune Business",
        "region": "North",
        "domain": "tribuneindia.com",
    },
    {"name": "FNB News North", "region": "North", "domain": "fnbnews.com"},
    {
        "name": "Outlook Business",
        "region": "North",
        "domain": "outlookbusiness.com",
    },
    {
        "name": "BW Hotelier/FMCG",
        "region": "North",
        "domain": "businessworld.in",
    },
    {"name": "Policy Circle", "region": "North", "domain": "policycircle.org"},
    {
        "name": "Indian Chemical News",
        "region": "North",
        "domain": "indianchemicalnews.com",
    },
    # South Region (Newspapers + Magazines)
    {
        "name": "The Hindu BusinessLine",
        "region": "South",
        "domain": "thehindubusinessline.com",
    },
    {
        "name": "Deccan Herald Business",
        "region": "South",
        "domain": "deccanherald.com",
    },
    {
        "name": "Financial Express South",
        "region": "South",
        "domain": "financialexpress.com",
    },
    {
        "name": "Telangana Today",
        "region": "South",
        "domain": "telanganatoday.com",
    },
    {
        "name": "Deccan Chronicle",
        "region": "South",
        "domain": "deccanchronicle.com",
    },
    {
        "name": "Processed Food Industry",
        "region": "South",
        "domain": "pfi-online.com",
    },
    {"name": "FnB News South", "region": "South", "domain": "fnbnews.com"},
    {
        "name": "Commodity Online",
        "region": "South",
        "domain": "commodityonline.com",
    },
    {
        "name": "Beverage & Food World",
        "region": "South",
        "domain": "bfworld.in",
    },
    {"name": "FSSAI Updates", "region": "South", "domain": "fssai.gov.in"},
    # West Region (Newspapers + Magazines)
    {
        "name": "Financial Express Mumbai",
        "region": "West",
        "domain": "financialexpress.com",
    },
    {
        "name": "Business Standard West",
        "region": "West",
        "domain": "business-standard.com",
    },
    {
        "name": "Navbharat Times Commerce",
        "region": "West",
        "domain": "navbharattimes.indiatimes.com",
    },
    {
        "name": "Gujarat Samachar Business",
        "region": "West",
        "domain": "gujaratsamachar.com",
    },
    {"name": "Sakal Money", "region": "West", "domain": "esakal.com"},
    {
        "name": "Entrepreneur India",
        "region": "West",
        "domain": "entrepreneur.com",
    },
    {
        "name": "Progressive Grocer India",
        "region": "West",
        "domain": "indiaretailing.com",
    },
    {"name": "Food & Beverage News", "region": "West", "domain": "fnbnews.com"},
    {
        "name": "Food Processing India",
        "region": "West",
        "domain": "foodprocessingindia.gov.in",
    },
    {
        "name": "India Retailing",
        "region": "West",
        "domain": "indiaretailing.com",
    },
    # East Region (Newspapers + Magazines)
    {
        "name": "Telegraph Business",
        "region": "East",
        "domain": "telegraphindia.com",
    },
    {
        "name": "Statesman Economy",
        "region": "East",
        "domain": "thestatesman.com",
    },
    {
        "name": "Assam Tribune Business",
        "region": "East",
        "domain": "assamtribune.com",
    },
    {
        "name": "Odisha Post Business",
        "region": "East",
        "domain": "orissapost.com",
    },
    {"name": "Millennium Post", "region": "East", "domain": "millenniumpost.in"},
    {
        "name": "Spice Board India Journal",
        "region": "East",
        "domain": "indianspices.com",
    },
    {
        "name": "Agro Spectrum",
        "region": "East",
        "domain": "agrospectrumindia.com",
    },
    {
        "name": "Commodity India East",
        "region": "East",
        "domain": "commodityindia.com",
    },
    {"name": "FnB News East", "region": "East", "domain": "fnbnews.com"},
    {"name": "Indian Food Industry", "region": "East", "domain": "afsti.org"},
]


def clean_text(raw_text):
  """Strips CDATA tags, HTML tags, and extra whitespace."""
  if not raw_text:
    return ""
  text = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", raw_text, flags=re.DOTALL)
  soup = BeautifulSoup(text, "html.parser")
  return soup.get_text().strip()


def get_existing_bulletin_data(db_client):
  """Indexes existing URLs and Titles in Firestore to prevent duplicates."""
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
      print(
          "ℹ️ Found existing bulletins for today. Highest sequence:"
          f" {highest_seq:03d}"
      )
    print(
        f"ℹ️ Indexed {len(existing_urls)} existing articles in Firestore for"
        " deduplication."
    )

  except Exception as e:
    print(f"⚠️ Could not fetch existing records for deduplication: {e}")

  return highest_seq, existing_urls, existing_titles


def generate_document_id(sequence_num):
  """Generates standard Document ID: ART_YYYY_MM_DD_XXX"""
  date_str = datetime.now().strftime("%Y_%m_%d")
  return f"ART_{date_str}_{sequence_num:03d}"


def analyze_with_gemini(headline, description):
  """Uses Gemini to generate Executive Summary, Category, and Action Advisory."""
  if not ai_client:
    return {
        "category": "🌶️ Spices & Pickles",
        "riskLevel": "MEDIUM",
        "summary": f"Key update regarding {headline[:60]}...",
        "actionAdvisory": (
            "Review regional supplier contracts and adjust safety stock"
            " buffers."
        ),
    }

  prompt = f"""
    You are an FMCG Industry Supply Chain Analyst. Analyze this news item:
    Headline: {headline}
    Description: {description}

    Return ONLY a raw valid JSON object with no backticks, markdown, or text formatting:
    {{
      "category": "🌶️ Spices & Pickles",
      "riskLevel": "MEDIUM",
      "summary": "2-sentence executive summary focused on supply chain, brand, or pricing impact.",
      "actionAdvisory": "1-sentence strategic action advisory for procurement teams."
    }}

    Allowed category values: "🌶️ Spices & Pickles", "🌾 Grains & Pulses", "🥛 Dairy & Edible Oils", "📦 Packaging & Logistics".
    Allowed riskLevel values: "HIGH", "MEDIUM", "LOW".
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

    return json.loads(text)
  except Exception as e:
    print(f"   ⚠️ Gemini AI API Error Details: {e}")
    return {
        "category": "🌶️ Spices & Pickles",
        "riskLevel": "MEDIUM",
        "summary": description[:150] if description else headline,
        "actionAdvisory": (
            "Monitor regional market movements and adjust procurement buffers."
        ),
    }


def fetch_targeted_outlet_news(outlet):
  """Constructs a Google News Search RSS feed query for a target outlet domain."""
  headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
  articles = []

  # Format: site:domain.com (Keywords)
  query = f'site:{outlet["domain"]} ({SEARCH_QUERY_STRING})'
  encoded_query = urllib.parse.quote(query)

  # FIXED: Removed Markdown brackets and redundant base URL duplication
  rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-IN&gl=IN&ceid=IN:en"

  try:
    res = requests.get(rss_url, headers=headers, timeout=10)
    if res.status_code == 200:
      soup = BeautifulSoup(res.content, "xml")
      items = soup.find_all("item")

      for item in items[:2]:  # Limit top 2 articles per target outlet
        title_elem = item.find("title")
        link_elem = item.find("link")
        desc_elem = item.find("description")

        title = (
            clean_text(title_elem.text)
            if title_elem and title_elem.text
            else ""
        )
        link = link_elem.text.strip() if link_elem and link_elem.text else ""
        desc = (
            clean_text(desc_elem.text) if desc_elem and desc_elem.text else ""
        )

        if title:
          articles.append({
              "title": title,
              "url": link,
              "raw_desc": desc,
              "source": outlet["name"],
              "region": outlet["region"],
          })
  except Exception as e:
    print(f"   ⚠️ Could not fetch query for {outlet['name']}: {e}")

  return articles


def run_scraper():
  print(
      "\n🚀 Starting Comprehensive FMCG Market Scraper (40 Outlets +"
      " Spices/Pickles Matrix)...\n"
  )

  current_sequence, existing_urls, existing_titles = get_existing_bulletin_data(
      db
  )
  processed_count = 0
  skipped_count = 0

  print(
      f"📌 Matrix Scope: Searching {len(TARGET_OUTLETS)} Target Publications"
      " across North, South, West, East..."
  )
  print(
      "🔑 Keywords Loaded: Spices, Pickles, Desai Brothers, Mother's Recipe,"
      " Suhana, Everest, MDH, ITC, Nestle, APMC, ETO.\n"
  )

  for outlet in TARGET_OUTLETS:
    print(f"🔍 Searching {outlet['name']} ({outlet['region']} Region)...")
    articles = fetch_targeted_outlet_news(outlet)

    for article in articles:
      clean_url = article["url"].strip().lower()
      clean_title = article["title"].strip().lower()

      # Deduplication Check
      if (clean_url and clean_url in existing_urls) or (
          clean_title and clean_title in existing_titles
      ):
        skipped_count += 1
        print(f"   ⏩ Duplicate Skipped: {article['title'][:50]}...")
        continue

      current_sequence += 1
      processed_count += 1

      doc_id = generate_document_id(current_sequence)
      print(f"   📄 Processing [{doc_id}]: {article['title'][:60]}...")

      # Gemini AI Analysis with error handling block and rate-limit pause
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

      # Store Payload
      doc_payload = {
          "title": article["title"],
          "source": article["source"],
          "region": article["region"],
          "category": ai_data.get("category", "🌶️ Spices & Pickles"),
          "riskLevel": ai_data.get("riskLevel", "MEDIUM"),
          "summary": ai_data.get("summary", ""),
          "actionAdvisory": ai_data.get("actionAdvisory", ""),
          "url": article["url"],
          "timestamp": (
              firestore.SERVER_TIMESTAMP
              if db
              else datetime.now(timezone.utc).isoformat()
          ),
          "createdDate": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
      }

      if db:
        doc_ref = db.collection("bulletins").document(doc_id)
        doc_ref.set(doc_payload)
        print(f"   ✅ Stored in Firestore -> Doc ID: {doc_id}")
      else:
        print(f"   ℹ️ [Dry Run Payload Saved] -> Doc ID: {doc_id}")

      if clean_url:
        existing_urls.add(clean_url)
      if clean_title:
        existing_titles.add(clean_title)

      # Pause for 12-15 seconds between requests to stay safely under the free tier 5 RPM limit[cite: 2]
      time.sleep(12)

  print("\n🎉 Scraper Execution Complete!")
  print(f"   ✨ Total New Relevant Bulletins Processed: {processed_count}")
  print(f"   ⏩ Duplicate Bulletins Skipped: {skipped_count}")


if __name__ == "__main__":
  run_scraper()