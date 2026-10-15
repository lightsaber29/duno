import { useCallback, useEffect, useRef, useState } from 'react'
import { addTodo, deleteTodo, loadTodos, updateTodo, type Todo } from './lib/db'
import { addDays, parseKey, rate, today, weekDays, weekRange, weekStart } from './lib/week'

const WD = ['일', '월', '화', '수', '목', '금', '토']

type Props = { onError: (e: unknown) => void; onSignOut: () => void }

/** 한 화면: 상단바 → 주간 줄 → 일간 목록 → 할 일 입력. 문구는 프로토타입(todo-planner_1.html) 그대로 */
export function Home({ onError, onSignOut }: Props) {
  const t = today()
  const thisWeek = weekStart(t)
  const [ws, setWs] = useState(thisWeek)
  const [sel, setSel] = useState(t)
  // 어느 주를 불러온 건지 같이 둔다. 주를 빨리 넘길 때 늦게 온 응답이 다른 주를 덮지 않게
  const [loaded, setLoaded] = useState<{ ws: string; todos: Todo[] } | null>(null)
  const todos = loaded?.ws === ws ? loaded.todos : null
  const setTodos = (f: (ts: Todo[]) => Todo[]) => setLoaded((l) => l && { ...l, todos: f(l.todos) })
  const [draft, setDraft] = useState('')
  const addRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(() => loadTodos(ws, addDays(ws, 6)).then((r) => setLoaded({ ws, todos: r })).catch(onError), [ws, onError])
  useEffect(() => {
    reload()
  }, [reload])

  const days = weekDays(ws)
  const of = (k: string) => (todos ?? []).filter((x) => x.date === k)

  function goWeek(n: number) {
    const next = n === 0 ? thisWeek : addDays(ws, n)
    setWs(next)
    setSel(next === thisWeek ? t : next)
  }

  /** 화면 먼저 바꾸고 저장. 실패하면 서버 값으로 되돌린다 */
  function act(local: (ts: Todo[]) => Todo[], remote: Promise<void>) {
    setTodos(local)
    remote.catch((e) => {
      onError(e)
      reload()
    })
  }

  async function add() {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    addRef.current?.focus()
    try {
      const row = await addTodo(sel, text)
      setTodos((ts) => [...ts, row])
    } catch (e) {
      onError(e)
      setDraft(text)
    }
  }

  const s = parseKey(sel)
  const list = of(sel)
  return (
    <main className="home">
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
                {WD[d.getDay()]}
                <span className="ring" style={{ background: `conic-gradient(var(--accent) ${r.pct}%, var(--line) 0)` }}>
                  <span>{d.getDate()}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="p-day">
        <h2>
          {s.getMonth() + 1}월 {s.getDate()}일 ({WD[s.getDay()]}){sel === t && ' · 오늘'}
        </h2>
        {todos &&
          (list.length ? (
            list.map((x) => (
              <TodoRow
                key={x.id}
                todo={x}
                onToggle={(done) => act((ts) => ts.map((y) => (y.id === x.id ? { ...y, done } : y)), updateTodo(x.id, { done }))}
                onSave={(text) => act((ts) => ts.map((y) => (y.id === x.id ? { ...y, text } : y)), updateTodo(x.id, { text }))}
                onDelete={() => act((ts) => ts.filter((y) => y.id !== x.id), deleteTodo(x.id))}
              />
            ))
          ) : (
            // ponytail: 프로토타입은 날짜와 상관없이 "오늘 할 일을 적어 보세요". 다른 날엔 "오늘"만 뺐다
            <p className="empty">{sel === t ? '오늘 할 일을 적어 보세요' : '할 일을 적어 보세요'}</p>
          ))}
      </section>

      <form
        className="p-add"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input ref={addRef} type="text" value={draft} maxLength={100} placeholder="할 일 추가" aria-label="할 일 입력" onChange={(e) => setDraft(e.target.value)} />
        <button type="submit">추가</button>
      </form>
    </main>
  )
}

type RowProps = { todo: Todo; onToggle: (done: boolean) => void; onSave: (text: string) => void; onDelete: () => void }

/** 글자를 누르면 수정 칸 + 삭제. Enter·바깥 누르기는 저장, Esc는 취소, 비우면 원래대로 */
function TodoRow({ todo, onToggle, onSave, onDelete }: RowProps) {
  const [edit, setEdit] = useState<string | null>(null)
  const cancel = useRef(false)

  function finish() {
    const v = (edit ?? '').trim()
    if (!cancel.current && v && v !== todo.text) onSave(v)
    cancel.current = false
    setEdit(null)
  }

  if (edit !== null)
    return (
      // key: 보기 칸의 DOM을 재사용하면 autoFocus가 안 걸리고 포커스가 삭제 버튼에 남는다(Enter 한 번에 지워짐)
      // onBlur: 수정 칸 → 삭제 버튼으로 포커스가 옮겨 가는 동안에는 닫지 않는다
      <div key="edit" className="task" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && finish()}>
        <input
          type="text"
          autoFocus
          value={edit}
          maxLength={100}
          aria-label="할 일 고치기"
          onChange={(e) => setEdit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              cancel.current = true
              e.currentTarget.blur()
            }
          }}
        />
        {/* 터치에서 눌러도 수정 칸 포커스를 뺏지 않게 */}
        <button type="button" className="del" onPointerDown={(e) => e.preventDefault()} onClick={onDelete}>삭제</button>
      </div>
    )

  return (
    <div key="view" className={'task' + (todo.done ? ' done' : '')}>
      <input type="checkbox" checked={todo.done} aria-label={todo.text} onChange={(e) => onToggle(e.target.checked)} />
      <button type="button" className="t" onClick={() => setEdit(todo.text)}>{todo.text}</button>
    </div>
  )
}
