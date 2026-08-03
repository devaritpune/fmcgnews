"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  fetchLiveNews,
  generateGeminiTrendAnalysis,
  NewsArticle,
  TrendAnalysis,
} from "../lib/newsService";
import { LocationData } from "@/lib/firestoreLocations";

// Dynamically import Leaflet Map to bypass Server-Side Rendering (SSR) window errors
const IndiaMap = dynamic(() => import("@/components/IndiaMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[550px] bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-orange-400 font-semibold animate-pulse">
      📍 Initializing Pan-India Geospatial Map...
    </div>
  ),
});

const INDIAN_STATES = [
  "All",
  "National",
  "Kerala",
  "Maharashtra",
  "Punjab",
  "Andhra Pradesh",
  "Gujarat",
  "Karnataka",
];

export default function FMCGDeskDashboard() {
  const [activeCategory, setActiveCategory] = useState<string>("spices_pickles");
  const [selectedState, setSelectedState] = useState<string>("All");
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [trendAnalysis, setTrendAnalysis] = useState<TrendAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);

  useEffect(() => {
    async function loadNews() {
      setLoading(true);
      const data = await fetchLiveNews(activeCategory, selectedState);
      setArticles(data);
      setTrendAnalysis(generateGeminiTrendAnalysis(data));
      setLoading(false);
    }
    loadNews();
  }, [activeCategory, selectedState]);

  return (
    <main className="p-8 max-w-7xl mx-auto min-h-screen text-slate-100 font-sans space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🌶️</span>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              FMCGDesk Market Intelligence
            </h1>
          </div>
          <p className="text-slate-400 text-sm">
            Past 7 Days Executive News Bulletin • Spices & Pickles Category
          </p>
        </div>

        {/* State Filter Dropdown */}
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
          <label className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Region:
          </label>
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="bg-transparent text-white text-sm font-medium focus:outline-none cursor-pointer"
          >
            {INDIAN_STATES.map((st) => (
              <option key={st} value={st} className="bg-slate-900 text-white">
                {st === "All" ? "🇮🇳 All Regions" : st}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Category Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setActiveCategory("spices_pickles")}
          className="px-5 py-2.5 rounded-lg font-semibold text-sm bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 shadow-lg shadow-emerald-500/5"
        >
          🌶️ Spices & Pickles (Live)
        </button>

        <button
          disabled
          className="px-5 py-2.5 rounded-lg font-medium text-sm bg-slate-900/40 border border-slate-800 text-slate-600 cursor-not-allowed flex items-center gap-2"
        >
          🥛 Dairy & Beverages
          <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">
            Soon
          </span>
        </button>
      </div>

      {/* Geospatial Map Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
            🗺️ Interactive Pan-India Geospatial Map
          </h2>
          <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full font-medium">
            37 Locations Seeded
          </span>
        </div>

        {/* The Interactive Leaflet Map Component */}
        <IndiaMap onSelectLocation={(loc) => setSelectedLocation(loc)} />
      </section>

      {/* Executive Briefing Tile: "AI Market Insights" */}
      {trendAnalysis && !loading && (
        <section className="p-6 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                ✨ AI Market Insights
              </span>
              <span className="text-xs text-slate-400">
                Synthesis of {articles.length} Active Articles (Past 7 Days)
              </span>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full w-fit ${
                trendAnalysis.marketSentiment === "Bullish"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
              }`}
            >
              Market Outlook: {trendAnalysis.marketSentiment}
            </span>
          </div>

          {/* Executive Summary Block */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl mb-4">
            <p className="text-slate-200 text-sm font-medium leading-relaxed">
              <strong className="text-emerald-400 font-semibold">Executive Summary:</strong>{" "}
              {trendAnalysis.executiveSummary}
            </p>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-semibold">⚠️ Operational Watchout:</span>
              <span>{trendAnalysis.topRiskFactor}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <span>Top Active States:</span>
              <span className="text-slate-300 font-medium">
                {trendAnalysis.activeRegions.join(", ")}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Grid of News Articles */}
      {loading ? (
        <div className="p-16 text-center text-slate-500 animate-pulse bg-slate-900/30 border border-slate-800 rounded-2xl">
          Fetching live FMCG market news and computing AI Market Insights...
        </div>
      ) : articles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {articles.map((item, idx) => (
            <div
              key={item.id || idx}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-lg"
            >
              <div>
                {/* Article Header & Metadata */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800 text-slate-300">
                      📍 {item.state || "National"}
                    </span>
                    {item.publishedDate && (
                      <span className="text-[11px] text-slate-500">
                        {item.publishedDate}
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                      item.riskLevel === "High"
                        ? "bg-red-500/10 text-red-400 border border-red-500/30"
                        : item.riskLevel === "Medium"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    }`}
                  >
                    {item.riskLevel} Risk
                  </span>
                </div>

                {/* Article Title */}
                <h3 className="font-bold text-lg text-white mb-3 line-clamp-2 leading-snug group-hover:text-emerald-400 transition-colors">
                  {item.title}
                </h3>

                {/* Article Summary */}
                <p className="text-slate-400 text-sm line-clamp-3 leading-relaxed mb-6">
                  {item.summary}
                </p>
              </div>

              {/* Direct External Link */}
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between w-full px-4 py-2.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/20 hover:border-emerald-500/60 transition-all cursor-pointer"
              >
                <span>Read Full External Article</span>
                <span className="text-sm">↗</span>
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center">
          <p className="text-slate-300 font-medium mb-1">
            No articles found for region "{selectedState}".
          </p>
          <p className="text-slate-500 text-sm">
            Select "All Regions" to view nationwide market updates.
          </p>
        </div>
      )}

      {/* Location Detail Modal */}
      {selectedLocation && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full space-y-4 relative shadow-2xl">
            <button
              onClick={() => setSelectedLocation(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl font-bold"
            >
              ✕
            </button>

            <div className="border-b border-slate-800 pb-3">
              <span className="text-xs font-mono uppercase bg-orange-950 text-orange-400 px-2 py-0.5 rounded border border-orange-800/50">
                {selectedLocation.region} Region
              </span>
              <h3 className="text-2xl font-black text-white mt-2">
                {selectedLocation.capital}, {selectedLocation.state}
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400">Dominant Brands</h4>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedLocation.dominant_brands?.map((brand) => (
                    <span
                      key={brand}
                      className="bg-slate-800 text-orange-300 border border-slate-700 text-xs px-2.5 py-1 rounded font-semibold"
                    >
                      {brand}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400">
                  Consumer & Culinary Focus
                </h4>
                <p className="text-sm text-slate-300 mt-1 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  {selectedLocation.demographics_focus}
                </p>
              </div>

              {selectedLocation.export_hub && (
                <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/50 p-2.5 rounded-lg text-emerald-400 text-xs font-medium">
                  🌐 Key International Export Hub for Spices & Processed Pickles
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLocation(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2 px-4 rounded transition"
              >
                Close Market Brief
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}