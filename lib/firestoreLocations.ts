import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";

export interface LocationData {
  location_id: string;
  capital: string;
  state: string;
  region: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  dominant_brands: string[];
  demographics_focus: string;
  export_hub?: boolean;
}

export const FALLBACK_LOCATIONS: LocationData[] = [
  {
    location_id: "pune",
    capital: "Pune",
    state: "Maharashtra",
    region: "West",
    coordinates: { lat: 18.5204, lng: 73.8567 },
    dominant_brands: ["Pravin Masale", "Khedkar", "Suhana", "Everest"],
    demographics_focus: "High demand for authentic Maharashtrian Goda Masala, Kanda Lasun chutney, and regional pickle varieties.",
    export_hub: true
  },
  {
    location_id: "gandhinagar",
    capital: "Gandhinagar",
    state: "Gujarat",
    region: "West",
    coordinates: { lat: 23.2156, lng: 72.6369 },
    dominant_brands: ["Ramdev Spices", "Badshah", "Laljee Spices", "Everest"],
    demographics_focus: "Major trade hub for cumin, coriander powder, and sweet-spicy Gujarati pickle formulations.",
    export_hub: true
  },
  {
    location_id: "mumbai",
    capital: "Mumbai",
    state: "Maharashtra",
    region: "West",
    coordinates: { lat: 19.0760, lng: 72.8777 },
    dominant_brands: ["Everest", "Bedekar", "Mother's Recipe", "Catch"],
    demographics_focus: "Cosmopolitan trade center with massive quick-commerce penetration for organic spice blends and convenience packaging.",
    export_hub: true
  },
  {
    location_id: "srinagar",
    capital: "Srinagar",
    state: "Jammu and Kashmir",
    region: "North",
    coordinates: { lat: 34.0837, lng: 74.7973 },
    dominant_brands: ["Kanwal Spices", "Kashmir Valley Spices", "Catch", "MDH"],
    demographics_focus: "Unique Wazwan spice culture with heavy reliance on Kashmiri Lal Mirch, Saffron, and traditional dried garlic mixes.",
    export_hub: false
  },
  {
    location_id: "jaipur",
    capital: "Jaipur",
    state: "Rajasthan",
    region: "West",
    coordinates: { lat: 26.9124, lng: 75.7873 },
    dominant_brands: ["Catch", "Everest", "MDH", "Laljee Spices"],
    demographics_focus: "Fiery regional taste preferences (Mathania Chili). Strong market for dry garlic chutney and ker sangri pickles.",
    export_hub: false
  },
  {
    location_id: "bengaluru",
    capital: "Bengaluru",
    state: "Karnataka",
    region: "South",
    coordinates: { lat: 12.9716, lng: 77.5946 },
    dominant_brands: ["MTR", "Eastern", "Priya", "Aachi"],
    demographics_focus: "Rapid adoption of clean-label organic spices, instant Sambar/Rasam mixes, and ready-to-eat condiment pastes.",
    export_hub: true
  },
  {
    location_id: "kochi",
    capital: "Kochi",
    state: "Kerala",
    region: "South",
    coordinates: { lat: 9.9312, lng: 76.2673 },
    dominant_brands: ["Nirapara", "Eastern", "Grandma's", "Double Horse"],
    demographics_focus: "Global export powerhouse for Black Pepper, Green Cardamom, and authentic tender mango and fish pickles.",
    export_hub: true
  },
  {
    location_id: "kolkata",
    capital: "Kolkata",
    state: "West Bengal",
    region: "East",
    coordinates: { lat: 22.5726, lng: 88.3639 },
    dominant_brands: ["Sunrise Pure", "Cookme", "MDH", "Everest"],
    demographics_focus: "Strong demand for Panch Phoron, mustard oil-based pickles, and premium grade turmeric powder.",
    export_hub: true
  },
  {
    location_id: "delhi",
    capital: "New Delhi",
    state: "Delhi",
    region: "North",
    coordinates: { lat: 28.6139, lng: 77.2090 },
    dominant_brands: ["MDH", "Catch", "Goldjee", "Everest"],
    demographics_focus: "Massive market for blended chhole and butter chicken spices along with quick-commerce pickle consumption.",
    export_hub: true
  }
];

/**
 * Fetches location hubs from the Firestore 'locations' collection.
 * Automatically falls back to local seed dataset if Firestore is unreachable or empty.
 */
export async function getAllLocations(): Promise<LocationData[]> {
  try {
    const locationsRef = collection(db, "locations");
    const snapshot = await getDocs(locationsRef);

    if (snapshot.empty) {
      console.info("Firestore 'locations' collection empty. Serving fallback hubs dataset.");
      return FALLBACK_LOCATIONS;
    }

    return snapshot.docs.map((doc) => doc.data() as LocationData);
  } catch (error) {
    console.warn("Firestore locations fetch warning/fallback activated:", error);
    return FALLBACK_LOCATIONS;
  }
}