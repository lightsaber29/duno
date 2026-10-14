import { useEffect, useMemo, useState } from 'react'
import { Dial } from '../components/Dial'
import { COLORS, OTHER_COLOR } from '../lib/colors'
import { actualRatios, totalMinutes } from '../lib/ratio'
import { fmtDiff, fmtMinutes, localDate } from '../lib/format'
import type { PlanData } from '../lib/db'

const PREV_COLOR = '#cfcfcf'

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
  const over = rows.filter((r) => r.actual > r.plan).map((r) => r.name)

  const planSlices = rows.map((r) => ({ key: r.key, name: r.name, ratio: r.plan, color: r.color }))
  const actualSlices = [...rows, ...extra].filter((r) => r.actual > 0).map((r) => ({ key: r.key, name: r.name, ratio: r.actual, color: r.color }))

  return (
    <main className="screen">
      <h1>{data.plan.goal}</h1>
      <div className="row">
        <div className="seg">
          <button type="button" className={period === 'week' ? 'on' : ''} onClick={() => setPeriod('week')}>최근 1주</button>
          <button type="button" className={period === 'all' ? 'on' : ''} onClick={() => setPeriod('all')}>총 시간</button>
        </div>
        {period === 'week' && (
          <div className="seg">
            <button type="button" className={chart === 'bar' ? 'on' : ''} onClick={() => setChart('bar')}>띠</button>
            <button type="button" className={chart === 'pie' ? 'on' : ''} onClick={() => setChart('pie')}>원</button>
          </div>
        )}
      </div>

      {period === 'week' ? (
        <>
          {chart === 'bar' ? (
            <div className="bars">
              <small>계획</small>
              <Bar slices={planSlices} />
              <small>실제</small>
              {hasRecords ? <Bar slices={actualSlices} /> : <Empty onWrite={onWrite} />}
            </div>
          ) : (
            <div className="pies">
              <div><small>계획</small><Dial slices={planSlices} selected={null} onSelect={() => {}} onDrag={() => {}} size={150} /></div>
              <div><small>실제</small>{hasRecords ? <Dial slices={actualSlices} selected={null} onSelect={() => {}} onDrag={() => {}} size={150} /> : <Empty onWrite={onWrite} />}</div>
            </div>
          )}
          <ul className="ratio-list">
            {rows.map((r) => (
              <li key={r.key}>
                <span className="dot" style={{ background: r.color }} />
                <span className="name">{r.name}</span>
                <span className="sub">계획 {r.plan}% · 실제 {hasRecords ? `${r.actual}%` : '—'}</span>
                <strong className="diff">{hasRecords ? fmtDiff(r.actual - r.plan) : ''}</strong>
              </li>
            ))}
            {extra.map((r) => (
              <li key={r.key}>
                <span className="dot" style={{ background: r.color }} />
                <span className="name">{r.name}</span>
                <span className="sub">계획 없음 · 실제 {r.actual}%</span>
              </li>
            ))}
          </ul>
          {over.length > 0 && <p className="hint">{over.join(', ')}에 계획보다 시간을 더 썼어요.</p>}
        </>
      ) : (
        <>
          <p className="total">{hasRecords ? fmtMinutes(total) : '아직 기록이 없어요'}</p>
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

function Bar({ slices }: { slices: { key: string; name: string; ratio: number; color: string }[] }) {
  return (
    <div className="bar">
      {slices.map((s) => (
        <span key={s.key} style={{ width: `${s.ratio}%`, background: s.color }} title={`${s.name} ${s.ratio}%`}>
          {s.ratio >= 12 ? s.name : ''}
        </span>
      ))}
    </div>
  )
}

function Empty({ onWrite }: { onWrite: () => void }) {
  return (
    <p className="hint">
      아직 기록이 없어요. <button type="button" className="link" onClick={onWrite}>기록하기</button>
    </p>
  )
}
