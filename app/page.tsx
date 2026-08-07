"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { collection, query, getDocs, limit } from "firebase/firestore";
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

// Dynamic import for the Map Component to support Leaflet / Client-side rendering
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
  sub_category?: string;
  market_scope?: string;
  summary: string;
  full_content?: string;
  region: string;
  published_at?: any;
  date?: any;
  timestamp?: any;
  createdDate?: string;
  source_name?: string;
  source?: string;
  source_url?: string;
  url?: string;
  key_takeaway?: string;
  risk_level?: "High" | "Medium" | "Low";
  riskLevel?: string;
  business_advisory?: {
    qa_compliance?: string;
    supply_chain?: string;
    export_strategy?: string;
  };
  actionAdvisory?: string;
  official_compliance_link?: string;
  official_compliance_title?: string;
}

export default function Home() {
  const [activeViewTab, setActiveViewTab] = useState<"intelligence" | "map">("intelligence");
  const [selectedRegion, setSelectedRegion] = useState<string>("All");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const [selectedCategory, setSelectedCategory] = useState<string>("Spices & Pickles");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("All");

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  useEffect(() => {
    async function fetchNews() {
      setLoading(true);
      try {
        // Querying the correct "bulletins" collection populated by your scraper
        const newsRef = collection(db, "bulletins");
        const q = query(newsRef, limit(100));
        const snapshot = await getDocs(q);

        let docs: Article[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || "",
            category: data.category || "Spices & Pickles",
            sub_category: data.sub_category,
            market_scope: data.market_scope,
            summary: data.summary || data.raw_desc || "",
            full_content: data.full_content || data.summary,
            region: data.region || "Pan-India",
            published_at: data.published_at || data.timestamp || data.createdDate,
            date: data.date || data.createdDate,
            source_name: data.source_name || data.source,
            source_url: data.source_url || data.url,
            key_takeaway: data.key_takeaway,
            risk_level: (data.risk_level || data.riskLevel || "Medium") as "High" | "Medium" | "Low",
            business_advisory: data.business_advisory || {
              qa_compliance: data.actionAdvisory || data.summary,
            },
          };
        });

        // Safe 7-Day Window Filter
        const now = new Date();
        const maxAgeDays = 8;

        docs = docs.filter((item) => {
          const rawDate = item.published_at || item.date;
          if (!rawDate) return true;

          let pubDate: Date;
          if (typeof rawDate === "object" && rawDate.seconds) {
            pubDate = new Date(rawDate.seconds * 1000);
          } else {
            pubDate = new Date(rawDate);
          }

          if (isNaN(pubDate.getTime())) return true;
          const diffDays = (now.getTime() - pubDate.getTime()) / (1000 * 3600 * 24);

          return diffDays >= -2 && diffDays <= maxAgeDays;
        });

        // Apply Sub-Category Filters
        if (selectedSubCategory !== "All") {
          docs = docs.filter((item) => {
            if (selectedSubCategory === "Domestic") return item.market_scope === "Domestic";
            if (selectedSubCategory === "Export") return item.market_scope === "Export";
            if (selectedSubCategory === "Regulatory") return item.sub_category === "Regulatory & Compliance";
            return true;
          });
        }

        // Apply Region Filters
        if (selectedRegion !== "All") {
          docs = docs.filter((item) => item.region?.toLowerCase() === selectedRegion.toLowerCase());
        }

        setArticles(docs);
      } catch (error) {
        console.error("Error fetching bulletins:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchNews();
  }, [selectedCategory, selectedSubCategory, selectedRegion]);

  // Executive AI Market Insights Synthesis
  const executiveInsightsSummary = useMemo(() => {
    if (articles.length === 0) return "No critical market disruptions reported in the active window.";
    const titles = articles.slice(0, 3).map((a) => a.title).join("; ");
    return `Synthesis of ${articles.length} active updates: Key developments across regional hubs indicate dynamic pricing, export compliance checks, and raw material safety audits. Highlights: ${titles}`;
  }, [articles]);

  const handleWhatsAppShare = (title: string, link?: string) => {
    const text = encodeURIComponent(`*FMCG Executive Bulletin:* ${title}\nRead detail: ${link || "https://fmcgdesk.web.app"}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  const getRiskBadge = (level?: string) => {
    switch (level?.toUpperCase()) {
      case "HIGH":
        return <span className="bg-red-950/90 text-red-400 border border-red-700/80 text-xs px-2.5 py-1 rounded-md font-bold font-mono shrink-0">🚨 HIGH RISK</span>;
      case "MEDIUM":
        return <span className="bg-amber-950/90 text-amber-400 border border-amber-700/80 text-xs px-2.5 py-1 rounded-md font-bold font-mono shrink-0">⚠️ MEDIUM RISK</span>;
      default:
        return <span className="bg-emerald-950/90 text-emerald-400 border border-emerald-700/80 text-xs px-2.5 py-1 rounded-md font-bold font-mono shrink-0">✅ LOW RISK</span>;
    }
  };

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

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <span className="text-xs text-slate-400">🌐</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-transparent text-xs text-emerald-400 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="en" className="bg-slate-900 text-white">English</option>
              <option value="hi" className="bg-slate-900 text-white">Hindi</option>
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
              <option value="North" className="bg-slate-900 text-white">North India</option>
              <option value="South" className="bg-slate-900 text-white">South India</option>
              <option value="East" className="bg-slate-900 text-white">East India</option>
              <option value="West" className="bg-slate-900 text-white">West India</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Categories Bar & Two Main Views Switcher */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory("Spices & Pickles")}
            className="bg-emerald-950/80 border border-emerald-500/80 text-emerald-300 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-950/50"
          >
            <span>🌶️ Spices & Pickles</span>
            <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full uppercase">Live</span>
          </button>
          <span className="text-xs text-slate-500 font-mono italic">Edible Oils, Dairy, Bakery coming soon</span>
        </div>

        {/* Tab 1: Bulletin Tab vs Tab 2: India Map with City Data */}
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
            <span>🗺️ India Map (Locations DB)</span>
          </button>
        </div>
      </div>

      {/* Sub-Category Filter Bar for Bulletins */}
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
            ● All Bulletins (All India)
          </button>
          <button
            onClick={() => setSelectedSubCategory("Domestic")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
              selectedSubCategory === "Domestic"
                ? "bg-emerald-500 text-slate-950 border-emerald-400"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
            }`}
          >
            🇮🇳 Domestic Market
          </button>
          <button
            onClick={() => setSelectedSubCategory("Export")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
              selectedSubCategory === "Export"
                ? "bg-emerald-500 text-slate-950 border-emerald-400"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
            }`}
          >
            🚢 IB (International Business & Exports)
          </button>
          <button
            onClick={() => setSelectedSubCategory("Regulatory")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
              selectedSubCategory === "Regulatory"
                ? "bg-emerald-500 text-slate-950 border-emerald-400"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
            }`}
          >
            📜 Regulatory & Food Safety
          </button>
        </div>
      )}

      {/* AI Intelligence Header Banner */}
      {activeViewTab === "intelligence" && (
        <div className="max-w-7xl mx-auto mb-8 bg-slate-900/90 border border-emerald-900/60 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <h3 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider">
                ✨ AI MARKET INSIGHTS <span className="text-slate-500 font-normal">| Deep Market Intelligence & Consumer Signals</span>
              </h3>
            </div>
            <span className="bg-emerald-950 text-emerald-300 border border-emerald-800/80 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
              Market Outlook: Bullish
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-200 leading-relaxed font-sans">
            <strong className="text-emerald-400">Executive Summary:</strong> {executiveInsightsSummary}
          </p>
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
                <p className="text-xs text-slate-500">Run your scraper script to populate data or toggle region filters.</p>
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
                        {getRiskBadge(article.risk_level)}
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

                    <div className="pt-3 flex items-center justify-between border-t border-slate-800/80">
                      <button
                        onClick={() => setSelectedArticle(article)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span>Read Executive Bulletin</span> →
                      </button>
                      <button
                        onClick={() => handleWhatsAppShare(article.title, article.source_url)}
                        className="bg-emerald-950 text-emerald-300 border border-emerald-800/60 text-[11px] font-semibold px-2.5 py-1 rounded-lg hover:bg-emerald-900 transition cursor-pointer"
                      >
                        💬 Share
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

            <div className="border-b border-slate-800 pb-4 space-y-3 pr-10">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-mono uppercase bg-emerald-950 text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-800/50 font-semibold">
                  📍 {selectedArticle.region} Region • Executive Analysis
                </span>
                {getRiskBadge(selectedArticle.risk_level)}
              </div>

              <h3 className="text-xl md:text-2xl font-black text-white leading-snug">
                {selectedArticle.title}
              </h3>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400 font-mono pt-1">
                <span>📅 Published: <strong className="text-slate-200">{formatDate(selectedArticle.published_at || selectedArticle.date)}</strong></span>
                <span>📰 Source: <strong className="text-emerald-400">{selectedArticle.source_name || "FMCG Intelligence Desk"}</strong></span>
                
                {selectedArticle.source_url && (
                  <a
                    href={selectedArticle.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 underline font-semibold transition flex items-center gap-1"
                  >
                    🔗 Read Source Article ↗
                  </a>
                )}
              </div>
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

              {selectedArticle.business_advisory && (
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                  <h5 className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider">🏢 Action Advisory for Business Stakeholders</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    {selectedArticle.business_advisory.qa_compliance && (
                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                        <strong className="text-slate-300 font-semibold block">🔬 QA & Compliance:</strong>
                        <p className="text-slate-400">{selectedArticle.business_advisory.qa_compliance}</p>
                      </div>
                    )}
                    {selectedArticle.business_advisory.supply_chain && (
                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                        <strong className="text-slate-300 font-semibold block">🚚 Supply Chain:</strong>
                        <p className="text-slate-400">{selectedArticle.business_advisory.supply_chain}</p>
                      </div>
                    )}
                    {selectedArticle.business_advisory.export_strategy && (
                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                        <strong className="text-slate-300 font-semibold block">🚢 Export & Business:</strong>
                        <p className="text-slate-400">{selectedArticle.business_advisory.export_strategy}</p>
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