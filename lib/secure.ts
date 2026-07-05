import * as SecureStore from 'expo-secure-store';

const GEMINI_API_KEY = 'gemini_api_key';

export async function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(GEMINI_API_KEY);
}

export async function setApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(GEMINI_API_KEY, key);
}

export async function clearApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(GEMINI_API_KEY);
}
