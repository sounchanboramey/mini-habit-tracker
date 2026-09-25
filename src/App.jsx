import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { supabase, supabaseConfigured } from './lib/supabase'
import OfflineBanner from './components/OfflineBanner'
import './App.css'

// ---------------------------------------------------------------------------
// React.lazy — code-split the heavy Tracker route
//
// Hand-written decision: The TrackerPage is the heaviest module in the app.
// It contains all CRUD logic, AvatarUpload (Supabase Storage), ErrorBoundary,
// OfflineBanner queue helpers, and the full habit list UI — none of which is
// needed on the /login or /signup routes. Lazy-splitting it means unauthenticated
// visitors download only the auth forms (~small chunk) and the tracker JS is
// fetched only after a successful sign-in.
// ---------------------------------------------------------------------------
const TrackerPage = lazy(() => import('./components/TrackerPage'))

// ---------------------------------------------------------------------------
// Route guard
// ---------------------------------------------------------------------------
function ProtectedRoute({ session, children }) {
  return session ? children : <Navigate to="/login" replace />
}

// ---------------------------------------------------------------------------
// Auth page — stays in the initial bundle (always needed on first load)
// ---------------------------------------------------------------------------
function AuthPage({ mode }) {
  const navigate = useNavigate()
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')
  const signup = mode === 'signup'

  async function submit(event) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setError('')
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
          <Link to={signup ? '/login' : '/signup'}>{signup ? 'Sign in' : 'Create an account'}</Link>
        </p>
      </section>
    </main>
  )
}

// ---------------------------------------------------------------------------
// App root — session bootstrap + routing
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
        <Route
          path="/"
          element={
            !authReady
              ? <div className="loading-screen">A moment for you…</div>
              : (
                <ProtectedRoute session={session}>
                  {/* Suspense fallback shown while the TrackerPage chunk downloads */}
                  <Suspense fallback={<div className="loading-screen">Getting everything ready…</div>}>
                    <TrackerPage session={session} />
                  </Suspense>
                </ProtectedRoute>
              )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
