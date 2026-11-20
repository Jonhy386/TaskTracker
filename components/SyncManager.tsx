import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { runSync } from '../lib/sync';
import { onLocalChange } from '../lib/syncOutbox';

const PERIODIC_SYNC_MS = 2 * 60 * 1000; // catches changes made on another device
const DEBOUNCE_MS = 1500; // batches rapid local edits before pushing

// Renders nothing - just drives lib/sync.ts in the background once signed in.
export default function SyncManager({ userId }: { userId: string }) {
  const db = useSQLiteContext();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      if (!cancelled) runSync(db, userId);
    };

    sync();

    const unsubscribe = onLocalChange(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(sync, DEBOUNCE_MS);
    });

    const interval = setInterval(sync, PERIODIC_SYNC_MS);

    let removeOnlineListener: (() => void) | undefined;
    if (Platform.OS === 'web') {
      window.addEventListener('online', sync);
      removeOnlineListener = () => window.removeEventListener('online', sync);
    }

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(interval);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      removeOnlineListener?.();
    };
  }, [db, userId]);

  return null;
}
