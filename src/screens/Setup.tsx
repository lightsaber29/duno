import { useState } from 'react'
import { RatioEditor } from '../components/RatioEditor'
import { COLORS } from '../lib/colors'
import { addSlice, equalSplit, removeSlice } from '../lib/ratio'
import type { PlanInput } from '../lib/db'

const EXAMPLES = ['팀 프로젝트', '직무 공부', '포트폴리오', '면접 준비', '자격증', '영어', '이력서', '네트워킹']
const STEPS = ['핵심 목표', '세부 목표', '비율 정하기', '알림 설정']

type Props = {
  /** 고치기 모드면 지금 값. 없으면 처음 설정 */
  initial?: PlanInput
  onDone: (input: PlanInput) => void
  onCancel?: () => void
}

/** 목표 설정 화면(2절). 4단계. 계획 화면의 고치기도 같은 화면을 값이 채워진 채 연다(6절). */
export function Setup({ initial, onDone, onCancel }: Props) {
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState(initial?.goal ?? '')
  const [items, setItems] = useState<PlanInput['items']>(initial?.items ?? [])
  const [ratios, setRatios] = useState<number[]>(initial?.ratios ?? [])
  // 비율을 손댔으면 더하고 뺄 때 7-4 규칙, 아니면 균등(③ 처음 들어오면 균등)
  const [touched, setTouched] = useState(!!initial)
  const [custom, setCustom] = useState('')

  const names = items.map((it) => it.name)

  function add(name: string) {
    const n = name.trim()
    if (!n || n.length > 15 || items.length >= 8 || names.includes(n)) return // ponytail: 같은 이름은 허용 안 함(문서 미정)
    setItems([...items, { name: n }])
    setRatios(touched ? addSlice(ratios) : equalSplit(items.length + 1))
  }
  function remove(i: number) {
    setItems(items.filter((_, k) => k !== i))
    setRatios(touched ? removeSlice(ratios, i) : equalSplit(items.length - 1))
  }
  function rename(i: number, name: string) {
    setItems(items.map((it, k) => (k === i ? { ...it, name: name.slice(0, 15) } : it)))
  }

  const canNext = [goal.trim().length > 0, items.length >= 2, true, true][step]

  function next() {
    if (step < 3) return setStep(step + 1)
    onDone({ goal: goal.trim(), items: items.map((it) => ({ ...it, name: it.name.trim() })), ratios, notifyAt })
  }
  const [notifyAt, setNotifyAt] = useState(initial?.notifyAt ?? '21:00')

  return (
    <main className="screen">
      <header className="step-head">
        <span>{step + 1}/4</span>
        <h1>{STEPS[step]}</h1>
      </header>

      {step === 0 && (
        <label>
          이루려는 것 한 줄
          <input value={goal} maxLength={25} autoFocus onChange={(e) => setGoal(e.target.value)} placeholder="예: 상반기에 백엔드 개발자로 취업" />
          <small>{goal.length}/25</small>
        </label>
      )}

      {step === 1 && (
        <>
          <p className="hint">시간을 나눠 쓸 일. 2개 이상 8개 이하</p>
          <div className="chips">
            {EXAMPLES.map((ex) => {
              const on = names.includes(ex)
              return (
                <button key={ex} type="button" className={on ? 'chip on' : 'chip'} onClick={() => (on ? remove(names.indexOf(ex)) : add(ex))}>
                  {ex}
                </button>
              )
            })}
          </div>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              add(custom)
              setCustom('')
            }}
          >
            <input value={custom} maxLength={15} placeholder="직접 적기 (15자)" onChange={(e) => setCustom(e.target.value)} />
            <button type="submit" disabled={!custom.trim() || items.length >= 8}>더하기</button>
          </form>
          <ul className="ratio-list">
            {items.map((it, i) => (
              <li key={it.id ?? `new-${i}`}>
                <span className="dot" style={{ background: COLORS[i] }} />
                <input className="name" value={it.name} maxLength={15} onChange={(e) => rename(i, e.target.value)} aria-label="세부 목표 이름" />
                <button type="button" className="x" onClick={() => remove(i)} aria-label="빼기">×</button>
              </li>
            ))}
          </ul>
        </>
      )}

      {step === 2 && (
        <RatioEditor
          slices={items.map((it, i) => ({ key: it.id ?? `new-${i}`, name: it.name, ratio: ratios[i], color: COLORS[i] }))}
          onChange={(r) => {
            setTouched(true)
            setRatios(r)
          }}
          center="비율 정하기"
        />
      )}

      {step === 3 && (
        <label>
          알림 시간
          <input type="time" value={notifyAt} onChange={(e) => setNotifyAt(e.target.value)} />
          <small>저녁에 작성 화면으로 부르는 시각. 지금은 저장만 합니다.</small>
        </label>
      )}

      <footer className="row">
        {step > 0 ? <button type="button" onClick={() => setStep(step - 1)}>이전</button> : onCancel ? <button type="button" onClick={onCancel}>취소</button> : <span />}
        <button type="button" className="primary" disabled={!canNext || items.some((it) => !it.name.trim())} onClick={next}>
          {step < 3 ? '다음' : '완료'}
        </button>
      </footer>
    </main>
  )
}
