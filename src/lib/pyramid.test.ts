// 실행: npm test
// 규칙 근거: docs/킥보드 phase2.md "계산 규칙", docs/킥보드 phase2 개발 계획.md "계산"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { equalSplit } from './ratio.ts'
import { fmtMinutes, level, nudge, planText, proposal, timeStats, verdict, weekBasis, weekTarget, withNewCategory, withoutCategory } from './pyramid.ts'

const CATS = [
  { id: 'r', name: '리서치', ratio: 40 },
  { id: 'm', name: '제작', ratio: 40 },
  { id: 'f', name: '피드백', ratio: 20 },
]
// 10일에 걸쳐 리서치 600분, 제작 200, 피드백 100, 기타 100 → 전체 1000분
const day = (i: number) => `2026-09-${String(20 + i).padStart(2, '0')}`
const T = [
  ...Array.from({ length: 6 }, (_, i) => ({ category_id: 'r', minutes: 100, date: day(i) })),
  { category_id: 'm', minutes: 120, date: day(6) },
  { category_id: 'm', minutes: 80, date: day(7) },
  { category_id: 'f', minutes: 100, date: day(8) },
  { category_id: null, minutes: 100, date: day(9) },
  { category_id: 'r', minutes: 0, date: day(10) }, // 0분: 빼고, 회고한 날로도 안 침
]

test('진입: 똑같이 나누기 (프로토타입 equal()과 같음)', () => {
  assert.deepEqual(equalSplit(3), [34, 33, 33])
  assert.deepEqual(equalSplit(5), [20, 20, 20, 20, 20])
})

test('실제 비율: 기타 포함 전체 시간 대비, 합 100. 차이는 실제 − 정한', () => {
  const { total, rows } = timeStats(CATS, T)
  assert.equal(total, 1000)
  assert.deepEqual(rows.map((r) => [r.name, r.minutes, r.actual, r.diff]), [
    ['리서치', 600, 60, 20],
    ['제작', 200, 20, -20],
    ['피드백', 100, 10, -10],
    ['기타', 100, 10, null], // 기타는 판정 없음
  ])
  assert.deepEqual(rows[1].todos.map((t) => t.minutes), [120, 80], '할 일은 시간 많은 순')
  assert.equal(rows[0].todos.length, 6, '0분 할 일은 목록에서 빠짐')
})

test('실제 비율 반올림: 줄마다 반올림하지 않고 합 100', () => {
  const { rows } = timeStats(CATS, [
    { category_id: 'r', minutes: 1, date: day(0) },
    { category_id: 'm', minutes: 1, date: day(0) },
    { category_id: 'f', minutes: 1, date: day(0) },
  ])
  assert.deepEqual(rows.map((r) => r.actual), [34, 33, 33, 0])
})

test('편향 경계: 15를 넘어야(초과) 더/덜, 딱 15는 계획대로 (phase3 BI-3)', () => {
  assert.equal(level(16), 'over')
  assert.equal(level(15), 'ok')
  assert.equal(level(-15), 'ok')
  assert.equal(level(-16), 'under')
  assert.equal(level(null), null)
  assert.deepEqual(verdict(timeStats(CATS, T).rows), { over: ['리서치'], under: ['제작'] })
})

test('기록이 없으면 전부 0, 판정 없음, 제안 없음', () => {
  const { total, rows } = timeStats(CATS, [])
  assert.equal(total, 0)
  assert.deepEqual(rows.map((r) => [r.actual, r.diff]), [[0, null], [0, null], [0, null], [0, null]])
  const p = proposal(CATS, [])
  assert.equal(p.biased, false)
  assert.deepEqual(p.timePlan, [])
  assert.equal(p.otherTodos, null)
})

test('모르는 카테고리(지워진 것)는 기타로', () => {
  const { rows } = timeStats(CATS, [{ category_id: 'gone', minutes: 30, date: day(0) }])
  assert.equal(rows[3].minutes, 30)
})

test('비율 조정안: 정한 비율과 실제의 중간값, 합 100', () => {
  // (40+60)/2=50, (40+20)/2=30, (20+10)/2=15 → 합 95 → 100으로 맞추면 52.6/31.6/15.8 → 53/31/16
  assert.deepEqual(proposal(CATS, T).ratioPlan, [53, 31, 16])
})

test('시간 옮기기안: |차이| × 주 평균(회고한 날 기준), 30분 단위', () => {
  // 주 평균 = 1000분 ÷ 10일 × 7 = 700분. 20% × 700 = 140분 → 150분
  const p = proposal(CATS, T)
  assert.equal(p.biased, true)
  assert.deepEqual(p.timePlan, [
    { name: '리서치', minutes: 150, more: false },
    { name: '제작', minutes: 150, more: true },
  ])
  assert.deepEqual(p.timePlan.map(planText), ['리서치 주 2시간 30분 줄이기', '제작 주 2시간 30분 더'])
})

test('시간 옮기기안: 30분 단위로 0이 되면 뺀다', () => {
  // 하루 리서치 5분 → 주 평균 35분. 리서치 +60%p × 35 = 21 → 30분, 제작 −40%p × 35 = 14 → 0, 피드백 −20%p × 35 = 7 → 0
  const p = proposal(CATS, [{ category_id: 'r', minutes: 5, date: day(0) }])
  assert.equal(p.biased, true)
  assert.deepEqual(p.timePlan, [{ name: '리서치', minutes: 30, more: false }])
})

test('새 카테고리 권유: 기타 2시간 이상 + 카테고리 5개 미만', () => {
  const other = (m: number) => [{ category_id: null, minutes: m, date: day(0) }]
  assert.equal(proposal(CATS, other(119)).otherTodos, null)
  assert.equal(proposal(CATS, other(120)).otherTodos?.length, 1)
  const five = [...CATS, { id: 'a', name: 'a', ratio: 0 }, { id: 'b', name: 'b', ratio: 0 }]
  assert.equal(proposal(five, other(300)).otherTodos, null, '5개면 권하지 않음')
})

test('새 카테고리 비율: 10%, 가장 큰 카테고리(동점이면 앞)에서', () => {
  assert.deepEqual(withNewCategory([30, 50, 20]), [30, 40, 20, 10])
  assert.deepEqual(withNewCategory([34, 33, 33]), [24, 33, 33, 10])
  assert.deepEqual(withNewCategory([40, 40, 20]), [30, 40, 20, 10])
})

test('시간 표시', () => {
  assert.equal(fmtMinutes(0), '0분')
  assert.equal(fmtMinutes(45), '45분')
  assert.equal(fmtMinutes(60), '1시간')
  assert.equal(fmtMinutes(150), '2시간 30분')
})

test('라벨 누르기: 다음 카테고리, 기타 다음은 첫 번째, 모르는 id는 첫 번째', async () => {
  const { nextCat } = await import('./cats.ts')
  assert.equal(nextCat(CATS, 'r'), 'm')
  assert.equal(nextCat(CATS, 'f'), null, '마지막 다음은 기타')
  assert.equal(nextCat(CATS, null), 'r')
  assert.equal(nextCat(CATS, 'gone'), 'r')
})

// ---- phase3: 주간 비율·주간 목표 시간·권유·카테고리 지우기 (docs/자전거 phase3 개발 계획.md) ----

test('주간 비율: 그 주 → 그 이전 가장 최근 → 핵심목표 비율, 묶음에 없는 카테고리는 0 (WG-5, D7)', () => {
  const rows = [
    { week_start: '2026-10-05', category_id: 'r', ratio: 50 },
    { week_start: '2026-10-05', category_id: 'm', ratio: 30 },
    { week_start: '2026-10-05', category_id: 'f', ratio: 20 },
    { week_start: '2026-10-19', category_id: 'r', ratio: 100 },
  ]
  const r = (ws: string) => weekBasis(CATS, rows, ws).map((c) => c.ratio)
  assert.deepEqual(r('2026-09-28'), [40, 40, 20], '그 이전 묶음이 없으면 핵심목표 비율')
  assert.deepEqual(r('2026-10-05'), [50, 30, 20], '그 주 묶음')
  assert.deepEqual(r('2026-10-12'), [50, 30, 20], '정하지 않은 주는 직전 묶음을 이어 씀')
  assert.deepEqual(r('2026-10-19'), [100, 0, 0], '묶음에 없는 카테고리는 0')
})

test('주간 목표 시간: 그 주 이전 가장 최근 값, 없으면 null', () => {
  const weeks = [
    { week_start: '2026-09-28', target_minutes: 1200 },
    { week_start: '2026-10-05', target_minutes: null },
    { week_start: '2026-10-12', target_minutes: 900 },
  ]
  assert.equal(weekTarget(weeks, '2026-09-21'), null)
  assert.equal(weekTarget(weeks, '2026-10-05'), 1200, '비어 있는 주는 이어 씀')
  assert.equal(weekTarget(weeks, '2026-10-12'), 900)
  assert.equal(weekTarget(weeks, '2026-10-26'), 900)
})

test('할 일 입력 권유: 15 넘게 덜 쓴 카테고리 중 가장 많이 덜 쓴 것, 1분 이상 할 일 중 가장 짧은 것 (D5)', () => {
  // T: 리서치 60%(+20), 제작 20%(-20), 피드백 10%(-10) → 제작만 대상
  const p = nudge(CATS, T.map((t, i) => ({ ...t, text: `t${i}` })))
  assert.equal(p?.name, '제작')
  assert.equal(p?.todo?.minutes, 80, '제작 120분·80분 중 짧은 것')
  assert.equal(nudge(CATS, []), null, '기록이 없으면 권유 없음')
  // 덜 쓴 곳이 없으면 없음: 정한 비율대로
  const even = [
    { category_id: 'r', minutes: 40, date: day(0) },
    { category_id: 'm', minutes: 40, date: day(0) },
    { category_id: 'f', minutes: 20, date: day(0) },
  ]
  assert.equal(nudge(CATS, even), null)
})

test('할 일 입력 권유: 같은 시간이면 최근, 0분은 빼고, 할 일이 없으면 카테고리만', () => {
  const t = [
    { category_id: 'r', minutes: 600, date: day(0), text: 'r' },
    { category_id: 'm', minutes: 30, date: day(1), text: '옛것' },
    { category_id: 'm', minutes: 30, date: day(3), text: '최근' },
    { category_id: 'm', minutes: 0, date: day(4), text: '0분' },
  ]
  // 리서치 91%(+51), 제작 9%(-31), 피드백 0%(-20) → 제작. 30분 둘 중 날짜가 늦은 것
  assert.equal(nudge(CATS, t)?.todo?.text, '최근')
  // 리서치만 기록: 제작 -40, 피드백 -20 → 가장 많이 덜 쓴 제작. 제작 할 일이 없으니 카테고리만
  const p = nudge(CATS, [{ category_id: 'r', minutes: 600, date: day(0), text: 'r' }])
  assert.equal(p?.name, '제작')
  assert.equal(p?.todo, null)
  // 덜 쓴 정도가 같으면 앞 카테고리: 제작·피드백 둘 다 정한 비율 30, 리서치만 기록 → 둘 다 -30
  const tie = [CATS[0], { ...CATS[1], ratio: 30 }, { ...CATS[2], ratio: 30 }]
  assert.equal(nudge(tie, [{ category_id: 'r', minutes: 60, date: day(0) }])?.name, '제작')
})

test('카테고리 지우기: 그 몫을 남은 곳에 원래 비율대로, 합 100 (D6)', () => {
  assert.deepEqual(withoutCategory([40, 40, 20], 2), [50, 50])
  assert.deepEqual(withoutCategory([50, 30, 20], 0), [60, 40])
  assert.deepEqual(withoutCategory([34, 33, 33], 0), [50, 50])
  assert.deepEqual(withoutCategory([100, 0, 0], 0), [50, 50], '남은 게 다 0%면 똑같이')
  assert.deepEqual(withoutCategory([100], 0), [])
})
