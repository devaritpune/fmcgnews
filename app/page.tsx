"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { LocationData } from "../lib/firestoreLocations";
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

const IndiaMap = dynamic(() => import("../components/IndiaMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[620px] bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-emerald-400 font-medium animate-pulse gap-3">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <span>📍 Initializing Geospatial Intelligence Engine...</span>
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
  source_name?: string;
  source_url?: string;
  key_takeaway?: string;
  risk_level?: "High" | "Medium" | "Low";
  business_advisory?: {
    qa_compliance?: string;
    supply_chain?: string;
    export_strategy?: string;
  };
  official_compliance_link?: string;
  official_compliance_title?: string;
}

const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    headerTitle: "FMCG News Desk",
    headerSubtitle: "Executive Market Intelligence & Regulatory Risk Monitor",
    readDetail: "Read Executive Bulletin",
    share: "Share",
    source: "Source",
    published: "Published",
    keyTakeaway: "💡 Executive Strategic Takeaway",
    riskLevel: "⚠️ Risk Level",
    businessAdvisory: "🏢 Action Advisory for Business Stakeholders",
    officialHelpLink: "🔗 Official Regulatory Mandate Site",
    noLink: "Publisher link unavailable",
  },
};

export default function Home() {
  const [activeViewTab, setActiveViewTab] = useState<"intelligence" | "map">("intelligence");
  const [selectedRegion, setSelectedRegion] = useState<string>("All");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const [selectedCategory, setSelectedCategory] = useState<string>("Spices & Pickles");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("All");

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const t = TRANSLATIONS[selectedLanguage] || TRANSLATIONS.en;

  useEffect(() => {
    async function fetchNews() {
      setLoading(true);
      try {
        const newsRef = collection(db, "news_articles");
        const q = query(newsRef, limit(50));
        const snapshot = await getDocs(q);

        let docs: Article[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Article, "id">),
        }));

        // STRICT FILTER: Restrict articles to Past 7 Days only
        const now = new Date();
        const maxAgeDays = 7;

        docs = docs.filter((item) => {
          const rawDate = item.published_at || item.date;
          if (!rawDate) return false;

          let pubDate: Date;
          if (typeof rawDate === "object" && rawDate.seconds) {
            pubDate = new Date(rawDate.seconds * 1000);
          } else {
            pubDate = new Date(rawDate);
          }

          if (isNaN(pubDate.getTime())) return false;
          const diffDays = (now.getTime() - pubDate.getTime()) / (1000 * 3600 * 24);

          // Return true if within last 7 days (or future dated inside test cycle)
          return diffDays >= 0 && diffDays <= maxAgeDays;
        });

        if (selectedSubCategory !== "All") {
          docs = docs.filter((item) => {
            if (selectedSubCategory === "IB") return item.market_scope === "Export";
            if (selectedSubCategory === "Domestic") return item.market_scope === "Domestic";
            if (selectedSubCategory === "Regulatory") return item.sub_category === "Regulatory & Compliance";
            return true;
          });
        }

        if (selectedRegion !== "All") {
          docs = docs.filter((item) => item.region?.toLowerCase() === selectedRegion.toLowerCase());
        }

        setArticles(docs);
      } catch (error) {
        console.error("Error fetching articles:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchNews();
  }, [selectedCategory, selectedSubCategory, selectedRegion]);

  const handleWhatsAppShare = (title: string, link?: string) => {
    const text = encodeURIComponent(`*FMCG Executive Bulletin:* ${title}\nRead detail: ${link || "https://fmcgdesk.web.app"}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  const getRiskBadge = (level?: "High" | "Medium" | "Low") => {
    switch (level) {
      case "High":
        return <span className="bg-red-950/90 text-red-400 border border-red-700/80 text-xs px-2.5 py-1 rounded-md font-bold font-mono shrink-0">🚨 HIGH RISK</span>;
      case "Medium":
        return <span className="bg-amber-950/90 text-amber-400 border border-amber-700/80 text-xs px-2.5 py-1 rounded-md font-bold font-mono shrink-0">⚠️ MEDIUM RISK</span>;
      default:
        return <span className="bg-emerald-950/90 text-emerald-400 border border-emerald-700/80 text-xs px-2.5 py-1 rounded-md font-bold font-mono shrink-0">✅ LOW RISK</span>;
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased">
      {/* Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/80 pb-6 mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            FMCG <span className="text-emerald-400">News Desk</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1 font-mono tracking-wide">
            Executive Market Intelligence & Regulatory Risk Monitor
          </p>
        </div>
      </header>

      {/* Main Bulletins Grid */}
      <div className="max-w-7xl mx-auto space-y-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-52 animate-pulse" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
            No active bulletins found within the last 7 days.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <div
                key={article.id}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-xl"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="bg-slate-950 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded font-mono">
                      📍 {article.region || "Pan-India"}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      📅 {formatDate(article.published_at || article.date)}
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

                <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                  <button
                    onClick={() => setSelectedArticle(article)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>{t.readDetail}</span> →
                  </button>
                  <button
                    onClick={() => handleWhatsAppShare(article.title, article.source_url)}
                    className="bg-emerald-950 text-emerald-300 border border-emerald-800/60 text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                  >
                    💬 Share
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EXECUTIVE BULLETIN DETAIL MODAL */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-3xl w-full space-y-5 relative shadow-2xl animate-scaleUp max-h-[90vh] overflow-y-auto">
            
            {/* Close Button with Fixed Z-Index & Position */}
            <button
              onClick={() => setSelectedArticle(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer z-10"
            >
              ✕
            </button>

            {/* Header with Padding-Right (pr-10) to avoid overlap with Close Button */}
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

              {/* Enhanced Top Metadata Row including Read Full Article Link */}
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
                    🔗 Read Full Article ↗
                  </a>
                )}
              </div>
            </div>

            {/* Deep-Dive Article Body */}
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm text-slate-200 leading-relaxed">
                <h5 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider mb-2">Detailed Market Intelligence</h5>
                <p>{selectedArticle.full_content || selectedArticle.summary}</p>
              </div>

              {/* Strategic Takeaway */}
              {selectedArticle.key_takeaway && (
                <div className="bg-emerald-950/40 border border-emerald-800/60 p-4 rounded-xl text-xs text-emerald-300 space-y-1">
                  <strong className="text-emerald-400 uppercase font-mono block">💡 Executive Strategic Takeaway</strong>
                  <p className="text-slate-200 leading-relaxed">{selectedArticle.key_takeaway}</p>
                </div>
              )}

              {/* Stakeholder Action Advisory Box */}
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

              {/* Official Compliance Support Link */}
              {selectedArticle.official_compliance_link && (
                <div className="bg-blue-950/40 border border-blue-800/50 p-3.5 rounded-xl flex items-center justify-between text-xs gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono uppercase text-blue-400 font-bold block">Official Regulatory Compliance Mandate</span>
                    <span className="text-slate-200 font-medium">{selectedArticle.official_compliance_title || "Official Regulatory Portal"}</span>
                  </div>
                  <a
                    href={selectedArticle.official_compliance_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg shrink-0 transition"
                  >
                    Official Portal ↗
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
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