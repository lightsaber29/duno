import { useCallback, useEffect, useState } from 'react'
import { useSession } from './auth/useSession'
import { Login } from './auth/Login'
import { supabase } from './lib/supabase'
import { loadSetup, loadTodos, loadWeek, type Setup, type Todo, type Week } from './lib/db'
import { addDays, shouldClose, today, weekStart } from './lib/week'
import { Home } from './Home'
import { Close } from './Close'
import { Onboard } from './Onboard'

type CloseData = { lw: string; week: Week | null; todos: Todo[]; thisGoal: string }

export default function App() {
  const session = useSession()
  const [error, setError] = useState('')
  const onError = useCallback((e: unknown) => setError(String((e as Error).message ?? e)), [])

  if (session === undefined) return null
  return (
    <>
      {/* key: 다른 계정으로 바꿔 들어오면 앞 사람 상태를 버리고 새로 */}
      {session ? <Signed key={session.user.id} onError={onError} /> : <Login />}
      {error && (
        <p role="alert" className="error" onClick={() => setError('')}>{error}</p>
      )}
    </>
  )
}

/** 로그인 뒤: 진입(핵심목표 없음) → 주간 마감(지난주 안 끝냄) → 메인 */
function Signed({ onError }: { onError: (e: unknown) => void }) {
  // undefined = 확인 중, null = 진입 필요 / 띄우지 않음
  const [setup, setSetup] = useState<Setup | null>()
  const [close, setClose] = useState<CloseData | null>()

  useEffect(() => {
    // 실패하면 undefined로 둔다: 진입 화면으로 보내면 이미 있는 핵심목표를 또 만들려 한다
    loadSetup().then(setSetup).catch(onError)
    const lw = addDays(weekStart(today()), -7)
    Promise.all([loadWeek(lw), loadTodos(lw, addDays(lw, 6)), loadWeek(addDays(lw, 7))])
      .then(([week, todos, tw]) => setClose(shouldClose(week, todos.length) ? { lw, week, todos, thisGoal: tw?.goal ?? '' } : null))
      .catch((e) => {
        onError(e)
        setClose(null)
      })
  }, [onError])

  if (setup === undefined || close === undefined) return null
  if (!setup) return <Onboard onDone={setSetup} onError={onError} />
  if (close) return <Close {...close} onDone={() => setClose(null)} onError={onError} />
  return <Home setup={setup} onError={onError} onSignOut={() => supabase.auth.signOut()} />
}
