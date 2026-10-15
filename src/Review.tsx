import { useEffect, useRef, useState } from 'react'
import { addTodo, loadNotes, loadTodos, saveNote, updateTodo, type Category, type Todo } from './lib/db'
import { catName, catStyle, nextCat } from './lib/cats'
import { fmtMinutes, timeStats } from './lib/pyramid'
import { addDays, parseKey, today } from './lib/week'

type Props = { cats: Category[]; named: Category[]; onClose: (date: string) => void; onError: (e: unknown) => void } // named: 지운 카테고리 포함, 라벨 이름용

const WORD = ['그제', '어제', '오늘']
const clamp = (v: string | number, max: number) => Math.max(0, Math.min(max, Math.floor(+v || 0)))
const md = (k: string) => {
  const d = parseKey(k)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/**
 * 저녁 회고: 오늘·어제·그제 할 일마다 쓴 시간, 목록에 없던 일, 회고 한 줄. 문구는 프로토타입(킥보드 phase2.html).
 * 프로토타입처럼 "저장"과 "돌아가기" 모두 적은 것을 남긴다: 할 일 칸을 벗어날 때 저장하고, 닫을 때 남은 것을 한 번 더.
 */
export function Review({ cats, named, onClose, onError }: Props) {
  const t = today()
  const dates = [addDays(t, -2), addDays(t, -1), t]
  const [date, setDate] = useState(t)
  const [todos, setTodos] = useState<Todo[] | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const saved = useRef({ mins: {} as Record<string, number>, notes: {} as Record<string, string> }) // 서버에 있는 값
  const [pick, setPick] = useState<string | null>(cats[0]?.id ?? null)
  const [extra, setExtra] = useState({ text: '', h: 0, m: 30 })

  useEffect(() => {
    const from = addDays(today(), -2)
    Promise.all([loadTodos(from, today()), loadNotes(from, today())])
      .then(([ts, ns]) => {
        saved.current = { mins: Object.fromEntries(ts.map((x) => [x.id, x.minutes])), notes: { ...ns } }
        setTodos(ts)
        setNotes(ns)
      })
      .catch(onError)
  }, [onError])

  const fail = (e: unknown) => onError(e)
  function saveMinutes(x: Todo) {
    if (saved.current.mins[x.id] === x.minutes) return
    saved.current.mins[x.id] = x.minutes
    updateTodo(x.id, { minutes: x.minutes }).catch(fail)
  }
  function saveDayNote(k: string) {
    const v = (notes[k] ?? '').trim()
    if ((saved.current.notes[k] ?? '') === v) return
    saved.current.notes[k] = v
    saveNote(k, v).catch(fail)
  }
  function close() {
    todos?.forEach(saveMinutes)
    dates.forEach(saveDayNote)
    onClose(date)
  }
  const setMin = (id: string, minutes: number) => setTodos((ts) => ts && ts.map((x) => (x.id === id ? { ...x, minutes } : x)))

  async function addExtra() {
    const text = extra.text.trim()
    if (!text) return
    const minutes = clamp(extra.h, 23) * 60 + clamp(extra.m, 59)
    try {
      const row = await addTodo(date, text, pick, { done: true, minutes }) // 이미 한 일이라 체크된 채로
      saved.current.mins[row.id] = minutes
      setTodos((ts) => ts && [...ts, row])
      setExtra((x) => ({ ...x, text: '' }))
    } catch (e) {
      onError(e)
    }
  }

  const list = (todos ?? []).filter((x) => x.date === date)
  const sum = timeStats(cats, list)
  const word = WORD[dates.indexOf(date)]
  return (
    <main className="flow review">
      <div className="c-top">
        <button type="button" onClick={close}>‹ 돌아가기</button>
        <span>저녁 회고</span>
      </div>
      <div className="rv-tabs" role="group" aria-label="날짜">
        {dates.map((k, i) => (
          <button key={k} type="button" aria-pressed={k === date} onClick={() => setDate(k)}>
            {WORD[i]} {md(k)}
          </button>
        ))}
      </div>
      <p className="c-note">할 일마다 실제로 쓴 시간을 적어. 체크 안 한 일도 쓴 시간이 있으면 적어.</p>
      {todos &&
        (list.length ? (
          list.map((x) => (
            // 시간·분 칸 사이를 오갈 때는 저장하지 않고, 이 할 일 칸을 벗어날 때 저장
            <div key={x.id} className="rv-row" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && saveMinutes(x)}>
              <div className="rv-t">
                <span className="tx">{x.text}</span>
                {x.done && <span className="ck">✓ 완료</span>}
                <button
                  type="button"
                  className="chip"
                  style={catStyle(cats, x.category_id)}
                  aria-label={`카테고리 바꾸기: 지금 ${catName(named, x.category_id)}`}
                  onClick={() => {
                    const category_id = nextCat(cats, x.category_id)
                    setTodos((ts) => ts && ts.map((y) => (y.id === x.id ? { ...y, category_id } : y)))
                    updateTodo(x.id, { category_id }).catch(fail)
                  }}
                >
                  {catName(named, x.category_id)}
                </button>
              </div>
              <div className="hm">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={23}
                  value={Math.floor(x.minutes / 60)}
                  aria-label={`${x.text} 시간`}
                  onChange={(e) => setMin(x.id, clamp(e.target.value, 23) * 60 + (x.minutes % 60))}
                />
                시간
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={59}
                  step={5}
                  value={x.minutes % 60}
                  aria-label={`${x.text} 분`}
                  onChange={(e) => setMin(x.id, Math.floor(x.minutes / 60) * 60 + clamp(e.target.value, 59))}
                />
                분
              </div>
            </div>
          ))
        ) : (
          <p className="c-note">이날 적어 둔 할 일이 없어.</p>
        ))}
      <form
        className="rv-add"
        onSubmit={(e) => {
          e.preventDefault()
          addExtra()
        }}
      >
        <span className="rv-add-h">+ 목록에 없던 일</span>
        <div className="picks" role="group" aria-label="카테고리 고르기">
          {[...cats.map((c) => c.id), null].map((id) => (
            <button key={id ?? 'etc'} type="button" className="pick" style={catStyle(cats, id)} aria-pressed={pick === id} onClick={() => setPick(id)}>
              {catName(cats, id)}
            </button>
          ))}
        </div>
        <input type="text" maxLength={30} value={extra.text} placeholder="예: 회의실 예약" aria-label="목록에 없던 일" onChange={(e) => setExtra({ ...extra, text: e.target.value })} />
        <div className="hm">
          <input type="number" inputMode="numeric" min={0} max={23} value={extra.h} aria-label="시간" onChange={(e) => setExtra({ ...extra, h: clamp(e.target.value, 23) })} />
          시간
          <input type="number" inputMode="numeric" min={0} max={59} step={5} value={extra.m} aria-label="분" onChange={(e) => setExtra({ ...extra, m: clamp(e.target.value, 59) })} />
          분
          <button type="submit" className="rv-add-btn">추가</button>
        </div>
      </form>
      <label className="c-f">
        <span>{word} 회고 한 줄 <em>(선택)</em></span>
        <input
          type="text"
          maxLength={40}
          value={notes[date] ?? ''}
          placeholder="예: 오후 집중이 좋았다"
          onChange={(e) => setNotes({ ...notes, [date]: e.target.value })}
          onBlur={() => saveDayNote(date)}
        />
      </label>
      <div className="rv-sum" aria-live="polite">
        <b>합계 {fmtMinutes(sum.total)}</b>
        {sum.rows.some((r) => r.minutes) && ' · ' + sum.rows.filter((r) => r.minutes).map((r) => `${r.name} ${fmtMinutes(r.minutes)}`).join(' / ')}
      </div>
      <button type="button" className="c-main primary" onClick={close}>저장</button>
    </main>
  )
}
