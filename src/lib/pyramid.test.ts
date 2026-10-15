// 실행: npm test
// 규칙 근거: docs/킥보드 phase2.md "계산 규칙", docs/킥보드 phase2 개발 계획.md "계산"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { equalSplit } from './ratio.ts'
import { coreAfter, fmtMinutes, level, nudge, timeStats, verdict, weekBasis, weekTarget } from './pyramid.ts'

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

test('편향 경계: 절댓값 15 이상이면 더/덜, 14는 계획대로 (phase4 BI-4·5)', () => {
  assert.equal(level(15), 'over')
  assert.equal(level(14), 'ok')
  assert.equal(level(-14), 'ok')
  assert.equal(level(-15), 'under')
  assert.equal(level(null), null)
  assert.deepEqual(verdict(timeStats(CATS, T).rows), { over: ['리서치'], under: ['제작'] })
})

test('기록이 없으면 전부 0, 판정 없음', () => {
  const { total, rows } = timeStats(CATS, [])
  assert.equal(total, 0)
  assert.deepEqual(rows.map((r) => [r.actual, r.diff]), [[0, null], [0, null], [0, null], [0, null]])
})

test('모르는 카테고리는 기타로', () => {
  const { rows } = timeStats(CATS, [{ category_id: 'unknown', minutes: 30, date: day(0) }])
  assert.equal(rows[3].minutes, 30)
})

test('지운 카테고리 시간은 전체(분모)에만, 어느 칸에도 안 보임 (TD-4)', () => {
  const t = [
    { category_id: 'r', minutes: 60, date: day(0) },
    { category_id: 'x', minutes: 40, date: day(0) }, // 지운 카테고리
  ]
  const { total, rows } = timeStats(CATS, t, ['x'])
  assert.equal(total, 100)
  assert.deepEqual(rows.map((r) => [r.name, r.minutes, r.actual]), [['리서치', 60, 60], ['제작', 0, 0], ['피드백', 0, 0], ['기타', 0, 0]], '기타에도 안 들어감')
  assert.equal(rows[0].diff, 20, '실제 60% − 정한 40%')
})

test('시간 표시', () => {
  assert.equal(fmtMinutes(0), '0분')
  assert.equal(fmtMinutes(45), '45분')
  assert.equal(fmtMinutes(60), '1시간')
  assert.equal(fmtMinutes(150), '2시간 30분')
})

// ---- phase3: 주간 비율·주간 목표 시간·권유·카테고리 지우기 (docs/자전거 phase3 개발 계획.md) ----

test('주간 비율: 그 주에 정한 묶음, 없으면 핵심목표 비율(이어 쓰지 않음), 묶음에 없는 카테고리는 0 (phase4 WG-5)', () => {
  const rows = [
    { week_start: '2026-10-05', category_id: 'r', ratio: 50 },
    { week_start: '2026-10-05', category_id: 'm', ratio: 30 },
    { week_start: '2026-10-05', category_id: 'f', ratio: 20 },
    { week_start: '2026-10-19', category_id: 'r', ratio: 100 },
  ]
  const r = (ws: string) => weekBasis(CATS, rows, ws).map((c) => c.ratio)
  assert.deepEqual(r('2026-09-28'), [40, 40, 20], '그 이전 묶음이 없으면 핵심목표 비율')
  assert.deepEqual(r('2026-10-05'), [50, 30, 20], '그 주 묶음')
  assert.deepEqual(r('2026-10-12'), [40, 40, 20], '정하지 않은 주는 핵심목표 비율(직전 묶음을 이어 쓰지 않음)')
  assert.deepEqual(r('2026-10-19'), [100, 0, 0], '묶음에 없는 카테고리는 0')
})

test('주간 목표 시간: 그 주 이전 가장 최근 값, 없으면 null', () => {
  const weeks = [
    { week_start: '2026-09-28', target_minutes: 1200 },
    { week_start: '2026-10-05', target_minutes: null },
    { week_start: '2026-10-12', target_minutes: 900 },
    { week_start: '2026-10-19' }, // 값이 아예 없는 행도 비어 있는 것으로
  ]
  assert.equal(weekTarget(weeks, '2026-09-21'), null)
  assert.equal(weekTarget(weeks, '2026-10-05'), 1200, '비어 있는 주는 이어 씀')
  assert.equal(weekTarget(weeks, '2026-10-12'), 900)
  assert.equal(weekTarget(weeks, '2026-10-26'), 900, '값 없는 10/19 행은 건너뛰고 이어 씀')
})

test('할 일 입력 권유: 15 이상 덜 쓴 카테고리 중 편향이 가장 큰 것, 1분 이상 할 일 중 가장 짧은 것 (NU-2~4)', () => {
  // T: 리서치 60%(+20), 제작 20%(-20), 피드백 10%(-10) → 제작만 대상
  const p = nudge(CATS, T.map((t, i) => ({ ...t, text: `t${i}` })))
  assert.equal(p?.name, '제작')
  assert.equal(p?.todo?.minutes, 80, '제작 120분·80분 중 짧은 것')
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

test('카테고리 지우고 더한 뒤 핵심목표 비율: 지운 몫은 원래 비율대로, 새 것은 0 (D6)', () => {
  assert.deepEqual(coreAfter([40, 40, 20], [false, false, true], 0), [50, 50])
  assert.deepEqual(coreAfter([50, 30, 20], [true, false, false], 0), [60, 40])
  assert.deepEqual(coreAfter([34, 33, 33], [true, false, false], 1), [50, 50, 0], '새 카테고리는 0%')
  assert.deepEqual(coreAfter([60, 30, 10], [false, true, true], 0), [100], '여럿 지우기')
  assert.deepEqual(coreAfter([100, 0, 0], [true, false, false], 0), [50, 50], '남은 게 다 0%면 똑같이')
  assert.deepEqual(coreAfter([40, 40, 20], [false, false, false], 0), [40, 40, 20], '바꾼 게 없으면 그대로')
})


test('할 일 입력 권유: 기록이 0이어도 진입 직후부터, 핵심목표 비율 15 이상 중 가장 큰 카테고리만 (NU-2)', () => {
  const p = nudge(CATS, [])
  assert.deepEqual(p && [p.name, p.todo], ['리서치', null], '40·40·20 중 같으면 앞')
  assert.equal(nudge([{ id: 'a', name: 'a', ratio: 90 }, { id: 'b', name: 'b', ratio: 10 }], [])?.name, 'a')
  assert.equal(nudge([{ id: 'a', name: 'a', ratio: 14 }, { id: 'b', name: 'b', ratio: 14 }, { id: 'c', name: 'c', ratio: 72 }].slice(0, 2), []), null, '15 미만뿐이면 없음')
})

test('할 일 입력 권유: 지운 카테고리 시간은 분모에만 (TD-4)', () => {
  // 리서치 30 + 지운 70 → 리서치 30%(-10) 계획대로, 제작 0%(-40) 덜, 피드백 0%(-20) 덜 → 제작
  const p = nudge(CATS, [{ category_id: 'r', minutes: 30, date: day(0) }, { category_id: 'x', minutes: 70, date: day(0) }], ['x'])
  assert.equal(p?.name, '제작')
})
