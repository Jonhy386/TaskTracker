import { Platform } from 'react-native';
import { supabase } from './supabase';

// Web Push only (see supabase/schema.sql's push_subscriptions table: the
// endpoint/p256dh/auth_key columns are the standard PushSubscription shape).
// expo-notifications doesn't cover web at all, so this talks to the browser's
// ServiceWorker/Push APIs directly instead.

export type PushSupportState = 'unsupported' | 'denied' | 'default' | 'granted';

export function isPushSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window
  );
}

export function getPushPermissionState(): PushSupportState {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission as PushSupportState;
}

// Registers sw.js (served from the site root - see web-static/sw.js), asks
// for notification permission if needed, subscribes with the VAPID public
// key, and upserts the subscription so the server can send to it later.
// Throws on failure; callers show the message to the user.
export async function subscribeToPush(userId: string): Promise<void> {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error('Missing EXPO_PUBLIC_VAPID_PUBLIC_KEY.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Browser returned an incomplete push subscription.');
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth_key: json.keys.auth,
    },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}
