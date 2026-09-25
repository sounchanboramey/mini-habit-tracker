import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { supabase, supabaseConfigured } from './lib/supabase'
import ErrorBoundary from './components/ErrorBoundary'
import AvatarUpload from './components/AvatarUpload'
import OfflineBanner from './components/OfflineBanner'
import './App.css'

// ---------------------------------------------------------------------------
// Offline queue helpers — stored in localStorage so they survive a refresh
// ---------------------------------------------------------------------------
const QUEUE_KEY = 'habit_offline_queue'

function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') } catch { return [] }
}
function writeQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}
function enqueue(name) {
  const q = readQueue()
  q.push({ name, queuedAt: Date.now() })
  writeQueue(q)
}
function clearQueue() {
  localStorage.removeItem(QUEUE_KEY)
}

// ---------------------------------------------------------------------------
// Route guard
// ---------------------------------------------------------------------------
function ProtectedRoute({ session, children }) {
  return session ? children : <Navigate to="/login" replace />
}

// ---------------------------------------------------------------------------
// Auth page
// ---------------------------------------------------------------------------
function AuthPage({ mode }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const signup = mode === 'signup'

  async function submit(event) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    const { error: authError } = signup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (authError) setError(authError.message)
    else navigate('/')
  }

  return (
    <main className="auth-shell">
      <Link className="brand" to="/">little by little<span>✳</span></Link>
      <section className="auth-card">
        <p className="eyebrow">YOUR GENTLE RESET</p>
        <h1>{signup ? 'Make room for good habits.' : 'Welcome back.'}</h1>
        <p className="subtle">Small steps, repeated, become something wonderful.</p>

        {!supabaseConfigured && (
          <p className="notice">
            Add your Supabase URL and anon key to the local <code>.env</code> file to connect.
          </p>
        )}

        <form onSubmit={submit}>
          <label>
            Email address
            <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength="6" required value={password} onChange={e => setPassword(e.target.value)} />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" disabled={busy || !supabaseConfigured}>
            {busy ? 'One moment…' : signup ? 'Create my account' : 'Sign in'}
          </button>
        </form>

        <p className="switch-auth">
          {signup ? 'Already have an account?' : 'New around here?'}{' '}
          <Link to={signup ? '/login' : '/signup'}>
            {signup ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </section>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Topbar — wrapped in ErrorBoundary in Tracker
// ---------------------------------------------------------------------------
function Topbar({ session, onSignOut }) {
  return (
    <header className="topbar">
      <Link className="brand" to="/">little by little<span>✳</span></Link>
      <div className="user-menu">
        <AvatarUpload userId={session.user.id} />
        <span className="user-email">{session.user.email}</span>
        <button className="quiet-button" onClick={onSignOut}>Sign out</button>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// Share button — native share sheet on mobile, clipboard fallback on desktop
// ---------------------------------------------------------------------------
function ShareButton() {
  const [copied, setCopied] = useState(false)
  const shareText = 'I\'m building better habits with little by little ✳ — one small promise at a time.'
  const shareUrl  = window.location.origin

  async function handleShare() {
    if (navigator.share) {
      // Native share sheet (mobile)
      try {
        await navigator.share({ title: 'little by little', text: shareText, url: shareUrl })
      } catch {
        // User cancelled — no action needed
      }
    } else {
      // Clipboard fallback (desktop)
      try {
        await navigator.clipboard.writeText(`${shareText} ${shareUrl}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      } catch {
        // Clipboard blocked — silent fail
      }
    }
  }

  return (
    <button className="share-button" onClick={handleShare} aria-label="Share this app">
      {copied ? '✓ Copied!' : '↗ Share'}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Habit panel — wrapped in its own ErrorBoundary
// ---------------------------------------------------------------------------
function HabitPanel({ session }) {
  const [habits, setHabits]                 = useState([])
  const [completedToday, setCompletedToday] = useState(new Set())
  const [queued, setQueued]                 = useState(readQueue)   // offline queue
  const [name, setName]                     = useState('')
  const [loading, setLoading]               = useState(true)
  const [saving, setSaving]                 = useState(false)
  const [togglingId, setTogglingId]         = useState(null)
  const [error, setError]                   = useState('')
  const [editingId, setEditingId]           = useState(null)

  const userId = session.user.id
  const today  = new Date().toISOString().slice(0, 10)

  // ── Load habits + today's logs ──────────────────────────────────────────
  async function loadData() {
    setLoading(true)
    setError('')
    const [habitsResult, logsResult] = await Promise.all([
      supabase.from('habits').select('id, name, created_at')
        .eq('user_id', userId).order('created_at', { ascending: true }),
      supabase.from('daily_logs').select('habit_id')
        .eq('user_id', userId).eq('log_date', today).eq('completed', true),
    ])
    if (habitsResult.error) setError(habitsResult.error.message)
    else setHabits(habitsResult.data ?? [])
    if (logsResult.error) setError(prev => prev || logsResult.error.message)
    else setCompletedToday(new Set((logsResult.data ?? []).map(r => r.habit_id)))
    setLoading(false)
  }

  useEffect(() => { loadData() }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Flush offline queue when connectivity returns ────────────────────────
  useEffect(() => {
    async function flushQueue() {
      const q = readQueue()
      if (q.length === 0) return
      for (const item of q) {
        await supabase.from('habits').insert({ name: item.name, user_id: userId })
      }
      clearQueue()
      setQueued([])
      await loadData()
    }

    window.addEventListener('online', flushQueue)
    return () => window.removeEventListener('online', flushQueue)
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Add or rename a habit ───────────────────────────────────────────────
  async function saveHabit(event) {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) return

    // Offline: enqueue locally instead of calling Supabase
    if (!navigator.onLine) {
      enqueue(cleanName)
      setQueued(readQueue())
      setName('')
      return
    }

    setSaving(true)
    setError('')
    const result = editingId
      ? await supabase.from('habits').update({ name: cleanName })
          .eq('id', editingId).eq('user_id', userId)
      : await supabase.from('habits').insert({ name: cleanName, user_id: userId })
    if (result.error) setError(result.error.message)
    else { setName(''); setEditingId(null); await loadData() }
    setSaving(false)
  }

  // ── Delete a habit ──────────────────────────────────────────────────────
  async function deleteHabit(id, habitName) {
    if (!window.confirm(`Delete "${habitName}"? This removes all its logs too.`)) return
    setError('')
    const { error: deleteError } = await supabase.from('habits').delete()
      .eq('id', id).eq('user_id', userId)
    if (deleteError) setError(deleteError.message)
    else {
      setHabits(current => current.filter(h => h.id !== id))
      setCompletedToday(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  // ── Toggle completion ────────────────────────────────────────────────────
  async function toggleHabit(habit) {
    setError('')
    setTogglingId(habit.id)
    const alreadyDone = completedToday.has(habit.id)
    if (alreadyDone) {
      const { error: delError } = await supabase.from('daily_logs').delete()
        .eq('habit_id', habit.id).eq('user_id', userId).eq('log_date', today)
      if (delError) setError(delError.message)
      else setCompletedToday(prev => { const next = new Set(prev); next.delete(habit.id); return next })
    } else {
      const { error: upsertError } = await supabase.from('daily_logs')
        .upsert({ user_id: userId, habit_id: habit.id, log_date: today, completed: true },
          { onConflict: 'habit_id,log_date' })
      if (upsertError) setError(upsertError.message)
      else setCompletedToday(prev => new Set([...prev, habit.id]))
    }
    setTogglingId(null)
  }

  const doneCount = habits.filter(h => completedToday.has(h.id)).length

  return (
    <>
      {/* Progress pill */}
      {!loading && habits.length > 0 && (
        <p className="progress-hint">
          {doneCount === habits.length
            ? '🎉 All done for today — wonderful!'
            : `${doneCount} of ${habits.length} habit${habits.length === 1 ? '' : 's'} done today`}
        </p>
      )}

      <section className="habit-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">YOUR PRACTICE</p>
            <h2>My habits <span className="count">{habits.length + queued.length}</span></h2>
          </div>
          <span className="leaf">✿</span>
        </div>

        <form className="habit-form" onSubmit={saveHabit}>
          <input aria-label="Habit name" placeholder="e.g. Read for ten minutes"
            value={name} onChange={e => setName(e.target.value)} maxLength="100" required />
          <button className="primary" disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add a habit'}
          </button>
          {editingId && (
            <button type="button" className="quiet-button"
              onClick={() => { setEditingId(null); setName('') }}>Cancel</button>
          )}
        </form>

        {error && <p className="error" role="alert">{error}</p>}

        {loading ? (
          <p className="empty-state">Gathering your habits…</p>
        ) : habits.length === 0 && queued.length === 0 ? (
          <div className="empty-state">
            <span>☼</span>
            <h3>A fresh page.</h3>
            <p>Your habits will live here. Add your first small promise above.</p>
          </div>
        ) : (
          <ul className="habit-list">
            {/* Live habits from Supabase */}
            {habits.map(habit => {
              const done     = completedToday.has(habit.id)
              const toggling = togglingId === habit.id
              return (
                <li key={habit.id} className={done ? 'habit-done' : ''}>
                  <button
                    className={`check-button${done ? ' checked' : ''}`}
                    aria-label={done ? `Unmark ${habit.name}` : `Mark ${habit.name} complete today`}
                    onClick={() => toggleHabit(habit)} disabled={toggling}
                    title={done ? 'Click to unmark' : 'Click to mark done'}
                  >
                    {toggling ? '…' : '✓'}
                  </button>
                  <span className="habit-name">{habit.name}</span>
                  <button className="text-button"
                    onClick={() => { setEditingId(habit.id); setName(habit.name) }}>Edit</button>
                  <button className="text-button delete"
                    onClick={() => deleteHabit(habit.id, habit.name)}>Delete</button>
                </li>
              )
            })}

            {/* Offline-queued habits — waiting to sync */}
            {queued.map((item, i) => (
              <li key={`queued-${i}`} className="habit-queued">
                <span className="check-button" aria-hidden="true">⏳</span>
                <span className="habit-name">{item.name}</span>
                <span className="queued-badge">queued</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

// ---------------------------------------------------------------------------
// Tracker — composes sections with independent ErrorBoundaries
// ---------------------------------------------------------------------------
function Tracker({ session }) {
  const [signOutError, setSignOutError] = useState('')

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) setSignOutError(error.message)
  }

  return (
    <main className="tracker-shell">

      <ErrorBoundary label="Nav">
        <Topbar session={session} onSignOut={signOut} />
      </ErrorBoundary>

      {signOutError && <p className="error topbar-error" role="alert">{signOutError}</p>}

      <ErrorBoundary label="Stats">
        <section className="welcome">
          <p className="eyebrow">A LITTLE SPACE FOR YOU</p>
          <h1>Make today count.</h1>
          <p>Good things grow one small promise at a time.</p>
          <ShareButton />
        </section>
      </ErrorBoundary>

      <ErrorBoundary label="Habit List">
        <HabitPanel session={session} />
      </ErrorBoundary>

      <footer>Be patient with yourself. You're growing. <span>✿</span></footer>
    </main>
  )
}

// ---------------------------------------------------------------------------
// App root
// ---------------------------------------------------------------------------
export default function App() {
  const [session, setSession]     = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next); setAuthReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <OfflineBanner />
      <Routes>
        <Route path="/login"  element={session ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
        <Route path="/signup" element={session ? <Navigate to="/" replace /> : <AuthPage mode="signup" />} />
        <Route path="/"
          element={
            !authReady
              ? <div className="loading-screen">A moment for you…</div>
              : <ProtectedRoute session={session}><Tracker session={session} /></ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
