import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Set EXPO_PUBLIC_API_URL to your deployed backend (e.g. https://api.skillconnect.app) for production builds.
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return 'http://localhost:4000';
    // Expo dev server runs on 8081 with the API on 4000; in production the backend serves the site itself.
    return window.location.port === '8081' ? `http://${window.location.hostname}:4000` : window.location.origin;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:4000`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}

export const API_URL = resolveApiUrl();
