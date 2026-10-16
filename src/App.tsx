import { useCallback, useEffect, useState } from 'react'
import { useSession } from './auth/useSession'
import { Login } from './auth/Login'
import { supabase } from './lib/supabase'
import { loadNotes, loadSetup, loadTargets, loadTodos, loadWeek, loadWeekRatios, type Setup, type Todo, type Week } from './lib/db'
import type { WeekRatio } from './lib/pyramid'
import { addDays, shouldClose, today, weekStart } from './lib/week'
import { Home } from './Home'
import { Close } from './Close'
import { Onboard } from './Onboard'

type CloseData = {
  lw: string
  week: Week | null
  todos: Todo[]
  notes: Record<string, string>
  thisGoal: string
  ratios: WeekRatio[]
  targets: { week_start: string; target_minutes: number | null }[]
}

export default function App() {
  const session = useSession()
  const [error, setError] = useState('')
  const onError = useCallback((e: unknown) => setError(String((e as Error).message ?? e)), [])

  if (session === undefined) return <Loading />
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

/** 세션·첫 데이터를 기다리는 동안. 흰 화면이면 앱이 죽은 줄 안다(피드백 F3). 로그인 화면과 같은 틀 */
function Loading() {
  return (
    <main className="login" aria-busy="true">
      <span className="logo pulse">DUNO</span>
      <p>불러오는 중…</p>
    </main>
  )
}

/** 로그인 뒤: 진입(핵심목표 없음) → 주간 마감(지난주 안 끝냄) → 메인 */
function Signed({ onError }: { onError: (e: unknown) => void }) {
  // undefined = 확인 중, null = 진입 필요 / 띄우지 않음
  const [setup, setSetup] = useState<Setup | null>()
  const [close, setClose] = useState<CloseData | null>()
  const [closed, setClosed] = useState(false) // 마감을 막 끝냈으면 이번 주 월요일(복사한 일)을 고른 채 메인

  useEffect(() => {
    // 실패하면 undefined로 둔다: 진입 화면으로 보내면 이미 있는 핵심목표를 또 만들려 한다
    loadSetup().then(setSetup).catch(onError)
    const lw = addDays(weekStart(today()), -7)
    Promise.all([loadWeek(lw), loadTodos(lw, addDays(lw, 6)), loadWeek(addDays(lw, 7)), loadNotes(lw, addDays(lw, 6)), loadWeekRatios(), loadTargets()])
      .then(([week, todos, tw, notes, ratios, targets]) =>
        setClose(shouldClose(week, todos.length) ? { lw, week, todos, notes, thisGoal: tw?.goal ?? '', ratios, targets } : null),
      )
      .catch((e) => {
        onError(e)
        setClose(null)
      })
  }, [onError])

  if (setup === undefined || close === undefined) return <Loading />
  if (!setup) return <Onboard onDone={setSetup} onError={onError} />
  if (close)
    return (
      <Close
        {...close}
        setup={setup}
        onError={onError}
        onDone={(s, skipped) => {
          setSetup(s)
          setClose(null)
          setClosed(!skipped) // 건너뛰면 복사한 일이 없으니 평소처럼 오늘
        }}
      />
    )
  // 실패(네트워크 등)하면 버튼이 안 먹는 것처럼 보이지 않게 오류를 띄운다
  const signOut = () => supabase.auth.signOut().then(({ error }) => error && onError(error))
  return <Home setup={setup} startMonday={closed} onError={onError} onSignOut={signOut} />
}
