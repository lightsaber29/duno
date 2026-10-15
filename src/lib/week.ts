// 날짜는 전부 기기 지역 날짜 'YYYY-MM-DD' 문자열. 같은 형식이라 문자열 비교가 곧 날짜 비교다.

const pad = (n: number) => String(n).padStart(2, '0')
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const today = () => toKey(new Date())

export function addDays(k: string, n: number): string {
  const d = parseKey(k)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

/** 그 날짜가 속한 주의 월요일 */
export function weekStart(k: string): string {
  return addDays(k, -((parseKey(k).getDay() + 6) % 7))
}

/** 월~일 7개 */
export const weekDays = (ws: string) => Array.from({ length: 7 }, (_, i) => addDays(ws, i))

/** "10/13 – 10/19" */
export function weekRange(ws: string): string {
  const f = (k: string) => { const d = parseKey(k); return `${d.getMonth() + 1}/${d.getDate()}` }
  return `${f(ws)} – ${f(addDays(ws, 6))}`
}

export type WeekKind = 'past' | 'current' | 'future'
export function weekKind(ws: string, todayKey: string): WeekKind {
  const cur = weekStart(todayKey)
  return ws < cur ? 'past' : ws === cur ? 'current' : 'future'
}

/** 이번 주보다 앞선 날짜는 읽기 전용 (지난 완료율이 바뀌지 않게) */
export const isReadOnly = (k: string, todayKey: string) => k < weekStart(todayKey)

/** 완료율. 할 일이 없으면 0% */
export function rate(todos: { done: boolean }[]) {
  const done = todos.filter((t) => t.done).length
  return { total: todos.length, done, pct: todos.length ? Math.round((done / todos.length) * 100) : 0 }
}

/** 바로 지난주 마감 흐름을 띄울지. 할 일도 목표도 없던 주, 이미 끝낸 주는 띄우지 않는다 */
export function shouldClose(lastWeek: { goal: string; closed_at: string | null } | null, lastWeekTodoCount: number): boolean {
  if (lastWeek?.closed_at) return false
  return lastWeekTodoCount > 0 || !!lastWeek?.goal
}
