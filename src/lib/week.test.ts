// 실행: npm test
// 규칙 근거: docs/스케이트보드 phase1.md "확정 사항", docs/스케이트보드 phase1 개발 계획.md
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, rate, targetMinutes, shouldClose, weekDays, weekKind, weekRange, weekStart } from './week.ts'

test('주 시작은 월요일: 월·수·일 모두 같은 월요일', () => {
  assert.equal(weekStart('2026-10-12'), '2026-10-12') // 월
  assert.equal(weekStart('2026-10-15'), '2026-10-12') // 목
  assert.equal(weekStart('2026-10-18'), '2026-10-12') // 일
  assert.equal(weekStart('2026-10-19'), '2026-10-19') // 다음 월
})

test('달·해 넘김', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2027-03-01', -1), '2027-02-28')
  assert.equal(weekStart('2027-01-01'), '2026-12-28') // 금 → 지난해 월요일
  assert.deepEqual(weekDays('2026-12-28'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'])
  assert.equal(weekRange('2026-12-28'), '12/28 – 1/3')
})

test('지난주·이번 주·다음 주', () => {
  const t = '2026-10-18' // 일요일 = 아직 이번 주
  assert.equal(weekKind('2026-10-05', t), 'past')
  assert.equal(weekKind('2026-10-12', t), 'current')
  assert.equal(weekKind('2026-10-19', t), 'future')
})

test('완료율: 그 주 전체 중 체크한 비율, 반올림, 없으면 0', () => {
  const d = (done: boolean) => ({ done })
  assert.deepEqual(rate([]), { total: 0, done: 0, pct: 0 })
  assert.deepEqual(rate([d(true), d(false), d(false)]), { total: 3, done: 1, pct: 33 })
  assert.deepEqual(rate([d(true), d(true), d(false)]), { total: 3, done: 2, pct: 67 })
  assert.deepEqual(rate([d(true)]), { total: 1, done: 1, pct: 100 })
})

test('마감 흐름을 띄울지', () => {
  assert.equal(shouldClose(null, 0), false) // 지난주 아무것도 없음 (처음 쓰는 주)
  assert.equal(shouldClose(null, 3), true) // 할 일만 있음
  assert.equal(shouldClose({ goal: '목표', closed_at: null }, 0), true) // 목표만 있음
  assert.equal(shouldClose({ goal: '', closed_at: null }, 0), false)
  assert.equal(shouldClose({ goal: '목표', closed_at: '2026-10-19T00:00:00Z' }, 3), false) // 이미 끝냄·건너뜀
})

test('주간 목표 시간 입력: 0.5시간 단위, 1~100시간 (phase3 ON-5)', () => {
  assert.equal(targetMinutes('20'), 1200)
  assert.equal(targetMinutes('7.5'), 450)
  assert.equal(targetMinutes('1'), 60)
  assert.equal(targetMinutes('100'), 6000)
  assert.equal(targetMinutes('0.5'), null, '1시간 미만')
  assert.equal(targetMinutes('100.5'), null)
  assert.equal(targetMinutes('7.3'), null, '0.5 단위가 아님')
  assert.equal(targetMinutes(''), null)
  assert.equal(targetMinutes('abc'), null)
})
