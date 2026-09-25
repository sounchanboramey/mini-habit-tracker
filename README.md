# little by little ✳ — Mini Habit Tracker

A minimal, calm habit tracker built with **React + Vite + Supabase**.  
Every user sees only their own habits — row-level security enforces this at the database layer.

---

## ✨ Features

- **Sign up / Sign in** with email and password (Supabase Auth)
- **Protected routes** — the tracker redirects to `/login` until authenticated
- **Full CRUD** — add, rename, delete habits; each deletion cascades to its daily logs
- **Daily toggle** — mark habits done (or undo); persisted in `daily_logs`
- **Completed-today visual** — green check, strikethrough name, progress pill
- **Session persistence** — Supabase stores the JWT in `localStorage`; refresh loses nothing
- **RLS enforced** — `auth.uid() = user_id` on every table row; a second account sees an empty list

---

## 🚀 Local Setup

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/mini-habit-tracker.git
cd mini-habit-tracker
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Settings → **API** → copy **Project URL** and **anon public** key

### 3. Add your keys

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> **Never commit `.env`** — it is gitignored by default.

### 4. Apply the database schema

In the Supabase dashboard → **SQL Editor** → **New query**, paste and run [`src/database/schema.sql`](src/database/schema.sql).

This creates:

| Table | Description |
|---|---|
| `public.habits` | One row per habit; `user_id` foreign-keys to `auth.users` |
| `public.daily_logs` | One row per (habit, date); `ON DELETE CASCADE` from habits |

RLS is enabled on both tables. Eight policies restrict every operation to `auth.uid() = user_id`.

### 5. (Optional) Seed starter habits

After signing up, find your UUID in **Authentication → Users**, then run in the SQL Editor:

```sql
insert into public.habits (user_id, name) values
  ('YOUR-UUID-HERE', 'Drink a glass of water'),
  ('YOUR-UUID-HERE', 'Read for ten minutes'),
  ('YOUR-UUID-HERE', 'Take a short walk');
```

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## 🛡️ Security Design

### Row-Level Security policies

```sql
-- habits (repeated pattern for daily_logs)
create policy "Users select own habits"
  on public.habits for select to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own habits"
  on public.habits for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own habits"
  on public.habits for update to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own habits"
  on public.habits for delete to authenticated
  using (auth.uid() = user_id);
```

### What an attacker could do if RLS were disabled

> If RLS were disabled on a deployed app, any attacker who extracts the public anon key from the client bundle (trivially, via browser DevTools → Network tab) could read, overwrite, or delete **every user's habits and daily logs** with a single HTTP request — no login required.

---

## ✅ Audit Checklist

- [ ] `git status` — `.env` is **not** listed as a tracked file
- [ ] Sign in as **Account A** → habits appear
- [ ] Sign in as **Account B** (different email) → list is **empty**, no error
- [ ] Delete a habit as Account A → check Supabase Table Editor: `daily_logs` rows for that habit are gone
- [ ] Refresh the page → session restores, habits reload (no re-login required)
- [ ] Supabase dashboard → **Authentication → Policies** → 8 policies exist (4 per table)

---

## 📁 Project Structure

```
src/
├── lib/
│   └── supabase.js        # Supabase client (reads from .env, never hard-coded)
├── database/
│   └── schema.sql         # Tables, RLS, policies — paste into SQL Editor
├── App.jsx                # Auth forms, ProtectedRoute, Tracker with full CRUD
├── App.css                # Styles
└── main.jsx               # React root
```

---

## 🧰 Tech Stack

| Layer | Tool |
|---|---|
| Frontend | React 19 + Vite |
| Routing | React Router v7 |
| Backend / DB | Supabase (Postgres + Auth) |
| Auth | Supabase Auth (email/password) |
| Security | Postgres Row-Level Security |
