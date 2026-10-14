import { useState } from 'react'
import { supabase } from '../lib/supabase'

/** Google 로그인. 메일을 보내지 않는다. 설정은 README 참고. */
export function Login() {
  const [error, setError] = useState('')

  async function go() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setError(error.message)
  }

  return (
    <main className="screen">
      <h1>Duno</h1>
      <p>미루던 일? Do it Now!</p>
      <button type="button" className="primary" onClick={go}>
        Google로 로그인
      </button>
      {error && <p role="alert" className="error">{error}</p>}
    </main>
  )
}
