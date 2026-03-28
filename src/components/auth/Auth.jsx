import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import './Auth.css'

export default function AuthPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [isLogin,  setIsLogin]  = useState(true)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [message,  setMessage]  = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (isLogin) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      console.log('signin data:', data)
      console.log('signin error:', error)
      if (error) setError(error.message)
      else navigate('/')   // ✅ redirect after successful login
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      console.log('signup data:', data)
      console.log('signup error:', error)
      if (error) setError(error.message)
      else setMessage('Check your email for a confirmation link!')
    }

    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">⇄ split<em>&</em>settle</div>
        <p className="auth-sub">split bills. settle up. stress less.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label">email</label>
            <input
              className="auth-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">password</label>
            <input
              className="auth-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error   && <div className="auth-error">⚠ {error}</div>}
          {message && <div className="auth-message">✓ {message}</div>}

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'please wait...' : isLogin ? 'sign in' : 'create account'}
          </button>
        </form>

        <div className="auth-switch">
          {isLogin ? "don't have an account?" : 'already have an account?'}
          <button
            className="auth-switch-btn"
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); setMessage(''); }}>
            {isLogin ? 'sign up' : 'sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}