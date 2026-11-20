// Daily due-date reminder push. Deployed via the Supabase Dashboard
// (Edge Functions -> New function -> paste this file -> Deploy), not the
// CLI. Triggered once a day by a pg_cron job (see supabase/schema.sql's
// cron.schedule call) hitting this function's URL with a shared secret -
// nothing else should be able to invoke it, so "verify_jwt" is off for this
// function and we check CRON_SECRET ourselves instead.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by
// the Edge Functions runtime - only CRON_SECRET and the VAPID_* secrets need
// to be set by hand (Edge Functions -> send-reminders -> Secrets).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT');
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return new Response('Missing VAPID secrets', { status: 500 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('id, title, user_id')
    .eq('due_date', today)
    .not('status', 'in', '(done,cancelled)');
  if (tasksError) {
    return new Response(`tasks query failed: ${tasksError.message}`, { status: 500 });
  }
  if (!tasks || tasks.length === 0) {
    return new Response('No tasks due today.', { status: 200 });
  }

  const tasksByUser = new Map<string, string[]>();
  for (const task of tasks) {
    const list = tasksByUser.get(task.user_id) ?? [];
    list.push(task.title);
    tasksByUser.set(task.user_id, list);
  }

  const { data: subs, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', [...tasksByUser.keys()]);
  if (subsError) {
    return new Response(`push_subscriptions query failed: ${subsError.message}`, { status: 500 });
  }

  let sent = 0;
  let removed = 0;
  for (const sub of subs ?? []) {
    const titles = tasksByUser.get(sub.user_id);
    if (!titles) continue;

    const body =
      titles.length === 1
        ? titles[0]
        : `${titles.slice(0, 2).join(', ')}${titles.length > 2 ? ` +${titles.length - 2} more` : ''}`;
    const payload = JSON.stringify({
      title: titles.length === 1 ? 'Due today' : `${titles.length} tasks due today`,
      body,
      url: '/',
    });

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        payload
      );
      sent += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        removed += 1;
      } else {
        console.error('send failed for', sub.id, err);
      }
    }
  }

  return new Response(`Sent ${sent}, removed ${removed} stale subscription(s).`, { status: 200 });
});
