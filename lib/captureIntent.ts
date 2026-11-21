import type { Router } from 'expo-router';
import { supabase } from './supabase';

// How fresh a capture_intents row has to be to act on it - guards against a
// stale row from a launch that got abandoned (e.g. the user force-quit
// before this ever ran) silently reopening Quick Add much later.
const FRESH_WINDOW_MS = 20_000;

// Checks for a pending "open Quick Add and start recording" signal written
// by the request-capture Edge Function (see supabase/schema.sql's
// capture_intents table) and, if one is fresh enough, redirects there.
// Always clears out this user's rows so the table doesn't accumulate,
// whether or not anything fires. Call on mount and again on every
// focus/visibilitychange - the Home Screen app is often still running in
// the background, so a relaunch can bring it forward without remounting.
export async function checkCaptureIntent(userId: string, router: Router): Promise<void> {
  const { data, error } = await supabase
    .from('capture_intents')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return;

  const latest = data[0].created_at as string;
  await supabase.from('capture_intents').delete().eq('user_id', userId);

  const ageMs = Date.now() - new Date(latest).getTime();
  if (ageMs <= FRESH_WINDOW_MS) {
    // push, not replace - this often fires as the very first navigation
    // after a fresh launch, so replace would leave nothing underneath to
    // go back to and no way to dismiss the screen.
    router.push('/capture?autostart=1');
  }
}
