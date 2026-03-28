import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'

export default function RequireAuth({ children }) {
  const [checked, setChecked] = useState(false)
  const [session, setSession] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setChecked(true)
      if (!session) navigate('/auth')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (!session) navigate('/auth')   // ✅ only redirect if logged out
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!checked) return (
    <div style={{
      minHeight: '100vh', background: '#0e0e0e',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#6b6866', fontFamily: 'DM Mono, monospace', fontSize: '0.8rem'
    }}>
      loading...
    </div>
  )

  return session ? children : null
}