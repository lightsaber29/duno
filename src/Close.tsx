import { useState } from 'react'
import { addCategory, addTodo, closeWeek, moveTodos, saveWeek, setRatios, type Setup, type Todo, type Week } from './lib/db'
import { fmtMinutes, planText, proposal, withNewCategory } from './lib/pyramid'
import { addDays, parseKey, weekDays, weekRange } from './lib/week'
import { Verdict } from './Pyramid'

type Props = {
  setup: Setup
  lw: string // 지난주 월요일
  week: Week | null
  todos: Todo[] // 지난주까지 4주 (제안 계산용)
  notes: Record<string, string> // 지난주 회고 한 줄
  thisGoal: string
  onDone: (s: Setup, skipped: boolean) => void // 비율·카테고리가 바뀌었을 수 있다
  onError: (e: unknown) => void
}

const WD = ['일', '월', '화', '수', '목', '금', '토']
const dl = (k: string) => {
  const d = parseKey(k)
  return `${d.getMonth() + 1}/${d.getDate()} (${WD[d.getDay()]})`
}

/** 주간 마감 3단계: 돌아보기 → 시간 정리(비율 조정안·시간 옮기기안, 기타로 새 카테고리) → 이번 주 목표·가져올 일. 문구는 프로토타입(킥보드 phase2.html) */
export function Close({ setup, lw, week, todos, notes, thisGoal, onDone, onError }: Props) {
  const { cats } = setup
  const tw = addDays(lw, 7)
  const undone = todos.filter((t) => t.date >= lw && !t.done)
  const p = proposal(cats, todos)
  const [step, setStep] = useState(1)
  const [good, setGood] = useState(week?.good ?? '')
  const [bad, setBad] = useState(week?.bad ?? '')
  const [choice, setChoice] = useState<'ratio' | 'time' | 'keep' | null>(null)
  const [acc, setAcc] = useState<boolean | null>(null) // 새 카테고리 승인
  const [newName, setNewName] = useState('')
  const [move, setMove] = useState(new Set<string>()) // 새 카테고리로 옮길 기타 할 일
  const [goal, setGoal] = useState(thisGoal)
  const [pick, setPick] = useState(() => new Set(undone.map((t) => t.id))) // 가져올 일, 처음엔 모두 체크
  const [busy, setBusy] = useState(false)
  const toggle = (set: Set<string>, id: string, on: boolean) => {
    const n = new Set(set)
    if (on) n.add(id)
    else n.delete(id)
    return n
  }

  /** 건너뛰기는 마감 표시만. 그 밖에는 비율·새 카테고리·시간 계획·목표·복사를 저장하고 마지막에 마감 표시 */
  async function finish(skip: boolean) {
    setBusy(true)
    try {
      let next = cats
      if (!skip) {
        // ponytail: 요청이 여러 번이라 한 묶음이 아니다. 마감 표시 전에 끊기면 다음에 열 때 다시 뜨고, 새 카테고리·복사가 겹칠 수 있음. 문제 되면 DB 함수(rpc) 하나로
        let ratios = choice === 'ratio' ? p.ratioPlan : cats.map((c) => c.ratio)
        let added: Setup['cats'][number] | null = null
        if (acc && p.otherTodos) {
          ratios = withNewCategory(ratios) // 새 카테고리 10%, 가장 큰 카테고리에서
          added = await addCategory(newName.trim() || '새 카테고리', 10, cats.length)
          if (move.size) await moveTodos([...move], added.id)
        }
        const changed = cats.map((c, i) => ({ id: c.id, ratio: ratios[i] })).filter((r, i) => r.ratio !== cats[i].ratio)
        if (changed.length) await setRatios(changed)
        next = [...cats.map((c, i) => ({ ...c, ratio: ratios[i] })), ...(added ? [added] : [])]
        const time_plan = choice === 'time' ? p.timePlan.map(planText).join(', ') : undefined
        await saveWeek(tw, { goal: goal.trim(), ...(time_plan && { time_plan }) })
        // 옮기지 않고 복사: 지난주 기록이 바뀌지 않게. 카테고리는 그대로(새 카테고리로 옮긴 일이면 새 것으로). 순서 유지를 위해 하나씩
        for (const t of undone) if (pick.has(t.id)) await addTodo(tw, t.text, added && move.has(t.id) ? added.id : t.category_id)
      }
      await closeWeek(lw, skip ? undefined : { good: good.trim(), bad: bad.trim() })
      onDone({ ...setup, cats: next }, skip)
    } catch (e) {
      onError(e)
      setBusy(false)
    }
  }

  if (step === 1) {
    const days = weekDays(lw).filter((k) => notes[k])
    return (
      <main className="flow">
        <div className="c-top">
          <span>주간 마감 1 / 3 · {weekRange(lw)}</span>
          <button type="button" disabled={busy} onClick={() => finish(true)}>건너뛰기</button>
        </div>
        <h1 className="f-h">{week?.goal || '지난주 목표 없음'}</h1>
        <div className="c-sub">지난주 회고 한 줄</div>
        <div className="refl">
          {days.length ? (
            days.map((k) => (
              <span key={k}>
                <b>{dl(k)}</b> {notes[k]}
              </span>
            ))
          ) : (
            <span>적은 회고가 없어요.</span>
          )}
        </div>
        <label className="c-f">
          <span>잘된 점 한 줄 <em>(선택)</em></span>
          <input type="text" maxLength={40} value={good} placeholder="초안을 드디어 썼다" onChange={(e) => setGood(e.target.value)} />
        </label>
        <label className="c-f">
          <span>아쉬운 점 한 줄 <em>(선택)</em></span>
          <input type="text" maxLength={40} value={bad} placeholder="조사에만 시간을 썼다" onChange={(e) => setBad(e.target.value)} />
        </label>
        <button type="button" className="c-main" onClick={() => setStep(2)}>다음</button>
      </main>
    )
  }

  if (step === 2)
    return (
      <main className="flow">
        <div className="c-top">
          <button type="button" onClick={() => setStep(1)}>‹ 이전</button>
          <span>주간 마감 2 / 3</span>
        </div>
        <h1 className="f-h">시간을 어떻게 쓸지 정리해요</h1>
        <p className="c-note">
          최근 4주 기록한 시간 기준이에요. <Verdict rows={p.rows} total={p.rows.reduce((a, r) => a + r.minutes, 0)} />
        </p>
        {p.biased ? (
          <>
            <button type="button" className="opt" aria-pressed={choice === 'ratio'} onClick={() => setChoice('ratio')}>
              <b>A. 비율을 실제에 맞춰 조정</b>
              {cats.map((c, i) => (
                <span key={c.id} className="wrow">
                  <span>{c.name}</span>
                  <span>
                    {c.ratio}% → <em>{p.ratioPlan[i]}%</em>
                  </span>
                </span>
              ))}
              <span className="c-note">정한 비율과 실제의 중간값이에요.</span>
            </button>
            {p.timePlan.length > 0 && (
              <button type="button" className="opt" aria-pressed={choice === 'time'} onClick={() => setChoice('time')}>
                <b>B. 비율은 두고 시간을 옮기기</b>
                {p.timePlan.map((x) => (
                  <span key={x.name}>{planText(x)}</span>
                ))}
                <span className="c-note">이번 주 목표 아래에 시간 계획으로 보여요.</span>
              </button>
            )}
            <button type="button" className="opt" aria-pressed={choice === 'keep'} onClick={() => setChoice('keep')}>
              <b>그대로 두기</b>
            </button>
          </>
        ) : (
          <p className="c-note">치우친 카테고리가 없어서 비율은 그대로 둘게요.</p>
        )}
        {p.otherTodos && (
          <div className="sug">
            <b>기타에서 새 카테고리 만들기</b>
            <span>기타에 쓴 시간 {fmtMinutes(p.rows[p.rows.length - 1].minutes)}. 새 카테고리로 옮길 일을 직접 골라 주세요.</span>
            {p.otherTodos.map((t) => (
              <label key={t.id} className="c-chk">
                <input type="checkbox" checked={move.has(t.id)} onChange={(e) => setMove((s) => toggle(s, t.id, e.target.checked))} />
                {t.text} · {fmtMinutes(t.minutes)}
              </label>
            ))}
            <input type="text" maxLength={8} value={newName} placeholder="새 카테고리 이름" aria-label="새 카테고리 이름" onChange={(e) => setNewName(e.target.value)} />
            <span className="c-note">새 카테고리는 10%로 시작하고, 가장 큰 카테고리에서 10%를 가져와요.</span>
            <div className="acts">
              <button type="button" aria-pressed={acc === true} onClick={() => setAcc(true)}>승인</button>
              <button type="button" className="no" aria-pressed={acc === false} onClick={() => setAcc(false)}>그대로 두기</button>
            </div>
          </div>
        )}
        <button type="button" className="c-main" onClick={() => setStep(3)}>다음</button>
      </main>
    )

  return (
    <main className="flow">
      <div className="c-top">
        <button type="button" onClick={() => setStep(2)}>‹ 이전</button>
        <span>주간 마감 3 / 3 · {weekRange(tw).split(' – ')[0]} 시작</span>
      </div>
      {bad.trim() && <div className="c-prev">지난주 아쉬운 점: {bad.trim()}</div>}
      <label className="c-f">
        <span className="f-h">이번 주 목표 한 줄</span>
        <input type="text" className="f-big" maxLength={40} value={goal} placeholder="와이어프레임 3장 완성하기" onChange={(e) => setGoal(e.target.value)} />
      </label>
      {choice === 'time' && p.timePlan.length > 0 && <div className="rv-sum">시간 계획: {p.timePlan.map(planText).join(', ')}</div>}
      <div className="c-sub">지난주 못 끝낸 일</div>
      {undone.length ? (
        undone.map((t) => (
          <label key={t.id} className="c-chk">
            <input type="checkbox" checked={pick.has(t.id)} onChange={(e) => setPick((s) => toggle(s, t.id, e.target.checked))} />
            {t.text}
          </label>
        ))
      ) : (
        <p className="c-note">모두 끝냈어요.</p>
      )}
      <p className="c-note">체크한 일만 이번 주 월요일 목록에 추가해요. 지난주 기록은 그대로예요.</p>
      <button type="button" className="c-main primary" disabled={busy} onClick={() => finish(false)}>이번 주 시작</button>
    </main>
  )
}
