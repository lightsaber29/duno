/**
 * 비율 계산. 근거: duno-screens-and-rules.md 7절(다이얼 규칙), 8절(실제 비율).
 * 모든 비율은 정수 %. 배열 순서 = 계획 순서(작성 화면은 기타가 마지막).
 */

/** 가중치를 합 total의 정수로 맞춘다. 최대 나머지 방식, 나머지가 같으면 앞 조각 먼저. 각 조각은 min 이상. */
export function largestRemainder(weights: number[], total = 100, min = 1): number[] {
  const n = weights.length
  if (n === 0) return []
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum <= 0) return weights.map(() => min)
  // ponytail: 나머지 비교를 정수로 하려고 total·sum 단위의 정수 산술만 쓴다. 부동소수점 동점 문제 없음.
  const scaled = weights.map((w) => w * total)
  const floor = scaled.map((s) => Math.floor(s / sum))
  // min 아래로 떨어진 조각은 min으로 올리고 나머지 배분에서 뺀다
  const out = floor.map((f) => Math.max(min, f))
  const order = scaled
    .map((s, i) => ({ i, rem: s % sum }))
    .filter(({ i }) => floor[i] >= min)
    .sort((a, b) => b.rem - a.rem || a.i - b.i)
    .map(({ i }) => i)
  let left = total - out.reduce((a, b) => a + b, 0)
  for (let k = 0; left > 0 && order.length; k = (k + 1) % order.length) {
    out[order[k]] += 1
    left -= 1
  }
  // min 강제로 합이 total을 넘었으면 큰 조각부터 1씩 뺀다
  for (let k = 0; left < 0 && order.length; k = (k + 1) % order.length) {
    const i = order[k]
    if (out[i] > min) {
      out[i] -= 1
      left += 1
    }
  }
  return out
}

/** 균등 배분. 남는 몫은 앞부터 1씩. 셋이면 34/33/33. */
export function equalSplit(n: number): number[] {
  return largestRemainder(Array(n).fill(1))
}

/** 조각 하나 더하기(7-3). 새 조각 = round(100 ÷ n), 나머지는 기존 비율대로. at 위치에 끼운다. */
export function addSlice(ratios: number[], at = ratios.length): number[] {
  const n = ratios.length + 1
  if (n === 1) return [100]
  const fresh = Math.round(100 / n) // 0.5는 올림
  const rest = largestRemainder(ratios, 100 - fresh)
  rest.splice(at, 0, fresh)
  return rest
}

/** 조각 하나 빼기(7-3, 7-4). 남은 조각들이 빠진 몫을 기존 비율대로 나눠 갖는다. */
export function removeSlice(ratios: number[], at: number): number[] {
  const rest = ratios.filter((_, i) => i !== at)
  return largestRemainder(rest)
}

/** 기타 더하기: 1%로 시작하고 바로 앞 조각에서 뺀다. 앞이 1%면 그 앞에서. 기타는 맨 끝에 붙는다. */
export function addOther(ratios: number[]): number[] {
  const out = [...ratios]
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i] > 1) {
      out[i] -= 1
      return [...out, 1]
    }
  }
  return [...out, 1] // ponytail: 전부 1%면 합이 101. 조각 8개 모두 1%인 경우뿐이라 무시
}

/** 기타 빼기: 기타(마지막)의 몫을 바로 앞 조각에 돌려준다. */
export function removeOther(ratios: number[]): number[] {
  const out = ratios.slice(0, -1)
  if (out.length) out[out.length - 1] += ratios[ratios.length - 1]
  return out
}

/**
 * 숫자 칸으로 i번째를 고칠 때(7-2).
 * 늘릴 때: 앞에서 5%까지, 모자라면 다음에서 5%까지. 이미 5% 이하인 이웃은 건너뛴다. 그래도 모자라면 가능한 만큼만.
 * 줄일 때: 줄인 만큼 앞에 더한다. 첫 조각은 다음과만, 마지막은 앞과만.
 * 1 아래는 1. 소수는 버림. 빈 값·숫자 아님은 원래 값.
 */
export function setByInput(ratios: number[], i: number, raw: string | number): number[] {
  const parsed = typeof raw === 'number' ? raw : parseFloat(raw)
  if (!Number.isFinite(parsed)) return ratios
  if (ratios.length === 1) return [100]
  const want = Math.max(1, Math.floor(parsed))
  const out = [...ratios]
  const prev = i > 0 ? i - 1 : null
  const next = i < out.length - 1 ? i + 1 : null
  let delta = want - out[i]
  if (delta > 0) {
    for (const j of [prev, next]) {
      if (j === null || delta <= 0 || out[j] <= 5) continue
      const take = Math.min(delta, out[j] - 5)
      out[j] -= take
      delta -= take
    }
    out[i] = want - delta
  } else if (delta < 0) {
    const j = prev ?? next!
    out[j] -= delta
    out[i] = want
  }
  return out
}

/** 끌기(7-1): i와 i+1(마지막이면 0) 사이 경계를 옮긴다. delta만큼 i가 늘고 이웃이 준다. 둘 다 1% 아래로 못 간다. */
export function dragBoundary(ratios: number[], i: number, delta: number): number[] {
  const j = (i + 1) % ratios.length
  if (i === j) return ratios
  const out = [...ratios]
  const d = Math.max(1 - out[i], Math.min(out[j] - 1, Math.round(delta)))
  out[i] += d
  out[j] -= d
  return out
}

/** 바뀐 내용 안내용: 달라진 조각만 [index, before, after]. */
export function diff(before: number[], after: number[]): [number, number, number][] {
  return after.flatMap((v, i) => (v !== before[i] ? [[i, before[i], v] as [number, number, number]] : []))
}

/** 세부 목표별 분. 쓴 시간 × 몫 ÷ 100. 소수는 반올림(문서 미정, 제안). */
export function shareMinutes(minutes: number, ratio: number): number {
  return Math.round((minutes * ratio) / 100)
}

export type Entry = { minutes: number | null; shares: { key: string; ratio: number }[] }

/** 기간 안 기록의 세부 목표별 누적 분(8절). 휴식(minutes null)은 0. key는 세부 목표 id, 기타는 'other'. */
export function totalMinutes(entries: Entry[]): Map<string, number> {
  const acc = new Map<string, number>()
  for (const e of entries) {
    if (e.minutes === null) continue
    for (const s of e.shares) acc.set(s.key, (acc.get(s.key) ?? 0) + (e.minutes * s.ratio) / 100)
  }
  return acc
}

/** 누적 분을 %로. 합이 0이면 전부 0. 최대 나머지 방식, 바닥 0. */
export function actualRatios(minutes: Map<string, number>): Map<string, number> {
  const keys = [...minutes.keys()]
  const pct = largestRemainder(keys.map((k) => minutes.get(k)!), 100, 0)
  return new Map(keys.map((k, i) => [k, pct[i]]))
}
