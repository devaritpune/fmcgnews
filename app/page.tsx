"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { collection, query, getDocs, limit, where, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";

function formatDate(dateValue: any): string {
  if (!dateValue) return "";
  if (typeof dateValue === "object" && dateValue.seconds) {
    return new Date(dateValue.seconds * 1000).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  if (typeof dateValue === "string") {
    const d = new Date(dateValue);
    return isNaN(d.getTime())
      ? dateValue
      : d.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
  }
  return String(dateValue);
}

const IndiaMap = dynamic(() => import("../components/IndiaMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[620px] bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-emerald-400 font-medium animate-pulse gap-3">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <span>📍 Initializing Pan-India Geospatial Intelligence Engine...</span>
    </div>
  ),
});

interface BusinessAdvisory {
  qa_compliance?: string;
  supply_chain?: string;
  export_strategy?: string;
}

interface Freshness {
  is_fresh: boolean;
  age_days: number | null;
  max_age_days: number;
  published_at_iso: string;
  reason: string;
}

interface BusinessRelevance {
  is_business_intelligence: boolean;
  strategic_value_score: number;
  content_type: string;
  reason: string;
}

interface Relevance {
  is_fmcg_relevant: boolean;
  category_match: boolean;
  relevance_score: number;
  suggested_category: string;
  reason: string;
  business_relevance: BusinessRelevance;
}

interface RecommendedAction {
  function: string;
  action: string;
  horizon: string;
}

interface DecisionIntelligence {
  event_type: string;
  what_changed: string;
  why_it_matters: string;
  strategic_significance: string;
  functions_affected: string[];
  recommended_actions: RecommendedAction[];
  watch_indicators: string[];
  risk_type: string;
  risk_rationale: string;
  opportunity: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | string;
}

const hasMeaningfulText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeDecisionIntelligence = (value: unknown): DecisionIntelligence | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const data = value as Record<string, unknown>;
  const text = (field: string) => hasMeaningfulText(data[field]) ? data[field].trim() : "";
  const functionsAffected = Array.isArray(data.functions_affected)
    ? data.functions_affected.filter(hasMeaningfulText).map((item) => item.trim())
    : [];
  const watchIndicators = Array.isArray(data.watch_indicators)
    ? data.watch_indicators.filter(hasMeaningfulText).map((item) => item.trim())
    : [];
  const recommendedActions = Array.isArray(data.recommended_actions)
    ? data.recommended_actions.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const action = item as Record<string, unknown>;
        const normalizedAction = {
          function: hasMeaningfulText(action.function) ? action.function.trim() : "",
          action: hasMeaningfulText(action.action) ? action.action.trim() : "",
          horizon: hasMeaningfulText(action.horizon) ? action.horizon.trim() : "",
        };
        return Object.values(normalizedAction).some(hasMeaningfulText) ? [normalizedAction] : [];
      })
    : [];

  const normalized: DecisionIntelligence = {
    event_type: text("event_type"),
    what_changed: text("what_changed"),
    why_it_matters: text("why_it_matters"),
    strategic_significance: text("strategic_significance"),
    functions_affected: functionsAffected,
    recommended_actions: recommendedActions,
    watch_indicators: watchIndicators,
    risk_type: text("risk_type"),
    risk_rationale: text("risk_rationale"),
    opportunity: text("opportunity"),
    confidence: text("confidence"),
  };

  return Object.values(normalized).some((item) =>
    Array.isArray(item) ? item.length > 0 : hasMeaningfulText(item)
  ) ? normalized : undefined;
};

interface Article {
  id: string;
  title: string;
  category: string;
  categoryName?: string;
  sub_category?: string;
  market_scope?: string;
  summary: string;
  full_content?: string;
  region: string;
  geographicScope?: string;
  states?: string[];
  cities?: string[];
  regionConfidence?: string;
  regionEvidence?: string;
  published_at?: any;
  published_date?: string;
  date?: any;
  timestamp?: any;
  createdDate?: string;
  source_name?: string;
  source?: string;
  source_url?: string;
  url?: string;
  key_takeaway?: string;
  riskLevel?: string;
  freshness?: Freshness;
  relevance?: Relevance;
  decision_intelligence?: DecisionIntelligence;
  business_advisory?: BusinessAdvisory;
  actionAdvisory?: string;
  language?: string;
}

// Multilingual Mock Dictionary / Translation Engine for Indian Languages
const TRANSLATIONS: Record<string, Record<string, string>> = {
  Hindi: {
    "AI MARKET INSIGHTS": "एआई बाज़ार अंतर्दृष्टि",
    "Executive Summary": "कार्यकारी सारांश",
    "Market Outlook": "बाज़ार दृष्टिकोण",
    "Bullish": "तेजी (Bullish)",
    "Read Executive Bulletin": "कार्यकारी बुलेटिन पढ़ें",
    "Share": "शेयर करें",
    "Domestic Market": "घरेलू बाज़ार",
    "IB (International Business & Exports)": "अंतर्राष्ट्रीय व्यापार और निर्यात",
    "Regulatory & Food Safety": "नियामक और खाद्य सुरक्षा",
    "All Bulletins (All India)": "सभी बुलेटिन (अखिल भारत)"
  },
  Bengali: {
    "AI MARKET INSIGHTS": "এআই বাজার অন্তর্দৃষ্টি",
    "Executive Summary": "নির্বাহী সারসংক্ষেপ",
    "Market Outlook": "বাজারের দৃষ্টিভঙ্গি",
    "Bullish": "ঊর্ধ্বমুখী (Bullish)",
    "Read Executive Bulletin": "নির্বাহী বুলেটিন পড়ুন",
    "Share": "শেয়ার করুন",
    "Domestic Market": "গার্হস্থ্য বাজার",
    "IB (International Business & Exports)": "আন্তর্জাতিক বাণিজ্য এবং রপ্তানি",
    "Regulatory & Food Safety": "নিয়ন্ত্রক এবং খাদ্য নিরাপত্তা",
    "All Bulletins (All India)": "সমস্ত বুলেটিন (সর্বভারতীয়)"
  },
  Telugu: {
    "AI MARKET INSIGHTS": "AI మార్కెట్ అంతर्दृष्टि",
    "Executive Summary": "నిర్వాహక సారాంశం",
    "Market Outlook": "మార్కెట్ దృక్పథం",
    "Bullish": "బుల్లిష్",
    "Read Executive Bulletin": "ఎగ్జిక్యూటివ్ బుెటిన్ చదవండి",
    "Share": "షేర్ చేయండి",
    "Domestic Market": "దేశీయ మార్కెట్",
    "IB (International Business & Exports)": "అంతర్జాతీయ వ్యాపారం & ఎగుమతులు",
    "Regulatory & Food Safety": "నియంత్రణ & ఆహార భద్రత",
    "All Bulletins (All India)": "అన్ని బుెటిన్‌లు (అఖిల భారతదేశం)"
  },
  Marathi: {
    "AI MARKET INSIGHTS": "एआय बाजार अंतर्दृष्टी",
    "Executive Summary": "कार्यकारी सारांश",
    "Market Outlook": "बाजार दृष्टिकोन",
    "Bullish": "बुलीश",
    "Read Executive Bulletin": "कार्यकारी बुलेटिन वाचा",
    "Share": "शेअर करा",
    "Domestic Market": "देशंतर्गत बाजारपेठ",
    "IB (International Business & Exports)": "आंतरराष्ट्रीय व्यापार आणि निर्यात",
    "Regulatory & Food Safety": "नियामक आणि अन्न सुरक्षा",
    "All Bulletins (All India)": "सर्व बुलेटिन (अखिल भारत)"
  },
  Tamil: {
    "AI MARKET INSIGHTS": "AI சந்தை நுண்ணறிவு",
    "Executive Summary": "நிர்வாக சுருக்கம்",
    "Market Outlook": "சந்தை கண்ணோட்டம்",
    "Bullish": "உச்சநிலை",
    "Read Executive Bulletin": "செய்தி குறிப்பை படிக்கவும்",
    "Share": "பகிரவும்",
    "Domestic Market": "உள்நாட்டு சந்தை",
    "IB (International Business & Exports)": "சர்வதேச வணிகம் & ஏற்றுமதி",
    "Regulatory & Food Safety": "ஒழுங்குமுறை & உணவு பாதுகாப்பு",
    "All Bulletins (All India)": "அனைத்து বুলেটின்களும்"
  },
  Gujarati: {
    "AI MARKET INSIGHTS": "એઆઈ માર્કેટ આંતरદૃષ્ટિ",
    "Executive Summary": "कार्यकारी सारांश",
    "Market Outlook": "બજાર દૃષ્ટિકોણ",
    "Bullish": "બુલીશ",
    "Read Executive Bulletin": "બુલેટિન વાંચો",
    "Share": "શેર કરો",
    "Domestic Market": "ઘરેलू બજાર",
    "IB (International Business & Exports)": "આંતરરાષ્ટ્રીય વ્યાપાર અને નિકાસ",
    "Regulatory & Food Safety": "નિયમન અને ખાદ્ય સુરક્ષા",
    "All Bulletins (All India)": "બધા બુલેટિન"
  },
  Kannada: {
    "AI MARKET INSIGHTS": "AI ಮಾರುಕಟ್ಟೆ ಒಳಹೋಟುಗಳು",
    "Executive Summary": "ಕಾರ್ಯನಿರ್ವಾಹಕ ಸಾರಾಂಶ",
    "Market Outlook": "ಮಾರುಕಟ್ಟೆ ದೃಷ್ಟಿಕೋನ",
    "Bullish": "ಬುಲಿಶ್",
    "Read Executive Bulletin": "ಬುಲೆಟಿನ್ ಓದಿ",
    "Share": "ಹಂಚಿಕೊಳ್ಳಿ",
    "Domestic Market": "ದೇಶೀಯ ಮಾರುಕಟ್ಟೆ",
    "IB (International Business & Exports)": "ಅಂತರರಾಷ್ಟ್ರೀಯ ವ್ಯಾಪಾರ ಮತ್ತು ರಫ್ತು",
    "Regulatory & Food Safety": "ನಿಯಂತ್ರಣ ಮತ್ತು ಆಹಾರ ಸುರಕ್ಷತೆ",
    "All Bulletins (All India)": "ಎಲ್ಲಾ ಬುಲೆಟಿನ್‌ಗಳು"
  },
  Malayalam: {
    "AI MARKET INSIGHTS": "AI മാർക്കറ്റ് ഉൾക്കാഴ്ചകൾ",
    "Executive Summary": "എക്സിക്യൂട്ടീവ് സംഗ്രഹം",
    "Market Outlook": "വിപണി വീക്ഷണം",
    "Bullish": "ബുള്ളിഷ്",
    "Read Executive Bulletin": "ബുള്ളറ്റിൻ വായിക്കുക",
    "Share": "പങ്കിടുക",
    "Domestic Market": "ആഭ്യന്തര വിപണി",
    "IB (International Business & Exports)": "അന്താരാഷ്ട്ര വ്യാപാരവും കയറ്റുമതിയും",
    "Regulatory & Food Safety": "റെഗുലേറ്ററി & ഭക്ഷ്യ സുരക്ഷ",
    "All Bulletins (All India)": "എല്ലാ ബുള്ളറ്റിനുകളും"
  },
  Punjabi: {
    "AI MARKET INSIGHTS": "ਏਆਈ ਮਾਰਕੀਟ ਸੂਝ",
    "Executive Summary": "कार्यकारी सारांश",
    "Market Outlook": "ਬਜ਼ਾਰ ਦ੍ਰਿਸ਼ਟੀਕੋਣ",
    "Bullish": "ਤੇਜ਼ੀ",
    "Read Executive Bulletin": "ਬੁਲੇਟਿਨ ਪੜ੍ਹੋ",
    "Share": "ਸ਼ੇਅਰ ਕਰੋ",
    "Domestic Market": "ਘਰੇਲੂ ਬਾਜ਼ਾਰ",
    "IB (International Business & Exports)": "ਅੰਤਰਰਾਸ਼ਟਰੀ ਵਪਾਰ ਅਤੇ ਨਿਰਯਾਤ",
    "Regulatory & Food Safety": "ਰੈਗੂਲੇਟਰੀ ਅਤੇ ਭੋਜਨ ਸੁਰੱਖਿਆ",
    "All Bulletins (All India)": "ਸਾਰੇ ਬੁਲੇਟਿਨ"
  }
};

export default function Home() {
  const [activeViewTab, setActiveViewTab] = useState<"intelligence" | "map">("intelligence");
  const [selectedRegion, setSelectedRegion] = useState<string>("All");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("English");
  const [selectedCategory, setSelectedCategory] = useState<string>("Spices & Pickles");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("All");

  // Available FMCG categories dynamically defined
  const FMCG_CATEGORIES = [
    { name: "Spices & Pickles", emoji: "🌶️" },
    { name: "Dairy & Beverages", emoji: "🥛" },
    { name: "Oils & Ghee", emoji: "🍳" },
    { name: "Snacks & Confectionery", emoji: "🍿" },
    { name: "Personal Care", emoji: "🧴" },
    { name: "Grains & Staples", emoji: "🌾" },
    { name: "Frozen Food", emoji: "❄️" },
    { name: "Home Care", emoji: "🧹" },
  ];

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const t = (text: string): string => {
    if (selectedLanguage === "English") return text;
    return TRANSLATIONS[selectedLanguage]?.[text] || text;
  };

  useEffect(() => {
    async function fetchNews() {
      setLoading(true);
      setFetchError(null);
      try {
        const bulletinsCol = collection(db, "bulletins");
        let constraints = [];

        // Apply region filter if not "All"
        if (selectedRegion !== "All") {
          constraints.push(where("region", "==", selectedRegion));
        }

        // Filter by categoryName - this matches what the scraper sets
        constraints.push(where("categoryName", "==", selectedCategory));

        // Filter for the last 7 days for better data availability
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        constraints.push(where("timestamp", ">=", sevenDaysAgo));

        // Order by most recent and limit the results
        constraints.push(orderBy("timestamp", "desc"));
        constraints.push(limit(100));

        const q = query(bulletinsCol, ...constraints);
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          setFetchError(`No articles found for ${selectedCategory} in the last 7 days. Check if the scraper has run and populated data.`);
          setArticles([]);
          setLoading(false);
          return;
        }

        let docs: Article[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || "Untitled Market Bulletin",
            category: data.category || "📰",
            categoryName: data.categoryName,
            summary: data.summary || "",
            full_content: data.summary || "",
            region: data.region || "Pan-India",
            geographicScope: data.geographicScope,
            states: Array.isArray(data.states) ? data.states : [],
            cities: Array.isArray(data.cities) ? data.cities : [],
            regionConfidence: data.regionConfidence,
            regionEvidence: data.regionEvidence,
            timestamp: data.timestamp,
            published_date: data.published_date,
            createdDate: data.createdDate,
            source: data.source || "Market Source",
            url: data.url || "",
            actionAdvisory: hasMeaningfulText(data.actionAdvisory) ? data.actionAdvisory.trim() : "",
            riskLevel: data.riskLevel || "MEDIUM",
            freshness: data.freshness || undefined,
            relevance: data.relevance || undefined,
            decision_intelligence: normalizeDecisionIntelligence(data.decision_intelligence),
            business_advisory: data.business_advisory || undefined,
            language: data.language || "English",
          };
        });

        // Apply Sub-Category Filters
        if (selectedSubCategory !== "All") {
          const isExportArticle = (title: string, summary: string): boolean => {
            const content = `${title} ${summary}`.toLowerCase();
            return /\b(export|global|shipment|international|trade|ib)\b/i.test(content);
          };

          const isRegulatoryArticle = (title: string, summary: string): boolean => {
            const content = `${title} ${summary}`.toLowerCase();
            return /\b(fssai|regulation|safety|compliance|regulatory|audit|standard)\b/i.test(content);
          };

          docs = docs.filter(item => {
            const title = item.title || "";
            const summary = item.summary || "";

            switch (selectedSubCategory) {
              case "Export":
                return isExportArticle(title, summary);
              case "Regulatory":
                return isRegulatoryArticle(title, summary);
              case "Domestic":
                return !isExportArticle(title, summary) && !isRegulatoryArticle(title, summary);
              default:
                return true;
            }
          });
        }

        setArticles(docs);
      } catch (error: any) {
        console.error("Firestore Fetch Error:", error);
        setFetchError(`Database Error: ${error.message || "Permission denied or network issue. Check Firebase rules."}`);
        setArticles([]);
      } finally {
        setLoading(false);
      }
    }

    fetchNews();
  }, [selectedCategory, selectedSubCategory, selectedRegion]);

  const executiveInsightsSummary = useMemo(() => {
    if (articles.length === 0) return "No critical market disruptions reported in the active collection.";
    const titles = articles.slice(0, 3).map((a) => a.title).join("; ");
    let text = `Synthesis of ${articles.length} active updates: Key developments across regional hubs indicate dynamic pricing, export compliance checks, and raw material safety audits. Highlights: ${titles}`;
    
    if (selectedLanguage !== "English") {
      text = `[${selectedLanguage} Translation Mode Active] ${text}`;
    }
    return text;
  }, [articles, selectedLanguage]);

  const handleWhatsAppShare = (title: string, link?: string) => {
    const text = encodeURIComponent(`*FMCG Executive Bulletin:* ${title}\nRead detail: ${link || "https://fmcgdesk.web.app"}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  const getRiskBadge = useCallback((level?: string) => {
    switch (level?.toUpperCase()) {
      case "HIGH":
        return <span className="bg-red-950/90 text-red-400 border border-red-700/80 text-xs px-2.5 py-1 rounded-md font-bold font-mono shrink-0">🚨 HIGH RISK</span>;
      case "MEDIUM":
        return <span className="bg-amber-950/90 text-amber-400 border border-amber-700/80 text-xs px-2.5 py-1 rounded-md font-bold font-mono shrink-0">⚠️ MEDIUM RISK</span>;
      default:
        return <span className="bg-emerald-950/90 text-emerald-400 border border-emerald-700/80 text-xs px-2.5 py-1 rounded-md font-bold font-mono shrink-0">✅ LOW RISK</span>;
    }
  }, []);

  return (
    <main className="min-h-screen bg-[#070d19] text-slate-100 p-4 md:p-8 font-sans antialiased">
      {/* Top Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/80 pb-6 mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 font-bold text-lg">
              🌐
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              FMCG <span className="text-emerald-400">News Desk</span>
            </h1>
          </div>
          <p className="text-slate-400 text-xs mt-1.5 font-mono tracking-wide">
            Multi-Category Executive Bulletins, Regional Trends & Consumer Insights
          </p>
        </div>

        {/* Global Controls & 10 Indian Languages Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <span className="text-xs text-slate-400">🌐</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-transparent text-xs text-emerald-400 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="English" className="bg-slate-900 text-white">English</option>
              <option value="Hindi" className="bg-slate-900 text-white">हिन्दी (Hindi)</option>
              <option value="Bengali" className="bg-slate-900 text-white">বাংলা (Bengali)</option>
              <option value="Telugu" className="bg-slate-900 text-white">తెలుగు (Telugu)</option>
              <option value="Marathi" className="bg-slate-900 text-white">मराठी (Marathi)</option>
              <option value="Tamil" className="bg-slate-900 text-white">தமிழ் (Tamil)</option>
              <option value="Gujarati" className="bg-slate-900 text-white">ગુજરાતી (Gujarati)</option>
              <option value="Kannada" className="bg-slate-900 text-white">ಕನ್ನಡ (Kannada)</option>
              <option value="Malayalam" className="bg-slate-900 text-white">മലയാളം (Malayalam)</option>
              <option value="Punjabi" className="bg-slate-900 text-white">ਪੰਜਾਬੀ (Punjabi)</option>
            </select>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">REGION:</span>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="bg-transparent text-xs text-emerald-400 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="All" className="bg-slate-900 text-white">IN All Regions (Pan-India)</option>
              <option value="North India" className="bg-slate-900 text-white">North India</option>
              <option value="South India" className="bg-slate-900 text-white">South India</option>
              <option value="East India" className="bg-slate-900 text-white">East India</option>
              <option value="West India" className="bg-slate-900 text-white">West India</option>
            </select>
          </div>
        </div>
      </header>

      {/* Categories Bar & View Tab Switcher */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          {FMCG_CATEGORIES.map((category) => (
            <button
              key={category.name}
              onClick={() => {
                setSelectedCategory(category.name);
                setSelectedSubCategory("All"); // Reset sub-category on category change
              }}
              className={`font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-2 transition border ${
                selectedCategory === category.name
                  ? "bg-emerald-950/80 border-emerald-500/80 text-emerald-300 shadow-lg shadow-emerald-950/50"
                  : "bg-slate-900/60 border-slate-700/80 text-slate-400 hover:border-slate-600"
              } cursor-pointer`}
            >
              <span>{category.emoji} {category.name}</span>
            </button>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1 self-start md:self-auto">
          <button
            onClick={() => setActiveViewTab("intelligence")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeViewTab === "intelligence"
                ? "bg-emerald-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>📊 Bulletin Tab</span>
          </button>
          <button
            onClick={() => setActiveViewTab("map")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeViewTab === "map"
                ? "bg-emerald-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>🗺️ India Map</span>
          </button>
        </div>
      </div>

      {/* Sub-Category Filters */}
      {activeViewTab === "intelligence" && (
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => setSelectedSubCategory("All")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
              selectedSubCategory === "All"
                ? "bg-emerald-500 text-slate-950 border-emerald-400"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
            }`}
          >
            ● {t("All Bulletins (All India)")}
          </button>
          <button
            onClick={() => setSelectedSubCategory("Domestic")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
              selectedSubCategory === "Domestic"
                ? "bg-emerald-500 text-slate-950 border-emerald-400"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
            }`}
          >
            🇮🇳 {t("Domestic Market")}
          </button>
          <button
            onClick={() => setSelectedSubCategory("Export")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
              selectedSubCategory === "Export"
                ? "bg-emerald-500 text-slate-950 border-emerald-400"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
            }`}
          >
            🚢 {t("IB (International Business & Exports)")}
          </button>
          <button
            onClick={() => setSelectedSubCategory("Regulatory")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
              selectedSubCategory === "Regulatory"
                ? "bg-emerald-500 text-slate-950 border-emerald-400"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
            }`}
          >
            📜 {t("Regulatory & Food Safety")}
          </button>
        </div>
      )}

      {/* AI Intelligence Header Banner */}
      {activeViewTab === "intelligence" && (
        <div className="max-w-7xl mx-auto mb-8 bg-slate-900/90 border border-emerald-900/60 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <h3 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider">
                ✨ {t("AI MARKET INSIGHTS")} <span className="text-slate-500 font-normal">| Deep Market Intelligence & Consumer Signals</span>
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {selectedLanguage !== "English" && (
                <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded uppercase tracking-wider font-mono">
                  🌐 Viewing in {selectedLanguage}
                </span>
              )}
              <span className="bg-emerald-950 text-emerald-300 border border-emerald-800/80 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                {t("Market Outlook")}: {t("Bullish")}
              </span>
            </div>
          </div>
          <p className="text-xs md:text-sm text-slate-200 leading-relaxed font-sans">
            <strong className="text-emerald-400">{t("Executive Summary")}:</strong> {executiveInsightsSummary}
          </p>
        </div>
      )}

      {/* Diagnostic Alert Box if Fetch Error Occurs */}
      {fetchError && (
        <div className="max-w-7xl mx-auto mb-6 bg-red-950/80 border border-red-700 p-4 rounded-xl text-red-300 text-xs font-mono">
          <strong>⚠️ Diagnostic Alert:</strong> {fetchError}
        </div>
      )}

      {/* VIEW CONTENT CONTAINER */}
      <div className="max-w-7xl mx-auto space-y-6">
        {activeViewTab === "map" ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <IndiaMap />
          </div>
        ) : (
          <div>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-56 animate-pulse" />
                ))}
              </div>
            ) : articles.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-2">
                <p className="text-base font-bold text-slate-200">No active bulletins found in Firebase bulletins collection.</p>
                <p className="text-xs text-slate-500">Check your browser developer console (F12) to verify if Firestore returned size 0.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {articles.map((article) => (
                  <div
                    key={article.id}
                    className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-xl"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="bg-slate-950 text-emerald-400 border border-emerald-800/60 px-2.5 py-0.5 rounded font-mono font-medium">
                          📍 {article.region || "Pan-India"}
                        </span>
                        {getRiskBadge(article.riskLevel)}
                      </div>

                      <h4
                        onClick={() => setSelectedArticle(article)}
                        className="text-base font-bold text-white leading-snug hover:text-emerald-400 transition cursor-pointer"
                      >
                        {article.title}
                      </h4>

                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                        {article.summary}
                      </p>
                    </div>

                    <div className="pt-3 flex items-center justify-between border-t border-slate-800/80">
                      <button
                        onClick={() => setSelectedArticle(article)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span>{t("Read Executive Bulletin")}</span> →
                      </button>
                      <button
                        onClick={() => handleWhatsAppShare(article.title, article.url)}
                        className="bg-emerald-950 text-emerald-300 border border-emerald-800/60 text-[11px] font-semibold px-2.5 py-1 rounded-lg hover:bg-emerald-900 transition cursor-pointer"
                      >
                        💬 {t("Share")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* DETAILED EXECUTIVE BULLETIN MODAL */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-3xl w-full space-y-5 relative shadow-2xl max-h-[90vh] overflow-y-auto">
            
            <button
              onClick={() => setSelectedArticle(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer z-10"
            >
              ✕
            </button>

            <div className="border-b border-slate-800 pb-4 space-y-3 pr-10 min-w-0">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-mono uppercase bg-emerald-950 text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-800/50 font-semibold">
                  📍 {selectedArticle.region} Region • Executive Analysis {selectedLanguage !== "English" && `(${selectedLanguage})`}
                </span>
                {getRiskBadge(selectedArticle.riskLevel)}
              </div>

              <h3 className="text-xl md:text-2xl font-black text-white leading-snug">
                {selectedArticle.title}
              </h3>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400 font-mono pt-1 min-w-0">
                <span>📅 Published: <strong className="text-slate-200">{formatDate(selectedArticle.freshness?.published_at_iso || selectedArticle.published_date || selectedArticle.timestamp || selectedArticle.createdDate)}</strong></span>
                <span>📰 Source: <strong className="text-emerald-400">{selectedArticle.source}</strong></span>
                <span>Category: <strong className="text-slate-200">{selectedArticle.categoryName || selectedArticle.category}</strong></span>

                {selectedArticle.url && (
                  <a
                    href={selectedArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 underline font-semibold transition inline-flex items-center gap-1 break-all"
                  >
                    🔗 Read Source Article ↗
                  </a>
                )}
              </div>

              {(selectedArticle.decision_intelligence?.event_type ||
                selectedArticle.decision_intelligence?.confidence ||
                selectedArticle.relevance?.relevance_score !== undefined ||
                selectedArticle.relevance?.business_relevance?.strategic_value_score !== undefined ||
                selectedArticle.relevance?.business_relevance?.content_type ||
                selectedArticle.freshness?.age_days !== undefined) && (
                <div className="flex flex-wrap gap-2 pt-1 text-[10px] font-mono uppercase tracking-wide">
                  {selectedArticle.decision_intelligence?.event_type && (
                    <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-1 rounded-md">Event: {selectedArticle.decision_intelligence.event_type}</span>
                  )}
                  {selectedArticle.decision_intelligence?.confidence && (
                    <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-1 rounded-md">Confidence: {selectedArticle.decision_intelligence.confidence}</span>
                  )}
                  {selectedArticle.relevance?.relevance_score !== undefined && (
                    <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-1 rounded-md">Relevance: {selectedArticle.relevance.relevance_score}/100</span>
                  )}
                  {selectedArticle.relevance?.business_relevance?.strategic_value_score !== undefined && (
                    <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-1 rounded-md">Strategic Value: {selectedArticle.relevance.business_relevance.strategic_value_score}/100</span>
                  )}
                  {selectedArticle.relevance?.business_relevance?.content_type && (
                    <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-1 rounded-md">Type: {selectedArticle.relevance.business_relevance.content_type}</span>
                  )}
                  {selectedArticle.freshness?.age_days !== undefined && selectedArticle.freshness.age_days !== null && (
                    <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-1 rounded-md">Age: {selectedArticle.freshness.age_days} day{selectedArticle.freshness.age_days === 1 ? "" : "s"}</span>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm text-slate-200 leading-relaxed">
                <h5 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider mb-2">Detailed Market Intelligence</h5>
                <p>{selectedArticle.full_content || selectedArticle.summary}</p>
              </div>

              {selectedArticle.key_takeaway && (
                <div className="bg-emerald-950/40 border border-emerald-800/60 p-4 rounded-xl text-xs text-emerald-300 space-y-1">
                  <strong className="text-emerald-400 uppercase font-mono block">💡 Executive Strategic Takeaway</strong>
                  <p className="text-slate-200 leading-relaxed">{selectedArticle.key_takeaway}</p>
                </div>
              )}

              {(selectedArticle.geographicScope ||
                (Array.isArray(selectedArticle.states) && selectedArticle.states.length > 0) ||
                (Array.isArray(selectedArticle.cities) && selectedArticle.cities.length > 0)) && (
                <div className="flex flex-wrap items-center gap-2 bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs">
                  <span className="font-mono font-bold text-slate-400 uppercase">Geography</span>
                  {selectedArticle.geographicScope && <span className="text-slate-300">Scope: {selectedArticle.geographicScope}</span>}
                  {Array.isArray(selectedArticle.states) && selectedArticle.states.length > 0 && <span className="text-slate-300">States: {selectedArticle.states.join(", ")}</span>}
                  {Array.isArray(selectedArticle.cities) && selectedArticle.cities.length > 0 && <span className="text-slate-300">Cities: {selectedArticle.cities.join(", ")}</span>}
                </div>
              )}

              {selectedArticle.decision_intelligence && (
                <div className="bg-slate-950 border border-slate-700 p-4 rounded-xl space-y-4">
                  <h5 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider">Decision Intelligence</h5>

                  {(selectedArticle.decision_intelligence.what_changed ||
                    selectedArticle.decision_intelligence.why_it_matters ||
                    selectedArticle.decision_intelligence.strategic_significance) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {selectedArticle.decision_intelligence.what_changed && (
                        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg min-w-0">
                          <h6 className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider mb-1.5">What Changed</h6>
                          <p className="text-xs text-slate-300 leading-relaxed break-words">{selectedArticle.decision_intelligence.what_changed}</p>
                        </div>
                      )}
                      {selectedArticle.decision_intelligence.why_it_matters && (
                        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg min-w-0">
                          <h6 className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider mb-1.5">Why It Matters</h6>
                          <p className="text-xs text-slate-300 leading-relaxed break-words">{selectedArticle.decision_intelligence.why_it_matters}</p>
                        </div>
                      )}
                      {selectedArticle.decision_intelligence.strategic_significance && (
                        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg min-w-0">
                          <h6 className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider mb-1.5">Strategic Significance</h6>
                          <p className="text-xs text-slate-300 leading-relaxed break-words">{selectedArticle.decision_intelligence.strategic_significance}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {Array.isArray(selectedArticle.decision_intelligence.functions_affected) && selectedArticle.decision_intelligence.functions_affected.length > 0 && (
                    <div className="space-y-2">
                      <h6 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Functions Affected</h6>
                      <div className="flex flex-wrap gap-2">
                        {selectedArticle.decision_intelligence.functions_affected.map((businessFunction, index) => (
                          <span key={`${businessFunction}-${index}`} className="bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 px-2.5 py-1 rounded-full text-[11px] font-semibold break-words">
                            {businessFunction}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(selectedArticle.decision_intelligence.recommended_actions) && selectedArticle.decision_intelligence.recommended_actions.length > 0 && (
                    <div className="space-y-2">
                      <h6 className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">Recommended Actions</h6>
                      <div className="space-y-2">
                        {selectedArticle.decision_intelligence.recommended_actions.map((recommendedAction, index) => (
                          <div key={`${recommendedAction.function}-${index}`} className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 min-w-0">
                            <div className="flex sm:flex-col items-center sm:items-start gap-2 sm:w-32 shrink-0">
                              {recommendedAction.function && <strong className="text-xs text-slate-100 break-words"><span className="text-[9px] text-slate-500 font-mono uppercase block">Who</span>{recommendedAction.function}</strong>}
                              {recommendedAction.horizon && <span className="bg-amber-950/70 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase"><span className="text-amber-500">When:</span> {recommendedAction.horizon}</span>}
                            </div>
                            {recommendedAction.action && <p className="text-xs text-slate-300 leading-relaxed break-words min-w-0"><span className="text-[9px] text-slate-500 font-mono font-bold uppercase block">What</span>{recommendedAction.action}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(selectedArticle.decision_intelligence.risk_type || selectedArticle.decision_intelligence.risk_rationale || selectedArticle.decision_intelligence.opportunity) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(selectedArticle.decision_intelligence.risk_type || selectedArticle.decision_intelligence.risk_rationale) && (
                        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg space-y-2 min-w-0">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <h6 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Risk &amp; Opportunity</h6>
                            {getRiskBadge(selectedArticle.riskLevel)}
                          </div>
                          {selectedArticle.decision_intelligence.risk_type && <p className="text-xs text-slate-300"><strong className="text-slate-100">Type:</strong> {selectedArticle.decision_intelligence.risk_type}</p>}
                          {selectedArticle.decision_intelligence.risk_rationale && <p className="text-xs text-slate-400 leading-relaxed break-words">{selectedArticle.decision_intelligence.risk_rationale}</p>}
                        </div>
                      )}
                      {selectedArticle.decision_intelligence.opportunity && (
                        <div className="bg-emerald-950/30 border border-emerald-900/60 p-3 rounded-lg min-w-0">
                          <h6 className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider mb-2">Opportunity</h6>
                          <p className="text-xs text-slate-300 leading-relaxed break-words">{selectedArticle.decision_intelligence.opportunity}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {Array.isArray(selectedArticle.decision_intelligence.watch_indicators) && selectedArticle.decision_intelligence.watch_indicators.length > 0 && (
                    <div className="space-y-2">
                      <h6 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Watch Indicators</h6>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {selectedArticle.decision_intelligence.watch_indicators.map((indicator, index) => (
                          <li key={`${indicator}-${index}`} className="flex items-start gap-2 break-words">
                            <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                            <span>{indicator}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {selectedArticle.actionAdvisory && (
                <div className="bg-amber-950/30 border border-amber-800/60 p-4 rounded-xl">
                  <h5 className="text-[10px] font-bold font-mono text-amber-400 uppercase tracking-wider mb-2">Executive Action</h5>
                  <p className="text-sm text-slate-100 leading-relaxed font-semibold break-words">{selectedArticle.actionAdvisory}</p>
                </div>
              )}

              {selectedArticle.business_advisory && (
                hasMeaningfulText(selectedArticle.business_advisory.qa_compliance) ||
                hasMeaningfulText(selectedArticle.business_advisory.supply_chain) ||
                hasMeaningfulText(selectedArticle.business_advisory.export_strategy)
              ) && (
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                  <h5 className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider">Action Advisory for Business Stakeholders</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    {hasMeaningfulText(selectedArticle.business_advisory.qa_compliance) && (
                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                        <strong className="text-slate-300 font-semibold block uppercase">QA & Compliance</strong>
                        <p className="text-slate-400 leading-relaxed break-words">{selectedArticle.business_advisory.qa_compliance}</p>
                      </div>
                    )}
                    {hasMeaningfulText(selectedArticle.business_advisory.supply_chain) && (
                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                        <strong className="text-slate-300 font-semibold block uppercase">Supply Chain</strong>
                        <p className="text-slate-400 leading-relaxed break-words">{selectedArticle.business_advisory.supply_chain}</p>
                      </div>
                    )}
                    {hasMeaningfulText(selectedArticle.business_advisory.export_strategy) && (
                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                        <strong className="text-slate-300 font-semibold block uppercase">Export &amp; Business</strong>
                        <p className="text-slate-400 leading-relaxed break-words">{selectedArticle.business_advisory.export_strategy}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-800">
              <span className="text-xs text-slate-500 font-mono">FMCG Executive Desk</span>
              <button
                onClick={() => setSelectedArticle(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2 px-4 rounded-xl ml-auto cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
