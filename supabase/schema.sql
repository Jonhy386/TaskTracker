                        -- TaskTracker cloud schema. Run this once in the Supabase SQL editor
                        -- (Project -> SQL Editor -> New query -> paste -> Run).
                        --
                        -- Mirrors the local SQLite schema (lib/db.ts) one-for-one for projects,
                        -- tasks, ideas and time_sessions, with a user_id + RLS policy added on
                        -- each so the data is scoped to whoever is signed in. pending_captures
                        -- (the on-device "Needs Review" queue for failed AI parses) stays
                        -- local-only and is not synced.
                        
                        create table if not exists projects (
                          id text primary key,
                          user_id uuid not null references auth.users (id) on delete cascade,
                          name text not null,
                          color text not null,
                          is_closed boolean not null default false,
                          updated_at timestamptz not null default now()
                        );
                        
                        create table if not exists tasks (
                          id text primary key,
                          user_id uuid not null references auth.users (id) on delete cascade,
                          title text not null,
                          description text,
                          project_id text not null references projects (id),
                          due_date date,
                          status text not null default 'not_started',
                          created_at timestamptz not null default now(),
                          updated_at timestamptz not null default now(),
                          total_time_seconds integer not null default 0
                        );
                        
                        create table if not exists ideas (
                          id text primary key,
                          user_id uuid not null references auth.users (id) on delete cascade,
                          title text not null,
                          body text not null,
                          project_id text references projects (id),
                          created_at timestamptz not null default now()
                        );
                        
                        create table if not exists time_sessions (
                          id text primary key,
                          user_id uuid not null references auth.users (id) on delete cascade,
                          task_id text references tasks (id),
                          project_id text not null references projects (id),
                          start_time timestamptz not null,
                          end_time timestamptz,
                          duration_seconds integer
                        );
                        
                        -- Web Push subscriptions, one row per browser/device that enabled reminders.
                        create table if not exists push_subscriptions (
                          id uuid primary key default gen_random_uuid(),
                          user_id uuid not null references auth.users (id) on delete cascade,
                          endpoint text not null unique,
                          p256dh text not null,
                          auth_key text not null,
                          created_at timestamptz not null default now()
                        );
                        
                        create index if not exists idx_tasks_user on tasks (user_id);
                        create index if not exists idx_tasks_project on tasks (project_id);
                        create index if not exists idx_ideas_user on ideas (user_id);
                        create index if not exists idx_sessions_user on time_sessions (user_id);
                        create index if not exists idx_push_subs_user on push_subscriptions (user_id);
                        
                        alter table projects enable row level security;
                        alter table tasks enable row level security;
                        alter table ideas enable row level security;
                        alter table time_sessions enable row level security;
                        alter table push_subscriptions enable row level security;
                        
                        create policy "own rows" on projects for all
                          using (auth.uid() = user_id) with check (auth.uid() = user_id);
                        create policy "own rows" on tasks for all
                          using (auth.uid() = user_id) with check (auth.uid() = user_id);
                        create policy "own rows" on ideas for all
                          using (auth.uid() = user_id) with check (auth.uid() = user_id);
                        create policy "own rows" on time_sessions for all
                          using (auth.uid() = user_id) with check (auth.uid() = user_id);
                        create policy "own rows" on push_subscriptions for all
                          using (auth.uid() = user_id) with check (auth.uid() = user_id);
