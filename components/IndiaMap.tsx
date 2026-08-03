"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LocationData, getAllLocations } from "@/lib/firestoreLocations";

// Custom Marker Icon matching the Travel Buddy map style
const customIcon = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

interface IndiaMapProps {
  onSelectLocation?: (location: LocationData) => void;
}

export default function IndiaMap({ onSelectLocation }: IndiaMapProps) {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLocations() {
      const data = await getAllLocations();
      setLocations(data);
      setLoading(false);
    }
    loadLocations();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-[550px] bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-orange-400 font-semibold animate-pulse">
        📍 Loading 37 FMCG Market Locations from Firestore...
      </div>
    );
  }

  return (
    <div className="w-full h-[550px] rounded-xl overflow-hidden shadow-2xl border border-slate-800 relative z-0">
      <MapContainer
        center={[22.5937, 78.9629]} // Center of India
        zoom={5}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {locations.map((loc) => (
          <Marker
            key={loc.location_id || loc.capital}
            position={[loc.coordinates.lat, loc.coordinates.lng]}
            icon={customIcon}
          >
            <Popup className="custom-popup">
              <div className="p-2 text-slate-900 font-sans max-w-[240px]">
                <div className="flex items-center justify-between border-b pb-1 mb-2">
                  <h3 className="text-base font-bold text-slate-900">{loc.capital}</h3>
                  <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded font-semibold">
                    {loc.region}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mb-1">
                  <strong>State:</strong> {loc.state}
                </p>
                
                <p className="text-xs font-semibold text-slate-800 mt-2">Dominant Brands:</p>
                <div className="flex flex-wrap gap-1 my-1">
                  {loc.dominant_brands?.slice(0, 4).map((brand) => (
                    <span
                      key={brand}
                      className="bg-slate-200 text-slate-800 text-[10px] font-medium px-1.5 py-0.5 rounded"
                    >
                      {brand}
                    </span>
                  ))}
                </div>

                <p className="text-[11px] text-slate-600 italic mt-2 line-clamp-2">
                  "{loc.demographics_focus}"
                </p>

                {onSelectLocation && (
                  <button
                    onClick={() => onSelectLocation(loc)}
                    className="mt-3 w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-1.5 px-3 rounded shadow transition"
                  >
                    View Market Brief 📊
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}