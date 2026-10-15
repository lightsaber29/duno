import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { addTodo, deleteTodo, loadTodos, loadWeek, saveWeek, updateTodo, type Category, type Setup, type Todo } from './lib/db'
import { catName, catStyle, nextCat } from './lib/cats'
import { addDays, parseKey, rate, today, weekDays, weekKind, weekRange, weekStart } from './lib/week'

const WD = ['일', '월', '화', '수', '목', '금', '토']
const GOAL_LABEL = { past: '지난주 목표', current: '이번 주 목표', future: '다음 주 목표' }

type Props = { setup: Setup; onError: (e: unknown) => void; onSignOut: () => void }
type Loaded = { ws: string; todos: Todo[]; goal: string; plan: string }

/** 메인: 핵심목표 → 상단바 → 주간 목표·시간 계획 → 주간 줄 → 일간 목록 → 카테고리 고르기·할 일 입력. 문구는 프로토타입(킥보드 phase2.html) 그대로 */
export function Home({ setup, onError, onSignOut }: Props) {
  const { cats } = setup
  const t = today()
  const thisWeek = weekStart(t)
  const [ws, setWs] = useState(thisWeek)
  const [sel, setSel] = useState(t)
  // 어느 주를 불러온 건지 같이 둔다. 주를 빨리 넘길 때 늦게 온 응답이 다른 주를 덮지 않게
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const cur = loaded?.ws === ws ? loaded : null
  const [draft, setDraft] = useState('')
  const [pick, setPick] = useState<string | null>(cats[0]?.id ?? null) // 새 할 일 카테고리. 마지막으로 고른 것
  const addRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(
    () =>
      Promise.all([loadTodos(ws, addDays(ws, 6)), loadWeek(ws)])
        .then(([todos, w]) => setLoaded({ ws, todos, goal: w?.goal ?? '', plan: w?.time_plan ?? '' }))
        .catch(onError),
    [ws, onError],
  )
  useEffect(() => {
    reload()
  }, [reload])

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

  const s = parseKey(sel)
  const list = of(sel)
  return (
    <main className="home">
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
            <button type="button" className="out" onClick={onSignOut}>로그아웃</button>
          </span>
        </div>
        <div className="goal">
          <small>{GOAL_LABEL[kind]}</small>
          {cur && <Goal key={ws} goal={cur.goal} onSave={(goal) => act((l) => ({ ...l, goal }), saveWeek(ws, { goal }))} />}
          {cur?.plan && <p className="focus">시간 계획: {cur.plan}</p>}
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
            <p className="empty">할 일을 적어 보세요</p>
          ))}
      </section>

      <form
        className="p-add"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
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
        <p className="hint">카테고리를 고르고 추가하세요. 라벨을 누르면 바꿀 수 있어요.</p>
      </form>
    </main>
  )
}

/** 요일 + 날짜 달성 링. 마감 흐름에서도 쓴다 */
export function DayRing({ k, pct }: { k: string; pct: number }) {
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

type GoalProps = { goal: string; onSave: (goal: string) => void }

/** 주간 목표 한 줄. 비워서 지울 수 있다 */
function Goal({ goal, onSave }: GoalProps) {
  const e = useInlineEdit(goal, onSave, true)
  if (e.editing) return <input key="edit" className="goal-edit" maxLength={40} placeholder="이번 주 목표" aria-label="주간 목표 입력" onBlur={e.finish} {...e.inputProps} />
  return (
    <button key="view" type="button" className={'goal-t' + (goal ? '' : ' ph')} aria-label="주간 목표 고치기" onClick={e.start}>
      {goal || '이번 주 목표를 적어 보세요'}
    </button>
  )
}

type RowProps = {
  todo: Todo
  cats: Category[]
  onToggle: (done: boolean) => void
  onSave: (text: string) => void
  onDelete: () => void
  onCycle: () => void
}

/** 체크 · 글자(누르면 수정 칸 + 삭제) · 카테고리 라벨(누르면 다음 카테고리로) */
function TodoRow({ todo, cats, onToggle, onSave, onDelete, onCycle }: RowProps) {
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
      <button type="button" className="chip" style={catStyle(cats, todo.category_id)} aria-label={`카테고리 바꾸기: 지금 ${catName(cats, todo.category_id)}`} onClick={onCycle}>
        {catName(cats, todo.category_id)}
      </button>
    </div>
  )
}
