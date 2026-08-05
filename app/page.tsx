"use client";

import { useEffect, useState } from "react";
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
  date: string;
  source_url?: string;
  key_takeaway?: string;
  risk_level?: string;
}

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

  useEffect(() => {
    async function fetchNews() {
      setLoading(true);
      try {
        const newsRef = collection(db, "news_articles");
        const q = query(newsRef, orderBy("published_at", "desc"), limit(20));
        const snapshot = await getDocs(q);

        let docs: Article[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Article, "id">),
        }));

        // Client-side region filter fallback if query constraints differ
        if (selectedRegion !== "All") {
          docs = docs.filter(
            (item) => item.region?.toLowerCase() === selectedRegion.toLowerCase()
          );
        }

        setArticles(docs);
      } catch (error) {
        console.error("Error fetching articles:", error);
        // Fallback article for UI display
        setArticles([
          {
            id: "1",
            title: "US Overtakes China as Largest Buyer of Indian Spice Exports",
            category: "Spices & Pickles",
            region: "National",
            date: "2026-08-02",
            summary: "Indian spice exports recorded high demand in North America led by premium cardamom, cumin, and chilli extracts.",
            full_content: "According to recent trade bulletin figures, spice exporters in Western and Southern India reported a 18% spike in export orders. Quick commerce adoption in domestic metro regions like Pune and Mumbai is further bolstering packaging revenues.",
            key_takeaway: "High export demand balancing out domestic spot raw material inflation.",
            source_url: "https://fmcgdesk.web.app"
          }
        ]);
      } finally {
        setLoading(false);
      }
    }

    fetchNews();
  }, [selectedCategory, selectedRegion]);

  const handleWhatsAppShare = (title: string, link?: string) => {
    const text = encodeURIComponent(`*FMCG News Desk Bulletin:* ${title}\nRead more: ${link || "https://fmcgdesk.web.app"}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased">
      {/* Universal FMCG Desk Executive Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/80 pb-6 mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-xl shadow-lg shadow-emerald-950/50">
              🌐
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              FMCG <span className="text-emerald-400">News Desk</span>
            </h1>
          </div>
          <p className="text-slate-400 text-xs mt-1.5 font-mono tracking-wide">
            Multi-Category Executive Bulletin, Regional Trends & Geospatial FMCG Insights
          </p>
        </div>

        {/* Global Controls: Multilingual & Region Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Multi-language Selector */}
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
        {/* Module Navigation & Multi-Category Selector Tabs */}
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
            <button
              disabled
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900/40 text-slate-600 border border-slate-800/40 cursor-not-allowed flex items-center gap-1.5 shrink-0"
            >
              🛢️ Edible Oils <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">Soon</span>
            </button>
            <button
              disabled
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900/40 text-slate-600 border border-slate-800/40 cursor-not-allowed flex items-center gap-1.5 shrink-0"
            >
              🥛 Dairy Products <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">Soon</span>
            </button>
            <button
              disabled
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900/40 text-slate-600 border border-slate-800/40 cursor-not-allowed flex items-center gap-1.5 shrink-0"
            >
              🍪 Biscuits & Bakery <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">Soon</span>
            </button>
            <button
              disabled
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900/40 text-slate-600 border border-slate-800/40 cursor-not-allowed flex items-center gap-1.5 shrink-0"
            >
              🧼 Personal Care <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">Soon</span>
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
              📊 Market Intelligence
            </button>
            <button
              onClick={() => setActiveViewTab("map")}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeViewTab === "map"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              🗺️ India Geospatial Map
            </button>
          </div>
        </div>

        {/* TAB 1: EXECUTIVE MARKET INTELLIGENCE VIEW */}
        {activeViewTab === "intelligence" && (
          <div className="space-y-8 animate-fadeIn">
            {/* AI Executive Summary Hero Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 pb-4 mb-4 gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                    ✨ AI MARKET INSIGHTS
                  </h2>
                  <span className="text-slate-500 text-xs">| Synthesis of Active FMCG Trade Data</span>
                </div>
                <span className="text-xs font-semibold bg-emerald-950 border border-emerald-700/50 text-emerald-300 px-3 py-1 rounded-full">
                  Market Outlook: Bullish
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-2">
                <p className="text-xs md:text-sm text-slate-200 leading-relaxed">
                  <strong className="text-emerald-400 font-semibold">Executive Summary:</strong> US has emerged as the top buyer for Indian spice exports amid steady demand for cardamom and pepper. Concurrently, domestic sales are experiencing double-digit growth in hubs like Pune, Mumbai, and Gandhinagar driven by quick-commerce channels.
                </p>
              </div>
            </div>

            {/* Articles Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                📰 Executive Market Bulletins
              </h3>
              <span className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg">
                {articles.length} Updates Found
              </span>
            </div>

            {/* News Bulletins Cards */}
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
                        <span className="text-slate-500 font-mono text-[11px]">{article.date}</span>
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
                        <span>Read Detail Bulletin</span>
                        <span>→</span>
                      </button>

                      <button
                        onClick={() => handleWhatsAppShare(article.title, article.source_url)}
                        className="bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 text-[11px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <span>💬</span>
                        <span>Share</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INTERACTIVE GEOSPATIAL MAP VIEW */}
        {activeViewTab === "map" && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  🗺️ Pan-India Geospatial Trade Intelligence
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click any city hub marker (e.g. Pune, Gandhinagar, Srinagar) to view market insights.
                </p>
              </div>
              <span className="text-xs font-mono bg-emerald-950 border border-emerald-700/50 text-emerald-300 px-3 py-1.5 rounded-xl font-semibold">
                37 Key Hubs Seeded
              </span>
            </div>

            <IndiaMap onSelectLocation={(loc) => setSelectedLocation(loc)} />
          </div>
        )}
      </div>

      {/* MODAL 1: Bulletin Article Detail Drawer */}
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
                {selectedArticle.region} Region • Bulletin Detail
              </span>
              <h3 className="text-xl md:text-2xl font-black text-white leading-snug">
                {selectedArticle.title}
              </h3>
              <p className="text-xs text-slate-400 font-mono">Published: {selectedArticle.date}</p>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm text-slate-200 leading-relaxed">
                {selectedArticle.full_content || selectedArticle.summary}
              </div>

              {selectedArticle.key_takeaway && (
                <div className="bg-emerald-950/40 border border-emerald-800/60 p-4 rounded-xl text-xs text-emerald-300 font-medium space-y-1">
                  <strong className="text-emerald-400 uppercase tracking-wider block font-mono">
                    💡 Executive Takeaway:
                  </strong>
                  <p className="text-slate-200">{selectedArticle.key_takeaway}</p>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <button
                onClick={() => handleWhatsAppShare(selectedArticle.title, selectedArticle.source_url)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-lg transition cursor-pointer flex items-center gap-2"
              >
                <span>💬 WhatsApp Share</span>
              </button>

              <button
                onClick={() => setSelectedArticle(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2.5 px-5 rounded-xl transition cursor-pointer"
              >
                Close Bulletin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Map Location Insights Modal */}
      {selectedLocation && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full space-y-5 relative shadow-2xl animate-scaleUp">
            <button
              onClick={() => setSelectedLocation(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer"
            >
              ✕
            </button>

            <div className="border-b border-slate-800 pb-3">
              <span className="text-xs font-mono uppercase bg-emerald-950 text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-800/50 font-semibold">
                {selectedLocation.region} Region • Hub Intelligence
              </span>
              <h3 className="text-2xl font-black text-white mt-2 tracking-tight">
                {selectedLocation.capital}, {selectedLocation.state}
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Dominant Market Brands
                </h4>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedLocation.dominant_brands?.map((brand) => (
                    <span
                      key={brand}
                      className="bg-slate-800 text-emerald-300 border border-slate-700 text-xs px-3 py-1 rounded-lg font-semibold shadow-sm"
                    >
                      {brand}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Consumer & Culinary Focus
                </h4>
                <p className="text-sm text-slate-300 mt-1.5 bg-slate-950 p-3.5 rounded-xl border border-slate-800 leading-relaxed">
                  {selectedLocation.demographics_focus}
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <button
                onClick={() => handleWhatsAppShare(`${selectedLocation.capital} FMCG Market Hub Insights`)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-lg transition cursor-pointer flex items-center gap-2"
              >
                <span>💬 WhatsApp Share</span>
              </button>

              <button
                onClick={() => setSelectedLocation(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2.5 px-5 rounded-xl transition cursor-pointer"
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