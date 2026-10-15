/**
 * 비율 계산. 피벗 전 Duno(b11cb12:src/lib/ratio.ts)에서 둘만 되살렸다.
 * 모든 비율은 정수 %.
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
