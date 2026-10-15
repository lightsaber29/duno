// 피라미드(편향 보기)·주간 마감·할 일 입력 권유 계산.
// 규칙 근거: docs/킥보드 phase2.md "계산 규칙", docs/자전거 phase3.md 5·6절, docs/자전거 phase3 개발 계획.md "계산"
import { equalSplit, largestRemainder } from './ratio.ts'

/** 편향 기준 %p. 이 값을 넘어야(초과) 더/덜 (phase3 BI-3 "15를 넘는") */
export const TH = 15

export type Cat = { id: string; name: string; ratio: number }
export type Timed = { category_id: string | null; minutes: number; date: string }
export type Row<T> = {
  id: string | null // null = 기타
  name: string
  ratio: number | null // 기타는 정한 비율 없음
  minutes: number
  actual: number
  diff: number | null // 실제 − 정한. 기타이거나 기록이 없으면 판정 없음
  todos: T[] // 시간 많이 쓴 순
}

/** 카테고리별 시간·실제 비율·차이. 기타가 마지막. 0분인 할 일은 빼고, 모르는 카테고리는 기타로 */
export function timeStats<T extends Timed>(cats: Cat[], todos: T[]) {
  const timed = todos.filter((t) => t.minutes > 0)
  const known = new Set(cats.map((c) => c.id))
  const keys = [...cats.map((c) => c.id), null]
  const lists = keys.map((k) =>
    timed.filter((t) => (k === null ? !t.category_id || !known.has(t.category_id) : t.category_id === k)).sort((a, b) => b.minutes - a.minutes),
  )
  const mins = lists.map((l) => l.reduce((a, t) => a + t.minutes, 0))
  const total = mins.reduce((a, b) => a + b, 0)
  const actual = largestRemainder(mins, 100, 0) // 기록이 없으면 전부 0
  const rows: Row<T>[] = keys.map((k, i) => {
    const c = cats.find((x) => x.id === k)
    return {
      id: k,
      name: c?.name ?? '기타',
      ratio: c?.ratio ?? null,
      minutes: mins[i],
      actual: actual[i],
      diff: c && total ? actual[i] - c.ratio : null,
      todos: lists[i],
    }
  })
  return { total, rows }
}

export type Level = 'over' | 'under' | 'ok'
export const level = (diff: number | null): Level | null => (diff === null ? null : diff > TH ? 'over' : diff < -TH ? 'under' : 'ok')

/** 판정 문장 재료: 많이 쓴 곳, 덜 쓴 곳 이름 */
export function verdict(rows: { name: string; diff: number | null }[]) {
  return {
    over: rows.filter((r) => level(r.diff) === 'over').map((r) => r.name),
    under: rows.filter((r) => level(r.diff) === 'under').map((r) => r.name),
  }
}

/**
 * 주간 마감 2단계 제안. todos는 지난주까지 4주 것.
 * - ratioPlan: 카테고리마다 (정한 + 실제) ÷ 2를 합 100으로
 * - timePlan: 치우친 카테고리마다 |차이|% × 주 평균 시간, 30분 단위. 0분은 뺀다
 * - otherTodos: 기타가 2시간 이상이고 카테고리가 5개 미만이면 새 카테고리로 옮길 후보
 */
export function proposal<T extends Timed>(cats: Cat[], todos: T[]) {
  const { total, rows } = timeStats(cats, todos)
  const catRows = rows.filter((r) => r.id !== null)
  const off = catRows.filter((r) => level(r.diff) === 'over' || level(r.diff) === 'under')
  // (정한 + 실제)를 그대로 가중치로 쓰면 ÷ 2와 비율이 같고 정수라 반올림이 정확하다
  const ratioPlan = largestRemainder(catRows.map((r) => r.ratio! + r.actual), 100, 0)
  const days = new Set(todos.filter((t) => t.minutes > 0).map((t) => t.date)).size // 회고한 날 = 시간이 적힌 날
  const weekly = days ? (total / days) * 7 : 0
  const timePlan = off
    .map((r) => ({ name: r.name, minutes: Math.round(((Math.abs(r.diff!) / 100) * weekly) / 30) * 30, more: r.diff! < 0 }))
    .filter((p) => p.minutes > 0)
  const other = rows[rows.length - 1]
  return {
    rows,
    biased: off.length > 0,
    ratioPlan,
    timePlan,
    otherTodos: other.minutes >= 120 && cats.length < 5 ? other.todos : null,
  }
}

/** 새 카테고리는 10%로 시작하고 가장 큰 카테고리(동점이면 앞)에서 10%를 가져온다 */
export function withNewCategory(ratios: number[]): number[] {
  const i = ratios.indexOf(Math.max(...ratios))
  return [...ratios.map((r, j) => (j === i ? r - 10 : r)), 10]
}

/** 분 → "2시간 30분", "45분", "0분" */
export function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60)
  const r = m % 60
  if (m <= 0) return '0분'
  return [h && `${h}시간`, r && `${r}분`].filter(Boolean).join(' ')
}

/** "리서치 주 2시간 30분 줄이기" */
export const planText = (p: { name: string; minutes: number; more: boolean }) => `${p.name} 주 ${fmtMinutes(p.minutes)} ${p.more ? '더' : '줄이기'}`

export type WeekRatio = { week_start: string; category_id: string; ratio: number }

/**
 * 그 주의 기준 비율(주간 비율). 그 주 묶음 → 그 이전 가장 최근 묶음 → 핵심목표 비율(cats.ratio) (WG-5, D7).
 * 고른 묶음에 없는 카테고리(나중에 더한 것)는 0%.
 */
export function weekBasis(cats: Cat[], rows: WeekRatio[], ws: string): Cat[] {
  const prior = rows.filter((r) => r.week_start <= ws)
  if (!prior.length) return cats
  const latest = prior.reduce((m, r) => (r.week_start > m ? r.week_start : m), '')
  const set = new Map(prior.filter((r) => r.week_start === latest).map((r) => [r.category_id, r.ratio]))
  return cats.map((c) => ({ ...c, ratio: set.get(c.id) ?? 0 }))
}

/** 그 주의 주간 목표 시간(분): 그 주 이전에 정한 가장 최근 값. 한 번도 없으면 null */
export function weekTarget(weeks: { week_start: string; target_minutes: number | null }[], ws: string): number | null {
  const set = weeks.filter((w) => w.week_start <= ws && w.target_minutes !== null).sort((a, b) => (a.week_start < b.week_start ? 1 : -1))
  return set[0]?.target_minutes ?? null
}

/**
 * 할 일 입력 권유(NU-2~5, D5). todos는 지금까지 전부, cats는 지우지 않은 카테고리(핵심목표 비율).
 * 15 넘게 덜 쓴 카테고리 중 가장 많이 덜 쓴 것 1개(같으면 앞 카테고리),
 * 그 카테고리의 1분 이상 할 일 중 가장 짧은 것(같으면 최근 날짜). 할 일이 없으면 카테고리만.
 */
export function nudge<T extends Timed>(cats: Cat[], todos: T[]) {
  const under = timeStats(cats, todos)
    .rows.filter((r) => level(r.diff) === 'under')
    .sort((a, b) => a.diff! - b.diff!) // 안정 정렬이라 같으면 카테고리 순서
  if (!under.length) return null
  const r = under[0]
  const todo = r.todos.reduce<T | null>((best, t) => (!best || t.minutes < best.minutes || (t.minutes === best.minutes && t.date > best.date) ? t : best), null)
  return { id: r.id!, name: r.name, todo }
}

/** 카테고리를 지우면 그 몫을 남은 카테고리에 원래 비율대로 나눠 합 100 (D6). 남은 것이 다 0%면 똑같이 */
export function withoutCategory(ratios: number[], i: number): number[] {
  const rest = ratios.filter((_, j) => j !== i)
  if (!rest.length) return []
  return rest.some((r) => r > 0) ? largestRemainder(rest, 100, 0) : equalSplit(rest.length)
}
