import { useEffect, useMemo, useState } from 'react'
import { Dial } from '../components/Dial'
import { COLORS, OTHER_COLOR } from '../lib/colors'
import { actualRatios, totalMinutes } from '../lib/ratio'
import { fmtDiff, fmtMinutes, localDate } from '../lib/format'
import type { PlanData } from '../lib/db'

const PREV_COLOR = 'var(--prev)'

type Props = { data: PlanData; onWrite: () => void; onView: () => void }

/** 현재 상태 화면(4절). 최근 1주(%)/총 시간(누적), 띠그래프/원그래프. 진행 정도 화면은 총 시간 보기로 합쳤다. */
export function Status({ data, onWrite, onView }: Props) {
  const [period, setPeriod] = useState<'week' | 'all'>('week')
  const [chart, setChart] = useState<'bar' | 'pie'>('bar')
  useEffect(onView, [onView])

  const active = data.subgoals.filter((s) => !s.removed_at)
  const since = localDate(-6)
  const entries = useMemo(() => (period === 'week' ? data.entries.filter((e) => e.date >= since) : data.entries), [data.entries, period, since])

  // 세부 목표별 누적 분. 지금 없는 세부 목표는 'prev'로, 기타는 'other'로 묶는다
  const minutes = useMemo(() => {
    const raw = totalMinutes(entries.map((e) => ({ minutes: e.minutes, shares: e.shares.map((s) => ({ key: s.subgoal_id ?? 'other', ratio: s.ratio })) })))
    const m = new Map<string, number>(active.map((s) => [s.id, 0]))
    m.set('prev', 0)
    m.set('other', 0)
    for (const [k, v] of raw) m.set(m.has(k) ? k : 'prev', (m.get(m.has(k) ? k : 'prev') ?? 0) + v)
    return m
  }, [entries, active])
  const total = [...minutes.values()].reduce((a, b) => a + b, 0)
  const actual = actualRatios(minutes)
  const hasRecords = entries.some((e) => e.minutes !== null)

  const rows = active.map((s, i) => ({ key: s.id, name: s.name, color: COLORS[i], plan: s.ratio, actual: actual.get(s.id) ?? 0, min: minutes.get(s.id) ?? 0 }))
  const extra = [
    { key: 'prev', name: '이전 세부 목표', color: PREV_COLOR, actual: actual.get('prev') ?? 0, min: minutes.get('prev') ?? 0 },
    { key: 'other', name: '기타', color: OTHER_COLOR, actual: actual.get('other') ?? 0, min: minutes.get('other') ?? 0 },
  ].filter((r) => r.min > 0)
  // 계획보다 가장 많이 넘친 세부 목표. 띠에 이름을 붙이고 한 줄 문장을 만든다
  const top = hasRecords ? rows.reduce<(typeof rows)[number] | null>((t, r) => (r.actual > r.plan && (!t || r.actual - r.plan > t.actual - t.plan) ? r : t), null) : null

  const planSlices = rows.map((r) => ({ key: r.key, name: r.name, ratio: r.plan, color: r.color }))
  const actualSlices = [...rows, ...extra].filter((r) => r.actual > 0).map((r) => ({ key: r.key, name: r.name, ratio: r.actual, color: r.color }))

  return (
    <main className="screen">
      <div className="stack" style={{ gap: 4 }}>
        <span className="label">핵심 목표</span>
        <h1 style={{ fontSize: 20 }}>{data.plan.goal}</h1>
      </div>
      <div className="row">
        <div className="seg" role="group" aria-label="기간">
          <button type="button" className={period === 'week' ? 'on' : ''} onClick={() => setPeriod('week')}>최근 1주</button>
          <button type="button" className={period === 'all' ? 'on' : ''} onClick={() => setPeriod('all')}>총 시간</button>
        </div>
        {period === 'week' && (
          <button type="button" className="link" style={{ marginLeft: 'auto' }} onClick={() => setChart(chart === 'bar' ? 'pie' : 'bar')}>
            {chart === 'bar' ? '원그래프로 보기' : '띠그래프로 보기'}
          </button>
        )}
      </div>

      {period === 'week' ? (
        <>
          {chart === 'bar' ? (
            <div className="bars">
              <span className="label">계획</span>
              <Bar slices={planSlices} named={top?.key} />
              <span className="label">실제</span>
              {hasRecords ? <Bar slices={actualSlices} named={top?.key} /> : <Empty onWrite={onWrite} />}
            </div>
          ) : (
            <div className="pies">
              <div><small>계획</small><Dial slices={planSlices} selected={null} onSelect={() => {}} onDrag={() => {}} size={150} /></div>
              <div><small>실제</small>{hasRecords ? <Dial slices={actualSlices} selected={null} onSelect={() => {}} onDrag={() => {}} size={150} /> : <Empty onWrite={onWrite} />}</div>
            </div>
          )}
          {top && (
            <div className="insight card">
              <p>최근 1주 동안 <b>{top.name}</b>에 시간이 많이 갔네</p>
              <small>계획은 {top.plan}%였는데 {top.actual}%를 썼어</small>
            </div>
          )}
          <ul className="list">
            {rows.map((r) => (
              <li key={r.key} className={r.key === top?.key ? 'top' : ''}>
                <span className="dot" style={{ background: r.color }} />
                <span className="name" style={{ flex: 'none' }}>{r.name}</span>
                <span className="sub">계획 {r.plan}% · 실제 {hasRecords ? `${r.actual}%` : '—'}</span>
                <span className="diff">{hasRecords ? fmtDiff(r.actual - r.plan) : ''}</span>
              </li>
            ))}
            {extra.map((r) => (
              <li key={r.key}>
                <span className="dot" style={{ background: r.color }} />
                <span className="name" style={{ flex: 'none' }}>{r.name}</span>
                <span className="sub">계획 없음 · 실제 {r.actual}%</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="total">{hasRecords ? fmtMinutes(total) : '아직 기록이 없어'}</p>
          <ul className="hbars">
            {[...rows, ...extra].map((r) => {
              const max = Math.max(...[...rows, ...extra].map((x) => x.min), 1)
              return (
                <li key={r.key}>
                  <span className="name"><span className="dot" style={{ background: r.color }} /> {r.name}</span>
                  <span className="track"><span className="fill" style={{ width: `${(r.min / max) * 100}%`, background: r.color }} /></span>
                  <span className="sub">{fmtMinutes(r.min)}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <footer className="row">
        <button type="button" className="primary" onClick={onWrite}>기록하기</button>
      </footer>
    </main>
  )
}

/** 띠그래프. named 조각에만 이름을 붙이고, 나머지는 자리가 있으면 %만 */
function Bar({ slices, named }: { slices: { key: string; name: string; ratio: number; color: string }[]; named?: string }) {
  return (
    <div className="band" role="img" aria-label={slices.map((s) => `${s.name} ${s.ratio}%`).join(', ')}>
      {slices.map((s) => (
        <span key={s.key} style={{ flex: `${s.ratio} 1 0`, background: s.color }} aria-hidden="true">
          {s.key === named ? <>{s.name}<br />{s.ratio}%</> : s.ratio >= 10 ? `${s.ratio}%` : ''}
        </span>
      ))}
    </div>
  )
}

function Empty({ onWrite }: { onWrite: () => void }) {
  return (
    <p className="hint">
      아직 기록이 없어. <button type="button" className="link" onClick={onWrite}>기록하기</button>
    </p>
  )
}
