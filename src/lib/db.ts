import { supabase } from './supabase'

export type Todo = { id: string; date: string; text: string; done: boolean; category_id: string | null; minutes: number }

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

const COLS = 'id, date, text, done, category_id, minutes'

/** from~to(둘 다 포함) 할 일. 목록 순서는 만든 순 */
export async function loadTodos(from: string, to: string): Promise<Todo[]> {
  return must(await supabase.from('todos').select(COLS).gte('date', from).lte('date', to).order('created_at')) as Todo[]
}

/** more: 회고에서 바로 추가하는 일은 체크된 채 시간과 함께 */
export async function addTodo(date: string, text: string, category_id: string | null, more: Partial<Pick<Todo, 'done' | 'minutes'>> = {}): Promise<Todo> {
  return must(await supabase.from('todos').insert({ date, text, category_id, ...more }).select(COLS).single<Todo>())
}

export async function updateTodo(id: string, patch: Partial<Pick<Todo, 'text' | 'done' | 'category_id' | 'minutes'>>): Promise<void> {
  must(await supabase.from('todos').update(patch).eq('id', id))
}

export async function deleteTodo(id: string): Promise<void> {
  must(await supabase.from('todos').delete().eq('id', id))
}

export type Week = { goal: string; good: string; bad: string; closed_at: string | null; time_plan: string; target_minutes: number | null }

/** 그 주 행. 아직 안 만들어졌으면 null */
export async function loadWeek(weekStart: string): Promise<Week | null> {
  return must(await supabase.from('weeks').select('goal, good, bad, closed_at, time_plan, target_minutes').eq('week_start', weekStart).maybeSingle<Week>())
}

/** 마감 흐름을 끝냈거나 건너뛴 표시. 회고 한 줄도 같이 저장 */
export async function closeWeek(weekStart: string, review?: { good: string; bad: string }): Promise<void> {
  await saveWeek(weekStart, { ...review, closed_at: new Date().toISOString() })
}

/** 주 행이 없으면 만들고, 있으면 넘긴 열만 바꾼다 */
export async function saveWeek(weekStart: string, patch: Partial<Week>): Promise<void> {
  must(await supabase.from('weeks').upsert({ week_start: weekStart, ...patch }, { onConflict: 'user_id,week_start' }))
}

export type Category = { id: string; name: string; ratio: number }
export type Setup = { coreGoal: string; cats: Category[] }

/** 핵심목표와 카테고리. 핵심목표가 없으면 null → 진입 화면 */
export async function loadSetup(): Promise<Setup | null> {
  const p = must(await supabase.from('profiles').select('core_goal').maybeSingle<{ core_goal: string }>())
  if (!p) return null
  const cats = must(await supabase.from('categories').select('id, name, ratio').order('position')) as Category[]
  return { coreGoal: p.core_goal, cats }
}

/**
 * 진입 화면 끝. 카테고리 → 주간 목표 시간(이번 주부터) → 핵심목표 순서라, 중간에 끊기면 다음에 진입 화면이 다시 뜬다.
 * target: 이번 주 월요일과 주간 목표 시간(분)
 */
export async function createSetup(coreGoal: string, cats: { name: string; ratio: number }[], target: { week: string; minutes: number }): Promise<Setup> {
  // 진입은 핵심목표가 없을 때만 오니, 지난번에 끊겨 남은 카테고리가 있으면 지우고 새로 넣는다.
  // 조건 없는 delete는 Supabase(safeupdate)가 막아서 항상 참인 조건을 단다
  must(await supabase.from('categories').delete().not('id', 'is', null))
  const rows = must(
    await supabase.from('categories').insert(cats.map((c, i) => ({ ...c, position: i }))).select('id, name, ratio').order('position'),
  ) as Category[]
  await saveWeek(target.week, { target_minutes: target.minutes })
  must(await supabase.from('profiles').insert({ core_goal: coreGoal }))
  return { coreGoal, cats: rows }
}

/** from~to 회고 한 줄. 날짜 → 글 */
export async function loadNotes(from: string, to: string): Promise<Record<string, string>> {
  const rows = must(await supabase.from('days').select('date, note').gte('date', from).lte('date', to)) as { date: string; note: string }[]
  return Object.fromEntries(rows.map((r) => [r.date, r.note]))
}

export async function saveNote(date: string, note: string): Promise<void> {
  must(await supabase.from('days').upsert({ date, note }, { onConflict: 'user_id,date' }))
}

/** from~to 주(월요일)의 목표. week_start → goal */
export async function loadGoals(from: string, to: string): Promise<Record<string, string>> {
  const rows = must(await supabase.from('weeks').select('week_start, goal').gte('week_start', from).lte('week_start', to)) as { week_start: string; goal: string }[]
  return Object.fromEntries(rows.map((r) => [r.week_start, r.goal]))
}

/** 주간 마감에서 기타로 새 카테고리 만들기 */
export async function addCategory(name: string, ratio: number, position: number): Promise<Category> {
  return must(await supabase.from('categories').insert({ name, ratio, position }).select('id, name, ratio').single<Category>())
}

/** 바뀐 비율만 하나씩(최대 5개) */
export async function setRatios(rows: { id: string; ratio: number }[]): Promise<void> {
  for (const r of rows) must(await supabase.from('categories').update({ ratio: r.ratio }).eq('id', r.id))
}

export async function moveTodos(ids: string[], category_id: string): Promise<void> {
  must(await supabase.from('todos').update({ category_id }).in('id', ids))
}
