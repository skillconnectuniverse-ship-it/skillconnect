import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'skillconnect_token';

export async function getStoredToken(): Promise<string | null> {
  if (Platform.OS === 'web') return typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  return SecureStore.getItemAsync(KEY);
}

export async function setStoredToken(token: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
    return;
  }
  if (token) await SecureStore.setItemAsync(KEY, token);
  else await SecureStore.deleteItemAsync(KEY);
}
