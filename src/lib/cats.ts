// 카테고리 라벨: 이름·색·바꾸기. 기타는 category_id = null (지워진 카테고리도 기타로)
import type { Category } from './db.ts'

export const catName = (cats: Category[], id: string | null) => cats.find((c) => c.id === id)?.name ?? '기타'

/** 순서대로 5색(--c0~4 글자, --s0~4 바탕), 기타는 회색 */
export function catStyle(cats: Category[], id: string | null) {
  const i = cats.findIndex((c) => c.id === id)
  return i < 0 ? { background: 'var(--sg)', color: 'var(--cg)' } : { background: `var(--s${i % 5})`, color: `var(--c${i % 5})` }
}

/** 라벨을 누르면 다음 카테고리로. 기타 다음은 첫 번째, 모르는 id도 첫 번째 */
export function nextCat(cats: Category[], id: string | null): string | null {
  const ids = [...cats.map((c) => c.id), null]
  return ids[(ids.indexOf(id) + 1) % ids.length]
}
