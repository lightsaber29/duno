import { useEffect, useState } from 'react'
import { addTodo, loadNotes, loadTodos, saveReview, updateTodo, type Category, type Todo } from './lib/db'
import { catName, catStyle, nextCat } from './lib/cats'
import { fmtMinutes, timeStats } from './lib/pyramid'
import { today } from './lib/week'

type Props = { cats: Category[]; named: Category[]; onClose: (date: string) => void; onError: (e: unknown) => void } // named: 지운 카테고리 포함, 라벨 이름용

const DAY = 24 * 60 // 하루 합계 한도(RV-6)
const clamp = (v: string | number, max: number) => Math.max(0, Math.min(max, Math.floor(+v || 0)))

/**
 * 저녁 회고(phase4 4.3): 오늘 할 일마다 쓴 시간, 목록에 없던 일, 회고 한 줄. 당일만 쓰고 당일 안에는 고칠 수 있다(RV-3).
 * "저장"을 눌러야 저장하고, 하루 합계가 24시간을 넘으면 저장할 수 없다(RV-6). 저장하면 0분이어도 기록한 날(RV-5).
 */
export function Review({ cats, named, onClose, onError }: Props) {
  const t = today()
  const [todos, setTodos] = useState<Todo[] | null>(null)
  const [saved, setSaved] = useState<Record<string, number>>({}) // 서버에 있는 시간
  const [note, setNote] = useState('')
  const [savedNote, setSavedNote] = useState('')
  const [pick, setPick] = useState<string | null>(null) // 기본 기타(TD-1)
  const [extra, setExtra] = useState({ text: '', h: 0, m: 30 })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const d = today()
    Promise.all([loadTodos(d, d), loadNotes(d, d)])
      .then(([ts, ns]) => {
        setSaved(Object.fromEntries(ts.map((x) => [x.id, x.minutes])))
        setTodos(ts)
        setNote(ns[d] ?? '')
        setSavedNote(ns[d] ?? '')
      })
      .catch(onError)
  }, [onError])

  const list = todos ?? []
  const sum = timeStats(cats, list, named.filter((c) => !cats.includes(c)).map((c) => c.id)) // 지운 카테고리 시간은 합계에만, 기타로 보이지 않게(TD-4)
  const total = list.reduce((a, x) => a + x.minutes, 0)
  const over = total > DAY
  const dirty = list.some((x) => saved[x.id] !== x.minutes) || note.trim() !== savedNote
  const setMin = (id: string, minutes: number) => setTodos((ts) => ts && ts.map((x) => (x.id === id ? { ...x, minutes } : x)))

  async function save() {
    setBusy(true)
    try {
      const times = list.filter((x) => saved[x.id] !== x.minutes).map(({ id, minutes }) => ({ id, minutes }))
      await saveReview(t, note.trim(), times) // 시간·한 줄·저장 표시를 한 번에(F7)
      onClose(t)
    } catch (e) {
      onError(e)
      setBusy(false)
    }
  }

  /** 목록에 없던 일은 바로 더한다(이미 한 일이라 체크된 채). 합계가 24시간을 넘으면 막는다 */
  const extraMinutes = clamp(extra.h, 23) * 60 + clamp(extra.m, 59)
  const extraOver = total + extraMinutes > DAY
  async function addExtra() {
    const text = extra.text.trim()
    if (!text || extraOver) return
    try {
      const row = await addTodo(t, text, pick, { done: true, minutes: extraMinutes })
      setSaved((s) => ({ ...s, [row.id]: extraMinutes }))
      setTodos((ts) => ts && [...ts, row])
      setExtra((x) => ({ ...x, text: '' }))
    } catch (e) {
      onError(e)
    }
  }

  return (
    <main className="flow review">
      <div className="c-top">
        {/* 저장하지 않은 것이 있으면 나가면 사라진다는 걸 버튼에 적는다 */}
        <button type="button" onClick={() => onClose(t)}>‹ {dirty ? '저장 안 하고 나가기' : '돌아가기'}</button>
        <span>오늘 회고</span>
      </div>
      <p className="c-note">할 일마다 실제로 쓴 시간을 적어. 체크 안 한 일도 쓴 시간이 있으면 적어. 회고는 오늘만 쓸 수 있어.</p>
      {todos &&
        (list.length ? (
          list.map((x) => (
            <div key={x.id} className="rv-row">
              <div className="rv-t">
                <span className="tx">{x.text}</span>
                {x.done && <span className="ck">✓ 완료</span>}
                <button
                  type="button"
                  className="chip"
                  style={catStyle(cats, x.category_id)}
                  aria-label={`카테고리 바꾸기: 지금 ${catName(named, x.category_id)}`}
                  onClick={() => {
                    // 카테고리는 바로 바꾼다. 기록 시간도 그 할 일을 따라 옮겨 간다(8절)
                    const category_id = nextCat(cats, x.category_id)
                    setTodos((ts) => ts && ts.map((y) => (y.id === x.id ? { ...y, category_id } : y)))
                    updateTodo(x.id, { category_id }).catch(onError)
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
          <p className="c-note">오늘 적어 둔 할 일이 없어.</p>
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
          <button type="submit" className="rv-add-btn" disabled={extraOver}>추가</button>
        </div>
      </form>
      <label className="c-f">
        <span>오늘 회고 한 줄 <em>(선택)</em></span>
        <input type="text" maxLength={40} value={note} placeholder="예: 오후 집중이 좋았다" onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="rv-sum" aria-live="polite">
        <b>합계 {fmtMinutes(total)}</b>
        {sum.rows.some((r) => r.minutes) && ' · ' + sum.rows.filter((r) => r.minutes).map((r) => `${r.name} ${fmtMinutes(r.minutes)}`).join(' / ')}
      </div>
      {over && <p className="ob-sum bad">하루는 24시간이야. 합계를 24시간 안으로 줄여 줘</p>}
      <button type="button" className="c-main primary" disabled={!todos || over || busy} onClick={save}>저장</button>
    </main>
  )
}
