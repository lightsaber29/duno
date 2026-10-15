import { useCallback, useState } from 'react'
import { useSession } from './auth/useSession'
import { Login } from './auth/Login'
import { supabase } from './lib/supabase'
import { Home } from './Home'

export default function App() {
  const session = useSession()
  const [error, setError] = useState('')
  const onError = useCallback((e: unknown) => setError(String((e as Error).message ?? e)), [])

  if (session === undefined) return null
  if (!session) return <Login />
  return (
    <>
      <Home onError={onError} onSignOut={() => supabase.auth.signOut()} />
      {error && (
        <p role="alert" className="error" onClick={() => setError('')}>{error}</p>
      )}
    </>
  )
}
