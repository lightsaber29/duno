import { supabase } from './supabase'

export type Todo = { id: string; date: string; text: string; done: boolean }

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

const COLS = 'id, date, text, done'

/** from~to(둘 다 포함) 할 일. 목록 순서는 만든 순 */
export async function loadTodos(from: string, to: string): Promise<Todo[]> {
  return must(await supabase.from('todos').select(COLS).gte('date', from).lte('date', to).order('created_at')) as Todo[]
}

export async function addTodo(date: string, text: string): Promise<Todo> {
  return must(await supabase.from('todos').insert({ date, text }).select(COLS).single<Todo>())
}

export async function updateTodo(id: string, patch: Partial<Pick<Todo, 'text' | 'done'>>): Promise<void> {
  must(await supabase.from('todos').update(patch).eq('id', id))
}

export async function deleteTodo(id: string): Promise<void> {
  must(await supabase.from('todos').delete().eq('id', id))
}

export type Week = { goal: string; good: string; bad: string; closed_at: string | null }

/** 그 주 행. 아직 안 만들어졌으면 null */
export async function loadWeek(weekStart: string): Promise<Week | null> {
  return must(await supabase.from('weeks').select('goal, good, bad, closed_at').eq('week_start', weekStart).maybeSingle<Week>())
}

/** 마감 흐름을 끝냈거나 건너뛴 표시. 회고 한 줄도 같이 저장 */
export async function closeWeek(weekStart: string, review?: { good: string; bad: string }): Promise<void> {
  await saveWeek(weekStart, { ...review, closed_at: new Date().toISOString() })
}

/** 주 행이 없으면 만들고, 있으면 넘긴 열만 바꾼다 */
export async function saveWeek(weekStart: string, patch: Partial<Week>): Promise<void> {
  must(await supabase.from('weeks').upsert({ week_start: weekStart, ...patch }, { onConflict: 'user_id,week_start' }))
}
