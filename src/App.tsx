import { useCallback, useEffect, useState } from 'react'
import { useSession } from './auth/useSession'
import { Login } from './auth/Login'
import { supabase } from './lib/supabase'
import { archivePlan, createPlan, deleteAllEntries, deleteEntry, loadPlan, logStatusView, saveEntry, seedEntries, updatePlan, type PlanData, type PlanInput, type Share } from './lib/db'
import { Setup } from './screens/Setup'
import { Write } from './screens/Write'
import { Status } from './screens/Status'
import { Plan } from './screens/Plan'

type Screen = 'status' | 'write' | 'plan' | 'edit'

export default function App() {
  const session = useSession()
  const [data, setData] = useState<PlanData | null | undefined>(undefined)
  const [screen, setScreen] = useState<Screen>('status')
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  const reload = useCallback(() => loadPlan().then(setData).catch((e) => setError(String(e.message ?? e))), [])
  useEffect(() => {
    if (session) reload()
  }, [session, reload])

  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 1500)
  }
  async function run(work: Promise<void>, after?: () => void) {
    try {
      await work
      await reload()
      after?.()
    } catch (e) {
      setError(String((e as Error).message ?? e))
    }
  }

  const onView = useCallback(() => {
    if (session) logStatusView(session.user.id)
  }, [session])

  if (session === undefined || (session && data === undefined)) return null
  if (!session) return <Login />

  // ponytail: 라우터 없이 state 하나. 화면 4개뿐이라 충분.
  let body
  if (!data) {
    body = <Setup onDone={(input) => run(createPlan(session.user.id, input), () => setScreen('status'))} />
  } else if (screen === 'edit') {
    const d = data
    const initial: PlanInput = {
      goal: d.plan.goal,
      items: d.subgoals.filter((s) => !s.removed_at).map((s) => ({ id: s.id, name: s.name })),
      ratios: d.subgoals.filter((s) => !s.removed_at).map((s) => s.ratio),
      notifyAt: d.plan.notify_at,
    }
    body = (
      <Setup
        initial={initial}
        onCancel={() => setScreen('plan')}
        onDone={(input) => {
          if (input.goal !== d.plan.goal) {
            if (!window.confirm('핵심 목표가 바뀌었어. 지난 계획과 기록은 보관하고 새로 시작할까?')) return
            run(archivePlan(d.plan.id).then(() => createPlan(session.user.id, { ...input, items: input.items.map((it) => ({ name: it.name })) })), () => setScreen('status'))
          } else {
            run(updatePlan(d, input), () => setScreen('status'))
          }
        }}
      />
    )
  } else if (screen === 'write') {
    body = (
      <Write
        data={data}
        onClose={() => setScreen('status')}
        onDelete={(date) => {
          if (!window.confirm(`${date} 기록을 지울까?`)) return
          run(deleteEntry(data.plan.id, date), () => {
            show('지웠어')
            setScreen('status')
          })
        }}
        onSave={(date, minutes, shares: Share[]) =>
          run(saveEntry(data.plan.id, date, minutes, shares), () => {
            show(minutes === null ? '휴식으로 기록했어' : '기록했어')
            setScreen('status')
          })
        }
      />
    )
  } else if (screen === 'plan') {
    const d = data
    body = (
      <Plan
        data={d}
        onEdit={() => setScreen('edit')}
        onSeed={() => run(seedEntries(d.plan.id, d.subgoals.filter((s) => !s.removed_at).map((s) => s.id)), () => show('예시 데이터를 넣었어'))}
        onClearAll={() => {
          if (!window.confirm('이 계획의 기록을 전부 지울까? 되돌릴 수 없어.')) return
          run(deleteAllEntries(d.plan.id), () => show('기록을 전부 지웠어'))
        }}
      />
    )
  } else {
    body = <Status data={data} onWrite={() => setScreen('write')} onView={onView} />
  }

  const tabs = data && (screen === 'status' || screen === 'plan')
  return (
    <>
      <header className="topbar">
        <span className="logo">DUNO</span>
        <small>{session.user.email}</small>
        <button type="button" className="link" onClick={() => supabase.auth.signOut()}>로그아웃</button>
      </header>
      {body}
      {error && (
        <p role="alert" className="error" onClick={() => setError('')}>{error}</p>
      )}
      {toast && <div className="toast">{toast}</div>}
      {tabs && (
        <nav className="tabs">
          <button type="button" className={screen === 'status' ? 'on' : ''} onClick={() => setScreen('status')}>현재 상태</button>
          <button type="button" className={screen === 'plan' ? 'on' : ''} onClick={() => setScreen('plan')}>계획</button>
        </nav>
      )}
    </>
  )
}
