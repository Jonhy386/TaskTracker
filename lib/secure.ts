import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const GEMINI_API_KEY = 'gemini_api_key';

// expo-secure-store has no web implementation. On web we fall back to
// localStorage — fine for a single-user, self-hosted PWA storing one API key.
export async function getApiKey(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return window.localStorage.getItem(GEMINI_API_KEY);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(GEMINI_API_KEY);
}

export async function setApiKey(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(GEMINI_API_KEY, key);
    return;
  }
  await SecureStore.setItemAsync(GEMINI_API_KEY, key);
}

export async function clearApiKey(): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.removeItem(GEMINI_API_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(GEMINI_API_KEY);
}
