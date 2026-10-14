// 실행: node --test src/lib/ratio.test.ts
// 예시는 전부 duno-screens-and-rules.md 7-2, 7-3, 7-4, 8절에서 그대로 가져왔다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  actualRatios, addOther, addSlice, dragBoundary, equalSplit, largestRemainder,
  removeOther, removeSlice, setByInput, shareMinutes, totalMinutes,
} from './ratio.ts'

test('균등 배분: 남는 몫은 앞부터', () => {
  assert.deepEqual(equalSplit(3), [34, 33, 33])
  assert.deepEqual(equalSplit(1), [100])
  assert.deepEqual(equalSplit(8), [13, 13, 13, 13, 12, 12, 12, 12])
})

test('7-2 숫자 칸: 35/30/25/7/3 예시 7개', () => {
  const r = [35, 30, 25, 7, 3]
  assert.deepEqual(setByInput(r, 2, 40), [35, 15, 40, 7, 3], '앞에서 15')
  assert.deepEqual(setByInput(r, 2, 55), [35, 5, 52, 5, 3], '앞 25, 다음 2, 둘 다 5에서 멈춤')
  assert.deepEqual(setByInput(r, 2, 15), [35, 40, 15, 7, 3], '줄인 10을 앞에')
  assert.deepEqual(setByInput(r, 0, 50), [50, 15, 25, 7, 3], '첫 조각은 다음에서')
  assert.deepEqual(setByInput(r, 4, 10), [35, 30, 25, 5, 5], '마지막은 앞에서, 5에서 멈춤')
  assert.deepEqual(setByInput(r, 0, 0), [1, 64, 25, 7, 3], '1로 맞추고 나머지를 다음에')
  assert.deepEqual(setByInput(r, 4, 1), [35, 30, 25, 9, 1], '줄인 2를 앞에')
})

test('7-2 숫자 칸: 소수 버림, 빈 값은 원래대로, 하나면 100', () => {
  assert.deepEqual(setByInput([50, 50], 0, '33.9'), [33, 67])
  assert.deepEqual(setByInput([50, 50], 0, ''), [50, 50])
  assert.deepEqual(setByInput([50, 50], 0, 'abc'), [50, 50])
  assert.deepEqual(setByInput([100], 0, 30), [100])
})

test('7-3 작성 화면 칩 더하고 빼기', () => {
  let r: number[] = []
  r = addSlice(r); r = addSlice(r); r = addSlice(r)
  assert.deepEqual(r, [34, 33, 33], 'a, b, c 차례로')
  r = addOther(r)
  assert.deepEqual(r, [34, 33, 32, 1], '기타 더함')
  r = addSlice(r, 3)
  assert.deepEqual(r, [27, 26, 26, 20, 1], 'd 더함')
  r = removeSlice(r, 0)
  assert.deepEqual(r, [36, 36, 27, 1], 'a 뺌')
  assert.deepEqual(addSlice([100], 0), [50, 50], '기타만 있는데 하나 더함')
  assert.deepEqual(removeOther([34, 33, 32, 1]), [34, 33, 33], '기타 빼면 앞에 돌려줌')
  assert.deepEqual(addOther([50, 49, 1]), [50, 48, 1, 1], '앞이 1%면 그 앞에서')
})

test('7-4 계획 고칠 때', () => {
  const r = [35, 30, 25, 10]
  assert.deepEqual(removeSlice(r, 2), [47, 40, 13])
  assert.deepEqual(addSlice([47, 40, 13]), [35, 30, 10, 25])
  assert.deepEqual(addSlice(removeSlice(r, 3)), [29, 25, 21, 25], '하나 빼고 다시 넣으면')
})

test('7-1 끌기: 양쪽 두 조각만, 바닥 1%', () => {
  assert.deepEqual(dragBoundary([34, 33, 33], 0, 10), [44, 23, 33])
  assert.deepEqual(dragBoundary([34, 33, 33], 0, 50), [66, 1, 33], '이웃이 1%에서 멈춤')
  assert.deepEqual(dragBoundary([34, 33, 33], 0, -50), [1, 66, 33])
  assert.deepEqual(dragBoundary([34, 33, 33], 2, 5), [29, 33, 38], '마지막은 첫 조각과')
})

test('최대 나머지: 동점이면 앞 조각 먼저', () => {
  assert.deepEqual(largestRemainder([1, 1, 1, 1, 1, 1]), [17, 17, 17, 17, 16, 16])
  assert.deepEqual(largestRemainder([0, 0], 100, 0), [0, 0])
})

test('8절 실제 비율: 휴식은 0, 기타 포함', () => {
  assert.equal(shareMinutes(90, 60), 54)
  const m = totalMinutes([
    { minutes: 120, shares: [{ key: 'a', ratio: 50 }, { key: 'b', ratio: 50 }] },
    { minutes: null, shares: [] },
    { minutes: 60, shares: [{ key: 'a', ratio: 90 }, { key: 'other', ratio: 10 }] },
  ])
  assert.deepEqual([...m], [['a', 114], ['b', 60], ['other', 6]])
  assert.deepEqual([...actualRatios(m)], [['a', 64], ['b', 33], ['other', 3]])
  assert.deepEqual([...actualRatios(new Map([['a', 0]]))], [['a', 0]])
})
