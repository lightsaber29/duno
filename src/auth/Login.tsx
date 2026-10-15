import { useState } from 'react'
import { supabase } from '../lib/supabase'

/** Google 로그인. 문구는 phase2 원페이저(킥보드 phase2.md) "무엇을 왜 만드나" 첫 문장에서. 설정은 README 참고. */
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
    <main className="login">
      <span className="logo">DUNO</span>
      <h1>핵심목표를 위해 시간을 어디에 쓰는지 봐</h1>
      <p>저녁마다 쓴 시간을 적으면 어느 쪽으로 쏠렸는지 보여 줄게</p>
      <button type="button" className="primary" onClick={go}>
        Google로 로그인
      </button>
      {error && <p role="alert" className="error">{error}</p>}
    </main>
  )
}
