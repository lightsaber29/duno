import { useState } from 'react'
import { RatioEditor } from '../components/RatioEditor'
import { COLORS } from '../lib/colors'
import { addSlice, equalSplit, removeSlice } from '../lib/ratio'
import type { PlanInput } from '../lib/db'

const EXAMPLES = ['직무 역량', '실무 경험', '어학', '툴 공부', '포트폴리오', '자소서', '면접 준비', '기업 분석']
const STEPS = ['핵심 목표', '세부 목표', '비율 정하기', '알림 설정']
const TITLES = ['어떤 목표를 이루고 싶어?', '목표를 이루려면 뭘 채워야 할까?', '시간을 어떻게 나눠 쓰고 싶어?', '언제 기록할까?']
const HINTS = [
  '한 줄이면 충분해. 25자까지 적을 수 있어.',
  '세부 목표를 2개 이상 골라 줘. 직접 적어도 돼.',
  '목표에 쓰는 시간 전체를 100%로 보고 나눠 봐. 조각을 누르고 끝의 동그라미를 끌거나 숫자를 직접 바꾸면 돼.',
  '저녁에 작성 화면으로 부르는 시각. 지금은 저장만 해.',
]

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
        <div className="n">
          <b>{step + 1}/4</b>
          <span className="label">{STEPS[step]}</span>
        </div>
        <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1} aria-valuetext={`4단계 중 ${step + 1}단계, ${STEPS[step]}`}>
          {STEPS.map((n, i) => <span key={n} className={i <= step ? 'on' : ''} />)}
        </div>
      </header>
      <div className="stack">
        <h1>{TITLES[step]}</h1>
        <p className="hint">{HINTS[step]}</p>
      </div>

      {step === 0 && (
        <div className="field">
          <label className="label" htmlFor="goal">핵심 목표</label>
          <div className="box card">
            <input id="goal" type="text" value={goal} maxLength={25} autoFocus onChange={(e) => setGoal(e.target.value)} placeholder="예: 내년 상반기에 원하는 직무로 취업" />
            <small>{goal.length}/25</small>
          </div>
        </div>
      )}

      {step === 1 && (
        <>
          <div className="chips" role="group" aria-label="세부 목표 고르기">
            {EXAMPLES.map((ex) => {
              const i = names.indexOf(ex)
              const on = i >= 0
              return (
                <button key={ex} type="button" className={on ? 'chip on' : 'chip'} aria-pressed={on} onClick={() => (on ? remove(i) : add(ex))}>
                  {on && <span className="dot" style={{ background: COLORS[i] }} />}
                  {ex}
                </button>
              )
            })}
          </div>
          <form
            className="field"
            onSubmit={(e) => {
              e.preventDefault()
              add(custom)
              setCustom('')
            }}
          >
            <label className="label" htmlFor="custom">직접 적기</label>
            <div className="row">
              <input id="custom" type="text" style={{ flex: 1, minWidth: 0 }} value={custom} maxLength={15} placeholder="예: 코딩 테스트" onChange={(e) => setCustom(e.target.value)} />
              <button type="submit" style={{ height: 48 }} disabled={!custom.trim() || items.length >= 8}>추가</button>
            </div>
          </form>
          <section className="stack" style={{ gap: 10 }}>
            <b style={{ fontSize: 14 }}>고른 세부 목표 <span className="sub" style={{ color: 'inherit' }}>{items.length}개 · 최대 8개</span></b>
            <ul className="list card">
              {items.map((it, i) => (
                <li key={it.id ?? `new-${i}`}>
                  <span className="dot" style={{ background: COLORS[i] }} />
                  <input className="name" value={it.name} maxLength={15} onChange={(e) => rename(i, e.target.value)} aria-label="세부 목표 이름" />
                  <button type="button" className="x" onClick={() => remove(i)} aria-label={`${it.name} 빼기`}>×</button>
                </li>
              ))}
            </ul>
          </section>
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
        <div className="field">
          <label className="label" htmlFor="notify">알림 시간</label>
          <input id="notify" type="time" value={notifyAt} onChange={(e) => setNotifyAt(e.target.value)} />
        </div>
      )}

      <footer className="row" style={{ marginTop: 'auto' }}>
        {step > 0 ? <button type="button" onClick={() => setStep(step - 1)}>이전</button> : onCancel && <button type="button" onClick={onCancel}>취소</button>}
        <button type="button" className="primary" disabled={!canNext || items.some((it) => !it.name.trim())} onClick={next}>
          {step < 3 ? '다음' : '완료'}
        </button>
      </footer>
    </main>
  )
}
