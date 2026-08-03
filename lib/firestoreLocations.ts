import { db } from "./firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

export interface LocationData {
  location_id: string;
  capital: string;
  state: string;
  region: string;
  coordinates: { lat: number; lng: number };
  dominant_brands: string[];
  demographics_focus: string;
  export_hub: boolean;
  top_categories?: string[];
}

// Fetch all 37 Locations for Map Pins
export async function getAllLocations(): Promise<LocationData[]> {
  try {
    const querySnapshot = await getDocs(collection(db, "locations"));
    return querySnapshot.docs.map((doc) => doc.data() as LocationData);
  } catch (error) {
    console.error("Error fetching locations from Firestore:", error);
    return [];
  }
}

// Fetch single Location details by ID
export async function getLocationById(locationId: string): Promise<LocationData | null> {
  try {
    const docRef = doc(db, "locations", locationId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as LocationData) : null;
  } catch (error) {
    console.error("Error fetching location details:", error);
    return null;
  }
}