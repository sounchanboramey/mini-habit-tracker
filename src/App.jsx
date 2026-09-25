import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { supabase, supabaseConfigured } from './lib/supabase'
import './App.css'

function ProtectedRoute({ session, children }) {
  return session ? children : <Navigate to="/login" replace />
}

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

  return <main className="auth-shell">
    <Link className="brand" to="/">little by little<span>✳</span></Link>
    <section className="auth-card"><p className="eyebrow">YOUR GENTLE RESET</p><h1>{signup ? 'Make room for good habits.' : 'Welcome back.'}</h1>
      <p className="subtle">Small steps, repeated, become something wonderful.</p>
      {!supabaseConfigured && <p className="notice">Add your Supabase URL and anon key to the local <code>.env</code> file to connect.</p>}
      <form onSubmit={submit}>
        <label>Email address<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength="6" required value={password} onChange={e => setPassword(e.target.value)} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy || !supabaseConfigured}>{busy ? 'One moment…' : signup ? 'Create my account' : 'Sign in'}</button>
      </form>
      <p className="switch-auth">{signup ? 'Already have an account?' : 'New around here?'} <Link to={signup ? '/login' : '/signup'}>{signup ? 'Sign in' : 'Create an account'}</Link></p>
    </section>
  </main>
}

function Tracker({ session }) {
  const [habits, setHabits] = useState([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const userId = session.user.id

  async function loadHabits() {
    setLoading(true)
    setError('')
    const { data, error: queryError } = await supabase.from('habits').select('id, name, created_at').eq('user_id', userId).order('created_at', { ascending: true })
    if (queryError) setError(queryError.message)
    else setHabits(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadHabits() }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveHabit(event) {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) return
    setSaving(true)
    setError('')
    const result = editingId
      ? await supabase.from('habits').update({ name: cleanName }).eq('id', editingId).eq('user_id', userId)
      : await supabase.from('habits').insert({ name: cleanName, user_id: userId })
    if (result.error) setError(result.error.message)
    else { setName(''); setEditingId(null); await loadHabits() }
    setSaving(false)
  }

  async function deleteHabit(id) {
    setError('')
    const { error: deleteError } = await supabase.from('habits').delete().eq('id', id).eq('user_id', userId)
    if (deleteError) setError(deleteError.message)
    else setHabits(current => current.filter(habit => habit.id !== id))
  }

  async function toggleHabit(habit) {
    setError('')
    const { error: updateError } = await supabase.from('daily_logs').upsert({ user_id: userId, habit_id: habit.id, log_date: new Date().toISOString().slice(0, 10), completed: true }, { onConflict: 'habit_id,log_date' })
    if (updateError) setError(updateError.message)
  }

  async function signOut() {
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) setError(signOutError.message)
  }

  return <main className="tracker-shell">
    <header className="topbar"><Link className="brand" to="/">little by little<span>✳</span></Link><div className="user-menu"><span>{session.user.email}</span><button className="quiet-button" onClick={signOut}>Sign out</button></div></header>
    <section className="welcome"><p className="eyebrow">A LITTLE SPACE FOR YOU</p><h1>Make today count.</h1><p>Good things grow one small promise at a time.</p></section>
    <section className="habit-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR PRACTICE</p><h2>My habits <span className="count">{habits.length}</span></h2></div><span className="leaf">✿</span></div>
      <form className="habit-form" onSubmit={saveHabit}><input aria-label="Habit name" placeholder="e.g. Read for ten minutes" value={name} onChange={e => setName(e.target.value)} maxLength="100" required /><button className="primary" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add a habit'}</button>{editingId && <button type="button" className="quiet-button" onClick={() => {setEditingId(null); setName('')}}>Cancel</button>}</form>
      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p className="empty-state">Gathering your habits…</p> : habits.length === 0 ? <div className="empty-state"><span>☼</span><h3>A fresh page.</h3><p>Your habits will live here. Add your first small promise above.</p></div> : <ul className="habit-list">{habits.map(habit => <li key={habit.id}><button className="check-button" aria-label={`Mark ${habit.name} complete today`} onClick={() => toggleHabit(habit)}>✓</button><span className="habit-name">{habit.name}</span><button className="text-button" onClick={() => {setEditingId(habit.id); setName(habit.name)}}>Edit</button><button className="text-button delete" onClick={() => deleteHabit(habit.id)}>Delete</button></li>)}</ul>}
    </section>
    <footer>Be patient with yourself. You’re growing. <span>✿</span></footer>
  </main>
}

export default function App() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  useEffect(() => {
    if (!supabase) { setAuthReady(true); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setAuthReady(true) })
    return () => subscription.unsubscribe()
  }, [])
  return <BrowserRouter><Routes>
    <Route path="/login" element={session ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
    <Route path="/signup" element={session ? <Navigate to="/" replace /> : <AuthPage mode="signup" />} />
    <Route path="/" element={!authReady ? <div className="loading-screen">A moment for you…</div> : <ProtectedRoute session={session}><Tracker session={session} /></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BrowserRouter>
}
