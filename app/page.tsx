"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { LocationData } from "../lib/firestoreLocations";
import {
  collection,
  query,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../lib/firebase";

const IndiaMap = dynamic(() => import("../components/IndiaMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[620px] bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-emerald-400 font-medium animate-pulse gap-3">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <span>📍 Initializing Pan-India Geospatial Intelligence Engine...</span>
    </div>
  ),
});

interface Article {
  id: string;
  title: string;
  category: string;
  summary: string;
  full_content?: string;
  region: string;
  published_at?: string;
  date?: string;
  source_name?: string;
  source_url?: string;
  key_takeaway?: string;
  risk_level?: string;
}

// Translations for UI labels
const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    headerTitle: "FMCG News Desk",
    headerSubtitle: "Multi-Category Executive Bulletins, Regional Trends & Consumer Insights",
    aiTitle: "✨ AI MARKET INSIGHTS",
    aiSubtitle: "Synthesis of Active FMCG Market Intelligence",
    outlook: "Market Outlook: Bullish",
    execSummaryLabel: "Executive Summary:",
    bulletinsTitle: "📰 Executive Market Bulletins",
    readDetail: "Read Detail Bulletin",
    share: "Share",
    source: "Source",
    published: "Published",
    keyTakeaway: "💡 Executive Strategic Takeaway:",
    readFullArticle: "🔗 Read full article on original publisher",
    noLink: "Source link unavailable",
    mapTab: "🗺️ India Geospatial Map",
    intelTab: "📊 Market Intelligence",
    updatesFound: "Updates Found",
  },
  hi: {
    headerTitle: "FMCG न्यूज डेस्क",
    headerSubtitle: "बहु-श्रेणी कार्यकारी बुलेटिन, क्षेत्रीय रुझान और उपभोक्ता अंतर्दृष्टि",
    aiTitle: "✨ एआई बाजार अंतर्दृष्टि",
    aiSubtitle: "सक्रिय एफएमसीजी बाजार खुफिया का संश्लेषण",
    outlook: "बाजार दृष्टिकोण: तेजी",
    execSummaryLabel: "कार्यकारी सारांश:",
    bulletinsTitle: "📰 कार्यकारी बाजार बुलेटिन",
    readDetail: "विस्तृत बुलेटिन पढ़ें",
    share: "साझा करें",
    source: "स्रोत",
    published: "प्रकाशित",
    keyTakeaway: "💡 कार्यकारी रणनीतिक निष्कर्ष:",
    readFullArticle: "🔗 मूल प्रकाशक पर पूरा लेख पढ़ें",
    noLink: "स्रोत लिंक उपलब्ध नहीं है",
    mapTab: "🗺️ भारत भू-स्थानिक मानचित्र",
    intelTab: "📊 बाजार इंटेलिजेंस",
    updatesFound: "अपडेट मिले",
  },
  mr: {
    headerTitle: "FMCG न्यूज डेस्क",
    headerSubtitle: "बहु-श्रेणी कार्यकारी बुलेटिन, प्रादेशिक प्रवाह आणि ग्राहक मते",
    aiTitle: "✨ AI मार्केट इनसाइट्स",
    aiSubtitle: "सक्रिय FMCG मार्केट बुद्धिमत्तेचे संश्लेषण",
    outlook: "बाजार दृष्टीकोन: तेजी",
    execSummaryLabel: "कार्यकारी सारांश:",
    bulletinsTitle: "📰 कार्यकारी बाजार बुलेटिन",
    readDetail: "सविस्तर बुलेटिन वाचा",
    share: "शेअर करा",
    source: "स्रोत",
    published: "प्रसिद्ध झाले",
    keyTakeaway: "💡 कार्यकारी धोरणात्मक निष्कर्ष:",
    readFullArticle: "🔗 मूळ बातमी लिंकवर वाचा",
    noLink: "स्रोत लिंक उपलब्ध नाही",
    mapTab: "🗺️ भारत नकाशा",
    intelTab: "📊 मार्केट इंटेलिजन्स",
    updatesFound: "अपडेट्स सापडले",
  },
  gu: {
    headerTitle: "FMCG ન્યૂઝ ડેસ્ક",
    headerSubtitle: "મલ્ટિ-કેટેગરી એક્ઝિક્યુટિવ બુલેટિન અને પ્રાદેશિક વલણો",
    aiTitle: "✨ AI માર્કેટ ઇનસાઇટ્સ",
    aiSubtitle: "સક્રિય FMCG માર્કેટ ઇન્ટેલિજન્સ સંશ્લેષણ",
    outlook: "માર્કેટ આઉટલુક: તેજી",
    execSummaryLabel: "એક્ઝિક્યુટિવ સારાંશ:",
    bulletinsTitle: "📰 એક્ઝિક્યુટિવ માર્કેટ બુલેટિન",
    readDetail: "વિગતવાર બુલેટિન વાંચો",
    share: "શેર કરો",
    source: "સ્રોત",
    published: "પ્રકાશિત",
    keyTakeaway: "💡 વ્યવહારે મુખ્ય નિર્ણય:",
    readFullArticle: "🔗 મૂળ પ્રકાશક પર સંપૂર્ણ લેખ વાંચો",
    noLink: "સ્રોત લિંક ઉપલબ્ધ નથી",
    mapTab: "🗺️ ભારત નકશો",
    intelTab: "📊 માર્કેટ ઇન્ટેલિજન્સ",
    updatesFound: "અપડેટ્સ મળ્યા",
  },
};

export default function Home() {
  const [activeViewTab, setActiveViewTab] = useState<"intelligence" | "map">("intelligence");
  const [selectedRegion, setSelectedRegion] = useState<string>("All");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const [selectedCategory, setSelectedCategory] = useState<string>("Spices & Pickles");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Modals state
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const t = TRANSLATIONS[selectedLanguage] || TRANSLATIONS.en;

  useEffect(() => {
    async function fetchNews() {
      setLoading(true);
      try {
        const newsRef = collection(db, "news_articles");
        const q = query(newsRef, orderBy("createdAt", "desc"), limit(30));
        const snapshot = await getDocs(q);

        const now = new Date();
        const maxAgeDays = 30; // Strictly allow only articles within 30 days

        let docs: Article[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Article, "id">),
        }));

        // Filter 1: Recency Filter (30 Days Limit)
        docs = docs.filter((item) => {
          const rawDate = item.published_at || item.date;
          if (!rawDate) return true; // Keep if date parsing fails
          const pubDate = new Date(rawDate);
          if (isNaN(pubDate.getTime())) return true;
          const diffDays = (now.getTime() - pubDate.getTime()) / (1000 * 3600 * 24);
          return diffDays <= maxAgeDays;
        });

        // Filter 2: Region Filter
        if (selectedRegion !== "All") {
          docs = docs.filter(
            (item) => item.region?.toLowerCase() === selectedRegion.toLowerCase()
          );
        }

        setArticles(docs);
      } catch (error) {
        console.error("Error fetching articles:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchNews();
  }, [selectedCategory, selectedRegion]);

  // Dynamic Executive Summary generated from loaded active articles
  const dynamicExecutiveSummary = useMemo(() => {
    if (articles.length === 0) {
      return "No active bulletins found for the selected region and category within the past 30 days.";
    }
    const keySummaries = articles.slice(0, 3).map((a) => a.summary).join(" ");
    return `Synthesis of ${articles.length} active updates: ${keySummaries}`;
  }, [articles]);

  const handleWhatsAppShare = (title: string, link?: string) => {
    const text = encodeURIComponent(`*FMCG News Desk Bulletin:* ${title}\nRead full story: ${link || "https://fmcgdesk.web.app"}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased">
      {/* Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/80 pb-6 mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-xl shadow-lg shadow-emerald-950/50">
              🌐
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              {t.headerTitle.split(" ")[0]} <span className="text-emerald-400">{t.headerTitle.split(" ").slice(1).join(" ")}</span>
            </h1>
          </div>
          <p className="text-slate-400 text-xs mt-1.5 font-mono tracking-wide">
            {t.headerSubtitle}
          </p>
        </div>

        {/* Global Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Language Selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-xl shadow-lg">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1">🌐</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-slate-950 text-emerald-400 font-bold text-xs border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
              <option value="mr">मराठी (Marathi)</option>
              <option value="gu">ગુજરાતી (Gujarati)</option>
            </select>
          </div>

          {/* Region Selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-xl shadow-lg">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1">Region:</span>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="bg-slate-950 text-emerald-400 font-bold text-xs border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="All">IN All Regions (Pan-India)</option>
              <option value="West">West (Pune, Gandhinagar, Mumbai)</option>
              <option value="North">North (Srinagar, Jaipur, Delhi)</option>
              <option value="South">South (Bengaluru, Kochi, Chennai)</option>
              <option value="East">East (Kolkata, Patna)</option>
            </select>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Navigation Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-800/80 pb-4 gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedCategory("Spices & Pickles")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                selectedCategory === "Spices & Pickles"
                  ? "bg-emerald-950 border border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-950/50"
                  : "bg-slate-900 text-slate-400 border border-slate-800"
              }`}
            >
              🌶️ Spices & Pickles <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">Live</span>
            </button>
          </div>

          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 self-start lg:self-auto">
            <button
              onClick={() => setActiveViewTab("intelligence")}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeViewTab === "intelligence"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.intelTab}
            </button>
            <button
              onClick={() => setActiveViewTab("map")}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeViewTab === "map"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.mapTab}
            </button>
          </div>
        </div>

        {/* TAB 1: EXECUTIVE MARKET INTELLIGENCE VIEW */}
        {activeViewTab === "intelligence" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Dynamic AI Executive Summary Hero Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 pb-4 mb-4 gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                    {t.aiTitle}
                  </h2>
                  <span className="text-slate-500 text-xs">| {t.aiSubtitle}</span>
                </div>
                <span className="text-xs font-semibold bg-emerald-950 border border-emerald-700/50 text-emerald-300 px-3 py-1 rounded-full">
                  {t.outlook}
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-2">
                <p className="text-xs md:text-sm text-slate-200 leading-relaxed">
                  <strong className="text-emerald-400 font-semibold">{t.execSummaryLabel}</strong>{" "}
                  {dynamicExecutiveSummary}
                </p>
              </div>
            </div>

            {/* Bulletins Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {t.bulletinsTitle}
              </h3>
              <span className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg">
                {articles.length} {t.updatesFound}
              </span>
            </div>

            {/* News Cards */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-52 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {articles.map((article) => (
                  <div
                    key={article.id}
                    className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-4 transition-all hover:translate-y-[-2px] flex flex-col justify-between shadow-xl"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="bg-slate-950 text-emerald-400 border border-emerald-800/60 px-2.5 py-0.5 rounded-md font-semibold font-mono">
                          📍 {article.region || "Pan-India"}
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">
                          📅 {article.published_at || article.date || "Recent"}
                        </span>
                      </div>

                      <h4
                        onClick={() => setSelectedArticle(article)}
                        className="text-base font-bold text-white leading-snug hover:text-emerald-400 transition cursor-pointer"
                      >
                        {article.title}
                      </h4>

                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                        {article.summary}
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-800/80 gap-2">
                      <button
                        onClick={() => setSelectedArticle(article)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span>{t.readDetail}</span>
                        <span>→</span>
                      </button>

                      <button
                        onClick={() => handleWhatsAppShare(article.title, article.source_url)}
                        className="bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 text-[11px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <span>💬</span>
                        <span>{t.share}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: GEOSPATIAL MAP VIEW */}
        {activeViewTab === "map" && (
          <div className="space-y-4 animate-fadeIn">
            <IndiaMap onSelectLocation={(loc) => setSelectedLocation(loc)} />
          </div>
        )}
      </div>

      {/* DETAIL BULLETIN MODAL */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full space-y-5 relative shadow-2xl animate-scaleUp">
            <button
              onClick={() => setSelectedArticle(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer"
            >
              ✕
            </button>

            <div className="border-b border-slate-800 pb-3 space-y-2">
              <span className="text-xs font-mono uppercase bg-emerald-950 text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-800/50 font-semibold">
                {selectedArticle.region || "Pan-India"} Region • Bulletin Detail
              </span>
              <h3 className="text-xl md:text-2xl font-black text-white leading-snug">
                {selectedArticle.title}
              </h3>
              
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1 font-mono">
                <span>📅 {t.published}: <strong className="text-slate-200">{selectedArticle.published_at || selectedArticle.date || 'Recent'}</strong></span>
                <span>📰 {t.source}: <strong className="text-emerald-400">{selectedArticle.source_name || 'FMCG Intelligence Desk'}</strong></span>
              </div>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm text-slate-200 leading-relaxed space-y-3">
                <p>{selectedArticle.full_content || selectedArticle.summary}</p>
              </div>

              {selectedArticle.key_takeaway && (
                <div className="bg-emerald-950/40 border border-emerald-800/60 p-4 rounded-xl text-xs text-emerald-300 font-medium space-y-1">
                  <strong className="text-emerald-400 uppercase tracking-wider block font-mono flex items-center gap-1">
                    {t.keyTakeaway}
                  </strong>
                  <p className="text-slate-200 leading-relaxed">{selectedArticle.key_takeaway}</p>
                </div>
              )}
            </div>

            {/* Direct Source Link */}
            <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
              {selectedArticle.source_url ? (
                <a
                  href={selectedArticle.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium flex items-center gap-1"
                >
                  {t.readFullArticle} ↗
                </a>
              ) : (
                <span className="text-xs text-slate-500 font-mono">{t.noLink}</span>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => handleWhatsAppShare(selectedArticle.title, selectedArticle.source_url)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>💬 {t.share}</span>
                </button>

                <button
                  onClick={() => setSelectedArticle(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2 px-4 rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}