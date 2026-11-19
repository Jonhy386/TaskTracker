import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { generateId } from './id';

export interface AudioPayload {
  base64: string;
  mimeType: string;
}

// On native, recordings are temp files that get copied into a permanent
// voice-notes directory. On web, expo-audio hands back a `blob:` URL backed
// by an in-memory Blob — there's no filesystem to copy into, so we just keep
// using that URL (it lives for the page's lifetime, which covers the normal
// record -> parse -> save flow).
export async function saveAudioPermanently(tempUri: string): Promise<string> {
  if (Platform.OS === 'web') {
    return tempUri;
  }
  const dir = `${FileSystem.documentDirectory}voice-notes/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const permanentUri = `${dir}${generateId()}.m4a`;
  await FileSystem.copyAsync({ from: tempUri, to: permanentUri });
  return permanentUri;
}

export async function discardAudio(uri: string | null): Promise<void> {
  if (!uri) return;
  if (Platform.OS === 'web') {
    try {
      URL.revokeObjectURL(uri);
    } catch {
      // ignore
    }
    return;
  }
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}

export async function readAudioForUpload(uri: string): Promise<AudioPayload> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const blob = await res.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] ?? '');
      };
      reader.onerror = () => reject(new Error('Failed to read recorded audio.'));
      reader.readAsDataURL(blob);
    });
    return { base64, mimeType: blob.type || 'audio/webm' };
  }
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  return { base64, mimeType: guessAudioMimeType(uri) };
}

function guessAudioMimeType(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'm4a':
    case 'mp4':
      return 'audio/mp4';
    case 'wav':
      return 'audio/wav';
    case 'aac':
      return 'audio/aac';
    case 'caf':
      return 'audio/x-caf';
    default:
      return 'audio/mp4';
  }
}
