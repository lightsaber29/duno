import { useCallback, useEffect, useState } from 'react'
import { useSession } from './auth/useSession'
import { Login } from './auth/Login'
import { supabase } from './lib/supabase'
import { loadTodos, loadWeek, type Todo, type Week } from './lib/db'
import { addDays, shouldClose, today, weekStart } from './lib/week'
import { Home } from './Home'
import { Close } from './Close'

type CloseData = { lw: string; week: Week | null; todos: Todo[]; thisGoal: string }

export default function App() {
  const session = useSession()
  const uid = session?.user.id
  // undefined = 확인 중, null = 띄우지 않음
  const [close, setClose] = useState<CloseData | null>()
  const [error, setError] = useState('')
  const onError = useCallback((e: unknown) => setError(String((e as Error).message ?? e)), [])

  // 앱을 열 때 바로 지난주 마감 흐름을 띄울지 본다
  useEffect(() => {
    if (!uid) return
    const lw = addDays(weekStart(today()), -7)
    Promise.all([loadWeek(lw), loadTodos(lw, addDays(lw, 6)), loadWeek(addDays(lw, 7))])
      .then(([week, todos, tw]) => setClose(shouldClose(week, todos.length) ? { lw, week, todos, thisGoal: tw?.goal ?? '' } : null))
      .catch((e) => {
        onError(e)
        setClose(null)
      })
  }, [uid, onError])

  if (session === undefined || (session && close === undefined)) return null
  if (!session) return <Login />
  return (
    <>
      {close ? (
        <Close {...close} onDone={() => setClose(null)} onError={onError} />
      ) : (
        <Home onError={onError} onSignOut={() => supabase.auth.signOut()} />
      )}
      {error && (
        <p role="alert" className="error" onClick={() => setError('')}>{error}</p>
      )}
    </>
  )
}
