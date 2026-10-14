import { useState } from 'react'
import { Dial, type Slice } from './Dial'
import { diff, equalSplit, setByInput } from '../lib/ratio'

type Props = {
  slices: Slice[]
  onChange: (ratios: number[]) => void
  center?: string
  /** 조각마다 보조 글(예: "약 54분"). 다이얼 가운데와 목록 줄에 같이 쓴다 */
  sub?: (s: Slice) => string
}

/**
 * 다이얼 + 목록(색 점·이름·% 숫자 칸) + 균등 배분 + 바뀐 내용 안내.
 * 목표 설정 ③과 작성 화면이 같이 쓴다(7절).
 */
export function RatioEditor({ slices, onChange, center, sub }: Props) {
  const [selected, setSelected] = useState<string | null>(slices[0]?.key ?? null)
  const [note, setNote] = useState('')
  const ratios = slices.map((s) => s.ratio)

  function apply(next: number[]) {
    const changed = diff(ratios, next)
    if (!changed.length) return
    setNote(changed.map(([i, b, a]) => `${slices[i].name} ${b}% → ${a}%`).join(', '))
    onChange(next)
  }

  return (
    <div className="ratio-editor">
      <Dial slices={slices} selected={selected} onSelect={setSelected} onDrag={apply} center={center} centerSub={sub} />
      <p className="dial-note">{note || ' '}</p>
      <ul className="ratio-list">
        {slices.map((s, i) => (
          <li key={s.key} className={selected === s.key ? 'selected' : ''} onClick={() => setSelected(selected === s.key ? null : s.key)}>
            <span className="dot" style={{ background: s.color }} />
            <span className="name">{s.name}</span>
            {sub && <span className="sub">{sub(s)}</span>}
            <RatioInput value={s.ratio} onCommit={(v) => apply(setByInput(ratios, i, v))} />
          </li>
        ))}
      </ul>
      <button type="button" disabled={slices.length < 2} onClick={() => apply(equalSplit(slices.length))}>
        균등 배분
      </button>
    </div>
  )
}

/** 숫자 칸. 입력 중엔 글자 그대로 두고 blur·Enter에서 규칙(7-2)을 적용한다. */
function RatioInput({ value, onCommit }: { value: number; onCommit: (raw: string) => void }) {
  const [text, setText] = useState<string | null>(null)
  return (
    <span className="pct">
      <input
        inputMode="numeric"
        value={text ?? value}
        onFocus={() => setText(String(value))}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { if (text !== null) onCommit(text); setText(null) }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        onClick={(e) => e.stopPropagation()}
        aria-label="비율 %"
      />
      %
    </span>
  )
}
