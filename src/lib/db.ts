import { supabase } from './supabase'
import type { WeekRatio } from './pyramid'

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

/** more: 회고에서 바로 추가하는 일은 체크된 채 시간과 함께, 권유로 추가하는 일은 nudged(성공 판단용, NU-8) */
export async function addTodo(
  date: string,
  text: string,
  category_id: string | null,
  more: Partial<Pick<Todo, 'done' | 'minutes'>> & { nudged?: boolean } = {},
): Promise<Todo> {
  return must(await supabase.from('todos').insert({ date, text, category_id, ...more }).select(COLS).single<Todo>())
}

export async function updateTodo(id: string, patch: Partial<Pick<Todo, 'text' | 'done' | 'category_id' | 'minutes'>>): Promise<void> {
  must(await supabase.from('todos').update(patch).eq('id', id))
}

export async function deleteTodo(id: string): Promise<void> {
  must(await supabase.from('todos').delete().eq('id', id))
}

export type Week = { goal: string; good: string; bad: string; closed_at: string | null; target_minutes: number | null; changes: Changes | null }
/** 주간 마감에서 무엇을 바꿨는지(WC-11). 화면에는 안 보인다 */
export type Changes = { goal: boolean; ratio: boolean; target: boolean; added: number; renamed: number; deleted: number }

/** 그 주 행. 아직 안 만들어졌으면 null */
export async function loadWeek(weekStart: string): Promise<Week | null> {
  return must(await supabase.from('weeks').select('goal, good, bad, closed_at, target_minutes, changes').eq('week_start', weekStart).maybeSingle<Week>())
}

/** 마감 흐름을 끝냈거나 건너뛴 표시. 회고 한 줄과 바꾼 것 기록도 같이 저장 */
export async function closeWeek(weekStart: string, review?: { good: string; bad: string; changes: Changes }): Promise<void> {
  await saveWeek(weekStart, { ...review, closed_at: new Date().toISOString() })
}

/** 주 행이 없으면 만들고, 있으면 넘긴 열만 바꾼다 */
export async function saveWeek(weekStart: string, patch: Partial<Week>): Promise<void> {
  must(await supabase.from('weeks').upsert({ week_start: weekStart, ...patch }, { onConflict: 'user_id,week_start' }))
}

export type Category = { id: string; name: string; ratio: number }
/** cats: 지우지 않은 카테고리(핵심목표 비율), gone: 지운 카테고리(라벨 이름·분모용), startedOn: 진입일("지금까지"의 시작, BI-3) */
export type Setup = { coreGoal: string; cats: Category[]; gone: Category[]; startedOn: string }

/** 핵심목표와 카테고리. 핵심목표가 없으면 null → 진입 화면 */
export async function loadSetup(): Promise<Setup | null> {
  const p = must(await supabase.from('profiles').select('core_goal, started_on').maybeSingle<{ core_goal: string; started_on: string }>())
  if (!p) return null
  const rows = must(await supabase.from('categories').select('id, name, ratio, deleted_at').order('position')) as (Category & { deleted_at: string | null })[]
  const pick = (gone: boolean) => rows.filter((r) => !!r.deleted_at === gone).map(({ id, name, ratio }) => ({ id, name, ratio }))
  return { coreGoal: p.core_goal, cats: pick(false), gone: pick(true), startedOn: p.started_on }
}

/**
 * 진입 화면 끝. 카테고리 → 주간 목표 시간(이번 주부터) → 핵심목표 순서라, 중간에 끊기면 다음에 진입 화면이 다시 뜬다.
 * target: 이번 주 월요일과 주간 목표 시간(분), startedOn: 진입일(기기 날짜, 할 일 날짜와 같은 기준)
 */
export async function createSetup(
  coreGoal: string,
  cats: { name: string; ratio: number }[],
  target: { week: string; minutes: number },
  startedOn: string,
): Promise<Setup> {
  // 진입은 핵심목표가 없을 때만 오니, 지난번에 끊겨 남은 카테고리가 있으면 지우고 새로 넣는다.
  // 조건 없는 delete는 Supabase(safeupdate)가 막아서 항상 참인 조건을 단다
  must(await supabase.from('categories').delete().not('id', 'is', null))
  const rows = must(
    await supabase.from('categories').insert(cats.map((c, i) => ({ ...c, position: i }))).select('id, name, ratio').order('position'),
  ) as Category[]
  await saveWeek(target.week, { target_minutes: target.minutes })
  must(await supabase.from('profiles').insert({ core_goal: coreGoal, started_on: startedOn }))
  return { coreGoal, cats: rows, gone: [], startedOn }
}

/** from~to 회고 한 줄. 날짜 → 글 */
export async function loadNotes(from: string, to: string): Promise<Record<string, string>> {
  const rows = must(await supabase.from('days').select('date, note').gte('date', from).lte('date', to)) as { date: string; note: string }[]
  return Object.fromEntries(rows.map((r) => [r.date, r.note]))
}

/** 그날 회고 저장: 회고 한 줄과 저장한 때(0분으로 저장해도 기록한 날, RV-5) */
export async function saveReview(date: string, note: string): Promise<void> {
  must(await supabase.from('days').upsert({ date, note, reviewed_at: new Date().toISOString() }, { onConflict: 'user_id,date' }))
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

/** 지금까지 정한 주간 비율 전부(작다: 주 × 카테고리) */
export async function loadWeekRatios(): Promise<WeekRatio[]> {
  return must(await supabase.from('week_ratios').select('week_start, category_id, ratio')) as WeekRatio[]
}

/** 그날 권유를 닫았는지(NU-6), 회고를 저장했는지(RV-5) */
export async function loadDay(date: string): Promise<{ nudgeClosed: boolean; reviewed: boolean }> {
  const row = must(await supabase.from('days').select('nudge_closed, reviewed_at').eq('date', date).maybeSingle<{ nudge_closed: boolean; reviewed_at: string | null }>())
  return { nudgeClosed: row?.nudge_closed ?? false, reviewed: !!row?.reviewed_at }
}

/** 그날 권유를 닫는다. 회고 한 줄은 그대로 */
export async function closeNudge(date: string): Promise<void> {
  must(await supabase.from('days').upsert({ date, nudge_closed: true }, { onConflict: 'user_id,date' }))
}

/** 주마다 정한 주간 목표 시간(분) 전부. 어느 주 값은 weekTarget으로 찾는다 */
export async function loadTargets(): Promise<{ week_start: string; target_minutes: number | null }[]> {
  return must(await supabase.from('weeks').select('week_start, target_minutes')) as { week_start: string; target_minutes: number | null }[]
}

export async function renameCategory(id: string, name: string): Promise<void> {
  must(await supabase.from('categories').update({ name }).eq('id', id))
}

/** 지운 표시만. 그 카테고리 할 일과 시간은 그대로 남는다(TD-3) */
export async function deleteCategory(id: string): Promise<void> {
  must(await supabase.from('categories').update({ deleted_at: new Date().toISOString() }).eq('id', id))
}

/** 그 주의 주간 비율 묶음을 통째로 바꾼다 */
export async function saveWeekRatios(weekStart: string, rows: { category_id: string; ratio: number }[]): Promise<void> {
  must(await supabase.from('week_ratios').delete().eq('week_start', weekStart))
  must(await supabase.from('week_ratios').insert(rows.map((r) => ({ week_start: weekStart, ...r }))))
}
