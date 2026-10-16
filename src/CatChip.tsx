import { useState } from 'react'
import type { Category } from './lib/db'
import { catName, catStyle } from './lib/cats'

type PicksProps = { cats: Category[]; value: string | null; onPick: (id: string | null) => void; label?: string; className?: string }

/** 카테고리 고르기 줄: 카테고리들 + 기타. 할 일 입력 위와 라벨을 눌렀을 때 같이 쓴다 */
export function CatPicks({ cats, value, onPick, label = '카테고리 고르기', className = '' }: PicksProps) {
  return (
    <div className={'picks ' + className} role="group" aria-label={label}>
      {[...cats.map((c) => c.id), null].map((id) => (
        <button key={id ?? 'etc'} type="button" className="pick" style={catStyle(cats, id)} aria-pressed={value === id} onClick={() => onPick(id)}>
          {catName(cats, id)}
        </button>
      ))}
    </div>
  )
}

type ChipProps = { id: string | null; cats: Category[]; named: Category[]; onPick: (id: string | null) => void }

/**
 * 할 일의 카테고리 라벨. 누르면 바로 아래에 고르기 줄이 펼쳐지고 하나 고르면 바뀐다(피드백 D2).
 * 누를 때마다 다음 카테고리로 돌던 방식은 5개면 최대 5번 눌러야 하고 지나치면 되돌릴 수 없었다.
 * named: 지운 카테고리 포함, 라벨 이름용(원래 이름에 회색, TD-3)
 */
export function CatChip({ id, cats, named, onPick }: ChipProps) {
  const [open, setOpen] = useState(false)
  const name = catName(named, id)
  return (
    <>
      <button type="button" className="chip" style={catStyle(cats, id)} aria-expanded={open} aria-label={`카테고리 바꾸기: 지금 ${name}`} onClick={() => setOpen(!open)}>
        {name}
      </button>
      {open && (
        <CatPicks
          cats={cats}
          value={id}
          label="카테고리 바꾸기"
          className="chip-picks"
          onPick={(v) => {
            setOpen(false)
            if (v !== id) onPick(v)
          }}
        />
      )}
    </>
  )
}
