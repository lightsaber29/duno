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
    <main className="screen" style={{ minHeight: '100vh', justifyContent: 'center' }}>
      <span className="logo">DUNO</span>
      <h1>미루던 일? Do it Now!</h1>
      <p className="hint">내 시간이 어디에 쏠렸는지 같이 봐 줄게.</p>
      <footer className="row">
        <button type="button" className="primary" onClick={go}>
          Google로 로그인
        </button>
      </footer>
      {error && <p role="alert" className="error">{error}</p>}
    </main>
  )
}
