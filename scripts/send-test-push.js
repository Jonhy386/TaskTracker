// Manual test sender for Web Push - not part of the app build. Reads
// push_subscriptions directly from Supabase (via the service_role key, which
// bypasses RLS) and sends each one a notification via the VAPID keys in
// .env.local. Scheduled/automatic sending (e.g. due-date reminders) isn't
// built yet - this is just for confirming the subscribe -> send path works.
//
// Usage:
//   node scripts/send-test-push.js [user_id] ["message"]
// With no user_id, sends to every subscription in the table (fine for
// solo testing). Find your user_id in Supabase -> Authentication -> Users.
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();

  const [, , userIdArg, messageArg] = process.argv;
  const message = messageArg || 'Test push from send-test-push.js';

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.');
    console.error('Get the service_role key from Supabase -> Project Settings -> Data API.');
    process.exit(1);
  }
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.error('Missing VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT in .env.local.');
    process.exit(1);
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let query = supabase.from('push_subscriptions').select('*');
  if (userIdArg) query = query.eq('user_id', userIdArg);
  const { data: subs, error } = await query;
  if (error) throw error;

  if (!subs || subs.length === 0) {
    console.log(userIdArg ? `No subscriptions found for user_id ${userIdArg}.` : 'No subscriptions found at all.');
    console.log('Enable notifications from the app\'s Settings screen first.');
    return;
  }

  console.log(`Sending to ${subs.length} subscription(s)...`);
  const payload = JSON.stringify({ title: 'TaskTracker', body: message, url: '/' });

  for (const sub of subs) {
    const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } };
    try {
      await webpush.sendNotification(subscription, payload);
      console.log(`  ok   ${sub.endpoint.slice(0, 60)}...`);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.log(`  gone ${sub.endpoint.slice(0, 60)}... (removing stale subscription)`);
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      } else {
        console.error(`  fail ${sub.endpoint.slice(0, 60)}...`, err.statusCode, err.body || err.message);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
