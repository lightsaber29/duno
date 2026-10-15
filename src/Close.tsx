import { useState } from 'react'
import { addTodo, closeWeek, saveWeek, type Todo, type Week } from './lib/db'
import { addDays, parseKey, rate, weekDays, weekRange } from './lib/week'
import { DayRing } from './Home'

type Props = { lw: string; week: Week | null; todos: Todo[]; thisGoal: string; onDone: () => void; onError: (e: unknown) => void }

/** 주간 마감 2단계: 지난주 돌아보기 → 이번 주 목표·가져올 일. 문구는 프로토타입(todo-planner_1.html) 그대로 */
export function Close({ lw, week, todos, thisGoal, onDone, onError }: Props) {
  const tw = addDays(lw, 7)
  const undone = todos.filter((t) => !t.done)
  const [step, setStep] = useState(1)
  const [good, setGood] = useState(week?.good ?? '')
  const [bad, setBad] = useState(week?.bad ?? '')
  const [goal, setGoal] = useState(thisGoal)
  const [pick, setPick] = useState(() => new Set(undone.map((t) => t.id))) // 처음엔 모두 체크
  const [busy, setBusy] = useState(false)
  const r = rate(todos)

  /** 건너뛰기는 마감 표시만(완료율은 todos에서 계산되니 따로 저장할 것이 없다) */
  async function finish(skip: boolean) {
    setBusy(true)
    try {
      if (!skip) {
        // 옮기지 않고 복사: 지난주 완료율이 바뀌지 않게. 순서 유지를 위해 하나씩
        // ponytail: 요청이 여러 번이라 한 묶음이 아니다. 복사 뒤 마감 표시 전에 끊기면 다음에 열 때 복사가 겹칠 수 있음. 문제 되면 DB 함수(rpc) 하나로
        for (const t of undone) if (pick.has(t.id)) await addTodo(tw, t.text)
        await saveWeek(tw, { goal: goal.trim() })
      }
      await closeWeek(lw, skip ? undefined : { good: good.trim(), bad: bad.trim() })
      onDone()
    } catch (e) {
      onError(e)
      setBusy(false)
    }
  }

  if (step === 1)
    return (
      <main className="flow">
        <div className="c-top">
          <span>{weekRange(lw)} 마감</span>
          <button type="button" disabled={busy} onClick={() => finish(true)}>건너뛰기</button>
        </div>
        <div className="c-goal">{week?.goal || '적어 둔 목표가 없어요'}</div>
        <div className="c-big">
          <b>{r.pct}%</b>
          <span>할 일 {r.total}개 중 {r.done}개 완료</span>
        </div>
        <div className="days">
          {weekDays(lw).map((k) => {
            const d = parseKey(k)
            const x = rate(todos.filter((t) => t.date === k))
            return (
              <div key={k} className="dbtn" role="img" aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일 ${x.done}/${x.total}`}>
                <DayRing k={k} pct={x.pct} />
              </div>
            )
          })}
        </div>
        <p className="c-note">못 끝낸 일 {undone.length}개는 다음 단계에서 가져올지 골라요.</p>
        <label className="c-f">
          <span>잘된 점 한 줄 <em>(선택)</em></span>
          <input type="text" maxLength={40} value={good} placeholder="월·화는 계획대로 끝냈다" onChange={(e) => setGood(e.target.value)} />
        </label>
        <label className="c-f">
          <span>아쉬운 점 한 줄 <em>(선택)</em></span>
          <input type="text" maxLength={40} value={bad} placeholder="주말엔 손을 못 놨다" onChange={(e) => setBad(e.target.value)} />
        </label>
        <button type="button" className="c-main" onClick={() => setStep(2)}>다음</button>
      </main>
    )

  return (
    <main className="flow">
      <div className="c-top">
        <button type="button" onClick={() => setStep(1)}>‹ 이전</button>
        <span>{weekRange(tw)} 시작</span>
      </div>
      {bad.trim() && <div className="c-prev">지난주 아쉬운 점: {bad.trim()}</div>}
      <label className="c-f">
        <span>이번 주 목표 한 줄</span>
        <input type="text" className="c-goalin" maxLength={40} value={goal} placeholder="상세 화면 2장 완성하기" onChange={(e) => setGoal(e.target.value)} />
      </label>
      <div className="c-sub">지난주 못 끝낸 일</div>
      {undone.length ? (
        undone.map((t) => (
          <label key={t.id} className="c-chk">
            <input
              type="checkbox"
              checked={pick.has(t.id)}
              onChange={(e) =>
                setPick((p) => {
                  const n = new Set(p)
                  if (e.target.checked) n.add(t.id)
                  else n.delete(t.id)
                  return n
                })
              }
            />
            {t.text}
          </label>
        ))
      ) : (
        <p className="c-note">지난주 할 일을 모두 끝냈어요.</p>
      )}
      <p className="c-note">체크한 일만 이번 주 월요일 목록으로 가져와요. 지난주 기록은 그대로 남아요.</p>
      <button type="button" className="c-main primary" disabled={busy} onClick={() => finish(false)}>이번 주 시작</button>
    </main>
  )
}
