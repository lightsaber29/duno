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

/** 그 주의 목표. 행이 없으면 빈 문자열 */
export async function loadGoal(weekStart: string): Promise<string> {
  const row = must(await supabase.from('weeks').select('goal').eq('week_start', weekStart).maybeSingle<{ goal: string }>())
  return row?.goal ?? ''
}

/** 주 행이 없으면 만들고, 있으면 goal만 바꾼다 */
export async function saveGoal(weekStart: string, goal: string): Promise<void> {
  must(await supabase.from('weeks').upsert({ week_start: weekStart, goal }, { onConflict: 'user_id,week_start' }))
}
