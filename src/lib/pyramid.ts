// 피라미드(편향 보기)·주간 마감·할 일 입력 권유 계산.
// 규칙 근거: docs/오토바이 phase4.md 5·6·8절, docs/오토바이 phase4 개발 계획.md "계산" (phase2·3 문서에서 이어짐)
import { equalSplit, largestRemainder } from './ratio.ts'

/** 편향 기준 %p. 절댓값이 이 값 이상이면 더/덜 (phase4 BI-4·5, 5절) */
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

/**
 * 카테고리별 시간·실제 비율·차이. 기타가 마지막. 0분인 할 일은 뺀다.
 * gone(지운 카테고리)의 시간은 전체 시간(분모)에만 넣고 어느 칸에도 보이지 않는다(TD-4). 모르는 카테고리는 기타로.
 */
export function timeStats<T extends Timed>(cats: Cat[], todos: T[], gone: string[] = []) {
  const goneSet = new Set(gone)
  const goneMin = todos.filter((t) => t.minutes > 0 && t.category_id && goneSet.has(t.category_id)).reduce((a, t) => a + t.minutes, 0)
  const timed = todos.filter((t) => t.minutes > 0 && !(t.category_id && goneSet.has(t.category_id)))
  const known = new Set(cats.map((c) => c.id))
  const keys = [...cats.map((c) => c.id), null]
  const lists = keys.map((k) =>
    timed.filter((t) => (k === null ? !t.category_id || !known.has(t.category_id) : t.category_id === k)).sort((a, b) => b.minutes - a.minutes),
  )
  const mins = lists.map((l) => l.reduce((a, t) => a + t.minutes, 0))
  const total = mins.reduce((a, b) => a + b, 0) + goneMin
  const actual = largestRemainder([...mins, goneMin], 100, 0).slice(0, -1) // 지운 몫은 빼고 보여 준다. 기록이 없으면 전부 0
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
export const level = (diff: number | null): Level | null => (diff === null ? null : diff >= TH ? 'over' : diff <= -TH ? 'under' : 'ok')

/** 판정 문장 재료: 많이 쓴 곳, 덜 쓴 곳 이름 */
export function verdict(rows: { name: string; diff: number | null }[]) {
  return {
    over: rows.filter((r) => level(r.diff) === 'over').map((r) => r.name),
    under: rows.filter((r) => level(r.diff) === 'under').map((r) => r.name),
  }
}

/** 분 → "2시간 30분", "45분", "0분" */
export function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60)
  const r = m % 60
  if (m <= 0) return '0분'
  return [h && `${h}시간`, r && `${r}분`].filter(Boolean).join(' ')
}


export type WeekRatio = { week_start: string; category_id: string; ratio: number }

/**
 * 그 주의 기준 비율(주간 비율). 그 주에 정한 묶음이 있으면 그것, 없으면 핵심목표 비율(cats.ratio).
 * 수정하지 않은 주·마감을 건너뛴 주·첫 주는 핵심목표 비율이다(phase4 WG-5, 이어 쓰지 않음). 묶음에 없는 카테고리는 0%.
 */
export function weekBasis(cats: Cat[], rows: WeekRatio[], ws: string): Cat[] {
  const own = rows.filter((r) => r.week_start === ws)
  if (!own.length) return cats
  const set = new Map(own.map((r) => [r.category_id, r.ratio]))
  return cats.map((c) => ({ ...c, ratio: set.get(c.id) ?? 0 }))
}

/** 그 주의 주간 목표 시간(분): 그 주 이전에 정한 가장 최근 값. 한 번도 없으면 null */
export function weekTarget(weeks: { week_start: string; target_minutes?: number | null }[], ws: string): number | null {
  // 행은 있어도 값이 비었으면(null·없음) 건너뜀
  const set = weeks.filter((w) => w.week_start <= ws && w.target_minutes != null).sort((a, b) => (a.week_start < b.week_start ? 1 : -1))
  return set[0]?.target_minutes ?? null
}

/**
 * 할 일 입력 권유(NU-2~5, 8절). todos는 "지금까지"(진입일부터), cats는 지우지 않은 카테고리(핵심목표 비율), gone은 지운 카테고리.
 * 15 이상 덜 쓴 카테고리 중 편향이 가장 큰 것 1개(같으면 앞 카테고리),
 * 그 카테고리의 1분 이상 할 일 중 가장 짧은 것(같으면 최근 날짜). 할 일이 없으면 카테고리만.
 * 기록이 0이어도 진입 직후부터 권한다: 실제가 모두 0%라 핵심목표 비율이 15 이상인 것 중 가장 큰 것.
 */
export function nudge<T extends Timed>(cats: Cat[], todos: T[], gone: string[] = []) {
  const { total, rows } = timeStats(cats, todos, gone)
  const under = rows
    .map((r) => ({ ...r, diff: r.ratio === null ? null : total ? r.diff : -r.ratio }))
    .filter((r) => level(r.diff) === 'under')
    .sort((a, b) => a.diff! - b.diff!) // 안정 정렬이라 같으면 카테고리 순서
  if (!under.length) return null
  const r = under[0]
  const todo = r.todos.reduce<T | null>((best, t) => (!best || t.minutes < best.minutes || (t.minutes === best.minutes && t.date > best.date) ? t : best), null)
  return { id: r.id!, name: r.name, todo }
}

/** 남은 비율을 원래 비율대로 합 100으로. 남은 게 다 0이면 똑같이 */
function rescale(rest: number[]): number[] {
  if (!rest.length) return []
  const sum = rest.reduce((a, b) => a + b, 0)
  return sum === 100 ? rest : sum > 0 ? largestRemainder(rest, 100, 0) : equalSplit(rest.length)
}

/**
 * 주간 마감에서 카테고리를 지우고 더한 뒤의 핵심목표 비율(D6, WC-10: 마감에서 직접 고치지는 않는다).
 * 지운 몫은 남은 카테고리에 원래 비율대로 나누고, 새 카테고리는 0%. 반환 순서 = 남긴 것 → 새 것
 */
export function coreAfter(ratios: number[], deleted: boolean[], added: number): number[] {
  return [...rescale(ratios.filter((_, i) => !deleted[i])), ...Array(added).fill(0)]
}

