import { useMemo, useState } from 'react'
import { RatioEditor } from '../components/RatioEditor'
import { COLORS, OTHER_COLOR } from '../lib/colors'
import { addOther, addSlice, largestRemainder, removeOther, removeSlice, shareMinutes } from '../lib/ratio'
import { fmtMinutes, localDate } from '../lib/format'
import type { Entry, PlanData, Share } from '../lib/db'

const OTHER = 'other'

type Props = {
  data: PlanData
  onSave: (date: string, minutes: number | null, shares: Share[]) => void
  onDelete: (date: string) => void
  onClose: () => void
}

/** 작성 화면(3절). 오늘/어제, 쓴 시간, 세부 목표 칩 + 기타, 다이얼, 저장/휴식. */
export function Write({ data, onSave, onDelete, onClose }: Props) {
  const active = data.subgoals.filter((s) => !s.removed_at)
  const today = localDate(0)
  const yesterday = localDate(-1)
  const [date, setDate] = useState(today) // 오늘·어제 외의 날도 고를 수 있다(테스트·누적 입력용. 결정 2-3 확장)
  const dayLabel = date === today ? '오늘' : date === yesterday ? '어제' : date
  const existing = useMemo(() => data.entries.find((e) => e.date === date), [data.entries, date])

  const [state, setState] = useState(() => fromEntry(existing, active.map((s) => s.id)))
  const [loadedFor, setLoadedFor] = useState(date)
  if (loadedFor !== date) {
    setLoadedFor(date)
    setState(fromEntry(existing, active.map((s) => s.id)))
  }
  const { minutes, keys, ratios } = state
  const lostShares = !!existing?.shares.some((s) => s.subgoal_id && !active.some((a) => a.id === s.subgoal_id))

  function toggle(key: string) {
    const i = keys.indexOf(key)
    if (i >= 0) {
      setState({ ...state, keys: keys.filter((k) => k !== key), ratios: key === OTHER ? removeOther(ratios) : removeSlice(ratios, i) })
      return
    }
    if (key === OTHER) {
      setState({ ...state, keys: [...keys, OTHER], ratios: addOther(ratios) })
      return
    }
    // 원 안의 자리는 계획 순서, 기타는 마지막
    const order = active.map((s) => s.id)
    const at = keys.filter((k) => k !== OTHER && order.indexOf(k) < order.indexOf(key)).length
    const nextKeys = [...keys]
    nextKeys.splice(at, 0, key)
    setState({ ...state, keys: nextKeys, ratios: addSlice(ratios, at) })
  }

  const slices = keys.map((k, i) => {
    const idx = active.findIndex((s) => s.id === k)
    return { key: k, name: k === OTHER ? '기타' : active[idx].name, ratio: ratios[i], color: k === OTHER ? OTHER_COLOR : COLORS[idx] }
  })
  const canSave = minutes >= 30 && keys.length > 0

  return (
    <main className="screen">
      <h1>{dayLabel}, 목표에 얼마나 썼나요?</h1>
      <div className="row">
        <div className="seg">
          <button type="button" className={date === today ? 'on' : ''} onClick={() => setDate(today)}>오늘</button>
          <button type="button" className={date === yesterday ? 'on' : ''} onClick={() => setDate(yesterday)}>어제</button>
        </div>
        <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="날짜" />
      </div>

      {existing?.minutes === null && <p className="hint">휴식으로 기록한 날이에요. 다시 적으면 바뀝니다.</p>}
      {lostShares && <p className="hint">이 기록에는 지금은 없는 세부 목표의 몫이 있어요. 저장하면 그 몫은 사라집니다.</p>}

      <div className="row stepper">
        <button type="button" onClick={() => setState({ ...state, minutes: Math.max(30, minutes - 30) })} disabled={minutes <= 30}>−</button>
        <strong>{fmtMinutes(minutes)}</strong>
        <button type="button" onClick={() => setState({ ...state, minutes: Math.min(1440, minutes + 30) })} disabled={minutes >= 1440}>+</button>
      </div>

      <div className="chips">
        {active.map((s, i) => (
          <button key={s.id} type="button" className={keys.includes(s.id) ? 'chip on' : 'chip'} style={{ '--c': COLORS[i] } as React.CSSProperties} onClick={() => toggle(s.id)}>
            {s.name}
          </button>
        ))}
        <button type="button" className={keys.includes(OTHER) ? 'chip on' : 'chip'} style={{ '--c': OTHER_COLOR } as React.CSSProperties} onClick={() => toggle(OTHER)}>
          기타
        </button>
      </div>

      {slices.length > 0 ? (
        <RatioEditor
          key={keys.join(',')}
          slices={slices}
          onChange={(r) => setState({ ...state, ratios: r })}
          center={fmtMinutes(minutes)}
          sub={(s) => `약 ${shareMinutes(minutes, s.ratio)}분`}
        />
      ) : (
        <p className="hint">오늘 손댄 세부 목표를 누르세요.</p>
      )}

      <footer className="row">
        <button type="button" onClick={onClose}>닫기</button>
        {existing && <button type="button" className="danger" onClick={() => onDelete(date)}>이 기록 지우기</button>}
        <button type="button" onClick={() => onSave(date, null, [])}>휴식</button>
        <button type="button" className="primary" disabled={!canSave} onClick={() => onSave(date, minutes, keys.map((k, i) => ({ subgoal_id: k === OTHER ? null : k, ratio: ratios[i] })))}>
          저장
        </button>
      </footer>
    </main>
  )
}

/** 이미 적은 날이면 값을 채운다. 지금 없는 세부 목표의 몫은 빼고 나머지를 100으로 맞춘다. */
function fromEntry(e: Entry | undefined, activeIds: string[]) {
  if (!e || e.minutes === null) return { minutes: 30, keys: [] as string[], ratios: [] as number[] }
  const kept = activeIds.map((id) => e.shares.find((s) => s.subgoal_id === id)).filter((s): s is Share => !!s)
  const other = e.shares.find((s) => s.subgoal_id === null)
  const shares = other ? [...kept, other] : kept
  return {
    minutes: e.minutes,
    keys: shares.map((s) => s.subgoal_id ?? OTHER),
    ratios: largestRemainder(shares.map((s) => s.ratio)),
  }
}
