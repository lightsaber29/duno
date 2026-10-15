import { useState } from 'react'
import { createSetup, type Setup } from './lib/db'
import { equalSplit } from './lib/ratio'
import { targetMinutes, today, weekStart } from './lib/week'

type Props = { onDone: (s: Setup) => void; onError: (e: unknown) => void }
type Row = { name: string; ratio: number }

/**
 * 진입: 핵심목표 한 줄 → 카테고리 최대 5개와 핵심목표 비율 → 주간 목표 시간(phase3 ON-5). 건너뛸 수 없다.
 * 문구는 프로토타입(킥보드 phase2.html)을 반말로, "영역"은 "카테고리"로
 */
export function Onboard({ onDone, onError }: Props) {
  const [step, setStep] = useState(1)
  const [goal, setGoal] = useState('')
  const [rows, setRows] = useState<Row[]>(() => equalSplit(3).map((ratio) => ({ name: '', ratio })))
  const [hours, setHours] = useState('20') // 주간 목표 시간
  const [busy, setBusy] = useState(false)

  const total = rows.reduce((a, r) => a + r.ratio, 0)
  const ready = total === 100 && rows.every((r) => r.name.trim())
  /** 더하거나 빼면 다시 똑같이 나눈다 */
  const even = (rs: Row[]) => equalSplit(rs.length).map((ratio, i) => ({ ...rs[i], ratio }))
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  async function start() {
    setBusy(true)
    try {
      const target = { week: weekStart(today()), minutes: targetMinutes(hours)! }
      onDone(await createSetup(goal.trim(), rows.map((r) => ({ name: r.name.trim(), ratio: r.ratio })), target, today()))
    } catch (e) {
      onError(e)
      setBusy(false)
    }
  }

  if (step === 1)
    return (
      <form
        className="flow"
        onSubmit={(e) => {
          e.preventDefault()
          if (goal.trim()) setStep(2)
        }}
      >
        <div className="c-top">
          <span>시작하기 1 / 3</span>
        </div>
        <h1 className="f-h">어떤 사람이 되고 싶어?</h1>
        <p className="c-note">끝나지 않는 지향점이야. 한 줄로 적어 줘. 메인 화면 맨 위에 늘 보여.</p>
        <input
          type="text"
          className="f-big"
          maxLength={30}
          value={goal}
          placeholder="예: 나다운 일로 먹고사는 사람"
          aria-label="핵심목표"
          onChange={(e) => setGoal(e.target.value)}
        />
        <button type="submit" className="c-main primary" disabled={!goal.trim()}>다음</button>
      </form>
    )

  if (step === 2)
    return (
      <main className="flow">
        <div className="c-top">
          <button type="button" onClick={() => setStep(1)}>‹ 이전</button>
          <span>시작하기 2 / 3</span>
        </div>
        <h1 className="f-h">핵심목표를 위해 시간을 어디에 쓰고 싶어?</h1>
        <p className="c-note">카테고리는 최대 5개. %는 내 시간 중 그 카테고리에 쓰고 싶은 비율이야. 똑같이 나눠 뒀으니 원하는 대로 고쳐.</p>
        {rows.map((r, i) => (
          <div key={i} className="ob-row">
            <input
              type="text"
              maxLength={8}
              value={r.name}
              placeholder="카테고리 이름"
              aria-label={`카테고리 ${i + 1} 이름`}
              onChange={(e) => set(i, { name: e.target.value })}
            />
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={r.ratio}
              aria-label={`카테고리 ${i + 1} 시간 비율`}
              onChange={(e) => set(i, { ratio: Math.max(0, Math.min(100, Math.floor(+e.target.value || 0))) })}
            />
            %
            <button type="button" className="x" aria-label={`카테고리 ${i + 1} 삭제`} disabled={rows.length <= 1} onClick={() => setRows((rs) => even(rs.filter((_, j) => j !== i)))}>
              ×
            </button>
          </div>
        ))}
        <div className="ob-btns">
          <button type="button" disabled={rows.length >= 5} onClick={() => setRows((rs) => even([...rs, { name: '', ratio: 0 }]))}>+ 카테고리 추가</button>
          <button type="button" onClick={() => setRows(even)}>똑같이 나누기</button>
        </div>
        <p className={'ob-sum' + (total === 100 ? '' : ' bad')} aria-live="polite">
          합계 {total}%{total === 100 ? '' : ' · 100%로 맞춰 줘'}
        </p>
        <p className="c-note">어디에도 안 맞는 일은 "기타"로 모여. 기타는 5개에 들어가지 않아.</p>
        <button type="button" className="c-main primary" disabled={!ready} onClick={() => setStep(3)}>다음</button>
      </main>
    )

  const minutes = targetMinutes(hours)
  return (
    <form
      className="flow"
      onSubmit={(e) => {
        e.preventDefault()
        if (minutes && !busy) start()
      }}
    >
      <div className="c-top">
        <button type="button" onClick={() => setStep(2)}>‹ 이전</button>
        <span>시작하기 3 / 3</span>
      </div>
      <h1 className="f-h">일주일에 핵심목표를 위해 몇 시간 쓸 거야?</h1>
      <p className="c-note">비율이 치우쳤더라도 그 주에 일을 했는지 보는 기준이야. 매주 같은 값으로 쓰고, 주간 마감에서 바꿀 수 있어.</p>
      <label className="ob-row">
        <input
          type="number"
          inputMode="decimal"
          min={1}
          max={100}
          step={0.5}
          value={hours}
          aria-label="주간 목표 시간"
          onChange={(e) => setHours(e.target.value)}
        />
        시간
      </label>
      {minutes === null && <p className="ob-sum bad">1시간부터 100시간까지, 0.5시간 단위로 적어 줘</p>}
      <button type="submit" className="c-main primary" disabled={minutes === null || busy}>시작하기</button>
    </form>
  )
}
