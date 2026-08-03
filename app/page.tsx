"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { LocationData } from "@/lib/firestoreLocations";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

// Dynamically import Leaflet Map to bypass Server-Side Rendering (SSR) window errors
const IndiaMap = dynamic(() => import("@/components/IndiaMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[580px] bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-emerald-400 font-semibold animate-pulse">
      📍 Initializing Pan-India Geospatial Intelligence Map...
    </div>
  ),
});

interface Article {
  id: string;
  title: string;
  category: string;
  summary: string;
  region: string;
  date: string;
  source_url?: string;
  key_takeaway?: string;
}

export default function Home() {
  const [selectedRegion, setSelectedRegion] = useState<string>("All");
  const [selectedCategory, setSelectedCategory] = useState<string>("Spices & Pickles");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);

  useEffect(() => {
    async function fetchNews() {
      setLoading(true);
      try {
        const newsRef = collection(db, "news_articles");
        let q = query(
          newsRef,
          where("category", "==", selectedCategory),
          orderBy("published_at", "desc"),
          limit(20)
        );

        if (selectedRegion !== "All") {
          q = query(
            newsRef,
            where("category", "==", selectedCategory),
            where("region", "==", selectedRegion),
            orderBy("published_at", "desc"),
            limit(20)
          );
        }

        const snapshot = await getDocs(q);
        const docs: Article[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Article, "id">),
        }));
        setArticles(docs);
      } catch (error) {
        console.error("Error fetching articles:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchNews();
  }, [selectedCategory, selectedRegion]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      {/* Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-6 mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white flex items-center gap-2">
            🌶️ FMCGDesk Market Intelligence
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Executive News Bulletin & Geospatial Trade Intelligence
          </p>
        </div>

        {/* Region Filter */}
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2 rounded-xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-2">
            Region:
          </span>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="bg-slate-950 text-slate-200 text-xs font-bold border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            <option value="All">All Regions (Pan-India)</option>
            <option value="North">North India</option>
            <option value="South">South India</option>
            <option value="East">East India</option>
            <option value="West">West India</option>
            <option value="Central">Central India</option>
            <option value="North-East">North-East India</option>
          </select>
        </div>
      </header>

      <div className="max-w-7xl mx-auto space-y-10">
        {/* Category Selector Tabs */}
        <div className="flex gap-3 border-b border-slate-800 pb-4">
          <button
            onClick={() => setSelectedCategory("Spices & Pickles")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              selectedCategory === "Spices & Pickles"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            🌶️ Spices & Pickles (Live)
          </button>
          <button
            disabled
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900/50 text-slate-600 border border-slate-800/50 cursor-not-allowed flex items-center gap-2"
          >
            🥛 Dairy & Beverages <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">Soon</span>
          </button>
        </div>

        {/* Interactive Pan-India Geospatial Map */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              🗺️ Interactive Pan-India Geospatial Map
            </h2>
            <span className="text-xs font-mono bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1 rounded-full">
              37 Key Hubs Seeded
            </span>
          </div>

          <IndiaMap onSelectLocation={(loc) => setSelectedLocation(loc)} />
        </section>

        {/* Executive News Intelligence Grid */}
        <section className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              📰 Executive Market Briefs
            </h2>
            <span className="text-xs font-medium text-slate-400">
              Showing {articles.length} Updates
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 h-48 animate-pulse"
                />
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              No news bulletins found for this filter selection.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article) => (
                <div
                  key={article.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-3 transition flex flex-col justify-between shadow-xl"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="bg-emerald-950 text-emerald-400 border border-emerald-800/50 px-2.5 py-0.5 rounded-md font-semibold">
                        {article.region}
                      </span>
                      <span className="text-slate-500 font-mono text-[11px]">
                        {article.date}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white leading-snug line-clamp-2 pt-1">
                      {article.title}
                    </h3>

                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                      {article.summary}
                    </p>
                  </div>

                  {article.key_takeaway && (
                    <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-[11px] text-slate-300 font-medium">
                      💡 <strong className="text-emerald-400">Takeaway:</strong>{" "}
                      {article.key_takeaway}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Location Detail Modal */}
      {selectedLocation && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full space-y-5 relative shadow-2xl">
            <button
              onClick={() => setSelectedLocation(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl font-bold bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center transition"
            >
              ✕
            </button>

            <div className="border-b border-slate-800 pb-3">
              <span className="text-xs font-mono uppercase bg-emerald-950 text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-800/50 font-semibold">
                {selectedLocation.region} Region • Market Insights
              </span>
              <h3 className="text-2xl font-black text-white mt-2 tracking-tight">
                {selectedLocation.capital}, {selectedLocation.state}
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
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
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Consumer & Culinary Focus
                </h4>
                <p className="text-sm text-slate-300 mt-1.5 bg-slate-950 p-3.5 rounded-xl border border-slate-800 leading-relaxed">
                  {selectedLocation.demographics_focus}
                </p>
              </div>

              {selectedLocation.export_hub && (
                <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-800/60 p-3 rounded-xl text-emerald-300 text-xs font-semibold">
                  🌐 Key International Export Hub for Spices & Processed Pickles
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLocation(null)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-emerald-600/20 transition cursor-pointer"
              >
                Close Insights
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}