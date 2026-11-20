# Supabase setup (step 1 of the cloud-sync build)

1. Go to https://supabase.com, sign in (or create a free account), and create a new project.
   Any region is fine; Europe-West (London) is closest if you want to minimize latency from Lisbon.
2. Once the project is ready, open **SQL Editor -> New query**, paste the contents of
   [`schema.sql`](./schema.sql), and run it. This creates `projects`, `tasks`, `ideas`,
   `time_sessions` and `push_subscriptions`, each scoped to the signed-in user via Row Level Security.
3. Go to **Project Settings -> Data API** (sometimes labeled "API"). Copy:
   - **Project URL**
   - **anon public** key (not the `service_role` key — that one stays server-side only, never in this app)
4. In the TaskTracker project folder, copy `.env.example` to `.env.local` and fill in those two values:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
   ```
   `.env.local` is gitignored — it never gets committed.
5. Go to **Authentication -> Sign In / Providers -> Email** and make sure "Email" is enabled with
   magic link / OTP (it is by default). Under **Authentication -> URL Configuration**, add your
   deployed site to **Redirect URLs**, e.g. `https://tasktracker-pwa.joaomlopes1995.workers.dev/**`
   (and `http://localhost:8081/**` for local dev) — Supabase only redirects back to allow-listed URLs
   after a magic-link click.

That's it for this step — tell me once `.env.local` is filled in and the schema ran, and I'll wire up
the sign-in screen next.
