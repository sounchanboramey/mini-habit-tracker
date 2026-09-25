-- Run this file in the Supabase SQL Editor after creating your project.
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  log_date date not null default current_date,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

alter table public.habits enable row level security;
alter table public.daily_logs enable row level security;

create policy "Users select own habits" on public.habits for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own habits" on public.habits for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own habits" on public.habits for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own habits" on public.habits for delete to authenticated using (auth.uid() = user_id);

create policy "Users select own daily logs" on public.daily_logs for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own daily logs" on public.daily_logs for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own daily logs" on public.daily_logs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own daily logs" on public.daily_logs for delete to authenticated using (auth.uid() = user_id);

-- Optional starter data: replace the UUID with your signed-in user's auth.users.id.
-- insert into public.habits (user_id, name) values
-- ('YOUR-AUTH-USER-UUID', 'Drink a glass of water'),
-- ('YOUR-AUTH-USER-UUID', 'Read for ten minutes'),
-- ('YOUR-AUTH-USER-UUID', 'Take a short walk');
