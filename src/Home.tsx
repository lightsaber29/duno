import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { addTodo, deleteTodo, loadGoal, loadTodos, saveGoal, updateTodo, type Todo } from './lib/db'
import { addDays, isReadOnly, parseKey, rate, today, weekDays, weekKind, weekRange, weekStart } from './lib/week'

const WD = ['일', '월', '화', '수', '목', '금', '토']
const GOAL_LABEL = { past: '지난주 목표', current: '이번 주 목표', future: '다음 주 목표' }

type Props = { onError: (e: unknown) => void; onSignOut: () => void }
type Loaded = { ws: string; todos: Todo[]; goal: string }

/** 한 화면: 상단바 → 주간 목표 → 주간 줄 → 일간 목록 → 할 일 입력. 문구는 프로토타입(todo-planner_1.html) 그대로 */
export function Home({ onError, onSignOut }: Props) {
  const t = today()
  const thisWeek = weekStart(t)
  const [ws, setWs] = useState(thisWeek)
  const [sel, setSel] = useState(t)
  // 어느 주를 불러온 건지 같이 둔다. 주를 빨리 넘길 때 늦게 온 응답이 다른 주를 덮지 않게
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const cur = loaded?.ws === ws ? loaded : null
  const [draft, setDraft] = useState('')
  const addRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(
    () =>
      Promise.all([loadTodos(ws, addDays(ws, 6)), loadGoal(ws)])
        .then(([todos, goal]) => setLoaded({ ws, todos, goal }))
        .catch(onError),
    [ws, onError],
  )
  useEffect(() => {
    reload()
  }, [reload])

  const kind = weekKind(ws, t)
  const days = weekDays(ws)
  const of = (k: string) => (cur?.todos ?? []).filter((x) => x.date === k)
  const ro = isReadOnly(sel, t)

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
      const row = await addTodo(sel, text)
      setLoaded((l) => l && mapTodos((ts) => [...ts, row])(l))
    } catch (e) {
      onError(e)
      setDraft(text)
    }
  }

  const s = parseKey(sel)
  const list = of(sel)
  const wr = rate(cur?.todos ?? [])
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
        <div className="goal">
          <small>
            <span>{GOAL_LABEL[kind]}</span>
            {kind === 'past' && <span className="badge final">완료율 {wr.pct}% 기록</span>}
            {kind === 'current' && <span className="badge live">진행 중 {wr.pct}%</span>}
            {kind === 'future' && <span className="badge wait">시작 전</span>}
          </small>
          {cur && (
            <Goal
              key={ws}
              goal={cur.goal}
              readOnly={kind === 'past'}
              onSave={(goal) => act((l) => ({ ...l, goal }), saveGoal(ws, goal))}
            />
          )}
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
        {cur &&
          (list.length ? (
            list.map((x) => (
              <TodoRow
                key={x.id}
                todo={x}
                readOnly={ro}
                onToggle={(done) => act(mapTodos((ts) => ts.map((y) => (y.id === x.id ? { ...y, done } : y))), updateTodo(x.id, { done }))}
                onSave={(text) => act(mapTodos((ts) => ts.map((y) => (y.id === x.id ? { ...y, text } : y))), updateTodo(x.id, { text }))}
                onDelete={() => act(mapTodos((ts) => ts.filter((y) => y.id !== x.id)), deleteTodo(x.id))}
              />
            ))
          ) : (
            // ponytail: 프로토타입은 날짜와 상관없이 "오늘 할 일을 적어 보세요". 다른 날엔 "오늘"만 빼고, 잠긴 날은 적을 수 없으니 "할 일이 없어요"
            <p className="empty">{ro ? '할 일이 없어요' : sel === t ? '오늘 할 일을 적어 보세요' : '할 일을 적어 보세요'}</p>
          ))}
      </section>

      {!ro && (
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
      )}
    </main>
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

type GoalProps = { goal: string; readOnly: boolean; onSave: (goal: string) => void }

/** 주간 목표 한 줄. 지난주는 고칠 수 없음 */
function Goal({ goal, readOnly, onSave }: GoalProps) {
  const e = useInlineEdit(goal, onSave, true)
  if (readOnly) return <div className={'goal-t' + (goal ? '' : ' ph')}>{goal || '적어 둔 목표가 없어요'}</div>
  if (e.editing) return <input key="edit" className="goal-edit" maxLength={40} placeholder="이번 주 목표" aria-label="주간 목표 입력" onBlur={e.finish} {...e.inputProps} />
  return (
    <button key="view" type="button" className={'goal-t' + (goal ? '' : ' ph')} aria-label="주간 목표 고치기" onClick={e.start}>
      {goal || '목표를 적어 보세요'}
    </button>
  )
}

type RowProps = { todo: Todo; readOnly: boolean; onToggle: (done: boolean) => void; onSave: (text: string) => void; onDelete: () => void }

/** 글자를 누르면 수정 칸 + 삭제. 지난주 이전은 체크·수정 모두 꺼짐 */
function TodoRow({ todo, readOnly, onToggle, onSave, onDelete }: RowProps) {
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
      <input type="checkbox" checked={todo.done} disabled={readOnly} aria-label={todo.text} onChange={(ev) => onToggle(ev.target.checked)} />
      {readOnly ? (
        <span className="t">{todo.text}</span>
      ) : (
        <button type="button" className="t" onClick={e.start}>{todo.text}</button>
      )}
    </div>
  )
}
