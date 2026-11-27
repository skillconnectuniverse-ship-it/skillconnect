import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { api } from './api';

export interface Coords {
  lat: number;
  lng: number;
}

// Returns null when permission is denied or location is unavailable.
export async function getCurrentCoords(): Promise<Coords | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

// Fallback when GPS is unavailable; web goes through the backend (Nominatim blocks browser CORS).
export async function geocodeAddress(address: string): Promise<Coords | null> {
  try {
    if (Platform.OS !== 'web') {
      const [r] = await Location.geocodeAsync(address);
      return r ? { lat: r.latitude, lng: r.longitude } : null;
    }
    const { result } = await api.get<{ result: Coords | null }>('/search/geocode', { q: address });
    return result;
  } catch {
    return null;
  }
}

export async function reverseCity(c: Coords): Promise<{ city: string; country: string; address: string } | null> {
  try {
    const [p] = await Location.reverseGeocodeAsync({ latitude: c.lat, longitude: c.lng });
    if (!p) return null;
    return {
      city: p.city || p.subregion || p.region || '',
      country: p.country || '',
      address: [p.name, p.street, p.district, p.city, p.region].filter(Boolean).join(', '),
    };
  } catch {
    return null;
  }
}
