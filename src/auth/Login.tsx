import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
      setState('error')
    } else {
      setState('sent')
    }
  }

  if (state === 'sent')
    return (
      <main className="screen">
        <h1>메일을 보냈어요</h1>
        <p>{email}로 간 링크를 누르면 로그인됩니다.</p>
      </main>
    )

  return (
    <main className="screen">
      <h1>Duno</h1>
      <p>미루던 일? Do it Now!</p>
      <form onSubmit={submit}>
        <label>
          이메일
          <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? '보내는 중…' : '로그인 링크 받기'}
        </button>
        {state === 'error' && <p role="alert">{error}</p>}
      </form>
    </main>
  )
}
