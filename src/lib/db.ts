import { supabase } from './supabase'
import { largestRemainder } from './ratio'
import { localDate } from './format'

export type Plan = { id: string; goal: string; notify_at: string }
export type Subgoal = { id: string; name: string; ratio: number; position: number; removed_at: string | null }
export type Share = { subgoal_id: string | null; ratio: number } // null = 기타
export type Entry = { id: string; date: string; minutes: number | null; shares: Share[] } // minutes null = 휴식
export type PlanData = { plan: Plan; subgoals: Subgoal[]; entries: Entry[] }

/** 계획 설정 화면이 내놓는 값. id가 있으면 기존 세부 목표(이름만 바뀌어도 같은 것), 없으면 새것 */
export type PlanInput = {
  goal: string
  items: { id?: string; name: string }[]
  ratios: number[]
  notifyAt: string
}

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

export async function loadPlan(): Promise<PlanData | null> {
  const plan = must(await supabase.from('plans').select('id, goal, notify_at').is('archived_at', null).maybeSingle<Plan>())
  if (!plan) return null
  const subgoals = must(
    await supabase.from('subgoals').select('id, name, ratio, position, removed_at').eq('plan_id', plan.id).order('position'),
  ) as Subgoal[]
  const rows = must(
    await supabase.from('entries').select('id, date, minutes, entry_shares(subgoal_id, ratio)').eq('plan_id', plan.id).order('date'),
  ) as (Omit<Entry, 'shares'> & { entry_shares: Share[] })[]
  const entries = rows.map(({ entry_shares, ...e }) => ({ ...e, shares: entry_shares }))
  return { plan: { ...plan, notify_at: plan.notify_at.slice(0, 5) }, subgoals, entries }
}

export async function createPlan(userId: string, input: PlanInput): Promise<void> {
  const plan = must(
    await supabase.from('plans').insert({ user_id: userId, goal: input.goal, notify_at: input.notifyAt }).select('id').single<{ id: string }>(),
  )
  must(
    await supabase
      .from('subgoals')
      .insert(input.items.map((it, i) => ({ plan_id: plan.id, name: it.name, ratio: input.ratios[i], position: i }))),
  )
}

/** 계획 고치기. 핵심 목표가 바뀌면 호출 전에 archivePlan + createPlan을 쓴다. */
export async function updatePlan(current: PlanData, input: PlanInput): Promise<void> {
  const planId = current.plan.id
  const keep = new Set(input.items.map((it) => it.id).filter(Boolean))
  for (const sg of current.subgoals) {
    if (!sg.removed_at && !keep.has(sg.id)) must(await supabase.from('subgoals').update({ removed_at: new Date().toISOString() }).eq('id', sg.id))
  }
  const fresh = input.items.map((it, i) => ({ plan_id: planId, name: it.name, ratio: input.ratios[i], position: i })).filter((_, i) => !input.items[i].id)
  if (fresh.length) must(await supabase.from('subgoals').insert(fresh))
  for (const [i, it] of input.items.entries()) {
    if (it.id) must(await supabase.from('subgoals').update({ name: it.name, ratio: input.ratios[i], position: i }).eq('id', it.id))
  }
  must(await supabase.from('plans').update({ notify_at: input.notifyAt }).eq('id', planId))
  must(
    await supabase.from('plan_changes').insert({
      plan_id: planId,
      before: { goal: current.plan.goal, notify_at: current.plan.notify_at, subgoals: current.subgoals.filter((s) => !s.removed_at).map((s) => [s.name, s.ratio]) },
      after: { goal: input.goal, notify_at: input.notifyAt, subgoals: input.items.map((it, i) => [it.name, input.ratios[i]]) },
    }),
  )
}

export async function archivePlan(planId: string): Promise<void> {
  must(await supabase.from('plans').update({ archived_at: new Date().toISOString() }).eq('id', planId))
}

export async function saveEntry(planId: string, date: string, minutes: number | null, shares: Share[]): Promise<void> {
  const entry = must(
    await supabase
      .from('entries')
      .upsert({ plan_id: planId, date, minutes, updated_at: new Date().toISOString() }, { onConflict: 'plan_id,date' })
      .select('id')
      .single<{ id: string }>(),
  )
  must(await supabase.from('entry_shares').delete().eq('entry_id', entry.id))
  if (shares.length) must(await supabase.from('entry_shares').insert(shares.map((s) => ({ entry_id: entry.id, ...s }))))
}

/** 검증용: 현재 상태 화면을 연 시각 */
export function logStatusView(userId: string): void {
  void supabase.from('status_views').insert({ user_id: userId })
}

export async function deleteEntry(planId: string, date: string): Promise<void> {
  must(await supabase.from('entries').delete().eq('plan_id', planId).eq('date', date))
}

export async function deleteAllEntries(planId: string): Promise<void> {
  must(await supabase.from('entries').delete().eq('plan_id', planId))
}

/** 테스트용 예시 데이터(seed.sql과 같은 모양). 오늘 포함 아흐레, 하루 휴식. 세부 목표가 넷보다 적으면 있는 것만 쓴다. */
export async function seedEntries(planId: string, subgoalIds: string[]): Promise<void> {
  const shape: [number, number | null, [number | null, number][]][] = [
    [-8, 180, [[0, 70], [1, 20], [null, 10]]],
    [-7, 240, [[0, 60], [2, 30], [3, 10]]],
    [-6, 120, [[0, 50], [1, 50]]],
    [-5, 300, [[0, 70], [2, 20], [null, 10]]],
    [-4, null, []],
    [-3, 90, [[0, 40], [3, 60]]],
    [-2, 210, [[0, 60], [1, 20], [2, 20]]],
    [-1, 150, [[0, 50], [2, 30], [3, 20]]],
    [0, 240, [[0, 60], [1, 10], [2, 10], [3, 10], [null, 10]]],
  ]
  for (const [offset, minutes, raw] of shape) {
    const kept = raw.filter(([i]) => i === null || i < subgoalIds.length)
    const ratios = largestRemainder(kept.map(([, r]) => r))
    await saveEntry(planId, localDate(offset), minutes, kept.map(([i], k) => ({ subgoal_id: i === null ? null : subgoalIds[i], ratio: ratios[k] })))
  }
}
