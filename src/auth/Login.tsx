import { useState } from 'react'
import { supabase } from '../lib/supabase'

/** Google 로그인. 문구는 원페이저 한 줄 요약. 설정은 README 참고. */
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
      <h1>날짜별로 할 일을 기록해요</h1>
      <p>핸드폰 한 화면에서 그 주와 그날을 함께 봐요</p>
      <button type="button" className="primary" onClick={go}>
        Google로 로그인
      </button>
      {error && <p role="alert" className="error">{error}</p>}
    </main>
  )
}
