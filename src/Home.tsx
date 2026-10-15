import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { addTodo, closeNudge, deleteTodo, loadNudgeClosed, loadTodos, loadWeek, saveWeek, updateTodo, type Category, type Setup, type Todo } from './lib/db'
import { catName, catStyle, nextCat } from './lib/cats'
import { fmtMinutes, nudge } from './lib/pyramid'
import { addDays, isEvening, parseKey, rate, today, weekDays, weekKind, weekRange, weekStart } from './lib/week'
import { Review } from './Review'
import { Pyramid } from './Pyramid'

const WD = ['일', '월', '화', '수', '목', '금', '토']
const GOAL_LABEL = { past: '지난주 목표', current: '이번 주 목표', future: '다음 주 목표' }

type Props = { setup: Setup; startMonday?: boolean; onError: (e: unknown) => void; onSignOut: () => void }
type Loaded = { ws: string; todos: Todo[]; goal: string }

/** 메인: 핵심목표 → 상단바 → 주간 목표·시간 계획 → 주간 줄 → 일간 목록 → 카테고리 고르기·할 일 입력. 문구는 프로토타입(킥보드 phase2.html) 그대로 */
export function Home({ setup, startMonday, onError, onSignOut }: Props) {
  const { cats } = setup
  const named = [...cats, ...setup.gone]
  const t = today()
  const thisWeek = weekStart(t)
  const [ws, setWs] = useState(thisWeek)
  const [sel, setSel] = useState(startMonday ? thisWeek : t)
  // 어느 주를 불러온 건지 같이 둔다. 주를 빨리 넘길 때 늦게 온 응답이 다른 주를 덮지 않게
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const cur = loaded?.ws === ws ? loaded : null
  const [draft, setDraft] = useState('')
  const [pick, setPick] = useState<string | null>(cats[0]?.id ?? null) // 새 할 일 카테고리. 마지막으로 고른 것
  const [review, setReview] = useState(false)
  const [pyramid, setPyramid] = useState(false)
  const [version, setVersion] = useState(0) // 회고에서 돌아오면 다시 불러오기
  const addRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(
    () =>
      Promise.all([loadTodos(ws, addDays(ws, 6)), loadWeek(ws)])
        .then(([todos, w]) => setLoaded({ ws, todos, goal: w?.goal ?? '' }))
        .catch(onError),
    [ws, onError],
  )
  // version: 회고에서 돌아오면 같은 주라도 다시 불러온다
  useEffect(() => {
    reload()
  }, [reload, version])

  // 할 일 입력 권유(phase3 4.5): 지금까지 기록 전부와 오늘 닫았는지. 회고에서 돌아오면 다시
  const [nudgeData, setNudgeData] = useState<{ todos: Todo[]; closed: boolean } | null>(null)
  useEffect(() => {
    Promise.all([loadTodos('1970-01-01', t), loadNudgeClosed(t)])
      .then(([todos, closed]) => setNudgeData({ todos, closed }))
      .catch(onError)
  }, [t, version, onError])
  // 권유는 "오늘" 목록에 더하니(NU-7) 오늘을 볼 때만
  const suggestion = nudgeData && !nudgeData.closed && sel === t ? nudge(cats, nudgeData.todos) : null

  function dismissNudge() {
    setNudgeData((d) => d && { ...d, closed: true })
    closeNudge(t).catch(onError)
  }

  /** 제시한 할 일을 오늘 목록에 더하고 그날 권유는 끝. 할 일 없이 카테고리만이면 그 카테고리를 골라 입력 칸으로 (NU-5) */
  async function takeNudge(s: NonNullable<typeof suggestion>) {
    if (!s.todo) {
      setPick(s.id)
      addRef.current?.focus()
      return
    }
    try {
      const row = await addTodo(t, s.todo.text, s.id, { nudged: true })
      setLoaded((l) => l && mapTodos((ts) => [...ts, row])(l))
      dismissNudge()
    } catch (e) {
      onError(e)
    }
  }

  const kind = weekKind(ws, t)
  const days = weekDays(ws)
  const of = (k: string) => (cur?.todos ?? []).filter((x) => x.date === k)

  function goWeek(n: number) {
    const next = n === 0 ? thisWeek : addDays(ws, n)
    setWs(next)
    setSel(next === thisWeek ? t : next)
  }

  /** 화면 먼저 바꾸고 저장. 실패하면 서버 값으로 되돌린다 */
  function act(local: (l: Loaded) => Loaded, remote: Promise<void>) {
    setLoaded((l) => l && local(l))
    remote.catch((e) => {
      onError(e)
      reload()
    })
  }
  const mapTodos = (f: (ts: Todo[]) => Todo[]) => (l: Loaded) => ({ ...l, todos: f(l.todos) })

  async function add() {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    addRef.current?.focus()
    try {
      const row = await addTodo(sel, text, pick)
      setLoaded((l) => l && mapTodos((ts) => [...ts, row])(l))
    } catch (e) {
      onError(e)
      setDraft(text)
    }
  }

  if (review)
    return (
      <Review
        cats={cats}
        named={named}
        onError={onError}
        onClose={(date) => {
          setReview(false)
          setWs(weekStart(date))
          setSel(date)
          setVersion((v) => v + 1)
        }}
      />
    )

  if (pyramid) return <Pyramid setup={setup} onClose={() => setPyramid(false)} onSignOut={onSignOut} onError={onError} />

  const s = parseKey(sel)
  const list = of(sel)
  // N1: 실제 알림 대신, 9시 이후 열었는데 오늘 시간이 하나도 안 적혀 있으면 띠
  const reviewNudge = ws === thisWeek && cur && isEvening() && of(t).every((x) => x.minutes === 0)
  return (
    <main className="home">
      {reviewNudge && (
        <button type="button" className="nudge" onClick={() => setReview(true)}>
          오늘 회고를 적어 봐 ›
        </button>
      )}
      <header className="vis">
        <small>핵심목표</small>
        <b>{setup.coreGoal}</b>
      </header>
      <section className="p-week">
        <div className="wk-h">
          <span>
            <button type="button" onClick={() => goWeek(-7)} aria-label="지난주">‹</button>
            {weekRange(ws)}
            <button type="button" onClick={() => goWeek(7)} aria-label="다음 주">›</button>
          </span>
          <span>
            {ws !== thisWeek && <button type="button" className="now" onClick={() => goWeek(0)}>이번 주로</button>}
            <button type="button" className="pill" onClick={() => setReview(true)}>회고</button>
            <button type="button" className="pill" aria-label="피라미드" onClick={() => setPyramid(true)}>△</button>
          </span>
        </div>
        <div className="goal">
          <small>{GOAL_LABEL[kind]}</small>
          {cur && <Goal key={ws} goal={cur.goal} label={GOAL_LABEL[kind]} onSave={(goal) => act((l) => ({ ...l, goal }), saveWeek(ws, { goal }))} />}
        </div>
        <div className="days">
          {days.map((k) => {
            const d = parseKey(k)
            const r = rate(of(k))
            return (
              <button
                key={k}
                type="button"
                className={'dbtn' + (k === t ? ' today' : '')}
                aria-pressed={k === sel}
                aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일 ${r.done}/${r.total}`}
                onClick={() => setSel(k)}
              >
                <DayRing k={k} pct={r.pct} />
              </button>
            )
          })}
        </div>
      </section>

      <section className="p-day">
        <h2>
          {s.getMonth() + 1}월 {s.getDate()}일 ({WD[s.getDay()]}){sel === t && ' · 오늘'}
        </h2>
        {cur &&
          (list.length ? (
            list.map((x) => (
              <TodoRow
                key={x.id}
                todo={x}
                cats={cats}
                named={named}
                onToggle={(done) => act(mapTodos((ts) => ts.map((y) => (y.id === x.id ? { ...y, done } : y))), updateTodo(x.id, { done }))}
                onSave={(text) => act(mapTodos((ts) => ts.map((y) => (y.id === x.id ? { ...y, text } : y))), updateTodo(x.id, { text }))}
                onDelete={() => act(mapTodos((ts) => ts.filter((y) => y.id !== x.id)), deleteTodo(x.id))}
                onCycle={() => {
                  const category_id = nextCat(cats, x.category_id)
                  act(mapTodos((ts) => ts.map((y) => (y.id === x.id ? { ...y, category_id } : y))), updateTodo(x.id, { category_id }))
                }}
              />
            ))
          ) : (
            <p className="empty">할 일을 적어 봐</p>
          ))}
      </section>

      <form
        className="p-add"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        {suggestion && (
          <div className="nudge-bar" role="status">
            <span>{suggestion.name}에 계획보다 시간을 덜 썼어</span>
            <button type="button" className="nudge-take" onClick={() => takeNudge(suggestion)}>
              {suggestion.todo ? `+ ${suggestion.todo.text} ${fmtMinutes(suggestion.todo.minutes)}` : `+ ${suggestion.name} 할 일 적기`}
            </button>
            <button type="button" className="nudge-close" onClick={dismissNudge}>닫기</button>
          </div>
        )}
        <div className="picks" role="group" aria-label="카테고리 고르기">
          {[...cats.map((c) => c.id), null].map((id) => (
            <button key={id ?? 'etc'} type="button" className="pick" style={catStyle(cats, id)} aria-pressed={pick === id} onClick={() => setPick(id)}>
              {catName(cats, id)}
            </button>
          ))}
        </div>
        <div className="addrow">
          <input ref={addRef} type="text" value={draft} maxLength={100} placeholder="할 일 추가" aria-label="할 일 입력" onChange={(e) => setDraft(e.target.value)} />
          <button type="submit">추가</button>
        </div>
        <p className="hint">카테고리를 고르고 추가해. 라벨을 누르면 바꿀 수 있어.</p>
      </form>
    </main>
  )
}

/** 요일 + 날짜 달성 링 */
function DayRing({ k, pct }: { k: string; pct: number }) {
  const d = parseKey(k)
  return (
    <>
      {WD[d.getDay()]}
      <span className="ring" style={{ background: `conic-gradient(var(--accent) ${pct}%, var(--line) 0)` }}>
        <span>{d.getDate()}</span>
      </span>
    </>
  )
}

/** 누르면 수정 칸. Enter·바깥 누르기는 저장, Esc는 취소. allowEmpty가 아니면 비웠을 때 원래대로 */
function useInlineEdit(value: string, onSave: (v: string) => void, allowEmpty = false) {
  const [edit, setEdit] = useState<string | null>(null)
  const cancel = useRef(false)
  function finish() {
    const v = (edit ?? '').trim()
    if (!cancel.current && (v || allowEmpty) && v !== value) onSave(v)
    cancel.current = false
    setEdit(null)
  }
  const inputProps = {
    type: 'text',
    autoFocus: true,
    value: edit ?? '',
    onChange: (e: { target: { value: string } }) => setEdit(e.target.value),
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') e.currentTarget.blur()
      if (e.key === 'Escape') {
        cancel.current = true
        e.currentTarget.blur()
      }
    },
  }
  return { editing: edit !== null, start: () => setEdit(value), finish, inputProps }
}

type GoalProps = { goal: string; label: string; onSave: (goal: string) => void }

/** 주간 목표 한 줄. 비워서 지울 수 있다. 빈칸 문구는 주에 맞춰 "지난주/이번 주/다음 주 목표를 적어 봐" */
function Goal({ goal, label, onSave }: GoalProps) {
  const e = useInlineEdit(goal, onSave, true)
  if (e.editing) return <input key="edit" className="goal-edit" maxLength={40} placeholder={label} aria-label="주간 목표 입력" onBlur={e.finish} {...e.inputProps} />
  return (
    <button key="view" type="button" className={'goal-t' + (goal ? '' : ' ph')} aria-label="주간 목표 고치기" onClick={e.start}>
      {goal || `${label}를 적어 봐`}
    </button>
  )
}

type RowProps = {
  todo: Todo
  cats: Category[]
  named: Category[] // 이름 찾기용: 지운 카테고리 포함(라벨은 원래 이름에 회색, TD-3)
  onToggle: (done: boolean) => void
  onSave: (text: string) => void
  onDelete: () => void
  onCycle: () => void
}

/** 체크 · 글자(누르면 수정 칸 + 삭제) · 카테고리 라벨(누르면 다음 카테고리로) */
function TodoRow({ todo, cats, named, onToggle, onSave, onDelete, onCycle }: RowProps) {
  const e = useInlineEdit(todo.text, onSave)

  if (e.editing)
    return (
      // key: 보기 칸의 DOM을 재사용하면 autoFocus가 안 걸리고 포커스가 삭제 버튼에 남는다(Enter 한 번에 지워짐)
      // onBlur: 수정 칸 → 삭제 버튼으로 포커스가 옮겨 가는 동안에는 닫지 않는다
      <div key="edit" className="task" onBlur={(ev) => !ev.currentTarget.contains(ev.relatedTarget) && e.finish()}>
        <input maxLength={100} aria-label="할 일 고치기" {...e.inputProps} />
        {/* 터치에서 눌러도 수정 칸 포커스를 뺏지 않게 */}
        <button type="button" className="del" onPointerDown={(ev) => ev.preventDefault()} onClick={onDelete}>삭제</button>
      </div>
    )

  return (
    <div key="view" className={'task' + (todo.done ? ' done' : '')}>
      <input type="checkbox" checked={todo.done} aria-label={todo.text} onChange={(ev) => onToggle(ev.target.checked)} />
      <button type="button" className="t" onClick={e.start}>{todo.text}</button>
      <button type="button" className="chip" style={catStyle(cats, todo.category_id)} aria-label={`카테고리 바꾸기: 지금 ${catName(named, todo.category_id)}`} onClick={onCycle}>
        {catName(named, todo.category_id)}
      </button>
    </div>
  )
}
