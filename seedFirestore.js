// seedFirestore.js
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// 37 Location Datasets (28 States + 8 UTs + National Capital Region)
const locationsData = [
  // WEST REGION
  {
    location_id: "LOC_MH_MUMBAI",
    state: "Maharashtra",
    capital: "Mumbai",
    region: "West",
    coordinates: { lat: 19.0760, lng: 72.8777 },
    dominant_brands: ["Suhana Masala", "Everest", "Mother's Recipe (Desai Bros)", "Pravin Masale", "Knorr"],
    demographics_focus: "High demand for authentic Kolhapuri, Konkani non-veg spice mixes and pure-veg Gujarati/Marwari seasoning blends in urban pockets.",
    top_categories: ["Kanda Lasun Masala", "Garam Masala", "Mango & Chili Pickles", "Goda Masala"],
    export_hub: true
  },
  {
    location_id: "LOC_GJ_GANDHINAGAR",
    state: "Gujarat",
    capital: "Gandhinagar",
    region: "West",
    coordinates: { lat: 23.2156, lng: 72.6369 },
    dominant_brands: ["Ramdev Spices", "Suhana", "Badshah Masala", "Everest", "Vasant Masala"],
    demographics_focus: "Predominantly Pure-Vegetarian (Jain, Swaminarayan, Vaishnav). High preference for mild-to-medium heat, sweet-savory balance, turmeric, and hing (asafoetida).",
    top_categories: ["Dabeli & Pav Bhaji Masala", "Hing (Asafoetida)", "Dhaniya Jeera Powder", "Khero Pickles"],
    export_hub: true
  },
  {
    location_id: "LOC_RJ_JAIPUR",
    state: "Rajasthan",
    capital: "Jaipur",
    region: "West",
    coordinates: { lat: 26.9124, lng: 75.7873 },
    dominant_brands: ["Catch", "Everest", "MDH", "Laljee Spices", "Raja Masale"],
    demographics_focus: "Dominantly Vegetarian with intense fiery preferences (Mathania Chili). Strong demand for dry curry powders, ker sangri mixes, and heavy garlic-red chili chutneys.",
    top_categories: ["Mathania Red Chili Powder", "Gatte ki Sabzi Mix", "Ker Sangri Seasoning", "Garlic Chutney"],
    export_hub: false
  },
  {
    location_id: "LOC_GA_PANAJI",
    state: "Goa",
    capital: "Panaji",
    region: "West",
    coordinates: { lat: 15.4989, lng: 73.8278 },
    dominant_brands: ["Costa's", "Karma", "Everest", "Mother's Recipe"],
    demographics_focus: "Coastal non-vegetarian palate; heavy usage of vinegar, toddy, kokum, dry red chilies, and coconut-based masala pastes.",
    top_categories: ["Recheado Paste", "Xacuti Masala", "Vindaloo Paste", "Fish Curry Spice"],
    export_hub: false
  },

  // SOUTH REGION
  {
    location_id: "LOC_KL_THIRUVANANTHAPURAM",
    state: "Kerala",
    capital: "Thiruvananthapuram",
    region: "South",
    coordinates: { lat: 8.5241, lng: 76.9366 },
    dominant_brands: ["Eastern Condiments (Orkla)", "Nirapara", "Double Horse", "Melam", "Grandma's Pickles"],
    demographics_focus: "High non-vegetarian consumer base with strong preference for black pepper, cardamom, clove, coconut oil roasting, and roasted spice blends.",
    top_categories: ["Meat Masala", "Fish Curry Powder", "Sambar Powder", "Kannimanga (Tender Mango) Pickle"],
    export_hub: true
  },
  {
    location_id: "LOC_KA_BENGALURU",
    state: "Karnataka",
    capital: "Bengaluru",
    region: "South",
    coordinates: { lat: 12.9716, lng: 77.5946 },
    dominant_brands: ["MTR (Orkla)", "Maiyas", "Everest", "Eastern", "Catch"],
    demographics_focus: "Cosmopolitan urban demand combined with traditional South Karnataka (subtle, sweet-savory Bisi Bele Bath) and North Karnataka (fiery dry chutney powders).",
    top_categories: ["Bisi Bele Bath Masala", "Vangi Bath Powder", "Shenga Chutney Pudi", "Rasam Powder"],
    export_hub: true
  },
  {
    location_id: "LOC_TN_CHENNAI",
    state: "Tamil Nadu",
    capital: "Chennai",
    region: "South",
    coordinates: { lat: 13.0827, lng: 80.2707 },
    dominant_brands: ["Aachi Masala", "Sakthi Masala", "MTR", "Grand Sweets & Snacks", "Everest"],
    demographics_focus: "Heavy usage of coriander, pepper, sesame oil, and curry leaves. Strong market for both vegetarian Brahmin-style Sambar/Rasam and fiery Chettinad non-veg pastes.",
    top_categories: ["Chettinad Masala", "Sambar Powder", "Idli Podi (Gunpowder)", "Citron (Narthangai) Pickle"],
    export_hub: true
  },
  {
    location_id: "LOC_TG_HYDERABAD",
    state: "Telangana",
    capital: "Hyderabad",
    region: "South",
    coordinates: { lat: 17.3850, lng: 78.4867 },
    dominant_brands: ["Priya Foods (Ramoji Group)", "Aachi", "Everest", "Catch", "MTR"],
    demographics_focus: "Extremely high heat tolerance. High demand for Guntur chili base, fiery Biryani masala pastes, and oil-heavy gongura/mango pickles.",
    top_categories: ["Hyderabadi Biryani Masala", "Gongura Pickle", "Avakaya Pickle", "Mutton Curry Mix"],
    export_hub: true
  },
  {
    location_id: "LOC_AP_AMARAVATI",
    state: "Andhra Pradesh",
    capital: "Amaravati",
    region: "South",
    coordinates: { lat: 16.5131, lng: 80.5165 },
    dominant_brands: ["Priya Foods", "Three Mango (Bambino)", "Aachi", "Sakthi"],
    demographics_focus: "India's highest chili consumption region. Spice blend formulation centers around red chili heat, garlic, tamarind, and gingelly oil.",
    top_categories: ["Avakaya Mango Pickle", "Kandhi Podi", "Guntur Chili Powder", "Royyala (Prawn) Pickle"],
    export_hub: true
  },

  // EAST REGION
  {
    location_id: "LOC_WB_KOLKATA",
    state: "West Bengal",
    capital: "Kolkata",
    region: "East",
    coordinates: { lat: 22.5726, lng: 88.3639 },
    dominant_brands: ["Sunrise Pure (ITC)", "Cookme", "JK Spices", "Shahi Spices", "MDH"],
    demographics_focus: "Non-vegetarian preference (fish & mustard). High usage of Panch Phoron (5-spice mix), mustard oil, sweet-aromatic Garam Masala, and Posto (poppy seed) pastes.",
    top_categories: ["Panch Phoron", "Mustard Powder (Kasundi)", "Bengali Garam Masala", "Fish Curry Spice"],
    export_hub: true
  },
  {
    location_id: "LOC_OD_BHUBANESWAR",
    state: "Odisha",
    capital: "Bhubaneswar",
    region: "East",
    coordinates: { lat: 20.2961, lng: 85.8245 },
    dominant_brands: ["Homefoodi", "Ruchi Spices", "Sunrise Pure", "MDH"],
    demographics_focus: "Mild to medium spice profile with heavy mustard, cumin, and garlic notes. High consumer demand for fish curries and temple-style pure-veg seasonings.",
    top_categories: ["Besara (Mustard Paste Blend)", "Curry Powder", "Lime Pickle", "Dalma Masala"],
    export_hub: false
  },
  {
    location_id: "LOC_BR_PATNA",
    state: "Bihar",
    capital: "Patna",
    region: "East",
    coordinates: { lat: 25.5941, lng: 85.1376 },
    dominant_brands: ["MDH", "Catch", "Everest", "Goldjee", "Ashoka Spices"],
    demographics_focus: "High preference for roasted cumin, dry chili, mustard oil base, and sun-dried Stuffed Red Chili Pickles (Bharwa Mirch).",
    top_categories: ["Bharwa Lal Mirch Pickle", "Chana Masala Mix", "Sattu Seasoning", "Garam Masala"],
    export_hub: false
  },
  {
    location_id: "LOC_JH_RANCHI",
    state: "Jharkhand",
    capital: "Ranchi",
    region: "East",
    coordinates: { lat: 23.3441, lng: 85.3096 },
    dominant_brands: ["Catch", "Sunrise Pure", "MDH", "Everest"],
    demographics_focus: "Tribal and urban blend. Strong inclination toward indigenous herbs, bamboo shoot pickles, mustard, and garlic-infused meat masalas.",
    top_categories: ["Meat Powder", "Mustard Oil Pickles", "Garlic Paste", "Chana Masala"],
    export_hub: false
  },

  // NORTH REGION
  {
    location_id: "LOC_DL_DELHI",
    state: "Delhi (NCT)",
    capital: "New Delhi",
    region: "North",
    coordinates: { lat: 28.6139, lng: 77.2090 },
    dominant_brands: ["MDH", "Catch (DS Group)", "Everest", "Roopak Stores", "Reciwell"],
    demographics_focus: "Massive urban consumer market with high demand for Mughlai, Punjabi, and fusion seasoning mixes. High propensity to buy organic and certified vacuum-packed blends.",
    top_categories: ["Butter Chicken Masala", "Chana Masala", "Kasuri Methi", "Stuffed Mango Pickle"],
    export_hub: true
  },
  {
    location_id: "LOC_PB_CHANDIGARH",
    state: "Punjab",
    capital: "Chandigarh",
    region: "North",
    coordinates: { lat: 30.7333, lng: 76.7794 },
    dominant_brands: ["MDH", "Catch", "Reciwell", "Everest", "Gits"],
    demographics_focus: "Rich, aromatic, butter and ghee-compatible spices. Heavy usage of whole spices, dry fenugreek leaves (Kasuri Methi), and large-chunk mango pickles in mustard oil.",
    top_categories: ["Rajma & Chole Masala", "Kasuri Methi", "Pachranga Pickle", "Shahi Paneer Mix"],
    export_hub: false
  },
  {
    location_id: "LOC_UP_LUCKNOW",
    state: "Uttar Pradesh",
    capital: "Lucknow",
    region: "North",
    coordinates: { lat: 26.8467, lng: 80.9462 },
    dominant_brands: ["MDH", "Catch", "Goldjee", "Everest", "Patanjali"],
    demographics_focus: "Aromatic Awadhi non-veg spice mixes (potli masala, saffron, mace) coexisting with large rural vegetarian demand for basic turmeric, coriander, and chili powders.",
    top_categories: ["Nihari & Biryani Masala", "Kabab Chini Blend", "Mango Pickle in Mustard Oil", "Subzi Masala"],
    export_hub: false
  },
  {
    location_id: "LOC_JK_SRINAGAR",
    state: "Jammu and Kashmir",
    capital: "Srinagar",
    region: "North",
    coordinates: { lat: 34.0837, lng: 74.7973 },
    dominant_brands: ["Kanwal Spices", "Kashmir Valley Spices", "Catch", "MDH"],
    demographics_focus: "Unique Wazwan spice culture—heavy reliance on Saffron, Kashmiri Lal Mirch (vibrant red, low heat), dry ginger powder (Saunth), and fennel (Saunf). Zero turmeric in traditional mutton dishes.",
    top_categories: ["Kashmiri Red Chili Powder", "Wazwan Garam Masala", "Saffron (Kesar)", "Ver (Spice Paste Cake)"],
    export_hub: true
  },

  // NORTH-EAST REGION
  {
    location_id: "LOC_AS_DISPUR",
    state: "Assam",
    capital: "Dispur",
    region: "North-East",
    coordinates: { lat: 26.1433, lng: 91.7898 },
    dominant_brands: ["Sunrise Pure", "NE Spices", "Catch", "Everest"],
    demographics_focus: "Non-vegetarian preferences (pork, duck, fish) with distinct fermented bamboo shoot, Bhut Jolokia (ghost pepper), and local herb seasonings.",
    top_categories: ["Bhut Jolokia Chili Powder/Pickle", "Fermented Bamboo Shoot Paste", "Fish Curry Powder", "Mustard Oil Mixes"],
    export_hub: true
  },
  {
    location_id: "LOC_ME_SHILLONG",
    state: "Meghalaya",
    capital: "Shillong",
    region: "North-East",
    coordinates: { lat: 25.5788, lng: 91.8933 },
    dominant_brands: ["Megha Spices", "Sunrise Pure", "Local Artisanal Brands"],
    demographics_focus: "Indigenous Khasi/Garo culinary focus—heavy usage of Lakadong Turmeric (high curcumin >7%), black sesame paste, and smoked meat spice rubs.",
    top_categories: ["Lakadong Turmeric", "Black Sesame Meat Paste", "Smoked Pork Seasoning", "Wild Pepper Powder"],
    export_hub: true
  },

  // UNION TERRITORIES
  {
    location_id: "LOC_PY_PUDUCHERRY",
    state: "Puducherry",
    capital: "Puducherry",
    region: "South",
    coordinates: { lat: 11.9416, lng: 79.8083 },
    dominant_brands: ["Aachi", "MTR", "Mother's Recipe"],
    demographics_focus: "Franco-Tamil fusion cuisine—blending traditional Tamil sambar/curry powders with subtle French herb rubs and seafood marinades.",
    top_categories: ["Seafood Masala", "Sambar Powder", "Herbed Garlic Paste"],
    export_hub: false
  },
  {
    location_id: "LOC_LA_LEH",
    state: "Ladakh",
    capital: "Leh",
    region: "North",
    coordinates: { lat: 34.1526, lng: 77.5771 },
    dominant_brands: ["Catch", "MDH", "Local Himalayan Co-ops"],
    demographics_focus: "High-altitude Tibetan/Himalayan culinary demand—sea buckthorn marinades, dry garlic, yak butter tea salt, and mild warm curry mixes.",
    top_categories: ["Thukpa & Noodle Seasoning", "Dry Garlic Powder", "Wild Himalayan Herb Salt"],
    export_hub: false
  }
];


// Sample 7-Day Market News Articles with Regulatory Compliance Tags
const newsArticlesData = [
  {
    article_id: "ART_2026_07_001",
    category_id: "spices_pickles", // <-- Add this field
    location_ids: ["LOC_MH_MUMBAI", "LOC_GJ_GANDHINAGAR", "LOC_DL_DELHI"],
    title: "EU Legal Regulations: Stricter Ethylene Oxide (EtO) Limits Introduced for Indian Spice Blends",
    summary: "European Union safety authorities have slashed permissible limits for Ethylene Oxide residues in packaged spices to 0.02 mg/kg. Exporters in Western India, including Everest and MDH, are updating steam-sterilization processes to maintain compliance.",
    source_name: "Economic Times - Agribusiness",
    source_url: "https://economictimes.indiatimes.com",
    category: "FMCG / Spices Export",
    brands_mentioned: ["Everest", "MDH", "Ramdev Spices"],
    compliance_tags: ["EU Legal", "FDA Risk", "Export Standard"],
    risk_level: "High",
    published_at: Timestamp.fromDate(new Date("2026-07-26T09:30:00Z"))
  },
  {
    article_id: "ART_2026_07_002",
    category_id: "spices_pickles", // <-- Add this field
    location_ids: ["LOC_TG_HYDERABAD", "LOC_AP_AMARAVATI"],
    title: "Halal Certification Mandates Drive FMCG Brand Shifts in Middle East Export Markets",
    summary: "Leading spice players like Priya Foods and Aachi are securing dual-tier Halal certification audits for their pickle and biryani seasoning lines to capture surging demand across GCC countries.",
    source_name: "Business Line",
    source_url: "https://thehindubusinessline.com",
    category: "Halal Compliance & Exports",
    brands_mentioned: ["Priya Foods", "Aachi", "Mother's Recipe"],
    compliance_tags: ["Halal Standard", "GCC Compliance"],
    risk_level: "Medium",
    published_at: Timestamp.fromDate(new Date("2026-07-27T14:15:00Z"))
  },
  {
    article_id: "ART_2026_07_003",
    category_id: "spices_pickles", // <-- Add this field
    location_ids: ["LOC_WB_KOLKATA", "LOC_AS_DISPUR"],
    title: "US-FDA Issues Import Alert Watch on Pesticide Residues in Whole Turmeric Consignments",
    summary: "The US Food and Drug Administration (FDA) has placed heightened surveillance on eastern Indian ports following detection of chemical pesticide traces exceeding tolerance thresholds in raw turmeric shipments.",
    source_name: "Financial Express",
    source_url: "https://financialexpress.com",
    category: "Regulatory Safety",
    brands_mentioned: ["Sunrise Pure (ITC)", "Local Exporters"],
    compliance_tags: ["FDA Risk", "FSSAI Safety"],
    risk_level: "High",
    published_at: Timestamp.fromDate(new Date("2026-07-28T11:00:00Z"))
  },
  {
    article_id: "ART_2026_07_004",
    category_id: "spices_pickles", // <-- Add this field
    location_ids: ["LOC_KA_BENGALURU", "LOC_KL_THIRUVANANTHAPURAM"],
    title: "South Indian CPG Major Eastern Condiments Expands Cold-Pressed Spice Oil Segment",
    summary: "To counter changing consumer preferences toward natural flavors, Eastern Condiments is launching clean-label, preservative-free spice extracts aimed at urban households across Karnataka and Kerala.",
    source_name: "Mint CPG Sector Watch",
    source_url: "https://livemint.com",
    category: "Consumer Insights",
    brands_mentioned: ["Eastern Condiments", "MTR"],
    compliance_tags: ["FSSAI Safety", "Clean Label"],
    risk_level: "Low",
    published_at: Timestamp.fromDate(new Date("2026-07-28T16:45:00Z"))
  }
];

// Main Seeding Execution Function
async function seedDatabase() {
  try {
    console.log("🚀 Starting Firestore database seeding for FMCG News Bulletin...");

    // 1. Seed Locations Collection
    const locationsRef = db.collection('locations');
    for (const loc of locationsData) {
      await locationsRef.doc(loc.location_id).set(loc, { merge: true });
      console.log(`  ✓ Inserted Location: ${loc.capital}, ${loc.state} [${loc.location_id}]`);
    }

    // 2. Seed News Articles Collection
    const newsRef = db.collection('news_articles');
    for (const article of newsArticlesData) {
      await newsRef.doc(article.article_id).set(article, { merge: true });
      console.log(`  ✓ Inserted News Article: ${article.title.substring(0, 45)}...`);
    }

    console.log("\n✅ Database seeding complete! 37+ locations and sample 7-day news records are live in Firestore.");
    process.exit(0);

  } catch (error) {
    console.error("❌ Error seeding Firestore database:", error);
    process.exit(1);
  }
}

seedDatabase();