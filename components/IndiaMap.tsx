"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LocationData, getAllLocations } from "@/lib/firestoreLocations";

// Custom Circular Marker Styles
const createCustomIcon = (isSelected: boolean) =>
  L.divIcon({
    className: "custom-marker-icon",
    html: `
      <div style="
        background-color: ${isSelected ? "#10b981" : "#f97316"};
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 2px solid #ffffff;
        box-shadow: 0 0 12px ${isSelected ? "rgba(16, 185, 129, 0.9)" : "rgba(249, 115, 22, 0.8)"};
        cursor: pointer;
        transition: all 0.2s ease-in-out;
      "></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });

interface IndiaMapProps {
  onSelectLocation?: (location: LocationData) => void;
}

export default function IndiaMap({ onSelectLocation }: IndiaMapProps) {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);

  useEffect(() => {
    async function loadLocations() {
      try {
        const data = await getAllLocations();
        setLocations(data);
      } catch (err) {
        console.error("Failed to load map markers:", err);
      } finally {
        setLoading(false);
      }
    }
    loadLocations();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-[580px] bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-emerald-400 font-semibold animate-pulse">
        📍 Initializing Pan-India Geospatial Intelligence Map...
      </div>
    );
  }

  return (
    <div className="w-full h-[580px] rounded-2xl overflow-hidden shadow-2xl border border-slate-800 relative z-0">
      <MapContainer
        center={[22.5937, 78.9629]}
        zoom={5}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        {/* High-visibility Voyager TileLayer */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://cartodb-basemaps-a.global.ssl.fastly.net/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {locations.map((loc) => {
          const locId = loc.location_id || loc.capital;
          const isSelected = activeLocationId === locId;

          return (
            <Marker
              key={locId}
              position={[loc.coordinates.lat, loc.coordinates.lng]}
              icon={createCustomIcon(isSelected)}
              eventHandlers={{
                click: () => setActiveLocationId(locId),
              }}
            >
              <Popup className="dark-leaflet-popup">
                <div className="p-1 bg-slate-900 text-slate-100 rounded-xl font-sans max-w-[260px]">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                    <h3 className="text-base font-bold text-white">{loc.capital}</h3>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-semibold uppercase">
                      {loc.region}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mb-2">
                    <strong className="text-slate-200">State:</strong> {loc.state}
                  </p>

                  <p className="text-xs font-semibold text-slate-300 mb-1">Dominant Brands:</p>
                  <div className="flex flex-wrap gap-1.5 my-1.5">
                    {loc.dominant_brands?.slice(0, 4).map((brand) => (
                      <span
                        key={brand}
                        className="bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-medium px-2 py-0.5 rounded-md"
                      >
                        {brand}
                      </span>
                    ))}
                  </div>

                  <p className="text-[11px] text-slate-400 italic my-2 line-clamp-2">
                    "{loc.demographics_focus}"
                  </p>

                  {onSelectLocation && (
                    <button
                      onClick={() => {
                        setActiveLocationId(locId);
                        onSelectLocation(loc);
                      }}
                      className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-3 rounded-lg shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span>Market Insights</span>
                      <span>↗</span>
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}