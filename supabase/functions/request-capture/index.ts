// Called from an iOS Shortcut bound to the Action Button, right before it
// opens webapp://tasktracker-pwa.../ to bring the installed Home Screen app
// forward. iOS drops any path/query on that webapp:// URL, so there's no way
// to tell the app "start recording" through the URL itself - instead, this
// function writes a timestamped row for the user, and the app checks for one
// on launch/foreground (lib/captureIntent.ts) and redirects into Quick Add
// if it finds one fresh enough.
//
// Deployed via the Supabase Dashboard (Edge Functions -> New function ->
// paste this file -> Deploy), with "Verify JWT" off and a CAPTURE_SECRET
// secret set - same pattern as send-reminders, but its own secret so a leak
// of one doesn't expose the other.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const captureSecret = Deno.env.get('CAPTURE_SECRET');
  if (!captureSecret || req.headers.get('x-capture-secret') !== captureSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { user_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }
  if (!body.user_id) {
    return new Response('Missing user_id', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { error } = await supabase.from('capture_intents').insert({ user_id: body.user_id });
  if (error) {
    return new Response(`insert failed: ${error.message}`, { status: 500 });
  }

  return new Response('ok', { status: 200 });
});
